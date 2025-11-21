// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.apiBase = "/api";
        this.token = localStorage.getItem("tuna_token");
        this.currentSection = "overview";
        this.teamsData = [];
        this.statsData = {};
        this.scenarioData = {};
        this.socket = null;
        this.connectedTeams = new Map();
        this.realTimeTeams = new Map();
        this.gameState = 'waiting'; // waiting, running, ended
        this.teamsCompletedCurrentStep = new Set();
        this.currentStep = 0;
        this.gameSettings = {}; // Store game settings
        this.logger = window.AdminLogger || new Logger('ADMIN');
        
        this.init();
    }

    async init() {
        console.log("🔧 Initializing Admin Panel...");
        
        // Initialize dark mode
        this.initDarkMode();
        
        // Initialize WebSocket connection
        this.initWebSocket();
        
        this.checkRequiredElements();
        this.setupEventListeners();
        
        // Check if user is already authenticated
        if (this.token) {
            try {
                // Test if token is still valid
                await this.apiRequest("/admin/teams");
                
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
                    console.log(`🔄 Admin UI updated with restored state - gameState: ${this.gameState}, step: ${this.currentStep}`);
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
            'adminLoginForm',
            'refreshDataBtn', 
            'exportDataBtn',
            'logoutBtn',
            'darkModeBtn'
        ];
        
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`⚠️ Required element with id '${id}' not found`);
            }
        });
        
        // Check navigation buttons (analytics button is hidden)
        const navButtons = document.querySelectorAll('.nav-btn');
        if (navButtons.length === 0) {
            console.warn('⚠️ No navigation buttons found');
        }
        
        // Check sections (analytics section is hidden)
        const sections = document.querySelectorAll('.admin-section');
        if (sections.length === 0) {
            console.warn('⚠️ No admin sections found');
        }
    }

    setupEventListeners() {
        // Admin login form
        document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleAdminLogin();
        });

        // Navigation
        document.querySelectorAll(".nav-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const section = e.target.dataset.section;
                if (section) {
                    this.showSection(section);
                }
            });
        });

        // Refresh data
        document.getElementById("refreshDataBtn").addEventListener("click", () => {
            this.loadData();
        });

        // Export data
        document.getElementById("exportDataBtn").addEventListener("click", () => {
            this.exportData();
        });

        // Logout
        document.getElementById("logoutBtn").addEventListener("click", () => {
            this.logout();
        });

        // Team search
        document.getElementById("teamSearch").addEventListener("input", (e) => {
            this.filterTeams(e.target.value);
        });

        // Status filter
        document.getElementById("statusFilter").addEventListener("change", (e) => {
            this.filterTeamsByStatus(e.target.value);
        });

        // Leaderboard filters
        document.querySelectorAll(".filter-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
                this.filterLeaderboard(e.target.dataset.filter);
            });
        });

        // Scenario decisions are now handled by event delegation above

        // Modal close
        document.querySelectorAll(".modal-close").forEach(btn => {
            btn.addEventListener("click", () => {
                this.closeModals();
            });
        });

        // Click outside modal to close
        document.querySelectorAll(".modal").forEach(modal => {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) {
                    this.closeModals();
                }
            });
        });

        // Dark mode toggle (if exists)
        const darkModeBtn = document.getElementById("darkModeBtn");
        if (darkModeBtn) {
            darkModeBtn.addEventListener("click", () => {
                this.toggleDarkMode();
            });
        }

        // Game control buttons
        const startGameAllBtn = document.getElementById("startGameAllBtn");
        if (startGameAllBtn) {
            startGameAllBtn.addEventListener("click", () => {
                this.startGameForAllTeams();
            });
        }

        const nextScenarioAllBtn = document.getElementById("nextScenarioAllBtn");
        if (nextScenarioAllBtn) {
            nextScenarioAllBtn.addEventListener("click", () => {
                this.nextScenarioForAllTeams();
            });
        }

        const endGameAllBtn = document.getElementById("endGameAllBtn");
        if (endGameAllBtn) {
            endGameAllBtn.addEventListener("click", () => {
                this.endGameForAllTeams();
            });
        }

        const resetGameAllBtn = document.getElementById("resetGameAllBtn");
        if (resetGameAllBtn) {
            resetGameAllBtn.addEventListener("click", () => {
                this.resetGameForAllTeams();
            });
        }

        const refreshTeamsBtn = document.getElementById("refreshTeamsBtn");
        if (refreshTeamsBtn) {
            refreshTeamsBtn.addEventListener("click", () => {
                this.forceCheckCompletedTeams();
                this.showNotification('Team status refreshed', 'info');
            });
        }

        // Event delegation for dynamically created buttons
        document.addEventListener("click", (e) => {
            if (e.target.closest(".view-team-btn")) {
                const teamId = e.target.closest(".view-team-btn").dataset.teamId;
                console.log("View team details clicked for team:", teamId);
                this.viewTeamDetails(parseInt(teamId));
            }
            
            if (e.target.closest(".view-scenario-decisions")) {
                const position = e.target.closest(".scenario-card").dataset.position;
                console.log("View scenario decisions clicked for position:", position);
                this.showScenarioDecisions(parseInt(position));
            }

            if (e.target.closest(".kick-team-btn")) {
                const teamId = e.target.closest(".kick-team-btn").dataset.teamId;
                console.log("Kick team clicked for team:", teamId);
                this.kickTeam(parseInt(teamId));
            }
        });

        // Game settings - save time limit
        const saveTimeLimitBtn = document.getElementById("saveTimeLimitBtn");
        if (saveTimeLimitBtn) {
            saveTimeLimitBtn.addEventListener("click", () => {
                this.saveTimeLimit();
            });
        }

        // Enter key support for time limit input
        const answerTimeLimitInput = document.getElementById("answerTimeLimit");
        if (answerTimeLimitInput) {
            answerTimeLimitInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    this.saveTimeLimit();
                }
            });
        }
    }

    async loadData() {
        this.showLoading(true);
        
        try {
            // Load all data in parallel
            const [teamsResponse, statsResponse, leaderboardResponse, settingsResponse] = await Promise.all([
                this.apiRequest("/admin/teams"),
                this.apiRequest("/admin/stats"),
                this.apiRequest("/admin/leaderboard"),
                this.apiRequest("/admin/game-settings")
            ]);

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

            // Update UI
            this.updateOverview();
            this.updateTeamsTable();
            this.updateLeaderboard();
            this.updateScenarioStats();
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
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('🔌 Admin connected to server');
            this.socket.emit('admin-join');
            this.showNotification('Connected to server', 'success');
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Admin disconnected from server');
        });

        // Listen for team connections
        this.socket.on('connected-teams', (teams) => {
            console.log('👥 Received connected teams:', teams);
            this.connectedTeams.clear();
            teams.forEach(team => {
                this.connectedTeams.set(team.teamId, team);
            });
            this.updateConnectedTeamsCount();
            this.updateRealTimeMonitoring();
            this.updateGameControlButtons();
            
            // Check which teams have already completed current step
            this.checkTeamsCompletedCurrentStep();
        });

        this.socket.on('team-connected', (data) => {
            console.log('👥 Team connected:', data);
            this.connectedTeams.set(data.teamId, data);
            this.updateConnectedTeamsCount();
            this.updateRealTimeMonitoring();
            this.updateGameControlButtons();
            this.showNotification(`Team ${data.teamName} connected`, 'info');
            
            // Check if this team has already completed current step
            this.checkTeamsCompletedCurrentStep();
        });

        this.socket.on('team-disconnected', (data) => {
            console.log('👥 Team disconnected:', data);
            this.connectedTeams.delete(data.teamId);
            this.teamsCompletedCurrentStep.delete(data.teamId);
            this.updateConnectedTeamsCount();
            this.updateRealTimeMonitoring();
            this.updateGameControlButtons();
            
            // Different notification based on reason
            const reason = data.reason || 'disconnected';
            const message = reason === 'logout' ? 
                `Team ${data.teamName} logged out` : 
                `Team ${data.teamName} disconnected`;
            this.showNotification(message, 'warning');
        });

        // Listen for team progress updates
        this.socket.on('team-progress-update', (data) => {
            console.log('📊 Team progress update:', data);
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
                console.log(`✅ Team ${data.teamName} completed step ${this.currentStep}, total completed: ${this.teamsCompletedCurrentStep.size}`);
            }
            
            this.updateRealTimeMonitoring();
            this.updateGameControlButtons();
        });

        this.socket.on('team-decision-submitted', (data) => {
            console.log('📝 Team decision submitted:', data);
            
            // Update team data in connectedTeams
            if (this.connectedTeams.has(data.teamId)) {
                const teamData = this.connectedTeams.get(data.teamId);
                teamData.position = data.position;
                teamData.score = data.score;
                this.connectedTeams.set(data.teamId, teamData);
            }
            
            this.updateRealTimeMonitoring();
            this.showNotification(`Team ${data.teamName} submitted decision for position ${data.position}`, 'success');
        });

        // Listen for game status updates
        this.socket.on('game-started', () => {
            console.log('🎮 Game started for all teams');
            this.gameState = 'running';
            this.currentStep = 1;
            this.teamsCompletedCurrentStep.clear();
            this.saveAdminState();
            this.updateGameStatus('Running');
            this.updateGameControlButtons();
            this.showNotification('Game started for all teams', 'success');
        });

        this.socket.on('scenario-advanced', () => {
            console.log('➡️ Scenario advanced for all teams');
            this.currentStep++;
            this.teamsCompletedCurrentStep.clear();
            this.saveAdminState();
            this.updateGameControlButtons();
            this.showNotification('Advanced to next scenario for all teams', 'info');
        });

        this.socket.on('game-ended', () => {
            console.log('🏁 Game ended for all teams');
            this.updateGameStatus('Ended');
            this.updateGameControlButtons();
            this.showNotification('Game ended for all teams', 'warning');
        });

        this.socket.on('game-reset', () => {
            console.log('🔄 Game reset for all teams');
            // Reset game state and current step
            this.gameState = 'waiting';
            this.currentStep = 0;
            this.teamsCompletedCurrentStep.clear();
            this.saveAdminState();
            this.updateGameStatus('Reset Complete');
            this.updateGameControlButtons();
            this.showNotification('Game reset for all teams', 'success');
        });

        // Listen for game state updates from server
        this.socket.on('game-state-update', (data) => {
            console.log('🔄 Game state update from server:', data);
            const oldGameState = this.gameState;
            this.gameState = data.gameState || 'waiting';
            this.currentStep = data.currentStep || 0;
            this.updateGameStatus(this.getGameStatusText(this.gameState));
            this.updateGameControlButtons();
            
            // Show notification if game state was reset (server restart)
            if (oldGameState !== this.gameState && this.gameState === 'waiting') {
                this.showNotification('Server restarted - Game state reset to waiting', 'info');
            }
        });
    }

    // Game Control Methods
    startGameForAllTeams() {
        if (this.socket) {
            this.gameState = 'running';
            this.teamsCompletedCurrentStep.clear();
            this.saveAdminState();
            this.socket.emit('start-game-all');
            this.updateGameStatus('Starting...');
            this.updateGameControlButtons();
        }
    }

    nextScenarioForAllTeams() {
        if (this.socket) {
            // Don't increment here - will be done in scenario-advanced handler
            // this.currentStep++;
            this.teamsCompletedCurrentStep.clear();
            this.saveAdminState();
            this.socket.emit('next-scenario-all');
            this.updateGameControlButtons();
            
            // Check completed teams after advancing step
            setTimeout(() => {
                this.forceCheckCompletedTeams();
            }, 1000);
        }
    }

    endGameForAllTeams() {
        if (this.socket) {
            this.gameState = 'ended';
            this.saveAdminState();
            this.socket.emit('end-game-all');
            this.updateGameStatus('Ending...');
            this.updateGameControlButtons();
        }
    }

    async resetGameForAllTeams() {
        if (confirm('Are you sure you want to reset the game for all teams? This will clear all progress and decisions.')) {
            try {
                this.showLoading(true);
                this.updateGameStatus('Resetting...');
                
                const response = await fetch(`${this.apiBase}/admin/reset-game`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                const data = await response.json();

                if (data.success) {
                    // Reset admin state
                    this.gameState = 'waiting';
                    this.teamsCompletedCurrentStep.clear();
                    this.saveAdminState();
                    
                    // Emit reset command to all teams via WebSocket
                    if (this.socket) {
                        this.socket.emit('reset-game-all');
                    }
                    
                    this.updateGameStatus('Reset Complete');
                    this.updateGameControlButtons();
                    this.showNotification('Game reset successfully for all teams', 'success');
                    
                    // Refresh data
                    await this.loadData();
                } else {
                    this.showNotification(data.message || 'Failed to reset game', 'error');
                }
            } catch (error) {
                console.error('Reset game error:', error);
                this.showNotification('Failed to reset game', 'error');
            } finally {
                this.showLoading(false);
            }
        }
    }

    kickTeam(teamId) {
        if (this.socket && confirm('Are you sure you want to kick this team? This will remove them from the game and they will need to rejoin.')) {
            this.socket.emit('kick-team', { teamId });
            this.showNotification('Team kicked from game', 'warning');
            
            // Remove team from connected teams immediately
            this.connectedTeams.delete(teamId);
            this.updateConnectedTeamsCount();
            this.updateRealTimeMonitoring();
        }
    }

    updateGameStatus(status) {
        const statusElement = document.getElementById('gameStatus');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `status-value ${status.toLowerCase().replace(' ', '-')}`;
        }
    }

    getGameStatusText(gameState) {
        const statusMap = {
            'waiting': 'Waiting',
            'running': 'Running',
            'ended': 'Ended'
        };
        return statusMap[gameState] || 'Unknown';
    }

    updateConnectedTeamsCount() {
        const countElement = document.getElementById('connectedTeamsCount');
        if (countElement) {
            countElement.textContent = this.connectedTeams.size;
        }
    }

    updateGameControlButtons() {
        const startBtn = document.getElementById('startGameAllBtn');
        const nextBtn = document.getElementById('nextScenarioAllBtn');
        const endBtn = document.getElementById('endGameAllBtn');
        const resetBtn = document.getElementById('resetGameAllBtn');

        if (startBtn) {
            if (this.gameState === 'waiting') {
                startBtn.style.display = 'block';
                startBtn.disabled = false;
                startBtn.textContent = '🎮 Mulai Permainan';
            } else if (this.gameState === 'running') {
                startBtn.style.display = 'none';
            } else if (this.gameState === 'ended') {
                startBtn.style.display = 'block';
                startBtn.disabled = true;
                startBtn.textContent = '🏁 Permainan Selesai';
            }
        }

        if (nextBtn) {
            if (this.gameState === 'running') {
                // Check if all CONNECTED teams completed current step
                // If no teams are connected, allow admin to proceed
                const allConnectedTeamsCompleted = this.connectedTeams.size === 0 || 
                    this.teamsCompletedCurrentStep.size >= this.connectedTeams.size;
                
                nextBtn.style.display = 'block';
                nextBtn.disabled = false;
                
                nextBtn.textContent = '➡️ Lanjut ke Step Berikutnya';
                // if (this.connectedTeams.size === 0) {
                //     nextBtn.textContent = '➡️ Lanjut ke Step Berikutnya (Tidak ada tim yang terhubung)';
                // } else {
                //     nextBtn.textContent = allConnectedTeamsCompleted ? 
                //         '➡️ Lanjut ke Step Berikutnya' : 
                //         `⏳ Menunggu Tim (${this.teamsCompletedCurrentStep.size}/${this.connectedTeams.size})`;
                // }
                
                console.log(`🎯 Step completion: ${this.teamsCompletedCurrentStep.size}/${this.connectedTeams.size} teams completed`);
            } else {
                nextBtn.style.display = 'none';
            }
        }

        if (endBtn) {
            if (this.gameState === 'running' || this.gameState === 'waiting') {
                endBtn.style.display = 'block';
                endBtn.disabled = false;
            } else {
                endBtn.style.display = 'none';
            }
        }

        if (resetBtn) {
            // Reset button is always available
            resetBtn.style.display = 'block';
            resetBtn.disabled = false;
        }
    }

    updateRealTimeMonitoring() {
        const container = document.getElementById('teamsMonitoringList');
        if (!container) return;

        container.innerHTML = '';
        
        // Show all connected teams with their current data
        this.connectedTeams.forEach((team, teamId) => {
            // Use team data directly, not progress data
            const position = team.position || 1;
            const score = team.score || 0;
            const isCompleted = team.isCompleted || false;
            
            const teamCard = document.createElement('div');
            teamCard.className = 'team-monitoring-card';
            teamCard.innerHTML = `
                <div class="team-info">
                    <h4>${team.teamName || 'Unknown Team'}</h4>
                    <div class="team-stats">
                        <span class="stat">Position: ${position}/7</span>
                        <span class="stat">Score: ${score}</span>
                        <span class="stat ${isCompleted ? 'completed' : 'active'}">
                            ${isCompleted ? 'Completed' : 'Active'}
                        </span>
                        <span class="stat connected">🟢 Connected</span>
                    </div>
                </div>
                <div class="team-actions">
                    <button class="btn btn-outline btn-sm kick-team-btn" data-team-id="${teamId}">
                        <i class="fas fa-user-times"></i> Kick
                    </button>
                </div>
            `;
            container.appendChild(teamCard);
        });
        
        // Show message if no teams are connected
        if (this.connectedTeams.size === 0) {
            const noTeamsCard = document.createElement('div');
            noTeamsCard.className = 'team-monitoring-card no-teams';
            noTeamsCard.innerHTML = `
                <div class="team-info">
                    <h4>⚠️ Tidak ada tim yang terhubung</h4>
                    <div class="team-stats">
                        <span class="stat">Semua tim telah logout atau disconnect</span>
                    </div>
                </div>
            `;
            container.appendChild(noTeamsCard);
        }
    }

    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`;
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

            if (!response.ok) {
                throw new Error(data.message || "Request failed");
            }

            return data;
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    }

    async showSection(sectionName) {
        // Update navigation
        document.querySelectorAll(".nav-btn").forEach(btn => {
            btn.classList.remove("active");
        });
        
        const navBtn = document.querySelector(`[data-section="${sectionName}"]`);
        if (navBtn) {
            navBtn.classList.add("active");
        }

        // Update content
        document.querySelectorAll(".admin-section").forEach(section => {
            section.classList.remove("active");
        });
        
        const section = document.getElementById(`${sectionName}-section`);
        if (section) {
            section.classList.add("active");
        }

        this.currentSection = sectionName;
        this.saveAdminState();

        // Load section-specific data
        if (sectionName === "game-control") {
            // Update real-time monitoring when switching to game control
            this.updateRealTimeMonitoring();
            this.updateGameControlButtons();
        } else if (sectionName === "game-settings") {
            // Load game settings if not already loaded
            if (!this.gameSettings || Object.keys(this.gameSettings).length === 0) {
                this.loadGameSettings();
            } else {
                this.updateGameSettingsUI();
            }
        }
        // Analytics section is hidden - no need to load
        if (sectionName === "analytics") {
            this.loadAnalytics();
        }
    }

    updateOverview() {
        // Update stats cards
        document.getElementById("totalTeams").textContent = this.statsData.totalTeams || 0;
        document.getElementById("activeTeams").textContent = this.statsData.activeTeams || 0;
        document.getElementById("completedTeams").textContent = this.statsData.completedTeams || 0;
        document.getElementById("averageScore").textContent = 
            this.statsData.averageScore ? Math.round(this.statsData.averageScore) : 0;

        // Update scenario stats
        this.updateScenarioStatsList();
    }

    updateScenarioStatsList() {
        const container = document.getElementById("scenarioStatsList");
        container.innerHTML = "";

        if (this.statsData.scenarioStats) {
            this.statsData.scenarioStats.forEach(stat => {
                const item = document.createElement("div");
                item.className = "scenario-stat-item";
                item.innerHTML = `
                    <h4>${stat.title}</h4>
                    <div class="stat-row">
                        <span>Completions:</span>
                        <span>${stat.completion_count || 0}</span>
                    </div>
                    <div class="stat-row">
                        <span>Avg Score:</span>
                        <span>${stat.average_score ? Math.round(stat.average_score) : 0}</span>
                    </div>
                    <div class="stat-row">
                        <span>Max Score:</span>
                        <span>${stat.max_score || 0}</span>
                    </div>
                `;
                container.appendChild(item);
            });
        }
    }

    updateTeamsTable() {
        const tbody = document.getElementById("teamsTableBody");
        tbody.innerHTML = "";

        this.teamsData.forEach((team, index) => {
            const row = document.createElement("tr");
            const status = this.getTeamStatus(team);
            const statusClass = this.getTeamStatusClass(status);
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>
                    <strong>${team.team_name}</strong>
                    <br>
                    <small class="text-muted">${team.players || "No players"}</small>
                </td>
                <td>${team.player_count}</td>
                <td>${team.current_position}/7</td>
                <td><strong>${team.total_score}</strong></td>
                <td><span class="team-status ${statusClass}">${status}</span></td>
                <td>
                    <button class="btn btn-primary btn-sm view-team-btn" data-team-id="${team.id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    updateLeaderboard() {
        const tbody = document.getElementById("leaderboardTableBody");
        tbody.innerHTML = "";

        this.leaderboardData.forEach((team, index) => {
            const row = document.createElement("tr");
            const rankClass = this.getRankClass(index + 1);
            
            row.innerHTML = `
                <td>
                    <div class="rank-badge ${rankClass}">${index + 1}</div>
                </td>
                <td><strong>${team.team_name}</strong></td>
                <td><strong>${team.total_score}</strong></td>
                <td>${team.current_position}/7</td>
                <td>${team.player_count}</td>
                <td>${team.completed_scenarios || 0}</td>
                <td>${team.average_score ? Math.round(team.average_score) : 0}</td>
                <td>${this.formatDate(team.last_activity)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    updateScenarioStats() {
        // Update scenario cards with stats
        if (this.statsData.scenarioStats) {
            this.statsData.scenarioStats.forEach(stat => {
                const completionsEl = document.getElementById(`scenario-${stat.position}-completions`);
                const avgEl = document.getElementById(`scenario-${stat.position}-avg`);
                
                if (completionsEl) completionsEl.textContent = stat.completion_count || 0;
                if (avgEl) avgEl.textContent = stat.average_score ? Math.round(stat.average_score) : 0;
            });
        }
    }

    async viewTeamDetails(teamId) {
        try {
            this.showLoading(true);
            const response = await this.apiRequest(`/admin/teams/${teamId}`);
            this.showTeamDetailsModal(response.data);
        } catch (error) {
            this.showNotification("Failed to load team details: " + error.message, "error");
        } finally {
            this.showLoading(false);
        }
    }

    showTeamDetailsModal(data) {
        const modal = document.getElementById("teamDetailsModal");
        const title = document.getElementById("teamDetailsTitle");
        const content = document.getElementById("teamDetailsContent");

        title.textContent = `Team: ${data.team.name}`;

        content.innerHTML = `
            <div class="team-info">
                <h4>Team Information</h4>
                <p><strong>Name:</strong> ${data.team.name}</p>
                <p><strong>Current Position:</strong> ${data.team.current_position}/7</p>
                <p><strong>Total Score:</strong> ${data.team.total_score}</p>
                <p><strong>Created:</strong> ${this.formatDate(data.team.created_at)}</p>
            </div>

            <div class="team-players">
                <h4>Players (${data.players.length})</h4>
                <div class="player-list">
                    ${data.players.map(player => 
                        `<span class="player-tag">${player.name}</span>`
                    ).join("")}
                </div>
            </div>

            <div class="team-decisions">
                <h4>Decisions (${data.decisions.length})</h4>
                ${data.decisions.map(decision => `
                    <div class="decision-item">
                        <div class="decision-header">
                            <span class="decision-position">Position ${decision.position}: ${decision.scenario_title}</span>
                            <span class="decision-score">${decision.score} points</span>
                        </div>
                        <div class="decision-content">
                            <h5>Team Decision:</h5>
                            <p>${decision.decision}</p>
                        </div>
                        <div class="decision-content">
                            <h5>Team Reasoning:</h5>
                            <p>${decision.reasoning}</p>
                        </div>
                        <div class="decision-content">
                            <h5>Standard Answer:</h5>
                            <p>${decision.standard_answer}</p>
                        </div>
                        <div class="decision-content">
                            <h5>Standard Reasoning:</h5>
                            <p>${decision.standard_reasoning}</p>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;

        modal.style.display = "block";
    }

    async showScenarioDecisions(position) {
        try {
            this.showLoading(true);
            const response = await this.apiRequest(`/admin/scenarios/${position}/decisions`);
            this.showScenarioDecisionsModal(response.data);
        } catch (error) {
            this.showNotification("Failed to load scenario decisions: " + error.message, "error");
        } finally {
            this.showLoading(false);
        }
    }

    showScenarioDecisionsModal(data) {
        const modal = document.getElementById("scenarioDecisionsModal");
        const title = document.getElementById("scenarioDecisionsTitle");
        const content = document.getElementById("scenarioDecisionsContent");

        title.textContent = `Scenario ${data.scenario.position}: ${data.scenario.title}`;

        content.innerHTML = `
            <div class="scenario-info">
                <h4>Scenario Information</h4>
                <p><strong>Title:</strong> ${data.scenario.title}</p>
                <p><strong>Position:</strong> ${data.scenario.position}/7</p>
                <p><strong>Description:</strong> ${data.scenario.scenario_text}</p>
            </div>

            <div class="decisions-list">
                <h4>Team Decisions (${data.decisions.length})</h4>
                ${data.decisions.map(decision => `
                    <div class="decision-card">
                        <div class="decision-card-header">
                            <span class="decision-team">${decision.team_name}</span>
                            <span class="decision-score-badge">${decision.score} points</span>
                        </div>
                        <div class="decision-content-section">
                            <h5>Team Decision:</h5>
                            <p>${decision.decision}</p>
                        </div>
                        <div class="decision-content-section">
                            <h5>Team Reasoning:</h5>
                            <p>${decision.reasoning}</p>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;

        modal.style.display = "block";
    }

    filterTeams(searchTerm) {
        const rows = document.querySelectorAll("#teamsTableBody tr");
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const teamName = row.cells[1].textContent.toLowerCase();
            const players = row.cells[1].textContent.toLowerCase();
            
            if (teamName.includes(term) || players.includes(term)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    }

    filterTeamsByStatus(status) {
        const rows = document.querySelectorAll("#teamsTableBody tr");
        
        rows.forEach(row => {
            const statusCell = row.cells[5];
            const teamStatus = statusCell.textContent.toLowerCase().trim();
            
            if (status === "all" || teamStatus === status) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    }

    filterLeaderboard(filter) {
        const rows = document.querySelectorAll("#leaderboardTableBody tr");
        
        rows.forEach(row => {
            const position = parseInt(row.cells[3].textContent.split("/")[0]);
            
            if (filter === "all") {
                row.style.display = "";
            } else if (filter === "completed" && position > 7) {
                row.style.display = "";
            } else if (filter === "active" && position <= 7) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
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
                a.download = `teams_export_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }

            // Export decisions data
            const decisionsResponse = await fetch(`${this.apiBase}/admin/export/decisions`, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (decisionsResponse.ok) {
                const blob = await decisionsResponse.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `decisions_export_${new Date().toISOString().split('T')[0]}.csv`;
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

    getTeamStatus(team) {
        if (team.current_position > 7) return "completed";
        if (team.current_position > 1) return "active";
        return "inactive";
    }

    getTeamStatusClass(status) {
        const classes = {
            "completed": "completed",
            "active": "active",
            "inactive": "inactive"
        };
        return classes[status] || "inactive";
    }

    getRankClass(rank) {
        if (rank === 1) return "rank-1";
        if (rank === 2) return "rank-2";
        if (rank === 3) return "rank-3";
        return "rank-other";
    }

    formatDate(dateString) {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return date.toLocaleDateString("id-ID", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    showLoading(show) {
        const overlay = document.getElementById("loadingOverlay");
        if (show) {
            overlay.classList.add("show");
        } else {
            overlay.classList.remove("show");
        }
    }

    closeModals() {
        document.querySelectorAll(".modal").forEach(modal => {
            modal.style.display = "none";
        });
    }

    showNotification(message, type = "info") {
        const notification = document.getElementById("notification");
        const icon = notification.querySelector(".notification-icon");
        const messageEl = notification.querySelector(".notification-message");

        const icons = {
            success: "fas fa-check-circle",
            error: "fas fa-exclamation-circle",
            warning: "fas fa-exclamation-triangle",
            info: "fas fa-info-circle",
        };

        icon.className = `notification-icon ${icons[type] || icons.info}`;
        messageEl.textContent = message;

        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove("show");
        }, 5000);
    }

    async handleAdminLogin() {
        const formData = new FormData(document.getElementById("adminLoginForm"));
        const data = {
            username: formData.get("username"),
            password: formData.get("password")
        };

        try {
            this.showLoading(true);
            const response = await this.apiRequest("/admin/login", {
                method: "POST",
                body: JSON.stringify(data)
            });

            this.token = response.data.token;
            localStorage.setItem("tuna_token", this.token);
            
            this.showAdminPanel();
            this.showNotification("Admin login successful!", "success");
        } catch (error) {
            this.showNotification("Login failed: " + error.message, "error");
        } finally {
            this.showLoading(false);
        }
    }

    showLoginScreen() {
        document.getElementById("admin-login-screen").style.display = "flex";
        document.getElementById("admin-panel-content").style.display = "none";
    }

    showAdminPanel() {
        document.getElementById("admin-login-screen").style.display = "none";
        document.getElementById("admin-panel-content").style.display = "block";
        
        // Load data
        this.loadData();
        
        // Don't force show overview - let the restored section be shown
        // The restored section will be shown by the init() method
    }

    logout() {
        this.token = null;
        localStorage.removeItem("tuna_token");
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
        localStorage.setItem("tuna_theme", newTheme);

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
        this.showNotification(
            `Switched to ${themeName} Mode`,
            "info"
        );
    }

    initDarkMode() {
        const savedTheme = localStorage.getItem("tuna_theme") || "light";
        document.documentElement.setAttribute("data-theme", savedTheme);

        // Update icon based on saved theme
        const icon = document.getElementById("darkModeIcon");
        const toggleBtn = document.getElementById("darkModeBtn");
        
        if (icon && toggleBtn) {
            icon.className = savedTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
            toggleBtn.title = `Switch to ${savedTheme === "dark" ? "Light" : "Dark"} Mode`;
        }
    }

    // Admin state persistence methods
    saveAdminState() {
        const adminState = {
            currentSection: this.currentSection,
            gameState: this.gameState,
            currentStep: this.currentStep,
            teamsCompletedCurrentStep: Array.from(this.teamsCompletedCurrentStep)
        };
        localStorage.setItem("tuna_admin_state", JSON.stringify(adminState));
    }

    restoreAdminState() {
        try {
            const savedState = localStorage.getItem("tuna_admin_state");
            if (savedState) {
                const adminState = JSON.parse(savedState);
                this.currentSection = adminState.currentSection || "overview";
                
                // Restore game state from localStorage to maintain UI state
                this.gameState = adminState.gameState || 'waiting';
                this.currentStep = adminState.currentStep || 0;
                this.teamsCompletedCurrentStep = new Set(adminState.teamsCompletedCurrentStep || []);
                
                console.log(`🔄 Admin state restored - section: ${this.currentSection}, gameState: ${this.gameState}, step: ${this.currentStep}`);
                return true;
            }
        } catch (error) {
            console.error("Error restoring admin state:", error);
        }
        return false;
    }

    clearAdminState() {
        localStorage.removeItem("tuna_admin_state");
    }

    // Check which teams have already completed current step based on database
    async checkTeamsCompletedCurrentStep() {
        if (this.gameState !== 'running' || this.connectedTeams.size === 0) {
            return;
        }

        try {
            console.log(`🔍 Checking completed teams for step ${this.currentStep}`);
            
            // Get all teams data to check their progress
            const response = await this.apiRequest('/admin/teams');
            if (response.success) {
                const teamsData = response.data;
                
                // Clear current completed teams set
                this.teamsCompletedCurrentStep.clear();
                
                // Check each connected team
                for (const [teamId, connectedTeam] of this.connectedTeams) {
                    const teamData = teamsData.find(t => t.id == teamId);
                    if (teamData) {
                        // A team is considered completed if they have submitted decisions
                        // and their current position is greater than the current step
                        if (teamData.current_position > this.currentStep) {
                            this.teamsCompletedCurrentStep.add(teamId);
                            console.log(`✅ Team ${teamData.team_name} already completed step ${this.currentStep} (position: ${teamData.current_position})`);
                        } else if (teamData.current_position === this.currentStep) {
                            // Check if team has submitted decision for current step
                            console.log(`🔍 Team ${teamData.team_name} is at step ${this.currentStep}, checking if they submitted decision`);
                            const hasSubmitted = await this.checkTeamDecisionForCurrentStep(teamId);
                            if (hasSubmitted) {
                                this.teamsCompletedCurrentStep.add(teamId);
                                console.log(`✅ Team ${teamData.team_name} has submitted decision for step ${this.currentStep}`);
                            }
                        }
                    }
                }
                
                console.log(`📊 Found ${this.teamsCompletedCurrentStep.size} teams already completed step ${this.currentStep}`);
                this.updateGameControlButtons();
            }
        } catch (error) {
            console.error('❌ Error checking completed teams:', error);
        }
    }

    // Force check completed teams (called when admin needs to refresh)
    async forceCheckCompletedTeams() {
        console.log('🔄 Force checking completed teams...');
        await this.checkTeamsCompletedCurrentStep();
    }

    // Check if team has submitted decision for current step
    async checkTeamDecisionForCurrentStep(teamId) {
        try {
            const response = await this.apiRequest(`/admin/teams/${teamId}`);
            if (response.success) {
                const teamData = response.data;
                const hasDecisionForCurrentStep = teamData.decisions.some(decision => 
                    decision.position === this.currentStep
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
            const response = await this.apiRequest("/admin/game-settings");
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
        const answerTimeLimitInput = document.getElementById("answerTimeLimit");
        const timeLimitStatus = document.getElementById("timeLimitStatus");
        
        if (!answerTimeLimitInput) return;
        
        // Update input with current setting value
        if (this.gameSettings && this.gameSettings.answer_time_limit) {
            const timeLimitSeconds = parseInt(this.gameSettings.answer_time_limit.value);
            const timeLimitMinutes = Math.floor(timeLimitSeconds / 60);
            answerTimeLimitInput.value = timeLimitMinutes;
            
            // Show last updated info
            if (timeLimitStatus && this.gameSettings.answer_time_limit.updated_at) {
                const updatedDate = new Date(this.gameSettings.answer_time_limit.updated_at);
                timeLimitStatus.innerHTML = `
                    <i class="fas fa-check-circle"></i> 
                    Terakhir diupdate: ${updatedDate.toLocaleString('id-ID')}
                `;
                timeLimitStatus.className = "setting-status success";
                timeLimitStatus.style.display = "block";
            }
        } else {
            // Default to 15 minutes if no setting found
            answerTimeLimitInput.value = 15;
        }
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
            const response = await this.apiRequest("/admin/game-settings", {
                method: "PUT",
                body: JSON.stringify({
                    settings: {
                        answer_time_limit: seconds
                    }
                })
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
                
                this.showNotification(`Waktu game berhasil diubah menjadi ${minutes} menit`, "success");
                
                // Hide status after 3 seconds
                setTimeout(() => {
                    if (this.gameSettings && this.gameSettings.answer_time_limit && this.gameSettings.answer_time_limit.updated_at) {
                        const updatedDate = new Date(this.gameSettings.answer_time_limit.updated_at);
                        timeLimitStatus.innerHTML = `
                            <i class="fas fa-check-circle"></i> 
                            Terakhir diupdate: ${updatedDate.toLocaleString('id-ID')}
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
}

// Initialize admin panel when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    console.log("🔧 DOM loaded, initializing admin panel...");
    window.adminPanel = new AdminPanel();
});
