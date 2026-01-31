/**
 * NOTE (response-builder.js):
 * Purpose: Constrói respostas enriquecidas com ofertas de aprofundamento.
 * Design: Detecta oportunidades de follow-up e formata resposta final.
 * 
 * CARACTERÍSTICAS:
 * - Respostas concisas mas completas
 * - Ofertas de aprofundamento contextuais
 * - Sugestões inteligentes baseadas nos dados
 * - Formatação consistente
 */

const { logger } = require('./simplista-logger');

/**
 * Templates de ofertas de aprofundamento por tipo
 */
const DEEPENING_TEMPLATES = {
	// Para resumos financeiros
	SUMMARY: [
		'Quer ver as maiores despesas por categoria?',
		'Posso detalhar alguma categoria específica?',
		'Quer comparar com o mês anterior?'
	],
	
	// Para consultas de saldo
	BALANCE: [
		'Quer ver a evolução do saldo nos últimos meses?',
		'Posso mostrar as entradas e saídas deste período?'
	],
	
	// Para despesas
	EXPENSE: [
		'Quer ver o histórico dessa categoria?',
		'Posso comparar com meses anteriores?',
		'Quer uma análise de tendência?'
	],
	
	// Para cotações/externos
	EXTERNAL: [
		'Quer mais detalhes sobre esse assunto?',
		'Posso buscar informações relacionadas?'
	],
	
	// Para transações
	TRANSACTION: [
		'Quer ver mais transações deste período?',
		'Posso filtrar por categoria?'
	]
};

/**
 * Detectores de contexto para sugestões
 */
const CONTEXT_DETECTORS = {
	// Detecta se há despesas altas
	hasHighExpenses: (data) => {
		if (!data.expenses || !Array.isArray(data.expenses)) return false;
		const total = data.expenses.reduce((sum, e) => sum + (e.valor || 0), 0);
		return total > 1000;
	},
	
	// Detecta tendência negativa
	hasNegativeTrend: (data) => {
		if (!data.comparison) return false;
		return data.comparison.variation < -10;
	},
	
	// Detecta poucas transações
	hasFewTransactions: (data) => {
		if (!data.transactions) return false;
		return data.transactions.length < 5;
	},
	
	// Detecta dados externos disponíveis
	hasExternalData: (data) => {
		return data.external && Object.keys(data.external).length > 0;
	}
};

/**
 * ResponseBuilder - Construtor de respostas enriquecidas
 */
class ResponseBuilder {
	constructor(options = {}) {
		this.verbosityLevel = options.verbosityLevel || 'low';
		this.includeEmojis = options.includeEmojis !== false;
	}

	/**
	 * Constrói resposta completa
	 * @param {object} params - Parâmetros
	 * @param {string} params.type - Tipo de consulta
	 * @param {object} params.data - Dados obtidos
	 * @param {object} params.classification - Classificação original
	 * @param {string} params.originalQuery - Query original
	 * @param {number} params.executionTime - Tempo de execução
	 * @returns {object} - Resposta formatada
	 */
	build({ type, data, classification, originalQuery, executionTime }) {
		const startTime = Date.now();
		
		try {
			// Formata resposta principal
			const mainResponse = this.formatMainResponse(type, data);
			
			// Gera ofertas de aprofundamento
			const deepening = this.generateDeepening(type, data, classification);
			
			// Combina resposta
			const fullResponse = this.combineResponse(mainResponse, deepening);
			
			// Monta metadados
			const metadata = this.buildMetadata({
				type,
				data,
				classification,
				executionTime,
				deepening
			});
			
			logger.responseBuilt(type, !!deepening.offer);
			
			return {
				resposta: fullResponse,
				metadata
			};
			
		} catch (error) {
			logger.error('response_builder', error);
			
			return {
				resposta: 'Desculpe, tive um problema ao formatar a resposta. Pode tentar novamente?',
				metadata: {
					erro: true,
					tempoExecucao: Date.now() - startTime
				}
			};
		}
	}

