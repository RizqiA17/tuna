// Demo version without database - for testing
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { serverLogger } = require("./server-logger");

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
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});

app.use(globalRateLimit);

// CORS configuration
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? false : true,
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Mock data for demo
const mockTeams = new Map();
const mockDecisions = new Map();

// WebSocket connection handling
const connectedTeams = new Map(); // teamId -> socketId
const connectedAdmins = new Set(); // socketId
const kickedTeams = new Set(); // teamId -> Set of kicked team IDs

// Game state for demo
let gameState = 'waiting'; // waiting, running, ended
let currentStep = 1;

io.on('connection', (socket) => {
  serverLogger.websocket('connection', { socketId: socket.id }, socket.id, 'IN');

  // Team connection
  socket.on('team-join', (data) => {
    const { teamId, teamName } = data;
    
    // Check if team has been kicked
    if (kickedTeams.has(teamId)) {
      console.log(`🚫 Team ${teamName} (${teamId}) tried to join but was previously kicked`);
      socket.emit('team-kicked');
      return;
    }
    
    // Debug logging
    serverLogger.debug("Team join attempt", { 
      teamId, 
      teamName, 
      socketId: socket.id,
      currentConnectedTeams: Array.from(connectedTeams.keys()),
      currentSize: connectedTeams.size,
      rawData: data
    });
    
    // Validate teamId
    if (!teamId || teamId === null || teamId === undefined) {
      serverLogger.error("Invalid teamId received", { 
        teamId, 
        teamName, 
        socketId: socket.id,
        rawData: data
      });
      return;
    }
    
    // Store complete team data, not just socket ID
    connectedTeams.set(teamId, {
      teamId,
      teamName,
      socketId: socket.id,
      connectedAt: new Date().toISOString(),
      position: 1,
      score: 0,
      isActive: true
    });
    socket.teamId = teamId;
    socket.teamName = teamName;
    
    serverLogger.team('joined', teamId, teamName, { 
      socketId: socket.id,
      connectedTeamsCount: connectedTeams.size,
      allTeamIds: Array.from(connectedTeams.keys())
    });
    
    // Get team progress from mock data and send to admin
    const mockTeam = mockTeams.get(teamId);
    if (mockTeam) {
      const isCompleted = mockTeam.currentPosition > 7;
      
      // Send team progress to admin
      io.to('admin-room').emit('team-progress-update', {
        teamId,
        teamName,
        currentPosition: mockTeam.currentPosition,
        totalScore: mockTeam.totalScore,
        isCompleted
      });
      
      console.log(`📊 Sent team progress for ${teamName}: position ${mockTeam.currentPosition}, score ${mockTeam.totalScore}`);
    }
    
    // Notify admins about team connection
    io.to('admin-room').emit('team-connected', { 
      teamId, 
      teamName,
      socketId: socket.id,
      connectedAt: new Date().toISOString()
    });
    
    // Send updated team list to all admins
    const teams = Array.from(connectedTeams.values());
    
    serverLogger.debug("Sending connected teams to admin", { 
      teams, 
      adminCount: connectedAdmins.size 
    });
    io.to('admin-room').emit('connected-teams', teams);
    
    // Send current game state to team
    socket.emit('game-state-update', {
      gameState,
      currentStep,
      connectedTeamsCount: connectedTeams.size
    });
  });

  // Admin connection
  socket.on('admin-join', () => {
    connectedAdmins.add(socket.id);
    socket.join('admin-room');
    
    serverLogger.admin('connected', socket.id, { 
      connectedAdminsCount: connectedAdmins.size,
      connectedTeamsCount: connectedTeams.size 
    });
    
    // Send current connected teams to admin
    const teams = Array.from(connectedTeams.values());
    
    serverLogger.debug("Sending current teams to admin", { 
      teams, 
      adminSocketId: socket.id 
    });
    socket.emit('connected-teams', teams);
    
    // Send current game state to admin
    socket.emit('game-state-update', {
      gameState,
      currentStep,
      connectedTeamsCount: connectedTeams.size
    });
  });

  // Game control events
  socket.on('start-game-all', async () => {
    gameState = 'running';
    currentStep = 1;
    serverLogger.gameState('started', { 
      adminSocketId: socket.id,
      connectedTeamsCount: connectedTeams.size 
    });
    io.to('admin-room').emit('game-started');
    io.emit('game-start-command');
  });

  socket.on('next-scenario-all', () => {
    currentStep++;
    serverLogger.gameState('scenario-advanced', { 
      adminSocketId: socket.id,
      connectedTeamsCount: connectedTeams.size 
    });
    io.to('admin-room').emit('scenario-advanced');
    io.emit('next-scenario-command');
  });

  socket.on('end-game-all', () => {
    gameState = 'ended';
    serverLogger.gameState('ended', { 
      adminSocketId: socket.id,
      connectedTeamsCount: connectedTeams.size 
    });
    io.to('admin-room').emit('game-ended');
    io.emit('end-game-command');
  });

  socket.on('reset-game-all', () => {
    gameState = 'waiting';
    currentStep = 1;
    serverLogger.gameState('reset', { 
      adminSocketId: socket.id,
      connectedTeamsCount: connectedTeams.size 
    });
    io.to('admin-room').emit('game-reset');
    
    // Clear kicked teams blacklist on reset
    kickedTeams.clear();
    console.log('✅ Kicked teams blacklist cleared on game reset');
    
    // Only send reset command to connected teams (not kicked teams)
    connectedTeams.forEach((teamData, teamId) => {
      io.to(teamData.socketId).emit('reset-game-command');
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
    const teamData = connectedTeams.get(teamId);
    if (teamData) {
      const teamName = teamData.teamName || 'Unknown';
      
      // Add team to kicked teams blacklist
      kickedTeams.add(teamId);
      
      // Send kick notification to team
      io.to(teamData.socketId).emit('team-kicked');
      
      // Remove team from connected teams
      connectedTeams.delete(teamId);
      
      // Notify admins about team kick
      io.to('admin-room').emit('team-disconnected', {
        teamId: teamId,
        teamName: teamName
      });
      
      serverLogger.team('kicked', teamId, teamName, {
        adminSocketId: socket.id,
        connectedTeamsCount: connectedTeams.size
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
      io.to('admin-room').emit('team-disconnected', {
        teamId: teamId,
        teamName: teamName,
        reason: 'logout'
      });
      
      serverLogger.team('logout', teamId, teamName, {
        socketId: socket.id,
        connectedTeamsCount: connectedTeams.size
      });
      
      console.log(`🚪 Team ${teamName} (${teamId}) logged out and removed from connected teams`);
    }
  });

  // Team progress updates
  socket.on('team-progress', (data) => {
    const { teamId, currentPosition, totalScore, isCompleted } = data;
    
    // Update team data in connectedTeams
    if (connectedTeams.has(teamId)) {
      const teamData = connectedTeams.get(teamId);
      teamData.position = currentPosition;
      teamData.score = totalScore;
      teamData.isCompleted = isCompleted;
      connectedTeams.set(teamId, teamData);
    }
    
    serverLogger.team('progress-update', teamId, socket.teamName, {
      currentPosition,
      totalScore,
      isCompleted,
      socketId: socket.id
    });
    
    io.to('admin-room').emit('team-progress-update', {
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
    
    // Update team data in connectedTeams
    if (connectedTeams.has(teamId)) {
      const teamData = connectedTeams.get(teamId);
      teamData.position = position;
      teamData.score = score;
      connectedTeams.set(teamId, teamData);
    }
    
    serverLogger.team('decision-submitted', teamId, socket.teamName, {
      position,
      score,
      socketId: socket.id
    });
    
    io.to('admin-room').emit('team-decision-submitted', {
      teamId,
      teamName: socket.teamName,
      position,
      score
    });
  });

  // Disconnection handling
  socket.on('disconnect', () => {
    serverLogger.websocket('disconnect', { socketId: socket.id }, socket.id, 'IN');
    
    if (socket.teamId) {
      serverLogger.debug("Team disconnect", { 
        teamId: socket.teamId, 
        teamName: socket.teamName,
        socketId: socket.id,
        beforeDelete: Array.from(connectedTeams.keys()),
        beforeSize: connectedTeams.size
      });
      
      serverLogger.team('disconnected', socket.teamId, socket.teamName, {
        socketId: socket.id,
        connectedTeamsCount: connectedTeams.size - 1
      });
      
      connectedTeams.delete(socket.teamId);
      
      serverLogger.debug("After team delete", { 
        afterDelete: Array.from(connectedTeams.keys()),
        afterSize: connectedTeams.size
      });
      io.to('admin-room').emit('team-disconnected', {
        teamId: socket.teamId,
        teamName: socket.teamName
      });
      
      // Send updated team list to all admins
      const teams = Array.from(connectedTeams.values());
      io.to('admin-room').emit('connected-teams', teams);
    }
    
    if (connectedAdmins.has(socket.id)) {
      serverLogger.admin('disconnected', socket.id, {
        connectedAdminsCount: connectedAdmins.size - 1
      });
      connectedAdmins.delete(socket.id);
    }
  });
});

// Generate demo token
const generateDemoToken = (teamId) => {
  return `demo_token_${teamId}_${Date.now()}`;
};

// Simple admin authentication middleware for demo
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token || !token.startsWith('demo_admin_token_')) {
    return res.status(401).json({
      success: false,
      message: "Admin access required"
    });
  }

  req.admin = { id: "admin", username: "admin" };
  next();
};

// Demo API routes
app.post("/api/auth/register", (req, res) => {
  const startTime = Date.now();
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  serverLogger.http('POST', '/api/auth/register', null, null, req.body, null, requestId);
  
  const { teamName, password, players } = req.body;

  if (mockTeams.has(teamName)) {
    const duration = Date.now() - startTime;
    serverLogger.http('POST', '/api/auth/register', 409, duration, req.body, { message: "Team name already exists" }, requestId);
    
    return res.status(409).json({
      success: false,
      message: "Team name already exists",
    });
  }

  const teamId = Date.now();
  const token = generateDemoToken(teamId);

  mockTeams.set(teamName, {
    id: teamId,
    name: teamName,
    password: password,
    currentPosition: 1,
    totalScore: 0,
    players: players || [],
  });

  const responseData = {
    success: true,
    message: "Team registered successfully",
    data: {
      teamId,
      teamName,
      token,
      players: players ? players.length : 0,
    },
  };

  const duration = Date.now() - startTime;
  serverLogger.http('POST', '/api/auth/register', 201, duration, req.body, responseData, requestId);
  serverLogger.data('create', { teamId, teamName, playerCount: players?.length || 0 }, 'TEAMS');

  res.status(201).json(responseData);
});

app.post("/api/auth/login", (req, res) => {
  const { teamName, password } = req.body;

  const team = mockTeams.get(teamName);
  if (!team || team.password !== password) {
    return res.status(401).json({
      success: false,
      message: "Invalid team name or password",
    });
  }

  const token = generateDemoToken(team.id);

  res.json({
    success: true,
    message: "Login successful",
    data: {
      teamId: team.id,
      teamName: team.name,
      currentPosition: team.currentPosition,
      totalScore: team.totalScore,
      token,
      players: team.players,
    },
  });
});

app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  // Find team by token (simplified for demo)
  let team = null;
  for (const [name, teamData] of mockTeams) {
    if (token.includes(teamData.id.toString())) {
      team = teamData;
      break;
    }
  }

  if (!team) {
    return res.status(401).json({
      success: false,
      message: "Invalid team session",
    });
  }

  res.json({
    success: true,
    data: {
      teamId: team.id,
      teamName: team.name,
      currentPosition: team.currentPosition,
      totalScore: team.totalScore,
      players: team.players,
    },
  });
});

// New API endpoints needed by frontend
app.get("/api/game/status", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  // Find team by token
  let team = null;
  for (const [name, teamData] of mockTeams) {
    if (token.includes(teamData.id.toString())) {
      team = teamData;
      break;
    }
  }

  if (!team) {
    return res.status(401).json({
      success: false,
      message: "Invalid team session",
    });
  }

  // Get current scenario if team is at position 1
  let currentScenario = null;
  if (team.currentPosition === 1) {
    currentScenario = gameScenarios[0]; // First scenario
  }

  res.json({
    success: true,
    team: {
      id: team.id,
      name: team.name,
      current_position: team.currentPosition,
      total_score: team.totalScore,
      players: team.players,
    },
    currentScenario: currentScenario,
    timeRemaining: 900, // 15 minutes
  });
});

app.post("/api/game/start", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  // Find team by token
  let team = null;
  for (const [name, teamData] of mockTeams) {
    if (token.includes(teamData.id.toString())) {
      team = teamData;
      break;
    }
  }

  if (!team) {
    return res.status(401).json({
      success: false,
      message: "Invalid team session",
    });
  }

  // Return first scenario
  res.json({
    success: true,
    scenario: gameScenarios[0],
    timeLimit: 900, // 15 minutes
  });
});

