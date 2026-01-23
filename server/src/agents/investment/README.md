---
# AGENTE DE INVESTIMENTOS (COORDENADOR)

## 📋 Status de Implementação

**FUTURO** - Este agente será implementado quando houver demanda por estratégias de investimento personalizadas.

**Arquitetura atual:**
- ✅ Junior Agent: Triagem e roteamento
- ✅ DataAgent: Acesso a dados MongoDB
- 🔜 Simplista Agent: Consultas simples
- 🔜 Lançador Agent: Lançamentos transacionais
- 📅 **Investment Agent**: Estratégias de investimento (este documento)

---

## 3. Arquitetura conceitual do agente

O Agente de Investimentos opera como um **coordenador autônomo** especializado em estratégias de investimento e alocação de carteira. Integra o banco de frameworks hierárquicos para garantir raciocínio guiado e explicável, pensando como um **gestor de fundos renomado**, priorizando diversificação, gestão de risco e horizonte de investimento.

## Memória e Contexto

- O Agente de Investimentos receberá contexto unificado via `context-builder` quando implementado: `workingMemory`, `episodicSummary` e `prompt_current` serão usados para contextualizar decisões e respeitar histórico do usuário.
- **Uso prático:** `episodicSummary` ajudará a identificar decisões de investimento anteriores, alocações e restrições pessoais; `workingMemory` proverá parâmetros temporários da sessão.
- **Acesso a dados:** Quando necessário, poderá consultar o DataAgent para dados financeiros do usuário (saldos, investimentos atuais, perfil de risco).
- **Agentes auxiliares:** Na v2.0+, Math Agent e Research Agent não receberão contexto episódico/working para manter separação de responsabilidades - receberão apenas dados estruturados necessários.


### 📚 Banco de Frameworks (diferencial central)

O banco de frameworks é a base do raciocínio do agente. Ele é estruturado hierarquicamente (níveis 1, 2 e 3) e contém:

- **Framework**
    
- **Objetivo**
    
- **Premissas**
    
- **Etapas**
    
- **Métricas**
    
- **Limitações**
    

O agente **não inventa** a lógica. Ele **consulta** o banco para selecionar e aplicar frameworks adequados ao prompt do usuário.

---

### 🧩 Camada 3 – Motor de raciocínio guiado

O agente:

1. Seleciona o framework adequado
    
2. Carrega o "modo de pensar"
    
3. Aplica o framework aos dados do usuário
    
4. Gera conclusões **seguindo a estrutura**
    

Isso garante:

- Consistência
    
- Reprodutibilidade
    
- Explicabilidade

---

## 4. 🔀 Ciclo de Execução Autônomo para Investimentos

O ciclo de execução é adaptado para decisões de investimento, com ênfase em estratégia, alocação e seleção de ativos.

**Fase 1 - PLANEJAMENTO:**

1. Recebe requisição com query do usuário e contexto unificado
2. Classifica a intenção de investimento: "Que tipo de decisão de investimento esse pedido exige?" (ex.: alocação de carteira, análise de ativo específico, gestão de risco)
3. Consulta o banco de frameworks (níveis 1 e 2) para selecionar frameworks centrais e secundários adequados
4. Define plano de execução: quais dados buscar (DataAgent para investimentos atuais, Research Agent para dados de mercado - futuro)
5. Estima complexidade e prioriza operações críticas

**Fase 2 - COLETA DE DADOS:**

1. Acessa DataAgent para dados de investimentos do usuário via ações estruturadas
2. Na v2.0+: Acessa Research Agent para dados de mercado (cotações, fundamentalistas)
3. Valida dados e identifica gaps
4. Organiza informações para aplicação dos frameworks

**Fase 3 - APLICAÇÃO DE FRAMEWORKS:**

1. Aplica frameworks selecionados: carrega "modo de pensar" (etapas, métricas) e processa dados
2. Executa análises de alocação, risco, diversificação conforme framework
3. Na v2.0+: Pode delegar cálculos complexos ao Math Agent
4. Monitora progresso e ajusta se necessário

**Fase 4 - CONSOLIDAÇÃO:**

1. Agrega todos os outputs em resposta estruturada
2. Aplica validação final baseada em frameworks (ex.: verifica se alocação respeita perfil de risco)
3. Formata resposta no padrão de contrato com metadados
4. Retorna estratégia completa ao chamador

---

## 5. Como estruturar o banco de dados de frameworks (modelo hierárquico)

### NÍVEL 1 — Frameworks Centrais (Investimentos)

Esse é o **JSON inicial** que o agente vê.

Ele responde:

> "Qual tipo de decisão de investimento esse pedido exige?"

#### Exemplo — Frameworks Centrais de Investimentos

```json
[
  {
    "framework_id": "DEFINICAO_DE_OBJETIVOS_E_HORIZONTE",
    "quando_usar": [
      "Início de jornada de investimentos",
      "Mudança de estratégia",
      "Novo objetivo financeiro"
    ]
  },
  {
    "framework_id": "ALOCACAO_DE_ATIVOS",
    "quando_usar": [
      "Montagem de carteira",
      "Rebalanceamento",
      "Diversificação"
    ]
  },
  {
    "framework_id": "ANALISE_DE_RENDA_FIXA",
    "quando_usar": [
      "Tesouro Direto",
      "CDB",
      "LCI/LCA",
      "Bonds"
    ]
  },
  {
    "framework_id": "ANALISE_DE_RENDA_VARIAVEL",
    "quando_usar": [
      "Ações",
      "ETFs",
      "FIIs",
      "Stock picking"
    ]
  },
  {
    "framework_id": "GESTAO_DE_RISCO_E_VOLATILIDADE",
    "quando_usar": [
      "Proteção de carteira",
      "Eventos macroeconômicos",
      "Alta incerteza"
    ]
  },
  {
    "framework_id": "ANALISE_MACROECONOMICA",
    "quando_usar": [
      "Cenário de juros",
      "Inflação",
      "Ciclo econômico"
    ]
  }
]
```

