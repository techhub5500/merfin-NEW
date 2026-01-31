/**
 * NOTE (request-analyzer.js):
 * Purpose: Análise semântica híbrida de requisições de pesquisa. Combina pattern matching
 * (regex) para 70% dos casos com IA (GPT-5 mini) para casos ambíguos.
 * Controls: Método principal analyze() recebe objetivo, contexto e tickers.
 * Behavior: Fase 1 = regex/lookup determinístico. Fase 2 = IA apenas se ambíguo.
 * Integration notes: Usado pelo ResearchAgent para determinar tipo de informação,
 * entidades e intenção antes do roteamento para APIs.
 */

const EntityExtractor = require('./utils/entity-extractor');
const QueryNormalizer = require('./utils/query-normalizer');

/**
 * RequestAnalyzer - Analisador Semântico Híbrido
 * 
 * Implementa análise em duas fases:
 * 1. Pattern Matching (sem IA) - Resolve ~70% dos casos
 * 2. IA Reasoning (GPT-5 mini) - Apenas para casos ambíguos ~30%
 * 
 * Resultado da análise:
 * - entidades: tickers, índices, moedas identificados
 * - tipo_informacao: ['numerica', 'qualitativa', 'factual']
 * - intencao: ['validar_variacao', 'entender_causa', 'comparacao', etc]
 * - janela_temporal: 'ontem', 'hoje', 'semana', 'mes', 'ano', 'atual'
 * - keywords_criticas: palavras-chave importantes extraídas
 */
class RequestAnalyzer {
	/**
	 * @param {object} config - Configurações
	 * @param {boolean} config.enableAI - Habilitar IA para casos ambíguos (default: true)
	 */
	constructor(config = {}) {
		this.enableAI = config.enableAI !== false;
		this.extractor = new EntityExtractor();
		this.normalizer = new QueryNormalizer();
		
		// Cliente OpenAI será inicializado apenas se necessário (lazy loading)
		this._openaiClient = null;
	}

	/**
	 * Inicializa cliente OpenAI (lazy loading)
	 * @private
	 */
	_getOpenAIClient() {
		if (!this._openaiClient && this.enableAI) {
			try {
				const { OpenAI } = require('openai');
				this._openaiClient = new OpenAI({ 
					apiKey: process.env.OPENAI_API_KEY 
				});
			} catch (error) {
				console.warn('[RequestAnalyzer] OpenAI não disponível:', error.message);
				this._openaiClient = null;
			}
		}
		return this._openaiClient;
	}

	/**
	 * Analisa requisição de pesquisa
	 * @param {object} params - Parâmetros da requisição
	 * @param {string} params.objetivo - Objetivo da pesquisa
	 * @param {string} params.contexto - Contexto adicional
	 * @param {string[]} params.tickers - Tickers fornecidos (opcional)
	 * @returns {Promise<object>} - Análise estruturada
	 */
	async analyze({ objetivo, contexto, tickers = [] }) {
		const startTime = Date.now();

		// ========================
		// FASE 1: Pattern Matching (sem IA)
		// ========================
		const normalized = this.normalizer.normalize(objetivo);
		const entities = this.extractor.extractAll(normalized);
		
		// Combina tickers fornecidos com extraídos
		const allTickers = [...new Set([
			...(tickers || []),
			...(entities.tickers || [])
		])];

		const preAnalysis = {
			entidades: allTickers,
			moedas: entities.moedas || [],
			indices: entities.indices || [],
			tipo_informacao: this._detectTypeByKeywords(normalized),
			intencao: this._detectIntentByKeywords(normalized),
			janela_temporal: this._extractTimeWindow(normalized),
			keywords_criticas: this._extractKeywords(normalized),
			_analysisTime: Date.now() - startTime,
			_aiUsed: false,
			_aiTokens: 0
		};

		// ========================
		// FASE 2: IA apenas se ambíguo
		// ========================
		if (this.enableAI && this._isAmbiguous(preAnalysis)) {
			console.log('[RequestAnalyzer] Caso ambíguo detectado, acionando IA');
			
			try {
				const aiAnalysis = await this._aiAnalysis(objetivo, contexto, preAnalysis);
				return {
					...preAnalysis,
					...aiAnalysis,
					_analysisTime: Date.now() - startTime,
					_aiUsed: true
				};
			} catch (error) {
				console.warn('[RequestAnalyzer] Falha na análise IA, usando pré-análise:', error.message);
				// Continua com pré-análise mesmo se IA falhar
			}
		}

		console.log('[RequestAnalyzer] Análise determinística concluída em', preAnalysis._analysisTime, 'ms');
		return preAnalysis;
	}

