# 📋 Plano de Implementação: Agente Simplista

**Data:** 31/01/2026  
**Versão:** 1.0  
**Status:** 📝 Planejamento  
**Modelo:** GPT-5 Mini (verbosity: low, reasoning: low)

---

## 📌 Visão Geral

O **Agente Simplista** é um executor operacional direto especializado em respostas rápidas e informacionais para queries simples. Ele não realiza análise profunda - apenas recupera, calcula e apresenta dados financeiros básicos de forma clara e imediata, com leve interpretação e sugestões rasas.

### Características Principais
- ⚡ Respostas em 2-3 segundos
- 📊 Acesso direto ao **FinanceDataBridge** para dados internos
- 🔍 Acesso direto ao **Serper** para dados externos (exceção do sistema)
- 💬 Diálogo limitado para esclarecer queries ambíguas (máximo 2-3 trocas)
- 🎯 Sempre oferece aprofundamento ("quer detalhes como...")
- 🧠 GPT-5 Mini com `verbosity: low` e `reasoning: low`

---

## 🎯 Objetivos de Implementação

### Objetivo 1: Core do Agente e Configuração LLM
**Descrição:** Criar a estrutura base do agente com configuração adequada do GPT-5 Mini e sistema de roteamento.

**Tarefas:**
1. Criar classe `SimplistaAgent` herdando de `BaseAgent` com configuração específica do GPT-5 Mini
2. Implementar método `execute()` com fluxo de processamento de queries simples
3. Implementar sistema de classificação de ambiguidade e decisão de diálogo
4. Configurar integração com sistema de memória (leitura do contexto completo)

---

### Objetivo 2: Integração com FinanceDataBridge
**Descrição:** Implementar sistema inteligente de consulta a dados internos através do FinanceDataBridge.

**Tarefas:**
1. Criar método `_shouldUseFinanceBridge()` para detectar quando consultar dados internos
2. Implementar método `_buildFinanceBridgeQuery()` para construir requisições ao bridge baseado na query do usuário
3. Implementar método `_processFinanceBridgeResponse()` para formatar dados recebidos do bridge
4. Criar sistema de fallback para erros de consulta ao bridge

---

### Objetivo 3: Integração Direta com Serper
**Descrição:** Implementar acesso direto ao Serper para enriquecer respostas com dados externos (cotações, informações de mercado, dados factuais).

**Tarefas:**
1. Criar método `_shouldUseSerper()` para detectar quando consultar dados externos
2. Implementar wrapper `_callSerper()` para chamadas diretas ao cliente Serper
3. Implementar método `_enrichWithExternalData()` para combinar dados internos + externos
4. Criar sistema de cache básico para respostas do Serper (TTL: 5h para cotações, 72h para fatos triviais)

---

### Objetivo 4: Sistema de Diálogo e Resposta Enriquecida
**Descrição:** Implementar capacidade de diálogo limitado para esclarecer queries e formatação de respostas informativas.

**Tarefas:**
1. Implementar método `_handleAmbiguousQuery()` para gerenciar diálogo de esclarecimento
2. Criar método `_buildEnrichedResponse()` para formatar respostas (fatos + leve insight + convite)
3. Implementar sistema de transição para queries complexas (detecção de "análise completa", "plano detalhado")
4. Criar método `_offerDeepening()` para gerar convites contextualizados de aprofundamento

---

## 📂 Estrutura de Arquivos

```
server/src/agents/junior/simplista/
├── simplista-agent.js              # Classe principal (herda BaseAgent)
├── query-classifier.js             # Classificação de ambiguidade e necessidade de dados
├── finance-bridge-connector.js     # Interface com FinanceDataBridge
├── serper-connector.js             # Acesso direto ao Serper
├── dialogue-manager.js             # Gerenciamento de diálogo interativo
├── response-builder.js             # Formatação de respostas enriquecidas
├── simplista-cache.js              # Cache local para Serper
└── README.md                       # Documentação já existe
```

---

## 🔧 Detalhamento Técnico por Objetivo

### Objetivo 1: Core do Agente e Configuração LLM

#### Tarefa 1.1: Criar classe SimplistaAgent
**Arquivo:** `server/src/agents/junior/simplista/simplista-agent.js`