app.post("/api/game/submit-decision", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  const { position, decision, argumentation } = req.body;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  // Find team by token
  let team = null;
  for (const [name, teamData] of mockTeams) {
    if (token.includes(teamData.id.toString())) {
      team = teamData;
      break;
    }
  }

  if (!team) {
    return res.status(401).json({
      success: false,
      message: "Invalid team session",
    });
  }

  // Consistent scoring algorithm based on content analysis
  const scenario = gameScenarios.find((s) => s.position === position);
  let score = 0;

  if (scenario) {
    // Create a hash-based score for consistency
    const decisionHash = decision.toLowerCase().replace(/[^a-z0-9]/g, "");
    const argumentationHash = argumentation
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    // Simple hash function for consistent scoring
    let hash = 0;
    for (let i = 0; i < decisionHash.length; i++) {
      hash = ((hash << 5) - hash + decisionHash.charCodeAt(i)) & 0xffffffff;
    }
    for (let i = 0; i < argumentationHash.length; i++) {
      hash =
        ((hash << 5) - hash + argumentationHash.charCodeAt(i)) & 0xffffffff;
    }

    // Base score from hash (consistent for same input)
    const baseScore = Math.abs(hash) % 8; // 0-7

    // Bonus for length and keywords
    const lengthBonus = Math.min(
      3,
      Math.floor(decision.length / 50) + Math.floor(argumentation.length / 100)
    );
    const keywordBonus = calculateKeywordScore(
      decision,
      argumentation,
      scenario
    );

    score = Math.min(15, baseScore + lengthBonus + keywordBonus);
  } else {
    score = 5; // Default score
  }

  // Update team data - increment position
  team.totalScore += score;
  team.currentPosition = Math.min(8, position + 1); // Cap at 8 (game complete)

  res.json({
    success: true,
    team: {
      id: team.id,
      name: team.name,
      current_position: team.currentPosition,
      total_score: team.totalScore,
      players: team.players,
    },
    result: {
      position: position,
      score: score,
      teamDecision: decision,
      teamArgumentation: argumentation,
      standardAnswer: scenario
        ? scenario.standardAnswer
        : "Jawaban standar tidak tersedia",
      standardArgumentation: scenario
        ? scenario.standardReasoning
        : "Penjelasan tidak tersedia",
    },
  });
});

