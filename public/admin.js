// Admin Panel JavaScript
import { API_BASE, STORAGE_KEYS } from './js/config/constants.js';
import { formatDate } from './js/utils/helpers.js';
import { ApiService } from './js/services/ApiService.js';
import { WebSocketService } from './js/services/WebSocketService.js';
import { AdminUIRenderer } from './js/ui/AdminUIRenderer.js';
import { AdminEventHandler } from './js/events/AdminEventHandler.js';

class AdminPanel {
  constructor() {
    this.apiBase = API_BASE;
    this.token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    this.apiService = new ApiService(this.token);
    this.wsService = new WebSocketService();
    this.currentSection = "overview";
    this.teamsData = [];
    this.statsData = {};
    this.scenarioData = {};
    this.socket = null;
    this.connectedTeams = new Map();
    this.realTimeTeams = new Map();
    this.gameState = "waiting"; // waiting, running, ended
    this.teamsCompletedCurrentStep = new Set();
    this.currentStep = 0;
    this.gameSettings = {}; // Store game settings
    this.containersData = []; // Store containers data
    this.logger = window.AdminLogger || new Logger("ADMIN");
    this.uiRenderer = new AdminUIRenderer(this);
    this.eventHandler = new AdminEventHandler(this);

    this.init();
  }

  async init() {
    console.log("🔧 Initializing Admin Panel...");

    // Initialize dark mode
    this.initDarkMode();

    // Initialize WebSocket connection
    this.initWebSocket();

    this.checkRequiredElements();

    // Check if user is already authenticated
    if (this.token) {
      try {
        // Test if token is still valid
        await this.apiService.request("/admin/teams");

        // Restore admin state
        const stateRestored = this.restoreAdminState();
        if (stateRestored) {
          console.log("Admin state restored successfully");
        }

        this.showAdminPanel();

        // Show the restored section immediately (like handleLogin does)
        if (stateRestored) {
          this.showSection(this.currentSection);
          console.log(`🔄 Admin section restored: ${this.currentSection}`);

          // Update UI based on restored state
          this.updateGameControlButtons();
          this.updateGameStatus(this.getGameStatusText(this.gameState));
          console.log(
            `🔄 Admin UI updated with restored state - gameState: ${this.gameState}, step: ${this.currentStep}`
          );
        }
      } catch (error) {
        console.log("Token invalid, showing login screen");
        this.showLoginScreen();
      }
    } else {
      this.showLoginScreen();
    }
  }

