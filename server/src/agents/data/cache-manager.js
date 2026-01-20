/**
 * NOTE (cache-manager.js):
 * Purpose: Gerenciador de cache específico para o Data Agent. Wrapper do ToolContext com
 * lógica de chaveamento, TTLs por tipo de dado e invalidação inteligente.
 * Controls: Usa CACHE_TTL de constants.js, gera chaves consistentes, gerencia hits/misses.
 * Behavior: Cache agressivo para dados que mudam pouco (perfil), cache curto para dados
 * financeiros (saldos, transações). Invalidação por padrões (user_id, account_id).
 * Integration notes: Usado exclusivamente por DataAgent. Integra com ToolContext da Etapa 1.
 * Logs automáticos de cache hit/miss para análise de performance.
 */

const { CACHE_TTL, CACHE_KEY_PREFIXES } = require('../shared/constants');
const logger = require('../shared/logger');

/**
 * CacheManager - Gerenciador de cache para Data Agent
 * 
 * Responsabilidades:
 * - Gerar chaves de cache consistentes
 * - Aplicar TTLs apropriados por tipo de dado
 * - Invalidar cache quando dados mudam
 * - Logar estatísticas de cache
 */
class CacheManager {
	constructor() {
		this.toolContext = null;
		this.prefix = CACHE_KEY_PREFIXES.DATA_AGENT;
		this.stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			invalidations: 0
		};
	}

	/**
	 * Configura a instância do ToolContext a usar
	 * @param {object} toolContext - Instância do ToolContext
	 */
	setToolContext(toolContext) {
		this.toolContext = toolContext;
	}

	/**
	 * Busca um valor do cache
	 * @param {string} key - Chave do cache
	 * @returns {Promise<any>} - Valor do cache ou null
	 */
	async get(key) {
		if (!this.toolContext) {
			logger.warn('[CacheManager] ToolContext não configurado, cache desabilitado');
			this.stats.misses++;
			return null;
		}

		const fullKey = `${this.prefix}${key}`;
		const value = this.toolContext.get(fullKey);

		if (value !== null && value !== undefined) {
			this.stats.hits++;
			logger.debug(`[DataAgent] Cache HIT: ${key}`, { cacheKey: fullKey });
			return value;
		}

		this.stats.misses++;
		logger.debug(`[DataAgent] Cache MISS: ${key}`, { cacheKey: fullKey });
		return null;
	}

	/**
	 * Armazena um valor no cache com TTL apropriado
	 * @param {string} key - Chave do cache
	 * @param {any} value - Valor a armazenar
	 * @param {string} dataType - Tipo de dado (para determinar TTL)
	 * @returns {Promise<void>}
	 */
	async set(key, value, dataType) {
		if (!this.toolContext) {
			logger.warn('[CacheManager] ToolContext não configurado, cache desabilitado');
			return;
		}

		const fullKey = `${this.prefix}${key}`;
		const ttl = this._getTTL(dataType);

		this.toolContext.set(fullKey, value, ttl);
		this.stats.sets++;

		logger.debug(`[DataAgent] Cache SET: ${key} (TTL: ${ttl}s)`, {
			cacheKey: fullKey,
			ttl,
			dataType
		});
	}

	/**
	 * Invalida cache baseado em padrões
	 * @param {object} invalidation - Padrão de invalidação
	 * @param {string} [invalidation.user_id] - Invalida tudo do usuário
	 * @param {string} [invalidation.account_id] - Invalida tudo da conta
	 * @param {string} [invalidation.pattern] - Padrão regex
	 * @returns {Promise<number>} - Número de chaves invalidadas
	 */
	async invalidate(invalidation) {
		if (!this.toolContext) {
			return 0;
		}

		let count = 0;
		const { user_id, account_id, pattern } = invalidation;

		// Invalida por user_id
		if (user_id) {
			const patterns = [
				`${this.prefix}account_balance_.*${user_id}`,
				`${this.prefix}account_balances_${user_id}`,
				`${this.prefix}transactions_${user_id}.*`,
				`${this.prefix}user_profile_${user_id}`,
				`${this.prefix}account_summary_${user_id}`
			];

			for (const pat of patterns) {
				count += this._invalidateByPattern(pat);
			}

			this.stats.invalidations += count;
			logger.info(`[DataAgent] Cache invalidado para user ${user_id}: ${count} chaves`, {
				user_id,
				count
			});
		}

		// Invalida por account_id
		if (account_id) {
			const patterns = [
				`${this.prefix}account_balance_${account_id}`,
				`${this.prefix}transactions_.*${account_id}.*`
			];

			for (const pat of patterns) {
				count += this._invalidateByPattern(pat);
			}

			this.stats.invalidations += count;
			logger.info(`[DataAgent] Cache invalidado para account ${account_id}: ${count} chaves`, {
				account_id,
				count
			});
		}

		// Invalida por padrão customizado
		if (pattern) {
			count += this._invalidateByPattern(`${this.prefix}${pattern}`);
			this.stats.invalidations += count;
			logger.info(`[DataAgent] Cache invalidado por padrão: ${count} chaves`, {
				pattern,
				count
			});
		}

		return count;
	}

	/**
	 * Gera chave de cache para query de transações
	 * @param {object} params - Parâmetros da query
	 * @returns {string} - Chave de cache
	 */
	generateTransactionCacheKey(params) {
		const parts = [`transactions_${params.user_id}`];

		if (params.account_id) parts.push(`acc_${params.account_id}`);
		if (params.section) parts.push(`sec_${params.section}`);
		if (params.type) parts.push(`type_${params.type}`);
		if (params.status) parts.push(`status_${params.status}`);
		if (params.start_date) parts.push(`from_${params.start_date}`);
		if (params.end_date) parts.push(`to_${params.end_date}`);
		if (params.limit) parts.push(`limit_${params.limit}`);

		return parts.join('_');
	}

	/**
	 * Retorna estatísticas de uso do cache
	 * @returns {object} - Estatísticas
	 */
	getStats() {
		const total = this.stats.hits + this.stats.misses;
		const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

		return {
			...this.stats,
			hit_rate: `${hitRate}%`,
			total_requests: total
		};
	}

	/**
	 * Reseta estatísticas
	 */
	resetStats() {
		this.stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			invalidations: 0
		};
	}

	/**
	 * Obtém TTL apropriado baseado no tipo de dado
	 * @param {string} dataType - Tipo de dado
	 * @returns {number} - TTL em segundos
	 * @private
	 */
	_getTTL(dataType) {
		return CACHE_TTL[dataType] || CACHE_TTL.ACCOUNT_BALANCE;
	}

	/**
	 * Invalida chaves que correspondem a um padrão
	 * @param {string} pattern - Padrão regex
	 * @returns {number} - Número de chaves invalidadas
	 * @private
	 */
	_invalidateByPattern(pattern) {
		if (!this.toolContext || !this.toolContext.clearByPattern) {
			// Se ToolContext não tem método clearByPattern, limpa tudo (fallback)
			if (this.toolContext && this.toolContext.clear) {
				this.toolContext.clear();
				return 1;
			}
			return 0;
		}

		return this.toolContext.clearByPattern(pattern);
	}
}

// Exporta singleton
module.exports = new CacheManager();