// Helper function for consistent keyword scoring
function calculateKeywordScore(decision, argumentation, scenario) {
  const decisionLower = decision.toLowerCase();
  const argumentationLower = argumentation.toLowerCase();
  const standardAnswerLower = scenario.standardAnswer.toLowerCase();
  const standardReasoningLower = scenario.standardReasoning.toLowerCase();

  // Extract keywords from standard answer
  const keywords = standardAnswerLower
    .split(" ")
    .filter(
      (word) =>
        word.length > 3 &&
        ![
          "yang",
          "dari",
          "untuk",
          "dengan",
          "dalam",
          "pada",
          "atau",
          "dan",
          "ini",
          "itu",
        ].includes(word)
    );

  let matches = 0;
  keywords.forEach((keyword) => {
    if (
      decisionLower.includes(keyword) ||
      argumentationLower.includes(keyword)
    ) {
      matches++;
    }
  });

  return Math.min(5, matches);
}

app.post("/api/game/next-scenario", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  // Find team by token
  let team = null;
  for (const [name, teamData] of mockTeams) {
    if (token.includes(teamData.id.toString())) {
      team = teamData;
      break;
    }
  }

  if (!team) {
    return res.status(401).json({
      success: false,
      message: "Invalid team session",
    });
  }

  // Get next scenario
  const nextScenario = gameScenarios.find(
    (s) => s.position === team.currentPosition
  );

  if (nextScenario) {
    res.json({
      success: true,
      scenario: nextScenario,
      timeLimit: 900,
    });
  } else {
    // Game finished
    res.json({
      success: true,
      scenario: null,
      message: "Game completed!",
    });
  }
});

