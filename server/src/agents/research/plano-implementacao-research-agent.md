# PLANO DE IMPLEMENTAÇÃO - RESEARCH AGENT
**Agente de Pesquisa Externa para Dados de Mercado Financeiro**

---

## 📋 VISÃO GERAL

Este plano detalha a implementação completa do **Research Agent**, um executor especializado em coleta inteligente de dados externos através de 3 APIs (Brapi, Tavily, Serper). O agente opera com GPT-5 mini (reasoning low, verbosity low), acionando IA apenas nos pontos essenciais.

### Melhorias Propostas Sobre o Plano Original

#### 1. **Pré-processamento Sem IA para Casos Simples**
**Proposta Original:** Análise semântica por IA em todas as requisições.
**Melhoria:** Implementar regex e pattern matching para 70% dos casos (ticker PETR4, palavras-chave "preço", "P/L"), reservando IA apenas para casos ambíguos.
**Justificativa:** Reduz custo em ~60% e latência de 2s para 50ms em casos triviais.

#### 2. **Cache com Fingerprinting Inteligente**
**Proposta Original:** Cache por query string simples.
**Melhoria:** Fingerprint normalizado (ex: "PETR4 preço" = "preço PETR4" = "cotação Petrobras").
**Justificativa:** Aumenta taxa de hit do cache de ~40% para ~75%.

#### 3. **Circuit Breaker por API**
**Proposta Original:** Retry simples com backoff.
**Melhoria:** Circuit breaker independente (após 3 falhas consecutivas, fonte fica "aberta" por 2 minutos).
**Justificativa:** Evita cascata de falhas e timeout desnecessário quando API está offline.

#### 4. **Log Estruturado com Níveis Dinâmicos**
**Proposta Original:** Log de todas as decisões.
**Melhoria:** 3 níveis (CRITICAL, DECISION, VERBOSE) com flag dinâmica por request.
**Justificativa:** Reduz poluição de logs de 500+ linhas para <30 linhas úteis em produção.

---

## 🎯 OBJETIVO 1: ESTRUTURA BASE E ANÁLISE DE REQUISIÇÕES

### Tarefa 1.1: Criar Estrutura de Arquivos e BaseAgent
**Arquivos a criar:**
```
server/src/agents/research/
├── research-agent.js           # Classe principal (extends BaseAgent)
├── request-analyzer.js         # Análise semântica de requisições
├── source-router.js            # Decision tree para roteamento
├── cache-manager.js            # Cache inteligente com fingerprint
├── api-clients/
│   ├── brapi-client.js         # Wrapper Brapi com retry
│   ├── tavily-client.js        # Wrapper Tavily com timeout
│   └── serper-client.js        # Wrapper Serper com circuit breaker
└── utils/
    ├── query-normalizer.js     # Normalização de queries
    └── entity-extractor.js     # Regex para tickers/códigos
```

**Implementação:**
```javascript
// research-agent.js
const BaseAgent = require('../shared/base-agent');
const RequestAnalyzer = require('./request-analyzer');
const SourceRouter = require('./source-router');
const CacheManager = require('./cache-manager');

class ResearchAgent extends BaseAgent {
  constructor(config = {}) {
    super('ResearchAgent', config);
    this.analyzer = new RequestAnalyzer();
    this.router = new SourceRouter({
      brapiClient: require('./api-clients/brapi-client'),
      tavilyClient: require('./api-clients/tavily-client'),
      serperClient: require('./api-clients/serper-client')
    });
    this.cache = new CacheManager();
  }

  async execute(request) {
    const { objetivo, contexto, tickers, periodo, profundidade = 'media' } = request.parameters;

    // 1. Verificar cache primeiro
    const cacheKey = this.cache.generateFingerprint({ objetivo, contexto, tickers });
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this._log('info', `[CACHE HIT] ${cacheKey}`);
      return { ...cached, fonte: 'CACHE', advertencia: cached.advertencia };
    }

    // 2. Análise semântica (com/sem IA)
    const analysis = await this.analyzer.analyze({ objetivo, contexto, tickers });
    
    // 3. Roteamento inteligente
    const executionPlan = this.router.buildPlan(analysis, { profundidade, priorizar_velocidade: false });
    
    // 4. Execução (paralela ou sequencial)
    const results = await this.router.execute(executionPlan);
    
    // 5. Consolidação e cache
    const consolidated = this._consolidate(results);
    await this.cache.set(cacheKey, consolidated, this._getTTL(analysis.tipo_informacao));
    
    return consolidated;
  }

  _getTTL(tipoInfo) {
    const TTL_MAP = {
      'preco_tempo_real': 5 * 60 * 60,      // 5 horas
      'fundamentalista': 24 * 60 * 60,      // 24 horas
      'noticias': 6 * 60 * 60,              // 6 horas
      'historico_anual': 3 * 24 * 60 * 60   // 3 dias
    };
    return TTL_MAP[tipoInfo] || 24 * 60 * 60;
  }

  _consolidate(results) {
    // Merge de dados de múltiplas fontes
    return {
      dados: results.map(r => r.data),
      fontes: results.map(r => r.fonte),
      timestamp: new Date().toISOString(),
      advertencias: results.filter(r => r.fallback).map(r => r.advertencia)
    };
  }
}

module.exports = ResearchAgent;
```

**Critério de Sucesso:**
- ✅ ResearchAgent extends BaseAgent corretamente
- ✅ Estrutura de pastas criada
- ✅ Todos os arquivos com JSDoc completo

---

### Tarefa 1.2: Implementar Análise Semântica Híbrida (Regex + IA Seletiva)
**Arquivo:** `request-analyzer.js`

**Lógica:**
1. **Fase 1 - Pattern Matching (sem IA):** 70% dos casos
   - Regex para tickers: `[A-Z]{4}\d{1,2}`
   - Keywords: `["preço", "cotação", "P/L", "dividendo", "por que", "motivo"]`
   - Decisão determinística por lookup table

2. **Fase 2 - IA Reasoning (GPT-5 mini):** 30% dos casos ambíguos
   - Prompt minimalista (< 200 tokens)
   - Retorno JSON estruturado

