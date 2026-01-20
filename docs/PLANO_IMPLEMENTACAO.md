# 📋 Plano de Implementação - Sistema de Agentes IA

**Data de Criação**: 18 de Janeiro de 2026  
**Última Atualização**: 18 de Janeiro de 2026 - 11:30  
**Revisões**: 3 (conforme solicitado)

**Mudanças desta revisão**:
- ✅ **Sistema de Memória Cognitiva** adicionado à Etapa 1 (22 arquivos novos)
- ✅ **Transaction Agent** agora EXECUTA transações (não apenas sugere)
- ✅ **Undo Manager** adicionado para permitir reversão de transações
- ✅ Duração da Etapa 1 ajustada de 3-4 para **5-7 dias**
- ✅ Total de arquivos da Etapa 1: 15-20 → **45-50**
- ✅ Total de arquivos da Etapa 6: 16-18 → **18-20**
- ✅ Tempo total do projeto: 28-36 → **30-39 dias**

---

## 🎯 Visão Geral

Este documento divide a implementação do sistema de agentes de IA em **8 etapas principais**. Cada etapa foi cuidadosamente planejada para:

1. **Ser independente** - Pode ser completada sem bloquear outras partes
2. **Ser testável** - Tem critérios claros de validação
3. **Agregar valor** - Entrega funcionalidade utilizável
4. **Ser sequencial** - Segue ordem lógica de dependências

---

## ⚠️ IMPORTANTE: Sobre Dados Atuais

**CONTEXTO CRÍTICO**: Atualmente a plataforma possui tabelas e planilhas com **textos e valores fixos** apenas para fins de visualização e estilização do frontend.

### O que precisa ser adaptado:

✅ **Podem permanecer fixos:**
- Títulos de seções
- Subtítulos
- Labels de campos
- Textos de ajuda/tooltips

❌ **DEVEM ser substituídos por dados dinâmicos:**
- Valores monetários (saldos, transações, investimentos)
- Nomes de contas e categorias do usuário
- Datas de transações
- Descrições de lançamentos
- Dados de gráficos e tabelas
- Qualquer informação específica do usuário

### Como abordar na implementação:

Cada etapa que envolve dados do usuário terá uma **sub-fase de dinamização**:
1. Identificar componentes com dados estáticos
2. Criar endpoints da API para buscar dados reais
3. Conectar frontend aos endpoints
4. Substituir dados mockados por chamadas reais
5. Validar que dados estão sendo exibidos corretamente

Esta adaptação está planejada especialmente nas **Etapas 3, 5 e 7**.

---

## 📊 Estrutura de Pastas Criada

```
server/
├── src/
│   ├── agents/              # Todos os agentes de IA
│   │   ├── orchestrator/    # Agente coordenador (ReAct)
│   │   ├── data/            # Agente de banco de dados
│   │   ├── research/        # Agente de pesquisa web
│   │   ├── analyst/         # Agente de análises financeiras
│   │   ├── strategist/      # Agente de estratégia de investimentos
│   │   ├── transaction/     # Agente de lançamentos
│   │   ├── validator/       # Agente de validação e compliance
│   │   └── shared/          # Código compartilhado entre agentes
│   ├── core/                # Infraestrutura crítica
│   │   ├── toolContext/     # Sistema de cache de sessão
│   │   └── streaming/       # Streaming de eventos SSE
│   ├── database/            # Camada de banco de dados
│   │   ├── schemas/         # Schemas e validações MongoDB
│   │   └── transactions/    # Gerenciamento de transações ACID
│   ├── api/                 # API REST
│   │   └── routes/          # Rotas HTTP
│   ├── config/              # Configurações centralizadas
│   └── external/            # Integrações externas
│       ├── tavily/          # Cliente API Tavily
│       ├── serper/          # Cliente API Serper
│       └── llm/             # Clientes de LLMs
├── logs/                    # Logs do sistema
└── server.js                # Servidor atual (será mantido)
```

**NOVO ARQUIVO**: `serveragent.js` será criado na **Etapa 2** como ponto de entrada separado para o sistema de agentes.

---

## 🚀 Etapas de Implementação

---

### **ETAPA 1: Fundação - Database & Core** 
**Duração Estimada:** 5-7 dias *(aumentado devido ao sistema de memória cognitiva)*  
**Prioridade:** CRÍTICA (base de tudo)

#### Objetivo
Estabelecer fundação sólida com MongoDB configurado corretamente, componentes core funcionais e **sistema completo de memória cognitiva** para os agentes.

#### Tarefas

**1.1 - Configuração do MongoDB com Validações Rígidas**
- [ ] Criar arquivo `server/src/database/schemas/accounts-schema.js`
  - Schema com validação $jsonSchema
  - Campos obrigatórios: user_id, account_type, currency, balance, status, created_at
  - Validação: balance >= 0 (exceto crédito)
  - Validação: account_type enum ['checking', 'savings', 'investment']
  - Validação: currency enum ['BRL', 'USD', 'EUR']
  - Validação: status enum ['active', 'suspended', 'closed']

- [ ] Criar arquivo `server/src/database/schemas/transactions-schema.js`
  - Schema com validação $jsonSchema
  - Campos obrigatórios: user_id, account_id, type, amount, date, status, created_at
  - Validação: amount >= 0.01
  - Validação: type enum ['income', 'expense', 'transfer', 'investment']
  - Validação: status enum ['pending', 'confirmed', 'cancelled', 'failed']
  - Validação: description maxLength 500

- [ ] Criar arquivo `server/src/database/schemas/users-schema.js`
  - Schema para perfis de usuário
  - Campos: risk_profile, investment_goals, financial_situation
  - Validação: risk_profile enum ['conservative', 'moderate', 'aggressive']

- [ ] Criar arquivo `server/src/database/schemas/audit-log-schema.js`
  - Schema IMUTÁVEL de auditoria
  - Campos: timestamp, user_id, action, entity, entity_id, before_state, after_state
  - Configurar como append-only (nunca deletar)

- [ ] Criar arquivo `server/src/database/schemas/indexes.js`
  - Índice: accounts { user_id: 1, status: 1 }
  - Índice único: accounts { user_id: 1, account_type: 1 }
  - Índice: transactions { user_id: 1, date: -1 }
  - Índice: transactions { account_id: 1, status: 1 }
  - Índice: audit_log { timestamp: -1 }
  - Índice: audit_log { user_id: 1, timestamp: -1 }

- [ ] Criar script de inicialização: `server/src/database/init-database.js`
  - Conecta ao MongoDB
  - Cria todas as collections com validações
  - Cria todos os índices


**1.2 - Sistema de Transações ACID**
- [ ] Criar `server/src/database/transactions/transaction-manager.js`
  - Método: `executeTransaction(operations)`
  - Implementar padrão: startSession → startTransaction → operações → commit/abort
  - Configuração: readConcern 'snapshot', writeConcern 'majority'
  - Logging obrigatório no audit_log

