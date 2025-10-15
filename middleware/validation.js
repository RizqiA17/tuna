const { body, validationResult } = require("express-validator");

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// Team registration validation
const validateTeamRegistration = [
  body("teamName")
    .isLength({ min: 3, max: 50 })
    .withMessage("Team name must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "Team name can only contain letters, numbers, spaces, hyphens, and underscores"
    ),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("players")
    .isArray({ min: 1, max: 5 })
    .withMessage("Team must have between 1 and 5 players"),
  body("players.*.name")
    .isLength({ min: 2, max: 30 })
    .withMessage("Player name must be between 2 and 30 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "Player name can only contain letters, numbers, spaces, hyphens, and underscores"
    ),
  validateRequest,
];

// Team login validation
const validateTeamLogin = [
  body("teamName").notEmpty().withMessage("Team name is required"),
  body("password").notEmpty().withMessage("Password is required"),
  validateRequest,
];

// Decision submission validation
const validateDecisionSubmission = [
  body("decision")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Decision must be between 10 and 1000 characters"),
  body("reasoning")
    .isLength({ min: 20, max: 2000 })
    .withMessage("Reasoning must be between 20 and 2000 characters"),
  validateRequest,
];

// Rate limiting helper
const createRateLimit = (windowMs, max) => {
  return {
    windowMs,
    max,
    message: {
      success: false,
      message: "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
  };
};

module.exports = {
  validateRequest,
  validateTeamRegistration,
  validateTeamLogin,
  validateDecisionSubmission,
  createRateLimit,
};
