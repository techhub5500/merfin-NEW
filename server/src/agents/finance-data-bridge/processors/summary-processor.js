/**
 * NOTE (summary-processor.js):
 * Purpose: Processa resumos financeiros via MongoDB Aggregation.
 * Calcula totais, médias, agrupamentos por categoria.
 * Design: Queries otimizadas com índices, cálculos no banco (não em JS).
 */

const mongoose = require('mongoose');
const Transaction = require('../../../database/schemas/transactions-schema');
const Debt = require('../../../database/schemas/debt-schema');
const CreditCard = require('../../../database/schemas/credit-card-schema');
const { logger } = require('../utils/bridge-logger');

/**
 * Classe SummaryProcessor
 * Gera resumos financeiros otimizados
 */
class SummaryProcessor {
	
	/**
	 * Gera resumo geral de transações
	 * @param {ObjectId} userId - ID do usuário
	 * @param {object} dateRange - { startDate, endDate }
	 * @param {object} filters - Filtros adicionais
	 * @returns {object} - Resumo completo
	 */
	async getTransactionsSummary(userId, dateRange, filters = {}) {
		const startTime = Date.now();
		
		try {
			// Monta query base
			const matchQuery = this._buildMatchQuery(userId, dateRange, filters);
			
			// Executa agregação principal
			const result = await Transaction.aggregate([
				{ $match: matchQuery },
				{
					$group: {
						_id: null,
						totalIncome: {
							$sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
						},
						totalExpense: {
							$sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
						},
						incomeCount: {
							$sum: { $cond: [{ $eq: ['$type', 'income'] }, 1, 0] }
						},
						expenseCount: {
							$sum: { $cond: [{ $eq: ['$type', 'expense'] }, 1, 0] }
						},
						totalCount: { $sum: 1 },
						totalAmount: { $sum: '$amount' }
					}
				}
			]);

			// Processa resultado
			const data = result[0] || {
				totalIncome: 0,
				totalExpense: 0,
				incomeCount: 0,
				expenseCount: 0,
				totalCount: 0,
				totalAmount: 0
			};

			const summary = {
				period: {
					start: dateRange.startDate,
					end: dateRange.endDate
				},
				summary: {
					totalIncome: this._round(data.totalIncome),
					totalExpense: this._round(data.totalExpense),
					netFlow: this._round(data.totalIncome - data.totalExpense),
					transactionCount: data.totalCount,
					averageTransaction: data.totalCount > 0 
						? this._round(data.totalAmount / data.totalCount) 
						: 0
				},
				breakdown: {
					byType: {
						income: { total: this._round(data.totalIncome), count: data.incomeCount },
						expense: { total: this._round(data.totalExpense), count: data.expenseCount }
					}
				}
			};

			// Adiciona breakdown por categoria se solicitado
			if (!filters.skipCategoryBreakdown) {
				summary.breakdown.byCategory = await this._getCategoryBreakdown(userId, dateRange, filters);
			}

			logger.decision('SUMMARY_GENERATED', `${data.totalCount} transactions processed in ${Date.now() - startTime}ms`);
			
			return summary;

		} catch (error) {
			logger.error('SUMMARY_FAILED', error);
			throw error;
		}
	}

	/**
	 * Gera breakdown por categoria
	 */
	async _getCategoryBreakdown(userId, dateRange, filters) {
		const matchQuery = this._buildMatchQuery(userId, dateRange, filters);
		
		// Filtra apenas despesas para breakdown de categoria
		matchQuery.type = 'expense';

		const result = await Transaction.aggregate([
			{ $match: matchQuery },
			{
				$group: {
					_id: '$category',
					total: { $sum: '$amount' },
					count: { $sum: 1 }
				}
			},
			{ $sort: { total: -1 } },
			{ $limit: 15 } // Top 15 categorias
		]);

		// Calcula total para percentuais
		const grandTotal = result.reduce((sum, item) => sum + item.total, 0);

		return result.map(item => ({
			category: item._id || 'Sem Categoria',
			total: this._round(item.total),
			count: item.count,
			percentage: grandTotal > 0 
				? this._round((item.total / grandTotal) * 100, 1) 
				: 0
		}));
	}