- [ ] Criar `server/src/database/transactions/account-transactions.js`
  - Função: `updateAccountBalance(accountId, amount, session)`
  - Garantir atomicidade com transações
  - Validar saldo antes de debitar

**1.3 - ToolContext (Sistema de Cache)**
- [ ] Criar `server/src/core/toolContext/tool-context.js`
  - Classe ToolContext com Map interno
  - Método `set(key, value, ttlSeconds = 300)`
  - Método `get(key)` com validação de TTL
  - Método `has(key)`
  - Método `clear()`
  - Array `_accessLog` para auditoria

- [ ] Criar `server/src/core/toolContext/ttl-manager.js`
  - Validação automática de expiração
  - Limpeza periódica de dados expirados

**1.3.1 - Sistema de Memória Cognitiva (Memory Architecture)**
> **CRÍTICO**: Este sistema não é histórico de chat, mas **estado cognitivo comprimido** dos agentes.

- [ ] Criar `server/src/core/memory/working/working-memory.js`
  - Memória de execução imediata (não persistente)
  - Armazenamento em Map por session_id
  - API: `set(sessionId, key, value)`, `get(sessionId, key)`, `getAll(sessionId)`, `clear(sessionId)`
  - Sem limite de tamanho (efêmera)
  - Auto-limpeza ao fim do chat

- [ ] Criar `server/src/core/memory/working/session-store.js`
  - Gerenciamento de sessões ativas
  - Timeout de inatividade (ex: 30 minutos)
  - Cleanup automático

- [ ] Criar `server/src/core/memory/episodic/episodic-memory.js`
  - Memória por chat (sessão específica)
  - Armazenamento MongoDB collection `episodic_memories`
  - Schema: { chat_id, user_id, episodic_memory (JSON), word_count, created_at, last_updated, expires_at }
  - Orçamento: ~500 palavras por chat
  - API: `create(chatId, userId)`, `update(chatId, content)`, `get(chatId)`, `compress(chatId)`, `archive(chatId)`, `delete(chatId)`

- [ ] Criar `server/src/core/memory/episodic/compression-engine.js`
  - Compressão progressiva quando aproximar de 400 palavras (80% do orçamento)
  - Uso de LLM para resumir mantendo essência
  - Gatilhos: a cada N mensagens ou quando ultrapassar threshold

- [ ] Criar `server/src/core/memory/episodic/relevance-scorer.js`
  - Pontuação de relevância de informações
  - Decisão sobre o que manter ao comprimir

- [ ] Criar `server/src/core/memory/longTerm/long-term-memory.js`
  - Memória global persistente (cross-chat)
  - Armazenamento dual: MongoDB + Vector Store (Pinecone/Qdrant)
  - Schema MongoDB: { user_id, long_term_memory (JSON), word_count, created_at, last_updated, memory_items[] }
  - Orçamento TOTAL: ~400 palavras para todo o perfil
  - API: `propose(userId, memoryCandidate)`, `retrieve(userId, query)`, `merge(userId, memoryIds)`, `calculateImpact(memoryId)`, `discard(userId, memoryId)`

- [ ] Criar `server/src/core/memory/longTerm/profile-manager.js`
  - Gerenciador de perfil permanente do usuário
  - Categorias: comunicação, perfil_financeiro, comportamental, objetivos, relação_plataforma

- [ ] Criar `server/src/core/memory/longTerm/memory-curator.js`
  - **Curador HÍBRIDO** (regras + LLM)
  - Regras duras não negociáveis
  - Avaliação semântica pelo agente
  - Decisão sobre o que vira Long-Term Memory
  - Impacto mínimo: score > 0.7

- [ ] Criar `server/src/core/memory/longTerm/memory-merger.js`
  - Fusão de memórias similares
  - Evitar duplicação e redundância

- [ ] Criar `server/src/core/memory/longTerm/relevance-calculator.js`
  - Cálculo de impacto de memórias (0.0 a 1.0)
  - Fatores: recorrência, estruturalidade, durabilidade, acesso
  - Threshold para manter: > 0.5
  - Threshold para Long-Term: > 0.7

- [ ] Criar `server/src/core/memory/longTerm/vector-store.js`
  - Integração com Pinecone ou Qdrant
  - Busca semântica de memórias
  - Embeddings com OpenAI text-embedding-3-small

- [ ] Criar `server/src/core/memory/shared/memory-validator.js`
  - Validação universal de memórias (todos os tipos)
  - Método: `checkHardRules(memory)` - dados sensíveis, conteúdo proibido
  - Método: `checkScope(memory, intendedScope)` - valida se escopo é apropriado
  - Método: `checkBudget(currentMemory, newContent, limit)` - verifica orçamento de palavras
  - Método: `checkImpact(memory, minScore)` - valida impacto mínimo para LTM

- [ ] Criar `server/src/core/memory/shared/memory-compressor.js`
  - Compressor universal de memórias verbose
  - Método LLM: `compress(memory, targetWords)` - compressão inteligente
  - Método baseado em regras: `compressRuleBased(memory)` - mais rápido

- [ ] Criar `server/src/core/memory/shared/word-counter.js`
  - Contador preciso de palavras
  - Suporte para strings e objetos JSON
  - Métodos: `count(content)`, `isNearLimit(currentCount, limit, threshold)`, `percentageUsed(currentCount, limit)`

- [ ] Criar `server/src/core/memory/shared/embedding-generator.js`
  - Geração de embeddings para busca semântica
  - Integração OpenAI Embeddings API
  - Método: `generate(text, model)`, `generateBatch(texts, model)`
  - Cálculo de similaridade cosseno

- [ ] Criar `server/src/core/memory/shared/memory-types.js`
  - Constantes e tipos de memória
  - Orçamentos: { WORKING: Infinity, EPISODIC: 500, LONG_TERM: 400 }
  - Thresholds de impacto
  - Categorias de memória

- [ ] Criar `server/src/core/memory/shared/hard-rules.js`
  - Regras duras não negociáveis
  - Lista de conteúdo proibido (senhas, tokens, dados sensíveis)
  - Gatilhos de compressão

- [ ] Criar `server/src/database/schemas/episodic-memory-schema.js`
  - Schema MongoDB para memórias episódicas
  - TTL opcional (deletar após 30 dias de inatividade)
  - Índices: { chat_id: 1 }, { user_id: 1, created_at: -1 }

- [ ] Criar `server/src/database/schemas/long-term-memory-schema.js`
  - Schema MongoDB para memórias de longo prazo
  - Array de memory_items com metadata
  - Índices: { user_id: 1 }, { 'memory_items.impact_score': -1 }

