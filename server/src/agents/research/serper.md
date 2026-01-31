RESUMO EXECUTIVO - SERPER API PARA SEU AGENTE DE PESQUISA
🎯 O QUE VOCÊ PRECISA SABER
Serper.dev é uma API de busca do Google com foco em velocidade e simplicidade. No seu sistema, ele atua como fallback e para buscas factuais rápidas.

⚡ ENDPOINT PRINCIPAL: /search
Quando usar no seu sistema:

✅ Fallback quando Tavily falhar (timeout, rate limit)
✅ Buscas factuais triviais (sede da empresa, data de fundação, telefone)
✅ Descoberta de entidades (ex: identificar tickers do setor de petróleo)
✅ Busca rápida e leve quando não precisa de análise profunda

URL Base:
https://google.serper.dev/search

🔧 CONFIGURAÇÃO RECOMENDADA PARA MERCADO FINANCEIRO
javascriptconst serperSearch = async (query, options = {}) => {
  const myHeaders = new Headers();
  myHeaders.append("X-API-KEY", process.env.SERPER_API_KEY);
  myHeaders.append("Content-Type", "application/json");

  const payload = {
    q: query,
    
    // 🌍 Geolocalização Brasil
    gl: "br",              // Google location: Brazil
    hl: "pt",              // Host language: Português
    
    // 📊 Quantidade de resultados
    num: options.num || 10, // Default: 10 (máx: 100)
    
    // 📅 Filtro temporal (opcional)
    tbs: options.timeRange || null, // "qdr:d" (dia), "qdr:w" (semana), "qdr:m" (mês)
    
    // 🔍 Tipo de busca (opcional)
    type: options.type || "search", // "search", "news", "images"
    
    // 🎯 Autosugestão (opcional)
    autocorrect: true,     // Corrige erros de digitação
    
    // 📄 Página (paginação)
    page: options.page || 1
  };

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify(payload),
    redirect: "follow"
  };

  try {
    const response = await fetch("https://google.serper.dev/search", requestOptions);
    
    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[SERPER ERROR]', error);
    throw error;
  }
};

📊 RESPOSTA ESTRUTURADA (JSON)
javascript{
  "searchParameters": {
    "q": "Petrobras sede endereço",
    "gl": "br",
    "hl": "pt",
    "num": 10,
    "type": "search"
  },
  
  // 🎯 KNOWLEDGE GRAPH (informações estruturadas)
  "knowledgeGraph": {
    "title": "Petrobras",
    "type": "Company",
    "description": "Petróleo Brasileiro S.A. — Petrobras é uma empresa...",
    "attributes": {
      "Fundação": "3 de outubro de 1953",
      "Sede": "Rio de Janeiro, RJ",
      "CEO": "Jean Paul Prates (maio de 2023–)",
      "Número de funcionários": "45.532 (2022)"
    }
  },
  
  // 🔍 RESULTADOS ORGÂNICOS
  "organic": [
    {
      "title": "Petrobras - Sobre a Companhia",
      "link": "https://petrobras.com.br/pt/quem-somos/",
      "snippet": "A Petrobras é uma empresa integrada de energia...",
      "position": 1,
      "date": "há 2 dias"  // Se disponível
    },
    {
      "title": "Petrobras: cotação, notícias e análises - InfoMoney",
      "link": "https://www.infomoney.com.br/cotacoes/petr4/",
      "snippet": "Acompanhe a cotação de PETR4...",
      "position": 2
    }
    // ... até 10 resultados
  ],
  
  // 📰 NOTÍCIAS (se type="news" ou se houver box de notícias)
  "news": [
    {
      "title": "Petrobras anuncia dividendos recordes",
      "link": "https://...",
      "snippet": "A estatal anunciou...",
      "date": "há 3 horas",
      "source": "Valor Econômico"
    }
  ],
  
  // ❓ PEOPLE ALSO ASK
  "peopleAlsoAsk": [
    {
      "question": "Qual é a sede da Petrobras?",
      "snippet": "A sede da Petrobras fica no Rio de Janeiro...",
      "link": "https://..."
    }
  ],
  
  // 🔗 RELATED SEARCHES
  "relatedSearches": [
    {
      "query": "petrobras telefone"
    },
    {
      "query": "petrobras investor relations"
    }
  ]
}

🎯 CASOS DE USO ESPECÍFICOS NO SEU SISTEMA
1. Busca Factual Trivial
javascript// Exemplo: "Qual a sede da Petrobras?"

async function buscarInfoAdministrativa(empresa) {
  const result = await serperSearch(`${empresa} sede endereço telefone`, {
    num: 3,  // Poucos resultados suficientes
    gl: "br",
    hl: "pt"
  });
  
  // Prioriza Knowledge Graph (dados estruturados)
  if (result.knowledgeGraph) {
    return {
      fonte: 'SERPER_KNOWLEDGE_GRAPH',
      dados: {
        nome: result.knowledgeGraph.title,
        descricao: result.knowledgeGraph.description,
        sede: result.knowledgeGraph.attributes?.Sede,
        fundacao: result.knowledgeGraph.attributes?.Fundação,
        ceo: result.knowledgeGraph.attributes?.CEO
      }
    };
  }
  
  // Fallback: extrai do snippet do primeiro resultado
  return {
    fonte: 'SERPER_ORGANIC',
    snippet: result.organic[0]?.snippet,
    url: result.organic[0]?.link
  };
}

