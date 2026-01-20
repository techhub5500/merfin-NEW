/**
 * NOTE (episodic-memory-schema.js):
 * Purpose: MongoDB schema for episodic memories (per-chat persistent context).
 * Controls: Stores chat-specific memories with word count, TTL for auto-deletion after inactivity.
 * Behavior: Each chat session has its own episodic memory; expires after 30 days of inactivity.
 * Integration notes: Used by episodic-memory.js to persist conversation context.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const episodicMemorySchema = new Schema({
  chatId: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  // Memory content (JSON object with structured information)
  episodicMemory: { type: Schema.Types.Mixed, required: true },
  
  // Word count for budget management
  wordCount: { type: Number, required: true, default: 0 },
  
  // Compression status
  compressionCount: { type: Number, default: 0 }, // Number of times compressed
  lastCompressedAt: { type: Date },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  lastUpdated: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: true } // TTL index for auto-deletion
}, {
  timestamps: false // Manual timestamp management
});

// Indexes for efficient queries
episodicMemorySchema.index({ userId: 1, createdAt: -1 });
episodicMemorySchema.index({ userId: 1, lastUpdated: -1 });

// TTL index: automatically delete documents after expiresAt date
episodicMemorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Update lastUpdated on save
episodicMemorySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

/**
 * Helper static methods
 */

// Find active episodic memory by chatId
episodicMemorySchema.statics.findByChatId = async function(chatId) {
  return this.findOne({ chatId }).exec();
};

// Find all episodic memories for a user
episodicMemorySchema.statics.findByUserId = async function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ lastUpdated: -1 })
    .limit(limit)
    .exec();
};

// Archive (set expiration) for a chat
episodicMemorySchema.statics.archiveChat = async function(chatId, daysUntilExpiry = 30) {
  const expiresAt = new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000);
  return this.updateOne({ chatId }, { expiresAt }).exec();
};

module.exports = mongoose.model('EpisodicMemory', episodicMemorySchema);
