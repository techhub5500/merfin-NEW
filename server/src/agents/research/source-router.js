/**
 * NOTE (source-router.js):
 * Purpose: Roteador inteligente que decide quais APIs usar baseado na análise semântica.
 * Implementa decision tree, execução paralela/sequencial e sistema de fallback hierárquico.
 * Controls: buildPlan() cria plano, execute() executa com fallbacks.
 * Behavior: 4 níveis de fallback: cache recente → fonte alternativa → cache antigo → erro.
 * Integration notes: Usado pelo ResearchAgent após análise semântica.
 */

const SerperClient = require('./api-clients/serper-client');

/**
 * SourceRouter - Roteador Inteligente Multi-Fonte
 * 
 * Decision Tree:
 * - BRAPI: dados numéricos, tickers, fundamentalistas, dividendos
 * - TAVILY: contexto qualitativo, notícias, análises, causas
 * - SERPER: fatos triviais, descoberta de entidades, fallback
 * 
 * Modos de execução:
 * - PARALLEL: fontes independentes executam em paralelo
 * - SEQUENTIAL: fontes dependentes (ex: descobrir tickers → buscar dados)
 * 
 * Sistema de Fallback (4 níveis):
 * 1. Cache recente (< 24h dados / < 6h notícias)
 * 2. Fonte alternativa (Brapi→Serper, Tavily→Serper)
 * 3. Cache antigo (até 48h dados / 7 dias notícias)
 * 4. Erro estruturado
 */
class SourceRouter {
	/**
	 * @param {object} clients - Clientes de API
	 * @param {object} clients.brapiClient - Cliente Brapi
	 * @param {object} clients.tavilyClient - Cliente Tavily
	 * @param {object} clients.serperClient - Cliente Serper
	 * @param {object} clients.cache - CacheManager
	 * @param {object} clients.logger - ResearchLogger
	 */
	constructor({ brapiClient, tavilyClient, serperClient, cache, logger }) {
		this.brapi = brapiClient;
		this.tavily = tavilyClient;
		this.serper = serperClient;
		this.cache = cache;
		this.logger = logger;
	}

	/**
	 * Constrói plano de execução baseado na análise semântica
	 * @param {object} analysis - Resultado do RequestAnalyzer
	 * @param {object} options - Opções de execução
	 * @param {string} options.profundidade - 'basica', 'media', 'profunda'
	 * @param {boolean} options.priorizar_velocidade - Prioriza cache
	 * @param {string[]} options.fontes_preferidas - Força fontes específicas
	 * @returns {object} - Plano de execução
	 */
	buildPlan(analysis, options = {}) {
		const plan = {
			steps: [],
			executionMode: 'PARALLEL',
			analysis: analysis,
			options: options
		};

		const { fontes_preferidas } = options;

		// Se fontes forçadas, usa apenas elas
		if (fontes_preferidas && fontes_preferidas.length > 0) {
			for (const fonte of fontes_preferidas) {
				plan.steps.push(this._createStep(fonte.toUpperCase(), analysis, options));
			}
			return plan;
		}

		// Decision Tree automático
		const needsBrapi = this._needsBrapi(analysis);
		const needsTavily = this._needsTavily(analysis);
		const needsSerper = this._needsSerper(analysis);

		if (needsBrapi) {
			plan.steps.push(this._createBrapiStep(analysis, options));
		}

		if (needsTavily) {
			plan.steps.push(this._createTavilyStep(analysis, options));
		}

		if (needsSerper) {
			plan.steps.push(this._createSerperStep(analysis, options));
		}

		// Caso nenhuma regra seja acionada, usa Serper como fallback geral
		if (plan.steps.length === 0) {
			plan.steps.push(this._createSerperStep(analysis, options));
		}

		// Determina modo de execução
		plan.executionMode = this._determineExecutionMode(analysis, plan.steps);

		return plan;
	}

