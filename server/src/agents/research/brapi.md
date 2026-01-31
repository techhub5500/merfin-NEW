RESUMO EXECUTIVO - BRAPI API PARA SEU AGENTE DE PESQUISA
🎯 O QUE VOCÊ PRECISA SABER
A brapi.dev é a API REST oficial para o mercado financeiro brasileiro. Ela fornece dados estruturados de ações, FIIs, BDRs, ETFs, criptomoedas, câmbio e indicadores econômicos com fontes oficiais (B3, CVM, IBGE, Banco Central).

⚡ ENDPOINT PRINCIPAL: /quote (Cotações)
Quando usar no seu sistema:

✅ Validar preços em tempo real de ações/FIIs
✅ Obter dados fundamentalistas (P/L, P/VP, ROE, margem, etc.)
✅ Consultar dividendos e proventos
✅ Buscar histórico de cotações (até anos atrás)
✅ Dados de volume, market cap, variação percentual

Instalação (SDK Oficial - RECOMENDADO):
bashnpm install brapi
Código Básico com SDK:
javascriptimport Brapi from 'brapi';

const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY
});

// Buscar cotação simples
const quote = await client.quote.retrieve('PETR4');
console.log(quote.results[0].regularMarketPrice); // 38.50

// Múltiplos ativos + histórico + fundamentos
const quotes = await client.quote.retrieve('PETR4,VALE3,ITUB4', {
  range: '1mo',           // Histórico de 1 mês
  interval: '1d',         // Dados diários
  fundamental: true,      // Inclui P/L, ROE, etc
  dividends: true         // Inclui dividendos
});
Sem SDK (HTTP Manual):
javascript// Com token (produção)
const response = await fetch('https://brapi.dev/api/quote/PETR4,VALE3', {
  headers: {
    'Authorization': `Bearer ${process.env.BRAPI_API_KEY}`
  }
});

// Teste SEM token (apenas PETR4, MGLU3, VALE3, ITUB4)
const testResponse = await fetch('https://brapi.dev/api/quote/PETR4');
```

---

## 📊 PARÂMETROS CRÍTICOS PARA SEU SISTEMA

### URL Base:
```
https://brapi.dev/api/quote/{TICKERS}
Parâmetros Query:
ParâmetroValoresDescriçãoSeu Usorange1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, maxPeríodo histórico1mo para análises recentesinterval1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3moGranularidade1d para dados diáriosfundamentaltrue, falseInclui dados fundamentalistastrue para P/L, ROE, etcdividendstrue, falseInclui dividendostrue para DYmodulesString separada por vírgulaMódulos adicionaisVer tabela abaixo
Módulos Disponíveis (modules):
javascript// Exemplo completo
const quote = await client.quote.retrieve('PETR4', {
  modules: 'summaryProfile,fundOwnership,insiderHolders'
});
MóduloDescriçãosummaryProfilePerfil da empresa (setor, funcionários, site)fundOwnershipPrincipais fundos que detêm a açãoinsiderHoldersAcionistas controladoresassetProfileInformações detalhadas do ativo

🔥 RESPOSTA ESTRUTURADA (JSON)
javascript{
  "results": [
    {
      "symbol": "PETR4",
      "shortName": "PETROBRAS PN",
      "longName": "Petróleo Brasileiro S.A. - Petrobras",
      "currency": "BRL",
      
      // 💰 PREÇOS
      "regularMarketPrice": 38.50,        // Preço atual
      "regularMarketDayHigh": 39.00,      // Máxima do dia
      "regularMarketDayLow": 38.20,       // Mínima do dia
      "regularMarketChange": 0.30,        // Variação absoluta
      "regularMarketChangePercent": 0.78, // Variação %
      "regularMarketTime": "2024-10-26T17:08:00.000Z",
      
      // 📊 VOLUME & MERCADO
      "marketCap": 503100000000,          // Valor de mercado
      "regularMarketVolume": 45678901,    // Volume negociado
      
      // 📈 DADOS FUNDAMENTALISTAS (se fundamental=true)
      "priceEarnings": 4.23,              // P/L
      "earningsPerShare": 9.10,           // LPA
      "priceToBook": 1.05,                // P/VP
      "returnOnEquity": 0.248,            // ROE (24.8%)
      "dividendYield": 0.0856,            // Dividend Yield (8.56%)
      
      // 💵 DIVIDENDOS (se dividends=true)
      "dividendsData": {
        "cashDividends": [...],           // Histórico de dividendos
        "stockDividends": [...],          // Bonificações
        "subscriptions": [...]            // Subscrições
      },
      
      // 📷 VISUAL
      "logourl": "https://icons.brapi.dev/logos/PETR4.png"
    }
  ]
}

