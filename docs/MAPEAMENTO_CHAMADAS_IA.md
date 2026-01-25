# 📊 Mapeamento Completo de Chamadas de IA no Sistema

**Gerado em:** 25/01/2026  
**Objetivo:** Documentar todas as chamadas de IA (LLM) no projeto, seus propósitos, parâmetros e integração.

---

## 📋 Índice

1. [Resumo Executivo](#resumo-executivo)
2. [Wrappers/Configurações de IA](#wrappersconfigurações-de-ia)
3. [Chamadas por Módulo](#chamadas-por-módulo)
4. [Análise de Tokens e Custos](#análise-de-tokens-e-custos)
5. [Fluxo de Execução](#fluxo-de-execução)

---

## 🎯 Resumo Executivo

### Total de Chamadas Identificadas: **12 pontos de invocação**

| Módulo | Chamadas | Modelo Principal | Tokens Estimados/Chamada |
|--------|----------|------------------|--------------------------|
| **Junior Agent** | 1 | gpt-5-nano | 800 (output) + reasoning |
| **Memory Processing** | 1 | gpt-4.1-nano | 1000 |
| **Working Memory** | 1 | gpt-4.1-nano | 200 |
| **Episodic Memory** | 2 | gpt-4.1-nano | 600 + 200 |
| **Long-Term Memory** | 5 | gpt-4.1-nano | 200-800 |
| **Shared Utilities** | 2 | gpt-4.1-nano | Mock (não configurado) |

---

## 🔧 Wrappers/Configurações de IA

### 1. **openai-config.js** (Principal)
**Localização:** `server/src/config/openai-config.js`

#### Funções Exportadas:
```javascript
callOpenAI(systemPrompt, userPrompt, options)
callOpenAIJSON(systemPrompt, userPrompt, options)
```

#### Configuração:
- **Modelo:** `gpt-4.1-nano`
- **API Key:** `process.env.OPENAI_API_KEY`
- **Parâmetros Padrão:**
  - `temperature: 0.3` (baixa para consistência)
  - `max_tokens: 1000`
  - `top_p: 0.95`
  - `frequency_penalty: 0.0`
  - `presence_penalty: 0.0`
- **Timeout:** 30 segundos
- **Retries:** 3 tentativas com delay de 1s entre elas

#### Comportamento:
1. `callOpenAI`: Retorna string de texto
2. `callOpenAIJSON`: 
   - Adiciona instrução para retornar JSON válido
   - Remove markdown code blocks (```json)
   - Parseia e retorna objeto JavaScript
   - Lança erro se JSON inválido

#### Uso:
- **TODOS os módulos de memória** usam este wrapper
- Importado via: `const { callOpenAI, callOpenAIJSON } = require('../../../config/openai-config')`

---

### 2. **deepseek-config.js** (Alternativo - Não Usado)
**Localização:** `server/src/config/deepseek-config.js`

#### Status: **DEPRECADO / NÃO UTILIZADO**
- Configurado para usar DeepSeek v3 Chat
- API Key: `process.env.DEEPSEEK_API_KEY`
- Modelo: `deepseek-chat`
- **NOTA:** openai-config.js exporta aliases `callDeepSeek` e `callDeepSeekJSON` que redirecionam para OpenAI

---

## 📡 Chamadas por Módulo

---

## 1️⃣ JUNIOR AGENT (Resposta ao Usuário)

### **1.1. Geração de Resposta Principal**
**Arquivo:** `server/src/agents/junior/junior/junior-agent.js`  
**Linha:** ~113  
**Função:** `processChatMessage()`

#### Chamada:
```javascript
const response = await openai.responses.create({
  model: this.model,
  input: contextualInput,
  max_output_tokens: this.max_output_tokens,
  reasoning: { effort: this.reasoning_effort },
});
```

#### Parâmetros Atuais:
- **Modelo:** `gpt-5-nano`
- **max_output_tokens:** `800` (aumentado de 320)
- **reasoning.effort:** `'medium'` (mudado de 'low')

#### Input (contextualInput):
Construído com:
1. **System Prompt:**
   ```
   Você é um assistente financeiro prestativo. Responda de forma 
   clara, objetiva e concisa em português brasileiro.
   ```

2. **Contexto de Memória:** (se disponível)
   - Working Memory
   - Episodic Memory
   - Long-Term Memory
   - Formatado via `memoryIntegration.formatContextForPrompt()`

3. **Histórico da Conversa:**
   ```
   Histórico da conversa:
   Usuário: <mensagem1>
   Assistente: <resposta1>
   ...
   ```

4. **Mensagem Atual:**
   ```
   Usuário: <mensagem>
   
   Assistente:
   ```

#### Output:
- Texto da resposta (extraído via `_extractResponseText()`)
- Se vazio, retorna: "Desculpe, não consegui gerar uma resposta."

#### Frequência:
- **TODA mensagem do usuário** dispara esta chamada

#### Custo Estimado:
- Input: ~500-2000 tokens (depende do contexto e histórico)
- Output: até 800 tokens
- Reasoning: variável (medium effort)

---

## 2️⃣ MEMORY PROCESSING (Classificação)

### **2.1. Classificação de Interação**
**Arquivo:** `server/src/core/memory/shared/memory-processor.js`  
**Linha:** ~185  
**Função:** `classifyInteraction()`

#### Chamada:
```javascript
const result = await callOpenAIJSON(systemPrompt, userPrompt, {
  max_tokens: 1000,
  temperature: 0.3
});
```

#### System Prompt:
```
Você é um classificador de memórias para sistema financeiro.
Analise a interação usuário-IA e classifique informações para armazenamento.

TIPOS DE MEMÓRIA:
1. WORKING MEMORY (temporária, sessão atual)
2. EPISODIC MEMORY (contexto do chat)
3. LONG-TERM MEMORY (perfil permanente)

CATEGORIAS LONG-TERM:
- perfil_profissional
- situacao_financeira
- investimentos
- objetivos_metas
- comportamento_gastos
- perfil_risco
- conhecimento_financeiro
- planejamento_futuro
- familia_dependentes
- relacao_plataforma
```

#### User Prompt:
```
Classifique esta interação:

MENSAGEM DO USUÁRIO: <userMessage>
RESPOSTA DA IA: <aiResponse>
HISTÓRICO (últimas 3 mensagens): <history>

Retorne JSON:
{
  "working": [
    { "key": "nome_variavel", "value": "valor", "reason": "..." }
  ],
  "episodic": {
    "contexto_conversa": "resumo (primeira pessoa)",
    "preferencias_mencionadas": "...",
    "decisoes_tomadas": "..."
  },
  "longTerm": [
    {
      "content": "informação usando nome do usuário",
      "category": "categoria válida",
      "reason": "..."
    }
  ]
}
```

#### Output Esperado:
- `working`: Array de objetos {key, value, reason}
- `episodic`: Objeto com campos contextuais
- `longTerm`: Array de candidatos com category

#### Frequência:
- **1 vez por mensagem** (após JuniorAgent responder)
- Executado em background (não bloqueia resposta)

#### Custo Estimado:
- Input: ~300-800 tokens
- Output: até 1000 tokens

---

## 3️⃣ WORKING MEMORY (Curadoria)

### **3.1. Validação de Entrada**
**Arquivo:** `server/src/core/memory/working/working-memory.js`  
**Linha:** ~66  
**Função:** `_curateValue()`

#### Chamada:
```javascript
const result = await callOpenAIJSON(systemPrompt, userPrompt, { 
  max_tokens: 200,
  temperature: 0.2
});
```

#### System Prompt:
```
You are a working memory curator for a financial investment system.
Validate if this data should be stored in temporary working memory.

REJECT if:
- Contains sensitive data (passwords, API keys, tokens, CPF, credit cards, CVV)
- Is irrelevant noise or spam
- Is duplicate/redundant information

ACCEPT if:
- User's first name or nickname (for personalization)
- Temporary calculation results
- Intermediate processing data
- Current session context
- User preferences for current action
- Financial analysis intermediate results

IMPORTANT: First names like "John", "Maria", "Edmar" are OK.
```

#### User Prompt:
```
Validate this working memory entry:

Key: "<key>"
Value: <value as JSON>

Return JSON:
{
  "allowed": <true/false>,
  "reason": "<brief explanation>",
  "sanitizedValue": <cleaned value or original>
}
```

#### Output Esperado:
- `allowed`: boolean
- `reason`: string
- `sanitizedValue`: valor limpo/original

#### Frequência:
- Para **cada item de working memory** identificado pela classificação
- Pode ser skipped com parâmetro `skipCuration=true`

#### Custo Estimado:
- Input: ~100-200 tokens
- Output: até 200 tokens

---

## 4️⃣ EPISODIC MEMORY (Curadoria e Relevância)

### **4.1. Curadoria de Conteúdo**
**Arquivo:** `server/src/core/memory/episodic/episodic-memory.js`  
**Linha:** ~63  
**Função:** `_curateContent()`

#### Chamada:
```javascript
const result = await callOpenAIJSON(systemPrompt, userPrompt, { 
  max_tokens: 600,
  temperature: 0.2
});
```

#### System Prompt:
```
You are an episodic memory curator for a financial investment system.
Validate and sanitize content before storing in chat-specific memory.

REJECT ONLY if:
- Contains passwords or API keys
- Contains CPF (format: XXX.XXX.XXX-XX or 11 digits)
- Contains credit card numbers (16 digits)
- Contains other document numbers (RG, CNH, passport)
- Contains spam or malicious content

ACCEPT (these are OK):
- Salary information and income values
- Investment amounts and financial data
- User preferences and personal information
- Financial analysis and insights
- Conversation context
```

#### User Prompt:
```
Curate this episodic memory content for chat <chatId>:

<content as JSON>

Return JSON:
{
  "allowed": <true/false>,
  "reason": "<brief explanation>",
  "sanitizedContent": <cleaned version>
}
```

#### Output Esperado:
- `allowed`: boolean
- `reason`: string explicativo
- `sanitizedContent`: objeto limpo

#### Frequência:
- **1 vez ao criar** nova episodic memory
- **1 vez ao atualizar** episodic memory existente

#### Custo Estimado:
- Input: ~200-400 tokens
- Output: até 600 tokens

---

### **4.2. Scoring de Relevância (Fragmentos)**
**Arquivo:** `server/src/core/memory/episodic/relevance-scorer.js`  
**Linha:** ~47  
**Função:** `scoreFragment()`

#### Chamada:
```javascript
const result = await callOpenAIJSON(systemPrompt, userPrompt, { 
  max_tokens: 200 
});
```

#### System Prompt:
```
You are a memory relevance analyzer for a financial investment system.
Evaluate how relevant and important a memory fragment is.

Consider:
1. Strategic value
2. Specificity
3. Uniqueness
4. Future utility
5. Recency context (weight: <recency>)
```

#### User Prompt:
```
Score this memory fragment's relevance (0.0 to 1.0):

Fragment: "<fragment>"
Keywords to consider: <keywords>
Chat context: <chatContext>

Return JSON:
{
  "score": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}
```

#### Output Esperado:
- `score`: número entre 0 e 1
- `reasoning`: explicação breve

#### Frequência:
- Usado pelo **compression-engine** durante compressão
- Não chamado automaticamente em toda interação

#### Custo Estimado:
- Input: ~100-200 tokens
- Output: até 200 tokens

---

### **4.3. Priorização de Informações**
**Arquivo:** `server/src/core/memory/episodic/relevance-scorer.js`  
**Linha:** ~101  
**Função:** `prioritizeInformation()`

#### Chamada:
```javascript
const result = await callOpenAIJSON(systemPrompt, userPrompt, { 
  max_tokens: 500 
});
```

#### System Prompt:
```
You are a memory prioritization system for financial investments.
Identify which pieces of information are most valuable to keep.

Prioritize:
- Investment strategies and patterns
- User preferences and risk tolerance
- Important financial decisions
- Unique behavioral patterns
```

#### User Prompt:
```
Prioritize this memory data. Keep only the <targetCount> most important items.

Memory data: <memory as JSON>
Context: <chatContext>

Return JSON:
{
  "prioritized": { <same structure with only important items> },
  "reasoning": "<brief explanation of what was kept>"
}
```

#### Output Esperado:
- `prioritized`: objeto filtrado
- `reasoning`: justificativa

#### Frequência:
- Usado durante **compressão avançada**
- Não executado automaticamente

#### Custo Estimado:
- Input: ~200-500 tokens
- Output: até 500 tokens

---

## 5️⃣ LONG-TERM MEMORY (Curadoria, Impacto e Refinamento)

### **5.1. Cálculo de Impact Score**
**Arquivo:** `server/src/core/memory/longTerm/relevance-calculator.js`  
**Linha:** ~64  
**Função:** `calculate()`

#### Chamada:
```javascript
const result = await callOpenAIJSON(systemPrompt, userPrompt, { 
  max_tokens: 400 
});
```

#### System Prompt:
```
You are a memory impact evaluator for a financial investment system.
Analyze memory content and calculate an impact score (0.0 to 1.0).

Factors:
1. RECURRENCE (25%): How often mentioned/accessed?
2. STRUCTURALITY (30%): Impact on finances, decisions, strategies?
3. DURABILITY (20%): Long-term relevant or temporary?
4. SPECIFICITY (15%): Concrete and specific vs vague?
5. ACTIONABILITY (10%): Can lead to concrete actions?

Higher scores (>0.7) = worthy of permanent storage
Lower scores (<0.5) = disposable/low-value
```

#### User Prompt:
```
Evaluate this memory for long-term storage:

Content: "<content>"

Context:
- Access count: <accessCount>
- Mentioned in <sourceChats.length> different chats
- Total mentions: <mentionCount>
- Category: <category>
- Age: <days> days old

Analyze each factor and return JSON:
{
  "factors": {
    "recurrence": <0.0-1.0>,
    "structurality": <0.0-1.0>,
    "durability": <0.0-1.0>,
    "specificity": <0.0-1.0>,
    "actionability": <0.0-1.0>
  },
  "overallScore": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}
```

#### Output Esperado:
- `factors`: objeto com 5 scores
- `overallScore`: score final
- `reasoning`: explicação

#### Pós-processamento:
```javascript
// Calcula score ponderado
calculatedScore = 
  factors.recurrence * 0.25 +
  factors.structurality * 0.30 +
  factors.durability * 0.20 +
  factors.specificity * 0.15 +
  factors.actionability * 0.10
```

#### Frequência:
- **1 vez por candidato de LTM** durante curadoria
- Threshold: score >= 0.7 para admissão

#### Custo Estimado:
- Input: ~200-300 tokens
- Output: até 400 tokens

#### Fallback:
- Se falhar, usa algoritmo local baseado em keywords

---

### **5.2. Refinamento de Conteúdo**
**Arquivo:** `server/src/core/memory/longTerm/memory-curator.js`  
**Linha:** ~132  
**Função:** `refineWithLLM()`

#### Chamada:
```javascript
const refined = await callOpenAI(systemPrompt, userPrompt, {
  max_tokens: 200,
  temperature: 0.3
});
```

#### System Prompt:
```
You are a memory curator for a financial investment system.
Refine memories for long-term storage by keeping only essential information.

Guidelines:
- Preserve key facts, preferences, and strategic information
- Remove noise, redundancy, and temporary details
- Keep actionable insights and patterns
- Maintain clarity and specificity
- Identify event date (or use today if unclear)
- Memory MUST start with "Em DD/MM/YYYY, " prefix
- Maximum 60 words (including date)
```

#### User Prompt:
```
Refine this memory for long-term storage:

Category: <category>
Impact Score: <impactScore>
Original: <content>

MANDATORY FORMAT:
- Start with "Em DD/MM/YYYY, "
- Follow with refined content
- Total max 60 words

Return refined version:
```

#### Output Esperado:
- String com memória refinada (max 60 palavras)
- Formato: "Em DD/MM/YYYY, [conteúdo refinado]"

#### Frequência:
- **1 vez por memória aceita** (impact >= 0.7)
- Após refinamento, pode ser comprimida se > 60 palavras

#### Custo Estimado:
- Input: ~100-200 tokens
- Output: até 200 tokens

---

### **5.3. Extração de Alto Impacto (Episodic → LTM)**
**Arquivo:** `server/src/core/memory/longTerm/memory-curator.js`  
**Linha:** ~194  
**Função:** `extractHighImpact()`

#### Chamada:
```javascript
const result = await callOpenAIJSON(systemPrompt, userPrompt, {
  max_tokens: 800,
  temperature: 0.4
});
```

#### System Prompt:
```
Você é um extrator de memórias de longo prazo para sistema financeiro.
Analise a memória episódica e extraia informações de ALTO IMPACTO.

IMPORTANTE: Use sempre o NOME DO USUÁRIO ao formular memórias.
NOME DO USUÁRIO: <userName>

CATEGORIAS DISPONÍVEIS:
[lista de categorias com descrições]

Para cada informação valiosa:
1. Identifique a categoria apropriada
2. Formule usando o NOME do usuário
3. Seja específico com valores e datas
4. Avalie impact score (0.0-1.0)

Extraia apenas informações que:
- Sejam duradouras e relevantes
- Tenham impacto em decisões futuras
- Sejam específicas e acionáveis
- Mereçam armazenamento permanente (score >= 0.7)
```

#### User Prompt:
```
Extract high-impact information from this episodic memory:

<episodicData as JSON>

Return JSON array of candidates com o nome "<userName>":
[
  {
    "content": "<extracted information usando '<userName>'>",
    "category": "<categoria válida>",
    "reasoning": "<why this is high-impact>"
  }
]
```

#### Output Esperado:
- Array de objetos: `{content, category, reasoning}`
- Cada candidate é avaliado posteriormente com `calculate()`

#### Frequência:
- Chamado quando **episodic memory tem alto impacto**
- Não automático - requer trigger manual ou threshold

#### Custo Estimado:
- Input: ~300-600 tokens
- Output: até 800 tokens

---

### **5.4. Atualização de Descrição de Categoria**
**Arquivo:** `server/src/core/memory/longTerm/category-description-updater.js`  
**Linha:** ~51  
**Função:** `updateCategoryDescription()`

#### Chamada:
```javascript
let description = await callOpenAI(systemPrompt, userPrompt, {
  temperature: 0.3,
  max_tokens: 150
});
```

#### System Prompt:
```
Você é um assistente financeiro que cria descrições concisas de perfil.
Siga EXATAMENTE as regras fornecidas.
```

#### User Prompt:
```
Você é um assistente financeiro especializado em criar descrições concisas.

CATEGORIA: <category>

MEMÓRIAS NA CATEGORIA:
1. <memory1>
2. <memory2>
...

TAREFA:
Crie uma descrição de NO MÁXIMO 25 PALAVRAS que resuma o perfil.

REGRAS OBRIGATÓRIAS:
1. Máximo 25 palavras
2. SEM datas específicas
3. SEM valores monetários detalhados
4. SEM nomes de ativos específicos
5. Foco em PADRÕES e CARACTERÍSTICAS gerais
6. Linguagem objetiva e profissional
7. Terceira pessoa (sem "o usuário")

EXEMPLOS DE BOAS DESCRIÇÕES:
- "Investidor conservador com portfólio diversificado em renda fixa, 
   prioriza liquidez e segurança"

RETORNE APENAS A DESCRIÇÃO, SEM EXPLICAÇÕES.
```

#### Output Esperado:
- String de até 25 palavras
- Sem datas, valores específicos, nomes de ativos

#### Pós-processamento:
```javascript
// Remove aspas
description = description.replace(/^["']|["']$/g, '');

// Trunca se exceder 25 palavras
if (countWords(description) > 25) {
  description = truncateToWords(description, 25);
}
```

#### Frequência:
- **Após cada propose() bem-sucedido** em LTM
- Atualiza a descrição dinâmica da categoria

#### Custo Estimado:
- Input: ~150-300 tokens (depende do número de memórias)
- Output: até 150 tokens

---

### **5.5. Fusão de Memórias (Memory Merger)**
**Arquivo:** `server/src/core/memory/longTerm/memory-merger.js`  
**Linha:** ~108  
**Função:** `fuseMemories()` (comentado/futuro)

#### Status: **NÃO IMPLEMENTADO (TODO)**

#### Chamada Planejada:
```javascript
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 150,
  temperature: 0.3
});
```

#### Prompt Planejado:
```
Merge these two related memories into one concise memory:
Memory 1: <existing>
Memory 2: <newContent>

Merged memory (preserve all unique information, max 100 words):
```

#### Implementação Atual:
- Usa deduplicação de frases baseada em Set
- LLM fusion está comentada para implementação futura

---

## 6️⃣ SHARED UTILITIES (Embedding - Não Configurado)

### **6.1. Geração de Embeddings**
**Arquivo:** `server/src/core/memory/shared/embedding-generator.js`  
**Linha:** ~18  
**Função:** `generate()`

#### Status: **NÃO CONFIGURADO (MOCK)**

#### Chamada Planejada (Comentada):
```javascript
// TODO: Integrate with actual OpenAI SDK
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// const response = await openai.embeddings.create({
//   model: 'text-embedding-3-small',
//   input: text
// });
// return response.data[0].embedding;
```

#### Implementação Atual:
```javascript
// Placeholder: return mock embedding
console.warn('[EmbeddingGenerator] Using MOCK embeddings');
return new Array(1536).fill(0).map(() => Math.random());
```

#### Impacto:
- **Semantic search NÃO funciona corretamente**
- Memory merger similarity NÃO é precisa
- Vector store usa embeddings aleatórios

#### Para Ativar:
1. Configurar `OPENAI_API_KEY` em .env
2. Instalar: `npm install openai`
3. Descomentar código

---

### **6.2. Geração de Embeddings em Lote**
**Arquivo:** `server/src/core/memory/shared/embedding-generator.js`  
**Linha:** ~47  
**Função:** `generateBatch()`

#### Status: **NÃO CONFIGURADO (MOCK)**

#### Chamada Planejada (Comentada):
```javascript
// const response = await openai.embeddings.create({
//   model: 'text-embedding-3-small',
//   input: texts
// });
// return response.data.map(item => item.embedding);
```

#### Implementação Atual:
- Retorna array de embeddings mock (aleatórios)

---

## 📊 Análise de Tokens e Custos

### Cenário Típico: Mensagem do Usuário

#### Fluxo Completo:
1. **JuniorAgent.processChatMessage()**
   - Input: ~500-2000 tokens (contexto + histórico + mensagem)
   - Output: ~800 tokens (resposta)
   - Reasoning tokens: variável (medium effort)
   - **Custo:** ~2800 tokens TOTAL

2. **MemoryProcessor.classifyInteraction()** (background)
   - Input: ~300-800 tokens
   - Output: ~1000 tokens
   - **Custo:** ~1800 tokens TOTAL

3. **WorkingMemory._curateValue()** (para cada item working)
   - Input: ~100-200 tokens
   - Output: ~200 tokens
   - **Custo por item:** ~400 tokens
   - Se 2 itens: ~800 tokens TOTAL

4. **EpisodicMemory._curateContent()** (1x)
   - Input: ~200-400 tokens
   - Output: ~600 tokens
   - **Custo:** ~1000 tokens TOTAL

5. **RelevanceCalculator.calculate()** (para cada candidato LTM)
   - Input: ~200-300 tokens
   - Output: ~400 tokens
   - **Custo por candidato:** ~700 tokens
   - Se 1 candidato: ~700 tokens TOTAL

6. **MemoryCurator.refineWithLLM()** (se candidato aceito)
   - Input: ~100-200 tokens
   - Output: ~200 tokens
   - **Custo:** ~400 tokens TOTAL

7. **CategoryDescriptionUpdater.updateCategoryDescription()** (após propose)
   - Input: ~150-300 tokens
   - Output: ~150 tokens
   - **Custo:** ~450 tokens TOTAL

### **TOTAL ESTIMADO POR MENSAGEM:**
- **Mínimo (sem LTM):** ~5600 tokens
- **Médio (1 LTM candidate):** ~7150 tokens
- **Máximo (múltiplos candidates + compression):** ~10000+ tokens

---

## 🔄 Fluxo de Execução

### Diagrama de Sequência:

```
Usuário envia mensagem
    ↓
┌─────────────────────────────────────────────┐
│ 1. JUNIOR AGENT                             │
│    - Carrega contexto de memória            │
│    - Constrói prompt com histórico          │
│    - openai.responses.create()              │ ← LLM #1 (gpt-5-nano)
│    - Retorna resposta ao usuário            │
└─────────────────────────────────────────────┘
    ↓ (em paralelo, background)
┌─────────────────────────────────────────────┐
│ 2. MEMORY PROCESSOR                         │
│    - classifyInteraction()                  │ ← LLM #2 (gpt-4.1-nano)
│    - Identifica: working, episodic, longTerm│
└─────────────────────────────────────────────┘
    ↓
    ├─→ [WORKING MEMORY]
    │   Para cada item working:
    │   - _curateValue()                       ← LLM #3 (gpt-4.1-nano)
    │   - Valida e armazena
    │
    ├─→ [EPISODIC MEMORY]
    │   - _curateContent()                     ← LLM #4 (gpt-4.1-nano)
    │   - create() ou update()
    │   - Auto-compress se necessário
    │
    └─→ [LONG-TERM MEMORY]
        Para cada candidato:
        - relevanceCalculator.calculate()      ← LLM #5 (gpt-4.1-nano)
        - Se score >= 0.7:
          - memoryCurator.refineWithLLM()      ← LLM #6 (gpt-4.1-nano)
          - propose() → armazena
          - updateCategoryDescription()        ← LLM #7 (gpt-4.1-nano)
```

---

## 🎯 Recomendações de Otimização

### 1. **Reduzir Chamadas em Cadeia**
   - Considerar batch processing para múltiplos candidatos LTM
   - Cache de classificações similares

### 2. **Ajustar max_tokens**
   - **JuniorAgent:** 800 tokens é adequado (ajustado recentemente)
   - **Classification:** 1000 tokens pode ser reduzido para 600
   - **Curation:** 600 tokens pode ser reduzido para 400

### 3. **Fallbacks Inteligentes**
   - Todos os módulos já têm fallbacks algorítmicos
   - Considerar usar fallback após 2 falhas consecutivas

### 4. **Configurar Embeddings**
   - **CRÍTICO:** Embeddings estão usando MOCK
   - Ativar OpenAI embeddings para semantic search real

### 5. **Monitoramento de Custos**
   - Adicionar contador de tokens total por sessão
   - Alert se exceder threshold (ex: 50k tokens/dia por usuário)

---

## 📝 Notas Finais

### Modelos Utilizados:
- **gpt-5-nano:** Apenas para JuniorAgent (resposta ao usuário)
- **gpt-4.1-nano:** Todos os outros processos de memória
- **text-embedding-3-small:** Planejado (não configurado)

### Dependências:
- `openai` SDK (Node.js)
- `axios` (para DeepSeek - não usado)

### Variáveis de Ambiente Necessárias:
```env
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...  # Opcional, não usado atualmente
```

### Arquivos Chave:
1. `server/src/config/openai-config.js` - Wrapper principal
2. `server/src/agents/junior/junior/junior-agent.js` - Resposta ao usuário
3. `server/src/core/memory/shared/memory-processor.js` - Orquestração
4. `server/src/core/memory/*/` - Módulos de memória com IA

---

**Documento gerado automaticamente via análise de código.**  
**Última atualização:** 25/01/2026  
**Versão:** 1.0
