const { executeQuery } = require("../config/database");

class AdminScenarioService {
    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT id FROM game_containers WHERE is_active = true LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container");
        }

        return container[0].id;
    }

    // Get all decisions for a specific scenario/position (container based)
    async getScenarioDecisions(position) {
        if (position < 1 || position > 7) {
            throw new Error("Invalid scenario position");
        }

        const activeContainerId = await this.getActiveContainer();

        // Get scenario info
        const scenario = await executeQuery(
            "SELECT * FROM game_scenarios WHERE position = ?",
            [position]
        );

        if (!scenario.length) {
            throw new Error("Scenario not found");
        }

        // Get all team decisions for this scenario in active container
        const decisions = await executeQuery(
            `
            SELECT
                td.*,
                t.name AS team_name,
                t.current_position,
                t.total_score
            FROM team_decisions td
            JOIN teams t ON td.team_id = t.id
            WHERE td.position = ?
                AND t.game_container_id = ?
            ORDER BY td.score DESC, td.created_at ASC
            `,
            [position, activeContainerId]
        );

        return {
            success: true,
            data: {
                scenario: scenario[0],
                decisions
            }
        };
    }
}

module.exports = new AdminScenarioService();
