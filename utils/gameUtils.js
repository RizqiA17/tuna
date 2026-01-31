const { executeQuery } = require("../config/database");

// Helper function to get game setting
async function getGameSetting(key, defaultValue = null) {
  try {
    const result = await executeQuery(
      "SELECT setting_value FROM game_settings WHERE setting_key = ?",
      [key]
    );
    if (result.length > 0) {
      return result[0].setting_value;
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error getting game setting ${key}:`, error);
    return defaultValue;
  }
}

// Simple scoring algorithm based on keyword matching
function calculateScore(
  decision,
  reasoning,
  standardAnswer,
  standardReasoning
) {
  const standardKeywords = extractKeywords(
    standardAnswer + " " + standardReasoning
  );
  const teamKeywords = extractKeywords(decision + " " + reasoning);

  const matchingKeywords = standardKeywords.filter((keyword) =>
    teamKeywords.some(
      (teamKeyword) =>
        teamKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(teamKeyword.toLowerCase())
    )
  );

  const similarityRatio =
    matchingKeywords.length / Math.max(standardKeywords.length, 1);

  // Score based on similarity
  if (similarityRatio >= 0.8) return 15;
  if (similarityRatio >= 0.6) return 12;
  if (similarityRatio >= 0.4) return 10;
  if (similarityRatio >= 0.2) return 7;
  if (similarityRatio >= 0.1) return 5;
  return 0;
}

function extractKeywords(text) {
  const stopWords = [
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
  ];

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.includes(word));
}

module.exports = {
  getGameSetting,
  calculateScore,
  extractKeywords,
};