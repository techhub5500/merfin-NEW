/**
 * NOTE (session-store.js):
 * Purpose: Manage active session lifecycle with automatic timeout and cleanup.
 * Controls: Session creation, renewal, expiration, and automatic cleanup of inactive sessions.
 * Integration notes: Works alongside working-memory.js to trigger cleanup of expired sessions.
 */

const { CLEANUP_RULES } = require('../shared/hard-rules');
const workingMemory = require('./working-memory');

/**
 * Session Store - Manages session lifecycle
 */
class SessionStore {
  constructor(options = {}) {
    this.sessions = new Map(); // sessionId -> { userId, createdAt, lastActivity, metadata }
    this.timeoutMs = options.timeoutMs || CLEANUP_RULES.WORKING_SESSION_TIMEOUT;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 5 * 60 * 1000; // 5 minutes
    this.cleanupTimer = null;
  }

  /**
   * Create a new session
   * @param {string} sessionId - Unique session identifier
   * @param {string} userId - User ID
   * @param {object} metadata - Optional session metadata
   * @returns {object} - Session object
   */
  createSession(sessionId, userId, metadata = {}) {
    if (!sessionId || !userId) {
      throw new Error('sessionId and userId are required');
    }

    const session = {
      sessionId,
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session information
   * @param {string} sessionId - Session identifier
   * @returns {object|null} - Session object or null
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Check if session exists and is active
   * @param {string} sessionId - Session identifier
   * @returns {boolean} - True if session is active
   */
  isActive(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const now = Date.now();
    const elapsed = now - session.lastActivity;
    
    return elapsed < this.timeoutMs;
  }

  /**
   * Renew session activity (update lastActivity timestamp)
   * @param {string} sessionId - Session identifier
   * @returns {boolean} - True if renewed successfully
   */
  renewActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.lastActivity = Date.now();
    return true;
  }

  /**
   * End a session manually
   * @param {string} sessionId - Session identifier
   */
  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear working memory for this session
    await workingMemory.clear(sessionId);
    
    // Remove session
    this.sessions.delete(sessionId);
  }

  /**
   * Cleanup expired sessions
   * @returns {Promise<number>} - Number of sessions cleaned up
   */
  async cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const elapsed = now - session.lastActivity;
      
      if (elapsed > this.timeoutMs) {
        await workingMemory.clear(sessionId);
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanup() {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      const cleaned = this.cleanupExpired();
      if (cleaned > 0) {
        console.log(`[SessionStore] Cleaned up ${cleaned} expired session(s)`);
      }
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop automatic cleanup timer
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get statistics about active sessions
   * @returns {object} - Session statistics
   */
  getStats() {
    const now = Date.now();
    const sessions = Array.from(this.sessions.values());
    
    const active = sessions.filter(s => (now - s.lastActivity) < this.timeoutMs).length;
    const expired = sessions.length - active;
    
    const durations = sessions.map(s => now - s.createdAt);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    
    return {
      total: sessions.length,
      active,
      expired,
      avgDurationMs: avgDuration
    };
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {object[]} - Array of active sessions
   */
  getUserSessions(userId) {
    const now = Date.now();
    const userSessions = [];

    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        const isActive = (now - session.lastActivity) < this.timeoutMs;
        userSessions.push({ ...session, isActive });
      }
    }

    return userSessions;
  }

  /**
   * Clear all sessions (use with caution)
   */
  async clearAll() {
    for (const sessionId of this.sessions.keys()) {
      await workingMemory.clear(sessionId);
    }
    this.sessions.clear();
  }
}

// Export singleton instance
const sessionStore = new SessionStore();

// Auto-start cleanup
sessionStore.startCleanup();

module.exports = sessionStore;
