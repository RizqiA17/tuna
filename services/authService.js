const { executeQuery } = require("../config/database");
const { generateAdminToken } = require("../middleware/auth");

class AuthService {
    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT * FROM game_containers WHERE is_active = true LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container");
        }

        return container[0];
    }

    // Admin login (container based)
    async login(username, password) {
        const activeContainer = await this.getActiveContainer();

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
                        username: "admin"
                    },
                    gameStatus: {
                        id: activeContainer.id,
                        status: activeContainer.status,
                        posisi: activeContainer.posisi,
                        is_active: activeContainer.is_active,
                        name: activeContainer.name,
                        created_at: activeContainer.created_at
                    }
                }
            };
        } else {
            throw new Error("Invalid admin credentials");
        }
    }
}

module.exports = new AuthService();
