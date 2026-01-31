/**
 * NOTE (research-agent.js):
 * Purpose: Agente executor especializado em coleta inteligente de dados externos de mercado
 * financeiro através de múltiplas fontes (Brapi, Tavily, Serper).
 * Controls: Operação principal: pesquisa_mercado_financeiro. Requer objetivo e contexto.
 * Behavior: Análise semântica híbrida (regex 70% + IA 30%), roteamento inteligente multi-fonte,
 * execução paralela com fallback hierárquico, cache com fingerprinting.
 * Integration notes: Recebe requisições de outros agentes (ex: InvestmentAgent), retorna
 * dados consolidados. Usa GPT-5 mini apenas para casos ambíguos.
 */

const BaseAgent = require('../shared/base-agent');
const RequestAnalyzer = require('./request-analyzer');
const SourceRouter = require('./source-router');
const CacheManager = require('./cache-manager');
const DataValidator = require('./data-validator');
const ResearchLogger = require('./research-logger');

/**
 * ResearchAgent - Agente de Pesquisa Externa
 * 
 * Executor operacional especializado em coleta de dados externos através de:
 * - Brapi (dados estruturados: preços, fundamentalistas, dividendos)
 * - Tavily (contexto qualitativo: notícias, análises, causas)
 * - Serper (fatos triviais: sede, fundação, informações administrativas)
 * 
 * Características principais:
 * - Análise semântica híbrida (regex + IA seletiva)
 * - Roteamento inteligente baseado em tipo de informação
 * - Execução paralela quando possível
 * - Sistema de fallback em 4 níveis
 * - Cache inteligente com fingerprinting
 * - Circuit breaker por API
 */
class ResearchAgent extends BaseAgent {
	/**
	 * @param {object} config - Configurações do agente
	 * @param {string} config.logLevel - Nível de log: 'CRITICAL', 'DECISION', 'VERBOSE'
	 * @param {boolean} config.enableAI - Habilitar IA para casos ambíguos (default: true)
	 * @param {number} config.defaultTimeout - Timeout padrão em ms (default: 20000)
	 */
	constructor(config = {}) {
		super('ResearchAgent', config);
		
		// Configurações com defaults
		this.enableAI = config.enableAI !== false;
		this.defaultTimeout = config.defaultTimeout || 20000;
		
		// Inicializa componentes
		this.logger = new ResearchLogger({ logLevel: config.logLevel || 'DECISION' });
		this.analyzer = new RequestAnalyzer({ enableAI: this.enableAI });
		this.cache = new CacheManager();
		this.validator = new DataValidator();
		this.router = null; // Inicializado em _initializeRouter()
		
		// Mapeamento de ações
		this.actionMap = {
			pesquisa_mercado_financeiro: this.pesquisaMercadoFinanceiro.bind(this)
		};
		
		// Inicialização lazy do router (para evitar dependências circulares)
		this._routerInitialized = false;
	}

	/**
	 * Inicializa o router com os clientes de API
	 * @private
	 */
	_initializeRouter() {
		if (this._routerInitialized) return;
		
		const BrapiClient = require('./api-clients/brapi-client');
		const TavilyClient = require('./api-clients/tavily-client');
		const SerperClient = require('./api-clients/serper-client');
		
		this.router = new SourceRouter({
			brapiClient: new BrapiClient(),
			tavilyClient: new TavilyClient(),
			serperClient: new SerperClient(),
			cache: this.cache,
			logger: this.logger
		});
		
		this._routerInitialized = true;
		this.logger.verbose('Router inicializado com sucesso');
	}

	/**
	 * Método principal de execução (herdado de BaseAgent)
	 * @param {object} request - Requisição no formato padrão
	 * @returns {Promise<object>} - Resultado da pesquisa
	 */
	async execute(request) {
		const { action, parameters, context } = request;

		// Valida se a ação é suportada
		if (!this.actionMap[action]) {
			const validActions = Object.keys(this.actionMap).join(', ');
			throw new Error(
				`Ação "${action}" não suportada pelo ResearchAgent. ` +
				`Ações válidas: ${validActions}`
			);
		}

		this._log('info', `Executando ação: ${action}`);
		return await this.actionMap[action](parameters, context);
	}

