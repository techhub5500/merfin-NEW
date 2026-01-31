/**
 * NOTE (brapi-client.js):
 * Purpose: Cliente wrapper para API Brapi (dados estruturados do mercado financeiro BR).
 * Controls: getQuote(), getCrypto(), getCurrency(), getInflation(), getPrimeRate().
 * Behavior: Implementa timeout, retry com backoff e circuit breaker.
 * Integration notes: Fonte primária para dados numéricos (preços, fundamentalistas, dividendos).
 * Documentação: https://brapi.dev/docs
 */

const CircuitBreaker = require('./circuit-breaker');

/**
 * BrapiClient - Cliente para API Brapi
 * 
 * Endpoints principais:
 * - /quote/{tickers} - Cotações de ações/FIIs
 * - /crypto - Criptomoedas
 * - /currency - Câmbio
 * - /inflation - IPCA, IGP-M
 * - /prime-rate - SELIC
 */
class BrapiClient {
	/**
	 * @param {object} config - Configurações
	 * @param {string} config.apiKey - API Key (default: env BRAPI_API_KEY)
	 * @param {number} config.timeout - Timeout em ms (default: 20000)
	 */
	constructor(config = {}) {
		this.apiKey = config.apiKey || process.env.BRAPI_API_KEY;
		this.baseUrl = 'https://brapi.dev/api';
		this.timeout = config.timeout || 20000;
		
		// Circuit Breaker
		this.breaker = new CircuitBreaker('BRAPI', {
			failureThreshold: 3,
			resetTimeout: 120000 // 2 minutos
		});

		// Verifica se SDK está disponível
		this._sdkClient = null;
		this._initSDK();
	}

	/**
	 * Tenta inicializar SDK oficial
	 * @private
	 */
	_initSDK() {
		try {
			const Brapi = require('brapi');
			this._sdkClient = new Brapi({ apiKey: this.apiKey });
			console.log('[BrapiClient] SDK oficial inicializado');
		} catch (error) {
			console.log('[BrapiClient] SDK não disponível, usando HTTP direto');
			this._sdkClient = null;
		}
	}

	/**
	 * Busca cotações de ações/FIIs
	 * @param {string|string[]} tickers - Ticker(s) para buscar
	 * @param {object} options - Opções da busca
	 * @param {string} options.range - Período histórico (1d, 5d, 1mo, 3mo, 6mo, 1y, etc)
	 * @param {string} options.interval - Intervalo (1d, 1wk, 1mo)
	 * @param {boolean} options.fundamental - Incluir dados fundamentalistas
	 * @param {boolean} options.dividends - Incluir dividendos
	 * @returns {Promise<object>} - Dados formatados
	 */
	async getQuote(tickers, options = {}) {
		const tickersStr = Array.isArray(tickers) ? tickers.join(',') : tickers;

		return this.breaker.execute(async () => {
			let response;

			// Tenta usar SDK primeiro
			if (this._sdkClient) {
				response = await this._executeWithTimeout(
					this._sdkClient.quote.retrieve(tickersStr, {
						range: options.range || '1d',
						interval: options.interval || '1d',
						fundamental: options.fundamental || false,
						dividends: options.dividends || false
					}),
					this.timeout
				);
			} else {
				// Fallback para HTTP direto
				response = await this._httpRequest(`/quote/${tickersStr}`, {
					range: options.range,
					interval: options.interval,
					fundamental: options.fundamental,
					dividends: options.dividends
				});
			}

			return {
				fonte: 'BRAPI',
				data: response.results || response,
				timestamp: new Date().toISOString()
			};
		});
	}

	/**
	 * Busca cotação de criptomoeda
	 * @param {string} coin - Símbolo (ex: BTC, ETH)
	 * @returns {Promise<object>}
	 */
	async getCrypto(coin) {
		return this.breaker.execute(async () => {
			const response = await this._httpRequest('/v2/crypto', { coin });
			
			return {
				fonte: 'BRAPI',
				data: response,
				timestamp: new Date().toISOString()
			};
		});
	}

	/**
	 * Busca cotação de moeda
	 * @param {string} currency - Par (ex: USD-BRL, EUR-BRL)
	 * @returns {Promise<object>}
	 */
	async getCurrency(currency) {
		return this.breaker.execute(async () => {
			const response = await this._httpRequest('/v2/currency', { currency });
			
			return {
				fonte: 'BRAPI',
				data: response,
				timestamp: new Date().toISOString()
			};
		});
	}

	/**
	 * Busca dados de inflação (IPCA, IGP-M)
	 * @returns {Promise<object>}
	 */
	async getInflation() {
		return this.breaker.execute(async () => {
			const response = await this._httpRequest('/v2/inflation', {
				country: 'brazil',
				sortBy: 'date'
			});
			
			return {
				fonte: 'BRAPI',
				data: response,
				timestamp: new Date().toISOString()
			};
		});
	}

	/**
	 * Busca taxa SELIC
	 * @returns {Promise<object>}
	 */
	async getPrimeRate() {
		return this.breaker.execute(async () => {
			const response = await this._httpRequest('/v2/prime-rate', {
				country: 'brazil',
				sortBy: 'date'
			});
			
			return {
				fonte: 'BRAPI',
				data: response,
				timestamp: new Date().toISOString()
			};
		});
	}

	/**
	 * Faz requisição HTTP com timeout
	 * @private
	 */
	async _httpRequest(endpoint, params = {}) {
		const url = new URL(`${this.baseUrl}${endpoint}`);
		
		// Adiciona parâmetros
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				url.searchParams.append(key, value);
			}
		});

		const headers = {
			'Content-Type': 'application/json'
		};

		// Adiciona autenticação se tiver API key
		if (this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(url.toString(), {
				method: 'GET',
				headers,
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Brapi HTTP ${response.status}: ${errorText}`);
			}

			return await response.json();

		} catch (error) {
			clearTimeout(timeoutId);
			
			if (error.name === 'AbortError') {
				throw new Error(`Brapi timeout após ${this.timeout}ms`);
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

module.exports = BrapiClient;
