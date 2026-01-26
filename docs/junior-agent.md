# JuniorAgent — Visão Geral (Atualizado com Memória Persistente)

Este documento descreve, de forma acessível e baseada no código atual, como o agente `JuniorAgent` funciona com seu **sistema de memória persistente**.

**Sumário**
- O que mudou
- Arquitetura de memória
- Fluxo de funcionamento
- Entradas e saídas
- Dependências
- Exemplo prático
- Notas técnicas

---

## O que mudou?

### Antes (Sistema Antigo)
- ❌ Sem memória persistente
- ❌ Contexto vinha apenas do frontend (histórico temporário)
- ❌ IA esquecia informações antigas
- ❌ Modelo: GPT-4.1 Mini

### Agora (Sistema Novo)
- ✅ **Memória persistente** no MongoDB
- ✅ **Janela deslizante** (últimos 2 ciclos íntegros)
- ✅ **Resumo cumulativo** (histórico antigo compactado)
- ✅ **Modelo: GPT-5 Mini** com novos parâmetros
- ✅ **GPT-5 Nano** para resumos automáticos

---

## Arquitetura de Memória

### 1. Três Camadas de Contexto

Quando o agente processa uma mensagem, ele envia para o GPT-5 Mini:

```
[System Prompt com Diretrizes de Memória]
↓
[HISTÓRICO_RESUMIDO] ← Resumo cumulativo (se existir)
↓
[JANELA_ATUAL] ← Últimos 2 ciclos (4 mensagens) íntegros
↓
[Mensagem atual do usuário]
```

### 2. Janela Deslizante

- **Tamanho fixo**: 2 ciclos = 4 mensagens (2 do usuário + 2 do assistente)
- **Conteúdo**: Mensagens mantidas **integralmente** sem alteração
- **Propósito**: Contexto imediato da conversa

### 3. Resumo Cumulativo

- **Gerado por**: GPT-5 Nano (modelo especializado em resumos)
- **Atualização**: `Novo Resumo = IA_Resumo(Resumo Anterior + Mensagens que saíram da janela)`
- **Conteúdo preservado**:
  - Nomes de pessoas
  - Valores monetários, saldos, metas
  - Datas importantes
  - Decisões tomadas
  - Preferências do usuário

### 4. Gatilho de Resumo

- **Métrica**: 1 palavra = 0,75 tokens
- **Threshold**: Quando `totalTokens >= 3500`
- **Ação**: Mensagens excedentes (além das 4 últimas) são resumidas e incorporadas ao resumo cumulativo

---

## Fluxo de Funcionamento

### Inicialização
1. Agente inicializa com configuração do GPT-5 Mini
2. Define parâmetros:
   - `model`: `gpt-5-mini`
   - `verbosity`: `medium`
   - `reasoning_effort`: `medium`
   - `TOKEN_THRESHOLD`: `3500`
   - `RECENT_WINDOW_SIZE`: `4`

### Processamento de Mensagem (Passo a Passo)

#### Etapa 1: Recebimento e Validação
- Recebe `message`, `chatId`, `userId`, `sessionId`
- Valida campos obrigatórios

#### Etapa 2: Carregar Memória
- Busca documento `ConversationalMemory` no MongoDB usando `chatId`
- Se não existir, cria novo documento vazio
- Carrega:
  - `cumulativeSummary` (resumo do histórico)
  - `recentWindow` (últimas 4 mensagens)
  - `totalTokens` (contador atual)

#### Etapa 3: Construir Prompt
- Monta `systemPrompt` com diretrizes de memória
- Injeta `[HISTÓRICO_RESUMIDO]` se existir
- Adiciona `[JANELA_ATUAL]` com últimas mensagens
- Anexa mensagem atual

#### Etapa 4: Chamar GPT-5 Mini
- Envia prompt para API OpenAI
- Parâmetros: `verbosity: medium`, `reasoning_effort: medium`
- Aguarda resposta

#### Etapa 5: Atualizar Memória
- Adiciona mensagem do usuário à `recentWindow`
- Adiciona resposta da IA à `recentWindow`
- Estima tokens de ambas
- Recalcula `totalTokens`

#### Etapa 6: Verificar Threshold
- Se `recentWindow.length > 4` **E** `totalTokens >= 3500`:
  - Aciona GPT-5 Nano para gerar novo resumo
  - Move mensagens antigas para resumo cumulativo
  - Mantém apenas últimas 4 mensagens na janela
  - Atualiza contadores

