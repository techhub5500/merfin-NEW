/**
 * NOTE (data-validator.js):
 * Purpose: Validador de integridade de dados financeiros. Detecta inconsistências como
 * saldos negativos inválidos, datas futuras, transações órfãs, moedas incompatíveis.
 * Controls: Executa múltiplas verificações configuráveis, retorna lista de problemas encontrados.
 * Behavior: Não modifica dados, apenas reporta inconsistências. Pode ser executado periodicamente
 * ou sob demanda. Útil para auditoria e detecção de bugs.
 * Integration notes: Usado por DataAgent.validateDataIntegrity(). Pode ser agendado via cron
 * para validações periódicas. Resultados logados e retornados para análise.
 */

const Account = require('../../database/schemas/accounts-schema');
const Transaction = require('../../database/schemas/transactions-schema');
const UserProfile = require('../../database/schemas/users-schema');

/**
 * Executa validações de integridade de dados para um usuário
 * 
 * @param {object} params - Parâmetros da validação
 * @param {string} params.user_id - ID do usuário
 * @param {array} [params.checks] - Lista de verificações a executar (padrão: todas)
 * @returns {Promise<object>} - Resultado das validações
 */
async function validateDataIntegrity(params) {
	const { user_id, checks = 'all' } = params;

	const availableChecks = [
		'negative_balances',
		'future_transactions',
		'orphan_transactions',
		'invalid_amounts',
		'currency_mismatches',
		'duplicate_transactions',
		'profile_consistency'
	];

	// Determina quais verificações executar
	const checksToRun = checks === 'all' ? availableChecks : checks;

	const results = {
		user_id,
		timestamp: new Date(),
		checks_performed: checksToRun,
		issues: [],
		warnings: [],
		summary: {
			total_issues: 0,
			total_warnings: 0,
			is_valid: true
		}
	};

	try {
		// Executa cada verificação
		for (const check of checksToRun) {
			switch (check) {
				case 'negative_balances':
					await checkNegativeBalances(user_id, results);
					break;
				case 'future_transactions':
					await checkFutureTransactions(user_id, results);
					break;
				case 'orphan_transactions':
					await checkOrphanTransactions(user_id, results);
					break;
				case 'invalid_amounts':
					await checkInvalidAmounts(user_id, results);
					break;
				case 'currency_mismatches':
					await checkCurrencyMismatches(user_id, results);
					break;
				case 'duplicate_transactions':
					await checkDuplicateTransactions(user_id, results);
					break;
				case 'profile_consistency':
					await checkProfileConsistency(user_id, results);
					break;
			}
		}

		// Atualiza sumário
		results.summary.total_issues = results.issues.length;
		results.summary.total_warnings = results.warnings.length;
		results.summary.is_valid = results.issues.length === 0;

		return results;

	} catch (error) {
		throw new Error(`Erro durante validação de integridade: ${error.message}`);
	}
}

/**
 * Verifica contas com saldo negativo (exceto crédito)
 */
async function checkNegativeBalances(userId, results) {
	try {
		const negativeAccounts = await Account.find({
			userId,
			balance: { $lt: 0 },
			status: { $ne: 'closed' }
		}).lean();

		negativeAccounts.forEach(acc => {
			results.issues.push({
				type: 'NEGATIVE_BALANCE',
				severity: 'HIGH',
				account_id: acc._id.toString(),
				message: `Conta com saldo negativo: R$ ${acc.balance.toFixed(2)}`,
				details: {
					balance: acc.balance,
					currency: acc.currency,
					status: acc.status
				}
			});
		});

	} catch (error) {
		results.warnings.push({
			type: 'CHECK_FAILED',
			check: 'negative_balances',
			message: `Falha ao verificar saldos negativos: ${error.message}`
		});
	}
}

/**
 * Verifica transações com data futura (suspeito se não for scheduled)
 */
async function checkFutureTransactions(userId, results) {
	try {
		const now = new Date();
		
		const futureTransactions = await Transaction.find({
			userId,
			section: { $ne: 'scheduled' }, // Transações agendadas podem ser futuras
			date: { $gt: now },
			status: 'confirmed'
		}).lean();

		futureTransactions.forEach(tx => {
			results.warnings.push({
				type: 'FUTURE_DATE',
				severity: 'MEDIUM',
				transaction_id: tx._id.toString(),
				message: `Transação confirmada com data futura: ${tx.date.toISOString()}`,
				details: {
					date: tx.date,
					type: tx.type,
					amount: tx.amount,
					description: tx.description
				}
			});
		});

	} catch (error) {
		results.warnings.push({
			type: 'CHECK_FAILED',
			check: 'future_transactions',
			message: `Falha ao verificar datas futuras: ${error.message}`
		});
	}
}

/**
 * Verifica transações órfãs (sem conta associada quando necessário)
 */
async function checkOrphanTransactions(userId, results) {
	try {
		const orphanTransactions = await Transaction.find({
			userId,
			section: 'statement', // Transações de extrato devem ter conta
			accountId: { $exists: false },
			status: 'confirmed'
		}).lean();

		orphanTransactions.forEach(tx => {
			results.issues.push({
				type: 'ORPHAN_TRANSACTION',
				severity: 'MEDIUM',
				transaction_id: tx._id.toString(),
				message: 'Transação confirmada sem conta associada',
				details: {
					type: tx.type,
					amount: tx.amount,
					date: tx.date,
					description: tx.description
				}
			});
		});

	} catch (error) {
		results.warnings.push({
			type: 'CHECK_FAILED',
			check: 'orphan_transactions',
			message: `Falha ao verificar transações órfãs: ${error.message}`
		});
	}
}

