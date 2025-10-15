// Copy this file to config.js and fill in your actual values
module.exports = {
  database: {
    host: "localhost",
    user: "root",
    password: "your_password",
    database: "tuna_adventure",
  },
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "development",
  },
  jwt: {
    secret: "your_super_secret_jwt_key_here_change_this",
  },
  game: {
    sessionTimeout: 3600000, // 1 hour in milliseconds
    maxTeams: 10,
    maxPlayersPerTeam: 5,
  },
};
