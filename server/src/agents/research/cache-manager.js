/**
 * NOTE (cache-manager.js):
 * Purpose: Sistema de cache inteligente com fingerprinting para aumentar hit rate.
 * Implementa cache global compartilhado (dados de mercado são públicos).
 * Controls: get(), set(), generateFingerprint(), getStats(), clear().
 * Behavior: Fingerprint normalizado garante que queries equivalentes usem mesmo cache.
 * TTL dinâmico por tipo de dado. Suporte a invalidação.
 * Integration notes: Usado por ResearchAgent e SourceRouter.
 * Em produção: substituir Map por Redis.
 */

const crypto = require('crypto');
const QueryNormalizer = require('./utils/query-normalizer');

/**
 * CacheManager - Gerenciador de Cache Inteligente
 * 
 * Características:
 * - Fingerprinting: "PETR4 preço" = "preço PETR4" = "cotação Petrobras"
 * - Cache global compartilhado entre usuários
 * - TTL dinâmico por tipo de dado
 * - Estatísticas de hit/miss
 * - Suporte a busca com expiração ignorada (para fallback)
 */
class CacheManager {
	/**
	 * @param {object} config - Configurações
	 * @param {number} config.maxSize - Tamanho máximo do cache (default: 1000)
	 * @param {number} config.defaultTTL - TTL padrão em segundos (default: 24h)
	 */
	constructor(config = {}) {
		this.cache = new Map();
		this.maxSize = config.maxSize || 1000;
		this.defaultTTL = config.defaultTTL || 24 * 60 * 60; // 24 horas
		this.normalizer = new QueryNormalizer();
		
		// Estatísticas
		this.stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			evictions: 0
		};

		// Limpeza periódica de entradas expiradas (a cada 5 minutos)
		this._cleanupInterval = setInterval(() => {
			this._cleanupExpired();
		}, 5 * 60 * 1000);
	}

	/**
	 * Gera fingerprint normalizado para cache key
	 * @param {object} params - Parâmetros da query
	 * @param {string} params.objetivo - Objetivo da pesquisa
	 * @param {string} params.contexto - Contexto
	 * @param {string[]} params.tickers - Tickers
	 * @returns {string} - Hash MD5 do fingerprint
	 */
	generateFingerprint({ objetivo, contexto, tickers }) {
		// Normaliza cada componente
		const normObjetivo = this.normalizer.generateFingerprint(objetivo || '');
		const normContexto = contexto 
			? this.normalizer.generateFingerprint(contexto) 
			: '';
		const normTickers = (tickers || [])
			.map(t => t.toUpperCase())
			.sort()
			.join(',');

		// Combina tudo
		const raw = `${normObjetivo}|${normContexto}|${normTickers}`;
		
		// Gera hash MD5 para key compacta
		return crypto.createHash('md5').update(raw).digest('hex');
	}

	/**
	 * Busca item no cache
	 * @param {string} key - Fingerprint/chave
	 * @param {object} options - Opções
	 * @param {boolean} options.ignoreExpiration - Ignora expiração (para fallback)
	 * @returns {Promise<object|null>} - Dados ou null se não encontrado/expirado
	 */
	async get(key, options = {}) {
		const entry = this.cache.get(key);
		
		if (!entry) {
			this.stats.misses++;
			return null;
		}

		const now = Date.now();
		const isExpired = now > entry.expiresAt;

		// Se expirado e não estamos ignorando expiração
		if (isExpired && !options.ignoreExpiration) {
			this.stats.misses++;
			// Não deletamos aqui - cleanup periódico faz isso
			return null;
		}

		this.stats.hits++;

		// Calcula idade em horas
		const ageMs = now - entry.createdAt;
		const ageHours = (ageMs / (1000 * 60 * 60)).toFixed(1);

		// Retorna cópia dos dados com metadados
		return {
			...entry.data,
			_fromCache: true,
			_ageHours: parseFloat(ageHours),
			_expired: isExpired,
			advertencia: isExpired 
				? `ATENÇÃO: Dados expirados de ${ageHours}h atrás (fallback)`
				: `Dados de cache de ${ageHours}h atrás`
		};
	}

	/**
	 * Salva item no cache
	 * @param {string} key - Fingerprint/chave
	 * @param {object} data - Dados a salvar
	 * @param {number} ttlSeconds - TTL em segundos (opcional)
	 * @returns {Promise<void>}
	 */
	async set(key, data, ttlSeconds = null) {
		// Eviction se cache cheio (LRU simples)
		if (this.cache.size >= this.maxSize) {
			this._evictOldest();
		}

		const ttl = ttlSeconds || this.defaultTTL;
		const now = Date.now();

		this.cache.set(key, {
			data,
			createdAt: now,
			expiresAt: now + (ttl * 1000),
			ttl
		});

		this.stats.sets++;
	}

	/**
	 * Remove item do cache
	 * @param {string} key - Fingerprint/chave
	 * @returns {boolean} - Se removeu algo
	 */
	delete(key) {
		return this.cache.delete(key);
	}

	/**
	 * Verifica se key existe (mesmo expirada)
	 * @param {string} key - Fingerprint/chave
	 * @returns {boolean}
	 */
	has(key) {
		return this.cache.has(key);
	}

	/**
	 * Limpa todo o cache
	 */
	clear() {
		this.cache.clear();
		this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
	}

	/**
	 * Retorna estatísticas do cache
	 * @returns {object} - Stats com hit rate
	 */
	getStats() {
		const total = this.stats.hits + this.stats.misses;
		const hitRate = total > 0 
			? ((this.stats.hits / total) * 100).toFixed(1)
			: 0;

		return {
			hits: this.stats.hits,
			misses: this.stats.misses,
			sets: this.stats.sets,
			evictions: this.stats.evictions,
			hitRate: `${hitRate}%`,
			size: this.cache.size,
			maxSize: this.maxSize
		};
	}

	/**
	 * Invalida entradas que contenham determinada entidade
	 * Útil para invalidação proativa
	 * @param {string} entity - Entidade (ex: 'PETR4')
	 * @returns {number} - Quantidade de entradas invalidadas
	 */
	invalidateByEntity(entity) {
		const entityUpper = entity.toUpperCase();
		let invalidated = 0;

		for (const [key, entry] of this.cache.entries()) {
			// Verifica se os dados contêm a entidade
			const dataStr = JSON.stringify(entry.data);
			if (dataStr.includes(entityUpper)) {
				this.cache.delete(key);
				invalidated++;
			}
		}

		return invalidated;
	}

	/**
	 * Remove a entrada mais antiga (LRU eviction)
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
			this.stats.evictions++;
		}
	}

	/**
	 * Limpa entradas expiradas
	 * @private
	 */
	_cleanupExpired() {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			console.log(`[CacheManager] Limpeza: ${cleaned} entradas expiradas removidas`);
		}
	}

	/**
	 * Limpa o interval de cleanup ao destruir
	 */
	destroy() {
		if (this._cleanupInterval) {
			clearInterval(this._cleanupInterval);
			this._cleanupInterval = null;
		}
	}
}

module.exports = CacheManager;
