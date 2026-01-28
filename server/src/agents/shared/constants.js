/**
 * NOTE (constants.js):
 * Purpose: Fonte única da verdade para todas as constantes usadas pelos agentes.
 * Define enums de status, categorias, TTLs de cache, timeouts, etc.
 * Controls: Valores centralizados que podem ser ajustados sem mudar código dos agentes.
 * Behavior: Mudanças aqui afetam automaticamente todos os agentes que usam essas constantes.
 * Integration notes: Importado por todos os agentes para garantir consistência.
 * Use sempre essas constantes em vez de valores hardcoded.
 */

/**
 * Níveis de complexidade de queries/tarefas
 * Usados pelo sistema de triagem para classificar requisições
 */
const COMPLEXITY = {
	TRIVIAL: 'trivial',         // Saudações, info do sistema
	LAUNCH: 'launch',           // Lançamento de transações
	SIMPLE: 'simple',           // Queries diretas, informacionais
	COMPLEX: 'complex'          // Análises, planejamento, múltiplos dados
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
 * Tipos de agente do sistema
 */
const AGENT_TYPES = {
	JUNIOR: 'JuniorAgent',           // Triagem e roteamento
	SIMPLISTA: 'SimplistaAgent',     // Consultas simples
	LAUNCH: 'LancadorAgent',         // Lançamentos transacionais
	DATA: 'DataAgent',               // Acesso a dados
	ANALYST: 'AnalystAgent',         // Análises futuras
	RESEARCH: 'ResearchAgent'        // Pesquisas futuras
};

/**
 * Limites de tentativas e diálogos
 */
const LIMITS_INTERACTION = {
	MAX_DIALOG_TURNS: 3,          // Máximo de trocas em diálogo
	MAX_RETRY_ATTEMPTS: 3,        // Tentativas de retry
	MAX_CLARIFICATION_ATTEMPTS: 2 // Tentativas de esclarecimento
};

/**
 * TTLs de cache por tipo de dado (em segundos)
 * Balanceia frescor dos dados com performance
 * 
 * NOTA: Para garantir atualização em tempo real dos cards do dashboard,
 * os TTLs de transações e resumos foram reduzidos significativamente.
 */
const CACHE_TTL = {
	// Dados financeiros - TTL muito curto para garantir atualização em tempo real
	ACCOUNT_BALANCE: 5,            // 5 segundos - atualiza quase sempre
	RECENT_TRANSACTIONS: 5,        // 5 segundos - atualiza quase sempre
	ACCOUNT_SUMMARY: 5,            // 5 segundos - atualiza quase sempre (cards do topo)
	
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
	JUNIOR_TRIAGE: 5000,         // 5 segundos (triagem rápida)
	SIMPLISTA_QUERY: 10000,      // 10 segundos (consulta simples)
	LANCH_TRANSACTION: 15000     // 15 segundos (lançamento)
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
	JuniorAgent: [
		'triageQuery',
		'classifyComplexity',
		'routeToAgent',
		'handleTrivial'
	],
	SimplistaAgent: [
		'fetchSimpleData',
		'calculateSimpleMetric',
		'clarifyQuery',
		'respondDirect'
	],
	LancadorAgent: [
		'extractTransactionInfo',
		'validateTransaction',
		'persistTransaction',
		'confirmLaunch',
		'clarifyDetails'
	],
	DataAgent: [
		'fetchAccountBalance',
		'fetchTransactions',
		'fetchUserProfile',
		'fetchAccountSummary',
		'validateDataIntegrity',
		'getCreditCards',
		'getDebts',
		'fetchReceivables',
		'fetchPayables'
	],
	// Agentes futuros
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

/**
 * Categorias de transação/despesa
 */
const TRANSACTION_CATEGORIES = {
	ALIMENTACAO: 'Alimentação',
	TRANSPORTE: 'Transporte',
	SAUDE: 'Saúde',
	LAZER: 'Lazer',
	EDUCACAO: 'Educação',
	MORADIA: 'Moradia',
	CONTAS: 'Contas',
	SALARIO: 'Salário',
	OUTROS: 'Outros'
};

/**
 * Estado de contexto de diálogo
 */
const DIALOG_STATE = {
	NONE: null,
	SIMPLISTA_ACTIVE: 'simplista',
	LANCH_ACTIVE: 'lancador',
	AWAITING_CLARIFICATION: 'awaiting_clarification'
};

module.exports = {
	COMPLEXITY,
	STATUS,
	TRANSACTION_STATUS,
	TRANSACTION_TYPES,
	TRANSACTION_CATEGORIES,
	ACCOUNT_STATUS,
	RISK_PROFILES,
	AGENT_TYPES,
	LIMITS_INTERACTION,
	DIALOG_STATE,
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
