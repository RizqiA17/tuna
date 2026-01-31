const { executeQuery } = require("../config/database");
const stateManager = require("../server-state-manager");
const { getGameSetting } = require("../utils/gameUtils");

class GameService {
  // Start game - initialize or reset game state
  async startGame(team) {
    // Check if game is already in progress
    if (team.current_position > 1) {
      throw new Error("Game already in progress. Use /status to get current state.");
    }

    // Get first scenario
    const scenario = await executeQuery(
      "SELECT * FROM game_scenarios WHERE position = 1"
    );

    if (!scenario.length) {
      throw new Error("Game scenarios not found");
    }

    // Get time limit from database settings
    const timeLimit = parseInt(
      await getGameSetting("answer_time_limit", "900")
    );

    return {
      success: true,
      message: "Game started successfully",
      scenario: {
        position: scenario[0].position,
        title: scenario[0].title,
        scenarioText: scenario[0].scenario_text,
      },
      timeLimit: timeLimit,
    };
  }

  // Get global game status
  async getGameStatus() {
    const response = await executeQuery(
      "SELECT status FROM game_status WHERE id = 1 FOR UPDATE"
    );

    return {
      success: true,
      data: {
        status: response.length > 0 ? response[0].status : null,
      },
    };
  }

  // Get current game status for a team
  async getStatus(team) {
    // Get global game state
    const gameState = stateManager.getGameState();
    const game = await executeQuery(
      "SELECT * FROM game_status WHERE id = 1 FOR UPDATE"
    );

    // Get team data from stateManager (priority), fallback to database
    let teamData = stateManager.getTeam(team.id);
    if (!teamData) {
      // Fallback to database
      const dbTeam = await executeQuery(
        "SELECT id, name, current_position, total_score FROM teams WHERE id = ?",
        [team.id]
      );
      if (dbTeam.length > 0) {
        teamData = stateManager.createOrUpdateTeam(team.id, {
          name: dbTeam[0].name,
          currentPosition: game[0].position,
          totalScore: dbTeam[0].total_score,
        });
      } else {
        teamData = {
          name: team.name,
          currentPosition: game[0].position,
          totalScore: team.total_score,
        };
      }
    }

    const teamDb = await executeQuery(
      "SELECT id, name, current_position, total_score FROM teams WHERE id = ?",
      [team.id]
    );

    // Get completed decisions
    const decisions = await executeQuery(
      "SELECT position, score FROM team_decisions WHERE team_id = ? ORDER BY position",
      [team.id]
    );

    // Get current scenario if not completed
    let currentScenario = null;
    if (teamData.currentPosition <= 7) {
      const scenario = await executeQuery(
        "SELECT * FROM game_scenarios WHERE position = ?",
        [game[0].posisi]
      );

      if (scenario.length > 0) {
        currentScenario = {
          position: scenario[0].position,
          title: scenario[0].title,
          scenarioText: scenario[0].scenario_text,
        };
      }
    }

    // Get time limit from database settings
    const timeLimit = parseInt(
      await getGameSetting("answer_time_limit", "900")
    );

    return {
      success: true,
      data: {
        game: game[0],
        teamName: teamData.name,
        currentPosition: game[0].posisi,
        totalScore: teamData.totalScore,
        isGameComplete: teamData.currentPosition > 7,
        completedDecisions: decisions,
        currentScenario,
        timeLimit: timeLimit,
        // Include global game state
        globalGameState: gameState.status,
        globalCurrentStep: gameState.currentStep,
        completeCurrentStep: teamDb[0].current_position > game[0].posisi,
        team: teamDb[0],
      },
    };
  }
}

module.exports = new GameService();