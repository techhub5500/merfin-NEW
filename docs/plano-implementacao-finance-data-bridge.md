# 📋 PLANO DE IMPLEMENTAÇÃO: FinanceDataBridge

**Projeto:** Sistema Centralizado de Consulta de Dados Financeiros  
**Versão:** 1.0  
**Data:** 28/01/2026  
**Responsável:** GitHub Copilot  

---

## 📌 VISÃO GERAL

O **FinanceDataBridge** é uma camada de infraestrutura lógica (backend) que atua como intermediária entre o Banco de Dados e as IAs da plataforma. Não é uma IA, mas um motor de processamento que só entra em execução quando um agente solicita dados.

### Benefícios Principais:
- **Desacoplamento:** Agentes de IA nunca fazem queries diretas ao banco
- **Manutenibilidade:** Mudanças no schema do banco afetam apenas o Bridge
- **Precisão:** Cálculos matemáticos feitos pelo MongoDB (nunca erra)
- **Economia:** Dados sumarizados consomem 90% menos tokens
- **Segurança:** Validação centralizada de userId e permissões

---

## 🎯 OBJETIVO 1: ESTRUTURA BASE E VALIDAÇÃO

### Tarefa 1.1: Criar estrutura de arquivos do Bridge
**Arquivos a criar:**
```
server/src/agents/finance-data-bridge/
├── index.js                    # Exporta módulo principal
├── bridge-core.js              # Classe principal FinanceDataBridge
├── validators/
│   └── request-validator.js    # Validação de requisições JSON
├── processors/
│   ├── date-processor.js       # Conversão de datas relativas
│   ├── summary-processor.js    # Sumarização de dados
│   └── ranking-processor.js    # Rankings (Top 10, frequência)
└── README.md                   # Documentação do módulo
```

**Critérios de aceite:**
- [ ] Estrutura de pastas criada
- [ ] Módulo exportável via `require('./finance-data-bridge')`
- [ ] README com documentação básica

---

### Tarefa 1.2: Implementar validação de requisições
**Arquivo:** `request-validator.js`

**Responsabilidades:**
- Validar que `userId` está presente e é um ObjectId válido
- Validar estrutura do JSON de requisição
- Retornar erros claros para requisições inválidas

**Schema de requisição aceito:**
```javascript
{
  userId: "ObjectId",           // OBRIGATÓRIO
  action: "summary|list|ranking|detail", // OBRIGATÓRIO
  domain: "transactions|debts|credit_cards|scheduled|assets",
  filters: {
    section: "statement|scheduled|credit_card|debt|asset",
    type: "income|expense",
    category: "string",
    status: "pending|confirmed|cancelled",
    dateRange: "7d|30d|3m|6m|12m|custom",
    startDate: "YYYY-MM-DD",
    endDate: "YYYY-MM-DD",
    minValue: number,
    maxValue: number
  },
  options: {
    limit: number,          // Padrão: 10, Máximo: 150
    page: number,           // Paginação
    sortBy: "date|amount|category",
    sortOrder: "asc|desc"
  }
}
```

**Critérios de aceite:**
- [ ] Validação de todos os campos obrigatórios
- [ ] Conversão automática de userId para ObjectId
- [ ] Retorno de erros descritivos
- [ ] Limite máximo de 150 registros enforçado

---

### Tarefa 1.3: Implementar processador de datas
**Arquivo:** `date-processor.js`

**Responsabilidades:**
- Converter termos relativos em datas absolutas
- Calcular períodos de ciclo de faturamento

**Conversões suportadas:**
| Termo | Conversão |
|-------|-----------|
| `7d` ou `7dias` | Últimos 7 dias |
| `30d` ou `1m` | Últimos 30 dias |
| `3m` | Últimos 3 meses |
| `6m` | Últimos 6 meses |
| `12m` ou `1a` | Últimos 12 meses |
| `mesAtual` | Mês corrente (1 a último dia) |
| `mesAnterior` | Mês anterior completo |
| `anoAtual` | Ano corrente (1 jan a hoje) |
| `custom` | Usa `startDate` e `endDate` fornecidos |

**Critérios de aceite:**
- [ ] Função `parseDateRange(term)` implementada
- [ ] Retorna `{ startDate: Date, endDate: Date }`
- [ ] Testes unitários para todas as conversões

---

### Tarefa 1.4: Implementar classe principal do Bridge
**Arquivo:** `bridge-core.js`

