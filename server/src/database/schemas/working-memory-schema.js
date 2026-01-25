/**
 * NOTE (working-memory-schema.js):
 * Purpose: MongoDB schema for working memories (per-session persistent context).
 * Controls: Stores session-specific key-value pairs with word count, TTL for auto-deletion after 500 hours.
 * Behavior: Each session has its own working memory entries; expires automatically after 500 hours.
 * Integration notes: Used by working-memory.js to persist session context with RAM cache.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const workingMemorySchema = new Schema({
  sessionId: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  wordCount: { type: Number, required: true, default: 0 },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  expiresAt: { type: Date } // TTL index defined below with schema.index()
}, {
  timestamps: false // Manual timestamp management
});

// Compound index for efficient queries (unique per session+key)
workingMemorySchema.index({ sessionId: 1, key: 1 }, { unique: true });

// Indexes for user-based queries
workingMemorySchema.index({ userId: 1, createdAt: -1 });
workingMemorySchema.index({ userId: 1, lastUpdated: -1 });

// TTL index: automatically delete documents after expiresAt date
workingMemorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Update lastUpdated on save
workingMemorySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

/**
 * Helper static methods
 */

// Find all working memory entries for a session
workingMemorySchema.statics.findBySessionId = async function(sessionId) {
  return this.find({ sessionId }).exec();
};

// Find all working memory entries for a user
workingMemorySchema.statics.findByUserId = async function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ lastUpdated: -1 })
    .limit(limit)
    .exec();
};

// Set expiration for all entries in a session
workingMemorySchema.statics.setSessionExpiry = async function(sessionId, hoursUntilExpiry = 500) {
  const expiresAt = new Date(Date.now() + hoursUntilExpiry * 60 * 60 * 1000);
  return this.updateMany({ sessionId }, { expiresAt }).exec();
};

module.exports = mongoose.model('WorkingMemory', workingMemorySchema);