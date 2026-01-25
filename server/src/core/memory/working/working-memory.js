/**
 * NOTE (working-memory.js):
 * Purpose: Persistent session-based memory for immediate execution context with AI curation and MongoDB storage.
 * Controls: Per-session key-value storage with AI validation, 600-word budget, and automatic expiration after 500 hours.
 * Behavior: Persisted in MongoDB with TTL index, cached in RAM for performance. AI validates all entries.
 * Integration notes: Use for temporary calculations, intermediate results, and current action parameters.
 */

const { CLEANUP_RULES } = require('../shared/hard-rules');
const { callOpenAIJSON } = require('../../../config/openai-config');
const memoryValidator = require('../shared/memory-validator');
const wordCounter = require('../shared/word-counter');
const { MEMORY_BUDGETS } = require('../shared/memory-types');
const WorkingMemoryModel = require('../../../database/schemas/working-memory-schema');
const contentValidator = require('../shared/content-validator');
// Note: sessionStore is imported lazily to avoid circular dependency
let sessionStore = null;

/**
 * Working Memory - Persistent storage per session with AI curation and MongoDB
 */
class WorkingMemory {
  constructor() {
    this.cache = new Map(); // sessionId -> Map(key -> {value, wordCount, timestamp})
    this.lastAccess = new Map(); // sessionId -> timestamp
  }

  /**
   * Validate value with REGEX PATTERNS (substitui IA, economiza ~200 tokens)
   * @param {string} key - Key being stored
   * @param {*} value - Value being stored
   * @returns {Promise<Object>} - {allowed: boolean, reason: string, sanitizedValue: *}
   * @private
   */
  async _curateValue(key, value) {
    try {
      console.log('[WorkingMemory] 🔍 Validando com REGEX (sem IA)...');
      
      // Usa validação por padrões ao invés de IA
      const result = contentValidator.validateWorkingMemory(key, value);
      
      console.log('[WorkingMemory] Validação:', result.allowed ? '✓ APROVADO' : '✗ REJEITADO', `-`, result.reason);
      
      return result;

    } catch (error) {
      console.warn('[WorkingMemory] Erro na validação, usando fallback:', error.message);
      
      // Fallback: validação básica
      const validation = memoryValidator.validateMemory(value, { scope: 'working' });
      
      return {
        allowed: validation.valid,
        reason: validation.valid ? 'Fallback validation passed' : validation.errors.join(', '),
        sanitizedValue: value
      };
    }
  }

  /**
   * DEPRECATED: Validate value with AI curation (substituído por regex)
   * @private
   */
  async _curateValue_AI_DEPRECATED(key, value) {
    try {
      const systemPrompt = `You are a working memory curator for a financial investment system.
Validate if this data should be stored in temporary working memory.

REJECT if:
- Contains sensitive data (passwords, API keys, tokens, CPF, credit card numbers, CVV)
- Is irrelevant noise or spam
- Is duplicate/redundant information

ACCEPT if:
- User's first name or nickname (for personalization)
- Temporary calculation results
- Intermediate processing data
- Current session context
- User preferences for current action
- Financial analysis intermediate results

IMPORTANT: First names like "John", "Maria", "Edmar" are OK and should be ACCEPTED for personalization.`;

      const userPrompt = `Validate this working memory entry:

Key: "${key}"
Value: ${JSON.stringify(value)}

Return JSON:
{
  "allowed": <true/false>,
  "reason": "<brief explanation>",
  "sanitizedValue": <cleaned value if modifications needed, or original>
}`;

      const result = await callOpenAIJSON(systemPrompt, userPrompt, { 
        max_tokens: 200,
        temperature: 0.2 // Very deterministic for validation
      });

      return {
        allowed: result.allowed !== false, // Default to true if not specified
        reason: result.reason || 'No reason provided',
        sanitizedValue: result.sanitizedValue !== undefined ? result.sanitizedValue : value
      };

    } catch (error) {
      console.warn('[WorkingMemory] AI curation failed, using fallback validation:', error.message);
      
      // Fallback: simple validation
      const validation = memoryValidator.validateMemory(value, { scope: 'working' });
      
      return {
        allowed: validation.valid,
        reason: validation.valid ? 'Fallback validation passed' : validation.errors.join(', '),
        sanitizedValue: value
      };
    }
  }

