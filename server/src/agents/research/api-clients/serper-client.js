/**
 * NOTE (serper-client.js):
 * Purpose: Cliente wrapper para API Serper (busca Google rápida e factual).
 * Controls: search(), searchNews().
 * Behavior: Implementa timeout, circuit breaker. Otimizado para buscas factuais.
 * Integration notes: Usada como fallback para Tavily e para buscas triviais.
 * Documentação: https://serper.dev/docs
 */

const CircuitBreaker = require('./circuit-breaker');

/**
 * SerperClient - Cliente para API Serper (Google Search)
 * 
 * Endpoints principais:
 * - /search - Busca web normal
 * - /news - Busca de notícias
 * - /images - Busca de imagens
 */
class SerperClient {
	/**
	 * @param {object} config - Configurações
	 * @param {string} config.apiKey - API Key (default: env SERPER_API_KEY)
	 * @param {number} config.timeout - Timeout em ms (default: 20000)
	 */
	constructor(config = {}) {
		this.apiKey = config.apiKey || process.env.SERPER_API_KEY;
		this.baseUrl = 'https://google.serper.dev';
		this.timeout = config.timeout || 20000;
		
		// Circuit Breaker
		this.breaker = new CircuitBreaker('SERPER', {
			failureThreshold: 3,
			resetTimeout: 120000 // 2 minutos
		});
	}

	/**
	 * Realiza busca web
	 * @param {string} query - Query de busca
	 * @param {object} options - Opções
	 * @param {number} options.num - Quantidade de resultados (default: 10, max: 100)
	 * @param {string} options.gl - Geolocalização (default: 'br')
	 * @param {string} options.hl - Idioma (default: 'pt')
	 * @param {string} options.timeRange - Filtro temporal: 'qdr:h', 'qdr:d', 'qdr:w', 'qdr:m', 'qdr:y'
	 * @param {string} options.type - Tipo: 'search', 'news', 'images' (default: 'search')
	 * @param {number} options.page - Página (default: 1)
	 * @returns {Promise<object>} - Resultados formatados
	 */
	async search(query, options = {}) {
		return this.breaker.execute(async () => {
			const response = await this._request('/search', {
				q: query,
				gl: options.gl || 'br',
				hl: options.hl || 'pt',
				num: options.num || 10,
				type: options.type || 'search',
				autocorrect: true,
				page: options.page || 1,
				tbs: options.timeRange || undefined
			});

			return this._formatResponse(response);
		});
	}

	/**
	 * Busca de notícias
	 * @param {string} query - Query de busca
	 * @param {object} options - Opções
	 * @param {number} options.num - Quantidade (default: 10)
	 * @param {string} options.timeRange - Filtro temporal
	 * @returns {Promise<object>}
	 */
	async searchNews(query, options = {}) {
		return this.search(query, {
			...options,
			type: 'news'
		});
	}

	/**
	 * Formata resposta do Serper para padrão interno
	 * @private
	 */
	_formatResponse(response) {
		return {
			fonte: 'SERPER',
			data: {
				knowledge_graph: response.knowledgeGraph || null,
				resultados: (response.organic || []).map(r => ({
					title: r.title,
					link: r.link,
					snippet: r.snippet,
					position: r.position,
					date: r.date
				})),
				noticias: (response.news || []).map(n => ({
					title: n.title,
					link: n.link,
					snippet: n.snippet,
					date: n.date,
					source: n.source
				})),
				people_also_ask: (response.peopleAlsoAsk || []).map(p => ({
					question: p.question,
					snippet: p.snippet,
					link: p.link
				})),
				related_searches: (response.relatedSearches || []).map(r => r.query)
			},
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Faz requisição para API Serper
	 * @private
	 */
	async _request(endpoint, payload) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				method: 'POST',
				headers: {
					'X-API-KEY': this.apiKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Serper HTTP ${response.status}: ${errorText}`);
			}

			return await response.json();

		} catch (error) {
			clearTimeout(timeoutId);
			
			if (error.name === 'AbortError') {
				throw new Error(`Serper timeout após ${this.timeout}ms`);
			}
			throw error;
		}
	}

	/**
	 * Converte janela temporal para formato Serper
	 * @param {string} window - 'day', 'week', 'month', 'year'
	 * @returns {string} - Formato tbs do Google
	 */
	static timeRangeToTbs(window) {
		const map = {
			'hour': 'qdr:h',
			'day': 'qdr:d',
			'week': 'qdr:w',
			'month': 'qdr:m',
			'year': 'qdr:y'
		};
		return map[window] || null;
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

module.exports = SerperClient;
