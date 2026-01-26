# 🚀 Guia Rápido - Testar Sistema de Memória

## Pré-requisitos
- ✅ MongoDB rodando
- ✅ Variáveis de ambiente configuradas (.env)
- ✅ Dependências instaladas (`npm install`)

## Passos para Testar

### 1. Iniciar Servidor
```powershell
cd server
node serverAgent.js
```

**Aguarde**: `serverAgent listening on port 5000`

---

### 2. Teste Básico (Postman/cURL)

#### Requisição 1: Apresentação
```bash
POST http://localhost:5000/api/chat/process
Content-Type: application/json

{
  "message": "Olá, me chamo Edmar",
  "chatId": "test_chat_001",
  "userId": "60d5ec49f1a2c8b1f8e4e1a1",
  "sessionId": "test_session_001"
}
```

**Resposta esperada:**
```json
{
  "response": "Oi, Edmar! Prazer em conhecer você. Como posso ajudar com suas finanças hoje? 😊",
  "sessionId": "test_session_001",
  "timestamp": "2026-01-26T..."
}
```

---

#### Requisição 2: Teste de Memória
```bash
POST http://localhost:5000/api/chat/process
Content-Type: application/json

{
  "message": "Como é meu nome?",
  "chatId": "test_chat_001",
  "userId": "60d5ec49f1a2c8b1f8e4e1a1",
  "sessionId": "test_session_001"
}
```

**Resposta esperada:**
```json
{
  "response": "Seu nome é Edmar! 😊 Posso te ajudar com algo?",
  "sessionId": "test_session_001",
  "timestamp": "2026-01-26T..."
}
```

✅ **Se a IA respondeu corretamente, o sistema está funcionando!**

---

### 3. Verificar MongoDB

#### No MongoDB Compass ou CLI:
```javascript
use <seu_database_name>
db.conversationalmemories.find({ chatId: "test_chat_001" })
```

**Deve mostrar:**
```json
{
  "_id": "...",
  "chatId": "test_chat_001",
  "userId": "60d5ec49f1a2c8b1f8e4e1a1",
  "sessionId": "test_session_001",
  "cumulativeSummary": "",
  "summaryTokens": 0,
  "recentWindow": [
    {
      "role": "user",
      "content": "Olá, me chamo Edmar",
      "timestamp": "...",
      "tokens": 6
    },
    {
      "role": "assistant",
      "content": "Oi, Edmar! Prazer...",
      "timestamp": "...",
      "tokens": 15
    },
    {
      "role": "user",
      "content": "Como é meu nome?",
      "timestamp": "...",
      "tokens": 5
    },
    {
      "role": "assistant",
      "content": "Seu nome é Edmar!...",
      "timestamp": "...",
      "tokens": 8
    }
  ],
  "totalTokens": 34
}
```

---

### 4. Logs Importantes

Ao processar mensagens, você verá:

```
[JuniorAgent] 📨 Processando mensagem: {
  chatId: 'test_chat_001',
  userId: '60d5ec49f1a2c8b1f8e4e1a1',
  ...
}

[JuniorAgent] 💾 Memória carregada: {
  hasSummary: false,
  summaryTokens: 0,
  recentWindowSize: 2,
  totalTokens: 21
}

[JuniorAgent] 📝 Prompt construído: {
  systemLength: 1234,
  contextLength: 567,
  estimatedInputTokens: 450
}

[JuniorAgent] 💰 Tokens consumidos: {
  prompt_tokens: 456,
  completion_tokens: 23,
  total_tokens: 479
}

[JuniorAgent] ✅ Resposta gerada e memória atualizada

[JuniorAgent] 📊 Tokens após atualização: {
  summaryTokens: 0,
  recentWindowTokens: 34,
  totalTokens: 34,
  threshold: 3500
}

[JuniorAgent] 💾 Memória salva: {
  recentWindowSize: 4,
  totalTokens: 34,
  summaryCount: 0
}
```

---

### 5. Testar Resumo Automático (Opcional)

Para forçar o gatilho de resumo, envie ~20 mensagens longas:

```bash
# Mensagem 1
{
  "message": "Estou planejando uma viagem para Europa em julho de 2026. Quero visitar Paris, Roma e Barcelona. Meu orçamento é de R$ 15.000.",
  "chatId": "test_chat_resumo",
  ...
}

# Mensagem 2
{
  "message": "Já economizei R$ 5.000 na minha conta poupança. Quanto ainda preciso guardar por mês?",
  ...
}

# Continue enviando mensagens longas...
```

Após ~15-20 mensagens, você verá no log:

```
[JuniorAgent] 🔄 Threshold atingido - iniciando resumo...

[MemorySummaryService] 📝 Gerando resumo cumulativo...

[MemorySummaryService] ✅ Resumo gerado: {
  summaryLength: 234,
  tokens: 45,
  ...
}

[JuniorAgent] ✅ Resumo concluído: {
  newSummaryLength: 234,
  newSummaryTokens: 45,
  newTotalTokens: 60,
  summaryCount: 1
}
```

Agora verifique no MongoDB:
```json
{
  "cumulativeSummary": "O usuário Edmar está planejando uma viagem para Europa em julho/2026. Orçamento: R$ 15.000. Já economizou R$ 5.000.",
  "summaryTokens": 45,
  "recentWindow": [ /* apenas últimas 4 mensagens */ ],
  "totalTokens": 60,
  "summaryCount": 1
}
```

---

## ⚠️ Problemas Comuns

### Erro: "chatId é obrigatório"
**Causa**: Frontend não enviou `chatId` ou `userId`  
**Solução**: Incluir ambos campos na requisição

### Erro: "Cannot find module"
**Causa**: Servidor não foi reiniciado após criar novos arquivos  
**Solução**: Ctrl+C no terminal e rodar `node serverAgent.js` novamente

### IA não lembra
**Debug**:
1. Verificar se `chatId` é o mesmo em todas as requisições
2. Conferir logs: `[JuniorAgent] 💾 Memória carregada`
3. Verificar MongoDB se documento foi salvo

### Resumo não funciona
**Debug**:
1. Verificar se `totalTokens >= 3500` nos logs
2. Precisa ter > 4 mensagens na janela
3. Conferir variável de ambiente `OPENAI_API_KEY`

---

## ✅ Checklist de Sucesso

- [ ] Servidor inicia sem erros
- [ ] Primeira mensagem funciona
- [ ] Segunda mensagem: IA lembra do nome
- [ ] MongoDB salva documento `conversationalmemories`
- [ ] Logs aparecem corretamente
- [ ] (Opcional) Resumo automático funciona após 20 mensagens

---

## 📞 Suporte

Se encontrar problemas:

1. **Verificar logs do console** (99% dos erros aparecem lá)
2. **Conferir MongoDB** (documento sendo salvo?)
3. **Validar .env** (chaves corretas?)
4. **Ler documentação completa**: `docs/junior-agent.md`
5. **Ler relatório de implementação**: `docs/IMPLEMENTACAO-MEMORIA-PERSISTENTE.md`

---

**Pronto para testar! 🚀**