	/**
	 * Gera tendência mensal
	 * @param {ObjectId} userId - ID do usuário
	 * @param {number} months - Quantidade de meses
	 * @returns {array} - Tendência por mês
	 */
	async getMonthlyTrend(userId, months = 6) {
		const endDate = new Date();
		const startDate = new Date();
		startDate.setMonth(startDate.getMonth() - months);
		startDate.setDate(1);
		startDate.setHours(0, 0, 0, 0);

		const result = await Transaction.aggregate([
			{
				$match: {
					userId: new mongoose.Types.ObjectId(userId),
					section: 'statement',
					status: 'confirmed',
					date: { $gte: startDate, $lte: endDate }
				}
			},
			{
				$group: {
					_id: {
						year: { $year: '$date' },
						month: { $month: '$date' }
					},
					totalIncome: {
						$sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
					},
					totalExpense: {
						$sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
					},
					transactionCount: { $sum: 1 }
				}
			},
			{ $sort: { '_id.year': 1, '_id.month': 1 } }
		]);

		return result.map(item => ({
			year: item._id.year,
			month: item._id.month,
			monthLabel: this._getMonthLabel(item._id.month),
			totalIncome: this._round(item.totalIncome),
			totalExpense: this._round(item.totalExpense),
			netFlow: this._round(item.totalIncome - item.totalExpense),
			transactionCount: item.transactionCount
		}));
	}

	/**
	 * Gera resumo de dívidas
	 */
	async getDebtsSummary(userId) {
		const debts = await Debt.find({ 
			userId: new mongoose.Types.ObjectId(userId),
			status: { $in: ['active', 'overdue'] }
		}).lean();

		if (debts.length === 0) {
			return {
				summary: {
					totalDebts: 0,
					totalValue: 0,
					totalPaid: 0,
					totalRemaining: 0,
					averageInstallment: 0
				},
				debts: []
			};
		}

		let totalValue = 0;
		let totalPaid = 0;
		let totalRemaining = 0;
		let totalInstallmentValue = 0;

		const debtsSummary = debts.map(debt => {
			const paidInstallments = debt.installments.filter(i => i.isPaid);
			const paidAmount = paidInstallments.reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);
			const remaining = debt.totalValue - paidAmount;

			totalValue += debt.totalValue;
			totalPaid += paidAmount;
			totalRemaining += remaining;
			totalInstallmentValue += debt.installmentValue;

			// Próxima parcela
			const nextInstallment = debt.installments
				.filter(i => !i.isPaid)
				.sort((a, b) => a.dueDate - b.dueDate)[0];

			return {
				debtId: debt._id.toString(),
				description: debt.description,
				institution: debt.institution,
				totalValue: this._round(debt.totalValue),
				remaining: this._round(remaining),
				paidPercentage: this._round((paidAmount / debt.totalValue) * 100, 1),
				installmentValue: this._round(debt.installmentValue),
				paidInstallments: paidInstallments.length,
				totalInstallments: debt.installmentCount,
				nextPayment: nextInstallment ? {
					date: nextInstallment.dueDate,
					amount: nextInstallment.amount,
					isOverdue: nextInstallment.dueDate < new Date()
				} : null,
				status: debt.status
			};
		});

