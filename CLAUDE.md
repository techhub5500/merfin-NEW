# Guia de Integração Pinecone - Long-Term Memory

## 📋 Visão Geral

O Pinecone será usado **APENAS** na **Long-Term Memory** para implementar busca semântica vetorial nas 10 categorias de memória permanente do usuário.

**Não usar em**: Working Memory ou Episodic Memory (continuam apenas no MongoDB).

---

## 🛠️ 1. Configuração Inicial

### 1.1 Instalação

```bash
npm install pinecone
```

### 1.2 Variáveis de Ambiente (.env)

Adicionar ao arquivo `.env`:

```
PINECONE_API_KEY=pc-sua-chave-aqui
```

### 1.3 Instalação do CLI (uma vez, na máquina de desenvolvimento)

**macOS:**
```bash
brew tap pinecone-io/tap
brew install pinecone-io/tap/pinecone
```

**Outras plataformas:**
- Baixar do GitHub: https://github.com/pinecone-io/cli/releases

### 1.4 Autenticação do CLI

```bash
export PINECONE_API_KEY="sua-chave-aqui"
pc auth configure --api-key $PINECONE_API_KEY
```

---

## 🗂️ 2. Criação do Index (VIA CLI - UMA VEZ APENAS)

### 2.1 Criar Index

**IMPORTANTE**: Usar CLI, NÃO criar via código JavaScript.

```bash
pc index create \
  -n long-term-memory \
  -m cosine \
  -c aws \
  -r us-east-1 \
  --model llama-text-embed-v2 \
  --field_map text=content
```

**Parâmetros explicados:**
- `-n long-term-memory`: Nome do index
- `-m cosine`: Métrica de similaridade (cosine para texto)
- `-c aws`: Cloud provider
- `-r us-east-1`: Região (escolher mais próxima)
- `--model llama-text-embed-v2`: Modelo de embeddings integrado (Pinecone gera automaticamente)
- `--field_map text=content`: Campo `content` será embedado automaticamente

### 2.2 Verificar Index Criado

```bash
pc index list
pc index describe -n long-term-memory
```

---

## 📦 3. Estrutura de Dados

### 3.1 Namespaces

**CRÍTICO**: Usar namespaces para isolamento por usuário.

**Padrão de namespace**: `user_{userId}`

Exemplo: `user_507f1f77bcf86cd799439011`

### 3.2 Formato do Record para Pinecone

Ao armazenar memória LTM no Pinecone, enviar:

```javascript
{
  _id: "mongodb_objectid_string",           // ID do MongoDB como string
  content: "João trabalha como engenheiro", // Texto que será embedado
  category: "perfil_profissional",          // Uma das 10 categorias
  impactScore: 0.85,                        // Score 0.0 a 1.0
  createdAt: "2026-01-24T10:00:00.000Z",   // ISO string
  accessCount: 5                            // Número de acessos
}
```

**REGRAS IMPORTANTES:**
- ✅ Metadata FLAT (sem objetos aninhados)
- ✅ Tipos permitidos: string, number, boolean, array de strings
- ❌ Máximo 40KB de metadata por record
- ❌ NÃO incluir objetos aninhados (causará erro)

---

## 💾 4. Operações de Armazenamento (Upsert)

### 4.1 Inicialização do Cliente (no startup da aplicação)

**Arquivo**: `src/core/memory/longTerm/pinecone-store.js`

```javascript
const { Pinecone } = require('pinecone');

// Inicializar APENAS UMA VEZ no startup
const apiKey = process.env.PINECONE_API_KEY;
const pc = new Pinecone({ apiKey });

// Verificar se index existe
const hasIndex = await pc.hasIndex('long-term-memory');
if (!hasIndex) {
  throw new Error('Index não existe. Criar via CLI primeiro.');
}

// Conectar ao index
const index = pc.Index('long-term-memory');
```

### 4.2 Upsert de Uma Memória

**Quando**: Após `longTermMemory.propose()` aceitar uma nova memória.

**Método**: `index.upsert_records(namespace, [record])`

**Exemplo de integração**:

```javascript
// No método propose() de long-term-memory.js
// APÓS salvar no MongoDB:

const namespace = `user_${userId}`;

const record = {
  _id: memoryItem._id.toString(),
  content: memoryItem.content,
  category: memoryItem.category,
  impactScore: memoryItem.impactScore,
  createdAt: memoryItem.createdAt.toISOString(),
  accessCount: memoryItem.accessCount || 0
};

await index.upsert_records(namespace, [record]);
```

### 4.3 Upsert em Batch (múltiplas memórias)

