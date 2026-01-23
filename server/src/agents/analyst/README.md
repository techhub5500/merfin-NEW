
---
# AGENTE ANALISTA DE FINANÇAS PESSOAIS (COORDENADOR)

## 📋 Status de Implementação

**FUTURO** - Este agente será implementado quando houver demanda por análises financeiras complexas.

**Arquitetura atual:**
- ✅ Junior Agent: Triagem e roteamento
- ✅ DataAgent: Acesso a dados MongoDB
- 🔜 Simplista Agent: Consultas simples
- 🔜 Lançador Agent: Lançamentos transacionais
- 📅 **Analyst Agent**: Análises complexas (este documento)

---

## 3. Arquitetura conceitual do agente

O Agente Analista de Finanças Pessoais opera como um **coordenador autônomo** especializado em análises financeiras profundas. Ele integra o banco de frameworks hierárquicos para garantir raciocínio guiado e explicável. Como coordenador, ele tem autonomia tática completa para decidir COMO alcançar os objetivos analíticos definidos.

## 8. 💾 Sistema de Memória e Contexto

Como **coordenador**, o Agente Analista receberá automaticamente contexto unificado via `context-builder` quando implementado:

**Receberá (futuro):**
- `workingMemory`: Variáveis de sessão e contexto volátil
- `episodicSummary`: Trechos relevantes do histórico de conversas
- `prompt_current`: Query original do usuário
- `userId` e `sessionId`: Identificadores para acesso a dados

**Acesso a dados:**
- Acesso direto ao DataAgent para consultas estruturadas
- Pode consultar dados financeiros via categorias e filtros
- Dados retornados integrados às análises de frameworks

**Compartilhamento:**
- Na v2.0+, poderá compartilhar contexto com outros coordenadores
- Por enquanto, opera de forma independente via chamadas diretas ao DataAgent

**Uso:** Utilizará toda a memória e dados disponíveis para elaborar análises profundas integradas, considerando histórico completo do usuário e frameworks especializados.

---

## 💾 Acesso a Dados via DataAgent

Como coordenador, o Agente Analista terá **acesso direto ao DataAgent** para consultas estruturadas aos dados financeiros do usuário.

### Funcionamento do Acesso:
- **Chamadas ao DataAgent:** Usa as ações disponíveis no DataAgent (fetchAccountBalance, fetchTransactions, etc)
- **Parâmetros Estruturados:** Envia parâmetros via formato de contrato padrão
- **Respostas Formatadas:** Recebe dados já validados e formatados pelo DataAgent
- **Integração com Frameworks:** Usa dados obtidos para alimentar frameworks de análise

### Ações Disponíveis do DataAgent:
- `fetchAccountBalance`: Saldos de contas
- `fetchTransactions`: Histórico de transações com filtros
- `fetchAccountSummary`: Resumo financeiro consolidado
- `getCreditCards`: Dados de cartões de crédito
- `getDebts`: Informações de dívidas
- `fetchReceivables/Payables`: Contas futuras a receber/pagar

### Exemplos de Uso:
1. **Diagnóstico de Gastos:** Chama `fetchTransactions` com filtros por categoria e período
2. **Análise de Endividamento:** Usa `getDebts` para calcular índices de endividamento
3. **Avaliação de Fluxo de Caixa:** Combina `fetchReceivables` e `fetchPayables` para projeções

Este acesso via DataAgent garante que análises sejam baseadas em dados reais, validados e com cache otimizado.

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
    

### 🧠 Ciclo de Execução Autônomo para Análise Financeira

**Fase 1 - PLANEJAMENTO:**

1. Recebe requisição com query do usuário e contexto unificado
2. Classifica a intenção financeira: "Que tipo de análise preciso executar?" (ex.: análise de gastos, diagnóstico de endividamento, avaliação de capacidade de compra)
3. Consulta o banco de frameworks (níveis 1 e 2) para selecionar frameworks centrais e secundários adequados
4. Define plano de execução: quais dados buscar do DataAgent, ordem de operações e dependências
5. Estima tempo e complexidade da análise

**Fase 2 - COLETA DE DADOS:**

1. Faz chamadas estruturadas ao DataAgent (ex.: fetchTransactions, getDebts, fetchAccountBalance)
2. Valida dados recebidos e identifica gaps
3. Faz chamadas adicionais se necessário para completar análise
4. Organiza dados para aplicação dos frameworks

**Fase 3 - ANÁLISE COM FRAMEWORKS:**

1. Aplica frameworks selecionados: carrega "modo de pensar" (etapas, métricas) e processa dados
2. Executa cálculos e diagnósticos conforme estrutura do framework
3. Identifica padrões, riscos e oportunidades
4. Valida conclusões contra premissas dos frameworks

**Fase 4 - CONSOLIDAÇÃO:**

1. Sintetiza resultados usando estrutura dos frameworks (critérios, riscos, recomendações)
2. Estrutura resposta explicável: framework usado, métricas aplicadas, limitações identificadas
3. Formata saída no padrão de contrato (success/error)
4. Retorna análise completa ao chamador

Isso garante consistência, reprodutibilidade e explicabilidade das análises financeiras.

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