**1.4 - Sistema de Streaming**
- [ ] Criar `server/src/core/streaming/event-emitter.js`
  - EventEmitter para streaming de eventos
  - Suporte a Server-Sent Events (SSE)

- [ ] Criar `server/src/core/streaming/event-types.js`
  - Enum de tipos: node:start, tool:call, data:partial, thought:reasoning, final:answer

- [ ] Criar `server/src/core/streaming/stream-formatter.js`
  - Formatação de eventos para SSE (formato: `data: {json}\n\n`)

**1.5 - Configurações**
- [ ] Criar `server/src/config/env.js`
  - Carregar variáveis .env com validação
  - Validar presença de: MONGODB_URI, OPENAI_API_KEY, JWT_SECRET

- [ ] Criar `server/src/config/agent-config.js`
  - Limites de ciclos por complexidade
  - TTLs de cache por tipo de dado
  - Configurações de timeout

#### Critérios de Validação
- ✅ MongoDB conecta com sucesso
- ✅ Schemas validam dados corretamente (testar inserção inválida - deve falhar)
- ✅ Transações ACID funcionam (testar rollback)
- ✅ ToolContext armazena e recupera dados com TTL
- ✅ **Working Memory armazena e limpa dados por sessão**
- ✅ **Episodic Memory persiste e comprime corretamente**
- ✅ **Long-Term Memory valida impacto e rejeita memórias de baixo score**
- ✅ **Memory Validator detecta dados sensíveis e escopo inadequado**
- ✅ **Word Counter calcula orçamento corretamente**
- ✅ **Memory Compressor reduz memórias verbose**
- ✅ EventEmitter emite eventos de streaming
- ✅ Variáveis de ambiente carregam corretamente

#### Arquivos Gerados
- **~45-50 arquivos novos** (15 core + 22 memory + schemas + configs + tests)
- Script de testes unitários para cada componente

---

### **ETAPA 2: Agentes Base - Shared & Data Agent**
**Duração Estimada:** 3-4 dias  
**Prioridade:** ALTA  
**Dependências:** Etapa 1 completa

#### Objetivo
Criar infraestrutura compartilhada e primeiro agente funcional (Data Agent).

#### Tarefas

**2.1 - Código Compartilhado (Shared)**
- [ ] Criar `server/src/agents/shared/base-agent.js`
  - Classe abstrata BaseAgent
  - Método abstrato `execute(request)`
  - Métodos auxiliares: `_successResponse()`, `_errorResponse()`
  - Sistema de logging integrado

- [ ] Criar `server/src/agents/shared/contracts.js`
  - Schema JSON de requisição padrão
  - Schema JSON de resposta padrão
  - Validadores Joi/Zod para contratos

- [ ] Criar `server/src/agents/shared/response-formatter.js`
  - Formatação padronizada de respostas
  - Inclusão automática de metadata (timestamp, request_id, etc)

- [ ] Criar `server/src/agents/shared/error-handler.js`
  - Tratamento centralizado de erros
  - Conversão de erros em formato padrão
  - Logging automático

- [ ] Criar `server/src/agents/shared/logger.js`
  - Logger específico para agentes
  - Formato: [AGENT_NAME] [TIMESTAMP] [LEVEL] mensagem
  - Integração com Winston ou similar

- [ ] Criar `server/src/agents/shared/constants.js`
  - Enums de complexidade
  - Enums de status de resposta
  - Limites de ciclos
  - TTLs padrão

**2.2 - Data Agent (Primeiro Agente Completo)**
- [ ] Criar `server/src/agents/data/data-agent.js`
  - Estender BaseAgent
  - Implementar método `execute(request)`
  - Mapeamento de ações para métodos

- [ ] Criar `server/src/agents/data/account-queries.js`
  - Implementar `fetchAccountBalance(params)`
  - Integração com ToolContext (cache)
  - Transformação de documentos MongoDB

- [ ] Criar `server/src/agents/data/transaction-queries.js`
  - Implementar `fetchTransactions(params)`
  - Query otimizada com agregação
  - Cálculo de sumários (total_income, total_expense, net_flow)

- [ ] Criar `server/src/agents/data/user-queries.js`
  - Implementar `fetchUserProfile(params)`
  - Cache de 30 minutos (TTL longo)

- [ ] Criar `server/src/agents/data/data-validator.js`
  - Implementar `validateDataIntegrity(params)`
  - Validações: saldo negativo, datas futuras, moeda inválida

- [ ] Criar `server/src/agents/data/cache-manager.js`
  - Wrapper do ToolContext para Data Agent
  - Estratégias de invalidação de cache

**2.3 - Servidor de Agentes (serveragent.js)**
- [ ] Criar `server/serveragent.js` (NOVO ARQUIVO SEPARADO)
  - Servidor Express dedicado aos agentes
  - Porta diferente do server.js (ex: 5000)
  - Rotas: POST /agent/execute
  - Middleware de validação de requisições
  - Cors configurado

#### Critérios de Validação
- ✅ BaseAgent pode ser estendido por outros agentes
- ✅ Data Agent responde a todas as tools implementadas
- ✅ Cache funciona corretamente (testar hit/miss)
- ✅ Validações de dados funcionam
- ✅ serveragent.js inicia sem erros
- ✅ Endpoint /agent/execute aceita requisições

#### Arquivos Gerados
- 13-15 arquivos novos
- Testes unitários para Data Agent

---

### **ETAPA 3: Dinamização do Frontend - Parte 1 (Dashboard & Contas)**
**Duração Estimada:** 2-3 dias  
**Prioridade:** ALTA  
**Dependências:** Etapa 2 completa

#### Objetivo
Substituir dados estáticos do dashboard e tela de contas por dados dinâmicos vindos do Data Agent.

#### Contexto
Atualmente o dashboard (`client/html/dash.html`) e as páginas de home/finanças/investimentos/perfil exibem dados fixos em HTML. Vamos conectar ao backend real.

#### Tarefas

**3.1 - API Routes para Dados Estáticos Atuais**
- [ ] Criar `server/src/api/routes/account-routes.js`
  - GET /api/accounts/:userId - Lista contas do usuário
  - GET /api/accounts/:accountId/balance - Saldo específico
  - Chamar Data Agent internamente

- [ ] Criar `server/src/api/routes/transaction-routes.js`
  - GET /api/transactions/:userId - Lista transações
  - Query params: startDate, endDate, type, status
  - GET /api/transactions/:userId/summary - Sumário mensal
  - Chamar Data Agent internamente

- [ ] Atualizar `server/server.js`
  - Importar e registrar account-routes
  - Importar e registrar transaction-routes
  - Adicionar middleware de autenticação

**3.2 - Dinamização do Dashboard (`client/html/dash.html`)**
- [ ] Identificar elementos com dados estáticos:
  - Tabela de transações recentes
  - Cards de saldo total
  - Gráficos de receitas/despesas
  - Lista de contas

