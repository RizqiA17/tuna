const express = require("express");
const rateLimit = require("express-rate-limit");
const { executeQuery } = require("../config/database");
const { authenticateAdmin, generateAdminToken } = require("../middleware/auth");

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
            username: "admin"
          }
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: "Invalid admin credentials"
      });
    }
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Apply admin authentication to all other routes
router.use(authenticateAdmin);

// Get all teams with their progress and scores
router.get("/teams", adminRateLimit, async (req, res) => {
  try {
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

    res.json({
      success: true,
      data: teams,
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
    const teamInfo = await executeQuery(
      "SELECT * FROM teams WHERE id = ?",
      [teamId]
    );

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
    const decisions = await executeQuery(`
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
    `, [teamId]);

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
router.get("/scenarios/:position/decisions", adminRateLimit, async (req, res) => {
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
    const decisions = await executeQuery(`
      SELECT 
        td.*,
        t.name as team_name,
        t.current_position,
        t.total_score
      FROM team_decisions td
      JOIN teams t ON td.team_id = t.id
      WHERE td.position = ?
      ORDER BY td.score DESC, td.created_at ASC
    `, [position]);

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
});

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

// Get game statistics
router.get("/stats", adminRateLimit, async (req, res) => {
  try {
    // Get total teams
    const totalTeams = await executeQuery("SELECT COUNT(*) as count FROM teams");
    
    // Get active teams (teams that have made at least one decision)
    const activeTeams = await executeQuery(`
      SELECT COUNT(DISTINCT team_id) as count 
      FROM team_decisions
    `);
    
    // Get completed teams (teams that have finished all scenarios)
    const completedTeams = await executeQuery(`
      SELECT COUNT(*) as count 
      FROM teams 
      WHERE current_position > 7
    `);
    
    // Get average score
    const avgScore = await executeQuery(`
      SELECT AVG(total_score) as average 
      FROM teams 
      WHERE total_score > 0
    `);
    
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

    res.json({
      success: true,
      data: {
        totalTeams: totalTeams[0].count,
        activeTeams: activeTeams[0].count,
        completedTeams: completedTeams[0].count,
        averageScore: avgScore[0].average || 0,
        scenarioStats,
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
    const csvHeader = "ID,Team Name,Current Position,Total Score,Player Count,Players,Created At\n";
    const csvRows = teams.map(team => 
      `${team.id},"${team.team_name}",${team.current_position},${team.total_score},${team.player_count},"${team.players}","${team.created_at}"`
    ).join('\n');

    const csvContent = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="teams_export.csv"');
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
    const csvHeader = "ID,Team Name,Position,Scenario Title,Decision,Reasoning,Score,Created At\n";
    const csvRows = decisions.map(decision => 
      `${decision.id},"${decision.team_name}",${decision.position},"${decision.scenario_title}","${decision.decision.replace(/"/g, '""')}","${decision.reasoning.replace(/"/g, '""')}",${decision.score},"${decision.created_at}"`
    ).join('\n');

    const csvContent = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="decisions_export.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error("Export decisions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