**Responsabilidades:**
- Herdar de `BaseAgent` para manter padrão do sistema
- Configurar GPT-5 Mini com `verbosity: low` e `reasoning: low`
- Implementar método `execute(params)` como ponto de entrada
- Gerenciar estado de diálogo (contexto ativo)

**Estrutura base:**
```javascript
class SimplistaAgent extends BaseAgent {
  constructor() {
    super();
    this.name = 'SimplistaAgent';
    this.model = 'gpt-5-mini';
    this.verbosity = 'low';
    this.reasoning = 'low';
    this.dialogueContext = new Map(); // userId -> contexto de diálogo
  }

  async execute(params) {
    // 1. Extrair: message, userId, memory
    // 2. Verificar contexto de diálogo ativo
    // 3. Classificar query (ambígua? precisa dados?)
    // 4. Buscar dados se necessário (bridge/serper)
    // 5. Gerar resposta enriquecida
    // 6. Retornar com metadados
  }
}
```

**Integração com configurações:**
- Usar `callOpenAI()` de `openai-config.js`
- Parametrizar chamadas com `verbosity: low` e `reasoning: low`

---

#### Tarefa 1.2: Implementar método execute()
**Arquivo:** `server/src/agents/junior/simplista/simplista-agent.js`

**Fluxo de processamento:**
```
┌─────────────────────────────────────────────────────────────┐
│                    EXECUTE - FLUXO PRINCIPAL                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Recebe: { message, userId, memory }                     │
│  2. Verifica diálogo ativo → Se sim: continua diálogo       │
│  3. Classifica query → ambígua? dados? tipo?                │
│  4. Busca dados:                                            │
│     ├─ FinanceBridge? → consulta dados internos             │
│     ├─ Serper? → consulta dados externos                    │
│     └─ Ambos? → combina                                     │
│  5. Gera resposta enriquecida                               │
│  6. Retorna:                                                │
│     {                                                       │
│       resposta: string,                                     │
│       metadata: {                                           │
│         tempoExecucao: number,                              │
│         fontesConsultadas: [],                              │
│         ofereceuAprofundamento: boolean                     │
│       }                                                     │
│     }                                                       │
└─────────────────────────────────────────────────────────────┘
```

**Casos especiais:**
- Query ambígua → inicia diálogo
- Transição para complexo → retorna flag especial
- Erro de dados → resposta baseada apenas em memória

---

#### Tarefa 1.3: Sistema de classificação de ambiguidade
**Arquivo:** `server/src/agents/junior/simplista/query-classifier.js`

**Responsabilidades:**
- Detectar se query é ambígua (falta período, categoria, especificação)
- Identificar se precisa de dados internos (gastos, saldos, investimentos)
- Identificar se precisa de dados externos (cotações, notícias, fatos de mercado)
- Detectar transição para análise complexa

**Métodos principais:**
```javascript
class QueryClassifier {
  isAmbiguous(query, memory) {
    // Análise rápida:
    // - Termos vagos sem contexto ("mês passado" mas qual?)
    // - Categoria não especificada ("quanto gastei")
    // - Período indefinido
    return { ambiguous: boolean, clarificationNeeded: string }
  }

  needsFinanceData(query) {
    // Keywords: "gastei", "recebi", "saldo", "dívidas", 
    //           "investimentos", "contas", "patrimônio"
    return boolean
  }

  needsExternalData(query) {
    // Keywords: "cotação", "preço", "P/L", "dólar", 
    //           "ação", "fundo", "SELIC", "índice"
    return boolean
  }

  isTransitionToComplex(query) {
    // Keywords: "analise", "planeje", "estratégia",
    //           "como devo", "o que fazer", "recomende"
    return boolean
  }
}
```

---

#### Tarefa 1.4: Integração com sistema de memória
**Arquivo:** `server/src/agents/junior/simplista/simplista-agent.js`

**Como funciona:**
- Recebe memória completa do sistema (conforme Junior README)
- Estrutura: `[HISTÓRICO_RESUMIDO] + [JANELA_ATUAL] + mensagem`
- Usa memória para contextualizar respostas simples
- Não gera nova memória (apenas lê)