🎯 INTEGRAÇÃO COM SEU SISTEMA
Cenário 1: Validar Queda de Ação
javascript// Seu agente recebe: "A Petrobras caiu 3% ontem, por que?"

async function validarQueda(ticker, periodo = '5d') {
  const client = new Brapi({ apiKey: process.env.BRAPI_API_KEY });
  
  const quote = await client.quote.retrieve(ticker, {
    range: periodo,
    interval: '1d'
  });
  
  const hoje = quote.results[0];
  
  return {
    ticker: hoje.symbol,
    preco_atual: hoje.regularMarketPrice,
    variacao_pct: hoje.regularMarketChangePercent,
    variacao_abs: hoje.regularMarketChange,
    validacao: hoje.regularMarketChangePercent < -2.5 ? 'QUEDA_CONFIRMADA' : 'QUEDA_NAO_SIGNIFICATIVA',
    timestamp: hoje.regularMarketTime
  };
}

// Uso no seu agente
const brapi = await validarQueda("PETR4", "5d");
// { variacao_pct: -3.2, validacao: 'QUEDA_CONFIRMADA' }
Cenário 2: Comparar P/L com Setor
javascriptasync function compararPLSetor(ticker, tickersSetor) {
  const client = new Brapi({ apiKey: process.env.BRAPI_API_KEY });
  
  // Busca todos em uma única request
  const tickers = [ticker, ...tickersSetor].join(',');
  const quotes = await client.quote.retrieve(tickers, {
    fundamental: true
  });
  
  const target = quotes.results.find(q => q.symbol === ticker);
  const setor = quotes.results.filter(q => q.symbol !== ticker);
  
  const mediaPL = setor.reduce((acc, q) => acc + q.priceEarnings, 0) / setor.length;
  
  return {
    pl_empresa: target.priceEarnings,
    pl_setor_medio: mediaPL,
    comparacao: target.priceEarnings < mediaPL ? 'ABAIXO_MEDIA' : 'ACIMA_MEDIA',
    diferenca_pct: ((target.priceEarnings / mediaPL - 1) * 100).toFixed(2)
  };
}

// Uso
const comparacao = await compararPLSetor('PETR4', ['PRIO3', 'RECV3']);
// { pl_empresa: 4.23, pl_setor_medio: 8.5, comparacao: 'ABAIXO_MEDIA' }
Cenário 3: Verificar Dividend Yield
javascriptasync function verificarDividendos(ticker) {
  const client = new Brapi({ apiKey: process.env.BRAPI_API_KEY });
  
  const quote = await client.quote.retrieve(ticker, {
    fundamental: true,
    dividends: true
  });
  
  const ativo = quote.results[0];
  
  return {
    ticker: ativo.symbol,
    dividend_yield: (ativo.dividendYield * 100).toFixed(2) + '%',
    preco_atual: ativo.regularMarketPrice,
    ultimo_dividendo: ativo.dividendsData.cashDividends[0], // Mais recente
    total_dividendos_12m: calcularDividendos12Meses(ativo.dividendsData)
  };
}

🚨 ORIENTAÇÕES CRÍTICAS
1. Autenticação
javascript// ✅ RECOMENDADO: Header (mais seguro)
headers: {
  'Authorization': `Bearer ${process.env.BRAPI_API_KEY}`
}

// ⚠️ NÃO RECOMENDADO: Query param (menos seguro)
url: 'https://brapi.dev/api/quote/PETR4?token=SEU_TOKEN'
2. Teste GRÁTIS (sem token)
javascript// 4 ações disponíveis SEM token:
const testTickers = ['PETR4', 'MGLU3', 'VALE3', 'ITUB4'];

// Funciona SEM autenticação
const response = await fetch('https://brapi.dev/api/quote/PETR4,VALE3');
3. Rate Limits & Custos

Documentação não especifica rate limits explícitos
Recomendação: Implemente retry com backoff
Use cache agressivo para dados fundamentalistas (TTL: 24h)
Cotações em tempo real: cache de 5 horas (conforme seu doc)

4. Múltiplos Ativos em Uma Request
javascript// ✅ EFICIENTE: 1 request para 10 ações
const quotes = await client.quote.retrieve('PETR4,VALE3,ITUB4,BBDC4,MGLU3');

// ❌ INEFICIENTE: 5 requests separadas
const petr4 = await client.quote.retrieve('PETR4');
const vale3 = await client.quote.retrieve('VALE3');
// ...
5. Tratamento de Erros
javascripttry {
  const quote = await client.quote.retrieve('TICKER_INVALIDO');
} catch (error) {
  if (error.status === 401) {
    // Token inválido
  } else if (error.status === 404) {
    // Ticker não encontrado
  } else if (error.status === 429) {
    // Rate limit excedido - acionar fallback
  }
}

