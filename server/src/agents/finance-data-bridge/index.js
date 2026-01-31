/**
 * NOTE (index.js):
 * Purpose: Ponto de entrada do módulo FinanceDataBridge.
 * Exporta interface simplificada para uso pelos agentes.
 * Design: Singleton pattern para manter estado consistente.
 * 
 * USO BÁSICO:
 * const Bridge = require('./finance-data-bridge');
 * const result = await Bridge.getSummary(userId, '30d');
 * 
 * USO AVANÇADO:
 * const result = await Bridge.execute({
 *   userId: '...',
 *   action: 'summary',
 *   domain: 'transactions',
 *   filters: { dateRange: '30d', type: 'expense' }
 * });
 */

const { FinanceDataBridge, RANKING_TYPES, DOMAIN_MAP } = require('./bridge-core');
const { VALIDATION } = require('./validators/request-validator');
const { DATE_TERM_CONFIG } = require('./processors/date-processor');

// Instância singleton
const bridge = new FinanceDataBridge();

/**
 * Interface pública do módulo
 */
module.exports = {
	// ========== EXECUÇÃO GENÉRICA ==========
	
	/**
	 * Executa requisição estruturada
	 * @param {object} request - Requisição completa
	 * @returns {Promise<object>} - Resultado da operação
	 */
	execute: (request) => bridge.execute(request),

	// ========== ATALHOS PARA SUMMARIES ==========
	
	/**
	 * Resumo de transações
	 * @param {string} userId - ID do usuário
	 * @param {string} dateRange - Período ('7d', '30d', '3m', etc)
	 * @param {object} options - Opções adicionais
	 */
	getSummary: (userId, dateRange = '30d', options = {}) => 
		bridge.getSummary(userId, dateRange, options),
	
	/**
	 * Resumo de dívidas
	 * @param {string} userId - ID do usuário
	 */
	getDebtsSummary: (userId) => 
		bridge.getDebtsSummary(userId),
	
	/**
	 * Resumo de cartões de crédito
	 * @param {string} userId - ID do usuário
	 */
	getCreditCardsSummary: (userId) => 
		bridge.getCreditCardsSummary(userId),
	
	/**
	 * Resumo de contas futuras
	 * @param {string} userId - ID do usuário
	 * @param {string} dateRange - Período
	 */
	getScheduledSummary: (userId, dateRange = '30d') => 
		bridge.getScheduledSummary(userId, dateRange),

	// ========== ATALHOS PARA RANKINGS ==========
	
	/**
	 * Top N maiores despesas
	 * @param {string} userId - ID do usuário
	 * @param {number} n - Quantidade (max 50)
	 * @param {string} dateRange - Período
	 */
	getTopExpenses: (userId, n = 10, dateRange = '30d') => 
		bridge.getTopExpenses(userId, n, dateRange),
	
	/**
	 * Top N maiores receitas
	 * @param {string} userId - ID do usuário
	 * @param {number} n - Quantidade (max 50)
	 * @param {string} dateRange - Período
	 */
	getTopIncome: (userId, n = 10, dateRange = '30d') => 
		bridge.getTopIncome(userId, n, dateRange),
	
	/**
	 * Top N categorias por gasto
	 * @param {string} userId - ID do usuário
	 * @param {number} n - Quantidade
	 * @param {string} dateRange - Período
	 */
	getTopCategories: (userId, n = 10, dateRange = '30d') => 
		bridge.getTopCategories(userId, n, dateRange),

	// ========== ATALHOS PARA LISTAGENS ==========
	
	/**
	 * Lista transações com paginação
	 * @param {string} userId - ID do usuário
	 * @param {object} options - { dateRange, type, category, limit, page, sortBy, sortOrder }
	 */
	listTransactions: (userId, options = {}) => 
		bridge.listTransactions(userId, options),
	
	/**
	 * Transações recentes (para dashboard)
	 * @param {string} userId - ID do usuário
	 * @param {number} limit - Quantidade
	 */
	getRecentTransactions: (userId, limit = 10) => 
		bridge.getRecentTransactions(userId, limit),

	// ========== ATALHOS PARA TENDÊNCIAS ==========
	
	/**
	 * Tendência mensal
	 * @param {string} userId - ID do usuário
	 * @param {number} months - Quantidade de meses
	 */
	getMonthlyTrend: (userId, months = 6) => 
		bridge.getMonthlyTrend(userId, months),

	// ========== UTILITÁRIOS ==========
	
	/**
	 * Retorna estatísticas do logger
	 */
	getLoggerStats: () => bridge.getLoggerStats(),
	
	/**
	 * Acesso direto à instância (para casos avançados)
	 */
	getInstance: () => bridge,

	// ========== CONSTANTES EXPORTADAS ==========
	
	/**
	 * Tipos de ranking disponíveis
	 */
	RANKING_TYPES,
	
	/**
	 * Mapeamento de domínios
	 */
	DOMAIN_MAP,
	
	/**
	 * Constantes de validação
	 */
	VALIDATION,
	
	/**
	 * Configuração de termos de data
	 */
	DATE_TERM_CONFIG
};
