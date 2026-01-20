/**
 * NOTE (error-handler.js):
 * Purpose: Tratador centralizado de erros para todos os agentes. Converte exceções
 * técnicas em respostas padronizadas user-friendly, sanitiza stack traces e faz logging.
 * Controls: Classifica erros por tipo (validação, banco de dados, lógica de negócio, etc).
 * Behavior: Nunca expõe stack traces ao usuário; loga detalhes completos para debug.
 * Integration notes: Usado por BaseAgent._errorResponse(). Inclui request_id para rastreamento.
 * Códigos HTTP sugeridos: 400 (validação), 422 (negócio), 500 (interno), 503 (serviço).
 */

const logger = require('./logger');
const responseFormatter = require('./response-formatter');

/**
 * Tipos de erro classificados
 */
const ErrorTypes = {
	VALIDATION: 'ValidationError',
	DATABASE: 'DatabaseError',
	BUSINESS_LOGIC: 'BusinessLogicError',
	EXTERNAL_API: 'ExternalAPIError',
	INTERNAL: 'InternalError',
	TIMEOUT: 'TimeoutError',
	NOT_FOUND: 'NotFoundError',
	UNAUTHORIZED: 'UnauthorizedError'
};

/**
 * Códigos de erro padronizados
 */
const ErrorCodes = {
	// Erros de validação (400)
	INVALID_REQUEST: 'INVALID_REQUEST',
	MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
	INVALID_FORMAT: 'INVALID_FORMAT',
	
	// Erros de lógica de negócio (422)
	INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
	INVALID_DATE: 'INVALID_DATE',
	INVALID_AMOUNT: 'INVALID_AMOUNT',
	BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
	
	// Erros de banco de dados (503)
	DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
	DATABASE_TIMEOUT: 'DATABASE_TIMEOUT',
	DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',
	
	// Erros de API externa (503)
	EXTERNAL_API_UNAVAILABLE: 'EXTERNAL_API_UNAVAILABLE',
	EXTERNAL_API_TIMEOUT: 'EXTERNAL_API_TIMEOUT',
	EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
	
	// Erros internos (500)
	INTERNAL_ERROR: 'INTERNAL_ERROR',
	AGENT_ERROR: 'AGENT_ERROR',
	UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
	
	// Erros de recurso (404)
	RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
	ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
	USER_NOT_FOUND: 'USER_NOT_FOUND',
	
	// Erros de autorização (401/403)
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN'
};

/**
 * Mapeamento de código de erro para tipo de erro
 */
const errorCodeToType = {
	[ErrorCodes.INVALID_REQUEST]: ErrorTypes.VALIDATION,
	[ErrorCodes.MISSING_REQUIRED_FIELD]: ErrorTypes.VALIDATION,
	[ErrorCodes.INVALID_FORMAT]: ErrorTypes.VALIDATION,
	
	[ErrorCodes.INSUFFICIENT_BALANCE]: ErrorTypes.BUSINESS_LOGIC,
	[ErrorCodes.INVALID_DATE]: ErrorTypes.BUSINESS_LOGIC,
	[ErrorCodes.INVALID_AMOUNT]: ErrorTypes.BUSINESS_LOGIC,
	[ErrorCodes.BUSINESS_RULE_VIOLATION]: ErrorTypes.BUSINESS_LOGIC,
	
	[ErrorCodes.DATABASE_CONNECTION_FAILED]: ErrorTypes.DATABASE,
	[ErrorCodes.DATABASE_TIMEOUT]: ErrorTypes.DATABASE,
	[ErrorCodes.DATABASE_QUERY_FAILED]: ErrorTypes.DATABASE,
	
	[ErrorCodes.EXTERNAL_API_UNAVAILABLE]: ErrorTypes.EXTERNAL_API,
	[ErrorCodes.EXTERNAL_API_TIMEOUT]: ErrorTypes.EXTERNAL_API,
	[ErrorCodes.EXTERNAL_API_ERROR]: ErrorTypes.EXTERNAL_API,
	
	[ErrorCodes.RESOURCE_NOT_FOUND]: ErrorTypes.NOT_FOUND,
	[ErrorCodes.ACCOUNT_NOT_FOUND]: ErrorTypes.NOT_FOUND,
	[ErrorCodes.USER_NOT_FOUND]: ErrorTypes.NOT_FOUND,
	
	[ErrorCodes.UNAUTHORIZED]: ErrorTypes.UNAUTHORIZED,
	[ErrorCodes.FORBIDDEN]: ErrorTypes.UNAUTHORIZED
};

/**
 * Mapeamento de tipo de erro para código HTTP sugerido
 */
