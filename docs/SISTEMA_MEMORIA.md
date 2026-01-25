# Sistema de Memória - Documentação Completa

## Visão Geral

O sistema de memória é um componente crítico que permite aos agentes de IA manter contexto persistente, aprender sobre os usuários e fornecer experiências personalizadas. Ele é composto por três camadas independentes mas integradas:

1. **Working Memory** (Memória de Trabalho)
2. **Episodic Memory** (Memória Episódica)  
3. **Long-Term Memory** (Memória de Longo Prazo)

---

## 1. Working Memory - Memória de Trabalho

### Propósito
Armazena contexto temporário durante a execução de uma sessão específica, como cálculos intermediários, parâmetros de ação atual e variáveis de raciocínio.

### Características
- **Escopo**: Por sessão (cada sessão tem seu próprio namespace isolado)
- **Persistência**: MongoDB com TTL de 500 horas
- **Cache**: RAM para performance
- **Orçamento**: 700 palavras por sessão
- **Curadoria**: IA DeepSeek valida cada entrada
- **Limpeza**: Automática após 40 minutos de inatividade (cache) + TTL no banco

### Estrutura de Dados
```javascript
{
  sessionId: String,
  userId: ObjectId,
  key: String,
  value: Mixed,
  wordCount: Number,
  createdAt: Date,
  lastUpdated: Date,
  expiresAt: Date  // TTL index
}
```

### Fluxo de Operação

#### Armazenamento (`set`)
1. Valida sessionId e key
2. Se userId não fornecido, busca da sessão (session-store)
3. **Curadoria de IA**: DeepSeek valida se dado deve ser armazenado
   - Rejeita: senhas, tokens, CPF, cartões, PII
   - Rejeita: spam, dados irrelevantes
   - Aceita: cálculos, contexto imediato, parâmetros temporários
4. Conta palavras do valor
5. Verifica orçamento (700 palavras/sessão)
6. Se exceder, remove entradas mais antigas (`_freeSpace`)
7. Persiste no MongoDB com expiresAt = now + 500h
8. Atualiza cache RAM
9. Atualiza timestamp de última atividade

#### Recuperação (`get`, `getAll`)
1. Verifica cache RAM primeiro
2. Se não encontrado, busca no MongoDB
3. Atualiza cache se carregado do DB
4. Retorna valor

#### Limpeza
- **Cache**: A cada verificação de sessão expirada (40 min de inatividade)
- **MongoDB**: TTL index automático após 500 horas

### Uso pelo Agente
```javascript
const workingMemory = require('./working/working-memory');

// Armazenar
await workingMemory.set(sessionId, 'calculo_rendimento', 1250.45, false, userId);

// Recuperar
const valor = await workingMemory.get(sessionId, 'calculo_rendimento');

// Recuperar tudo da sessão
const allData = await workingMemory.getAll(sessionId);

// Limpar sessão
await workingMemory.clear(sessionId);
```

### Integração com Session Store
O `session-store.js` gerencia o ciclo de vida das sessões:
- Cria sessões com `createSession(sessionId, userId, metadata)`
- Renova atividade com `renewActivity(sessionId)`
- Detecta sessões expiradas (40 min inatividade)
- Limpa working memory quando sessão expira
- Timer automático executa cleanup a cada 5 minutos

---

## 2. Episodic Memory - Memória Episódica

### Propósito
Gerencia contexto persistente de cada conversa (chat) individual com o usuário, incluindo preferências mencionadas, decisões tomadas e contexto específico da interação.

### Características
- **Escopo**: Por chat (cada conversa tem sua própria memória)
- **Persistência**: MongoDB
- **Orçamento**: 500 palavras por chat
- **Curadoria**: IA DeepSeek valida e sanitiza conteúdo
- **Compressão**: Automática aos 400 palavras (80% do orçamento)
- **Expiração**: 30 dias de inatividade (TTL index)
- **Idade Máxima**: 90 dias (hard limit)

### Estrutura de Dados
```javascript
{
  chatId: String (unique),
  userId: ObjectId,
  episodicMemory: Mixed,  // Objeto JSON estruturado
  wordCount: Number,
  compressionCount: Number,
  lastCompressedAt: Date,
  createdAt: Date,
  lastUpdated: Date,
  expiresAt: Date  // TTL index
}
```

