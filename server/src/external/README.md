# 🔌 Integrações Externas

## Propósito
Clientes para APIs externas e serviços de terceiros. Isola lógica de integração.

## Estrutura
- **tavily/** - Cliente da API Tavily (pesquisa profunda)
- **serper/** - Cliente da API Serper (pesquisa rápida)
- **llm/** - Clientes de LLMs (OpenAI, Anthropic, etc)

## Responsabilidades
1. Encapsular chamadas a APIs externas
2. Tratar erros de rede e timeouts
3. Implementar retry logic
4. Cachear respostas quando apropriado
5. Logar custos de cada chamada
6. Gerenciar rate limits
7. Formatar requisições e respostas

## Benefícios
- Facilita troca de providers
- Centraliza tratamento de erros
- Permite mocking em testes
- Isola lógica de integração