  checkRequiredElements() {
    const requiredElements = [
      "adminLoginForm",
      "refreshDataBtn",
      "exportDataBtn",
      "logoutBtn",
      "darkModeBtn",
    ];

    requiredElements.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) {
        console.warn(`⚠️ Required element with id '${id}' not found`);
      }
    });

    // Check navigation buttons (analytics button is hidden)
    const navButtons = document.querySelectorAll(".nav-btn");
    if (navButtons.length === 0) {
      console.warn("⚠️ No navigation buttons found");
    }

    // Check sections (analytics section is hidden)
    const sections = document.querySelectorAll(".admin-section");
    if (sections.length === 0) {
      console.warn("⚠️ No admin sections found");
    }
  }



  async loadData() {
    this.showLoading(true);

    try {
      // Load all data in parallel
      const [
        teamsResponse,
        statsResponse,
        leaderboardResponse,
        settingsResponse,
      ] = await Promise.all([
        this.apiService.request("/admin/teams"),
        this.apiService.request("/admin/stats"),
        this.apiService.request("/admin/leaderboard"),
        this.apiService.request("/admin/game-settings"),
      ]);

      this.updateTeamCompleted();

      this.teamsData = teamsResponse.data;
      this.statsData = statsResponse.data;
      this.leaderboardData = leaderboardResponse.data;

      // Load game settings
      if (settingsResponse.success) {
        this.gameSettings = settingsResponse.data;
        this.updateGameSettingsUI();
      }

      // Update game state from server stats
      if (this.statsData.gameState) {
        this.gameState = this.statsData.gameState;
        this.currentStep = this.statsData.currentStep || 0;
      }

      console.log(this.gameState);

      this.checkTeamsCompletedCurrentStep();
      // console.log(this.teamsCompletedCurrentStep.size);

      // Update UI
      this.updateOverview();
      this.updateTeamsTable();
      this.updateLeaderboard();
      this.updateScenarioStats();
      this.updateRealTimeMonitoring();
      this.updatePosition();
      this.updateGameStatus(this.getGameStatusText(this.gameState));
      this.updateGameControlButtons();

      this.showNotification("Data refreshed successfully!", "success");
    } catch (error) {
      console.error("Error loading data:", error);
      this.showNotification("Failed to load data: " + error.message, "error");
    } finally {
      this.showLoading(false);
    }
  }

  // WebSocket Methods
  initWebSocket() {
    this.wsService.connect();

    this.wsService.on("connect", () => {
      console.log("🔌 Admin connected to server");
      this.wsService.emit("admin-join");
      this.showNotification("Connected to server", "success");
    });

    this.wsService.on("disconnect", () => {
      console.log("🔌 Admin disconnected from server");
    });

    // Listen for team connections
    this.wsService.on("connected-teams", (teams) => {
      console.log("👥 Received connected teams:", teams);
      this.connectedTeams.clear();
      teams.forEach((team) => {
        this.connectedTeams.set(team.teamId, team);
      });
      this.updateConnectedTeamsCount();
      this.updateRealTimeMonitoring();
      this.updateGameControlButtons();

      // Check which teams have already completed current step
      this.checkTeamsCompletedCurrentStep();
    });

    this.wsService.on("team-connected", (data) => {
      console.log("👥 Team connected:", data);
      this.connectedTeams.set(data.teamId, data);
      this.updateConnectedTeamsCount();
      this.updateRealTimeMonitoring();
      this.updateGameControlButtons();
      this.updateTeamCompleted();
      this.showNotification(`Team ${data.teamName} connected`, "info");

      // Check if this team has already completed current step
      this.checkTeamsCompletedCurrentStep();
    });

    this.wsService.on("team-disconnected", (data) => {
      console.log("👥 Team disconnected:", data);
      this.connectedTeams.delete(data.teamId);
      this.teamsCompletedCurrentStep.delete(data.teamId);
      this.updateConnectedTeamsCount();
      this.updateRealTimeMonitoring();
      this.updateGameControlButtons();

      // Different notification based on reason
      const reason = data.reason || "disconnected";
      const message =
        reason === "logout"
          ? `Team ${data.teamName} logged out`
          : `Team ${data.teamName} disconnected`;
      this.showNotification(message, "warning");
    });

    // Listen for team progress updates
    this.wsService.on("team-progress-update", (data) => {
      console.log("📊 Team progress update:", data);
      this.realTimeTeams.set(data.teamId, data);

      // Update team data in connectedTeams
      if (this.connectedTeams.has(data.teamId)) {
        const teamData = this.connectedTeams.get(data.teamId);
        teamData.position = data.currentPosition;
        teamData.score = data.totalScore;
        teamData.isCompleted = data.isCompleted;
        this.connectedTeams.set(data.teamId, teamData);
      }

      // Track team completion for current step
      // A team completes a step when they submit a decision
      // We track this by checking if they have a position > 1 (meaning they submitted at least one decision)
      if (data.currentPosition > 1) {
        this.teamsCompletedCurrentStep.add(data.teamId);
        console.log(
          `✅ Team ${data.teamName} completed step ${this.currentStep}, total completed: ${this.teamsCompletedCurrentStep.size}`
        );
      }

      this.updateRealTimeMonitoring();
      this.updateGameControlButtons();
    });

    this.wsService.on("team-decision-submitted", (data) => {
      console.log("📝 Team decision submitted:", data);

      // Update team data in connectedTeams
      if (this.connectedTeams.has(data.teamId)) {
        const teamData = this.connectedTeams.get(data.teamId);
        teamData.position = data.position;
        teamData.score = data.score;
        this.connectedTeams.set(data.teamId, teamData);
      }

      this.updateRealTimeMonitoring();
      this.updateTeamCompleted();
      this.showNotification(
        `Team ${data.teamName} submitted decision for position ${data.position}`,
        "success"
      );
    });

    // Listen for game status updates
    this.wsService.on("game-started", () => {
      console.log("🎮 Game started for all teams");
      this.gameState = "running";
      this.currentStep = 1;
      this.teamsCompletedCurrentStep.clear();
      this.saveAdminState();
      this.updateGameStatus("Running");
      this.updateGameControlButtons();
      this.showNotification("Game started for all teams", "success");
    });

    this.wsService.on("scenario-advanced", () => {
      console.log("➡️ Scenario advanced for all teams");
      this.teamsCompletedCurrentStep.clear();
      this.saveAdminState();
      this.updateGameControlButtons();
      this.showNotification("Advanced to next scenario for all teams", "info");
    });

    this.wsService.on("game-ended", () => {
      console.log("🏁 Game ended for all teams");
      this.updateGameStatus("Ended");
      this.updateGameControlButtons();
      this.showNotification("Game ended for all teams", "warning");
    });

    this.wsService.on("game-reset", () => {
      console.log("🔄 Game reset for all teams");
      // Reset game state and current step
      this.gameState = "waiting";
      this.currentStep = 0;
      this.teamsCompletedCurrentStep.clear();
      this.saveAdminState();
      this.updateGameStatus("Reset Complete");
      this.updateGameControlButtons();
      this.showNotification("Game reset for all teams", "success");
    });

    // Listen for game state updates from server
    this.wsService.on("game-state-update", async (data) => {
      console.log("🔄 Game state update from server:", data);

      const gameState = await this.apiService.request("/admin/game-status");
      const gameStep = await this.apiService.request("/admin/game-position")
      console.log(gameState)
      console.log(gameStep)
      const oldGameState = this.gameState;
      this.gameState = gameState.data.status;
      this.currentStep = gameStep.data.position;
      this.updateGameStatus(gameState.data.status);
      this.updateGameControlButtons();

      // Show notification if game state was reset (server restart)
      if (oldGameState !== this.gameState && this.gameState === "waiting") {
        this.showNotification(
          "Server restarted - Game state reset to waiting",
          "info"
        );
      }
    });
  }

  // Game Control Methods
  async startGameForAllTeams() {
    if (this.wsService.connected) {
      this.gameState = "running";
      this.teamsCompletedCurrentStep.clear();
      this.saveAdminState();
      this.wsService.emit("start-game-all");
      this.updateGameStatus("Starting...");
      this.updateTeamCompleted();
      this.updateGameControlButtons();
      const state = await fetch(`${this.apiBase}/admin/game-status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          status: "mulai",
        }),
      });

      // const currentPos = await fetch(`${this.apiBase}/admin/game-position`, {
      //   method: "GET",
      //   headers: {
      //     "Content-Type": "application/json",
      //     Authorization: `Bearer ${this.token}`,
      //   },
      // });

      const posistion = await fetch(`${this.apiBase}/admin/game-position`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          position: 1,
        }),
      });

      this.updatePosition();
    }
  }

  async nextScenarioForAllTeams() {
    if (this.wsService.connected) {
      // Don't increment here - will be done in scenario-advanced handler
      // this.currentStep++;
      this.teamsCompletedCurrentStep.clear();
      this.saveAdminState();
      this.wsService.emit("next-scenario-all");
      this.updateGameControlButtons();

      try {
        const currentPos = await fetch(`${this.apiBase}/admin/game-position`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
          },
        });

        const pos = await currentPos.json();

        console.log(pos);

        if (pos.data.position < 7) {
          const posistion = await fetch(`${this.apiBase}/admin/game-position`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({
              position: pos.data.position + 1,
            }),
          });
          this.currentStep = pos.data.position + 1;
          this.teamsCompletedCurrentStep.clear();
          this.updateTeamCompleted();
        } else {
          const gameState = await fetch(`${this.apiBase}/admin/game-status`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({
              status: "selesai",
            }),

          });
          this.gameState = 'ended';
          this.updateGameStatus("Ended");
          this.updateGameControlButtons();
        }
        this.updatePosition();
      } catch (error) {
        console.error("Error advancing scenario position:", error);
        console.log("Tes1");
      }

      // Check completed teams after advancing step
      setTimeout(() => {
        this.forceCheckCompletedTeams();
      }, 1000);
    }
  }

  async endGameForAllTeams() {
    if (this.wsService.connected) {
      this.gameState = "ended";
      this.saveAdminState();
      this.wsService.emit("end-game-all");
      this.updateGameStatus("Ending...");
      this.updateGameControlButtons();
      const state = await fetch(`${this.apiBase}/admin/game-status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          status: "selesai",
        }),
      });
    }
  }

  async resetGameForAllTeams() {
    if (
      confirm(
        "Are you sure you want to reset the game for all teams? This will clear all progress and decisions."
      )
    ) {
      try {
        this.showLoading(true);
        this.updateGameStatus("Resetting...");

        const response = await fetch(`${this.apiBase}/admin/reset-game`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
          },
        });

        this.currentStep = 0;

        const data = await response.json();

        if (data.success) {
          // Reset admin state
          this.gameState = "waiting";
          this.teamsCompletedCurrentStep.clear();
          this.saveAdminState();

          // Emit reset command to all teams via WebSocket
          if (this.wsService.connected) {
            this.wsService.emit("reset-game-all");
          }

          this.updateGameStatus("Reset Complete");
          this.updateGameControlButtons();
          this.showNotification(
            "Game reset successfully for all teams",
            "success"
          );
          this.updatePosition();

          // Refresh data
          await this.loadData();
        } else {
          this.showNotification(
            data.message || "Failed to reset game",
            "error"
          );
        }
      } catch (error) {
        console.error("Reset game error:", error);
        this.showNotification("Failed to reset game", "error");
      } finally {
        this.showLoading(false);
      }
    }
  }

  kickTeam(teamId) {
    if (
      this.wsService.connected &&
      confirm(
        "Are you sure you want to kick this team? This will remove them from the game and they will need to rejoin."
      )
    ) {
      this.wsService.emit("kick-team", { teamId });
      this.showNotification("Team kicked from game", "warning");

      // Remove team from connected teams immediately
      this.connectedTeams.delete(teamId);
      this.updateConnectedTeamsCount();
      this.updateRealTimeMonitoring();
    }
  }

  updateGameStatus(status) {
    this.uiRenderer.updateGameStatus(status);
  }

  getGameStatusText(gameState) {
    const statusMap = {
      waiting: "Waiting",
      running: "Running",
      ended: "Ended",
    };
    return statusMap[gameState] || "Unknown";
  }

  updateConnectedTeamsCount() {
    this.uiRenderer.updateConnectedTeamsCount();
  }

  updateTeamCompleted() {
    this.uiRenderer.updateTeamCompleted();
  }

  updatePosition() {
    this.uiRenderer.updatePosition();
  }

  updateGameControlButtons() {
    this.uiRenderer.updateGameControlButtons();
  }

  async updateRealTimeMonitoring() {
    this.uiRenderer.updateRealTimeMonitoring();
  }

  async showSection(sectionName) {
    this.uiRenderer.showSection(sectionName);
  }

  updateOverview() {
    this.uiRenderer.updateOverview();
  }



  updateTeamsTable() {
    this.uiRenderer.updateTeamsTable();
  }

  updateLeaderboard() {
    this.uiRenderer.updateLeaderboard();
  }

  updateScenarioStats() {
    this.uiRenderer.updateScenarioStats();
  }

  async viewTeamDetails(teamId) {
    try {
      this.showLoading(true);
      const response = await this.apiService.request(`/admin/teams/${teamId}`);
      this.showTeamDetailsModal(response.data);
    } catch (error) {
      this.showNotification(
        "Failed to load team details: " + error.message,
        "error"
      );
    } finally {
      this.showLoading(false);
    }
  }

  showTeamDetailsModal(data) {
    this.uiRenderer.showTeamDetailsModal(data);
  }

  async showScenarioDecisions(position) {
    try {
      this.showLoading(true);
      const response = await this.apiService.request(
        `/admin/scenarios/${position}/decisions`
      );
      this.showScenarioDecisionsModal(response.data);
    } catch (error) {
      this.showNotification(
        "Failed to load scenario decisions: " + error.message,
        "error"
      );
    } finally {
      this.showLoading(false);
    }
  }

  showScenarioDecisionsModal(data) {
    this.uiRenderer.showScenarioDecisionsModal(data);
  }

  filterTeams(searchTerm) {
    this.uiRenderer.filterTeams(searchTerm);
  }

  filterTeamsByStatus(status) {
    this.uiRenderer.filterTeamsByStatus(status);
  }

  filterLeaderboard(filter) {
    this.uiRenderer.filterLeaderboard(filter);
  }

  async exportData() {
    try {
      // Export teams data
      const teamsResponse = await fetch(`${this.apiBase}/admin/export/teams`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (teamsResponse.ok) {
        const blob = await teamsResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `teams_export_${new Date().toISOString().split("T")[0]
          }.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      // Export decisions data
      const decisionsResponse = await fetch(
        `${this.apiBase}/admin/export/decisions`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      if (decisionsResponse.ok) {
        const blob = await decisionsResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `decisions_export_${new Date().toISOString().split("T")[0]
          }.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      this.showNotification("Data exported successfully!", "success");
    } catch (error) {
      this.showNotification("Failed to export data: " + error.message, "error");
    }
  }

  loadAnalytics() {
    // Analytics section is hidden - this method is kept for compatibility
    // Placeholder for analytics charts
    // In a real implementation, you would use a charting library like Chart.js
    console.log("Loading analytics...");
  }



  showLoading(show) {
    this.uiRenderer.showLoading(show);
  }

  closeModals() {
    this.uiRenderer.closeModals();
  }

  showNotification(message, type = "info") {
    this.uiRenderer.showNotification(message, type);
  }

  async handleAdminLogin() {
    const formData = new FormData(document.getElementById("adminLoginForm"));
    const data = {
      username: formData.get("username"),
      password: formData.get("password"),
    };

    try {
      this.showLoading(true);
      const response = await this.apiService.request("/admin/login", {
        method: "POST",
        body: JSON.stringify(data),
      });

      this.token = response.data.token;
      localStorage.setItem(STORAGE_KEYS.TOKEN, this.token);
      this.apiService.setToken(this.token);
      this.currentStep = response.data.gameStatus.posisi;

      this.showAdminPanel();
      this.updatePosition();
      this.showNotification("Admin login successful!", "success");
    } catch (error) {
      this.showNotification("Login failed: " + error.message, "error");
    } finally {
      this.showLoading(false);
    }
  }

  showLoginScreen() {
    this.uiRenderer.showLoginScreen();
  }

  showAdminPanel() {
    this.uiRenderer.showAdminPanel();
  }

  logout() {
    this.token = null;
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    this.apiService.setToken(null);
    this.clearAdminState();
    this.showLoginScreen();
    this.showNotification("Logged out successfully", "info");
  }

  // Dark Mode Management
  toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    // Apply theme with smooth transition
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);

    // Update icon with animation
    const icon = document.getElementById("darkModeIcon");
    const toggleBtn = document.getElementById("darkModeBtn");

    if (icon && toggleBtn) {
      // Add rotation animation
      toggleBtn.style.transform = "rotate(180deg)";
      setTimeout(() => {
        icon.className = newTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
        toggleBtn.style.transform = "rotate(0deg)";
      }, 150);
    }

    // Show notification with theme-specific styling
    const themeName = newTheme === "dark" ? "Dark" : "Light";
    this.showNotification(`Switched to ${themeName} Mode`, "info");
  }

  initDarkMode() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Update icon based on saved theme
    const icon = document.getElementById("darkModeIcon");
    const toggleBtn = document.getElementById("darkModeBtn");

    if (icon && toggleBtn) {
      icon.className = savedTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
      toggleBtn.title = `Switch to ${savedTheme === "dark" ? "Light" : "Dark"
        } Mode`;
    }
  }

  // Admin state persistence methods
  saveAdminState() {
    const adminState = {
      currentSection: this.currentSection,
      gameState: this.gameState,
      currentStep: this.currentStep,
      teamsCompletedCurrentStep: Array.from(this.teamsCompletedCurrentStep),
    };
    localStorage.setItem(STORAGE_KEYS.ADMIN_STATE, JSON.stringify(adminState));
  }

  async restoreAdminState() {
    try {
      const savedState = localStorage.getItem(STORAGE_KEYS.ADMIN_STATE);
      if (savedState) {
        const adminState = JSON.parse(savedState);
        this.currentSection = adminState.currentSection || "overview";

        const gameState = await this.apiService.request("/admin/game-status");
        const gameStep = await this.apiService.request("/admin/game-position")

        // Restore game state from localStorage to maintain UI state
        this.gameState = gameState.data.status || "waiting";
        this.currentStep = gameStep.data.position;
        this.teamsCompletedCurrentStep = new Set(
          adminState.teamsCompletedCurrentStep || []
        );

        console.log(
          `🔄 Admin state restored - section: ${this.currentSection}, gameState: ${this.gameState}, step: ${this.currentStep}`
        );
        return true;
      }
    } catch (error) {
      console.error("Error restoring admin state:", error);
    }
    return false;
  }

  clearAdminState() {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_STATE);
  }

  // Check which teams have already completed current step based on database
  async checkTeamsCompletedCurrentStep() {
    if (this.gameState !== "running" || this.connectedTeams.size === 0) {
      return;
    }

    try {

      // Get all teams data to check their progress
      const response = await this.apiService.request("/admin/teams");
      if (!response.success) return;
      console.log(`🔍 Checking completed teams for step ${this.currentStep}`);

      const teamsData = response.data;

      // selalu reset
      this.teamsCompletedCurrentStep.clear();

      // gunakan data dari DB, bukan connectedTeams
      for (const teamData of teamsData) {
        const teamId = teamData.id;

        if (teamData.current_position > this.currentStep) {
          this.teamsCompletedCurrentStep.add(teamId);
          continue;
        }

        // if (teamData.current_position === this.currentStep) {
        //   const hasSubmitted = await this.checkTeamDecisionForCurrentStep(teamId);
        //   if (hasSubmitted) {
        //     this.teamsCompletedCurrentStep.add(teamId);
        //   }
        // }
      }
      // console.log(this.teamsCompletedCurrentStep.size);
      this.updateTeamCompleted();

    } catch (error) {
      console.error("❌ Error checking completed teams:", error);
    }
  }

  // Force check completed teams (called when admin needs to refresh)
  async forceCheckCompletedTeams() {
    console.log("🔄 Force checking completed teams...");
    await this.checkTeamsCompletedCurrentStep();
  }

  // Check if team has submitted decision for current step
  async checkTeamDecisionForCurrentStep(teamId) {
    try {
      const response = await this.apiService.request(`/admin/teams/${teamId}`);
      if (response.success) {
        const teamData = response.data;
        const hasDecisionForCurrentStep = teamData.decisions.some(
          (decision) => decision.position === this.currentStep
        );
        return hasDecisionForCurrentStep;
      }
    } catch (error) {
      console.error(`❌ Error checking decision for team ${teamId}:`, error);
    }
    return false;
  }

  // Game Settings Methods
  async loadGameSettings() {
    try {
      const response = await this.apiService.request("/admin/game-settings");
      if (response.success) {
        this.gameSettings = response.data;
        this.updateGameSettingsUI();
      }
    } catch (error) {
      console.error("Error loading game settings:", error);
      this.showNotification("Gagal memuat pengaturan game", "error");
    }
  }

  updateGameSettingsUI() {
    this.uiRenderer.updateGameSettingsUI();
  }

  async saveTimeLimit() {
    const answerTimeLimitInput = document.getElementById("answerTimeLimit");
    const timeLimitStatus = document.getElementById("timeLimitStatus");
    const saveBtn = document.getElementById("saveTimeLimitBtn");

    if (!answerTimeLimitInput || !timeLimitStatus) return;

    const minutes = parseInt(answerTimeLimitInput.value);

    // Validate input
    if (isNaN(minutes) || minutes < 1 || minutes > 60) {
      timeLimitStatus.innerHTML = `
                <i class="fas fa-exclamation-circle"></i> 
                Masukkan nilai antara 1-60 menit
            `;
      timeLimitStatus.className = "setting-status error";
      timeLimitStatus.style.display = "block";
      return;
    }

    // Convert minutes to seconds
    const seconds = minutes * 60;

    // Disable button during save
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    }

    try {
      const response = await this.apiService.request("/admin/game-settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: {
            answer_time_limit: seconds,
          },
        }),
      });

      if (response.success) {
        // Update game settings
        this.gameSettings = response.data;

        // Update UI
        this.updateGameSettingsUI();

        // Show success message
        timeLimitStatus.innerHTML = `
                    <i class="fas fa-check-circle"></i> 
                    Waktu berhasil diubah menjadi ${minutes} menit (${seconds} detik)
                `;
        timeLimitStatus.className = "setting-status success";
        timeLimitStatus.style.display = "block";

        this.showNotification(
          `Waktu game berhasil diubah menjadi ${minutes} menit`,
          "success"
        );

        // Hide status after 3 seconds
        setTimeout(() => {
          if (
            this.gameSettings &&
            this.gameSettings.answer_time_limit &&
            this.gameSettings.answer_time_limit.updated_at
          ) {
            const updatedDate = new Date(
              this.gameSettings.answer_time_limit.updated_at
            );
            timeLimitStatus.innerHTML = `
                            <i class="fas fa-check-circle"></i> 
                            Terakhir diupdate: ${updatedDate.toLocaleString(
              "id-ID"
            )}
                        `;
          }
        }, 3000);
      } else {
        throw new Error(response.message || "Gagal menyimpan pengaturan");
      }
    } catch (error) {
      console.error("Error saving time limit:", error);
      timeLimitStatus.innerHTML = `
                <i class="fas fa-exclamation-circle"></i> 
                Gagal menyimpan: ${error.message || "Terjadi kesalahan"}
            `;
      timeLimitStatus.className = "setting-status error";
      timeLimitStatus.style.display = "block";
      this.showNotification("Gagal menyimpan pengaturan waktu", "error");
    } finally {
      // Re-enable button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Simpan';
      }
    }
  }

  // Container management methods
  async loadContainers() {
    try {
      const response = await this.apiService.request("/admin/containers");
      if (response.success) {
        this.containersData = response.data;
        this.renderContainers();
      } else {
        throw new Error(response.message || "Failed to load containers");
      }
    } catch (error) {
      console.error("Error loading containers:", error);
      this.showNotification("Failed to load containers", "error");
    }
  }

  renderContainers() {
    const tbody = document.getElementById("containersTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (this.containersData.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td colspan="7" style="text-align: center; padding: 2rem;">
          <i class="fas fa-box-open"></i> No containers found
        </td>
      `;
      tbody.appendChild(row);
      return;
    }

    this.containersData.forEach(container => {
      const row = document.createElement("tr");
      const statusText = container.status === "menunggu" ? "Waiting" :
                        container.status === "mulai" ? "Running" : "Ended";
      const statusClass = container.status === "menunggu" ? "status-waiting" :
                         container.status === "mulai" ? "status-running" : "status-ended";
      const activeIcon = container.is_active ? '<i class="fas fa-check-circle" style="color: #28a745;"></i>' : '<i class="fas fa-times-circle" style="color: #dc3545;"></i>';

      row.innerHTML = `
        <td>${container.id}</td>
        <td>${container.name}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${activeIcon}</td>
        <td>${container.posisi}</td>
        <td>${formatDate(container.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-primary edit-container" data-id="${container.id}">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="btn btn-sm btn-danger delete-container" data-id="${container.id}" ${container.is_active ? 'disabled' : ''}>
            <i class="fas fa-trash"></i> Delete
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Add event listeners
    tbody.querySelectorAll(".edit-container").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest("button").dataset.id;
        this.editContainer(id);
      });
    });

    tbody.querySelectorAll(".delete-container").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest("button").dataset.id;
        this.deleteContainer(id);
      });
    });
  }

  showAddContainerModal() {
    document.getElementById("containerModalTitle").textContent = "Add Container";
    document.getElementById("containerForm").reset();
    document.getElementById("containerModal").style.display = "block";
    this.editingContainerId = null;
  }

  editContainer(id) {
    const container = this.containersData.find(c => c.id == id);
    if (!container) return;

    document.getElementById("containerModalTitle").textContent = "Edit Container";
    document.getElementById("containerName").value = container.name;
    document.getElementById("containerStatus").value = container.status;
    document.getElementById("containerIsActive").checked = container.is_active;
    document.getElementById("containerPosition").value = container.posisi;

    document.getElementById("containerModal").style.display = "block";
    this.editingContainerId = id;
  }

  async saveContainer() {
    const form = document.getElementById("containerForm");
    const formData = new FormData(form);
    const data = {
      name: formData.get("name"),
      status: formData.get("status"),
      is_active: formData.get("is_active") === "on",
      posisi: parseInt(formData.get("posisi")) || 0
    };

    try {
      let response;
      if (this.editingContainerId) {
        response = await this.apiService.request(`/admin/containers/${this.editingContainerId}`, {
          method: "PUT",
          body: JSON.stringify(data)
        });
      } else {
        response = await this.apiService.request("/admin/containers", {
          method: "POST",
          body: JSON.stringify(data)
        });
      }

      if (response.success) {
        this.showNotification(`Container ${this.editingContainerId ? 'updated' : 'created'} successfully`, "success");
        this.loadContainers();
        this.closeContainerModal();
      } else {
        throw new Error(response.message || "Failed to save container");
      }
    } catch (error) {
      console.error("Error saving container:", error);
      this.showNotification(`Failed to save container: ${error.message}`, "error");
    }
  }

  async deleteContainer(id) {
    if (!confirm("Are you sure you want to delete this container? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await this.apiService.request(`/admin/containers/${id}`, {
        method: "DELETE"
      });

      if (response.success) {
        this.showNotification("Container deleted successfully", "success");
        this.loadContainers();
      } else {
        throw new Error(response.message || "Failed to delete container");
      }
    } catch (error) {
      console.error("Error deleting container:", error);
      this.showNotification(`Failed to delete container: ${error.message}`, "error");
    }
  }

  closeContainerModal() {
    document.getElementById("containerModal").style.display = "none";
    this.editingContainerId = null;
  }
}

// Initialize admin panel when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("🔧 DOM loaded, initializing admin panel...");
  window.adminPanel = new AdminPanel();
});