	/**
	 * Detecta tipo de informação por keywords
	 * @private
	 */
	_detectTypeByKeywords(text) {
		const textLower = text.toLowerCase();
		
		const PATTERNS = {
			numerica: [
				'preço', 'cotação', 'valor', 'r$', 'reais',
				'fechamento', 'abertura', 'máxima', 'mínima', 'volume',
				'p/l', 'p/vp', 'roe', 'margem', 'lucro', 'receita',
				'dividendo', 'yield', 'dy', 'proventos',
				'%', 'variação', 'alta', 'baixa', 'queda', 'subiu'
			],
			qualitativa: [
				'por que', 'porque', 'motivo', 'razão', 'causa',
				'análise', 'opinião', 'visão', 'perspectiva',
				'tese', 'risco', 'oportunidade', 'recomendação',
				'o que dizem', 'analistas', 'mercado diz',
				'notícia', 'novidade', 'aconteceu', 'anúncio'
			],
			factual: [
				'sede', 'endereço', 'localização', 'onde fica',
				'fundação', 'quando foi fundada', 'história',
				'ceo', 'presidente', 'diretoria', 'quem é',
				'telefone', 'contato', 'email', 'site',
				'funcionários', 'colaboradores', 'tamanho'
			]
		};

		const matches = [];
		for (const [type, keywords] of Object.entries(PATTERNS)) {
			if (keywords.some(kw => textLower.includes(kw))) {
				matches.push(type);
			}
		}

		// Default: qualitativa se nenhum padrão detectado
		return matches.length > 0 ? matches : ['qualitativa'];
	}

	/**
	 * Detecta intenção por keywords
	 * @private
	 */
	_detectIntentByKeywords(text) {
		const textLower = text.toLowerCase();
		
		const INTENTS = [
			{ 
				patterns: ['caiu', 'subiu', 'variou', 'mudou', 'alta de', 'queda de'],
				intent: 'validar_variacao'
			},
			{ 
				patterns: ['por que', 'porque', 'motivo', 'razão', 'causa', 'explicação'],
				intent: 'entender_causa'
			},
			{ 
				patterns: ['compare', 'comparar', 'diferença', 'versus', 'vs', 'melhor que'],
				intent: 'comparacao'
			},
			{ 
				patterns: ['atrativo', 'vale a pena', 'recomenda', 'devo comprar', 'devo vender'],
				intent: 'avaliacao'
			},
			{ 
				patterns: ['preço', 'cotação', 'quanto está', 'valor atual'],
				intent: 'consulta_preco'
			},
			{ 
				patterns: ['dividendo', 'yield', 'proventos', 'paga dividendo'],
				intent: 'consulta_dividendos'
			},
			{ 
				patterns: ['p/l', 'roe', 'margem', 'fundamentalista', 'indicadores'],
				intent: 'consulta_fundamentalista'
			},
			{ 
				patterns: ['notícia', 'novidade', 'aconteceu', 'última hora'],
				intent: 'buscar_noticias'
			},
			{ 
				patterns: ['sede', 'endereço', 'quem é', 'o que é', 'fundação'],
				intent: 'buscar_info_basica'
			}
		];

		const detectedIntents = [];
		for (const { patterns, intent } of INTENTS) {
			if (patterns.some(p => textLower.includes(p))) {
				detectedIntents.push(intent);
			}
		}

		return detectedIntents.length > 0 ? detectedIntents : ['busca_geral'];
	}

	/**
	 * Extrai janela temporal
	 * @private
	 */
	_extractTimeWindow(text) {
		const textLower = text.toLowerCase();
		
		const TIME_PATTERNS = {
			'ontem': ['ontem', 'yesterday', 'dia anterior'],
			'hoje': ['hoje', 'agora', 'atual', 'momento', 'today'],
			'semana': ['semana passada', 'última semana', 'last week', 'esta semana'],
			'mes': ['mês passado', 'último mês', 'last month', 'este mês'],
			'trimestre': ['trimestre', 'últimos 3 meses', 'quarter'],
			'ano': ['ano passado', 'último ano', '2024', '2025', '2026', 'anual']
		};

		for (const [window, patterns] of Object.entries(TIME_PATTERNS)) {
			if (patterns.some(p => textLower.includes(p))) {
				return window;
			}
		}

		return 'atual'; // default
	}

