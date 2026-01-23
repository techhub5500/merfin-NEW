# Sistema de Streaming - Experiência de IA Premium

---

## 1. VISÃO GERAL

### O que é o Sistema de Streaming?

O sistema de streaming é responsável por comunicar **em tempo real** o progresso do processamento dos agentes para o frontend. Em vez de o usuário esperar em silêncio por 30-60 segundos, ele vê o "pensamento" do agente acontecendo, criando uma experiência de **inteligência artificial perceptível**.

### Filosofia de Experiência do Usuário

Este sistema foi projetado com três princípios fundamentais:

1. **Transparência Inteligente:** O usuário vê o que o agente está fazendo, mas de forma que transmita competência, não complexidade técnica.

2. **Ritmo Humano:** Eventos não aparecem instantaneamente - são dosados com cadência que remete a pensamento deliberado.

3. **Linguagem de Intenção:** Não mostramos "o que o sistema é" (ex: "API_v2"), mas "o que o agente está fazendo pelo usuário".

---

## 2. ARQUITETURA DO SISTEMA

### Arquivos e Responsabilidades

```
server/src/core/streaming/
├── README.md              ← Este documento
├── event-emitter.js       ← Hub central de eventos (MANTER - ajustes menores)
├── event-types.js         ← Tipos de eventos (SUBSTITUIR COMPLETAMENTE)
├── stream-formatter.js    ← Formatador SSE (MANTER - adicionar features)
├── pacing-engine.js       ← NOVO: Motor de ritmo/cadência
├── narrative-builder.js   ← NOVO: Gerador de mensagens narrativas
└── stream-orchestrator.js ← NOVO: Orquestrador de eventos de streaming
```

### Fluxo de Eventos

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Agente    │───▶│ Stream           │───▶│ Pacing Engine   │
│             │    │ Orchestrator     │    │                 │
└─────────────┘    └──────────────────┘    └─────────────────┘
                            │                       │
                            ▼                       ▼
                   ┌──────────────────┐    ┌─────────────────┐
                   │ Narrative        │    │ Delay/Buffer    │
                   │ Builder          │    │                 │
                   └──────────────────┘    └─────────────────┘
                            │                       │
                            └───────────┬───────────┘
                                        ▼
                            ┌──────────────────┐
                            │ Event Emitter    │
                            │ (SSE Output)     │
                            └──────────────────┘
                                        │
                                        ▼
                            ┌──────────────────┐
                            │ Frontend         │
                            └──────────────────┘
```

---

## 3. TIPOS DE EVENTOS (REVISÃO COMPLETA)

### Eventos Atuais vs. Novos Eventos

| Evento Atual | Status | Novo Evento | Descrição |
|--------------|--------|-------------|-----------|
| `node:start` | 🔄 RENOMEAR | `phase:start` | Início de fase do processo |
| `tool:call` | 🔄 EXPANDIR | `action:*` | Família de ações específicas |
| `data:partial` | 🔄 EXPANDIR | `discovery:*` | Descobertas durante análise |
| `thought:reasoning` | ✅ MANTER | `thought:reasoning` | Pensamento em linguagem natural |
| `final:answer` | ✅ MANTER | `final:answer` | Resposta final |
| - | 🆕 NOVO | `progress:indicator` | Status de progresso visual |
| - | 🆕 NOVO | `status:parallel` | Ações paralelas em andamento |
| - | 🆕 NOVO | `insight:teaser` | Prévia de descoberta interessante |
| - | 🆕 NOVO | `redirect:adaptive` | Mudança de rota baseada em descoberta |

### Nova Estrutura de EVENT_TYPES

```javascript
// event-types.js (NOVA VERSÃO)