🔗 OUTROS ENDPOINTS ÚTEIS
1. Criptomoedas (/crypto)
javascriptconst crypto = await fetch('https://brapi.dev/api/v2/crypto?coin=BTC');
2. Câmbio/Moedas (/currency)
javascriptconst usd = await fetch('https://brapi.dev/api/v2/currency?currency=USD-BRL');
3. Inflação (IPCA, IGP-M) (/inflation)
javascriptconst ipca = await fetch('https://brapi.dev/api/v2/inflation?country=brazil&sortBy=date');
4. Taxa SELIC (/prime-rate)
javascriptconst selic = await fetch('https://brapi.dev/api/v2/prime-rate?country=brazil&sortBy=date');

🎯 REGRAS DE ROTEAMENTO (Decision Tree)
javascript// Integração com seu sistema de análise semântica

if (analysis.keywords.includes("preço") || 
    analysis.keywords.includes("cotação") ||
    analysis.keywords.includes("valor")) {
  // ✅ BRAPI
  return await brapiGetPrice(ticker);
}

if (analysis.keywords.includes("P/L") || 
    analysis.keywords.includes("ROE") ||
    analysis.keywords.includes("margem")) {
  // ✅ BRAPI com fundamental=true
  return await brapiGetFundamentals(ticker);
}

if (analysis.keywords.includes("dividendo") || 
    analysis.keywords.includes("yield") ||
    analysis.keywords.includes("DY")) {
  // ✅ BRAPI com dividends=true
  return await brapiGetDividends(ticker);
}

if (analysis.keywords.includes("por que") || 
    analysis.keywords.includes("motivo")) {
  // ✅ TAVILY (contexto qualitativo)
  return await tavilySearch(query);
}

🚀 EXEMPLO COMPLETO: EXECUÇÃO PARALELA
javascript// Cenário: "A Petrobras caiu 3% ontem, por que isso aconteceu?"

async function pesquisarQuedaAcao(ticker, pergunta) {
  const [brapiData, tavilyContext] = await Promise.all([
    // Thread A: BRAPI valida dados numéricos
    client.quote.retrieve(ticker, {
      range: '5d',
      interval: '1d',
      fundamental: true
    }),
    
    // Thread B: TAVILY busca contexto
    tvly.search(`${ticker} queda ontem motivo notícias`, {
      topic: 'finance',
      search_depth: 'advanced',
      time_range: 'day',
      max_results: 5
    })
  ]);
  
  const acao = brapiData.results[0];
  
  return {
    // Dados estruturados (BRAPI)
    validacao_numerica: {
      ticker: acao.symbol,
      preco_atual: acao.regularMarketPrice,
      variacao_pct: acao.regularMarketChangePercent,
      variacao_confirmada: acao.regularMarketChangePercent < -2.5
    },
    
    // Contexto qualitativo (TAVILY)
    analise_mercado: {
      resumo_ia: tavilyContext.answer,
      fontes_noticias: tavilyContext.results.slice(0, 3).map(r => ({
        titulo: r.title,
        url: r.url
      }))
    },
    
    // Metadata
    fontes_usadas: ['BRAPI', 'TAVILY'],
    timestamp: new Date().toISOString()
  };
}

📊 CACHE INTELIGENTE (conforme seu doc)
javascript// Baseado no seu sistema de TTLs

const CACHE_TTLS = {
  // BRAPI
  precos_atuais: 5 * 60 * 60 * 1000,        // 5 horas
  fundamentalistas: 24 * 60 * 60 * 1000,    // 24 horas
  dividendos: 24 * 60 * 60 * 1000,          // 24 horas
  historico_mensal: 24 * 60 * 60 * 1000,    // 24 horas
  
  // TAVILY
  noticias: 6 * 60 * 60 * 1000              // 6 horas
};

async function brapiComCache(ticker, opcoes = {}) {
  const cacheKey = `brapi:${ticker}:${JSON.stringify(opcoes)}`;
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    const idade = Date.now() - cached.timestamp;
    const ttl = opcoes.fundamental ? CACHE_TTLS.fundamentalistas : CACHE_TTLS.precos_atuais;
    
    if (idade < ttl) {
      return cached.data;
    }
  }
  
  const fresh = await client.quote.retrieve(ticker, opcoes);
  await cache.set(cacheKey, { 
    data: fresh, 
    timestamp: Date.now() 
  });
  
  return fresh;
}