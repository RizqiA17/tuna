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

    // Generate token
    const token = generateToken(team[0].id);

    // Get team players
    const players = await executeQuery(
      "SELECT name, role FROM players WHERE team_id = ? ORDER BY role DESC, id ASC",
      [team[0].id]
    );

    res.json({
      success: true,
      message: "Login successful",
      data: {
        teamId: team[0].id,
        teamName: team[0].name,
        currentPosition: team[0].current_position,
        totalScore: team[0].total_score,
        token,
        players,
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
      // Get team players
      const players = await executeQuery(
        "SELECT name, role FROM players WHERE team_id = ? ORDER BY role DESC, id ASC",
        [req.team.id]
      );

      res.json({
        success: true,
        data: {
          teamId: req.team.id,
          teamName: req.team.name,
          currentPosition: req.team.current_position,
          totalScore: req.team.total_score,
          players,
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