		return {
			summary: {
				totalDebts: debts.length,
				totalValue: this._round(totalValue),
				totalPaid: this._round(totalPaid),
				totalRemaining: this._round(totalRemaining),
				averageInstallment: this._round(totalInstallmentValue / debts.length)
			},
			debts: debtsSummary
		};
	}

	/**
	 * Gera resumo de cartões de crédito
	 */
	async getCreditCardsSummary(userId, billingCycle = null) {
		const cards = await CreditCard.find({
			userId: new mongoose.Types.ObjectId(userId),
			status: 'active'
		}).lean();

		if (cards.length === 0) {
			return {
				summary: {
					totalCards: 0,
					totalLimit: 0,
					totalUtilized: 0,
					availableCredit: 0,
					utilizationPercentage: 0
				},
				cards: []
			};
		}

		// Calcula utilização de cada cartão
		const cardsSummary = await Promise.all(cards.map(async (card) => {
			// Calcula ciclo de faturamento atual
			const now = new Date();
			let cycleStart, cycleEnd;
			
			if (billingCycle) {
				cycleStart = billingCycle.startDate;
				cycleEnd = billingCycle.endDate;
			} else {
				// Calcula automaticamente
				const renewalDay = card.billingCycleRenewalDay;
				const currentDay = now.getDate();
				
				if (currentDay >= renewalDay) {
					cycleStart = new Date(now.getFullYear(), now.getMonth(), renewalDay);
					cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, renewalDay - 1);
				} else {
					cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, renewalDay);
					cycleEnd = new Date(now.getFullYear(), now.getMonth(), renewalDay - 1);
				}
			}

			// Busca transações do ciclo atual
			const utilization = await Transaction.aggregate([
				{
					$match: {
						userId: new mongoose.Types.ObjectId(userId),
						section: 'credit_card',
						'creditCard.cardId': card._id.toString(),
						date: { $gte: cycleStart, $lte: cycleEnd },
						status: 'confirmed'
					}
				},
				{
					$group: {
						_id: null,
						total: { $sum: '$amount' },
						count: { $sum: 1 }
					}
				}
			]);

			const utilized = utilization[0]?.total || 0;
			const available = card.creditLimit - utilized;

			return {
				cardId: card._id.toString(),
				cardName: card.cardName,
				brand: card.brand,
				creditLimit: this._round(card.creditLimit),
				utilized: this._round(utilized),
				available: this._round(available),
				utilizationPercentage: card.creditLimit > 0 
					? this._round((utilized / card.creditLimit) * 100, 1) 
					: 0,
				billingCycle: {
					startDate: cycleStart,
					endDate: cycleEnd,
					dueDay: card.billingDueDay
				},
				transactionCount: utilization[0]?.count || 0
			};
		}));

		// Calcula totais
		const totalLimit = cardsSummary.reduce((sum, c) => sum + c.creditLimit, 0);
		const totalUtilized = cardsSummary.reduce((sum, c) => sum + c.utilized, 0);

		return {
			summary: {
				totalCards: cards.length,
				totalLimit: this._round(totalLimit),
				totalUtilized: this._round(totalUtilized),
				availableCredit: this._round(totalLimit - totalUtilized),
				utilizationPercentage: totalLimit > 0 
					? this._round((totalUtilized / totalLimit) * 100, 1) 
					: 0
			},
			cards: cardsSummary
		};
	}

	/**
	 * Gera resumo de contas futuras (scheduled)
	 */
	async getScheduledSummary(userId, dateRange) {
		const matchQuery = {
			userId: new mongoose.Types.ObjectId(userId),
			section: 'scheduled',
			status: { $in: ['pending', 'confirmed'] }
		};

		if (dateRange) {
			matchQuery['scheduled.dueDate'] = {
				$gte: dateRange.startDate,
				$lte: dateRange.endDate
			};
		}

		const result = await Transaction.aggregate([
			{ $match: matchQuery },
			{
				$group: {
					_id: '$type',
					total: { $sum: '$amount' },
					count: { $sum: 1 }
				}
			}
		]);

		let receivable = { total: 0, count: 0 };
		let payable = { total: 0, count: 0 };

		result.forEach(item => {
			if (item._id === 'income') {
				receivable = { total: item.total, count: item.count };
			} else if (item._id === 'expense') {
				payable = { total: item.total, count: item.count };
			}
		});

		return {
			period: dateRange ? {
				start: dateRange.startDate,
				end: dateRange.endDate
			} : 'all',
			summary: {
				receivable: {
					total: this._round(receivable.total),
					count: receivable.count
				},
				payable: {
					total: this._round(payable.total),
					count: payable.count
				},
				netExpected: this._round(receivable.total - payable.total)
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
			status: 'confirmed'
		};

		// Seção (default: statement)
		query.section = filters.section || 'statement';

		// Range de datas
		if (dateRange && dateRange.startDate && dateRange.endDate) {
			query.date = {
				$gte: dateRange.startDate,
				$lte: dateRange.endDate
			};
		}

		// Tipo
		if (filters.type) {
			query.type = filters.type;
		}

		// Categoria
		if (filters.category) {
			query.category = filters.category;
		}

		// Valor mínimo/máximo
		if (filters.minValue !== null || filters.maxValue !== null) {
			query.amount = {};
			if (filters.minValue !== null) query.amount.$gte = filters.minValue;
			if (filters.maxValue !== null) query.amount.$lte = filters.maxValue;
		}

		return query;
	}

	/**
	 * Arredonda número para N casas decimais
	 */
	_round(value, decimals = 2) {
		if (value === null || value === undefined || isNaN(value)) return 0;
		return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
	}

	/**
	 * Retorna label do mês
	 */
	_getMonthLabel(month) {
		const labels = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
						'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
		return labels[month] || '';
	}
}

module.exports = {
	SummaryProcessor
};
