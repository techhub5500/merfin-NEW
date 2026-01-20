/**
 * NOTE (base-agent.js):
 * Purpose: Classe abstrata base para todos os agentes do sistema. Define contrato padrão
 * e métodos auxiliares compartilhados (logging, formatação de resposta, validação).
 * Controls: Todos os agentes DEVEM estender esta classe e implementar execute(request).
 * Behavior: Fornece _successResponse(), _errorResponse(), _log() para uso pelos agentes filhos.
 * Integration notes: Usar logger compartilhado e response-formatter para consistência.
 * Cada agente filho sobrescreve o método execute() com sua lógica específica.
 */

const logger = require('./logger');
const responseFormatter = require('./response-formatter');
const errorHandler = require('./error-handler');

/**
 * BaseAgent - Classe abstrata base para todos os agentes
 * 
 * Esta classe define o contrato e comportamento padrão que todos os agentes
 * devem seguir. Fornece funcionalidades comuns como:
 * - Logging estruturado
 * - Formatação padronizada de respostas
 * - Tratamento centralizado de erros
 * - Validação básica de requisições
 */
class BaseAgent {
	/**
	 * @param {string} agentName - Nome único do agente (ex: 'DataAgent', 'AnalystAgent')
	 * @param {object} config - Configurações específicas do agente
	 */
	constructor(agentName, config = {}) {
		if (this.constructor === BaseAgent) {
			throw new Error('BaseAgent é uma classe abstrata e não pode ser instanciada diretamente');
		}

		this.name = agentName;
		this.config = config;
		this.startTime = null;
	}

	/**
	 * Método principal que cada agente DEVE implementar
	 * @param {object} request - Requisição no formato padrão do contrato
	 * @returns {Promise<object>} - Resposta formatada
	 */
	async execute(request) {
		throw new Error(`Método execute() deve ser implementado por ${this.name}`);
	}

	/**
	 * Executa a requisição com tratamento de erros e logging automático
	 * @param {object} request - Requisição validada
	 * @returns {Promise<object>} - Resposta formatada
	 */
	async run(request) {
		this.startTime = Date.now();
		const requestId = request.request_id || this._generateRequestId();

		try {
			this._log('info', `Iniciando execução - Request ID: ${requestId}`);
			this._log('debug', `Parâmetros: ${JSON.stringify(request.parameters || {})}`);

			// Validação básica da estrutura da requisição
			this._validateRequest(request);

			// Executa a lógica específica do agente
			const result = await this.execute(request);

			const executionTime = Date.now() - this.startTime;
			this._log('info', `Execução concluída em ${executionTime}ms`);

			return this._successResponse(result, requestId, executionTime);

		} catch (error) {
			const executionTime = Date.now() - this.startTime;
			this._log('error', `Erro durante execução: ${error.message}`);
			return this._errorResponse(error, requestId, executionTime);
		}
	}

	/**
	 * Formata resposta de sucesso no padrão do contrato
	 * @param {any} data - Dados a retornar
	 * @param {string} requestId - ID da requisição
	 * @param {number} executionTime - Tempo de execução em ms
	 * @returns {object} - Resposta formatada
	 */
	_successResponse(data, requestId, executionTime) {
		return responseFormatter.formatSuccess({
			agentName: this.name,
			data,
			requestId,
			executionTime
		});
	}

	/**
	 * Formata resposta de erro no padrão do contrato
	 * @param {Error} error - Erro capturado
	 * @param {string} requestId - ID da requisição
	 * @param {number} executionTime - Tempo de execução em ms
	 * @returns {object} - Resposta de erro formatada
	 */
	_errorResponse(error, requestId, executionTime) {
		return errorHandler.handleError({
			agentName: this.name,
			error,
			requestId,
			executionTime
		});
	}

	/**
	 * Sistema de logging estruturado
	 * @param {string} level - Nível do log (debug, info, warn, error)
	 * @param {string} message - Mensagem a logar
	 * @param {object} metadata - Metadados adicionais
	 */
	_log(level, message, metadata = {}) {
		logger.log(level, `[${this.name}] ${message}`, {
			agent: this.name,
			...metadata
		});
	}

	/**
	 * Validação básica da estrutura da requisição
	 * @param {object} request - Requisição a validar
	 * @throws {Error} - Se requisição inválida
	 */
	_validateRequest(request) {
		if (!request || typeof request !== 'object') {
			throw new Error('Requisição deve ser um objeto');
		}

		if (!request.action) {
			throw new Error('Campo "action" é obrigatório na requisição');
		}

		// Validação adicional pode ser feita por cada agente específico
	}

	/**
	 * Gera um ID único para a requisição
	 * @returns {string} - ID único
	 */
	_generateRequestId() {
		return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Obtém o nome do agente
	 * @returns {string}
	 */
	getName() {
		return this.name;
	}

	/**
	 * Obtém configurações do agente
	 * @returns {object}
	 */
	getConfig() {
		return this.config;
	}
}

module.exports = BaseAgent;