	/**
	 * Formata resposta principal baseada no tipo
	 * @param {string} type - Tipo de consulta
	 * @param {object} data - Dados
	 * @returns {string} - Resposta formatada
	 */
	formatMainResponse(type, data) {
		// Se já tem resposta formatada do bridge/serper
		if (data.formattedResponse) {
			return data.formattedResponse;
		}
		
		// Se tem mensagem de fallback
		if (data.fallbackMessage) {
			return data.fallbackMessage;
		}
		
		// Formata baseado no tipo
		switch (type) {
			case 'BALANCE':
				return this.formatBalanceResponse(data);
				
			case 'SUMMARY':
				return this.formatSummaryResponse(data);
				
			case 'EXPENSES':
				return this.formatExpensesResponse(data);
				
			case 'TRANSACTIONS':
				return this.formatTransactionsResponse(data);
				
			case 'EXTERNAL':
				return this.formatExternalResponse(data);
				
			case 'HYBRID':
				return this.formatHybridResponse(data);
				
			default:
				return this.formatGenericResponse(data);
		}
	}

	/**
	 * Formata resposta de saldo
	 */
	formatBalanceResponse(data) {
		if (!data.balance && !data.saldo) {
			return 'Não encontrei informações de saldo para o período solicitado.';
		}
		
		const saldo = data.balance || data.saldo;
		const emoji = this.includeEmojis ? '💰 ' : '';
		
		if (typeof saldo === 'number') {
			return `${emoji}Seu saldo atual é **R$ ${this.formatCurrency(saldo)}**.`;
		}
		
		// Saldo por conta
		if (saldo.total !== undefined) {
			let response = `${emoji}Aqui está seu saldo:\n`;
			
			if (saldo.corrente !== undefined) {
				response += `- Conta Corrente: R$ ${this.formatCurrency(saldo.corrente)}\n`;
			}
			if (saldo.poupanca !== undefined) {
				response += `- Poupança: R$ ${this.formatCurrency(saldo.poupanca)}\n`;
			}
			if (saldo.investimentos !== undefined) {
				response += `- Investimentos: R$ ${this.formatCurrency(saldo.investimentos)}\n`;
			}
			response += `\n**Total: R$ ${this.formatCurrency(saldo.total)}**`;
			
			return response;
		}
		
		return `${emoji}Seu saldo é **R$ ${this.formatCurrency(saldo)}**.`;
	}

	/**
	 * Formata resposta de resumo
	 */
	formatSummaryResponse(data) {
		if (!data.summary && !data.resumo) {
			return 'Não encontrei dados suficientes para gerar o resumo.';
		}
		
		const resumo = data.summary || data.resumo;
		const emoji = this.includeEmojis ? '📊 ' : '';
		
		let response = `${emoji}**Resumo do período:**\n\n`;
		
		if (resumo.entradas !== undefined) {
			response += `✅ Entradas: R$ ${this.formatCurrency(resumo.entradas)}\n`;
		}
		if (resumo.saidas !== undefined) {
			response += `❌ Saídas: R$ ${this.formatCurrency(resumo.saidas)}\n`;
		}
		if (resumo.saldo !== undefined) {
			response += `\n💰 **Saldo: R$ ${this.formatCurrency(resumo.saldo)}**`;
		}
		
		return response;
	}

	/**
	 * Formata resposta de despesas
	 */
	formatExpensesResponse(data) {
		if (!data.expenses && !data.despesas) {
			return 'Não encontrei despesas para o período solicitado.';
		}
		
		const despesas = data.expenses || data.despesas;
		const emoji = this.includeEmojis ? '💸 ' : '';
		
		if (!Array.isArray(despesas) || despesas.length === 0) {
			return 'Não há despesas registradas neste período.';
		}
		
		let response = `${emoji}**Despesas encontradas:**\n\n`;
		
		// Limita a 5 itens para resposta concisa
		const items = despesas.slice(0, 5);
		
		for (const item of items) {
			const categoria = item.categoria || item.category || 'Outros';
			const valor = item.valor || item.amount || 0;
			response += `- ${categoria}: R$ ${this.formatCurrency(valor)}\n`;
		}
		
		if (despesas.length > 5) {
			response += `\n_...e mais ${despesas.length - 5} itens._`;
		}
		
		return response;
	}

