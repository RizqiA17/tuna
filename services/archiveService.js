const { getConnection } = require("../config/database");
const stateManager = require("../server-state-manager");

class ArchiveService {
  // Archive current session to database
  async archiveSession() {
    const gameState = stateManager.getGameState();

    // Check if game has ended
    if (gameState.status !== "ended") {
      throw new Error("Can only archive when game has ended");
    }

    const allTeams = stateManager.getAllTeams();

    // Archive all team decisions that haven't been saved yet
    let archivedCount = 0;
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      for (const team of allTeams) {
        // Update final team state in database
        await connection.execute(
          "UPDATE teams SET current_position = ?, total_score = ?, updated_at = NOW() WHERE id = ?",
          [team.currentPosition, team.totalScore, team.id]
        );

        // Archive decisions if they exist in stateManager but not in database
        if (team.decisions && team.decisions.length > 0) {
          for (const decision of team.decisions) {
            // Check if decision already exists
            const [existing] = await connection.execute(
              "SELECT id FROM team_decisions WHERE team_id = ? AND position = ?",
              [team.id, decision.position]
            );

            if (existing.length === 0) {
              // Insert new decision
              await connection.execute(
                `INSERT INTO team_decisions
                (team_id, position, decision_text, reasoning_text, score, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  team.id,
                  decision.position,
                  decision.decision || "",
                  decision.reasoning || "",
                  decision.score || 0,
                  decision.timestamp || new Date().toISOString(),
                ]
              );
              archivedCount++;
            }
          }
        }
      }

      await connection.commit();

      const result = {
        success: true,
        message: "Session archived successfully",
        data: {
          teamsArchived: allTeams.length,
          decisionsArchived: archivedCount,
          sessionStarted: gameState.sessionStarted,
          archivedAt: new Date().toISOString(),
        },
      };

      console.log(
        `📦 Archived session: ${allTeams.length} teams, ${archivedCount} new decisions`
      );

      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new ArchiveService();