---

### NÍVEL 2 — Frameworks Secundários (por classe e método)

Após escolher um ou mais frameworks centrais, o agente acessa **frameworks secundários especializados**.

#### Exemplo — Framework Central: `ANALISE_DE_RENDA_FIXA`

```json
{
  "framework_central_id": "ANALISE_DE_RENDA_FIXA",
  "frameworks_secundarios": [
    {
      "framework_id": "ANALISE_DE_TITULOS_PUBLICOS",
      "quando_usar": [
        "Tesouro Selic",
        "Tesouro IPCA",
        "Tesouro Prefixado"
      ]
    },
    {
      "framework_id": "ANALISE_DE_CREDITO_PRIVADO",
      "quando_usar": [
        "CDB",
        "LCI",
        "LCA",
        "Debêntures"
      ]
    },
    {
      "framework_id": "ANALISE_DE_BONDS_INTERNACIONAIS",
      "quando_usar": [
        "Bonds",
        "Treasuries",
        "Risco cambial"
      ]
    }
  ]
}
```

---

### NÍVEL 3 — Conteúdo completo (exemplo)

#### Framework Secundário: `ANALISE_FUNDAMENTALISTA_DE_EMPRESAS`

```json
{
  "framework_id": "ANALISE_FUNDAMENTALISTA_DE_EMPRESAS",
  "objetivo": "Avaliar qualidade e preço de empresas listadas",
  "etapas": [
    "Análise do modelo de negócio",
    "Análise de receitas e margens",
    "Avaliação de endividamento",
    "Retorno sobre capital",
    "Geração de caixa",
    "Valuation"
  ],
  "metricas_chave": [
    "ROE",
    "ROIC",
    "Margem EBITDA",
    "Dívida Líquida / EBITDA",
    "Free Cash Flow"
  ],
  "criterios_de_alerta": [
    "Queda recorrente de margens",
    "Aumento excessivo de dívida",
    "Diluição frequente"
  ],
  "metodos_de_valuation": [
    "Fluxo de Caixa Descontado",
    "Múltiplos"
  ]
}
```

---

## 6. 🔀 Exemplo prático — múltiplos frameworks combinados

### Pergunta do usuário:

> "Tenho perfil moderado, quero investir pensando em aposentadoria e também quero analisar ações específicas."

---

### 🔹 Passo 1 — Frameworks centrais escolhidos

```json
[
  "DEFINICAO_DE_OBJETIVOS_E_HORIZONTE",
  "ALOCACAO_DE_ATIVOS",
  "ANALISE_DE_RENDA_VARIAVEL"
]
```

---

### 🔹 Passo 2 — Frameworks secundários

- DEFINICAO_DE_OBJETIVOS_E_HORIZONTE  
    → DEFINICAO_DE_PERFIL_DE_RISCO (moderado)
    
- ALOCACAO_DE_ATIVOS  
    → CARTEIRA_BALANCEADA_LONGO_PRAZO
    
- ANALISE_DE_RENDA_VARIAVEL  
    → ANALISE_FUNDAMENTALISTA_DE_EMPRESAS  
    → ANALISE_DE_ETFS
    

---

### 🔹 Passo 3 — Execução

O agente:

- Define percentuais de alocação (ex.: 50% renda fixa, 40% renda variável, 10% alternativos)
    
- Avalia risco agregado da carteira
    
- Analisa empresas individualmente (ROE, margens, valuation)
    
- Sugere exposição passiva + ativa
    
- Indica riscos e cenários adversos (ex.: recessão, alta inflação)
    

---

### 🔹 Passo 4 — Resposta final

A resposta não é:

> "Invista em ações"

Mas:

- Alocação recomendada com justificativas
    
- Ativos específicos selecionados
    
- Estratégia de rebalanceamento
    
- Plano de contingência para volatilidade
    

---

## Colaboração com Outros Coordenadores

O Agente de Investimentos pode colaborar com outros coordenadores quando queries envolvem domínios sobrepostos, como análise financeira ou planejamento. Por exemplo:

- **Quando chamar outro coordenador:** Se o investimento requer análise de situação atual, chama o Agente de Análise Financeira Pessoal para dados de renda/dívidas; se envolve planejamento de longo prazo, chama o Agente de Planejamento Financeiro.
- **Como estruturar requisição:** Envia pacote via Message Bus com objetivo específico (ex.: "Integre alocação de ativos com plano financeiro"), contratos e orçamento compartilhado.
- **Integração de respostas:** Combina frameworks do Investimento com outputs do outro coordenador, evitando loops.
- **Cenários comuns:** Em queries de investimento complexo, o Investimento coordena com o Analista para avaliação de capacidade de risco, garantindo resposta holística.
- **Nota sobre Agente Matemático:** Quando chamar o Agente Matemático para cálculos de investimento (valuation, risco, retorno), fornecer dados base; o Matemático pode obter dados externos adicionais diretamente do Agente de Pesquisa Externa se necessário.
