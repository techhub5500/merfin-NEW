/**
 * NOTE (transaction-queries.js):
 * Purpose: Queries especializadas para buscar transações do MongoDB com filtros e agregações.
 * Recupera histórico, calcula sumários (receitas/despesas/saldo), filtra por período/tipo/status.
 * Controls: Usa model Transaction (transactions-schema.js), suporta paginação e múltiplas sections.
 * Behavior: Retorna transações ordenadas por data DESC, com sumários calculados (total_income,
 * total_expense, net_flow). Suporta filtros por section (statement, scheduled, credit_card, debt, asset).
 * Integration notes: Usado por DataAgent.fetchTransactions(). Queries otimizadas com índices
 * em { userId, date } e { accountId, status }. Limite padrão de 100 transações por query.
 */

const Transaction = require('../../database/schemas/transactions-schema');
const { LIMITS } = require('../shared/constants');

/**
 * Busca transações com filtros avançados
 * 
 * @param {object} params - Parâmetros da query
 * @param {string} params.user_id - ID do usuário
 * @param {string} [params.account_id] - ID da conta específica
 * @param {string} [params.section] - Seção específica (statement, scheduled, etc)
 * @param {Date} [params.start_date] - Data inicial
 * @param {Date} [params.end_date] - Data final
 * @param {string} [params.type] - Tipo de transação (income, expense, etc)
 * @param {string} [params.status] - Status (pending, confirmed, etc)
 * @param {number} [params.limit] - Limite de resultados (padrão: 100)
 * @param {number} [params.skip] - Pular N resultados (paginação)
 * @returns {Promise<object>} - Transações e sumários
 */
async function fetchTransactions(params) {
	const {
		user_id,
		account_id,
		section,
		start_date,
		end_date,
		type,
		status,
		limit = LIMITS.MAX_TRANSACTIONS_PER_QUERY,
		skip = 0
	} = params;

	// Constrói query base
	const query = {
		userId: user_id
	};

	// Filtros opcionais
	if (account_id) {
		query.accountId = account_id;
	}

	if (section) {
		query.section = section;
	}

	if (type) {
		query.type = type;
	}

	if (status) {
		query.status = status;
	}

	// Filtro de data
	if (start_date || end_date) {
		query.date = {};
		if (start_date) {
			query.date.$gte = new Date(start_date);
		}
		if (end_date) {
			query.date.$lte = new Date(end_date);
		}
	}

	try {
		// Busca transações com paginação
		const transactions = await Transaction.find(query)
			.sort({ date: -1 }) // Mais recentes primeiro
			.limit(Math.min(limit, LIMITS.MAX_TRANSACTIONS_PER_QUERY))
			.skip(skip)
			.select('-__v') // Exclui campo de versão do Mongoose
			.lean()
			.exec();

		// Conta total de transações (para paginação)
		const totalCount = await Transaction.countDocuments(query);

		// Transforma documentos
		const transformedTransactions = transactions.map(tx => ({
			transaction_id: tx._id.toString(),
			user_id: tx.userId.toString(),
			account_id: tx.accountId ? tx.accountId.toString() : null,
			section: tx.section,
			type: tx.type,
			amount: tx.amount,
			currency: tx.currency,
			date: tx.date,
			status: tx.status,
			description: tx.description,
			category: tx.category,
			tags: tx.tags || [],
			merchant: tx.merchant,
			reference_id: tx.referenceId,
			metadata: tx.metadata,
			created_at: tx.createdAt,
			// Campos específicos por section
			...(tx.section === 'statement' && tx.statement ? { statement: tx.statement } : {}),
			...(tx.section === 'scheduled' && tx.scheduled ? { scheduled: tx.scheduled } : {}),
			...(tx.section === 'credit_card' && tx.creditCard ? { credit_card: tx.creditCard } : {}),
			...(tx.section === 'debt' && tx.debt ? { debt: tx.debt } : {}),
			...(tx.section === 'asset' && tx.asset ? { asset: tx.asset } : {})
		}));

		// Calcula sumários (apenas para transações confirmadas)
		const summary = await calculateSummary(query);

		return {
			user_id,
			transactions: transformedTransactions,
			count: transformedTransactions.length,
			total_count: totalCount,
			pagination: {
				limit,
				skip,
				has_more: skip + transformedTransactions.length < totalCount
			},
			summary
		};

	} catch (error) {
		throw new Error(`Erro ao buscar transações: ${error.message}`);
	}
}

