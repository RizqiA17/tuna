const { executeQuery, getConnection } = require("../config/database");

class SettingsService {

    async getActiveContainer() {
        const container = await executeQuery(
            "SELECT * FROM game_containers WHERE is_active = 1 LIMIT 1"
        );

        if (!container.length) {
            return null;
        }

        return container[0];
    }

    // Get game settings
    async getGameSettings() {
        const container = await this.getActiveContainer();

        const settings = await executeQuery(
            "SELECT setting_key, setting_value, description, updated_at FROM game_settings"
        );

        const settingsObj = {};

        settings.forEach((setting) => {
            settingsObj[setting.setting_key] = {
                value: setting.setting_value,
                description: setting.description,
                updated_at: setting.updated_at,
            };
        });

        return {
            success: true,
            data: settingsObj,
            container: container
        };
    }

    // Update game settings
    async updateGameSettings(settings, adminUsername) {
        if (!settings || typeof settings !== "object") {
            throw new Error("Invalid settings format");
        }

        const connection = await getConnection();
        await connection.beginTransaction();

        try {
            for (const [key, value] of Object.entries(settings)) {

                if (key === "answer_time_limit") {
                    const timeLimit = parseInt(value);
                    if (isNaN(timeLimit) || timeLimit < 60 || timeLimit > 3600) {
                        await connection.rollback();
                        throw new Error(
                            "Time limit must be between 60 and 3600 seconds (1 minute to 1 hour)"
                        );
                    }
                }

                await connection.execute(
                    `INSERT INTO game_settings (setting_key, setting_value, updated_by)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     setting_value = VALUES(setting_value),
                     updated_by = VALUES(updated_by),
                     updated_at = CURRENT_TIMESTAMP`,
                    [key, String(value), adminUsername || "admin"]
                );
            }

            await connection.commit();

            const updatedSettings = await executeQuery(
                "SELECT setting_key, setting_value, description, updated_at FROM game_settings"
            );

            const settingsObj = {};
            updatedSettings.forEach((setting) => {
                settingsObj[setting.setting_key] = {
                    value: setting.setting_value,
                    description: setting.description,
                    updated_at: setting.updated_at,
                };
            });

            return {
                success: true,
                message: "Game settings updated successfully",
                data: settingsObj,
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new SettingsService();
