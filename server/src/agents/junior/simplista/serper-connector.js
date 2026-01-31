/**
 * NOTE (serper-connector.js):
 * Purpose: Acesso direto ao Serper para o Agente Simplista.
 * Design: Wrapper simplificado com cache e formatação de respostas.
 * 
 * EXCEÇÃO DO SISTEMA: O Simplista é o único agente que pode acessar
 * o Serper diretamente, sem passar pelo Research Agent.
 * 
 * FUNCIONALIDADES:
 * - Busca de cotações e indicadores
 * - Busca de informações factuais (sede, CEO, etc)
 * - Cache com TTL dinâmico
 * - Adaptação de queries para melhor resultado
 */

const SerperClient = require('../../research/api-clients/serper-client');
const { cache, TTL_CONFIG } = require('./simplista-cache');
const { logger } = require('./simplista-logger');

/**
 * Mapeamento de tipos para adaptação de query
 */
const QUERY_ADAPTATIONS = {
	COTACAO: {
		prefix: '',
		suffix: 'cotação hoje',
		numResults: 3
	},
	INDICADORES: {
		prefix: '',
		suffix: 'indicador valor atual',
		numResults: 3
	},
	MOEDA: {
		prefix: '',
		suffix: 'comercial hoje',
		numResults: 3
	},
	INDICES: {
		prefix: '',
		suffix: 'valor atual',
		numResults: 3
	},
	FATOS: {
		prefix: '',
		suffix: '',
		numResults: 5
	},
	TICKER: {
		prefix: '',
		suffix: 'cotação hoje bolsa',
		numResults: 3
	}
};

/**
 * SerperConnector - Conector com Serper para Simplista
 */
class SerperConnector {
	constructor(options = {}) {
		this.client = new SerperClient({
			timeout: options.timeout || 10000  // 10s timeout para ser rápido
		});
		this.cache = cache;
	}

	/**
	 * Executa busca no Serper com cache
	 * @param {string} query - Query do usuário
	 * @param {string} dataType - Tipo de dado (COTACAO, MOEDA, etc)
	 * @param {object} options - Opções adicionais
	 * @returns {Promise<object>} - Resultado formatado
	 */
	async query(query, dataType, options = {}) {
		try {
			// Verifica cache primeiro
			const cacheKey = this.cache.generateKey(query, dataType);
			const cached = this.cache.get(cacheKey);
			
			if (cached) {
				logger.serperQuery(dataType, true, true);
				return {
					...cached,
					fromCache: true
				};
			}
			
			// Adapta query para melhor resultado
			const adaptedQuery = this.adaptQuery(query, dataType);
			
			// Executa busca
			const config = QUERY_ADAPTATIONS[dataType] || QUERY_ADAPTATIONS.FATOS;
			
			const response = await this.client.search(adaptedQuery, {
				num: config.numResults,
				gl: 'br',
				hl: 'pt'
			});
			
			// Processa resposta
			const processed = this.processResponse(response, query, dataType);
			
			logger.serperQuery(dataType, false, processed.success);
			
			// Cacheia se sucesso
			if (processed.success) {
				this.cache.setWithType(cacheKey, processed, dataType);
			}
			
			return processed;
			
		} catch (error) {
			logger.error('SERPER_ERROR', error, { query, dataType });
			
			return {
				success: false,
				source: 'Serper',
				error: error.message,
				textual: `⚠️ Não consegui buscar informações externas no momento.`
			};
		}
	}

	/**
	 * Adapta query para melhor resultado no Serper
	 * @param {string} query - Query original
	 * @param {string} dataType - Tipo de dado
	 * @returns {string} - Query adaptada
	 */
	adaptQuery(query, dataType) {
		const config = QUERY_ADAPTATIONS[dataType] || QUERY_ADAPTATIONS.FATOS;
		
		let adapted = query;
		
		// Extrai ticker se presente
		const tickerMatch = query.match(/\b([A-Z]{4}[0-9]{1,2})\b/i);
		if (tickerMatch && dataType === 'COTACAO') {
			adapted = `${tickerMatch[1].toUpperCase()} ${config.suffix}`;
			return adapted;
		}
		
		// Extrai moeda
		if (dataType === 'MOEDA') {
			if (/\bd[óo]lar\b/i.test(query)) {
				adapted = `dólar ${config.suffix}`;
			} else if (/\beuro\b/i.test(query)) {
				adapted = `euro ${config.suffix}`;
			}
			return adapted;
		}
		
		// Extrai índice
		if (dataType === 'INDICES') {
			if (/\bselic\b/i.test(query)) adapted = `taxa SELIC ${config.suffix}`;
			else if (/\bipca\b/i.test(query)) adapted = `IPCA ${config.suffix}`;
			else if (/\bcdi\b/i.test(query)) adapted = `CDI ${config.suffix}`;
			else if (/\bibovespa\b/i.test(query)) adapted = `IBOVESPA ${config.suffix}`;
			return adapted;
		}
		
		// Adiciona sufixo para outros tipos
		if (config.suffix) {
			adapted = `${query} ${config.suffix}`;
		}
		
		return adapted;
	}

