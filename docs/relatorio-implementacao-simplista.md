# Relatório de Implementação - Agente Simplista

## Visão Geral

O **Agente Simplista** é um agente especializado em consultas simples e rápidas, projetado para responder perguntas diretas sobre dados financeiros do usuário e informações externas (cotações, fatos gerais). Ele opera com **GPT-5 Mini** em modo de baixa verbosidade e baixo raciocínio, priorizando velocidade e eficiência.

### Posição na Arquitetura

```
Usuário → Junior Agent (Triagem) → Simplista (se categoria = SIMPLISTA)
                                 → Lançador (se categoria = LANCAMENTO)
                                 → Complexa (se categoria = COMPLEXA)
                                 → Trivial (se categoria = TRIVIAL)
```

### Arquivos Implementados

```
server/src/agents/junior/simplista/
├── index.js                  # Entry point do módulo
├── simplista-agent.js        # Classe principal do agente
├── simplista-logger.js       # Sistema de log focado
├── simplista-cache.js        # Cache com TTL dinâmico
├── query-classifier.js       # Classificador de queries
├── finance-bridge-connector.js # Integração com FinanceDataBridge
├── serper-connector.js       # Integração direta com Serper
├── dialogue-manager.js       # Gerenciador de diálogos curtos
└── response-builder.js       # Construtor de respostas enriquecidas
```

---

## Objetivo 1: Estrutura Core

### simplista-logger.js
Sistema de logging focado com apenas 3 níveis:
- **ERROR**: Erros críticos que impedem operação
- **DECISION**: Decisões de roteamento e classificação
- **METRIC**: Métricas de performance

**Características:**
- Buffer circular de 100 entradas máximo
- Gravação em arquivo apenas em produção
- Meta: máximo 15-20 linhas de log por request
- Métricas agregadas por sessão

### simplista-cache.js
Cache inteligente com TTL dinâmico por tipo de dado:

| Tipo | TTL | Justificativa |
|------|-----|---------------|
| Cotações | 5 min | Alta volatilidade |
| Dados financeiros | 30 min | Atualizações moderadas |
| Fatos gerais | 72h | Baixa mudança |

**Características:**
- Política LRU para evicção
- Limite de 500 entradas
- Estatísticas de hit/miss

---

## Objetivo 2: Integração FinanceDataBridge

### finance-bridge-connector.js
Wrapper para o FinanceDataBridge existente com:

**Operações Suportadas:**
- `getSummary` - Resumo financeiro do período
- `getBalance` - Saldo atual
- `getTopExpenses` - Maiores despesas
- `listTransactions` - Lista de transações
- `getCategoryExpenses` - Despesas por categoria

**Extração Inteligente:**
- Períodos via regex (70%) + IA fallback (30%)
- Categorias via keywords
- Formatação automática de respostas

**Fallback:**
- Se Bridge falha, retorna mensagem amigável
- Log de erro para diagnóstico

---

## Objetivo 3: Integração Serper

### serper-connector.js
Integração direta com Serper para dados externos:

**Tipos de Consulta:**
- **Cotação**: Dólar, Euro, Bitcoin, ações (PETR4, etc.)
- **Moeda**: Conversões e taxas
- **Índice**: Bovespa, IPCA, Selic
- **Geral**: Fatos e informações financeiras

**Características:**
- Cache integrado para evitar chamadas repetidas
- Adaptação automática de queries para melhor resultado
- Formatação específica por tipo de dado
- Circuit breaker herdado do SerperClient

---

## Objetivo 4: Diálogo e Resposta

### dialogue-manager.js
Gerenciador de diálogos para queries ambíguas:

**Templates de Esclarecimento:**
- PERIOD: "Qual período você quer consultar?"
- CATEGORY: "Que tipo de despesa?"
- ACCOUNT: "Saldo de qual conta?"

**Regras:**
- Máximo 2-3 trocas de diálogo
- Timeout de 5 minutos
- Valores default quando possível
- Transição automática se necessário

### response-builder.js
Construtor de respostas enriquecidas:

