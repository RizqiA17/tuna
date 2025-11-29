const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { executeQuery } = require('./config/database');

// Configuration
const DATA_DIR = path.join(__dirname, 'data');
const SESSION_STATE_FILE = path.join(DATA_DIR, 'session_state.json');
const BACKUP_FILE = SESSION_STATE_FILE + '.backup';
const DEBOUNCE_DELAY = 1000; // 1 second
const BACKUP_INTERVAL = 60000; // 60 seconds

/**
 * GameStateManager - Singleton for managing game state with file persistence
 * 
 * Handles:
 * - In-memory game state (fast access)
 * - File-based persistence (recovery after restart)
 * - Debounced saves (prevent excessive writes)
 * - Periodic backups
 * - Graceful shutdown
 */
class GameStateManager {
  constructor() {
    if (GameStateManager.instance) {
      return GameStateManager.instance;
    }

    this.state = {
      // Global game state
      gameState: 'waiting', // waiting, running, ended
      currentStep: 0,
      
      // Team data - Map<teamId, teamData>
      teams: new Map(),
      
      // Connection tracking
      connectedTeams: new Map(), // teamId -> socketId
      connectedAdmins: new Set(), // socketId
      kickedTeams: new Set(), // teamId
      
      // Metadata
      lastUpdated: new Date().toISOString(),
      sessionStarted: null
    };

    this.saveTimeout = null;
    this.backupInterval = null;
    this.isShuttingDown = false;

    GameStateManager.instance = this;
  }

  /**
   * Initialize state manager - load from file or create new
   */
  async init() {
    try {
      // // Ensure data directory exists
      // if (!fs.existsSync(DATA_DIR)) {
      //   fs.mkdirSync(DATA_DIR, { recursive: true });
      //   console.log('📁 Created data directory');
      // }

      // // Try to load existing state
      // if (fs.existsSync(SESSION_STATE_FILE)) {
      //   await this.loadFromFile();
      //   console.log('✅ Game state loaded from file');
      // } else {
      //   console.log('📝 No existing state file, starting fresh');
      //   await this.saveToFile(true);
      // }

      // // Setup periodic backup
      // this.backupInterval = setInterval(() => {
      //   this.createBackup();
      // }, BACKUP_INTERVAL);

      const status = await executeQuery(
        "SELECT * FROM game_status LIMIT 1 FOR UPDATE"
      )

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      console.log('🎮 Game State Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize state manager:', error);
      throw error;
    }
  }

