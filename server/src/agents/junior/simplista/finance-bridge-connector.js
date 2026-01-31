/**
 * NOTE (finance-bridge-connector.js):
 * Purpose: Interface com FinanceDataBridge para o Agente Simplista.
 * Design: Constrói requisições e processa respostas de forma inteligente.
 * 
 * RESPONSABILIDADES:
 * - Detectar quando usar o Bridge
 * - Construir requisições baseadas em queries naturais
 * - Formatar respostas para exibição amigável
 * - Fallback para erros
 * 
 * MUDANÇA DO PLANO: Adicionada extração de parâmetros via regex primeiro,
 * IA apenas para casos complexos. Melhora velocidade significativamente.
 */

const Bridge = require('../../finance-data-bridge');
const { callOpenAIJSON } = require('../../../config/openai-config');
const { logger } = require('./simplista-logger');

/**
 * Mapeamento de tipos de dados para ações do Bridge
 */
const DATA_TYPE_TO_ACTION = {
	SALDO: { action: 'summary', domain: 'transactions' },
	GASTOS: { action: 'summary', domain: 'transactions', filters: { type: 'expense' } },
	RECEITAS: { action: 'summary', domain: 'transactions', filters: { type: 'income' } },
	DIVIDAS: { action: 'summary', domain: 'debts' },
	INVESTIMENTOS: { action: 'summary', domain: 'assets' },
	CONTAS: { action: 'summary', domain: 'scheduled' },
	PATRIMONIO: { action: 'summary', domain: 'transactions' },
	RESERVA: { action: 'summary', domain: 'transactions' },
	CARTAO: { action: 'summary', domain: 'credit_cards' },
	EXTRATO: { action: 'list', domain: 'transactions' }
};

/**
 * Padrões para extração de período
 */
const PERIOD_EXTRACTION = {
	'este mes': 'mesAtual',
	'esse mes': 'mesAtual',
	'mes atual': 'mesAtual',
	'mes passado': 'mesAnterior',
	'ultimo mes': 'mesAnterior',
	'ultimos 7 dias': '7d',
	'ultima semana': '7d',
	'ultimos 30 dias': '30d',
	'ultimos 3 meses': '3m',
	'este ano': 'anoAtual',
	'esse ano': 'anoAtual',
	'ano passado': 'anoAnterior',
	'hoje': '1d',
	'ontem': '1d'
};

/**
 * Padrões para extração de categorias
 */
const CATEGORY_PATTERNS = {
	'alimentacao': /\b(alimenta[çc][ãa]o|comida|mercado|supermercado|restaurante)\b/i,
	'transporte': /\b(transporte|uber|99|taxi|gasolina|combustivel)\b/i,
	'moradia': /\b(moradia|aluguel|condominio|luz|agua|gas)\b/i,
	'saude': /\b(saude|medico|farmacia|remedio|consulta)\b/i,
	'educacao': /\b(educa[çc][ãa]o|escola|faculdade|curso)\b/i,
	'lazer': /\b(lazer|entretenimento|cinema|viagem|passeio)\b/i,
	'compras': /\b(compras|roupa|shopping)\b/i
};

/**
 * FinanceBridgeConnector - Conector com FinanceDataBridge
 */
class FinanceBridgeConnector {
	constructor() {
		this.bridge = Bridge;
	}

	/**
	 * Executa consulta ao Bridge baseada na query
	 * @param {string} query - Query do usuário
	 * @param {string} dataType - Tipo de dado detectado
	 * @param {string} userId - ID do usuário
	 * @param {object} memory - Contexto de memória
	 * @returns {Promise<object>} - Resultado processado
	 */
	async query(query, dataType, userId, memory = null) {
		try {
			// Constrói requisição
			const request = await this.buildBridgeQuery(query, dataType, userId, memory);
			
			logger.bridgeQuery(request, true);
			
			// Executa no Bridge
			const result = await this.bridge.execute(request);
			
			if (!result.success) {
				logger.error('BRIDGE_QUERY', new Error(result.error || 'Erro desconhecido'));
				return this.buildFallbackResponse(query, memory, result.error);
			}
			
			// Processa resposta
			return this.processResponse(result, query, dataType);
			
		} catch (error) {
			logger.error('BRIDGE_ERROR', error);
			return this.buildFallbackResponse(query, memory, error.message);
		}
	}

