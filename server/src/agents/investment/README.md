---
agente de investimentos:
## 3. Arquitetura conceitual do agente

O Agente de Investimentos opera em um **ciclo ReAct próprio**, adaptado à sua especialização, integrando o banco de frameworks hierárquicos para garantir raciocínio guiado e explicável. O ciclo combina planejamento estratégico de investimentos, execução operacional, avaliação contínua e consolidação final, alinhado com a autonomia de coordenadores no sistema multi-agente.

## Memória e Contexto

- O Agente de Investimentos recebe o contexto unificado via `context-builder`: `workingMemory`, `episodicSummary` e `prompt_current` são usados para contextualizar decisões e respeitar histórico do usuário.
- Uso prático: `episodicSummary` ajuda a identificar decisões de investimento anteriores, alocações e restrições pessoais; `workingMemory` provê parâmetros temporários da sessão.
- Acesso a LTM: quando necessário, o Investimentos pode consultar o `profile-manager` para dados permanentes do usuário.
- Restrições: o Agente Matemático e o Agente de Pesquisa Externa não recebem o contexto episódico/working para manter a separação de responsabilidades.


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

## 4. 🔀 Ciclo ReAct do Agente de Investimentos

O ciclo ReAct é adaptado para decisões de investimento, com ênfase em estratégia, alocação e seleção de ativos. O agente pensa como um **gestor de fundos renomado**, priorizando diversificação, gestão de risco e horizonte de investimento.

**Ciclo N - PLANEJAMENTO (primeiro ciclo):**

1. Recebe o pacote de missão do orquestrador (objetivo estratégico, query do usuário, contratos de agentes, orçamento, timeout).
2. Classifica a intenção de investimento: "Que tipo de decisão de investimento esse pedido exige?" (ex.: alocação de carteira, análise de ativo específico, gestão de risco).
3. Consulta o banco de frameworks (níveis 1 e 2) para selecionar frameworks centrais e secundários adequados.
4. Define plano de execução: quais agentes executores chamar (ex.: acessa diretamente o Sistema de Acesso a Dados Internos para dados de investimentos), ordem de operações e dependências.
5. Avalia orçamento e tempo restante; prioriza operações críticas.

**Ciclo N+1, N+2... - EXECUÇÃO:**

1. Acessa diretamente o Sistema de Acesso a Dados Internos (ex.: consulta dados de investimentos via categorias e filtros).
2. Aplica frameworks selecionados: carrega "modo de pensar" (etapas, métricas) e processa dados.
3. Monitora progresso: valida respostas, usa fallbacks se necessário, acumula consumo de recursos.
4. Se orçamento crítico ou tempo baixo, prioriza finalização.

**Ciclo N+X - AVALIAÇÃO CONTÍNUA:**

1. Após cada bloco de operações, pergunta: "Objetivo foi suficientemente alcançado? Dados faltantes impactam qualidade?"
2. Calcula custo-benefício de operações futuras baseado em frameworks (ex.: se análise de risco é essencial, executa mesmo com recursos limitados).
3. Decide continuar ou consolidar; documenta limitações.

**Ciclo N+FINAL - CONSOLIDAÇÃO:**

1. Agrega todos os outputs em resposta estruturada.
2. Aplica validação final baseada em frameworks (ex.: verifica se alocação respeita perfil de risco).
3. Reporta ao orquestrador com metadados (recursos consumidos, status).

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
