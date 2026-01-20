# ⚡ Cliente Serper

## Propósito
Cliente para a API Serper - usado para consultas rápidas e preços de ativos.

## Arquivos que devem estar aqui
- `serper-client.js` - Cliente principal
- `serper-parser.js` - Parser de resultados do Google
- `price-extractor.js` - Extrator de preços de snippets

## Responsabilidades
1. Fazer requisições à API Serper (Google Search)
2. Extrair dados de snippets
3. Parsear preços de ativos
4. Buscar notícias recentes (headlines)
5. Buscar indicadores econômicos
6. Calcular custos (US$ 0.01 por busca)
7. Cachear resultados

## Quando Usar
- Preços de ações, fundos, criptomoedas
- Notícias recentes (headline suficiente)
- Indicadores econômicos (Selic, IPCA, CDI)
- Validação rápida de informação
- Qualquer consulta que não precisa de texto completo

## Custo
US$ 0.01 por busca - 5x mais barato que Tavily