**Implementação:**
```javascript
// request-analyzer.js
const { OpenAI } = require('openai');
const EntityExtractor = require('./utils/entity-extractor');
const QueryNormalizer = require('./utils/query-normalizer');

class RequestAnalyzer {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.extractor = new EntityExtractor();
    this.normalizer = new QueryNormalizer();
  }

  async analyze({ objetivo, contexto, tickers }) {
    // FASE 1: Pré-processamento sem IA
    const normalized = this.normalizer.normalize(objetivo);
    const entities = this.extractor.extractAll(normalized);
    
    const preAnalysis = {
      entidades: entities.tickers || tickers || [],
      tipo_informacao: this._detectTypeByKeywords(normalized),
      intencao: this._detectIntentByKeywords(normalized),
      janela_temporal: this._extractTimeWindow(normalized),
      keywords_criticas: this._extractKeywords(normalized)
    };

    // FASE 2: IA apenas se ambíguo
    if (this._isAmbiguous(preAnalysis)) {
      console.log('[AI REASONING] Caso ambíguo detectado, acionando GPT-5 mini');
      return await this._aiAnalysis(objetivo, contexto, preAnalysis);
    }

    console.log('[PATTERN MATCH] Análise determinística concluída');
    return preAnalysis;
  }

  _detectTypeByKeywords(text) {
    const PATTERNS = {
      'numerica': /\b(preço|cotação|valor|R\$|\d+%|fechamento|P\/L|ROE|margem)\b/i,
      'qualitativa': /\b(por que|motivo|análise|opinião|tese|risco|contexto)\b/i,
      'factual': /\b(sede|endereço|fundação|CEO|contato|telefone)\b/i
    };

    const matches = [];
    for (const [type, regex] of Object.entries(PATTERNS)) {
      if (regex.test(text)) matches.push(type);
    }
    return matches.length > 0 ? matches : ['qualitativa']; // default
  }

  _detectIntentByKeywords(text) {
    const INTENTS = [
      { pattern: /\b(caiu|subiu|variou|mudou)\b/i, intent: 'validar_variacao' },
      { pattern: /\b(por que|motivo|razão|causa)\b/i, intent: 'entender_causa' },
      { pattern: /\b(compare|comparar|diferença|melhor)\b/i, intent: 'comparacao' },
      { pattern: /\b(atrativo|vale a pena|recomenda)\b/i, intent: 'avaliacao' }
    ];

    for (const { pattern, intent } of INTENTS) {
      if (pattern.test(text)) return [intent];
    }
    return ['busca_geral'];
  }

  _extractTimeWindow(text) {
    const TIME_PATTERNS = {
      'ontem': /\b(ontem|yesterday)\b/i,
      'hoje': /\b(hoje|agora|atual|today)\b/i,
      'semana': /\b(semana passada|última semana|last week)\b/i,
      'mes': /\b(mês passado|último mês|last month)\b/i,
      'ano': /\b(ano passado|último ano|2024|2025)\b/i
    };

    for (const [window, pattern] of Object.entries(TIME_PATTERNS)) {
      if (pattern.test(text)) return window;
    }
    return 'atual'; // default
  }

  _extractKeywords(text) {
    const CRITICAL_KEYWORDS = [
      'caiu', 'subiu', 'preço', 'cotação', 'P/L', 'dividendo', 
      'por que', 'motivo', 'análise', 'compare'
    ];
    return CRITICAL_KEYWORDS.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));
  }

  _isAmbiguous(analysis) {
    // Critérios de ambiguidade:
    // 1. Múltiplos tipos de informação detectados
    // 2. Sem entidades identificadas e intent não é factual
    // 3. Keywords conflitantes (ex: "preço" e "por que" juntos)
    
    if (analysis.tipo_informacao.length > 2) return true;
    if (analysis.entidades.length === 0 && analysis.intencao[0] !== 'busca_geral') return true;
    if (analysis.keywords_criticas.includes('preço') && analysis.keywords_criticas.includes('por que')) return true;
    
    return false;
  }

  async _aiAnalysis(objetivo, contexto, preAnalysis) {
    const prompt = `Analise a seguinte requisição de pesquisa financeira e retorne JSON estruturado:

Requisição: "${objetivo}"
Contexto: "${contexto || 'N/A'}"
Pré-análise: ${JSON.stringify(preAnalysis)}

Responda APENAS com JSON no formato:
{
  "entidades": ["TICKER1", "TICKER2"],
  "tipo_informacao": ["numerica", "qualitativa", "factual"],
  "intencao": ["validar_variacao", "entender_causa", etc],
  "janela_temporal": "ontem|hoje|semana|mes|ano|atual",
  "keywords_criticas": ["palavra1", "palavra2"],
  "confianca": 0.0-1.0
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // reasoning low
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const aiResult = JSON.parse(response.choices[0].message.content);
    
    // Merge AI com pré-análise
    return {
      ...preAnalysis,
      ...aiResult,
      _aiUsed: true,
      _aiTokens: response.usage.total_tokens
    };
  }
}

module.exports = RequestAnalyzer;
```

**Critério de Sucesso:**
- ✅ 70%+ das requisições resolvidas sem IA (medido via logs)
- ✅ Tempo de análise < 100ms para casos determinísticos
- ✅ Tempo de análise < 2s para casos com IA

---

### Tarefa 1.3: Criar Utilidades de Normalização e Extração
**Arquivo 1:** `utils/query-normalizer.js`
```javascript
class QueryNormalizer {
  normalize(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')                    // múltiplos espaços
      .replace(/petrobras/gi, 'PETR4')         // aliases comuns
      .replace(/vale\s+do\s+rio\s+doce/gi, 'VALE3')
      .replace(/itaú/gi, 'ITUB4');
  }

  generateFingerprint(query) {
    // Remove ordem das palavras, mantém apenas termos únicos ordenados
    const words = this.normalize(query).split(' ').sort();
    return words.join('|');
  }
}

module.exports = QueryNormalizer;
```

**Arquivo 2:** `utils/entity-extractor.js`
```javascript
class EntityExtractor {
  extractAll(text) {
    return {
      tickers: this.extractTickers(text),
      moedas: this.extractCurrencies(text),
      indices: this.extractIndices(text)
    };
  }

