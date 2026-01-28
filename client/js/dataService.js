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
	// IMPORTANTE: Rotas de agentes estão no serverAgent.js (porta 5000)
	AGENT_API_BASE: 'http://localhost:5000/api/agent/execute',
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
// AGENT API - Integração com serverAgent.js (porta 5000)
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
// CONTAS FUTURAS (A RECEBER / A PAGAR)
// ============================================================================

/**
 * Busca todas as contas futuras (scheduled) do mês
 * @param {string} monthKey - Formato 'YYYY-MM'
 * @returns {Promise<{receivables: Array, payables: Array}>}
 */
async function fetchFutureAccounts(monthKey) {
	const userId = getUserId();

	const params = {
		user_id: userId,
		section: 'scheduled'
	};

	// Adicionar filtro de mês se especificado
	if (monthKey && monthKey !== 'all') {
		const [year, month] = monthKey.split('-');
		const startDate = new Date(year, month - 1, 1);
		const endDate = new Date(year, month, 0, 23, 59, 59, 999);
		
		params.start_date = startDate.toISOString();
		params.end_date = endDate.toISOString();
	}

	const response = await executeAgent('DataAgent', 'fetchTransactions', params);

	if (response.status !== 'success' || !response.data || !response.data.transactions) {
		return { receivables: [], payables: [] };
	}

	// Filtra apenas transações scheduled (contas futuras)
	const scheduled = response.data.transactions.filter(tx => tx.section === 'scheduled');

	// Separa por tipo
	const receivables = scheduled.filter(tx => 
		tx.scheduled?.scheduledType === 'receivable' || tx.type === 'income'
	);

	const payables = scheduled.filter(tx => 
		tx.scheduled?.scheduledType === 'payable' || tx.type === 'expense'
	);

	return { receivables, payables };
}

/**
 * Busca apenas contas a receber do mês
 * @param {string} monthKey - Formato 'YYYY-MM'
 * @returns {Promise<Array>}
 */
async function fetchReceivables(monthKey) {
	const { receivables } = await fetchFutureAccounts(monthKey);
	return receivables;
}

/**
 * Busca apenas contas a pagar do mês
 * @param {string} monthKey - Formato 'YYYY-MM'
 * @returns {Promise<Array>}
 */
async function fetchPayables(monthKey) {
	const { payables } = await fetchFutureAccounts(monthKey);
	return payables;
}

/**
 * Cria uma nova conta futura (a receber ou a pagar)
 * @param {object} accountData - Dados da conta
 * @returns {Promise<object>}
 */
async function createFutureAccount(accountData) {
	const userId = getUserId();

	const params = {
		userId,
		section: 'scheduled',
		type: accountData.type, // 'income' ou 'expense'
		amount: accountData.amount,
		description: accountData.description,
		date: accountData.date || new Date().toISOString(),
		category: accountData.category || 'Geral',
		status: 'pending',
		scheduled: {
			scheduledType: accountData.scheduledType, // 'receivable' ou 'payable'
			dueDate: accountData.dueDate || accountData.date,
			frequency: accountData.frequency || 'once'
		}
	};

	const response = await executeAgent('DataAgent', 'createTransaction', params);

	return {
		success: response.status === 'success',
		transaction: response.data?.transaction || null
	};
}

// ============================================================================
// CARTÃO DE CRÉDITO
// ============================================================================

/**
 * Busca todos os cartões de crédito do usuário
 * @returns {Promise<Array>}
 */
async function fetchCreditCards() {
	const userId = getUserId();

	const params = {
		userId,
		status: 'active'
	};

	const response = await executeAgent('DataAgent', 'getCreditCards', params);

	if (response.status !== 'success' || !response.data) {
		return [];
	}

	return response.data.cards || [];
}

/**
 * Busca utilização do cartão (fatura atual, limite, etc)
 * @param {string} cardId - ID do cartão
 * @returns {Promise<object>}
 */
async function fetchCreditCardUtilization(cardId) {
	const userId = getUserId();

	const params = {
		cardId,
		userId
	};

	const response = await executeAgent('DataAgent', 'getCreditCardUtilization', params);

	if (response.status !== 'success' || !response.data) {
		return {
			cardId,
			cardName: '',
			creditLimit: 0,
			utilizedAmount: 0,
			availableCredit: 0,
			utilizationPercentage: 0,
			currentBill: 0,
			billingCycle: null
		};
	}

	return response.data;
}

/**
 * Cria um novo cartão de crédito
 * @param {object} cardData - Dados do cartão
 * @returns {Promise<object>}
 */
async function createCreditCard(cardData) {
	const userId = getUserId();

	const params = {
		userId,
		cardName: cardData.cardName,
		creditLimit: cardData.creditLimit,
		billingCycleRenewalDay: cardData.billingCycleRenewalDay,
		billingDueDay: cardData.billingDueDay,
		brand: cardData.brand || 'other',
		lastFourDigits: cardData.lastFourDigits || null
	};

	const response = await executeAgent('DataAgent', 'createCreditCard', params);

	return {
		success: response.status === 'success',
		card: response.data?.card || null
	};
}

