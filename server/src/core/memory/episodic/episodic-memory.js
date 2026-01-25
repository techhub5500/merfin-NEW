/**
 * NOTE (episodic-memory.js):
 * Purpose: Manage persistent per-chat memories with AI curation and automatic compression.
 * Controls: CRUD operations for chat-specific context with AI validation, word budget enforcement (500 words),
 * automatic compression at 80% threshold, and expiration management.
 * Integration notes: Persists to MongoDB via episodic-memory-schema; uses OpenAI GPT-4.1 nano for curation.
 */

const EpisodicMemoryModel = require('../../../database/schemas/episodic-memory-schema');
const { count, isNearLimit } = require('../shared/word-counter');
const { validateMemory } = require('../shared/memory-validator');
const { compress } = require('../shared/memory-compressor');
const { MEMORY_SCOPES, MEMORY_BUDGETS } = require('../shared/memory-types');
const { CLEANUP_RULES, COMPRESSION_TRIGGERS } = require('../shared/hard-rules');
const { callOpenAIJSON } = require('../../../config/openai-config');
const contentValidator = require('../shared/content-validator');

// Debug: Verify CLEANUP_RULES is properly loaded
console.log('[EpisodicMemory] 🔍 CLEANUP_RULES loaded:', {
  exists: !!CLEANUP_RULES,
  EPISODIC_INACTIVITY_DAYS: CLEANUP_RULES?.EPISODIC_INACTIVITY_DAYS,
  allKeys: Object.keys(CLEANUP_RULES || {})
});

/**
 * Curate content with REGEX PATTERNS (substitui IA, economiza ~600 tokens)
 * @param {object} content - Content to curate
 * @param {string} chatId - Chat identifier for context
 * @returns {Promise<Object>} - {allowed: boolean, reason: string, sanitizedContent: object}
 * @private
 */
async function _curateContent(content, chatId) {
  try {
    console.log('[EpisodicMemory] 🔍 Validando com REGEX (sem IA)...');
    
    // Usa validação por padrões ao invés de IA
    const result = contentValidator.validateEpisodicMemory(content, chatId);
    
    console.log('[EpisodicMemory] Validação:', result.allowed ? '✓ APROVADO' : '✗ REJEITADO', `-`, result.reason);
    
    return result;

  } catch (error) {
    console.warn('[EpisodicMemory] Erro na validação, usando fallback:', error.message);
    
    // Fallback: validação básica
    const validation = validateMemory(content, { scope: MEMORY_SCOPES.EPISODIC });
    return {
      allowed: validation.valid,
      reason: validation.valid ? 'Fallback validation passed' : validation.errors.join(', '),
      sanitizedContent: content
    };
  }
}

/**
 * DEPRECATED: Curate content with AI (substituído por regex)
 * @private
 */
// (AI-based curation removed - deprecated implementation deleted)

/**
 * Create a new episodic memory for a chat (with AI curation)
 * @param {string} chatId - Unique chat identifier
 * @param {string} userId - User ID
 * @param {object} initialContent - Initial memory content (optional)
 * @returns {Promise<object>} - Created episodic memory
 */
async function create(chatId, userId, initialContent = {}) {
  if (!chatId || !userId) {
    throw new Error('chatId and userId are required');
  }

  // Check if chat memory already exists
  const existing = await EpisodicMemoryModel.findByChatId(chatId);
  if (existing) {
    throw new Error(`Episodic memory for chat ${chatId} already exists`);
  }

  // AI Curation
  const curation = await _curateContent(initialContent, chatId);
  if (!curation.allowed) {
    throw new Error(`Curation rejected: ${curation.reason}`);
  }
  
  console.log(`[EpisodicMemory] Content curated: ${curation.reason}`);
  const sanitizedContent = curation.sanitizedContent;

  // Validate sanitized content
  const validation = validateMemory(sanitizedContent, { scope: MEMORY_SCOPES.EPISODIC });
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // Calculate word count
  const wordCount = count(sanitizedContent);

  // Set expiration (30 days from now)
  const expiresAt = new Date(Date.now() + CLEANUP_RULES.EPISODIC_INACTIVITY_DAYS * 24 * 60 * 60 * 1000);

  // Create memory document
  const episodicMemory = new EpisodicMemoryModel({
    chatId,
    userId,
    episodicMemory: sanitizedContent,
    wordCount,
    expiresAt
  });

  await episodicMemory.save();
  return episodicMemory.toObject();
}

/**
 * Update episodic memory for a chat (with AI curation)
 * @param {string} chatId - Chat identifier
 * @param {object} content - New or updated content
 * @param {object} options - Update options
 * @param {boolean} options.merge - Merge with existing content (default: true)
 * @param {boolean} options.autoCompress - Auto-compress if near limit (default: true)
 * @param {boolean} options.skipCuration - Skip AI curation (default: false)
 * @param {Function} options.llmFunction - LLM function for compression
 * @returns {Promise<object>} - Updated memory
 */