	/**
	 * Processa resposta do Serper
	 * @param {object} response - Resposta do Serper
	 * @param {string} originalQuery - Query original
	 * @param {string} dataType - Tipo de dado
	 * @returns {object} - Resposta processada
	 */
	processResponse(response, originalQuery, dataType) {
		const result = {
			success: true,
			source: 'Serper',
			fromCache: false,
			textual: '',
			structured: {
				knowledgeGraph: response.data?.knowledge_graph || null,
				results: response.data?.resultados || [],
				timestamp: response.timestamp
			}
		};
		
		// Formata baseado no tipo
		switch (dataType) {
			case 'COTACAO':
			case 'TICKER':
				result.textual = this.formatCotacao(response, originalQuery);
				break;
			case 'MOEDA':
				result.textual = this.formatMoeda(response, originalQuery);
				break;
			case 'INDICES':
				result.textual = this.formatIndice(response, originalQuery);
				break;
			case 'INDICADORES':
				result.textual = this.formatIndicadores(response, originalQuery);
				break;
			case 'FATOS':
				result.textual = this.formatFatos(response, originalQuery);
				break;
			default:
				result.textual = this.formatGeneric(response);
		}
		
		return result;
	}

	/**
	 * Formata cotação de ação
	 * @param {object} response - Resposta do Serper
	 * @param {string} query - Query original
	 * @returns {string} - Texto formatado
	 */
	formatCotacao(response, query) {
		const kg = response.data?.knowledge_graph;
		const results = response.data?.resultados || [];
		
		// Extrai ticker da query
		const tickerMatch = query.match(/\b([A-Z]{4}[0-9]{1,2})\b/i);
		const ticker = tickerMatch ? tickerMatch[1].toUpperCase() : '';
		
		// Tenta extrair valor do knowledge graph
		if (kg) {
			if (kg.title && kg.snippet) {
				return `📈 **${kg.title}**\n${kg.snippet}`;
			}
		}
		
		// Tenta extrair dos resultados
		if (results.length > 0) {
			const first = results[0];
			// Busca padrão de preço no snippet
			const priceMatch = first.snippet?.match(/R\$\s*[\d.,]+/);
			
			if (priceMatch) {
				return `📈 **${ticker || 'Cotação'}**: ${priceMatch[0]}\n📍 Fonte: ${new URL(first.link).hostname}`;
			}
			
			return `📈 **${ticker || 'Informação'}**\n${first.snippet}\n\n📍 Fonte: ${new URL(first.link).hostname}`;
		}
		
		return `📈 Não encontrei a cotação específica. Tente pesquisar diretamente em sites como B3 ou InfoMoney.`;
	}

	/**
	 * Formata cotação de moeda
	 * @param {object} response - Resposta do Serper
	 * @param {string} query - Query original
	 * @returns {string} - Texto formatado
	 */
	formatMoeda(response, query) {
		const kg = response.data?.knowledge_graph;
		const results = response.data?.resultados || [];
		
		// Detecta moeda
		let moeda = 'Câmbio';
		if (/d[óo]lar/i.test(query)) moeda = 'Dólar';
		else if (/euro/i.test(query)) moeda = 'Euro';
		
		// Tenta extrair valor
		if (results.length > 0) {
			const first = results[0];
			const priceMatch = first.snippet?.match(/R\$\s*[\d.,]+/);
			
			if (priceMatch) {
				return `💵 **${moeda} Comercial**: ${priceMatch[0]}\n📍 Fonte: ${new URL(first.link).hostname}`;
			}
			
			return `💵 **${moeda}**\n${first.snippet}\n\n📍 Fonte: ${new URL(first.link).hostname}`;
		}
		
		return `💵 Não encontrei a cotação do ${moeda}. Consulte o Banco Central para valores oficiais.`;
	}

	/**
	 * Formata índice econômico
	 * @param {object} response - Resposta do Serper
	 * @param {string} query - Query original
	 * @returns {string} - Texto formatado
	 */
	formatIndice(response, query) {
		const results = response.data?.resultados || [];
		
		// Detecta índice
		let indice = 'Índice';
		if (/selic/i.test(query)) indice = 'Taxa SELIC';
		else if (/ipca/i.test(query)) indice = 'IPCA';
		else if (/cdi/i.test(query)) indice = 'CDI';
		else if (/ibovespa/i.test(query)) indice = 'IBOVESPA';
		
		if (results.length > 0) {
			const first = results[0];
			// Busca padrão de percentual ou valor
			const valueMatch = first.snippet?.match(/[\d.,]+\s*%|R\$\s*[\d.,]+|[\d.,]+\s*pontos?/i);
			
			if (valueMatch) {
				return `📊 **${indice}**: ${valueMatch[0]}\n📍 Fonte: ${new URL(first.link).hostname}`;
			}
			
			return `📊 **${indice}**\n${first.snippet}\n\n📍 Fonte: ${new URL(first.link).hostname}`;
		}
		
		return `📊 Não encontrei o valor atual do ${indice}. Consulte o Banco Central para valores oficiais.`;
	}