### Fluxo de Operação

#### Criação (`create`)
1. Verifica se chat já tem memória (rejeita se sim)
2. **Curadoria de IA**: valida conteúdo inicial
   - Rejeita: senhas, API keys, CPF, spam
   - Aceita e sanitiza: preferências, análises, contexto
3. Valida contra hard rules
4. Conta palavras
5. Define expiração (30 dias)
6. Persiste no MongoDB

#### Atualização (`update`)
1. Busca memória existente
2. **Curadoria de IA**: valida novo conteúdo
3. Merge com existente (ou substitui, configurável)
4. Valida resultado
5. Conta palavras
6. **Auto-compressão**: Se ≥ 400 palavras (80% de 500)
   - Comprime para 300 palavras (60% do orçamento)
   - Usa LLM DeepSeek para compressão inteligente
   - Incrementa compressionCount
7. Renova expiração (mais 30 dias)
8. Persiste

#### Compressão (`compressMemory`)
- **Trigger**: Aos 400 palavras (isNearLimit check)
- **Target**: 300 palavras (60% do orçamento)
- **Método**: LLM (preserva essência) ou rule-based (fallback)
- **DeepSeek Prompt**:
  - Preservar: informações críticas, padrões, decisões, preferências
  - Remover: redundância, exemplos desnecessários, detalhes
  - Manter: números e valores específicos relevantes

### Uso pelo Agente
```javascript
const episodicMemory = require('./episodic/episodic-memory');

// Criar
await episodicMemory.create(chatId, userId, {
  preferencias: 'Investimentos conservadores',
  contexto: 'Primeira conversa sobre previdência'
});

// Atualizar
await episodicMemory.update(chatId, {
  decisao_tomada: 'Optou por renda fixa',
  proximos_passos: 'Analisar CDBs'
}, { 
  merge: true,
  autoCompress: true
});

// Recuperar
const memory = await episodicMemory.get(chatId);

// Arquivar (definir expiração)
await episodicMemory.archive(chatId, 30);
```

---

## 3. Long-Term Memory - Memória de Longo Prazo

### Propósito
Sistema de memória permanente organizado em **10 categorias temáticas**, armazenando apenas informações de alto impacto e alta relevância sobre o usuário.

### Características
- **Escopo**: Cross-chat (perfil permanente do usuário)
- **Persistência**: MongoDB + Vector Store (embeddings)
- **Orçamento Total**: 3500 palavras
- **Orçamento por Categoria**: 350 palavras
- **Curadoria**: Híbrida (regras + IA DeepSeek)
- **Impact Score**: Mínimo 0.7 para aceitar
- **Busca Semântica**: Embeddings vetoriais (planejado)

### Categorias (10)
1. **perfil_profissional** - Carreira, emprego, renda, histórico profissional
2. **situacao_financeira** - Patrimônio, dívidas, contas, fluxo de caixa
3. **investimentos** - Ativos, estratégias, performance, alocação
4. **objetivos_metas** - Metas financeiras, prazos, prioridades
5. **comportamento_gastos** - Padrões de consumo, hábitos, preferências
6. **perfil_risco** - Tolerância a risco, preferências de investimento
7. **conhecimento_financeiro** - Nível de conhecimento, aprendizados
8. **planejamento_futuro** - Aposentadoria, grandes compras, projetos
9. **familia_dependentes** - Dependentes, responsabilidades familiares
10. **relacao_plataforma** - Preferências de comunicação, feedback, uso

### Estrutura de Dados
```javascript
// Schema Principal
{
  userId: ObjectId (unique),
  memoryItems: [{
    content: String,
    category: String (enum das 10 categorias),
    impactScore: Number (0.0 - 1.0),
    sourceChats: [String],
    createdAt: Date,
    lastAccessed: Date,
    accessCount: Number,
    vectorId: String  // Ref para vector store
  }],
  totalWordCount: Number,
  createdAt: Date,
  lastUpdated: Date,
  curationStats: {
    totalProposed: Number,
    totalAccepted: Number,
    totalRejected: Number,
    totalMerged: Number,
    lastCuratedAt: Date
  }
}
```

