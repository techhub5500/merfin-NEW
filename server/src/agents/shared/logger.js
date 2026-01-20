/**
 * NOTE (logger.js):
 * Purpose: Sistema de logging estruturado específico para agentes. Registra todas as ações,
 * erros e eventos importantes com contexto (agent name, request_id, timestamp).
 * Controls: Níveis de log (debug, info, warn, error), formatação consistente, rotação de arquivos.
 * Behavior: Em desenvolvimento exibe no console, em produção grava em arquivos com rotação.
 * Integration notes: Usado por BaseAgent._log(). Integra com Winston para funcionalidades avançadas.
 * Formato: [AgentName] [YYYY-MM-DD HH:mm:ss] [LEVEL] mensagem { metadata }
 */

const winston = require('winston');
const path = require('path');

/**
 * Níveis de log do sistema
 */
const LOG_LEVELS = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3
};

/**
 * Formato personalizado para logs de agentes
 */
const agentLogFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.printf(({ level, message, timestamp, agent, requestId, stack, ...metadata }) => {
		let log = `[${timestamp}] [${level.toUpperCase()}]`;
		
		if (agent) {
			log += ` [${agent}]`;
		}
		
		if (requestId) {
			log += ` [ReqID: ${requestId}]`;
		}
		
		log += ` ${message}`;
		
		// Adiciona metadata se houver
		const metaKeys = Object.keys(metadata);
		if (metaKeys.length > 0) {
			log += ` ${JSON.stringify(metadata)}`;
		}
		
		// Adiciona stack trace se for erro
		if (stack) {
			log += `\n${stack}`;
		}
		
		return log;
	})
);

/**
 * Configuração de transportes (onde os logs são enviados)
 */
const transports = [];

// Console (sempre ativo em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
	transports.push(
		new winston.transports.Console({
			level: 'debug',
			format: winston.format.combine(
				winston.format.colorize(),
				agentLogFormat
			)
		})
	);
}

// Arquivo de logs gerais (todos os níveis)
transports.push(
	new winston.transports.File({
		filename: path.join(__dirname, '../../../logs/agents.log'),
		level: 'info',
		format: agentLogFormat,
		maxsize: 10485760, // 10MB
		maxFiles: 5,
		tailable: true
	})
);

// Arquivo específico para erros
transports.push(
	new winston.transports.File({
		filename: path.join(__dirname, '../../../logs/agents-errors.log'),
		level: 'error',
		format: agentLogFormat,
		maxsize: 10485760, // 10MB
		maxFiles: 5,
		tailable: true
	})
);

/**
 * Instância do logger Winston
 */
const logger = winston.createLogger({
	levels: LOG_LEVELS,
	transports,
	exitOnError: false
});

/**
 * Wrapper para facilitar o uso
 */
const agentLogger = {
	/**
	 * Log de debug - informações detalhadas para desenvolvimento
	 * @param {string} message - Mensagem
	 * @param {object} metadata - Metadados adicionais
	 */
	debug(message, metadata = {}) {
		logger.debug(message, metadata);
	},

	/**
	 * Log de info - eventos normais do sistema
	 * @param {string} message - Mensagem
	 * @param {object} metadata - Metadados adicionais
	 */
	info(message, metadata = {}) {
		logger.info(message, metadata);
	},

	/**
	 * Log de warn - algo inesperado mas não crítico
	 * @param {string} message - Mensagem
	 * @param {object} metadata - Metadados adicionais
	 */
	warn(message, metadata = {}) {
		logger.warn(message, metadata);
	},

	/**
	 * Log de erro - falhas que impedem operação
	 * @param {string} message - Mensagem
	 * @param {object} metadata - Metadados adicionais (pode incluir stack)
	 */
	error(message, metadata = {}) {
		logger.error(message, metadata);
	},

	/**
	 * Método genérico que aceita nível como parâmetro
	 * @param {string} level - Nível do log
	 * @param {string} message - Mensagem
	 * @param {object} metadata - Metadados adicionais
	 */
	log(level, message, metadata = {}) {
		if (logger[level]) {
			logger[level](message, metadata);
		} else {
			logger.info(message, { level, ...metadata });
		}
	},

	/**
	 * Log específico para início de requisição
	 * @param {string} agentName - Nome do agente
	 * @param {string} requestId - ID da requisição
	 * @param {string} action - Ação sendo executada
	 * @param {object} params - Parâmetros da requisição
	 */
	logRequestStart(agentName, requestId, action, params = {}) {
		logger.info(`Iniciando execução - Action: ${action}`, {
			agent: agentName,
			requestId,
			action,
			parameters: params
		});
	},

	/**
	 * Log específico para fim de requisição
	 * @param {string} agentName - Nome do agente
	 * @param {string} requestId - ID da requisição
	 * @param {number} executionTime - Tempo de execução em ms
	 * @param {boolean} cached - Se veio do cache
	 */
	logRequestEnd(agentName, requestId, executionTime, cached = false) {
		logger.info(`Execução concluída em ${executionTime}ms`, {
			agent: agentName,
			requestId,
			executionTime,
			cached
		});
	},

	/**
	 * Log específico para cache hit
	 * @param {string} agentName - Nome do agente
	 * @param {string} cacheKey - Chave do cache
	 */
	logCacheHit(agentName, cacheKey) {
		logger.debug(`Cache HIT - Key: ${cacheKey}`, {
			agent: agentName,
			cacheKey,
			cacheStatus: 'hit'
		});
	},

	/**
	 * Log específico para cache miss
	 * @param {string} agentName - Nome do agente
	 * @param {string} cacheKey - Chave do cache
	 */
	logCacheMiss(agentName, cacheKey) {
		logger.debug(`Cache MISS - Key: ${cacheKey}`, {
			agent: agentName,
			cacheKey,
			cacheStatus: 'miss'
		});
	},

	/**
	 * Log específico para erros de validação
	 * @param {string} agentName - Nome do agente
	 * @param {string} requestId - ID da requisição
	 * @param {string} validationError - Descrição do erro
	 */
	logValidationError(agentName, requestId, validationError) {
		logger.warn(`Erro de validação: ${validationError}`, {
			agent: agentName,
			requestId,
			errorType: 'validation'
		});
	}
};

module.exports = agentLogger;
