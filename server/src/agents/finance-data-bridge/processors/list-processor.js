/**
 * NOTE (list-processor.js):
 * Purpose: Processa listagens com paginação e ordenação.
 * Garante limite máximo de 150 registros por requisição.
 * Design: Retorna metadata de paginação para navegação.
 */

const mongoose = require('mongoose');
const Transaction = require('../../../database/schemas/transactions-schema');
const Debt = require('../../../database/schemas/debt-schema');
const CreditCard = require('../../../database/schemas/credit-card-schema');
const { logger } = require('../utils/bridge-logger');

/**
 * Limites de paginação
 */
const PAGINATION_LIMITS = {
	DEFAULT: 20,
	MAX: 150
};

/**
 * Classe ListProcessor
 * Processa listagens paginadas
 */
class ListProcessor {
	
	/**
	 * Lista transações com paginação
	 * @param {ObjectId} userId - ID do usuário
	 * @param {object} dateRange - { startDate, endDate }
	 * @param {object} filters - Filtros
	 * @param {object} options - { limit, page, sortBy, sortOrder }
	 * @returns {object} - { data, pagination }
	 */
	async listTransactions(userId, dateRange, filters = {}, options = {}) {
		const startTime = Date.now();
		
		// Normaliza opções
		const limit = Math.min(options.limit || PAGINATION_LIMITS.DEFAULT, PAGINATION_LIMITS.MAX);
		const page = Math.max(options.page || 1, 1);
		const skip = (page - 1) * limit;
		const sortBy = options.sortBy || 'date';
		const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

		// Monta query
		const query = this._buildTransactionQuery(userId, dateRange, filters);

		try {
			// Conta total para paginação
			const totalItems = await Transaction.countDocuments(query);
			const totalPages = Math.ceil(totalItems / limit);

			// Busca transações
			const sortQuery = { [sortBy]: sortOrder };
			
			const transactions = await Transaction.find(query)
				.sort(sortQuery)
				.skip(skip)
				.limit(limit)
				.select('-__v')
				.lean();

			// Transforma dados
			const data = transactions.map(tx => this._transformTransaction(tx));

			logger.decision('LIST_TRANSACTIONS', `Found ${data.length} of ${totalItems}, page ${page}/${totalPages}`);

			return {
				data,
				pagination: {
					page,
					limit,
					totalItems,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1,
					nextPage: page < totalPages ? page + 1 : null,
					prevPage: page > 1 ? page - 1 : null
				},
				meta: {
					durationMs: Date.now() - startTime,
					filters: this._summarizeFilters(filters),
					sortBy,
					sortOrder: sortOrder === 1 ? 'asc' : 'desc'
				}
			};

		} catch (error) {
			logger.error('LIST_TRANSACTIONS_FAILED', error);
			throw error;
		}
	}

	/**
	 * Lista dívidas com paginação
	 */
	async listDebts(userId, filters = {}, options = {}) {
		const limit = Math.min(options.limit || PAGINATION_LIMITS.DEFAULT, PAGINATION_LIMITS.MAX);
		const page = Math.max(options.page || 1, 1);
		const skip = (page - 1) * limit;

		const query = { userId: new mongoose.Types.ObjectId(userId) };
		
		if (filters.status) {
			query.status = filters.status;
		}

		try {
			const totalItems = await Debt.countDocuments(query);
			const totalPages = Math.ceil(totalItems / limit);

			const debts = await Debt.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean();

			const data = debts.map(debt => this._transformDebt(debt));

			return {
				data,
				pagination: {
					page,
					limit,
					totalItems,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1
				}
			};

		} catch (error) {
			logger.error('LIST_DEBTS_FAILED', error);
			throw error;
		}
	}

	/**
	 * Lista cartões de crédito
	 */
	async listCreditCards(userId, filters = {}, options = {}) {
		const query = { userId: new mongoose.Types.ObjectId(userId) };
		
		if (filters.status) {
			query.status = filters.status;
		}

		try {
			const cards = await CreditCard.find(query)
				.sort({ createdAt: -1 })
				.lean();

			const data = cards.map(card => ({
				cardId: card._id.toString(),
				cardName: card.cardName,
				brand: card.brand,
				creditLimit: card.creditLimit,
				billingCycleRenewalDay: card.billingCycleRenewalDay,
				billingDueDay: card.billingDueDay,
				status: card.status,
				lastFourDigits: card.lastFourDigits
			}));

			return {
				data,
				pagination: {
					page: 1,
					limit: data.length,
					totalItems: data.length,
					totalPages: 1,
					hasNext: false,
					hasPrev: false
				}
			};

		} catch (error) {
			logger.error('LIST_CREDIT_CARDS_FAILED', error);
			throw error;
		}
	}