**Formato esperado:**
```javascript
{
  userId: '507f...',
  memory: {
    summary: 'Resumo de conversas anteriores...',
    recent: [
      { role: 'user', content: '...' },
      { role: 'assistant', content: '...' }
    ]
  },
  message: 'Quanto gastei este mês?'
}
```

---

### Objetivo 2: Integração com FinanceDataBridge

#### Tarefa 2.1: Detector de necessidade de dados internos
**Arquivo:** `server/src/agents/junior/simplista/finance-bridge-connector.js`

**Método `_shouldUseFinanceBridge(query)`:**
```javascript
class FinanceBridgeConnector {
  shouldQuery(query) {
    // Regex patterns para detecção rápida
    const patterns = {
      SALDO: /saldo|quanto tenho|disponível/i,
      GASTOS: /gastei|despesas|saídas/i,
      RECEITAS: /recebi|entrada|salário/i,
      DIVIDAS: /dívidas|deve|débito/i,
      INVESTIMENTOS: /investido|aplicação|carteira/i,
      CONTAS: /contas|pagar|vencer/i,
      PATRIMONIO: /patrimônio|líquido|total/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(query)) {
        return { needed: true, dataType: type };
      }
    }

    return { needed: false, dataType: null };
  }
}
```

---

#### Tarefa 2.2: Construtor de requisições ao Bridge
**Arquivo:** `server/src/agents/junior/simplista/finance-bridge-connector.js`

**Método `buildBridgeQuery(query, dataType, memory)`:**

**Análise inteligente:**
- Extrai período da query (GPT-5 Mini com prompt específico)
- Extrai categoria se mencionada
- Determina action do bridge (summary, list, ranking)
- Monta estrutura de requisição

**Exemplos de mapeamento:**

| Query do Usuário | Bridge Request |
|------------------|----------------|
| "Quanto gastei este mês?" | `{ action: 'summary', domain: 'transactions', period: 'mesAtual', type: 'expense' }` |
| "Top 5 despesas" | `{ action: 'ranking', domain: 'transactions', rankingType: 'topExpenses', limit: 5 }` |
| "Minhas dívidas" | `{ action: 'summary', domain: 'debts' }` |
| "Saldo em conta" | `{ action: 'summary', domain: 'transactions', section: 'statement' }` |

**Estrutura de requisição:**
```javascript
{
  userId: string,
  action: 'summary' | 'list' | 'ranking',
  domain: 'transactions' | 'debts' | 'credit_cards' | 'scheduled',
  filters: {
    period: string,      // 'mesAtual', '30d', 'custom'
    type: string,        // 'income', 'expense', 'all'
    category: string,    // Se especificado
    minValue: number,    // Opcional
    maxValue: number     // Opcional
  },
  rankingType: string,   // Se action = 'ranking'
  limit: number          // Limite de resultados
}
```

---

#### Tarefa 2.3: Processador de respostas do Bridge
**Arquivo:** `server/src/agents/junior/simplista/finance-bridge-connector.js`

**Método `processResponse(bridgeResponse, originalQuery)`:**

**Responsabilidades:**
- Extrair dados relevantes da resposta do bridge
- Formatar valores monetários (R$ X.XXX,XX)
- Criar resumo textual dos dados
- Adicionar comparações simples (vs mês anterior)

**Exemplo de processamento:**
```javascript
// Bridge retorna:
{
  success: true,
  summary: {
    totalIncome: 8500,
    totalExpense: 6200,
    balance: 2300,
    topCategory: { name: 'Alimentação', value: 1200 }
  }
}

// Processado para:
{
  textual: '💰 RECEITAS: R$ 8.500,00\n💸 DESPESAS: R$ 6.200,00\n📈 SOBRA: R$ 2.300,00\n\nMaior gasto: Alimentação (R$ 1.200)',
  structured: { ... },
  comparison: '+15% vs mês anterior'
}
```

---

#### Tarefa 2.4: Sistema de fallback
**Arquivo:** `server/src/agents/junior/simplista/finance-bridge-connector.js`

**Estratégias de fallback:**
1. **Erro de conexão:** Responde com base na memória recente
2. **Sem dados:** Informa que não há registros para o período
3. **Timeout:** Usa cache se disponível, senão informa problema temporário