### Fluxo de Operação

#### Proposta (`propose`)
1. Recebe candidato: content, category, sourceChats
2. **Curadoria Híbrida**:
   
   **a) Hard Rules**
   - Verifica padrões proibidos (senhas, CPF, tokens)
   - Valida categoria (deve ser uma das 10)
   - Verifica se adequado para LTM (não efêmero)
   
   **b) Impact Score (IA DeepSeek)**
   - Avalia 5 fatores ponderados:
     - Recurrence (25%): frequência de menção/acesso
     - Structurality (30%): impacto em finanças/decisões
     - Durability (20%): relevância longa vs efêmera
     - Specificity (15%): concretude vs genericidade
     - Actionability (10%): leva a ações concretas
   - Score final: 0.0 a 1.0
   - Rejeita se < 0.7
   
   **c) Refinamento (LLM)**
   - Remove ruído e redundância
   - Preserva informações essenciais
   - Limite: 100 palavras por memória
   
   **d) Compressão Adicional**
   - Se ainda verboso, comprime para 80 palavras

3. **Verificação de Duplicatas**
   - Gera embedding vetorial do conteúdo
   - Busca memórias similares na mesma categoria
   - Se similaridade ≥ 0.85: faz merge ao invés de criar nova
   - Mantém maior impact score, soma access counts

4. **Verificação de Orçamento**
   - Conta palavras da categoria específica
   - Limite: 350 palavras por categoria
   - Se exceder: descarta memórias de menor impact da MESMA categoria
   - Nunca descarta de outras categorias

5. **Armazenamento**
   - Gera embedding vetorial (para busca semântica futura)
   - Adiciona ao array memoryItems
   - Atualiza totalWordCount
   - Atualiza curationStats

#### Recuperação (`retrieve`)
- **Modo 1: Vector Search** (query + semantic search)
  - Gera embedding do query
  - Busca vetores similares no vector store
  - Filtra por minImpact
  - Ordena por similaridade
  - Atualiza access stats

- **Modo 2: Category Filter** (sem query)
  - Filtra por categoria
  - Filtra por minImpact
  - Ordena por impact score
  - Limita resultados

#### Merge de Episódica para LTM (`merge`)
1. Recebe memória episódica de um chat
2. IA extrai informações de alto impacto
3. Para cada candidato:
   - Classifica em categoria apropriada
   - Propõe para LTM via `propose()`
   - Se aceito, adiciona sourceChat ao histórico
4. Retorna lista de memórias promovidas

### Personalização com Nome do Usuário
**IMPORTANTE**: Todas as memórias LTM devem usar o nome do usuário ao invés de "o usuário".

Exemplo:
- ❌ "O usuário trabalha como engenheiro"
- ✅ "João trabalha como engenheiro de software na Empresa X"

Isso permite que o usuário visualize suas próprias memórias de forma natural e clara.

### Uso pelo Agente
```javascript
const longTermMemory = require('./longTerm/long-term-memory');

// Propor memória
const result = await longTermMemory.propose(
  userId,
  'João trabalha como engenheiro de software, ganha R$ 12k/mês',
  'perfil_profissional',
  [chatId]
);

// Recuperar relevantes
const memories = await longTermMemory.retrieve(
  userId,
  'investimentos em renda fixa',
  { 
    category: 'investimentos',
    minImpact: 0.7,
    limit: 5,
    useVectorSearch: true
  }
);

// Merge de episódica
const promoted = await longTermMemory.merge(userId, chatId, episodicData);

// Estatísticas
const stats = await longTermMemory.getStats(userId);
```

---

## 4. Memory Processor - Orquestrador de Memórias

### Propósito
Processa memórias em background após cada interação usuário-IA, classificando informações e distribuindo entre os três tipos de memória.

### Fluxo de Processamento

#### `processMemories(context)`
Recebe:
- sessionId, userId, chatId
- userMessage, aiResponse
- history (últimas mensagens)
- userName (para LTM personalizada)

#### Etapa 1: Classificação (IA DeepSeek)
Analisa a interação e classifica informações:

