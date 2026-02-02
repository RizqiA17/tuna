const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { executeQuery } = require("../config/database");
const { generateToken } = require("../middleware/auth");
const {
    validateTeamRegistration,
    validateTeamLogin,
    createRateLimit,
} = require("../middleware/validation");

const stateManager = require("../server-state-manager");

const router = express.Router();

const authRateLimit = rateLimit(createRateLimit(60 * 1000, 360));
const registrationRateLimit = rateLimit(createRateLimit(60 * 1000, 360));

async function getActiveContainer() {
    const rows = await executeQuery(
        "SELECT * FROM game_containers WHERE is_active = true LIMIT 1"
    );

    if (!rows.length) {
        throw new Error("No active game container");
    }

    return rows[0];
}

// ================= REGISTER =================
router.post(
    "/register",
    registrationRateLimit,
    validateTeamRegistration,
    async (req, res) => {
        try {
            const { teamName, password, players } = req.body;
            const container = await getActiveContainer();

            const existingTeam = await executeQuery(
                "SELECT id FROM teams WHERE name = ? AND game_container_id = ?",
                [teamName, container.id]
            );

            if (existingTeam.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Team name already exists",
                });
            }

            const hashedPassword = await bcrypt.hash(password, 12);

            const connection = await require("../config/database").getConnection();
            await connection.beginTransaction();

            try {
                const teamResult = await connection.execute(
                    "INSERT INTO teams (name, password, game_container_id) VALUES (?, ?, ?)",
                    [teamName, hashedPassword, container.id]
                );

                const teamId = teamResult[0].insertId;

                for (let i = 0; i < players.length; i++) {
                    const player = players[i];
                    const role = i === 0 ? "leader" : "member";

                    await connection.execute(
                        "INSERT INTO players (team_id, name, role) VALUES (?, ?, ?)",
                        [teamId, player.name, role]
                    );
                }

                await connection.commit();

                stateManager.createOrUpdateTeam(teamId, {
                    name: teamName,
                    currentPosition: 1,
                    totalScore: 0,
                    decisions: [],
                    createdAt: new Date().toISOString()
                });

                const token = generateToken(teamId);

                res.status(201).json({
                    success: true,
                    message: "Team registered successfully",
                    data: {
                        teamId,
                        teamName,
                        currentPosition: 1,
                        totalScore: 0,
                        token,
                        players,
                        gameStatus: container.status
                    },
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error("Registration error:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
);

// ================= LOGIN =================
router.post("/login", authRateLimit, validateTeamLogin, async (req, res) => {
    try {
        const { teamName, password } = req.body;
        const container = await getActiveContainer();

        const team = await executeQuery(
            "SELECT id, name, password, current_position, total_score FROM teams WHERE name = ? AND game_container_id = ?",
            [teamName, container.id]
        );

        if (!team.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid team name or password",
            });
        }

        const isValidPassword = await bcrypt.compare(password, team[0].password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid team name or password",
            });
        }

        if (container.posisi > team[0].current_position) {
            await executeQuery(
                "UPDATE teams SET current_position = ? WHERE id = ?",
                [container.posisi, team[0].id]
            );

            for (let i = team[0].current_position; i < container.posisi; i++) {
                try {
                    await executeQuery(
                        "INSERT INTO team_decisions (team_id, position, decision, reasoning, score) VALUES (?, ?, ?, ?, ?)",
                        [team[0].id, i, "", "", 0]
                    );
                } catch (e) { }
            }
        }

        await executeQuery(
            "DELETE FROM team_decisions WHERE team_id = ?",
            [team[0].id]
        );

        const token = generateToken(team[0].id);

        const players = await executeQuery(
            "SELECT name, role FROM players WHERE team_id = ? ORDER BY role DESC, id ASC",
            [team[0].id]
        );

        if (container.status === "menunggu") {
            await executeQuery(
                "UPDATE teams SET current_position = 1, total_score = 0 WHERE id = ?",
                [team[0].id]
            );

            await executeQuery(
                "DELETE FROM team_decisions WHERE team_id = ?",
                [team[0].id]
            );
        }

        res.json({
            success: true,
            message: "Login successful",
            data: {
                game: container,
                teamId: team[0].id,
                teamName: team[0].name,
                currentPosition: container.posisi,
                totalScore: team[0].total_score,
                token,
                players,
                gameStatus: container.status === "menunggu"
                    ? "waiting"
                    : container.status === "mulai"
                        ? "running"
                        : "ended",
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

// ================= ME =================
router.get(
    "/me",
    require("../middleware/auth").authenticateToken,
    async (req, res) => {
        try {
            const teamId = req.team.id;
            const container = await getActiveContainer();

            const team = await executeQuery(
                "SELECT id, name, current_position, total_score FROM teams WHERE id = ? AND game_container_id = ?",
                [teamId, container.id]
            );

            const players = await executeQuery(
                "SELECT name, role FROM players WHERE team_id = ? ORDER BY role DESC, id ASC",
                [teamId]
            );

            res.json({
                success: true,
                data: {
                    game: container,
                    teamId: team[0].id,
                    teamName: team[0].name,
                    currentPosition: container.posisi,
                    totalScore: team[0].total_score,
                    players,
                    gameStatus: container.status,
                },
            });
        } catch (error) {
            console.error("Get team info error:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
);

module.exports = router;
