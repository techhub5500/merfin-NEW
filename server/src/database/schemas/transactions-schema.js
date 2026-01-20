
/**
 * NOTE (transactions-schema.js):
 * Purpose: Define `Transaction` documents across multiple sections:
 *  - `statement` (executed entries), `scheduled` (planned), `credit_card`, `debt`, `asset`.
 * Controls: common fields (userId, accountId, type, amount, date, status, description)
 * Validation: amount >= 0.01, description <= 15 words, section enum enforced.
 * Integration notes: use tags like `transactions:account:{accountId}` or
 * `user:{userId}:transactions` for cache invalidation after mutations.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const scheduledSchema = new Schema({
	frequency: { type: String, enum: ['once', 'daily', 'weekly', 'monthly', 'yearly'], default: 'once' },
	nextDate: { type: Date },
	recurrenceCount: { type: Number, min: 1 },
	endDate: { type: Date },
	// Scheduled type: 'receivable' (a receber) or 'payable' (a pagar)
	scheduledType: { type: String, enum: ['receivable', 'payable'], required: false },
	dueDate: { type: Date, comment: 'Data de vencimento para contas futuras' }
}, { _id: false });

const creditCardSchema = new Schema({
	cardId: { type: String },
	utilizedAmount: { type: Number, default: 0.0, min: 0 },
	creditLimit: { type: Number, default: 0.0, min: 0 },
	billingCycleStartDay: { type: Number, min: 1, max: 31 },
	billingCycleEndDay: { type: Number, min: 1, max: 31 }
}, { _id: false });

const debtSchema = new Schema({
	debtType: { type: String, enum: ['personal', 'loan', 'mortgage', 'credit_card', 'other'], default: 'personal' },
	totalAmount: { type: Number, required: true, min: 0.01 },
	installmentCount: { type: Number, min: 1 },
	installmentValue: { type: Number, min: 0.0 },
	firstInstallmentDate: { type: Date },
	outstandingBalance: { type: Number, min: 0.0 },
	interestRate: { type: Number, min: 0.0 },
	descriptionFree: { type: String, maxlength: 1000 }
}, { _id: false });

const assetSchema = new Schema({
	assetName: { type: String },
	assetType: { type: String, enum: ['real_estate', 'investment', 'vehicle', 'cash', 'other'], default: 'other' },
	assetValue: { type: Number, min: 0.0 },
	acquisitionDate: { type: Date }
}, { _id: false });

const transactionSchema = new Schema({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	accountId: { type: Schema.Types.ObjectId, ref: 'Account', index: true },

	// Section: where this entry belongs
	section: { type: String, required: true, enum: ['statement', 'scheduled', 'credit_card', 'debt', 'asset'], index: true },

	// Common fields
	type: { type: String, enum: ['income', 'expense', 'transfer', 'investment', 'fee', 'refund'], required: true },
	amount: { type: Number, required: true, min: 0.01 },
	currency: { type: String, enum: ['BRL', 'USD', 'EUR'], default: 'BRL' },
	date: { type: Date, required: true, default: Date.now },
	status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'failed'], default: 'confirmed' },
	description: {
		type: String,
		validate: {
			validator: function (v) {
				if (!v) return true;
				return v.trim().split(/\s+/).filter(Boolean).length <= 15;
			},
			message: 'Description must have at most 15 words'
		}
	},
	category: { type: String, index: true },
	tags: [{ type: String }],
	merchant: { type: String },
	referenceId: { type: String },
	metadata: { type: Schema.Types.Mixed },

	// Section-specific subdocuments
	statement: {
		// For executed entries (extrato: receitas/despesas executadas)
		executedAt: { type: Date },
		receiptNumber: { type: String }
	},

	scheduled: scheduledSchema,

	creditCard: creditCardSchema,

	debt: debtSchema,

	asset: assetSchema,

	createdAt: { type: Date, default: Date.now }
});

// Indexes useful for queries
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ accountId: 1, status: 1 });
transactionSchema.index({ userId: 1, section: 1, date: -1 });

/**
 * INTEGRATION NOTES FOR FRONTEND (dash.html):
 * 
 * 1. CARDS DO TOPO (Receitas, Despesas, Saldo):
 *    - Extracted from section='statement' transactions
 *    - Receitas: SUM(amount WHERE type='income' AND section='statement')
 *    - Despesas: SUM(amount WHERE type='expense' AND section='statement')
 *    - Saldo: Receitas - Despesas
 * 
 * 2. CARD "ÚLTIMAS TRANSAÇÕES":
 *    - Query: section='statement', sort by date DESC, limit 5-10
 *    - Display: description, date, amount (both income and expense)
 * 
 * 3. CARD "EXTRATO":
 *    - Two tabs: Receitas / Despesas
 *    - Receitas: section='statement', type='income'
 *    - Despesas: section='statement', type='expense'
 *    - Display: description (description field), date (date field), amount
 * 
 * 4. CARD "CONTAS FUTURAS":
 *    - Two tabs: A receber / A pagar
 *    - A receber: section='scheduled', scheduled.scheduledType='receivable' OR type='income'
 *    - A pagar: section='scheduled', scheduled.scheduledType='payable' OR type='expense'
 *    - Display: description, "Venc. <dueDate>" (scheduled.dueDate), amount
 * 
 * 5. CARD "CARTÃO DE CRÉDITO":
 *    - See credit-card-schema.js for credit card management
 *    - Transactions linked to credit card: section='credit_card'
 *    - utilizedAmount = SUM(amount WHERE section='credit_card' AND date in current billing cycle)
 * 
 * 6. CARD "DÍVIDAS":
 *    - See debt-schema.js for debt management
 *    - Alternatively, can use section='debt' for simple debt tracking
 * 
 * DataAgent endpoints needed:
 * - POST /agent/execute { agent_name: "DataAgent", action: "getTransactions", userId, section, type, startDate, endDate }
 * - POST /agent/execute { agent_name: "DataAgent", action: "createTransaction", userId, data: {...} }
 * - POST /agent/execute { agent_name: "DataAgent", action: "updateTransaction", userId, transactionId, data: {...} }
 * - POST /agent/execute { agent_name: "DataAgent", action: "deleteTransaction", userId, transactionId }
 * - POST /agent/execute { agent_name: "DataAgent", action: "getTransactionsSummary", userId, startDate, endDate }
 */

module.exports = mongoose.model('Transaction', transactionSchema);

