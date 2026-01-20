# 🔍 Cliente Tavily

## Propósito
Cliente para a API Tavily - usado para pesquisas profundas e análises de mercado.

## Arquivos que devem estar aqui
- `tavily-client.js` - Cliente principal
- `tavily-formatter.js` - Formatador de respostas
- `tavily-cache.js` - Cache de resultados (1 hora)

## Responsabilidades
1. Fazer requisições à API Tavily
2. Configurar search_depth (basic ou advanced)
3. Extrair conteúdo relevante das respostas
4. Calcular custos (US$ 0.05 por busca)
5. Cachear resultados para evitar custos redundantes
6. Tratar erros e timeouts

## Quando Usar
- Análises profundas de mercado
- Research setorial
- Conteúdo completo de artigos
- Comparação entre múltiplas fontes
- Quando precisa de texto completo (não só headline)

## Custo
US$ 0.05 por busca - usar com moderação
