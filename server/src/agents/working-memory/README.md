# Working Memory Interna - Sistema Multi-Agente

---

## 1. VISÃO GERAL

### O que é a Working Memory Interna?

A Working Memory Interna (WMI) é um sistema de memória **exclusivo da arquitetura de agentes**, completamente separado do sistema de memória de conversação usuário-IA que existe em `server/src/core/memory`. 

**IMPORTANTE:** Este sistema NÃO é a memória de chat entre usuário e IA. É uma memória **interna ao processamento de cada missão**, que persiste informações entre as diversas etapas da arquitetura (do Agente Junior até a Resposta Final).

### Propósito

Garantir que informações críticas **persistam através das múltiplas camadas da arquitetura** durante o processamento de uma query:

- Agente Junior → Orquestrador → Message Bus → Coordenadores → Executores → Resposta Final

Sem esta memória, cada camada operaria de forma isolada, perdendo contexto e criando inconsistências.

### Ciclo de Vida

```
QUERY RECEBIDA → WMI CRIADA → PROCESSAMENTO → RESPOSTA ENVIADA → WMI DELETADA
```

**Regra Fundamental:** A Working Memory Interna é **efêmera**. Assim que a resposta final é enviada ao usuário, todos os dados da WMI para aquela missão são **apagados do MongoDB**. Não há persistência entre missões.

---

## 2. SEPARAÇÃO DO SISTEMA DE MEMÓRIA DE CONVERSAÇÃO

### Distinção Crítica

| Aspecto | Memória de Conversação (`core/memory`) | Working Memory Interna (`agents/working-memory`) |
|---------|---------------------------------------|------------------------------------------------|
| **Propósito** | Manter contexto entre usuário e IA | Manter estado entre etapas internas |
| **Duração** | Persiste entre sessões | Apagada após resposta enviada |
| **Quem usa** | Interface de chat, histórico | Agentes, Message Bus, Orquestrador |
| **Dados** | Mensagens, preferências do usuário | Estados de missão, recursos, grafos de chamadas |
| **MongoDB** | Collection separada | Collection `agent_working_memory` |
| **Servidor** | Compartilha `serverAgent.js` | Compartilha `serverAgent.js` |

### Separação no MongoDB

**Collections distintas e isoladas:**

```javascript
// Memória de Conversação (NÃO TOCAR)
db.conversation_memory  // Histórico de chat
db.user_preferences     // Preferências persistentes
db.episodic_memory      // Memória episódica

// Working Memory Interna (ESTE SISTEMA)
db.agent_working_memory // Única collection - dados voláteis por missão
```

### Separação no Código

**Arquivos completamente independentes:**

```
server/src/core/memory/          ← Sistema de Conversação (NÃO MODIFICAR)
├── episodic/
├── longTerm/
├── shared/
├── working/
└── README.md

server/src/agents/working-memory/ ← Working Memory Interna (ESTE SISTEMA)
├── README.md                     ← Este documento
├── mission-memory.js             ← Classe principal de memória por missão
├── memory-store.js               ← Camada de persistência MongoDB
├── memory-schemas.js             ← Schemas de validação dos dados
└── memory-cleanup.js             ← Job de limpeza automática
```

---

## 3. ARQUITETURA DA WORKING MEMORY INTERNA

### Estrutura Hierárquica por Missão

Cada missão (query complexa do usuário) gera uma instância de Working Memory com a seguinte estrutura:

