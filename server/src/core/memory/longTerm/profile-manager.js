/**
 * NOTE (profile-manager.js):
 * Purpose: Manage user memory profile organized by categories (USER_PREFERENCES, STRATEGIC_GOALS, etc.).
 * Controls: Category-based retrieval, profile updates, category statistics.
 * Integration notes: Works with long-term-memory.js and LongTermMemory schema.
 */

const LongTermMemoryModel = require('../../../database/schemas/long-term-memory-schema');
const { LTM_CATEGORIES } = require('../shared/memory-types');

/**
 * Get user profile by category
 * @param {string} userId - User ID
 * @param {string} category - Memory category
 * @returns {Promise<Array>} - Memory items in category
 */
async function getProfileByCategory(userId, category) {
  if (!Object.values(LTM_CATEGORIES).includes(category)) {
    throw new Error(`Invalid category: ${category}`);
  }

  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (!ltm) {
    return [];
  }

  return ltm.getByCategory(category);
}

/**
 * Get full user profile
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Profile organized by categories
 */
async function getFullProfile(userId) {
  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (!ltm) {
    return createEmptyProfile();
  }

  const profile = createEmptyProfile();

  for (const item of ltm.memoryItems) {
    if (!profile[item.category]) {
      profile[item.category] = [];
    }
    profile[item.category].push({
      content: item.content,
      impactScore: item.impactScore,
      sourceChats: item.sourceChats,
      createdAt: item.createdAt,
      accessCount: item.accessCount
    });
  }

  return profile;
}

/**
 * Get top memories across all categories
 * @param {string} userId - User ID
 * @param {number} limit - Max memories to return
 * @returns {Promise<Array>} - Top memories by impact
 */
async function getTopMemories(userId, limit = 10) {
  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (!ltm) {
    return [];
  }

  return ltm.getTopMemories(limit);
}

/**
 * Get category statistics
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Stats by category
 */
async function getCategoryStats(userId) {
  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (!ltm) {
    return {};
  }

  const stats = {};

  for (const category of Object.values(LTM_CATEGORIES)) {
    const items = ltm.getByCategory(category);
    
    if (items.length > 0) {
      const totalImpact = items.reduce((sum, item) => sum + item.impactScore, 0);
      const wordCounts = items.map(item => item.content.split(/\s+/).length);
      const totalWords = wordCounts.reduce((sum, w) => sum + w, 0);

      stats[category] = {
        count: items.length,
        averageImpact: (totalImpact / items.length).toFixed(2),
        totalWords,
        averageWords: Math.round(totalWords / items.length)
      };
    } else {
      stats[category] = {
        count: 0,
        averageImpact: 0,
        totalWords: 0,
        averageWords: 0
      };
    }
  }

  return stats;
}

/**
 * Update memory access stats
 * @param {string} userId - User ID
 * @param {string} memoryId - Memory item ID
 * @returns {Promise<boolean>} - Success
 */
async function trackMemoryAccess(userId, memoryId) {
  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (!ltm) {
    return false;
  }

  return ltm.trackAccess(memoryId);
}

/**
 * Remove memory by ID
 * @param {string} userId - User ID
 * @param {string} memoryId - Memory item ID
 * @returns {Promise<boolean>} - Success
 */
async function removeMemory(userId, memoryId) {
  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (!ltm) {
    return false;
  }

  const vectorStore = require('./vector-store');

  // Find item to get vectorId
  const item = ltm.memoryItems.id(memoryId);
  if (!item) {
    return false;
  }

  // Delete vector embedding
  if (item.vectorId) {
    await vectorStore.deleteEmbedding(item.vectorId);
  }

  // Remove item
  const wordCount = item.content.split(/\s+/).length;
  item.remove();
  ltm.totalWordCount -= wordCount;
  await ltm.save();

  return true;
}

/**
 * Create empty profile structure
 * @returns {object} - Empty profile
 */
function createEmptyProfile() {
  const profile = {};
  for (const category of Object.values(LTM_CATEGORIES)) {
    profile[category] = [];
  }
  return profile;
}

module.exports = {
  getProfileByCategory,
  getFullProfile,
  getTopMemories,
  getCategoryStats,
  trackMemoryAccess,
  removeMemory
};