	/**
	 * Formata resposta de transações
	 */
	formatTransactionsResponse(data) {
		if (!data.transactions && !data.transacoes) {
			return 'Não encontrei transações para o período solicitado.';
		}
		
		const transacoes = data.transactions || data.transacoes;
		const emoji = this.includeEmojis ? '📝 ' : '';
		
		if (!Array.isArray(transacoes) || transacoes.length === 0) {
			return 'Não há transações registradas neste período.';
		}
		
		let response = `${emoji}**Últimas transações:**\n\n`;
		
		// Limita a 5 itens
		const items = transacoes.slice(0, 5);
		
		for (const item of items) {
			const desc = item.descricao || item.description || 'Transação';
			const valor = item.valor || item.amount || 0;
			const tipo = valor >= 0 ? '↗️' : '↘️';
			response += `${tipo} ${desc}: R$ ${this.formatCurrency(Math.abs(valor))}\n`;
		}
		
		if (transacoes.length > 5) {
			response += `\n_Total de ${transacoes.length} transações no período._`;
		}
		
		return response;
	}

	/**
	 * Formata resposta de dados externos
	 */
	formatExternalResponse(data) {
		if (!data.external && !data.externo) {
			return 'Não consegui obter informações externas no momento.';
		}
		
		const externo = data.external || data.externo;
		
		// Se já veio formatado
		if (typeof externo === 'string') {
			return externo;
		}
		
		// Formata dados externos
		const emoji = this.includeEmojis ? '🌐 ' : '';
		let response = `${emoji}`;
		
		if (externo.cotacao) {
			response += externo.cotacao;
		} else if (externo.info) {
			response += externo.info;
		} else {
			response += JSON.stringify(externo);
		}
		
		return response;
	}

	/**
	 * Formata resposta híbrida (interno + externo)
	 */
	formatHybridResponse(data) {
		let response = '';
		
		// Dados internos primeiro
		if (data.internal) {
			response += this.formatMainResponse(data.internal.type, data.internal);
			response += '\n\n';
		}
		
		// Depois externos
		if (data.external) {
			response += '---\n';
			response += this.formatExternalResponse(data);
		}
		
		return response.trim();
	}

	/**
	 * Formata resposta genérica
	 */
	formatGenericResponse(data) {
		if (data.message) {
			return data.message;
		}
		
		if (data.resposta) {
			return data.resposta;
		}
		
		return 'Aqui estão as informações solicitadas.';
	}

	/**
	 * Gera ofertas de aprofundamento
	 * @param {string} type - Tipo de consulta
	 * @param {object} data - Dados
	 * @param {object} classification - Classificação
	 * @returns {object} - Oferta de aprofundamento
	 */
	generateDeepening(type, data, classification) {
		// Não oferece aprofundamento se houve erro
		if (data.error || data.erro) {
			return { offer: null };
		}
		
		// Cria oferta executável baseada no tipo
		let offerText = null;
		let action = null;
		
		switch (type) {
			case 'SALDO':
			case 'GASTOS':
			case 'RECEITAS':
				// Oferece breakdown por categoria
				offerText = 'Quer ver as maiores despesas por categoria?';
				action = {
					type: 'ranking',
					domain: 'transactions',
					rankingType: 'byCategory',
					limit: 5
				};
				break;
				
			case 'EXTRATO':
			case 'TRANSACOES':
				// Oferece filtro por categoria
				offerText = 'Posso filtrar por categoria específica?';
				action = {
					type: 'filter',
					domain: 'transactions',
					filterType: 'category'
				};
				break;
				
			default:
				// Análise contextual para outros casos
				if (CONTEXT_DETECTORS.hasHighExpenses(data)) {
					offerText = 'Notei despesas altas. Quer ver por categoria?';
					action = {
						type: 'ranking',
						domain: 'transactions',
						rankingType: 'byCategory',
						limit: 5
					};
				}
				break;
		}
		
		if (!offerText) {
			return { offer: null };
		}
		
		return {
			offer: offerText,
			action,
			type,
			executable: true
		};
	}