  /**
   * Set a value in working memory for a session (with AI curation and MongoDB persistence)
   * @param {string} sessionId - Session identifier
   * @param {string} key - Key to store
   * @param {*} value - Value to store
   * @param {boolean} skipCuration - Skip AI curation (use with caution)
   * @param {string} userId - Optional user ID (will be fetched from session if not provided)
   * @returns {Promise<boolean>} - True if stored successfully
   */
  async set(sessionId, key, value, skipCuration = false, userId = null) {
    if (!sessionId || !key) {
      throw new Error('sessionId and key are required');
    }

    // Get userId from session if not provided
    if (!userId) {
      // Lazy load sessionStore to avoid circular dependency
      if (!sessionStore) {
        sessionStore = require('./session-store');
      }
      const session = sessionStore.getSession(sessionId);
      if (session) {
        userId = session.userId;
      } else {
        throw new Error('Session not found and userId not provided');
      }
    }

    // AI Curation
    if (!skipCuration) {
      const curation = await this._curateValue(key, value);
      
      if (!curation.allowed) {
        console.warn(`[WorkingMemory] Entry rejected by curation: ${curation.reason}`);
        return false;
      }
      
      // Use sanitized value if AI modified it
      value = curation.sanitizedValue;
      console.log('[WorkingMemory] ✅ Entry APPROVED for storage', {
        sessionId,
        key,
        valuePreview: value.substring(0, 50) + '...',
        reason: curation.reason
      });
    }

    const wordCount = wordCounter.count(value);

    // Check budget (600 words)
    const currentWords = await this._countSessionWords(sessionId);
    
    if (currentWords + wordCount > MEMORY_BUDGETS.WORKING) {
      console.warn(`[WorkingMemory] Budget exceeded for session ${sessionId}: ${currentWords + wordCount}/${MEMORY_BUDGETS.WORKING} words`);
      // Remove oldest entries to make space
      await this._freeSpace(sessionId, wordCount);
    }
    
    // Set expiration (500 hours from now)
    const expiresAt = new Date(Date.now() + 500 * 60 * 60 * 1000);
    
    // Persist to MongoDB
    console.log('[WorkingMemory] 💾 Salvando no MongoDB', { sessionId, key, wordCount, userId });
    try {
      await WorkingMemoryModel.findOneAndUpdate(
        { sessionId, key },
        { 
          userId,
          value, 
          wordCount,
          createdAt: new Date(),
          expiresAt
        },
        { upsert: true, new: true }
      );
      console.log('[WorkingMemory] ✅ MongoDB save SUCCESS', { sessionId, key });
    } catch (error) {
      console.error(`[WorkingMemory] ❌ Failed to persist to MongoDB: ${error.message}`);
      return false;
    }

    // Update cache
    if (!this.cache.has(sessionId)) {
      this.cache.set(sessionId, new Map());
    }
    this.cache.get(sessionId).set(key, { value, wordCount, timestamp: Date.now() });
    
    // Update last access time
    this.lastAccess.set(sessionId, Date.now());
    
    return true;
  }

  /**
   * Get a value from working memory
   * @param {string} sessionId - Session identifier
   * @param {string} key - Key to retrieve
   * @returns {Promise<*>} - Stored value or undefined
   */
  async get(sessionId, key) {
    if (!sessionId || !key) return undefined;

    // Check cache first
    const sessionCache = this.cache.get(sessionId);
    if (sessionCache && sessionCache.has(key)) {
      const cached = sessionCache.get(key);
      // Update last access
      this.lastAccess.set(sessionId, Date.now());
      return cached.value;
    }

    // Load from MongoDB
    try {
      const doc = await WorkingMemoryModel.findOne({ sessionId, key });
      if (doc) {
        // Update cache
        if (!this.cache.has(sessionId)) {
          this.cache.set(sessionId, new Map());
        }
        this.cache.get(sessionId).set(key, { 
          value: doc.value, 
          wordCount: doc.wordCount, 
          timestamp: Date.now() 
        });
        
        this.lastAccess.set(sessionId, Date.now());
        return doc.value;
      }
    } catch (error) {
      console.error(`[WorkingMemory] Failed to load from MongoDB: ${error.message}`);
    }

    return undefined;
  }