/**
 * Verifica valores inválidos (zero, negativos onde não permitido)
 */
async function checkInvalidAmounts(userId, results) {
	try {
		const invalidTransactions = await Transaction.find({
			userId,
			$or: [
				{ amount: { $lte: 0 } },
				{ amount: { $exists: false } }
			]
		}).lean();

		invalidTransactions.forEach(tx => {
			results.issues.push({
				type: 'INVALID_AMOUNT',
				severity: 'HIGH',
				transaction_id: tx._id.toString(),
				message: `Transação com valor inválido: ${tx.amount}`,
				details: {
					amount: tx.amount,
					type: tx.type,
					date: tx.date
				}
			});
		});

	} catch (error) {
		results.warnings.push({
			type: 'CHECK_FAILED',
			check: 'invalid_amounts',
			message: `Falha ao verificar valores inválidos: ${error.message}`
		});
	}
}

/**
 * Verifica incompatibilidades de moeda entre conta e transação
 */
async function checkCurrencyMismatches(userId, results) {
	try {
		// Busca todas as contas do usuário
		const accounts = await Account.find({ userId }).lean();
		const accountMap = new Map(accounts.map(acc => [acc._id.toString(), acc.currency]));

		// Busca transações com conta associada
		const transactions = await Transaction.find({
			userId,
			accountId: { $exists: true }
		}).lean();

		transactions.forEach(tx => {
			const accountCurrency = accountMap.get(tx.accountId.toString());
			
			if (accountCurrency && tx.currency && accountCurrency !== tx.currency) {
				results.warnings.push({
					type: 'CURRENCY_MISMATCH',
					severity: 'MEDIUM',
					transaction_id: tx._id.toString(),
					account_id: tx.accountId.toString(),
					message: `Moeda da transação (${tx.currency}) difere da conta (${accountCurrency})`,
					details: {
						transaction_currency: tx.currency,
						account_currency: accountCurrency
					}
				});
			}
		});

	} catch (error) {
		results.warnings.push({
			type: 'CHECK_FAILED',
			check: 'currency_mismatches',
			message: `Falha ao verificar moedas: ${error.message}`
		});
	}
}

/**
 * Verifica possíveis transações duplicadas
 */
async function checkDuplicateTransactions(userId, results) {
	try {
		const duplicates = await Transaction.aggregate([
			{
				$match: {
					userId,
					section: 'statement'
				}
			},
			{
				$group: {
					_id: {
						accountId: '$accountId',
						amount: '$amount',
						date: '$date',
						description: '$description'
					},
					count: { $sum: 1 },
					ids: { $push: '$_id' }
				}
			},
			{
				$match: {
					count: { $gt: 1 }
				}
			}
		]);

		duplicates.forEach(dup => {
			results.warnings.push({
				type: 'POSSIBLE_DUPLICATE',
				severity: 'LOW',
				message: `Possível duplicata: ${dup.count} transações idênticas`,
				details: {
					amount: dup._id.amount,
					date: dup._id.date,
					description: dup._id.description,
					transaction_ids: dup.ids.map(id => id.toString()),
					count: dup.count
				}
			});
		});

	} catch (error) {
		results.warnings.push({
			type: 'CHECK_FAILED',
			check: 'duplicate_transactions',
			message: `Falha ao verificar duplicatas: ${error.message}`
		});
	}
}

/**
 * Verifica consistência do perfil financeiro
 */
async function checkProfileConsistency(userId, results) {
	try {
		const profile = await UserProfile.findOne({ userId }).lean();

		if (!profile) {
			results.warnings.push({
				type: 'MISSING_PROFILE',
				severity: 'MEDIUM',
				message: 'Usuário sem perfil financeiro cadastrado'
			});
			return;
		}

		// Verifica se perfil de risco está definido
		if (!profile.riskAssessment || !profile.riskAssessment.risk_profile) {
			results.warnings.push({
				type: 'INCOMPLETE_PROFILE',
				severity: 'LOW',
				message: 'Perfil de risco não definido'
			});
		}

		// Verifica consistência da situação financeira
		const fs = profile.financial_situation;
		if (fs) {
			if (fs.monthlyIncome && fs.monthlyExpenses && fs.monthlyExpenses > fs.monthlyIncome * 1.5) {
				results.warnings.push({
					type: 'UNUSUAL_EXPENSES',
					severity: 'LOW',
					message: 'Despesas mensais excedem significativamente a receita',
					details: {
						income: fs.monthlyIncome,
						expenses: fs.monthlyExpenses
					}
				});
			}

			if (fs.liquidAssets && fs.liquidAssets < 0) {
				results.issues.push({
					type: 'NEGATIVE_ASSETS',
					severity: 'MEDIUM',
					message: 'Ativos líquidos negativos no perfil',
					details: {
						liquid_assets: fs.liquidAssets
					}
				});
			}
		}

	} catch (error) {
		results.warnings.push({
			type: 'CHECK_FAILED',
			check: 'profile_consistency',
			message: `Falha ao verificar perfil: ${error.message}`
		});
	}
}

module.exports = {
	validateDataIntegrity
};
