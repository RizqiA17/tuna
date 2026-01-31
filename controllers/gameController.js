const gameService = require("../services/gameService");
const scenarioService = require("../services/scenarioService");
const decisionService = require("../services/decisionService");
const leaderboardService = require("../services/leaderboardService");

class GameController {
  // Start game - initialize or reset game state
  async startGame(req, res) {
    try {
      const result = await gameService.startGame(req.team);
      res.json(result);
    } catch (error) {
      console.error("Start game error:", error);
      const statusCode = error.message.includes("already in progress") ? 409 :
                        error.message.includes("not found") ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get global game status
  async getGameStatus(req, res) {
    try {
      const result = await gameService.getGameStatus();
      res.json(result);
    } catch (error) {
      console.error("Get game status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get current game status
  async getStatus(req, res) {
    try {
      const result = await gameService.getStatus(req.team);
      res.json(result);
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
      const result = await scenarioService.getScenario(position, req.team.id);
      res.json(result);
    } catch (error) {
      console.error("Get scenario error:", error);
      const statusCode = error.message.includes("Invalid") || error.message.includes("already") ? 400 :
                        error.message.includes("not found") ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get team rank
  async getTeamRank(req, res) {
    try {
      const { teamId } = req.params;
      const result = await leaderboardService.getTeamRank(teamId);
      res.json(result);
    } catch (error) {
      console.error("Get team rank error:", error);
      const statusCode = error.message.includes("not found") ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Submit decision for a scenario
  async submitDecisionWithPosition(req, res) {
    try {
      const position = parseInt(req.params.position);
      const { decision, reasoning } = req.body;
      const result = await decisionService.submitDecisionWithPosition(
        position,
        decision,
        reasoning,
        req.team
      );
      res.json(result);
    } catch (error) {
      console.error("Submit decision error:", error);
      const statusCode = error.message.includes("Invalid") || error.message.includes("already") ? 400 :
                        error.message.includes("not found") ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Submit decision (without position parameter - for current scenario)
  async submitDecision(req, res) {
    try {
      const { position, decision, argumentation } = req.body;
      const result = await decisionService.submitDecision(position, decision, argumentation, req.team);
      res.json(result);
    } catch (error) {
      console.error("Submit decision error:", error);
      const statusCode = error.message.includes("Valid position") || error.message.includes("already") ? 400 :
                        error.message.includes("not found") ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get decision
  async getDecision(req, res) {
    try {
      const { teamId, position } = req.query;
      const result = await decisionService.getDecision(teamId, position);
      res.json(result);
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
      const result = await scenarioService.getNextScenario(req.team);
      res.json(result);
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
      const result = await leaderboardService.getLeaderboard();
      res.json(result);
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