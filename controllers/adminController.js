const authService = require("../services/authService");
const gameManagementService = require("../services/gameManagementService");
const teamService = require("../services/teamService");
const adminScenarioService = require("../services/adminScenarioService");
const statisticsService = require("../services/statisticsService");
const exportService = require("../services/exportService");
const settingsService = require("../services/settingsService");
const archiveService = require("../services/archiveService");

class AdminController {
  // Admin login
  async login(req, res) {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);
      res.json(result);
    } catch (error) {
      console.error("Admin login error:", error);
      const statusCode = error.message.includes("Invalid") ? 401 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get game status
  async getGameStatus(req, res) {
    try {
      const result = await gameManagementService.getGameStatus();
      res.json(result);
    } catch (error) {
      console.error("Get game status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update game status
  async updateGameStatus(req, res) {
    try {
      const { status } = req.body;
      const result = await gameManagementService.updateGameStatus(status);
      res.json(result);
    } catch (error) {
      console.error("Update game status error:", error);
      const statusCode = error.message.includes("Invalid") ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get game position
  async getGamePosition(req, res) {
    try {
      const result = await gameManagementService.getGamePosition();
      res.json(result);
    } catch (error) {
      console.error("Get game position error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update game position
  async updateGamePosition(req, res) {
    try {
      const { position } = req.body;
      const result = await gameManagementService.updateGamePosition(position);
      res.json(result);
    } catch (error) {
      console.error("Update game position error:", error);
      const statusCode = error.message.includes("Invalid") ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get all teams
  async getTeams(req, res) {
    try {
      const result = await teamService.getAllTeams();
      res.json(result);
    } catch (error) {
      console.error("Get teams error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get team details
  async getTeamDetails(req, res) {
    try {
      const teamId = req.params.teamId;
      const result = await teamService.getTeamDetails(teamId);
      res.json(result);
    } catch (error) {
      console.error("Get team details error:", error);
      const statusCode = error.message.includes("not found") ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get scenario decisions
  async getScenarioDecisions(req, res) {
    try {
      const position = parseInt(req.params.position);
      const result = await adminScenarioService.getScenarioDecisions(position);
      res.json(result);
    } catch (error) {
      console.error("Get scenario decisions error:", error);
      const statusCode = error.message.includes("Invalid") ? 400 :
                        error.message.includes("not found") ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get leaderboard
  async getLeaderboard(req, res) {
    try {
      const result = await statisticsService.getLeaderboard();
      res.json(result);
    } catch (error) {
      console.error("Get leaderboard error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Reset game
  async resetGame(req, res) {
    try {
      const result = await gameManagementService.resetGame();
      res.json(result);
    } catch (error) {
      console.error("Reset game error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get game statistics
  async getStats(req, res) {
    try {
      const result = await statisticsService.getGameStats();
      res.json(result);
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Archive session
  async archiveSession(req, res) {
    try {
      const result = await archiveService.archiveSession();
      res.json(result);
    } catch (error) {
      console.error("Archive session error:", error);
      const statusCode = error.message.includes("Can only archive") ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Export teams
  async exportTeams(req, res) {
    try {
      const csvContent = await exportService.exportTeams();
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
  }

  // Export decisions
  async exportDecisions(req, res) {
    try {
      const csvContent = await exportService.exportDecisions();
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
  }

  // Get game settings
  async getGameSettings(req, res) {
    try {
      const result = await settingsService.getGameSettings();
      res.json(result);
    } catch (error) {
      console.error("Get game settings error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update game settings
  async updateGameSettings(req, res) {
    try {
      const { settings } = req.body;
      const result = await settingsService.updateGameSettings(settings, req.admin?.username);
      res.json(result);
    } catch (error) {
      console.error("Update game settings error:", error);
      const statusCode = error.message.includes("Invalid") || error.message.includes("must be") ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
}

module.exports = new AdminController();