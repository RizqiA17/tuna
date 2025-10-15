const jwt = require("jsonwebtoken");
const { executeQuery } = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key_here";

// Generate JWT token
const generateToken = (teamId, type = "game_session") => {
  return jwt.sign({ teamId, type }, JWT_SECRET, {
    expiresIn: "24h",
  });
};

// Generate admin token
const generateAdminToken = (adminId) => {
  return jwt.sign({ adminId, type: "admin_session" }, JWT_SECRET, {
    expiresIn: "8h", // Shorter expiry for admin sessions
  });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    const decoded = verifyToken(token);

    // Check if it's an admin session
    if (decoded.type === "admin_session") {
      // For admin sessions, we'll use a simple admin check
      // In production, you should have a proper admin table
      const adminId = decoded.adminId;
      if (adminId === "admin" || adminId === "tuna_admin") {
        req.isAdmin = true;
        req.adminId = adminId;
        return next();
      }
    }

    // Verify team exists and session is valid
    const team = await executeQuery(
      "SELECT id, name, current_position, total_score FROM teams WHERE id = ?",
      [decoded.teamId]
    );

    if (!team.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid team session",
      });
    }

    req.team = team[0];
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Admin access token required",
    });
  }

  try {
    const decoded = verifyToken(token);

    if (decoded.type !== "admin_session") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    // Simple admin validation - in production, check against admin table
    if (decoded.adminId === "admin" || decoded.adminId === "tuna_admin") {
      req.isAdmin = true;
      req.adminId = decoded.adminId;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Invalid admin credentials",
    });
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }
};

// Check if team has access to specific position
const checkPositionAccess = (requiredPosition) => {
  return (req, res, next) => {
    if (req.team.current_position < requiredPosition) {
      return res.status(403).json({
        success: false,
        message: `You must complete position ${requiredPosition - 1} first`,
      });
    }
    next();
  };
};

module.exports = {
  generateToken,
  generateAdminToken,
  verifyToken,
  authenticateToken,
  authenticateAdmin,
  checkPositionAccess,
};
