const { executeQuery } = require("../config/database");
const stateManager = require("../server-state-manager");

class LeaderboardService {

    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT * FROM game_containers WHERE is_active = 1 LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container found");
        }

        return container[0];
    }

    // Get team rank
    async getTeamRank(teamId) {
        const container = await this.getActiveContainer();

        const team = await executeQuery(
            "SELECT id, name, current_position, total_score FROM teams WHERE id = ? AND game_container_id = ?",
            [teamId, container.id]
        );

        if (!team.length) {
            throw new Error("Team not found in active container");
        }

        const teamTotalScore = team[0].total_score;
        const teamCurrentPosition = team[0].current_position;

        const rankResult = await executeQuery(
            `
            SELECT COUNT(*) + 1 AS team_rank
            FROM teams
            WHERE game_container_id = ?
              AND (
                    total_score > ?
                 OR (total_score = ? AND current_position > ?)
              )
            `,
            [container.id, teamTotalScore, teamTotalScore, teamCurrentPosition]
        );

        const teamRank = rankResult[0]?.team_rank || 1;

        const totalTeamsResult = await executeQuery(
            "SELECT COUNT(*) AS total FROM teams WHERE game_container_id = ?",
            [container.id]
        );

        const totalTeams = totalTeamsResult[0].total;

        return {
            success: true,
            data: {
                teamId: team[0].id,
                teamName: team[0].name,
                rank: teamRank,
                totalTeams: totalTeams,
                containerId: container.id
            },
        };
    }

    // Get leaderboard
    async getLeaderboard() {
        const container = await this.getActiveContainer();

        const allTeams = stateManager.getAllTeams()
            .filter((t) => t.game_container_id === container.id || t.containerId === container.id);

        const leaderboard = await executeQuery(`
            SELECT
                t.id,
                t.name as team_name,
                t.total_score,
                t.current_position,
                COUNT(p.id) as player_count
            FROM teams t
            LEFT JOIN players p ON t.id = p.team_id
            WHERE t.game_container_id = ?
            GROUP BY t.id, t.name, t.total_score, t.current_position
            ORDER BY t.total_score DESC, t.current_position DESC
            LIMIT 10
        `, [container.id]);

        const mergedLeaderboard = leaderboard.map((dbTeam) => {
            const stateTeam = allTeams.find((t) => t.id === dbTeam.id);
            if (stateTeam) {
                return {
                    ...dbTeam,
                    total_score: stateTeam.totalScore,
                    current_position: stateTeam.currentPosition,
                };
            }
            return dbTeam;
        });

        mergedLeaderboard.sort((a, b) => {
            if (b.total_score !== a.total_score) {
                return b.total_score - a.total_score;
            }
            return b.current_position - a.current_position;
        });

        return {
            success: true,
            data: mergedLeaderboard.slice(0, 10),
            containerId: container.id
        };
    }
}

module.exports = new LeaderboardService();
