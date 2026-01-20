# 🛤️ Rotas da API

## Propósito
Definição de todas as rotas HTTP do sistema.

## Arquivos que devem estar aqui
- `chat-routes.js` - Rotas de chat com agentes
- `account-routes.js` - Rotas de contas
- `transaction-routes.js` - Rotas de transações
- `investment-routes.js` - Rotas de investimentos
- `profile-routes.js` - Rotas de perfil de usuário
- `auth-routes.js` - Rotas de autenticação (já existe em outro lugar)

## Responsabilidades
1. Definir endpoints REST
2. Aplicar middlewares de autenticação
3. Validar parâmetros de requisição
4. Chamar controllers apropriados
5. Retornar respostas HTTP formatadas

## Padrões
- Usar verbos HTTP corretos (GET, POST, PUT, DELETE)
- Retornar códigos de status apropriados
- Incluir validação de entrada em todas as rotas
- Aplicar rate limiting quando apropriado
- Logar todas as requisições