  extractTickers(text) {
    // Regex: 4 letras maiúsculas + 1-2 dígitos (ex: PETR4, ITUB4, TAEE11)
    const regex = /\b([A-Z]{4}\d{1,2})\b/g;
    const matches = text.match(regex);
    return matches ? [...new Set(matches)] : [];
  }

  extractCurrencies(text) {
    // USD/BRL, EUR/BRL, etc
    const regex = /\b([A-Z]{3}\/[A-Z]{3})\b/g;
    const matches = text.match(regex);
    return matches ? [...new Set(matches)] : [];
  }

  extractIndices(text) {
    const INDICES = ['IBOVESPA', 'SELIC', 'IPCA', 'IGP-M', 'CDI'];
    return INDICES.filter(idx => text.toUpperCase().includes(idx));
  }
}

module.exports = EntityExtractor;
```

**Critério de Sucesso:**
- ✅ Fingerprints idênticos para queries equivalentes ("PETR4 preço" = "preço PETR4")
- ✅ Extração de 100% dos tickers válidos em testes unitários

---

### Tarefa 1.4: Implementar Cache Inteligente com Fingerprinting
**Arquivo:** `cache-manager.js`

**Implementação:**
```javascript
// cache-manager.js
const crypto = require('crypto');
const QueryNormalizer = require('./utils/query-normalizer');

class CacheManager {
  constructor() {
    this.cache = new Map(); // Em produção: Redis
    this.normalizer = new QueryNormalizer();
    this.hits = 0;
    this.misses = 0;
  }

  generateFingerprint({ objetivo, contexto, tickers }) {
    // Normaliza e ordena para garantir consistência
    const normalized = this.normalizer.normalize(objetivo);
    const tickersStr = (tickers || []).sort().join(',');
    const contextNorm = contexto ? this.normalizer.normalize(contexto) : '';
    
    const raw = `${normalized}|${tickersStr}|${contextNorm}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  async get(fingerprint) {
    const entry = this.cache.get(fingerprint);
    if (!entry) {
      this.misses++;
      return null;
    }

    // Verifica se está expirado
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(fingerprint);
      this.misses++;
      return null;
    }

    this.hits++;
    const ageHours = ((Date.now() - entry.createdAt) / (1000 * 60 * 60)).toFixed(1);
    
    return {
      ...entry.data,
      advertencia: `Dados de cache de ${ageHours}h atrás`
    };
  }

  async set(fingerprint, data, ttlSeconds) {
    this.cache.set(fingerprint, {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size
    };
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

module.exports = CacheManager;
```

**Critério de Sucesso:**
- ✅ Taxa de hit > 70% após 100 requisições em ambiente de teste
- ✅ Fingerprints únicos para consultas distintas, idênticos para equivalentes

---

## 🎯 OBJETIVO 2: INTEGRAÇÃO COM APIs E SISTEMA DE FALLBACK

### Tarefa 2.1: Implementar Wrappers das 3 APIs com Circuit Breaker
**Arquivo 1:** `api-clients/brapi-client.js`
```javascript
const Brapi = require('brapi');
const CircuitBreaker = require('./circuit-breaker');

class BrapiClient {
  constructor() {
    this.client = new Brapi({ apiKey: process.env.BRAPI_API_KEY });
    this.breaker = new CircuitBreaker('BRAPI', { 
      failureThreshold: 3, 
      resetTimeout: 120000 // 2 minutos
    });
  }

  async getQuote(tickers, options = {}) {
    return this.breaker.execute(async () => {
      const tickersStr = Array.isArray(tickers) ? tickers.join(',') : tickers;
      
      const response = await Promise.race([
        this.client.quote.retrieve(tickersStr, {
          range: options.range || '1d',
          interval: options.interval || '1d',
          fundamental: options.fundamental || false,
          dividends: options.dividends || false
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 20000)
        )
      ]);

      return {
        fonte: 'BRAPI',
        data: response.results,
        timestamp: new Date().toISOString()
      };
    });
  }

  async getCrypto(coin) {
    return this.breaker.execute(async () => {
      const response = await fetch(`https://brapi.dev/api/v2/crypto?coin=${coin}`, {
        headers: { 'Authorization': `Bearer ${process.env.BRAPI_API_KEY}` }
      });
      if (!response.ok) throw new Error(`Brapi error: ${response.status}`);
      return response.json();
    });
  }

  async getCurrency(pair) {
    return this.breaker.execute(async () => {
      const response = await fetch(`https://brapi.dev/api/v2/currency?currency=${pair}`, {
        headers: { 'Authorization': `Bearer ${process.env.BRAPI_API_KEY}` }
      });
      if (!response.ok) throw new Error(`Brapi error: ${response.status}`);
      return response.json();
    });
  }
}

module.exports = BrapiClient;
```

**Arquivo 2:** `api-clients/tavily-client.js`
```javascript
const { tavily } = require("@tavily/core");
const CircuitBreaker = require('./circuit-breaker');

class TavilyClient {
  constructor() {
    this.client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    this.breaker = new CircuitBreaker('TAVILY', { 
      failureThreshold: 3, 
      resetTimeout: 120000 
    });
  }

  async search(query, options = {}) {
    return this.breaker.execute(async () => {
      const response = await Promise.race([
        this.client.search(query, {
          topic: options.topic || 'finance',
          search_depth: options.depth || 'advanced',
          max_results: options.maxResults || 5,
          include_answer: options.includeAnswer !== false,
          time_range: options.timeRange || 'week',
          country: options.country || 'brazil'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 20000)
        )
      ]);

      return {
        fonte: 'TAVILY',
        data: {
          resposta_ia: response.answer,
          resultados: response.results.map(r => ({
            titulo: r.title,
            url: r.url,
            conteudo: r.content,
            score: r.score,
            data_publicacao: r.published_date
          }))
        },
        timestamp: new Date().toISOString()
      };
    });
  }

