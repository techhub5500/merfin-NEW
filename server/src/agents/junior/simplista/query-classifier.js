/**
 * NOTE (query-classifier.js):
 * Purpose: Classificação rápida de queries para o Agente Simplista.
 * Design: Detecção baseada em regex (70%) + IA para casos ambíguos (30%).
 * 
 * RESPONSABILIDADES:
 * - Detectar ambiguidade (falta período, categoria, conta)
 * - Identificar necessidade de dados internos (FinanceBridge)
 * - Identificar necessidade de dados externos (Serper)
 * - Detectar transição para análise complexa
 * 
 * MUDANÇA DO PLANO: Uso híbrido regex + IA apenas quando necessário,
 * para manter velocidade de resposta < 3s
 */

const { callOpenAIJSON } = require('../../../config/openai-config');

/**
 * Padrões para detecção de dados internos (FinanceBridge)
 */
const FINANCE_PATTERNS = {
	SALDO: /\b(saldo|quanto\s+tenho|dispon[íi]vel|sobrou)\b/i,
	GASTOS: /\b(gastei|despesas?|sa[íi]das?|gastos?)\b/i,
	RECEITAS: /\b(recebi|entradas?|sal[áa]rio|rendimentos?)\b/i,
	DIVIDAS: /\b(d[íi]vidas?|devo|d[ée]bitos?|devendo)\b/i,
	INVESTIMENTOS: /\b(investido|investimentos?|aplica[çc][ãõo]|carteira|investir)\b/i,
	CONTAS: /\b(contas?|pagar|vence[mr]?|vencimento)\b/i,
	PATRIMONIO: /\b(patrim[ôo]nio|l[íi]quido|total\s+de)\b/i,
	RESERVA: /\b(reserva|emerg[êe]ncia)\b/i,
	CARTAO: /\b(cart[ãa]o|cr[ée]dito|fatura)\b/i,
	EXTRATO: /\b(extrato|movimenta[çc][ãõo]es?|transa[çc][ãõo]es?)\b/i
};

/**
 * Padrões para detecção de dados externos (Serper)
 */
const EXTERNAL_PATTERNS = {
	COTACAO: /\b(cota[çc][ãa]o|pre[çc]o|quanto\s+(est[áa]|custa)|valor\s+de|a[çc][ãa]o|a[çc][ões]es)\b/i,
	INDICADORES: /\b(p\/l|p\/e|roe|dividend|dy|margem|lucro)\b/i,
	MOEDA: /\b(d[óo]lar|euro|real|c[âa]mbio|usd|eur|brl)\b/i,
	INDICES: /\b(selic|ipca|cdi|ibovespa|sp500|s&p|nasdaq|dow\s*jones)\b/i,
	FATOS: /\b(sede|ceo|fundad[ao]|empresa|quem\s+[ée]|quando\s+foi)\b/i,
	TICKER: /\b[A-Z]{4}[0-9]{1,2}\b/i  // PETR4, VALE3, etc.
};

/**
 * Padrões para detecção de transição para complexo
 */
const COMPLEX_PATTERNS = [
	/\b(analis[ea]r?|an[áa]lise)\s+(completa|detalhada|profunda)\b/i,
	/\b(planej[ea]r?|monte\s+um\s+plano)\b/i,
	/\b(estrat[ée]gia|estrat[ée]gico)\b/i,
	/\b(como\s+devo|o\s+que\s+(devo\s+)?fazer)\b/i,
	/\b(recomen[ds][ea]?|sugira?|sugest[ãa]o)\b/i,
	/\b(monte\s+uma?\s+carteira)\b/i,
	/\b(melhor\s+investimento|onde\s+investir)\b/i,
	/\b(por\s+qu[eê]|motivo|explicar?)\b/i,
	/\b(proje[çc][ãa]o|prever|futuro)\b/i
];

/**
 * Padrões de período explícito
 */
const PERIOD_PATTERNS = [
	/\b(este|esse|neste|nesse)\s+m[êe]s\b/i,
	/\b([úu]ltimo|passado)\s+m[êe]s\b/i,
	/\b(este|esse)\s+ano\b/i,
	/\b([úu]ltimos?)\s+(\d+)\s+(dias?|semanas?|meses?|anos?)\b/i,
	/\b(hoje|ontem|esta\s+semana)\b/i,
	/\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i,
	/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/  // Datas
];

