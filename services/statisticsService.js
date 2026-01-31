const { executeQuery } = require("../config/database");
const stateManager = require("../server-state-manager");

class StatisticsService {

    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT * FROM game_containers WHERE is_active = 1 LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container found");
        }

        return container[0];
    }

    // Get comprehensive leaderboard with detailed stats
    async getLeaderboard() {
        const container = await this.getActiveContainer();

        const leaderboard = await executeQuery(`
            SELECT
                t.id,
                t.name as team_name,
                t.current_position,
                t.total_score,
                t.created_at,
                COUNT(p.id) as player_count,
                COUNT(td.id) as completed_scenarios,
                AVG(td.score) as average_score,
                MAX(td.created_at) as last_activity
            FROM teams t
            LEFT JOIN players p ON t.id = p.team_id
            LEFT JOIN team_decisions td ON t.id = td.team_id
            WHERE t.game_container_id = ?
            GROUP BY t.id, t.name, t.current_position, t.total_score, t.created_at
            ORDER BY t.total_score DESC, t.current_position DESC, t.created_at ASC
        `, [container.id]);

        return {
            success: true,
            data: leaderboard,
            containerId: container.id
        };
    }

    // Get game statistics
    async getGameStats() {
        const container = await this.getActiveContainer();

        const gameState = stateManager.getGameState();

        const allTeamsState = stateManager.getAllTeams()
            .filter((t) => t.game_container_id === container.id || t.containerId === container.id);

        const totalTeams = await executeQuery(
            "SELECT COUNT(*) as count FROM teams WHERE game_container_id = ?",
            [container.id]
        );

        const activeTeams = await executeQuery(`
            SELECT COUNT(DISTINCT td.team_id) as count
            FROM team_decisions td
            JOIN teams t ON td.team_id = t.id
            WHERE t.game_container_id = ?
        `, [container.id]);

        const completedTeamsCount = allTeamsState.filter(
            (t) => t.currentPosition > 7
        ).length;

        const teamsWithScore = allTeamsState.filter((t) => t.totalScore > 0);

        const avgScoreRealtime =
            teamsWithScore.length > 0
                ? teamsWithScore.reduce((sum, t) => sum + t.totalScore, 0) /
                  teamsWithScore.length
                : 0;

        const scenarioStats = await executeQuery(`
            SELECT
                gs.position,
                gs.title,
                COUNT(td.id) as completion_count,
                AVG(td.score) as average_score,
                MAX(td.score) as max_score,
                MIN(td.score) as min_score
            FROM game_scenarios gs
            LEFT JOIN team_decisions td ON gs.position = td.position
            LEFT JOIN teams t ON td.team_id = t.id
            WHERE t.game_container_id = ? OR t.id IS NULL
            GROUP BY gs.position, gs.title
            ORDER BY gs.position
        `, [container.id]);

        const state = await executeQuery(
            "SELECT status, posisi FROM game_containers WHERE id = ? LIMIT 1",
            [container.id]
        );

        return {
            success: true,
            data: {
                totalTeams: totalTeams[0].count,
                activeTeams: activeTeams[0].count,
                completedTeams: completedTeamsCount,
                averageScore: avgScoreRealtime,
                scenarioStats,
                gameState:
                    state[0].status == "menunggu"
                        ? "waiting"
                        : state[0].status == "mulai"
                        ? "running"
                        : "ended",
                currentStep: state[0].posisi,
                connectedTeamsCount: gameState.connectedTeamsCount,
                containerId: container.id
            },
        };
    }
}

module.exports = new StatisticsService();
