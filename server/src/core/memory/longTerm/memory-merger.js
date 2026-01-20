/**
 * NOTE (memory-merger.js):
 * Purpose: Detect duplicate memories and merge them intelligently to avoid redundancy.
 * Controls: Similarity detection (vector + keyword), fusion logic, impact score combination.
 * Behavior: checkAndMerge() → find similar → calculate fusion → update existing or add new.
 * Integration notes: Uses embedding-generator.js for similarity, vector-store.js for search.
 */

const embeddingGenerator = require('../shared/embedding-generator');
const vectorStore = require('./vector-store');
const wordCounter = require('../shared/word-counter');
const { SIMILARITY_THRESHOLDS } = require('../shared/memory-types');

/**
 * Check for duplicates and merge if needed
 * @param {object} ltm - LongTermMemory document
 * @param {string} newContent - New memory content
 * @param {string} category - Memory category
 * @param {number} impactScore - Impact score
 * @returns {Promise<object>} - Merge result
 */
async function checkAndMerge(ltm, newContent, category, impactScore) {
  // Find similar memories in the same category
  const categoryItems = ltm.getByCategory(category);
  
  if (categoryItems.length === 0) {
    return { merged: false, memoryItem: null };
  }

  // Generate embedding for new content
  const newEmbedding = await embeddingGenerator.generate(newContent);

  // Find most similar memory
  const similarities = [];
  for (const item of categoryItems) {
    const itemEmbedding = await vectorStore.getEmbedding(item.vectorId);
    if (itemEmbedding) {
      const similarity = embeddingGenerator.cosineSimilarity(newEmbedding, itemEmbedding);
      similarities.push({ item, similarity });
    }
  }

  // Sort by similarity (descending)
  similarities.sort((a, b) => b.similarity - a.similarity);

  // Check if top match is similar enough (threshold from constants)
  if (similarities.length > 0 && similarities[0].similarity >= SIMILARITY_THRESHOLDS.MERGE_THRESHOLD) {
    const match = similarities[0].item;
    console.log(`[Merger] Similar memory found (similarity: ${similarities[0].similarity.toFixed(2)}), merging...`);

    // Merge memories
    const mergedContent = await fuseMemories(match.content, newContent);
    const mergedImpact = Math.max(match.impactScore, impactScore);

    // Update existing memory
    match.content = mergedContent;
    match.impactScore = mergedImpact;
    match.lastAccessed = new Date();
    match.accessCount += 1;

    // Update vector embedding
    await vectorStore.updateEmbedding(match.vectorId, mergedContent);

    // Update word count
    const oldWords = wordCounter.count(match.content);
    const newWords = wordCounter.count(mergedContent);
    ltm.totalWordCount += (newWords - oldWords);

    await ltm.save();

    return {
      merged: true,
      memoryItem: match,
      similarity: similarities[0].similarity
    };
  }

  return { merged: false, memoryItem: null };
}

/**
 * Fuse two memory contents intelligently
 * @param {string} existing - Existing memory
 * @param {string} newContent - New memory
 * @returns {Promise<string>} - Fused content
 */
async function fuseMemories(existing, newContent) {
  // TODO: Implement LLM-based fusion
  // For now, use simple concatenation with deduplication

  const existingParts = existing.split(/[.!?]+/).map(s => s.trim()).filter(s => s);
  const newParts = newContent.split(/[.!?]+/).map(s => s.trim()).filter(s => s);

  // Remove duplicate sentences
  const uniqueParts = [...new Set([...existingParts, ...newParts])];

  // Join with periods
  return uniqueParts.join('. ') + '.';

  /*
  // LLM-based fusion (future implementation)
  const prompt = `Merge these two related memories into one concise memory:
Memory 1: ${existing}
Memory 2: ${newContent}

Merged memory (preserve all unique information, max 100 words):`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    temperature: 0.3
  });

  return response.choices[0].message.content.trim();
  */
}

/**
 * Detect duplicates across all categories
 * @param {object} ltm - LongTermMemory document
 * @param {number} threshold - Similarity threshold (default: SIMILARITY_THRESHOLDS.DUPLICATE_THRESHOLD)
 * @returns {Promise<Array>} - Duplicate pairs
 */
async function detectDuplicates(ltm, threshold = SIMILARITY_THRESHOLDS.DUPLICATE_THRESHOLD) {
  const duplicates = [];
  const items = ltm.memoryItems;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const item1 = items[i];
      const item2 = items[j];

      // Skip if different categories (usually not duplicates)
      if (item1.category !== item2.category) {
        continue;
      }

      // Get embeddings
      const emb1 = await vectorStore.getEmbedding(item1.vectorId);
      const emb2 = await vectorStore.getEmbedding(item2.vectorId);

      if (emb1 && emb2) {
        const similarity = embeddingGenerator.cosineSimilarity(emb1, emb2);
        
        if (similarity >= threshold) {
          duplicates.push({
            item1: item1._id,
            item2: item2._id,
            similarity,
            category: item1.category
          });
        }
      }
    }
  }

  return duplicates;
}

/**
 * Batch merge duplicates
 * @param {string} userId - User ID
 * @param {number} threshold - Similarity threshold (default: SIMILARITY_THRESHOLDS.DUPLICATE_THRESHOLD)
 * @returns {Promise<number>} - Number of merges performed
 */
async function batchMergeDuplicates(userId, threshold = SIMILARITY_THRESHOLDS.DUPLICATE_THRESHOLD) {
  const LongTermMemoryModel = require('../../../database/schemas/long-term-memory-schema');
  const ltm = await LongTermMemoryModel.findOne({ userId });
  
  if (!ltm) {
    return 0;
  }

  const duplicates = await detectDuplicates(ltm, threshold);
  let mergeCount = 0;

  for (const dup of duplicates) {
    const item1 = ltm.memoryItems.id(dup.item1);
    const item2 = ltm.memoryItems.id(dup.item2);

    if (item1 && item2) {
      // Merge into item with higher impact
      const [keeper, removed] = item1.impactScore >= item2.impactScore 
        ? [item1, item2] 
        : [item2, item1];

      // Fuse contents
      const mergedContent = await fuseMemories(keeper.content, removed.content);
      keeper.content = mergedContent;
      keeper.impactScore = Math.max(keeper.impactScore, removed.impactScore);
      keeper.sourceChats = [...new Set([...keeper.sourceChats, ...removed.sourceChats])];
      keeper.accessCount += removed.accessCount;

      // Update vector
      await vectorStore.updateEmbedding(keeper.vectorId, mergedContent);

      // Remove duplicate
      await vectorStore.deleteEmbedding(removed.vectorId);
      removed.remove();

      mergeCount++;
    }
  }

  if (mergeCount > 0) {
    // Recalculate word count
    let totalWords = 0;
    for (const item of ltm.memoryItems) {
      totalWords += wordCounter.count(item.content);
    }
    ltm.totalWordCount = totalWords;

    await ltm.save();
    console.log(`[Merger] Batch merged ${mergeCount} duplicates for user ${userId}`);
  }

  return mergeCount;
}

module.exports = {
  checkAndMerge,
  fuseMemories,
  detectDuplicates,
  batchMergeDuplicates
};