**Working Memory**:
```json
[
  { 
    "key": "calculo_roi",
    "value": 8.5,
    "reason": "Resultado intermediário de cálculo"
  }
]
```

**Episodic Memory**:
```json
{
  "contexto_conversa": "Usuário perguntou sobre rentabilidade de CDB",
  "preferencias_mencionadas": "Prefere liquidez diária",
  "decisoes_tomadas": "Decidiu analisar CDBs de grandes bancos"
}
```

**Long-Term Memory**:
```json
[
  {
    "content": "João prefere investimentos com liquidez diária devido à necessidade de reserva de emergência",
    "category": "comportamento_gastos",
    "reason": "Padrão comportamental importante e duradouro"
  }
]
```

#### Etapa 2: Processamento Paralelo
Executa em paralelo (Promise.allSettled):

1. **Working Memory**: Para cada item
   - Chama `workingMemory.set(sessionId, key, value, false, userId)`
   - Passa por curadoria de IA novamente
   - Armazena se aceito

2. **Episodic Memory**:
   - Verifica se chat já tem memória
   - Se sim: atualiza com merge (`episodicMemory.update`)
   - Se não: cria nova (`episodicMemory.create`)
   - Auto-compressão se necessário

3. **Long-Term Memory**: Para cada candidato
   - Propõe via `longTermMemory.propose`
   - Passa por curadoria completa
   - Calcula impact score
   - Verifica duplicatas
   - Armazena se score ≥ 0.7

#### Etapa 3: Logging de Resultados
```javascript
{
  success: true,
  classification: { working: [...], episodic: {...}, longTerm: [...] },
  results: [
    { type: 'working', results: [...] },
    { type: 'episodic', status: 'updated', chatId },
    { type: 'longTerm', results: [...] }
  ]
}
```

### Execução Assíncrona
O processamento é **não bloqueante**:
- Dispara após resposta ao usuário
- Não atrasa a interação
- Erros não afetam o chat
- Logging completo para auditoria

---

## 5. Memory Integration - API Unificada

### Propósito
Interface de alto nível que simplifica o uso do sistema de memória pelos agentes, fornecendo funções prontas para operações comuns.

### Funções Principais

#### `initializeSession(sessionId, userId, metadata)`
Cria nova sessão no session-store.

#### `buildAgentContext(sessionId, chatId, userId)`
Constrói contexto completo para o agente:
```javascript
{
  sessionId,
  chatId,
  userId,
  workingMemory: { key1: value1, ... },
  episodicMemory: { contexto, preferencias, ... },
  longTermMemory: [
    { content, category, impactScore },
    ...
  ],
  sessionMetadata: { ... }
}
```

#### `processInteractionMemories(interaction)`
Dispara processamento de memórias em background (não bloqueante).

#### `formatContextForPrompt(context)`
Formata contexto em string legível para incluir no prompt da IA:
```
## Memória de Trabalho (Sessão Atual):
- calculo_roi: 8.5
- periodo_analise: "ultimos_12_meses"

## Contexto da Conversa:
{
  "contexto_conversa": "...",
  "decisoes_tomadas": "..."
}

## Informações Importantes sobre o Usuário:
- [perfil_profissional] João trabalha como engenheiro...
- [investimentos] João investe R$ 2k/mês em FIIs...
```

### Uso no Agente
```javascript
const memoryIntegration = require('../core/memory/memory-integration');

// No início da interação
const context = await memoryIntegration.buildAgentContext(sessionId, chatId, userId);
const formattedContext = memoryIntegration.formatContextForPrompt(context);

// Incluir no prompt da IA
const prompt = `${systemPrompt}\n\n${formattedContext}\n\nUsuário: ${message}`;

// Após gerar resposta
memoryIntegration.processInteractionMemories({
  sessionId,
  chatId,
  userId,
  userMessage,
  aiResponse,
  history
}).catch(error => console.error('Memory processing error:', error));
```

---

## 6. Integração com JuniorAgent

### Modificações Realizadas
O `junior-agent.js` foi atualizado para integração completa com o sistema de memória.

### Fluxo Completo

1. **Recebe Requisição**:
   ```javascript
   { message, sessionId, userId, chatId, history }
   ```