	/**
	 * Verifica se precisa de Brapi (dados estruturados)
	 * @private
	 */
	_needsBrapi(analysis) {
		const { entidades, tipo_informacao, keywords_criticas, indices, moedas } = analysis;

		// Tem tickers
		if (entidades && entidades.length > 0) {
			return true;
		}

		// Tem moedas ou índices
		if ((moedas && moedas.length > 0) || (indices && indices.length > 0)) {
			return true;
		}

		// Tipo numérico
		if (tipo_informacao && tipo_informacao.includes('numerica')) {
			return true;
		}

		// Keywords de dados estruturados
		const brapiKeywords = [
			'preço', 'cotação', 'valor', 'fechamento', 'abertura',
			'p/l', 'p/vp', 'roe', 'margem', 'lucro', 'receita',
			'dividendo', 'yield', 'dy', 'proventos',
			'selic', 'ipca', 'cdi', 'dólar', 'usd'
		];

		if (keywords_criticas && keywords_criticas.some(kw => 
			brapiKeywords.includes(kw.toLowerCase())
		)) {
			return true;
		}

		return false;
	}

	/**
	 * Verifica se precisa de Tavily (contexto qualitativo)
	 * @private
	 */
	_needsTavily(analysis) {
		const { tipo_informacao, intencao, keywords_criticas } = analysis;

		// Tipo qualitativo
		if (tipo_informacao && tipo_informacao.includes('qualitativa')) {
			return true;
		}

		// Intenções que requerem contexto
		const tavilyIntents = ['entender_causa', 'buscar_noticias', 'avaliacao'];
		if (intencao && intencao.some(i => tavilyIntents.includes(i))) {
			return true;
		}

		// Keywords de contexto
		const tavilyKeywords = [
			'por que', 'porque', 'motivo', 'razão', 'causa',
			'análise', 'opinião', 'visão', 'perspectiva',
			'notícia', 'novidade', 'aconteceu', 'anúncio',
			'tese', 'risco', 'oportunidade', 'recomendação'
		];

		if (keywords_criticas && keywords_criticas.some(kw => 
			tavilyKeywords.some(tk => kw.toLowerCase().includes(tk))
		)) {
			return true;
		}

		return false;
	}

	/**
	 * Verifica se precisa de Serper (fatos triviais)
	 * @private
	 */
	_needsSerper(analysis) {
		const { tipo_informacao, intencao, keywords_criticas, entidades } = analysis;

		// Tipo factual
		if (tipo_informacao && tipo_informacao.includes('factual')) {
			return true;
		}

		// Intenção de info básica
		if (intencao && intencao.includes('buscar_info_basica')) {
			return true;
		}

		// Keywords triviais
		const serperKeywords = [
			'sede', 'endereço', 'localização', 'onde fica',
			'fundação', 'quando foi fundada', 'história',
			'ceo', 'presidente', 'diretoria', 'quem é',
			'telefone', 'contato', 'email', 'site'
		];

		if (keywords_criticas && keywords_criticas.some(kw => 
			serperKeywords.some(sk => kw.toLowerCase().includes(sk))
		)) {
			return true;
		}

		// Precisa descobrir tickers (não tem entidades identificadas mas precisa)
		const needsEntityDiscovery = (!entidades || entidades.length === 0) && 
			intencao && intencao.includes('comparacao');
		
		if (needsEntityDiscovery) {
			return true;
		}

		return false;
	}

	/**
	 * Cria step genérico
	 * @private
	 */
	_createStep(fonte, analysis, options) {
		switch (fonte) {
			case 'BRAPI':
				return this._createBrapiStep(analysis, options);
			case 'TAVILY':
				return this._createTavilyStep(analysis, options);
			case 'SERPER':
				return this._createSerperStep(analysis, options);
			default:
				throw new Error(`Fonte desconhecida: ${fonte}`);
		}
	}

