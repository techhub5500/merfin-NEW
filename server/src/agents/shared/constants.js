/**
 * NOTE (constants.js):
 * Purpose: Fonte única da verdade para todas as constantes usadas pelos agentes.
 * Define enums de complexidade, status, limites de ciclos, TTLs de cache, etc.
 * Controls: Valores centralizados que podem ser ajustados sem mudar código dos agentes.
 * Behavior: Mudanças aqui afetam automaticamente todos os agentes que usam essas constantes.
 * Integration notes: Importado por todos os agentes e pelo orquestrador para garantir
 * consistência. Use sempre essas constantes em vez de valores hardcoded.
 */

/**
 * Níveis de complexidade de queries/tarefas
 * Usados pelo orquestrador para determinar limite de ciclos ReAct
 */
const COMPLEXITY = {
	SIMPLE: 'simple',           // Queries diretas, 1-2 agentes
	BASIC: 'basic',             // Queries com 2-3 agentes
	COMPARATIVE: 'comparative', // Comparações, análises
	COMPLEX: 'complex',         // Múltiplos agentes, planejamento
	RESEARCH: 'research'        // Pesquisa externa intensiva
};

/**
 * Status possíveis de uma resposta de agente
 */
const STATUS = {
	SUCCESS: 'success',   // Execução bem-sucedida
	ERROR: 'error',       // Erro durante execução
	PARTIAL: 'partial'    // Resultado parcial (streaming)
};

/**
 * Status de transações financeiras
 */
const TRANSACTION_STATUS = {
	PENDING: 'pending',       // Aguardando processamento
	CONFIRMED: 'confirmed',   // Confirmada
	CANCELLED: 'cancelled',   // Cancelada
	FAILED: 'failed'          // Falhou
};

/**
 * Tipos de transação
 */
const TRANSACTION_TYPES = {
	INCOME: 'income',         // Receita
	EXPENSE: 'expense',       // Despesa
	TRANSFER: 'transfer',     // Transferência
	INVESTMENT: 'investment'  // Investimento
};

/**
 * Status de conta
 */
const ACCOUNT_STATUS = {
	ACTIVE: 'active',
	SUSPENDED: 'suspended',
	CLOSED: 'closed'
};

/**
 * Perfis de risco do usuário
 */
const RISK_PROFILES = {
	CONSERVATIVE: 'conservador',
	MODERATE: 'moderado',
	AGGRESSIVE: 'agressivo'
};

/**
 * Limites de ciclos ReAct por nível de complexidade
 * Previne loops infinitos e controla custos de LLM
 */
const CYCLE_LIMITS = {
	[COMPLEXITY.SIMPLE]: 3,
	[COMPLEXITY.BASIC]: 5,
	[COMPLEXITY.COMPARATIVE]: 8,
	[COMPLEXITY.COMPLEX]: 12,
	[COMPLEXITY.RESEARCH]: 15
};

/**
 * TTLs de cache por tipo de dado (em segundos)
 * Balanceia frescor dos dados com performance
 */
const CACHE_TTL = {
	// Dados financeiros - TTL curto
	ACCOUNT_BALANCE: 60,           // 1 minuto
	RECENT_TRANSACTIONS: 120,      // 2 minutos
	ACCOUNT_SUMMARY: 300,          // 5 minutos
	
	// Dados de perfil - TTL médio
	USER_PROFILE: 1800,            // 30 minutos
	RISK_ASSESSMENT: 3600,         // 1 hora
	INVESTMENT_GOALS: 1800,        // 30 minutos
	
	// Análises e cálculos - TTL médio
	INVESTMENT_ANALYSIS: 600,      // 10 minutos
	COMPARISON_RESULTS: 900,       // 15 minutos
	RETURNS_CALCULATION: 300,      // 5 minutos
	
	// Pesquisas externas - TTL longo
	MARKET_DATA: 3600,             // 1 hora
	ASSET_PRICES: 1800,            // 30 minutos
	ECONOMIC_INDICATORS: 7200,     // 2 horas
	NEWS_ARTICLES: 3600,           // 1 hora
	
	// Dados estáticos - TTL muito longo
	PLATFORM_CONFIG: 86400,        // 24 horas
	TAX_RATES: 43200               // 12 horas
};

