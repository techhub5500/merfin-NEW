/**
 * ==============================================================================
 * DATA SERVICE - Centralização de Chamadas API
 * ==============================================================================
 * 
 * PROPÓSITO:
 * Módulo centralizado para todas as chamadas HTTP ao backend. Gerencia:
 * - Autenticação (JWT tokens)
 * - Tratamento de erros consistente
 * - Base URLs configuráveis
 * - Retry logic para requisições falhadas
 * - Cache de dados no localStorage (opcional)
 * 
 * ENDPOINTS DISPONÍVEIS:
 * - Dashboard Stats (receitas, despesas, saldo)
 * - Transações (latest, by-type, scheduled)
 * - Cartões de Crédito (list, utilization, update)
 * - Dívidas (list, details, create, pay-installment)
 * - Patrimônio (breakdown)
 * 
 * INTEGRAÇÃO:
 * - Usado por: dash.js, invest.js, profile.js
 * - Auth: Requer token JWT no localStorage
 * - Ports: API_PORT (5000 - serverAgent.js), AUTH_PORT (3000 - server.js)
 * 
 * ==============================================================================
 */

'use strict';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
	// API URLs
	AGENT_API_BASE: 'http://localhost:5000/api/dashboard',
	AUTH_API_BASE: 'http://localhost:3000/api/auth',
	
	// Cache settings
	CACHE_ENABLED: false, // Disable cache for real-time data
	CACHE_TTL: 60000, // 1 minute
	
	// Request settings
	TIMEOUT: 10000, // 10 seconds
	RETRY_ATTEMPTS: 2,
	RETRY_DELAY: 1000 // 1 second
};

// ============================================================================
// AUTENTICAÇÃO
// ============================================================================

/**
 * Get JWT token from localStorage
 * @returns {string|null} - JWT token or null if not found
 */
function getAuthToken() {
	return localStorage.getItem('token');
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
	const token = getAuthToken();
	if (!token) return false;
	
	// TODO: Validate token expiration
	return true;
}

/**
 * Redirect to login page if not authenticated
 */
function requireAuth() {
	if (!isAuthenticated()) {
		window.location.href = '/html/index.html';
		throw new Error('Authentication required');
	}
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

/**
 * Make authenticated HTTP request
 * @param {string} url - Full URL
 * @param {object} options - Fetch options
 * @returns {Promise<object>} - Response data
 */
async function makeRequest(url, options = {}) {
	requireAuth();
	
	const token = getAuthToken();
	
	const defaultOptions = {
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		}
	};
	
	const mergedOptions = {
		...defaultOptions,
		...options,
		headers: {
			...defaultOptions.headers,
			...(options.headers || {})
		}
	};
	
	try {
		const response = await fetch(url, mergedOptions);
		
		// Handle auth errors
		if (response.status === 401) {
			localStorage.removeItem('token');
			window.location.href = '/html/index.html';
			throw new Error('Session expired');
		}
		
		const data = await response.json();
		
		if (!response.ok) {
			throw new Error(data.message || `HTTP ${response.status}`);
		}
		
		return data;
		
	} catch (error) {
		console.error('Request failed:', url, error);
		throw error;
	}
}

/**
 * GET request
 */
async function get(url) {
	return makeRequest(url, { method: 'GET' });
}

/**
 * POST request
 */
async function post(url, data) {
	return makeRequest(url, {
		method: 'POST',
		body: JSON.stringify(data)
	});
}

/**
 * PUT request
 */
async function put(url, data) {
	return makeRequest(url, {
		method: 'PUT',
		body: JSON.stringify(data)
	});
}

/**
 * DELETE request
 */
async function del(url) {
	return makeRequest(url, { method: 'DELETE' });
}

// ============================================================================
// DASHBOARD STATS API
// ============================================================================

/**
 * Get monthly statistics (income, expense, balance)
 * @param {string} month - Format: YYYY-MM
 * @returns {Promise<object>} - { income, expense, balance }
 */
async function getMonthlyStats(month) {
	const response = await get(`${CONFIG.AGENT_API_BASE}/stats/${month}`);
	return response.data;
}

// ============================================================================
// TRANSACTIONS API
// ============================================================================

/**
 * Get latest transactions for dashboard
 * @param {object} params - { month?: string, limit?: number }
 * @returns {Promise<Array>} - Array of transactions
 */
async function getLatestTransactions(params = {}) {
	const queryParams = new URLSearchParams();
	if (params.month) queryParams.append('month', params.month);
	if (params.limit) queryParams.append('limit', params.limit);
	
	const url = `${CONFIG.AGENT_API_BASE}/transactions/latest?${queryParams.toString()}`;
	const response = await get(url);
	return response.data;
}

