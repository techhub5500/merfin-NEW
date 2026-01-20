/**
 * NOTE (response-formatter.js):
 * Purpose: Formatador universal de respostas de agentes. Garante que todas as respostas
 * sigam exatamente o mesmo formato, independente do agente que as gerou.
 * Controls: Adiciona automaticamente metadata (timestamp, execution_time, cached).
 * Behavior: Transforma dados crus em respostas padronizadas conforme contrato.
 * Integration notes: Usado por BaseAgent._successResponse() e _errorResponse().
 * Respostas sempre incluem request_id para rastreabilidade.
 */

/**
 * Formata uma resposta de sucesso no padrão do contrato
 * 
 * @param {object} options - Opções de formatação
 * @param {string} options.agentName - Nome do agente que gerou a resposta
 * @param {any} options.data - Dados a retornar
 * @param {string} options.requestId - ID da requisição
 * @param {number} options.executionTime - Tempo de execução em ms
 * @param {boolean} options.cached - Se dados vieram do cache
 * @param {string} options.cacheKey - Chave do cache (se aplicável)
 * @returns {object} - Resposta formatada
 */
function formatSuccess({
	agentName,
	data,
	requestId,
	executionTime,
	cached = false,
	cacheKey = null
}) {
	const response = {
		request_id: requestId,
		agent_name: agentName,
		status: 'success',
		data: data,
		metadata: {
			timestamp: new Date().toISOString(),
			execution_time_ms: executionTime,
			cached: cached
		}
	};

	// Adiciona cache_key apenas se presente
	if (cacheKey) {
		response.metadata.cache_key = cacheKey;
	}

	return response;
}

/**
 * Formata uma resposta de erro no padrão do contrato
 * (Delegado para error-handler, mas pode ser chamado diretamente)
 * 
 * @param {object} options - Opções de formatação
 * @param {string} options.agentName - Nome do agente
 * @param {Error} options.error - Objeto de erro
 * @param {string} options.requestId - ID da requisição
 * @param {number} options.executionTime - Tempo de execução em ms
 * @param {string} options.errorCode - Código do erro (opcional)
 * @param {string} options.errorType - Tipo do erro (opcional)
 * @returns {object} - Resposta de erro formatada
 */
function formatError({
	agentName,
	error,
	requestId,
	executionTime,
	errorCode = 'INTERNAL_ERROR',
	errorType = 'InternalError'
}) {
	return {
		request_id: requestId,
		agent_name: agentName,
		status: 'error',
		error: {
			code: errorCode,
			message: error.message || 'Erro desconhecido',
			type: errorType,
			details: error.details || {}
		},
		metadata: {
			timestamp: new Date().toISOString(),
			execution_time_ms: executionTime
		}
	};
}

/**
 * Formata uma resposta parcial (para streaming)
 * 
 * @param {object} options - Opções de formatação
 * @param {string} options.agentName - Nome do agente
 * @param {any} options.partialData - Dados parciais
 * @param {string} options.requestId - ID da requisição
 * @param {string} options.step - Passo atual da execução
 * @param {number} options.progress - Progresso (0-100)
 * @returns {object} - Resposta parcial formatada
 */
function formatPartial({
	agentName,
	partialData,
	requestId,
	step,
	progress = 0
}) {
	return {
		request_id: requestId,
		agent_name: agentName,
		status: 'partial',
		partial_data: partialData,
		metadata: {
			timestamp: new Date().toISOString(),
			step: step,
			progress_percentage: Math.min(100, Math.max(0, progress))
		}
	};
}

/**
 * Adiciona metadados de cache a uma resposta
 * 
 * @param {object} response - Resposta original
 * @param {string} cacheKey - Chave do cache
 * @param {number} ttl - TTL do cache em segundos
 * @returns {object} - Resposta com metadados de cache
 */
function addCacheMetadata(response, cacheKey, ttl) {
	if (response.metadata) {
		response.metadata.cached = true;
		response.metadata.cache_key = cacheKey;
		response.metadata.cache_ttl_seconds = ttl;
	}
	return response;
}

/**
 * Sanitiza dados sensíveis antes de retornar
 * Remove campos como senhas, tokens, etc.
 * 
 * @param {object} data - Dados a sanitizar
 * @param {array} sensitiveFields - Campos a remover
 * @returns {object} - Dados sanitizados
 */
function sanitizeData(data, sensitiveFields = ['password', 'token', 'secret', 'api_key']) {
	if (!data || typeof data !== 'object') {
		return data;
	}

	const sanitized = Array.isArray(data) ? [...data] : { ...data };

	sensitiveFields.forEach(field => {
		if (field in sanitized) {
			delete sanitized[field];
		}
	});

	// Recursivamente sanitiza objetos aninhados
	Object.keys(sanitized).forEach(key => {
		if (sanitized[key] && typeof sanitized[key] === 'object') {
			sanitized[key] = sanitizeData(sanitized[key], sensitiveFields);
		}
	});

	return sanitized;
}

module.exports = {
	formatSuccess,
	formatError,
	formatPartial,
	addCacheMetadata,
	sanitizeData
};
