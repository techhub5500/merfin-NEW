/**
 * NOTE (account-queries.js):
 * Purpose: Queries especializadas para buscar informações de contas bancárias do MongoDB.
 * Recupera saldos, detalhes de contas individuais e consolidação de múltiplas contas.
 * Controls: Usa model Account (accounts-schema.js), filtra por user_id e status.
 * Behavior: Retorna dados transformados e agregados, calcula total_balance automaticamente.
 * Integration notes: Usado por DataAgent.fetchAccountBalance(). Queries otimizadas
 * com índices em { user_id, status }. Sempre filtra contas fechadas ('closed').
 */

const Account = require('../../database/schemas/accounts-schema');

/**
 * Busca saldo de uma conta específica ou todas as contas de um usuário
 * 
 * @param {object} params - Parâmetros da query
 * @param {string} params.user_id - ID do usuário
 * @param {string} [params.account_id] - ID da conta específica (opcional)
 * @param {boolean} [params.include_closed] - Incluir contas fechadas (padrão: false)
 * @returns {Promise<object>} - Dados das contas com saldos
 */
async function fetchAccountBalance(params) {
	const { user_id, account_id, include_closed = false } = params;

	// Constrói query base
	const query = {
		userId: user_id
	};

	// Filtro por conta específica
	if (account_id) {
		query._id = account_id;
	}

	// Filtro de status (exclui fechadas por padrão)
	if (!include_closed) {
		query.status = { $ne: 'closed' };
	}

	try {
		// Busca contas do banco
		const accounts = await Account.find(query)
			.select('_id userId currency balance status createdAt updatedAt')
			.lean()
			.exec();

		if (!accounts || accounts.length === 0) {
			if (account_id) {
				throw new Error(`Conta ${account_id} não encontrada`);
			}
			
			// Usuário sem contas
			return {
				user_id,
				total_balance: 0,
				accounts: [],
				currency: 'BRL'
			};
		}

		// Transforma documentos MongoDB para formato de resposta
		const transformedAccounts = accounts.map(acc => ({
			account_id: acc._id.toString(),
			user_id: acc.userId.toString(),
			currency: acc.currency,
			balance: acc.balance,
			status: acc.status,
			created_at: acc.createdAt,
			updated_at: acc.updatedAt
		}));

		// Calcula saldo total
		const totalBalance = transformedAccounts.reduce(
			(sum, acc) => sum + (acc.balance || 0), 
			0
		);

		// Se foi query por conta específica, retorna só ela
		if (account_id) {
			return {
				user_id,
				account: transformedAccounts[0],
				currency: transformedAccounts[0].currency
			};
		}

		// Retorna todas as contas com total
		return {
			user_id,
			total_balance: totalBalance,
			accounts: transformedAccounts,
			currency: 'BRL', // Pode ser determinado pela conta principal
			accounts_count: transformedAccounts.length
		};

	} catch (error) {
		// Re-lança erro com contexto adicional
		throw new Error(`Erro ao buscar saldos: ${error.message}`);
	}
}

/**
 * Busca detalhes completos de uma conta específica
 * 
 * @param {string} accountId - ID da conta
 * @returns {Promise<object>} - Detalhes completos da conta
 */
async function fetchAccountDetails(accountId) {
	try {
		const account = await Account.findById(accountId)
			.populate('userId', 'name email') // Popula dados básicos do usuário
			.lean()
			.exec();

		if (!account) {
			throw new Error(`Conta ${accountId} não encontrada`);
		}

		return {
			account_id: account._id.toString(),
			user_id: account.userId._id.toString(),
			user_name: account.userId.name,
			currency: account.currency,
			balance: account.balance,
			status: account.status,
			created_at: account.createdAt,
			updated_at: account.updatedAt
		};

	} catch (error) {
		throw new Error(`Erro ao buscar detalhes da conta: ${error.message}`);
	}
}

/**
 * Busca contas agrupadas por status
 * Útil para dashboards e sumários
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<object>} - Contas agrupadas por status
 */
async function fetchAccountsByStatus(userId) {
	try {
		const accounts = await Account.find({ userId })
			.select('_id currency balance status')
			.lean()
			.exec();

		const grouped = {
			active: [],
			suspended: [],
			closed: []
		};

		accounts.forEach(acc => {
			grouped[acc.status].push({
				account_id: acc._id.toString(),
				currency: acc.currency,
				balance: acc.balance
			});
		});

		return {
			user_id: userId,
			grouped_accounts: grouped,
			total_active: grouped.active.length,
			total_suspended: grouped.suspended.length,
			total_closed: grouped.closed.length
		};

	} catch (error) {
		throw new Error(`Erro ao agrupar contas: ${error.message}`);
	}
}

/**
 * Verifica se uma conta pertence a um usuário
 * Útil para validações de autorização
 * 
 * @param {string} accountId - ID da conta
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} - True se a conta pertence ao usuário
 */
async function verifyAccountOwnership(accountId, userId) {
	try {
		const account = await Account.findOne({
			_id: accountId,
			userId: userId
		})
		.select('_id')
		.lean()
		.exec();

		return !!account;

	} catch (error) {
		return false;
	}
}

/**
 * Busca contas com saldo abaixo de um limite
 * Útil para alertas e notificações
 * 
 * @param {string} userId - ID do usuário
 * @param {number} threshold - Limite de saldo
 * @returns {Promise<array>} - Contas com saldo baixo
 */
async function fetchLowBalanceAccounts(userId, threshold = 100) {
	try {
		const accounts = await Account.find({
			userId,
			status: 'active',
			balance: { $lt: threshold }
		})
		.select('_id currency balance')
		.lean()
		.exec();

		return accounts.map(acc => ({
			account_id: acc._id.toString(),
			currency: acc.currency,
			balance: acc.balance,
			threshold
		}));

	} catch (error) {
		throw new Error(`Erro ao buscar contas com saldo baixo: ${error.message}`);
	}
}

module.exports = {
	fetchAccountBalance,
	fetchAccountDetails,
	fetchAccountsByStatus,
	verifyAccountOwnership,
	fetchLowBalanceAccounts
};
