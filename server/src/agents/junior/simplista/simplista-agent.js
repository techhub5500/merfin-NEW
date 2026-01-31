/**
 * NOTE (simplista-agent.js):
 * Purpose: Agente principal para queries simples e consultas rápidas.
 * Model: GPT-5 Mini com verbosity: low, reasoning: low
 * 
 * RESPONSABILIDADES:
 * 1. Classificar queries como internas, externas ou híbridas
 * 2. Consultar FinanceDataBridge para dados financeiros
 * 3. Consultar Serper diretamente para dados externos
 * 4. Gerenciar diálogos curtos para ambiguidades
 * 5. Construir respostas enriquecidas com ofertas de aprofundamento
 * 
 * REGRAS:
 * - Respostas concisas e diretas
 * - Máximo 2-3 trocas de diálogo
 * - Transição para COMPLEXA se query exigir análise profunda
 * - Log focado (<20 linhas por request)
 */

const { QueryClassifier, queryClassifier } = require('./query-classifier');
const { FinanceBridgeConnector, financeBridgeConnector } = require('./finance-bridge-connector');
const { SerperConnector, serperConnector } = require('./serper-connector');
const { DialogueManager, dialogueManager } = require('./dialogue-manager');
const { ResponseBuilder, responseBuilder } = require('./response-builder');
const { SimplistaLogger, logger } = require('./simplista-logger');
const { SimplistaCache, simplistaCache } = require('./simplista-cache');

/**
 * SimplistaAgent - Agente para consultas simples
 */
class SimplistaAgent {
	constructor(options = {}) {
		// Componentes
		this.classifier = options.classifier || queryClassifier;
		this.bridge = options.bridge || financeBridgeConnector;
		this.serper = options.serper || serperConnector;
		this.dialogue = options.dialogue || dialogueManager;
		this.responseBuilder = options.responseBuilder || responseBuilder;
		this.logger = options.logger || logger;
		this.cache = options.cache || simplistaCache;
		
		// Configurações
		this.timeout = options.timeout || 10000; // 10 segundos
		this.maxDialogueAttempts = options.maxDialogueAttempts || 3;
	}

	/**
	 * Executa query do usuário
	 * @param {object} params - Parâmetros
	 * @param {string} params.userId - ID do usuário
	 * @param {object} params.memory - Memória do usuário
	 * @param {string} params.message - Mensagem do usuário
	 * @returns {Promise<object>} - Resposta
	 */
	async execute({ userId, memory, message }) {
		const startTime = Date.now();
		
		this.logger.startExecution(userId, message);
		
		try {
			// 1. Verifica se é confirmação de oferta executável
			if (this.dialogue.hasActiveDialogue(userId) && this.dialogue.isConfirmation(message)) {
				const action = this.dialogue.processOfferConfirmation(userId, message);
				
				if (action) {
					// Executa ação diretamente
					return await this.executeOfferAction(userId, message, action, startTime);
				}
			}
			
			// 2. Verifica diálogo de esclarecimento ativo
			if (this.dialogue.hasActiveDialogue(userId)) {
				return await this.handleDialogueResponse(userId, message, startTime);
			}
			
			// 3. Classifica a query
			const classification = await this.classifier.classify(message);
			
			this.logger.classification({
				needsFinance: classification.sources?.includes('INTERNAL'),
				needsExternal: classification.sources?.includes('EXTERNAL'),
				isAmbiguous: classification.isAmbiguous,
				isTransition: !!classification.transitionTo
			});
			
			// 3. Verifica se precisa transicionar
			if (classification.transitionTo) {
				return this.responseBuilder.buildTransitionResponse(
					classification.transitionTo,
					classification.reason
				);
			}
			
			// 4. Verifica ambiguidade
			if (classification.isAmbiguous && !classification.canProceedWithDefault) {
				return this.handleAmbiguity(userId, message, classification, startTime);
			}
			
			// 5. Executa consultas baseado na classificação
			const data = await this.fetchData(userId, message, classification);
			
			// 6. Constrói resposta
			const response = this.responseBuilder.build({
				type: classification.type,
				data,
				classification,
				originalQuery: message,
				executionTime: Date.now() - startTime
			});
			
			// 7. Salva oferta executável se houver
			if (response.metadata?.deepening?.executable) {
				this.dialogue.saveExecutableOffer(userId, response.metadata.deepening);
			}
			
			// 8. Log final
			this.logger.endExecution(startTime, response);
			
			return response;
			
		} catch (error) {
			this.logger.error('execute', error);
			
			return this.responseBuilder.buildErrorResponse('default', error);
		}
	}

	/**
	 * Busca dados baseado na classificação
	 * @param {string} userId - ID do usuário
	 * @param {string} message - Mensagem original
	 * @param {object} classification - Classificação
	 * @returns {Promise<object>} - Dados obtidos
	 */
	async fetchData(userId, message, classification) {
		const { sources, type } = classification;
		const data = {};
		
		try {
			// Consulta paralela se ambas fontes necessárias
			if (sources.includes('INTERNAL') && sources.includes('EXTERNAL')) {
				const [internalResult, externalResult] = await Promise.allSettled([
					this.fetchInternalData(userId, message, classification),
					this.fetchExternalData(message, classification)
				]);
				
				if (internalResult.status === 'fulfilled') {
					data.internal = internalResult.value;
				}
				if (externalResult.status === 'fulfilled') {
					data.external = externalResult.value;
				}
				
			} else if (sources.includes('INTERNAL')) {
				data.internal = await this.fetchInternalData(userId, message, classification);
				
			} else if (sources.includes('EXTERNAL')) {
				data.external = await this.fetchExternalData(message, classification);
			}
			
			// Combina dados se híbrido
			if (data.internal && data.external) {
				data.formattedResponse = this.combineResponses(data.internal, data.external);
				data.type = 'HYBRID';
			} else if (data.internal) {
				data.formattedResponse = data.internal.formattedResponse;
				data.type = data.internal.type || type;
			} else if (data.external) {
				data.formattedResponse = data.external.formattedResponse;
				data.type = 'EXTERNAL';
			}
			
			return data;
			
		} catch (error) {
			this.logger.error('fetchData', error);
			throw error;
		}
	}

