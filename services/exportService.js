const { executeQuery } = require("../config/database");

class ExportService {
  // Export team data to CSV format
  async exportTeams() {
    const teams = await executeQuery(`
      SELECT
        t.id,
        t.name as team_name,
        t.current_position,
        t.total_score,
        t.created_at,
        COUNT(p.id) as player_count,
        GROUP_CONCAT(p.name SEPARATOR '; ') as players
      FROM teams t
      LEFT JOIN players p ON t.id = p.team_id
      GROUP BY t.id, t.name, t.current_position, t.total_score, t.created_at
      ORDER BY t.total_score DESC, t.current_position DESC
    `);

    // Convert to CSV format
    const csvHeader =
      "ID,Team Name,Current Position,Total Score,Player Count,Players,Created At\n";
    const csvRows = teams
      .map(
        (team) =>
          `${team.id},"${team.team_name}",${team.current_position},${team.total_score},${team.player_count},"${team.players}","${team.created_at}"`
      )
      .join("\n");

    return csvHeader + csvRows;
  }

  // Export decisions data to CSV format
  async exportDecisions() {
    const decisions = await executeQuery(`
      SELECT
        td.id,
        t.name as team_name,
        td.position,
        gs.title as scenario_title,
        td.decision,
        td.reasoning,
        td.score,
        td.created_at
      FROM team_decisions td
      JOIN teams t ON td.team_id = t.id
      JOIN game_scenarios gs ON td.position = gs.position
      ORDER BY td.position, td.score DESC
    `);

    // Convert to CSV format
    const csvHeader =
      "ID,Team Name,Position,Scenario Title,Decision,Reasoning,Score,Created At\n";
    const csvRows = decisions
      .map(
        (decision) =>
          `${decision.id},"${decision.team_name}",${decision.position},"${
            decision.scenario_title
          }","${decision.decision.replace(
            /"/g,
            '""'
          )}","${decision.reasoning.replace(/"/g, '""')}",${decision.score},"${
            decision.created_at
          }"`
      )
      .join("\n");

    return csvHeader + csvRows;
  }
}

module.exports = new ExportService();