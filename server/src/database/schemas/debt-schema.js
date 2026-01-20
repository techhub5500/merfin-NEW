/**
 * NOTE (debt-schema.js):
 * Purpose: Define `Debt` documents for managing user debts with installment tracking.
 * Controls: userId, description, institution, totalValue, installments tracking
 * Integration notes: Cache invalidation tag `user:{userId}:debts` after mutations.
 * Frontend: dash.html - Card "Dívidas" + Modal "Detalhes da Dívida"
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const installmentSchema = new Schema({
	installmentNumber: { type: Number, required: true, min: 1 },
	dueDate: { type: Date, required: true },
	amount: { type: Number, required: true, min: 0.01 },
	isPaid: { type: Boolean, default: false },
	paidAt: { type: Date },
	paidAmount: { type: Number, min: 0 }
}, { _id: false });

const debtSchema = new Schema({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	
	// Basic information (from frontend form)
	description: { type: String, required: true, trim: true, maxlength: 200 },
	institution: { type: String, required: true, trim: true, maxlength: 100 },
	debtDate: { type: Date, required: true, comment: 'Data da dívida (data inicial)' },
	
	// Financial details
	totalValue: { type: Number, required: true, min: 0.01, comment: 'Valor total da dívida' },
	installmentCount: { type: Number, required: true, min: 1, comment: 'Quantidade de parcelas' },
	firstPaymentDate: { type: Date, required: true, comment: 'Data do primeiro pagamento' },
	
	// Calculated fields
	installmentValue: { 
		type: Number, 
		required: true, 
		min: 0.01,
		comment: 'Valor de cada parcela (totalValue / installmentCount)' 
	},
	
	// Installments tracking
	installments: {
		type: [installmentSchema],
		default: [],
		comment: 'Array of all installments with payment status'
	},
	
	// Status
	status: { 
		type: String, 
		enum: ['active', 'paid', 'cancelled', 'overdue'], 
		default: 'active',
		index: true
	},
	
	// Additional info
	debtType: { 
		type: String, 
		enum: ['personal_loan', 'vehicle_financing', 'credit_card_installment', 'mortgage', 'other'], 
		default: 'other' 
	},
	interestRate: { type: Number, min: 0, default: 0, comment: 'Taxa de juros (% ao mês)' },
	notes: { type: String, maxlength: 1000 },
	metadata: { type: Schema.Types.Mixed },
	
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now }
});

// Indexes
debtSchema.index({ userId: 1, status: 1 });
debtSchema.index({ userId: 1, createdAt: -1 });

// Auto-update updatedAt
debtSchema.pre('save', function(next) {
	this.updatedAt = new Date();
	next();
});

/**
 * Helper methods for debt calculations
 */

// Calculate remaining installments
debtSchema.methods.getRemainingInstallments = function() {
	return this.installments.filter(inst => !inst.isPaid).length;
};

// Calculate paid installments count
debtSchema.methods.getPaidInstallmentsCount = function() {
	return this.installments.filter(inst => inst.isPaid).length;
};

// Calculate total paid amount
debtSchema.methods.getTotalPaidAmount = function() {
	return this.installments
		.filter(inst => inst.isPaid)
		.reduce((sum, inst) => sum + (inst.paidAmount || inst.amount), 0);
};

// Calculate paid percentage
debtSchema.methods.getPaidPercentage = function() {
	if (this.installmentCount === 0) return 0;
	const paidCount = this.getPaidInstallmentsCount();
	return (paidCount / this.installmentCount) * 100;
};

// Calculate remaining value
debtSchema.methods.getRemainingValue = function() {
	const totalPaid = this.getTotalPaidAmount();
	return Math.max(0, this.totalValue - totalPaid);
};

// Get next payment due date
debtSchema.methods.getNextPaymentDueDate = function() {
	const unpaid = this.installments
		.filter(inst => !inst.isPaid)
		.sort((a, b) => a.dueDate - b.dueDate);
	return unpaid.length > 0 ? unpaid[0].dueDate : null;
};

// Get end date (last installment)
debtSchema.methods.getEndDate = function() {
	if (this.installments.length === 0) return null;
	const sorted = [...this.installments].sort((a, b) => b.dueDate - a.dueDate);
	return sorted[0].dueDate;
};

// Check for overdue installments
debtSchema.methods.hasOverdueInstallments = function() {
	const now = new Date();
	return this.installments.some(inst => !inst.isPaid && inst.dueDate < now);
};

/**
 * INTEGRATION NOTES:
 * 
 * Frontend requirements (dash.html):
 * 
 * 1. Add Debt Form (button "Adicionar dívida"):
 *    - description (Descrição da dívida)
 *    - institution (Instituição)
 *    - debtDate (Data da dívida)
 *    - totalValue (Valor total)
 *    - installmentCount (Quantidade de parcelas)
 *    - firstPaymentDate (Primeiro pagamento)
 * 
 * 2. Debt List Display (card "Dívidas"):
 *    - Show: "<installmentCount> - <paidCount> parcelas" (e.g., "24 - 6 parcelas")
 *    - Show: paid percentage (e.g., "25%")
 *    - Show: "Total pendente" (sum of all remaining values)
 * 
 * 3. Debt Details Modal:
 *    - Title: "<description> - <institution>"
 *    - Próximo pagamento: installmentNumber + dueDate or "Todas pagas"
 *    - Valor já pago: sum of paid installments
 *    - % pago: percentage
 *    - Término previsto: last installment date
 *    - Tab "Parcelas a pagar": list unpaid installments (with "Pagar" button)
 *    - Tab "Parcelas pagas": list paid installments
 *    - Mark overdue installments with special styling
 * 
 * DataAgent endpoints needed:
 * - POST /agent/execute { agent_name: "DataAgent", action: "createDebt", data: {...} }
 * - POST /agent/execute { agent_name: "DataAgent", action: "getDebts", userId: "..." }
 * - POST /agent/execute { agent_name: "DataAgent", action: "getDebtDetails", debtId: "...", userId: "..." }
 * - POST /agent/execute { agent_name: "DataAgent", action: "payInstallment", debtId: "...", installmentNumber: N, userId: "..." }
 * - POST /agent/execute { agent_name: "DataAgent", action: "updateDebt", debtId: "...", data: {...}, userId: "..." }
 * - POST /agent/execute { agent_name: "DataAgent", action: "deleteDebt", debtId: "...", userId: "..." }
 * 
 * Auto-generation of installments:
 * When creating a debt, generate all installments automatically:
 * - Calculate installmentValue = totalValue / installmentCount
 * - Starting from firstPaymentDate, generate monthly due dates
 * - Create installmentSchema objects for each installment
 */

module.exports = mongoose.model('Debt', debtSchema);
