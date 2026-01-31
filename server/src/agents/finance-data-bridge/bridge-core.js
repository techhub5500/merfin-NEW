/**
 * NOTE (bridge-core.js):
 * Purpose: Classe principal do FinanceDataBridge.
 * Orquestra validação, processamento de datas e execução de queries.
 * Design: Facade pattern - interface única para todos os agentes.
 * 
 * ARQUITETURA:
 * Request → Validator → DateProcessor → [Processor] → Response
 * 
 * MUDANÇAS EM RELAÇÃO AO PLANO ORIGINAL:
 * 1. Adicionado ListProcessor para centralizar lógica de paginação
 * 2. Logger focado (não verboso) integrado em toda a cadeia
 * 3. Métodos de conveniência para operações comuns dos agentes
 */

const { RequestValidator } = require('./validators/request-validator');
const { DateProcessor } = require('./processors/date-processor');
const { SummaryProcessor } = require('./processors/summary-processor');
const { RankingProcessor, RANKING_TYPES } = require('./processors/ranking-processor');
const { ListProcessor } = require('./processors/list-processor');
const { logger } = require('./utils/bridge-logger');

/**
 * Mapeamento de domínios para sections/collections
 */
const DOMAIN_MAP = {
	transactions: { collection: 'transactions', section: 'statement' },
	debts: { collection: 'debts', section: null },
	credit_cards: { collection: 'creditcards', section: null },
	scheduled: { collection: 'transactions', section: 'scheduled' },
	assets: { collection: 'transactions', section: 'asset' }
};

/**
 * Classe FinanceDataBridge
 * Interface central para acesso a dados financeiros
 */
class FinanceDataBridge {
	constructor() {
		this.validator = new RequestValidator();
		this.dateProcessor = new DateProcessor();
		this.summaryProcessor = new SummaryProcessor();
		this.rankingProcessor = new RankingProcessor();
		this.listProcessor = new ListProcessor();
	}

	/**
	 * Executa uma requisição ao Bridge
	 * @param {object} request - Requisição estruturada
	 * @returns {object} - Resultado da operação
	 */
	async execute(request) {
		const startTime = logger.startExecution(request);
		
		try {
			// 1. Validar requisição
			const validation = this.validator.validate(request);
			
			if (!validation.valid) {
				logger.error('VALIDATION_FAILED', { errors: validation.errors });
				return {
					success: false,
					error: 'Validation failed',
					details: validation.errors
				};
			}

			const normalizedRequest = validation.request;

			// 2. Processar datas
			const dateRange = this.dateProcessor.parseDateRange(
				normalizedRequest.filters.dateRange,
				{
					startDate: normalizedRequest.filters.startDate,
					endDate: normalizedRequest.filters.endDate
				}
			);

			// 3. Log da query
			logger.query(normalizedRequest.domain, normalizedRequest.filters);

			// 4. Executar ação
			let result;
			
			switch (normalizedRequest.action) {
				case 'summary':
					result = await this._executeSummary(normalizedRequest, dateRange);
					break;
					
				case 'list':
					result = await this._executeList(normalizedRequest, dateRange);
					break;
					
				case 'ranking':
					result = await this._executeRanking(normalizedRequest, dateRange);
					break;
					
				case 'detail':
					result = await this._executeDetail(normalizedRequest);
					break;
					
				default:
					throw new Error(`Unknown action: ${normalizedRequest.action}`);
			}

			// 5. Finalizar log
			const resultCount = result?.data?.length || result?.items?.length || 1;
			logger.endExecution(startTime, resultCount);

			return {
				success: true,
				action: normalizedRequest.action,
				domain: normalizedRequest.domain,
				...result
			};

		} catch (error) {
			logger.error('EXECUTION_FAILED', error, { request });
			
			return {
				success: false,
				error: error.message,
				stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
			};
		}
	}

	/**
	 * Executa ação de summary
	 */
	async _executeSummary(request, dateRange) {
		const { userId, domain, filters } = request;

		switch (domain) {
			case 'transactions':
			case 'scheduled':
				if (domain === 'scheduled') {
					return await this.summaryProcessor.getScheduledSummary(userId, dateRange);
				}
				return await this.summaryProcessor.getTransactionsSummary(userId, dateRange, filters);
				
			case 'debts':
				return await this.summaryProcessor.getDebtsSummary(userId);
				
			case 'credit_cards':
				const billingCycle = filters.billingCycle 
					? this.dateProcessor.calculateBillingCycle(filters.billingCycle.renewalDay)
					: null;
				return await this.summaryProcessor.getCreditCardsSummary(userId, billingCycle);
				
			default:
				return await this.summaryProcessor.getTransactionsSummary(userId, dateRange, filters);
		}
	}

