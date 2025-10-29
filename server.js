const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

// Import database and routes
const { testConnection } = require("./config/database");
const authRoutes = require("./routes/auth");
const gameRoutes = require("./routes/game");
const adminRoutes = require("./routes/admin");

// Import state manager
const stateManager = require("./server-state-manager");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com"
        ],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: [
          "'self'", 
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com"
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  })
);

// Rate limiting
// const globalRateLimit = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 200, // limit each IP to 200 requests per windowMs
//   message: {
//     success: false,
//     message: "Too many requests from this IP, please try again later.",
//   },
// });

// app.use(globalRateLimit);

// CORS configuration
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? false : true, // Configure for production
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/admin", adminRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Tuna Adventure Game API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Admin panel route
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// WebSocket connection handling now managed by stateManager
// Access via: stateManager.state.connectedTeams, stateManager.state.connectedAdmins, stateManager.state.kickedTeams

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Team connection
  socket.on('team-join', async (data) => {
    const { teamId, teamName } = data;
    
    // Check if team has been kicked
    if (stateManager.isTeamKicked(teamId)) {
      console.log(`🚫 Team ${teamName} (${teamId}) tried to join but was previously kicked`);
      socket.emit('team-kicked');
      return;
    }
    
    // Add to connected teams
    stateManager.addConnectedTeam(teamId, socket.id);
    socket.teamId = teamId;
    socket.teamName = teamName;
    
    // Get or create team data from stateManager
    let team = stateManager.getTeam(teamId);
    if (!team) {
      // Load from database first (for existing teams)
      try {
        const { executeQuery } = require('./config/database');
        const dbTeam = await executeQuery(
          "SELECT id, name, current_position, total_score FROM teams WHERE id = ?",
          [teamId]
        );
        if (dbTeam.length > 0) {
          team = stateManager.createOrUpdateTeam(teamId, {
            name: dbTeam[0].name,
            currentPosition: dbTeam[0].current_position,
            totalScore: dbTeam[0].total_score,
            decisions: []
          });
        } else {
          // New team (shouldn't happen here, but handle gracefully)
          team = stateManager.createOrUpdateTeam(teamId, {
            name: teamName,
            currentPosition: 1,
            totalScore: 0
          });
        }
      } catch (error) {
        console.error('❌ Error loading team:', error);
        team = stateManager.createOrUpdateTeam(teamId, {
          name: teamName,
          currentPosition: 1,
          totalScore: 0
        });
      }
    }
    
    // Send team progress to admin
    socket.to('admin-room').emit('team-progress-update', {
      teamId,
      teamName: team.name,
      currentPosition: team.currentPosition,
      totalScore: team.totalScore,
      isCompleted: team.currentPosition > 7
    });
    
    // Send current game state to team
    const gameState = stateManager.getGameState();
    socket.emit('game-state-update', {
      gameState: gameState.status,
      currentStep: gameState.currentStep,
      isGameRunning: gameState.status === 'running',
      isWaiting: gameState.status === 'waiting',
      timestamp: new Date().toISOString()
    });
    
    // Notify admins about team connection
    socket.to('admin-room').emit('team-connected', { teamId, teamName: team.name });
  });

  // Admin connection
  socket.on('admin-join', () => {
    stateManager.addConnectedAdmin(socket.id);
    socket.join('admin-room');
    
    // Send current game state
    const gameState = stateManager.getGameState();
    socket.emit('game-state-update', {
      gameState: gameState.status,
      currentStep: gameState.currentStep,
      isGameRunning: gameState.status === 'running',
      isGameEnded: gameState.status === 'ended',
      isWaiting: gameState.status === 'waiting',
      connectedTeamsCount: gameState.connectedTeamsCount,
      timestamp: new Date().toISOString()
    });
    
    // Send current connected teams to admin
    const connectedTeams = stateManager.getConnectedTeams();
    const teams = Array.from(connectedTeams.entries()).map(([teamId, socketId]) => {
      const team = stateManager.getTeam(teamId);
      return {
        teamId,
        teamName: team ? team.name : (io.sockets.sockets.get(socketId)?.teamName || 'Unknown'),
        socketId
      };
    });
    socket.emit('connected-teams', teams);
  });

  // Game control events
  socket.on('start-game-all', async () => {
    console.log('🎮 Admin starting game for all teams');
    stateManager.updateGameState('running', 1);
    
    io.to('admin-room').emit('game-started');
    io.emit('game-start-command');
  });

  socket.on('next-scenario-all', () => {
    console.log('➡️ Admin advancing to next scenario for all teams');
    const newStep = stateManager.state.currentStep + 1;
    stateManager.updateGameState('running', newStep);
    
    io.to('admin-room').emit('scenario-advanced');
    io.emit('next-scenario-command');
  });

  socket.on('end-game-all', () => {
    console.log('🏁 Admin ending game for all teams');
    stateManager.updateGameState('ended');
    
    io.to('admin-room').emit('game-ended');
    io.emit('end-game-command');
  });

  socket.on('reset-game-all', () => {
    console.log('🔄 Admin resetting game for all teams');
    stateManager.resetSession();
    
    io.to('admin-room').emit('game-reset');
    
    // Send reset command to connected teams
    const connectedTeams = stateManager.getConnectedTeams();
    connectedTeams.forEach((socketId, teamId) => {
      io.to(socketId).emit('reset-game-command');
    });
  });

  socket.on('unban-team', (data) => {
    const { teamId } = data;
    if (stateManager.isTeamKicked(teamId)) {
      stateManager.unbanTeam(teamId);
      io.to('admin-room').emit('team-unbanned', { teamId });
    }
  });

  socket.on('kick-team', (data) => {
    const { teamId } = data;
    const connectedTeams = stateManager.getConnectedTeams();
    const teamSocketId = connectedTeams.get(teamId);
    
    if (teamSocketId) {
      // Get team name
      const team = stateManager.getTeam(teamId);
      const teamName = team ? team.name : (io.sockets.sockets.get(teamSocketId)?.teamName || 'Unknown');
      
      // Add team to kicked teams blacklist
      stateManager.kickTeam(teamId);
      
      // Send kick notification to team
      io.to(teamSocketId).emit('team-kicked');
      
      // Remove team from connected teams
      stateManager.removeConnectedTeam(teamId);
      
      // Notify admins about team kick
      io.to('admin-room').emit('team-disconnected', {
        teamId: teamId,
        teamName: teamName
      });
    }
  });

  // Team logout
  socket.on('team-logout', (data) => {
    const { teamId } = data;
    const team = stateManager.getTeam(teamId);
    const teamName = team ? team.name : (socket.teamName || 'Unknown');
    
    const connectedTeams = stateManager.getConnectedTeams();
    if (connectedTeams.has(teamId)) {
      // Remove team from connected teams
      stateManager.removeConnectedTeam(teamId);
      
      // Notify admins about team logout
      socket.to('admin-room').emit('team-disconnected', {
        teamId: teamId,
        teamName: teamName,
        reason: 'logout'
      });
    }
  });

  // Team progress updates
  socket.on('team-progress', (data) => {
    const { teamId, currentPosition, totalScore, isCompleted } = data;
    
    // Update team data in stateManager
    const team = stateManager.getTeam(teamId);
    if (team) {
      stateManager.createOrUpdateTeam(teamId, {
        ...team,
        currentPosition,
        totalScore
      });
    }
    
    socket.to('admin-room').emit('team-progress-update', {
      teamId,
      teamName: socket.teamName || (team ? team.name : 'Unknown'),
      currentPosition,
      totalScore,
      isCompleted
    });
  });

  // Team decision submission
  socket.on('team-decision', (data) => {
    const { teamId, position, score } = data;
    const team = stateManager.getTeam(teamId);
    
    socket.to('admin-room').emit('team-decision-submitted', {
      teamId,
      teamName: socket.teamName || (team ? team.name : 'Unknown'),
      position,
      score
    });
  });

  // Disconnection handling
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    if (socket.teamId) {
      stateManager.removeConnectedTeam(socket.teamId);
      const team = stateManager.getTeam(socket.teamId);
      socket.to('admin-room').emit('team-disconnected', {
        teamId: socket.teamId,
        teamName: team ? team.name : (socket.teamName || 'Unknown')
      });
    }
    
    if (stateManager.state.connectedAdmins.has(socket.id)) {
      stateManager.removeConnectedAdmin(socket.id);
    }
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Sync teams from database to stateManager
    const { executeQuery } = require('./config/database');
    await stateManager.syncTeamsFromDatabase(executeQuery);

    // Start HTTP server with WebSocket
    server.listen(PORT, () => {
      console.log(`🚀 Tuna Adventure Game server running on port ${PORT}`);
      console.log(`📱 Frontend: http://localhost:${PORT}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`💚 Health: http://localhost:${PORT}/api/health`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Export io for use in routes
app.set('io', io);

// Start the server
startServer();