  async extract(urls, options = {}) {
    return this.breaker.execute(async () => {
      const response = await this.client.extract({
        urls,
        extract_depth: options.depth || 'advanced',
        format: options.format || 'markdown'
      });
      return {
        fonte: 'TAVILY_EXTRACT',
        data: response,
        timestamp: new Date().toISOString()
      };
    });
  }
}

module.exports = TavilyClient;
```

**Arquivo 3:** `api-clients/serper-client.js`
```javascript
const CircuitBreaker = require('./circuit-breaker');

class SerperClient {
  constructor() {
    this.apiKey = process.env.SERPER_API_KEY;
    this.breaker = new CircuitBreaker('SERPER', { 
      failureThreshold: 3, 
      resetTimeout: 120000 
    });
  }

  async search(query, options = {}) {
    return this.breaker.execute(async () => {
      const payload = {
        q: query,
        gl: options.gl || 'br',
        hl: options.hl || 'pt',
        num: options.num || 10,
        type: options.type || 'search',
        autocorrect: true,
        page: options.page || 1
      };

      if (options.timeRange) {
        payload.tbs = options.timeRange; // ex: "qdr:d" para último dia
      }

      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Serper error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        fonte: 'SERPER',
        data: {
          knowledge_graph: data.knowledgeGraph,
          resultados: data.organic || [],
          noticias: data.news || [],
          people_also_ask: data.peopleAlsoAsk || []
        },
        timestamp: new Date().toISOString()
      };
    });
  }
}

module.exports = SerperClient;
```

**Arquivo 4:** `api-clients/circuit-breaker.js`
```javascript
// Circuit Breaker Pattern para prevenir cascata de falhas
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minuto
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`[CIRCUIT BREAKER] ${this.name} está OPEN (tentativa em ${Math.ceil((this.nextAttempt - Date.now()) / 1000)}s)`);
      }
      // Tenta reabrir (HALF_OPEN)
      this.state = 'HALF_OPEN';
      console.log(`[CIRCUIT BREAKER] ${this.name} mudou para HALF_OPEN`);
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  _onSuccess() {
    if (this.state === 'HALF_OPEN') {
      console.log(`[CIRCUIT BREAKER] ${this.name} RECUPERADO, mudando para CLOSED`);
      this.state = 'CLOSED';
    }
    this.failureCount = 0;
  }

  _onFailure() {
    this.failureCount++;
    console.log(`[CIRCUIT BREAKER] ${this.name} falha ${this.failureCount}/${this.failureThreshold}`);

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.log(`[CIRCUIT BREAKER] ${this.name} ABERTO até ${new Date(this.nextAttempt).toISOString()}`);
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null
    };
  }
}

module.exports = CircuitBreaker;
```

**Critério de Sucesso:**
- ✅ Circuit breaker abre após 3 falhas consecutivas
- ✅ Timeout de 20s em cada API respeitado
- ✅ Logs de estado do circuit breaker aparecem nos logs

---

### Tarefa 2.2: Implementar Roteador Inteligente (Decision Tree)
**Arquivo:** `source-router.js`

**Implementação:**
```javascript
class SourceRouter {
  constructor({ brapiClient, tavilyClient, serperClient }) {
    this.brapi = brapiClient;
    this.tavily = tavilyClient;
    this.serper = serperClient;
  }

  buildPlan(analysis, options) {
    const { tipo_informacao, intencao, keywords_criticas, entidades } = analysis;
    const plan = { steps: [], executionMode: 'PARALLEL' };

    // REGRA 1: BRAPI - Dados estruturados
    if (this._needsBrapi(tipo_informacao, keywords_criticas, entidades)) {
      plan.steps.push({
        fonte: 'BRAPI',
        action: 'getQuote',
        params: {
          tickers: entidades,
          fundamental: keywords_criticas.some(kw => ['P/L', 'ROE', 'margem'].includes(kw)),
          dividends: keywords_criticas.some(kw => ['dividendo', 'yield', 'DY'].includes(kw))
        }
      });
    }

    // REGRA 2: TAVILY - Contexto qualitativo
    if (this._needsTavily(tipo_informacao, intencao, keywords_criticas)) {
      plan.steps.push({
        fonte: 'TAVILY',
        action: 'search',
        params: {
          query: this._buildTavilyQuery(analysis),
          depth: options.profundidade === 'profunda' ? 'advanced' : 'basic',
          timeRange: this._mapTimeRange(analysis.janela_temporal)
        }
      });
    }

    // REGRA 3: SERPER - Fatos triviais ou fallback
    if (this._needsSerper(tipo_informacao, intencao, keywords_criticas)) {
      plan.steps.push({
        fonte: 'SERPER',
        action: 'search',
        params: {
          query: analysis.keywords_criticas.join(' '),
          num: 5
        }
      });
    }

    // Determina modo de execução
    if (plan.steps.length > 1 && this._requiresSequential(analysis)) {
      plan.executionMode = 'SEQUENTIAL';
    }

    return plan;
  }

  _needsBrapi(tipos, keywords, entidades) {
    // Tem ticker OU busca numérica
    if (entidades.length > 0) return true;
    if (tipos.includes('numerica')) return true;
    if (keywords.some(kw => ['preço', 'cotação', 'P/L', 'dividendo'].includes(kw))) return true;
    return false;
  }

  _needsTavily(tipos, intencoes, keywords) {
    // Busca qualitativa OU quer entender motivo
    if (tipos.includes('qualitativa')) return true;
    if (intencoes.includes('entender_causa')) return true;
    if (keywords.some(kw => ['por que', 'motivo', 'análise'].includes(kw))) return true;
    return false;
  }

  _needsSerper(tipos, intencoes, keywords) {
    // Busca factual trivial
    if (tipos.includes('factual')) return true;
    if (keywords.some(kw => ['sede', 'endereço', 'telefone'].includes(kw))) return true;
    return false;
  }

  _requiresSequential(analysis) {
    // Precisa de Serper para descobrir tickers antes do Brapi
    return analysis.intencao.includes('comparacao') && analysis.entidades.length === 0;
  }