app.get("/api/game/leaderboard", (req, res) => {
  // Convert mock teams to leaderboard format
  const leaderboard = Array.from(mockTeams.values())
    .map((team) => ({
      team_name: team.name,
      total_score: team.totalScore,
      current_position: team.currentPosition,
      players: team.players,
    }))
    .sort((a, b) => b.total_score - a.total_score);

  res.json({
    success: true,
    data: leaderboard,
  });
});

// Game scenarios
const gameScenarios = [
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

// Admin routes for demo
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  // Simple admin credentials check for demo
  if (username === "admin" && password === "tuna_admin_2024") {
    const token = `demo_admin_token_${Date.now()}`;
    
    res.json({
      success: true,
      message: "Admin login successful",
      data: {
        token,
        admin: {
          id: "admin",
          username: "admin"
        }
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Invalid admin credentials"
    });
  }
});

app.get("/api/admin/teams", authenticateAdmin, (req, res) => {
  const teams = Array.from(mockTeams.values()).map(team => ({
    id: team.id,
    team_name: team.name,
    current_position: team.currentPosition,
    total_score: team.totalScore,
    created_at: new Date().toISOString(),
    player_count: team.players.length,
    players: team.players.map(p => p.name).join(', ')
  }));

  res.json({
    success: true,
    data: teams,
  });
});

