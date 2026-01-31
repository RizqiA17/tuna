const { executeQuery } = require("../config/database");
const stateManager = require("../server-state-manager");

class LeaderboardService {
  // Get team rank
  async getTeamRank(teamId) {
    // Ambil data tim
    const team = await executeQuery(
      "SELECT id, name, current_position, total_score FROM teams WHERE id = ?",
      [teamId]
    );

    if (!team.length) {
      throw new Error("Team not found");
    }

    // Ambil nilai score & posisi dari tim
    const teamTotalScore = team[0].total_score;
    const teamCurrentPosition = team[0].current_position;

    // Hitung ranking tim ini
    const rankResult = await executeQuery(
      `
        SELECT COUNT(*) + 1 AS team_rank
        FROM teams
        WHERE (total_score > ?)
          OR (total_score = ? AND current_position > ?)
      `,
      [teamTotalScore, teamTotalScore, teamCurrentPosition]
    );

    const teamRank = rankResult[0]?.team_rank || 1;

    // Opsional: total jumlah tim
    const totalTeamsResult = await executeQuery(
      "SELECT COUNT(*) AS total FROM teams"
    );
    const totalTeams = totalTeamsResult[0].total;

    return {
      success: true,
      data: {
        teamId: team[0].id,
        teamName: team[0].name,
        rank: teamRank,
        totalTeams: totalTeams, // "Rank X dari Y tim"
      },
    };
  }

  // Get leaderboard
  async getLeaderboard() {
    // Combine data from stateManager (real-time) and database
    const allTeams = stateManager.getAllTeams();

    // Get player counts from database
    const leaderboard = await executeQuery(`
      SELECT
        t.id,
        t.name as team_name,
        t.total_score,
        t.current_position,
        COUNT(p.id) as player_count
      FROM teams t
      LEFT JOIN players p ON t.id = p.team_id
      GROUP BY t.id, t.name, t.total_score, t.current_position
      ORDER BY t.total_score DESC, t.current_position DESC
      LIMIT 10
    `);

    // Merge with real-time data from stateManager
    const mergedLeaderboard = leaderboard.map((dbTeam) => {
      const stateTeam = allTeams.find((t) => t.id === dbTeam.id);
      if (stateTeam) {
        // Use stateManager data for real-time scores
        return {
          ...dbTeam,
          total_score: stateTeam.totalScore,
          current_position: stateTeam.currentPosition,
        };
      }
      return dbTeam;
    });

    // Sort again after merge
    mergedLeaderboard.sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      return b.current_position - a.current_position;
    });

    return {
      success: true,
      data: mergedLeaderboard.slice(0, 10),
    };
  }
}

module.exports = new LeaderboardService();