- [ ] Criar `client/js/dash.js` (atualizar se já existe)
  - Função `loadAccountBalances()` - busca saldos
  - Função `loadRecentTransactions()` - busca últimas 10 transações
  - Função `loadMonthlySummary()` - busca sumário do mês
  - Função `renderAccountCards()` - renderiza cards de contas
  - Função `renderTransactionTable()` - renderiza tabela
  - Usar fetch() para chamar endpoints da API

- [ ] Atualizar HTML para ter placeholders:
  - Adicionar `id` em elementos que receberão dados
  - Adicionar loading states (spinners)
  - Tratamento de erros (mensagens amigáveis)

**3.3 - Dinamização da Tela de Investimentos (`client/html/invest.html`)**
- [ ] Criar `server/src/api/routes/investment-routes.js`
  - GET /api/investments/:userId - Lista investimentos
  - GET /api/investments/:userId/performance - Performance total

- [ ] Atualizar `client/js/invest.js`
  - Função `loadInvestments()` - busca investimentos
  - Função `loadPerformance()` - busca performance
  - Renderização dinâmica de tabelas

**3.4 - Testes de Integração**
- [ ] Testar carregamento de dados no dashboard
- [ ] Testar filtros de transações
- [ ] Testar exibição de múltiplas contas
- [ ] Testar estados de loading e erro

#### Critérios de Validação
- ✅ Dashboard carrega saldos reais do banco
- ✅ Transações exibidas são do usuário logado
- ✅ Gráficos usam dados reais
- ✅ Loading states aparecem durante requisições
- ✅ Erros são tratados graciosamente
- ✅ Performance é aceitável (< 2s para carregar dashboard)

#### Arquivos Modificados/Criados
- 3 arquivos de rotas novos
- 3 arquivos JS do cliente atualizados
- server.js modificado

---

### **ETAPA 4: Orquestrador & Motor ReAct**
**Duração Estimada:** 5-6 dias  
**Prioridade:** CRÍTICA  
**Dependências:** Etapas 1 e 2 completas

#### Objetivo
Implementar o agente orquestrador que coordena todos os outros agentes usando o padrão ReAct com execução paralela.

#### Tarefas

**4.1 - Classificador de Complexidade**
- [ ] Criar `server/src/agents/orchestrator/complexity-classifier.js`
  - Função `classifyComplexity(query)` retorna 'simple' | 'basic' | 'comparative' | 'complex' | 'research'
  - Análise de palavras-chave
  - Detecção de queries comparativas ("vs", "ou", "melhor")
  - Detecção de queries de planejamento ("plano", "aposentadoria")
  - Pode usar LLM para classificação mais precisa

- [ ] Criar `server/src/agents/orchestrator/cycle-limits.js`
  - Mapeamento complexidade → limite de ciclos
  - Simple: 1-3, Basic: 3-5, Comparative: 5-8, Complex: 8-12, Research: 10-15

**4.2 - Planejador de Execução**
- [ ] Criar `server/src/agents/orchestrator/execution-planner.js`
  - Função `createExecutionPlan(query, complexity)`
  - Retorna: array de objetivos, array de steps com dependências
  - Identifica agentes necessários
  - Detecta ações paralelizáveis (sem dependências)

**4.3 - Motor ReAct**
- [ ] Criar `server/src/agents/orchestrator/react-engine.js`
  - Método `reason(state)`: decide próxima ação
    - Analisa dados coletados até o momento
    - Identifica objetivos pendentes
    - Justifica necessidade de continuar
    - Retorna: { agent, task, justification }
  
  - Método `act(action, state)`: executa ação
    - Constrói requisição padronizada para agente
    - Chama agente via dispatcher
    - Suporta execução paralela (Promise.all)
    - Retorna: resultado do agente
  
  - Método `observe(result, state)`: processa resultado
    - Mescla dados no state.collected_data
    - Atualiza objetivos alcançados
    - Detecta novos objetivos descobertos
    - Retorna: state atualizado

**4.4 - Dispatcher de Agentes**
- [ ] Criar `server/src/agents/orchestrator/agent-dispatcher.js`
  - Função `getAgent(agentName)`: retorna instância do agente
  - Função `execute(agentName, request)`: chama agente.execute()
  - Pool de instâncias de agentes (singleton)
  - Tratamento de erros de agentes

**4.5 - Orquestrador Principal**
- [ ] Criar `server/src/agents/orchestrator/orchestrator.js`
  - Estender BaseAgent
  
  - Método `processQuery(query, context)`:
    - Classificar complexidade
    - Obter limite de ciclos
    - Criar plano de execução
    - Inicializar state
    - Loop ReAct:
      ```
      while (current_cycle < max_cycles && pending_objectives) {
        nextAction = reason(state)
        result = act(nextAction, state)
        state = observe(result, state)
        logCycle(state)
      }
      ```
    - Chamar validador (OBRIGATÓRIO)
    - Consolidar resposta
  
  - Método `consolidateResponse(state)`:
    - Agregar dados coletados
    - Gerar resposta em linguagem natural
    - Incluir metadata (ciclos, agentes usados, custo, tempo)

**4.6 - Integração com Streaming**
- [ ] Adicionar emissão de eventos no motor ReAct
  - Emitir 'node:start' ao iniciar ciclo
  - Emitir 'tool:call' ao chamar agente
  - Emitir 'thought:reasoning' durante reason()
  - Emitir 'data:partial' durante observe()
  - Emitir 'final:answer' ao consolidar resposta

#### Critérios de Validação
- ✅ Classificador identifica corretamente 5 tipos de queries
- ✅ Planejador cria planos coerentes
- ✅ Motor ReAct executa ciclos corretamente
- ✅ Dispatcher chama agentes sem erros
- ✅ Orquestrador completa queries simples em 1-3 ciclos
- ✅ Streaming emite eventos corretamente
- ✅ Validador é sempre chamado antes da resposta

#### Arquivos Gerados
- 6 arquivos novos
- Testes de integração para fluxo completo

---

### **ETAPA 5: Agentes Especializados - Research & Analyst**
**Duração Estimada:** 4-5 dias  
**Prioridade:** ALTA  
**Dependências:** Etapa 4 completa

#### Objetivo
Implementar agentes de pesquisa externa e análise financeira.

#### Tarefas

**5.1 - Integrações Externas (APIs)**
- [ ] Criar `server/src/external/llm/llm-router.js`
  - Função `route(task, complexity)` decide qual modelo usar
  - Tier 1 (denso): GPT-4o ou Claude Opus
  - Tier 2 (rápido): GPT-4o-mini ou Claude Haiku

- [ ] Criar `server/src/external/llm/openai-client.js`
  - Wrapper da API OpenAI
  - Métodos: `complete(prompt, model)`, `stream(prompt, model)`
  - Contador de tokens e custos

