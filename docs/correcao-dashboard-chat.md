# Correção: Dashboard Cards e Chat

**Data:** 27 de Janeiro de 2026  
**Status:** ✅ Concluído

---

## Resumo Executivo

Foram identificados e corrigidos dois problemas distintos que afetavam a página `dash.html` e `invest.html`:

1. **Erro 404 nos Cards** - Os dados do carrossel não carregavam
2. **Erro 400 no Chat** - O chat retornava erro ao enviar mensagens

---

## Problema 1: Cards do Carrossel Não Carregam (Erro 404)

### Sintoma
```
POST http://localhost:3000/api/agent/execute 404 (Not Found)
```

### Causa Raiz
O arquivo `dataService.js` estava configurado para enviar requisições para a **porta 3000** (server.js), mas a rota `/api/agent/execute` só existe no **serverAgent.js** (porta 5000).

### Arquitetura do Sistema
```
┌─────────────────────────────────────────────────────────────────┐
│                        SERVIDORES                               │
├─────────────────────────────────────────────────────────────────┤
│  server.js (porta 3000)          serverAgent.js (porta 5000)    │
│  ├── Páginas HTML               ├── /api/agent/execute          │
│  ├── /api/auth/*                ├── /api/chat/process           │
│  └── /api/chat/history/*        ├── /api/agent/health           │
│                                 └── DataAgent, JuniorAgent      │
└─────────────────────────────────────────────────────────────────┘
```

### Correção Aplicada
**Arquivo:** `client/js/dataService.js`

```javascript
// ANTES (errado)
const AGENT_API_URL = 'http://localhost:3000/api/agent/execute';

// DEPOIS (correto)
const AGENT_API_URL = 'http://localhost:5000/api/agent/execute';
```

---

## Problema 2: Chat Retorna Erro 400 (Bad Request)

### Sintoma
```
POST http://localhost:5000/api/chat/process 400 (Bad Request)
[SERVER] ❌ Validação falhou: userId ausente no request body
```

### Causa Raiz
O `serverAgent.js` **exige** que o campo `userId` seja enviado no request body para processar mensagens de chat. Porém, os arquivos `dash.js` e `invest.js` não estavam passando esse parâmetro para a função `sendToChatAPI()`.

### Comparação do Código

| Arquivo | Chamada | Status |
|---------|---------|--------|
| `main.js` | `sendToChatAPI(text, sessionId, history, userId, chatId)` | ✅ Funciona |
| `dash.js` | `sendToChatAPI(message, sessionId, history)` | ❌ Falta userId e chatId |
| `invest.js` | `sendToChatAPI(message, sessionId, history)` | ❌ Falta userId e chatId |

### Correções Aplicadas

**Arquivo:** `client/js/dash.js` (linha ~152)
```javascript
// ANTES
const response = await chatIntegration.sendToChatAPI(message, window.dashSessionId, history);

// DEPOIS
const userId = getUserId();
const response = await chatIntegration.sendToChatAPI(message, window.dashSessionId, history, userId, window.dashChatId);
```

**Arquivo:** `client/js/invest.js` (linha ~413)
```javascript
// ANTES
const response = await chatIntegration.sendToChatAPI(message, this.sessionId, history);

// DEPOIS
const userId = getUserId();
const response = await chatIntegration.sendToChatAPI(message, this.sessionId, history, userId, this.chatId);
```

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `client/js/dataService.js` | Corrigida URL da API de agentes (porta 3000 → 5000) |
| `client/js/dash.js` | Adicionados parâmetros `userId` e `chatId` na chamada do chat |
| `client/js/invest.js` | Adicionados parâmetros `userId` e `chatId` na chamada do chat |

---

## Verificação

### Servidores Ativos
- ✅ `server.js` rodando na porta **3000**
- ✅ `serverAgent.js` rodando na porta **5000**

### Endpoints Testados
```bash
# Health check do serverAgent
GET http://localhost:5000/health → OK

# Health check do server principal
GET http://localhost:3000/api → OK
```

---

## Como Testar

1. Certifique-se que ambos os servidores estão rodando:
   ```bash
   # Terminal 1 - Servidor principal
   cd server
   node server.js
   
   # Terminal 2 - Servidor de agentes
   cd server
   node serverAgent.js
   ```

2. Acesse `http://localhost:3000/dash.html`

3. Verifique:
   - [ ] Cards do carrossel carregam dados
   - [ ] Chat responde às mensagens sem erro
   - [ ] Console não mostra erros 404 ou 400

---

## Lições Aprendidas

1. **Consistência entre arquivos**: O `main.js` servia como referência funcional, mas `dash.js` e `invest.js` não seguiam o mesmo padrão

2. **Separação de servidores**: O sistema usa dois servidores Express separados - é importante saber qual rota pertence a qual servidor

3. **Validação obrigatória**: O serverAgent exige `userId` para o sistema de memória funcionar corretamente

---

## Notas Técnicas

### Fluxo do Chat (Corrigido)
```
1. Usuário envia mensagem
2. Frontend obtém userId do localStorage
3. Frontend chama createChatOnMain() no server.js (porta 3000)
4. Frontend chama sendToChatAPI() no serverAgent.js (porta 5000)
   └── Passa: message, sessionId, history, userId, chatId
5. JuniorAgent processa a mensagem
6. Resposta é exibida no chat
7. Mensagem é persistida no histórico
```

### Fluxo dos Cards (Corrigido)
```
1. Dashboard carrega
2. dataService.executeAgent() é chamado
3. Requisição vai para http://localhost:5000/api/agent/execute
4. DataAgent processa e retorna dados
5. Cards são populados
```