```javascript
{
  // === IDENTIFICAÇÃO ===
  mission_id: "uuid-v4",              // ID único da missão
  session_id: "session-abc123",        // Sessão do usuário
  user_id: "user-xyz",                 // ID do usuário
  created_at: ISODate,                 // Quando a missão iniciou
  status: "active" | "completed" | "timeout" | "failed",

  // === CAMADA 0: AGENTE JUNIOR ===
  junior: {
    query_original: "texto do usuário",
    classificacao: {
      tipo: "complexa" | "trivial" | "lancamento" | "simplista",
      dominio: "investimentos" | "planejamento" | "analise_financeira",
      prompts_escolhidos: ["prompt_id_1", "prompt_id_2"]
    },
    candidatos_coordenador: [
      { nome: "AgenteInvestimentos", score: 90, justificativa: "..." },
      { nome: "AgentePlanejamento", score: 40, justificativa: "..." }
    ],
    timestamp: ISODate
  },

  // === CAMADA 1: ORQUESTRADOR ===
  orquestrador: {
    pacote_missao: {
      objetivo_estrategico: "texto do objetivo",
      coordenador_escolhido: "AgenteInvestimentos",
      houve_override: false,
      justificativa_override: null,
      complexidade: "profunda",
      timeout_global: 120,  // segundos
      timestamp_limite: ISODate
    },
    recursos_alocados: {
      tokens: 10000,
      chamadas_api: 15
    },
    recursos_consumidos: {
      tokens: 0,
      chamadas_api: 0,
      ultima_atualizacao: ISODate
    },
    tempo: {
      inicio: ISODate,
      decorrido: 0  // segundos, atualizado continuamente
    }
  },

  // === CAMADA 2: MESSAGE BUS ===
  message_bus: {
    // Grafo de chamadas para detecção de loops
    grafo_chamadas: {
      nodes: ["Junior", "Orquestrador", "CoordenadorInvestimentos"],
      edges: [
        { from: "Junior", to: "Orquestrador", timestamp: ISODate },
        { from: "Orquestrador", to: "CoordenadorInvestimentos", timestamp: ISODate }
      ],
      profundidade_maxima: 2
    },
    
    // Fila de mensagens ativas
    mensagens_pendentes: [
      {
        message_id: "msg-001",
        remetente: "CoordenadorInvestimentos",
        destinatario: "AgentePesquisa",
        prioridade: "ALTA",
        timestamp_envio: ISODate,
        timeout: 60
      }
    ],
    
    // Rastreamento de recursos acumulado
    recursos_totais: {
      tokens_consumidos: 3500,
      chamadas_api_consumidas: 4,
      mensagens_processadas: 12
    },
    
    // Circuit Breaker por agente
    circuit_breakers: {
      "AgentePesquisa": {
        estado: "CLOSED",  // CLOSED | OPEN | HALF-OPEN
        falhas_consecutivas: 0,
        ultimas_10_tentativas: [true, true, true, false, true],
        ultimo_teste: null,
        fallback_ativo: null
      }
    },
    
    // Janela deslizante de mensagens (últimos 10 segundos)
    janela_mensagens: [
      { timestamp: ISODate, tipo: "envio" },
      { timestamp: ISODate, tipo: "resposta" }
    ],
    
    // Detector de progresso
    ultima_atividade: ISODate
  },

  // === CAMADA 3: COORDENADORES ===
  coordenadores: {
    "AgenteInvestimentos": {
      ciclo_atual: 5,
      
      // Plano de execução
      plano: {
        operacoes: [
          {
            id: "op-001",
            nome: "buscar_dados_mercado",
            agente_destino: "AgentePesquisa",
            prioridade: "CRITICA",
            dependencias: [],
            estimativa_tokens: 800
          },
          {
            id: "op-002", 
            nome: "buscar_portfolio",
            agente_destino: "AgenteDadosInternos",
            prioridade: "CRITICA",
            dependencias: [],
            estimativa_tokens: 500
          }
        ],
        dependencias_mapa: {
          "op-003": ["op-001", "op-002"]  // op-003 depende de op-001 e op-002
        }
      },
      
      // Estado de cada operação
      operacoes_estado: {
        "op-001": {
          status: "concluida",  // pendente | em_andamento | concluida | falhou
          resultado: { /* dados retornados */ },
          metadados: { fonte: "API Brapi", confiabilidade: 95 },
          fallback_usado: false,
          timestamp_inicio: ISODate,
          timestamp_fim: ISODate,
          tokens_consumidos: 750
        }
      },
      
      // Dados coletados (cache local)
      dados_coletados: {
        mercado: { preco: 38.50, variacao: -3.1 },
        portfolio: { valor_total: 100000, alocacao_acoes: 0.20 }
      },
      
      // Advertências acumuladas
      advertencias: [
        { tipo: "dados_fallback", mensagem: "Dados de fonte alternativa", impacto: "baixo" }
      ],
      
      // Histórico de decisões
      decisoes: [
        {
          ciclo: 3,
          decisao: "omitir_analise_historica",
          motivo: "custo_beneficio_negativo",
          operacao_afetada: "op-004",
          timestamp: ISODate
        }
      ],
      
      // Análise de progresso
      progresso: {
        score_completude: 75,  // 0-100%
        lacunas_criticas: [],
        lacunas_complementares: ["comparacao_setorial"]
      },
      
      // Recursos do coordenador
      recursos: {
        tokens_consumidos: 4200,
        tokens_restantes: 5800,
        chamadas_api_consumidas: 4,
        chamadas_api_restantes: 11,
        percentual_orcamento: 42,
        tempo_decorrido: 35,  // segundos
        tempo_restante: 85
      }
    }
  },

  // === CAMADA 4: EXECUTORES (stateless - apenas tracking) ===
  executores: {
    execucoes: [
      {
        executor: "AgentePesquisa",
        operacao: "dados_fundamentalistas",
        requisicao_id: "req-001",
        timestamp_inicio: ISODate,
        timestamp_fim: ISODate,
        duracao: 2.5,  // segundos
        status: "sucesso_via_fallback",
        fallback_usado: "Yahoo Finance",
        tokens_consumidos: 750
      }
    ]
  },

  // === RESPOSTA FINAL ===
  resposta_final: {
    consolidacao_recebida: { /* JSON do coordenador */ },
    tentativas_sintese: 1,
    validacoes: {
      termos_proibidos_encontrados: [],
      passou_validacao: true
    },
    resposta_gerada: "texto da resposta",
    timestamp_envio: ISODate
  }
}
```