	/**
	 * Executa ação de oferta confirmada pelo usuário
	 */
	async executeOfferAction(userId, originalMessage, action, startTime) {
		try {
			this.logger.startExecution();
			
			// Para ranking por categoria, usa summary do Bridge que já retorna breakdown
			const request = {
				userId,
				action: 'summary', // Summary já retorna breakdown por categoria
				domain: action.domain || 'transactions',
				filters: {
					dateRange: 'mesAtual'
				}
			};
			
			// Executa no Bridge
			const result = await this.bridge.bridge.execute(request);
			
			if (!result.success) {
				return this.responseBuilder.buildErrorResponse('bridge_error', result.error);
			}
			
			// Se pediu ranking, ajusta action para formatRanking ser chamado
			if (action.type === 'ranking') {
				result.action = 'ranking';
			}
			
			// Formata resposta
			const processed = this.bridge.processResponse(result, originalMessage, 'GASTOS');
			
			const response = {
				resposta: processed.formattedResponse || 'É necessário ter mais transações categorizadas para gerar o ranking.',
				metadata: {
					agente: 'simplista',
					tempoExecucao: Date.now() - startTime,
					fontesConsultadas: ['FinanceDataBridge'],
					ofereceuAprofundamento: false
				}
			};
			
			this.logger.endExecution(startTime, response);
			return response;
			
		} catch (error) {
			this.logger.error('executeOfferAction', error);
			return this.responseBuilder.buildErrorResponse('offer_execution', error);
		}
	}

	/**
	 * Busca dados internos via Bridge
	 */
	async fetchInternalData(userId, message, classification) {
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error('Bridge timeout')), this.timeout);
		});
		
		const dataPromise = this.bridge.query(
			message,
			classification.type,
			userId,
			null // memory
		);
		
		return Promise.race([dataPromise, timeoutPromise]);
	}

	/**
	 * Busca dados externos via Serper
	 */
	async fetchExternalData(message, classification) {
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error('Serper timeout')), this.timeout);
		});
		
		const dataPromise = this.serper.query(
			message,
			classification.type,
			{}
		);
		
		return Promise.race([dataPromise, timeoutPromise]);
	}

	/**
	 * Combina respostas internas e externas
	 */
	combineResponses(internal, external) {
		let response = '';
		
		// Dados internos primeiro
		if (internal.formattedResponse) {
			response += internal.formattedResponse;
		}
		
		// Adiciona dados externos se relevantes
		if (external.formattedResponse) {
			response += '\n\n---\n';
			response += '🌐 **Informações adicionais:**\n';
			response += external.formattedResponse;
		}
		
		return response;
	}

	/**
	 * Trata ambiguidade iniciando diálogo
	 */
	handleAmbiguity(userId, message, classification, startTime) {
		const { ambiguityType } = classification;
		
		const dialogueResult = this.dialogue.startDialogue(
			userId,
			message,
			ambiguityType,
			classification
		);
		
		this.logger.dialogueStarted(ambiguityType);
		
		return {
			resposta: dialogueResult.question,
			metadata: {
				tempoExecucao: Date.now() - startTime,
				fontesConsultadas: [],
				ofereceuAprofundamento: false,
				dialogoIniciado: true,
				tipoAmbiguidade: ambiguityType
			}
		};
	}

	/**
	 * Processa resposta de diálogo ativo
	 */
	async handleDialogueResponse(userId, message, startTime) {
		const result = this.dialogue.processResponse(userId, message);
		
		if (!result.success) {
			// Precisa de mais esclarecimento
			return {
				resposta: result.message,
				metadata: {
					tempoExecucao: Date.now() - startTime,
					fontesConsultadas: [],
					dialogoAtivo: true,
					tentativasRestantes: result.remainingAttempts
				}
			};
		}
		
		// Diálogo resolvido, reconstrói query e executa
		const enhancedQuery = this.dialogue.reconstructQuery(
			result.originalQuery,
			result.clarification
		);
		
		this.logger.dialogueContinued(result.clarification.type);
		
		// Re-executa com query melhorada
		return this.execute({
			userId,
			memory: {},
			message: enhancedQuery
		});
	}

	/**
	 * Retorna estatísticas do agente
	 */
	getStats() {
		return {
			agent: 'SimplistaAgent',
			cache: this.cache.getStats(),
			dialogue: this.dialogue.getStats(),
			metrics: this.logger.getMetrics()
		};
	}

	/**
	 * Limpa cache e recursos
	 */
	async cleanup() {
		this.cache.clearAll();
		this.logger.resetMetrics();
	}
}

// Factory function para criar instância
function createSimplistaAgent(options = {}) {
	return new SimplistaAgent(options);
}

// Instância padrão (singleton)
let defaultInstance = null;

function getSimplistaAgent() {
	if (!defaultInstance) {
		defaultInstance = new SimplistaAgent();
	}
	return defaultInstance;
}

module.exports = {
	SimplistaAgent,
	createSimplistaAgent,
	getSimplistaAgent
};
