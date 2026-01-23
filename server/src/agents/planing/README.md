---
agente de planejamento financeiro:
## 3. Arquitetura conceitual do agente

O Agente de Planejamento Financeiro opera em um **ciclo ReAct próprio**, adaptado à sua especialização, integrando o banco de frameworks hierárquicos para garantir raciocínio guiado e explicável. O ciclo combina planejamento estratégico, execução operacional, avaliação contínua e consolidação final, alinhado com a autonomia de coordenadores no sistema multi-agente.

## 8. 💾 Sistema de Memória

Como **coordenador**, o Agente de Planejamento recebe automaticamente a **Memória de Contexto (Chat)** e a **Memória Interna** na sua integralidade de outros agentes coordenadores, garantindo continuidade e acesso completo aos processos anteriores.

**Recebe automaticamente:**
- **Memória de Contexto (Chat):** Working Memory (volátil), Episodic Memory (histórico da conversa), Long-Term Memory (perfil do usuário) - sempre enviada na integralidade.
- **Memória Interna:** Dados e processos preservados de execuções anteriores, identificados claramente como distintos do contexto histórico.

**Compartilha com outros coordenadores:**
- Sempre envia Memória de Contexto e Memória Interna na integralidade para garantir continuidade.

**Para executores:**
- Avalia se é relevante incluir elementos da memória; inclui apenas o necessário para evitar sobrecarga.

**Uso:** Utiliza toda a memória disponível para elaborar planos estratégicos integrados, considerando histórico completo do usuário e processos anteriores.

### 📚 Banco de Frameworks (diferencial central)

O banco de frameworks é a base do raciocínio do agente. Ele é estruturado hierárquicamente (níveis 1, 2 e 3) e contém:

- **Framework**
    
- **Objetivo**
    
- **Premissas**
    
- **Etapas**
    
- **Métricas**
    
- **Limitações**
    

O agente **não inventa** a lógica. Ele **consulta** o banco para selecionar e aplicar frameworks adequados ao prompt do usuário.

### 🧠 Ciclo ReAct Adaptado para Planejamento Financeiro

**Ciclo N - PLANEJAMENTO (primeiro ciclo):**

1. Recebe o pacote de missão do orquestrador (objetivo estratégico, query do usuário, contratos de agentes, orçamento, timeout).
2. Classifica a intenção de planejamento: "Que tipo de planejamento preciso executar?" (ex.: curto prazo como orçamento mensal, médio prazo como compra de imóvel, longo prazo como aposentadoria).
3. Consulta o banco de frameworks (níveis 1 e 2) para selecionar frameworks centrais e secundários adequados.
4. Define plano de execução: quais agentes executores chamar (ex.: acessa diretamente o Sistema de Acesso a Dados Internos para projeções), ordem de operações e dependências.
5. Avalia orçamento e tempo restante; prioriza operações críticas.

**Ciclo N+1, N+2... - EXECUÇÃO:**

1. Acessa diretamente o Sistema de Acesso a Dados Internos (ex.: consulta dados de renda e metas via categorias e filtros).
2. Aplica frameworks selecionados: carrega "modo de pensar" (etapas, métricas) e processa dados.
3. Monitora progresso: valida respostas, usa fallbacks se necessário, acumula consumo de recursos.
4. Se orçamento crítico ou tempo baixo, prioriza finalização.

**Ciclo N+X - AVALIAÇÃO CONTÍNUA:**

1. Após cada bloco de operações, pergunta: "Objetivo foi suficientemente alcançado? Dados faltantes impactam qualidade?"
2. Calcula custo-benefício de operações futuras baseado em frameworks (ex.: se projeção de longo prazo é essencial, executa mesmo com recursos limitados).
3. Decide continuar ou consolidar; documenta limitações.

**Ciclo FINAL - CONSOLIDAÇÃO:**

1. Sintetiza resultados usando estrutura dos frameworks (ex.: quais metas são viáveis, cronograma, riscos).
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
        

👉 Isso força o agente a **planejar antes de executar**, exatamente como um planejador financeiro humano.

---

## 🧠 NÍVEL 1 — Frameworks Centrais (visão macro)

Esse é o **único JSON que o agente vê inicialmente**.

Ele responde à pergunta:

> "Qual linha de planejamento financeiro esse problema exige?"

### Exemplo: JSON de frameworks centrais

[
  {
    "framework_id": "PLANEJAMENTO_DE_CURTO_PRAZO",
    "quando_usar": [
      "Orçamento mensal",
      "Quitação de dívidas",
      "Reserva de emergência",
      "Controle de gastos imediatos"
    ]
  },
  {
    "framework_id": "PLANEJAMENTO_DE_MEDIO_PRAZO",
    "quando_usar": [
      "Compra de imóvel",
      "Casamento",
      "Mudança de padrão de vida",
      "Educação dos filhos"
    ]
  },
  {
    "framework_id": "PLANEJAMENTO_DE_LONGO_PRAZO",
    "quando_usar": [
      "Aposentadoria",
      "Planejamento sucessório",
      "Metas de patrimônio"
    ]
  },
  {
    "framework_id": "PLANEJAMENTO_DE_MULTIPLOS_OBJETIVOS",
    "quando_usar": [
      "Múltiplos objetivos simultâneos",
      "Conflito de prioridades",
      "Otimização de recursos limitados"
    ]
  }
]


👉 Aqui **não existe método**, só **intenção e contexto**.

---

## 🧩 NÍVEL 2 — Frameworks Secundários (decisão específica)

Depois que o agente escolhe um ou mais frameworks centrais, o sistema libera **os frameworks secundários associados àqueles centrais**.

Eles respondem:

