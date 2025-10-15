// Demo version without database - for testing
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
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
  max: 100, // limit each IP to 100 requests per windowMs
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

// Generate demo token
const generateDemoToken = (teamId) => {
  return `demo_token_${teamId}_${Date.now()}`;
};

// Demo API routes
app.post("/api/auth/register", (req, res) => {
  const { teamName, password, players } = req.body;

  if (mockTeams.has(teamName)) {
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

  res.status(201).json({
    success: true,
    message: "Team registered successfully",
    data: {
      teamId,
      teamName,
      token,
      players: players ? players.length : 0,
    },
  });
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
];

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

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`🚀 Tuna Adventure Game DEMO server running on port ${PORT}`);
      console.log(`📱 Frontend: http://localhost:${PORT}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`💚 Health: http://localhost:${PORT}/api/health`);
      console.log(`\n🎮 DEMO MODE: Game berjalan tanpa database`);
      console.log(`📝 Data akan hilang saat server restart`);
      console.log(`\n🎯 Silakan buka browser dan coba game!`);
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

// Start the server
startServer();