	/**
	 * Operação principal: pesquisa_mercado_financeiro
	 * 
	 * Coleta dados de mercado, fundamentos, notícias e contextos sobre ativos,
	 * economia e mercado financeiro.
	 * 
	 * @param {object} params - Parâmetros da pesquisa
	 * @param {string} params.objetivo - Descrição clara do que precisa ser pesquisado
	 * @param {string} params.contexto - Contexto adicional para melhorar precisão
	 * @param {string[]} [params.tickers] - Lista de tickers se aplicável
	 * @param {string} [params.periodo] - Período temporal (ex: 'ontem', 'última semana')
	 * @param {string} [params.profundidade='media'] - Nível: 'basica', 'media', 'profunda'
	 * @param {boolean} [params.priorizar_velocidade=false] - Prioriza cache e respostas rápidas
	 * @param {string[]} [params.fontes_preferidas] - Força uso de fontes específicas
	 * @param {object} context - Contexto da requisição
	 * @returns {Promise<object>} - Dados consolidados de múltiplas fontes
	 */
	async pesquisaMercadoFinanceiro(params, context = {}) {
		const startTime = Date.now();
		
		// Valida parâmetros obrigatórios
		if (!params.objetivo) {
			throw new Error('Parâmetro "objetivo" é obrigatório');
		}
		if (!params.contexto) {
			throw new Error('Parâmetro "contexto" é obrigatório');
		}

		// Inicializa router se necessário
		this._initializeRouter();

		const {
			objetivo,
			contexto,
			tickers = [],
			periodo,
			profundidade = 'media',
			priorizar_velocidade = false,
			fontes_preferidas
		} = params;

		// 1. VERIFICAR CACHE PRIMEIRO
		const cacheKey = this.cache.generateFingerprint({ objetivo, contexto, tickers });
		
		if (priorizar_velocidade) {
			const cached = await this.cache.get(cacheKey);
			if (cached) {
				this.logger.logCacheHit(cacheKey, cached._ageHours || 0);
				return this._formatResponse(cached, startTime, true);
			}
		}

		this.logger.logCacheMiss(cacheKey);

		// 2. ANÁLISE SEMÂNTICA (Regex + IA seletiva)
		const analysis = await this.analyzer.analyze({ objetivo, contexto, tickers });
		this.logger.logRequest(params, analysis);

		// 3. CONSTRUIR PLANO DE EXECUÇÃO
		const executionPlan = this.router.buildPlan(analysis, {
			profundidade,
			priorizar_velocidade,
			fontes_preferidas
		});
		this.logger.logRouting(executionPlan);

		// 4. EXECUTAR PLANO (paralelo ou sequencial)
		const results = await this.router.execute(executionPlan);

		// 5. VALIDAR DADOS RETORNADOS
		const validatedResults = this._validateResults(results);

		// 6. CONSOLIDAR RESULTADOS
		const consolidated = this._consolidate(validatedResults, analysis);

		// 7. SALVAR NO CACHE
		const ttl = this._getTTL(analysis.tipo_informacao, analysis.keywords_criticas);
		await this.cache.set(cacheKey, consolidated, ttl);

		// 8. RETORNAR RESPOSTA FORMATADA
		return this._formatResponse(consolidated, startTime, false);
	}

	/**
	 * Valida resultados de cada fonte usando DataValidator
	 * @private
	 */
	_validateResults(results) {
		return results.map(result => {
			if (!result || result.error) {
				return result; // Mantém erros para tratamento posterior
			}

			const validation = this.validator.validate(result.fonte, result.data);
			if (!validation.valid) {
				this.logger.decision(`Validação falhou para ${result.fonte}`, {
					erro: validation.error
				});
				return {
					...result,
					validationError: validation.error
				};
			}

			return result;
		});
	}