- [ ] Criar `server/src/external/serper/serper-client.js`
  - Wrapper da API Serper
  - Método `search(query, options)`
  - Parser de resultados (snippets, links)

- [ ] Criar `server/src/external/tavily/tavily-client.js`
  - Wrapper da API Tavily
  - Método `search(query, depth)`
  - Parser de resultados (content, score)

**5.2 - Research Agent**
- [ ] Criar `server/src/agents/research/research-agent.js`
  - Estender BaseAgent
  - Método `execute(request)` com mapeamento de ações

- [ ] Criar `server/src/agents/research/api-selector.js`
  - Função `chooseApi(action, params)`
  - Lógica: preços/headlines → Serper, análises → Tavily

- [ ] Criar `server/src/agents/research/asset-price-searcher.js`
  - Tool: `searchAssetPrices(params)`
  - Usa Serper
  - Extrai preço com regex
  - Cache de 1 hora

- [ ] Criar `server/src/agents/research/market-analysis-searcher.js`
  - Tool: `searchMarketAnalysis(params)`
  - Usa Tavily
  - Extrai key findings
  - Gera summary

- [ ] Criar `server/src/agents/research/economic-indicators-searcher.js`
  - Tool: `searchEconomicIndicators(params)`
  - Busca Selic, IPCA, CDI em sites oficiais
  - Parser específico para BC Brasil

- [ ] Criar `server/src/agents/research/result-parser.js`
  - Funções de parsing e extração
  - `extractPrice(text)`, `extractKeyFindings(results)`

**5.3 - Analyst Agent**
- [ ] Criar `server/src/agents/analyst/analyst-agent.js`
  - Estender BaseAgent
  - Mapeamento de ações

- [ ] Criar `server/src/agents/analyst/investment-comparator.js`
  - Tool: `compareInvestments(params)`
  - Calcula scores (return, risk, liquidity)
  - Pondera por perfil do usuário
  - Gera pros/cons
  - Retorna recommendation

- [ ] Criar `server/src/agents/analyst/returns-calculator.js`
  - Tool: `calculateReturns(params)`
  - Juros compostos: `P * (1 + r)^t`
  - Cálculo de IR (tabela regressiva)
  - Retorno líquido e taxa efetiva

- [ ] Criar `server/src/agents/analyst/tax-calculator.js`
  - Função `getTaxRate(investmentType, months)`
  - Tabela regressiva: 22.5% (≤6m), 20% (≤12m), 17.5% (≤24m), 15% (>24m)
  - LCI/LCA: isento

- [ ] Criar `server/src/agents/analyst/scoring-engine.js`
  - Função `calculateScores(investment, profile)`
  - Scores: return (0-10), risk (0-10), liquidity (0-10)
  - Overall score ponderado

- [ ] Criar `server/src/agents/analyst/risk-analyzer.js`
  - Tool: `analyzeRisk(params)`
  - Cálculo de volatilidade
  - Sharpe ratio
  - Classificação: low/medium/high

#### Critérios de Validação
- ✅ Serper busca preços de ativos corretamente
- ✅ Tavily retorna análises profundas
- ✅ Research Agent extrai dados estruturados
- ✅ Analyst Agent compara investimentos corretamente
- ✅ Cálculos de IR estão corretos (validar com casos reais)
- ✅ Scores são consistentes e fazem sentido
- ✅ Custos de API são logados

#### Arquivos Gerados
- 15-18 arquivos novos
- Testes unitários para cálculos financeiros

---

### **ETAPA 6: Agentes Especializados - Strategist, Transaction & Validator**
**Duração Estimada:** 4-5 dias  
**Prioridade:** ALTA  
**Dependências:** Etapa 5 completa

#### Objetivo
Completar todos os agentes especializados restantes.

#### Tarefas

**6.1 - Strategist Agent**
- [ ] Criar `server/src/agents/strategist/strategist-agent.js`
  - Estender BaseAgent
  - Mapeamento de ações

- [ ] Criar `server/src/agents/strategist/portfolio-builder.js`
  - Tool: `buildPortfolio(params)`
  - Alocações base por perfil:
    - Conservative: 70% RF, 10% RV, 20% Emergência
    - Moderate: 50% RF, 30% RV, 20% Emergência
    - Aggressive: 30% RF, 60% RV, 10% Emergência
  - Ajustes por condições de mercado
  - Construir fixed_income, variable_income, emergency_fund
  - Calcular expected_return_range
  - Gerar action_plan

- [ ] Criar `server/src/agents/strategist/allocation-recommender.js`
  - Tool: `recommendAllocation(params)`
  - Recomenda como alocar valor específico
  - Considera purpose (emergency_fund, investment, retirement)
  - Considera timeframe (short, medium, long)

- [ ] Criar `server/src/agents/strategist/financial-planner.js`
  - Tool: `createFinancialPlan(params)`
  - Calcula PMT (pagamento mensal necessário)
  - Fórmula: `PMT = FV / (((1+r)^n - 1) / r)`
  - Gera milestones anuais
  - Verifica se objetivo é atingível
  - Sugere ajustes se necessário

- [ ] Criar `server/src/agents/strategist/rebalancing-advisor.js`
  - Compara portfólio atual vs recomendado
  - Sugere ajustes (aumentar X%, reduzir Y%)

**6.2 - Transaction Agent**
> **MUDANÇA CRÍTICA**: Este agente EXECUTA transações imediatamente (não pede confirmação). Usuário tem botão de DESFAZER.

- [ ] Criar `server/src/agents/transaction/transaction-agent.js`
  - Estender BaseAgent
  - **NOVO COMPORTAMENTO**: EXECUTA transações imediatamente após parsing e validação
  - Workflow:
    1. Parse da intenção
    2. Validação completa
    3. Detecção de duplicatas
    4. **EXECUÇÃO com transação ACID**
    5. Registro em audit_log para permitir undo
    6. Resposta ao usuário com confirmação e opção de desfazer

- [ ] Criar `server/src/agents/transaction/intent-parser.js`
  - Tool: `parseTransactionIntent(params)`
  - Detecta tipo: keywords ["recebi"] → income, ["paguei"] → expense
  - Extrai valor: regex `R\$\s*(\d+(?:\.\d{3})*(?:,\d{2})?)`
  - Extrai data: detecta "hoje", "ontem" ou padrões DD/MM
  - Extrai descrição: remove valores e datas do texto

- [ ] Criar `server/src/agents/transaction/transaction-validator.js`
  - Tool: `validateTransaction(params)`
  - Validações:
    - Valor > 0
    - Data não futura (se confirmed)
    - Saldo suficiente (se expense)
  - Retorna: validation_errors, warnings
  - **Se houver erros críticos**: aborta execução e explica ao usuário

