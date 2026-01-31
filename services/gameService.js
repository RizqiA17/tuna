const { executeQuery } = require("../config/database");
const stateManager = require("../server-state-manager");
const { getGameSetting } = require("../utils/gameUtils");

class GameService {

    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT * FROM game_containers WHERE is_active = 1 LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container found");
        }

        return container[0];
    }

    // Start game - initialize or reset game state
    async startGame(team) {
        const container = await this.getActiveContainer();

        if (team.current_position > 1) {
            throw new Error("Game already in progress. Use /status to get current state.");
        }

        const scenario = await executeQuery(
            "SELECT * FROM game_scenarios WHERE position = 1"
        );

        if (!scenario.length) {
            throw new Error("Game scenarios not found");
        }

        const timeLimit = parseInt(
            await getGameSetting("answer_time_limit", "900")
        );

        return {
            success: true,
            message: "Game started successfully",
            scenario: {
                position: scenario[0].position,
                title: scenario[0].title,
                scenarioText: scenario[0].scenario_text,
            },
            timeLimit: timeLimit,
            containerId: container.id
        };
    }

    // Get container game status
    async getGameStatus() {
        const container = await this.getActiveContainer();

        const response = await executeQuery(
            "SELECT status, posisi FROM game_containers WHERE id = ? FOR UPDATE",
            [container.id]
        );

        return {
            success: true,
            data: {
                status: response.length > 0 ? response[0].status : null,
                posisi: response.length > 0 ? response[0].posisi : null
            }
        };
    }

    // Get current game status for a team
    async getStatus(team) {
        const container = await this.getActiveContainer();

        const gameState = stateManager.getGameState();

        const game = await executeQuery(
            "SELECT * FROM game_containers WHERE id = ? FOR UPDATE",
            [container.id]
        );

        let teamData = stateManager.getTeam(team.id);

        if (!teamData) {
            const dbTeam = await executeQuery(
                "SELECT id, name, current_position, total_score FROM teams WHERE id = ? AND game_container_id = ?",
                [team.id, container.id]
            );

            if (dbTeam.length > 0) {
                teamData = stateManager.createOrUpdateTeam(team.id, {
                    name: dbTeam[0].name,
                    currentPosition: game[0].posisi,
                    totalScore: dbTeam[0].total_score,
                });
            } else {
                teamData = {
                    name: team.name,
                    currentPosition: game[0].posisi,
                    totalScore: team.total_score,
                };
            }
        }

        const teamDb = await executeQuery(
            "SELECT id, name, current_position, total_score FROM teams WHERE id = ? AND game_container_id = ?",
            [team.id, container.id]
        );

        const decisions = await executeQuery(
            "SELECT position, score FROM team_decisions WHERE team_id = ? ORDER BY position",
            [team.id]
        );

        let currentScenario = null;

        if (teamData.currentPosition <= 7) {
            const scenario = await executeQuery(
                "SELECT * FROM game_scenarios WHERE position = ?",
                [game[0].posisi]
            );

            if (scenario.length > 0) {
                currentScenario = {
                    position: scenario[0].position,
                    title: scenario[0].title,
                    scenarioText: scenario[0].scenario_text,
                };
            }
        }

        const timeLimit = parseInt(
            await getGameSetting("answer_time_limit", "900")
        );

        return {
            success: true,
            data: {
                game: game[0],
                teamName: teamData.name,
                currentPosition: game[0].posisi,
                totalScore: teamData.totalScore,
                isGameComplete: teamData.currentPosition > 7,
                completedDecisions: decisions,
                currentScenario,
                timeLimit: timeLimit,
                globalGameState: gameState.status,
                globalCurrentStep: gameState.currentStep,
                completeCurrentStep: teamDb[0].current_position > game[0].posisi,
                team: teamDb[0],
                container: container
            },
        };
    }
}

module.exports = new GameService();