**Exemplo de resposta com fallback:**
```
"Estou tendo dificuldade para acessar seus dados no momento. 
Pela nossa última conversa, lembro que você tinha cerca de R$ 3.000 em conta. 
Posso tentar novamente ou você prefere fazer outra pergunta?"
```

---

### Objetivo 3: Integração Direta com Serper

#### Tarefa 3.1: Detector de necessidade de dados externos
**Arquivo:** `server/src/agents/junior/simplista/serper-connector.js`

**Método `shouldUseSerper(query)`:**
```javascript
class SerperConnector {
  shouldQuery(query) {
    // Padrões que exigem Serper
    const patterns = {
      COTACAO: /cotação|preço|quanto (está|custa)|valor de|ação/i,
      INDICADORES: /p\/l|roe|dividend|margem|lucro/i,
      MOEDA: /dólar|euro|real|câmbio/i,
      INDICES: /selic|ipca|cdi|ibovespa|sp500/i,
      FATOS: /sede|ceo|fundada|empresa|quem é/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(query)) {
        return { needed: true, dataType: type };
      }
    }

    return { needed: false, dataType: null };
  }
}
```

---

#### Tarefa 3.2: Wrapper para chamadas ao Serper
**Arquivo:** `server/src/agents/junior/simplista/serper-connector.js`

**Método `callSerper(query, dataType, options)`:**

**Responsabilidades:**
- Instanciar cliente Serper (importar de `research/api-clients/serper-client.js`)
- Adaptar query para busca eficiente
- Processar resposta do Serper
- Implementar timeout de 10 segundos

**Exemplo de uso:**
```javascript
async callSerper(query, dataType, options = {}) {
  const SerperClient = require('../../research/api-clients/serper-client');
  const serper = new SerperClient({ timeout: 10000 });

  try {
    // Adapta query baseado no tipo
    const searchQuery = this._adaptQuery(query, dataType);
    
    // Chama Serper
    const response = await serper.search(searchQuery, {
      num: 3,           // Apenas 3 resultados para ser rápido
      gl: 'br',
      hl: 'pt'
    });

    // Processa resposta
    return this._processSerperResponse(response, dataType);
    
  } catch (error) {
    console.error('[Simplista] Erro no Serper:', error.message);
    return { success: false, error: error.message };
  }
}
```

**Adaptação de queries:**
| Tipo | Query Original | Query para Serper |
|------|---------------|-------------------|
| COTACAO | "Qual preço da Petrobras?" | "PETR4 cotação hoje" |
| MOEDA | "Quanto está o dólar?" | "dólar comercial hoje" |
| FATOS | "Sede da Vale" | "Vale S.A. sede localização" |

---

#### Tarefa 3.3: Enriquecimento com dados externos
**Arquivo:** `server/src/agents/junior/simplista/serper-connector.js`

**Método `enrichWithExternalData(internalData, externalData, query)`:**

**Combina dados internos + externos:**
- Dados internos do FinanceBridge
- Dados externos do Serper
- Contexto da query original

**Exemplo:**
```javascript
// Query: "Quanto está o dólar e quanto tenho em conta?"
// internalData: { saldo: 5230 }
// externalData: { dolarComercial: 5.23 }

// Resultado enriquecido:
`
💵 DÓLAR COMERCIAL: R$ 5,23 (fonte: Banco Central)
💰 SEU SALDO: R$ 5.230,00

📊 Com seu saldo atual, você pode comprar aproximadamente US$ 999.

Quer ver como está o câmbio nos últimos dias ou fazer uma análise completa?
`
```

---

#### Tarefa 3.4: Sistema de cache para Serper
**Arquivo:** `server/src/agents/junior/simplista/simplista-cache.js`

**Implementação simples:**
```javascript
class SimplistaCache {
  constructor() {
    this.cache = new Map();
  }

  set(key, value, ttlMinutes) {
    const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  generateKey(query, dataType) {
    // Hash simples para chave
    return `${dataType}:${query.toLowerCase().replace(/\s+/g, '_')}`;
  }
}
```

**TTL por tipo:**
- Cotações: 300 minutos (5h)
- Indicadores econômicos: 300 minutos (5h)
- Fatos triviais: 4320 minutos (72h)

---

### Objetivo 4: Sistema de Diálogo e Resposta Enriquecida

