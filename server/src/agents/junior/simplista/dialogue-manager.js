/**
 * NOTE (dialogue-manager.js):
 * Purpose: Gerenciamento de diálogo interativo para queries ambíguas.
 * Design: Mantém estado de diálogo por usuário com timeout automático.
 * 
 * CARACTERÍSTICAS:
 * - Máximo 2-3 trocas de diálogo
 * - Timeout de 5 minutos
 * - Perguntas direcionadas por tipo de ambiguidade
 * - Transição automática para complexo se necessário
 */

const { logger } = require('./simplista-logger');

/**
 * Templates de perguntas por tipo de ambiguidade
 */
const CLARIFICATION_TEMPLATES = {
	PERIOD: {
		question: 'Qual período você quer consultar? Este mês, último mês ou outro?',
		options: ['este mês', 'último mês', 'últimos 7 dias', 'este ano'],
		defaultValue: 'mesAtual'
	},
	CATEGORY: {
		question: 'Que tipo de despesa? Alimentação, transporte, moradia ou outra?',
		options: ['alimentação', 'transporte', 'moradia', 'saúde', 'lazer'],
		defaultValue: null
	},
	ACCOUNT: {
		question: 'Saldo de qual conta? Corrente, poupança ou total em investimentos?',
		options: ['corrente', 'poupança', 'investimentos', 'total'],
		defaultValue: 'total'
	},
	AMOUNT: {
		question: 'Qual o valor aproximado?',
		options: [],
		defaultValue: null
	}
};

/**
 * Mapeamento de respostas para valores do sistema
 */
const RESPONSE_MAPPINGS = {
	PERIOD: {
		'este mes': 'mesAtual',
		'esse mes': 'mesAtual',
		'mes atual': 'mesAtual',
		'ultimo mes': 'mesAnterior',
		'mes passado': 'mesAnterior',
		'ultimos 7 dias': '7d',
		'semana': '7d',
		'este ano': 'anoAtual',
		'esse ano': 'anoAtual',
		'ano passado': 'anoAnterior',
		'3 meses': '3m',
		'ultimos 3 meses': '3m'
	},
	CATEGORY: {
		'alimentacao': 'alimentacao',
		'comida': 'alimentacao',
		'mercado': 'alimentacao',
		'transporte': 'transporte',
		'uber': 'transporte',
		'moradia': 'moradia',
		'aluguel': 'moradia',
		'saude': 'saude',
		'lazer': 'lazer',
		'entretenimento': 'lazer'
	},
	ACCOUNT: {
		'corrente': 'checking',
		'poupanca': 'savings',
		'investimentos': 'investments',
		'investimento': 'investments',
		'total': 'all',
		'tudo': 'all',
		'todos': 'all'
	}
};

/**
 * DialogueManager - Gerenciador de diálogos interativos
 */
class DialogueManager {
	constructor(options = {}) {
		// Map de contextos ativos: userId -> contexto
		this.activeContexts = new Map();
		
		// Configurações
		this.maxAttempts = options.maxAttempts || 3;
		this.timeoutMs = options.timeoutMs || 5 * 60 * 1000; // 5 minutos
		
		// Limpeza periódica de contextos expirados
		this.cleanupInterval = setInterval(() => {
			this.cleanupExpired();
		}, 60000); // A cada minuto
	}

	/**
	 * Verifica se usuário tem diálogo ativo
	 * @param {string} userId - ID do usuário
	 * @returns {boolean}
	 */
	hasActiveDialogue(userId) {
		const context = this.activeContexts.get(userId);
		
		if (!context) return false;
		
		// Verifica timeout
		if (Date.now() - context.timestamp > this.timeoutMs) {
			this.clearContext(userId);
			return false;
		}
		
		return true;
	}

	/**
	 * Salva oferta executável para o usuário
	 * @param {string} userId - ID do usuário
	 * @param {object} offer - Oferta com ação executável
	 */
	saveExecutableOffer(userId, offer) {
		const context = {
			userId,
			type: 'executable_offer',
			offer,
			timestamp: Date.now(),
			attempts: 0
		};
		
		this.activeContexts.set(userId, context);
	}

