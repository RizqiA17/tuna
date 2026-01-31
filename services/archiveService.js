const { getConnection, executeQuery } = require("../config/database");
const stateManager = require("../server-state-manager");

class ArchiveService {
    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT id FROM game_containers WHERE is_active = true LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container");
        }

        return container[0].id;
    }

    // Archive current session to database (container based)
    async archiveSession() {
        const gameState = stateManager.getGameState();

        // Check if game has ended
        if (gameState.status !== "ended") {
            throw new Error("Can only archive when game has ended");
        }

        const activeContainerId = await this.getActiveContainer();
        const allTeams = stateManager.getAllTeams();

        let archivedCount = 0;
        const connection = await getConnection();

        try {
            await connection.beginTransaction();

            for (const team of allTeams) {
                // Update final team state in database (scoped by container)
                await connection.execute(
                    `UPDATE teams 
                     SET current_position = ?, total_score = ?, updated_at = NOW() 
                     WHERE id = ? AND game_container_id = ?`,
                    [team.currentPosition, team.totalScore, team.id, activeContainerId]
                );

                if (team.decisions && team.decisions.length > 0) {
                    for (const decision of team.decisions) {
                        // Check if decision already exists (scoped by container via team)
                        const [existing] = await connection.execute(
                            `SELECT td.id 
                             FROM team_decisions td
                             JOIN teams t ON td.team_id = t.id
                             WHERE td.team_id = ? 
                               AND td.position = ?
                               AND t.game_container_id = ?`,
                            [team.id, decision.position, activeContainerId]
                        );

                        if (existing.length === 0) {
                            await connection.execute(
                                `INSERT INTO team_decisions
                                (team_id, position, decision, reasoning, score, created_at)
                                VALUES (?, ?, ?, ?, ?, ?)`,
                                [
                                    team.id,
                                    decision.position,
                                    decision.decision || "",
                                    decision.reasoning || "",
                                    decision.score || 0,
                                    decision.timestamp || new Date()
                                ]
                            );

                            archivedCount++;
                        }
                    }
                }
            }

            await connection.commit();

            const result = {
                success: true,
                message: "Session archived successfully",
                data: {
                    teamsArchived: allTeams.length,
                    decisionsArchived: archivedCount,
                    sessionStarted: gameState.sessionStarted,
                    archivedAt: new Date().toISOString()
                }
            };

            console.log(
                `Archived container ${activeContainerId}: ${allTeams.length} teams, ${archivedCount} new decisions`
            );

            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new ArchiveService();