const EVENT_TYPES = {
  // === FASES DO PROCESSO ===
  PHASE_START: 'phase:start',           // Início de uma fase
  PHASE_COMPLETE: 'phase:complete',     // Conclusão de uma fase
  
  // === AÇÕES ESPECÍFICAS ===
  ACTION_ANALYZING: 'action:analyzing',     // Analisando dados
  ACTION_COMPARING: 'action:comparing',     // Comparando opções
  ACTION_CALCULATING: 'action:calculating', // Calculando valores
  ACTION_RESEARCHING: 'action:researching', // Pesquisando informações
  ACTION_SIMULATING: 'action:simulating',   // Simulando cenários
  ACTION_VALIDATING: 'action:validating',   // Validando dados
  ACTION_AUDITING: 'action:auditing',       // Auditando informações
  ACTION_OPTIMIZING: 'action:optimizing',   // Otimizando estratégia
  
  // === DESCOBERTAS ===
  DISCOVERY_DATA: 'discovery:data',         // Dado relevante encontrado
  DISCOVERY_PATTERN: 'discovery:pattern',   // Padrão identificado
  DISCOVERY_OPPORTUNITY: 'discovery:opportunity', // Oportunidade encontrada
  DISCOVERY_RISK: 'discovery:risk',         // Risco identificado
  
  // === PROGRESSO ===
  PROGRESS_UPDATE: 'progress:update',       // Atualização de progresso
  PROGRESS_MILESTONE: 'progress:milestone', // Marco importante atingido
  
  // === PENSAMENTO ===
  THOUGHT_REASONING: 'thought:reasoning',   // Raciocínio em linguagem natural
  THOUGHT_DECISION: 'thought:decision',     // Decisão tomada
  THOUGHT_INSIGHT: 'thought:insight',       // Insight obtido
  
  // === ESTADOS PARALELOS ===
  PARALLEL_START: 'parallel:start',         // Início de operações paralelas
  PARALLEL_UPDATE: 'parallel:update',       // Atualização de operação paralela
  PARALLEL_COMPLETE: 'parallel:complete',   // Operação paralela concluída
  
  // === ADAPTAÇÃO ===
  ADAPTIVE_REDIRECT: 'adaptive:redirect',   // Mudança de rota
  ADAPTIVE_DEEPEN: 'adaptive:deepen',       // Aprofundando análise
  ADAPTIVE_SKIP: 'adaptive:skip',           // Pulando etapa desnecessária
  
  // === TEASERS ===
  TEASER_PREVIEW: 'teaser:preview',         // Prévia de descoberta
  TEASER_HIGHLIGHT: 'teaser:highlight',     // Destaque importante
  
  // === RESPOSTA ===
  FINAL_ANSWER: 'final:answer',             // Resposta final completa
  FINAL_SUMMARY: 'final:summary'            // Resumo antes da resposta
};

// Agrupamentos para facilitar uso
const EVENT_GROUPS = {
  ACTIONS: [
    'action:analyzing', 'action:comparing', 'action:calculating',
    'action:researching', 'action:simulating', 'action:validating',
    'action:auditing', 'action:optimizing'
  ],
  DISCOVERIES: [
    'discovery:data', 'discovery:pattern', 
    'discovery:opportunity', 'discovery:risk'
  ],
  PARALLEL: [
    'parallel:start', 'parallel:update', 'parallel:complete'
  ]
};

module.exports = { EVENT_TYPES, EVENT_GROUPS };
```

---

## 4. LINGUAGEM DE INTENÇÃO

### Princípio Fundamental

**NUNCA mostre o que o sistema é. SEMPRE mostre o que o agente faz pelo usuário.**

### Exemplos de Transformação

| ❌ Técnico (Evitar) | ✅ Intencional (Usar) |
|---------------------|----------------------|
| "Buscando dados históricos" | "Analisando seu histórico de gastos dos últimos 6 meses para identificar padrões" |
| "Chamando API Brapi" | "Consultando cotação atualizada do mercado" |
| "Calculando ROI" | "Simulando diferentes cenários de rentabilidade para o seu perfil" |
| "Timeout na requisição" | "Buscando fonte alternativa de dados para garantir precisão" |
| "Executando query MongoDB" | "Verificando seu histórico de investimentos" |
| "Processando JSON" | "Organizando as informações encontradas" |

### Vocabulário Premium para Finanças

**Verbos de Alto Valor:**
- Auditar, Escanear, Projetar, Mitigar, Otimizar, Alocar, Ponderar
- Avaliar, Analisar, Simular, Comparar, Validar, Identificar
- Mapear, Estruturar, Diagnosticar, Recomendar

**Exemplos de Uso:**
- "Ponderando o impacto tributário antes de sugerir a realocação"
- "Auditando a composição atual do seu portfólio"
- "Mitigando riscos identificados na sua estratégia"
- "Projetando rentabilidade para os próximos 12 meses"

---

## 5. MOTOR DE RITMO (PACING ENGINE)

### Propósito

Evitar que eventos apareçam muito rápido (parecem fake/script) ou muito devagar (frustram o usuário).

### Regras de Cadência

```javascript
// pacing-engine.js