2. **Inicializa Sessão**:
   ```javascript
   memoryIntegration.initializeSession(sessionId, userId, { 
     startedAt: new Date(),
     chatId 
   });
   ```

3. **Carrega Contexto**:
   ```javascript
   const memoryContext = await memoryIntegration.buildAgentContext(
     sessionId, 
     chatId, 
     userId
   );
   ```

4. **Constrói Prompt**:
   - System prompt base
   - Contexto de memória formatado
   - Histórico da conversa
   - Mensagem atual

5. **Gera Resposta** (OpenAI GPT-5-nano)

6. **Processa Memórias** (background):
   ```javascript
   memoryIntegration.processInteractionMemories({
     sessionId, chatId, userId,
     userMessage, aiResponse, history
   });
   ```

7. **Retorna Resposta**

### Validações Adicionadas no serverAgent.js
```javascript
// Valida userId (obrigatório para memória)
if (!userId) {
  return res.status(400).json({
    error: {
      code: 'MISSING_USER_ID',
      message: 'userId é obrigatório para sistema de memória'
    }
  });
}

// Gera IDs se não fornecidos
const finalSessionId = sessionId || `session_${userId}_${Date.now()}`;
const finalChatId = chatId || `chat_${userId}_${Date.now()}`;
```

---

## 7. Arquivos Auxiliares

### word-counter.js
- `count(content)`: Conta palavras em string ou JSON
- `isNearLimit(current, limit, threshold)`: Verifica proximidade do limite
- `percentageUsed(current, limit)`: Calcula % do orçamento usado
- `remainingWords(current, limit)`: Calcula espaço restante

### memory-validator.js
- `checkHardRules(memory)`: Valida contra conteúdo proibido
- `checkScope(memory, scope)`: Valida adequação ao escopo
- `checkBudget(current, new, limit)`: Valida orçamento
- `checkImpact(memory, minScore)`: Valida impact score
- `validateMemory(memory, options)`: Validação completa

### memory-compressor.js
- `compress(memory, targetWords, options)`: Compressão automática
- `compressWithLLM(memory, target, llmFunction)`: Compressão inteligente
- `compressRuleBased(memory, target)`: Compressão por regras

### hard-rules.js
- Define padrões proibidos (regex + keywords)
- Define thresholds de compressão
- Define regras de limpeza automática
- `containsForbiddenContent(text)`: Detecta conteúdo proibido
- `isSuitableForLTM(text)`: Valida adequação para LTM

### memory-types.js
- Define escopos (WORKING, EPISODIC, LONG_TERM)
- Define orçamentos de palavras
- Define thresholds de impact
- Define categorias de LTM
- Define estruturas de dados

### category-definitions.js
- Define 10 categorias de LTM
- Prompts especializados para cada categoria
- Exemplos de boas memórias
- Critérios de impact score

---

## 8. Fluxo Completo de Interação

### Cenário: Usuário pergunta sobre investimentos

#### 1. Frontend envia:
```javascript
POST /api/chat/process
{
  "message": "Quanto devo investir por mês?",
  "userId": "507f1f77bcf86cd799439011",
  "sessionId": "session_123",
  "chatId": "chat_456",
  "history": [...]
}
```

#### 2. serverAgent.js valida e roteia

#### 3. JuniorAgent processa:

**a) Inicializa sessão**:
```javascript
session-store: { sessionId, userId, createdAt, lastActivity }
```

**b) Carrega contexto de memória**:
```javascript
context = {
  workingMemory: {},
  episodicMemory: {
    contexto: "Conversa anterior sobre reserva de emergência"
  },
  longTermMemory: [
    {
      content: "João ganha R$ 8.500/mês e gasta R$ 6.000/mês",
      category: "situacao_financeira",
      impactScore: 0.85
    },
    {
      content: "João prefere investimentos de renda fixa",
      category: "perfil_risco",
      impactScore: 0.78
    }
  ]
}
```

