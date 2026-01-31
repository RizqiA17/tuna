const { executeQuery } = require("../config/database");
const stateManager = require("../server-state-manager");

class TeamService {

    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT * FROM game_containers WHERE is_active = 1 LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container found");
        }

        return container[0];
    }

    // Get all teams with their progress and scores
    async getAllTeams() {
        const container = await this.getActiveContainer();

        const teams = await executeQuery(`
            SELECT
                t.id,
                t.name as team_name,
                t.current_position,
                t.total_score,
                t.created_at,
                COUNT(p.id) as player_count,
                GROUP_CONCAT(p.name SEPARATOR ', ') as players
            FROM teams t
            LEFT JOIN players p ON t.id = p.team_id
            WHERE t.game_container_id = ?
            GROUP BY t.id, t.name, t.current_position, t.total_score, t.created_at
            ORDER BY t.total_score DESC, t.current_position DESC
        `, [container.id]);

        const allTeamsState = stateManager.getAllTeams()
            .filter((t) => t.game_container_id === container.id || t.containerId === container.id);

        const connectedTeams = stateManager.getConnectedTeams();

        const mergedTeams = teams.map((dbTeam) => {
            const stateTeam = allTeamsState.find((t) => t.id === dbTeam.id);
            const isConnected = connectedTeams.has(dbTeam.id);

            if (stateTeam) {
                return {
                    ...dbTeam,
                    current_position: stateTeam.currentPosition,
                    total_score: stateTeam.totalScore,
                    is_connected: isConnected,
                };
            }

            return {
                ...dbTeam,
                is_connected: isConnected,
            };
        });

        mergedTeams.sort((a, b) => {
            if (b.total_score !== a.total_score) {
                return b.total_score - a.total_score;
            }
            return b.current_position - a.current_position;
        });

        return {
            success: true,
            data: mergedTeams,
            containerId: container.id
        };
    }

    // Get detailed team data with all decisions
    async getTeamDetails(teamId) {
        const container = await this.getActiveContainer();

        const teamInfo = await executeQuery(
            "SELECT * FROM teams WHERE id = ? AND game_container_id = ?",
            [teamId, container.id]
        );

        if (!teamInfo.length) {
            throw new Error("Team not found in active container" + teamId + container.id);
        }

        const players = await executeQuery(
            "SELECT * FROM players WHERE team_id = ?",
            [teamId]
        );

        const decisions = await executeQuery(`
            SELECT
                td.*,
                gs.title as scenario_title,
                gs.scenario_text,
                gs.standard_answer,
                gs.standard_reasoning,
                gs.max_score
            FROM team_decisions td
            JOIN game_scenarios gs ON td.position = gs.position
            WHERE td.team_id = ?
            ORDER BY td.position
        `, [teamId]);

        return {
            success: true,
            data: {
                team: teamInfo[0],
                players,
                decisions,
            },
            containerId: container.id
        };
    }
}

module.exports = new TeamService();
