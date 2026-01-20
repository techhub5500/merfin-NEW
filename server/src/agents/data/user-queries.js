/**
 * NOTE (user-queries.js):
 * Purpose: Queries especializadas para buscar perfil financeiro do usuário do MongoDB.
 * Recupera avaliação de risco, objetivos de investimento, situação financeira e preferências.
 * Controls: Usa model UserProfile (users-schema.js), dados usados para personalização pelos agentes.
 * Behavior: Retorna perfil completo incluindo risk_profile (conservador/moderado/agressivo),
 * investment_goals, financial_situation. Cache com TTL longo (30 min) pois dados mudam pouco.
 * Integration notes: Usado por DataAgent.fetchUserProfile() e por agentes de análise/estratégia
 * para personalizar recomendações. Perfil atualizado apenas quando usuário refaz questionário de risco.
 */

const UserProfile = require('../../database/schemas/users-schema');

/**
 * Busca perfil financeiro completo do usuário
 * 
 * @param {object} params - Parâmetros da query
 * @param {string} params.user_id - ID do usuário
 * @param {boolean} [params.include_answers] - Incluir respostas do questionário (padrão: false)
 * @returns {Promise<object>} - Perfil financeiro do usuário
 */
async function fetchUserProfile(params) {
	const { user_id, include_answers = false } = params;

	try {
		// Busca perfil do banco
		let query = UserProfile.findOne({ userId: user_id });

		// Seleciona campos baseado na opção include_answers
		if (!include_answers) {
			query = query.select('-riskAssessment.answers');
		}

		const profile = await query.lean().exec();

		if (!profile) {
			// Usuário ainda não tem perfil
			return {
				user_id,
				profile_exists: false,
				risk_profile: null,
				investment_goals: [],
				financial_situation: {},
				message: 'Perfil financeiro ainda não criado. Complete o questionário de avaliação de risco.'
			};
		}

		// Transforma documento para formato de resposta
		const result = {
			user_id,
			profile_exists: true,
			risk_assessment: {
				risk_profile: profile.riskAssessment?.risk_profile || null,
				risk_score: profile.riskAssessment?.riskScore || null,
				last_updated: profile.riskAssessment?.riskUpdatedAt || null
			},
			investment_goals: (profile.investment_goals || []).map(goal => ({
				name: goal.name,
				target_amount: goal.targetAmount,
				target_date: goal.targetDate,
				priority: goal.priority
			})),
			financial_situation: profile.financial_situation ? {
				monthly_income: profile.financial_situation.monthlyIncome || 0,
				monthly_expenses: profile.financial_situation.monthlyExpenses || 0,
				net_worth: profile.financial_situation.netWorth || 0,
				liquid_assets: profile.financial_situation.liquidAssets || 0,
				liabilities: profile.financial_situation.liabilities || 0,
				savings_rate: calculateSavingsRate(
					profile.financial_situation.monthlyIncome,
					profile.financial_situation.monthlyExpenses
				)
			} : null
		};

		// Adiciona respostas se solicitado
		if (include_answers && profile.riskAssessment?.answers) {
			result.risk_assessment.answers = profile.riskAssessment.answers.map(ans => ({
				question_id: ans.qId,
				question: ans.question,
				choice: ans.choice,
				choice_text: ans.choiceText
			}));
		}

		return result;

	} catch (error) {
		throw new Error(`Erro ao buscar perfil do usuário: ${error.message}`);
	}
}

/**
 * Busca apenas o perfil de risco do usuário
 * Útil para decisões rápidas sem carregar perfil completo
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<object>} - Perfil de risco
 */
async function fetchRiskProfile(userId) {
	try {
		const profile = await UserProfile.findOne({ userId })
			.select('riskAssessment.risk_profile riskAssessment.riskScore riskAssessment.riskUpdatedAt')
			.lean()
			.exec();

		if (!profile || !profile.riskAssessment) {
			return {
				user_id: userId,
				risk_profile: null,
				risk_score: null,
				message: 'Perfil de risco não definido'
			};
		}

		return {
			user_id: userId,
			risk_profile: profile.riskAssessment.risk_profile,
			risk_score: profile.riskAssessment.riskScore,
			last_updated: profile.riskAssessment.riskUpdatedAt
		};

	} catch (error) {
		throw new Error(`Erro ao buscar perfil de risco: ${error.message}`);
	}
}

/**
 * Busca objetivos de investimento do usuário
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<array>} - Lista de objetivos
 */