	/**
	 * Executa ação de list
	 */
	async _executeList(request, dateRange) {
		const { userId, domain, filters, options } = request;

		switch (domain) {
			case 'transactions':
				return await this.listProcessor.listTransactions(userId, dateRange, filters, options);
				
			case 'scheduled':
				return await this.listProcessor.listScheduledTransactions(userId, dateRange, filters, options);
				
			case 'debts':
				return await this.listProcessor.listDebts(userId, filters, options);
				
			case 'credit_cards':
				return await this.listProcessor.listCreditCards(userId, filters, options);
				
			default:
				return await this.listProcessor.listTransactions(userId, dateRange, filters, options);
		}
	}

	/**
	 * Executa ação de ranking
	 */
	async _executeRanking(request, dateRange) {
		const { userId, filters, options } = request;
		
		// Determina tipo de ranking
		let rankingType = filters.rankingType || RANKING_TYPES.TOP_EXPENSES;
		
		// Mapeia type para ranking
		if (!filters.rankingType && filters.type === 'income') {
			rankingType = RANKING_TYPES.TOP_INCOME;
		}

		return await this.rankingProcessor.getTopN(
			userId,
			rankingType,
			options.limit,
			dateRange,
			filters
		);
	}

	/**
	 * Executa ação de detail
	 */
	async _executeDetail(request) {
		const { userId, filters } = request;
		
		if (!filters.transactionId) {
			throw new Error('transactionId is required for detail action');
		}

		const detail = await this.listProcessor.getTransactionDetail(userId, filters.transactionId);
		
		if (!detail) {
			throw new Error(`Transaction not found: ${filters.transactionId}`);
		}

		return { data: detail };
	}

	// ========== MÉTODOS DE CONVENIÊNCIA ==========
	// Atalhos para operações comuns dos agentes

	/**
	 * Resumo de transações (atalho)
	 */
	async getSummary(userId, dateRange = '30d', options = {}) {
		return this.execute({
			userId,
			action: 'summary',
			domain: 'transactions',
			filters: { 
				dateRange,
				...options
			}
		});
	}

	/**
	 * Top N despesas (atalho)
	 */
	async getTopExpenses(userId, n = 10, dateRange = '30d') {
		return this.execute({
			userId,
			action: 'ranking',
			domain: 'transactions',
			filters: { 
				dateRange, 
				type: 'expense',
				rankingType: RANKING_TYPES.TOP_EXPENSES
			},
			options: { limit: n }
		});
	}

	/**
	 * Top N receitas (atalho)
	 */
	async getTopIncome(userId, n = 10, dateRange = '30d') {
		return this.execute({
			userId,
			action: 'ranking',
			domain: 'transactions',
			filters: { 
				dateRange, 
				type: 'income',
				rankingType: RANKING_TYPES.TOP_INCOME
			},
			options: { limit: n }
		});
	}

	/**
	 * Top categorias por gasto (atalho)
	 */
	async getTopCategories(userId, n = 10, dateRange = '30d') {
		return this.execute({
			userId,
			action: 'ranking',
			domain: 'transactions',
			filters: { 
				dateRange,
				rankingType: RANKING_TYPES.TOP_CATEGORIES
			},
			options: { limit: n }
		});
	}

	/**
	 * Resumo de dívidas (atalho)
	 */
	async getDebtsSummary(userId) {
		return this.execute({
			userId,
			action: 'summary',
			domain: 'debts'
		});
	}

	/**
	 * Resumo de cartões de crédito (atalho)
	 */
	async getCreditCardsSummary(userId) {
		return this.execute({
			userId,
			action: 'summary',
			domain: 'credit_cards'
		});
	}

	/**
	 * Resumo de contas futuras (atalho)
	 */
	async getScheduledSummary(userId, dateRange = '30d') {
		return this.execute({
			userId,
			action: 'summary',
			domain: 'scheduled',
			filters: { dateRange }
		});
	}

	/**
	 * Lista transações paginadas (atalho)
	 */
	async listTransactions(userId, options = {}) {
		return this.execute({
			userId,
			action: 'list',
			domain: 'transactions',
			filters: {
				dateRange: options.dateRange || '30d',
				type: options.type,
				category: options.category,
				section: options.section
			},
			options: {
				limit: options.limit || 20,
				page: options.page || 1,
				sortBy: options.sortBy || 'date',
				sortOrder: options.sortOrder || 'desc'
			}
		});
	}

	/**
	 * Tendência mensal (atalho)
	 */
	async getMonthlyTrend(userId, months = 6) {
		try {
			const trend = await this.summaryProcessor.getMonthlyTrend(userId, months);
			return {
				success: true,
				action: 'trend',
				domain: 'transactions',
				data: trend
			};
		} catch (error) {
			logger.error('MONTHLY_TREND_FAILED', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Transações recentes (atalho para dashboard)
	 */
	async getRecentTransactions(userId, limit = 10) {
		return this.execute({
			userId,
			action: 'ranking',
			domain: 'transactions',
			filters: {
				rankingType: RANKING_TYPES.RECENT_TRANSACTIONS
			},
			options: { limit }
		});
	}

	/**
	 * Retorna estatísticas do logger
	 */
	getLoggerStats() {
		return logger.getSessionSummary();
	}
}

module.exports = {
	FinanceDataBridge,
	DOMAIN_MAP,
	RANKING_TYPES
};
