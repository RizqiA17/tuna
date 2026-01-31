const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  authenticateToken,
  checkPositionAccess,
} = require("../middleware/auth");
const {
  validateDecisionSubmission,
  createRateLimit,
} = require("../middleware/validation");

// Import controller
const gameController = require("../controllers/gameController");

const router = express.Router();

// Rate limiting
const gameRateLimit = rateLimit(createRateLimit(60 * 1000, 600)); // 60 requests per minute

// Apply authentication to all game routes
router.use(authenticateToken);

// Start game - initialize or reset game state
router.post("/start", gameRateLimit, gameController.startGame);

// Get global game status
router.get("/game-status", gameRateLimit, gameController.getGameStatus);

// Get current game status
router.get("/status", gameRateLimit, gameController.getStatus);

// Get specific scenario
router.get(
  "/scenario/:position",
  gameRateLimit,
  checkPositionAccess(1),
  gameController.getScenario
);

// Get team rank
router.get("/rank/:teamId", gameController.getTeamRank);

// Submit decision for a scenario
router.post(
  "/submit-decision/:position",
  gameRateLimit,
  checkPositionAccess(1),
  validateDecisionSubmission,
  gameController.submitDecisionWithPosition
);

// Submit decision (without position parameter - for current scenario)
router.post("/submit-decision", gameRateLimit, gameController.submitDecision);

// Get decision
router.get("/decision", gameController.getDecision);

// Get next scenario
router.post("/next-scenario", gameRateLimit, gameController.getNextScenario);

// Get leaderboard
router.get("/leaderboard", gameRateLimit, gameController.getLeaderboard);

module.exports = router;