	/**
	 * Consolida dados de múltiplas fontes em resposta unificada
	 * @private
	 */
	_consolidate(results, analysis) {
		const consolidated = {
			dados_consolidados: {},
			fontes_usadas: [],
			timestamp: new Date().toISOString(),
			advertencias: [],
			metadados: {
				total_fontes_planejadas: results.length,
				fontes_primarias: 0,
				fontes_fallback: 0,
				fontes_com_erro: 0,
				analise_usou_ia: analysis._aiUsed || false,
				tokens_ia: analysis._aiTokens || 0
			}
		};

		for (const result of results) {
			// Tratamento de erros
			if (!result) continue;
			
			if (result.error) {
				consolidated.metadados.fontes_com_erro++;
				consolidated.advertencias.push(`${result.fonte || 'Fonte desconhecida'} falhou: ${result.error}`);
				continue;
			}

			if (result.validationError) {
				consolidated.advertencias.push(`${result.fonte} retornou dados inválidos: ${result.validationError}`);
			}

			// Contabiliza fontes
			consolidated.fontes_usadas.push(result.fonte);
			
			if (result.fallback) {
				consolidated.metadados.fontes_fallback++;
				consolidated.advertencias.push(result.advertencia);
			} else {
				consolidated.metadados.fontes_primarias++;
			}

			// Merge de dados por tipo de fonte
			this._mergeSourceData(consolidated.dados_consolidados, result);
		}

		// Validação de completude
		if (consolidated.fontes_usadas.length === 0) {
			consolidated.advertencias.push('CRÍTICO: Nenhuma fonte retornou dados válidos');
		}

		return consolidated;
	}

	/**
	 * Faz merge dos dados de uma fonte no objeto consolidado
	 * @private
	 */
	_mergeSourceData(target, result) {
		switch (result.fonte) {
			case 'BRAPI':
				target.dados_estruturados = {
					...(target.dados_estruturados || {}),
					...this._normalizeBrapiData(result.data)
				};
				break;

			case 'TAVILY':
				target.contexto_qualitativo = {
					resposta_ia: result.data?.resposta_ia,
					fontes_noticias: (result.data?.resultados || []).slice(0, 5).map(r => ({
						titulo: r.titulo,
						url: r.url,
						conteudo: r.conteudo?.substring(0, 300),
						score: r.score,
						data_publicacao: r.data_publicacao
					}))
				};
				break;

			case 'SERPER':
				target.informacoes_adicionais = {
					knowledge_graph: result.data?.knowledge_graph,
					resultados: (result.data?.resultados || []).slice(0, 3).map(r => ({
						titulo: r.title,
						snippet: r.snippet,
						url: r.link
					})),
					noticias: (result.data?.noticias || []).slice(0, 3)
				};
				break;

			default:
				// Fonte desconhecida: adiciona em 'outros'
				target.outros = target.outros || [];
				target.outros.push(result.data);
		}
	}

	/**
	 * Normaliza dados do Brapi para formato consistente
	 * @private
	 */
	_normalizeBrapiData(data) {
		if (!data || !Array.isArray(data)) return {};

		return {
			ativos: data.map(item => ({
				ticker: item.symbol,
				nome: item.shortName || item.longName,
				preco_atual: item.regularMarketPrice,
				variacao_percentual: item.regularMarketChangePercent,
				variacao_absoluta: item.regularMarketChange,
				preco_maximo: item.regularMarketDayHigh,
				preco_minimo: item.regularMarketDayLow,
				volume: item.regularMarketVolume,
				market_cap: item.marketCap,
				// Fundamentalistas (se disponível)
				pl: item.priceEarnings,
				pvp: item.priceToBook,
				roe: item.returnOnEquity,
				dividend_yield: item.dividendYield,
				lpa: item.earningsPerShare,
				// Metadata
				ultima_atualizacao: item.regularMarketTime,
				logo: item.logourl
			}))
		};
	}

