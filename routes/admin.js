const express = require("express");
const rateLimit = require("express-rate-limit");
const { authenticateAdmin } = require("../middleware/auth");

// Import controller
const adminController = require("../controllers/adminController");

const router = express.Router();

// Rate limiting for admin routes
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 360, // 60 requests per minute
  message: {
    success: false,
    message: "Too many admin requests, please try again later.",
  },
});

// Admin login route (no auth required)
router.post("/login", adminRateLimit, adminController.login);

// Apply admin authentication to all other routes
router.use(authenticateAdmin);

router.get("/game-status", adminRateLimit, adminController.getGameStatus);
router.put("/game-status", adminRateLimit, adminController.updateGameStatus);
router.get("/game-position", adminRateLimit, adminController.getGamePosition);
router.put("/game-position", adminRateLimit, adminController.updateGamePosition);

// Get all teams with their progress and scores
router.get("/teams", adminRateLimit, adminController.getTeams);

// Get detailed team data with all decisions
router.get("/teams/:teamId", adminRateLimit, adminController.getTeamDetails);

// Get all decisions for a specific scenario/position
router.get(
  "/scenarios/:position/decisions",
  adminRateLimit,
  adminController.getScenarioDecisions
);

// Get comprehensive leaderboard with detailed stats
router.get("/leaderboard", adminRateLimit, adminController.getLeaderboard);

// Reset game for all teams
router.post("/reset-game", adminRateLimit, adminController.resetGame);

// Get game statistics
router.get("/stats", adminRateLimit, adminController.getStats);

// Archive current session to database
router.post("/archive-session", adminRateLimit, adminController.archiveSession);

// Export team data to CSV format
router.get("/export/teams", adminRateLimit, adminController.exportTeams);

// Export decisions data to CSV format
router.get("/export/decisions", adminRateLimit, adminController.exportDecisions);

// Get game settings
router.get("/game-settings", adminRateLimit, adminController.getGameSettings);

// Update game settings
router.put("/game-settings", adminRateLimit, adminController.updateGameSettings);

module.exports = router;