/**
 * QueryClassifier - Classificador de queries para Simplista
 */
class QueryClassifier {
	constructor() {
		this.financePatterns = FINANCE_PATTERNS;
		this.externalPatterns = EXTERNAL_PATTERNS;
		this.complexPatterns = COMPLEX_PATTERNS;
		this.periodPatterns = PERIOD_PATTERNS;
	}

	/**
	 * Classifica query completa
	 * @param {string} query - Query do usuário
	 * @param {object} memory - Contexto de memória (opcional)
	 * @returns {object} - Resultado da classificação
	 */
	async classify(query, memory = null) {
		// Classificação rápida baseada em regex
		const needsFinance = this.needsFinanceData(query);
		const needsExternal = this.needsExternalData(query);
		const isTransition = this.isTransitionToComplex(query);
		
		// Verifica ambiguidade apenas se precisa de dados
		let isAmbiguous = false;
		let ambiguityType = null;
		let clarificationNeeded = null;
		
		if (needsFinance.needed && !isTransition) {
			const ambiguityCheck = this.checkAmbiguity(query, memory);
			isAmbiguous = ambiguityCheck.ambiguous;
			ambiguityType = ambiguityCheck.type;
			clarificationNeeded = ambiguityCheck.clarification;
		}
		
		// Determina tipo de dado principal
		const type = needsFinance.dataType || needsExternal.dataType || 'UNKNOWN';
		
		// Determina fontes a consultar
		const sources = [];
		if (needsFinance.needed) sources.push('INTERNAL');
		if (needsExternal.needed) sources.push('EXTERNAL');
		
		// Determina se precisa transicionar
		const transitionTo = isTransition ? 'COMPLEXA' : null;
		
		return {
			// Campos novos (compatíveis com simplista-agent)
			type,
			sources,
			transitionTo,
			confidence: 0.8, // Classificação por regex tem boa confiança
			
			// Campos originais (mantidos para compatibilidade)
			needsFinance: needsFinance.needed,
			financeDataType: needsFinance.dataType,
			needsExternal: needsExternal.needed,
			externalDataType: needsExternal.dataType,
			isAmbiguous,
			ambiguityType,
			clarificationNeeded,
			canProceedWithDefault: !isAmbiguous || this.hasPeriod(query),
			hasPeriod: this.hasPeriod(query)
		};
	}

	/**
	 * Verifica se query precisa de dados internos (FinanceBridge)
	 * @param {string} query - Query do usuário
	 * @returns {object} - { needed: boolean, dataType: string|null }
	 */
	needsFinanceData(query) {
		for (const [type, pattern] of Object.entries(this.financePatterns)) {
			if (pattern.test(query)) {
				return { needed: true, dataType: type };
			}
		}
		return { needed: false, dataType: null };
	}

	/**
	 * Verifica se query precisa de dados externos (Serper)
	 * @param {string} query - Query do usuário
	 * @returns {object} - { needed: boolean, dataType: string|null }
	 */
	needsExternalData(query) {
		for (const [type, pattern] of Object.entries(this.externalPatterns)) {
			if (pattern.test(query)) {
				return { needed: true, dataType: type };
			}
		}
		return { needed: false, dataType: null };
	}

	/**
	 * Verifica se query indica transição para análise complexa
	 * @param {string} query - Query do usuário
	 * @returns {boolean}
	 */
	isTransitionToComplex(query) {
		return this.complexPatterns.some(pattern => pattern.test(query));
	}

	/**
	 * Verifica se query tem período explícito
	 * @param {string} query - Query do usuário
	 * @returns {boolean}
	 */
	hasPeriod(query) {
		return this.periodPatterns.some(pattern => pattern.test(query));
	}