	/**
	 * Cria step para Brapi
	 * @private
	 */
	_createBrapiStep(analysis, options) {
		const { entidades, keywords_criticas, moedas, indices } = analysis;
		
		// Determina se precisa de dados adicionais
		const kwLower = (keywords_criticas || []).map(k => k.toLowerCase());
		const needsFundamental = kwLower.some(k => 
			['p/l', 'roe', 'margem', 'lucro', 'pvp', 'receita'].includes(k)
		);
		const needsDividends = kwLower.some(k => 
			['dividendo', 'yield', 'dy', 'proventos'].includes(k)
		);

		return {
			fonte: 'BRAPI',
			action: 'getQuote',
			params: {
				tickers: entidades || [],
				moedas: moedas || [],
				indices: indices || [],
				fundamental: needsFundamental,
				dividends: needsDividends,
				range: this._mapTimeWindowToRange(analysis.janela_temporal)
			}
		};
	}

	/**
	 * Cria step para Tavily
	 * @private
	 */
	_createTavilyStep(analysis, options) {
		const { entidades, keywords_criticas, janela_temporal } = analysis;
		
		// Constrói query otimizada
		let query = (keywords_criticas || []).join(' ');
		if (entidades && entidades.length > 0) {
			query = `${entidades[0]} ${query}`;
		}

		return {
			fonte: 'TAVILY',
			action: 'search',
			params: {
				query: query.trim(),
				depth: options.profundidade === 'profunda' ? 'advanced' : 'basic',
				timeRange: this._mapTimeWindowToTavilyRange(janela_temporal),
				maxResults: options.profundidade === 'basica' ? 3 : 5
			}
		};
	}

	/**
	 * Cria step para Serper
	 * @private
	 */
	_createSerperStep(analysis, options) {
		const { entidades, keywords_criticas } = analysis;
		
		// Constrói query
		let query = (keywords_criticas || []).join(' ');
		if (entidades && entidades.length > 0) {
			query = `${entidades.join(' ')} ${query}`;
		}

		return {
			fonte: 'SERPER',
			action: 'search',
			params: {
				query: query.trim() || 'mercado financeiro brasil',
				num: options.profundidade === 'basica' ? 3 : 5
			}
		};
	}

	/**
	 * Mapeia janela temporal para range do Brapi
	 * @private
	 */
	_mapTimeWindowToRange(window) {
		const map = {
			'ontem': '5d',
			'hoje': '1d',
			'semana': '1mo',
			'mes': '3mo',
			'trimestre': '6mo',
			'ano': '1y',
			'atual': '1d'
		};
		return map[window] || '1d';
	}

	/**
	 * Mapeia janela temporal para Tavily
	 * @private
	 */
	_mapTimeWindowToTavilyRange(window) {
		const map = {
			'ontem': 'day',
			'hoje': 'day',
			'semana': 'week',
			'mes': 'month',
			'ano': 'year',
			'atual': 'week'
		};
		return map[window] || 'week';
	}

	/**
	 * Determina modo de execução
	 * @private
	 */
	_determineExecutionMode(analysis, steps) {
		// Sequencial se precisa descobrir entidades antes de buscar dados
		const hasSerper = steps.some(s => s.fonte === 'SERPER');
		const hasBrapi = steps.some(s => s.fonte === 'BRAPI');
		const noEntities = !analysis.entidades || analysis.entidades.length === 0;

		if (hasSerper && hasBrapi && noEntities && 
			analysis.intencao && analysis.intencao.includes('comparacao')) {
			return 'SEQUENTIAL';
		}

		// Paralelo é o padrão
		return 'PARALLEL';
	}

	/**
	 * Executa plano de execução
	 * @param {object} plan - Plano criado por buildPlan()
	 * @returns {Promise<object[]>} - Resultados de cada step
	 */
	async execute(plan) {
		if (this.logger) {
			this.logger.decision('Executando plano', {
				modo: plan.executionMode,
				steps: plan.steps.length
			});
		}

		if (plan.executionMode === 'PARALLEL') {
			return await this._executeParallel(plan.steps);
		} else {
			return await this._executeSequential(plan.steps, plan.analysis);
		}
	}