/**
 * Calcula sumários de transações (receitas, despesas, saldo)
 * 
 * @param {object} query - Query do MongoDB
 * @returns {Promise<object>} - Sumários calculados
 */
async function calculateSummary(query) {
	try {
		// Adiciona filtro para apenas transações confirmadas nos sumários
		const summaryQuery = {
			...query,
			status: 'confirmed',
			section: 'statement' // Sumários apenas para extrato executado
		};

		const result = await Transaction.aggregate([
			{ $match: summaryQuery },
			{
				$group: {
					_id: '$type',
					total: { $sum: '$amount' },
					count: { $sum: 1 }
				}
			}
		]);

		// Processa resultado da agregação
		let totalIncome = 0;
		let totalExpense = 0;
		let incomeCount = 0;
		let expenseCount = 0;

		result.forEach(item => {
			if (item._id === 'income') {
				totalIncome = item.total;
				incomeCount = item.count;
			} else if (item._id === 'expense') {
				totalExpense = item.total;
				expenseCount = item.count;
			}
		});

		const netFlow = totalIncome - totalExpense;

		return {
			total_income: totalIncome,
			income_count: incomeCount,
			total_expense: totalExpense,
			expense_count: expenseCount,
			net_flow: netFlow
		};

	} catch (error) {
		// Em caso de erro, retorna sumário zerado
		return {
			total_income: 0,
			income_count: 0,
			total_expense: 0,
			expense_count: 0,
			net_flow: 0
		};
	}
}

/**
 * Busca sumário rápido das transações recentes (últimos 30 dias)
 * 
 * @param {object} params - { user_id, account_id? }
 * @returns {Promise<object>} - Sumário dos últimos 30 dias
 */
async function fetchRecentSummary(params) {
	const { user_id, account_id } = params;

	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const query = {
		userId: user_id,
		section: 'statement',
		status: 'confirmed',
		date: { $gte: thirtyDaysAgo }
	};

	if (account_id) {
		query.accountId = account_id;
	}

	try {
		const summary = await calculateSummary(query);
		
		// Busca também transações pendentes
		const pendingCount = await Transaction.countDocuments({
			...query,
			status: 'pending'
		});

		return {
			period: 'last_30_days',
			start_date: thirtyDaysAgo,
			end_date: new Date(),
			...summary,
			pending_count: pendingCount
		};

	} catch (error) {
		throw new Error(`Erro ao buscar sumário recente: ${error.message}`);
	}
}

/**
 * Busca transações agrupadas por categoria
 * Útil para análises de gastos
 * 
 * @param {string} userId - ID do usuário
 * @param {string} type - Tipo de transação (income/expense)
 * @param {Date} startDate - Data inicial
 * @param {Date} endDate - Data final
 * @returns {Promise<array>} - Transações agrupadas por categoria
 */
async function fetchTransactionsByCategory(userId, type, startDate, endDate) {
	try {
		const match = {
			userId,
			type,
			section: 'statement',
			status: 'confirmed'
		};

		if (startDate || endDate) {
			match.date = {};
			if (startDate) match.date.$gte = new Date(startDate);
			if (endDate) match.date.$lte = new Date(endDate);
		}

		const result = await Transaction.aggregate([
			{ $match: match },
			{
				$group: {
					_id: '$category',
					total: { $sum: '$amount' },
					count: { $sum: 1 },
					average: { $avg: '$amount' }
				}
			},
			{ $sort: { total: -1 } }
		]);

		return result.map(item => ({
			category: item._id || 'Sem Categoria',
			total: item.total,
			count: item.count,
			average: item.average
		}));

	} catch (error) {
		throw new Error(`Erro ao agrupar por categoria: ${error.message}`);
	}
}