- [ ] Criar `server/src/agents/transaction/duplicate-detector.js`
  - Função `detectDuplicates(transaction, recentTransactions)`
  - Janela de 7 dias
  - Verifica: mesmo valor (±0.01), mesmo tipo, data próxima
  - **Se detectar duplicata**: alerta usuário mas EXECUTA se usuário não cancelou em 2 segundos

- [ ] Criar `server/src/agents/transaction/category-suggester.js`
  - Função `suggestCategory(description, userHistory)`
  - Baseado em histórico do usuário
  - Keywords comuns: "mercado" → alimentação, "uber" → transporte

- [ ] Criar `server/src/agents/transaction/transaction-executor.js`
  - Função `executeTransaction(transaction)`
  - **EXECUÇÃO COM ACID**:
    1. Inicia sessão e transação MongoDB
    2. Insere registro em `transactions` collection
    3. Atualiza saldo em `accounts` collection
    4. Registra em `audit_log` com before_state e after_state
    5. Commit da transação
    6. Retorna transaction_id para possível undo

- [ ] Criar `server/src/agents/transaction/undo-manager.js`
  - Função `undoTransaction(transactionId, userId)`
  - **VALIDAÇÕES**:
    - Transação existe e pertence ao usuário
    - Transação ainda dentro da janela de undo (24 horas)
    - Status da transação é 'confirmed'
  - **REVERSÃO COM ACID**:
    1. Inicia sessão e transação MongoDB
    2. Marca transação original como 'cancelled'
    3. Reverte saldo da conta
    4. Registra undo no audit_log
    5. Commit da transação
  - Retorna: success, reverted_transaction

- [ ] Criar endpoint `POST /api/transactions/undo/:transactionId`
  - Permite usuário desfazer transação via botão no frontend
  - Chama undo-manager.undoTransaction()
  - Retorna confirmação de reversão

**6.3 - Validator Agent**
- [ ] Criar `server/src/agents/validator/validator-agent.js`
  - Estender BaseAgent
  - **CRÍTICO**: Chamado SEMPRE antes de responder usuário

- [ ] Criar `server/src/agents/validator/risk-profile-validator.js`
  - Função `validateRiskProfile(response, profile)`
  - Valida limites:
    - Conservative: max 30% RV, min 6 meses emergência
    - Moderate: max 60% RV, min 3 meses emergência
    - Aggressive: max 90% RV, min 3 meses emergência
  - Retorna: violations, warnings

- [ ] Criar `server/src/agents/validator/compliance-checker.js`
  - Função `validateCompliance(response)`
  - Regras:
    - Nunca recomendar produto sem FGC para emergência
    - Sempre mencionar IR em produtos tributados
    - Alertar sobre falta de liquidez
    - Mencionar risco de perda em RV

- [ ] Criar `server/src/agents/validator/disclaimer-generator.js`
  - Gera disclaimers obrigatórios
  - Ex: "Investimentos em renda variável envolvem risco..."

- [ ] Criar `server/src/agents/validator/response-adjuster.js`
  - Ajusta recomendações não conformes
  - Reduz alocação em RV se excedeu limite
  - Aumenta emergência se abaixo do mínimo

- [ ] Criar `server/src/agents/validator/confidence-calculator.js`
  - Calcula score 0-1
  - Penaliza por violations (-0.2 cada)
  - Penaliza por warnings (-0.05 cada)

#### Critérios de Validação
- ✅ Strategist constrói portfólios balanceados
- ✅ Financial planner calcula PMT corretamente
- ✅ Transaction Agent parse linguagem natural com >80% acurácia
- ✅ **Transaction Agent EXECUTA transações com sucesso**
- ✅ **Undo Manager reverte transações corretamente (testar rollback ACID)**
- ✅ Detector de duplicatas funciona (testar casos reais)
- ✅ **Transações executadas aparecem imediatamente no saldo**
- ✅ Validator detecta violações de compliance
- ✅ Validator ajusta recomendações não conformes
- ✅ Disclaimers são adicionados automaticamente

#### Arquivos Gerados
- **18-20 arquivos novos** (2 arquivos extras: transaction-executor.js e undo-manager.js)
- Testes unitários para cada agente
- **Teste especial de ACID para undo de transações**
- Testes unitários para cada agente

---

### **ETAPA 7: Interface de Chat & Dinamização Completa do Frontend**
**Duração Estimada:** 4-5 dias  
**Prioridade:** ALTA  
**Dependências:** Etapas 4, 5 e 6 completas

#### Objetivo
Criar interface de chat com agentes e finalizar dinamização de todas as telas.

#### Tarefas

**7.1 - API de Chat**
- [ ] Criar `server/src/api/routes/chat-routes.js`
  - POST /api/chat - Enviar query para orquestrador
    - Body: { userId, query, sessionId? }
    - Chama orchestrator.processQuery()
    - Retorna resposta completa
  
  - GET /api/chat/stream/:sessionId - Stream SSE
    - Server-Sent Events
    - Envia eventos em tempo real durante execução
    - Formato: `data: {"event": "node:start", "detail": "..."}\n\n`
  
  - GET /api/chat/history/:userId - Histórico de conversas
    - Retorna últimas 50 queries e respostas
  
  - DELETE /api/chat/session/:sessionId - Limpar sessão
    - Limpa cache do ToolContext

- [ ] Atualizar `server/server.js`
  - Registrar chat-routes
  - Middleware CORS para SSE

**7.2 - Interface de Chat no Frontend**
- [ ] Criar `client/html/chat.html` (ou modal em dash.html)
  - Interface de chat estilo ChatGPT
  - Input de mensagem
  - Área de mensagens (scroll automático)
  - Indicador de "Agente está pensando..."
  - Exibição de eventos de streaming

- [ ] Criar `client/js/chat.js`
  - Função `sendMessage(query)`:
    - POST para /api/chat
    - Exibe loading
    - Renderiza resposta
  
  - Função `connectStream(sessionId)`:
    - EventSource para /api/chat/stream/:sessionId
    - Listener de eventos:
      - node:start → "🤔 Orquestrador planejando..."
      - tool:call → "🔧 Consultando dados..."
      - data:partial → "📊 Dados parciais: ..."
      - final:answer → Renderizar resposta final
  
  - Função `renderMessage(message, isUser)`:
    - Renderiza mensagem do usuário ou agente
    - Suporte a Markdown na resposta
    - Código formatado (syntax highlighting)
  
  - Função `showThinking(details)`:
    - Exibe passos do raciocínio do agente
    - Pode ser colapsável/expandível

**7.3 - Dinamização Completa - Perfil (`client/html/profile.html`)**
- [ ] Criar `server/src/api/routes/profile-routes.js`
  - GET /api/profile/:userId - Perfil completo
  - PUT /api/profile/:userId - Atualizar perfil
  - PUT /api/profile/:userId/risk - Atualizar perfil de risco