**Quando**: Migração inicial ou sincronização em massa.

**LIMITE CRÍTICO**: Máximo 96 records por batch para texto.

```javascript
const BATCH_SIZE = 96;

for (let i = 0; i < memories.length; i += BATCH_SIZE) {
  const batch = memories.slice(i, i + BATCH_SIZE);
  
  const records = batch.map(mem => ({
    _id: mem._id.toString(),
    content: mem.content,
    category: mem.category,
    impactScore: mem.impactScore,
    createdAt: mem.createdAt.toISOString(),
    accessCount: mem.accessCount || 0
  }));
  
  await index.upsert_records(namespace, records);
  
  // Rate limiting entre batches
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

---

## 🔍 5. Busca Semântica (Retrieval)

### 5.1 Busca Básica COM Reranking (SEMPRE USAR)

**Quando**: No método `retrieve()` de `long-term-memory.js` quando `useVectorSearch: true`.

**CRÍTICO**: SEMPRE usar reranking em produção para melhor qualidade.

```javascript
const namespace = `user_${userId}`;

const results = await index.search({
  namespace: namespace,
  query: {
    top_k: topK * 2,  // Buscar mais candidatos para reranking
    inputs: {
      text: queryText  // Ex: "investimentos em renda fixa"
    }
  },
  rerank: {
    model: 'bge-reranker-v2-m3',
    top_n: topK,              // Quantidade final de resultados
    rank_fields: ['content']  // Campo usado para reranking
  }
});
```

### 5.2 Processar Resultados

```javascript
// IMPORTANTE: Com reranking, usar acesso dict-style

const memories = results.result.hits.map(hit => ({
  memoryId: hit["_id"],
  score: hit["_score"],
  content: hit.fields["content"],
  category: hit.fields["category"],
  impactScore: hit.fields["impactScore"],
  createdAt: new Date(hit.fields["createdAt"]),
  accessCount: hit.fields["accessCount"]
}));
```

### 5.3 Busca com Filtros de Metadata

**Quando**: Filtrar por categoria ou impact score mínimo.

```javascript
// Filtros simples
const filterCriteria = {
  category: { $eq: "investimentos" }
};

// Filtros complexos
const filterCriteria = {
  $and: [
    { category: { $in: ["investimentos", "perfil_risco"] } },
    { impactScore: { $gte: 0.7 } },
    { accessCount: { $gt: 0 } }
  ]
};

const results = await index.search({
  namespace: namespace,
  query: {
    top_k: topK * 2,
    inputs: { text: queryText },
    filter: filterCriteria  // Adicionar filtro DENTRO de query
  },
  rerank: {
    model: 'bge-reranker-v2-m3',
    top_n: topK,
    rank_fields: ['content']
  }
});
```

**Operadores disponíveis:**
- `$eq`, `$ne`: igual, diferente
- `$gt`, `$gte`, `$lt`, `$lte`: maior, maior/igual, menor, menor/igual
- `$in`, `$nin`: em lista, não em lista
- `$exists`: campo existe
- `$and`, `$or`: lógicos

### 5.4 Busca SEM Query (apenas filtros)

**Quando**: Listar memórias de uma categoria específica sem busca semântica.

**NOTA**: Sem query, não há reranking (não faz sentido).

```javascript
const results = await index.search({
  namespace: namespace,
  query: {
    top_k: topK,
    filter: { category: { $eq: "investimentos" } }
  }
  // SEM rerank quando não há query de texto
});
```

---

## 🗑️ 6. Operações de Deleção

### 6.1 Deletar Memória Específica

**Quando**: Ao remover memória do MongoDB (ex: descartada por orçamento).

```javascript
await index.delete({
  namespace: `user_${userId}`,
  ids: [memoryId]  // Array de IDs
});
```

### 6.2 Deletar Múltiplas Memórias

```javascript
await index.delete({
  namespace: `user_${userId}`,
  ids: [id1, id2, id3]
});
```

### 6.3 Deletar Namespace Inteiro (CUIDADO!)

**Quando**: Usuário solicita exclusão completa de dados.

```javascript
await index.delete({
  namespace: `user_${userId}`,
  delete_all: true
});
```

---

## 🔄 7. Sincronização MongoDB ↔ Pinecone

### 7.1 Quando Sincronizar

**Operações que DEVEM sincronizar:**

1. **Criação de memória**: `propose()` → MongoDB + Pinecone
2. **Atualização de memória**: Atualizar MongoDB + Upsert no Pinecone (sobrescreve)
3. **Deleção de memória**: Deletar MongoDB + Deletar no Pinecone
4. **Merge de duplicata**: Atualizar MongoDB + Upsert no Pinecone

### 7.2 Padrão de Sincronização

```javascript
// SEMPRE seguir esta ordem:
// 1. Operação no MongoDB
// 2. Se sucesso, operação no Pinecone
// 3. Se Pinecone falhar, logar erro mas NÃO reverter MongoDB