/**
 * Busca transações recorrentes (scheduled)
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<array>} - Transações agendadas
 */
async function fetchScheduledTransactions(userId) {
	try {
		const transactions = await Transaction.find({
			userId,
			section: 'scheduled',
			'scheduled.nextDate': { $exists: true }
		})
		.sort({ 'scheduled.nextDate': 1 })
		.select('-__v')
		.lean()
		.exec();

		return transactions.map(tx => ({
			transaction_id: tx._id.toString(),
			description: tx.description,
			amount: tx.amount,
			type: tx.type,
			frequency: tx.scheduled.frequency,
			next_date: tx.scheduled.nextDate,
			recurrence_count: tx.scheduled.recurrenceCount,
			end_date: tx.scheduled.endDate
		}));

	} catch (error) {
		throw new Error(`Erro ao buscar transações agendadas: ${error.message}`);
	}
}

/**
 * Busca contas futuras a receber (receivables)
 * Frontend: dash.html - Card "Contas Futuras" > Tab "A receber"
 * 
 * @param {object} params - { userId, limit?, includeOverdue? }
 * @returns {Promise<object>} - Contas a receber
 */
async function fetchReceivables(params) {
	const { userId, limit = 50, includeOverdue = true } = params;

	try {
		const now = new Date();
		const query = {
			userId,
			section: 'scheduled',
			$or: [
				{ 'scheduled.scheduledType': 'receivable' },
				{ type: 'income', 'scheduled.scheduledType': { $exists: false } }
			],
			status: { $ne: 'cancelled' }
		};

		// Filter by due date if not including overdue
		if (!includeOverdue) {
			query['scheduled.dueDate'] = { $gte: now };
		}

		const receivables = await Transaction.find(query)
			.sort({ 'scheduled.dueDate': 1 })
			.limit(limit)
			.select('-__v')
			.lean()
			.exec();

		const transformedReceivables = receivables.map(tx => ({
			transaction_id: tx._id.toString(),
			description: tx.description || 'Receita a receber',
			amount: tx.amount,
			dueDate: tx.scheduled.dueDate || tx.date,
			status: tx.status,
			isOverdue: tx.scheduled.dueDate && tx.scheduled.dueDate < now,
			merchant: tx.merchant,
			category: tx.category
		}));

		const totalAmount = transformedReceivables.reduce((sum, r) => sum + r.amount, 0);

		return {
			receivables: transformedReceivables,
			count: transformedReceivables.length,
			totalAmount: Number(totalAmount.toFixed(2))
		};

	} catch (error) {
		throw new Error(`Erro ao buscar contas a receber: ${error.message}`);
	}
}

/**
 * Busca contas futuras a pagar (payables)
 * Frontend: dash.html - Card "Contas Futuras" > Tab "A pagar"
 * 
 * @param {object} params - { userId, limit?, includeOverdue? }
 * @returns {Promise<object>} - Contas a pagar
 */
