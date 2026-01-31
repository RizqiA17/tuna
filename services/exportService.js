const { executeQuery } = require("../config/database");

class ExportService {
    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT id FROM game_containers WHERE is_active = true LIMIT 1"
        );

        if (!container.length) {
            throw new Error("No active game container");
        }

        return container[0].id;
    }

    // Export team data to CSV format (container based)
    async exportTeams() {
        const activeContainerId = await this.getActiveContainer();

        const teams = await executeQuery(
            `
            SELECT
                t.id,
                t.name AS team_name,
                t.current_position,
                t.total_score,
                t.created_at,
                COUNT(p.id) AS player_count,
                GROUP_CONCAT(p.name SEPARATOR '; ') AS players
            FROM teams t
            LEFT JOIN players p ON t.id = p.team_id
            WHERE t.game_container_id = ?
            GROUP BY t.id, t.name, t.current_position, t.total_score, t.created_at
            ORDER BY t.total_score DESC, t.current_position DESC
            `,
            [activeContainerId]
        );

        const csvHeader =
            "ID,Team Name,Current Position,Total Score,Player Count,Players,Created At\n";

        const csvRows = teams
            .map(
                (team) =>
                    `${team.id},"${team.team_name}",${team.current_position},${team.total_score},${team.player_count},"${team.players || ""}","${team.created_at}"`
            )
            .join("\n");

        return csvHeader + csvRows;
    }

    // Export decisions data to CSV format (container based)
    async exportDecisions() {
        const activeContainerId = await this.getActiveContainer();

        const decisions = await executeQuery(
            `
            SELECT
                td.id,
                t.name AS team_name,
                td.position,
                gs.title AS scenario_title,
                td.decision,
                td.reasoning,
                td.score,
                td.created_at
            FROM team_decisions td
            JOIN teams t ON td.team_id = t.id
            JOIN game_scenarios gs ON td.position = gs.position
            WHERE t.game_container_id = ?
            ORDER BY td.position, td.score DESC
            `,
            [activeContainerId]
        );

        const csvHeader =
            "ID,Team Name,Position,Scenario Title,Decision,Reasoning,Score,Created At\n";

        const csvRows = decisions
            .map((decision) => {
                const safeDecision = (decision.decision || "").replace(/"/g, '""');
                const safeReasoning = (decision.reasoning || "").replace(/"/g, '""');

                return `${decision.id},"${decision.team_name}",${decision.position},"${decision.scenario_title}","${safeDecision}","${safeReasoning}",${decision.score},"${decision.created_at}"`;
            })
            .join("\n");

        return csvHeader + csvRows;
    }
}

module.exports = new ExportService();
