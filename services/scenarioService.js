const { executeQuery } = require("../config/database");
const { getGameSetting } = require("../utils/gameUtils");

class ScenarioService {

    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT * FROM game_containers WHERE is_active = 1 LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container found");
        }

        return container[0];
    }

    // Get specific scenario
    async getScenario(position, teamId) {
        if (position < 1 || position > 7) {
            throw new Error("Invalid scenario position");
        }

        const container = await this.getActiveContainer();

        const teamCheck = await executeQuery(
            "SELECT id FROM teams WHERE id = ? AND game_container_id = ?",
            [teamId, container.id]
        );

        if (!teamCheck.length) {
            throw new Error("Team not in active container");
        }

        const existingDecision = await executeQuery(
            "SELECT id FROM team_decisions WHERE team_id = ? AND position = ?",
            [teamId, position]
        );

        if (existingDecision.length > 0) {
            throw new Error("This scenario has already been completed");
        }

        const scenario = await executeQuery(
            "SELECT position, title, scenario_text as scenarioText FROM game_scenarios WHERE position = ?",
            [position]
        );

        if (!scenario.length) {
            throw new Error("Scenario not found");
        }

        return {
            success: true,
            data: scenario[0],
            containerId: container.id
        };
    }

    // Get next scenario
    async getNextScenario(team) {
        const container = await this.getActiveContainer();

        const teamDb = await executeQuery(
            "SELECT current_position FROM teams WHERE id = ? AND game_container_id = ?",
            [team.id, container.id]
        );

        if (!teamDb.length) {
            throw new Error("Team not in active container");
        }

        const nextScenario = await executeQuery(
            "SELECT * FROM game_scenarios WHERE position = ?",
            [teamDb[0].current_position]
        );

        const timeLimit = parseInt(
            await getGameSetting("answer_time_limit", "900")
        );

        if (nextScenario.length > 0) {
            return {
                success: true,
                scenario: {
                    position: nextScenario[0].position,
                    title: nextScenario[0].title,
                    scenarioText: nextScenario[0].scenario_text,
                },
                timeLimit: timeLimit,
                containerId: container.id
            };
        } else {
            return {
                success: true,
                scenario: null,
                message: "Game completed!",
                containerId: container.id
            };
        }
    }
}

module.exports = new ScenarioService();