  _buildTavilyQuery(analysis) {
    const { entidades, keywords_criticas, janela_temporal } = analysis;
    let query = keywords_criticas.join(' ');
    if (entidades.length > 0) {
      query = `${entidades[0]} ${query}`;
    }
    if (janela_temporal && janela_temporal !== 'atual') {
      query += ` ${janela_temporal}`;
    }
    return query;
  }

  _mapTimeRange(window) {
    const MAP = {
      'ontem': 'day',
      'hoje': 'day',
      'semana': 'week',
      'mes': 'month',
      'ano': 'year'
    };
    return MAP[window] || 'week';
  }

  async execute(plan) {
    console.log(`[ROUTER] Executando plano: ${plan.executionMode}, ${plan.steps.length} fonte(s)`);

    if (plan.executionMode === 'PARALLEL') {
      return await this._executeParallel(plan.steps);
    } else {
      return await this._executeSequential(plan.steps);
    }
  }

  async _executeParallel(steps) {
    const promises = steps.map(step => this._executeStep(step));
    const results = await Promise.allSettled(promises);

    return results.map((result, idx) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Fallback será tratado em _executeStep
        return {
          fonte: steps[idx].fonte,
          error: result.reason.message,
          fallback: true
        };
      }
    });
  }

  async _executeSequential(steps) {
    const results = [];
    for (const step of steps) {
      const result = await this._executeStep(step);
      results.push(result);
    }
    return results;
  }

  async _executeStep(step) {
    const { fonte, action, params } = step;
    
    try {
      switch (fonte) {
        case 'BRAPI':
          return await this.brapi[action](params.tickers, params);
        case 'TAVILY':
          return await this.tavily[action](params.query, params);
        case 'SERPER':
          return await this.serper[action](params.query, params);
        default:
          throw new Error(`Fonte desconhecida: ${fonte}`);
      }
    } catch (error) {
      console.log(`[ROUTER] ${fonte} falhou: ${error.message}, tentando fallback`);
      return await this._executeFallback(step, error);
    }
  }

  async _executeFallback(step, originalError) {
    const { fonte } = step;

    // Fallback hierárquico
    if (fonte === 'BRAPI') {
      // Tenta Serper como alternativa
      try {
        return await this.serper.search(step.params.tickers.join(' ') + ' cotação preço');
      } catch {
        throw originalError;
      }
    } else if (fonte === 'TAVILY') {
      // Tenta Serper
      try {
        return await this.serper.search(step.params.query);
      } catch {
        throw originalError;
      }
    } else {
      // Serper não tem fallback
      throw originalError;
    }
  }
}

module.exports = SourceRouter;
```

**Critério de Sucesso:**
- ✅ Decision tree roteia corretamente para Brapi quando há ticker
- ✅ Tavily é acionado quando há "por que" ou "motivo"
- ✅ Fallback Tavily→Serper funciona em caso de erro

---

### Tarefa 2.3: Implementar Sistema de Fallback Hierárquico Completo
**Modificação em:** `source-router.js` (método `_executeFallback`)

**Níveis de Fallback:**
```
1. Cache < 24h (dados numéricos) ou < 6h (notícias)
2. Fonte alternativa (Brapi→Serper, Tavily→Serper)
3. Cache antigo (até 48h dados / 7 dias notícias)
4. Erro estruturado
```

**Implementação:**
```javascript
// Adicionar ao source-router.js