/**
 * Get transactions by type (income or expense)
 * @param {string} month - Format: YYYY-MM
 * @param {string} type - 'income' or 'expense'
 * @returns {Promise<Array>} - Array of transactions
 */
async function getTransactionsByType(month, type) {
	const url = `${CONFIG.AGENT_API_BASE}/transactions/by-type?month=${month}&type=${type}`;
	const response = await get(url);
	return response.data;
}

/**
 * Get scheduled transactions (receivables and payables)
 * @param {string} month - Format: YYYY-MM
 * @returns {Promise<object>} - { receivables: [], payables: [] }
 */
async function getScheduledTransactions(month) {
	const url = `${CONFIG.AGENT_API_BASE}/transactions/scheduled?month=${month}`;
	const response = await get(url);
	return response.data;
}

// ============================================================================
// CREDIT CARD API
// ============================================================================

/**
 * Get all credit cards
 * @returns {Promise<object>} - { cards: [], count: number }
 */
async function getCreditCards() {
	const response = await get(`${CONFIG.AGENT_API_BASE}/credit-cards`);
	return response.data;
}

/**
 * Get credit card utilization
 * @param {string} cardId - Credit card ID
 * @returns {Promise<object>} - Utilization details
 */
async function getCreditCardUtilization(cardId) {
	const response = await get(`${CONFIG.AGENT_API_BASE}/credit-cards/${cardId}/utilization`);
	return response.data;
}

/**
 * Update credit card
 * @param {string} cardId - Credit card ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} - Updated card data
 */
async function updateCreditCard(cardId, updates) {
	const response = await put(`${CONFIG.AGENT_API_BASE}/credit-cards/${cardId}`, updates);
	return response.data;
}

// ============================================================================
// DEBTS API
// ============================================================================

/**
 * Get all debts
 * @param {string} status - Optional: 'active', 'paid', etc
 * @returns {Promise<object>} - { debts: [], count: number, totalPending: number }
 */
async function getDebts(status = null) {
	let url = `${CONFIG.AGENT_API_BASE}/debts`;
	if (status) url += `?status=${status}`;
	
	const response = await get(url);
	return response.data;
}

/**
 * Get debt details with installments
 * @param {string} debtId - Debt ID
 * @returns {Promise<object>} - Debt details with installments
 */
async function getDebtDetails(debtId) {
	const response = await get(`${CONFIG.AGENT_API_BASE}/debts/${debtId}`);
	return response.data;
}

/**
 * Create new debt
 * @param {object} debtData - Debt information
 * @returns {Promise<object>} - Created debt
 */
async function createDebt(debtData) {
	const response = await post(`${CONFIG.AGENT_API_BASE}/debts`, debtData);
	return response.data;
}

/**
 * Pay debt installment
 * @param {string} debtId - Debt ID
 * @param {number} installmentNumber - Installment number
 * @param {number} paidAmount - Amount paid (optional)
 * @returns {Promise<object>} - Updated debt
 */
async function payInstallment(debtId, installmentNumber, paidAmount = null) {
	const data = { installmentNumber };
	if (paidAmount) data.paidAmount = paidAmount;
	
	const response = await post(`${CONFIG.AGENT_API_BASE}/debts/${debtId}/pay-installment`, data);
	return response.data;
}

// ============================================================================
// PATRIMONY API
// ============================================================================

/**
 * Get patrimony breakdown
 * @param {string} month - Format: YYYY-MM
 * @returns {Promise<object>} - Patrimony breakdown by type
 */
async function getPatrimony(month) {
	const url = `${CONFIG.AGENT_API_BASE}/patrimony?month=${month}`;
	const response = await get(url);
	return response.data;
}

// ============================================================================
// AGENT API - Integração com serverAgent.js
// ============================================================================

const AGENT_API_URL = 'http://localhost:5000/api/agent/execute';

/**
 * Get user ID from localStorage
 * @returns {string|null}
 */
function getUserId() {
	const user = JSON.parse(localStorage.getItem('user') || '{}');
	return user.id || user._id || null;
}

/**
 * Execute an action on an agent
 * @param {string} agentName - Agent name (ex: 'DataAgent')
 * @param {string} action - Action name (ex: 'fetchTransactions')
 * @param {object} params - Action parameters
 * @returns {Promise<object>}
 */
async function executeAgent(agentName, action, params = {}) {
	const userId = getUserId();
	const token = getAuthToken(); // Usa a função que já existe

	if (!userId) {
		throw new Error('Usuário não autenticado. Faça login primeiro.');
	}

	const requestBody = {
		agent_name: agentName,
		action: action,
		parameters: params,  // CORRIGIDO: era 'params', agora é 'parameters'
		context: {
			session_id: `session_${Date.now()}`,
			user_id: userId
		}
	};

	console.log('[DataService] Executando agente:', { agentName, action, params });

	const response = await fetch(AGENT_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { 'Authorization': `Bearer ${token}` } : {})
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error?.message || `Erro HTTP ${response.status}`);
	}

	const data = await response.json();

	if (data.status === 'error') {
		throw new Error(data.error?.message || 'Erro desconhecido');
	}

	console.log('[DataService] Resposta do agente:', data);
	return data;
}

