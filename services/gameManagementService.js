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

    // Get all containers
    async getAllContainers() {
        const containers = await executeQuery(
            "SELECT id, name, status, is_active, posisi, created_at FROM game_containers ORDER BY created_at DESC"
        );

        return {
            success: true,
            data: containers
        };
    }

    // Create new container
    async createContainer(name) {
        // Check if name already exists
        const existing = await executeQuery(
            "SELECT id FROM game_containers WHERE name = ?",
            [name]
        );

        if (existing.length > 0) {
            throw new Error("Container with this name already exists");
        }

        const result = await executeQuery(
            "INSERT INTO game_containers (name, status, is_active, posisi) VALUES (?, 'menunggu', false, 0)",
            [name]
        );

        return {
            success: true,
            message: "Container created successfully",
            data: { id: result.insertId, name, status: 'menunggu', is_active: false, posisi: 0 }
        };
    }

    // Update container
    async updateContainer(id, updates) {
        const { name, status, is_active, posisi } = updates;

        // Check if container exists
        const existing = await executeQuery(
            "SELECT id, is_active FROM game_containers WHERE id = ?",
            [id]
        );

        if (existing.length === 0) {
            throw new Error("Container not found");
        }

        // If activating this container, deactivate all others first
        if (is_active === true && existing[0].is_active === 0) {
            await executeQuery(
                "UPDATE game_containers SET is_active = false WHERE is_active = true"
            );
        }

        // If trying to deactivate the only active container, prevent it
        if (is_active === false && existing[0].is_active === 1) {
            const activeCount = await executeQuery(
                "SELECT COUNT(*) as count FROM game_containers WHERE is_active = true"
            );
            if (activeCount[0].count <= 1) {
                throw new Error("Cannot deactivate the only active container");
            }
        }

        // Validate status
        if (status && !["menunggu", "mulai", "selesai"].includes(status)) {
            throw new Error("Invalid status");
        }

        // Build update query
        const updateFields = [];
        const values = [];

        if (name !== undefined) {
            updateFields.push("name = ?");
            values.push(name);
        }
        if (status !== undefined) {
            updateFields.push("status = ?");
            values.push(status);
        }
        if (is_active !== undefined) {
            updateFields.push("is_active = ?");
            values.push(is_active);
        }
        if (posisi !== undefined) {
            updateFields.push("posisi = ?");
            values.push(posisi);
        }

        if (updateFields.length === 0) {
            throw new Error("No valid fields to update");
        }

        values.push(id);

        await executeQuery(
            `UPDATE game_containers SET ${updateFields.join(", ")} WHERE id = ?`,
            values
        );

        return {
            success: true,
            message: "Container updated successfully"
        };
    }

    // Delete container
    async deleteContainer(id) {
        // Check if container exists and is not active
        const container = await executeQuery(
            "SELECT id, is_active FROM game_containers WHERE id = ?",
            [id]
        );

        if (container.length === 0) {
            throw new Error("Container not found");
        }

        if (container[0].is_active) {
            throw new Error("Cannot delete active container");
        }

        await executeQuery(
            "DELETE FROM game_containers WHERE id = ?",
            [id]
        );

        return {
            success: true,
            message: "Container deleted successfully"
        };
    }
}

module.exports = new GameManagementService();