	/**
	 * Verifica ambiguidade da query
	 * @param {string} query - Query do usuário
	 * @param {object} memory - Contexto de memória
	 * @returns {object} - { ambiguous: boolean, type: string, clarification: string }
	 */
	checkAmbiguity(query, memory = null) {
		// Verifica se tem período
		const hasPeriod = this.hasPeriod(query);
		
		// Se não tem período e precisa de dados históricos
		const needsHistorical = /\b(gastei|recebi|total|quanto)\b/i.test(query);
		
		if (needsHistorical && !hasPeriod) {
			// Verifica se memória tem contexto recente de período
			if (memory?.recent?.length > 0) {
				const recentContext = memory.recent.map(m => m.content).join(' ');
				if (this.hasPeriod(recentContext)) {
					// Período está no contexto recente, não é ambíguo
					return { ambiguous: false, type: null, clarification: null };
				}
			}
			
			return {
				ambiguous: true,
				type: 'PERIOD',
				clarification: 'Qual período você quer consultar? Este mês, último mês ou outro?'
			};
		}
		
		// Query sobre saldo de conta específica
		const askingBalance = /\b(saldo|quanto\s+tenho)\b/i.test(query);
		const hasAccountSpec = /\b(corrente|poupan[çc]a|investimento|cart[ãa]o)\b/i.test(query);
		
		if (askingBalance && !hasAccountSpec && !this.needsExternalData(query).needed) {
			// Verifica se é genérico ou tem contexto
			const isGeneric = /^(qual\s+)?meu\s+saldo\??$/i.test(query.trim());
			if (isGeneric && !memory?.recent?.length) {
				return {
					ambiguous: true,
					type: 'ACCOUNT',
					clarification: 'Saldo de qual conta? Corrente, poupança ou total em investimentos?'
				};
			}
		}
		
		return { ambiguous: false, type: null, clarification: null };
	}

	/**
	 * Detecta domínio sugerido para transição
	 * @param {string} query - Query do usuário
	 * @returns {string} - Domínio sugerido
	 */
	getSuggestedDomain(query) {
		if (/\b(investir?|a[çc][ãõ]es?|carteira|fundos?)\b/i.test(query)) {
			return 'investimentos';
		}
		if (/\b(planej[ao]|plano|meta|objetivo)\b/i.test(query)) {
			return 'planejamentos';
		}
		return 'analises';
	}

	/**
	 * Extrai entidades da query (tickers, moedas, etc)
	 * @param {string} query - Query do usuário
	 * @returns {object} - Entidades encontradas
	 */
	extractEntities(query) {
		const entities = {
			tickers: [],
			currencies: [],
			indices: []
		};
		
		// Tickers (PETR4, VALE3, etc)
		const tickerMatches = query.match(/\b[A-Z]{4}[0-9]{1,2}\b/gi);
		if (tickerMatches) {
			entities.tickers = tickerMatches.map(t => t.toUpperCase());
		}
		
		// Moedas
		if (/\b(d[óo]lar|usd)\b/i.test(query)) entities.currencies.push('USD');
		if (/\b(euro|eur)\b/i.test(query)) entities.currencies.push('EUR');
		
		// Índices
		if (/\bselic\b/i.test(query)) entities.indices.push('SELIC');
		if (/\bipca\b/i.test(query)) entities.indices.push('IPCA');
		if (/\bcdi\b/i.test(query)) entities.indices.push('CDI');
		if (/\bibovespa\b/i.test(query)) entities.indices.push('IBOVESPA');
		
		return entities;
	}

	/**
	 * Usa IA para casos muito ambíguos (fallback)
	 * @param {string} query - Query do usuário
	 * @param {object} memory - Contexto de memória
	 * @returns {Promise<object>} - Classificação por IA
	 */
	async classifyWithAI(query, memory = null) {
		const systemPrompt = `Analise a query financeira e classifique:

QUERY: "${query}"
${memory?.summary ? `CONTEXTO: ${memory.summary}` : ''}

Responda em JSON:
{
  "needsInternalData": boolean,
  "internalDataType": "SALDO|GASTOS|RECEITAS|DIVIDAS|INVESTIMENTOS|CONTAS|null",
  "needsExternalData": boolean,
  "externalDataType": "COTACAO|MOEDA|INDICES|FATOS|null",
  "isAmbiguous": boolean,
  "ambiguityType": "PERIOD|CATEGORY|ACCOUNT|null",
  "clarification": "pergunta para esclarecer ou null",
  "isComplexTransition": boolean
}`;

		try {
			const result = await callOpenAIJSON(
				systemPrompt,
				query,
				{ max_output_tokens: 200 }
			);
			return result;
		} catch (error) {
			console.error('[QueryClassifier] Erro na classificação IA:', error.message);
			// Fallback para classificação regex
			return this.classify(query, memory);
		}
	}
}

// Instância singleton
const queryClassifier = new QueryClassifier();

module.exports = {
	QueryClassifier,
	queryClassifier,
	FINANCE_PATTERNS,
	EXTERNAL_PATTERNS,
	COMPLEX_PATTERNS
};