	/**
	 * Formata indicadores fundamentalistas
	 * @param {object} response - Resposta do Serper
	 * @param {string} query - Query original
	 * @returns {string} - Texto formatado
	 */
	formatIndicadores(response, query) {
		const results = response.data?.resultados || [];
		
		if (results.length > 0) {
			const first = results[0];
			return `📊 **Indicadores**\n${first.snippet}\n\n📍 Fonte: ${new URL(first.link).hostname}`;
		}
		
		return `📊 Não encontrei os indicadores solicitados.`;
	}

	/**
	 * Formata fatos gerais
	 * @param {object} response - Resposta do Serper
	 * @param {string} query - Query original
	 * @returns {string} - Texto formatado
	 */
	formatFatos(response, query) {
		const kg = response.data?.knowledge_graph;
		const results = response.data?.resultados || [];
		
		// Se tem knowledge graph, usa
		if (kg && kg.snippet) {
			return `ℹ️ ${kg.snippet}\n\n📍 Fonte: Google Knowledge Graph`;
		}
		
		if (results.length > 0) {
			const first = results[0];
			return `ℹ️ ${first.snippet}\n\n📍 Fonte: ${new URL(first.link).hostname}`;
		}
		
		return `ℹ️ Não encontrei a informação solicitada.`;
	}

	/**
	 * Formata resposta genérica
	 * @param {object} response - Resposta do Serper
	 * @returns {string} - Texto formatado
	 */
	formatGeneric(response) {
		const results = response.data?.resultados || [];
		
		if (results.length > 0) {
			let text = `🔍 **Resultados encontrados:**\n`;
			results.slice(0, 3).forEach((r, i) => {
				text += `${i + 1}. ${r.title}\n   ${r.snippet?.substring(0, 100)}...\n`;
			});
			return text;
		}
		
		return `🔍 Nenhum resultado encontrado.`;
	}

	/**
	 * Combina dados internos com externos
	 * @param {object} internalData - Dados do FinanceBridge
	 * @param {object} externalData - Dados do Serper
	 * @param {string} query - Query original
	 * @returns {object} - Dados enriquecidos
	 */
	enrichWithExternalData(internalData, externalData, query) {
		const enriched = {
			success: true,
			source: 'Combined',
			internal: internalData,
			external: externalData,
			textual: ''
		};
		
		// Combina textos de forma inteligente
		let text = '';
		
		// Dados externos primeiro (se são o foco da query)
		if (externalData?.success && externalData.textual) {
			text += externalData.textual + '\n\n';
		}
		
		// Dados internos
		if (internalData?.success && internalData.textual) {
			text += internalData.textual + '\n\n';
		}
		
		// Insight de combinação (se tiver moeda + saldo)
		if (this.canCalculateConversion(internalData, externalData)) {
			const insight = this.calculateConversion(internalData, externalData);
			if (insight) {
				text += `\n📊 ${insight}`;
			}
		}
		
		enriched.textual = text.trim();
		return enriched;
	}

	/**
	 * Verifica se pode calcular conversão
	 * @param {object} internal - Dados internos
	 * @param {object} external - Dados externos
	 * @returns {boolean}
	 */
	canCalculateConversion(internal, external) {
		// Tem saldo e cotação de moeda
		const hasSaldo = internal?.structured?.summary?.balance !== undefined ||
			internal?.structured?.summary?.totalIncome !== undefined;
		const hasCotacao = external?.textual?.includes('R$');
		
		return hasSaldo && hasCotacao;
	}

	/**
	 * Calcula conversão simples
	 * @param {object} internal - Dados internos
	 * @param {object} external - Dados externos
	 * @returns {string|null} - Insight de conversão
	 */
	calculateConversion(internal, external) {
		try {
			// Extrai saldo
			const summary = internal?.structured?.summary;
			const saldo = summary?.balance || 
				((summary?.totalIncome || 0) - (summary?.totalExpense || 0));
			
			if (!saldo || saldo <= 0) return null;
			
			// Extrai cotação do texto externo
			const cotacaoMatch = external.textual.match(/R\$\s*([\d.,]+)/);
			if (!cotacaoMatch) return null;
			
			const cotacao = parseFloat(cotacaoMatch[1].replace('.', '').replace(',', '.'));
			if (!cotacao || isNaN(cotacao)) return null;
			
			// Calcula conversão
			const converted = Math.floor(saldo / cotacao);
			
			// Detecta moeda
			let moeda = 'unidades';
			if (/d[óo]lar/i.test(external.textual)) moeda = 'dólares';
			else if (/euro/i.test(external.textual)) moeda = 'euros';
			
			return `Com seu saldo atual, você pode adquirir aproximadamente **${converted.toLocaleString('pt-BR')} ${moeda}**.`;
			
		} catch (error) {
			return null;
		}
	}

	/**
	 * Retorna estatísticas do cache
	 * @returns {object} - Estatísticas
	 */
	getCacheStats() {
		return this.cache.getStats();
	}

	/**
	 * Limpa cache do Serper
	 */
	clearCache() {
		this.cache.clear();
	}
}

// Instância singleton
const serperConnector = new SerperConnector();

module.exports = {
	SerperConnector,
	serperConnector,
	QUERY_ADAPTATIONS
};
