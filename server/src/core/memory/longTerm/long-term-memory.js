/**
 * NOTE (long-term-memory.js):
 * Purpose: Core API for Long-Term Memory (LTM) - cross-chat curated user profile memories.
 * Controls: 400-word budget, impact score >0.7 required, category-based organization.
 * Behavior: propose() → curator validates → merge duplicates → store with vector embedding.
 * Integration notes: Uses LongTermMemory schema, vector-store.js for embeddings, memory-curator.js for validation.
 */

const { getCategoryDefinition } = require('./category-definitions');
const { MEMORY_BUDGETS } = require('../shared/memory-types');


const LongTermMemoryModel = require('../../../database/schemas/long-term-memory-schema');
const memoryCurator = require('./memory-curator');
const memoryMerger = require('./memory-merger');
const wordCounter = require('../shared/word-counter');
const { MEMORY_BUDGETS } = require('../shared/memory-types');
const vectorStore = require('./vector-store');

/**
 * Propose memory for LTM storage
 * @param {string} userId - User ID
 * @param {string} content - Memory content
 * @param {string} category - Memory category
 * @param {Array<string>} sourceChats - Source chat IDs
 * @returns {Promise<object|null>} - Stored memory item or null if rejected
 */
async function propose(userId, content, category, sourceChats = []) {
  // Validate with curator (hybrid rules + LLM)
  const curationResult = await memoryCurator.curate(content, category);
  
  if (!curationResult.accepted) {
    console.log(`[LTM] Memory rejected: ${curationResult.reason}`);
    return null;
  }

  // Use curated content (may be compressed/refined)
  const curatedContent = curationResult.content;
  const impactScore = curationResult.impactScore;

  // Check for duplicates and merge if needed
  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (ltm) {
    const mergeResult = await memoryMerger.checkAndMerge(ltm, curatedContent, category, impactScore);
    if (mergeResult.merged) {
      console.log(`[LTM] Merged with existing memory`);
      return mergeResult.memoryItem;
    }
  }

  // Verificar orçamento POR CATEGORIA
const categoryBudget = MEMORY_BUDGETS.LONG_TERM_PER_CATEGORY;
const categoryItems = ltm ? ltm.getByCategory(category) : [];
const categoryWordCount = categoryItems.reduce((sum, item) => 
  sum + wordCounter.count(item.content), 0
);

if (categoryWordCount + wordCounter.count(curatedContent) > categoryBudget) {
  // Descartar memórias de menor impacto DESTA CATEGORIA
  await discardLowImpactFromCategory(userId, category, wordCounter.count(curatedContent));
}

  // Generate vector embedding
  const vectorId = await vectorStore.storeEmbedding(userId, curatedContent, { category, impactScore });

  // Create new memory item
  const newItem = {
    content: curatedContent,
    category,
    impactScore,
    sourceChats,
    vectorId,
    createdAt: new Date(),
    lastAccessed: new Date(),
    accessCount: 0
  };

  // Add to LTM
  if (!ltm) {
    // Create new LTM document
    const wordCount = wordCounter.count(curatedContent);
    await LongTermMemoryModel.create({
      userId,
      memoryItems: [newItem],
      totalWordCount: wordCount,
      curationStats: {
        totalProposed: 1,
        totalAccepted: 1,
        totalRejected: 0,
        lastCuratedAt: new Date()
      }
    });
  } else {
    // Check budget PER CATEGORY (não mais budget global)
    const categoryBudget = MEMORY_BUDGETS.LONG_TERM_PER_CATEGORY; // 350 palavras
    const categoryItems = ltm.getByCategory(category);
    const categoryWordCount = categoryItems.reduce((sum, item) => 
      sum + wordCounter.count(item.content), 0
    );

    if (categoryWordCount + wordCounter.count(curatedContent) > categoryBudget) {
      // Discard low-impact memories FROM THIS CATEGORY ONLY
      await discardLowImpactFromCategory(userId, category, wordCounter.count(curatedContent));
    }

    // Add new item
    ltm.memoryItems.push(newItem);
    ltm.totalWordCount += wordCounter.count(curatedContent);
    ltm.curationStats.totalProposed += 1;
    ltm.curationStats.totalAccepted += 1;
    ltm.curationStats.lastCuratedAt = new Date();
    await ltm.save();
  }

  console.log(`[LTM] Memory stored: category=${category}, impact=${impactScore.toFixed(2)}`);
  return newItem;
}

/**
 * Retrieve relevant memories
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {object} options - Retrieval options
 * @returns {Promise<Array>} - Relevant memories
 */