app.get("/api/admin/stats", authenticateAdmin, (req, res) => {
  const teams = Array.from(mockTeams.values());
  const totalTeams = teams.length;
  const activeTeams = teams.filter(t => t.currentPosition > 1).length;
  const completedTeams = teams.filter(t => t.currentPosition > 7).length;
  const averageScore = teams.length > 0 ? teams.reduce((sum, t) => sum + t.totalScore, 0) / teams.length : 0;

  res.json({
    success: true,
    data: {
      totalTeams,
      activeTeams,
      completedTeams,
      averageScore,
      gameState,
      currentStep,
      connectedTeamsCount: connectedTeams.size,
      scenarioStats: gameScenarios.map(scenario => ({
        position: scenario.position,
        title: scenario.title,
        completion_count: 0, // Demo doesn't track this
        average_score: 0,
        max_score: 0
      }))
    },
  });
});

app.get("/api/admin/leaderboard", authenticateAdmin, (req, res) => {
  const leaderboard = Array.from(mockTeams.values())
    .map(team => ({
      id: team.id,
      team_name: team.name,
      current_position: team.currentPosition,
      total_score: team.totalScore,
      created_at: new Date().toISOString(),
      player_count: team.players.length,
      completed_scenarios: Math.max(0, team.currentPosition - 1),
      average_score: team.currentPosition > 1 ? team.totalScore / (team.currentPosition - 1) : 0,
      last_activity: new Date().toISOString()
    }))
    .sort((a, b) => b.total_score - a.total_score);

  res.json({
    success: true,
    data: leaderboard,
  });
});