	/**
	 * Calcula TTL dinâmico baseado no tipo de informação
	 * @private
	 */
	_getTTL(tipoInfo, keywords = []) {
		// TTL em segundos
		const TTL_BASE = {
			'preco_tempo_real': 5 * 60 * 60,        // 5 horas
			'indicador_diario': 5 * 60 * 60,        // 5 horas (SELIC, IPCA)
			'moeda': 5 * 60 * 60,                   // 5 horas (USD/BRL)
			'cripto': 5 * 60 * 60,                  // 5 horas (BTC)
			'dividendo_atual': 24 * 60 * 60,        // 24 horas
			'fundamentalista': 24 * 60 * 60,        // 24 horas (P/L, ROE)
			'noticias': 6 * 60 * 60,                // 6 horas
			'historico_semanal': 24 * 60 * 60,      // 24 horas
			'historico_anual': 3 * 24 * 60 * 60,    // 3 dias
			'fato_trivial': 3 * 24 * 60 * 60        // 3 dias (sede, fundação)
		};

		// Keywords de alta prioridade para tipos específicos
		const keywordLower = (keywords || []).map(k => k.toLowerCase());

		if (keywordLower.some(kw => ['preço', 'cotação', 'valor', 'alta', 'baixa'].includes(kw))) {
			return TTL_BASE.preco_tempo_real;
		}
		if (keywordLower.some(kw => ['selic', 'ipca', 'cdi'].includes(kw))) {
			return TTL_BASE.indicador_diario;
		}
		if (keywordLower.some(kw => ['dólar', 'euro', 'usd', 'eur'].includes(kw))) {
			return TTL_BASE.moeda;
		}
		if (keywordLower.some(kw => ['btc', 'bitcoin', 'eth', 'cripto'].includes(kw))) {
			return TTL_BASE.cripto;
		}
		if (keywordLower.some(kw => ['dividendo', 'yield', 'dy', 'proventos'].includes(kw))) {
			return TTL_BASE.dividendo_atual;
		}
		if (keywordLower.some(kw => ['p/l', 'roe', 'margem', 'pvp', 'lucro'].includes(kw))) {
			return TTL_BASE.fundamentalista;
		}
		if (keywordLower.some(kw => ['notícia', 'análise', 'por que', 'motivo'].includes(kw))) {
			return TTL_BASE.noticias;
		}
		if (keywordLower.some(kw => ['sede', 'fundação', 'ceo', 'endereço'].includes(kw))) {
			return TTL_BASE.fato_trivial;
		}

		// Fallback baseado no tipo de informação
		const tipoArray = Array.isArray(tipoInfo) ? tipoInfo : [tipoInfo];
		if (tipoArray.includes('numerica')) {
			return TTL_BASE.preco_tempo_real;
		}
		if (tipoArray.includes('qualitativa')) {
			return TTL_BASE.noticias;
		}
		if (tipoArray.includes('factual')) {
			return TTL_BASE.fato_trivial;
		}

		// Default: 24 horas
		return 24 * 60 * 60;
	}

	/**
	 * Formata resposta final com metadados de execução
	 * @private
	 */
	_formatResponse(data, startTime, fromCache) {
		const executionTime = Date.now() - startTime;

		// Log de estatísticas da sessão
		this.logger.decision('Pesquisa concluída', {
			tempo_execucao_ms: executionTime,
			fonte_cache: fromCache,
			fontes_usadas: data.fontes_usadas?.length || 0,
			advertencias: data.advertencias?.length || 0
		});

		return {
			...data,
			_metadados_execucao: {
				tempo_execucao_ms: executionTime,
				fonte_cache: fromCache,
				timestamp_resposta: new Date().toISOString()
			}
		};
	}

	/**
	 * Obtém estatísticas do cache
	 * @returns {object} - Estatísticas de hits/misses
	 */
	getCacheStats() {
		return this.cache.getStats();
	}

	/**
	 * Limpa o cache
	 */
	clearCache() {
		this.cache.clear();
		this.logger.decision('Cache limpo manualmente');
	}
}

module.exports = ResearchAgent;