#### Etapa 7: Persistir e Retornar
- Salva documento no MongoDB
- Retorna resposta para o usuário

---

## Entradas (o que o agente recebe)

A função `execute(request)` espera um `request` cuja propriedade `parameters` contém:

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `message` | string | ✅ Sim | Texto atual do usuário |
| `chatId` | string | ✅ Sim | Identificador único do chat (chave para memória) |
| `userId` | string | ✅ Sim | Identificador do usuário MongoDB |
| `sessionId` | string | ⚠️ Opcional | Identificador de sessão (repassado no retorno) |

**Origem**: Endpoint `/api/chat/process` no `serverAgent.js`

---

## Saídas (o que o agente envia)

Retorna objeto JavaScript:

```json
{
  "response": "Texto gerado pelo GPT-5 Mini",
  "sessionId": "session_123",
  "timestamp": "2026-01-26T10:30:00.000Z"
}
```

**Destino**: Frontend via resposta HTTP do endpoint

---

## Dependências

### Arquivos Criados/Modificados

1. **`conversational-memory-schema.js`** (NOVO)
   - Schema MongoDB para persistir memória
   - Campos: `cumulativeSummary`, `recentWindow`, `totalTokens`
   - Métodos: `findOrCreate()`, `findByChatId()`

2. **`memory-summary-service.js`** (NOVO)
   - Serviço de resumo usando GPT-5 Nano
   - Método principal: `generateCumulativeSummary()`
   - Estimativa de tokens: `estimateTokens()`

3. **`junior-agent.js`** (REFATORADO)
   - Atualizado para GPT-5 Mini
   - Implementa lógica de janela deslizante
   - Integra serviço de resumo

### Bibliotecas Externas

- `openai` — Cliente oficial OpenAI (suporta GPT-5)
- `mongoose` — ODM para MongoDB

### Variáveis de Ambiente

- `OPENAI_API_KEY` — Chave de API para acessar GPT-5 Mini/Nano
- `MONGO_URI` — String de conexão MongoDB

---

## Exemplo Prático Completo

### Cenário: Primeira Interação

**Requisição 1:**
```json
{
  "message": "Olá, me chamo Edmar",
  "chatId": "chat_abc123",
  "userId": "60d5ec49f1a2c8b1f8e4e1a1",
  "sessionId": "session_001"
}
```

**Estado da Memória (MongoDB) ANTES:**
```javascript
{
  cumulativeSummary: "",
  recentWindow: [],
  totalTokens: 0
}
```

**Resposta da IA:**
```json
{
  "response": "Oi, Edmar! Prazer em conhecer você. Como posso ajudar com suas finanças hoje? 😊",
  "sessionId": "session_001",
  "timestamp": "2026-01-26T10:30:00.000Z"
}
```

**Estado da Memória DEPOIS:**
```javascript
{
  cumulativeSummary: "",
  recentWindow: [
    { role: "user", content: "Olá, me chamo Edmar", tokens: 6 },
    { role: "assistant", content: "Oi, Edmar! Prazer...", tokens: 15 }
  ],
  totalTokens: 21
}
```

---

### Cenário: Segunda Interação (Teste de Memória)

**Requisição 2:**
```json
{
  "message": "Como é meu nome?",
  "chatId": "chat_abc123",
  "userId": "60d5ec49f1a2c8b1f8e4e1a1",
  "sessionId": "session_001"
}
```

**Estado da Memória ANTES:**
```javascript
{
  cumulativeSummary: "",
  recentWindow: [
    { role: "user", content: "Olá, me chamo Edmar", tokens: 6 },
    { role: "assistant", content: "Oi, Edmar! Prazer...", tokens: 15 }
  ],
  totalTokens: 21
}
```

**Prompt Enviado ao GPT-5 Mini:**
```
[System Prompt com diretrizes de memória...]

[JANELA_ATUAL]
U: Olá, me chamo Edmar
A: Oi, Edmar! Prazer em conhecer você. Como posso ajudar...

U: Como é meu nome?
A:
```

**Resposta da IA:**
```json
{
  "response": "Seu nome é Edmar! 😊 Posso te ajudar com algo?",
  "sessionId": "session_001",
  "timestamp": "2026-01-26T10:31:00.000Z"
}
```

✅ **Problema resolvido**: A IA agora **lembra** do nome!

---

### Cenário: Conversa Longa (Gatilho de Resumo)

Após 50 mensagens (`totalTokens = 3600`):

