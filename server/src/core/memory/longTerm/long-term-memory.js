/**
 * NOTE (long-term-memory.js):
 * Purpose: Core API for Long-Term Memory (LTM) - cross-chat curated user profile memories.
 * Controls: 1800-word budget total, 180 per category, impact score >0.7 required.
 * Behavior: propose() → curator validates → add date prefix → merge duplicates → store → update category description.
 * Integration notes: Uses LongTermMemory schema, vector-store.js for embeddings, memory-curator.js for validation.
 */

const LongTermMemoryModel = require('../../../database/schemas/long-term-memory-schema');
const memoryCurator = require('./memory-curator');
const memoryMerger = require('./memory-merger');
const wordCounter = require('../shared/word-counter');
const { MEMORY_BUDGETS } = require('../shared/memory-types');
const vectorStore = require('./vector-store'); // Old vector store (keep for backward compatibility)
const pineconeStore = require('./pinecone-store'); // NEW: Pinecone Vector Store
const { processDateInContent } = require('./memory-utils');
const { updateCategoryDescription, shouldUpdateDescription } = require('./category-description-updater');

/**
 * Propose memory for LTM storage
 * @param {string} userId - User ID
 * @param {string} content - Memory content
 * @param {string} category - Memory category
 * @param {Array<string>} sourceChats - Source chat IDs
 * @returns {Promise<object|null>} - Stored memory item or null if rejected
 */