> "Qual planejamento específico preciso executar dentro dessa linha de pensamento?"

---

### Exemplo: conteúdo interno de um framework central

#### Framework Central: `PLANEJAMENTO_DE_MEDIO_PRAZO`

{
  "framework_central_id": "PLANEJAMENTO_DE_MEDIO_PRAZO",
  "frameworks_secundarios": [
    {
      "framework_id": "PLANEJAMENTO_DE_COMPRA_DE_IMOVEL",
      "quando_usar": [
        "Compra de imóvel",
        "Planejamento de entrada",
        "Financiamento habitacional"
      ]
    },
    {
      "framework_id": "PLANEJAMENTO_FINANCEIRO_DE_CASAMENTO",
      "quando_usar": [
        "Casamento",
        "Festa",
        "Lua de mel",
        "União de rendas"
      ]
    },
    {
      "framework_id": "PLANEJAMENTO_DE_EDUCACAO",
      "quando_usar": [
        "Educação superior",
        "Cursos profissionalizantes",
        "Planejamento de mensalidades"
      ]
    }
  ]
}


👉 Ainda **não há lógica detalhada**, apenas **opções de planejamento**.

---

## 📘 NÍVEL 3 — Conteúdo completo do framework (liberação final)

Somente após o agente **escolher explicitamente** um framework secundário, o sistema libera o conteúdo completo:

```json
{
  "framework_id": "PLANEJAMENTO_DE_COMPRA_DE_IMOVEL",
  "objetivo": "Planejar financeiramente a compra de imóvel em horizonte definido",
  "premissas": [
    "Renda recorrente estável",
    "Capacidade de poupança consistente",
    "Reserva de emergência adequada"
  ],
  "etapas": [
    "Avaliar renda líquida mensal",
    "Definir valor máximo do imóvel",
    "Projetar poupança para entrada",
    "Simular financiamento e prestações",
    "Executar teste de estresse financeiro"
  ],
  "metricas_chave": [
    "Comprometimento de renda (máx. 30%)",
    "Valor da entrada (mín. 20%)",
    "Prazo do financiamento",
    "Taxa de juros efetiva"
  ],
  "criterios_de_decisao": {
    "comprometimento_maximo": 0.30,
    "reserva_minima_meses": 6,
    "entrada_minima_percentual": 0.20
  }
}
```

---

## 🔀 Uso de MÚLTIPLOS frameworks (exemplo completo)

### Pergunta do usuário:

> "Em 3 anos quero me casar, comprar uma casa e começar a poupar para a aposentadoria. Como planejar financeiramente?"

---

### 🔹 Passo 1 — Classificação do problema

O agente identifica:

- Múltiplos objetivos em diferentes prazos
    
- Necessidade de priorização e sequenciamento
    
- Planejamento integrado de médio e longo prazo
    

---

### 🔹 Passo 2 — Seleção de frameworks centrais

O agente seleciona **mais de um framework central**:

`[   "PLANEJAMENTO_DE_MEDIO_PRAZO",   "PLANEJAMENTO_DE_LONGO_PRAZO",   "PLANEJAMENTO_DE_MULTIPLOS_OBJETIVOS" ]`

---

### 🔹 Passo 3 — Acesso aos frameworks secundários

De cada framework central, ele escolhe os necessários:

**Do PLANEJAMENTO_DE_MEDIO_PRAZO**

- PLANEJAMENTO_DE_COMPRA_DE_IMOVEL
    
- PLANEJAMENTO_FINANCEIRO_DE_CASAMENTO
    

**Do PLANEJAMENTO_DE_LONGO_PRAZO**

- PLANEJAMENTO_DE_APOSENTADORIA
    

**Do PLANEJAMENTO_DE_MULTIPLOS_OBJETIVOS**

- PRIORIZACAO_DE_OBJETIVOS
    
- ALOCACAO_DE_RENDA_NO_TEMPO
    

---

### 🔹 Passo 4 — Execução combinada

O agente agora:

- Avalia viabilidade de cada objetivo isoladamente
    
- Prioriza objetivos por urgência e impacto
    
- Sequencia cronologicamente (casamento primeiro, casa depois, aposentadoria contínua)
    
- Otimiza alocação de renda para múltiplos objetivos
    

---

### 🔹 Passo 5 — Resposta final

A resposta final não é:

> "Você pode planejar tudo"

Mas:

- Ordem recomendada de objetivos
    
- Cronograma detalhado com marcos
    
- Alocação de renda por objetivo
    
- Cenários alternativos (conservador, moderado, agressivo)
    
- Riscos e ajustes necessários

---

## Colaboração com Outros Coordenadores

O Agente de Planejamento pode colaborar com outros coordenadores quando queries envolvem análise ou investimentos. Por exemplo:

- **Quando chamar outro coordenador:** Se o planejamento requer análise de situação atual, chama o Agente de Análise Financeira Pessoal para dados de renda/dívidas; se envolve investimentos, chama o Agente de Investimentos para projeções.
- **Como estruturar requisição:** Envia pacote via Message Bus com objetivo específico (ex.: "Forneça projeções de renda para planejamento de aposentadoria"), contratos e orçamento compartilhado.
- **Integração de respostas:** Combina frameworks do Planejamento com outputs do outro coordenador, evitando loops (ex.: não chama recursivamente).
- **Cenários comuns:** Em planejamentos complexos, o Planejamento coordena com o Analista para baseline financeira, garantindo planos realistas.
- **Nota sobre Agente Matemático:** Quando chamar o Agente Matemático para projeções numéricas, fornecer dados base; o Matemático pode obter dados externos adicionais diretamente do Agente de Pesquisa Externa se necessário.
