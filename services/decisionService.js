const { executeQuery, getConnection } = require("../config/database");
const stateManager = require("../server-state-manager");
const { calculateScore } = require("../utils/gameUtils");

class DecisionService {
  // Submit decision for a scenario (with position parameter)
  async submitDecisionWithPosition(position, decision, reasoning, team) {
    if (position < 1 || position > 7) {
      throw new Error("Invalid scenario position");
    }

    // Check if already completed
    const existingDecision = await executeQuery(
      "SELECT id FROM team_decisions WHERE team_id = ? AND position = ?",
      [team.id, position]
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

    // Calculate score based on similarity to standard answer
    const score = calculateScore(
      decision,
      reasoning,
      scenario[0].standard_answer,
      scenario[0].standard_reasoning
    );

    // Start transaction
    const connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Save decision
      await connection.execute(
        "INSERT INTO team_decisions (team_id, position, decision, reasoning, score) VALUES (?, ?, ?, ?, ?)",
        [team.id, position, decision, reasoning, score]
      );

      // Update team position and total score
      const newPosition = position + 1;
      const newTotalScore = team.total_score + score;

      await connection.execute(
        "UPDATE teams SET current_position = ?, total_score = ? WHERE id = ?",
        [newPosition, newTotalScore, team.id]
      );

      await connection.commit();

      return {
        success: true,
        message: "Decision submitted successfully",
        data: {
          score,
          newPosition,
          newTotalScore,
          isGameComplete: newPosition > 7,
        },
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
    // Only require position. Allow decision and argumentation to be empty strings (for auto-submit)
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

    // Normalize decision and argumentation to empty strings if missing/undefined/null
    // This allows auto-submit with empty fields
    const normalizedDecision =
      decision !== undefined && decision !== null ? String(decision) : "";
    const normalizedArgumentation =
      argumentation !== undefined && argumentation !== null
        ? String(argumentation)
        : "";

    // Check if already completed
    const existingDecision = await executeQuery(
      "SELECT id FROM team_decisions WHERE team_id = ? AND position = ?",
      [team.id, positionNum]
    );

    if (existingDecision.length > 0) {
      throw new Error("This scenario has already been completed");
    }

    // Get standard answer for scoring
    const scenario = await executeQuery(
      "SELECT standard_answer, standard_reasoning, max_score FROM game_scenarios WHERE position = ?",
      [positionNum]
    );

    if (!scenario.length) {
      throw new Error("Scenario not found");
    }

    // Calculate score based on similarity to standard answer
    const score = calculateScore(
      normalizedDecision,
      normalizedArgumentation,
      scenario[0].standard_answer,
      scenario[0].standard_reasoning
    );

    // Start transaction
    const connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Save decision (with normalized values - empty strings are allowed)
      await connection.execute(
        "INSERT INTO team_decisions (team_id, position, decision, reasoning, score) VALUES (?, ?, ?, ?, ?)",
        [
          team.id,
          positionNum,
          normalizedDecision,
          normalizedArgumentation,
          score,
        ]
      );

      // Update team position and total score
      const newPosition = positionNum + 1;
      const newTotalScore = team.total_score + score;

      await connection.execute(
        "UPDATE teams SET current_position = ?, total_score = ? WHERE id = ?",
        [newPosition, newTotalScore, team.id]
      );

      await connection.commit();

      // Update stateManager for real-time tracking
      stateManager.addTeamDecision(team.id, {
        position: positionNum,
        decision: normalizedDecision,
        reasoning: normalizedArgumentation,
        score,
        newPosition,
        newTotalScore,
      });

      // Get scenario data for result
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
          total_score: newTotalScore,
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
              : "Penjelasan tidak tersedia",
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get decision
  async getDecision(teamId, position) {
    const decision = await executeQuery(
      "SELECT position, decision, reasoning, score FROM team_decisions WHERE team_id = ? AND position = ?",
      [teamId, position]
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
          standardArgumentation: standardAnswer[0].standard_reasoning,
        },
      };
    } else {
      return {
        success: false,
        message: "Decision not found",
      };
    }
  }
}

module.exports = new DecisionService();