/**
 * NOTE (query-normalizer.js):
 * Purpose: Normalização de queries para melhorar cache hit rate através de fingerprinting.
 * Transforma variações equivalentes em formato canônico.
 * Controls: normalize() para texto, generateFingerprint() para hash de cache.
 * Behavior: Remove acentos, normaliza espaços, traduz aliases comuns para tickers.
 * Integration notes: Usado por RequestAnalyzer e CacheManager.
 */

/**
 * QueryNormalizer - Normalizador de Queries
 * 
 * Objetivo: Aumentar cache hit rate transformando queries equivalentes
 * em formato canônico. Exemplos:
 * - "PETR4 preço" = "preço PETR4" = "cotação Petrobras"
 * - "vale do rio doce" → "VALE3"
 * - "   múltiplos   espaços   " → "múltiplos espaços"
 */
class QueryNormalizer {
	constructor() {
		// Aliases de empresas/ativos para tickers
		this.ALIASES = {
			// Petrobras
			'petrobras': 'PETR4',
			'petro': 'PETR4',
			'petrobrás': 'PETR4',
			
			// Vale
			'vale': 'VALE3',
			'vale do rio doce': 'VALE3',
			'cvrd': 'VALE3',
			
			// Itaú
			'itaú': 'ITUB4',
			'itau': 'ITUB4',
			'itaú unibanco': 'ITUB4',
			'itau unibanco': 'ITUB4',
			
			// Bradesco
			'bradesco': 'BBDC4',
			
			// Banco do Brasil
			'banco do brasil': 'BBAS3',
			'bb': 'BBAS3',
			
			// Magazine Luiza
			'magazine luiza': 'MGLU3',
			'magalu': 'MGLU3',
			
			// Ambev
			'ambev': 'ABEV3',
			
			// WEG
			'weg': 'WEGE3',
			
			// JBS
			'jbs': 'JBSS3',
			
			// B3
			'b3': 'B3SA3',
			'bolsa brasileira': 'B3SA3',
			
			// Suzano
			'suzano': 'SUZB3',
			
			// Eletrobras
			'eletrobras': 'ELET3',
			'eletrobrás': 'ELET3',
			
			// Klabin
			'klabin': 'KLBN11',
			
			// Taesa
			'taesa': 'TAEE11',
			
			// Engie
			'engie': 'EGIE3',
			
			// PRIO (antiga PetroRio)
			'prio': 'PRIO3',
			'petrorio': 'PRIO3',
			
			// 3R Petroleum
			'3r petroleum': 'RRRP3',
			'3r': 'RRRP3',
			
			// Índices
			'ibovespa': 'IBOV',
			'ibov': 'IBOV',
			'bovespa': 'IBOV',
			
			// Moedas
			'dólar': 'USD/BRL',
			'dolar': 'USD/BRL',
			'euro': 'EUR/BRL',
			
			// Cripto
			'bitcoin': 'BTC',
			'ethereum': 'ETH'
		};

		// Sinônimos de palavras-chave
		this.SYNONYMS = {
			'cotação': 'preço',
			'valor': 'preço',
			'quanto custa': 'preço',
			'quanto está': 'preço',
			'porque': 'por que',
			'por quê': 'por que',
			'motivo': 'por que',
			'razão': 'por que',
			'causa': 'por que',
			'caiu': 'queda',
			'despencou': 'queda',
			'derreteu': 'queda',
			'subiu': 'alta',
			'disparou': 'alta',
			'explodiu': 'alta',
			'dividend yield': 'DY',
			'rendimento': 'DY',
			'proventos': 'dividendo'
		};
	}

	/**
	 * Normaliza texto para formato canônico
	 * @param {string} text - Texto a normalizar
	 * @returns {string} - Texto normalizado
	 */
	normalize(text) {
		if (!text || typeof text !== 'string') {
			return '';
		}

		let normalized = text
			// Lowercase para comparação
			.toLowerCase()
			// Remove espaços extras
			.trim()
			.replace(/\s+/g, ' ')
			// Remove caracteres especiais exceto letras, números, espaços, / e %
			.replace(/[^\w\sàáâãéêíóôõúç%\/\-]/gi, '');

		// Substitui aliases de empresas
		for (const [alias, ticker] of Object.entries(this.ALIASES)) {
			// Usa word boundary para evitar substituições parciais
			const regex = new RegExp(`\\b${this._escapeRegex(alias)}\\b`, 'gi');
			normalized = normalized.replace(regex, ticker);
		}

		// Substitui sinônimos
		for (const [synonym, canonical] of Object.entries(this.SYNONYMS)) {
			const regex = new RegExp(`\\b${this._escapeRegex(synonym)}\\b`, 'gi');
			normalized = normalized.replace(regex, canonical);
		}

		return normalized;
	}

	/**
	 * Gera fingerprint para cache (ordem invariante)
	 * @param {string} query - Query normalizada
	 * @returns {string} - Fingerprint ordenado
	 */
	generateFingerprint(query) {
		const normalized = this.normalize(query);
		
		// Extrai tokens únicos e ordena
		const tokens = normalized
			.split(/\s+/)
			.filter(t => t.length > 0)
			.map(t => t.toLowerCase())
			.filter((v, i, a) => a.indexOf(v) === i) // unique
			.sort();

		return tokens.join('|');
	}

	/**
	 * Remove acentos de texto
	 * @param {string} text - Texto com acentos
	 * @returns {string} - Texto sem acentos
	 */
	removeAccents(text) {
		return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	}

	/**
	 * Escapa caracteres especiais para regex
	 * @private
	 */
	_escapeRegex(string) {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/**
	 * Adiciona novo alias (extensível)
	 * @param {string} alias - Nome ou apelido
	 * @param {string} ticker - Ticker correspondente
	 */
	addAlias(alias, ticker) {
		this.ALIASES[alias.toLowerCase()] = ticker.toUpperCase();
	}
}

module.exports = QueryNormalizer;