**c) Formata prompt**:
```
Você é um assistente financeiro...

## Contexto da Memória:
## Contexto da Conversa:
{
  "contexto": "Conversa anterior sobre reserva de emergência"
}

## Informações Importantes sobre o Usuário:
- [situacao_financeira] João ganha R$ 8.500/mês e gasta R$ 6.000/mês
- [perfil_risco] João prefere investimentos de renda fixa

---

Histórico da conversa:
...

Usuário: Quanto devo investir por mês?

Assistente:
```

**d) IA gera resposta**:
```
Com base na sua renda de R$ 8.500 e gastos de R$ 6.000, você tem uma
sobra de R$ 2.500/mês. Recomendo investir 70-80% disso (R$ 1.750-2.000)
priorizando renda fixa, já que você prefere esse perfil...
```

**e) Retorna resposta ao usuário**

**f) Processa memórias (background)**:

**IA classifica**:
```javascript
{
  working: [
    { key: "sobra_mensal", value: 2500, reason: "Cálculo temporário" }
  ],
  episodic: {
    contexto_conversa: "Usuário perguntou sobre quanto investir mensalmente",
    recomendacao_dada: "R$ 1.750-2.000/mês em renda fixa"
  },
  longTerm: [
    {
      content: "João decidiu investir entre R$ 1.750-2.000/mês priorizando renda fixa",
      category: "investimentos",
      reason: "Decisão estratégica importante de alocação mensal"
    }
  ]
}
```

**Processamento paralelo**:
- **Working**: Armazena sobra_mensal = 2500 (expira em 500h)
- **Episodic**: Atualiza contexto do chat (merge)
- **Long-Term**: Propõe memória
  - Curadoria: aceita (impact 0.82)
  - Verifica duplicatas: nenhuma
  - Armazena com embedding vetorial

#### 4. Resposta final ao frontend

---

## 9. Monitoramento e Estatísticas

### Working Memory Stats
```javascript
await workingMemory.getStats();
// Retorna:
{
  cache: {
    activeSessions: 5,
    totalKeys: 23,
    totalWords: 450,
    avgKeysPerSession: 4.6,
    avgWordsPerSession: "90.0"
  },
  database: {
    totalSessions: 8,
    totalKeys: 45,
    totalWords: 890,
    avgKeysPerSession: 5.625,
    avgWordsPerSession: "111.3"
  }
}
```

### Long-Term Memory Stats
```javascript
await longTermMemory.getStats(userId);
// Retorna:
{
  totalItems: 28,
  totalWords: 2450,
  budgetUsed: "70.0",
  topCategories: [
    { category: 'investimentos', count: 8 },
    { category: 'perfil_profissional', count: 6 },
    ...
  ],
  averageImpact: "0.78",
  curationStats: {
    totalProposed: 45,
    totalAccepted: 28,
    totalRejected: 15,
    totalMerged: 2
  }
}
```

---

## 10. Configurações Importantes

### Variáveis de Ambiente (.env)
```bash
# MongoDB
MONGO_URI=mongodb://localhost:27017/seu_banco

# DeepSeek (para curadoria de memória)
DEEPSEEK_API_KEY=sk-your-deepseek-key

# OpenAI (para JuniorAgent)
OPENAI_API_KEY=sk-your-openai-key

# Servidor
AGENT_PORT=5000
CORS_ORIGIN=http://localhost:3000
```

### Orçamentos e Thresholds
Definidos em `memory-types.js`:
```javascript
MEMORY_BUDGETS: {
  WORKING: 700,
  EPISODIC: 500,
  LONG_TERM: 3500,
  LONG_TERM_PER_CATEGORY: 350
}

IMPACT_THRESHOLDS: {
  MIN_TO_KEEP: 0.5,
  MIN_FOR_LTM: 0.7,
  COMPRESSION_TRIGGER: 0.8
}
```

### Limpeza Automática
Definida em `hard-rules.js`:
```javascript
CLEANUP_RULES: {
  WORKING_SESSION_TIMEOUT: 40 * 60 * 1000,  // 40 minutos
  EPISODIC_INACTIVITY_DAYS: 30,
  EPISODIC_MAX_AGE_DAYS: 90
}
```

---

## 11. Melhores Práticas

### Para Desenvolvedores