  /**
   * Load state from file
   */
  async loadFromFile() {
    try {
      const data = fs.readFileSync(SESSION_STATE_FILE, 'utf8');
      const parsed = JSON.parse(data);

      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid state file structure');
      }

      // Restore state
      this.state.gameState = parsed.gameState || 'waiting';
      this.state.currentStep = parsed.currentStep || 0;
      this.state.sessionStarted = parsed.sessionStarted;
      this.state.lastUpdated = parsed.lastUpdated;

      // Restore teams (convert array back to Map)
      this.state.teams = new Map();
      if (Array.isArray(parsed.teams)) {
        parsed.teams.forEach(team => {
          this.state.teams.set(team.id, team);
        });
      }

      // Restore kicked teams
      this.state.kickedTeams = new Set(parsed.kickedTeams || []);

      // Note: connectedTeams and connectedAdmins are NOT restored
      // (they will reconnect via WebSocket)
      this.state.connectedTeams = new Map();
      this.state.connectedAdmins = new Set();

      console.log(`📂 Loaded state: ${this.state.teams.size} teams, gameState=${this.state.gameState}, step=${this.state.currentStep}`);
    } catch (error) {
      console.error('❌ Error loading state file:', error);
      
      // Try backup file
      if (fs.existsSync(BACKUP_FILE)) {
        console.log('🔄 Attempting to restore from backup...');
        try {
          fs.copyFileSync(BACKUP_FILE, SESSION_STATE_FILE);
          await this.loadFromFile(); // Recursive call with backup
          console.log('✅ Restored from backup successfully');
          return;
        } catch (backupError) {
          console.error('❌ Backup restore failed:', backupError);
        }
      }
      
      // If all fails, start fresh
      console.log('⚠️  Starting with fresh state');
    }
  }

  /**
   * Save state to file (with debouncing)
   */
  saveToFile(immediate = false) {
    if (this.isShuttingDown) {
      return; // Don't schedule new saves during shutdown
    }

    if (immediate) {
      this._performSave();
    } else {
      // Debounce: cancel previous timeout and schedule new save
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = setTimeout(() => {
        this._performSave();
      }, DEBOUNCE_DELAY);
    }
  }

  /**
   * Actually perform the save operation
   */
  _performSave() {
    try {
      // Update timestamp
      this.state.lastUpdated = new Date().toISOString();

      // Convert Maps to arrays for JSON serialization
      const serializable = {
        gameState: this.state.gameState,
        currentStep: this.state.currentStep,
        sessionStarted: this.state.sessionStarted,
        lastUpdated: this.state.lastUpdated,
        teams: Array.from(this.state.teams.values()),
        kickedTeams: Array.from(this.state.kickedTeams),
        // Note: connectedTeams and connectedAdmins are NOT persisted
      };

      // Write to file
      fs.writeFileSync(
        SESSION_STATE_FILE,
        JSON.stringify(serializable, null, 2),
        'utf8'
      );

      console.log(`💾 State saved: ${this.state.teams.size} teams, gameState=${this.state.gameState}`);
    } catch (error) {
      console.error('❌ Error saving state:', error);
      // Continue with in-memory state even if file save fails
    }
  }

  /**
   * Create backup copy
   */
  createBackup() {
    try {
      if (fs.existsSync(SESSION_STATE_FILE)) {
        fs.copyFileSync(SESSION_STATE_FILE, BACKUP_FILE);
        console.log('💾 Backup created');
      }
    } catch (error) {
      console.error('❌ Error creating backup:', error);
    }
  }

  /**
   * Sync teams from database (called on server start)
   */
  async syncTeamsFromDatabase(executeQuery) {
    try {
      // Only sync if starting fresh or in waiting state
      if (this.state.gameState !== 'waiting' && this.state.teams.size > 0) {
        console.log('⚠️  Game in progress, skipping database sync');
        return;
      }

      const teams = await executeQuery('SELECT id, name, current_position, total_score FROM teams');
      
      console.log(`🔄 Syncing ${teams.length} teams from database...`);
      
      teams.forEach(dbTeam => {
        const existingTeam = this.state.teams.get(dbTeam.id);
        if (!existingTeam) {
          // Add new team from database
          this.state.teams.set(dbTeam.id, {
            id: dbTeam.id,
            name: dbTeam.name,
            currentPosition: dbTeam.current_position,
            totalScore: dbTeam.total_score,
            decisions: [],
            createdAt: new Date().toISOString()
          });
        }
      });

      this.saveToFile(true);
      console.log(`✅ Synced ${teams.length} teams from database`);
    } catch (error) {
      console.error('❌ Error syncing from database:', error);
    }
  }

  /**
   * Get global game state
   */
  getGameState() {
    return {
      status: this.state.gameState,
      currentStep: this.state.currentStep,
      sessionStarted: this.state.sessionStarted,
      lastUpdated: this.state.lastUpdated,
      connectedTeamsCount: this.state.connectedTeams.size,
      totalTeamsCount: this.state.teams.size
    };
  }

  /**
   * Update global game state
   */
  updateGameState(status, step = null) {
    this.state.gameState = status;
    
    if (step !== null) {
      this.state.currentStep = step;
    }
    
    if (status === 'running' && !this.state.sessionStarted) {
      this.state.sessionStarted = new Date().toISOString();
    }
    
    this.saveToFile();
    console.log(`🎮 Game state updated: ${status}, step: ${this.state.currentStep}`);
  }

  /**
   * Get team data
   */
  getTeam(teamId) {
    return this.state.teams.get(teamId);
  }

  /**
   * Get all teams as array
   */
  getAllTeams() {
    return Array.from(this.state.teams.values());
  }

  /**
   * Create or update team
   */
  createOrUpdateTeam(teamId, teamData) {
    const existing = this.state.teams.get(teamId);
    
    const updated = {
      id: teamId,
      ...existing,
      ...teamData,
      updatedAt: new Date().toISOString()
    };
    
    this.state.teams.set(teamId, updated);
    this.saveToFile();
    
    return updated;
  }

  /**
   * Add team decision
   */
  addTeamDecision(teamId, decision) {
    const team = this.state.teams.get(teamId);
    if (!team) {
      console.error(`❌ Team ${teamId} not found in state`);
      return;
    }

    // Initialize decisions array if needed
    if (!team.decisions) {
      team.decisions = [];
    }

    // Add decision
    team.decisions.push({
      ...decision,
      timestamp: new Date().toISOString()
    });

    // Update position and score
    team.currentPosition = decision.newPosition;
    team.totalScore = decision.newTotalScore;

    this.saveToFile();
  }

  /**
   * Connected teams management
   */
  addConnectedTeam(teamId, socketId) {
    this.state.connectedTeams.set(teamId, socketId);
    console.log(`✅ Team ${teamId} connected (socket: ${socketId})`);
    // Note: connectedTeams is NOT persisted to file
  }

  removeConnectedTeam(teamId) {
    const removed = this.state.connectedTeams.delete(teamId);
    if (removed) {
      console.log(`❌ Team ${teamId} disconnected`);
    }
  }

  getConnectedTeams() {
    return this.state.connectedTeams;
  }

  /**
   * Connected admins management
   */
  addConnectedAdmin(socketId) {
    this.state.connectedAdmins.add(socketId);
    console.log(`👨‍💼 Admin connected: ${socketId}`);
  }

  removeConnectedAdmin(socketId) {
    this.state.connectedAdmins.delete(socketId);
    console.log(`👨‍💼 Admin disconnected: ${socketId}`);
  }

  /**
   * Kicked teams management
   */
  kickTeam(teamId) {
    this.state.kickedTeams.add(teamId);
    this.saveToFile();
    console.log(`👢 Team ${teamId} kicked and blacklisted`);
  }

  unbanTeam(teamId) {
    const removed = this.state.kickedTeams.delete(teamId);
    if (removed) {
      this.saveToFile();
      console.log(`✅ Team ${teamId} unbanned`);
    }
  }

  isTeamKicked(teamId) {
    return this.state.kickedTeams.has(teamId);
  }

  /**
   * Reset session (game reset)
   */
  resetSession() {
    console.log('🔄 Resetting game session...');
    
    this.state.gameState = 'waiting';
    this.state.currentStep = 0;
    this.state.sessionStarted = null;
    
    // Clear kicked teams on reset
    this.state.kickedTeams.clear();
    
    // Reset all team progress
    this.state.teams.forEach((team, teamId) => {
      team.currentPosition = 1;
      team.totalScore = 0;
      team.decisions = [];
      team.updatedAt = new Date().toISOString();
    });
    
    this.saveToFile(true);
    console.log('✅ Session reset complete');
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) {
        return;
      }

      console.log(`\n🛑 ${signal} received, saving state before shutdown...`);
      this.isShuttingDown = true;

      // Cancel pending saves
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }

      // Stop periodic backups
      if (this.backupInterval) {
        clearInterval(this.backupInterval);
      }

      // Perform final save
      this._performSave();
      
      // Create final backup
      this.createBackup();

      console.log('✅ State saved successfully');
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('beforeExit', () => shutdown('beforeExit'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown('uncaughtException');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }
}

// Create and export singleton instance
const stateManager = new GameStateManager();

// Initialize on require
stateManager.init().catch(error => {
  console.error('❌ Fatal error initializing state manager:', error);
  process.exit(1);
});

module.exports = stateManager;
