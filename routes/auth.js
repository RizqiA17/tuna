const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { executeQuery } = require("../config/database");
const { generateToken } = require("../middleware/auth");
const {
  validateTeamRegistration,
  validateTeamLogin,
  createRateLimit,
} = require("../middleware/validation");

// Import state manager
const stateManager = require("../server-state-manager");

const router = express.Router();

// Rate limiting
const authRateLimit = rateLimit(createRateLimit(15 * 60 * 1000, 50)); // 50 requests per 15 minutes
const registrationRateLimit = rateLimit(createRateLimit(60 * 60 * 1000, 5)); // 5 registrations per hour

// Team registration
router.post(
  "/register",
  registrationRateLimit,
  validateTeamRegistration,
  async (req, res) => {
    try {
      const { teamName, password, players } = req.body;

      // Check if team name already exists
      const existingTeam = await executeQuery(
        "SELECT id FROM teams WHERE name = ?",
        [teamName]
      );

      if (existingTeam.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Team name already exists",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Start transaction
      const connection = await require("../config/database").getConnection();
      await connection.beginTransaction();

      try {
        const gameStatus = connection.execute(
          "SELECT status FROM game_status WHERE id = 1 FOR UPDATE"
        )

        // Create team
        const teamResult = await connection.execute(
          "INSERT INTO teams (name, password) VALUES (?, ?)",
          [teamName, hashedPassword]
        );

        const teamId = teamResult[0].insertId;

        // Add players
        for (let i = 0; i < players.length; i++) {
          const player = players[i];
          const role = i === 0 ? "leader" : "member";

          await connection.execute(
            "INSERT INTO players (team_id, name, role) VALUES (?, ?, ?)",
            [teamId, player.name, role]
          );
        }

        await connection.commit();

        // Add team to stateManager for real-time tracking
        stateManager.createOrUpdateTeam(teamId, {
          name: teamName,
          currentPosition: 1,
          totalScore: 0,
          decisions: [],
          createdAt: new Date().toISOString()
        });

        // Generate token
        const token = generateToken(teamId);

        res.status(201).json({
          success: true,
          message: "Team registered successfully",
          data: {
            teamId,
            teamName,
            currentPosition: 1,
            totalScore: 0,
            token,
            players,
            gameStatus: (await gameStatus)[0][0].status
          },
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Team login
router.post("/login", authRateLimit, validateTeamLogin, async (req, res) => {
  try {
    const { teamName, password } = req.body;

    // Find team
    const team = await executeQuery(
      "SELECT id, name, password, current_position, total_score FROM teams WHERE name = ?",
      [teamName]
    );

    const game = await executeQuery(
      "SELECT * FROM game_status WHERE id = 1 LIMIT 1"
    );

    if (!team.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid team name or password",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, team[0].password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid team name or password",
      });
    }

    if (game[0].posisi > team[0].current_position) {
      await executeQuery(
        "UPDATE teams SET current_position = ? WHERE id = ?",
        [game[0].posisi, team[0].id]
      )

      for (let i = team[0].current_position; i < game[0].posisi; i++) {
        try {
          await executeQuery(
            "INSERT INTO team_decisions (team_id, position, decision, reasoning, score) VALUES (?, ?, ?, ?, ?)",
            [team[0].id, i, '', '', 0]
          )
        } catch (e) { }
      }
    }

    // Generate token
    const token = generateToken(team[0].id);

    // Get team players
    const players = await executeQuery(
      "SELECT name, role FROM players WHERE team_id = ? ORDER BY role DESC, id ASC",
      [team[0].id]
    );

    const gameStatus = await executeQuery(
      "SELECT * FROM game_status WHERE id = 1"
    );

    if (gameStatus[0].status === 'menunggu') {
      team[0].current_position = 1;
      team[0].total_score = 0;
      await executeQuery(
        "UPDATE teams SET current_position = 1, total_score = 0 WHERE id = ?",
        [team[0].id]
      );

      // Update state manager
      stateManager.createOrUpdateTeam(team[0].id, {
        name: team[0].name,
        currentPosition: game[0].posisi,
        totalScore: 0,
        decisions: [],
        createdAt: new Date().toISOString()
      });

      // hapus semua keputusan sebelumnya
      await executeQuery(
        "DELETE FROM team_decisions WHERE team_id = ?",
        [team[0].id]
      );
    }

    res.json({
      success: true,
      message: "Login successful",
      data: {
        game: game[0],
        teamId: team[0].id,
        teamName: team[0].name,
        currentPosition: game[0].posisi,
        totalScore: team[0].total_score,
        token,
        players,
        gameStatus: gameStatus[0].status == 'menunggu' ? 'waiting' : gameStatus[0].status == 'mulai' ? 'running' : 'ended',
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get team info (protected route)
router.get(
  "/me",
  require("../middleware/auth").authenticateToken,
  async (req, res) => {
    try {
      const teamId = req.team.id;

      // Find team
      const team = await executeQuery(
        "SELECT id, name, password, current_position, total_score FROM teams WHERE id = ?",
        [teamId]
      );

      const game = await executeQuery(
        "SELECT * FROM game_status WHERE id = 1 LIMIT 1"
      );

      if (game[0].posisi > team[0].current_position) {
        await executeQuery(
          "UPDATE teams SET current_position = ? WHERE id = ?",
          [game[0].posisi, team[0].id]
        )

        for (let i = team[0].current_position; i < game[0].posisi; i++) {
          try {
            await executeQuery(
              "INSERT INTO team_decisions (team_id, position, decision, reasoning, score) VALUES (?, ?, ?, ?, ?)",
              [team[0].id, i, '', '', 0]
            )
          } catch (e) { }
        }
      }

      // Get team players
      const players = await executeQuery(
        "SELECT name, role FROM players WHERE team_id = ? ORDER BY role DESC, id ASC",
        [team[0].id]
      );

      const gameStatus = await executeQuery(
        "SELECT * FROM game_status WHERE id = 1"
      );

      if (gameStatus[0].status === 'menunggu') {
        team[0].current_position = 1;
        team[0].total_score = 0;
        await executeQuery(
          "UPDATE teams SET current_position = 1, total_score = 0 WHERE id = ?",
          [team[0].id]
        );

        // Update state manager
        stateManager.createOrUpdateTeam(team[0].id, {
          name: team[0].name,
          currentPosition: game[0].posisi,
          totalScore: 0,
          decisions: [],
          createdAt: new Date().toISOString()
        });

        // hapus semua keputusan sebelumnya
        await executeQuery(
          "DELETE FROM team_decisions WHERE team_id = ?",
          [team[0].id]
        );
      }

      res.json({
        success: true,
        message: "Login successful",
        data: {
          game: game[0],
          teamId: team[0].id,
          teamName: team[0].name,
          currentPosition: game[0].posisi,
          totalScore: team[0].total_score,
          players,
          gameStatus: gameStatus[0].status == 'menunggu' ? 'waiting' : gameStatus[0].status == 'mulai' ? 'running' : 'ended',
        },
      });
    } catch (error) {
      console.error("Get team info error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

module.exports = router;