1. **Sempre forneça userId**:
   ```javascript
   // ❌ Evite
   await workingMemory.set(sessionId, key, value);
   
   // ✅ Correto
   await workingMemory.set(sessionId, key, value, false, userId);
   ```

2. **Use memory-integration.js**:
   ```javascript
   // ❌ Evite uso direto
   const working = await workingMemory.getAll(sessionId);
   const episodic = await episodicMemory.get(chatId);
   
   // ✅ Use a API unificada
   const context = await memoryIntegration.buildAgentContext(sessionId, chatId, userId);
   ```

3. **Não bloqueie com processamento de memória**:
   ```javascript
   // ❌ Evite await
   await memoryIntegration.processInteractionMemories(...);
   
   // ✅ Fire and forget
   memoryIntegration.processInteractionMemories(...).catch(console.error);
   ```

4. **Use nomes de usuário em LTM**:
   ```javascript
   // ❌ Genérico
   "O usuário prefere renda fixa"
   
   // ✅ Personalizado
   "João prefere renda fixa para seus investimentos"
   ```

### Para Agentes

1. **Sempre construa contexto no início**
2. **Formate contexto para o prompt da IA**
3. **Processe memórias após responder**
4. **Trate erros de memória gracefully** (não quebre a interação)
5. **Log de todas operações de memória**

---

## 12. Troubleshooting

### Problema: Memórias não estão sendo armazenadas

**Diagnóstico**:
1. Verificar logs do memory-processor
2. Verificar se classificação está funcionando
3. Verificar se DEEPSEEK_API_KEY está configurada

**Solução**:
```bash
# Ver logs do processamento
grep "MemoryProcessor" logs/server.log

# Testar classificação manualmente
node -e "const p = require('./src/core/memory/shared/memory-processor'); 
p.classifyInteraction({...}).then(console.log)"
```

### Problema: Working memory sendo limpa muito rápido

**Diagnóstico**:
Verificar WORKING_SESSION_TIMEOUT em hard-rules.js

**Solução**:
```javascript
// Aumentar timeout (em milissegundos)
WORKING_SESSION_TIMEOUT: 60 * 60 * 1000,  // 60 minutos
```

### Problema: Episodic memory excedendo orçamento

**Diagnóstico**:
Verificar se auto-compressão está funcionando

**Solução**:
```javascript
// Forçar compressão manual
await episodicMemory.compressMemory(chatId, 300);
```

### Problema: Long-term memory rejeitando tudo

**Diagnóstico**:
1. Verificar impact scores sendo calculados
2. Verificar threshold MIN_FOR_LTM (0.7)

**Solução**:
```javascript
// Testar scoring manualmente
const score = await relevanceCalculator.calculate(content, context);
console.log('Impact score:', score);
```

---

## 13. Roadmap Futuro

### Implementações Pendentes

1. **Vector Store Real**:
   - Integrar Pinecone ou Qdrant
   - Implementar busca semântica real
   - Configurar embeddings OpenAI

2. **Compressão Avançada**:
   - Usar GPT-4 para compressão de alta qualidade
   - Implementar estratégias de merge inteligente

3. **Dashboard de Memória**:
   - Interface para visualizar memórias do usuário
   - Permitir edição/exclusão por categoria
   - Mostrar estatísticas e gráficos

4. **Otimizações de Performance**:
   - Cache distribuído (Redis)
   - Batch processing de memórias
   - Índices otimizados no MongoDB

5. **Testes Automatizados**:
   - Unit tests para cada módulo
   - Integration tests do fluxo completo
   - Load tests de processamento

---

## 14. Conclusão

O sistema de memória é uma arquitetura sofisticada de três camadas que permite aos agentes de IA:

- **Manter contexto imediato** (Working Memory)
- **Lembrar conversas específicas** (Episodic Memory)
- **Construir perfil permanente do usuário** (Long-Term Memory)

Com curadoria inteligente via IA, compressão automática, orçamentos balanceados e integração simples, o sistema garante que os agentes forneçam experiências personalizadas e contextualmente relevantes sem comprometer performance ou privacidade.

**Status**: ✅ Integrado e funcional
**Última Atualização**: Janeiro 2026
**Próximos Passos**: Implementar vector store e dashboard de visualização