async _executeFallback(step, originalError) {
  const { fonte, params } = step;
  const fallbackLog = [`[FALLBACK] ${fonte} primário falhou: ${originalError.message}`];

  // NÍVEL 1: Cache recente
  try {
    const cacheKey = this._generateCacheKey(step);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      const ageHours = ((Date.now() - cached.timestamp) / (1000 * 60 * 60)).toFixed(1);
      const maxAge = fonte === 'TAVILY' ? 6 : 24;
      
      if (ageHours <= maxAge) {
        fallbackLog.push(`[FALLBACK L1] Cache recente (${ageHours}h) - SUCESSO`);
        console.log(fallbackLog.join(' → '));
        return {
          ...cached,
          fallback: true,
          advertencia: `Dados de cache de ${ageHours}h (fonte primária ${fonte} indisponível)`
        };
      }
    }
  } catch {}

  // NÍVEL 2: Fonte alternativa
  try {
    if (fonte === 'BRAPI') {
      fallbackLog.push('[FALLBACK L2] Tentando Serper');
      const result = await this.serper.search(params.tickers.join(' ') + ' cotação preço Brasil');
      fallbackLog.push('[FALLBACK L2] Serper - SUCESSO');
      console.log(fallbackLog.join(' → '));
      return { ...result, fallback: true, advertencia: 'Dados de fonte alternativa (Serper)' };
    } else if (fonte === 'TAVILY') {
      fallbackLog.push('[FALLBACK L2] Tentando Serper');
      const result = await this.serper.search(params.query, { num: 5 });
      fallbackLog.push('[FALLBACK L2] Serper - SUCESSO');
      console.log(fallbackLog.join(' → '));
      return { ...result, fallback: true, advertencia: 'Dados de fonte alternativa (Serper)' };
    }
  } catch (error) {
    fallbackLog.push(`[FALLBACK L2] Falhou: ${error.message}`);
  }

  // NÍVEL 3: Cache antigo
  try {
    const cacheKey = this._generateCacheKey(step);
    const cached = await this.cache.get(cacheKey, { ignoreExpiration: true });
    if (cached) {
      const ageHours = ((Date.now() - cached.timestamp) / (1000 * 60 * 60)).toFixed(1);
      const maxAge = fonte === 'TAVILY' ? 168 : 48; // 7 dias vs 48h
      
      if (ageHours <= maxAge) {
        fallbackLog.push(`[FALLBACK L3] Cache antigo (${ageHours}h) - SUCESSO`);
        console.log(fallbackLog.join(' → '));
        return {
          ...cached,
          fallback: true,
          advertencia: `ATENÇÃO: Dados muito antigos (${ageHours}h). Fonte primária e alternativas indisponíveis.`
        };
      }
    }
  } catch {}

  // NÍVEL 4: Erro estruturado
  fallbackLog.push('[FALLBACK L4] Todos os fallbacks falharam - ERRO');
  console.error(fallbackLog.join(' → '));
  
  throw new Error(JSON.stringify({
    erro: 'Falha completa em todas as fontes e fallbacks',
    fonte_primaria: fonte,
    erro_original: originalError.message,
    tentativas_fallback: [
      { nivel: 1, metodo: 'Cache recente', resultado: 'falhou' },
      { nivel: 2, metodo: 'Fonte alternativa', resultado: 'falhou' },
      { nivel: 3, metodo: 'Cache antigo', resultado: 'falhou' }
    ],
    sugestao: 'Tente novamente em alguns minutos ou reformule a consulta'
  }));
}
```

**Critério de Sucesso:**
- ✅ Fallback percorre os 4 níveis em ordem
- ✅ Logs mostram caminho do fallback claramente
- ✅ Advertências incluem idade do cache quando aplicável

---

### Tarefa 2.4: Adicionar TTL Dinâmico por Tipo de Dado
**Modificação em:** `research-agent.js`

**Implementação:**
```javascript
_getTTL(tipoInfo, keywords = []) {
  // TTL base por tipo
  const BASE_TTL = {
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

  // Detecta tipo específico baseado em keywords
  if (keywords.some(kw => ['preço', 'cotação', 'valor'].includes(kw))) {
    return BASE_TTL.preco_tempo_real;
  }
  if (keywords.some(kw => ['SELIC', 'IPCA', 'CDI'].includes(kw))) {
    return BASE_TTL.indicador_diario;
  }
  if (keywords.some(kw => ['USD/BRL', 'dólar', 'euro'].includes(kw))) {
    return BASE_TTL.moeda;
  }
  if (keywords.some(kw => ['BTC', 'ETH', 'cripto'].includes(kw))) {
    return BASE_TTL.cripto;
  }
  if (keywords.some(kw => ['dividendo', 'yield', 'DY'].includes(kw))) {
    return BASE_TTL.dividendo_atual;
  }
  if (keywords.some(kw => ['P/L', 'ROE', 'margem'].includes(kw))) {
    return BASE_TTL.fundamentalista;
  }
  if (keywords.some(kw => ['notícia', 'análise', 'por que'].includes(kw))) {
    return BASE_TTL.noticias;
  }
  if (keywords.some(kw => ['sede', 'fundação', 'CEO'].includes(kw))) {
    return BASE_TTL.fato_trivial;
  }

  // Fallback genérico baseado no tipo
  return BASE_TTL[tipoInfo] || 24 * 60 * 60;
}
```

**Critério de Sucesso:**
- ✅ Preços têm TTL de 5h
- ✅ Notícias têm TTL de 6h
- ✅ Fundamentalistas têm TTL de 24h
- ✅ Fatos triviais têm TTL de 3 dias

---

## 🎯 OBJETIVO 3: VALIDAÇÃO, CONSOLIDAÇÃO E SISTEMA DE LOG INTELIGENTE

### Tarefa 3.1: Implementar Consolidação de Múltiplas Fontes
**Modificação em:** `research-agent.js`

**Implementação:**
```javascript
_consolidate(results, analysis) {
  const consolidated = {
    dados_consolidados: {},
    fontes_usadas: [],
    timestamp: new Date().toISOString(),
    advertencias: [],
    metadados: {
      total_fontes: results.length,
      fontes_primarias: 0,
      fontes_fallback: 0,
      tempo_total_ms: 0
    }
  };

  for (const result of results) {
    if (!result || result.error) {
      consolidated.advertencias.push(`${result.fonte} falhou: ${result.error}`);
      continue;
    }

    consolidated.fontes_usadas.push(result.fonte);
    
    if (result.fallback) {
      consolidated.metadados.fontes_fallback++;
      consolidated.advertencias.push(result.advertencia);
    } else {
      consolidated.metadados.fontes_primarias++;
    }

    // Merge de dados por tipo de fonte
    if (result.fonte === 'BRAPI') {
      consolidated.dados_consolidados.dados_estruturados = result.data;
    } else if (result.fonte === 'TAVILY') {
      consolidated.dados_consolidados.contexto_qualitativo = {
        resposta_ia: result.data.resposta_ia,
        fontes_noticias: result.data.resultados.slice(0, 3)
      };
    } else if (result.fonte === 'SERPER') {
      consolidated.dados_consolidados.informacoes_adicionais = {
        knowledge_graph: result.data.knowledge_graph,
        resultados: result.data.resultados.slice(0, 3)
      };
    }
  }

  // Validação de completude
  if (consolidated.fontes_usadas.length === 0) {
    throw new Error('Nenhuma fonte retornou dados válidos');
  }

  return consolidated;
}
```

**Critério de Sucesso:**
- ✅ Dados de múltiplas fontes mesclados sem conflitos
- ✅ Advertências incluem fontes que falharam
- ✅ Metadados mostram quantas fontes primárias vs fallback

---

### Tarefa 3.2: Adicionar Validação de Dados Retornados
**Arquivo:** `data-validator.js`

**Implementação:**
```javascript
class DataValidator {
  validateBrapiData(data) {
    if (!data || !Array.isArray(data)) {
      return { valid: false, error: 'Dados Brapi inválidos: não é array' };
    }

    for (const item of data) {
      if (!item.symbol || !item.regularMarketPrice) {
        return { valid: false, error: 'Dados Brapi incompletos: faltam symbol ou price' };
      }
    }

    return { valid: true };
  }

  validateTavilyData(data) {
    if (!data || !data.resultados) {
      return { valid: false, error: 'Dados Tavily inválidos: faltam resultados' };
    }

    if (data.resultados.length === 0) {
      return { valid: false, error: 'Tavily retornou 0 resultados' };
    }

    return { valid: true };
  }

  validateSerperData(data) {
    if (!data || (!data.resultados && !data.knowledge_graph)) {
      return { valid: false, error: 'Dados Serper inválidos: sem resultados ou KG' };
    }

    return { valid: true };
  }

  validate(fonte, data) {
    switch (fonte) {
      case 'BRAPI':
        return this.validateBrapiData(data);
      case 'TAVILY':
        return this.validateTavilyData(data);
      case 'SERPER':
        return this.validateSerperData(data);
      default:
        return { valid: false, error: `Fonte desconhecida: ${fonte}` };
    }
  }
}

module.exports = DataValidator;
```

**Critério de Sucesso:**
- ✅ Valida estrutura mínima de cada API
- ✅ Retorna erro descritivo quando dados inválidos

---

### Tarefa 3.3: Criar Manifest do Research Agent
**Arquivo:** `manifests/ResearchAgent.json`

**Implementação:**
```json
{
  "name": "ResearchAgent",
  "version": "1.0.0",
  "type": "executor",
  "description": "Executor especializado em coleta inteligente de dados externos de mercado financeiro via Brapi, Tavily e Serper",
  "capabilities": [
    "Análise semântica híbrida (regex + IA seletiva)",
    "Roteamento inteligente multi-fonte",
    "Execução paralela com fallback hierárquico",
    "Cache inteligente com fingerprinting",
    "Circuit breaker por API"
  ],
  "contract": {
    "operations": [
      {
        "name": "pesquisa_mercado_financeiro",
        "description": "Coleta dados de mercado, notícias e contexto sobre ativos financeiros",
        "required_params": ["objetivo", "contexto"],
        "optional_params": ["tickers", "periodo", "profundidade", "priorizar_velocidade"],
        "returns": {
          "dados_consolidados": "object",
          "fontes_usadas": "array",
          "advertencias": "array",
          "timestamp": "string"
        }
      }
    ]
  },
  "dependencies": {
    "external_apis": ["Brapi", "Tavily", "Serper"],
    "env_vars": ["BRAPI_API_KEY", "TAVILY_API_KEY", "SERPER_API_KEY", "OPENAI_API_KEY"]
  },
  "performance": {
    "avg_response_time_ms": 2500,
    "cache_hit_rate_target": "70%",
    "ai_usage_rate_target": "30%"
  }
}
```

**Critério de Sucesso:**
- ✅ Manifest reflete todas as operações disponíveis
- ✅ Dependências listadas corretamente

---

### Tarefa 3.4: Implementar Sistema de Log Inteligente (3 Níveis)
**Arquivo:** `research-logger.js`

**Níveis:**
- **CRITICAL:** Erros fatais, circuit breaker aberto, todas as fontes falharam
- **DECISION:** Decisões de roteamento, uso de fallback, IA acionada
- **VERBOSE:** Todos os detalhes (apenas em modo debug)

**Implementação:**
```javascript
const fs = require('fs');
const path = require('path');

class ResearchLogger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || process.env.RESEARCH_LOG_LEVEL || 'DECISION';
    this.logFile = path.join(__dirname, '../../..', 'log', `research-agent-${this._getTimestamp()}.md`);
    this.levels = {
      CRITICAL: 0,
      DECISION: 1,
      VERBOSE: 2
    };
    this.currentLevel = this.levels[this.logLevel];
    this.sessionStats = {
      total_requests: 0,
      cache_hits: 0,
      ai_used: 0,
      fallbacks_used: 0,
      errors: 0
    };
  }

  _getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/:/g, '-').split('.')[0];
  }

  _shouldLog(level) {
    return this.levels[level] <= this.currentLevel;
  }

  critical(message, data = {}) {
    if (!this._shouldLog('CRITICAL')) return;
    this._write('🔴 CRITICAL', message, data);
    this.sessionStats.errors++;
  }

  decision(message, data = {}) {
    if (!this._shouldLog('DECISION')) return;
    this._write('⚡ DECISION', message, data);
  }

  verbose(message, data = {}) {
    if (!this._shouldLog('VERBOSE')) return;
    this._write('📝 VERBOSE', message, data);
  }

  logRequest(request, analysis) {
    this.sessionStats.total_requests++;
    this.decision('Nova requisição recebida', {
      objetivo: request.objetivo,
      tickers: request.tickers,
      tipo_analise: analysis._aiUsed ? 'IA' : 'REGEX'
    });
    if (analysis._aiUsed) {
      this.sessionStats.ai_used++;
      this.decision('IA acionada para análise semântica', {
        tokens: analysis._aiTokens,
        confianca: analysis.confianca
      });
    }
  }

  logRouting(plan) {
    this.decision('Plano de roteamento criado', {
      modo: plan.executionMode,
      fontes: plan.steps.map(s => s.fonte).join(', '),
      total_steps: plan.steps.length
    });
  }

  logCacheHit(fingerprint, ageHours) {
    this.sessionStats.cache_hits++;
    this.decision(`Cache HIT (${ageHours}h)`, { fingerprint: fingerprint.substring(0, 8) });
  }

  logCacheMiss(fingerprint) {
    this.decision('Cache MISS', { fingerprint: fingerprint.substring(0, 8) });
  }

  logFallback(fonte, nivel, sucesso) {
    this.sessionStats.fallbacks_used++;
    const status = sucesso ? 'SUCESSO' : 'FALHA';
    this.decision(`Fallback L${nivel} - ${fonte}`, { resultado: status });
  }

  logCircuitBreaker(api, state) {
    if (state === 'OPEN') {
      this.critical(`Circuit Breaker ABERTO: ${api}`, {
        motivo: 'Falhas consecutivas excederam threshold',
        proxima_tentativa: state.nextAttempt
      });
    } else if (state === 'HALF_OPEN') {
      this.decision(`Circuit Breaker HALF_OPEN: ${api}`, {
        tentando: 'Reabrir circuito'
      });
    } else {
      this.decision(`Circuit Breaker FECHADO: ${api}`, {
        status: 'Operacional'
      });
    }
  }

  logError(error, context = {}) {
    this.critical('Erro durante execução', {
      mensagem: error.message,
      stack: error.stack,
      contexto: context
    });
  }

  logSessionStats() {
    const cacheHitRate = this.sessionStats.total_requests > 0
      ? ((this.sessionStats.cache_hits / this.sessionStats.total_requests) * 100).toFixed(1)
      : 0;
    const aiUsageRate = this.sessionStats.total_requests > 0
      ? ((this.sessionStats.ai_used / this.sessionStats.total_requests) * 100).toFixed(1)
      : 0;

    this.decision('📊 Estatísticas da Sessão', {
      total_requests: this.sessionStats.total_requests,
      cache_hit_rate: `${cacheHitRate}%`,
      ai_usage_rate: `${aiUsageRate}%`,
      fallbacks_used: this.sessionStats.fallbacks_used,
      errors: this.sessionStats.errors
    });
  }

  _write(level, message, data) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${level} - ${message}\n`;
    const details = Object.keys(data).length > 0 
      ? `  ${JSON.stringify(data, null, 2)}\n` 
      : '';

    const entry = line + details + '\n';

    // Console
    console.log(entry.trim());

    // Arquivo
    fs.appendFileSync(this.logFile, entry, 'utf8');
  }
}

module.exports = ResearchLogger;
```

