const { executeQuery, getConnection } = require("../config/database");

class SettingsService {
  // Get game settings
  async getGameSettings() {
    const settings = await executeQuery(
      "SELECT setting_key, setting_value, description, updated_at FROM game_settings"
    );

    // Convert array to object for easier access
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
        // Validate answer_time_limit
        if (key === "answer_time_limit") {
          const timeLimit = parseInt(value);
          if (isNaN(timeLimit) || timeLimit < 60 || timeLimit > 3600) {
            await connection.rollback();
            throw new Error(
              "Time limit must be between 60 and 3600 seconds (1 minute to 1 hour)"
            );
          }
        }

        // Update or insert setting
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

      // Get updated settings
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