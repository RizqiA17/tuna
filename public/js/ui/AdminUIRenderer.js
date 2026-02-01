import { formatDate } from "../utils/helpers.js";
export class AdminUIRenderer {
    constructor(adminInstance) {
        this.admin = adminInstance;
    }

    // Overview and stats updates
    updateOverview() {
        // Update stats cards
        document.getElementById("totalTeams").textContent =
            this.admin.statsData.totalTeams || 0;
        document.getElementById("activeTeams").textContent =
            this.admin.statsData.activeTeams || 0;
        document.getElementById("completedTeams").textContent =
            this.admin.statsData.completedTeams || 0;
        document.getElementById("averageScore").textContent = this.admin.statsData
            .averageScore
            ? Math.round(this.admin.statsData.averageScore)
            : 0;

        // Update scenario stats
        this.updateScenarioStatsList();
    }

    updateScenarioStatsList() {
        const container = document.getElementById("scenarioStatsList");
        container.innerHTML = "";

        if (this.admin.statsData.scenarioStats) {
            this.admin.statsData.scenarioStats.forEach((stat) => {
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
                        <span>${stat.average_score
                        ? Math.round(stat.average_score)
                        : 0
                    }</span>
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

    // Teams table updates
    updateTeamsTable() {
        const tbody = document.getElementById("teamsTableBody");
        tbody.innerHTML = "";

        this.admin.teamsData.forEach((team, index) => {
            const row = document.createElement("tr");
            const status = this.getTeamStatus(team);
            const statusClass = this.getTeamStatusClass(status);

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>
                    <strong>${team.team_name}</strong>
                    <br>
                    <small class="text-muted">${team.players || "No players"
                }</small>
                </td>
                <td>${team.player_count}</td>
                <td>${team.current_position}/7</td>
                <td><strong>${team.total_score}</strong></td>
                <td><span class="team-status ${statusClass}">${status}</span></td>
                <td>
                    <button class="btn btn-primary btn-sm view-team-btn" data-team-id="${team.id
                }">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Leaderboard updates
    updateLeaderboard() {
        const tbody = document.getElementById("leaderboardTableBody");
        tbody.innerHTML = "";

        this.admin.leaderboardData.forEach((team, index) => {
            const row = document.createElement("tr");
            const rankClass = index + 1;

            row.innerHTML = `
                <td>
                    <div class="rank-badge ${rankClass}">${index + 1}</div>
                </td>
                <td><strong>${team.team_name}</strong></td>
                <td><strong>${team.total_score}</strong></td>
                <td>${team.current_position}/7</td>
                <td>${team.player_count}</td>
                <td>${team.completed_scenarios || 0}</td>
                <td>${team.average_score ? Math.round(team.average_score) : 0
                }</td>
                <td>${formatDate(team.last_activity)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Scenario stats updates
    updateScenarioStats() {
        // Update scenario cards with stats
        if (this.admin.statsData.scenarioStats) {
            this.admin.statsData.scenarioStats.forEach((stat) => {
                const completionsEl = document.getElementById(
                    `scenario-${stat.position}-completions`
                );
                const avgEl = document.getElementById(`scenario-${stat.position}-avg`);

                if (completionsEl)
                    completionsEl.textContent = stat.completion_count || 0;
                if (avgEl)
                    avgEl.textContent = stat.average_score
                        ? Math.round(stat.average_score)
                        : 0;
            });
        }
    }

    // Real-time monitoring updates
    async updateRealTimeMonitoring() {
        const container = document.getElementById("teamsMonitoringList");
        if (!container) return;

        container.innerHTML = "";

        // Show all connected teams with their current data
        for (const [teamId, team] of this.admin.connectedTeams) {
            const response = await this.admin.apiService.request(`/admin/teams/${teamId}`);
            console.log(response);

            const position = Math.min(response?.data?.team?.current_position ?? 0, 7);
            const score = response.data.team.total_score || 0;
            const isCompleted = response.data.team.current_position > 7 || false;

            const oldCard = container.querySelector(`[data-team-id="${teamId}"]`);

            const cardHTML = `
          <div class="team-info">
              <h4>${team.teamName || "Unknown Team"}</h4>
              <div class="team-stats">
                  <span class="stat">Position: ${position}/7</span>
                  <span class="stat">Score: ${score}</span>
                  <span class="stat ${isCompleted ? "completed" : "active"}">
                      ${isCompleted ? "Completed" : "Active"}
                  </span>
                  <span class="stat connected">Connected</span>
              </div>
          </div>
          <div class="team-actions">
              <button class="btn btn-outline btn-sm kick-team-btn" data-team-id="${teamId}">
                  <i class="fas fa-user-times"></i> Kick
              </button>
          </div>
      `;

            // Jika sudah ada card → update
            if (oldCard) {
                oldCard.innerHTML = cardHTML;
            }
            // Jika belum ada → buat baru
            else {
                const teamCard = document.createElement("div");
                teamCard.setAttribute("data-team-id", teamId);
                teamCard.className = "team-monitoring-card";
                teamCard.innerHTML = cardHTML;
                container.appendChild(teamCard);
            }

        }


        // Show message if no teams are connected
        if (this.admin.connectedTeams.size === 0) {
            const noTeamsCard = document.createElement("div");
            noTeamsCard.className = "team-monitoring-card no-teams";
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

    // Game control UI updates
    updateGameStatus(status) {
        const statusElement = document.getElementById("gameStatus");
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `status-value ${status
                .toLowerCase()
                .replace(" ", "-")}`;
        }
    }

    updateConnectedTeamsCount() {
        const countElement = document.getElementById("connectedTeamsCount");
        if (countElement) {
            countElement.textContent = this.admin.connectedTeams.size;
        }
    }

    updateTeamCompleted() {
        const teamCompleted = document.getElementById("teamCompleted");
        if (teamCompleted) {
            teamCompleted.textContent = `${this.admin.teamsCompletedCurrentStep.size}/${this.admin.connectedTeams.size}`;
        }
    }

    updatePosition() {
        const positionElement = document.getElementById("currentPosition");
        if (positionElement) {
            positionElement.textContent = this.admin.currentStep;
        }
    }

    updateGameControlButtons() {
        // const startBtn = document.getElementById("startGameAllBtn");
        // const nextBtn = document.getElementById("nextScenarioAllBtn");
        // const endBtn = document.getElementById("endGameAllBtn");
        const resetBtn = document.getElementById("resetGameAllBtn");

        // if (startBtn) {
        //     if (this.admin.gameState === "waiting") {
        //         startBtn.style.display = "block";
        //         startBtn.disabled = false;
        //         startBtn.textContent = "🎮 Mulai Permainan";
        //     } else if (this.admin.gameState === "running") {
        //         startBtn.style.display = "none";
        //     }
        // }


        // if (nextBtn) {
        //     if (this.admin.gameState === "running") {
        //         // Check if all CONNECTED teams completed current step
        //         // If no teams are connected, allow admin to proceed
        //         const allConnectedTeamsCompleted =
        //             this.admin.connectedTeams.size === 0 ||
        //             this.admin.teamsCompletedCurrentStep.size >= this.admin.connectedTeams.size;

        //         nextBtn.style.display = "block";
        //         nextBtn.disabled = false;

        //         nextBtn.textContent = "➡️ Lanjut ke Step Berikutnya";
        //         // if (this.admin.connectedTeams.size === 0) {
        //         //     nextBtn.textContent = '➡️ Lanjut ke Step Berikutnya (Tidak ada tim yang terhubung)';
        //         // } else {
        //         //     nextBtn.textContent = allConnectedTeamsCompleted ?
        //         //         '➡️ Lanjut ke Step Berikutnya' :
        //         //         `⏳ Menunggu Tim (${this.admin.teamsCompletedCurrentStep.size}/${this.admin.connectedTeams.size})`;
        //         // }

        //         console.log(
        //             `🎯 Step completion: ${this.admin.teamsCompletedCurrentStep.size}/${this.admin.connectedTeams.size} teams completed`
        //         );
        //     } else {
        //         nextBtn.style.display = "none";
        //     }
        // }

        // if (endBtn) {
        //     if (this.admin.gameState === "running" || this.admin.gameState === "waiting") {
        //         endBtn.style.display = "block";
        //         endBtn.disabled = false;
        //     } else {
        //         endBtn.style.display = "none";
        //     }
        // }

        if (resetBtn) {
            // Reset button is always available
            resetBtn.style.display = "block";
            resetBtn.disabled = false;
        }
    }

    // Section navigation
    async showSection(sectionName) {
        // Update navigation
        document.querySelectorAll(".nav-btn").forEach((btn) => {
            btn.classList.remove("active");
        });

        const navBtn = document.querySelector(`[data-section="${sectionName}"]`);
        if (navBtn) {
            navBtn.classList.add("active");
        }

        // Update content
        document.querySelectorAll(".admin-section").forEach((section) => {
            section.classList.remove("active");
        });

        const section = document.getElementById(`${sectionName}-section`);
        if (section) {
            section.classList.add("active");
        }

        this.admin.currentSection = sectionName;
        this.admin.saveAdminState();

        // Load section-specific data
        if (sectionName === "containers") {
            this.admin.loadContainers();
        }

        // Load section-specific data
        if (sectionName === "game-control") {
            // Update real-time monitoring when switching to game control
            this.updateRealTimeMonitoring();
            this.updateGameControlButtons();
        } else if (sectionName === "game-settings") {
            // Load game settings if not already loaded
            if (!this.admin.gameSettings || Object.keys(this.admin.gameSettings).length === 0) {
                this.admin.loadGameSettings();
            } else {
                this.updateGameSettingsUI();
            }
        }
        // Analytics section is hidden - no need to load
        if (sectionName === "analytics") {
            this.admin.loadAnalytics();
        }
    }

    // Modal display methods
    showTeamDetailsModal(data) {
        const modal = document.getElementById("teamDetailsModal");
        const title = document.getElementById("teamDetailsTitle");
        const content = document.getElementById("teamDetailsContent");

        title.textContent = `Team: ${data.team.name}`;

        content.innerHTML = `
            <div class="team-info">
                <h4>Team Information</h4>
                <p><strong>Name:</strong> ${data.team.name}</p>
                <p><strong>Current Position:</strong> ${data.team.current_position
            }/7</p>
                <p><strong>Total Score:</strong> ${data.team.total_score}</p>
                <p><strong>Created:</strong> ${formatDate(
                data.team.created_at
            )}</p>
            </div>

            <div class="team-players">
                <h4>Players (${data.players.length})</h4>
                <div class="player-list">
                    ${data.players
                .map(
                    (player) =>
                        `<span class="player-tag">${player.name}</span>`
                )
                .join("")}
                </div>
            </div>

            <div class="team-decisions">
                <h4>Decisions (${data.decisions.length})</h4>
                ${data.decisions
                .map(
                    (decision) => `
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
                `
                )
                .join("")}
            </div>
        `;

        modal.style.display = "block";
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
                <p><strong>Description:</strong> ${data.scenario.scenario_text
            }</p>
            </div>

            <div class="decisions-list">
                <h4>Team Decisions (${data.decisions.length})</h4>
                ${data.decisions
                .map(
                    (decision) => `
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
                `
                )
                .join("")}
            </div>
        `;

        modal.style.display = "block";
    }

    // Screen management
    showLoginScreen() {
        document.getElementById("admin-login-screen").style.display = "flex";
        document.getElementById("admin-panel-content").style.display = "none";
    }

    showAdminPanel() {
        document.getElementById("admin-login-screen").style.display = "none";
        document.getElementById("admin-panel-content").style.display = "block";

        // Load data
        this.admin.loadData();

        // Don't force show overview - let the restored section be shown
        // The restored section will be shown by the init() method
    }

    // Loading and notification methods
    showLoading(show) {
        const overlay = document.getElementById("loadingOverlay");
        if (show) {
            overlay.classList.add("show");
        } else {
            overlay.classList.remove("show");
        }
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

    closeModals() {
        document.querySelectorAll(".modal").forEach((modal) => {
            modal.style.display = "none";
        });
    }

    // Game settings UI
    updateGameSettingsUI() {
        const answerTimeLimitInput = document.getElementById("answerTimeLimit");
        const timeLimitStatus = document.getElementById("timeLimitStatus");

        if (!answerTimeLimitInput) return;

        // Update input with current setting value
        if (this.admin.gameSettings && this.admin.gameSettings.answer_time_limit) {
            const timeLimitSeconds = parseInt(
                this.admin.gameSettings.answer_time_limit.value
            );
            const timeLimitMinutes = Math.floor(timeLimitSeconds / 60);
            answerTimeLimitInput.value = timeLimitMinutes;

            // Show last updated info
            if (timeLimitStatus && this.admin.gameSettings.answer_time_limit.updated_at) {
                const updatedDate = new Date(
                    this.admin.gameSettings.answer_time_limit.updated_at
                );
                timeLimitStatus.innerHTML = `
                    <i class="fas fa-check-circle"></i>
                    Terakhir diupdate: ${updatedDate.toLocaleString("id-ID")}
                `;
                timeLimitStatus.className = "setting-status success";
                timeLimitStatus.style.display = "block";
            }
        } else {
            // Default to 15 minutes if no setting found
            answerTimeLimitInput.value = 15;
        }
    }

    // Helper methods
    getTeamStatus(team) {
        if (team.current_position > 7) return "completed";
        if (team.current_position > 1) return "active";
        return "inactive";
    }

    getTeamStatusClass(status) {
        const classes = {
            completed: "completed",
            active: "active",
            inactive: "inactive",
        };
        return classes[status] || "inactive";
    }

    // Filter methods
    filterTeams(searchTerm) {
        const rows = document.querySelectorAll("#teamsTableBody tr");
        const term = searchTerm.toLowerCase();

        rows.forEach((row) => {
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

        rows.forEach((row) => {
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

        rows.forEach((row) => {
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
}