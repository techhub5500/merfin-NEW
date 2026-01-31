/**
 * NOTE (tavily-client.js):
 * Purpose: Cliente wrapper para API Tavily (pesquisa qualitativa com IA).
 * Controls: search(), extract().
 * Behavior: Implementa timeout, circuit breaker. Usa topic='finance' por padrão.
 * Integration notes: Fonte primária para contexto qualitativo (notícias, análises, causas).
 * Documentação: https://docs.tavily.com/
 */

const CircuitBreaker = require('./circuit-breaker');

/**
 * TavilyClient - Cliente para API Tavily
 * 
 * Endpoints principais:
 * - /search - Busca com análise de relevância e resposta LLM
 * - /extract - Extração de conteúdo de URLs
 */
class TavilyClient {
	/**
	 * @param {object} config - Configurações
	 * @param {string} config.apiKey - API Key (default: env TAVILY_API_KEY)
	 * @param {number} config.timeout - Timeout em ms (default: 20000)
	 */
	constructor(config = {}) {
		this.apiKey = config.apiKey || process.env.TAVILY_API_KEY;
		this.timeout = config.timeout || 20000;
		
		// Circuit Breaker
		this.breaker = new CircuitBreaker('TAVILY', {
			failureThreshold: 3,
			resetTimeout: 120000 // 2 minutos
		});

		// SDK Tavily (lazy loading)
		this._client = null;
	}

	/**
	 * Inicializa cliente Tavily
	 * @private
	 */
	_getClient() {
		if (!this._client) {
			try {
				const { tavily } = require('@tavily/core');
				this._client = tavily({ apiKey: this.apiKey });
				console.log('[TavilyClient] Cliente inicializado');
			} catch (error) {
				console.warn('[TavilyClient] SDK não disponível:', error.message);
				this._client = null;
			}
		}
		return this._client;
	}

	/**
	 * Realiza busca com análise de relevância
	 * @param {string} query - Query de busca
	 * @param {object} options - Opções
	 * @param {string} options.topic - Tópico: 'general', 'news', 'finance' (default: 'finance')
	 * @param {string} options.depth - Profundidade: 'basic' (1 crédito), 'advanced' (2 créditos)
	 * @param {number} options.maxResults - Máximo de resultados (default: 5, max: 20)
	 * @param {boolean} options.includeAnswer - Incluir resposta LLM (default: true)
	 * @param {string} options.timeRange - Filtro temporal: 'day', 'week', 'month', 'year'
	 * @param {string} options.country - País para priorização (default: 'brazil')
	 * @returns {Promise<object>} - Resultados formatados
	 */
	async search(query, options = {}) {
		return this.breaker.execute(async () => {
			const client = this._getClient();
			
			if (!client) {
				// Fallback para HTTP direto se SDK não disponível
				return this._httpSearch(query, options);
			}

			const searchOptions = {
				topic: options.topic || 'finance',
				search_depth: options.depth || 'advanced',
				max_results: options.maxResults || 5,
				include_answer: options.includeAnswer !== false,
				time_range: options.timeRange || 'week'
			};

			// Adiciona country apenas se especificado (não é padrão na API)
			if (options.country) {
				searchOptions.country = options.country;
			}

			const response = await this._executeWithTimeout(
				client.search(query, searchOptions),
				this.timeout
			);

			return this._formatResponse(response);
		});
	}

	/**
	 * Extrai conteúdo de URLs
	 * @param {string[]} urls - Lista de URLs para extrair
	 * @param {object} options - Opções
	 * @param {string} options.depth - Profundidade: 'basic', 'advanced'
	 * @param {string} options.format - Formato: 'text', 'markdown' (default: 'markdown')
	 * @returns {Promise<object>}
	 */
	async extract(urls, options = {}) {
		return this.breaker.execute(async () => {
			const client = this._getClient();
			
			if (!client) {
				throw new Error('Tavily SDK não disponível para extract');
			}

			const response = await this._executeWithTimeout(
				client.extract({
					urls,
					extract_depth: options.depth || 'advanced',
					format: options.format || 'markdown'
				}),
				this.timeout
			);

			return {
				fonte: 'TAVILY_EXTRACT',
				data: response,
				timestamp: new Date().toISOString()
			};
		});
	}

	/**
	 * Formata resposta do Tavily para padrão interno
	 * @private
	 */
	_formatResponse(response) {
		return {
			fonte: 'TAVILY',
			data: {
				resposta_ia: response.answer || null,
				resultados: (response.results || []).map(r => ({
					titulo: r.title,
					url: r.url,
					conteudo: r.content,
					score: r.score,
					data_publicacao: r.published_date
				})),
				tempo_resposta: response.response_time
			},
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Fallback HTTP se SDK não disponível
	 * @private
	 */
	async _httpSearch(query, options = {}) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch('https://api.tavily.com/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					api_key: this.apiKey,
					query,
					topic: options.topic || 'finance',
					search_depth: options.depth || 'advanced',
					max_results: options.maxResults || 5,
					include_answer: options.includeAnswer !== false,
					time_range: options.timeRange || 'week'
				}),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Tavily HTTP ${response.status}: ${errorText}`);
			}

			const data = await response.json();
			return this._formatResponse(data);

		} catch (error) {
			clearTimeout(timeoutId);
			
			if (error.name === 'AbortError') {
				throw new Error(`Tavily timeout após ${this.timeout}ms`);
			}
			throw error;
		}
	}

	/**
	 * Executa promise com timeout
	 * @private
	 */
	async _executeWithTimeout(promise, timeoutMs) {
		return Promise.race([
			promise,
			new Promise((_, reject) => 
				setTimeout(() => reject(new Error(`Timeout após ${timeoutMs}ms`)), timeoutMs)
			)
		]);
	}

	/**
	 * Retorna estado do circuit breaker
	 */
	getCircuitState() {
		return this.breaker.getState();
	}

	/**
	 * Verifica se serviço está disponível
	 */
	isAvailable() {
		return this.breaker.isAvailable();
	}
}

module.exports = TavilyClient;