async function propose(userId, content, category, sourceChats = []) {
  console.log('[LTM] 🎯 INÍCIO - Proposta de nova memória');
  console.log('[LTM] 📋 Dados:', {
    userId,
    category,
    contentLength: content?.length || 0,
    content: content?.substring(0, 100) + '...',
    sourceChats
  });
  
  // Validate with curator (hybrid rules + LLM)
  console.log('[LTM] 🔍 Enviando para curadoria...');
  const curationResult = await memoryCurator.curate(content, category);
  
  if (!curationResult.accepted) {
    console.log('[LTM] ❌ REJEITADO - Memória não aceita pela curadoria');
    console.log('[LTM] 📝 Razão:', curationResult.reason);
    console.log('[LTM] 📊 Score:', curationResult.impactScore);
    return null;
  }
  
  console.log('[LTM] ✅ ACEITO - Memória aprovada pela curadoria');
  console.log('[LTM] 📊 Impact Score:', curationResult.impactScore);
  console.log('[LTM] 📝 Conteúdo curado:', curationResult.content);

  // Use curated content (may be compressed/refined)
  let curatedContent = curationResult.content;
  const impactScore = curationResult.impactScore;

  // MANDATORY: Process date in content (extract or use current date, add "Em DD/MM/YYYY, " prefix)
  console.log('[LTM] 📅 Processando data...');
  const { formattedContent, eventDate } = processDateInContent(curatedContent);
  curatedContent = formattedContent;
  console.log('[LTM] ✅ Data processada:', eventDate);
  console.log('[LTM] 📝 Conteúdo formatado:', formattedContent);

  // Check for duplicates and merge if needed
  console.log('[LTM] 🔍 Verificando duplicatas e merge...');
  const ltm = await LongTermMemoryModel.findOne({ userId });
  if (ltm) {
    const mergeResult = await memoryMerger.checkAndMerge(ltm, curatedContent, category, impactScore);
    if (mergeResult.merged) {
      console.log('[LTM] 🔄 MERGED - Memória mesclada com existente');
      console.log('[LTM] 📝 Item resultante:', mergeResult.memoryItem);
      return mergeResult.memoryItem;
    }
    console.log('[LTM] ➕ Não houve merge, adicionando como nova memória');
  } else {
    console.log('[LTM] 🆕 Primeiro item de LTM para este usuário');
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

  // Create new memory item
  const newItem = {
    content: curatedContent,
    category,
    impactScore,
    sourceChats,
    eventDate,  // Date of the event described in memory
    createdAt: new Date(),
    lastAccessed: new Date(),
    accessCount: 0
  };

  // Add to LTM (MongoDB)
  let savedLtm = null;
  if (!ltm) {
    // Create new LTM document
    const wordCount = wordCounter.count(curatedContent);
    savedLtm = await LongTermMemoryModel.create({
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

    // Sync to Pinecone (upsert after MongoDB save)
    try {
      await pineconeStore.upsertMemory(userId, savedLtm.memoryItems[0]);
    } catch (error) {
      console.error('[LTM] Pinecone sync failed:', error.message);
      // Continue even if Pinecone fails (MongoDB is source of truth)
    }

    // Update category description (initial)
    await updateAndSaveCategoryDescription(savedLtm, category);
    console.log(`[LTM] Memory stored: category=${category}, impact=${impactScore.toFixed(2)}`);
    return savedLtm.memoryItems[0];
  } else {
    // Check budget PER CATEGORY
    const categoryBudget = MEMORY_BUDGETS.LONG_TERM_PER_CATEGORY;
    const categoryItems = ltm.getByCategory(category);
    const categoryWordCount = categoryItems.reduce((sum, item) => 
      sum + wordCounter.count(item.content), 0
    );

    if (categoryWordCount + wordCounter.count(curatedContent) > categoryBudget) {
      // Discard low-impact memories FROM THIS CATEGORY ONLY
      await discardLowImpactFromCategory(userId, category, wordCounter.count(curatedContent));
    }

    // Add new item to MongoDB
    ltm.memoryItems.push(newItem);
    ltm.totalWordCount += wordCounter.count(curatedContent);
    ltm.curationStats.totalProposed += 1;
    ltm.curationStats.totalAccepted += 1;
    ltm.curationStats.lastCuratedAt = new Date();
    await ltm.save();

    // Sync to Pinecone (upsert after MongoDB save)
    try {
      const savedItem = ltm.memoryItems[ltm.memoryItems.length - 1]; // Get the newly added item
      await pineconeStore.upsertMemory(userId, savedItem);
    } catch (error) {
      console.error('[LTM] Pinecone sync failed:', error.message);
      // Continue even if Pinecone fails (MongoDB is source of truth)
    }

    // Update category description (if needed)
    await updateAndSaveCategoryDescription(ltm, category);
  }

  console.log('[LTM] ✅ FIM - Memória armazenada com sucesso');
  console.log('[LTM] 📊 Resumo:', {
    category,
    impactScore: impactScore.toFixed(2),
    wordCount: wordCounter.count(curatedContent),
    eventDate,
    content: curatedContent.substring(0, 100) + '...'
  });
  return newItem;
}

/**
 * Retrieve relevant memories
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {object} options - Retrieval options
 * @param {string} options.category - Filter by category (optional)
 * @param {number} options.minImpact - Minimum impact score (default: 0.5)
 * @param {number} options.limit - Number of results (default: 5)
 * @param {boolean} options.useVectorSearch - Use Pinecone vector search (default: true)
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
    try {
      // Build Pinecone filter
      const filter = {};
      if (category) {
        filter.category = { $eq: category };
      }
      if (minImpact > 0) {
        filter.impactScore = { $gte: minImpact };
      }

      // Pinecone semantic search with reranking
      const pineconeResults = await pineconeStore.searchMemories(userId, query, {
        topK: limit,
        filter: Object.keys(filter).length > 0 ? filter : null
      });

      // Map Pinecone results back to MongoDB memory items and update access stats
      const memoryMap = new Map(ltm.memoryItems.map(item => [item._id.toString(), item]));
      
      results = pineconeResults.map(pr => {
        const item = memoryMap.get(pr.memoryId);
        if (item) {
          item.lastAccessed = new Date();
          item.accessCount += 1;
          return item;
        }
        return null;
      }).filter(item => item !== null);

      await ltm.save(); // Save updated access stats

    } catch (error) {
      console.error('[LTM] Pinecone search failed, falling back to MongoDB:', error.message);
      // Fallback to MongoDB filtering
      results = ltm.getByCategory(category);
      results = results
        .filter(item => item.impactScore >= minImpact)
        .sort((a, b) => b.impactScore - a.impactScore)
        .slice(0, limit);
    }
  } else {
    // Fallback: category and impact filtering (no vector search)
    results = category ? ltm.getByCategory(category) : ltm.memoryItems;
    results = results
      .filter(item => item.impactScore >= minImpact)
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, limit);
  }

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
  }

  // Delete from Pinecone (batch delete)
  if (toRemove.length > 0) {
    try {
      await pineconeStore.deleteMemoriesBatch(userId, toRemove.map(id => id.toString()));
    } catch (error) {
      console.error('[LTM] Pinecone batch delete failed:', error.message);
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
  }

  // Delete from Pinecone (batch delete)
  if (toRemove.length > 0) {
    try {
      await pineconeStore.deleteMemoriesBatch(userId, toRemove.map(id => id.toString()));
    } catch (error) {
      console.error('[LTM] Pinecone batch delete failed:', error.message);
    }
  }

  ltm.memoryItems = ltm.memoryItems.filter(item => !toRemove.includes(item._id));
  ltm.totalWordCount -= wordsFreed;
  await ltm.save();

  console.log(`[LTM] Discarded ${toRemove.length} low-impact memories from category '${category}', freed ${wordsFreed} words`);
  return wordsFreed;
}

/**
 * Update category description if needed and save to database
 * @param {object} ltm - LongTermMemory document
 * @param {string} category - Category to update
 * @returns {Promise<void>}
 */
async function updateAndSaveCategoryDescription(ltm, category) {
  const categoryMemories = ltm.getByCategory(category);
  const currentDescription = ltm.categoryDescriptions[category];

  // Check if update is needed
  if (!shouldUpdateDescription(currentDescription, categoryMemories.length)) {
    return;
  }

  try {
    // Generate new description
    const newDescription = await updateCategoryDescription(categoryMemories, category);

    // Update in document
    if (!ltm.categoryDescriptions[category]) {
      ltm.categoryDescriptions[category] = {};
    }
    
    ltm.categoryDescriptions[category].description = newDescription;
    ltm.categoryDescriptions[category].lastUpdated = new Date();
    ltm.categoryDescriptions[category].updateCount = (currentDescription?.updateCount || 0) + 1;

    // Save changes
    await ltm.save();
    
    console.log(`[LTM] Updated category description for '${category}': "${newDescription}"`);
  } catch (error) {
    console.error(`[LTM] Failed to update category description for '${category}':`, error.message);
  }
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
