const { executeQuery } = require("../config/database");
const { generateAdminToken } = require("../middleware/auth");

class AuthService {
  // Admin login
  async login(username, password) {
    const gameState = await executeQuery(
      "SELECT * FROM game_status LIMIT 1"
    );

    // Simple admin credentials check
    // In production, use proper admin table with hashed passwords
    if (username === "admin" && password === "tuna_admin_2024") {
      const token = generateAdminToken("admin");

      return {
        success: true,
        message: "Admin login successful",
        data: {
          token,
          admin: {
            id: "admin",
            username: "admin",
          },
          gameStatus: gameState[0],
        },
      };
    } else {
      throw new Error("Invalid admin credentials");
    }
  }
}

module.exports = new AuthService();