/**
 * Fetch statement transactions (section='statement')
 * @param {object} options - Filter options
 * @param {string} options.monthKey - Month format 'YYYY-MM' or 'all'
 * @param {string} options.type - Type: 'income' or 'expense' (optional)
 * @returns {Promise<object>}
 */
async function fetchStatementTransactions(options = {}) {
	const { monthKey, type } = options;
	const userId = getUserId();

	const params = {
		user_id: userId,  // ADICIONADO: user_id é obrigatório
		section: 'statement',
		status: 'confirmed'
	};

	if (type) {
		params.type = type;
	}

	if (monthKey && monthKey !== 'all') {
		const [year, month] = monthKey.split('-');
		const startDate = new Date(year, month - 1, 1);
		const endDate = new Date(year, month, 0, 23, 59, 59, 999);
		
		params.start_date = startDate.toISOString();
		params.end_date = endDate.toISOString();
	}

	const response = await executeAgent('DataAgent', 'fetchTransactions', params);

	return {
		transactions: response.data?.transactions || [],
		summary: response.data?.summary || {
			total_income: 0,
			total_expense: 0,
			net_flow: 0
		},
		count: response.data?.count || 0
	};
}

/**
 * Fetch only incomes from statement
 * @param {string} monthKey - Month format 'YYYY-MM' or 'all'
 * @returns {Promise<Array>}
 */
async function fetchIncomes(monthKey) {
	const result = await fetchStatementTransactions({ monthKey, type: 'income' });
	return result.transactions;
}

/**
 * Fetch only expenses from statement
 * @param {string} monthKey - Month format 'YYYY-MM' or 'all'
 * @returns {Promise<Array>}
 */
async function fetchExpenses(monthKey) {
	const result = await fetchStatementTransactions({ monthKey, type: 'expense' });
	return result.transactions;
}

/**
 * Fetch transactions summary (Receitas, Despesas, Saldo)
 * For top cards
 * @param {string} monthKey - Month format 'YYYY-MM' or 'all'
 * @returns {Promise<object>}
 */
async function fetchTransactionsSummary(monthKey) {
	const userId = getUserId();
	
	const params = {
		userId: userId  // ADICIONADO: userId é obrigatório
	};

	if (monthKey && monthKey !== 'all') {
		const [year, month] = monthKey.split('-');
		const startDate = new Date(year, month - 1, 1);
		const endDate = new Date(year, month, 0, 23, 59, 59, 999);
		
		params.startDate = startDate.toISOString();
		params.endDate = endDate.toISOString();
	}

	const response = await executeAgent('DataAgent', 'getTransactionsSummary', params);

	return {
		receitas: response.data?.receitas || 0,
		despesas: response.data?.despesas || 0,
		saldo: response.data?.saldo || 0
	};
}

/**
 * Create a new statement transaction
 * @param {object} transactionData - Transaction data
 * @param {string} transactionData.description - Description
 * @param {string} transactionData.type - 'income' or 'expense'
 * @param {number} transactionData.amount - Amount
 * @param {string} transactionData.date - ISO date (optional)
 * @param {string} transactionData.category - Category (optional)
 * @returns {Promise<object>}
 */
async function createStatementTransaction(transactionData) {
	const userId = getUserId();

	const params = {
		userId,
		section: 'statement',
		type: transactionData.type,
		amount: transactionData.amount,
		description: transactionData.description,
		date: transactionData.date || new Date().toISOString(),
		category: transactionData.category || 'Geral',
		status: 'confirmed'
	};

	const response = await executeAgent('DataAgent', 'createTransaction', params);

	return {
		success: response.status === 'success',
		transaction: response.data?.transaction || null
	};
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export all API functions
window.DataService = {
	// Auth
	isAuthenticated,
	requireAuth,
	getUserId,
	getAuthToken,
	
	// Stats
	getMonthlyStats,
	
	// Transactions
	getLatestTransactions,
	getTransactionsByType,
	getScheduledTransactions,
	
	// Statement Transactions (NEW)
	fetchStatementTransactions,
	fetchIncomes,
	fetchExpenses,
	fetchTransactionsSummary,
	createStatementTransaction,
	
	// Credit Cards
	getCreditCards,
	getCreditCardUtilization,
	updateCreditCard,
	
	// Debts
	getDebts,
	getDebtDetails,
	createDebt,
	payInstallment,
	
	// Patrimony
	getPatrimony,
	
	// Low-level
	executeAgent
};
