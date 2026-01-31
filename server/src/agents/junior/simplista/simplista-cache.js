/**
 * NOTE (simplista-cache.js):
 * Purpose: Cache local simples para respostas do Serper.
 * Design: Map-based com TTL dinâmico por tipo de dado.
 * 
 * TTL PADRÕES:
 * - Cotações: 300 min (5h)
 * - Indicadores: 300 min (5h)
 * - Fatos triviais: 4320 min (72h)
 */

/**
 * TTL padrões por tipo de dado (em minutos)
 */
const TTL_CONFIG = {
	COTACAO: 300,       // 5 horas
	INDICADORES: 300,   // 5 horas
	MOEDA: 300,         // 5 horas
	INDICES: 300,       // 5 horas
	FATOS: 4320,        // 72 horas (3 dias)
	DEFAULT: 300        // 5 horas
};

/**
 * SimplistaCache - Cache simples com TTL
 */
class SimplistaCache {
	constructor(options = {}) {
		this.cache = new Map();
		this.maxSize = options.maxSize || 200;
		this.defaultTTL = options.defaultTTL || TTL_CONFIG.DEFAULT;
		
		// Estatísticas
		this._stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			evictions: 0
		};
	}

	/**
	 * Gera chave de cache normalizada
	 * @param {string} query - Query original
	 * @param {string} dataType - Tipo de dados
	 * @returns {string} - Chave normalizada
	 */
	generateKey(query, dataType) {
		// Normaliza query: lowercase, remove acentos, compacta espaços
		const normalized = query
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '') // Remove acentos
			.replace(/[^\w\s]/g, '')         // Remove pontuação
			.replace(/\s+/g, '_')            // Espaços para underscore
			.substring(0, 50);               // Limita tamanho
		
		return `${dataType}:${normalized}`;
	}

	/**
	 * Obtém valor do cache
	 * @param {string} key - Chave do cache
	 * @returns {object|null} - Valor cacheado ou null
	 */
	get(key) {
		const entry = this.cache.get(key);
		
		if (!entry) {
			this._stats.misses++;
			return null;
		}
		
		// Verifica expiração
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			this._stats.misses++;
			return null;
		}
		
		this._stats.hits++;
		return entry.value;
	}

	/**
	 * Define valor no cache
	 * @param {string} key - Chave do cache
	 * @param {object} value - Valor a cachear
	 * @param {number} ttlMinutes - TTL em minutos (opcional)
	 */
	set(key, value, ttlMinutes = null) {
		// Evicção se necessário
		if (this.cache.size >= this.maxSize) {
			this._evictOldest();
		}
		
		const ttl = ttlMinutes || this.defaultTTL;
		const expiresAt = Date.now() + (ttl * 60 * 1000);
		
		this.cache.set(key, {
			value,
			expiresAt,
			createdAt: Date.now()
		});
		
		this._stats.sets++;
	}

	/**
	 * Define valor com TTL baseado no tipo
	 * @param {string} key - Chave do cache
	 * @param {object} value - Valor a cachear
	 * @param {string} dataType - Tipo de dado para TTL
	 */
	setWithType(key, value, dataType) {
		const ttl = TTL_CONFIG[dataType] || TTL_CONFIG.DEFAULT;
		this.set(key, value, ttl);
	}

	/**
	 * Verifica se chave existe e não expirou
	 * @param {string} key - Chave do cache
	 * @returns {boolean}
	 */
	has(key) {
		const entry = this.cache.get(key);
		if (!entry) return false;
		
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return false;
		}
		
		return true;
	}

	/**
	 * Remove entrada do cache
	 * @param {string} key - Chave do cache
	 */
	delete(key) {
		this.cache.delete(key);
	}

	/**
	 * Limpa todo o cache
	 */
	clear() {
		this.cache.clear();
	}

	/**
	 * Remove entradas expiradas
	 */
	cleanup() {
		const now = Date.now();
		let removed = 0;
		
		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
				removed++;
			}
		}
		
		return removed;
	}

	/**
	 * Remove entrada mais antiga
	 * @private
	 */
	_evictOldest() {
		let oldestKey = null;
		let oldestTime = Infinity;
		
		for (const [key, entry] of this.cache.entries()) {
			if (entry.createdAt < oldestTime) {
				oldestTime = entry.createdAt;
				oldestKey = key;
			}
		}
		
		if (oldestKey) {
			this.cache.delete(oldestKey);
			this._stats.evictions++;
		}
	}

	/**
	 * Retorna estatísticas do cache
	 * @returns {object}
	 */
	getStats() {
		const total = this._stats.hits + this._stats.misses;
		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			hits: this._stats.hits,
			misses: this._stats.misses,
			sets: this._stats.sets,
			evictions: this._stats.evictions,
			hitRate: total > 0 ? Math.round((this._stats.hits / total) * 100) : 0
		};
	}

	/**
	 * Reseta estatísticas
	 */
	resetStats() {
		this._stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			evictions: 0
		};
	}
}

// Instância singleton
const simplistaCache = new SimplistaCache();

module.exports = {
	SimplistaCache,
	simplistaCache,
	cache: simplistaCache,  // Alias para compatibilidade
	TTL_CONFIG
};