#### Tarefa 4.1: Gerenciador de queries ambíguas
**Arquivo:** `server/src/agents/junior/simplista/dialogue-manager.js`

**Método `handleAmbiguousQuery(query, userId, ambiguityType)`:**

**Fluxo de diálogo:**
```
1. Detecta ambiguidade (QueryClassifier)
2. Gera pergunta de esclarecimento específica
3. Marca contexto ativo para userId
4. Aguarda resposta do usuário
5. Junior detecta contexto ativo → encaminha resposta
6. Processa resposta + query original
7. Retorna resposta final
```

**Exemplos de perguntas de esclarecimento:**

| Ambiguidade | Pergunta Gerada |
|-------------|-----------------|
| Período indefinido | "Qual período você quer consultar? Este mês, último mês ou outro?" |
| Categoria vaga | "Que tipo de despesa? Alimentação, transporte, saúde?" |
| Conta não especificada | "Saldo de qual conta? Corrente, poupança ou investimento?" |

**Estrutura de contexto:**
```javascript
{
  userId: '507f...',
  originalQuery: 'Quanto gastei',
  ambiguityType: 'PERIOD',
  questionAsked: 'Qual período...',
  timestamp: Date.now(),
  attempts: 1
}
```

**Limites:**
- Máximo 2-3 trocas de diálogo
- Timeout de 5 minutos (após isso, reseta contexto)
- Se ambiguidade persiste, sugere ser mais específico

---

#### Tarefa 4.2: Construtor de respostas enriquecidas
**Arquivo:** `server/src/agents/junior/simplista/response-builder.js`

**Método `buildEnrichedResponse(data, query, sources)`:**

**Estrutura da resposta:**
```
┌─────────────────────────────────────────────────────┐
│              RESPOSTA ENRIQUECIDA                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. DADOS FACTUAIS                                  │
│     - Números formatados                            │
│     - Informações objetivas                         │
│                                                     │
│  2. LEVE INTERPRETAÇÃO                              │
│     - 1-2 insights rasas                            │
│     - Comparação simples                            │
│                                                     │
│  3. SUGESTÃO RASA (opcional)                        │
│     - Dica básica sem ser invasivo                  │
│                                                     │
│  4. CONVITE PARA APROFUNDAMENTO                     │
│     - "Quer detalhes como..."                       │
│     - Sugestões contextualizadas                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Exemplo real:**
```
📊 RESUMO GERAL - Janeiro 2026

💰 RECEITAS: R$ 8.500,00
💸 DESPESAS: R$ 6.200,00
📈 SOBRA: R$ 2.300,00

📅 Comparado ao mês passado:
- Receitas: +5% 
- Despesas: -2%
- Sobra: +15%

💡 Sua situação está saudável, com sobra positiva consistente. 
Que tal focar em aumentar um pouco mais a reserva de emergência?

Quer detalhes como uma análise completa das suas finanças ou 
plano para investir essa sobra?
```

**Formatação:**
- Emojis para visual clean (✅ opcional)
- Valores monetários sempre em R$ X.XXX,XX
- Percentuais com sinal (+ ou -)
- Quebras de linha para legibilidade

---

#### Tarefa 4.3: Detecção de transição para complexo
**Arquivo:** `server/src/agents/junior/simplista/response-builder.js`

**Método `detectComplexTransition(userMessage)`:**

**Keywords de transição:**
```javascript
const COMPLEX_KEYWORDS = [
  'analise completa',
  'análise detalhada',
  'planeje',
  'estratégia',
  'como devo',
  'o que fazer',
  'recomende',
  'sugira investimentos',
  'monte um plano'
];
```

**Comportamento:**
- Detecta keywords na mensagem do usuário
- Retorna flag `{ shouldTransition: true, suggestedDomain: 'analises' }`
- Simplista encerra e sinaliza para Junior reclassificar

**Exemplo de fluxo:**
```
User: "Quanto gastei este mês?"
Simplista: [responde com dados]

User: "Faça uma análise completa dos meus gastos"
Simplista: [detecta transição] → retorna flag especial