const PACING_RULES = {
  // Delay mínimo entre eventos do mesmo tipo
  MIN_DELAY_SAME_TYPE: 800,     // 0.8 segundos
  
  // Delay mínimo entre eventos diferentes
  MIN_DELAY_DIFFERENT: 400,     // 0.4 segundos
  
  // Delay máximo antes de parecer travado
  MAX_SILENCE: 5000,            // 5 segundos
  
  // Delays específicos por tipo de evento
  DELAYS: {
    'phase:start': 600,
    'action:analyzing': 1200,
    'action:calculating': 1500,
    'action:simulating': 2000,
    'discovery:opportunity': 800,
    'discovery:risk': 800,
    'thought:reasoning': 1000,
    'teaser:preview': 500,
    'final:answer': 0  // Imediato
  },
  
  // Delays para criar sensação de "trabalho pesado"
  HEAVY_WORK_EVENTS: [
    'action:simulating',
    'action:analyzing', 
    'action:calculating'
  ],
  HEAVY_WORK_DELAY: 2000,
  
  // Buffer de eventos para suavização
  BUFFER_SIZE: 3
};

class PacingEngine {
  constructor() {
    this.lastEventTime = null;
    this.lastEventType = null;
    this.eventBuffer = [];
  }

  async queueEvent(event) {
    this.eventBuffer.push(event);
    await this.processBuffer();
  }

  async processBuffer() {
    if (this.eventBuffer.length === 0) return;
    
    const event = this.eventBuffer.shift();
    const delay = this.calculateDelay(event);
    
    await this.wait(delay);
    
    this.lastEventTime = Date.now();
    this.lastEventType = event.type;
    
    return event;
  }

