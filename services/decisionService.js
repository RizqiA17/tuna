const { executeQuery, getConnection } = require("../config/database");
const stateManager = require("../server-state-manager");
const { calculateScore } = require("../utils/gameUtils");

class DecisionService {
    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT id FROM game_containers WHERE is_active = true LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container");
        }

        return container[0].id;
    }

    // Submit decision for a scenario (with position parameter)
    async submitDecisionWithPosition(position, decision, reasoning, team) {
        if (position < 1 || position > 7) {
            throw new Error("Invalid scenario position");
        }

        const activeContainerId = await this.getActiveContainer();

        // Check if already completed (container scoped)
        const existingDecision = await executeQuery(
            `SELECT td.id 
             FROM team_decisions td
             JOIN teams t ON td.team_id = t.id
             WHERE td.team_id = ? 
               AND td.position = ?
               AND t.game_container_id = ?`,
            [team.id, position, activeContainerId]
        );

        if (existingDecision.length > 0) {
            throw new Error("This scenario has already been completed");
        }

        // Get standard answer for scoring
        const scenario = await executeQuery(
            "SELECT standard_answer, standard_reasoning, max_score FROM game_scenarios WHERE position = ?",
            [position]
        );

        if (!scenario.length) {
            throw new Error("Scenario not found");
        }

        const score = calculateScore(
            decision,
            reasoning,
            scenario[0].standard_answer,
            scenario[0].standard_reasoning
        );

        const connection = await getConnection();
        await connection.beginTransaction();

        try {
            await connection.execute(
                "INSERT INTO team_decisions (team_id, position, decision, reasoning, score) VALUES (?, ?, ?, ?, ?)",
                [team.id, position, decision, reasoning, score]
            );

            const newPosition = position + 1;
            const newTotalScore = team.total_score + score;

            await connection.execute(
                `UPDATE teams 
                 SET current_position = ?, total_score = ? 
                 WHERE id = ? AND game_container_id = ?`,
                [newPosition, newTotalScore, team.id, activeContainerId]
            );

            await connection.commit();

            return {
                success: true,
                message: "Decision submitted successfully",
                data: {
                    score,
                    newPosition,
                    newTotalScore,
                    isGameComplete: newPosition > 7
                }
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Submit decision (without position parameter - for current scenario)
    async submitDecision(position, decision, argumentation, team) {
        const positionNum = parseInt(position);

        if (
            !position ||
            position === undefined ||
            position === null ||
            isNaN(positionNum) ||
            positionNum < 1 ||
            positionNum > 7
        ) {
            throw new Error("Valid position (1-7) is required");
        }

        const activeContainerId = await this.getActiveContainer();

        const normalizedDecision =
            decision !== undefined && decision !== null ? String(decision) : "";

        const normalizedArgumentation =
            argumentation !== undefined && argumentation !== null
                ? String(argumentation)
                : "";

        // Check if already completed (container scoped)
        const existingDecision = await executeQuery(
            `SELECT td.id 
             FROM team_decisions td
             JOIN teams t ON td.team_id = t.id
             WHERE td.team_id = ? 
               AND td.position = ?
               AND t.game_container_id = ?`,
            [team.id, positionNum, activeContainerId]
        );

        if (existingDecision.length > 0) {
            throw new Error("This scenario has already been completed");
        }

        const scenario = await executeQuery(
            "SELECT standard_answer, standard_reasoning, max_score FROM game_scenarios WHERE position = ?",
            [positionNum]
        );

        if (!scenario.length) {
            throw new Error("Scenario not found");
        }

        const score = calculateScore(
            normalizedDecision,
            normalizedArgumentation,
            scenario[0].standard_answer,
            scenario[0].standard_reasoning
        );

        const connection = await getConnection();
        await connection.beginTransaction();

        try {
            await connection.execute(
                "INSERT INTO team_decisions (team_id, position, decision, reasoning, score) VALUES (?, ?, ?, ?, ?)",
                [
                    team.id,
                    positionNum,
                    normalizedDecision,
                    normalizedArgumentation,
                    score
                ]
            );

            const newPosition = positionNum + 1;
            const newTotalScore = team.total_score + score;

            await connection.execute(
                `UPDATE teams 
                 SET current_position = ?, total_score = ? 
                 WHERE id = ? AND game_container_id = ?`,
                [newPosition, newTotalScore, team.id, activeContainerId]
            );

            await connection.commit();

            stateManager.addTeamDecision(team.id, {
                position: positionNum,
                decision: normalizedDecision,
                reasoning: normalizedArgumentation,
                score,
                newPosition,
                newTotalScore
            });

            const scenarioData = await executeQuery(
                "SELECT standard_answer, standard_reasoning FROM game_scenarios WHERE position = ?",
                [positionNum]
            );

            return {
                success: true,
                message: "Decision submitted successfully",
                team: {
                    id: team.id,
                    name: team.name,
                    current_position: newPosition,
                    total_score: newTotalScore
                },
                result: {
                    position: positionNum,
                    score: score,
                    teamDecision: normalizedDecision,
                    teamArgumentation: normalizedArgumentation,
                    standardAnswer:
                        scenarioData.length > 0
                            ? scenarioData[0].standard_answer
                            : "Jawaban standar tidak tersedia",
                    standardArgumentation:
                        scenarioData.length > 0
                            ? scenarioData[0].standard_reasoning
                            : "Penjelasan tidak tersedia"
                }
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Get decision (container based)
    async getDecision(teamId, position) {
        const activeContainerId = await this.getActiveContainer();

        const decision = await executeQuery(
            `SELECT td.position, td.decision, td.reasoning, td.score 
             FROM team_decisions td
             JOIN teams t ON td.team_id = t.id
             WHERE td.team_id = ? 
               AND td.position = ?
               AND t.game_container_id = ?`,
            [teamId, position, activeContainerId]
        );

        const standardAnswer = await executeQuery(
            "SELECT standard_answer, standard_reasoning FROM game_scenarios WHERE position = ?",
            [position]
        );

        if (decision.length > 0) {
            return {
                success: true,
                data: {
                    position: decision[0].position,
                    teamDecision: decision[0].decision,
                    teamArgumentation: decision[0].reasoning,
                    score: decision[0].score,
                    standardAnswer: standardAnswer[0].standard_answer,
                    standardArgumentation: standardAnswer[0].standard_reasoning
                }
            };
        } else {
            return {
                success: false,
                message: "Decision not found"
            };
        }
    }
}

module.exports = new DecisionService();