**Formatação por Tipo:**
- Saldo: Com emoji 💰 e breakdown por conta
- Resumo: Entradas ✅, Saídas ❌, Saldo final
- Despesas: Lista limitada a 5 itens
- Transações: Com indicadores de entrada/saída

**Ofertas de Aprofundamento:**
- Contextuais baseadas nos dados
- Sugestões inteligentes para análise
- Integração com fluxo de transição

---

## Integração com Junior Agent

### Alterações em junior-agent.js

O método `routeToSimplista()` foi atualizado:

**Antes (STUB):**
```javascript
const stubResponse = `[MODO TESTE] Recebi sua consulta...`;
```

**Depois (Produção):**
```javascript
const { getSimplistaAgent } = require('../simplista');
const simplistaAgent = getSimplistaAgent();
const result = await simplistaAgent.execute({ userId, memory, message });
```

**Recursos Implementados:**
- Importação lazy para performance
- Passagem de contexto de memória
- Tratamento de flags de transição
- Salvamento automático na memória

---

## Testes Estratégicos

### Teste 1: Classificação de Queries

**Objetivo:** Validar classificação correta de queries por tipo.

```javascript
// test-classification.js
const { queryClassifier } = require('./query-classifier');

const testCases = [
  // Queries internas
  { query: 'qual meu saldo', expected: { type: 'BALANCE', sources: ['INTERNAL'] } },
  { query: 'quanto gastei esse mês', expected: { type: 'EXPENSES', sources: ['INTERNAL'] } },
  { query: 'resumo financeiro', expected: { type: 'SUMMARY', sources: ['INTERNAL'] } },
  
  // Queries externas
  { query: 'cotação do dólar', expected: { type: 'COTACAO', sources: ['EXTERNAL'] } },
  { query: 'quanto tá o bitcoin', expected: { type: 'COTACAO', sources: ['EXTERNAL'] } },
  { query: 'taxa selic atual', expected: { type: 'INDICE', sources: ['EXTERNAL'] } },
  
  // Queries híbridas
  { query: 'quanto gastei em dólar esse mês', expected: { sources: ['INTERNAL', 'EXTERNAL'] } },
  
  // Queries ambíguas
  { query: 'quanto gastei', expected: { isAmbiguous: true, ambiguityType: 'PERIOD' } },
  
  // Queries que devem transicionar
  { query: 'analise meus investimentos', expected: { transitionTo: 'COMPLEXA' } },
  { query: 'registrar gasto de 50 reais', expected: { transitionTo: 'LANCAMENTO' } }
];

async function runTests() {
  console.log('🧪 Teste de Classificação de Queries\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const { query, expected } of testCases) {
    const result = await queryClassifier.classify(query);
    
    let success = true;
    const checks = [];
    
    if (expected.type && result.type !== expected.type) {
      success = false;
      checks.push(`type: ${result.type} (esperado: ${expected.type})`);
    }
    
    if (expected.sources) {
      const sourcesMatch = expected.sources.every(s => result.sources.includes(s));
      if (!sourcesMatch) {
        success = false;
        checks.push(`sources: ${result.sources.join(',')} (esperado: ${expected.sources.join(',')})`);
      }
    }
    
    if (expected.isAmbiguous !== undefined && result.isAmbiguous !== expected.isAmbiguous) {
      success = false;
      checks.push(`isAmbiguous: ${result.isAmbiguous} (esperado: ${expected.isAmbiguous})`);
    }
    
    if (expected.transitionTo && result.transitionTo !== expected.transitionTo) {
      success = false;
      checks.push(`transitionTo: ${result.transitionTo} (esperado: ${expected.transitionTo})`);
    }
    
    if (success) {
      console.log(`✅ "${query}"`);
      passed++;
    } else {
      console.log(`❌ "${query}" - ${checks.join(', ')}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Resultado: ${passed}/${passed + failed} testes passaram`);
}

runTests();
```

### Teste 2: Integração Bridge

**Objetivo:** Validar consultas ao FinanceDataBridge.

