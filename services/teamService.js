const { executeQuery } = require("../config/database");
const stateManager = require("../server-state-manager");

class TeamService {
  // Get all teams with their progress and scores
  async getAllTeams() {
    // Get teams from database for player info
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
      GROUP BY t.id, t.name, t.current_position, t.total_score, t.created_at
      ORDER BY t.total_score DESC, t.current_position DESC
    `);

    // Merge with real-time data from stateManager
    const allTeamsState = stateManager.getAllTeams();
    const connectedTeams = stateManager.getConnectedTeams();

    const mergedTeams = teams.map((dbTeam) => {
      const stateTeam = allTeamsState.find((t) => t.id === dbTeam.id);
      const isConnected = connectedTeams.has(dbTeam.id);

      if (stateTeam) {
        // Use real-time data from stateManager
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

    // Sort by real-time scores
    mergedTeams.sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      return b.current_position - a.current_position;
    });

    return {
      success: true,
      data: mergedTeams,
    };
  }

  // Get detailed team data with all decisions
  async getTeamDetails(teamId) {
    // Get team basic info
    const teamInfo = await executeQuery("SELECT * FROM teams WHERE id = ?", [
      teamId,
    ]);

    if (!teamInfo.length) {
      throw new Error("Team not found");
    }

    // Get team players
    const players = await executeQuery(
      "SELECT * FROM players WHERE team_id = ?",
      [teamId]
    );

    // Get all team decisions
    const decisions = await executeQuery(
      `
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
    `,
      [teamId]
    );

    return {
      success: true,
      data: {
        team: teamInfo[0],
        players,
        decisions,
      },
    };
  }
}

module.exports = new TeamService();