// Uso
const info = await buscarInfoAdministrativa("Petrobras");
// { sede: "Rio de Janeiro, RJ", fundacao: "3 de outubro de 1953" }
2. Descoberta de Tickers do Setor
javascript// Exemplo: "Compare P/L da Petrobras com setor de petróleo"
// Serper identifica quais são as empresas do setor

async function identificarTickersSetor(setor) {
  const result = await serperSearch(
    `principais empresas ${setor} Brasil B3 tickers ações`,
    {
      num: 5,
      gl: "br",
      hl: "pt"
    }
  );
  
  // Extrai tickers dos snippets (regex simples)
  const tickersEncontrados = new Set();
  const tickerRegex = /\b([A-Z]{4}\d{1,2})\b/g;
  
  result.organic.forEach(item => {
    const matches = item.snippet.match(tickerRegex);
    if (matches) {
      matches.forEach(t => tickersEncontrados.add(t));
    }
  });
  
  return Array.from(tickersEncontrados);
}

// Uso
const tickersSetor = await identificarTickersSetor("petróleo");
// ["PETR4", "PETR3", "PRIO3", "RECV3"]
3. Fallback Quando Tavily Falhar
javascript// Sistema de fallback hierárquico do seu doc

async function pesquisarContextoQualitativo(query) {
  try {
    // Tenta TAVILY primeiro (fonte primária)
    return await tavilySearch(query, {
      topic: 'finance',
      search_depth: 'advanced',
      time_range: 'day'
    });
  } catch (tavilyError) {
    console.log('[FALLBACK] Tavily falhou, tentando Serper...');
    
    try {
      // Fallback Nível 2: SERPER
      const serperResult = await serperSearch(query, {
        num: 5,
        gl: 'br',
        hl: 'pt'
      });
      
      return {
        fonte: 'SERPER_FALLBACK',
        conteudo: serperResult.organic.slice(0, 3).map(r => ({
          titulo: r.title,
          snippet: r.snippet,
          url: r.link,
          data: r.date
        })),
        advertencia: 'Dados de fallback (Serper) - menos profundo que Tavily'
      };
    } catch (serperError) {
      console.log('[FALLBACK] Serper também falhou, tentando cache...');
      
      // Fallback Nível 3: Cache antigo
      return await buscarCacheAntigo(query, { maxAge: 48 * 60 * 60 * 1000 });
    }
  }
}
4. Buscar Notícias Recentes (alternativa ao Tavily)
javascriptasync function buscarNoticiasSerper(ticker, periodo = 'day') {
  const timeRangeMap = {
    'day': 'qdr:d',
    'week': 'qdr:w',
    'month': 'qdr:m',
    'year': 'qdr:y'
  };
  
  const result = await serperSearch(`${ticker} notícias`, {
    num: 10,
    gl: 'br',
    hl: 'pt',
    tbs: timeRangeMap[periodo],  // Filtro temporal
    type: 'news'                   // Força busca de notícias
  });
  
  return {
    fonte: 'SERPER_NEWS',
    noticias: result.news || result.organic,
    total: result.news?.length || 0
  };
}

// Uso
const noticias = await buscarNoticiasSerper('PETR4', 'day');

🔧 PARÂMETROS AVANÇADOS
Filtros Temporais (tbs):
javascriptconst timeFilters = {
  'ultima_hora': 'qdr:h',
  'ultimo_dia': 'qdr:d',
  'ultima_semana': 'qdr:w',
  'ultimo_mes': 'qdr:m',
  'ultimo_ano': 'qdr:y'
};

// Exemplo
await serperSearch('PETR4 dividendos', { tbs: 'qdr:m' }); // Último mês
Tipos de Busca (type):
javascriptconst searchTypes = {
  'web': 'search',      // Busca normal
  'noticias': 'news',   // Notícias
  'imagens': 'images',  // Imagens
  'videos': 'videos'    // Vídeos
};
Operadores de Busca (Google Search Operators):
javascript// Busca exata
await serperSearch('"Petrobras dividendos 2024"');

// Excluir termos
await serperSearch('Petrobras -Lava Jato');

// Site específico
await serperSearch('site:investidorsardinha.com.br PETR4');

// OR lógico
await serperSearch('PETR4 OR PETR3');

// Intervalo numérico
await serperSearch('PETR4 dividendos 2020..2024');

🚨 TRATAMENTO DE ERROS & LIMITES
Rate Limits:
javascript// Serper: 2.500 requests/mês no plano free
// Implementar retry com backoff

async function serperComRetry(query, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await serperSearch(query, options);
    } catch (error) {
      if (error.status === 429) { // Rate limit
        const delay = Math.pow(2, i) * 1000; // Backoff exponencial
        console.log(`[SERPER] Rate limit, retry em ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Outro erro, não retenta
      }
    }
  }
  throw new Error('Serper: Max retries excedido');
}
Timeout (20s conforme seu doc):
javascriptasync function serperComTimeout(query, options = {}) {
  return Promise.race([
    serperSearch(query, options),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Serper timeout')), 20000)
    )
  ]);
}