	/**
	 * Verifica se mensagem é confirmação de oferta
	 * @param {string} message - Mensagem do usuário
	 * @returns {boolean}
	 */
	isConfirmation(message) {
		const normalized = message
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim();
		
		// Confirmações explícitas
		if (/^(sim|yes|ok|claro|confirmo|quero|show|beleza|isso|certo)$/i.test(normalized)) {
			return true;
		}
		
		// Especificações da oferta (top 3, por categoria, etc)
		if (/^(top\s*\d+|maiores?|principais?|por\s+categoria|detalhada?s?|completa?s?)$/i.test(normalized)) {
			return true;
		}
		
		return false;
	}

	/**
	 * Processa confirmação de oferta executável
	 * @param {string} userId - ID do usuário
	 * @param {string} message - Mensagem de confirmação
	 * @returns {object|null} - Ação a executar ou null
	 */
	processOfferConfirmation(userId, message) {
		const context = this.getContext(userId);
		
		if (!context || context.type !== 'executable_offer') {
			return null;
		}
		
		const normalized = message
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim();
		
		const offer = context.offer;
		
		// Detecta se é confirmação simples ou especificação
		let action = { ...offer.action };
		
		// Ajusta action baseado na confirmação
		if (/top\s*(\d+)/.test(normalized)) {
			const limit = parseInt(normalized.match(/top\s*(\d+)/)[1]);
			action.limit = limit;
		}
		
		// Limpa contexto após processar
		this.clearContext(userId);
		
		return action;
	}

	/**
	 * Obtém contexto ativo do usuário
	 * @param {string} userId - ID do usuário
	 * @returns {object|null} - Contexto ou null
	 */
	getContext(userId) {
		if (!this.hasActiveDialogue(userId)) return null;
		return this.activeContexts.get(userId);
	}

	/**
	 * Inicia novo diálogo de esclarecimento
	 * @param {string} userId - ID do usuário
	 * @param {string} originalQuery - Query original
	 * @param {string} ambiguityType - Tipo de ambiguidade
	 * @param {object} classification - Resultado da classificação
	 * @returns {object} - Resposta de esclarecimento
	 */
	startDialogue(userId, originalQuery, ambiguityType, classification = {}) {
		const template = CLARIFICATION_TEMPLATES[ambiguityType] || CLARIFICATION_TEMPLATES.PERIOD;
		
		const context = {
			userId,
			originalQuery,
			ambiguityType,
			classification,
			questionAsked: template.question,
			options: template.options,
			defaultValue: template.defaultValue,
			timestamp: Date.now(),
			attempts: 1
		};
		
		this.activeContexts.set(userId, context);
		
		logger.dialogueStarted(ambiguityType);
		
		return {
			type: 'clarification',
			question: template.question,
			options: template.options,
			context
		};
	}

	/**
	 * Processa resposta do usuário ao diálogo
	 * @param {string} userId - ID do usuário
	 * @param {string} response - Resposta do usuário
	 * @returns {object} - Resultado do processamento
	 */
	processResponse(userId, response) {
		const context = this.getContext(userId);
		
		if (!context) {
			return {
				success: false,
				error: 'NO_ACTIVE_DIALOGUE',
				message: 'Não há diálogo ativo para este usuário.'
			};
		}
		
		logger.dialogueContinued(context.attempts);
		
		// Incrementa tentativas
		context.attempts++;
		context.timestamp = Date.now();
		
		// Tenta extrair valor da resposta
		const extracted = this.extractValue(response, context.ambiguityType);
		
		if (extracted.success) {
			// Resposta válida, limpa contexto
			const result = {
				success: true,
				originalQuery: context.originalQuery,
				clarification: {
					type: context.ambiguityType,
					value: extracted.value,
					normalizedValue: extracted.normalizedValue
				},
				classification: context.classification
			};
			
			this.clearContext(userId);
			return result;
		}
		
		// Resposta não reconhecida
		if (context.attempts >= this.maxAttempts) {
			// Máximo de tentativas, usa default ou desiste
			const result = {
				success: true,
				originalQuery: context.originalQuery,
				clarification: {
					type: context.ambiguityType,
					value: context.defaultValue,
					normalizedValue: context.defaultValue,
					usedDefault: true
				},
				classification: context.classification
			};
			
			this.clearContext(userId);
			return result;
		}
		
		// Pede novamente
		this.activeContexts.set(userId, context);
		
		return {
			success: false,
			error: 'INVALID_RESPONSE',
			message: `Desculpe, não entendi. ${context.questionAsked}`,
			remainingAttempts: this.maxAttempts - context.attempts
		};
	}