---

## 4. CICLO DE VIDA DETALHADO

### Fase 1: Criação (Agente Junior)

```javascript
// Quando query entra no sistema
const memoryStore = require('./memory-store');

async function criarMissao(sessionId, userId, queryOriginal) {
  const missionId = generateUUID();
  
  await memoryStore.create({
    mission_id: missionId,
    session_id: sessionId,
    user_id: userId,
    status: 'active',
    created_at: new Date(),
    junior: {
      query_original: queryOriginal,
      timestamp: new Date()
    }
  });
  
  return missionId;
}
```

### Fase 2: Atualização Contínua

Cada camada atualiza sua seção da memória:

```javascript
// Message Bus atualizando recursos
await memoryStore.update(missionId, {
  'message_bus.recursos_totais.tokens_consumidos': newTokenCount,
  'message_bus.ultima_atividade': new Date()
});

// Coordenador atualizando progresso
await memoryStore.update(missionId, {
  [`coordenadores.${coordName}.ciclo_atual`]: ciclo + 1,
  [`coordenadores.${coordName}.progresso.score_completude`]: 75
});
```

### Fase 3: Leitura para Decisões

```javascript
// Coordenador consultando orçamento restante
const memory = await memoryStore.get(missionId);
const orcamento = memory.orquestrador.recursos_alocados.tokens;
const consumido = memory.message_bus.recursos_totais.tokens_consumidos;
const restante = orcamento - consumido;

if (restante < orcamento * 0.2) {
  // Priorizar finalização
}
```

### Fase 4: Deleção (Pós-Resposta)

```javascript
// Após resposta enviada ao usuário
async function finalizarMissao(missionId) {
  // Marca como completada
  await memoryStore.update(missionId, {
    status: 'completed',
    'resposta_final.timestamp_envio': new Date()
  });
  
  // Agenda deleção (imediata ou com delay para debug)
  const DELETE_DELAY = process.env.WMI_DELETE_DELAY || 0;
  
  setTimeout(async () => {
    await memoryStore.delete(missionId);
  }, DELETE_DELAY);
}
```

---

## 5. MEMÓRIA POR CAMADA

### Camada 0: Agente Junior - Criticidade BAIXA

**Dados armazenados:**
- Query original (SEMPRE preservar)
- Classificação realizada (tipo, domínio)
- Candidatos a coordenador com scores
- Justificativas

**Motivo:** Junior opera uma vez no início. Dados são usados pelo Orquestrador e para auditoria.

**Frequência de acesso:** 1-2 vezes por missão.

---

### Camada 1: Orquestrador - Criticidade ALTA

**Dados armazenados:**
- Pacote de missão completo
- Recursos alocados e consumidos
- Decisão de override (se houver)
- Timeout global e timestamps

**Motivo:** Orquestrador monitora recursos globais. Precisa forçar encerramento se timeout estourar.

**Frequência de acesso:** Contínua (polling de timeout).

**Operações críticas:**
- Verificar se timeout global foi atingido
- Calcular tempo restante
- Enviar sinal de encerramento forçado