	/**
	 * Executa steps em paralelo
	 * @private
	 */
	async _executeParallel(steps) {
		const promises = steps.map(step => this._executeStepWithFallback(step));
		const results = await Promise.allSettled(promises);

		return results.map((result, idx) => {
			if (result.status === 'fulfilled') {
				return result.value;
			} else {
				return {
					fonte: steps[idx].fonte,
					error: result.reason.message,
					fallback: false
				};
			}
		});
	}

	/**
	 * Executa steps sequencialmente
	 * @private
	 */
	async _executeSequential(steps, analysis) {
		const results = [];
		let enrichedAnalysis = { ...analysis };

		for (const step of steps) {
			// Enriquece step com dados dos steps anteriores
			const enrichedStep = this._enrichStep(step, enrichedAnalysis, results);
			
			const result = await this._executeStepWithFallback(enrichedStep);
			results.push(result);

			// Extrai entidades descobertas para próximos steps
			if (step.fonte === 'SERPER' && result.data) {
				const discoveredTickers = this._extractTickersFromSerper(result.data);
				if (discoveredTickers.length > 0) {
					enrichedAnalysis = {
						...enrichedAnalysis,
						entidades: [...(enrichedAnalysis.entidades || []), ...discoveredTickers]
					};
				}
			}
		}

		return results;
	}

	/**
	 * Enriquece step com dados de steps anteriores
	 * @private
	 */
	_enrichStep(step, analysis, previousResults) {
		// Se é Brapi e não tinha tickers, mas agora tem
		if (step.fonte === 'BRAPI' && 
			(!step.params.tickers || step.params.tickers.length === 0) &&
			analysis.entidades && analysis.entidades.length > 0) {
			return {
				...step,
				params: {
					...step.params,
					tickers: analysis.entidades
				}
			};
		}
		return step;
	}

	/**
	 * Extrai tickers de resultado do Serper
	 * @private
	 */
	_extractTickersFromSerper(data) {
		const tickers = new Set();
		const tickerRegex = /\b([A-Z]{4}\d{1,2})\b/g;

		// Procura em snippets e títulos
		const searchIn = [
			...(data.resultados || []).map(r => `${r.title} ${r.snippet}`),
			...(data.noticias || []).map(n => `${n.title} ${n.snippet}`)
		];

		for (const text of searchIn) {
			const matches = text.match(tickerRegex);
			if (matches) {
				matches.forEach(t => tickers.add(t));
			}
		}

		return Array.from(tickers);
	}

	/**
	 * Executa step com sistema de fallback hierárquico
	 * @private
	 */
	async _executeStepWithFallback(step) {
		const { fonte, action, params } = step;

		try {
			return await this._executeStep(step);
		} catch (primaryError) {
			if (this.logger) {
				this.logger.decision(`${fonte} primário falhou`, {
					erro: primaryError.message
				});
			}

			// FALLBACK NÍVEL 1: Cache recente
			const cacheResult = await this._tryFallbackCache(step, false);
			if (cacheResult) {
				if (this.logger) {
					this.logger.logFallback(fonte, 1, true);
				}
				return cacheResult;
			}

			// FALLBACK NÍVEL 2: Fonte alternativa
			try {
				const altResult = await this._tryFallbackAlternativeSource(step);
				if (altResult) {
					if (this.logger) {
						this.logger.logFallback(fonte, 2, true);
					}
					return altResult;
				}
			} catch (altError) {
				if (this.logger) {
					this.logger.decision(`Fallback L2 para ${fonte} falhou`, {
						erro: altError.message
					});
				}
			}

			// FALLBACK NÍVEL 3: Cache antigo
			const oldCacheResult = await this._tryFallbackCache(step, true);
			if (oldCacheResult) {
				if (this.logger) {
					this.logger.logFallback(fonte, 3, true);
				}
				return oldCacheResult;
			}

			// FALLBACK NÍVEL 4: Erro estruturado
			if (this.logger) {
				this.logger.logFallback(fonte, 4, false);
			}

			return {
				fonte,
				error: primaryError.message,
				fallback: true,
				advertencia: `Todas as fontes falharam para ${fonte}: ${primaryError.message}`,
				diagnostico: {
					fonte_primaria: fonte,
					erro_original: primaryError.message,
					tentativas: ['cache_recente', 'fonte_alternativa', 'cache_antigo'],
					sugestao: 'Tente novamente em alguns minutos'
				}
			};
		}
	}