```javascript
// test-bridge.js
const { financeBridgeConnector } = require('./finance-bridge-connector');

async function testBridge() {
  console.log('🧪 Teste de Integração Bridge\n');
  
  const testCases = [
    {
      name: 'Resumo do mês',
      params: {
        userId: 'test-user-123',
        message: 'resumo financeiro deste mês',
        classification: { type: 'SUMMARY' }
      }
    },
    {
      name: 'Saldo atual',
      params: {
        userId: 'test-user-123',
        message: 'qual meu saldo',
        classification: { type: 'BALANCE' }
      }
    },
    {
      name: 'Top despesas',
      params: {
        userId: 'test-user-123',
        message: 'maiores gastos do mês passado',
        classification: { type: 'EXPENSES' }
      }
    }
  ];
  
  for (const { name, params } of testCases) {
    console.log(`\n--- ${name} ---`);
    
    try {
      const startTime = Date.now();
      const result = await financeBridgeConnector.query(params);
      const elapsed = Date.now() - startTime;
      
      console.log(`⏱️ Tempo: ${elapsed}ms`);
      console.log(`📊 Resultado: ${result.formattedResponse ? 'OK' : 'Fallback'}`);
      
      if (result.formattedResponse) {
        console.log(`💬 ${result.formattedResponse.substring(0, 100)}...`);
      }
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
}

testBridge();
```

### Teste 3: Integração Serper

**Objetivo:** Validar consultas externas via Serper.

```javascript
// test-serper.js
const { serperConnector } = require('./serper-connector');

async function testSerper() {
  console.log('🧪 Teste de Integração Serper\n');
  
  const testCases = [
    { query: 'cotação do dólar hoje', type: 'COTACAO' },
    { query: 'preço do bitcoin', type: 'COTACAO' },
    { query: 'taxa selic atual', type: 'INDICE' },
    { query: 'ibovespa hoje', type: 'INDICE' }
  ];
  
  for (const { query, type } of testCases) {
    console.log(`\n--- "${query}" ---`);
    
    try {
      const startTime = Date.now();
      const result = await serperConnector.query({
        message: query,
        classification: { type }
      });
      const elapsed = Date.now() - startTime;
      
      console.log(`⏱️ Tempo: ${elapsed}ms`);
      console.log(`📊 Cache: ${result.fromCache ? 'HIT' : 'MISS'}`);
      
      if (result.formattedResponse) {
        console.log(`💬 ${result.formattedResponse}`);
      }
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
  
  // Teste de cache
  console.log('\n--- Teste de Cache ---');
  const cacheTest = await serperConnector.query({
    message: 'cotação do dólar hoje',
    classification: { type: 'COTACAO' }
  });
  console.log(`📦 Segunda chamada - Cache: ${cacheTest.fromCache ? 'HIT ✅' : 'MISS ❌'}`);
}

testSerper();
```

### Teste 4: Fluxo Completo

**Objetivo:** Validar o fluxo end-to-end do Simplista.

```javascript
// test-e2e.js
const { getSimplistaAgent } = require('./index');

async function testE2E() {
  console.log('🧪 Teste End-to-End do Simplista\n');
  
  const agent = getSimplistaAgent();
  
  const conversations = [
    // Conversa 1: Query simples
    { userId: 'user1', message: 'qual meu saldo' },
    
    // Conversa 2: Query com período
    { userId: 'user2', message: 'quanto gastei em alimentação esse mês' },
    
    // Conversa 3: Query externa
    { userId: 'user3', message: 'cotação do dólar' },
    
    // Conversa 4: Query ambígua (deve iniciar diálogo)
    { userId: 'user4', message: 'quanto gastei' },
    
    // Conversa 5: Query híbrida
    { userId: 'user5', message: 'meus gastos em dólar' }
  ];
  
  for (const { userId, message } of conversations) {
    console.log(`\n--- User: ${userId} ---`);
    console.log(`📝 Query: "${message}"`);
    
    try {
      const startTime = Date.now();
      const result = await agent.execute({ userId, memory: {}, message });
      const elapsed = Date.now() - startTime;
      
      console.log(`⏱️ Tempo: ${elapsed}ms`);
      console.log(`💬 Resposta: ${result.resposta?.substring(0, 150) || 'N/A'}...`);
      
      if (result.metadata) {
        console.log(`📊 Fontes: ${result.metadata.fontesConsultadas?.join(', ') || 'N/A'}`);
        console.log(`💡 Aprofundamento: ${result.metadata.ofereceuAprofundamento ? 'Sim' : 'Não'}`);
        console.log(`🔄 Transição: ${result.metadata.transitionFlag || 'Nenhuma'}`);
      }
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
  
  // Estatísticas finais
  console.log('\n--- Estatísticas do Agente ---');
  console.log(JSON.stringify(agent.getStats(), null, 2));
}

testE2E();
```