Junior: [recebe flag] → reclassifica como COMPLEXA → rota para coordenadores
```

---

#### Tarefa 4.4: Gerador de convites contextualizados
**Arquivo:** `server/src/agents/junior/simplista/response-builder.js`

**Método `generateDeepeningOffer(query, dataProvided)`:**

**Convites baseados no contexto:**

| Query Original | Dados Fornecidos | Convite Gerado |
|----------------|------------------|----------------|
| "Quanto gastei?" | Resumo de gastos | "Quer uma análise detalhada de onde você pode economizar?" |
| "Minhas dívidas" | Lista de dívidas | "Quer um plano de quitação estratégico dessas dívidas?" |
| "Saldo em conta" | Saldo atual | "Quer sugestões de como investir esse valor?" |
| "Quanto investi?" | Total investido | "Quer uma análise de rentabilidade e rebalanceamento?" |

**Lógica:**
- Analisa tipo de dado fornecido
- Usa GPT-5 Mini para gerar convite personalizado
- Sempre oferece 2 opções de aprofundamento
- Mantém tom amigável e não invasivo

**Exemplo de geração:**
```javascript
async generateDeepeningOffer(query, dataProvided) {
  const prompt = `
Baseado na query "${query}" e nos dados fornecidos (resumo),
gere um convite curto e direto para aprofundamento.

Formato: "Quer [opção 1] ou [opção 2]?"

Exemplos:
- "Quer uma análise completa dos seus gastos ou plano de economia?"
- "Quer estratégia de quitação ou consolidação de dívidas?"

Gere apenas o convite, sem explicações.
  `;

  const offer = await callOpenAI(
    'Você é o Simplista. Gere convites curtos para aprofundamento.',
    prompt,
    { verbosity: 'low', reasoning: 'low' }
  );

  return offer.trim();
}
```

---

## 🔄 Fluxo Completo de Execução

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO - SIMPLISTA                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. ENTRADA                                                         │
│     └─ Junior chama Simplista.execute({ message, userId, memory }) │
│                                                                     │
│  2. VERIFICAÇÃO DE DIÁLOGO ATIVO                                    │
│     ├─ Tem contexto ativo? → Processa resposta ao diálogo          │
│     └─ Não → Continua fluxo normal                                 │
│                                                                     │
│  3. CLASSIFICAÇÃO DA QUERY                                          │
│     ├─ QueryClassifier.isAmbiguous() → Se sim: inicia diálogo      │
│     ├─ QueryClassifier.needsFinanceData() → Marca flag             │
│     ├─ QueryClassifier.needsExternalData() → Marca flag            │
│     └─ QueryClassifier.isTransitionToComplex() → Flag especial     │
│                                                                     │
│  4. COLETA DE DADOS                                                 │
│     ├─ Se needsFinanceData:                                         │
│     │   ├─ FinanceBridgeConnector.buildBridgeQuery()               │
│     │   ├─ Chama FinanceDataBridge.execute()                       │
│     │   └─ FinanceBridgeConnector.processResponse()                │
│     │                                                               │
│     ├─ Se needsExternalData:                                        │
│     │   ├─ SerperConnector.callSerper()                            │
│     │   ├─ Cache check primeiro                                    │
│     │   └─ SerperConnector.processResponse()                       │
│     │                                                               │
│     └─ Se ambos: SerperConnector.enrichWithExternalData()          │
│                                                                     │
│  5. GERAÇÃO DE RESPOSTA                                             │
│     ├─ ResponseBuilder.buildEnrichedResponse()                     │
│     │   ├─ Formata dados factuais                                  │
│     │   ├─ Adiciona leve interpretação                             │
│     │   ├─ Sugere insight raso                                     │
│     │   └─ Gera convite de aprofundamento                          │
│     │                                                               │
│     └─ Se erro: ResponseBuilder.buildFallbackResponse()            │
│                                                                     │
│  6. SAÍDA                                                           │
│     └─ Retorna:                                                     │
│         {                                                           │
│           resposta: string,                                         │
│           metadata: {                                               │
│             tempoExecucao: number,                                  │
│             fontesConsultadas: ['FinanceBridge', 'Serper'],         │
│             ofereceuAprofundamento: boolean,                        │
│             dialogoIniciado: boolean,                               │
│             transitionFlag: boolean                                 │
│           }                                                         │
│         }                                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 System Prompts

### System Prompt Principal (Simplista)
**Arquivo:** Será definido na implementação

**Estrutura:**
```
Você é o Agente Simplista, especializado em respostas RÁPIDAS e DIRETAS 
sobre finanças pessoais.