---

### Camada 2: Message Bus - Criticidade ULTRA ALTA

**Dados armazenados:**

1. **Grafo de chamadas:**
   - Detectar loops circulares
   - Verificar profundidade
   - Histórico de quem chamou quem

2. **Fila de mensagens:**
   - Mensagens pendentes
   - Callbacks registrados
   - Timeouts individuais

3. **Recursos acumulados:**
   - Tokens consumidos globalmente
   - Chamadas API totais
   - Não pode recontar a cada mensagem

4. **Circuit Breakers:**
   - Estado por agente (CLOSED/OPEN/HALF-OPEN)
   - Histórico de falhas
   - Timestamps de cooldown

5. **Detector de anomalias:**
   - Janela deslizante de mensagens
   - Última atividade (detector de stall)

**Motivo:** Message Bus é o sistema nervoso. Sem memória:
- Loops não detectados → stack overflow
- Recursos reconhecidos → estouro de orçamento
- Circuit breakers inúteis → falhas em cascata

**Frequência de acesso:** A cada mensagem (dezenas por missão).

---

### Camada 3: Coordenadores - Criticidade ALTA

**Dados armazenados:**

1. **Plano de execução:**
   - Operações planejadas
   - Dependências entre operações
   - Priorização

2. **Estado de operações:**
   - Status de cada operação
   - Resultados recebidos
   - Fallbacks usados

3. **Dados coletados:**
   - Cache local de respostas
   - Metadados de cada fonte

4. **Histórico de decisões:**
   - Por que omitiu operação X
   - Por que priorizou A sobre B

5. **Análise de progresso:**
   - Score de completude
   - Lacunas identificadas

**Motivo:** Coordenadores operam em múltiplos ciclos. Sem memória:
- Perdem contexto entre ciclos
- Repetem operações
- Não conseguem avaliar se objetivo foi alcançado

**Frequência de acesso:** A cada ciclo (5-15 por missão complexa).

---

### Camada 4: Executores - Criticidade BAIXA

**Dados armazenados:**
- Tracking de execuções (para métricas)
- Não há estado real entre operações

**Motivo:** Executores são stateless por design. Processam uma requisição e retornam.

**Frequência de acesso:** Apenas para logging/métricas.

---

### Sistema de Resposta Final - Criticidade MODERADA

**Dados armazenados:**
- Consolidação recebida do coordenador
- Tentativas de síntese
- Validações realizadas
- Resposta final gerada

**Preservação Integral:** Todas as respostas dos agentes executores e coordenadores são armazenadas na sua integridade (100%) na memória interna, garantindo que nenhum dado processado seja perdido durante a elaboração da resposta final. A consolidação inclui dados_suporte, calculos_realizados, comparacoes_feitas, limitacoes_encontradas, etc., preservados integralmente para síntese com o contexto de chat.

**Motivo:** Operação pontual no final, mas precisa manter estado se regeneração for necessária.

**Frequência de acesso:** 1-3 vezes no final da missão.

---

## 6. OPERAÇÕES DE MEMÓRIA

### Operações Atômicas

```javascript
// memory-store.js

class MemoryStore {
  // Criar nova memória de missão
  async create(missionData) {
    return await this.collection.insertOne({
      ...missionData,
      created_at: new Date(),
      status: 'active'
    });
  }

  // Buscar memória completa
  async get(missionId) {
    return await this.collection.findOne({ mission_id: missionId });
  }

  // Atualização parcial (path notation)
  async update(missionId, updates) {
    return await this.collection.updateOne(
      { mission_id: missionId },
      { $set: updates }
    );
  }

  // Push em arrays
  async pushTo(missionId, arrayPath, item) {
    return await this.collection.updateOne(
      { mission_id: missionId },
      { $push: { [arrayPath]: item } }
    );
  }

  // Incrementar contadores
  async increment(missionId, field, amount = 1) {
    return await this.collection.updateOne(
      { mission_id: missionId },
      { $inc: { [field]: amount } }
    );
  }

  // Deletar memória
  async delete(missionId) {
    return await this.collection.deleteOne({ mission_id: missionId });
  }

  // Buscar todas as missões ativas (para cleanup)
  async findActive() {
    return await this.collection.find({ status: 'active' }).toArray();
  }

  // Buscar missões expiradas
  async findExpired(olderThan) {
    return await this.collection.find({
      created_at: { $lt: olderThan }
    }).toArray();
  }
}
```

