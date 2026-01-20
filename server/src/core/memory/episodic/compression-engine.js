/**
 * NOTE (compression-engine.js):
 * Purpose: Trigger and manage automatic compression of episodic memories.
 * Controls: Monitors word count, triggers compression at 80% threshold, uses LLM or rule-based methods.
 * Integration notes: Called automatically by episodic-memory.js when memory approaches limit.
 */

const { count, isNearLimit } = require('../shared/word-counter');
const { compress } = require('../shared/memory-compressor');
const { MEMORY_BUDGETS } = require('../shared/memory-types');

/**
 * Check if compression is needed
 * @param {*} content - Memory content
 * @param {number} threshold - Threshold (0.0 to 1.0, default 0.8)
 * @returns {boolean} - True if compression needed
 */
function needsCompression(content, threshold = 0.8) {
  const wordCount = count(content);
  const budget = MEMORY_BUDGETS.EPISODIC;
  return isNearLimit(wordCount, budget, threshold);
}

/**
 * Compress episodic memory content
 * @param {*} content - Memory content to compress
 * @param {object} options - Compression options
 * @param {number} options.targetPercent - Target percentage of budget (default: 0.6)
 * @param {Function} options.llmFunction - LLM function for intelligent compression
 * @param {boolean} options.preferRuleBased - Use rule-based compression
 * @returns {Promise<object>} - Compressed content and metadata
 */
async function compressEpisodicMemory(content, options = {}) {
  const { targetPercent = 0.6, llmFunction = null, preferRuleBased = false } = options;

  const budget = MEMORY_BUDGETS.EPISODIC;
  const currentWords = count(content);
  const targetWords = Math.floor(budget * targetPercent);

  if (currentWords <= targetWords) {
    return {
      compressed: content,
      wordsBefore: currentWords,
      wordsAfter: currentWords,
      compressionRatio: 1.0,
      method: 'none'
    };
  }

  const compressed = await compress(content, targetWords, { llmFunction, preferRuleBased });
  const wordsAfter = count(compressed);

  return {
    compressed,
    wordsBefore: currentWords,
    wordsAfter,
    compressionRatio: wordsAfter / currentWords,
    method: preferRuleBased || !llmFunction ? 'rule-based' : 'llm'
  };
}

module.exports = {
  needsCompression,
  compressEpisodicMemory
};
