const express = require("express");
const rateLimit = require("express-rate-limit");
const { executeQuery } = require("../config/database");
const {
  authenticateToken,
  checkPositionAccess,
} = require("../middleware/auth");
const {
  validateDecisionSubmission,
  createRateLimit,
} = require("../middleware/validation");

const router = express.Router();

// Rate limiting
const gameRateLimit = rateLimit(createRateLimit(60 * 1000, 30)); // 30 requests per minute

// Apply authentication to all game routes
router.use(authenticateToken);

// Get current game status
router.get("/status", gameRateLimit, async (req, res) => {
  try {
    const team = req.team;

    // Get completed decisions
    const decisions = await executeQuery(
      "SELECT position, score FROM team_decisions WHERE team_id = ? ORDER BY position",
      [team.id]
    );

    // Get current scenario if not completed
    let currentScenario = null;
    if (team.current_position <= 7) {
      const scenario = await executeQuery(
        "SELECT * FROM game_scenarios WHERE position = ?",
        [team.current_position]
      );

      if (scenario.length > 0) {
        currentScenario = {
          position: scenario[0].position,
          title: scenario[0].title,
          scenarioText: scenario[0].scenario_text,
        };
      }
    }

    res.json({
      success: true,
      data: {
        teamName: team.name,
        currentPosition: team.current_position,
        totalScore: team.total_score,
        isGameComplete: team.current_position > 7,
        completedDecisions: decisions,
        currentScenario,
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

// Get specific scenario
router.get(
  "/scenario/:position",
  gameRateLimit,
  checkPositionAccess(1),
  async (req, res) => {
    try {
      const position = parseInt(req.params.position);

      if (position < 1 || position > 7) {
        return res.status(400).json({
          success: false,
          message: "Invalid scenario position",
        });
      }

      // Check if team has access to this position
      if (req.team.current_position < position) {
        return res.status(403).json({
          success: false,
          message: `You must complete position ${position - 1} first`,
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
);

// Submit decision for a scenario
router.post(
  "/submit-decision/:position",
  gameRateLimit,
  checkPositionAccess(1),
  validateDecisionSubmission,
  async (req, res) => {
    try {
      const position = parseInt(req.params.position);
      const { decision, reasoning } = req.body;

      if (position < 1 || position > 7) {
        return res.status(400).json({
          success: false,
          message: "Invalid scenario position",
        });
      }

      // Check if team has access to this position
      if (req.team.current_position < position) {
        return res.status(403).json({
          success: false,
          message: `You must complete position ${position - 1} first`,
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
      const connection = await require("../config/database").getConnection();
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
);

// Get leaderboard
router.get("/leaderboard", gameRateLimit, async (req, res) => {
  try {
    const leaderboard = await executeQuery(`
      SELECT 
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

// Simple scoring algorithm based on keyword matching
function calculateScore(
  decision,
  reasoning,
  standardAnswer,
  standardReasoning
) {
  const standardKeywords = extractKeywords(
    standardAnswer + " " + standardReasoning
  );
  const teamKeywords = extractKeywords(decision + " " + reasoning);

  const matchingKeywords = standardKeywords.filter((keyword) =>
    teamKeywords.some(
      (teamKeyword) =>
        teamKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(teamKeyword.toLowerCase())
    )
  );

  const similarityRatio =
    matchingKeywords.length / Math.max(standardKeywords.length, 1);

  // Score based on similarity
  if (similarityRatio >= 0.8) return 15;
  if (similarityRatio >= 0.6) return 12;
  if (similarityRatio >= 0.4) return 10;
  if (similarityRatio >= 0.2) return 7;
  if (similarityRatio >= 0.1) return 5;
  return 0;
}

function extractKeywords(text) {
  const stopWords = [
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
  ];

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.includes(word));
}

module.exports = router;
