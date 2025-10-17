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
    this.currentScenarioPosition = 0;
    this.hasJoinedAsTeam = false;
    this.isKicked = false; // Flag to track if team has been kicked
    this.logger = window.TeamLogger || new Logger('TEAM');
    
    // Timer persistence properties
    this.timerStartTime = null;
    this.timerDuration = 900; // 15 minutes in seconds
    this.isTimerActive = false;
    this.currentScreen = 'login-screen';

    this.init();
  }

  async init() {
    this.logger.info("Initializing Tuna Adventure Game", { 
      gameState: this.gameState,
      hasToken: !!this.token,
      playerCount: this.playerCount
    });

    try {
      // Initialize dark mode
      this.initDarkMode();

      // Initialize WebSocket connection (non-blocking)
      this.initWebSocket();

      // Show loading screen
      this.showScreen("loading-screen");

      // Simulate loading
      await this.delay(3000);

      // Add a fallback timeout to ensure we don't get stuck on loading screen
      const fallbackTimeout = setTimeout(() => {
        this.logger.warn("Fallback timeout reached, forcing transition to login screen");
        this.showScreen("login-screen");
      }, 10000); // 10 second fallback

    // Check if user is already logged in
    if (this.token) {
      try {
        this.logger.info("Token found, attempting to load team data", { token: this.token.substring(0, 20) + '...' });
        await this.loadTeamData();
        
        clearTimeout(fallbackTimeout);
        
        // Follow the same pattern as handleLogin() - simple and effective
        this.showScreen("game-screen");
        this.updateGameUI();
        
        // Restore game state after basic setup (like handleLogin would do)
        const gameStateRestored = await this.restoreGameState();
        if (gameStateRestored) {
          this.logger.info("Game state restored successfully");
        }
        
        this.logger.info("Game screen shown, UI updated successfully");
      } catch (error) {
        this.logger.error("Token invalid or failed to load team data", { error: error.message, stack: error.stack });
        this.token = null;
        localStorage.removeItem("tuna_token");
        this.clearTimerState();
        clearTimeout(fallbackTimeout);
        this.showScreen("login-screen");
        this.showNotification(
          "Sesi Anda telah berakhir. Silakan login kembali.",
          "warning"
        );
      }
    } else {
      this.logger.info("No token found, showing login screen");
      clearTimeout(fallbackTimeout);
      this.showScreen("login-screen");
    }

    this.setupEventListeners();
    
    // Add debug method to global scope for testing
    window.debugTuna = {
      showWelcome: () => this.forceShowWelcomeContent(),
      showAppropriate: () => this.showAppropriateContent(),
      getState: () => ({
        currentScreen: this.currentScreen,
        gameState: this.gameState,
        isGameStarted: this.isGameStarted
      })
    };
    } catch (error) {
      this.logger.error("Initialization failed", { error: error.message, stack: error.stack });
      // Fallback: show login screen
      this.showScreen("login-screen");
      this.showNotification("Terjadi kesalahan saat memuat aplikasi. Silakan refresh halaman.", "error");
    }
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

    document.getElementById("decisionForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      // Ensure scenario is loaded before submitting
      if (!this.currentScenario && this.teamData && this.teamData.currentPosition) {
        console.log("🔄 Loading scenario before submit...");
        await this.loadCurrentScenario();
      }
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
    console.log(`🎯 Switching to screen: ${screenId}`);
    
    // Update current screen state
    console.log('🔄 currentScreen changed via showScreen():', {
      from: this.currentScreen,
      to: screenId
    });
    this.currentScreen = screenId;
    
    // Remove active class from all screens and reset display style
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
      screen.style.display = "none";
      console.log(`  - Removed active from: ${screen.id}`);
    });
    
    // Add active class to target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.add("active");
      targetScreen.style.display = "flex";
      console.log(`  - Added active to: ${screenId}`);
      
      // Force a reflow to ensure the display change takes effect
      targetScreen.offsetHeight;
    } else {
      console.error(`  - Target screen not found: ${screenId}`);
    }

    // Note: Content sections are managed by showAppropriateContent()
    // Don't override content sections here to avoid conflicts
  }

  // Explicitly hide login screen
  hideLoginScreen() {
    const loginScreen = document.getElementById("login-screen");
    if (loginScreen) {
      loginScreen.classList.remove("active");
      loginScreen.style.display = "none";
      console.log("🎯 Login screen explicitly hidden");
    }
  }

  // Explicitly show login screen
  showLoginScreen() {
    console.log("🎯 Showing login screen");
    
    // Use requestAnimationFrame to ensure DOM updates are processed
    requestAnimationFrame(() => {
      try {
        // Remove active class from all screens and reset display style
        document.querySelectorAll(".screen").forEach((screen) => {
          screen.classList.remove("active");
          screen.style.display = "none";
          console.log(`  - Removed active from: ${screen.id}`);
        });
        
        // Add active class to login screen
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen) {
          loginScreen.classList.add("active");
          loginScreen.style.display = "flex";
          console.log("🎯 Login screen explicitly shown");
        } else {
          console.error("Login screen not found");
        }
      } catch (error) {
        console.error("Error showing login screen:", error);
      }
    });
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

    // Don't allow login if team has been kicked
    if (this.isKicked) {
      this.showNotification(
        "Tim Anda telah dikeluarkan dari permainan. Anda tidak dapat masuk kembali.",
        "error"
      );
      return;
    }

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
      
      // Explicitly hide login screen and show game screen
      this.hideLoginScreen();
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
      
    console.log("🎯 Registration successful, switching to game screen");
    
    // Explicitly hide login screen and show game screen
    this.hideLoginScreen();
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
    try {
      this.socket = io();
      this.logger.info("WebSocket connection initialized");
      
      // Add timeout for WebSocket connection
      const connectionTimeout = setTimeout(() => {
        if (!this.socket.connected) {
          this.logger.warn("WebSocket connection timeout, continuing without WebSocket");
        }
      }, 5000); // 5 second timeout
      
      this.socket.on('connect', () => {
        clearTimeout(connectionTimeout);
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
      
      // Only reconnect if team hasn't been kicked
      if (this.teamData && !this.hasJoinedAsTeam) {
        this.socket.emit('team-join', {
          teamId: this.teamData.id,
          teamName: this.teamData.teamName
        });
        this.hasJoinedAsTeam = true;
      }
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
    });
    
    this.socket.on('connect_error', (error) => {
      this.logger.error("WebSocket connection error", { error: error.message });
      clearTimeout(connectionTimeout);
    });
    
    } catch (error) {
      this.logger.error("Failed to initialize WebSocket", { error: error.message });
    }

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
        "Tim Anda telah dikeluarkan dari permainan oleh admin. Anda tidak dapat masuk kembali.",
        "error"
      );
      
      // Set kicked flag to prevent any further actions
      this.isKicked = true;
      
      // Reset join flag to prevent reconnection
      this.hasJoinedAsTeam = false;
      
      // Clear all game state
      this.clearGameState();
      localStorage.removeItem("tuna_game_state");
      localStorage.removeItem("tuna_timer_state");
      
      // Disconnect from WebSocket to prevent reconnection
      if (this.socket) {
        this.socket.disconnect();
      }
      
      this.logout();
    });

    this.socket.on('reset-game-command', () => {
      console.log('🔄 Received reset game command from admin');
      
      // Don't process reset if team has been kicked
      if (this.isKicked) {
        console.log('🚫 Team has been kicked, ignoring reset command');
        return;
      }
      
      this.resetGameFromAdmin();
    });

    // Listen for game state updates from server
    this.socket.on('game-state-update', (data) => {
      console.log('🔄 Game state update from server:', data);
      const oldGameState = this.gameState;
      const oldStep = this.currentScenarioPosition;
      
      this.gameState = data.gameState || 'waiting';
      this.currentScenarioPosition = data.currentStep || 0;
      
      // IMPORTANT: Update flags based on server state for better synchronization
      this.isGameStarted = data.isGameRunning || false;
      this.isWaitingForAdmin = data.isWaiting || false;
      
      // Update UI based on server state
      this.updateGameStateUI();
      
      // IMPORTANT: If step changed, we need to sync with server state
      if (oldStep !== this.currentScenarioPosition && this.teamData) {
        console.log(`🔄 Step changed from ${oldStep} to ${this.currentScenarioPosition}, syncing with server`);
        this.syncWithServerState();
      } else {
        this.showAppropriateContent();
      }
      
      // Show notification if game state was reset (server restart)
      if (oldGameState !== this.gameState && this.gameState === 'waiting') {
        this.showNotification('Server restarted - Game state reset to waiting', 'info');
        this.clearGameState();
      }
      
      // Log enhanced synchronization info
      this.logger.info("Game state synchronized with server", {
        gameState: this.gameState,
        currentStep: this.currentScenarioPosition,
        isGameStarted: this.isGameStarted,
        isWaitingForAdmin: this.isWaitingForAdmin,
        timestamp: data.timestamp
      });
    });
  }

  // Game Logic
  async startGame() {
    console.log("🚀 Starting game...");
    
    // Don't allow starting game if team has been kicked
    if (this.isKicked) {
      this.showNotification(
        "Tim Anda telah dikeluarkan dari permainan. Silakan login ulang.",
        "error"
      );
      this.logout();
      return;
    }
    
    if (this.isWaitingForAdmin) {
      this.showNotification(
        "Menunggu admin untuk memulai permainan...",
        "info"
      );
      return;
    }

    try {
      // Check if team is continuing from a previous position
      if (this.teamData && this.teamData.currentPosition > 1) {
        // Team is continuing - get current scenario
        const response = await this.apiRequest(`/game/scenario/${this.teamData.currentPosition}`);
        
         if (response.success) {
           this.currentScenario = response.data;
           this.currentScenarioPosition = this.teamData.currentPosition;
           this.updateScenarioUI();
           // Clear form fields for new scenario
           this.clearDecisionFormForNewScenario();

          // Hide welcome content and show scenario content
          document.getElementById("welcome-content").classList.remove("active");
          document.getElementById("scenario-content").classList.add("active");
          console.log('🔄 currentScreen changed to scenario-content (line 742)');
          console.log('🔄 currentScreen changed to scenario-content (line 769)');
         console.log('🔄 currentScreen changed to scenario-content (line 807)');
          console.log('🔄 currentScreen changed to scenario-content (line 1092)');
          console.log('🔄 currentScreen changed to scenario-content (line 1234)');
                console.log('🔄 currentScreen changed to scenario-content (line 1528)');
                console.log('🔄 currentScreen changed to scenario-content (line 1606)');
              console.log('🔄 currentScreen changed to scenario-content (line 1707)');
            this.currentScreen = 'scenario-content';

          this.showNotification(
            `Lanjutkan ke Pos ${this.teamData.currentPosition}: ${this.currentScenario.title}`,
            "success"
          );
          console.log("✅ Game continued successfully");
          return;
        }
      }
      
      // Team is starting fresh
      const response = await this.apiRequest("/game/start", {
        method: "POST",
      });

       if (response.success) {
         this.currentScenario = response.scenario;
         this.timeLeft = response.timeLimit;
         this.currentScenarioPosition = response.scenario.position || 0;
         this.updateScenarioUI();
         // Clear form fields for new scenario
         this.clearDecisionFormForNewScenario();

        // Hide welcome content and show scenario content
        document.getElementById("welcome-content").classList.remove("active");
        document.getElementById("scenario-content").classList.add("active");
        console.log('🔄 currentScreen changed to scenario-content (line 769)');
         console.log('🔄 currentScreen changed to scenario-content (line 807)');
          console.log('🔄 currentScreen changed to scenario-content (line 1092)');
          console.log('🔄 currentScreen changed to scenario-content (line 1234)');
                console.log('🔄 currentScreen changed to scenario-content (line 1528)');
                console.log('🔄 currentScreen changed to scenario-content (line 1606)');
              console.log('🔄 currentScreen changed to scenario-content (line 1707)');
            this.currentScreen = 'scenario-content';

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
    
    // Don't allow starting game if team has been kicked
    if (this.isKicked) {
      console.log("🚫 Team has been kicked, ignoring start game command");
      return;
    }
    
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
        this.currentScenarioPosition = response.scenario.position || 0;
         console.log('🔄 currentScreen changed to scenario-content (line 769)');
         console.log('🔄 currentScreen changed to scenario-content (line 807)');
          console.log('🔄 currentScreen changed to scenario-content (line 1092)');
          console.log('🔄 currentScreen changed to scenario-content (line 1234)');
                console.log('🔄 currentScreen changed to scenario-content (line 1528)');
                console.log('🔄 currentScreen changed to scenario-content (line 1606)');
              console.log('🔄 currentScreen changed to scenario-content (line 1707)');
            this.currentScreen = 'scenario-content';
         this.updateScenarioUI();
         // Clear form fields for new scenario
         this.clearDecisionFormForNewScenario();
        this.updateGameStateUI();
        this.saveGameState();

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
    
    // Don't allow next scenario if team has been kicked
    if (this.isKicked) {
      console.log("🚫 Team has been kicked, ignoring next scenario command");
      return;
    }
    
    this.currentScenarioPosition++;
    this.saveGameState();
    this.nextScenario();
  }

  endGameFromAdmin() {
    console.log("🏁 Ending game from admin command...");
    
    // Don't allow end game if team has been kicked
    if (this.isKicked) {
      console.log("🚫 Team has been kicked, ignoring end game command");
      return;
    }
    
    this.isGameStarted = false;
    this.isWaitingForAdmin = true;
    this.gameState = 'ended';
    this.currentScreen = 'complete-content';
    this.saveGameState();
    this.updateGameStateUI();
    this.showNotification(
      "Admin telah mengakhiri permainan.",
      "info"
    );
  }

  resetGameFromAdmin() {
    console.log("🔄 Resetting game from admin command...");
    
    // Clear kicked flag on reset
    this.isKicked = false;
    
    // Reset all game state
    this.isGameStarted = false;
    this.isWaitingForAdmin = false;
    this.gameState = 'waiting';
    this.currentScreen = 'welcome-content';
    this.currentScenarioPosition = 0;
    this.currentScenario = null;
    this.timeLeft = 900;
    this.stopTimer();
    this.clearTimerState();
    
    // Reset team data to initial state
    if (this.teamData) {
      this.teamData.currentPosition = 1;
      this.teamData.totalScore = 0;
    }
    
    // Clear all saved states
    this.clearGameState();
    localStorage.removeItem("tuna_game_state");
    localStorage.removeItem("tuna_timer_state");
    
    // Update UI
    this.updateGameUI();
    this.updateGameStateUI();
    this.showAppropriateContent();
    
    this.showNotification(
      "Admin telah mereset permainan. Anda dapat memulai permainan baru.",
      "success"
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
    // Clear form fields before starting new decision
    this.clearDecisionForm();
    
    // Hide scenario content and show decision content
    document.getElementById("scenario-content").classList.remove("active");
    document.getElementById("decision-content").classList.add("active");
    
    // Update current screen state
    this.currentScreen = 'decision-content';
    this.saveGameState();

    this.startTimer();
    this.showNotification(
      "Waktu diskusi dimulai! Anda memiliki 15 menit.",
      "info"
    );
  }

  async submitDecision() {
    // Check if currentScenario is available
    if (!this.currentScenario) {
      console.warn("⚠️ currentScenario is null, attempting to load scenario before submit");
      
      // Try to load scenario before showing error
      if (this.teamData && this.teamData.currentPosition) {
        await this.loadCurrentScenario();
        
        // Check again after loading
        if (!this.currentScenario) {
          this.showNotification("Tidak ada scenario aktif. Silakan refresh halaman atau hubungi admin.", "error");
          console.error("❌ Cannot submit decision: currentScenario is still null after loading attempt");
          return;
        }
      } else {
        this.showNotification("Tidak ada scenario aktif. Silakan refresh halaman atau hubungi admin.", "error");
        console.error("❌ Cannot submit decision: currentScenario is null and no team data");
        return;
      }
    }

    const formData = new FormData(document.getElementById("decisionForm"));
    const decision = formData.get("decision");
    const reasoning = formData.get("reasoning");
    
    // Validate form data
    if (!decision || !reasoning) {
      this.showNotification("Silakan isi semua field yang diperlukan (Keputusan dan Alasan).", "error");
      console.warn("⚠️ Form validation failed:", { decision: !!decision, reasoning: !!reasoning });
      return;
    }
    
    const data = {
      position: this.currentScenario.position,
      decision: decision,
      argumentation: reasoning,
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
        
        // Update current screen state
        this.currentScreen = 'results-content';
        this.saveGameState();

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

    // Store results data for persistence
    this.resultsData = {
      score: result.score,
      teamDecision: result.teamDecision,
      teamReasoning: result.teamArgumentation,
      standardDecision: result.standardAnswer,
      standardReasoning: result.standardArgumentation
    };

    // Hide all content sections first
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
      console.log(`  - Removed active from: ${section.id}`);
    });
    
    // Show only results content
    document.getElementById("results-content").classList.add("active");
    console.log("  - Added active to: results-content");
    
    // Update current screen state
    this.currentScreen = 'results-content';
    this.saveGameState();

    this.updateGameUI();
    
    console.log("✅ Results displayed, scenario content hidden");
  }

  async nextScenario() {
    this.updateGameUI();
    this.updateGameStateUI();

    if (this.teamData.currentPosition > 7) {
      // Hide results and show complete content
      document.getElementById("results-content").classList.remove("active");
      document.getElementById("complete-content").classList.add("active");
      this.currentScreen = 'complete-content';
      this.saveGameState();
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
           // Clear form fields for new scenario
           this.clearDecisionFormForNewScenario();
          document.getElementById("scenario-content").classList.add("active");
          console.log('🔄 currentScreen changed to scenario-content (line 742)');
          console.log('🔄 currentScreen changed to scenario-content (line 769)');
         console.log('🔄 currentScreen changed to scenario-content (line 807)');
          console.log('🔄 currentScreen changed to scenario-content (line 1092)');
          console.log('🔄 currentScreen changed to scenario-content (line 1234)');
                console.log('🔄 currentScreen changed to scenario-content (line 1528)');
                console.log('🔄 currentScreen changed to scenario-content (line 1606)');
              console.log('🔄 currentScreen changed to scenario-content (line 1707)');
            this.currentScreen = 'scenario-content';
          this.saveGameState();
          this.showNotification(
            `Selamat! Lanjut ke Pos ${this.teamData.currentPosition}: ${nextScenario.title}`,
            "success"
          );
        } else {
          // No more scenarios
          document.getElementById("complete-content").classList.add("active");
          this.currentScreen = 'complete-content';
          this.saveGameState();
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
      
      // Update current screen state and save
      this.currentScreen = 'leaderboard-content';
      this.saveGameState();
      
      console.log("✅ Leaderboard displayed, currentScreen set to leaderboard-content");
    } catch (error) {
      this.showNotification(error.message, "error");
    }
  }

  hideLeaderboard() {
    // Hide leaderboard and show appropriate content
    document.getElementById("leaderboard-content").classList.remove("active");

    if (this.teamData.currentPosition > 7) {
      document.getElementById("complete-content").classList.add("active");
      this.currentScreen = 'complete-content';
    } else {
      document.getElementById("results-content").classList.add("active");
      this.currentScreen = 'results-content';
    }
    
    // Save the updated screen state
    this.saveGameState();
  }

  playAgain() {
    this.logout();
  }

  logout() {
    // Notify server about logout if team is connected
    if (this.socket && this.teamData) {
      const teamId = this.teamData.teamId || this.teamData.id;
      if (teamId) {
        console.log('🚪 Notifying server about team logout:', teamId);
        this.socket.emit('team-logout', { teamId });
      }
    }

    this.token = null;
    localStorage.removeItem("tuna_token");
    this.teamData = null;
    this.currentScenario = null;
    this.stopTimer();
    this.clearTimerState();
    localStorage.removeItem("tuna_game_state");
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
    if (!this.currentScenario) {
      console.warn("⚠️ currentScenario is null, attempting to load scenario");
      // Try to load scenario if we have team data and position
      if (this.teamData && this.teamData.currentPosition) {
        this.loadCurrentScenario();
      }
      return;
    }

    document.getElementById("scenarioTitle").textContent =
      this.currentScenario.title;
    document.getElementById("scenarioPosition").textContent =
      this.currentScenario.position;
    document.getElementById("scenarioText").textContent =
      this.currentScenario.scenarioText;
  }

  async loadCurrentScenario() {
    if (!this.teamData || !this.teamData.currentPosition) {
      console.error("❌ Cannot load scenario: missing team data or position");
      return;
    }

    try {
      console.log(`🔄 Loading scenario for position ${this.teamData.currentPosition}`);
      const response = await this.apiRequest(`/game/scenario/${this.teamData.currentPosition}`);
      
      if (response.success) {
        this.currentScenario = response.data;
        this.currentScenarioPosition = this.teamData.currentPosition;
        this.gameState = 'running';
        this.isGameStarted = true;
        this.isWaitingForAdmin = false;
        console.log('🔄 currentScreen changed to scenario-content (line 769)');
         console.log('🔄 currentScreen changed to scenario-content (line 807)');
          console.log('🔄 currentScreen changed to scenario-content (line 1092)');
          console.log('🔄 currentScreen changed to scenario-content (line 1234)');
                console.log('🔄 currentScreen changed to scenario-content (line 1528)');
                console.log('🔄 currentScreen changed to scenario-content (line 1606)');
              console.log('🔄 currentScreen changed to scenario-content (line 1707)');
            this.currentScreen = 'scenario-content';
        
         // Update UI
         this.updateScenarioUI();
         
         // Don't clear form when loading scenario - preserve user input
         console.log("📝 Preserving user input when loading scenario");
         
         this.updateGameUI();
         
         // Only call showAppropriateContent if we're not in results screen
         if (this.currentScreen !== 'results-content') {
           this.showAppropriateContent();
         }
        
        console.log("✅ Scenario loaded successfully:", this.currentScenario);
        this.logger.info("Scenario loaded and UI updated", {
          scenario: this.currentScenario,
          currentScreen: this.currentScreen,
          gameState: this.gameState
        });
      } else {
        console.error("❌ Failed to load scenario:", response.message);
        this.showNotification("Gagal memuat scenario. Silakan refresh halaman.", "error");
      }
    } catch (error) {
      console.error("❌ Error loading scenario:", error);
      this.showNotification("Error memuat scenario. Silakan refresh halaman.", "error");
    }
  }

  clearDecisionForm() {
    // Clear form fields
    document.getElementById("decision").value = "";
    document.getElementById("reasoning").value = "";
    
    // Reset character counters
    document.getElementById("decisionCount").textContent = "0";
    document.getElementById("reasoningCount").textContent = "0";
    
    console.log("🧹 Form fields cleared for new scenario");
  }

  // Clear form only when starting a new scenario (not when restoring)
  clearDecisionFormForNewScenario() {
    this.clearDecisionForm();
  }

  // Check if form has data
  hasFormData() {
    const decision = document.getElementById("decision").value;
    const reasoning = document.getElementById("reasoning").value;
    const hasData = decision && reasoning;
    console.log("🔍 Checking form data:", { 
      decision: decision ? `${decision.length} chars` : 'empty', 
      reasoning: reasoning ? `${reasoning.length} chars` : 'empty',
      hasData: hasData 
    });
    return hasData;
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

  // New method to load leaderboard data without changing currentScreen
  async loadLeaderboardData() {
    try {
      console.log('🔄 Loading leaderboard data for display');
      const response = await this.apiRequest("/game/leaderboard");
      this.updateLeaderboardUI(response.data);
      console.log('✅ Leaderboard data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading leaderboard data:', error);
      this.showNotification("Gagal memuat data leaderboard", "error");
    }
  }

  // Timer
  startTimer() {
    this.timeLeft = 900; // 15 minutes
    this.timerStartTime = Date.now();
    this.timerDuration = 900;
    this.isTimerActive = true;
    
    // Save timer state to localStorage
    this.saveTimerState();
    
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.updateTimerDisplay();
      
      // Update saved timer state
      this.saveTimerState();

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
    this.isTimerActive = false;
    this.timerStartTime = null;
    this.clearTimerState();
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    document.getElementById("timeRemaining").textContent = display;
  }

  // Timer persistence methods
  saveTimerState() {
    if (this.isTimerActive && this.timerStartTime) {
      const timerState = {
        startTime: this.timerStartTime,
        duration: this.timerDuration,
        isActive: this.isTimerActive,
        currentScenario: this.currentScenario ? this.currentScenario.position : null,
        gameState: this.gameState,
        currentScreen: this.currentScreen
      };
      localStorage.setItem("tuna_timer_state", JSON.stringify(timerState));
    }
  }

  restoreTimerState() {
    try {
      const savedState = localStorage.getItem("tuna_timer_state");
      if (savedState) {
        const timerState = JSON.parse(savedState);
        
        // Don't restore timer state - let server provide current state
        // Timer state should only be restored if server confirms game is running
        this.logger.info("Timer state found in localStorage but not restoring - waiting for server confirmation");
        this.clearTimerState();
      }
    } catch (error) {
      console.error("Error restoring timer state:", error);
      this.clearTimerState();
    }
    return false;
  }

  clearTimerState() {
    localStorage.removeItem("tuna_timer_state");
  }

  clearGameState() {
    localStorage.removeItem("tuna_game_state");
    this.gameState = 'waiting';
    this.isGameStarted = false;
    this.isWaitingForAdmin = true;
    this.currentScenarioPosition = 0;
    this.currentScreen = 'welcome-content';
    this.currentScenario = null;
    
    // Ensure game screen is shown and welcome content is active
    this.showScreen("game-screen");
    this.showAppropriateContent();
    
    // Force show welcome content as fallback
    setTimeout(() => {
      this.forceShowWelcomeContent();
    }, 100);
  }
  
  forceShowWelcomeContent() {
    console.log('🔧 Force showing welcome content');
    // Hide all content sections
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
    });
    
    // Show welcome content
    const welcomeElement = document.getElementById("welcome-content");
    if (welcomeElement) {
      welcomeElement.classList.add("active");
      console.log('✅ Welcome content forced to show');
    } else {
      console.error('❌ Welcome content element not found');
    }
  }

  saveGameState() {
    const gameState = {
      teamData: this.teamData,
      currentScenario: this.currentScenario,
      gameState: this.gameState,
      currentScreen: this.currentScreen,
      isGameStarted: this.isGameStarted,
      currentScenarioPosition: this.currentScenarioPosition,
      resultsData: this.resultsData
    };
    localStorage.setItem("tuna_game_state", JSON.stringify(gameState));
  }

  async restoreGameState() {
    try {
      // First, try to get current game state from server
      if (this.teamData) {
        try {
          const response = await this.apiRequest("/game/status");
          if (response.success) {
            const serverState = response.data;
            
            // Update team data with server state
            this.teamData.currentPosition = serverState.currentPosition;
            this.teamData.totalScore = serverState.totalScore;
            
            // Determine appropriate screen based on server state
            this.logger.info("Determining screen based on server state", {
              isGameComplete: serverState.isGameComplete,
              hasCurrentScenario: !!serverState.currentScenario,
              currentPosition: serverState.currentPosition,
              serverScenario: serverState.currentScenario,
              frontendCurrentScenario: this.currentScenario
            });
            
            console.log('🔍 Starting restoreGameState conditional checks:', {
              isGameComplete: serverState.isGameComplete,
              hasCurrentScenario: !!serverState.currentScenario,
              currentPosition: serverState.currentPosition,
              currentScreen: this.currentScreen
            });
            
            if (serverState.isGameComplete) {
              console.log('🔍 Entering isGameComplete block');
              this.currentScreen = 'complete-content';
              this.gameState = 'ended';
            } else if (serverState.currentScenario) {
              console.log('🔍 Entering hasCurrentScenario block');
              // Team is in the middle of a scenario - but check if user was viewing results/leaderboard first
              const savedState = localStorage.getItem("tuna_game_state");
              let shouldShowScenario = true;
              
              if (savedState) {
                try {
                  const gameState = JSON.parse(savedState);
                  if (gameState.currentScreen === 'results-content' || gameState.currentScreen === 'leaderboard-content') {
                    // User was viewing results or leaderboard, prioritize that over scenario
                    this.currentScreen = gameState.currentScreen;
                    this.gameState = 'waiting';
                    this.isWaitingForAdmin = true;
                    shouldShowScenario = false;
                    
                    this.logger.info("User was viewing results/leaderboard, prioritizing that over scenario", {
                      currentScreen: this.currentScreen,
                      serverScenario: serverState.currentScenario
                    });
                    
                    // If restoring results-content, we need to load the scenario data and results data
                    if (this.currentScreen === 'results-content' && gameState.currentScenario) {
                      this.currentScenario = gameState.currentScenario;
                      console.log('🔍 Restored scenario for results-content:', this.currentScenario);
                    }
                    
                    // Restore results data if available
                    if (this.currentScreen === 'results-content' && gameState.resultsData) {
                      this.resultsData = gameState.resultsData;
                      console.log('🔍 Restored results data from gameState:', this.resultsData);
                    } else if (this.currentScreen === 'results-content' && !gameState.resultsData) {
                      console.log('⚠️ Results screen but no resultsData in gameState!');
                    }
                  }
                } catch (error) {
                  // Continue with scenario display if localStorage parsing fails
                }
              }
              
              if (shouldShowScenario) {
                // Team is in the middle of a scenario - show scenario content
                this.currentScenario = serverState.currentScenario;
                console.log('🔄 currentScreen changed to scenario-content (line 742)');
          console.log('🔄 currentScreen changed to scenario-content (line 769)');
         console.log('🔄 currentScreen changed to scenario-content (line 807)');
          console.log('🔄 currentScreen changed to scenario-content (line 1092)');
          console.log('🔄 currentScreen changed to scenario-content (line 1234)');
                console.log('🔄 currentScreen changed to scenario-content (line 1528)');
                console.log('🔄 currentScreen changed to scenario-content (line 1606)');
              console.log('🔄 currentScreen changed to scenario-content (line 1707)');
            this.currentScreen = 'scenario-content';
                this.gameState = 'running';
                this.currentScenarioPosition = serverState.currentPosition;
                this.isGameStarted = true;
                this.isWaitingForAdmin = false;
                
                this.logger.info("Team is in scenario, setting scenario content", {
                  scenario: serverState.currentScenario,
                  currentScreen: this.currentScreen,
                  position: serverState.currentPosition
                });
                
                 // Update scenario UI immediately
                 this.updateScenarioUI();
                 // Don't clear form fields for restored scenario - user might have already filled them
                 this.updateGameUI();
              }
            } else if (serverState.currentPosition > 1) {
              // Team has completed scenarios but no current scenario
              // This means they're waiting for admin to advance to next scenario
              console.log('🔍 Entering localStorage fallback block:', {
                serverStateCurrentPosition: serverState.currentPosition,
                hasCurrentScenario: !!serverState.currentScenario,
                currentScreen: this.currentScreen
              });
              
              // Check if user was viewing results or leaderboard before refresh
              const savedState = localStorage.getItem("tuna_game_state");
              if (savedState) {
                try {
                  const gameState = JSON.parse(savedState);
                  console.log('🔍 Checking gameState.currentScreen:', {
                    gameStateCurrentScreen: gameState.currentScreen,
                    isResults: gameState.currentScreen === 'results-content',
                    isLeaderboard: gameState.currentScreen === 'leaderboard-content',
                    willEnterBlock: gameState.currentScreen === 'results-content' || gameState.currentScreen === 'leaderboard-content'
                  });
                  
                  if (gameState.currentScreen === 'results-content' || gameState.currentScreen === 'leaderboard-content') {
                    // User was viewing results or leaderboard, restore that screen
                    this.currentScreen = gameState.currentScreen;
                    this.logger.info("Restoring user's previous screen", {
                      currentScreen: this.currentScreen,
                      currentPosition: serverState.currentPosition
                    });
                    
                    // If restoring results-content, we need to load the scenario data and results data
                    if (this.currentScreen === 'results-content' && gameState.currentScenario) {
                      this.currentScenario = gameState.currentScenario;
                      this.logger.info("Restored scenario data for results display", {
                        scenario: this.currentScenario
                      });
                    }
                    
                    // Restore results data if available
                    if (this.currentScreen === 'results-content' && gameState.resultsData) {
                      this.resultsData = gameState.resultsData;
                      console.log('🔍 Restored results data from server state:', this.resultsData);
                      this.logger.info("Restored results data for display", {
                        resultsData: this.resultsData
                      });
                    }
                    
                    // If no results data from server state, try localStorage
                    console.log('🔍 Checking resultsData restoration:', {
                      currentScreen: this.currentScreen,
                      hasResultsData: !!this.resultsData,
                      resultsData: this.resultsData
                    });
                    
                    if (this.currentScreen === 'results-content' && !this.resultsData) {
                      console.log('🔍 No results data from server state, trying localStorage...');
                      const savedState = localStorage.getItem("tuna_game_state");
                      if (savedState) {
                        const localGameState = JSON.parse(savedState);
                        console.log('🔍 localStorage gameState:', {
                          hasResultsData: !!localGameState.resultsData,
                          resultsData: localGameState.resultsData
                        });
                        if (localGameState.resultsData) {
                          this.resultsData = localGameState.resultsData;
                          console.log('🔍 Restored results data from localStorage:', this.resultsData);
                        }
                      } else {
                        console.log('🔍 No saved state found in localStorage');
                      }
                    } else {
                      console.log('🔍 Skipping localStorage fallback:', {
                        currentScreen: this.currentScreen,
                        hasResultsData: !!this.resultsData
                      });
                    }
                    
                  } else {
                    this.currentScreen = 'welcome-content';
                  }
                } catch (error) {
                  this.currentScreen = 'welcome-content';
                }
              } else {
                this.currentScreen = 'welcome-content';
              }
              
              this.gameState = 'waiting';
              this.isWaitingForAdmin = true;
              this.logger.info("Team waiting for admin, showing appropriate content", {
                currentPosition: serverState.currentPosition,
                currentScreen: this.currentScreen
              });
            } else {
              // Team hasn't started yet
              console.log('🔍 Entering else block (team hasn\'t started):', {
                serverStateCurrentPosition: serverState.currentPosition,
                hasCurrentScenario: !!serverState.currentScenario,
                currentScreen: this.currentScreen
              });
              this.currentScreen = 'welcome-content';
              this.gameState = 'waiting';
              this.logger.info("Team hasn't started yet, showing welcome content");
            }
            
            // If we're in a scenario position but don't have currentScenario, try to load it
            // BUT NOT if user is viewing results or leaderboard
            if (serverState.currentPosition > 1 && serverState.currentPosition <= 7 && !this.currentScenario && 
                this.currentScreen !== 'results-content' && this.currentScreen !== 'leaderboard-content') {
              this.logger.info("Team is in scenario position but no currentScenario, attempting to load", {
                currentPosition: serverState.currentPosition
              });
              await this.loadCurrentScenario();
            }
            
            // Additional check: if we have currentScenario but it's not being displayed properly
            // BUT NOT if user is viewing results or leaderboard
            if (serverState.currentScenario && !this.currentScenario && 
                this.currentScreen !== 'results-content' && this.currentScreen !== 'leaderboard-content') {
              this.logger.info("Server provided currentScenario but frontend doesn't have it, loading it", {
                serverScenario: serverState.currentScenario,
                currentPosition: serverState.currentPosition
              });
              this.currentScenario = serverState.currentScenario;
              console.log('🔄 currentScreen changed to scenario-content (line 742)');
          console.log('🔄 currentScreen changed to scenario-content (line 769)');
         console.log('🔄 currentScreen changed to scenario-content (line 807)');
          console.log('🔄 currentScreen changed to scenario-content (line 1092)');
          console.log('🔄 currentScreen changed to scenario-content (line 1234)');
                console.log('🔄 currentScreen changed to scenario-content (line 1528)');
                console.log('🔄 currentScreen changed to scenario-content (line 1606)');
              console.log('🔄 currentScreen changed to scenario-content (line 1707)');
            // DON'T change currentScreen if user is viewing results or leaderboard
            if (this.currentScreen !== 'results-content' && this.currentScreen !== 'leaderboard-content') {
              this.currentScreen = 'scenario-content';
              this.gameState = 'running';
              this.isGameStarted = true;
              this.isWaitingForAdmin = false;
              this.updateScenarioUI();
              this.updateGameUI();
              this.showAppropriateContent();
            }
            }
            
            this.logger.info("Game state restored from server", {
              currentPosition: serverState.currentPosition,
              isGameComplete: serverState.isGameComplete,
              hasCurrentScenario: !!serverState.currentScenario,
              currentScenario: serverState.currentScenario,
              currentScreen: this.currentScreen
            });
            
            // Show appropriate content immediately (like handleLogin does)
            this.showAppropriateContent();
            
            return true;
          }
        } catch (error) {
          this.logger.error("Failed to get game state from server", { error: error.message });
        }
      }
      
      // Fallback: check localStorage if server request failed
      const savedState = localStorage.getItem("tuna_game_state");
      if (savedState) {
        const gameState = JSON.parse(savedState);
        
        // Only restore if it seems reasonable (not from a server restart)
        if (gameState.teamData && gameState.teamData.currentPosition > 1) {
          this.teamData = gameState.teamData;
          this.currentScenario = gameState.currentScenario;
          this.gameState = gameState.gameState || 'waiting';
          this.currentScreen = gameState.currentScreen || 'welcome-content';
          this.currentScenarioPosition = gameState.currentScenarioPosition || 0;
          this.resultsData = gameState.resultsData;
          console.log('🔍 Restored results data from localStorage:', this.resultsData);
          
          this.logger.info("Game state restored from localStorage", {
            currentPosition: this.teamData.currentPosition,
            currentScreen: this.currentScreen
          });
          
          // Show appropriate content immediately (like handleLogin does)
          this.showAppropriateContent();
          
          return true;
        } else {
          this.logger.info("LocalStorage state found but not restoring - appears to be from server restart");
          this.clearGameState();
        }
      }
    } catch (error) {
      console.error("Error restoring game state:", error);
    }
    return false;
  }

  // IMPORTANT: New method to sync with server state when step changes
  async syncWithServerState() {
    try {
      console.log('🔄 syncWithServerState called - BEFORE:', {
        currentScreen: this.currentScreen,
        currentStep: this.currentScenarioPosition,
        teamPosition: this.teamData?.currentPosition
      });
      
      this.logger.info("Syncing with server state", {
        currentStep: this.currentScenarioPosition,
        teamPosition: this.teamData?.currentPosition
      });
      
      // Get fresh data from server
      const response = await this.apiRequest("/game/status");
      if (response.success) {
        const serverState = response.data;
        
        // Update team data with latest server state
        this.teamData.currentPosition = serverState.currentPosition;
        this.teamData.totalScore = serverState.totalScore;
        
        // Clear current scenario if we're not in a scenario
        if (!serverState.currentScenario) {
          this.currentScenario = null;
          this.isGameStarted = false;
          this.isWaitingForAdmin = true;
          this.currentScreen = 'welcome-content';
          this.logger.info("No current scenario, showing welcome content");
        } else {
          // We have a current scenario
          this.currentScenario = serverState.currentScenario;
          // Don't override currentScreen if user was viewing results or leaderboard
          console.log('🔍 syncWithServerState - checking currentScreen override:', {
            currentScreen: this.currentScreen,
            willOverride: this.currentScreen !== 'results-content' && this.currentScreen !== 'leaderboard-content'
          });
          
          if (this.currentScreen !== 'results-content' && this.currentScreen !== 'leaderboard-content') {
            console.log('⚠️ syncWithServerState - OVERRIDING currentScreen to scenario-content');
            console.log('🔄 currentScreen changed to scenario-content (line 742)');
          console.log('🔄 currentScreen changed to scenario-content (line 769)');
         console.log('🔄 currentScreen changed to scenario-content (line 807)');
          console.log('🔄 currentScreen changed to scenario-content (line 1092)');
          console.log('🔄 currentScreen changed to scenario-content (line 1234)');
                console.log('🔄 currentScreen changed to scenario-content (line 1528)');
                console.log('🔄 currentScreen changed to scenario-content (line 1606)');
              console.log('🔄 currentScreen changed to scenario-content (line 1707)');
            this.currentScreen = 'scenario-content';
          } else {
            console.log('✅ syncWithServerState - KEEPING currentScreen:', this.currentScreen);
          }
          this.gameState = 'running';
          this.isGameStarted = true;
          this.isWaitingForAdmin = false;
          
          // Don't update scenario UI if user is viewing results or leaderboard
          if (this.currentScreen !== 'results-content' && this.currentScreen !== 'leaderboard-content') {
            this.updateScenarioUI();
          }
          
          this.logger.info("Current scenario found, showing scenario content", {
            scenario: serverState.currentScenario.title,
            position: serverState.currentPosition
          });
        }
        
        // Update UI
        this.updateGameUI();
        
        console.log('🔄 syncWithServerState - AFTER all changes:', {
          currentScreen: this.currentScreen,
          currentScenario: this.currentScenario?.title
        });
        
        this.showAppropriateContent();
        
        this.logger.info("Successfully synced with server state", {
          currentPosition: serverState.currentPosition,
          hasCurrentScenario: !!serverState.currentScenario,
          currentScreen: this.currentScreen
        });
      }
    } catch (error) {
      this.logger.error("Failed to sync with server state", { error: error.message });
    }
  }

  showAppropriateContent() {
    console.log('🎯 showAppropriateContent called', {
      currentScreen: this.currentScreen,
      gameState: this.gameState,
      isGameStarted: this.isGameStarted,
      currentPosition: this.teamData?.currentPosition,
      hasCurrentScenario: !!this.currentScenario,
      currentScenario: this.currentScenario,
      isKicked: this.isKicked
    });
    
    // DEBUG: Check DOM state before making changes
    console.log('🔍 DOM State BEFORE showAppropriateContent:');
    document.querySelectorAll('.content-section').forEach(el => {
      console.log(`  ${el.id}: ${el.classList.contains('active') ? 'ACTIVE' : 'HIDDEN'}`);
    });
    
    // Don't show any game content if team has been kicked (unless reset)
    if (this.isKicked && this.currentScreen !== 'welcome-content') {
      console.log('🚫 Team has been kicked, not showing game content');
      this.showNotification(
        "Tim Anda telah dikeluarkan dari permainan. Silakan login ulang.",
        "error"
      );
      this.logout();
      return;
    }
    
    // Hide all content sections first
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
      console.log(`  - Removed active from: ${section.id}`);
    });
    
    // Show the appropriate content based on current state
    if (this.currentScreen && this.currentScreen !== 'game-screen' && document.getElementById(this.currentScreen)) {
      const targetElement = document.getElementById(this.currentScreen);
      targetElement.classList.add("active");
      console.log(`  - Added active to: ${this.currentScreen}`);
      
      // DEBUG: Check DOM state after adding active class
      console.log('🔍 DOM State AFTER adding active class:');
      document.querySelectorAll('.content-section').forEach(el => {
        console.log(`  ${el.id}: ${el.classList.contains('active') ? 'ACTIVE' : 'HIDDEN'}`);
      });
      
      // If showing welcome content and team has progress, update the welcome message
      if (this.currentScreen === 'welcome-content' && this.teamData && this.teamData.currentPosition > 1) {
        this.updateWelcomeContentForProgress();
      }
      
      // If showing scenario content, make sure scenario UI is updated
      if (this.currentScreen === 'scenario-content') {
         if (this.currentScenario) {
           console.log('  - Updating scenario UI for restored scenario');
           this.updateScenarioUI();
           // Don't clear form fields - user might have already filled them
         } else if (this.teamData && this.teamData.currentPosition) {
          console.log('🔄 Loading scenario for scenario content display...');
          this.loadCurrentScenario();
        }
      }
      
      // If showing results content, make sure only results are visible
      if (this.currentScreen === 'results-content') {
        console.log('  - Showing results content only');
        // Ensure scenario content is hidden when showing results
        const scenarioContent = document.getElementById('scenario-content');
        if (scenarioContent) {
          scenarioContent.classList.remove('active');
        }
        
        // Restore results data if available
        console.log('🔍 Checking resultsData in showAppropriateContent:', {
          hasResultsData: !!this.resultsData,
          resultsData: this.resultsData,
          currentScreen: this.currentScreen
        });
        
        if (this.resultsData) {
          console.log('  - Restoring results data for display', this.resultsData);
          
          // Use setTimeout to ensure DOM is ready
          setTimeout(() => {
            // Check if DOM elements exist
            const scenarioScore = document.getElementById("scenarioScore");
            const teamDecision = document.getElementById("teamDecision");
            const teamReasoning = document.getElementById("teamReasoning");
            const standardDecision = document.getElementById("standardDecision");
            const standardReasoning = document.getElementById("standardReasoning");
            
            console.log('  - DOM elements check (after timeout):', {
              scenarioScore: !!scenarioScore,
              teamDecision: !!teamDecision,
              teamReasoning: !!teamReasoning,
              standardDecision: !!standardDecision,
              standardReasoning: !!standardReasoning
            });
            
            if (scenarioScore) scenarioScore.textContent = this.resultsData.score;
            if (teamDecision) teamDecision.textContent = this.resultsData.teamDecision;
            if (teamReasoning) teamReasoning.textContent = this.resultsData.teamReasoning;
            if (standardDecision) standardDecision.textContent = this.resultsData.standardDecision;
            if (standardReasoning) standardReasoning.textContent = this.resultsData.standardReasoning;
            
            console.log('  - Results data restored successfully');
          }, 100);
        } else {
          console.log('  - No results data available to restore');
        }
      }
      
      // If showing leaderboard content, make sure only leaderboard is visible
      if (this.currentScreen === 'leaderboard-content') {
        console.log('  - Showing leaderboard content only');
        // Ensure scenario content is hidden when showing leaderboard
        const scenarioContent = document.getElementById('scenario-content');
        if (scenarioContent) {
          scenarioContent.classList.remove('active');
        }
        
        // DEBUG: Check DOM state after hiding scenario content
        console.log('🔍 DOM State AFTER hiding scenario content:');
        document.querySelectorAll('.content-section').forEach(el => {
          console.log(`  ${el.id}: ${el.classList.contains('active') ? 'ACTIVE' : 'HIDDEN'}`);
        });
        
        // Load leaderboard data if not already loaded
        if (this.teamData) {
          console.log('  - Loading leaderboard data for display');
          // Don't call showLeaderboard() here as it will override currentScreen
          // Instead, just load the data and update UI
          this.loadLeaderboardData();
        }
      }
    } else {
      // Default to welcome content if no specific screen is set or if currentScreen is game-screen
      const welcomeElement = document.getElementById("welcome-content");
      if (welcomeElement) {
        welcomeElement.classList.add("active");
        console.log(`  - Added active to welcome-content (default)`);
        
        // Update welcome content if team has progress
        if (this.teamData && this.teamData.currentPosition > 1) {
          this.updateWelcomeContentForProgress();
        }
      } else {
        console.error('  - welcome-content element not found!');
      }
    }
    
    // Update game state UI
    this.updateGameStateUI();
    
    // DEBUG: Final DOM state check
    console.log('🔍 FINAL DOM State:');
    document.querySelectorAll('.content-section').forEach(el => {
      console.log(`  ${el.id}: ${el.classList.contains('active') ? 'ACTIVE' : 'HIDDEN'}`);
    });
    
    // DEBUG: Check scenario DOM elements
    console.log('🔍 Scenario DOM Elements:');
    console.log(`  scenarioTitle: "${document.getElementById('scenarioTitle')?.textContent}"`);
    console.log(`  scenarioPosition: "${document.getElementById('scenarioPosition')?.textContent}"`);
    console.log(`  scenarioText: "${document.getElementById('scenarioText')?.textContent?.substring(0, 50)}..."`);
  }

  updateWelcomeContentForProgress() {
    if (!this.teamData || this.teamData.currentPosition <= 1) return;
    
    const welcomeCard = document.querySelector('#welcome-content .welcome-card');
    if (!welcomeCard) return;
    
    // Update the welcome message based on team's progress
    const title = welcomeCard.querySelector('h3');
    const description = welcomeCard.querySelector('p');
    const startButton = document.getElementById('startGameBtn');
    
    if (title && description && startButton) {
      if (this.teamData.currentPosition > 7) {
        // Game completed
        title.textContent = '🏆 Petualangan Selesai!';
        description.textContent = `Selamat! Tim Anda telah menyelesaikan semua tantangan dengan total skor ${this.teamData.totalScore} poin.`;
        startButton.style.display = 'none';
      } else if (this.isWaitingForAdmin) {
        // Waiting for admin to advance
        title.textContent = '⏳ Menunggu Admin';
        description.textContent = `Tim Anda telah menyelesaikan Pos ${this.teamData.currentPosition - 1} dengan skor ${this.teamData.totalScore} poin. Menunggu admin untuk memulai pos berikutnya.`;
        startButton.textContent = '⏳ Menunggu Admin...';
        startButton.disabled = true;
      } else {
        // Team has progress but can continue
        title.textContent = '🎯 Lanjutkan Petualangan!';
        description.textContent = `Tim Anda berada di Pos ${this.teamData.currentPosition} dengan total skor ${this.teamData.totalScore} poin. Siap untuk tantangan berikutnya?`;
        startButton.textContent = '🚀 Lanjutkan Petualangan';
        startButton.disabled = false;
      }
    }
    
    // Also update the progress bar to reflect current position
    this.updateGameUI();
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
