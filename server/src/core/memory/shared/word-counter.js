/**
 * NOTE (word-counter.js):
 * Purpose: Accurate word counting for memory budget management.
 * Controls: Counts words in strings and JSON objects, calculates budget usage percentages,
 * detects when memory is near limit to trigger compression.
 * Integration notes: Used by all memory types to enforce word budgets.
 */

/**
 * Count words in a string
 * @param {string} text - Text to count
 * @returns {number} - Word count
 */
function countWordsInString(text) {
  if (!text || typeof text !== 'string') return 0;
  
  // Trim and split by whitespace, filter empty strings
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Count words in a JSON object recursively
 * @param {*} obj - Object to count words from
 * @returns {number} - Total word count
 */
function countWordsInObject(obj) {
  if (!obj) return 0;
  
  if (typeof obj === 'string') {
    return countWordsInString(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return 1; // Count primitives as 1 word
  }
  
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + countWordsInObject(item), 0);
  }
  
  if (typeof obj === 'object') {
    return Object.values(obj).reduce((sum, value) => sum + countWordsInObject(value), 0);
  }
  
  return 0;
}

/**
 * Count words in content (auto-detects string or object)
 * @param {string|object} content - Content to count
 * @returns {number} - Word count
 */
function count(content) {
  if (!content) return 0;
  
  if (typeof content === 'string') {
    return countWordsInString(content);
  }
  
  return countWordsInObject(content);
}

/**
 * Check if current word count is near the limit
 * @param {number} currentCount - Current word count
 * @param {number} limit - Maximum allowed words
 * @param {number} threshold - Threshold percentage (0.0 to 1.0, default 0.8)
 * @returns {boolean} - True if near limit
 */
function isNearLimit(currentCount, limit, threshold = 0.8) {
  if (limit === Infinity) return false;
  return currentCount >= (limit * threshold);
}

/**
 * Calculate percentage of budget used
 * @param {number} currentCount - Current word count
 * @param {number} limit - Maximum allowed words
 * @returns {number} - Percentage (0-100)
 */
function percentageUsed(currentCount, limit) {
  if (limit === Infinity) return 0;
  if (limit === 0) return 100;
  return Math.min(100, (currentCount / limit) * 100);
}

/**
 * Calculate remaining words
 * @param {number} currentCount - Current word count
 * @param {number} limit - Maximum allowed words
 * @returns {number} - Remaining words (Infinity if no limit)
 */
function remainingWords(currentCount, limit) {
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - currentCount);
}

module.exports = {
  count,
  countWordsInString,
  countWordsInObject,
  isNearLimit,
  percentageUsed,
  remainingWords
};
