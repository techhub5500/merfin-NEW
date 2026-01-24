/**
 * NOTE (context-builder.js):
 * Purpose: Build comprehensive context for agents by combining working memory and session state.
 * Controls: Aggregates session data, working memory variables, and metadata into unified context object.
 * Integration notes: Called by agents at the start of each cycle to get full execution context.
 */

const workingMemory = require('./working-memory');
const sessionStore = require('./session-store');

/**
 * Build execution context for an agent
 * @param {string} sessionId - Session identifier
 * @param {object} options - Context options
 * @param {string[]} options.keys - Specific keys to include from working memory
 * @param {boolean} options.includeMetadata - Include session metadata
 * @returns {Promise<object>} - Complete context object
 */
async function buildContext(sessionId, options = {}) {
  const { keys = null, includeMetadata = true } = options;

  const context = {
    sessionId,
    timestamp: new Date().toISOString()
  };

  // Get session info
  const session = sessionStore.getSession(sessionId);
  if (session) {
    context.userId = session.userId;
    context.sessionCreatedAt = new Date(session.createdAt).toISOString();
    context.sessionDuration = Date.now() - session.createdAt;
    
    if (includeMetadata && session.metadata) {
      context.sessionMetadata = session.metadata;
    }
  } else {
    context.error = 'Session not found or expired';
    return context;
  }

  // Get working memory data
  if (keys && Array.isArray(keys)) {
    // Get specific keys only
    context.memory = {};
    for (const key of keys) {
      const value = await workingMemory.get(sessionId, key);
      if (value !== undefined) {
        context.memory[key] = value;
      }
    }
  } else {
    // Get all working memory
    context.memory = await workingMemory.getAll(sessionId);
  }

  return context;
}

/**
 * Update working memory with new values
 * @param {string} sessionId - Session identifier
 * @param {object} updates - Key-value pairs to update
 */
async function updateContext(sessionId, updates) {
  if (!updates || typeof updates !== 'object') {
    throw new Error('Updates must be an object');
  }

  // Renew session activity
  sessionStore.renewActivity(sessionId);

  // Get userId from session
  const session = sessionStore.getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Update working memory
  for (const [key, value] of Object.entries(updates)) {
    await workingMemory.set(sessionId, key, value, false, session.userId);
  }
}

/**
 * Clear specific keys from context
 * @param {string} sessionId - Session identifier
 * @param {string[]} keys - Keys to clear
 */
async function clearContextKeys(sessionId, keys) {
  if (!Array.isArray(keys)) {
    throw new Error('Keys must be an array');
  }

  for (const key of keys) {
    await workingMemory.delete(sessionId, key);
  }
}

/**
 * Clear entire context for session
 * @param {string} sessionId - Session identifier
 */
async function clearContext(sessionId) {
  await workingMemory.clear(sessionId);
}

module.exports = {
  buildContext,
  updateContext,
  clearContextKeys,
  clearContext
};
