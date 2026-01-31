/**
 * NOTE (ranking-processor.js):
 * Purpose: Gera rankings dinâmicos (Top N) de transações.
 * Suporta rankings por valor, frequência, categoria.
 * Design: Queries otimizadas com aggregation pipeline.
 */

const mongoose = require('mongoose');
const Transaction = require('../../../database/schemas/transactions-schema');
const { logger } = require('../utils/bridge-logger');

/**
 * Tipos de ranking suportados
 */
const RANKING_TYPES = {
	TOP_EXPENSES: 'topExpenses',
	TOP_INCOME: 'topIncome',
	TOP_CATEGORIES: 'topCategories',
	TOP_MERCHANTS: 'topMerchants',
	FREQUENT_CATEGORIES: 'frequentCategories',
	RECENT_TRANSACTIONS: 'recentTransactions'
};

/**
 * Classe RankingProcessor
 * Gera rankings de transações
 */
class RankingProcessor {
	
	/**
	 * Gera ranking baseado no tipo
	 * @param {ObjectId} userId - ID do usuário
	 * @param {string} type - Tipo de ranking
	 * @param {number} limit - Quantidade de itens
	 * @param {object} dateRange - { startDate, endDate }
	 * @param {object} filters - Filtros adicionais
	 * @returns {object} - Ranking com items e summary
	 */
	async getTopN(userId, type, limit = 10, dateRange, filters = {}) {
		const startTime = Date.now();
		
		// Valida e limita
		limit = Math.min(Math.max(limit, 1), 50);
		
		let result;
		
		switch (type) {
			case RANKING_TYPES.TOP_EXPENSES:
				result = await this._getTopTransactions(userId, 'expense', limit, dateRange, filters);
				break;
				
			case RANKING_TYPES.TOP_INCOME:
				result = await this._getTopTransactions(userId, 'income', limit, dateRange, filters);
				break;
				
			case RANKING_TYPES.TOP_CATEGORIES:
				result = await this._getTopCategories(userId, limit, dateRange, filters);
				break;
				
			case RANKING_TYPES.TOP_MERCHANTS:
				result = await this._getTopMerchants(userId, limit, dateRange, filters);
				break;
				
			case RANKING_TYPES.FREQUENT_CATEGORIES:
				result = await this._getFrequentCategories(userId, limit, dateRange, filters);
				break;
				
			case RANKING_TYPES.RECENT_TRANSACTIONS:
				result = await this._getRecentTransactions(userId, limit, filters);
				break;
				
			default:
				// Default: top despesas
				result = await this._getTopTransactions(userId, 'expense', limit, dateRange, filters);
		}

		logger.decision('RANKING_GENERATED', `type=${type}, items=${result.items.length}, duration=${Date.now() - startTime}ms`);
		
		return result;
	}

	/**
	 * Top N transações por valor
	 */
	async _getTopTransactions(userId, type, limit, dateRange, filters) {
		const matchQuery = this._buildMatchQuery(userId, dateRange, filters);
		matchQuery.type = type;

		// Primeiro pega o total para calcular percentuais
		const totalResult = await Transaction.aggregate([
			{ $match: matchQuery },
			{ $group: { _id: null, total: { $sum: '$amount' } } }
		]);
		const grandTotal = totalResult[0]?.total || 0;

		// Pega top N
		const transactions = await Transaction.find(matchQuery)
			.sort({ amount: -1 })
			.limit(limit)
			.select('description amount date category merchant')
			.lean();

		const items = transactions.map((tx, index) => ({
			rank: index + 1,
			description: tx.description || 'Sem descrição',
			amount: this._round(tx.amount),
			date: tx.date,
			category: tx.category || 'Sem Categoria',
			merchant: tx.merchant || null,
			percentageOfTotal: grandTotal > 0 
				? this._round((tx.amount / grandTotal) * 100, 1) 
				: 0
		}));

		const totalInRanking = items.reduce((sum, item) => sum + item.amount, 0);

		return {
			rankingType: type === 'expense' ? RANKING_TYPES.TOP_EXPENSES : RANKING_TYPES.TOP_INCOME,
			period: {
				start: dateRange?.startDate,
				end: dateRange?.endDate
			},
			items,
			summary: {
				totalInRanking: this._round(totalInRanking),
				percentageOfTotal: grandTotal > 0 
					? this._round((totalInRanking / grandTotal) * 100, 1) 
					: 0,
				grandTotal: this._round(grandTotal)
			}
		};
	}

	/**
	 * Top N categorias por valor total
	 */
	async _getTopCategories(userId, limit, dateRange, filters) {
		const matchQuery = this._buildMatchQuery(userId, dateRange, filters);
		// Default: despesas
		matchQuery.type = filters.type || 'expense';

		const result = await Transaction.aggregate([
			{ $match: matchQuery },
			{
				$group: {
					_id: '$category',
					total: { $sum: '$amount' },
					count: { $sum: 1 },
					avgAmount: { $avg: '$amount' },
					maxAmount: { $max: '$amount' },
					lastDate: { $max: '$date' }
				}
			},
			{ $sort: { total: -1 } },
			{ $limit: limit }
		]);

		const grandTotal = result.reduce((sum, item) => sum + item.total, 0);

		const items = result.map((item, index) => ({
			rank: index + 1,
			category: item._id || 'Sem Categoria',
			total: this._round(item.total),
			count: item.count,
			average: this._round(item.avgAmount),
			max: this._round(item.maxAmount),
			lastTransaction: item.lastDate,
			percentage: grandTotal > 0 
				? this._round((item.total / grandTotal) * 100, 1) 
				: 0
		}));

		return {
			rankingType: RANKING_TYPES.TOP_CATEGORIES,
			period: {
				start: dateRange?.startDate,
				end: dateRange?.endDate
			},
			items,
			summary: {
				totalCategories: items.length,
				grandTotal: this._round(grandTotal),
				totalTransactions: items.reduce((sum, i) => sum + i.count, 0)
			}
		};
	}