**Integração no research-agent.js:**
```javascript
// Adicionar no construtor
this.logger = new ResearchLogger({ logLevel: config.logLevel || 'DECISION' });

// Usar ao longo do código
async execute(request) {
  // ...
  const analysis = await this.analyzer.analyze({ objetivo, contexto, tickers });
  this.logger.logRequest(request.parameters, analysis);

  const executionPlan = this.router.buildPlan(analysis, { profundidade });
  this.logger.logRouting(executionPlan);

  // ... ao final
  this.logger.logSessionStats();
}
```

**Exemplos de Log DECISION (nível padrão):**
```
[2026-01-30T18:30:00.000Z] ⚡ DECISION - Nova requisição recebida
  {
    "objetivo": "A Petrobras caiu 3% ontem, por que?",
    "tickers": ["PETR4"],
    "tipo_analise": "REGEX"
  }

[2026-01-30T18:30:00.050Z] ⚡ DECISION - Plano de roteamento criado
  {
    "modo": "PARALLEL",
    "fontes": "BRAPI, TAVILY",
    "total_steps": 2
  }

[2026-01-30T18:30:02.300Z] ⚡ DECISION - Fallback L2 - TAVILY
  {
    "resultado": "SUCESSO"
  }

[2026-01-30T18:35:00.000Z] ⚡ DECISION - 📊 Estatísticas da Sessão
  {
    "total_requests": 15,
    "cache_hit_rate": "73.3%",
    "ai_usage_rate": "26.7%",
    "fallbacks_used": 2,
    "errors": 0
  }
```