	/**
	 * Executa step individual
	 * @private
	 */
	async _executeStep(step) {
		const { fonte, action, params } = step;

		switch (fonte) {
			case 'BRAPI':
				return await this._executeBrapi(params);
			case 'TAVILY':
				return await this.tavily.search(params.query, params);
			case 'SERPER':
				return await this.serper.search(params.query, params);
			default:
				throw new Error(`Fonte desconhecida: ${fonte}`);
		}
	}

	/**
	 * Executa chamada Brapi
	 * @private
	 */
	async _executeBrapi(params) {
		const { tickers, moedas, indices, ...options } = params;

		// Se tem tickers, busca cotações
		if (tickers && tickers.length > 0) {
			return await this.brapi.getQuote(tickers, options);
		}

		// Se tem moedas, busca câmbio
		if (moedas && moedas.length > 0) {
			const currency = moedas[0].replace('/', '-');
			return await this.brapi.getCurrency(currency);
		}

		// Se tem índices (SELIC, IPCA)
		if (indices && indices.length > 0) {
			if (indices.includes('SELIC')) {
				return await this.brapi.getPrimeRate();
			}
			if (indices.some(i => ['IPCA', 'IGP-M', 'IGPM'].includes(i))) {
				return await this.brapi.getInflation();
			}
		}

		throw new Error('Brapi: Nenhum ticker, moeda ou índice especificado');
	}

	/**
	 * Tenta fallback via cache
	 * @private
	 */
	async _tryFallbackCache(step, allowExpired) {
		if (!this.cache) return null;

		const cacheKey = this._generateStepCacheKey(step);
		const cached = await this.cache.get(cacheKey, { ignoreExpiration: allowExpired });
		
		if (cached) {
			return {
				...cached,
				fallback: true,
				advertencia: allowExpired 
					? `Dados de cache antigo (${cached._ageHours}h) - fonte primária indisponível`
					: `Dados de cache recente (${cached._ageHours}h)`
			};
		}

		return null;
	}

	/**
	 * Tenta fallback via fonte alternativa
	 * @private
	 */
	async _tryFallbackAlternativeSource(step) {
		const { fonte, params } = step;

		// Brapi → Serper
		if (fonte === 'BRAPI') {
			const query = (params.tickers || []).join(' ') + ' cotação preço brasil';
			const result = await this.serper.search(query, { num: 5 });
			return {
				...result,
				fallback: true,
				advertencia: 'Dados de fonte alternativa (Serper) - Brapi indisponível'
			};
		}

		// Tavily → Serper
		if (fonte === 'TAVILY') {
			const result = await this.serper.search(params.query, { 
				num: 5,
				timeRange: SerperClient.timeRangeToTbs(params.timeRange)
			});
			return {
				...result,
				fallback: true,
				advertencia: 'Dados de fonte alternativa (Serper) - Tavily indisponível'
			};
		}

		// Serper não tem fallback (é o último recurso)
		return null;
	}

	/**
	 * Gera cache key para step
	 * @private
	 */
	_generateStepCacheKey(step) {
		const { fonte, params } = step;
		const paramsStr = JSON.stringify(params);
		return `step:${fonte}:${paramsStr}`;
	}
}

module.exports = SourceRouter;
