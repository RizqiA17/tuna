const { executeQuery, getConnection } = require("../config/database");
const stateManager = require("../server-state-manager");
const { getGameSetting, calculateScore } = require("../utils/gameUtils");

class GameController {
  // Start game - initialize or reset game state
  async startGame(req, res) {
    try {
      const team = req.team;

      // Check if game is already in progress
      if (team.current_position > 1) {
        return res.status(409).json({
          success: false,
          message: "Game already in progress. Use /status to get current state.",
        });
      }

      // Get first scenario
      const scenario = await executeQuery(
        "SELECT * FROM game_scenarios WHERE position = 1"
      );

      if (!scenario.length) {
        return res.status(404).json({
          success: false,
          message: "Game scenarios not found",
        });
      }

      // Get time limit from database settings
      const timeLimit = parseInt(
        await getGameSetting("answer_time_limit", "900")
      );

      res.json({
        success: true,
        message: "Game started successfully",
        scenario: {
          position: scenario[0].position,
          title: scenario[0].title,
          scenarioText: scenario[0].scenario_text,
        },
        timeLimit: timeLimit,
      });
    } catch (error) {
      console.error("Start game error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get global game status
  async getGameStatus(req, res) {
    try {
      const response = await executeQuery(
        "SELECT status FROM game_status WHERE id = 1 FOR UPDATE"
      );

      res.json({
        success: true,
        data: {
          status: response.length > 0 ? response[0].status : null,
        },
      });
    } catch (error) {
      console.error("Get game status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get current game status for a team
  async getStatus(req, res) {
    try {
      // Get global game state
      const gameState = stateManager.getGameState();
      const team = req.team;

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

      res.json({
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
      });
    } catch (error) {
      console.error("Get game status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get specific scenario
  async getScenario(req, res) {
    try {
      const position = parseInt(req.params.position);

      if (position < 1 || position > 7) {
        return res.status(400).json({
          success: false,
          message: "Invalid scenario position",
        });
      }

      // Check if already completed
      const existingDecision = await executeQuery(
        "SELECT id FROM team_decisions WHERE team_id = ? AND position = ?",
        [req.team.id, position]
      );

      if (existingDecision.length > 0) {
        return res.status(409).json({
          success: false,
          message: "This scenario has already been completed",
        });
      }

      // Get scenario
      const scenario = await executeQuery(
        "SELECT position, title, scenario_text FROM game_scenarios WHERE position = ?",
        [position]
      );

      if (!scenario.length) {
        return res.status(404).json({
          success: false,
          message: "Scenario not found",
        });
      }

      res.json({
        success: true,
        data: scenario[0],
      });
    } catch (error) {
      console.error("Get scenario error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get team rank
  async getTeamRank(req, res) {
    try {
      const { teamId } = req.params;

      // Ambil data tim
      const team = await executeQuery(
        "SELECT id, name, current_position, total_score FROM teams WHERE id = ?",
        [teamId]
      );

      if (!team.length) {
        return res.status(404).json({
          success: false,
          message: "Team not found",
        });
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

      res.json({
        success: true,
        data: {
          teamId: team[0].id,
          teamName: team[0].name,
          rank: teamRank,
          totalTeams: totalTeams, // "Rank X dari Y tim"
        },
      });
    } catch (error) {
      console.error("Get team rank error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Submit decision for a scenario (with position parameter)
  async submitDecisionWithPosition(req, res) {
    try {
      const position = parseInt(req.params.position);
      const { decision, reasoning } = req.body;

      if (position < 1 || position > 7) {
        return res.status(400).json({
          success: false,
          message: "Invalid scenario position",
        });
      }

      // Check if already completed
      const existingDecision = await executeQuery(
        "SELECT id FROM team_decisions WHERE team_id = ? AND position = ?",
        [req.team.id, position]
      );

      if (existingDecision.length > 0) {
        return res.status(409).json({
          success: false,
          message: "This scenario has already been completed",
        });
      }

      // Get standard answer for scoring
      const scenario = await executeQuery(
        "SELECT standard_answer, standard_reasoning, max_score FROM game_scenarios WHERE position = ?",
        [position]
      );

      if (!scenario.length) {
        return res.status(404).json({
          success: false,
          message: "Scenario not found",
        });
      }

      // Calculate score based on similarity to standard answer
      const score = calculateScore(
        decision,
        reasoning,
        scenario[0].standard_answer,
        scenario[0].standard_reasoning
      );

      // Start transaction
      const connection = await getConnection();
      await connection.beginTransaction();

      try {
        // Save decision
        await connection.execute(
          "INSERT INTO team_decisions (team_id, position, decision, reasoning, score) VALUES (?, ?, ?, ?, ?)",
          [req.team.id, position, decision, reasoning, score]
        );

        // Update team position and total score
        const newPosition = position + 1;
        const newTotalScore = req.team.total_score + score;

        await connection.execute(
          "UPDATE teams SET current_position = ?, total_score = ? WHERE id = ?",
          [newPosition, newTotalScore, req.team.id]
        );

        await connection.commit();

        res.json({
          success: true,
          message: "Decision submitted successfully",
          data: {
            score,
            newPosition,
            newTotalScore,
            isGameComplete: newPosition > 7,
          },
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Submit decision error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Submit decision (without position parameter - for current scenario)
  async submitDecision(req, res) {
    try {
      const team = req.team;
      const { position, decision, argumentation } = req.body;

      // Only require position. Allow decision and argumentation to be empty strings (for auto-submit)
      const positionNum = parseInt(position);
      if (
        !position ||
        position === undefined ||
        position === null ||
        isNaN(positionNum) ||
        positionNum < 1 ||
        positionNum > 7
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid position (1-7) is required",
        });
      }

      // Normalize decision and argumentation to empty strings if missing/undefined/null
      // This allows auto-submit with empty fields
      const normalizedDecision =
        decision !== undefined && decision !== null ? String(decision) : "";
      const normalizedArgumentation =
        argumentation !== undefined && argumentation !== null
          ? String(argumentation)
          : "";

      // Check if already completed
      const existingDecision = await executeQuery(
        "SELECT id FROM team_decisions WHERE team_id = ? AND position = ?",
        [team.id, positionNum]
      );

      if (existingDecision.length > 0) {
        return res.status(409).json({
          success: false,
          message: "This scenario has already been completed",
        });
      }

      // Get standard answer for scoring
      const scenario = await executeQuery(
        "SELECT standard_answer, standard_reasoning, max_score FROM game_scenarios WHERE position = ?",
        [positionNum]
      );

      if (!scenario.length) {
        return res.status(404).json({
          success: false,
          message: "Scenario not found",
        });
      }

      // Calculate score based on similarity to standard answer
      const score = calculateScore(
        normalizedDecision,
        normalizedArgumentation,
        scenario[0].standard_answer,
        scenario[0].standard_reasoning
      );

      // Start transaction
      const connection = await getConnection();
      await connection.beginTransaction();

      try {
        // Save decision (with normalized values - empty strings are allowed)
        await connection.execute(
          "INSERT INTO team_decisions (team_id, position, decision, reasoning, score) VALUES (?, ?, ?, ?, ?)",
          [
            team.id,
            positionNum,
            normalizedDecision,
            normalizedArgumentation,
            score,
          ]
        );

        // Update team position and total score
        const newPosition = positionNum + 1;
        const newTotalScore = team.total_score + score;

        await connection.execute(
          "UPDATE teams SET current_position = ?, total_score = ? WHERE id = ?",
          [newPosition, newTotalScore, team.id]
        );

        await connection.commit();

        // Update stateManager for real-time tracking
        stateManager.addTeamDecision(team.id, {
          position: positionNum,
          decision: normalizedDecision,
          reasoning: normalizedArgumentation,
          score,
          newPosition,
          newTotalScore,
        });

        // Get scenario data for result
        const scenarioData = await executeQuery(
          "SELECT standard_answer, standard_reasoning FROM game_scenarios WHERE position = ?",
          [positionNum]
        );

        res.json({
          success: true,
          message: "Decision submitted successfully",
          team: {
            id: team.id,
            name: team.name,
            current_position: newPosition,
            total_score: newTotalScore,
          },
          result: {
            position: positionNum,
            score: score,
            teamDecision: normalizedDecision,
            teamArgumentation: normalizedArgumentation,
            standardAnswer:
              scenarioData.length > 0
                ? scenarioData[0].standard_answer
                : "Jawaban standar tidak tersedia",
            standardArgumentation:
              scenarioData.length > 0
                ? scenarioData[0].standard_reasoning
                : "Penjelasan tidak tersedia",
          },
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Submit decision error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get decision
  async getDecision(req, res) {
    try {
      const { teamId, position } = req.query;

      const decision = await executeQuery(
        "SELECT position, decision, reasoning, score FROM team_decisions WHERE team_id = ? AND position = ?",
        [teamId, position]
      );

      const standardAnswer = await executeQuery(
        "SELECT standard_answer, standard_reasoning FROM game_scenarios WHERE position = ?",
        [position]
      );

      if (decision.length > 0) {
        res.json({
          success: true,
          data: {
            position: decision[0].position,
            teamDecision: decision[0].decision,
            teamArgumentation: decision[0].reasoning,
            score: decision[0].score,
            standardAnswer: standardAnswer[0].standard_answer,
            standardArgumentation: standardAnswer[0].standard_reasoning,
          },
        });
      } else {
        res.json({
          success: false,
          message: "Decision not found",
        });
      }
    } catch (error) {
      console.error("Get decision error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get next scenario
  async getNextScenario(req, res) {
    try {
      const team = req.team;

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
        res.json({
          success: true,
          scenario: {
            position: nextScenario[0].position,
            title: nextScenario[0].title,
            scenarioText: nextScenario[0].scenario_text,
          },
          timeLimit: timeLimit,
        });
      } else {
        // Game finished
        res.json({
          success: true,
          scenario: null,
          message: "Game completed!",
        });
      }
    } catch (error) {
      console.error("Get next scenario error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get leaderboard
  async getLeaderboard(req, res) {
    try {
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

      res.json({
        success: true,
        data: mergedLeaderboard.slice(0, 10),
      });
    } catch (error) {
      console.error("Get leaderboard error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new GameController();