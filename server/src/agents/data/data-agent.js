/**
 * NOTE (data-agent.js):
 * Purpose: Agente responsável por todas as operações de leitura de dados do MongoDB.
 * Fornece acesso a saldos de contas, transações, perfil de usuário e validações de integridade.
 * Controls: Ações mapeadas: fetchAccountBalance, fetchTransactions, fetchUserProfile,
 * fetchAccountSummary, validateDataIntegrity. Usa cache agressivo para performance.
 * Behavior: Estende BaseAgent, delega queries para módulos especializados, gerencia cache.
 * Integration notes: Primeiro agente funcional do sistema, serve de modelo para outros.
 * Usado por orquestrador e pode ser chamado diretamente via API. Cache gerenciado por ToolContext.
 */

const BaseAgent = require('../shared/base-agent');
const accountQueries = require('./account-queries');
const transactionQueries = require('./transaction-queries');
const userQueries = require('./user-queries');
const creditCardQueries = require('./credit-card-queries');
const debtQueries = require('./debt-queries');
const dataValidator = require('./data-validator');
const cacheManager = require('./cache-manager');
const { AGENT_ACTIONS } = require('../shared/constants');

/**
 * DataAgent - Agente de acesso a dados do sistema
 * 
 * Responsabilidades:
 * - Buscar saldos e informações de contas
 * - Recuperar histórico de transações
 * - Obter perfil financeiro do usuário
 * - Validar integridade dos dados
 * - Gerenciar cache de dados frequentemente acessados
 */
class DataAgent extends BaseAgent {
	constructor(config = {}) {
		super('DataAgent', config);
		
		// Mapeamento de ações para métodos
		this.actionMap = {
			// Account actions
			fetchAccountBalance: this.fetchAccountBalance.bind(this),
			fetchAccountSummary: this.fetchAccountSummary.bind(this),
			
			// Transaction actions
			fetchTransactions: this.fetchTransactions.bind(this),
			getLatestTransactions: this.getLatestTransactions.bind(this),
			getTransactionsSummary: this.getTransactionsSummary.bind(this),
			createTransaction: this.createTransaction.bind(this),
			
			// Scheduled transactions (Contas Futuras)
			fetchReceivables: this.fetchReceivables.bind(this),
			fetchPayables: this.fetchPayables.bind(this),
			
			// Credit card actions
			getCreditCards: this.getCreditCards.bind(this),
			getCreditCardById: this.getCreditCardById.bind(this),
			createCreditCard: this.createCreditCard.bind(this),
			updateCreditCard: this.updateCreditCard.bind(this),
			deleteCreditCard: this.deleteCreditCard.bind(this),
			getCreditCardUtilization: this.getCreditCardUtilization.bind(this),
			
			// Debt actions
			getDebts: this.getDebts.bind(this),
			getDebtDetails: this.getDebtDetails.bind(this),
			createDebt: this.createDebt.bind(this),
			payInstallment: this.payInstallment.bind(this),
			updateDebt: this.updateDebt.bind(this),
			deleteDebt: this.deleteDebt.bind(this),
			
			// User & validation
			fetchUserProfile: this.fetchUserProfile.bind(this),
			validateDataIntegrity: this.validateDataIntegrity.bind(this)
		};
	}

	/**
	 * Método principal de execução
	 * @param {object} request - Requisição no formato padrão
	 * @returns {Promise<object>} - Resultado da ação
	 */
	async execute(request) {
		const { action, parameters, context } = request;

		// Valida se a ação é suportada
		if (!this.actionMap[action]) {
			const validActions = Object.keys(this.actionMap).join(', ');
			throw new Error(
				`Ação "${action}" não suportada pelo DataAgent. ` +
				`Ações válidas: ${validActions}`
			);
		}

		// Inicializa cache manager com contexto
		if (context && context.toolContext) {
			cacheManager.setToolContext(context.toolContext);
		}

		this._log('info', `Executando ação: ${action}`);

		// Executa a ação correspondente
		return await this.actionMap[action](parameters, context);
	}