**Estrutura da classe:**
```javascript
class FinanceDataBridge {
  constructor() {
    this.validator = new RequestValidator();
    this.dateProcessor = new DateProcessor();
    this.summaryProcessor = new SummaryProcessor();
    this.rankingProcessor = new RankingProcessor();
  }

  async execute(request) {
    // 1. Validar requisição
    // 2. Processar datas
    // 3. Executar ação (summary/list/ranking/detail)
    // 4. Retornar resultado formatado
  }
}
```

**Critérios de aceite:**
- [ ] Classe FinanceDataBridge implementada
- [ ] Método `execute(request)` funcional
- [ ] Integração com todos os processadores

---

## 🎯 OBJETIVO 2: PROCESSADORES DE DADOS

### Tarefa 2.1: Implementar SummaryProcessor
**Arquivo:** `summary-processor.js`

**Responsabilidades:**
- Calcular totais agregados via MongoDB Aggregation
- Retornar resumos financeiros padronizados

**Formato de saída padrão:**
```javascript
{
  period: { start: Date, end: Date },
  summary: {
    totalIncome: 5000.00,
    totalExpense: 3200.00,
    netFlow: 1800.00,
    transactionCount: 47,
    averageTransaction: 174.46
  },
  breakdown: {
    byCategory: [
      { category: "Alimentação", total: 850.00, count: 15, percentage: 26.5 },
      { category: "Transporte", total: 420.00, count: 8, percentage: 13.1 }
    ],
    byType: {
      income: { total: 5000.00, count: 2 },
      expense: { total: 3200.00, count: 45 }
    }
  }
}
```

**Queries MongoDB a implementar:**
- `getSummary(userId, filters)` - Resumo geral
- `getCategorySummary(userId, filters)` - Agrupado por categoria
- `getMonthlyTrend(userId, months)` - Tendência mensal

**Critérios de aceite:**
- [ ] Todas as queries usando `$match`, `$group`, `$project`
- [ ] Conversão de userId para ObjectId
- [ ] Formatação de valores com 2 casas decimais
- [ ] Porcentagens calculadas automaticamente

---

### Tarefa 2.2: Implementar RankingProcessor
**Arquivo:** `ranking-processor.js`

**Responsabilidades:**
- Gerar rankings dinâmicos (Top N)
- Suportar diferentes critérios de ordenação

**Rankings suportados:**
| Tipo | Descrição |
|------|-----------|
| `topExpenses` | N maiores despesas |
| `topIncome` | N maiores receitas |
| `topCategories` | Categorias com maior gasto |
| `topMerchants` | Estabelecimentos mais frequentes |
| `frequentCategories` | Categorias mais recorrentes |

**Formato de saída:**
```javascript
{
  rankingType: "topExpenses",
  period: { start: Date, end: Date },
  items: [
    { rank: 1, description: "Aluguel", amount: 1500.00, date: "2026-01-05", category: "Moradia" },
    { rank: 2, description: "Compra supermercado", amount: 450.00, date: "2026-01-12", category: "Alimentação" }
  ],
  summary: {
    totalInRanking: 2850.00,
    percentageOfTotal: 42.5
  }
}
```

**Critérios de aceite:**
- [ ] Método `getTopN(userId, type, n, filters)` implementado
- [ ] Limite padrão de 10, máximo de 50
- [ ] Cálculo de percentual sobre total

---

### Tarefa 2.3: Implementar paginação e listagem
**Arquivo:** `bridge-core.js` (método adicional)

**Responsabilidades:**
- Buscar listas de transações com paginação
- Nunca retornar mais de 150 registros

**Parâmetros de paginação:**
```javascript
{
  page: 1,          // Página atual (1-based)
  limit: 20,        // Itens por página (máx: 150)
  sortBy: "date",   // Campo de ordenação
  sortOrder: "desc" // Direção
}
```

**Formato de saída:**
```javascript
{
  data: [...],      // Array de transações
  pagination: {
    page: 1,
    limit: 20,
    totalItems: 234,
    totalPages: 12,
    hasNext: true,
    hasPrev: false
  }
}
```

**Critérios de aceite:**
- [ ] Método `getList(userId, domain, filters, options)` implementado
- [ ] Paginação correta com contagem total
- [ ] Ordenação dinâmica funcionando

---

## 🎯 OBJETIVO 3: INTEGRAÇÃO E DOCUMENTAÇÃO

### Tarefa 3.1: Integrar com schemas existentes
**Responsabilidades:**
- Conectar Bridge com schemas de `server/src/database/schemas/`
- Mapear domínios para collections corretas