	/**
	 * Constrói requisição para o Bridge
	 * @param {string} query - Query do usuário
	 * @param {string} dataType - Tipo de dado
	 * @param {string} userId - ID do usuário
	 * @param {object} memory - Contexto
	 * @returns {Promise<object>} - Requisição formatada
	 */
	async buildBridgeQuery(query, dataType, userId, memory = null) {
		// Base da requisição
		const mapping = DATA_TYPE_TO_ACTION[dataType] || { action: 'summary', domain: 'transactions' };
		
		const request = {
			userId,
			action: mapping.action,
			domain: mapping.domain,
			filters: { ...mapping.filters }
		};
		
		// Extrai período
		const period = this.extractPeriod(query);
		if (period) {
			request.filters.dateRange = period;
		} else {
			// Default: mês atual
			request.filters.dateRange = 'mesAtual';
		}
		
		// Extrai categoria se mencionada
		const category = this.extractCategory(query);
		if (category) {
			request.filters.category = category;
		}
		
		// Detecta se é ranking (top N)
		const rankingMatch = query.match(/\b(top|maiores?|principais?)\s*(\d+)?\b/i);
		if (rankingMatch) {
			request.action = 'ranking';
			request.options = {
				limit: parseInt(rankingMatch[2]) || 5
			};
			
			// Define tipo de ranking
			if (dataType === 'GASTOS' || /\b(despesas?|gastos?)\b/i.test(query)) {
				request.filters.rankingType = 'topExpenses';
			} else if (dataType === 'RECEITAS' || /\b(receitas?|ganhos?)\b/i.test(query)) {
				request.filters.rankingType = 'topIncome';
			} else {
				request.filters.rankingType = 'topExpenses';
			}
		}
		
		return request;
	}

	/**
	 * Extrai período da query
	 * @param {string} query - Query do usuário
	 * @returns {string|null} - Período formatado
	 */
	extractPeriod(query) {
		// Normaliza query
		const normalized = query
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');
		
		// Busca padrão conhecido
		for (const [pattern, period] of Object.entries(PERIOD_EXTRACTION)) {
			if (normalized.includes(pattern)) {
				return period;
			}
		}
		
		// Padrão "últimos N dias/meses"
		const numericMatch = normalized.match(/ultimos?\s+(\d+)\s+(dias?|semanas?|meses?)/);
		if (numericMatch) {
			const num = parseInt(numericMatch[1]);
			const unit = numericMatch[2];
			
			if (unit.startsWith('dia')) return `${num}d`;
			if (unit.startsWith('semana')) return `${num * 7}d`;
			if (unit.startsWith('mes')) return `${num}m`;
		}
		
		return null;
	}

