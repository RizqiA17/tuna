const { executeQuery } = require("../config/database");
const { getGameSetting } = require("../utils/gameUtils");

class ScenarioService {
  // Get specific scenario
  async getScenario(position, teamId) {
    if (position < 1 || position > 7) {
      throw new Error("Invalid scenario position");
    }

    // Check if already completed
    const existingDecision = await executeQuery(
      "SELECT id FROM team_decisions WHERE team_id = ? AND position = ?",
      [teamId, position]
    );

    if (existingDecision.length > 0) {
      throw new Error("This scenario has already been completed");
    }

    // Get scenario
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
    };
  }

  // Get next scenario
  async getNextScenario(team) {
    // Get next scenario
    const nextScenario = await executeQuery(
      "SELECT * FROM game_scenarios WHERE position = ?",
      [team.current_position]
    );

    // Get time limit from database settings
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
      };
    } else {
      // Game finished
      return {
        success: true,
        scenario: null,
        message: "Game completed!",
      };
    }
  }
}

module.exports = new ScenarioService();