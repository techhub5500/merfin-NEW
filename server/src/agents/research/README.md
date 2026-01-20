# 🔍 Agente Pesquisador

## Propósito
Agente responsável por buscar informações atualizadas na web usando APIs externas (Tavily e Serper). Especializado em dados de mercado financeiro.

## Arquivos que devem estar aqui
- `research-agent.js` - Classe principal do agente
- `api-selector.js` - Lógica para escolher entre Tavily e Serper
- `asset-price-searcher.js` - Busca preços de ativos
- `news-searcher.js` - Busca notícias do mercado
- `market-analysis-searcher.js` - Busca análises profundas
- `economic-indicators-searcher.js` - Busca indicadores econômicos
- `result-parser.js` - Parse e extração de dados dos resultados

## Responsabilidades
1. Escolher API adequada baseado no tipo de pesquisa:
   - **Serper**: Consultas rápidas, preços, headlines 
   - **Tavily**: Análises profundas, research, conteúdo completo 
2. Validar qualidade das fontes retornadas
3. Extrair dados estruturados de textos
4. Agregar múltiplas fontes quando necessário
5. Cachear resultados conforme volatividade da informação, vamos dividir em dados com alta volatividade, dados com volatividade media e dados com volatividade baixa, o tempo de cacheamento será de: 1 hora; 1 dia e 5 dias, respectivamento.
6. Tratar rate limits e timeouts das APIs

## Tools Implementadas
- `search_asset_prices` - Preços de ações, fundos, cripto (Serper)
- `search_market_news` - Notícias recentes (Serper)
- `search_market_analysis` - Análises profundas (Tavily)
- `search_economic_indicators` - Selic, IPCA, CDI, PIB (Serper)