### Teste 5: Diálogo Interativo

**Objetivo:** Validar fluxo de diálogo para queries ambíguas.

```javascript
// test-dialogue.js
const { dialogueManager } = require('./dialogue-manager');

async function testDialogue() {
  console.log('🧪 Teste de Diálogo Interativo\n');
  
  const userId = 'test-user-dialogue';
  
  // Simula query ambígua
  console.log('1️⃣ Iniciando diálogo para período ambíguo...');
  const startResult = dialogueManager.startDialogue(
    userId,
    'quanto gastei em alimentação',
    'PERIOD',
    { type: 'EXPENSES' }
  );
  
  console.log(`   Pergunta: ${startResult.question}`);
  console.log(`   Opções: ${startResult.options.join(', ')}`);
  
  // Simula respostas do usuário
  const userResponses = [
    { input: 'xyz123', expected: 'invalid' },
    { input: 'esse mês', expected: 'valid' }
  ];
  
  for (const { input, expected } of userResponses) {
    console.log(`\n2️⃣ Usuário responde: "${input}"`);
    
    const result = dialogueManager.processResponse(userId, input);
    
    if (result.success) {
      console.log('   ✅ Diálogo resolvido');
      console.log(`   Tipo: ${result.clarification.type}`);
      console.log(`   Valor: ${result.clarification.normalizedValue}`);
      
      // Reconstrói query
      const newQuery = dialogueManager.reconstructQuery(
        result.originalQuery,
        result.clarification
      );
      console.log(`   Query reconstruída: "${newQuery}"`);
    } else {
      console.log(`   ❌ ${result.message}`);
      console.log(`   Tentativas restantes: ${result.remainingAttempts}`);
    }
  }
  
  // Estatísticas
  console.log('\n--- Estatísticas ---');
  console.log(JSON.stringify(dialogueManager.getStats(), null, 2));
}

testDialogue();
```

---

## Métricas de Sucesso

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Tempo de resposta | < 2s | Logger de métricas |
| Taxa de cache hit | > 40% | simplistaCache.getStats() |
| Classificação correta | > 85% | Testes de regressão |
| Diálogos completados | > 90% | DialogueManager stats |
| Transições corretas | 100% | Logs de decisão |

---

## Configuração para Produção

### Variáveis de Ambiente

```env
# Simplista
SIMPLISTA_LOG_LEVEL=METRIC       # Apenas métricas em produção
SIMPLISTA_CACHE_MAX_SIZE=1000    # Aumentar cache em produção
SIMPLISTA_TIMEOUT_MS=10000       # Timeout de 10s

# Serper (já configurado)
SERPER_API_KEY=xxx

# OpenAI (já configurado)
OPENAI_API_KEY=xxx
```

### Habilitando em Produção

O Simplista já está integrado e será ativado automaticamente quando queries forem classificadas como `SIMPLISTA` pelo Junior Agent.

---

## Considerações Finais

### Pontos Fortes

1. **Modularidade**: Cada componente é independente e testável
2. **Performance**: Cache e classificação híbrida (regex + IA)
3. **Fallbacks**: Tratamento robusto de erros
4. **Logging focado**: Máximo 15-20 linhas por request

### Melhorias Futuras

1. **Cache distribuído**: Redis para múltiplas instâncias
2. **ML para classificação**: Modelo treinado em queries reais
3. **Mais fontes externas**: Alpha Vantage para ações
4. **Personalização**: Preferências de resposta por usuário

---

**Implementado por:** GitHub Copilot  
**Data:** ${new Date().toISOString().split('T')[0]}  
**Versão:** 1.0.0