	/**
	 * Extrai categoria da query
	 * @param {string} query - Query do usuário
	 * @returns {string|null} - Categoria encontrada
	 */
	extractCategory(query) {
		for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
			if (pattern.test(query)) {
				return category;
			}
		}
		return null;
	}

	/**
	 * Processa resposta do Bridge para formato amigável
	 * @param {object} result - Resultado do Bridge
	 * @param {string} originalQuery - Query original
	 * @param {string} dataType - Tipo de dado
	 * @returns {object} - Resposta processada
	 */
	processResponse(result, originalQuery, dataType) {
		const processed = {
			success: true,
			source: 'FinanceBridge',
			formattedResponse: '',
			structured: result,
			comparison: null
		};
		
		// Formata baseado no tipo de ação
		switch (result.action) {
			case 'summary':
				processed.formattedResponse = this.formatSummary(result, dataType);
				break;
			case 'ranking':
				processed.formattedResponse = this.formatRanking(result);
				break;
			case 'list':
				processed.formattedResponse = this.formatList(result);
				break;
			default:
				processed.formattedResponse = this.formatGeneric(result);
		}
		
		return processed;
	}

	/**
	 * Formata resumo para texto
	 * @param {object} result - Resultado do Bridge
	 * @param {string} dataType - Tipo de dado
	 * @returns {string} - Texto formatado
	 */
	formatSummary(result, dataType) {
		// O Bridge retorna: { success, action, domain, period, summary, breakdown }
		// O summary contém: { totalIncome, totalExpense, netFlow, transactionCount, averageTransaction }
		const summary = result.summary || {};
		const period = result.period || {};
		let text = '';
		
		switch (dataType) {
			case 'GASTOS':
				text = `💸 **Despesas do período**: R$ ${this.formatCurrency(summary.totalExpense || 0)}`;
				if (summary.transactionCount) {
					const expenseCount = result.breakdown?.byType?.expense?.count || summary.transactionCount;
					text += ` (${expenseCount} transações)`;
				}
				break;
				
			case 'RECEITAS':
				text = `💰 **Receitas do período**: R$ ${this.formatCurrency(summary.totalIncome || 0)}`;
				if (summary.transactionCount) {
					const incomeCount = result.breakdown?.byType?.income?.count || summary.transactionCount;
					text += ` (${incomeCount} transações)`;
				}
				break;
				
			case 'SALDO':
			case 'PATRIMONIO':
			default:
				// Saldo padrão - mostra resumo completo
				text = `📊 **Resumo Financeiro do Mês**\n\n`;
				text += `💰 Receitas: R$ ${this.formatCurrency(summary.totalIncome || 0)}\n`;
				text += `💸 Despesas: R$ ${this.formatCurrency(summary.totalExpense || 0)}\n`;
				text += `\n📈 **Saldo: R$ ${this.formatCurrency(summary.netFlow || 0)}**`;
				
				if (summary.transactionCount) {
					text += `\n\n_${summary.transactionCount} transações no período_`;
				}
				break;
				
			case 'DIVIDAS':
				const debts = summary;
				text = `📋 **Dívidas**\n`;
				text += `• Total: R$ ${this.formatCurrency(debts.totalAmount || 0)}\n`;
				text += `• Ativas: ${debts.activeCount || 0} dívidas`;
				if (debts.overdueAmount) {
					text += `\n⚠️ Em atraso: R$ ${this.formatCurrency(debts.overdueAmount)}`;
				}
				break;
				
			case 'CARTAO':
				const cards = summary;
				text = `💳 **Cartões de Crédito**\n`;
				text += `• Fatura atual: R$ ${this.formatCurrency(cards.totalBill || 0)}\n`;
				text += `• Limite disponível: R$ ${this.formatCurrency(cards.availableLimit || 0)}`;
				break;
				
			case 'CONTAS':
				const scheduled = summary;
				text = `📅 **Contas Futuras**\n`;
				text += `• Total a pagar: R$ ${this.formatCurrency(scheduled.totalToPay || 0)}\n`;
				text += `• Próximos 7 dias: R$ ${this.formatCurrency(scheduled.next7Days || 0)}`;
				break;
		}
		
		return text;
	}

	/**
	 * Formata ranking para texto
	 * @param {object} result - Resultado do Bridge
	 * @returns {string} - Texto formatado
	 */
	formatRanking(result) {
		// Se tem breakdown por categoria, formata isso
		if (result.breakdown?.byCategory) {
			const categories = Object.entries(result.breakdown.byCategory)
				.filter(([_, data]) => data.total > 0)
				.sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
				.slice(0, 5); // Top 5
			
			if (categories.length === 0) {
				return '📊 Nenhuma despesa categorizada encontrada no período.';
			}
			
			let text = `📊 **TOP ${categories.length} CATEGORIAS**\n\n`;
			
			categories.forEach(([category, data], index) => {
				const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
				const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
				text += `${emoji} **${categoryName}**: R$ ${this.formatCurrency(Math.abs(data.total))}`;
				if (data.count) {
					text += ` _(${data.count} transações)_`;
				}
				text += `\n`;
			});
			
			return text.trim();
		}
		
		// Formato antigo - lista de items
		const items = result.items || [];
		if (items.length === 0) {
			return '📊 Nenhum registro encontrado para o período.';
		}
		
		let text = `📊 **TOP ${items.length} TRANSAÇÕES**\n\n`;
		
		items.forEach((item, index) => {
			const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
			text += `${emoji} ${item.description || item.name}: R$ ${this.formatCurrency(item.value || item.amount)}\n`;
		});
		
		return text.trim();
	}

	/**
	 * Formata lista para texto
	 * @param {object} result - Resultado do Bridge
	 * @returns {string} - Texto formatado
	 */
	formatList(result) {
		const data = result.data || [];
		if (data.length === 0) {
			return '📋 Nenhum registro encontrado.';
		}
		
		let text = `📋 **ÚLTIMAS ${data.length} TRANSAÇÕES**\n`;
		
		data.slice(0, 10).forEach(item => {
			const type = item.type === 'income' ? '💰' : '💸';
			const date = new Date(item.date).toLocaleDateString('pt-BR');
			text += `${type} ${date}: ${item.description} - ${this.formatCurrency(item.amount)}\n`;
		});
		
		if (data.length > 10) {
			text += `\n... e mais ${data.length - 10} transações`;
		}
		
		return text.trim();
	}

	/**
	 * Formata resposta genérica
	 * @param {object} result - Resultado do Bridge
	 * @returns {string} - Texto formatado
	 */
	formatGeneric(result) {
		if (result.summary) {
			return `📊 ${JSON.stringify(result.summary, null, 2)}`;
		}
		return '📊 Dados recuperados com sucesso.';
	}

	/**
	 * Formata valor monetário
	 * @param {number} value - Valor numérico
	 * @returns {string} - Valor formatado
	 */
	formatCurrency(value) {
		return value.toLocaleString('pt-BR', {
			style: 'currency',
			currency: 'BRL'
		});
	}

	/**
	 * Constrói resposta de fallback
	 * @param {string} query - Query original
	 * @param {object} memory - Contexto de memória
	 * @param {string} errorMsg - Mensagem de erro
	 * @returns {object} - Resposta de fallback
	 */
	buildFallbackResponse(query, memory, errorMsg) {
		logger.fallback(errorMsg, 'MEMORY_BASED');
		
		let response = {
			success: false,
			source: 'Fallback',
			textual: '',
			error: errorMsg
		};
		
		// Tenta usar memória recente
		if (memory?.recent?.length > 0) {
			// Busca menções a valores na memória recente
			const recentText = memory.recent.map(m => m.content).join(' ');
			const valueMatch = recentText.match(/R\$\s*[\d.,]+/);
			
			if (valueMatch) {
				response.textual = `⚠️ Estou tendo dificuldade para acessar seus dados no momento.\n\n`;
				response.textual += `Pela nossa conversa recente, você mencionou um valor de ${valueMatch[0]}.\n\n`;
				response.textual += `Posso tentar novamente ou você prefere fazer outra pergunta?`;
				response.hasMemoryContext = true;
			} else {
				response.textual = `⚠️ Desculpe, não consegui acessar seus dados financeiros no momento.\n\n`;
				response.textual += `Por favor, tente novamente em alguns instantes ou reformule sua pergunta.`;
			}
		} else {
			response.textual = `⚠️ Desculpe, houve um problema ao buscar seus dados.\n\n`;
			response.textual += `Por favor, tente novamente em alguns instantes.`;
		}
		
		return response;
	}

	/**
	 * Usa IA para construir query complexa (fallback)
	 * @param {string} query - Query do usuário
	 * @param {string} dataType - Tipo de dado
	 * @returns {Promise<object>} - Parâmetros extraídos
	 */
	async extractParamsWithAI(query, dataType) {
		const systemPrompt = `Extraia parâmetros da query para consulta financeira.

QUERY: "${query}"
TIPO: ${dataType}

Responda em JSON:
{
  "period": "mesAtual|mesAnterior|30d|7d|3m|anoAtual|custom",
  "type": "income|expense|all",
  "category": "string ou null",
  "action": "summary|list|ranking",
  "limit": "número ou null (se ranking)"
}`;

		try {
			return await callOpenAIJSON(systemPrompt, query, { max_output_tokens: 150 });
		} catch (error) {
			console.error('[FinanceBridgeConnector] Erro na extração IA:', error.message);
			return null;
		}
	}
}

// Instância singleton
const financeBridgeConnector = new FinanceBridgeConnector();

module.exports = {
	FinanceBridgeConnector,
	financeBridgeConnector,
	DATA_TYPE_TO_ACTION,
	PERIOD_EXTRACTION,
	CATEGORY_PATTERNS
};