/**
 * Atualiza dados de um cartão de crédito
 * @param {string} cardId - ID do cartão
 * @param {object} updates - Campos a atualizar
 * @returns {Promise<object>}
 */
async function updateCreditCard(cardId, updates) {
	const userId = getUserId();

	const params = {
		cardId,
		userId,
		updates
	};

	const response = await executeAgent('DataAgent', 'updateCreditCard', params);

	return {
		success: response.status === 'success',
		card: response.data?.card || null
	};
}

/**
 * Busca o cartão principal do usuário (primeiro ativo)
 * @returns {Promise<object|null>}
 */
async function fetchPrimaryCreditCard() {
	const cards = await fetchCreditCards();
	return cards.length > 0 ? cards[0] : null;
}

// ============================================================================
// DÍVIDAS
// ============================================================================

/**
 * Busca todas as dívidas do usuário
 * @param {string} status - Status da dívida ('active', 'paid', 'cancelled', 'overdue') - opcional
 * @returns {Promise<object>} { debts: Array, count: number, totalPending: number }
 */
async function fetchDebts(status = null) {
	const userId = getUserId();

	const params = {
		userId
	};

	if (status) {
		params.status = status;
	}

	const response = await executeAgent('DataAgent', 'getDebts', params);

	if (response.status !== 'success' || !response.data) {
		return { debts: [], count: 0, totalPending: 0 };
	}

	return {
		debts: response.data.debts || [],
		count: response.data.count || 0,
		totalPending: response.data.totalPending || 0
	};
}

/**
 * Busca detalhes de uma dívida específica (incluindo parcelas)
 * @param {string} debtId - ID da dívida
 * @returns {Promise<object>}
 */
async function fetchDebtDetails(debtId) {
	const userId = getUserId();

	const params = {
		debtId,
		userId
	};

	const response = await executeAgent('DataAgent', 'getDebtDetails', params);

	if (response.status !== 'success' || !response.data) {
		throw new Error('Erro ao buscar detalhes da dívida');
	}

	return response.data;
}

/**
 * Cria uma nova dívida
 * @param {object} debtData - Dados da dívida
 * @returns {Promise<object>}
 */
async function createDebtEntry(debtData) {
	const userId = getUserId();

	const params = {
		userId,
		description: debtData.description,
		institution: debtData.institution,
		debtDate: debtData.debtDate || new Date().toISOString(),
		totalValue: parseFloat(debtData.totalValue),
		installmentCount: parseInt(debtData.installmentCount),
		firstPaymentDate: debtData.firstPaymentDate,
		debtType: debtData.debtType || 'other',
		interestRate: debtData.interestRate || 0,
		notes: debtData.notes || ''
	};

	const response = await executeAgent('DataAgent', 'createDebt', params);

	return {
		success: response.status === 'success',
		debt: response.data?.debt || null
	};
}

/**
 * Paga uma parcela da dívida
 * @param {string} debtId - ID da dívida
 * @param {number} installmentNumber - Número da parcela
 * @param {number} paidAmount - Valor pago (opcional)
 * @returns {Promise<object>}
 */
async function payDebtInstallment(debtId, installmentNumber, paidAmount = null) {
	const userId = getUserId();

	const params = {
		debtId,
		userId,
		installmentNumber
	};

	if (paidAmount !== null) {
		params.paidAmount = parseFloat(paidAmount);
	}

	const response = await executeAgent('DataAgent', 'payInstallment', params);

	return {
		success: response.status === 'success',
		debt: response.data?.debt || null,
		installmentPaid: response.data?.installmentPaid || null
	};
}

/**
 * Atualiza dados de uma dívida
 * @param {string} debtId - ID da dívida
 * @param {object} updates - Campos a atualizar
 * @returns {Promise<object>}
 */
async function updateDebtEntry(debtId, updates) {
	const userId = getUserId();

	const params = {
		debtId,
		userId,
		updates
	};

	const response = await executeAgent('DataAgent', 'updateDebt', params);

	return {
		success: response.status === 'success',
		debt: response.data?.debt || null
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
	
	// Future Accounts (A receber / A pagar)
	fetchFutureAccounts,
	fetchReceivables,
	fetchPayables,
	createFutureAccount,
	
	// Credit Cards (NEW)
	fetchCreditCards,
	fetchCreditCardUtilization,
	createCreditCard,
	updateCreditCard,
	fetchPrimaryCreditCard,
	
	// Credit Cards (OLD - mantido para compatibilidade)
	getCreditCards,
	getCreditCardUtilization,
	
	// Debts (NEW)
	fetchDebts,
	fetchDebtDetails,
	createDebtEntry,
	payDebtInstallment,
	updateDebtEntry,
	
	// Debts (OLD - mantido para compatibilidade)
	getDebts,
	getDebtDetails,
	createDebt,
	payInstallment,
	
	// Patrimony
	getPatrimony,
	
	// Low-level
	executeAgent
};