- [ ] Atualizar `client/js/profile.js`
  - Função `loadProfile()` - busca dados do perfil
  - Função `updateProfile(data)` - atualiza perfil
  - Função `updateRiskProfile(risk)` - atualiza perfil de risco
  - Renderização dinâmica de formulário

- [ ] Identificar dados estáticos em profile.html:
  - Nome, email, telefone do usuário
  - Perfil de risco atual
  - Objetivos financeiros
  - Situação financeira (renda, despesas)

**7.4 - Adicionar Chat em Todas as Telas**
- [ ] Adicionar botão flutuante de chat em:
  - dash.html
  - invest.html
  - profile.html

- [ ] Modal de chat compartilhado:
  - Pode ser aberto de qualquer tela
  - Mantém contexto da sessão
  - Histórico persistente

**7.5 - Melhorias de UX**
- [ ] Loading states em todas as telas
- [ ] Mensagens de erro user-friendly
- [ ] Toasts para notificações
- [ ] Skeleton screens durante carregamento
- [ ] Empty states (quando não há dados)

#### Critérios de Validação
- ✅ Chat envia queries e recebe respostas
- ✅ Streaming exibe eventos em tempo real
- ✅ Interface responsiva e intuitiva
- ✅ Todas as telas usam dados dinâmicos
- ✅ Perfil pode ser editado
- ✅ Loading e error states funcionam
- ✅ Chat pode ser aberto de qualquer tela

#### Arquivos Modificados/Criados
- 4 arquivos de rotas novos
- 1 HTML novo (chat) ou modal
- 4 JS atualizados/criados
- CSS para estilização do chat

---

### **ETAPA 8: Testes, Logging & Deploy**
**Duração Estimada:** 3-4 dias  
**Prioridade:** MÉDIA  
**Dependências:** Todas as etapas anteriores completas

#### Objetivo
Garantir qualidade, monitoramento e preparar para produção.

#### Tarefas

**8.1 - Sistema de Logging Completo**
- [ ] Configurar Winston ou Pino
  - Diferentes níveis: debug, info, warn, error
  - Diferentes arquivos: app.log, agents.log, errors.log, costs.log

- [ ] Criar `server/src/utils/cost-tracker.js`
  - Rastrear custos de:
    - Chamadas LLM (tokens × preço)
    - Chamadas Serper (US$ 0.01/busca)
    - Chamadas Tavily (US$ 0.05/busca)
  - Exportar relatório diário/mensal

- [ ] Criar `server/src/utils/performance-monitor.js`
  - Medir tempo de execução de cada agente
  - Medir tempo total de queries
  - Identificar gargalos

- [ ] Implementar logging em todos os agentes
  - Log de entrada (request recebido)
  - Log de saída (response enviado)
  - Log de erros (stack trace completo)

**8.2 - Testes**
- [ ] Testes Unitários (Jest ou Mocha):
  - ToolContext (set/get/TTL)
  - Data Agent (queries)
  - Analyst Agent (cálculos financeiros)
  - Transaction Parser (NLP)
  - Validators
  - Cobertura mínima: 70%

- [ ] Testes de Integração:
  - Fluxo completo: query → orquestrador → agentes → resposta
  - Testar queries de cada tipo de complexidade
  - Testar paralelização de ações
  - Testar validação obrigatória

- [ ] Testes End-to-End (Cypress ou Playwright):
  - Login → Dashboard → Ver saldo
  - Enviar query no chat → Receber resposta
  - Criar transação → Validar no banco
  - Atualizar perfil → Validar mudanças

**8.3 - Documentação**
- [ ] Criar `docs/API_REFERENCE.md`
  - Documentar todos os endpoints
  - Exemplos de requisições/respostas
  - Códigos de erro

- [ ] Criar `docs/AGENT_GUIDE.md`
  - Como criar um novo agente
  - Contratos de comunicação
  - Boas práticas

- [ ] Criar `docs/DEPLOYMENT.md`
  - Instruções de deploy
  - Variáveis de ambiente
  - Requisitos de sistema

- [ ] Atualizar README.md principal
  - Visão geral do sistema
  - Como rodar localmente
  - Stack tecnológico

**8.4 - Preparação para Produção**
- [ ] Criar `.env.example` com todas as variáveis necessárias

- [ ] Criar `server/src/utils/health-check.js`
  - Endpoint GET /health
  - Verifica: MongoDB conectado, APIs externas acessíveis

- [ ] Implementar rate limiting
  - Limitar requisições por usuário
  - Prevenir abuso de APIs caras (Tavily)

- [ ] Implementar retry logic
  - Retry em falhas de APIs externas
  - Exponential backoff

- [ ] Segurança:
  - Validação de inputs em todas as rotas
  - Sanitização de queries MongoDB
  - CORS configurado corretamente
  - Headers de segurança (Helmet.js)

- [ ] Scripts úteis em package.json:
  - `npm run dev` - Desenvolvimento
  - `npm run start` - Produção
  - `npm run test` - Testes
  - `npm run db:init` - Inicializar banco
  - `npm run db:seed` - Popular dados de teste

**8.5 - Monitoramento**
- [ ] Configurar logging estruturado (JSON)
- [ ] Dashboard de custos (opcional, pode ser script)
- [ ] Alertas de erro (email ou webhook)

#### Critérios de Validação
- ✅ Testes unitários passam (cobertura >70%)
- ✅ Testes de integração passam
- ✅ Testes E2E passam
- ✅ Logs são gerados corretamente
- ✅ Custos são rastreados
- ✅ Performance é aceitável (<5s para queries complexas)
- ✅ Documentação está completa
- ✅ Sistema roda em produção sem erros

#### Arquivos Gerados
- 50+ arquivos de teste
- 4 documentos MD
- Scripts de utilidade

---

## 📊 Resumo de Esforço

| Etapa | Duração | Prioridade | Arquivos Criados | Complexidade |
|-------|---------|------------|------------------|--------------|
| 1. Fundação + Memória | **5-7 dias** | CRÍTICA | **45-50** | **Muito Alta** |
| 2. Agentes Base | 3-4 dias | ALTA | 13-15 | Média |
| 3. Dinamização Frontend Parte 1 | 2-3 dias | ALTA | 6-8 | Baixa |
| 4. Orquestrador | 5-6 dias | CRÍTICA | 6 | Muito Alta |
| 5. Research & Analyst | 4-5 dias | ALTA | 15-18 | Alta |
| 6. Strategist, Transaction, Validator | 4-5 dias | ALTA | **18-20** | Alta |
| 7. Chat & Dinamização Completa | 4-5 dias | ALTA | 10-12 | Média |
| 8. Testes & Deploy | 3-4 dias | MÉDIA | 50+ | Média |