  calculateDelay(event) {
    const now = Date.now();
    
    // Se é o primeiro evento, delay mínimo
    if (!this.lastEventTime) {
      return PACING_RULES.DELAYS[event.type] || 400;
    }
    
    const timeSinceLast = now - this.lastEventTime;
    
    // Se passou muito tempo, evento imediato
    if (timeSinceLast > PACING_RULES.MAX_SILENCE) {
      return 0;
    }
    
    // Calcular delay base
    let baseDelay = PACING_RULES.DELAYS[event.type] || 600;
    
    // Mesmo tipo = delay maior (evita parecer script)
    if (event.type === this.lastEventType) {
      baseDelay = Math.max(baseDelay, PACING_RULES.MIN_DELAY_SAME_TYPE);
    }
    
    // Trabalho pesado = delay extra
    if (PACING_RULES.HEAVY_WORK_EVENTS.includes(event.type)) {
      baseDelay = Math.max(baseDelay, PACING_RULES.HEAVY_WORK_DELAY);
    }
    
    // Subtrair tempo já esperado
    const effectiveDelay = Math.max(0, baseDelay - timeSinceLast);
    
    return effectiveDelay;
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { PacingEngine, PACING_RULES };
```

---

## 6. CONSTRUTOR DE NARRATIVAS

### Propósito

Transformar eventos técnicos em mensagens narrativas que façam o usuário sentir que está sendo atendido por um consultor premium.

### Templates de Narrativa

```javascript
// narrative-builder.js

const NARRATIVE_TEMPLATES = {
  // === FASES ===
  'phase:start': {
    'planejamento': 'Iniciando análise estratégica do seu cenário financeiro...',
    'pesquisa': 'Consultando fontes de dados atualizadas...',
    'simulacao': 'Preparando simulações personalizadas para seu perfil...',
    'consolidacao': 'Organizando os insights para sua análise...'
  },
  
  // === AÇÕES ===
  'action:analyzing': [
    'Analisando {contexto} para identificar padrões relevantes...',
    'Examinando detalhadamente {contexto}...',
    'Avaliando {contexto} com atenção aos detalhes...'
  ],
  
  'action:comparing': [
    'Comparando {item_a} com {item_b} para encontrar a melhor opção...',
    'Avaliando as diferenças entre {item_a} e {item_b}...'
  ],
  
  'action:calculating': [
    'Calculando projeções baseadas no seu histórico...',
    'Processando os números para sua simulação...',
    'Realizando cálculos de rentabilidade...'
  ],
  
  'action:researching': [
    'Pesquisando informações atualizadas sobre {tema}...',
    'Consultando dados de mercado sobre {tema}...',
    'Buscando as últimas informações sobre {tema}...'
  ],
  
  'action:simulating': [
    'Simulando cenário de {descricao}...',
    'Projetando resultados para {descricao}...',
    'Modelando diferentes possibilidades de {descricao}...'
  ],
  
  'action:validating': [
    'Validando a consistência dos dados obtidos...',
    'Verificando a precisão das informações...',
    'Confirmando os valores calculados...'
  ],
  
  'action:auditing': [
    'Auditando a composição atual de {item}...',
    'Revisando detalhadamente {item}...'
  ],
  
  'action:optimizing': [
    'Otimizando a estratégia para maximizar seus resultados...',
    'Ajustando a alocação para seu perfil de risco...'
  ],
  
  // === DESCOBERTAS ===
  'discovery:data': [
    '✓ {dado}',
    'Identificado: {dado}'
  ],
  
  'discovery:pattern': [
    '📊 Padrão identificado: {descricao}',
    'Notei uma tendência: {descricao}'
  ],
  
  'discovery:opportunity': [
    '💡 Encontrei uma oportunidade interessante: {descricao}',
    '✨ Oportunidade identificada: {descricao}'
  ],
  
  'discovery:risk': [
    '⚠️ Atenção: {descricao}',
    '🔍 Ponto de atenção: {descricao}'
  ],
  
  // === ADAPTAÇÃO ===
  'adaptive:redirect': [
    'Notei algo importante - vou aprofundar a análise de {area}...',
    'Com base no que encontrei, estou explorando melhor {area}...'
  ],
  
  'adaptive:deepen': [
    'Este ponto merece uma análise mais detalhada...',
    'Vou me aprofundar neste aspecto que parece relevante...'
  ],
  
  // === TEASERS ===
  'teaser:preview': [
    '👀 Encontrei algo interessante na sua {area}...',
    '🎯 Há um ponto importante sobre {area} que vou detalhar...'
  ],
  
  // === PARALELO ===
  'parallel:start': [
    'Realizando {count} verificações simultaneamente...'
  ],
  
  'parallel:update': {
    template: '[{status}] {descricao}',
    statuses: {
      'pending': '⏳',
      'running': '🔄',
      'done': '✅',
      'error': '❌'
    }
  }
};

class NarrativeBuilder {
  constructor() {
    this.contextCache = {};
  }

  build(eventType, payload = {}) {
    const templates = NARRATIVE_TEMPLATES[eventType];
    
    if (!templates) {
      return this.buildGeneric(eventType, payload);
    }
    
    // Se é objeto com subtipos
    if (typeof templates === 'object' && !Array.isArray(templates)) {
      const subtype = payload.subtype || Object.keys(templates)[0];
      return this.interpolate(templates[subtype], payload);
    }
    
    // Se é array, escolher aleatoriamente
    if (Array.isArray(templates)) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      return this.interpolate(template, payload);
    }
    
    return this.interpolate(templates, payload);
  }

  interpolate(template, data) {
    if (!template) return null;
    
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  buildGeneric(eventType, payload) {
    // Fallback para eventos não mapeados
    if (payload.message) {
      return payload.message;
    }
    return null;
  }

  // Construir mensagem de progresso paralelo
  buildParallelProgress(operations) {
    const lines = operations.map(op => {
      const status = NARRATIVE_TEMPLATES['parallel:update'].statuses[op.status];
      return `${status} ${op.descricao}`;
    });
    return lines.join('\n');
  }
}

module.exports = { NarrativeBuilder, NARRATIVE_TEMPLATES };
```

---

## 7. ORQUESTRADOR DE STREAMING

### Propósito

Coordenar o fluxo de eventos, aplicando pacing, narrativa e enviando ao frontend de forma otimizada.

```javascript
// stream-orchestrator.js

const { PacingEngine } = require('./pacing-engine');
const { NarrativeBuilder } = require('./narrative-builder');
const streaming = require('./event-emitter');
const { EVENT_TYPES } = require('./event-types');

class StreamOrchestrator {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.pacing = new PacingEngine();
    this.narrative = new NarrativeBuilder();
    this.eventHistory = [];
    this.isActive = true;
    this.parallelOperations = new Map();
  }

  // Método principal para emitir evento
  async emit(eventType, payload = {}) {
    if (!this.isActive) return;

    // Construir mensagem narrativa
    const message = this.narrative.build(eventType, payload);
    
    // Criar evento completo
    const event = {
      type: eventType,
      payload: {
        ...payload,
        message,
        timestamp: new Date().toISOString()
      }
    };
    
    // Aplicar pacing
    const pacedEvent = await this.pacing.queueEvent(event);
    
    // Registrar no histórico
    this.eventHistory.push(pacedEvent);
    
    // Emitir para o frontend
    streaming.emit(this.sessionId, pacedEvent.type, pacedEvent.payload);
    
    return pacedEvent;
  }

  // === MÉTODOS DE CONVENIÊNCIA ===

  // Início de fase
  async startPhase(phaseName, description) {
    await this.emit(EVENT_TYPES.PHASE_START, {
      phase: phaseName,
      subtype: phaseName,
      description
    });
  }

  // Ação em andamento
  async action(actionType, context = {}) {
    const eventType = `action:${actionType}`;
    await this.emit(eventType, context);
  }

  // Descoberta
  async discovery(discoveryType, data) {
    const eventType = `discovery:${discoveryType}`;
    await this.emit(eventType, data);
  }

  // Pensamento/raciocínio
  async thought(message) {
    await this.emit(EVENT_TYPES.THOUGHT_REASONING, { message });
  }

  // Teaser de descoberta interessante
  async teaser(message, area) {
    await this.emit(EVENT_TYPES.TEASER_PREVIEW, { message, area });
  }

  // Mudança de rota adaptativa
  async adaptiveRedirect(reason, newArea) {
    await this.emit(EVENT_TYPES.ADAPTIVE_REDIRECT, {
      reason,
      area: newArea
    });
  }

  // === OPERAÇÕES PARALELAS ===

  // Iniciar rastreamento de operações paralelas
  async startParallel(operations) {
    // Registrar operações
    operations.forEach((op, index) => {
      this.parallelOperations.set(op.id, {
        id: op.id,
        descricao: op.descricao,
        status: 'pending'
      });
    });

    await this.emit(EVENT_TYPES.PARALLEL_START, {
      count: operations.length,
      operations: Array.from(this.parallelOperations.values())
    });
  }

  // Atualizar status de operação paralela
  async updateParallel(operationId, status, extraData = {}) {
    if (this.parallelOperations.has(operationId)) {
      const op = this.parallelOperations.get(operationId);
      op.status = status;
      Object.assign(op, extraData);

      const operations = Array.from(this.parallelOperations.values());
      
      await this.emit(EVENT_TYPES.PARALLEL_UPDATE, {
        updated: operationId,
        operations,
        progress: this.narrative.buildParallelProgress(operations)
      });
    }
  }

  // Completar operação paralela
  async completeParallel(operationId, result = {}) {
    await this.updateParallel(operationId, 'done', result);

    // Verificar se todas completaram
    const allDone = Array.from(this.parallelOperations.values())
      .every(op => op.status === 'done' || op.status === 'error');

    if (allDone) {
      await this.emit(EVENT_TYPES.PARALLEL_COMPLETE, {
        operations: Array.from(this.parallelOperations.values())
      });
      this.parallelOperations.clear();
    }
  }

  // === PROGRESSO ===

  async updateProgress(current, total, description) {
    const percentage = Math.round((current / total) * 100);
    
    await this.emit(EVENT_TYPES.PROGRESS_UPDATE, {
      current,
      total,
      percentage,
      description
    });
  }

  async milestone(description) {
    await this.emit(EVENT_TYPES.PROGRESS_MILESTONE, {
      description,
      timestamp: new Date().toISOString()
    });
  }

  // === RESPOSTA FINAL ===

  async summary(points) {
    await this.emit(EVENT_TYPES.FINAL_SUMMARY, { points });
  }

  async finalAnswer(content) {
    this.isActive = false; // Para de processar novos eventos
    
    await this.emit(EVENT_TYPES.FINAL_ANSWER, {
      content,
      eventCount: this.eventHistory.length
    });
  }

  // === CLEANUP ===

  destroy() {
    this.isActive = false;
    this.eventHistory = [];
    this.parallelOperations.clear();
  }
}

module.exports = { StreamOrchestrator };
```

---

## 8. INTEGRAÇÃO COM AGENTES

### Como Agentes Usam o Sistema

```javascript
// Exemplo de uso em um Coordenador

const { StreamOrchestrator } = require('../../core/streaming/stream-orchestrator');

class CoordenadorInvestimentos {
  async run(request) {
    const stream = new StreamOrchestrator(request.session_id);
    
    try {
      // Fase 1: Planejamento
      await stream.startPhase('planejamento', 
        'Organizando a análise de investimento');
      
      await stream.thought(
        'Vou analisar os fundamentos da empresa e comparar com o setor...'
      );

      // Fase 2: Coleta de dados (paralela)
      await stream.startParallel([
        { id: 'cotacao', descricao: 'Verificando cotação atual' },
        { id: 'fundamentos', descricao: 'Analisando indicadores fundamentalistas' },
        { id: 'portfolio', descricao: 'Consultando seu portfólio atual' }
      ]);

      // Simular operações
      await stream.updateParallel('cotacao', 'running');
      const cotacao = await this.buscarCotacao();
      await stream.completeParallel('cotacao', { valor: cotacao.preco });

      await stream.updateParallel('fundamentos', 'running');
      const fundamentos = await this.buscarFundamentos();
      await stream.completeParallel('fundamentos');

      await stream.updateParallel('portfolio', 'running');
      const portfolio = await this.buscarPortfolio();
      await stream.completeParallel('portfolio');

      // Descoberta interessante
      await stream.teaser(
        'Encontrei um padrão interessante no P/L histórico...',
        'indicadores'
      );

      // Análise
      await stream.action('analyzing', {
        contexto: 'a relação preço/lucro comparada ao histórico'
      });

      // Descoberta de oportunidade
      await stream.discovery('opportunity', {
        descricao: 'P/L atual 15% abaixo da média histórica'
      });

      // Simulação
      await stream.action('simulating', {
        descricao: 'um aporte de R$ 5.000'
      });

      await stream.thought(
        'Com base na análise, vou estruturar uma recomendação personalizada...'
      );

      // Milestone
      await stream.milestone('Análise completa - preparando recomendação');

      // Resposta final
      await stream.finalAnswer({
        recomendacao: '...',
        dados: fundamentos,
        simulacao: '...'
      });

    } catch (error) {
      await stream.emit('error', { message: error.message });
    } finally {
      stream.destroy();
    }
  }
}
```

---

## 9. HIERARQUIA VISUAL NO FRONTEND

### Recomendações de Exibição

O frontend deve exibir eventos de forma hierarquicamente distinta:

```
┌─────────────────────────────────────────────────────────────────┐
│  💭 PENSAMENTO (fonte menor, itálico, cor esmaecida)            │
│  "Analisando seu histórico de gastos dos últimos 6 meses..."    │
├─────────────────────────────────────────────────────────────────┤
│  📊 AÇÕES PARALELAS (grid/lista de status)                      │
│  ✅ Verificando cotação atual                                   │
│  🔄 Analisando indicadores fundamentalistas                     │
│  ⏳ Consultando seu portfólio atual                             │
├─────────────────────────────────────────────────────────────────┤
│  💡 DESCOBERTA (destaque visual, badge colorido)                │
│  "P/L atual 15% abaixo da média histórica"                      │
├─────────────────────────────────────────────────────────────────┤
│  📝 RESPOSTA FINAL (fonte maior, destaque principal)            │
│  [Conteúdo da resposta...]                                      │
│                                                                  │
│  ▼ Ver raciocínio completo (dropdown recolhido)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Classes CSS Sugeridas

```css
/* Eventos de pensamento - sutil */
.stream-thought {
  font-style: italic;
  color: #6b7280;
  font-size: 0.875rem;
  opacity: 0.8;
}

/* Ações - neutra, informativa */
.stream-action {
  color: #374151;
  font-size: 0.9rem;
}

/* Descobertas - destaque positivo */
.stream-discovery-opportunity {
  color: #059669;
  background: #d1fae5;
  padding: 0.5rem;
  border-radius: 4px;
}

/* Alertas - destaque de atenção */
.stream-discovery-risk {
  color: #d97706;
  background: #fef3c7;
  padding: 0.5rem;
  border-radius: 4px;
}

/* Operações paralelas - lista de status */
.stream-parallel {
  background: #f3f4f6;
  padding: 0.75rem;
  border-radius: 6px;
}

.stream-parallel-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.25rem 0;
}

/* Resposta final - destaque máximo */
.stream-final {
  font-size: 1rem;
  color: #111827;
  line-height: 1.6;
}

/* Dropdown de raciocínio */
.stream-reasoning-toggle {
  margin-top: 1rem;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.875rem;
}
```

---

## 10. DEMONSTRAÇÃO DE DINAMISMO

### Elemento de "Surpresa e Descoberta"

O streaming NÃO deve ser linear (0 → 100%). Deve mostrar que o agente é **reativo e inteligente**:

```javascript
// Exemplo de fluxo adaptativo

await stream.action('analyzing', { 
  contexto: 'histórico de dividendos' 
});

// Descoberta inesperada muda o rumo
await stream.discovery('pattern', {
  descricao: 'Variação atípica nos últimos 3 trimestres'
});

// Agente mostra que está reagindo
await stream.adaptiveRedirect(
  'Essa variação merece atenção',
  'análise trimestral'
);

await stream.action('analyzing', {
  contexto: 'os fatores que causaram essa variação'
});
```

Isso cria a sensação de que o agente está **pensando de verdade**, não seguindo um script.

---

## 11. INTEGRAÇÃO COM serverAgent.js

### Modificações Necessárias

```javascript
// serverAgent.js (seção de streaming)

// MANTER: imports existentes
const streaming = require('./src/core/streaming/event-emitter');
const { EVENT_TYPES } = require('./src/core/streaming/event-types');
const streamFormatter = require('./src/core/streaming/stream-formatter');

// ADICIONAR: novos imports
const { StreamOrchestrator } = require('./src/core/streaming/stream-orchestrator');
const { PacingEngine } = require('./src/core/streaming/pacing-engine');
const { NarrativeBuilder } = require('./src/core/streaming/narrative-builder');

// MANTER: endpoint SSE existente (funciona igual)
app.get('/stream/agents/:sessionId', (req, res) => {
  // ... código existente permanece igual
});

// ATUALIZAR: demo route para usar novo sistema
app.post('/api/agents/stream-demo', async (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  // Usar novo orquestrador
  const stream = new StreamOrchestrator(sessionId);

  // Demo com novos eventos
  (async () => {
    await stream.startPhase('planejamento');
    await stream.thought('Vou analisar suas finanças com atenção...');
    
    await stream.startParallel([
      { id: 'saldo', descricao: 'Verificando saldo atual' },
      { id: 'gastos', descricao: 'Analisando gastos do mês' }
    ]);
    
    await stream.updateParallel('saldo', 'running');
    await new Promise(r => setTimeout(r, 1000));
    await stream.completeParallel('saldo', { valor: 'R$ 5.200,00' });
    
    await stream.updateParallel('gastos', 'running');
    await new Promise(r => setTimeout(r, 1500));
    await stream.completeParallel('gastos');
    
    await stream.discovery('pattern', {
      descricao: 'Seus gastos com alimentação aumentaram 15% este mês'
    });
    
    await stream.action('calculating', {
      contexto: 'projeções para o próximo mês'
    });
    
    await stream.finalAnswer({
      message: 'Análise completa! Aqui está seu panorama financeiro...'
    });
    
    stream.destroy();
  })();

  return res.status(202).json({ status: 'started' });
});
```

---

## 12. ARQUIVOS - STATUS E AÇÕES

| Arquivo | Status Atual | Ação Requerida |
|---------|-------------|----------------|
| `event-emitter.js` | ✅ Funcional | MANTER - Apenas adicionar tipagem se necessário |
| `event-types.js` | 🔄 Limitado | SUBSTITUIR - Nova estrutura completa |
| `stream-formatter.js` | ✅ Funcional | MANTER - Sem alterações necessárias |
| `pacing-engine.js` | ❌ Não existe | CRIAR - Novo arquivo |
| `narrative-builder.js` | ❌ Não existe | CRIAR - Novo arquivo |
| `stream-orchestrator.js` | ❌ Não existe | CRIAR - Novo arquivo |
| `README.md` | 🔄 Desatualizado | SUBSTITUÍDO - Este documento |

---

## 13. ALTERAÇÕES NA ARQUITETURA DE AGENTES

Para acomodar o novo sistema de streaming, as seguintes alterações são sugeridas na arquitetura:

### 13.1 Coordenadores

**Adicionar ao System Prompt:**

```
Seção X - Comunicação de Progresso:

- Durante sua execução, você deve emitir eventos de streaming para manter o usuário informado
- Use linguagem de intenção, não linguagem técnica
- Antes de operações demoradas, emita evento explicando o que vai fazer
- Ao descobrir algo interessante, emita teaser antes de continuar
- Adapte sua narrativa ao tom "consultor financeiro premium"
```

### 13.2 Message Bus

**Adicionar hook de streaming:**

- Sempre que mensagem for enviada: emitir evento de ação
- Sempre que mensagem for recebida: emitir evento de descoberta (se relevante)

### 13.3 Resposta Final

**Adicionar resumo antes da resposta:**

- Antes de enviar `final:answer`, enviar `final:summary` com pontos-chave
- Transição suave de "pensando" para "respondendo"

---

## 14. MÉTRICAS DE QUALIDADE DA EXPERIÊNCIA

### KPIs Sugeridos

1. **Tempo até primeiro evento:** < 1 segundo
2. **Gap máximo entre eventos:** < 5 segundos
3. **Eventos por missão média:** 8-15 eventos
4. **Taxa de abandono durante streaming:** < 5%
5. **Feedback positivo pós-streaming:** > 80%

### Logging para Análise

```javascript
// Adicionar ao StreamOrchestrator

logMetrics() {
  const metrics = {
    session_id: this.sessionId,
    total_events: this.eventHistory.length,
    first_event_delay: this.eventHistory[0]?.timestamp,
    event_types: this.countByType(),
    max_gap: this.calculateMaxGap(),
    total_duration: this.calculateDuration()
  };
  
  console.log('[StreamMetrics]', JSON.stringify(metrics));
}
```

---

## 15. PRÓXIMOS PASSOS DE IMPLEMENTAÇÃO

1. **Criar novos arquivos:**
   - `pacing-engine.js`
   - `narrative-builder.js`
   - `stream-orchestrator.js`

2. **Atualizar `event-types.js`:**
   - Substituir pela nova estrutura

3. **Atualizar `serverAgent.js`:**
   - Importar novos módulos
   - Atualizar demo route

4. **Integrar com agentes:**
   - Injetar StreamOrchestrator nas requisições
   - Adicionar chamadas de streaming nos coordenadores

5. **Atualizar frontend:**
   - Implementar novos handlers de eventos
   - Aplicar hierarquia visual

6. **Testes:**
   - Testar pacing em diferentes cenários
   - Validar narrativas
   - Medir métricas de UX

---

## 16. CONSIDERAÇÕES FINAIS

O sistema de streaming é a **interface humana** da sua IA. Enquanto a arquitetura de agentes cuida da inteligência real, o streaming cuida da **percepção de inteligência** pelo usuário.

**Lembre-se:**
- O usuário não quer saber que você está "chamando APIs"
- O usuário quer sentir que tem um consultor trabalhando para ele
- Ritmo importa tanto quanto conteúdo
- Descobertas e adaptações criam confiança
- Transparência inteligente > transparência técnica

Este sistema transforma uma espera silenciosa de 30-60 segundos em uma **experiência de consultoria premium em tempo real**.