  /**
   * Get all key-value pairs for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<object>} - Object with all keys and values
   */
  async getAll(sessionId) {
    if (!sessionId) return {};

    // Check cache first
    const sessionCache = this.cache.get(sessionId);
    if (sessionCache && sessionCache.size > 0) {
      const result = {};
      for (const [key, data] of sessionCache.entries()) {
        result[key] = data.value;
      }
      this.lastAccess.set(sessionId, Date.now());
      return result;
    }

    // Load from MongoDB
    try {
      const docs = await WorkingMemoryModel.find({ sessionId });
      const result = {};
      const cacheMap = new Map();
      
      for (const doc of docs) {
        result[doc.key] = doc.value;
        cacheMap.set(doc.key, { 
          value: doc.value, 
          wordCount: doc.wordCount, 
          timestamp: Date.now() 
        });
      }
      
      // Update cache
      this.cache.set(sessionId, cacheMap);
      this.lastAccess.set(sessionId, Date.now());
      
      return result;
    } catch (error) {
      console.error(`[WorkingMemory] Failed to load all from MongoDB: ${error.message}`);
      return {};
    }
  }

  /**
   * Check if a key exists in session memory
   * @param {string} sessionId - Session identifier
   * @param {string} key - Key to check
   * @returns {Promise<boolean>} - True if key exists
   */
  async has(sessionId, key) {
    if (!sessionId || !key) return false;

    // Check cache first
    const sessionCache = this.cache.get(sessionId);
    if (sessionCache && sessionCache.has(key)) {
      return true;
    }

    // Check MongoDB
    try {
      const count = await WorkingMemoryModel.countDocuments({ sessionId, key });
      return count > 0;
    } catch (error) {
      console.error(`[WorkingMemory] Failed to check existence in MongoDB: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete a specific key from session memory
   * @param {string} sessionId - Session identifier
   * @param {string} key - Key to delete
   * @returns {Promise<boolean>} - True if key was deleted
   */
  async delete(sessionId, key) {
    if (!sessionId || !key) return false;

    // Remove from cache
    const sessionCache = this.cache.get(sessionId);
    if (sessionCache) {
      sessionCache.delete(key);
    }

    // Remove from MongoDB
    try {
      const result = await WorkingMemoryModel.deleteOne({ sessionId, key });
      return result.deletedCount > 0;
    } catch (error) {
      console.error(`[WorkingMemory] Failed to delete from MongoDB: ${error.message}`);
      return false;
    }
  }

  /**
   * Clear all memory for a session
   * @param {string} sessionId - Session identifier
   */
  async clear(sessionId) {
    if (!sessionId) return;

    // Clear cache
    this.cache.delete(sessionId);
    this.lastAccess.delete(sessionId);

    // Clear from MongoDB
    try {
      await WorkingMemoryModel.deleteMany({ sessionId });
    } catch (error) {
      console.error(`[WorkingMemory] Failed to clear from MongoDB: ${error.message}`);
    }
  }

  /**
   * Clear all expired sessions (inactive for > timeout) - Note: MongoDB TTL handles automatic expiration
   * @param {number} timeoutMs - Timeout in milliseconds (default: 500 minutes)
   * @returns {Promise<number>} - Number of sessions cleared
   */
  async clearExpired(timeoutMs = CLEANUP_RULES.WORKING_SESSION_TIMEOUT) {
    const now = Date.now();
    let cleared = 0;

    // Clear from cache based on last access
    for (const [sessionId, lastAccessTime] of this.lastAccess.entries()) {
      if (now - lastAccessTime > timeoutMs) {
        this.cache.delete(sessionId);
        this.lastAccess.delete(sessionId);
        cleared++;
      }
    }

    // MongoDB TTL will handle persistence expiration automatically after 500 hours
    return cleared;
  }

  /**
   * Get statistics about working memory usage
   * @returns {Promise<object>} - Memory statistics
   */
  async getStats() {
    const activeSessions = this.cache.size;
    const totalKeys = Array.from(this.cache.values()).reduce((sum, m) => sum + m.size, 0);
    
    let totalWords = 0;
    for (const sessionId of this.cache.keys()) {
      totalWords += await this._countSessionWords(sessionId);
    }
    
    // Also get DB stats
    try {
      const dbStats = await WorkingMemoryModel.aggregate([
        {
          $group: {
            _id: '$sessionId',
            keys: { $sum: 1 },
            words: { $sum: '$wordCount' }
          }
        }
      ]);
      
      const dbSessions = dbStats.length;
      const dbKeys = dbStats.reduce((sum, s) => sum + s.keys, 0);
      const dbWords = dbStats.reduce((sum, s) => sum + s.words, 0);
      
      return {
        cache: {
          activeSessions,
          totalKeys,
          totalWords,
          avgKeysPerSession: activeSessions > 0 ? totalKeys / activeSessions : 0,
          avgWordsPerSession: activeSessions > 0 ? (totalWords / activeSessions).toFixed(1) : 0
        },
        database: {
          totalSessions: dbSessions,
          totalKeys: dbKeys,
          totalWords: dbWords,
          avgKeysPerSession: dbSessions > 0 ? dbKeys / dbSessions : 0,
          avgWordsPerSession: dbSessions > 0 ? (dbWords / dbSessions).toFixed(1) : 0
        }
      };
    } catch (error) {
      console.error(`[WorkingMemory] Failed to get DB stats: ${error.message}`);
      return {
        cache: {
          activeSessions,
          totalKeys,
          totalWords,
          avgKeysPerSession: activeSessions > 0 ? totalKeys / activeSessions : 0,
          avgWordsPerSession: activeSessions > 0 ? (totalWords / activeSessions).toFixed(1) : 0
        },
        database: null
      };
    }
  }

  /**
   * Count words in a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<number>} - Word count
   * @private
   */
  async _countSessionWords(sessionId) {
    // Check cache first
    const sessionCache = this.cache.get(sessionId);
    if (sessionCache) {
      let totalWords = 0;
      for (const data of sessionCache.values()) {
        totalWords += data.wordCount;
      }
      return totalWords;
    }

    // Count from MongoDB
    try {
      const result = await WorkingMemoryModel.aggregate([
        { $match: { sessionId } },
        { $group: { _id: null, totalWords: { $sum: '$wordCount' } } }
      ]);
      
      return result.length > 0 ? result[0].totalWords : 0;
    } catch (error) {
      console.error(`[WorkingMemory] Failed to count words from MongoDB: ${error.message}`);
      return 0;
    }
  }

  /**
   * Free space by removing oldest entries
   * @param {string} sessionId - Session identifier
   * @param {number} wordsNeeded - Words to free
   * @private
   */
  async _freeSpace(sessionId, wordsNeeded) {
    try {
      // Get all entries for session, sorted by createdAt (oldest first)
      const entries = await WorkingMemoryModel.find({ sessionId }).sort({ createdAt: 1 });
      
      let wordsFreed = 0;
      for (const entry of entries) {
        if (wordsFreed >= wordsNeeded) {
          break;
        }

        // Remove from DB
        await WorkingMemoryModel.deleteOne({ _id: entry._id });
        
        // Remove from cache if present
        const sessionCache = this.cache.get(sessionId);
        if (sessionCache) {
          sessionCache.delete(entry.key);
        }
        
        wordsFreed += entry.wordCount;
        console.log(`[WorkingMemory] Removed key '${entry.key}' to free space (${entry.wordCount} words)`);
      }
    } catch (error) {
      console.error(`[WorkingMemory] Failed to free space in MongoDB: ${error.message}`);
    }
  }

  /**
   * Clear all sessions (use with caution)
   */
  async clearAll() {
    // Clear cache
    this.cache.clear();
    this.lastAccess.clear();

    // Clear from MongoDB
    try {
      await WorkingMemoryModel.deleteMany({});
    } catch (error) {
      console.error(`[WorkingMemory] Failed to clear all from MongoDB: ${error.message}`);
    }
  }
}

// Export singleton instance
const workingMemory = new WorkingMemory();

module.exports = workingMemory;