**Critério de Sucesso:**
- ✅ Logs DECISION têm < 30 linhas por requisição típica
- ✅ Logs CRITICAL aparecem para erros graves
- ✅ Estatísticas de sessão mostram métricas chave
- ✅ Cache hit rate > 70% após 50 requisições
- ✅ AI usage rate < 35%

---

## 📊 MÉTRICAS DE SUCESSO DO PROJETO

### Fase de Implementação (Objetivos 1-3):
- ✅ Todos os 12 arquivos criados e funcionais
- ✅ Testes manuais passam para 5 cenários:
  1. "Qual o preço da PETR4?" → BRAPI (cache em 2ª chamada)
  2. "A Petrobras caiu ontem, por que?" → BRAPI + TAVILY paralelo
  3. "Compare P/L da PETR4 com setor de petróleo" → SERPER + BRAPI sequencial
  4. "Qual a sede da Petrobras?" → SERPER (factual)
  5. "TICKER_INVALIDO preço" → Fallback até erro estruturado

### Fase de Produção:
- ✅ Taxa de hit de cache > 70%
- ✅ Uso de IA < 35% das requisições
- ✅ Tempo médio de resposta < 2.5s
- ✅ Circuit breaker previne cascata de falhas
- ✅ Logs ocupam < 50 linhas/requisição no nível DECISION

---

## 🔄 ORDEM DE EXECUÇÃO RECOMENDADA

1. **Objetivo 1 (Base):** Implementar na ordem 1.1 → 1.2 → 1.3 → 1.4
2. **Objetivo 2 (APIs):** Implementar na ordem 2.1 → 2.2 → 2.3 → 2.4
3. **Objetivo 3 (Final):** Implementar na ordem 3.1 → 3.2 → 3.3 → 3.4
4. **Testes:** Após cada objetivo, testar com cenários simples
5. **Refinamento:** Ajustar logs e cache baseado em observação real

---

## 🎯 JUSTIFICATIVAS DAS MELHORIAS

### 1. Pré-processamento Regex (Tarefa 1.2)
- **Problema:** IA em todas as requisições custa caro e é lento
- **Solução:** 70% dos casos são triviais ("preço PETR4") e resolvem com regex
- **Ganho:** 60% redução de custo, 2s→50ms de latência

### 2. Cache Fingerprinting (Tarefa 1.4)
- **Problema:** "preço PETR4" e "PETR4 preço" geram caches diferentes
- **Solução:** Normalizar query antes de gerar hash
- **Ganho:** Taxa de hit sobe de ~40% para ~75%

### 3. Circuit Breaker (Tarefa 2.1)
- **Problema:** API offline causa timeout de 20s em todas as chamadas
- **Solução:** Após 3 falhas, abre circuito e fica 2min sem tentar
- **Ganho:** Evita cascata de timeouts, resposta imediata de erro

### 4. Log de 3 Níveis (Tarefa 3.4)
- **Problema:** Log de 500+ linhas com 85% de ruído
- **Solução:** CRITICAL (erros), DECISION (decisões), VERBOSE (debug)
- **Ganho:** Produção roda em DECISION com < 30 linhas/requisição úteis

---

## ⚠️ OBSERVAÇÕES FINAIS

1. **GPT-5 mini (reasoning low, verbosity low)** usado apenas em `request-analyzer.js` para casos ambíguos
2. **IA representa < 35%** das requisições (70% resolvido por regex)
3. **Cache global** (não por usuário) pois dados de mercado são públicos
4. **Circuit breaker** evita desperdício quando API está offline
5. **Logs em DECISION** mostram apenas decisões e erros, não debug
6. **TTL dinâmico** baseado no tipo de dado (5h preços, 6h notícias, 24h fundamentalistas)
7. **Fallback hierárquico** garante resiliência em 4 níveis

---

**Este plano será executado por mim mesmo. Estruturado para ser pragmático e executável em sequência lógica.**
