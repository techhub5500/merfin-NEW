/**
 * NOTE (credit-card-schema.js):
 * Purpose: Define `CreditCard` documents for managing user credit cards.
 * Controls: userId, cardName, creditLimit, billingCycleRenewalDay, billingDueDay
 * Integration notes: Cache invalidation tag `user:{userId}:creditcards` after mutations.
 * Frontend: dash.html - Card "Cartão de Crédito"
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const creditCardSchema = new Schema({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	
	// Card information
	cardName: { type: String, required: true, trim: true, maxlength: 100 },
	creditLimit: { type: Number, required: true, min: 0, default: 0 },
	
	// Billing cycle configuration
	billingCycleRenewalDay: { 
		type: Number, 
		required: true, 
		min: 1, 
		max: 31,
		comment: 'Day of month when billing cycle resets (1-31)'
	},
	billingDueDay: { 
		type: Number, 
		required: true, 
		min: 1, 
		max: 31,
		comment: 'Day of month when payment is due (1-31)'
	},
	
	// Current status
	status: { 
		type: String, 
		enum: ['active', 'blocked', 'cancelled'], 
		default: 'active' 
	},
	
	// Metadata
	brand: { type: String, enum: ['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other'], default: 'other' },
	lastFourDigits: { type: String, maxlength: 4, match: /^[0-9]{4}$/ },
	metadata: { type: Schema.Types.Mixed },
	
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now }
});

// Indexes
creditCardSchema.index({ userId: 1, status: 1 });
creditCardSchema.index({ userId: 1, cardName: 1 }, { unique: true });

// Auto-update updatedAt
creditCardSchema.pre('save', function(next) {
	this.updatedAt = new Date();
	next();
});

/**
 * INTEGRATION NOTES:
 * 
 * Frontend requirements (dash.html):
 * - Button "Editar": User enters cardName, creditLimit, billingCycleRenewalDay, billingDueDay
 * - Display "Valor utilizado": Sum of all transactions with section='credit_card' for current billing cycle
 * - Display "Limite disponível": creditLimit - utilizedAmount
 * - Display "Fatura atual": Total of transactions from billingCycleRenewalDay to current date
 * 
 * Calculation logic:
 * - utilizedAmount = SUM(transactions where section='credit_card' AND userId=X AND 
 *                        date >= last_billing_cycle_date AND date < next_billing_cycle_date)
 * - availableCredit = creditLimit - utilizedAmount
 * - currentBill = utilizedAmount (for current cycle)
 * 
 * DataAgent endpoints needed:
 * - POST /agent/execute { agent_name: "DataAgent", action: "createCreditCard", data: {...} }
 * - POST /agent/execute { agent_name: "DataAgent", action: "updateCreditCard", data: {...} }
 * - POST /agent/execute { agent_name: "DataAgent", action: "getCreditCards", userId: "..." }
 * - POST /agent/execute { agent_name: "DataAgent", action: "getCreditCardUtilization", cardId: "...", userId: "..." }
 */

module.exports = mongoose.model('CreditCard', creditCardSchema);