async function retrieve(userId, query, options = {}) {
  const {
    category = null,
    minImpact = 0.5,
    limit = 5,
    useVectorSearch = true
  } = options;

  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (!ltm) {
    return [];
  }

  let results = [];

  if (useVectorSearch && query) {
    // Vector-based semantic search
    const vectorResults = await vectorStore.search(userId, query, { limit: limit * 2 });
    
    // Map vectorIds to memory items
    results = ltm.memoryItems.filter(item => 
      vectorResults.some(v => v.id === item.vectorId)
    );

    // Update access stats
    for (const item of results) {
      item.lastAccessed = new Date();
      item.accessCount += 1;
    }
    await ltm.save();
  } else {
    // Fallback: category and impact filtering
    results = ltm.getByCategory(category);
  }

  // Filter by impact and limit
  results = results
    .filter(item => item.impactScore >= minImpact)
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, limit);

  return results;
}

/**
 * Merge episodic memory into LTM
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID
 * @param {object} episodicData - Episodic memory data
 * @returns {Promise<Array>} - Newly promoted memories
 */
async function merge(userId, chatId, episodicData) {
  const promoted = [];

  // Extract high-impact information from episodic memory
  const candidates = await memoryCurator.extractHighImpact(episodicData);

  for (const candidate of candidates) {
    const result = await propose(
      userId,
      candidate.content,
      candidate.category,
      [chatId]
    );

    if (result) {
      promoted.push(result);
    }
  }

  console.log(`[LTM] Merged ${promoted.length} memories from chat ${chatId}`);
  return promoted;
}

/**
 * Calculate impact score for content
 * @param {string} content - Memory content
 * @param {object} context - Context data
 * @returns {Promise<number>} - Impact score (0-1)
 */
async function calculateImpact(content, context = {}) {
  const relevanceCalculator = require('./relevance-calculator');
  return relevanceCalculator.calculate(content, context);
}

/**
 * Discard low-impact memories to free space
 * @param {string} userId - User ID
 * @param {number} spaceNeeded - Words needed
 * @returns {Promise<number>} - Words freed
 */
async function discardLowImpact(userId, spaceNeeded) {
  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (!ltm) {
    return 0;
  }


  // Sort by impact (ascending)
  const sorted = [...ltm.memoryItems].sort((a, b) => a.impactScore - b.impactScore);


  let wordsFreed = 0;
  const toRemove = [];

  for (const item of sorted) {
    if (wordsFreed >= spaceNeeded) {
      break;
    }

    const itemWords = wordCounter.count(item.content);
    wordsFreed += itemWords;
    toRemove.push(item._id);

    // Delete vector embedding
    if (item.vectorId) {
      await vectorStore.deleteEmbedding(item.vectorId);
    }
  }

  // Remove items
  ltm.memoryItems = ltm.memoryItems.filter(item => !toRemove.includes(item._id));
  ltm.totalWordCount -= wordsFreed;
  await ltm.save();

  console.log(`[LTM] Discarded ${toRemove.length} low-impact memories, freed ${wordsFreed} words`);
  return wordsFreed;
}

/**
 * Discard low-impact memories from specific category
 * @param {string} userId - User ID
 * @param {string} category - Category name
 * @param {number} spaceNeeded - Words needed
 * @returns {Promise<number>} - Words freed
 */
async function discardLowImpactFromCategory(userId, category, spaceNeeded) {
  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (!ltm) return 0;

  // Get items from this category only, sorted by impact (ascending)
  const categoryItems = ltm.getByCategory(category)
    .sort((a, b) => a.impactScore - b.impactScore);

  let wordsFreed = 0;
  const toRemove = [];

  for (const item of categoryItems) {
    if (wordsFreed >= spaceNeeded) break;

    const itemWords = wordCounter.count(item.content);
    wordsFreed += itemWords;
    toRemove.push(item._id);

    if (item.vectorId) {
      await vectorStore.deleteEmbedding(item.vectorId);
    }
  }

  ltm.memoryItems = ltm.memoryItems.filter(item => !toRemove.includes(item._id));
  ltm.totalWordCount -= wordsFreed;
  await ltm.save();

  console.log(`[LTM] Discarded ${toRemove.length} low-impact memories from category '${category}', freed ${wordsFreed} words`);
  return wordsFreed;
}


/**
 * Get memory statistics
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Stats
 */
async function getStats(userId) {
  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (!ltm) {
    return {
      totalItems: 0,
      totalWords: 0,
      budgetUsed: 0,
      topCategories: [],
      averageImpact: 0
    };
  }

  const categoryCount = {};
  let totalImpact = 0;

  for (const item of ltm.memoryItems) {
    categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    totalImpact += item.impactScore;
  }

  const topCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  return {
    totalItems: ltm.memoryItems.length,
    totalWords: ltm.totalWordCount,
    budgetUsed: (ltm.totalWordCount / MEMORY_BUDGETS.LONG_TERM * 100).toFixed(1),
    topCategories,
    averageImpact: ltm.memoryItems.length > 0 ? (totalImpact / ltm.memoryItems.length).toFixed(2) : 0,
    curationStats: ltm.curationStats
  };
}

module.exports = {
  propose,
  retrieve,
  merge,
  calculateImpact,
  discardLowImpact,
  getStats,
  discardLowImpactFromCategory
};
