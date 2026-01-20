/**
 * NOTE (credit-card-queries.js):
 * Purpose: Queries específicas para cartões de crédito
 * Controls: CRUD operations for credit cards and utilization calculations
 * Integration notes: Usado pelo DataAgent para operações de cartão de crédito
 */

const CreditCard = require('../../database/schemas/credit-card-schema');
const Transaction = require('../../database/schemas/transactions-schema');

/**
 * Get all credit cards for a user
 */
async function getCreditCards(params) {
	const { userId, status = 'active' } = params;

	const query = { userId };
	if (status) {
		query.status = status;
	}

	const cards = await CreditCard.find(query).sort({ createdAt: -1 }).lean();

	return {
		cards,
		count: cards.length
	};
}

/**
 * Get a specific credit card by ID
 */
async function getCreditCardById(params) {
	const { cardId, userId } = params;

	const card = await CreditCard.findOne({ _id: cardId, userId }).lean();

	if (!card) {
		throw new Error(`Credit card not found: ${cardId}`);
	}

	return card;
}

/**
 * Create a new credit card
 */
async function createCreditCard(params) {
	const { userId, cardName, creditLimit, billingCycleRenewalDay, billingDueDay, brand, lastFourDigits } = params;

	const card = new CreditCard({
		userId,
		cardName,
		creditLimit,
		billingCycleRenewalDay,
		billingDueDay,
		brand,
		lastFourDigits,
		status: 'active'
	});

	await card.save();

	return {
		success: true,
		card: card.toObject()
	};
}

/**
 * Update a credit card
 */
async function updateCreditCard(params) {
	const { cardId, userId, updates } = params;

	const allowedUpdates = ['cardName', 'creditLimit', 'billingCycleRenewalDay', 'billingDueDay', 'brand', 'lastFourDigits', 'status'];
	const filteredUpdates = {};

	for (const key of allowedUpdates) {
		if (updates[key] !== undefined) {
			filteredUpdates[key] = updates[key];
		}
	}

	filteredUpdates.updatedAt = new Date();

	const card = await CreditCard.findOneAndUpdate(
		{ _id: cardId, userId },
		{ $set: filteredUpdates },
		{ new: true }
	).lean();

	if (!card) {
		throw new Error(`Credit card not found: ${cardId}`);
	}

	return {
		success: true,
		card
	};
}

/**
 * Delete a credit card
 */
async function deleteCreditCard(params) {
	const { cardId, userId } = params;

	const result = await CreditCard.deleteOne({ _id: cardId, userId });

	if (result.deletedCount === 0) {
		throw new Error(`Credit card not found: ${cardId}`);
	}

	return {
		success: true,
		deletedCount: result.deletedCount
	};
}

/**
 * Calculate current billing cycle dates
 */
function calculateBillingCycleDates(billingCycleRenewalDay) {
	const now = new Date();
	const currentMonth = now.getMonth();
	const currentYear = now.getFullYear();
	const currentDay = now.getDate();

	let cycleStartMonth = currentMonth;
	let cycleStartYear = currentYear;

	// If we're before the renewal day, cycle started last month
	if (currentDay < billingCycleRenewalDay) {
		cycleStartMonth = currentMonth - 1;
		if (cycleStartMonth < 0) {
			cycleStartMonth = 11;
			cycleStartYear--;
		}
	}

	const cycleStart = new Date(cycleStartYear, cycleStartMonth, billingCycleRenewalDay, 0, 0, 0, 0);
	
	// Next cycle starts one month after
	let cycleEndMonth = cycleStartMonth + 1;
	let cycleEndYear = cycleStartYear;
	if (cycleEndMonth > 11) {
		cycleEndMonth = 0;
		cycleEndYear++;
	}

	const cycleEnd = new Date(cycleEndYear, cycleEndMonth, billingCycleRenewalDay, 0, 0, 0, 0);

	return { cycleStart, cycleEnd };
}

/**
 * Get credit card utilization (current billing cycle)
 */
async function getCreditCardUtilization(params) {
	const { cardId, userId } = params;

	// Get the card
	const card = await CreditCard.findOne({ _id: cardId, userId }).lean();

	if (!card) {
		throw new Error(`Credit card not found: ${cardId}`);
	}

	// Calculate current billing cycle
	const { cycleStart, cycleEnd } = calculateBillingCycleDates(card.billingCycleRenewalDay);

	// Get all transactions for this card in the current cycle
	const transactions = await Transaction.find({
		userId,
		section: 'credit_card',
		'creditCard.cardId': cardId.toString(),
		date: { $gte: cycleStart, $lt: cycleEnd },
		status: { $ne: 'cancelled' }
	}).lean();

	// Calculate utilization
	const utilizedAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
	const availableCredit = Math.max(0, card.creditLimit - utilizedAmount);
	const utilizationPercentage = card.creditLimit > 0 ? (utilizedAmount / card.creditLimit) * 100 : 0;

	return {
		cardId: card._id,
		cardName: card.cardName,
		creditLimit: card.creditLimit,
		utilizedAmount: Number(utilizedAmount.toFixed(2)),
		availableCredit: Number(availableCredit.toFixed(2)),
		utilizationPercentage: Number(utilizationPercentage.toFixed(2)),
		currentBill: Number(utilizedAmount.toFixed(2)),
		billingCycle: {
			start: cycleStart,
			end: cycleEnd,
			renewalDay: card.billingCycleRenewalDay,
			dueDay: card.billingDueDay
		},
		transactionsCount: transactions.length
	};
}

module.exports = {
	getCreditCards,
	getCreditCardById,
	createCreditCard,
	updateCreditCard,
	deleteCreditCard,
	getCreditCardUtilization,
	calculateBillingCycleDates
};
