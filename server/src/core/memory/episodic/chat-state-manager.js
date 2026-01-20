/**
 * NOTE (chat-state-manager.js):
 * Purpose: Manage chat state lifecycle including creation, updates, and archiving.
 * Controls: High-level interface for chat memory management with automatic expiration handling.
 * Integration notes: Wrapper around episodic-memory.js with additional chat state logic.
 */

const episodicMemory = require('./episodic-memory');

/**
 * Initialize chat memory
 * @param {string} chatId - Chat identifier
 * @param {string} userId - User ID
 * @param {object} initialState - Initial chat state
 * @returns {Promise<object>} - Created memory
 */
async function initializeChat(chatId, userId, initialState = {}) {
  return episodicMemory.create(chatId, userId, initialState);
}

/**
 * Update chat state
 * @param {string} chatId - Chat identifier
 * @param {object} updates - State updates
 * @param {object} options - Update options
 * @returns {Promise<object>} - Updated memory
 */
async function updateChatState(chatId, updates, options = {}) {
  return episodicMemory.update(chatId, updates, options);
}

/**
 * Get current chat state
 * @param {string} chatId - Chat identifier
 * @returns {Promise<object|null>} - Chat state
 */
async function getChatState(chatId) {
  const memory = await episodicMemory.get(chatId);
  return memory ? memory.episodicMemory : null;
}

/**
 * End chat (archive memory)
 * @param {string} chatId - Chat identifier
 * @returns {Promise<boolean>} - Success
 */
async function endChat(chatId) {
  return episodicMemory.archive(chatId);
}

/**
 * Delete chat memory
 * @param {string} chatId - Chat identifier
 * @returns {Promise<boolean>} - Success
 */
async function deleteChat(chatId) {
  return episodicMemory.deleteMemory(chatId);
}

module.exports = {
  initializeChat,
  updateChatState,
  getChatState,
  endChat,
  deleteChat
};
