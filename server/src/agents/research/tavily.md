RESUMO EXECUTIVO - TAVILY API PARA SEU AGENTE DE PESQUISA
🎯 O QUE VOCÊ PRECISA SABER
A Tavily oferece 4 endpoints principais, mas para seu caso de uso (inteligência qualitativa de mercado financeiro), você usará principalmente 2 deles:

⚡ 1. TAVILY SEARCH (/search) - ENDPOINT PRINCIPAL
Quando usar no seu sistema:

✅ Buscar notícias e contexto sobre quedas/altas de ações
✅ Capturar opinião de analistas e relatórios
✅ Entender causas de eventos (ex: "por que PETR4 caiu 3%?")
✅ Pesquisar tese de investimento e riscos de empresas

Instalação:
bashnpm i @tavily/core
Código Básico:
javascriptconst { tavily } = require("@tavily/core");

const tvly = tavily({ apiKey: "tvly-YOUR_API_KEY" });
const response = await tvly.search("Por que a Petrobras caiu ontem?", {
  topic: "finance",           // ⚠️ IMPORTANTE: use "finance" para mercado
  search_depth: "advanced",   // Retorna conteúdo mais relevante (2 créditos)
  max_results: 5,             // Até 20 resultados possíveis
  include_answer: true,       // LLM gera resposta curta
  time_range: "day"           // Filtra notícias recentes (day/week/month/year)
});
Parâmetros Críticos para Você:
ParâmetroValor RecomendadoPor quê?topic"finance"Otimiza busca para mercado financeirosearch_depth"advanced"Melhor relevância (usa 2 créditos vs 1 no basic)time_range"day" ou "week"Notícias frescas são críticasmax_results5-10Equilíbrio entre qualidade e latênciainclude_answertrueResposta LLM resumida útil para contexto rápidocountry"brazil"Prioriza fontes brasileiras (opcional)
Resposta Estruturada:
javascript{
  "query": "Por que a Petrobras caiu ontem?",
  "answer": "A Petrobras caiu 3% após anúncio de...", // ✅ Resposta LLM
  "results": [
    {
      "title": "Petrobras cai 3% com...",
      "url": "https://...",
      "content": "snippet relevante...",  // Conteúdo otimizado
      "score": 0.95,                      // Relevância (0-1)
      "published_date": "2025-01-29"
    }
  ],
  "response_time": 1.67
}

📄 2. TAVILY EXTRACT (/extract) - COMPLEMENTAR
Quando usar:

Quando /search retornar URLs interessantes mas snippets insuficientes
Para extrair conteúdo completo de relatórios/artigos específicos

Código:
javascriptconst response = await tvly.extract({
  urls: ["https://url-do-relatorio-xp.com"],
  extract_depth: "advanced",  // Pega tabelas e conteúdo embedado
  format: "markdown"          // Retorna em markdown (melhor para LLM)
});
```

### Custo:
- **Basic**: 1 crédito a cada 5 URLs extraídas
- **Advanced**: 2 créditos a cada 5 URLs extraídas

---

## 🚨 ORIENTAÇÕES CRÍTICAS

### 1. **Custos e Limites**
```
✅ Plano FREE: 1.000 créditos/mês
⚠️ Search Basic: 1 crédito/request
⚠️ Search Advanced: 2 créditos/request (RECOMENDADO para finance)
⚠️ Extract: 1-2 créditos a cada 5 URLs

💡 Cálculo: Com 1.000 créditos FREE + search advanced (2 créditos):
   → ~500 buscas avançadas/mês
   → ~16 buscas/dia
2. Rate Limits ⏱️

Não especificado explicitamente na doc
Erro 429 indica rate limit excedido
Recomendação: Implemente retry com backoff exponencial

3. Timeouts Adaptativos
javascript// Seu sistema: timeout inicial 20s
// Tavily não especifica timeout default, então:

const response = await Promise.race([
  tvly.search(query, options),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 20000)
  )
]);
4. Fallback para Serper
javascripttry {
  return await tavilySearch(query);
} catch (error) {
  if (error.code === 429 || error.message.includes('Timeout')) {
    console.log('[FALLBACK] Tavily falhou, usando Serper...');
    return await serperSearch(query);
  }
  throw error;
}

🎯 INTEGRAÇÃO COM SEU SISTEMA
Regra de Roteamento (sua Decision Tree):
javascript// Seu código de análise semântica identifica:
const analysis = {
  intencao: ["entender_causa"],
  keywords_criticas: ["caiu", "por que"]
};

// 👉 DISPARA TAVILY se:
if (
  analysis.keywords.includes("por que") ||
  analysis.keywords.includes("motivo") ||
  analysis.keywords.includes("analistas") ||
  analysis.tipo_informacao.includes("qualitativa")
) {
  return await tavilyFinanceSearch({
    query: objetivo,
    topic: "finance",
    search_depth: "advanced",
    time_range: "day",
    max_results: 5,
    include_answer: true
  });
}
Exemplo de Cenário Real:
INPUT do Agente de Investimentos:
json{
  "objetivo": "A Petrobras caiu 3% ontem, por que isso aconteceu?",
  "contexto": "Usuário quer decidir se compra",
  "tickers": ["PETR4"]
}
SEU AGENTE DE PESQUISA EXECUTA:
javascript// Thread A (paralela): BRAPI valida a queda
const brapi = await validarQueda("PETR4", "ontem");

// Thread B (paralela): TAVILY busca contexto
const tavily = await tvly.search(
  "Petrobras PETR4 queda ontem motivo notícias",
  {
    topic: "finance",
    search_depth: "advanced",
    time_range: "day",
    max_results: 5,
    include_answer: true,
    country: "brazil"
  }
);

// Consolidação
return {
  validacao: brapi.data, // { variacao: -3.2%, data: "2025-01-29" }
  contexto: tavily.answer, // "Caiu devido a anúncio de..."
  fontes: tavily.results.slice(0, 3).map(r => r.url)
};

⚠️ OBSERVAÇÕES IMPORTANTES
❌ O que Tavily NÃO faz (use Brapi):

Não retorna preços de ações/FIIs em tempo real
Não tem dados estruturados (P/L, ROE, dividendos)
Não tem históricos de cotação

✅ O que Tavily FAZ MELHOR:

Contexto qualitativo com IA
Notícias ultra-recentes (time_range: "day")
Análise semântica de relevância (score)
Resposta LLM resumida (include_answer)

🔐 Autenticação:
javascript// Variável de ambiente
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
📊 Cache Inteligente:
javascript// Seu sistema: TTL 6h para notícias
const cacheKey = `tavily:${hash(query)}`;
const cached = await cache.get(cacheKey);

if (cached && cached.timestamp > Date.now() - 6 * 60 * 60 * 1000) {
  return cached.data;
}

const fresh = await tvly.search(query, options);
await cache.set(cacheKey, { data: fresh, timestamp: Date.now() }, '6h');