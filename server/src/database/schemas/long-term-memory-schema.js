/**
 * NOTE (long-term-memory-schema.js):
 * Purpose: MongoDB schema for long-term persistent memories (cross-chat user profile).
 * Controls: Stores highly curated memories with impact scores, categories, and access tracking.
 * Behavior: Total 1800 words (180 per category); only high-impact memories (score > 0.7) stored.
 * Integration notes: Used by long-term-memory.js; dual storage with vector database for semantic search.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Individual memory item within long-term memory
const memoryItemSchema = new Schema({
  content: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: [
      'perfil_profissional',
      'situacao_financeira',
      'investimentos',
      'objetivos_metas',
      'comportamento_gastos',
      'perfil_risco',
      'conhecimento_financeiro',
      'planejamento_futuro',
      'familia_dependentes',
      'relacao_plataforma'
    ]
  },
  impactScore: { type: Number, required: true, min: 0.0, max: 1.0 },
  sourceChats: [{ type: String }], // Array of chat IDs that contributed to this memory
  createdAt: { type: Date, default: Date.now },
  eventDate: { type: Date, required: true }, // Data do evento descrito na memória
  lastAccessed: { type: Date, default: Date.now },
  accessCount: { type: Number, default: 0 },
  vectorId: { type: String } // Reference to vector in external vector store
}, { _id: true });

const longTermMemorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  
  // Array of memory items
  memoryItems: { type: [memoryItemSchema], default: [] },
  
  // Total word count across all items (budget: 1800 words total, 180 per category)
  totalWordCount: { type: Number, required: true, default: 0 },
  
  // Dynamic category descriptions (max 25 words each, ~150 chars)
  categoryDescriptions: {
    perfil_profissional: {
      description: { type: String, default: '' },
      lastUpdated: { type: Date },
      updateCount: { type: Number, default: 0 }
    },
    situacao_financeira: {
      description: { type: String, default: '' },
      lastUpdated: { type: Date },
      updateCount: { type: Number, default: 0 }
    },
    investimentos: {
      description: { type: String, default: '' },
      lastUpdated: { type: Date },
      updateCount: { type: Number, default: 0 }
    },
    objetivos_metas: {
      description: { type: String, default: '' },
      lastUpdated: { type: Date },
      updateCount: { type: Number, default: 0 }
    },
    comportamento_gastos: {
      description: { type: String, default: '' },
      lastUpdated: { type: Date },
      updateCount: { type: Number, default: 0 }
    },
    perfil_risco: {
      description: { type: String, default: '' },
      lastUpdated: { type: Date },
      updateCount: { type: Number, default: 0 }
    },
    conhecimento_financeiro: {
      description: { type: String, default: '' },
      lastUpdated: { type: Date },
      updateCount: { type: Number, default: 0 }
    },
    planejamento_futuro: {
      description: { type: String, default: '' },
      lastUpdated: { type: Date },
      updateCount: { type: Number, default: 0 }
    },
    familia_dependentes: {
      description: { type: String, default: '' },
      lastUpdated: { type: Date },
      updateCount: { type: Number, default: 0 }
    },
    relacao_plataforma: {
      description: { type: String, default: '' },
      lastUpdated: { type: Date },
      updateCount: { type: Number, default: 0 }
    }
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  
  // Curation statistics
  curationStats: {
    totalProposed: { type: Number, default: 0 },    // Total memories proposed
    totalAccepted: { type: Number, default: 0 },    // Total memories accepted
    totalRejected: { type: Number, default: 0 },    // Total memories rejected
    totalMerged: { type: Number, default: 0 },      // Total memories merged
    lastCuratedAt: { type: Date }
  }
}, {
  timestamps: false // Manual timestamp management
});

// Indexes for efficient queries
longTermMemorySchema.index({ 'memoryItems.impactScore': -1 });
longTermMemorySchema.index({ 'memoryItems.category': 1 });
longTermMemorySchema.index({ 'memoryItems.lastAccessed': -1 });

// Update lastUpdated on save
longTermMemorySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

/**
 * Helper static methods
 */

// Find long-term memory for a user
longTermMemorySchema.statics.findByUserId = async function(userId) {
  return this.findOne({ userId }).exec();
};

// Find or create long-term memory for a user
longTermMemorySchema.statics.findOrCreate = async function(userId) {
  let memory = await this.findOne({ userId }).exec();
  
  if (!memory) {
    memory = new this({
      userId,
      memoryItems: [],
      totalWordCount: 0
    });
    await memory.save();
  }
  
  return memory;
};

// Get memories by category
longTermMemorySchema.methods.getByCategory = function(category) {
  return this.memoryItems.filter(item => item.category === category);
};

// Get top N memories by impact score
longTermMemorySchema.methods.getTopMemories = function(n = 10) {
  return this.memoryItems
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, n);
};

// Update access statistics for a memory item
longTermMemorySchema.methods.trackAccess = function(memoryItemId) {
  const item = this.memoryItems.id(memoryItemId);
  if (item) {
    item.lastAccessed = new Date();
    item.accessCount += 1;
  }
};

module.exports = mongoose.model('LongTermMemory', longTermMemorySchema);