	/**
	 * Lista transações agendadas
	 */
	async listScheduledTransactions(userId, dateRange, filters = {}, options = {}) {
		const limit = Math.min(options.limit || PAGINATION_LIMITS.DEFAULT, PAGINATION_LIMITS.MAX);
		const page = Math.max(options.page || 1, 1);
		const skip = (page - 1) * limit;

		const query = {
			userId: new mongoose.Types.ObjectId(userId),
			section: 'scheduled',
			status: { $in: ['pending', 'confirmed'] }
		};

		// Filtro por tipo (receivable/payable)
		if (filters.scheduledType === 'receivable' || filters.type === 'income') {
			query.type = 'income';
		} else if (filters.scheduledType === 'payable' || filters.type === 'expense') {
			query.type = 'expense';
		}

		// Filtro por data de vencimento
		if (dateRange && dateRange.startDate && dateRange.endDate) {
			query['scheduled.dueDate'] = {
				$gte: dateRange.startDate,
				$lte: dateRange.endDate
			};
		}

		try {
			const totalItems = await Transaction.countDocuments(query);
			const totalPages = Math.ceil(totalItems / limit);

			const transactions = await Transaction.find(query)
				.sort({ 'scheduled.dueDate': 1 }) // Próximos vencimentos primeiro
				.skip(skip)
				.limit(limit)
				.lean();

			const data = transactions.map(tx => ({
				transactionId: tx._id.toString(),
				description: tx.description,
				amount: tx.amount,
				type: tx.type,
				category: tx.category,
				dueDate: tx.scheduled?.dueDate,
				frequency: tx.scheduled?.frequency,
				nextDate: tx.scheduled?.nextDate,
				status: tx.status,
				isOverdue: tx.scheduled?.dueDate && tx.scheduled.dueDate < new Date()
			}));

			return {
				data,
				pagination: {
					page,
					limit,
					totalItems,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1
				}
			};

		} catch (error) {
			logger.error('LIST_SCHEDULED_FAILED', error);
			throw error;
		}
	}

	/**
	 * Busca detalhe de uma transação específica
	 */
	async getTransactionDetail(userId, transactionId) {
		try {
			const transaction = await Transaction.findOne({
				_id: new mongoose.Types.ObjectId(transactionId),
				userId: new mongoose.Types.ObjectId(userId)
			}).lean();

			if (!transaction) {
				return null;
			}

			return this._transformTransaction(transaction, true);

		} catch (error) {
			logger.error('GET_TRANSACTION_DETAIL_FAILED', error, { transactionId });
			throw error;
		}
	}

	// ========== HELPERS ==========

	/**
	 * Constrói query para transações
	 */
	_buildTransactionQuery(userId, dateRange, filters) {
		const query = {
			userId: new mongoose.Types.ObjectId(userId)
		};

		// Seção
		if (filters.section) {
			query.section = filters.section;
		} else {
			query.section = 'statement';
		}

		// Status
		if (filters.status) {
			query.status = filters.status;
		}

		// Tipo
		if (filters.type) {
			query.type = filters.type;
		}

		// Categoria
		if (filters.category) {
			query.category = filters.category;
		}

		// Range de datas
		if (dateRange && dateRange.startDate && dateRange.endDate) {
			query.date = {
				$gte: dateRange.startDate,
				$lte: dateRange.endDate
			};
		}

		// Valor mínimo/máximo
		if (filters.minValue !== null || filters.maxValue !== null) {
			query.amount = {};
			if (filters.minValue !== null) query.amount.$gte = filters.minValue;
			if (filters.maxValue !== null) query.amount.$lte = filters.maxValue;
		}

		return query;
	}

	/**
	 * Transforma documento de transação para resposta
	 */
	_transformTransaction(tx, includeDetails = false) {
		const base = {
			transactionId: tx._id.toString(),
			accountId: tx.accountId?.toString() || null,
			section: tx.section,
			type: tx.type,
			amount: tx.amount,
			currency: tx.currency || 'BRL',
			date: tx.date,
			status: tx.status,
			description: tx.description,
			category: tx.category,
			merchant: tx.merchant || null
		};

		if (includeDetails) {
			base.tags = tx.tags || [];
			base.referenceId = tx.referenceId;
			base.metadata = tx.metadata;
			base.createdAt = tx.createdAt;
			
			// Dados específicos por seção
			if (tx.section === 'scheduled' && tx.scheduled) {
				base.scheduled = tx.scheduled;
			}
			if (tx.section === 'credit_card' && tx.creditCard) {
				base.creditCard = tx.creditCard;
			}
			if (tx.section === 'debt' && tx.debt) {
				base.debt = tx.debt;
			}
			if (tx.section === 'asset' && tx.asset) {
				base.asset = tx.asset;
			}
		}

		return base;
	}

	/**
	 * Transforma documento de dívida para resposta
	 */
	_transformDebt(debt) {
		const paidCount = debt.installments.filter(i => i.isPaid).length;
		const paidAmount = debt.installments
			.filter(i => i.isPaid)
			.reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);

		return {
			debtId: debt._id.toString(),
			description: debt.description,
			institution: debt.institution,
			debtDate: debt.debtDate,
			totalValue: debt.totalValue,
			installmentCount: debt.installmentCount,
			installmentValue: debt.installmentValue,
			paidInstallments: paidCount,
			remainingInstallments: debt.installmentCount - paidCount,
			paidAmount: paidAmount,
			remainingAmount: debt.totalValue - paidAmount,
			status: debt.status,
			debtType: debt.debtType,
			interestRate: debt.interestRate
		};
	}

	/**
	 * Sumariza filtros aplicados
	 */
	_summarizeFilters(filters) {
		const applied = {};
		if (filters.section) applied.section = filters.section;
		if (filters.type) applied.type = filters.type;
		if (filters.category) applied.category = filters.category;
		if (filters.status) applied.status = filters.status;
		return applied;
	}
}

module.exports = {
	ListProcessor,
	PAGINATION_LIMITS
};