### Operações Específicas por Camada

```javascript
// mission-memory.js

class MissionMemory {
  constructor(missionId) {
    this.missionId = missionId;
    this.store = require('./memory-store');
  }

  // === JUNIOR ===
  async setJuniorClassification(classificacao, candidatos) {
    await this.store.update(this.missionId, {
      'junior.classificacao': classificacao,
      'junior.candidatos_coordenador': candidatos,
      'junior.timestamp': new Date()
    });
  }

  // === ORQUESTRADOR ===
  async setPacoteMissao(pacote) {
    await this.store.update(this.missionId, {
      'orquestrador.pacote_missao': pacote,
      'orquestrador.recursos_alocados': pacote.orcamento_recursos,
      'orquestrador.tempo.inicio': new Date()
    });
  }

  async getTempoRestante() {
    const memory = await this.store.get(this.missionId);
    const timeout = memory.orquestrador.pacote_missao.timeout_global;
    const inicio = new Date(memory.orquestrador.tempo.inicio);
    const agora = new Date();
    const decorrido = (agora - inicio) / 1000;
    return Math.max(0, timeout - decorrido);
  }

  // === MESSAGE BUS ===
  async addMensagem(mensagem) {
    await this.store.pushTo(
      this.missionId,
      'message_bus.mensagens_pendentes',
      mensagem
    );
    await this.store.update(this.missionId, {
      'message_bus.ultima_atividade': new Date()
    });
  }

  async removeMensagem(messageId) {
    await this.store.update(this.missionId, {
      'message_bus.mensagens_pendentes': {
        $pull: { message_id: messageId }
      }
    });
  }

  async addEdgeGrafo(from, to) {
    await this.store.pushTo(
      this.missionId,
      'message_bus.grafo_chamadas.edges',
      { from, to, timestamp: new Date() }
    );
    
    // Verificar loop
    return await this.detectarLoop(from, to);
  }

  async detectarLoop(from, to) {
    const memory = await this.store.get(this.missionId);
    const edges = memory.message_bus.grafo_chamadas.edges;
    
    // DFS para detectar ciclo
    const visited = new Set();
    const stack = [to];
    
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === from) return true; // Loop detectado
      if (visited.has(current)) continue;
      visited.add(current);
      
      // Adicionar destinos de current à stack
      edges.forEach(e => {
        if (e.from === current) stack.push(e.to);
      });
    }
    
    return false;
  }

  async updateCircuitBreaker(agente, estado, falha = null) {
    const path = `message_bus.circuit_breakers.${agente}`;
    const updates = {
      [`${path}.estado`]: estado,
      [`${path}.ultimo_teste`]: new Date()
    };
    
    if (falha !== null) {
      // Atualizar histórico de tentativas
      await this.store.pushTo(
        this.missionId,
        `${path}.ultimas_10_tentativas`,
        !falha // true = sucesso, false = falha
      );
    }
    
    await this.store.update(this.missionId, updates);
  }

  async consumirRecursos(tokens, chamadasApi) {
    await this.store.increment(
      this.missionId,
      'message_bus.recursos_totais.tokens_consumidos',
      tokens
    );
    await this.store.increment(
      this.missionId,
      'message_bus.recursos_totais.chamadas_api_consumidas',
      chamadasApi
    );
  }

  async getRecursosRestantes() {
    const memory = await this.store.get(this.missionId);
    const alocados = memory.orquestrador.recursos_alocados;
    const consumidos = memory.message_bus.recursos_totais;
    
    return {
      tokens_restantes: alocados.tokens - consumidos.tokens_consumidos,
      chamadas_api_restantes: alocados.chamadas_api - consumidos.chamadas_api_consumidas,
      percentual_tokens: (consumidos.tokens_consumidos / alocados.tokens) * 100,
      percentual_api: (consumidos.chamadas_api_consumidas / alocados.chamadas_api) * 100
    };
  }

  // === COORDENADORES ===
  async setCoordenadorPlano(coordName, plano) {
    await this.store.update(this.missionId, {
      [`coordenadores.${coordName}.plano`]: plano,
      [`coordenadores.${coordName}.ciclo_atual`]: 1
    });
  }

  async updateOperacaoEstado(coordName, operacaoId, estado) {
    await this.store.update(this.missionId, {
      [`coordenadores.${coordName}.operacoes_estado.${operacaoId}`]: estado
    });
  }

  async addDadosColetados(coordName, chave, dados) {
    await this.store.update(this.missionId, {
      [`coordenadores.${coordName}.dados_coletados.${chave}`]: dados
    });
  }

  async addDecisao(coordName, decisao) {
    await this.store.pushTo(
      this.missionId,
      `coordenadores.${coordName}.decisoes`,
      { ...decisao, timestamp: new Date() }
    );
  }

  async updateProgresso(coordName, scoreCompletude, lacunas) {
    await this.store.update(this.missionId, {
      [`coordenadores.${coordName}.progresso`]: {
        score_completude: scoreCompletude,
        lacunas_criticas: lacunas.criticas || [],
        lacunas_complementares: lacunas.complementares || []
      }
    });
  }

  async incrementarCiclo(coordName) {
    await this.store.increment(
      this.missionId,
      `coordenadores.${coordName}.ciclo_atual`,
      1
    );
  }

  // === RESPOSTA FINAL ===
  async setConsolidacao(consolidacao) {
    await this.store.update(this.missionId, {
      'resposta_final.consolidacao_recebida': consolidacao
    });
  }

  async setRespostaFinal(resposta, validacoes) {
    await this.store.update(this.missionId, {
      'resposta_final.resposta_gerada': resposta,
      'resposta_final.validacoes': validacoes,
      'resposta_final.timestamp_envio': new Date(),
      'status': 'completed'
    });
  }
}
```