	/**
	 * Extrai keywords críticas
	 * @private
	 */
	_extractKeywords(text) {
		const CRITICAL_KEYWORDS = [
			// Variação
			'caiu', 'subiu', 'variou', 'queda', 'alta',
			// Preço
			'preço', 'cotação', 'valor',
			// Fundamentalista
			'P/L', 'P/VP', 'ROE', 'margem', 'lucro',
			// Dividendos
			'dividendo', 'yield', 'DY', 'proventos',
			// Contexto
			'por que', 'motivo', 'análise', 'notícia',
			// Comparação
			'compare', 'melhor', 'diferença',
			// Tempo
			'ontem', 'hoje', 'semana', 'mês', 'ano',
			// Indicadores
			'SELIC', 'IPCA', 'CDI', 'dólar', 'USD'
		];

		const textLower = text.toLowerCase();
		return CRITICAL_KEYWORDS.filter(kw => 
			textLower.includes(kw.toLowerCase())
		);
	}

	/**
	 * Determina se análise é ambígua e precisa de IA
	 * @private
	 */
	_isAmbiguous(analysis) {
		// Critério 1: Múltiplos tipos de informação detectados (pode ser intencional)
		if (analysis.tipo_informacao.length >= 3) {
			return true;
		}

		// Critério 2: Sem entidades E intent não trivial
		const hasNoEntities = analysis.entidades.length === 0 && 
							   analysis.moedas.length === 0 && 
							   analysis.indices.length === 0;
		const isComplexIntent = !['busca_geral', 'buscar_info_basica'].includes(analysis.intencao[0]);
		
		if (hasNoEntities && isComplexIntent) {
			return true;
		}

		// Critério 3: Keywords aparentemente conflitantes
		const hasNumeric = analysis.tipo_informacao.includes('numerica');
		const hasQualitative = analysis.tipo_informacao.includes('qualitativa');
		const kwLower = analysis.keywords_criticas.map(k => k.toLowerCase());
		const hasPriceKeyword = kwLower.some(k => ['preço', 'cotação'].includes(k));
		const hasWhyKeyword = kwLower.some(k => ['por que', 'motivo'].includes(k));
		
		if (hasNumeric && hasQualitative && hasPriceKeyword && hasWhyKeyword) {
			// Isso é na verdade um cenário válido (validar + entender causa)
			// Não precisa de IA
			return false;
		}

		// Critério 4: Sem keywords críticas identificadas
		if (analysis.keywords_criticas.length === 0) {
			return true;
		}

		return false;
	}

	/**
	 * Análise via IA para casos ambíguos
	 * @private
	 */
	async _aiAnalysis(objetivo, contexto, preAnalysis) {
		const client = this._getOpenAIClient();
		if (!client) {
			throw new Error('Cliente OpenAI não disponível');
		}

		const prompt = `Analise a seguinte requisição de pesquisa financeira e retorne JSON estruturado.

Requisição: "${objetivo}"
Contexto: "${contexto || 'N/A'}"
Pré-análise (regex): ${JSON.stringify(preAnalysis, null, 2)}

Instruções:
1. Valide e complete a pré-análise
2. Identifique entidades financeiras que possam ter sido perdidas
3. Determine a intenção principal do usuário
4. Atribua um nível de confiança

Responda APENAS com JSON válido no formato:
{
  "entidades": ["TICKER1", "TICKER2"],
  "tipo_informacao": ["numerica", "qualitativa", "factual"],
  "intencao": ["validar_variacao", "entender_causa"],
  "janela_temporal": "ontem|hoje|semana|mes|ano|atual",
  "keywords_criticas": ["palavra1", "palavra2"],
  "confianca": 0.0-1.0,
  "observacoes": "string opcional com insights adicionais"
}`;

		const response = await client.chat.completions.create({
			model: 'gpt-4o-mini', // GPT-5 mini quando disponível
			messages: [
				{ 
					role: 'system', 
					content: 'Você é um analisador semântico especializado em mercado financeiro brasileiro. Responda sempre em JSON válido.'
				},
				{ role: 'user', content: prompt }
			],
			temperature: 0.1, // reasoning low
			max_tokens: 400,
			response_format: { type: 'json_object' }
		});

		const content = response.choices[0].message.content;
		const aiResult = JSON.parse(content);

		return {
			...aiResult,
			_aiTokens: response.usage?.total_tokens || 0
		};
	}
}

module.exports = RequestAnalyzer;