const errorTypeToHttpCode = {
	[ErrorTypes.VALIDATION]: 400,
	[ErrorTypes.BUSINESS_LOGIC]: 422,
	[ErrorTypes.DATABASE]: 503,
	[ErrorTypes.EXTERNAL_API]: 503,
	[ErrorTypes.INTERNAL]: 500,
	[ErrorTypes.TIMEOUT]: 504,
	[ErrorTypes.NOT_FOUND]: 404,
	[ErrorTypes.UNAUTHORIZED]: 401
};

/**
 * Classifica um erro em um dos tipos padrão
 * @param {Error} error - Erro a classificar
 * @returns {object} - { type, code, httpCode }
 */
function classifyError(error) {
	// Se o erro já tem um código customizado
	if (error.code && errorCodeToType[error.code]) {
		const type = errorCodeToType[error.code];
		return {
			type,
			code: error.code,
			httpCode: errorTypeToHttpCode[type]
		};
	}

	// Classificação por nome do erro
	if (error.name === 'ValidationError' || error.name === 'CastError') {
		return {
			type: ErrorTypes.VALIDATION,
			code: ErrorCodes.INVALID_REQUEST,
			httpCode: 400
		};
	}

	if (error.name === 'MongoError' || error.name === 'MongoServerError') {
		return {
			type: ErrorTypes.DATABASE,
			code: ErrorCodes.DATABASE_QUERY_FAILED,
			httpCode: 503
		};
	}

	if (error.message && error.message.includes('timeout')) {
		return {
			type: ErrorTypes.TIMEOUT,
			code: ErrorCodes.DATABASE_TIMEOUT,
			httpCode: 504
		};
	}

	// Erro genérico
	return {
		type: ErrorTypes.INTERNAL,
		code: ErrorCodes.INTERNAL_ERROR,
		httpCode: 500
	};
}

/**
 * Cria mensagem user-friendly baseada no tipo de erro
 * @param {Error} error - Erro original
 * @param {string} errorType - Tipo classificado
 * @returns {string} - Mensagem sanitizada
 */
function createUserFriendlyMessage(error, errorType) {
	// Erros de validação e lógica de negócio podem expor mensagem original
	if (errorType === ErrorTypes.VALIDATION || errorType === ErrorTypes.BUSINESS_LOGIC) {
		return error.message || 'Requisição inválida';
	}

	// Erros de banco e API externa são genéricos
	if (errorType === ErrorTypes.DATABASE || errorType === ErrorTypes.EXTERNAL_API) {
		return 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.';
	}

	// Erros internos são muito genéricos
	return 'Ocorreu um erro inesperado. Nossa equipe foi notificada.';
}

/**
 * Sanitiza detalhes do erro para não expor informações sensíveis
 * @param {object} details - Detalhes do erro
 * @returns {object} - Detalhes sanitizados
 */
function sanitizeErrorDetails(details) {
	if (!details || typeof details !== 'object') {
		return {};
	}

	const sanitized = { ...details };
	
	// Remove campos sensíveis
	const sensitiveFields = ['password', 'token', 'api_key', 'secret', 'stack', 'stackTrace'];
	sensitiveFields.forEach(field => {
		delete sanitized[field];
	});

	return sanitized;
}

/**
 * Handler principal de erros
 * @param {object} options - Opções do erro
 * @param {string} options.agentName - Nome do agente
 * @param {Error} options.error - Erro capturado
 * @param {string} options.requestId - ID da requisição
 * @param {number} options.executionTime - Tempo de execução
 * @returns {object} - Resposta de erro formatada
 */
function handleError({ agentName, error, requestId, executionTime }) {
	// Classifica o erro
	const classification = classifyError(error);
	const { type, code, httpCode } = classification;

	// Cria mensagem user-friendly
	const userMessage = createUserFriendlyMessage(error, type);

	// Sanitiza detalhes
	const details = sanitizeErrorDetails({
		originalMessage: error.message,
		...(error.details || {})
	});

	// Loga o erro completo para debug (com stack trace)
	logger.log('error', `[${agentName}] Erro: ${error.message}`, {
		agent: agentName,
		requestId,
		errorType: type,
		errorCode: code,
		httpCode,
		stack: error.stack,
		details: error.details || {}
	});

	// Retorna resposta formatada SEM stack trace
	return responseFormatter.formatError({
		agentName,
		error: {
			message: userMessage,
			details
		},
		requestId,
		executionTime,
		errorCode: code,
		errorType: type
	});
}

/**
 * Cria um erro customizado com código específico
 * @param {string} message - Mensagem do erro
 * @param {string} code - Código do erro
 * @param {object} details - Detalhes adicionais
 * @returns {Error} - Erro customizado
 */
function createError(message, code, details = {}) {
	const error = new Error(message);
	error.code = code;
	error.details = details;
	return error;
}

module.exports = {
	ErrorTypes,
	ErrorCodes,
	errorTypeToHttpCode,
	handleError,
	classifyError,
	createError,
	createUserFriendlyMessage
};