**Mapeamento de domínios:**
| Domínio | Collection | Schema |
|---------|------------|--------|
| `transactions` | `transactions` | transactions-schema.js |
| `debts` | `debts` | debts-schema.js |
| `credit_cards` | `creditcards` | credit-card-schema.js |
| `scheduled` | `transactions` (section='scheduled') | transactions-schema.js |
| `assets` | `transactions` (section='asset') | transactions-schema.js |

**Critérios de aceite:**
- [ ] Todos os domínios mapeados
- [ ] Queries funcionando para cada domínio
- [ ] Testes de integração passando

---

### Tarefa 3.2: Criar interface de uso para agentes
**Arquivo:** `index.js`

**Exportar interface simplificada:**
```javascript
const FinanceDataBridge = require('./bridge-core');

// Instância singleton
const bridge = new FinanceDataBridge();

// Métodos de conveniência
module.exports = {
  // Execução genérica
  execute: (request) => bridge.execute(request),
  
  // Atalhos comuns
  getSummary: (userId, dateRange) => bridge.execute({
    userId,
    action: 'summary',
    domain: 'transactions',
    filters: { dateRange }
  }),
  
  getTopExpenses: (userId, n = 10, dateRange = '30d') => bridge.execute({
    userId,
    action: 'ranking',
    domain: 'transactions',
    filters: { dateRange, type: 'expense' },
    options: { limit: n }
  }),
  
  getDebtsSummary: (userId) => bridge.execute({
    userId,
    action: 'summary',
    domain: 'debts'
  })
};
```

**Critérios de aceite:**
- [ ] Interface exportada e funcional
- [ ] Atalhos para operações comuns
- [ ] Documentação inline com JSDoc

---

### Tarefa 3.3: Documentação completa
**Arquivo:** `README.md`

**Conteúdo:**
1. Visão geral do módulo
2. Instalação e configuração
3. API Reference completa
4. Exemplos de uso
5. Tratamento de erros
6. Limitações e considerações de performance

**Exemplo de uso no README:**
```javascript
const Bridge = require('./server/src/agents/finance-data-bridge');

// Agente quer saber o resumo do mês
const response = await Bridge.execute({
  userId: "507f1f77bcf86cd799439011",
  action: "summary",
  domain: "transactions",
  filters: {
    section: "statement",
    dateRange: "30d"
  }
});

// Agente quer os 10 maiores gastos
const topExpenses = await Bridge.getTopExpenses(userId, 10, '30d');

// Agente quer lista paginada de despesas
const expenses = await Bridge.execute({
  userId,
  action: "list",
  domain: "transactions",
  filters: { type: "expense", dateRange: "30d" },
  options: { limit: 20, page: 1, sortBy: "amount", sortOrder: "desc" }
});
```

**Critérios de aceite:**
- [ ] README completo e formatado
- [ ] Exemplos funcionais e testados
- [ ] Seção de troubleshooting

---

### Tarefa 3.4: Testes e validação final
**Responsabilidades:**
- Criar testes unitários para cada processador
- Testar integração com banco de dados real
- Validar limites de paginação

**Cenários de teste:**
1. Resumo de transações de 30 dias
2. Top 10 despesas do mês
3. Agrupamento por categoria
4. Paginação com 200+ registros
5. Filtros combinados (categoria + período + valor)
6. Erro ao passar userId inválido
7. Requisição com campos faltantes

**Critérios de aceite:**
- [ ] Cobertura de testes > 80%
- [ ] Todos os cenários passando
- [ ] Performance < 500ms para queries complexas

---

## 📊 CRONOGRAMA ESTIMADO

| Objetivo | Tempo Estimado |
|----------|----------------|
| **Objetivo 1:** Estrutura Base |
| **Objetivo 2:** Processadores |
| **Objetivo 3:** Integração | |


---

## 🔗 DEPENDÊNCIAS

- `mongoose` - Já instalado
- `server/src/database/schemas/*` - Schemas existentes
- `server/src/agents/data/*` - Queries existentes (podem ser reutilizadas)

---

## 📝 NOTAS FINAIS

### Agentes que usarão o Bridge:
- ✅ Agente Analista (análises financeiras)
- ✅ Agente de Investimentos (patrimônio e alocação)
- ✅ Agente de Planejamento (orçamentos e metas)
- ✅ Agente de Pesquisa (comparações)
- ❌ Agente Junior (usa fluxo próprio simplificado)

### Migrations futuras:
Quando o Bridge estiver pronto, os agentes existentes devem migrar gradualmente:
1. Criar método alternativo que usa o Bridge
2. Testar em paralelo com implementação atual
3. Substituir implementação original
4. Remover código legado

---