try {
  // 1. MongoDB
  await MongoDBModel.save(memory);
  
  // 2. Pinecone
  try {
    await index.upsert_records(namespace, [record]);
  } catch (pineconeError) {
    console.error('Pinecone sync failed:', pineconeError);
    // NÃO reverter MongoDB - continuar operação
    // Background job pode re-sincronizar depois
  }
} catch (mongoError) {
  // Se MongoDB falhar, nem tentar Pinecone
  throw mongoError;
}
```

### 7.3 Migração Inicial (Existente → Pinecone)

**Script de migração única**:

```javascript
// Buscar TODAS memórias LTM do MongoDB
const allUsers = await LongTermMemoryModel.find({});

for (const userMemory of allUsers) {
  const namespace = `user_${userMemory.userId}`;
  const records = userMemory.memoryItems.map(item => ({
    _id: item._id.toString(),
    content: item.content,
    category: item.category,
    impactScore: item.impactScore,
    createdAt: item.createdAt.toISOString(),
    accessCount: item.accessCount || 0
  }));
  
  // Batch de 96
  for (let i = 0; i < records.length; i += 96) {
    const batch = records.slice(i, i + 96);
    await index.upsert_records(namespace, batch);
    await new Promise(r => setTimeout(r, 100));
  }
}
```

---

## ⚠️ 8. Tratamento de Erros

### 8.1 Tipos de Erro

- **4xx (erro do cliente)**: NÃO retry (exceto 429)
- **429 (rate limit)**: Retry com backoff exponencial
- **5xx (erro do servidor)**: Retry com backoff exponencial

### 8.2 Pattern de Retry

```javascript
async function retryWithBackoff(operation, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const statusCode = error.status || error.statusCode;
      
      // Retry apenas erros transientes
      const shouldRetry = statusCode >= 500 || statusCode === 429;
      
      if (shouldRetry && attempt < maxRetries - 1) {
        const delay = Math.min(Math.pow(2, attempt) * 1000, 60000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// Uso
await retryWithBackoff(() => 
  index.upsert_records(namespace, records)
);
```

---

## 📊 9. Integração com Long-Term Memory Existente

### 9.1 Modificações em `long-term-memory.js`

**No método `propose()`:**

```javascript
// Após salvar no MongoDB com sucesso:
const namespace = `user_${userId}`;
const record = {
  _id: savedMemory._id.toString(),
  content: savedMemory.content,
  category: savedMemory.category,
  impactScore: savedMemory.impactScore,
  createdAt: savedMemory.createdAt.toISOString(),
  accessCount: 0
};

// Sincronizar com Pinecone (não bloquear se falhar)
try {
  await pineconeStore.upsert(namespace, record);
} catch (error) {
  console.error('Pinecone sync error:', error);
  // Continuar - memória já está no MongoDB
}
```

**No método `retrieve()`:**

```javascript
// Se useVectorSearch: true
if (options.useVectorSearch && query) {
  const namespace = `user_${userId}`;
  
  const filters = {};
  if (options.category) {
    filters.category = { $eq: options.category };
  }
  if (options.minImpact) {
    filters.impactScore = { $gte: options.minImpact };
  }
  
  const filterCriteria = Object.keys(filters).length > 0
    ? { $and: Object.entries(filters).map(([k, v]) => ({ [k]: v })) }
    : undefined;
  
  const results = await pineconeStore.search(
    namespace,
    query,
    {
      topK: options.limit || 5,
      filter: filterCriteria
    }
  );
  
  // Atualizar access stats no MongoDB
  const memoryIds = results.map(r => r.memoryId);
  await this._updateAccessStats(userId, memoryIds);
  
  return results;
}

// Senão, busca tradicional no MongoDB
```

### 9.2 Novo Arquivo: `pinecone-store.js`

Criar em: `src/core/memory/longTerm/pinecone-store.js`

**Responsabilidades:**
- Inicializar cliente Pinecone
- Wrapper para upsert_records
- Wrapper para search com reranking
- Wrapper para delete
- Tratamento de erros
- Retry logic

---

## 🎯 10. Casos de Uso Específicos

### 10.1 Busca: "Encontrar memórias sobre investimentos"

```javascript
const results = await longTermMemory.retrieve(
  userId,
  'investimentos em renda fixa e CDB',
  {
    category: 'investimentos',
    minImpact: 0.7,
    limit: 5,
    useVectorSearch: true
  }
);
```

### 10.2 Busca: "Informações financeiras do usuário"

```javascript
const results = await longTermMemory.retrieve(
  userId,
  'renda salário gastos mensais',
  {
    category: 'situacao_financeira',
    minImpact: 0.7,
    limit: 10,
    useVectorSearch: true
  }
);
```

### 10.3 Listar: "Todas memórias de uma categoria"

```javascript
const results = await longTermMemory.retrieve(
  userId,
  null,  // Sem query semântica
  {
    category: 'perfil_profissional',
    minImpact: 0.5,
    limit: 20,
    useVectorSearch: false  // Busca no MongoDB
  }
);
```

---

## ✅ 11. Checklist de Implementação

### Fase 1: Setup
- [ ] Instalar `pinecone` via npm
- [ ] Adicionar `PINECONE_API_KEY` no `.env`
- [ ] Instalar Pinecone CLI
- [ ] Autenticar CLI
- [ ] Criar index `long-term-memory` via CLI
- [ ] Verificar index criado

### Fase 2: Código Base
- [ ] Criar `pinecone-store.js`
- [ ] Implementar inicialização do cliente
- [ ] Implementar `upsert()`
- [ ] Implementar `search()`
- [ ] Implementar `delete()`
- [ ] Implementar retry logic

### Fase 3: Integração
- [ ] Modificar `propose()` para sincronizar
- [ ] Modificar `retrieve()` para busca vetorial
- [ ] Modificar operações de deleção
- [ ] Adicionar sincronização em `_checkDuplicates()`
- [ ] Adicionar sincronização em `_enforcebudget()`

### Fase 4: Migração
- [ ] Criar script de migração
- [ ] Migrar memórias existentes do MongoDB
- [ ] Verificar sincronização

### Fase 5: Testes
- [ ] Testar upsert de nova memória
- [ ] Testar busca semântica
- [ ] Testar busca com filtros
- [ ] Testar deleção
- [ ] Testar retry logic

---

## 🚫 12. O Que NÃO Fazer

### ❌ NUNCA usar SDK para criar/deletar index

```javascript
// ERRADO - Não fazer isso
await pc.create_index({ name: 'long-term-memory', ... });

// CORRETO - Usar CLI
// pc index create -n long-term-memory ...
```

### ❌ NUNCA usar metadata aninhada

```javascript
// ERRADO
{
  _id: "123",
  user: { name: "João", age: 30 }  // Nested!
}

// CORRETO
{
  _id: "123",
  user_name: "João",
  user_age: 30
}
```

### ❌ NUNCA exceder batch size

```javascript
// ERRADO
await index.upsert_records(namespace, 200Records);  // > 96

// CORRETO
for (let i = 0; i < records.length; i += 96) {
  await index.upsert_records(namespace, records.slice(i, i + 96));
}
```

### ❌ NUNCA esquecer namespace

```javascript
// ERRADO
await index.search({ query: {...} });

// CORRETO
await index.search({ namespace: `user_${userId}`, query: {...} });
```

### ❌ NUNCA fazer busca sem reranking em produção

```javascript
// SUBÓTIMO (ok para testes)
await index.search({
  namespace: ns,
  query: { top_k: 5, inputs: { text: query } }
});

// ÓTIMO (produção)
await index.search({
  namespace: ns,
  query: { top_k: 10, inputs: { text: query } },
  rerank: { model: 'bge-reranker-v2-m3', top_n: 5, rank_fields: ['content'] }
});
```

---

## 📝 13. Resumo Final

**Pinecone no Sistema:**
- **Escopo**: APENAS Long-Term Memory
- **Propósito**: Busca semântica vetorial
- **Embeddings**: Automáticos (llama-text-embed-v2)
- **Namespace**: Por usuário (`user_{userId}`)
- **Sincronização**: MongoDB → Pinecone (MongoDB é source of truth)
- **Busca**: SEMPRE com reranking

**Fluxo Típico:**
1. Usuário faz pergunta
2. `retrieve()` busca no Pinecone com query semântico
3. Pinecone retorna top memórias relevantes
4. Sistema formata para contexto do agente
5. Agente usa memórias na resposta

**Manutenção:**
- Index criado via CLI (uma vez)
- Dados sincronizados automaticamente
- Erros de sync logados mas não bloqueiam
- Background job pode re-sincronizar se necessário