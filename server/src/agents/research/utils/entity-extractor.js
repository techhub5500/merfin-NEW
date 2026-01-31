/**
 * NOTE (entity-extractor.js):
 * Purpose: Extração de entidades financeiras (tickers, moedas, índices) via regex.
 * Permite identificar automaticamente ativos mencionados em texto livre.
 * Controls: extractAll() retorna {tickers, moedas, indices}.
 * Behavior: Usa regex específicos para padrões brasileiros (ex: PETR4, TAEE11).
 * Integration notes: Usado por RequestAnalyzer na fase de pattern matching.
 */

/**
 * EntityExtractor - Extrator de Entidades Financeiras
 * 
 * Identifica automaticamente:
 * - Tickers brasileiros (PETR4, VALE3, TAEE11)
 * - Pares de moeda (USD/BRL, EUR/BRL)
 * - Índices e indicadores (IBOVESPA, SELIC, IPCA)
 */
class EntityExtractor {
	constructor() {
		// Índices e indicadores conhecidos
		this.KNOWN_INDICES = [
			'IBOVESPA', 'IBOV', 'IFIX', 'IDIV', 'SMLL', 'BDRX',
			'SELIC', 'IPCA', 'IGP-M', 'IGPM', 'CDI', 'TR',
			'PIB', 'INPC', 'IPC'
		];

		// Pares de moeda comuns
		this.CURRENCY_PAIRS = [
			'USD/BRL', 'EUR/BRL', 'GBP/BRL', 'JPY/BRL',
			'BTC/BRL', 'ETH/BRL', 'BTC/USD', 'ETH/USD'
		];

		// Criptomoedas conhecidas
		this.KNOWN_CRYPTOS = [
			'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT',
			'AVAX', 'MATIC', 'LINK', 'UNI'
		];
	}

	/**
	 * Extrai todas as entidades de um texto
	 * @param {string} text - Texto para analisar
	 * @returns {object} - {tickers, moedas, indices, cryptos}
	 */
	extractAll(text) {
		if (!text || typeof text !== 'string') {
			return { tickers: [], moedas: [], indices: [], cryptos: [] };
		}

		const textUpper = text.toUpperCase();

		return {
			tickers: this.extractTickers(textUpper),
			moedas: this.extractCurrencies(textUpper),
			indices: this.extractIndices(textUpper),
			cryptos: this.extractCryptos(textUpper)
		};
	}

	/**
	 * Extrai tickers de ações/FIIs brasileiros
	 * Padrão: 4 letras maiúsculas + 1-2 dígitos
	 * Exemplos: PETR4, VALE3, TAEE11, MXRF11
	 * @param {string} text - Texto em maiúsculas
	 * @returns {string[]} - Lista de tickers únicos
	 */
	extractTickers(text) {
		// Regex para tickers brasileiros:
		// - 4 letras maiúsculas
		// - 1 ou 2 dígitos
		// - Opcionalmente seguido de F (fracionário)
		const tickerRegex = /\b([A-Z]{4})(\d{1,2})(F)?\b/g;
		
		const matches = [];
		let match;
		
		while ((match = tickerRegex.exec(text)) !== null) {
			const ticker = match[1] + match[2] + (match[3] || '');
			
			// Valida que não é um índice conhecido
			if (!this.KNOWN_INDICES.includes(ticker)) {
				matches.push(ticker);
			}
		}

		// Remove duplicatas
		return [...new Set(matches)];
	}

	/**
	 * Extrai pares de moeda
	 * Padrão: XXX/YYY (3 letras / 3 letras)
	 * @param {string} text - Texto em maiúsculas
	 * @returns {string[]} - Lista de pares de moeda
	 */
	extractCurrencies(text) {
		// Regex para pares de moeda
		const currencyRegex = /\b([A-Z]{3})\/([A-Z]{3})\b/g;
		
		const matches = [];
		let match;
		
		while ((match = currencyRegex.exec(text)) !== null) {
			matches.push(match[0]);
		}

		// Também detecta menções textuais
		const textMentions = [];
		if (/\bD[ÓO]LAR\b/i.test(text)) textMentions.push('USD/BRL');
		if (/\bEURO\b/i.test(text)) textMentions.push('EUR/BRL');
		if (/\bLIBRA\b/i.test(text)) textMentions.push('GBP/BRL');

		return [...new Set([...matches, ...textMentions])];
	}

	/**
	 * Extrai índices e indicadores econômicos
	 * @param {string} text - Texto em maiúsculas
	 * @returns {string[]} - Lista de índices
	 */
	extractIndices(text) {
		const found = [];
		
		for (const index of this.KNOWN_INDICES) {
			// Usa word boundary para match exato
			const regex = new RegExp(`\\b${index}\\b`, 'i');
			if (regex.test(text)) {
				found.push(index);
			}
		}

		return found;
	}

	/**
	 * Extrai criptomoedas
	 * @param {string} text - Texto em maiúsculas
	 * @returns {string[]} - Lista de criptos
	 */
	extractCryptos(text) {
		const found = [];
		
		for (const crypto of this.KNOWN_CRYPTOS) {
			const regex = new RegExp(`\\b${crypto}\\b`, 'i');
			if (regex.test(text)) {
				found.push(crypto);
			}
		}

		// Também detecta menções textuais
		if (/\bBITCOIN\b/i.test(text) && !found.includes('BTC')) {
			found.push('BTC');
		}
		if (/\bETHEREUM\b/i.test(text) && !found.includes('ETH')) {
			found.push('ETH');
		}

		return found;
	}

	/**
	 * Valida se um ticker tem formato válido
	 * @param {string} ticker - Ticker a validar
	 * @returns {boolean} - Se é válido
	 */
	isValidTicker(ticker) {
		if (!ticker || typeof ticker !== 'string') return false;
		
		// Padrão: 4 letras + 1-2 dígitos + F opcional
		const regex = /^[A-Z]{4}\d{1,2}F?$/;
		return regex.test(ticker.toUpperCase());
	}

	/**
	 * Determina tipo de ativo pelo ticker
	 * @param {string} ticker - Ticker
	 * @returns {string} - Tipo: 'acao', 'fii', 'bdr', 'etf', 'unit', 'desconhecido'
	 */
	getAssetType(ticker) {
		if (!ticker) return 'desconhecido';
		
		const tickerUpper = ticker.toUpperCase();
		const suffix = tickerUpper.slice(-2);
		const num = parseInt(suffix, 10);

		// FIIs geralmente terminam em 11
		if (num === 11) {
			return 'fii';
		}
		
		// Ações ordinárias: 3
		// Ações preferenciais: 4
		// Units: 11 (alguns)
		if ([3, 4, 5, 6].includes(num)) {
			return 'acao';
		}

		// BDRs geralmente terminam em 34 ou 35
		if ([34, 35].includes(num)) {
			return 'bdr';
		}

		return 'desconhecido';
	}

	/**
	 * Adiciona índice/indicador conhecido
	 * @param {string} index - Nome do índice
	 */
	addIndex(index) {
		if (!this.KNOWN_INDICES.includes(index.toUpperCase())) {
			this.KNOWN_INDICES.push(index.toUpperCase());
		}
	}

	/**
	 * Adiciona cripto conhecida
	 * @param {string} crypto - Símbolo da crypto
	 */
	addCrypto(crypto) {
		if (!this.KNOWN_CRYPTOS.includes(crypto.toUpperCase())) {
			this.KNOWN_CRYPTOS.push(crypto.toUpperCase());
		}
	}
}

module.exports = EntityExtractor;
