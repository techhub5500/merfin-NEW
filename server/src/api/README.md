# 🌐 Camada de API

## Propósito
Define as rotas HTTP e controllers para interação com o frontend. Serve como interface entre cliente e sistema de agentes.

## Estrutura
- **routes/** - Definição de rotas Express

## Responsabilidades
1. Receber requisições HTTP do frontend
2. Validar dados de entrada
3. Autenticar e autorizar usuários
4. Chamar o Orquestrador com a query
5. Retornar respostas formatadas (JSON)
6. Implementar streaming Server-Sent Events (SSE)
7. Tratar erros HTTP adequadamente

## Rotas Principais
- `POST /api/chat` - Enviar query para agentes
- `GET /api/chat/stream/:sessionId` - Stream de eventos SSE
- `GET /api/accounts` - Listar contas (dados estáticos inicialmente)
- `GET /api/transactions` - Listar transações (dados estáticos inicialmente)
- `POST /api/transactions` - Criar transação
- `GET /api/profile` - Perfil do usuário
