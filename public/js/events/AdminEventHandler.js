export class AdminEventHandler {
  constructor(adminInstance) {
    this.admin = adminInstance;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Admin login form
    document
      .getElementById("adminLoginForm")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        this.admin.handleAdminLogin();
      });

    // Navigation
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const section = e.target.dataset.section;
        if (section) {
          this.admin.showSection(section);
        }
      });
    });

    // Refresh data
    document.getElementById("refreshDataBtn").addEventListener("click", () => {
      this.admin.loadData();
    });

    // Export data
    document.getElementById("exportDataBtn").addEventListener("click", () => {
      this.admin.exportData();
    });

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
      this.admin.logout();
    });

    // Team search
    document.getElementById("teamSearch").addEventListener("input", (e) => {
      this.admin.filterTeams(e.target.value);
    });

    // Status filter
    document.getElementById("statusFilter").addEventListener("change", (e) => {
      this.admin.filterTeamsByStatus(e.target.value);
    });

    // Leaderboard filters
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".filter-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.admin.filterLeaderboard(e.target.dataset.filter);
      });
    });

    // Scenario decisions are now handled by event delegation above

    // Modal close
    document.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.admin.closeModals();
      });
    });

    // Click outside modal to close
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.admin.closeModals();
        }
      });
    });

    // Dark mode toggle (if exists)
    const darkModeBtn = document.getElementById("darkModeBtn");
    if (darkModeBtn) {
      darkModeBtn.addEventListener("click", () => {
        this.admin.toggleDarkMode();
      });
    }

    // Game control buttons
    const startGameAllBtn = document.getElementById("startGameAllBtn");
    if (startGameAllBtn) {
      startGameAllBtn.addEventListener("click", () => {
        this.admin.startGameForAllTeams();
      });
    }

    const nextScenarioAllBtn = document.getElementById("nextScenarioAllBtn");
    if (nextScenarioAllBtn) {
      nextScenarioAllBtn.addEventListener("click", () => {
        this.admin.nextScenarioForAllTeams();
      });
    }

    const endGameAllBtn = document.getElementById("endGameAllBtn");
    if (endGameAllBtn) {
      endGameAllBtn.addEventListener("click", () => {
        this.admin.endGameForAllTeams();
      });
    }

    const resetGameAllBtn = document.getElementById("resetGameAllBtn");
    if (resetGameAllBtn) {
      resetGameAllBtn.addEventListener("click", () => {
        this.admin.resetGameForAllTeams();
      });
    }

    const refreshTeamsBtn = document.getElementById("refreshTeamsBtn");
    if (refreshTeamsBtn) {
      refreshTeamsBtn.addEventListener("click", () => {
        this.admin.forceCheckCompletedTeams();
        this.admin.showNotification("Team status refreshed", "info");
      });
    }

    // Event delegation for dynamically created buttons
    document.addEventListener("click", (e) => {
      if (e.target.closest(".view-team-btn")) {
        const teamId = e.target.closest(".view-team-btn").dataset.teamId;
        console.log("View team details clicked for team:", teamId);
        this.admin.viewTeamDetails(parseInt(teamId));
      }

      if (e.target.closest(".view-scenario-decisions")) {
        const position = e.target.closest(".scenario-card").dataset.position;
        console.log("View scenario decisions clicked for position:", position);
        this.admin.showScenarioDecisions(parseInt(position));
      }

      if (e.target.closest(".kick-team-btn")) {
        const teamId = e.target.closest(".kick-team-btn").dataset.teamId;
        console.log("Kick team clicked for team:", teamId);
        this.admin.kickTeam(parseInt(teamId));
      }
    });

    // Game settings - save time limit
    const saveTimeLimitBtn = document.getElementById("saveTimeLimitBtn");
    if (saveTimeLimitBtn) {
      saveTimeLimitBtn.addEventListener("click", () => {
        this.admin.saveTimeLimit();
      });
    }

    // Enter key support for time limit input
    const answerTimeLimitInput = document.getElementById("answerTimeLimit");
    if (answerTimeLimitInput) {
      answerTimeLimitInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.admin.saveTimeLimit();
        }
      });
    }
  }
}