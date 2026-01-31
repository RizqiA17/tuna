const { executeQuery } = require("../config/database");

class AdminScenarioService {
  // Get all decisions for a specific scenario/position
  async getScenarioDecisions(position) {
    if (position < 1 || position > 7) {
      throw new Error("Invalid scenario position");
    }

    // Get scenario info
    const scenario = await executeQuery(
      "SELECT * FROM game_scenarios WHERE position = ?",
      [position]
    );

    if (!scenario.length) {
      throw new Error("Scenario not found");
    }

    // Get all team decisions for this scenario
    const decisions = await executeQuery(
      `
    SELECT
      td.*,
      t.name as team_name,
      t.current_position,
      t.total_score
    FROM team_decisions td
    JOIN teams t ON td.team_id = t.id
    WHERE td.position = ?
    ORDER BY td.score DESC, td.created_at ASC
  `,
      [position]
    );

    return {
      success: true,
      data: {
        scenario: scenario[0],
        decisions,
      },
    };
  }
}

module.exports = new AdminScenarioService();