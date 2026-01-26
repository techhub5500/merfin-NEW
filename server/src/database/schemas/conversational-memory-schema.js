/**
 * Conversational Memory Schema
 * 
 * Purpose: Armazena resumos cumulativos e janela deslizante de mensagens recentes
 * para manter memória persistente de conversas longas.
 * 
 * Arquitetura:
 * - cumulativeSummary: Resumo progressivo do histórico antigo (atualizado pelo GPT-5 Nano)
 * - recentWindow: Últimos 2 ciclos (4 mensagens) mantidos integralmente
 * - totalTokens: Contador estimado de tokens para gatilho de resumo
 * 
 * Controls: Um documento por chatId. Atualizado a cada interação.
 * Behavior: Quando totalTokens > 3500, as mensagens antigas são resumidas e movidas para cumulativeSummary.
 * Integration: Usado exclusivamente pelo JuniorAgent.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sub-schema para mensagens na janela recente
const recentMessageSchema = new Schema({
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  content: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  tokens: { type: Number, required: true, default: 0 } // Estimativa de tokens
}, { _id: false });

const conversationalMemorySchema = new Schema({
  // Identificadores
  chatId: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  
  // Resumo Cumulativo (Memória de Longo Prazo)
  cumulativeSummary: {
    type: String,
    default: '',
    maxlength: 10000 // Limite de segurança
  },
  
  // Tokens estimados do resumo
  summaryTokens: {
    type: Number,
    default: 0
  },
  
  // Janela de Curto Prazo (últimos 2 ciclos = 4 mensagens)
  recentWindow: {
    type: [recentMessageSchema],
    default: []
  },
  
  // Contador total de tokens (resumo + janela recente)
  totalTokens: {
    type: Number,
    default: 0
  },
  
  // Metadados de resumo
  lastSummaryAt: { type: Date },
  summaryCount: { type: Number, default: 0 }, // Quantas vezes foi resumido
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  lastUpdatedAt: { type: Date, default: Date.now }
}, {
  timestamps: false // Gerenciamento manual
});

// Índices compostos para otimização
conversationalMemorySchema.index({ userId: 1, lastUpdatedAt: -1 });
conversationalMemorySchema.index({ chatId: 1, sessionId: 1 });

// Atualizar lastUpdatedAt automaticamente
conversationalMemorySchema.pre('save', function(next) {
  this.lastUpdatedAt = new Date();
  next();
});

/**
 * Métodos estáticos
 */

// Buscar memória por chatId
conversationalMemorySchema.statics.findByChatId = async function(chatId) {
  return this.findOne({ chatId }).exec();
};

// Criar ou obter memória existente
conversationalMemorySchema.statics.findOrCreate = async function(chatId, userId, sessionId) {
  let memory = await this.findOne({ chatId }).exec();
  
  if (!memory) {
    memory = await this.create({
      chatId,
      userId,
      sessionId,
      cumulativeSummary: '',
      summaryTokens: 0,
      recentWindow: [],
      totalTokens: 0
    });
  }
  
  return memory;
};

// Limpar memórias antigas (opcional - para manutenção)
conversationalMemorySchema.statics.cleanupOld = async function(daysOld = 90) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return this.deleteMany({ lastUpdatedAt: { $lt: cutoffDate } }).exec();
};

module.exports = mongoose.model('ConversationalMemory', conversationalMemorySchema);