	/**
	 * Combina resposta principal com oferta
	 * @param {string} mainResponse - Resposta principal
	 * @param {object} deepening - Oferta de aprofundamento
	 * @returns {string} - Resposta combinada
	 */
	combineResponse(mainResponse, deepening) {
		if (!deepening.offer) {
			return mainResponse;
		}
		
		return `${mainResponse}\n\n💡 _${deepening.offer}_`;
	}

	/**
	 * Monta metadados da resposta
	 */
	buildMetadata({ type, data, classification, executionTime, deepening }) {
		const sources = [];
		
		if (data.internal || classification?.sources?.includes('INTERNAL')) {
			sources.push('FinanceDataBridge');
		}
		if (data.external || classification?.sources?.includes('EXTERNAL')) {
			sources.push('Serper');
		}
		
		return {
			tempoExecucao: executionTime,
			tipo: type,
			fontesConsultadas: sources,
			ofereceuAprofundamento: !!deepening.offer,
			aprofundamentoContextual: deepening.contextBased || false,
			deepening: deepening.offer ? deepening : null, // Inclui deepening completo para salvar oferta
			transitionFlag: null
		};
	}

	/**
	 * Formata valor monetário
	 * @param {number} value - Valor
	 * @returns {string} - Valor formatado
	 */
	formatCurrency(value) {
		if (typeof value !== 'number' || isNaN(value)) {
			return '0,00';
		}
		
		return value.toLocaleString('pt-BR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	/**
	 * Cria resposta de erro amigável
	 * @param {string} context - Contexto do erro
	 * @param {Error} error - Erro
	 * @returns {object} - Resposta de erro
	 */
	buildErrorResponse(context, error) {
		logger.error(context, error);
		
		const messages = {
			'classification': 'Não consegui entender sua pergunta. Pode reformular?',
			'bridge': 'Tive um problema ao acessar seus dados financeiros. Tente novamente.',
			'serper': 'Não consegui buscar informações externas. Quer tentar outra pergunta?',
			'timeout': 'A consulta demorou mais que o esperado. Pode tentar novamente?',
			'default': 'Ocorreu um erro inesperado. Por favor, tente novamente.'
		};
		
		return {
			resposta: messages[context] || messages.default,
			metadata: {
				erro: true,
				contextoErro: context,
				tempoExecucao: 0,
				fontesConsultadas: [],
				ofereceuAprofundamento: false
			}
		};
	}

	/**
	 * Cria resposta para transição a outro agente
	 * @param {string} targetAgent - Agente de destino
	 * @param {string} reason - Razão da transição
	 * @returns {object} - Resposta com flag de transição
	 */
	buildTransitionResponse(targetAgent, reason) {
		const messages = {
			'COMPLEXA': 'Essa pergunta precisa de uma análise mais detalhada. Vou direcionar para o analista.',
			'LANCAMENTO': 'Para registrar transações, vou direcionar para o módulo de lançamentos.'
		};
		
		return {
			resposta: messages[targetAgent] || 'Vou direcionar sua pergunta para o especialista adequado.',
			metadata: {
				transitionFlag: targetAgent,
				razaoTransicao: reason,
				tempoExecucao: 0,
				fontesConsultadas: [],
				ofereceuAprofundamento: false
			}
		};
	}
}

// Instância singleton
const responseBuilder = new ResponseBuilder();

module.exports = {
	ResponseBuilder,
	responseBuilder,
	DEEPENING_TEMPLATES,
	CONTEXT_DETECTORS
};