SUAS CARACTERÍSTICAS:
- Fornece informações factuais + leve interpretação
- Sempre oferece aprofundamento ("quer detalhes como...")
- Não faz análises profundas
- Não dá recomendações complexas
- Responde em 2-3 segundos

FORMATO DE RESPOSTA:
1. Dados factuais (números, informações objetivas)
2. Leve interpretação (1-2 insights rasos)
3. Sugestão rasa (opcional, se relevante)
4. Convite para aprofundamento (sempre)

EXEMPLOS:
[incluir 5-10 exemplos de queries e respostas ideais]

DADOS DISPONÍVEIS:
- Dados internos: [resumo dos dados fornecidos pelo bridge]
- Dados externos: [resumo dos dados do Serper]
- Memória: [contexto da conversa]

QUERY DO USUÁRIO:
{query}

Responda seguindo o formato acima. Seja claro, útil e conciso.
```

---

### System Prompt para Análise de Ambiguidade
**Uso:** Decidir se precisa iniciar diálogo

```
Analise a query abaixo e determine se é ambígua.

QUERY: "{query}"
MEMÓRIA: "{memory_summary}"

Uma query é ambígua se:
- Falta especificar período (este mês? último? ano?)
- Falta especificar categoria (alimentação? transporte?)
- Falta especificar conta (corrente? investimento?)
- Termo vago sem contexto

Responda em JSON:
{
  "ambigua": boolean,
  "motivo": string,
  "pergunta_esclarecimento": string (se ambígua)
}
```

---

### System Prompt para Construção de Query Bridge
**Uso:** GPT-5 Mini ajuda a montar requisição ao bridge

```
Extraia parâmetros da query do usuário para consultar dados financeiros.

QUERY: "{query}"

Identifique:
1. Período: "mesAtual", "mesAnterior", "30d", "7d", "custom"
2. Tipo: "income", "expense", "all"
3. Categoria: se especificada (alimentação, transporte, etc.)
4. Action: "summary", "list", "ranking"

Responda em JSON:
{
  "period": string,
  "type": string,
  "category": string | null,
  "action": string
}
```

---

## 🧪 Testes Estratégicos

### Teste 1: Query Simples com Dados Internos
```javascript
// Query: "Quanto gastei este mês?"
// Deve: Consultar FinanceBridge → Retornar resumo + convite

const result = await simplista.execute({
  message: 'Quanto gastei este mês?',
  userId: '507f1f77bcf86cd799439011',
  memory: { ... }
});

// Validações:
// ✅ result.metadata.fontesConsultadas.includes('FinanceBridge')
// ✅ result.resposta.includes('R$')
// ✅ result.metadata.ofereceuAprofundamento === true
// ✅ result.metadata.tempoExecucao < 3000 (3s)
```

---

### Teste 2: Query com Dados Externos (Serper)
```javascript
// Query: "Qual o preço da PETR4?"
// Deve: Consultar Serper → Cache → Retornar cotação + convite

const result = await simplista.execute({
  message: 'Qual o preço da PETR4?',
  userId: '507f1f77bcf86cd799439011',
  memory: { ... }
});

// Validações:
// ✅ result.metadata.fontesConsultadas.includes('Serper')
// ✅ result.resposta.match(/R\$ \d+,\d{2}/)
// ✅ Cache deve ter entrada com TTL de 5h
```

---

### Teste 3: Query Ambígua (Diálogo)
```javascript
// Query: "Quanto gastei?"
// Deve: Detectar ambiguidade → Perguntar período

const result = await simplista.execute({
  message: 'Quanto gastei?',
  userId: '507f1f77bcf86cd799439011',
  memory: { ... }
});

// Validações:
// ✅ result.metadata.dialogoIniciado === true
// ✅ result.resposta.includes('Qual período')
// ✅ Contexto de diálogo criado para userId

// Segunda mensagem (resposta ao diálogo):
const result2 = await simplista.execute({
  message: 'Este mês',
  userId: '507f1f77bcf86cd799439011',
  memory: { ... }
});

