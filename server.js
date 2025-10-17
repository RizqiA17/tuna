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

// WebSocket connection handling
const connectedTeams = new Map(); // teamId -> socketId
const connectedAdmins = new Set(); // socketId
const kickedTeams = new Set(); // teamId -> Set of kicked team IDs

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Team connection
  socket.on('team-join', async (data) => {
    const { teamId, teamName } = data;
    
    // Check if team has been kicked
    if (kickedTeams.has(teamId)) {
      console.log(`🚫 Team ${teamName} (${teamId}) tried to join but was previously kicked`);
      socket.emit('team-kicked');
      return;
    }
    
    connectedTeams.set(teamId, socket.id);
    socket.teamId = teamId;
    socket.teamName = teamName;
    console.log(`👥 Team ${teamName} (${teamId}) joined`);
    
    // Get team progress from database and send to admin
    try {
      const { executeQuery } = require('./config/database');
      const team = await executeQuery(
        "SELECT current_position, total_score FROM teams WHERE id = ?",
        [teamId]
      );
      
      if (team.length > 0) {
        const teamData = team[0];
        const isCompleted = teamData.current_position > 7;
        
        // Send team progress to admin
        socket.to('admin-room').emit('team-progress-update', {
          teamId,
          teamName,
          currentPosition: teamData.current_position,
          totalScore: teamData.total_score,
          isCompleted
        });
        
        console.log(`📊 Sent team progress for ${teamName}: position ${teamData.current_position}, score ${teamData.total_score}`);
      }
    } catch (error) {
      console.error('❌ Error getting team progress:', error);
    }
    
    // Notify admins about team connection
    socket.to('admin-room').emit('team-connected', { teamId, teamName });
  });

  // Admin connection
  socket.on('admin-join', () => {
    connectedAdmins.add(socket.id);
    socket.join('admin-room');
    console.log(`👨‍💼 Admin connected: ${socket.id}`);
    
    // Send current connected teams to admin
    const teams = Array.from(connectedTeams.entries()).map(([teamId, socketId]) => ({
      teamId,
      teamName: io.sockets.sockets.get(socketId)?.teamName || 'Unknown'
    }));
    socket.emit('connected-teams', teams);
  });

  // Game control events
  socket.on('start-game-all', async () => {
    console.log('🎮 Admin starting game for all teams');
    io.to('admin-room').emit('game-started');
    io.emit('game-start-command');
  });

  socket.on('next-scenario-all', () => {
    console.log('➡️ Admin advancing to next scenario for all teams');
    io.to('admin-room').emit('scenario-advanced');
    io.emit('next-scenario-command');
  });

  socket.on('end-game-all', () => {
    console.log('🏁 Admin ending game for all teams');
    io.to('admin-room').emit('game-ended');
    io.emit('end-game-command');
  });

  socket.on('reset-game-all', () => {
    console.log('🔄 Admin resetting game for all teams');
    io.to('admin-room').emit('game-reset');
    
    // Clear kicked teams blacklist on reset
    kickedTeams.clear();
    console.log('✅ Kicked teams blacklist cleared on game reset');
    
    // Only send reset command to connected teams (not kicked teams)
    connectedTeams.forEach((socketId, teamId) => {
      io.to(socketId).emit('reset-game-command');
    });
  });

  socket.on('unban-team', (data) => {
    const { teamId } = data;
    if (kickedTeams.has(teamId)) {
      kickedTeams.delete(teamId);
      console.log(`✅ Team ${teamId} unbanned and can rejoin`);
      io.to('admin-room').emit('team-unbanned', { teamId });
    }
  });

  socket.on('kick-team', (data) => {
    const { teamId } = data;
    const teamSocketId = connectedTeams.get(teamId);
    if (teamSocketId) {
      // Get team name before deleting
      const teamName = io.sockets.sockets.get(teamSocketId)?.teamName || 'Unknown';
      
      // Add team to kicked teams blacklist
      kickedTeams.add(teamId);
      
      // Send kick notification to team
      io.to(teamSocketId).emit('team-kicked');
      
      // Remove team from connected teams
      connectedTeams.delete(teamId);
      
      // Notify admins about team kick
      io.to('admin-room').emit('team-disconnected', {
        teamId: teamId,
        teamName: teamName
      });
      
      console.log(`👢 Team ${teamName} (${teamId}) kicked from game and added to blacklist`);
    }
  });

  // Team logout
  socket.on('team-logout', (data) => {
    const { teamId } = data;
    const teamName = socket.teamName || 'Unknown';
    
    if (connectedTeams.has(teamId)) {
      // Remove team from connected teams
      connectedTeams.delete(teamId);
      
      // Notify admins about team logout
      socket.to('admin-room').emit('team-disconnected', {
        teamId: teamId,
        teamName: teamName,
        reason: 'logout'
      });
      
      console.log(`🚪 Team ${teamName} (${teamId}) logged out and removed from connected teams`);
    }
  });

  // Team progress updates
  socket.on('team-progress', (data) => {
    const { teamId, currentPosition, totalScore, isCompleted } = data;
    socket.to('admin-room').emit('team-progress-update', {
      teamId,
      teamName: socket.teamName,
      currentPosition,
      totalScore,
      isCompleted
    });
  });

  // Team decision submission
  socket.on('team-decision', (data) => {
    const { teamId, position, score } = data;
    socket.to('admin-room').emit('team-decision-submitted', {
      teamId,
      teamName: socket.teamName,
      position,
      score
    });
  });

  // Disconnection handling
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    if (socket.teamId) {
      connectedTeams.delete(socket.teamId);
      socket.to('admin-room').emit('team-disconnected', {
        teamId: socket.teamId,
        teamName: socket.teamName
      });
    }
    
    if (connectedAdmins.has(socket.id)) {
      connectedAdmins.delete(socket.id);
    }
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

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
