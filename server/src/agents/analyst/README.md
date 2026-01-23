
    

---
agente analista de finanças pessoais:
## 3. Arquitetura conceitual do agente

O Agente Analista de Finanças Pessoais opera em um **ciclo ReAct próprio**, adaptado à sua especialização, integrando o banco de frameworks hierárquicos para garantir raciocínio guiado e explicável. O ciclo combina planejamento estratégico, execução operacional, avaliação contínua e consolidação final, alinhado com a autonomia de coordenadores no sistema multi-agente.

## 8. 💾 Sistema de Memória

Como **coordenador**, o Agente Analista recebe automaticamente a **Memória de Contexto (Chat)** e a **Memória Interna** na sua integralidade de outros agentes coordenadores, garantindo continuidade e acesso completo aos processos anteriores.

**Recebe automaticamente:**
- **Memória de Contexto (Chat):** Working Memory (volátil), Episodic Memory (histórico da conversa), Long-Term Memory (perfil do usuário) - sempre enviada na integralidade.
- **Memória Interna:** Dados e processos preservados de execuções anteriores, identificados claramente como distintos do contexto histórico.

**Compartilha com outros coordenadores:**
- Sempre envia Memória de Contexto e Memória Interna na integralidade para garantir continuidade.

**Para executores:**
- Avalia se é relevante incluir elementos da memória; inclui apenas o necessário para evitar sobrecarga.

**Uso:** Utiliza toda a memória disponível para elaborar análises profundas integradas, considerando histórico completo do usuário e processos anteriores.

---

## 💾 Sistema de Acesso a Dados Internos

Como agente de IA coordenador, o Agente Analista tem **acesso direto e inteligente** ao Sistema de Acesso a Dados Internos, permitindo consultas dinâmicas aos dados financeiros do usuário durante o ciclo ReAct.

### Funcionamento do Acesso:
- **Categorias Iniciais:** Seleciona de categorias como `Dados_receitas_e_despesas`, `Dados_transacoes`, `Dados_dividas`, etc.
- **Filtros Dinâmicos:** Aplica filtros específicos (período, tipo, status) para refinar diagnósticos financeiros.
- **Iteração Inteligente:** Pode voltar às categorias, adicionar/remover filtros conforme a análise evolui.
- **Integração com IA:** Usa dados obtidos para alimentar frameworks de análise e ciclos ReAct.

### Exemplos de Uso:
- **Diagnóstico de Gastos:** Consulta `Dados_receitas_e_despesas` com filtros por tipo de despesa para identificar padrões de consumo.
- **Análise de Renda:** Filtra receitas por período para avaliar estabilidade financeira.
- **Avaliação de Dívidas:** Acessa dados de dívidas para calcular índices de endividamento.

Este acesso direto garante que as análises de IA sejam baseadas em dados reais e atualizados, maximizando a precisão dos diagnósticos financeiros.

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
    
2. Carrega o “modo de pensar”
    
3. Aplica o framework aos dados do usuário
    
4. Gera conclusões **seguindo a estrutura**
    

Isso garante:

- Consistência
    
- Reprodutibilidade
    
- Explicabilidade
    

---

### 🧾 Camada 4 – Output explicável

O resultado não é só:

> “Sim, pode comprar”

Mas:

- Qual framework foi usado
    
- Quais critérios passaram
    
- Quais falharam
    
- Riscos identificados
    
- Recomendações condicionais
    

### 🧠 Ciclo ReAct Adaptado para Análise Financeira

**Ciclo N - PLANEJAMENTO (primeiro ciclo):**

1. Recebe o pacote de missão do orquestrador (objetivo estratégico, query do usuário, contratos de agentes, orçamento, timeout).
2. Classifica a intenção financeira: "Que tipo de análise preciso executar?" (ex.: compra de ativo grande, endividamento, planejamento de longo prazo).
3. Consulta o banco de frameworks (níveis 1 e 2) para selecionar frameworks centrais e secundários adequados.
4. Define plano de execução: quais agentes executores chamar (ex.: acessa diretamente o Sistema de Acesso a Dados Internos para transações), ordem de operações e dependências.
5. Avalia orçamento e tempo restante; prioriza operações críticas.

**Ciclo N+1, N+2... - EXECUÇÃO:**