// Validações:
// ✅ result2.metadata.dialogoIniciado === false
// ✅ result2.resposta.includes('R$')
// ✅ Contexto de diálogo removido
```

---

### Teste 4: Query Mista (Interno + Externo)
```javascript
// Query: "Quanto está o dólar e quanto tenho em conta?"
// Deve: Consultar Serper + FinanceBridge → Combinar dados

const result = await simplista.execute({
  message: 'Quanto está o dólar e quanto tenho em conta?',
  userId: '507f1f77bcf86cd799439011',
  memory: { ... }
});

// Validações:
// ✅ result.metadata.fontesConsultadas.length === 2
// ✅ result.resposta.includes('DÓLAR') && result.resposta.includes('SALDO')
// ✅ Enriquecimento: "você pode comprar aproximadamente"
```

---

### Teste 5: Transição para Complexo
```javascript
// Primeira query simples, depois pede análise completa

const result1 = await simplista.execute({
  message: 'Quanto gastei este mês?',
  userId: '507f1f77bcf86cd799439011',
  memory: { ... }
});

const result2 = await simplista.execute({
  message: 'Faça uma análise completa dos meus gastos',
  userId: '507f1f77bcf86cd799439011',
  memory: { ... }
});

// Validações:
// ✅ result2.metadata.transitionFlag === true
// ✅ result2.metadata.suggestedDomain === 'analises'
// ✅ Junior deve receber flag e reclassificar
```

---

### Teste 6: Fallback (Erro no Bridge)
```javascript
// Simular erro de conexão com MongoDB

const result = await simplista.execute({
  message: 'Quanto gastei este mês?',
  userId: '507f1f77bcf86cd799439011',
  memory: { 
    recent: [
      { role: 'assistant', content: 'Você tinha R$ 3.000 em conta' }
    ]
  }
});

// Validações:
// ✅ result.resposta.includes('dificuldade para acessar')
// ✅ result.resposta.includes('3.000') // usa memória
// ✅ result.metadata.fontesConsultadas.includes('Memory')
```

---

## 🎯 Critérios de Sucesso

| Métrica | Alvo | Como Medir |
|---------|------|------------|
| Tempo médio de resposta | < 3s | `metadata.tempoExecucao` |
| Taxa de uso do Bridge | > 60% | Queries que consultam dados internos |
| Taxa de uso do Serper | ~20% | Queries que consultam dados externos |
| Taxa de diálogo iniciado | < 15% | Queries ambíguas |
| Taxa de oferecimento de aprofundamento | 100% | Todas as respostas devem oferecer |
| Taxa de transição para complexo | ~10% | Usuários que pedem análise profunda |
| Satisfação da resposta | Qualitativa | Respostas claras e úteis |

---

## 📝 Observações Finais

### Pontos de Atenção
1. **Velocidade:** Simplista deve ser RÁPIDO. Timeout máximo de 3s para resposta completa
2. **Clareza:** Respostas devem ser diretas, sem jargão técnico excessivo
3. **Equilíbrio:** Fatos + leve interpretação + convite (não ser robótico nem invasivo)
4. **Transições:** Detectar quando usuário quer análise profunda e sinalizar corretamente

### Integrações Essenciais
- ✅ FinanceDataBridge (já implementado)
- ✅ Serper via Research Agent (já implementado)
- ✅ Sistema de Memória do Junior (já implementado)
- ⚠️ Interface com Junior (precisa adaptar junior-agent.js para chamar Simplista)

### Próximos Passos Após Implementação
1. Testes integrados com Junior
2. Validação de performance (< 3s)
3. Refinamento de prompts baseado em casos reais
4. Ajuste de TTL de cache baseado em uso
5. Monitoramento de taxa de transição para complexo

---

## 📚 Referências

- [README Simplista](../server/src/agents/junior/simplista/README.md) - Visão conceitual
- [README Junior](../server/src/agents/junior/junior/README.md) - Integração com Junior
- [Relatório FinanceDataBridge](./relatorio-implementacao-finance-data-bridge.md) - API de dados internos
- [Relatório Research Agent](./relatorio-research-agent.md) - Sistema de pesquisa externa
- [Relatório Junior V2](./relatorio-implementacao-junior-v2.md) - Contexto de triagem

---

**Pronto para implementação!** 🚀
