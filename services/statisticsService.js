const { executeQuery } = require("../config/database");
const stateManager = require("../server-state-manager");

class StatisticsService {
  // Get comprehensive leaderboard with detailed stats
  async getLeaderboard() {
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
      GROUP BY t.id, t.name, t.current_position, t.total_score, t.created_at
      ORDER BY t.total_score DESC, t.current_position DESC, t.created_at ASC
    `);

    return {
      success: true,
      data: leaderboard,
    };
  }

  // Get game statistics
  async getGameStats() {
    // Get real-time data from stateManager
    const gameState = stateManager.getGameState();
    const allTeamsState = stateManager.getAllTeams();

    // Get total teams
    const totalTeams = await executeQuery(
      "SELECT COUNT(*) as count FROM teams"
    );

    // Get active teams (teams that have made at least one decision)
    const activeTeams = await executeQuery(`
      SELECT COUNT(DISTINCT team_id) as count
      FROM team_decisions
    `);

    // Get completed teams from stateManager (real-time)
    const completedTeamsCount = allTeamsState.filter(
      (t) => t.currentPosition > 7
    ).length;

    // Get average score from stateManager (real-time)
    const teamsWithScore = allTeamsState.filter((t) => t.totalScore > 0);
    const avgScoreRealtime =
      teamsWithScore.length > 0
        ? teamsWithScore.reduce((sum, t) => sum + t.totalScore, 0) /
          teamsWithScore.length
        : 0;

    // Get scenario completion rates
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
      GROUP BY gs.position, gs.title
      ORDER BY gs.position
    `);

    const state = await executeQuery(
      "SELECT * FROM game_status LIMIT 1"
    );

    return {
      success: true,
      data: {
        totalTeams: totalTeams[0].count,
        activeTeams: activeTeams[0].count,
        completedTeams: completedTeamsCount,
        averageScore: avgScoreRealtime,
        scenarioStats,
        // Include global game state
        gameState: state[0].status == 'menunggu' ? 'waiting' : state[0].status == 'mulai' ? 'running' : 'ended',
        currentStep: state[0].posisi,
        connectedTeamsCount: gameState.connectedTeamsCount,
      },
    };
  }
}

module.exports = new StatisticsService();