---

## 7. LIMPEZA AUTOMÁTICA

### Job de Cleanup

```javascript
// memory-cleanup.js

const MemoryStore = require('./memory-store');

class MemoryCleanup {
  constructor() {
    this.store = new MemoryStore();
    this.CLEANUP_INTERVAL = 60000; // 1 minuto
    this.MAX_AGE_ACTIVE = 300000;  // 5 minutos (missões abandonadas)
    this.MAX_AGE_COMPLETED = 0;    // Imediato (ou delay para debug)
  }

  start() {
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    console.log('[WMI Cleanup] Job iniciado');
  }

  async cleanup() {
    const now = new Date();
    
    // 1. Deletar missões completadas
    const completedThreshold = new Date(now - this.MAX_AGE_COMPLETED);
    const deletedCompleted = await this.store.collection.deleteMany({
      status: 'completed',
      'resposta_final.timestamp_envio': { $lt: completedThreshold }
    });
    
    // 2. Marcar missões ativas muito antigas como timeout
    const activeThreshold = new Date(now - this.MAX_AGE_ACTIVE);
    const expiredActive = await this.store.findExpired(activeThreshold);
    
    for (const mission of expiredActive) {
      if (mission.status === 'active') {
        await this.store.update(mission.mission_id, {
          status: 'timeout',
          'resposta_final.erro': 'Missão abandonada após timeout'
        });
      }
    }
    
    // 3. Deletar missões com timeout/failed
    const failedThreshold = new Date(now - 60000); // 1 minuto após falha
    const deletedFailed = await this.store.collection.deleteMany({
      status: { $in: ['timeout', 'failed'] },
      created_at: { $lt: failedThreshold }
    });

    console.log(`[WMI Cleanup] Removidas: ${deletedCompleted.deletedCount} completadas, ${deletedFailed.deletedCount} falhas`);
  }
}

module.exports = new MemoryCleanup();
```

---

## 8. INTEGRAÇÃO COM serverAgent.js

### Separação Explícita das Memórias

```javascript
// serverAgent.js (trecho de integração)

// ===== MEMÓRIA DE CONVERSAÇÃO (EXISTENTE - NÃO MODIFICAR) =====
// Esta seção gerencia a memória persistente entre usuário e IA
// Collections: conversation_memory, user_preferences, episodic_memory
// Lógica em: server/src/core/memory/

// ===== WORKING MEMORY INTERNA (NOVO - ESTE SISTEMA) =====
// Esta seção gerencia memória efêmera durante processamento de missões
// Collection: agent_working_memory
// Lógica em: server/src/agents/working-memory/

const MissionMemory = require('./src/agents/working-memory/mission-memory');
const MemoryStore = require('./src/agents/working-memory/memory-store');
const MemoryCleanup = require('./src/agents/working-memory/memory-cleanup');

// Inicializar cleanup job ao iniciar servidor
mongoose.connect(MONGO_URI).then(() => {
  console.log('Connected to MongoDB');
  
  // Inicializar store de Working Memory Interna
  const memoryStore = new MemoryStore();
  memoryStore.initialize();
  
  // Iniciar job de limpeza
  MemoryCleanup.start();
  
  // ... resto do código
});
```