	/**
	 * Top N estabelecimentos por valor
	 */
	async _getTopMerchants(userId, limit, dateRange, filters) {
		const matchQuery = this._buildMatchQuery(userId, dateRange, filters);
		matchQuery.merchant = { $exists: true, $ne: null, $ne: '' };
		matchQuery.type = 'expense';

		const result = await Transaction.aggregate([
			{ $match: matchQuery },
			{
				$group: {
					_id: '$merchant',
					total: { $sum: '$amount' },
					count: { $sum: 1 },
					avgAmount: { $avg: '$amount' },
					categories: { $addToSet: '$category' }
				}
			},
			{ $sort: { total: -1 } },
			{ $limit: limit }
		]);

		const grandTotal = result.reduce((sum, item) => sum + item.total, 0);

		const items = result.map((item, index) => ({
			rank: index + 1,
			merchant: item._id,
			total: this._round(item.total),
			count: item.count,
			average: this._round(item.avgAmount),
			categories: item.categories.filter(c => c).slice(0, 3),
			percentage: grandTotal > 0 
				? this._round((item.total / grandTotal) * 100, 1) 
				: 0
		}));

		return {
			rankingType: RANKING_TYPES.TOP_MERCHANTS,
			period: {
				start: dateRange?.startDate,
				end: dateRange?.endDate
			},
			items,
			summary: {
				totalMerchants: items.length,
				grandTotal: this._round(grandTotal)
			}
		};
	}

	/**
	 * Categorias mais frequentes (por número de transações)
	 */
	async _getFrequentCategories(userId, limit, dateRange, filters) {
		const matchQuery = this._buildMatchQuery(userId, dateRange, filters);

		const result = await Transaction.aggregate([
			{ $match: matchQuery },
			{
				$group: {
					_id: '$category',
					count: { $sum: 1 },
					total: { $sum: '$amount' },
					avgAmount: { $avg: '$amount' }
				}
			},
			{ $sort: { count: -1 } }, // Ordena por frequência
			{ $limit: limit }
		]);

		const grandCount = result.reduce((sum, item) => sum + item.count, 0);

		const items = result.map((item, index) => ({
			rank: index + 1,
			category: item._id || 'Sem Categoria',
			count: item.count,
			total: this._round(item.total),
			average: this._round(item.avgAmount),
			frequencyPercentage: grandCount > 0 
				? this._round((item.count / grandCount) * 100, 1) 
				: 0
		}));

		return {
			rankingType: RANKING_TYPES.FREQUENT_CATEGORIES,
			period: {
				start: dateRange?.startDate,
				end: dateRange?.endDate
			},
			items,
			summary: {
				totalCategories: items.length,
				totalTransactions: grandCount
			}
		};
	}

	/**
	 * Transações mais recentes
	 */
	async _getRecentTransactions(userId, limit, filters) {
		const matchQuery = {
			userId: new mongoose.Types.ObjectId(userId),
			section: filters.section || 'statement',
			status: 'confirmed'
		};

		if (filters.type) {
			matchQuery.type = filters.type;
		}

		const transactions = await Transaction.find(matchQuery)
			.sort({ date: -1 })
			.limit(limit)
			.select('description amount date type category merchant')
			.lean();

		const items = transactions.map((tx, index) => ({
			rank: index + 1,
			description: tx.description || 'Sem descrição',
			amount: this._round(tx.amount),
			date: tx.date,
			type: tx.type,
			category: tx.category || 'Sem Categoria',
			merchant: tx.merchant || null
		}));

		return {
			rankingType: RANKING_TYPES.RECENT_TRANSACTIONS,
			period: null,
			items,
			summary: {
				count: items.length,
				totalAmount: this._round(items.reduce((sum, i) => sum + i.amount, 0))
			}
		};
	}

	// ========== HELPERS ==========

	/**
	 * Constrói query de match base
	 */
	_buildMatchQuery(userId, dateRange, filters) {
		const query = {
			userId: new mongoose.Types.ObjectId(userId),
			section: filters.section || 'statement',
			status: 'confirmed'
		};

		if (dateRange && dateRange.startDate && dateRange.endDate) {
			query.date = {
				$gte: dateRange.startDate,
				$lte: dateRange.endDate
			};
		}

		if (filters.category) {
			query.category = filters.category;
		}

		if (filters.minValue !== null || filters.maxValue !== null) {
			query.amount = {};
			if (filters.minValue !== null) query.amount.$gte = filters.minValue;
			if (filters.maxValue !== null) query.amount.$lte = filters.maxValue;
		}

		return query;
	}

	/**
	 * Arredonda número
	 */
	_round(value, decimals = 2) {
		if (value === null || value === undefined || isNaN(value)) return 0;
		return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
	}
}

module.exports = {
	RankingProcessor,
	RANKING_TYPES
};
