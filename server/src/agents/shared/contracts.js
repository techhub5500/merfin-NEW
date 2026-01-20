/**
 * NOTE (contracts.js):
 * Purpose: Define contratos (schemas) de requisição e resposta padrão para comunicação
 * entre agentes e orquestrador. Garante consistência e validação de dados.
 * Controls: Valida estrutura de requisições/respostas usando Joi.
 * Behavior: Rejeita requisições malformadas antes de chegarem ao agente.
 * Integration notes: Todos os agentes devem aceitar requisições neste formato e
 * retornar respostas neste formato. Use validateRequest() antes de processar.
 */

const Joi = require('joi');

/**
 * Schema de requisição padrão para todos os agentes
 * 
 * Formato esperado:
 * {
 *   request_id: "uuid",
 *   agent_name: "DataAgent",
 *   action: "fetchAccountBalance",
 *   parameters: { user_id: "123", account_id: "456" },
 *   context: { session_id: "abc", user_id: "123" }
 * }
 */
const requestSchema = Joi.object({
	request_id: Joi.string().optional(),
	agent_name: Joi.string().required()
		.messages({
			'any.required': 'Campo "agent_name" é obrigatório',
			'string.base': 'Campo "agent_name" deve ser uma string'
		}),
	action: Joi.string().required()
		.messages({
			'any.required': 'Campo "action" é obrigatório',
			'string.base': 'Campo "action" deve ser uma string'
		}),
	parameters: Joi.object().optional().default({}),
	context: Joi.object({
		session_id: Joi.string().optional(),
		user_id: Joi.string().optional(),
		toolContext: Joi.object().optional()
	}).optional().default({})
}).unknown(false);

/**
 * Schema de resposta de sucesso padrão
 * 
 * Formato esperado:
 * {
 *   request_id: "uuid",
 *   agent_name: "DataAgent",
 *   status: "success",
 *   data: { ... },
 *   metadata: {
 *     timestamp: "2026-01-18T14:32:15Z",
 *     execution_time_ms: 45,
 *     cached: false
 *   }
 * }
 */
const successResponseSchema = Joi.object({
	request_id: Joi.string().required(),
	agent_name: Joi.string().required(),
	status: Joi.string().valid('success').required(),
	data: Joi.any().required(),
	metadata: Joi.object({
		timestamp: Joi.date().iso().required(),
		execution_time_ms: Joi.number().min(0).required(),
		cached: Joi.boolean().optional().default(false),
		cache_key: Joi.string().optional()
	}).required()
});

/**
 * Schema de resposta de erro padrão
 * 
 * Formato esperado:
 * {
 *   request_id: "uuid",
 *   agent_name: "DataAgent",
 *   status: "error",
 *   error: {
 *     code: "VALIDATION_ERROR",
 *     message: "Saldo insuficiente",
 *     type: "BusinessLogicError",
 *     details: { ... }
 *   },
 *   metadata: {
 *     timestamp: "2026-01-18T14:32:15Z",
 *     execution_time_ms: 12
 *   }
 * }
 */
const errorResponseSchema = Joi.object({
	request_id: Joi.string().required(),
	agent_name: Joi.string().required(),
	status: Joi.string().valid('error').required(),
	error: Joi.object({
		code: Joi.string().required(),
		message: Joi.string().required(),
		type: Joi.string().required(),
		details: Joi.object().optional()
	}).required(),
	metadata: Joi.object({
		timestamp: Joi.date().iso().required(),
		execution_time_ms: Joi.number().min(0).required()
	}).required()
});

/**
 * Valida uma requisição contra o schema padrão
 * @param {object} request - Requisição a validar
 * @returns {object} - { valid: boolean, value?: object, error?: string }
 */
function validateRequest(request) {
	const result = requestSchema.validate(request, {
		abortEarly: false,
		stripUnknown: false
	});

	if (result.error) {
		return {
			valid: false,
			error: result.error.details.map(d => d.message).join('; ')
		};
	}

	return {
		valid: true,
		value: result.value
	};
}

/**
 * Valida uma resposta de sucesso contra o schema padrão
 * @param {object} response - Resposta a validar
 * @returns {object} - { valid: boolean, value?: object, error?: string }
 */
function validateSuccessResponse(response) {
	const result = successResponseSchema.validate(response, {
		abortEarly: false
	});

	if (result.error) {
		return {
			valid: false,
			error: result.error.details.map(d => d.message).join('; ')
		};
	}

	return {
		valid: true,
		value: result.value
	};
}

/**
 * Valida uma resposta de erro contra o schema padrão
 * @param {object} response - Resposta a validar
 * @returns {object} - { valid: boolean, value?: object, error?: string }
 */
function validateErrorResponse(response) {
	const result = errorResponseSchema.validate(response, {
		abortEarly: false
	});

	if (result.error) {
		return {
			valid: false,
			error: result.error.details.map(d => d.message).join('; ')
		};
	}

	return {
		valid: true,
		value: result.value
	};
}

/**
 * Cria uma requisição padrão válida
 * @param {string} agentName - Nome do agente
 * @param {string} action - Ação a executar
 * @param {object} parameters - Parâmetros da ação
 * @param {object} context - Contexto adicional
 * @returns {object} - Requisição formatada
 */
function createRequest(agentName, action, parameters = {}, context = {}) {
	return {
		request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		agent_name: agentName,
		action,
		parameters,
		context
	};
}

module.exports = {
	requestSchema,
	successResponseSchema,
	errorResponseSchema,
	validateRequest,
	validateSuccessResponse,
	validateErrorResponse,
	createRequest
};