async function update(chatId, content, options = {}) {
  const { merge = true, autoCompress = true, skipCuration = false, llmFunction = null } = options;

  if (!chatId || !content) {
    throw new Error('chatId and content are required');
  }

  const memory = await EpisodicMemoryModel.findByChatId(chatId);
  if (!memory) {
    throw new Error(`Episodic memory for chat ${chatId} not found`);
  }

  // AI Curation
  let sanitizedContent = content;
  if (!skipCuration) {
    const curation = await _curateContent(content, chatId);
    if (!curation.allowed) {
      throw new Error(`Curation rejected: ${curation.reason}`);
    }
    console.log(`[EpisodicMemory] Update curated: ${curation.reason}`);
    sanitizedContent = curation.sanitizedContent;
  }

  // Merge or replace content
  let newContent = merge 
    ? { ...memory.episodicMemory, ...sanitizedContent }
    : sanitizedContent;

  // Validate new content
  const validation = validateMemory(newContent, { 
    scope: MEMORY_SCOPES.EPISODIC,
    currentMemory: memory.episodicMemory
  });

  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // Calculate new word count
  let wordCount = count(newContent);
  const budget = MEMORY_BUDGETS.EPISODIC;

  // Auto-compress if near limit
  if (autoCompress && isNearLimit(wordCount, budget, COMPRESSION_TRIGGERS.EPISODIC / budget)) {
    const targetWords = Math.floor(budget * 0.6); // Compress to 60% of budget
    newContent = await compress(newContent, targetWords, { llmFunction });
    wordCount = count(newContent);
    
    memory.compressionCount = (memory.compressionCount || 0) + 1;
    memory.lastCompressedAt = new Date();
  }

  // Check if still within budget after compression
  if (wordCount > budget) {
    throw new Error(`Memory exceeds budget after compression: ${wordCount} words (limit: ${budget})`);
  }

  // Verify CLEANUP_RULES is defined
  if (!CLEANUP_RULES || !CLEANUP_RULES.EPISODIC_INACTIVITY_DAYS) {
    console.error('[EpisodicMemory] ❌ CLEANUP_RULES.EPISODIC_INACTIVITY_DAYS is undefined!');
    throw new Error('CLEANUP_RULES not properly imported or EPISODIC_INACTIVITY_DAYS undefined');
  }

  // Update memory
  memory.episodicMemory = newContent;
  memory.wordCount = wordCount;
  memory.expiresAt = new Date(Date.now() + CLEANUP_RULES.EPISODIC_INACTIVITY_DAYS * 24 * 60 * 60 * 1000);

  await memory.save();
  return memory.toObject();
}

/**
 * Get episodic memory for a chat
 * @param {string} chatId - Chat identifier
 * @returns {Promise<object|null>} - Memory object or null
 */
async function get(chatId) {
  if (!chatId) return null;

  const memory = await EpisodicMemoryModel.findByChatId(chatId);
  return memory ? memory.toObject() : null;
}

/**
 * Compress episodic memory manually
 * @param {string} chatId - Chat identifier
 * @param {number} targetWords - Target word count (default: 60% of budget)
 * @param {Function} llmFunction - LLM function for compression
 * @returns {Promise<object>} - Compressed memory
 */
async function compressMemory(chatId, targetWords = null, llmFunction = null) {
  const memory = await EpisodicMemoryModel.findByChatId(chatId);
  if (!memory) {
    throw new Error(`Episodic memory for chat ${chatId} not found`);
  }

  const budget = MEMORY_BUDGETS.EPISODIC;
  const target = targetWords || Math.floor(budget * 0.6);

  const compressed = await compress(memory.episodicMemory, target, { llmFunction });
  const newWordCount = count(compressed);

  memory.episodicMemory = compressed;
  memory.wordCount = newWordCount;
  memory.compressionCount = (memory.compressionCount || 0) + 1;
  memory.lastCompressedAt = new Date();

  await memory.save();
  return memory.toObject();
}

/**
 * Archive episodic memory (set expiration)
 * @param {string} chatId - Chat identifier
 * @param {number} daysUntilExpiry - Days until expiration (default: 30)
 * @returns {Promise<boolean>} - Success
 */
async function archive(chatId, daysUntilExpiry = CLEANUP_RULES.EPISODIC_INACTIVITY_DAYS) {
  if (!chatId) return false;

  const result = await EpisodicMemoryModel.archiveChat(chatId, daysUntilExpiry);
  return result.modifiedCount > 0;
}

/**
 * Delete episodic memory
 * @param {string} chatId - Chat identifier
 * @returns {Promise<boolean>} - Success
 */
async function deleteMemory(chatId) {
  if (!chatId) return false;

  const result = await EpisodicMemoryModel.deleteOne({ chatId });
  return result.deletedCount > 0;
}

/**
 * Get all episodic memories for a user
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of results
 * @returns {Promise<object[]>} - Array of memories
 */
async function getUserMemories(userId, limit = 10) {
  return EpisodicMemoryModel.findByUserId(userId, limit);
}

module.exports = {
  create,
  update,
  get,
  compressMemory,
  archive,
  deleteMemory,
  getUserMemories
};