async function fetchPayables(params) {
	const { userId, limit = 50, includeOverdue = true } = params;

	try {
		const now = new Date();
		const query = {
			userId,
			section: 'scheduled',
			$or: [
				{ 'scheduled.scheduledType': 'payable' },
				{ type: 'expense', 'scheduled.scheduledType': { $exists: false } }
			],
			status: { $ne: 'cancelled' }
		};

		// Filter by due date if not including overdue
		if (!includeOverdue) {
			query['scheduled.dueDate'] = { $gte: now };
		}

		const payables = await Transaction.find(query)
			.sort({ 'scheduled.dueDate': 1 })
			.limit(limit)
			.select('-__v')
			.lean()
			.exec();

		const transformedPayables = payables.map(tx => ({
			transaction_id: tx._id.toString(),
			description: tx.description || 'Despesa a pagar',
			amount: tx.amount,
			dueDate: tx.scheduled.dueDate || tx.date,
			status: tx.status,
			isOverdue: tx.scheduled.dueDate && tx.scheduled.dueDate < now,
			merchant: tx.merchant,
			category: tx.category
		}));

		const totalAmount = transformedPayables.reduce((sum, p) => sum + p.amount, 0);

		return {
			payables: transformedPayables,
			count: transformedPayables.length,
			totalAmount: Number(totalAmount.toFixed(2))
		};

	} catch (error) {
		throw new Error(`Erro ao buscar contas a pagar: ${error.message}`);
	}
}

/**
 * Create a new transaction
 * 
 * @param {object} params - Transaction data
 * @returns {Promise<object>} - Created transaction
 */
async function createTransaction(params) {
	const {
		userId,
		accountId,
		section = 'statement',
		type,
		amount,
		date,
		description,
		category,
		status = 'confirmed',
		...additionalData
	} = params;

	try {
		const transaction = new Transaction({
			userId,
			accountId,
			section,
			type,
			amount,
			date: date || new Date(),
			description,
			category,
			status,
			...additionalData
		});

		await transaction.save();

		return {
			success: true,
			transaction: transaction.toObject()
		};

	} catch (error) {
		throw new Error(`Erro ao criar transação: ${error.message}`);
	}
}

/**
 * Get transaction summary for dashboard cards
 * Frontend: dash.html - Cards do topo (Receitas, Despesas, Saldo)
 * 
 * @param {object} params - { userId, startDate?, endDate? }
 * @returns {Promise<object>} - Summary with receitas, despesas, saldo
 */
async function getTransactionsSummary(params) {
	const { userId, startDate, endDate } = params;

	try {
		const query = {
			userId,
			section: 'statement',
			status: 'confirmed'
		};

		if (startDate || endDate) {
			query.date = {};
			if (startDate) query.date.$gte = new Date(startDate);
			if (endDate) query.date.$lte = new Date(endDate);
		}

		const summary = await calculateSummary(query);

		return {
			receitas: summary.total_income || 0,
			despesas: summary.total_expense || 0,
			saldo: summary.net_flow || 0,
			period: {
				startDate: startDate || 'all_time',
				endDate: endDate || new Date()
			}
		};

	} catch (error) {
		throw new Error(`Erro ao obter sumário de transações: ${error.message}`);
	}
}

/**
 * Get latest transactions for dashboard
 * Frontend: dash.html - Card "Últimas Transações"
 * 
 * @param {object} params - { userId, limit? }
 * @returns {Promise<object>} - Latest transactions
 */
async function getLatestTransactions(params) {
	const { userId, limit = 10 } = params;

	try {
		const transactions = await Transaction.find({
			userId,
			section: 'statement',
			status: { $in: ['confirmed', 'pending'] }
		})
		.sort({ date: -1 })
		.limit(limit)
		.select('-__v')
		.lean()
		.exec();

		const transformedTransactions = transactions.map(tx => ({
			transaction_id: tx._id.toString(),
			description: tx.description || (tx.type === 'income' ? 'Receita' : 'Despesa'),
			amount: tx.amount,
			type: tx.type,
			date: tx.date,
			status: tx.status,
			category: tx.category
		}));

		return {
			transactions: transformedTransactions,
			count: transformedTransactions.length
		};

	} catch (error) {
		throw new Error(`Erro ao buscar últimas transações: ${error.message}`);
	}
}

module.exports = {
	fetchTransactions,
	calculateSummary,
	fetchRecentSummary,
	fetchTransactionsByCategory,
	fetchScheduledTransactions,
	fetchReceivables,
	fetchPayables,
	createTransaction,
	getTransactionsSummary,
	getLatestTransactions
};