**TOTAL ESTIMADO: 30-39 dias (~6-8 semanas)**

> ⚠️ **Nota**: A Etapa 1 foi estendida de 3-4 para 5-7 dias devido à adição do sistema completo de memória cognitiva (22 arquivos novos). A Etapa 6 ganhou 2 arquivos extras (transaction-executor e undo-manager).

---

## 🔄 Ordem Recomendada de Execução

1. **Semana 1-2**: Etapas 1 e 2 (Fundação sólida + Sistema de Memória Cognitiva)
2. **Semana 2-3**: Etapa 3 (Dinamizar frontend básico)
3. **Semana 3-4**: Etapa 4 (Orquestrador - peça central)
4. **Semana 4-5**: Etapa 5 (Research & Analyst)
5. **Semana 5-6**: Etapa 6 (Demais agentes + Execução de Transações)
6. **Semana 6-7**: Etapa 7 (Chat e UX final)
7. **Semana 7-8**: Etapa 8 (Testes e preparação para produção)

---

## ⚠️ Riscos e Mitigações

### Risco 1: APIs Externas Instáveis
**Mitigação**: Implementar retry logic, fallbacks e mocks para desenvolvimento/testes

### Risco 2: Custos de LLM/APIs Altos
**Mitigação**: Cache agressivo, monitoramento de custos, limites por usuário

### Risco 3: Complexidade do Orquestrador
**Mitigação**: Começar simples (sem paralelização), adicionar features incrementalmente

### Risco 4: Performance de Queries Complexas
**Mitigação**: Otimizar queries MongoDB, implementar caching, limitar ciclos

### Risco 5: Dados Estáticos no Frontend
**Mitigação**: Etapa 3 e 7 focam especificamente nisso com checkpoints claros

---

## 🎯 Marcos (Milestones)

### Milestone 1: "Fundação Sólida" (Fim da Etapa 2)
- MongoDB funcional com validações
- Data Agent respondendo
- ToolContext operacional
- **Critério**: Conseguir buscar saldo de usuário via Data Agent

### Milestone 2: "Dados Dinâmicos" (Fim da Etapa 3)
- Dashboard carrega dados reais
- Transações exibidas do banco
- **Critério**: Dashboard sem nenhum dado fixo

### Milestone 3: "Cérebro Funcional" (Fim da Etapa 4)
- Orquestrador coordena agentes
- Ciclos ReAct funcionando
- Streaming de eventos
- **Critério**: Query simples respondida pelo orquestrador

### Milestone 4: "Inteligência Completa" (Fim da Etapa 6)
- Todos os agentes implementados
- Queries complexas funcionando
- **Critério**: Orquestrador responde "Compare CDB vs Tesouro Direto"

### Milestone 5: "Pronto para Usuário" (Fim da Etapa 7)
- Chat funcional
- Todas as telas dinâmicas
- UX polida
- **Critério**: Usuário consegue usar sistema completo sem bugs críticos

### Milestone 6: "Production Ready" (Fim da Etapa 8)
- Testes passando
- Logs funcionando
- Documentação completa
- **Critério**: Sistema pode ser deployado em produção

---

## 📝 Checklist Geral de Qualidade

Antes de considerar cada etapa completa, validar:

- [ ] Código segue padrões do projeto
- [ ] Sem console.log em produção
- [ ] Tratamento de erros em todas as funções
- [ ] Validação de inputs
- [ ] Logs apropriados
- [ ] Testes unitários criados
- [ ] README da pasta atualizado (se aplicável)
- [ ] Sem dados sensíveis hardcoded
- [ ] Performance aceitável
- [ ] Sem memory leaks

---

## 🚨 Observações Críticas Identificadas na Revisão

### ✅ Consistências Validadas:
1. Estrutura de pastas coerente com arquitetura descrita
2. Ordem de etapas respeita dependências
3. Separação de responsabilidades clara
4. Foco em manutenibilidade alcançado

### ⚠️ Atenção Especial Necessária:

**1. Dados Estáticos → Dinâmicos**
- **Onde**: Etapas 3 e 7
- **Ação**: Mapear TODOS os componentes com dados fixos antes de iniciar implementação
- **Validação**: Fazer checklist de cada elemento HTML que exibe dados

**2. serveragent.js vs server.js**
- **Decisão Arquitetural**: Dois servidores separados ou unificar?
- **Recomendação Original**: Separados (portas diferentes)
- **Alternativa**: Unificar em server.js com rotas separadas (`/api/agent/*`)
- **Decisão Final**: Fica a seu critério. Se unificar, ajustar Etapa 2

**3. MongoDB Transações ACID**
- **Requer**: MongoDB Replica Set (não funciona em standalone)
- **Ação**: Configurar replica set mesmo em dev (ou usar MongoDB Atlas)
- **Impacto**: Etapa 1 pode demorar mais se precisar configurar replica set local

**4. Custos de APIs**
- **Tavily**: US$ 0.05/busca - CARO
- **Serper**: US$ 0.01/busca - Barato
- **OpenAI GPT-4o**: US$ 0.03/1K tokens - Moderado
- **Ação**: Implementar limites por usuário desde o início (Etapa 2)
- **Monitoramento**: Criar dashboard de custos na Etapa 8

**5. Streaming SSE**
- **Atenção**: Alguns proxies/loadbalancers podem buffering SSE
- **Teste**: Validar funcionamento em produção real
- **Fallback**: Implementar polling como backup na Etapa 7

**6. Performance de Queries Complexas**
- **Meta**: <5s para queries de 10-15 ciclos
- **Risco**: Pode ultrapassar se muitas chamadas de API
- **Mitigação**: Paralelização (Etapa 4) + Cache agressivo (Etapa 1)

---

## 🎓 Próximos Passos Recomendados

1. **Revisar este documento** com a equipe/stakeholders
2. **Decidir sobre serveragent.js** separado ou unificado
3. **Configurar MongoDB** com replica set
4. **Obter API keys**: OpenAI, Tavily, Serper
5. **Criar projeto no GitHub** e estrutura inicial
6. **Iniciar Etapa 1** após aprovação deste plano

---

## 📚 Referências e Recursos

- **Documentação MongoDB Transactions**: https://docs.mongodb.com/manual/core/transactions/
- **Server-Sent Events**: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- **ReAct Pattern**: Paper original "ReAct: Synergizing Reasoning and Acting in Language Models"
- **OpenAI API**: https://platform.openai.com/docs
- **Tavily API**: https://tavily.com/docs
- **Serper API**: https://serper.dev/docs

---

**FIM DO PLANO DE IMPLEMENTAÇÃO**

_Este documento foi revisado 2 vezes conforme solicitado. Qualquer inconsistência encontrada está documentada na seção "Observações Críticas"._
