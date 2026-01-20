/**
 * NOTE (working-memory.js):
 * Purpose: Volatile session-based memory for immediate execution context with AI curation.
 * Controls: Per-session key-value storage with AI validation and 700-word budget.
 * Behavior: Automatically cleaned after 40 min inactivity. AI validates all entries.
 * Integration notes: Use for temporary calculations, intermediate results, and current action parameters.
 */

const { CLEANUP_RULES } = require('../shared/hard-rules');
const { callDeepSeekJSON } = require('../../../config/deepseek-config');
const memoryValidator = require('../shared/memory-validator');
const wordCounter = require('../shared/word-counter');
const { MEMORY_BUDGETS } = require('../shared/memory-types');

/**
 * Working Memory - Volatile storage per session with AI curation
 */
class WorkingMemory {
  constructor() {
    this.sessions = new Map(); // sessionId -> Map(key -> value)
    this.lastAccess = new Map(); // sessionId -> timestamp
  }

  /**
   * Validate value with AI curation before storing
   * @param {string} key - Key being stored
   * @param {*} value - Value being stored
   * @returns {Promise<Object>} - {allowed: boolean, reason: string, sanitizedValue: *}
   * @private
   */
  async _curateValue(key, value) {
    try {
      const systemPrompt = `You are a working memory curator for a financial investment system.
Validate if this data should be stored in temporary working memory.

REJECT if:
- Contains sensitive data (passwords, API keys, tokens, CPF, credit card)
- Contains personally identifiable information (PII)
- Is irrelevant noise or spam
- Is duplicate/redundant information

ACCEPT if:
- Temporary calculation results
- Intermediate processing data
- Current session context
- User preferences for current action
- Financial analysis intermediate results`;

      const userPrompt = `Validate this working memory entry:

Key: "${key}"
Value: ${JSON.stringify(value)}

Return JSON:
{
  "allowed": <true/false>,
  "reason": "<brief explanation>",
  "sanitizedValue": <cleaned value if modifications needed, or original>
}`;

      const result = await callDeepSeekJSON(systemPrompt, userPrompt, { 
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
   * Set a value in working memory for a session (with AI curation)
   * @param {string} sessionId - Session identifier
   * @param {string} key - Key to store
   * @param {*} value - Value to store
   * @param {boolean} skipCuration - Skip AI curation (use with caution)
   * @returns {Promise<boolean>} - True if stored successfully
   */
  async set(sessionId, key, value, skipCuration = false) {
    if (!sessionId || !key) {
      throw new Error('sessionId and key are required');
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
      console.log(`[WorkingMemory] Entry approved: ${curation.reason}`);
    }

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Map());
    }

    const sessionMemory = this.sessions.get(sessionId);
    
    // Check budget (700 words)
    const currentWords = this._countSessionWords(sessionId);
    const newValueWords = wordCounter.count(value);
    
    if (currentWords + newValueWords > MEMORY_BUDGETS.WORKING) {
      console.warn(`[WorkingMemory] Budget exceeded for session ${sessionId}: ${currentWords + newValueWords}/${MEMORY_BUDGETS.WORKING} words`);
      // Remove oldest entries to make space
      this._freeSpace(sessionId, newValueWords);
    }
    
    sessionMemory.set(key, value);
    
    // Update last access time
    this.lastAccess.set(sessionId, Date.now());
    
    return true;
  }

  /**
   * Get a value from working memory
   * @param {string} sessionId - Session identifier
   * @param {string} key - Key to retrieve
   * @returns {*} - Stored value or undefined
   */
  get(sessionId, key) {
    if (!sessionId || !key) return undefined;

    const sessionMemory = this.sessions.get(sessionId);
    if (!sessionMemory) return undefined;

    // Update last access time
    this.lastAccess.set(sessionId, Date.now());
    
    return sessionMemory.get(key);
  }

  /**
   * Get all key-value pairs for a session
   * @param {string} sessionId - Session identifier
   * @returns {object} - Object with all keys and values
   */
  getAll(sessionId) {
    if (!sessionId) return {};

    const sessionMemory = this.sessions.get(sessionId);
    if (!sessionMemory) return {};

    // Update last access time
    this.lastAccess.set(sessionId, Date.now());

    // Convert Map to object
    const result = {};
    for (const [key, value] of sessionMemory.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Check if a key exists in session memory
   * @param {string} sessionId - Session identifier
   * @param {string} key - Key to check
   * @returns {boolean} - True if key exists
   */
  has(sessionId, key) {
    if (!sessionId || !key) return false;

    const sessionMemory = this.sessions.get(sessionId);
    return sessionMemory ? sessionMemory.has(key) : false;
  }

  /**
   * Delete a specific key from session memory
   * @param {string} sessionId - Session identifier
   * @param {string} key - Key to delete
   * @returns {boolean} - True if key was deleted
   */
  delete(sessionId, key) {
    if (!sessionId || !key) return false;

    const sessionMemory = this.sessions.get(sessionId);
    if (!sessionMemory) return false;

    return sessionMemory.delete(key);
  }

  /**
   * Clear all memory for a session
   * @param {string} sessionId - Session identifier
   */
  clear(sessionId) {
    if (!sessionId) return;

    this.sessions.delete(sessionId);
    this.lastAccess.delete(sessionId);
  }

  /**
   * Clear all expired sessions (inactive for > timeout)
   * @param {number} timeoutMs - Timeout in milliseconds (default: 30 minutes)
   * @returns {number} - Number of sessions cleared
   */
  clearExpired(timeoutMs = CLEANUP_RULES.WORKING_SESSION_TIMEOUT) {
    const now = Date.now();
    let cleared = 0;

    for (const [sessionId, lastAccessTime] of this.lastAccess.entries()) {
      if (now - lastAccessTime > timeoutMs) {
        this.sessions.delete(sessionId);
        this.lastAccess.delete(sessionId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get statistics about working memory usage
   * @returns {object} - Memory statistics
   */
  getStats() {
    const activeSessions = this.sessions.size;
    const totalKeys = Array.from(this.sessions.values()).reduce((sum, m) => sum + m.size, 0);
    
    let totalWords = 0;
    for (const sessionId of this.sessions.keys()) {
      totalWords += this._countSessionWords(sessionId);
    }
    
    return {
      activeSessions,
      totalKeys,
      totalWords,
      avgKeysPerSession: activeSessions > 0 ? totalKeys / activeSessions : 0,
      avgWordsPerSession: activeSessions > 0 ? (totalWords / activeSessions).toFixed(1) : 0
    };
  }

  /**
   * Count words in a session
   * @param {string} sessionId - Session identifier
   * @returns {number} - Word count
   * @private
   */
  _countSessionWords(sessionId) {
    const sessionMemory = this.sessions.get(sessionId);
    
    if (!sessionMemory) {
      return 0;
    }

    let totalWords = 0;
    for (const value of sessionMemory.values()) {
      totalWords += wordCounter.count(value);
    }

    return totalWords;
  }

  /**
   * Free space by removing oldest entries
   * @param {string} sessionId - Session identifier
   * @param {number} wordsNeeded - Words to free
   * @private
   */
  _freeSpace(sessionId, wordsNeeded) {
    const sessionMemory = this.sessions.get(sessionId);
    
    if (!sessionMemory) {
      return;
    }

    // Convert to array and sort by insertion order (Map preserves order, so oldest first)
    const entries = Array.from(sessionMemory.entries());

    let wordsFreed = 0;
    for (const [key, value] of entries) {
      if (wordsFreed >= wordsNeeded) {
        break;
      }

      const entryWords = wordCounter.count(value);
      sessionMemory.delete(key);
      wordsFreed += entryWords;
      console.log(`[WorkingMemory] Removed key '${key}' to free space (${entryWords} words)`);
    }
  }

  /**
   * Clear all sessions (use with caution)
   */
  clearAll() {
    this.sessions.clear();
    this.lastAccess.clear();
  }
}

// Export singleton instance
const workingMemory = new WorkingMemory();

module.exports = workingMemory;
