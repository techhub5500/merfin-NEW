/**
 * NOTE (debt-queries.js):
 * Purpose: Queries específicas para dívidas e parcelas
 * Controls: CRUD operations for debts and installment tracking
 * Integration notes: Usado pelo DataAgent para operações de dívidas
 */

const Debt = require('../../database/schemas/debt-schema');

/**
 * Get all debts for a user
 */
async function getDebts(params) {
	const { userId, status } = params;

	const query = { userId };
	if (status) {
		query.status = status;
	}

	const debts = await Debt.find(query).sort({ createdAt: -1 }).lean();

	// Calculate summaries for each debt
	const debtsWithSummary = debts.map(debt => {
		const paidCount = debt.installments.filter(i => i.isPaid).length;
		const totalPaid = debt.installments
			.filter(i => i.isPaid)
			.reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);
		const remainingValue = debt.totalValue - totalPaid;
		const paidPercentage = (paidCount / debt.installmentCount) * 100;

		return {
			...debt,
			paidInstallmentsCount: paidCount,
			remainingInstallmentsCount: debt.installmentCount - paidCount,
			totalPaid: Number(totalPaid.toFixed(2)),
			remainingValue: Number(remainingValue.toFixed(2)),
			paidPercentage: Number(paidPercentage.toFixed(2))
		};
	});

	// Calculate total pending across all debts
	const totalPending = debtsWithSummary.reduce((sum, d) => sum + d.remainingValue, 0);

	return {
		debts: debtsWithSummary,
		count: debtsWithSummary.length,
		totalPending: Number(totalPending.toFixed(2))
	};
}

/**
 * Get a specific debt by ID with full details
 */
async function getDebtDetails(params) {
	const { debtId, userId } = params;

	const debt = await Debt.findOne({ _id: debtId, userId }).lean();

	if (!debt) {
		throw new Error(`Debt not found: ${debtId}`);
	}

	const now = new Date();

	// Separate installments into pending and paid
	const pendingInstallments = debt.installments
		.filter(i => !i.isPaid)
		.map(i => ({
			...i,
			isOverdue: i.dueDate < now
		}))
		.sort((a, b) => a.installmentNumber - b.installmentNumber);

	const paidInstallments = debt.installments
		.filter(i => i.isPaid)
		.sort((a, b) => b.installmentNumber - a.installmentNumber);

	// Calculate summary
	const paidCount = paidInstallments.length;
	const totalPaid = paidInstallments.reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);
	const remainingValue = debt.totalValue - totalPaid;
	const paidPercentage = (paidCount / debt.installmentCount) * 100;

	// Get next payment
	const nextPayment = pendingInstallments.length > 0 ? pendingInstallments[0] : null;

	// Get end date
	const allInstallments = [...debt.installments].sort((a, b) => b.dueDate - a.dueDate);
	const endDate = allInstallments.length > 0 ? allInstallments[0].dueDate : null;

	return {
		...debt,
		summary: {
			nextPayment: nextPayment ? {
				installmentNumber: nextPayment.installmentNumber,
				dueDate: nextPayment.dueDate,
				amount: nextPayment.amount,
				isOverdue: nextPayment.isOverdue
			} : null,
			totalPaid: Number(totalPaid.toFixed(2)),
			paidPercentage: Number(paidPercentage.toFixed(2)),
			remainingValue: Number(remainingValue.toFixed(2)),
			endDate,
			paidCount,
			remainingCount: debt.installmentCount - paidCount
		},
		pendingInstallments,
		paidInstallments
	};
}

/**
 * Create a new debt with auto-generated installments
 */
async function createDebt(params) {
	const { 
		userId, 
		description, 
		institution, 
		debtDate, 
		totalValue, 
		installmentCount, 
		firstPaymentDate,
		debtType,
		interestRate,
		notes
	} = params;

	// Calculate installment value
	const installmentValue = totalValue / installmentCount;

	// Generate installments array
	const installments = [];
	const firstDate = new Date(firstPaymentDate);

	for (let i = 1; i <= installmentCount; i++) {
		const dueDate = new Date(firstDate);
		dueDate.setMonth(dueDate.getMonth() + (i - 1));

		installments.push({
			installmentNumber: i,
			dueDate,
			amount: Number(installmentValue.toFixed(2)),
			isPaid: false
		});
	}

	const debt = new Debt({
		userId,
		description,
		institution,
		debtDate,
		totalValue,
		installmentCount,
		firstPaymentDate,
		installmentValue: Number(installmentValue.toFixed(2)),
		installments,
		status: 'active',
		debtType,
		interestRate,
		notes
	});

	await debt.save();

	return {
		success: true,
		debt: debt.toObject()
	};
}

/**
 * Pay an installment
 */
async function payInstallment(params) {
	const { debtId, userId, installmentNumber, paidAmount } = params;

	const debt = await Debt.findOne({ _id: debtId, userId });

	if (!debt) {
		throw new Error(`Debt not found: ${debtId}`);
	}

	// Find the installment
	const installment = debt.installments.find(i => i.installmentNumber === installmentNumber);

	if (!installment) {
		throw new Error(`Installment ${installmentNumber} not found`);
	}

	if (installment.isPaid) {
		throw new Error(`Installment ${installmentNumber} is already paid`);
	}

	// Mark as paid
	installment.isPaid = true;
	installment.paidAt = new Date();
	installment.paidAmount = paidAmount !== undefined ? paidAmount : installment.amount;

	// Check if all installments are paid
	const allPaid = debt.installments.every(i => i.isPaid);
	if (allPaid) {
		debt.status = 'paid';
	}

	await debt.save();

	return {
		success: true,
		debt: debt.toObject(),
		installmentPaid: installment.installmentNumber
	};
}

/**
 * Update a debt
 */
async function updateDebt(params) {
	const { debtId, userId, updates } = params;

	const allowedUpdates = ['description', 'institution', 'notes', 'status', 'debtType', 'interestRate'];
	const filteredUpdates = {};

	for (const key of allowedUpdates) {
		if (updates[key] !== undefined) {
			filteredUpdates[key] = updates[key];
		}
	}

	filteredUpdates.updatedAt = new Date();

	const debt = await Debt.findOneAndUpdate(
		{ _id: debtId, userId },
		{ $set: filteredUpdates },
		{ new: true }
	).lean();

	if (!debt) {
		throw new Error(`Debt not found: ${debtId}`);
	}

	return {
		success: true,
		debt
	};
}

/**
 * Delete a debt
 */
async function deleteDebt(params) {
	const { debtId, userId } = params;

	const result = await Debt.deleteOne({ _id: debtId, userId });

	if (result.deletedCount === 0) {
		throw new Error(`Debt not found: ${debtId}`);
	}

	return {
		success: true,
		deletedCount: result.deletedCount
	};
}

module.exports = {
	getDebts,
	getDebtDetails,
	createDebt,
	payInstallment,
	updateDebt,
	deleteDebt
};