### Middleware de Injeção

```javascript
// Middleware que injeta MissionMemory em requisições de agentes
const injectMissionMemory = async (req, res, next) => {
  if (req.body.mission_id) {
    req.missionMemory = new MissionMemory(req.body.mission_id);
  }
  next();
};

app.use('/agent/execute', injectMissionMemory);
app.use('/api/agent/execute', injectMissionMemory);
```

---

## 9. SCHEMAS DE VALIDAÇÃO

```javascript
// memory-schemas.js

const Joi = require('joi');

const juniorSchema = Joi.object({
  query_original: Joi.string().required(),
  classificacao: Joi.object({
    tipo: Joi.string().valid('complexa', 'trivial', 'lancamento', 'simplista'),
    dominio: Joi.string(),
    prompts_escolhidos: Joi.array().items(Joi.string())
  }),
  candidatos_coordenador: Joi.array().items(
    Joi.object({
      nome: Joi.string().required(),
      score: Joi.number().min(0).max(100).required(),
      justificativa: Joi.string()
    })
  ),
  timestamp: Joi.date()
});

const orquestradorSchema = Joi.object({
  pacote_missao: Joi.object({
    objetivo_estrategico: Joi.string().required(),
    coordenador_escolhido: Joi.string().required(),
    houve_override: Joi.boolean(),
    justificativa_override: Joi.string().allow(null),
    complexidade: Joi.string().valid('comparativa', 'profunda', 'analise_investimento'),
    timeout_global: Joi.number().min(30).max(300),
    timestamp_limite: Joi.date()
  }),
  recursos_alocados: Joi.object({
    tokens: Joi.number().min(1000).max(50000),
    chamadas_api: Joi.number().min(5).max(50)
  }),
  recursos_consumidos: Joi.object({
    tokens: Joi.number().min(0),
    chamadas_api: Joi.number().min(0),
    ultima_atualizacao: Joi.date()
  }),
  tempo: Joi.object({
    inicio: Joi.date(),
    decorrido: Joi.number().min(0)
  })
});

const messageBusSchema = Joi.object({
  grafo_chamadas: Joi.object({
    nodes: Joi.array().items(Joi.string()),
    edges: Joi.array().items(
      Joi.object({
        from: Joi.string().required(),
        to: Joi.string().required(),
        timestamp: Joi.date()
      })
    ),
    profundidade_maxima: Joi.number().min(0).max(10)
  }),
  mensagens_pendentes: Joi.array(),
  recursos_totais: Joi.object({
    tokens_consumidos: Joi.number().min(0),
    chamadas_api_consumidas: Joi.number().min(0),
    mensagens_processadas: Joi.number().min(0)
  }),
  circuit_breakers: Joi.object().pattern(
    Joi.string(),
    Joi.object({
      estado: Joi.string().valid('CLOSED', 'OPEN', 'HALF-OPEN'),
      falhas_consecutivas: Joi.number().min(0),
      ultimas_10_tentativas: Joi.array().items(Joi.boolean()),
      ultimo_teste: Joi.date().allow(null),
      fallback_ativo: Joi.string().allow(null)
    })
  ),
  janela_mensagens: Joi.array(),
  ultima_atividade: Joi.date()
});

const missionMemorySchema = Joi.object({
  mission_id: Joi.string().uuid().required(),
  session_id: Joi.string().required(),
  user_id: Joi.string().required(),
  status: Joi.string().valid('active', 'completed', 'timeout', 'failed').required(),
  created_at: Joi.date().required(),
  junior: juniorSchema,
  orquestrador: orquestradorSchema,
  message_bus: messageBusSchema,
  coordenadores: Joi.object(),
  executores: Joi.object(),
  resposta_final: Joi.object()
});

module.exports = {
  juniorSchema,
  orquestradorSchema,
  messageBusSchema,
  missionMemorySchema
};
```

---