// Reset game for all teams (demo version)
app.post("/api/admin/reset-game", authenticateAdmin, (req, res) => {
  try {
    // Reset all teams to position 1 and score 0
    for (const [teamName, team] of mockTeams) {
      team.currentPosition = 1;
      team.totalScore = 0;
    }

    // Clear all decisions
    mockDecisions.clear();

    // Reset game state
    gameState = 'waiting';
    currentStep = 1;

    // Reset connected teams data
    for (const [teamId, teamData] of connectedTeams) {
      teamData.position = 1;
      teamData.score = 0;
      teamData.isCompleted = false;
    }

    serverLogger.system('game', 'reset', {
      adminSocketId: req.admin.id,
      teamsReset: mockTeams.size,
      connectedTeamsReset: connectedTeams.size
    });

    res.json({
      success: true,
      message: "Game reset successfully for all teams",
    });
  } catch (error) {
    console.error("Reset game error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.get("/api/game/scenario/:position", (req, res) => {
  const position = parseInt(req.params.position);
  const scenario = gameScenarios.find((s) => s.position === position);

  if (!scenario) {
    return res.status(404).json({
      success: false,
      message: "Scenario not found",
    });
  }

  res.json({
    success: true,
    data: {
      position: scenario.position,
      title: scenario.title,
      scenarioText: scenario.scenarioText,
    },
  });
});

app.post("/api/game/submit-decision/:position", (req, res) => {
  const position = parseInt(req.params.position);
  const { decision, reasoning } = req.body;

  // Simple demo scoring
  const score = Math.floor(Math.random() * 16); // 0-15

  res.json({
    success: true,
    message: "Decision submitted successfully",
    data: {
      score,
      newPosition: position + 1,
      newTotalScore: score,
      isGameComplete: position >= 7,
    },
  });
});

app.get("/api/game/leaderboard", (req, res) => {
  const leaderboard = Array.from(mockTeams.values())
    .map((team) => ({
      team_name: team.name,
      total_score: team.totalScore,
      current_position: team.currentPosition,
      player_count: team.players.length,
    }))
    .sort((a, b) => b.total_score - a.total_score);

  res.json({
    success: true,
    data: leaderboard,
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Tuna Adventure Game API is running (DEMO MODE)",
    timestamp: new Date().toISOString(),
    version: "1.0.0-demo",
  });
});

// Admin panel route
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Log viewer route
app.get("/logs", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "log-viewer.html"));
});

// Log statistics API
app.get("/api/logs/stats", (req, res) => {
  try {
    const stats = serverLogger.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get log statistics",
      error: error.message
    });
  }
});

// Export logs API
app.get("/api/logs/export", (req, res) => {
  try {
    const exportFile = serverLogger.exportLogs();
    res.download(exportFile, `tuna_server_logs_${new Date().toISOString().split('T')[0]}.json`);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to export logs",
      error: error.message
    });
  }
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
    message: "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Export io for use in routes
app.set('io', io);

// Start server
const startServer = async () => {
  try {
    // Start HTTP server with WebSocket
    server.listen(PORT, () => {
      serverLogger.system('server', 'started', {
        port: PORT,
        mode: 'DEMO',
        features: ['WebSocket', 'REST API', 'Admin Panel']
      });
      
      console.log(`🚀 Tuna Adventure Game DEMO server running on port ${PORT}`);
      console.log(`📱 Frontend: http://localhost:${PORT}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`💚 Health: http://localhost:${PORT}/api/health`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`\n🎮 DEMO MODE: Game berjalan tanpa database`);
      console.log(`📝 Data akan hilang saat server restart`);
      console.log(`\n🎯 Silakan buka browser dan coba game!`);
      console.log(`👨‍💼 Admin Panel: http://localhost:${PORT}/admin`);
    });
  } catch (error) {
    serverLogger.error("Failed to start server", { error: error.message, stack: error.stack });
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

// Start the server
startServer();
