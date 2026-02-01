export class GameUIRenderer {
  constructor(gameInstance) {
    this.game = gameInstance;
  }

  // Main content display methods
  async showAppropriateContent(screen = null) {
    // console.trace("showAppropriateContent called", {
    //   currentScreen: this.game.currentScreen,
    //   gameState: this.game.gameState,
    //   isGameStarted: this.game.isGameStarted,
    //   currentPosition: this.game.teamData?.currentPosition,
    //   hasCurrentScenario: !!this.game.currentScenario,
    //   currentScenario: this.game.currentScenario,
    //   isKicked: this.game.isKicked
    // });

    this.debugDOMState("BEFORE");

    if (this.game.isKicked && this.game.currentScreen !== "welcome-content") {
      this.showNotification(
        "Tim Anda telah dikeluarkan dari permainan. Silakan login ulang.",
        "error"
      );
      this.game.logout();
      return;
    }

    this.hideAllSections();

    const teamData = await this.game.apiService.request("/game/status");

    if(screen) this.game.currentScreen = screen
    else if (teamData.data.game.status === 'menunggu') this.game.currentScreen = 'welcome-content'
    else if (teamData.data.game.status === 'selesai') this.game.currentScreen = "complete-content";
    else if (!teamData.data.completeCurrentStep) this.game.currentScreen = "scenario-content";
    else if (teamData.data.completeCurrentStep) {
      const me = await this.game.apiService.request("/auth/me");

      const teamId = me.data.teamId;
      const position = me.data.currentPosition - 1;

      const response = await this.game.apiService.request(`/game/decision?teamId=${teamId}&position=${position}`);

      this.showResults(response.data);

      this.game.currentScreen = "results-content";
    }
    else this.game.currentScreen = "welcome-content";

    if (this.shouldShowExplicitScreen()) {
      this.activateSection(this.game.currentScreen);
      this.debugDOMState("AFTER adding active class");
      this.handleExplicitScreen();
    } else {
      this.showWelcomeAsDefault();
    }

    this.updateGameStateUI();
    this.debugDOMState("FINAL");
    this.logScenarioElements();
    const state = JSON.parse(localStorage.getItem('tuna_game_state'));
    state.currentScreen = this.game.currentScreen === "leaderboard-content" ? "results-content" : this.game.currentScreen;
    localStorage.setItem('tuna_game_state', JSON.stringify(state));
  }

  // Helper methods for content display
  hideAllSections() {
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
    });
  }

  activateSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.classList.add("active");
    }
  }

  shouldShowExplicitScreen() {
    return this.game.currentScreen && this.game.currentScreen !== "welcome-content";
  }

  handleExplicitScreen() {
    // Handle special cases for explicit screens
  }

  showWelcomeAsDefault() {
    this.game.currentScreen = "welcome-content";
    this.activateSection("welcome-content");
  }

  // Game state UI updates
  updateGameStateUI(gameStatus) {
    // Update start game button visibility
    // const startGameBtn = document.getElementById("startGameBtn");
    // if (startGameBtn) {
    //   if (this.game.gameState === "waiting" || gameStatus === "menunggu") {
    //     startGameBtn.style.display = "block";
    //     startGameBtn.textContent = "⏳ Menunggu Admin...";
    //     startGameBtn.disabled = true;
    //   } else if (this.game.gameState === "running" || gameStatus === "mulai") {
    //     startGameBtn.style.display = "none";
    //   } else if (this.game.gameState === "ended" || gameStatus === "selesai") {
    //     startGameBtn.style.display = "block";
    //     startGameBtn.textContent = "🏁 Permainan Selesai";
    //     startGameBtn.disabled = true;
    //   }
    // }

    // Update next scenario button visibility
    // Next scenario button removed - controlled by admin only
  }

  // Scenario UI updates
  updateScenarioUI() {
    if (!this.game.currentScenario) {
      console.warn("⚠️ currentScenario is null, attempting to load scenario");
      // Try to load scenario if we have team data and position
      if (this.game.teamData && this.game.teamData.currentPosition) {
        this.game.loadCurrentScenario();
      }
      return;
    }

    document.getElementById("scenarioTitle").textContent =
      this.game.currentScenario.title;
    document.getElementById("scenarioPosition").textContent =
      this.game.currentScenario.position;
    document.getElementById("scenarioText").textContent =
      this.game.currentScenario.scenarioText;
  }

  // Notification system
  showNotification(message, type = "info") {
    const notification = document.getElementById("notification");
    const icon = notification.querySelector(".notification-icon");
    const messageEl = notification.querySelector(".notification-message");

    // Set icon based on type
    const icons = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-circle",
      warning: "fas fa-exclamation-triangle",
      info: "fas fa-info-circle",
    };

    icon.className = `notification-icon ${icons[type] || icons.info}`;
    messageEl.textContent = message;

    // Show notification
    notification.className = `notification ${type} show`;

    // Auto hide after 5 seconds
    setTimeout(() => {
      notification.classList.remove("show");
    }, 5000);
  }

  // Form clearing methods
  clearDecisionFormForNewScenario() {
    // Clear decision form fields
    const decisionInput = document.getElementById("decisionInput");
    const reasoningInput = document.getElementById("reasoningInput");

    if (decisionInput) decisionInput.value = "";
    if (reasoningInput) reasoningInput.value = "";

    // Reset character counts
    this.updateCharCount("decisionInput", 0, 500);
    this.updateCharCount("reasoningInput", 0, 1000);

    // Clear any validation messages
    const decisionError = document.getElementById("decisionError");
    const reasoningError = document.getElementById("reasoningError");

    if (decisionError) decisionError.textContent = "";
    if (reasoningError) reasoningError.textContent = "";
  }

  // Character count updates
  updateCharCount(elementId, count, max) {
    const counter = document.getElementById(`${elementId}Count`);
    if (counter) {
      counter.textContent = `${count}/${max}`;
      counter.className = count > max ? "char-count error" : "char-count";
    }
  }

  // Screen management
  showScreen(screenId) {
    // Remove active class from all screens and reset display style
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
      screen.style.display = "none";
    });

    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.style.display = "flex";
      targetScreen.classList.add("active");
    }

    // Force a reflow to ensure the display change takes effect
    if (targetScreen) {
      targetScreen.offsetHeight;
    }

    // Note: Content sections are managed by showAppropriateContent()
  }

  showLoginScreen() {
    // Remove active class from all screens and reset display style
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
      screen.style.display = "none";
    });

    // Show login screen
    const loginScreen = document.getElementById("login-screen");
    if (loginScreen) {
      loginScreen.style.display = "flex";
      loginScreen.classList.add("active");
    }
  }

  // Welcome content methods
  forceShowWelcomeContent() {
    this.hideAllSections();
    this.activateSection("welcome-content");
    this.game.currentScreen = "welcome-content";
    this.updateWelcomeContentForProgress();
  }

  updateWelcomeContentForProgress() {
    if (!this.game.teamData) return;

    const progressContainer = document.getElementById("progressContainer");
    const welcomeMessage = document.getElementById("welcomeMessage");

    if (this.game.teamData.currentPosition > 1) {
      // Show progress for teams that have started
      if (progressContainer) progressContainer.style.display = "block";
      if (welcomeMessage) {
        welcomeMessage.innerHTML = `
          <h2>Selamat Datang Kembali!</h2>
          <p>Tim <strong>${this.game.teamData.teamName}</strong></p>
          <p>Anda telah menyelesaikan ${this.game.teamData.currentPosition - 1} dari 7 pos.</p>
          <p>Total skor: <strong>${this.game.teamData.totalScore}</strong> poin</p>
        `;
      }
    } else {
      // Hide progress for new teams
      if (progressContainer) progressContainer.style.display = "none";
      if (welcomeMessage) {
        welcomeMessage.innerHTML = `
          <h2>Selamat Datang!</h2>
          <p>Tim <strong>${this.game.teamData.teamName}</strong></p>
          <p>Tunggu instruksi dari admin untuk memulai permainan.</p>
        `;
      }
    }
  }

  // Results display
  showResults(data) {
    const resultsContainer = document.getElementById("resultsContainer");
    if (!resultsContainer) return;

    // Clear previous results
    resultsContainer.innerHTML = "";

    // Display the decision results
    const resultHTML = `
      <div class="result-section">
        <h3>Keputusan Tim Anda</h3>
        <div class="decision-display">
          <h4>Keputusan:</h4>
          <p>${data.decision || "Tidak ada keputusan"}</p>
        </div>
        <div class="reasoning-display">
          <h4>Alasan:</h4>
          <p>${data.reasoning || "Tidak ada alasan"}</p>
        </div>
        <div class="score-display">
          <h4>Skor:</h4>
          <p class="score-value">${data.score || 0} poin</p>
        </div>
      </div>
    `;

    resultsContainer.innerHTML = resultHTML;
  }

  // Debug methods
  debugDOMState(label) {
    if (this.game.logger) {
      const activeSections = Array.from(document.querySelectorAll(".content-section.active"))
        .map(el => el.id);
      this.game.logger.debug(`DOM State ${label}`, {
        activeSections,
        currentScreen: this.game.currentScreen
      });
    }
  }

  logScenarioElements() {
    if (this.game.logger) {
      const scenarioElements = {
        title: document.getElementById("scenarioTitle")?.textContent,
        position: document.getElementById("scenarioPosition")?.textContent,
        text: document.getElementById("scenarioText")?.textContent?.substring(0, 100) + "..."
      };
      this.game.logger.debug("Scenario elements state", scenarioElements);
    }
  }
}