/**
 * Prefixos de chave de cache por agente
 * Facilita invalidação e organização
 */
const CACHE_KEY_PREFIXES = {
	DATA_AGENT: 'data:',
	RESEARCH_AGENT: 'research:',
	ANALYST_AGENT: 'analyst:',
	STRATEGIST_AGENT: 'strategist:',
	TRANSACTION_AGENT: 'transaction:',
	VALIDATOR_AGENT: 'validator:'
};

/**
 * Timeouts de operação por tipo (em milissegundos)
 */
const TIMEOUTS = {
	DATABASE_QUERY: 10000,       // 10 segundos
	EXTERNAL_API: 15000,         // 15 segundos
	LLM_CALL: 30000,             // 30 segundos
	AGENT_EXECUTION: 60000,      // 60 segundos
	ORCHESTRATOR_CYCLE: 120000   // 2 minutos
};

/**
 * Limites de dados
 */
const LIMITS = {
	MAX_TRANSACTIONS_PER_QUERY: 100,
	MAX_SEARCH_RESULTS: 20,
	MAX_COMPARISON_ITEMS: 5,
	MAX_DESCRIPTION_LENGTH: 500,
	MIN_INVESTMENT_AMOUNT: 0.01,
	MAX_RETRY_ATTEMPTS: 3
};

/**
 * Moedas suportadas
 */
const CURRENCIES = {
	BRL: 'BRL',
	USD: 'USD',
	EUR: 'EUR'
};

/**
 * Tipos de investimento
 */
const INVESTMENT_TYPES = {
	CDB: 'CDB',
	LCI: 'LCI',
	LCA: 'LCA',
	TESOURO_DIRETO: 'Tesouro Direto',
	ACOES: 'Ações',
	FUNDOS: 'Fundos',
	RENDA_FIXA: 'Renda Fixa'
};

/**
 * Ações disponíveis por agente
 * Mapeamento de quais ações cada agente pode executar
 */
const AGENT_ACTIONS = {
	DataAgent: [
		'fetchAccountBalance',
		'fetchTransactions',
		'fetchUserProfile',
		'fetchAccountSummary',
		'validateDataIntegrity'
	],
	ResearchAgent: [
		'searchAssetPrices',
		'searchMarketAnalysis',
		'searchEconomicIndicators',
		'searchNews'
	],
	AnalystAgent: [
		'compareInvestments',
		'calculateReturns',
		'analyzePortfolio',
		'assessRisk'
	],
	StrategistAgent: [
		'createInvestmentPlan',
		'optimizePortfolio',
		'suggestRebalancing',
		'planRetirement'
	],
	TransactionAgent: [
		'executeTransaction',
		'scheduleTransaction',
		'updateTransaction',
		'cancelTransaction'
	],
	ValidatorAgent: [
		'validateTransaction',
		'checkCompliance',
		'verifyLimits',
		'auditOperation'
	]
};

/**
 * Prioridades de execução para paralelização
 * Números mais baixos = maior prioridade
 */
const EXECUTION_PRIORITY = {
	CRITICAL: 1,    // Validações, checks de segurança
	HIGH: 2,        // Busca de dados essenciais
	NORMAL: 3,      // Análises, cálculos
	LOW: 4          // Pesquisas opcionais, cache warming
};

/**
 * Níveis de log
 */
const LOG_LEVELS = {
	DEBUG: 'debug',
	INFO: 'info',
	WARN: 'warn',
	ERROR: 'error'
};

module.exports = {
	COMPLEXITY,
	STATUS,
	TRANSACTION_STATUS,
	TRANSACTION_TYPES,
	ACCOUNT_STATUS,
	RISK_PROFILES,
	CYCLE_LIMITS,
	CACHE_TTL,
	CACHE_KEY_PREFIXES,
	TIMEOUTS,
	LIMITS,
	CURRENCIES,
	INVESTMENT_TYPES,
	AGENT_ACTIONS,
	EXECUTION_PRIORITY,
	LOG_LEVELS
};
