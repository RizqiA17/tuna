export class GameEventHandler {
  constructor(gameInstance) {
    this.game = gameInstance;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", (e) => {
        const tab = e.target.dataset.tab;
        this.game.switchTab(tab);
      });
    });

    // Forms
    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.game.handleLogin();
    });

    document.getElementById("registerForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.game.handleRegister();
    });

    // Add player button
    document.getElementById("addPlayer").addEventListener("click", () => {
      this.game.addPlayerInput();
    });

    // Game buttons
    document.getElementById("startGameBtn").addEventListener("click", () => {
      this.game.startGame();
    });

    document
      .getElementById("startDecisionBtn")
      .addEventListener("click", () => {
        this.game.startDecision();
      });

    document
      .getElementById("decisionForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        // Ensure scenario is loaded before submitting
        if (
          !this.game.currentScenario &&
          this.game.teamData &&
          this.game.teamData.currentPosition
        ) {
          await this.game.loadCurrentScenario();
        }
        this.game.submitDecision();
      });

    document
      .getElementById("backToScenarioBtn")
      .addEventListener("click", () => {
        // Hide decision content and show scenario content
        document.getElementById("decision-content").classList.remove("active");
        document.getElementById("scenario-content").classList.add("active");
      });

    // Next scenario is now controlled by admin only
    // Removed nextScenarioBtn event listener

    document
      .getElementById("viewLeaderboardBtn")
      .addEventListener("click", () => {
        this.game.showLeaderboard();
      });

    document
      .getElementById("nextScenarioBtn")
      .addEventListener("click", () => {
        this.game.nextScenario();
      });

    document
      .getElementById("viewFinalLeaderboardBtn")
      .addEventListener("click", () => {
        this.game.showLeaderboard();
      });

    document
      .getElementById("closeLeaderboardBtn")
      .addEventListener("click", () => {
        this.game.hideLeaderboard();
      });

    document.getElementById("playAgainBtn").addEventListener("click", () => {
      this.game.playAgain();
    });

    document.getElementById("logoutBtn").addEventListener("click", () => {
      this.game.logout();
    });

    // Character counters
    document.getElementById("decision").addEventListener("input", (e) => {
      this.game.updateCharCount("decisionCount", e.target.value.length, 1000);
    });

    document.getElementById("reasoning").addEventListener("input", (e) => {
      this.game.updateCharCount("reasoningCount", e.target.value.length, 2000);
    });

    // Dark mode toggle
    document.getElementById("darkModeBtn").addEventListener("click", () => {
      this.game.toggleDarkMode();
    });

    // Browser event handling
    // Handle page unload (browser close, refresh, navigation)
    window.addEventListener('beforeunload', (event) => {
      this.game.logger.info("beforeunload event triggered - saving state");
      this.game.saveStateOnUnload();

      // For modern browsers, we can't prevent the unload, but we can save state
      // The browser will give us a small window to save data
    });

    // Handle page visibility changes (tab switching, minimize, etc.)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.game.logger.info("Page hidden - saving state");
        this.game.debouncedSaveState();
      } else {
        this.game.logger.info("Page visible - checking for updates");
        this.game.checkForStateUpdates();
      }
    });

    // Handle page hide/show (better support for mobile)
    window.addEventListener('pagehide', (event) => {
      this.game.logger.info("pagehide event triggered - saving state");
      this.game.saveStateOnUnload();
    });

    window.addEventListener('pageshow', (event) => {
      this.game.logger.info("pageshow event triggered - checking state");
      if (event.persisted) {
        // Page was restored from cache
        this.game.logger.info("Page restored from cache - checking for updates");
        this.game.checkForStateUpdates();
      }
    });

    // Handle storage events for multi-tab synchronization
    window.addEventListener('storage', (event) => {
      if (event.key === 'tuna_game_state') {
        this.game.logger.info("Storage event detected - syncing with other tabs", {
          key: event.key,
          newValue: event.newValue ? 'present' : 'null'
        });
        this.game.syncWithOtherTabs(event.key, event.newValue);
      }
    });

    // Handle online/offline events
    window.addEventListener('online', () => {
      this.game.logger.info("Network connection restored");
      this.game.isOffline = false;
      this.game.showNotification('Koneksi internet telah pulih', 'success');
      this.game.syncWithServer();
      this.game.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.game.logger.info("Network connection lost");
      this.game.isOffline = true;
      this.game.showNotification('Koneksi internet terputus. Data akan disinkronkan saat online kembali.', 'warning');
    });
  }
}