1. Acessa diretamente o Sistema de Acesso a Dados Internos (ex.: consulta dados de renda e dívidas via categorias e filtros).
2. Aplica frameworks selecionados: carrega "modo de pensar" (etapas, métricas) e processa dados.
3. Monitora progresso: valida respostas, usa fallbacks se necessário, acumula consumo de recursos.
4. Se orçamento crítico ou tempo baixo, prioriza finalização.

**Ciclo N+X - AVALIAÇÃO CONTÍNUA:**

1. Após cada bloco de operações, pergunta: "Objetivo foi suficientemente alcançado? Dados faltantes impactam qualidade?"
2. Calcula custo-benefício de operações futuras baseado em frameworks (ex.: se análise de risco é essencial, executa mesmo com recursos limitados).
3. Decide continuar ou consolidar; documenta limitações.

**Ciclo FINAL - CONSOLIDAÇÃO:**

1. Sintetiza resultados usando estrutura dos frameworks (ex.: quais critérios passaram/falharam, riscos, recomendações).
2. Estrutura resposta explicável: framework usado, métricas aplicadas, limitações.
3. Reporta ao orquestrador com metadados (recursos consumidos, status).

Isso garante consistência, reprodutibilidade e explicabilidade, alinhado com a autonomia do sistema.

---

## 4. # Como estruturar o banco de dados de frameworks (modelo hierárquico)

## Visão geral da lógica

O agente **não tem acesso direto ao conteúdo completo dos frameworks**.

Ele funciona assim:

1. O agente recebe a pergunta do usuário
    
2. Ele acessa um **JSON com frameworks centrais (nível 1)**  
    → só com **ID + quando usar**
    
3. Ele escolhe **1 ou mais frameworks centrais**
    
4. O sistema abre o framework central escolhido
    
5. Dentro dele existem **frameworks secundários (nível 2)**  
    → ainda **sem conteúdo detalhado**
    
6. O agente escolhe os frameworks secundários necessários
    
7. **Só então** o sistema libera:
    
    - etapas
        
    - métricas
        
    - lógica de decisão
        
    - critérios
        

👉 Isso força o agente a **planejar antes de executar**, exatamente como um analista humano.

---

## 🧠 NÍVEL 1 — Frameworks Centrais (visão macro)

Esse é o **único JSON que o agente vê inicialmente**.

Ele responde à pergunta:

> “Qual linha de raciocínio financeiro esse problema exige?”

### Exemplo: JSON de frameworks centrais

[
  {
    "framework_id": "ANALISE_DE_ENDIVIDAMENTO",
    "quando_usar": [
      "Dívidas elevadas",
      "Uso excessivo de crédito",
      "Financiamentos",
      "Cartão de crédito"
    ]
  },
  {
    "framework_id": "AVALIACAO_DE_ORCAMENTO_MENSAL",
    "quando_usar": [
      "Gastos excessivos",
      "Controle de despesas",
      "Análise de fluxo de caixa",
      "Otimização de custos"
    ]
  },
  {
    "framework_id": "GESTAO_DE_RENDA_E_CARREIRA",
    "quando_usar": [
      "Aumento de renda",
      "Instabilidade profissional",
      "Avaliação de risco financeiro"
    ]
  }
]


👉 Aqui **não existe método**, só **intenção e contexto**.

---

## 🧩 NÍVEL 2 — Frameworks Secundários (decisão específica)

Depois que o agente escolhe um ou mais frameworks centrais, o sistema libera **os frameworks secundários associados àqueles centrais**.

Eles respondem:

> “Qual análise específica preciso executar dentro dessa linha de pensamento?”

---

### Exemplo: conteúdo interno de um framework central

#### Framework Central: `ANALISE_DE_ENDIVIDAMENTO`

{
  "framework_central_id": "ANALISE_DE_ENDIVIDAMENTO",
  "frameworks_secundarios": [
    {
      "framework_id": "ANALISE_DE_DIVIDAS_DE_CARTAO",
      "quando_usar": [
        "Dívidas de cartão de crédito",
        "Rotativo do cartão",
        "Juros altos"
      ]
    },
    {
      "framework_id": "ANALISE_DE_FINANCIAMENTOS",
      "quando_usar": [
        "Financiamentos pessoais",
        "Empréstimos bancários",
        "Consolidação de dívidas"
      ]
    },
    {
      "framework_id": "AVALIACAO_DE_CAPACIDADE_DE_PAGAMENTO",
      "quando_usar": [
        "Capacidade de quitar dívidas",
        "Renda vs. despesas",
        "Plano de pagamento"
      ]
    }
  ]
}


