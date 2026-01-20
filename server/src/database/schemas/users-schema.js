/**
 * NOTE (users-schema.js):
 * Purpose: Store user financial profile used by agents/IA for personalization.
 * Controls: `riskAssessment.answers`, `riskScore`, `risk_profile` (conservador|moderado|agressivo),
 * investment goals and summarized financial situation.
 * Integration notes: Agents should update `risk_profile` atomically and may use `riskUpdatedAt`.
 */
const mongoose = require('mongoose');

const { Schema } = mongoose;

const answerSchema = new Schema({
  qId: { type: Number, required: true },
  question: { type: String, required: true },
  choice: { type: String, required: true, enum: ['A', 'B', 'C'] },
  choiceText: { type: String }
}, { _id: false });

const goalsSchema = new Schema({
  name: { type: String, required: true },
  targetAmount: { type: Number, min: 0 },
  targetDate: { type: Date },
  priority: { type: Number, min: 1, max: 5, default: 3 }
}, { _id: false });

const financialSituationSchema = new Schema({
  monthlyIncome: { type: Number, min: 0 },
  monthlyExpenses: { type: Number, min: 0 },
  netWorth: { type: Number },
  liquidAssets: { type: Number, min: 0 },
  liabilities: { type: Number, min: 0 }
}, { _id: false });

const userProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

  // Risk assessment: raw answers and IA result
  riskAssessment: {
    answers: { type: [answerSchema], default: [] },
    // riskScore é opcional; a IA pode calcular um número para justificar a decisão
    riskScore: { type: Number, min: 0, max: 20 },
    // risk_profile deve ser exatamente uma destas strings quando definido
    risk_profile: { type: String, enum: ['conservador', 'moderado', 'agressivo'] },
    riskUpdatedAt: { type: Date }
  },

  // Objetivos de investimento do usuário
  investment_goals: { type: [goalsSchema], default: [] },

  // Situação financeira resumida (opcional, pode ser preenchida pelo usuário ou por import)
  financial_situation: { type: financialSituationSchema, default: {} },

  // Preferências e tolerâncias adicionais (livre)
  preferences: { type: Schema.Types.Mixed },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Atualizar updatedAt automaticamente
userProfileSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

/**
 * Notas de integração para a IA / agente:
 * - Fluxo sugerido para a IA:
 *   1) Ler `riskAssessment.answers` (espera-se 10 objetos com qId 1..10)
 *   2) Mapear cada escolha A->0, B->1, C->2 e somar para obter `riskScore` (0..20)
 *   3) Aplicar thresholds (ex.: <=7 conservador, 8-13 moderado, >=14 agressivo)
 *   4) Atualizar o documento com `risk_profile`, `riskScore` e `riskUpdatedAt` (timestamp)
 * - A IA deve usar `userId` para localizar o documento e executar um update atômico.
 */

module.exports = mongoose.model('UserProfile', userProfileSchema);