	/**
	 * Extrai valor da resposta do usuário
	 * @param {string} response - Resposta do usuário
	 * @param {string} ambiguityType - Tipo de ambiguidade
	 * @returns {object} - { success, value, normalizedValue }
	 */
	extractValue(response, ambiguityType) {
		// Normaliza resposta
		const normalized = response
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim();
		
		const mapping = RESPONSE_MAPPINGS[ambiguityType];
		
		if (!mapping) {
			// Sem mapeamento, retorna valor bruto
			return {
				success: true,
				value: response,
				normalizedValue: normalized
			};
		}
		
		// Busca match no mapeamento
		for (const [pattern, value] of Object.entries(mapping)) {
			if (normalized.includes(pattern)) {
				return {
					success: true,
					value: response,
					normalizedValue: value
				};
			}
		}
		
		// Busca match parcial
		const words = normalized.split(/\s+/);
		for (const word of words) {
			if (mapping[word]) {
				return {
					success: true,
					value: response,
					normalizedValue: mapping[word]
				};
			}
		}
		
		return {
			success: false,
			value: response,
			normalizedValue: null
		};
	}

	/**
	 * Reconstrói query com esclarecimento
	 * @param {string} originalQuery - Query original
	 * @param {object} clarification - Esclarecimento obtido
	 * @returns {string} - Query reconstruída
	 */
	reconstructQuery(originalQuery, clarification) {
		const { type, normalizedValue } = clarification;
		
		switch (type) {
			case 'PERIOD':
				// Adiciona período à query
				const periodText = this.periodToText(normalizedValue);
				return `${originalQuery} ${periodText}`;
				
			case 'CATEGORY':
				// Adiciona categoria
				return `${originalQuery} em ${normalizedValue}`;
				
			case 'ACCOUNT':
				// Especifica conta
				return `${originalQuery} na conta ${normalizedValue}`;
				
			default:
				return originalQuery;
		}
	}

	/**
	 * Converte valor de período para texto legível
	 * @param {string} period - Período normalizado
	 * @returns {string} - Texto legível
	 */
	periodToText(period) {
		const map = {
			'mesAtual': 'este mês',
			'mesAnterior': 'mês passado',
			'7d': 'últimos 7 dias',
			'30d': 'últimos 30 dias',
			'3m': 'últimos 3 meses',
			'anoAtual': 'este ano',
			'anoAnterior': 'ano passado'
		};
		return map[period] || period;
	}

	/**
	 * Limpa contexto do usuário
	 * @param {string} userId - ID do usuário
	 */
	clearContext(userId) {
		this.activeContexts.delete(userId);
	}

	/**
	 * Limpa contextos expirados
	 */
	cleanupExpired() {
		const now = Date.now();
		
		for (const [userId, context] of this.activeContexts.entries()) {
			if (now - context.timestamp > this.timeoutMs) {
				this.activeContexts.delete(userId);
			}
		}
	}

	/**
	 * Retorna estatísticas
	 * @returns {object}
	 */
	getStats() {
		return {
			activeDialogues: this.activeContexts.size,
			maxAttempts: this.maxAttempts,
			timeoutMinutes: this.timeoutMs / 60000
		};
	}

	/**
	 * Destrutor
	 */
	destroy() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
		this.activeContexts.clear();
	}
}

// Instância singleton
const dialogueManager = new DialogueManager();

module.exports = {
	DialogueManager,
	dialogueManager,
	CLARIFICATION_TEMPLATES,
	RESPONSE_MAPPINGS
};
