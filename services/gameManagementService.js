const { executeQuery } = require("../config/database");
const stateManager = require("../server-state-manager");

class GameManagementService {
  // Get game status
  async getGameStatus() {
    const status = await executeQuery(
      "SELECT status FROM game_status LIMIT 1"
    );

    return {
      success: true,
      data: {
        status: status[0].status == "menunggu" ? "waiting" : status[0].status == "mulai" ? "running" : "ended",
      },
    };
  }

  // Update game status
  async updateGameStatus(status) {
    if (!["menunggu", "mulai", "selesai"].includes(status)) {
      throw new Error("Invalid game status");
    }

    await executeQuery("UPDATE game_status SET status = ?", [status]);

    // Update game status in state manager
    stateManager.updateGameState(
      status == "menunggu" ? "waiting" : status == "mulai" ? "running" : "ended"
    );

    return {
      success: true,
      message: "Game status updated successfully",
      data: { status },
    };
  }

  // Get game position
  async getGamePosition() {
    const status = await executeQuery(
      "SELECT posisi FROM game_status LIMIT 1"
    );

    return {
      success: true,
      data: {
        position: status[0].posisi,
      },
    };
  }

  // Update game position
  async updateGamePosition(position) {
    if (typeof position !== "number" || position < 0 || position > 7) {
      throw new Error("Invalid game position");
    }

    await executeQuery("UPDATE game_status SET posisi = ?", [position]);

    return {
      success: true,
      message: "Game position updated successfully",
      data: { position },
    };
  }

  // Reset game for all teams
  async resetGame() {
    const { getConnection } = require("../config/database");
    const connection = await getConnection();

    await connection.beginTransaction();

    try {
      // Reset all teams to position 1 and score 0
      await connection.execute(
        "UPDATE teams SET current_position = 1, total_score = 0"
      );

      await connection.execute("UPDATE game_status SET status = 'menunggu', posisi = 0");

      // Clear all team decisions
      await connection.execute("DELETE FROM team_decisions");

      await connection.commit();

      return {
        success: true,
        message: "Game reset successfully for all teams",
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new GameManagementService();