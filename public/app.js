// Tuna Adventure Game - Frontend Application
class TunaAdventureGame {
  constructor() {
    this.apiBase = "/api";
    this.token = localStorage.getItem("tuna_token");
    this.teamData = null;
    this.currentScenario = null;
    this.timeLeft = 900; // 15 minutes in seconds
    this.timer = null;
    this.playerCount = 1;
    this.socket = null;
    this.isGameStarted = false;
    this.isWaitingForAdmin = false;
    this.gameState = 'waiting'; // waiting, running, ended
    this.currentScenarioPosition = 1;
    this.hasJoinedAsTeam = false;
    this.logger = window.TeamLogger || new Logger('TEAM');

    this.init();
  }

  async init() {
    this.logger.info("Initializing Tuna Adventure Game", { 
      gameState: this.gameState,
      hasToken: !!this.token,
      playerCount: this.playerCount
    });

    // Initialize dark mode
    this.initDarkMode();

    // Initialize WebSocket connection
    this.initWebSocket();

    // Show loading screen
    this.showScreen("loading-screen");

    // Simulate loading
    await this.delay(3000);

    // Check if user is already logged in
    if (this.token) {
      try {
        this.logger.info("Token found, attempting to load team data", { token: this.token.substring(0, 20) + '...' });
        await this.loadTeamData();
        this.showScreen("game-screen");
        this.updateGameUI();
        this.logger.info("Game screen shown, UI updated successfully");
      } catch (error) {
        this.logger.error("Token invalid or failed to load team data", { error: error.message, stack: error.stack });
        this.token = null;
        localStorage.removeItem("tuna_token");
        this.showScreen("login-screen");
        this.showNotification(
          "Sesi Anda telah berakhir. Silakan login kembali.",
          "warning"
        );
      }
    } else {
      this.logger.info("No token found, showing login screen");
      this.showScreen("login-screen");
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    console.log("🎯 Setting up event listeners...");

    // Tab switching
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Forms
    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById("registerForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    // Add player button
    document.getElementById("addPlayer").addEventListener("click", () => {
      this.addPlayerInput();
    });

    // Game buttons
    document.getElementById("startGameBtn").addEventListener("click", () => {
      this.startGame();
    });

    document
      .getElementById("startDecisionBtn")
      .addEventListener("click", () => {
        this.startDecision();
      });

    document.getElementById("decisionForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.submitDecision();
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
        this.showLeaderboard();
      });

    document
      .getElementById("viewFinalLeaderboardBtn")
      .addEventListener("click", () => {
        this.showLeaderboard();
      });

    document
      .getElementById("closeLeaderboardBtn")
      .addEventListener("click", () => {
        this.hideLeaderboard();
      });

    document.getElementById("playAgainBtn").addEventListener("click", () => {
      this.playAgain();
    });

    document.getElementById("logoutBtn").addEventListener("click", () => {
      this.logout();
    });

    // Character counters
    document.getElementById("decision").addEventListener("input", (e) => {
      this.updateCharCount("decisionCount", e.target.value.length, 1000);
    });

    document.getElementById("reasoning").addEventListener("input", (e) => {
      this.updateCharCount("reasoningCount", e.target.value.length, 2000);
    });

    // Dark mode toggle
    document.getElementById("darkModeBtn").addEventListener("click", () => {
      this.toggleDarkMode();
    });
  }

  // Screen Management
  showScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });
    document.getElementById(screenId).classList.add("active");

    // If showing game screen, make sure welcome content is active by default
    if (screenId === "game-screen") {
      document.querySelectorAll(".content-section").forEach((section) => {
        section.classList.remove("active");
      });
      document.getElementById("welcome-content").classList.add("active");
    }
  }

  switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.classList.remove("active");
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");

    // Update forms
    document.querySelectorAll(".auth-form").forEach((form) => {
      form.classList.remove("active");
    });
    document.getElementById(`${tab}-form`).classList.add("active");
  }

  // API Methods
  async apiRequest(endpoint, options = {}) {
    const url = `${this.apiBase}${endpoint}`;
    const startTime = Date.now();
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    this.logger.debug("API request started", { 
      url, 
      method: options.method || 'GET', 
      requestId,
      hasToken: !!this.token
    });

    const config = {
      headers: {
        "Content-Type": "application/json",
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok) {
        this.logger.error("API request failed", { 
          url, 
          status: response.status, 
          error: data.message,
          duration,
          requestId
        });
        throw new Error(data.message || "Request failed");
      }

      this.logger.network(
        options.method || 'GET', 
        url, 
        options.body ? JSON.parse(options.body) : null, 
        data, 
        response.status, 
        duration
      );

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error("API request failed", { 
        url, 
        error: error.message, 
        duration,
        requestId
      });
      throw error;
    }
  }

  // Authentication
  async handleLogin() {
    const formData = new FormData(document.getElementById("loginForm"));
    const data = {
      teamName: formData.get("teamName"),
      password: formData.get("password"),
    };

    try {
      const response = await this.apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });

      this.token = response.data.token;
      localStorage.setItem("tuna_token", this.token);

      this.teamData = response.data;
      
      // Join WebSocket as team
      if (this.socket && this.socket.connected) {
        const teamId = this.teamData.teamId || this.teamData.id;
        if (teamId) {
          this.socket.emit('team-join', {
            teamId: teamId,
            teamName: this.teamData.teamName
          });
          this.logger.websocket('team-join', {
            teamId: teamId,
            teamName: this.teamData.teamName
          }, 'OUT');
        } else {
          this.logger.error("No teamId available in handleLogin", { teamData: this.teamData });
        }
      }
      
      this.showScreen("game-screen");
      this.updateGameUI();
      this.showNotification(
        "Login berhasil! Selamat datang kembali.",
        "success"
      );
    } catch (error) {
      this.showNotification(error.message, "error");
    }
  }

  async handleRegister() {
    const formData = new FormData(document.getElementById("registerForm"));

    // Validate password confirmation
    if (formData.get("password") !== formData.get("confirmPassword")) {
      this.showNotification("Kata sandi tidak cocok!", "error");
      return;
    }

    // Collect players
    const players = [];
    for (let i = 0; i < this.playerCount; i++) {
      const playerName = formData.get(`players[${i}].name`);
      if (playerName) {
        players.push({ name: playerName });
      }
    }

    if (players.length === 0) {
      this.showNotification("Minimal 1 anggota tim!", "error");
      return;
    }

    const data = {
      teamName: formData.get("teamName"),
      password: formData.get("password"),
      players,
    };

    try {
      const response = await this.apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      });

      this.token = response.data.token;
      localStorage.setItem("tuna_token", this.token);

      this.teamData = response.data;
      
      // Join WebSocket as team
      if (this.socket && this.socket.connected) {
        const teamId = this.teamData.teamId || this.teamData.id;
        if (teamId) {
          this.socket.emit('team-join', {
            teamId: teamId,
            teamName: this.teamData.teamName
          });
          this.logger.websocket('team-join', {
            teamId: teamId,
            teamName: this.teamData.teamName
          }, 'OUT');
        } else {
          this.logger.error("No teamId available in handleRegister", { teamData: this.teamData });
        }
      }
      
    this.showScreen("game-screen");
    this.updateGameUI();
    this.updateGameStateUI();
    this.showNotification(
      "Tim berhasil didaftarkan! Selamat datang di Petualangan Puncak TUNA!",
      "success"
    );
    } catch (error) {
      this.showNotification(error.message, "error");
    }
  }

  async loadTeamData() {
    const response = await this.apiRequest("/auth/me");
    this.teamData = response.data;
    
    // Join WebSocket as team (only if not already joined)
    if (this.socket && this.socket.connected && !this.hasJoinedAsTeam) {
      const teamId = this.teamData.teamId || this.teamData.id;
      
      if (!teamId) {
        this.logger.error("No teamId available for team join", { 
          teamData: this.teamData,
          teamId: teamId
        });
        return;
      }
      
      this.logger.debug("Sending team-join", { 
        teamId: teamId, 
        teamName: this.teamData.teamName,
        teamData: this.teamData
      });
      
      this.socket.emit('team-join', {
        teamId: teamId,
        teamName: this.teamData.teamName
      });
      this.logger.websocket('team-join', {
        teamId: teamId,
        teamName: this.teamData.teamName
      }, 'OUT');
      this.hasJoinedAsTeam = true;
    }
    
    // Update game state UI
    this.updateGameStateUI();
    
    return response.data;
  }

  // WebSocket Methods
  initWebSocket() {
    this.socket = io();
    this.logger.info("WebSocket connection initialized");
    
    this.socket.on('connect', () => {
      this.logger.websocket('connect', null, 'IN');
      
      // Join as team if logged in (only if not already joined)
      const teamId = this.teamData?.teamId || this.teamData?.id;
      if (this.teamData && teamId && this.teamData.teamName && !this.hasJoinedAsTeam) {
        this.logger.debug("Sending team-join from initWebSocket", { 
          teamId: teamId, 
          teamName: this.teamData.teamName,
          teamData: this.teamData
        });
        
        this.logger.info("Joining as team", { 
          teamId: teamId, 
          teamName: this.teamData.teamName 
        });
        this.socket.emit('team-join', {
          teamId: teamId,
          teamName: this.teamData.teamName
        });
        this.logger.websocket('team-join', {
          teamId: teamId,
          teamName: this.teamData.teamName
        }, 'OUT');
        this.hasJoinedAsTeam = true;
      } else if (!this.teamData) {
        this.logger.warn("Team data not ready for WebSocket join", { 
          hasTeamData: !!this.teamData,
          teamId: this.teamData?.id,
          teamName: this.teamData?.teamName
        });
      } else if (this.hasJoinedAsTeam) {
        this.logger.info("Already joined as team, skipping", { 
          teamId: this.teamData.id, 
          teamName: this.teamData.teamName 
        });
      }
    });

    // Reconnect team if socket reconnects
    this.socket.on('reconnect', () => {
      console.log('🔌 Reconnected to server');
      if (this.teamData) {
        this.socket.emit('team-join', {
          teamId: this.teamData.id,
          teamName: this.teamData.teamName
        });
      }
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
    });

    // Listen for admin commands
    this.socket.on('game-start-command', () => {
      console.log('🎮 Received game start command from admin');
      this.startGameFromAdmin();
    });

    this.socket.on('next-scenario-command', () => {
      console.log('➡️ Received next scenario command from admin');
      this.nextScenarioFromAdmin();
    });

    this.socket.on('end-game-command', () => {
      console.log('🏁 Received end game command from admin');
      this.endGameFromAdmin();
    });

    this.socket.on('team-kicked', () => {
      console.log('👢 Team has been kicked by admin');
      this.showNotification(
        "Tim Anda telah dikeluarkan dari permainan oleh admin.",
        "warning"
      );
      this.logout();
    });
  }

  // Game Logic
  async startGame() {
    console.log("🚀 Starting game...");
    
    if (this.isWaitingForAdmin) {
      this.showNotification(
        "Menunggu admin untuk memulai permainan...",
        "info"
      );
      return;
    }

    try {
      const response = await this.apiRequest("/game/start", {
        method: "POST",
      });

      if (response.success) {
        this.currentScenario = response.scenario;
        this.timeLeft = response.timeLimit;
        this.updateScenarioUI();

        // Hide welcome content and show scenario content
        document.getElementById("welcome-content").classList.remove("active");
        document.getElementById("scenario-content").classList.add("active");

        this.showNotification(
          "Petualangan dimulai! Baca scenario dengan teliti.",
          "success"
        );
        console.log("✅ Game started successfully");
      }
    } catch (error) {
      console.error("❌ Error starting game:", error);
      this.showNotification(
        "Gagal memulai petualangan. Silakan coba lagi.",
        "error"
      );
    }
  }

  async startGameFromAdmin() {
    console.log("🎮 Starting game from admin command...");
    try {
      const response = await this.apiRequest("/game/start", {
        method: "POST",
      });

      if (response.success) {
        this.currentScenario = response.scenario;
        this.timeLeft = response.timeLimit;
        this.isGameStarted = true;
        this.isWaitingForAdmin = false;
        this.gameState = 'running';
        this.currentScenarioPosition = 1;
        this.updateScenarioUI();
        this.updateGameStateUI();

        // Hide welcome content and show scenario content
        document.getElementById("welcome-content").classList.remove("active");
        document.getElementById("scenario-content").classList.add("active");

        this.showNotification(
          "Admin telah memulai permainan! Baca scenario dengan teliti.",
          "success"
        );
        console.log("✅ Game started from admin command");
      }
    } catch (error) {
      console.error("❌ Error starting game from admin:", error);
      this.showNotification(
        "Gagal memulai petualangan dari admin.",
        "error"
      );
    }
  }

  async nextScenarioFromAdmin() {
    console.log("➡️ Moving to next scenario from admin command...");
    this.currentScenarioPosition++;
    this.nextScenario();
  }

  endGameFromAdmin() {
    console.log("🏁 Ending game from admin command...");
    this.isGameStarted = false;
    this.isWaitingForAdmin = true;
    this.gameState = 'ended';
    this.updateGameStateUI();
    this.showNotification(
      "Admin telah mengakhiri permainan.",
      "info"
    );
  }

  updateGameStateUI() {
    // Update start game button visibility
    const startGameBtn = document.getElementById("startGameBtn");
    if (startGameBtn) {
      if (this.gameState === 'waiting') {
        startGameBtn.style.display = 'block';
        startGameBtn.textContent = '⏳ Menunggu Admin...';
        startGameBtn.disabled = true;
      } else if (this.gameState === 'running') {
        startGameBtn.style.display = 'none';
      } else if (this.gameState === 'ended') {
        startGameBtn.style.display = 'block';
        startGameBtn.textContent = '🏁 Permainan Selesai';
        startGameBtn.disabled = true;
      }
    }

    // Update next scenario button visibility
    // Next scenario button removed - controlled by admin only
  }

  async startDecision() {
    // Hide scenario content and show decision content
    document.getElementById("scenario-content").classList.remove("active");
    document.getElementById("decision-content").classList.add("active");

    this.startTimer();
    this.showNotification(
      "Waktu diskusi dimulai! Anda memiliki 15 menit.",
      "info"
    );
  }

  async submitDecision() {
    const formData = new FormData(document.getElementById("decisionForm"));
    const data = {
      position: this.currentScenario.position,
      decision: formData.get("decision"),
      argumentation: formData.get("reasoning"),
    };

    try {
      this.stopTimer();
      const response = await this.apiRequest("/game/submit-decision", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (response.success) {
        // Update team data
        this.teamData.totalScore = response.team.total_score;
        this.teamData.currentPosition = response.team.current_position;

        // Send progress update to admin
        if (this.socket) {
          const teamId = this.teamData.teamId || this.teamData.id;
          this.socket.emit('team-progress', {
            teamId: teamId,
            currentPosition: this.teamData.currentPosition,
            totalScore: this.teamData.totalScore,
            isCompleted: this.teamData.currentPosition > 7
          });

          this.socket.emit('team-decision', {
            teamId: teamId,
            position: this.currentScenario.position,
            score: response.result.score
          });
        }

        // Update game state UI
        this.updateGameStateUI();

        // Show results
        await this.showResults(response.result);
        this.showNotification("Keputusan berhasil dikirim!", "success");
      }
    } catch (error) {
      this.showNotification(error.message, "error");
      this.startTimer(); // Restart timer on error
    }
  }

  async showResults(result) {
    // Update UI with results
    document.getElementById("scenarioScore").textContent = result.score;

    // Show team's decision
    document.getElementById("teamDecision").textContent = result.teamDecision;
    document.getElementById("teamReasoning").textContent =
      result.teamArgumentation;

    // Show standard answer
    document.getElementById("standardDecision").textContent =
      result.standardAnswer;
    document.getElementById("standardReasoning").textContent =
      result.standardArgumentation;

    // Hide decision content and show results content
    document.getElementById("decision-content").classList.remove("active");
    document.getElementById("results-content").classList.add("active");

    this.updateGameUI();
  }

  async nextScenario() {
    this.updateGameUI();
    this.updateGameStateUI();

    if (this.teamData.currentPosition > 7) {
      // Hide results and show complete content
      document.getElementById("results-content").classList.remove("active");
      document.getElementById("complete-content").classList.add("active");
      this.updateCompleteUI();
    } else {
      // Hide results and load next scenario
      document.getElementById("results-content").classList.remove("active");

      try {
        // Get the next scenario directly from our game scenarios
        const nextScenario = this.getScenarioByPosition(
          this.teamData.currentPosition
        );
        if (nextScenario) {
          this.currentScenario = nextScenario;
          this.updateScenarioUI();
          document.getElementById("scenario-content").classList.add("active");
          this.showNotification(
            `Selamat! Lanjut ke Pos ${this.teamData.currentPosition}: ${nextScenario.title}`,
            "success"
          );
        } else {
          // No more scenarios
          document.getElementById("complete-content").classList.add("active");
          this.updateCompleteUI();
        }
      } catch (error) {
        console.error("Error loading next scenario:", error);
        this.showNotification("Gagal memuat scenario berikutnya", "error");
      }
    }
  }

  async showLeaderboard() {
    try {
      const response = await this.apiRequest("/game/leaderboard");
      this.updateLeaderboardUI(response.data);

      // Hide current content and show leaderboard
      document.querySelectorAll(".content-section").forEach((section) => {
        section.classList.remove("active");
      });
      document.getElementById("leaderboard-content").classList.add("active");
    } catch (error) {
      this.showNotification(error.message, "error");
    }
  }

  hideLeaderboard() {
    // Hide leaderboard and show appropriate content
    document.getElementById("leaderboard-content").classList.remove("active");

    if (this.teamData.currentPosition > 7) {
      document.getElementById("complete-content").classList.add("active");
    } else {
      document.getElementById("results-content").classList.add("active");
    }
  }

  playAgain() {
    this.logout();
  }

  logout() {
    this.token = null;
    localStorage.removeItem("tuna_token");
    this.teamData = null;
    this.currentScenario = null;
    this.stopTimer();
    this.showScreen("login-screen");
    this.resetForms();
    this.showNotification("Anda telah keluar dari permainan.", "info");
  }

  // UI Updates
  updateGameUI() {
    if (!this.teamData) return;

    document.getElementById("teamName").textContent = this.teamData.teamName;
    document.getElementById("currentPosition").textContent =
      this.teamData.currentPosition;
    document.getElementById("totalScore").textContent =
      this.teamData.totalScore;

    // Update progress bar
    const progress = ((this.teamData.currentPosition - 1) / 7) * 100;
    document.getElementById("progressBar").style.width = `${progress}%`;

    // Update progress labels
    document
      .querySelectorAll(".progress-labels .label")
      .forEach((label, index) => {
        label.classList.remove("active");
        if (index < this.teamData.currentPosition) {
          label.classList.add("active");
        }
      });
  }

  updateScenarioUI() {
    if (!this.currentScenario) return;

    document.getElementById("scenarioTitle").textContent =
      this.currentScenario.title;
    document.getElementById("scenarioPosition").textContent =
      this.currentScenario.position;
    document.getElementById("scenarioText").textContent =
      this.currentScenario.scenarioText;
  }

  updateCompleteUI() {
    document.getElementById("finalScore").textContent =
      this.teamData.totalScore;
  }

  updateLeaderboardUI(leaderboard) {
    const container = document.getElementById("leaderboardList");
    container.innerHTML = "";

    leaderboard.forEach((team, index) => {
      const item = document.createElement("div");
      item.className = "leaderboard-item";

      // Highlight current team
      if (team.team_name === this.teamData.teamName) {
        item.classList.add("current-team");
      }

      item.innerHTML = `
                <div class="rank">${index + 1}</div>
                <div class="team-name">${team.team_name}</div>
                <div class="team-stats">
                    <span>${team.total_score} poin</span>
                    <span>Pos ${team.current_position}/7</span>
                </div>
            `;

      container.appendChild(item);
    });
  }

  // Timer
  startTimer() {
    this.timeLeft = 900; // 15 minutes
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.updateTimerDisplay();

      if (this.timeLeft <= 0) {
        this.stopTimer();
        this.showNotification(
          "Waktu habis! Kirim keputusan sekarang.",
          "warning"
        );
      }
    }, 1000);

    this.updateTimerDisplay();
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    document.getElementById("timeRemaining").textContent = display;
  }

  // Utility Methods
  addPlayerInput() {
    if (this.playerCount >= 5) {
      this.showNotification("Maksimal 5 anggota tim!", "warning");
      return;
    }

    this.playerCount++;
    const container = document.getElementById("players-list");
    const playerDiv = document.createElement("div");
    playerDiv.className = "player-input";
    playerDiv.innerHTML = `
            <input type="text" name="players[${
              this.playerCount - 1
            }].name" placeholder="Nama Anggota ${this.playerCount}" required>
            <span class="player-role">👤 Member</span>
        `;
    container.appendChild(playerDiv);
  }

  updateCharCount(elementId, count, max) {
    const element = document.getElementById(elementId);
    element.textContent = count;

    if (count > max * 0.9) {
      element.style.color = "#e53e3e";
    } else if (count > max * 0.8) {
      element.style.color = "#ed8936";
    } else {
      element.style.color = "#718096";
    }
  }

  resetForms() {
    document.getElementById("loginForm").reset();
    document.getElementById("registerForm").reset();
    document.getElementById("decisionForm").reset();

    // Reset player count
    this.playerCount = 1;
    const playersList = document.getElementById("players-list");
    playersList.innerHTML = `
            <div class="player-input">
                <input type="text" name="players[0].name" placeholder="Nama Anggota 1 (Leader)" required>
                <span class="player-role">👑 Leader</span>
            </div>
        `;
  }

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

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Dark Mode Management
  toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    // Apply theme with smooth transition
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("tuna_theme", newTheme);

    // Update icon with animation
    const icon = document.getElementById("darkModeIcon");
    const toggleBtn = document.getElementById("darkModeBtn");
    
    // Add rotation animation
    toggleBtn.style.transform = "rotate(180deg)";
    setTimeout(() => {
      icon.className = newTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
      toggleBtn.style.transform = "rotate(0deg)";
    }, 150);

    // Show notification with theme-specific styling
    const themeName = newTheme === "dark" ? "Dark" : "Light";
    this.showNotification(
      `Switched to ${themeName} Mode`,
      "info"
    );

    // Update toggle button title
    toggleBtn.title = `Switch to ${newTheme === "dark" ? "Light" : "Dark"} Mode`;
  }

  initDarkMode() {
    const savedTheme = localStorage.getItem("tuna_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

    const icon = document.getElementById("darkModeIcon");
    const toggleBtn = document.getElementById("darkModeBtn");
    
    icon.className = savedTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
    toggleBtn.title = `Switch to ${savedTheme === "dark" ? "Light" : "Dark"} Mode`;
  }

  // Game scenarios data (sync with server)
  getScenarioByPosition(position) {
    const scenarios = [
      {
        position: 1,
        title: "Hutan Kabut",
        scenarioText:
          "Kelompok Anda tiba di Hutan Kabut. Sangat lembap dan jarak pandang terbatas. Anda menemukan sebuah petunjuk tua yang tertulis: 'Jalan tercepat adalah mengikuti bisikan angin'. Saat Anda diam, Anda mendengar suara gemerisik daun dari tiga arah yang berbeda. Apa yang Anda lakukan?",
        standardAnswer:
          "Berhenti sejenak, jangan langsung bergerak. Kirim satu atau dua orang untuk melakukan eksplorasi pendek (tidak lebih dari 5 menit) ke setiap arah sumber suara untuk mengumpulkan lebih banyak data. Tetap berkomunikasi dengan suara.",
        standardReasoning:
          "Situasi ini sangat ambigu. 'Bisikan angin' adalah informasi yang tidak jelas dan subjektif. Mengambil keputusan berdasarkan data yang minim sangat berisiko. Langkah terbaik adalah mengurangi ambiguitas dengan mencari informasi tambahan (eksplorasi kecil) sebelum mengambil keputusan besar (memilih jalur). Ini adalah prinsip sense-making atau upaya memahami situasi sebelum bertindak.",
      },
      {
        position: 2,
        title: "Sungai Deras",
        scenarioText:
          "Setelah melewati hutan, Anda tiba di tepi sungai yang seharusnya tenang menurut peta lama Anda. Namun, akibat hujan di hulu, sungai itu kini berubah menjadi arus deras yang berbahaya. Jembatan satu-satunya telah hanyut. Rencana Anda untuk menyeberang gagal total. Apa yang Anda lakukan?",
        standardAnswer:
          "Segera menjauh dari tepi sungai untuk memastikan keamanan. Lakukan evaluasi ulang situasi (assess the situation) dan cari alternatif. Alternatifnya bisa berupa: (1) Menyusuri sungai ke arah hulu atau hilir untuk mencari titik penyeberangan yang lebih aman/jembatan lain, atau (2) Berkemah di tempat aman dan menunggu hingga arus sungai kembali normal.",
        standardReasoning:
          "Ini adalah situasi turbulensi di mana kondisi berubah drastis dan cepat. Reaksi pertama adalah memastikan keselamatan (safety first) dan menstabilkan situasi. Memaksa menyeberang adalah tindakan gegabah. Kunci menghadapi turbulensi adalah agilitas (kemampuan beradaptasi) dan mengubah rencana dengan cepat berdasarkan kondisi baru, bukan terpaku pada rencana awal.",
      },
      {
        position: 3,
        title: "Artefak Asing",
        scenarioText:
          "Di sebuah reruntuhan kuno, Anda menemukan sebuah artefak bercahaya yang tidak pernah ada dalam catatan atau legenda manapun. Bentuknya seperti kubus dengan tombol-tombol aneh. Saat disentuh, artefak itu mengeluarkan suara dengungan lembut. Apa yang Anda lakukan?",
        standardAnswer:
          "Jangan menekan tombol secara acak. Amati artefak tersebut dengan saksama. Catat simbol-simbolnya, coba hubungkan polanya dengan lingkungan sekitar reruntuhan. Lakukan eksperimen kecil dan terkontrol (misalnya, menekan satu tombol dengan lembut menggunakan tongkat, sambil yang lain menjaga jarak).",
        standardReasoning:
          "Ini adalah tantangan kebaruan (novelty). Karena tidak ada pengalaman sebelumnya, tindakan terbaik adalah eksperimentasi yang terukur dan aman. Tujuannya adalah belajar tentang objek baru ini dengan risiko minimal. Keingintahuan harus diimbangi dengan kehati-hatian. Mencatat hasil observasi juga penting untuk membangun pemahaman baru.",
      },
      {
        position: 4,
        title: "Persimpangan Tiga Jalur",
        scenarioText:
          "Anda sampai di sebuah persimpangan dengan tiga jalur gua yang gelap. Sebuah papan petunjuk bertuliskan: 'Satu jalur menuju bahaya, satu jalur memutar jauh, satu jalur menuju tujuan'. Tidak ada informasi lain untuk membedakan ketiganya. Apa yang Anda putuskan?",
        standardAnswer:
          "Menerapkan strategi portofolio atau diversifikasi risiko. Jangan mempertaruhkan seluruh tim pada satu jalur. Opsi terbaik: (1) Kirim tim kecil (pramuka) ke setiap jalur dengan batas waktu yang jelas untuk kembali dan melapor. (2) Jika tidak memungkinkan, pilih satu jalur secara acak namun siapkan rencana kontingensi/rencana darurat jika jalur tersebut salah.",
        standardReasoning:
          "Situasi ini penuh ketidakpastian (uncertainty), di mana kita tahu kemungkinan hasilnya tetapi tidak tahu mana yang akan terjadi. Bertaruh pada satu pilihan adalah judi. Strategi terbaik adalah menyebar risiko atau setidaknya memiliki rencana B dan C. Ini menunjukkan pemahaman bahwa dalam ketidakpastian, fleksibilitas dan persiapan adalah kunci.",
      },
      {
        position: 5,
        title: "Badai di Lereng Terbuka",
        scenarioText:
          "Saat mendaki di lereng yang terbuka, cuaca tiba-tiba berubah drastis. Badai petir datang lebih cepat dari perkiraan. Angin kencang dan kilat menyambar-nyambar. Tidak ada tempat berlindung yang ideal. Apa prioritas dan tindakan Anda?",
        standardAnswer:
          "Prioritas utama adalah keselamatan dan meminimalkan paparan risiko. Segera turun ke area yang lebih rendah, hindari pohon tinggi atau area terbuka. Cari cekungan atau berlindung di antara bebatuan rendah. Semua anggota merendah (jongkok), lepaskan benda logam, dan rapatkan kaki. Komunikasi harus jelas, singkat, dan tenang.",
        standardReasoning:
          "Ini adalah krisis gabungan turbulensi (perubahan cepat) dan ketidakpastian (di mana petir akan menyambar). Dalam situasi seperti ini, hierarki kebutuhan Maslow berlaku: keselamatan fisik adalah yang utama. Visi mencapai puncak harus ditunda sementara. Kepemimpinan yang tenang dan instruksi yang jelas sangat krusial untuk menjaga kelompok tetap kohesif dan tidak panik.",
      },
      {
        position: 6,
        title: "Teka-teki Sang Penjaga",
        scenarioText:
          "Sebuah gerbang menuju puncak dijaga oleh golem batu. Golem itu berkata: 'Aku hanya akan membuka jalan bagi mereka yang bisa memberiku 'Gema Tanpa Suara'.' Golem itu tidak merespons pertanyaan apapun. Apa yang Anda lakukan untuk memecahkan teka-teki ini?",
        standardAnswer:
          "Jawaban teka-teki ini bersifat metaforis. Tim harus melakukan brainstorming untuk menginterpretasikan frasa ambigu 'Gema Tanpa Suara'. Ini bukan tentang benda fisik. Jawaban yang paling tepat adalah menunjukkan pemahaman atau refleksi. Misalnya, menuliskan tujuan perjalanan/visi tim di atas selembar daun dan menunjukkannya pada golem, atau melakukan pantomim yang mencerminkan tujuan mereka.",
        standardReasoning:
          "Tantangan ini menggabungkan ambiguitas (frasa puitis) dan novelty (interaksi dengan makhluk magis). Masalah tidak bisa diselesaikan secara harfiah. Dibutuhkan pemikiran kreatif (lateral thinking) dan pemahaman mendalam tentang konteks yang lebih besar (tujuan perjalanan mereka). Ini menguji kemampuan tim untuk beralih dari pemikiran logis-linear ke pemikiran konseptual dan abstrak.",
      },
      {
        position: 7,
        title: "Puncak Terakhir",
        scenarioText:
          "Anda hampir sampai di puncak! Namun, puncak yang Anda lihat ternyata adalah puncak palsu. Puncak sejati berada lebih tinggi, dan untuk mencapainya Anda harus menyeberangi punggungan sempit yang diselimuti kabut tebal (Ambiguitas). Tiba-tiba, gempa kecil mengguncang pijakan Anda (Turbulensi). Anda tidak tahu seberapa stabil sisa jalur tersebut (Ketidakpastian), dan di ujung punggungan terlihat sebuah cahaya aneh yang belum pernah Anda lihat (Novelty). Apa kerangka kerja keputusan yang Anda gunakan?",
        standardAnswer:
          "Menggunakan pendekatan terintegrasi. Stop & Stabilize (Turbulensi): Berhenti bergerak, cari pijakan paling stabil, tenangkan diri. Clarify & Sense-make (Ambiguitas): Tunggu sejenak jika memungkinkan agar kabut sedikit berkurang. Gunakan tali untuk menguji kekuatan jalur di depan. Explore & Experiment (Novelty): Amati cahaya dari kejauhan. Jangan langsung mendekat. Hedge & Prepare (Ketidakpastian): Buat beberapa skenario: (a) Jika jalur aman, (b) Jika jalur runtuh, (c) Jika cahaya itu berbahaya. Siapkan tali pengaman sebagai mitigasi risiko. Keputusan akhir harus berdasarkan konsensus setelah mempertimbangkan semua elemen ini.",
        standardReasoning:
          "Ini adalah ujian akhir yang menggabungkan semua elemen TUNA. Jawaban terbaik bukanlah satu tindakan tunggal, melainkan sebuah proses atau kerangka kerja pengambilan keputusan yang adaptif. Tim harus menunjukkan bahwa mereka bisa mengidentifikasi setiap elemen TUNA dalam masalah ini dan menerapkan strategi yang sesuai untuk masing-masing elemen secara berurutan dan terintegrasi. Ini menunjukkan kematangan dalam kepemimpinan di lingkungan yang kompleks.",
      },
    ];

    return scenarios.find((s) => s.position === position);
  }
}

// Initialize the game when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("🎮 DOM loaded, initializing game...");
  new TunaAdventureGame();
});