	/**
	 * Busca saldo de uma ou mais contas
	 * @param {object} params - { user_id, account_id? }
	 * @param {object} context - Contexto da requisição
	 * @returns {Promise<object>} - Saldos das contas
	 */
	async fetchAccountBalance(params, context) {
		this._validateParams(params, ['user_id']);

		const cacheKey = params.account_id 
			? `account_balance_${params.account_id}`
			: `account_balances_${params.user_id}`;

		// Tenta buscar do cache
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return {
				...cached,
				_cached: true,
				_cache_key: cacheKey
			};
		}

		this._log('debug', `Cache MISS: ${cacheKey}`);

		// Busca do banco
		const result = await accountQueries.fetchAccountBalance(params);

		// Armazena no cache
		await cacheManager.set(cacheKey, result, 'ACCOUNT_BALANCE');

		return result;
	}

	/**
	 * Busca transações com filtros
	 * @param {object} params - { user_id, account_id?, start_date?, end_date?, type?, status?, limit? }
	 * @param {object} context - Contexto da requisição
	 * @returns {Promise<object>} - Lista de transações com sumários
	 */
	async fetchTransactions(params, context) {
		this._validateParams(params, ['user_id']);

		// Cache key baseado em filtros
		const cacheKey = cacheManager.generateTransactionCacheKey(params);

		// Tenta buscar do cache
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return {
				...cached,
				_cached: true,
				_cache_key: cacheKey
			};
		}

		this._log('debug', `Cache MISS: ${cacheKey}`);

		// Busca do banco
		const result = await transactionQueries.fetchTransactions(params);

		// Armazena no cache
		await cacheManager.set(cacheKey, result, 'RECENT_TRANSACTIONS');

		return result;
	}

	/**
	 * Busca perfil completo do usuário
	 * @param {object} params - { user_id }
	 * @param {object} context - Contexto da requisição
	 * @returns {Promise<object>} - Perfil do usuário
	 */
	async fetchUserProfile(params, context) {
		this._validateParams(params, ['user_id']);

		const cacheKey = `user_profile_${params.user_id}`;

		// Tenta buscar do cache (TTL longo)
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return {
				...cached,
				_cached: true,
				_cache_key: cacheKey
			};
		}

		this._log('debug', `Cache MISS: ${cacheKey}`);

		// Busca do banco
		const result = await userQueries.fetchUserProfile(params);

		// Armazena no cache com TTL longo
		await cacheManager.set(cacheKey, result, 'USER_PROFILE');

		return result;
	}

	/**
	 * Busca sumário consolidado de todas as contas do usuário
	 * @param {object} params - { user_id }
	 * @param {object} context - Contexto da requisição
	 * @returns {Promise<object>} - Sumário financeiro
	 */
	async fetchAccountSummary(params, context) {
		this._validateParams(params, ['user_id']);

		const cacheKey = `account_summary_${params.user_id}`;

		// Tenta buscar do cache
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return {
				...cached,
				_cached: true,
				_cache_key: cacheKey
			};
		}

		this._log('debug', `Cache MISS: ${cacheKey}`);

		// Busca contas e transações recentes
		const accounts = await accountQueries.fetchAccountBalance(params);
		const transactions = await transactionQueries.fetchRecentSummary(params);

		const result = {
			user_id: params.user_id,
			total_balance: accounts.total_balance || 0,
			accounts_count: accounts.accounts ? accounts.accounts.length : 0,
			accounts: accounts.accounts || [],
			recent_summary: transactions
		};

		// Armazena no cache
		await cacheManager.set(cacheKey, result, 'ACCOUNT_SUMMARY');

		return result;
	}

	/**
	 * Valida integridade dos dados financeiros
	 * @param {object} params - { user_id, checks? }
	 * @param {object} context - Contexto da requisição
	 * @returns {Promise<object>} - Resultado das validações
	 */
	async validateDataIntegrity(params, context) {
		this._validateParams(params, ['user_id']);

		this._log('info', `Validando integridade de dados para usuário ${params.user_id}`);

		const result = await dataValidator.validateDataIntegrity(params);

		return result;
	}

	/**
	 * Valida se parâmetros obrigatórios estão presentes
	 * @param {object} params - Parâmetros a validar
	 * @param {array} required - Lista de campos obrigatórios
	 * @throws {Error} - Se algum campo obrigatório estiver faltando
	 */
	_validateParams(params, required = []) {
		if (!params) {
			throw new Error('Parâmetros são obrigatórios');
		}

		for (const field of required) {
			if (!params[field]) {
				throw new Error(`Campo obrigatório ausente: ${field}`);
			}
		}
	}

	/**
	 * Invalida cache relacionado a um usuário ou conta
	 * @param {object} invalidation - { user_id?, account_id?, pattern? }
	 */
	async invalidateCache(invalidation) {
		this._log('info', `Invalidando cache: ${JSON.stringify(invalidation)}`);
		await cacheManager.invalidate(invalidation);
	}

	// ========== TRANSACTION METHODS ==========

	/**
	 * Get latest transactions for dashboard
	 * @param {object} params - { userId, limit? }
	 */
	async getLatestTransactions(params, context) {
		this._validateParams(params, ['userId']);
		
		const cacheKey = `latest_transactions_${params.userId}_${params.limit || 10}`;
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return { ...cached, _cached: true };
		}

		const result = await transactionQueries.getLatestTransactions(params);
		await cacheManager.set(cacheKey, result, 'RECENT_TRANSACTIONS');
		return result;
	}

	/**
	 * Get transactions summary (receitas, despesas, saldo)
	 * @param {object} params - { userId, startDate?, endDate? }
	 */
	async getTransactionsSummary(params, context) {
		this._validateParams(params, ['userId']);
		console.log('[DataAgent.getTransactionsSummary] incoming params:', params);
		
		const cacheKey = `transactions_summary_${params.userId}_${params.startDate || 'all'}_${params.endDate || 'now'}`;
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return { ...cached, _cached: true };
		}

		const result = await transactionQueries.getTransactionsSummary(params);
		await cacheManager.set(cacheKey, result, 'ACCOUNT_SUMMARY');
		return result;
	}

	/**
	 * Create a new transaction
	 * @param {object} params - Transaction data
	 */
	async createTransaction(params, context) {
		this._validateParams(params, ['userId', 'type', 'amount']);
		
		const result = await transactionQueries.createTransaction(params);
		
		// Invalidate related caches
		await this.invalidateCache({ user_id: params.userId });
		
		return result;
	}

	/**
	 * Fetch receivables (Contas a receber)
	 * @param {object} params - { userId, limit?, includeOverdue? }
	 */
	async fetchReceivables(params, context) {
		this._validateParams(params, ['userId']);
		
		const cacheKey = `receivables_${params.userId}_${params.limit || 50}`;
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return { ...cached, _cached: true };
		}

		const result = await transactionQueries.fetchReceivables(params);
		await cacheManager.set(cacheKey, result, 'RECENT_TRANSACTIONS');
		return result;
	}

	/**
	 * Fetch payables (Contas a pagar)
	 * @param {object} params - { userId, limit?, includeOverdue? }
	 */
	async fetchPayables(params, context) {
		this._validateParams(params, ['userId']);
		
		const cacheKey = `payables_${params.userId}_${params.limit || 50}`;
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return { ...cached, _cached: true };
		}

		const result = await transactionQueries.fetchPayables(params);
		await cacheManager.set(cacheKey, result, 'RECENT_TRANSACTIONS');
		return result;
	}

	// ========== CREDIT CARD METHODS ==========

	/**
	 * Get all credit cards for a user
	 * @param {object} params - { userId, status? }
	 */
	async getCreditCards(params, context) {
		this._validateParams(params, ['userId']);
		
		const cacheKey = `credit_cards_${params.userId}_${params.status || 'all'}`;
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return { ...cached, _cached: true };
		}

		const result = await creditCardQueries.getCreditCards(params);
		await cacheManager.set(cacheKey, result, 'USER_PROFILE');
		return result;
	}

	/**
	 * Get a specific credit card by ID
	 * @param {object} params - { cardId, userId }
	 */
	async getCreditCardById(params, context) {
		this._validateParams(params, ['cardId', 'userId']);
		
		const cacheKey = `credit_card_${params.cardId}`;
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return { ...cached, _cached: true };
		}

		const result = await creditCardQueries.getCreditCardById(params);
		await cacheManager.set(cacheKey, result, 'USER_PROFILE');
		return result;
	}

	/**
	 * Create a new credit card
	 * @param {object} params - Credit card data
	 */
	async createCreditCard(params, context) {
		this._validateParams(params, ['userId', 'cardName', 'creditLimit', 'billingCycleRenewalDay', 'billingDueDay']);
		
		const result = await creditCardQueries.createCreditCard(params);
		
		// Invalidate user's credit cards cache
		await this.invalidateCache({ user_id: params.userId });
		
		return result;
	}

	/**
	 * Update a credit card
	 * @param {object} params - { cardId, userId, updates }
	 */
	async updateCreditCard(params, context) {
		this._validateParams(params, ['cardId', 'userId', 'updates']);
		
		const result = await creditCardQueries.updateCreditCard(params);
		
		// Invalidate cache
		await this.invalidateCache({ user_id: params.userId });
		
		return result;
	}

	/**
	 * Delete a credit card
	 * @param {object} params - { cardId, userId }
	 */
	async deleteCreditCard(params, context) {
		this._validateParams(params, ['cardId', 'userId']);
		
		const result = await creditCardQueries.deleteCreditCard(params);
		
		// Invalidate cache
		await this.invalidateCache({ user_id: params.userId });
		
		return result;
	}

	/**
	 * Get credit card utilization
	 * @param {object} params - { cardId, userId }
	 */
	async getCreditCardUtilization(params, context) {
		this._validateParams(params, ['cardId', 'userId']);
		
		const cacheKey = `credit_card_utilization_${params.cardId}`;
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return { ...cached, _cached: true };
		}

		const result = await creditCardQueries.getCreditCardUtilization(params);
		await cacheManager.set(cacheKey, result, 'ACCOUNT_BALANCE');
		return result;
	}

	// ========== DEBT METHODS ==========

	/**
	 * Get all debts for a user
	 * @param {object} params - { userId, status? }
	 */
	async getDebts(params, context) {
		this._validateParams(params, ['userId']);
		
		const cacheKey = `debts_${params.userId}_${params.status || 'all'}`;
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return { ...cached, _cached: true };
		}

		const result = await debtQueries.getDebts(params);
		await cacheManager.set(cacheKey, result, 'USER_PROFILE');
		return result;
	}

	/**
	 * Get debt details with installments
	 * @param {object} params - { debtId, userId }
	 */
	async getDebtDetails(params, context) {
		this._validateParams(params, ['debtId', 'userId']);
		
		const cacheKey = `debt_details_${params.debtId}`;
		const cached = await cacheManager.get(cacheKey);
		if (cached) {
			this._log('debug', `Cache HIT: ${cacheKey}`);
			return { ...cached, _cached: true };
		}

		const result = await debtQueries.getDebtDetails(params);
		await cacheManager.set(cacheKey, result, 'USER_PROFILE');
		return result;
	}

	/**
	 * Create a new debt
	 * @param {object} params - Debt data
	 */
	async createDebt(params, context) {
		this._validateParams(params, ['userId', 'description', 'institution', 'debtDate', 'totalValue', 'installmentCount', 'firstPaymentDate']);
		
		const result = await debtQueries.createDebt(params);
		
		// Invalidate cache
		await this.invalidateCache({ user_id: params.userId });
		
		return result;
	}

	/**
	 * Pay a debt installment
	 * @param {object} params - { debtId, userId, installmentNumber, paidAmount? }
	 */
	async payInstallment(params, context) {
		this._validateParams(params, ['debtId', 'userId', 'installmentNumber']);
		
		const result = await debtQueries.payInstallment(params);
		
		// Invalidate cache
		await this.invalidateCache({ user_id: params.userId });
		
		return result;
	}

	/**
	 * Update a debt
	 * @param {object} params - { debtId, userId, updates }
	 */
	async updateDebt(params, context) {
		this._validateParams(params, ['debtId', 'userId', 'updates']);
		
		const result = await debtQueries.updateDebt(params);
		
		// Invalidate cache
		await this.invalidateCache({ user_id: params.userId });
		
		return result;
	}

	/**
	 * Delete a debt
	 * @param {object} params - { debtId, userId }
	 */
	async deleteDebt(params, context) {
		this._validateParams(params, ['debtId', 'userId']);
		
		const result = await debtQueries.deleteDebt(params);
		
		// Invalidate cache
		await this.invalidateCache({ user_id: params.userId });
		
		return result;
	}
}

module.exports = DataAgent;