## 10. ÍNDICES MONGODB

```javascript
// Índices recomendados para performance

// Índice principal para busca por mission_id
db.agent_working_memory.createIndex({ "mission_id": 1 }, { unique: true });

// Índice para busca por sessão (debug)
db.agent_working_memory.createIndex({ "session_id": 1 });

// Índice para cleanup por status e data
db.agent_working_memory.createIndex({ "status": 1, "created_at": 1 });

// Índice para busca de missões ativas por usuário
db.agent_working_memory.createIndex({ "user_id": 1, "status": 1 });

// TTL Index para auto-delete após 10 minutos (backup do cleanup job)
db.agent_working_memory.createIndex(
  { "created_at": 1 },
  { expireAfterSeconds: 600 }
);
```

---

## 11. MONITORAMENTO E DEBUG

### Endpoints de Debug (apenas desenvolvimento)

```javascript
// Apenas em NODE_ENV === 'development'
if (process.env.NODE_ENV === 'development') {
  
  // Ver memória de uma missão
  app.get('/api/wmi/debug/:missionId', async (req, res) => {
    const memory = await memoryStore.get(req.params.missionId);
    res.json(memory);
  });
  
  // Listar todas as missões ativas
  app.get('/api/wmi/debug/active', async (req, res) => {
    const active = await memoryStore.findActive();
    res.json({
      count: active.length,
      missions: active.map(m => ({
        id: m.mission_id,
        status: m.status,
        created: m.created_at,
        coordenador: m.orquestrador?.pacote_missao?.coordenador_escolhido
      }))
    });
  });
  
  // Forçar cleanup
  app.post('/api/wmi/debug/cleanup', async (req, res) => {
    await MemoryCleanup.cleanup();
    res.json({ message: 'Cleanup executado' });
  });
}
```

---

## 12. RESUMO DE CRITICIDADE

| Componente | Criticidade | Dados Principais | Frequência de Acesso |
|------------|-------------|------------------|---------------------|
| **Junior** | 🟡 Baixa | Query, classificação, candidatos | 1-2x |
| **Orquestrador** | 🔴 Alta | Pacote missão, recursos, timeout | Contínua |
| **Message Bus** | 🔴🔴 Ultra | Grafo, fila, recursos, circuit breakers | Cada mensagem |
| **Coordenadores** | 🔴 Alta | Plano, estados, decisões, progresso | Cada ciclo |
| **Executores** | 🟢 Mínima | Apenas tracking | Logging |
| **Resposta Final** | 🟡 Moderada | Consolidação, validações | 1-3x no final |

---

## 13. PRÓXIMOS PASSOS DE IMPLEMENTAÇÃO

1. **Criar arquivos base:**
   - `memory-store.js` - Camada de persistência
   - `mission-memory.js` - Classe de alto nível
   - `memory-schemas.js` - Validação Joi
   - `memory-cleanup.js` - Job de limpeza

2. **Configurar MongoDB:**
   - Criar collection `agent_working_memory`
   - Aplicar índices

3. **Integrar com serverAgent.js:**
   - Importar módulos
   - Inicializar store e cleanup
   - Adicionar middleware de injeção

4. **Integrar com cada camada:**
   - Junior: criar missão
   - Orquestrador: definir pacote
   - Message Bus: rastrear mensagens
   - Coordenadores: gerenciar estado
   - Resposta Final: consolidar e deletar

5. **Testes:**
   - Testes unitários por camada
   - Testes de ciclo completo
   - Testes de cleanup

---

## 14. CONSIDERAÇÕES FINAIS

A Working Memory Interna é **essencial para a integridade do sistema multi-agente**. Sem ela:

- O sistema perderia contexto entre camadas
- Recursos seriam reconhecidos indefinidamente
- Loops circulares não seriam detectados
- Coordenadores não teriam autonomia real (sem memória de ciclos anteriores)
- A resposta final não teria acesso aos dados processados

Este sistema opera de forma **completamente isolada** da memória de conversação, garantindo que:

- Cada tipo de memória tenha seu propósito claro
- Não haja interferência entre sistemas
- A manutenção seja independente
- O debug seja facilitado

**Lembre-se:** A WMI é efêmera. Após a resposta ser enviada, tudo é apagado. Se você precisa persistir algo permanentemente, use o sistema de memória de conversação em `server/src/core/memory`.
