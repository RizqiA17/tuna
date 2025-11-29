const express = require("express");
const rateLimit = require("express-rate-limit");
const { executeQuery, getConnection } = require("../config/database");
const { authenticateAdmin, generateAdminToken } = require("../middleware/auth");

// Import state manager
const stateManager = require("../server-state-manager");

const router = express.Router();

// Rate limiting for admin routes
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    message: "Too many admin requests, please try again later.",
  },
});

// Admin login route (no auth required)
router.post("/login", adminRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;

    const gameState = await executeQuery(
      "SELECT * FROM game_status LIMIT 1"
    );

    // Simple admin credentials check
    // In production, use proper admin table with hashed passwords
    if (username === "admin" && password === "tuna_admin_2024") {
      const token = generateAdminToken("admin");

      res.json({
        success: true,
        message: "Admin login successful",
        data: {
          token,
          admin: {
            id: "admin",
            username: "admin",
          },
          gameStatus: gameState[0],
        },
      });
    } else {
      res.status(401).json({
        success: false,
        message: "Invalid admin credentials",
      });
    }
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Apply admin authentication to all other routes
router.use(authenticateAdmin);

router.get("/game-status", adminRateLimit, async (req, res) => {
  try {
    const status = await executeQuery(
      "SELECT status FROM game_status LIMIT 1"
    );

    res.json({
      success: true,
      data: {
        status: status[0].status == "menunggu" ? "waiting" : status[0].status == "mulai" ? "running" : "ended",
      },
    });
  } catch (error) {
    console.error("Get game status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.put("/game-status", adminRateLimit, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["menunggu", "mulai", "selesai"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid game status",
      });
    }

    const gameStatus = await executeQuery("UPDATE game_status SET status = ?", [
      status,
    ]);
    // Update game status in state manager
    stateManager.updateGameState(
      status == "menunggu" ? "waiting" : status == "mulai" ? "running" : "ended"
    );

    res.json({
      success: true,
      message: "Game status updated successfully",
      data: {
        status,
      },
    });
  } catch (error) {
    console.error("Update game status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.get("/game-position", adminRateLimit, async (req, res) => {
  try {
    const status = await executeQuery(
      "SELECT posisi FROM game_status LIMIT 1"
    );

    res.json({
      success: true,
      data: {
        position: status[0].posisi,
      },
    });
  } catch (error) { 
    console.error("Get game position error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.put("/game-position", adminRateLimit, async (req, res) => {
  try{
    const { position } = req.body;

    if (typeof position !== "number" || position < 0 || position > 7) {
      return res.status(400).json({
        success: false,
        message: "Invalid game position",
      });
    }

    const gamePosition = await executeQuery("UPDATE game_status SET posisi = ?", [
      position,
    ]);

    // Update game position in state manager
    // stateManager.(position);

    res.json({
      success: true,
      message: "Game position updated successfully",
      data: {
        position,
      },
    });
  } catch (error) {
    console.error("Update game position error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
})

// Get all teams with their progress and scores
router.get("/teams", adminRateLimit, async (req, res) => {
  try {
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

    res.json({
      success: true,
      data: mergedTeams,
    });
  } catch (error) {
    console.error("Get teams error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get detailed team data with all decisions
router.get("/teams/:teamId", adminRateLimit, async (req, res) => {
  try {
    const teamId = req.params.teamId;

    // Get team basic info
    const teamInfo = await executeQuery("SELECT * FROM teams WHERE id = ?", [
      teamId,
    ]);

    if (!teamInfo.length) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
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

    res.json({
      success: true,
      data: {
        team: teamInfo[0],
        players,
        decisions,
      },
    });
  } catch (error) {
    console.error("Get team details error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get all decisions for a specific scenario/position
router.get(
  "/scenarios/:position/decisions",
  adminRateLimit,
  async (req, res) => {
    try {
      const position = parseInt(req.params.position);

      if (position < 1 || position > 7) {
        return res.status(400).json({
          success: false,
          message: "Invalid scenario position",
        });
      }

      // Get scenario info
      const scenario = await executeQuery(
        "SELECT * FROM game_scenarios WHERE position = ?",
        [position]
      );

      if (!scenario.length) {
        return res.status(404).json({
          success: false,
          message: "Scenario not found",
        });
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

      res.json({
        success: true,
        data: {
          scenario: scenario[0],
          decisions,
        },
      });
    } catch (error) {
      console.error("Get scenario decisions error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Get comprehensive leaderboard with detailed stats
router.get("/leaderboard", adminRateLimit, async (req, res) => {
  try {
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

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Reset game for all teams
router.post("/reset-game", adminRateLimit, async (req, res) => {
  try {
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

      res.json({
        success: true,
        message: "Game reset successfully for all teams",
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Reset game error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get game statistics
router.get("/stats", adminRateLimit, async (req, res) => {
  try {
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
    )

    res.json({
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
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Archive current session to database
router.post("/archive-session", adminRateLimit, async (req, res) => {
  try {
    const gameState = stateManager.getGameState();

    // Check if game has ended
    if (gameState.status !== "ended") {
      return res.status(400).json({
        success: false,
        message: "Can only archive when game has ended",
      });
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

      res.json({
        success: true,
        message: "Session archived successfully",
        data: {
          teamsArchived: allTeams.length,
          decisionsArchived: archivedCount,
          sessionStarted: gameState.sessionStarted,
          archivedAt: new Date().toISOString(),
        },
      });

      console.log(
        `📦 Archived session: ${allTeams.length} teams, ${archivedCount} new decisions`
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Archive session error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Export team data to CSV format
router.get("/export/teams", adminRateLimit, async (req, res) => {
  try {
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

    const csvContent = csvHeader + csvRows;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="teams_export.csv"'
    );
    res.send(csvContent);
  } catch (error) {
    console.error("Export teams error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Export decisions data to CSV format
router.get("/export/decisions", adminRateLimit, async (req, res) => {
  try {
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

    const csvContent = csvHeader + csvRows;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="decisions_export.csv"'
    );
    res.send(csvContent);
  } catch (error) {
    console.error("Export decisions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get game settings
router.get("/game-settings", adminRateLimit, async (req, res) => {
  try {
    const settings = await executeQuery(
      "SELECT setting_key, setting_value, description, updated_at FROM game_settings"
    );

    // Convert array to object for easier access
    const settingsObj = {};
    settings.forEach((setting) => {
      settingsObj[setting.setting_key] = {
        value: setting.setting_value,
        description: setting.description,
        updated_at: setting.updated_at,
      };
    });

    res.json({
      success: true,
      data: settingsObj,
    });
  } catch (error) {
    console.error("Get game settings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update game settings
router.put("/game-settings", adminRateLimit, async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid settings format",
      });
    }

    const connection = await getConnection();
    await connection.beginTransaction();

    try {
      for (const [key, value] of Object.entries(settings)) {
        // Validate answer_time_limit
        if (key === "answer_time_limit") {
          const timeLimit = parseInt(value);
          if (isNaN(timeLimit) || timeLimit < 60 || timeLimit > 3600) {
            await connection.rollback();
            return res.status(400).json({
              success: false,
              message:
                "Time limit must be between 60 and 3600 seconds (1 minute to 1 hour)",
            });
          }
        }

        // Update or insert setting
        await connection.execute(
          `INSERT INTO game_settings (setting_key, setting_value, updated_by)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
           setting_value = VALUES(setting_value),
           updated_by = VALUES(updated_by),
           updated_at = CURRENT_TIMESTAMP`,
          [key, String(value), req.admin?.username || "admin"]
        );
      }

      await connection.commit();

      // Get updated settings
      const updatedSettings = await executeQuery(
        "SELECT setting_key, setting_value, description, updated_at FROM game_settings"
      );

      const settingsObj = {};
      updatedSettings.forEach((setting) => {
        settingsObj[setting.setting_key] = {
          value: setting.setting_value,
          description: setting.description,
          updated_at: setting.updated_at,
        };
      });

      res.json({
        success: true,
        message: "Game settings updated successfully",
        data: settingsObj,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Update game settings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