async function fetchInvestmentGoals(userId) {
	try {
		const profile = await UserProfile.findOne({ userId })
			.select('investment_goals')
			.lean()
			.exec();

		if (!profile || !profile.investment_goals) {
			return {
				user_id: userId,
				goals: [],
				message: 'Nenhum objetivo de investimento definido'
			};
		}

		const goals = profile.investment_goals.map(goal => ({
			name: goal.name,
			target_amount: goal.targetAmount,
			target_date: goal.targetDate,
			priority: goal.priority,
			months_remaining: goal.targetDate ? calculateMonthsRemaining(goal.targetDate) : null
		}));

		// Ordena por prioridade (maior prioridade primeiro)
		goals.sort((a, b) => (b.priority || 0) - (a.priority || 0));

		return {
			user_id: userId,
			goals,
			total_goals: goals.length
		};

	} catch (error) {
		throw new Error(`Erro ao buscar objetivos de investimento: ${error.message}`);
	}
}

/**
 * Busca situação financeira do usuário
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<object>} - Situação financeira
 */
async function fetchFinancialSituation(userId) {
	try {
		const profile = await UserProfile.findOne({ userId })
			.select('financial_situation')
			.lean()
			.exec();

		if (!profile || !profile.financial_situation) {
			return {
				user_id: userId,
				financial_situation: null,
				message: 'Situação financeira não cadastrada'
			};
		}

		const fs = profile.financial_situation;

		return {
			user_id: userId,
			monthly_income: fs.monthlyIncome || 0,
			monthly_expenses: fs.monthlyExpenses || 0,
			monthly_savings: (fs.monthlyIncome || 0) - (fs.monthlyExpenses || 0),
			savings_rate: calculateSavingsRate(fs.monthlyIncome, fs.monthlyExpenses),
			net_worth: fs.netWorth || 0,
			liquid_assets: fs.liquidAssets || 0,
			liabilities: fs.liabilities || 0,
			liquidity_ratio: fs.netWorth > 0 ? (fs.liquidAssets / fs.netWorth) : 0
		};

	} catch (error) {
		throw new Error(`Erro ao buscar situação financeira: ${error.message}`);
	}
}

/**
 * Verifica se usuário tem perfil completo
 * Útil para validações
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<object>} - Status do perfil
 */
async function checkProfileCompleteness(userId) {
	try {
		const profile = await UserProfile.findOne({ userId })
			.select('riskAssessment investment_goals financial_situation')
			.lean()
			.exec();

		if (!profile) {
			return {
				user_id: userId,
				is_complete: false,
				missing_fields: ['risk_assessment', 'investment_goals', 'financial_situation'],
				completion_percentage: 0
			};
		}

		const missing = [];
		let completed = 0;
		const total = 3;

		if (!profile.riskAssessment?.risk_profile) {
			missing.push('risk_assessment');
		} else {
			completed++;
		}

		if (!profile.investment_goals || profile.investment_goals.length === 0) {
			missing.push('investment_goals');
		} else {
			completed++;
		}

		if (!profile.financial_situation || !profile.financial_situation.monthlyIncome) {
			missing.push('financial_situation');
		} else {
			completed++;
		}

		return {
			user_id: userId,
			is_complete: missing.length === 0,
			missing_fields: missing,
			completion_percentage: Math.round((completed / total) * 100)
		};

	} catch (error) {
		throw new Error(`Erro ao verificar completude do perfil: ${error.message}`);
	}
}

/**
 * Calcula taxa de poupança baseado em receitas e despesas
 * @param {number} income - Receita mensal
 * @param {number} expenses - Despesas mensais
 * @returns {number} - Taxa de poupança em percentual (0-100)
 */
function calculateSavingsRate(income, expenses) {
	if (!income || income <= 0) {
		return 0;
	}

	const savings = income - (expenses || 0);
	const rate = (savings / income) * 100;

	return Math.max(0, Math.min(100, rate)); // Limita entre 0 e 100
}

/**
 * Calcula meses restantes até uma data alvo
 * @param {Date} targetDate - Data alvo
 * @returns {number} - Meses restantes
 */
function calculateMonthsRemaining(targetDate) {
	if (!targetDate) return null;

	const now = new Date();
	const target = new Date(targetDate);
	
	const months = (target.getFullYear() - now.getFullYear()) * 12 + 
	               (target.getMonth() - now.getMonth());

	return Math.max(0, months);
}

module.exports = {
	fetchUserProfile,
	fetchRiskProfile,
	fetchInvestmentGoals,
	fetchFinancialSituation,
	checkProfileCompleteness
};
