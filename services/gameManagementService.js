const { executeQuery, getConnection } = require("../config/database");
const stateManager = require("../server-state-manager");

class GameManagementService {
    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT * FROM game_containers WHERE is_active = true LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container");
        }

        return container[0];
    }

    // Get game status (container based)
    async getGameStatus() {
        const activeContainer = await this.getActiveContainer();

        return {
            success: true,
            data: {
                status:
                    activeContainer.status === "menunggu"
                        ? "waiting"
                        : activeContainer.status === "mulai"
                        ? "running"
                        : "ended"
            }
        };
    }

    // Update game status (container based)
    async updateGameStatus(status) {
        if (!["menunggu", "mulai", "selesai"].includes(status)) {
            throw new Error("Invalid game status");
        }

        const activeContainer = await this.getActiveContainer();

        await executeQuery(
            "UPDATE game_containers SET status = ? WHERE id = ?",
            [status, activeContainer.id]
        );

        stateManager.updateGameState(
            status === "menunggu"
                ? "waiting"
                : status === "mulai"
                ? "running"
                : "ended"
        );

        return {
            success: true,
            message: "Game status updated successfully",
            data: { status }
        };
    }

    // Get game position (container based)
    async getGamePosition() {
        const activeContainer = await this.getActiveContainer();

        return {
            success: true,
            data: {
                position: activeContainer.posisi
            }
        };
    }

    // Update game position (container based)
    async updateGamePosition(position) {
        if (typeof position !== "number" || position < 0 || position > 7) {
            throw new Error("Invalid game position");
        }

        const activeContainer = await this.getActiveContainer();

        await executeQuery(
            "UPDATE game_containers SET posisi = ? WHERE id = ?",
            [position, activeContainer.id]
        );

        return {
            success: true,
            message: "Game position updated successfully",
            data: { position }
        };
    }

    // Reset game for active container only
    async resetGame() {
        const connection = await getConnection();
        const activeContainer = await this.getActiveContainer();

        await connection.beginTransaction();

        try {
            // Reset teams in active container
            await connection.execute(
                "UPDATE teams SET current_position = 1, total_score = 0 WHERE game_container_id = ?",
                [activeContainer.id]
            );

            // Reset container state
            await connection.execute(
                "UPDATE game_containers SET status = 'menunggu', posisi = 0 WHERE id = ?",
                [activeContainer.id]
            );

            // Clear decisions only for container
            await connection.execute(
                `DELETE td FROM team_decisions td
                 JOIN teams t ON td.team_id = t.id
                 WHERE t.game_container_id = ?`,
                [activeContainer.id]
            );

            await connection.commit();

            return {
                success: true,
                message: "Game reset successfully for active container"
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new GameManagementService();