👉 Ainda **não há lógica detalhada**, apenas **opções de raciocínio**.

---

## 📘 NÍVEL 3 — Conteúdo completo do framework (liberação final)

Somente após o agente **escolher explicitamente** um framework secundário, o sistema libera o conteúdo completo:

```json
{
  "framework_id": "ANALISE_DE_DIVIDAS_DE_CARTAO",
  "objetivo": "Avaliar impacto financeiro de dívidas de cartão de crédito e propor estratégias de quitação",
  "premissas": [
    "Renda mensal estável",
    "Controle de gastos impulsivos",
    "Disponibilidade de reserva de emergência"
  ],
  "etapas": [
    "Calcular juros acumulados",
    "Avaliar capacidade de pagamento mínimo",
    "Simular cenários de quitação",
    "Identificar fontes de economia",
    "Propor plano de ação"
  ],
  "metricas_chave": [
    "Taxa de juros efetiva",
    "Valor da dívida total",
    "Pagamento mínimo mensal",
    "Tempo estimado de quitação"
  ],
  "criterios_de_decisao": {
    "juros_maximo_aceitavel": 0.15,
    "pagamento_minimo_percentual": 0.05
  }
}
```

---

## 🔀 Uso de MÚLTIPLOS frameworks (exemplo completo)

### Pergunta do usuário:

> "Tenho dívidas no cartão, gastos mensais altos e quero avaliar meus investimentos pessoais. Como melhorar minha situação financeira?"

---

### 🔹 Passo 1 — Classificação do problema

O agente identifica:

- Dívidas elevadas
    
- Gastos excessivos
    
- Análise de situação financeira atual
    

---

### 🔹 Passo 2 — Seleção de frameworks centrais

O agente seleciona **mais de um framework central**:

`[   "ANALISE_DE_ENDIVIDAMENTO",   "AVALIACAO_DE_ORCAMENTO_MENSAL" ]`

---

### 🔹 Passo 3 — Acesso aos frameworks secundários

De cada framework central, ele escolhe os necessários:

**Do ANALISE_DE_ENDIVIDAMENTO**

- ANALISE_DE_DIVIDAS_DE_CARTAO
    
- AVALIACAO_DE_CAPACIDADE_DE_PAGAMENTO
    

**Do AVALIACAO_DE_ORCAMENTO_MENSAL**

- ANALISE_DE_FLUXO_DE_CAIXA
    
- OTIMIZACAO_DE_CUSTOS
    

**Do ANALISE_DE_INVESTIMENTOS_PESSOAIS**

- AVALIACAO_DE_RISCOS
    
- DIVERSIFICACAO_FINANCEIRA
    

---

### 🔹 Passo 4 — Execução combinada

O agente agora:

- Analisa dívidas e calcula impacto dos juros
    
- Avalia orçamento mensal e identifica áreas de economia
    
- Proposta estratégias integradas de melhoria financeira
    

---

### 🔹 Passo 5 — Resposta final

A resposta final não é:

> "Você tem problemas financeiros"

Mas:

- Quais dívidas são prioritárias para quitar
    
- Como otimizar o orçamento mensal
    
- Plano de ação integrado com riscos e benefícios

---

## Colaboração com Outros Coordenadores

O Agente Analista pode colaborar com outros coordenadores quando queries envolvem domínios sobrepostos, como planejamento financeiro. Por exemplo:

- **Quando chamar outro coordenador:** Se a análise requer projeções de longo prazo ou planejamento estratégico, chama o Agente de Planejamento Financeiro para integrar cenários.
- **Como estruturar requisição:** Envia pacote via Message Bus com objetivo específico (ex.: "Integre análise de endividamento com plano financeiro"), contratos e orçamento compartilhado.
- **Integração de respostas:** Combina frameworks do Analista com outputs do outro coordenador, evitando loops (ex.: não chama recursivamente).
- **Cenários comuns:** Em queries de situação financeira complexa, o Analista coordena com outros agentes para garantir resposta holística.
- **Nota sobre Agente Matemático:** Quando chamar o Agente Matemático para cálculos, fornecer dados conhecidos; o Matemático pode obter dados externos adicionais diretamente do Agente de Pesquisa Externa se necessário.