**Estado ANTES do Resumo:**
```javascript
{
  cumulativeSummary: "",
  recentWindow: [
    // 50 mensagens aqui (últimas 4 serão mantidas)
  ],
  totalTokens: 3600
}
```

**Ação Automática:**
1. GPT-5 Nano resume as 46 mensagens antigas
2. Gera `cumulativeSummary`: "O usuário Edmar está planejando uma viagem para Europa em julho/2026. Orçamento estimado: R$ 15.000. Já economizou R$ 5.000 em conta poupança. Preferências: voos diretos, hotéis 4 estrelas."

**Estado DEPOIS do Resumo:**
```javascript
{
  cumulativeSummary: "O usuário Edmar está planejando uma viagem...",
  summaryTokens: 45,
  recentWindow: [
    // Apenas últimas 4 mensagens
  ],
  totalTokens: 60 // (45 do resumo + 15 da janela)
}
```

**Próxima Requisição:**
```json
{
  "message": "Quanto ainda preciso guardar?"
}
```

**Prompt Enviado:**
```
[HISTÓRICO_RESUMIDO]
O usuário Edmar está planejando uma viagem para Europa...

[JANELA_ATUAL]
U: Vou viajar em julho
A: Ótimo! Quanto você planeja gastar?
U: Uns 15 mil
A: Legal! Já tem algo guardado?

U: Quanto ainda preciso guardar?
A:
```

**Resposta da IA:**
```json
{
  "response": "Edmar, você já tem R$ 5.000 guardados e precisa de R$ 15.000 no total. Faltam R$ 10.000 para sua viagem! 🎯"
}
```

✅ **IA lembrou**: Nome, meta financeira, valor já guardado (tudo do resumo!)

---

## Notas Técnicas e Recomendações

### Para Desenvolvedores

1. **Migração de Dados**
   - Banco de dados precisa estar rodando antes do primeiro teste
   - Schema `ConversationalMemory` será criado automaticamente

2. **Variáveis de Ambiente**
   ```bash
   OPENAI_API_KEY=sk-...  # Chave com acesso a GPT-5
   MONGO_URI=mongodb://...
   ```

3. **Testes**
   - Testar primeiro com `totalTokens < 3500` (sem resumo)
   - Depois forçar `totalTokens >= 3500` para testar resumo
   - Verificar logs do console para debug

4. **Performance**
   - Resumo acontece de forma **síncrona** (bloqueia resposta)
   - Tempo adicional: ~2-3 segundos quando threshold é atingido
   - Considerar fazer resumo em background futuro (fila)

### Diferenças GPT-4 vs GPT-5

| Parâmetro | GPT-4.1 Mini | GPT-5 Mini |
|-----------|--------------|------------|
| `temperature` | ✅ `0.7` | ❌ Removido |
| `verbosity` | ❌ N/A | ✅ `medium` |
| `reasoning_effort` | ❌ N/A | ✅ `medium` |

### Monitoramento

Logs importantes para acompanhar:
```
[JuniorAgent] 📨 Processando mensagem
[JuniorAgent] 💾 Memória carregada
[JuniorAgent] 📋 Resumindo mensagens  ← Resumo acionado
[JuniorAgent] ✅ Resumo concluído
[JuniorAgent] 💰 Tokens consumidos
```

### Custos Estimados

- **GPT-5 Mini**: ~$0.10 por 1M tokens (prompt)
- **GPT-5 Nano**: ~$0.05 por 1M tokens (resumo)
- Resumo a cada ~15-20 interações (dependendo do tamanho)

---

## Resolução do Problema Original

### ❌ Antes:
```
Usuário: "Olá, me chamo Edmar"
IA: "Oi, Edmar! Como posso ajudar?"

Usuário: "Como é meu nome?"
IA: "Ainda não sei seu nome!"  ← PROBLEMA
```

### ✅ Agora:
```
Usuário: "Olá, me chamo Edmar"
IA: "Oi, Edmar! Como posso ajudar?"

Usuário: "Como é meu nome?"
IA: "Seu nome é Edmar! 😊"  ← RESOLVIDO
```

**Motivo**: Memória persistente no MongoDB + janela deslizante mantém contexto entre requisições.

---

Arquivo de referência: `server/src/agents/junior/junior/junior-agent.js` (versão com memória persistente).

Arquivos relacionados:
- `server/src/database/schemas/conversational-memory-schema.js`
- `server/src/services/memory-summary-service.js`
