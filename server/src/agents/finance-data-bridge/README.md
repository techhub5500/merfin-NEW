# 📊 FinanceDataBridge

Sistema centralizado de consulta de dados financeiros para agentes de IA.

## 📌 Visão Geral

O **FinanceDataBridge** é uma camada de infraestrutura lógica que atua como intermediária entre o Banco de Dados e os Agentes de IA da plataforma. Não é uma IA, mas um motor de processamento que só entra em execução quando um agente solicita dados.

### Benefícios

| Benefício | Descrição |
|-----------|-----------|
| **Desacoplamento** | Agentes nunca fazem queries diretas ao banco |
| **Manutenibilidade** | Mudanças no schema afetam apenas o Bridge |
| **Precisão** | Cálculos matemáticos feitos pelo MongoDB |
| **Economia** | Dados sumarizados consomem 90% menos tokens |
| **Segurança** | Validação centralizada de userId e permissões |

---

## 🚀 Uso Rápido

```javascript
const Bridge = require('./server/src/agents/finance-data-bridge');

// Resumo dos últimos 30 dias
const summary = await Bridge.getSummary(userId, '30d');

// Top 10 maiores despesas
const topExpenses = await Bridge.getTopExpenses(userId, 10, '30d');

// Resumo de dívidas
const debts = await Bridge.getDebtsSummary(userId);
```

---

## 📖 API Reference

### Execução Genérica

#### `execute(request)`

Executa uma requisição estruturada.

```javascript
const result = await Bridge.execute({
  userId: "507f1f77bcf86cd799439011",
  action: "summary",           // summary | list | ranking | detail
  domain: "transactions",      // transactions | debts | credit_cards | scheduled | assets
  filters: {
    dateRange: "30d",          // 7d | 30d | 3m | 6m | 12m | mesAtual | custom
    type: "expense",           // income | expense
    category: "Alimentação",
    section: "statement"       // statement | scheduled | credit_card | debt | asset
  },
  options: {
    limit: 20,                 // Máximo: 150
    page: 1,
    sortBy: "date",            // date | amount | category
    sortOrder: "desc"          // asc | desc
  }
});
```

**Retorno:**
```javascript
{
  success: true,
  action: "summary",
  domain: "transactions",
  period: { start: Date, end: Date },
  summary: {
    totalIncome: 5000.00,
    totalExpense: 3200.00,
    netFlow: 1800.00,
    transactionCount: 47,
    averageTransaction: 174.46
  },
  breakdown: {
    byCategory: [...],
    byType: { income: {...}, expense: {...} }
  }
}
```

---

### Métodos de Conveniência

#### Summaries

| Método | Descrição |
|--------|-----------|
| `getSummary(userId, dateRange, options)` | Resumo de transações |
| `getDebtsSummary(userId)` | Resumo de dívidas |
| `getCreditCardsSummary(userId)` | Resumo de cartões de crédito |
| `getScheduledSummary(userId, dateRange)` | Resumo de contas futuras |
| `getMonthlyTrend(userId, months)` | Tendência mensal (últimos N meses) |

#### Rankings

| Método | Descrição |
|--------|-----------|
| `getTopExpenses(userId, n, dateRange)` | Top N maiores despesas |
| `getTopIncome(userId, n, dateRange)` | Top N maiores receitas |
| `getTopCategories(userId, n, dateRange)` | Top N categorias por gasto |
| `getRecentTransactions(userId, limit)` | Transações mais recentes |

#### Listagens

| Método | Descrição |
|--------|-----------|
| `listTransactions(userId, options)` | Lista paginada de transações |

---

## 📅 Termos de Data Suportados

| Termo | Descrição |
|-------|-----------|
| `7d` ou `7dias` | Últimos 7 dias |
| `30d` ou `1m` | Últimos 30 dias |
| `3m` | Últimos 3 meses |
| `6m` | Últimos 6 meses |
| `12m` ou `1a` | Últimos 12 meses |
| `mesAtual` | Mês corrente |
| `mesAnterior` | Mês anterior completo |
| `anoAtual` | Ano corrente (1 jan até hoje) |
| `custom` | Período customizado (requer startDate/endDate) |

---

## 🏷️ Domínios e Seções

### Mapeamento de Domínios

| Domínio | Collection | Section |
|---------|------------|---------|
| `transactions` | transactions | statement |
| `scheduled` | transactions | scheduled |
| `credit_cards` | creditcards | - |
| `debts` | debts | - |
| `assets` | transactions | asset |

### Tipos de Ranking

```javascript
const { RANKING_TYPES } = require('./finance-data-bridge');

// Tipos disponíveis:
RANKING_TYPES.TOP_EXPENSES       // Maiores despesas
RANKING_TYPES.TOP_INCOME         // Maiores receitas
RANKING_TYPES.TOP_CATEGORIES     // Categorias por valor
RANKING_TYPES.TOP_MERCHANTS      // Estabelecimentos por valor
RANKING_TYPES.FREQUENT_CATEGORIES // Categorias por frequência
RANKING_TYPES.RECENT_TRANSACTIONS // Transações recentes
```

---

## 📝 Exemplos de Uso

### 1. Dashboard - Resumo Financeiro

```javascript
const Bridge = require('./finance-data-bridge');

async function getDashboardData(userId) {
  const [summary, topExpenses, recentTx] = await Promise.all([
    Bridge.getSummary(userId, 'mesAtual'),
    Bridge.getTopExpenses(userId, 5, 'mesAtual'),
    Bridge.getRecentTransactions(userId, 10)
  ]);

  return {
    receitas: summary.summary.totalIncome,
    despesas: summary.summary.totalExpense,
    saldo: summary.summary.netFlow,
    topGastos: topExpenses.items,
    ultimasTransacoes: recentTx.items
  };
}
```

### 2. Agente Analista - Análise por Categoria

```javascript
async function analyzeByCategory(userId, months = 3) {
  const result = await Bridge.execute({
    userId,
    action: 'ranking',
    domain: 'transactions',
    filters: {
      dateRange: `${months}m`,
      type: 'expense',
      rankingType: 'topCategories'
    },
    options: { limit: 15 }
  });

  return result.items.map(cat => ({
    categoria: cat.category,
    total: cat.total,
    percentual: cat.percentage,
    mediaTransacao: cat.average
  }));
}
```

### 3. Agente de Investimentos - Patrimônio

```javascript
async function getPatrimonio(userId) {
  const [debts, cards] = await Promise.all([
    Bridge.getDebtsSummary(userId),
    Bridge.getCreditCardsSummary(userId)
  ]);

  return {
    totalDividas: debts.summary.totalRemaining,
    utilizacaoCartoes: cards.summary.totalUtilized,
    limiteDisponivel: cards.summary.availableCredit
  };
}
```

### 4. Listagem Paginada

```javascript
async function getExpenseHistory(userId, page = 1) {
  const result = await Bridge.listTransactions(userId, {
    dateRange: '6m',
    type: 'expense',
    limit: 20,
    page,
    sortBy: 'amount',
    sortOrder: 'desc'
  });

  return {
    transacoes: result.data,
    paginacao: result.pagination
  };
}
```

---

## ⚠️ Tratamento de Erros

Todas as respostas incluem um campo `success`:

```javascript
// Sucesso
{
  success: true,
  action: "summary",
  ...data
}

// Erro
{
  success: false,
  error: "Validation failed",
  details: ["userId is required", "Invalid action: xyz"]
}
```

### Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `userId is required` | userId não informado | Passar userId válido |
| `Invalid action` | Action inválida | Usar: summary, list, ranking, detail |
| `Invalid dateRange` | Termo de data inválido | Ver lista de termos suportados |
| `startDate must be before endDate` | Datas invertidas | Corrigir ordem |

---

## 🔧 Configuração

### Logs

O Bridge possui sistema de log focado e não verboso:

```javascript
// Verificar estatísticas do logger
const stats = Bridge.getLoggerStats();
console.log(stats);
// { sessionId: 'bridge_...', totalEntries: 15, errors: 0, avgDurationMs: 45 }
```

Os logs são escritos em:
- **Desenvolvimento**: Console
- **Produção**: `server/logs/bridge/bridge_YYYY-MM-DD.log`

### Limites

| Limite | Valor |
|--------|-------|
| Máximo de registros por lista | 150 |
| Máximo de rankings | 50 |
| Default de registros | 10 |
| Default de paginação | 20 |

---

## 📁 Estrutura de Arquivos

```
finance-data-bridge/
├── index.js                    # Exporta interface pública
├── bridge-core.js              # Classe principal
├── README.md                   # Esta documentação
├── validators/
│   └── request-validator.js    # Validação de requisições
├── processors/
│   ├── date-processor.js       # Conversão de datas
│   ├── summary-processor.js    # Resumos e agregações
│   ├── ranking-processor.js    # Rankings (Top N)
│   └── list-processor.js       # Listagens paginadas
└── utils/
    └── bridge-logger.js        # Sistema de log
```

---

## 🔄 Agentes que Usam o Bridge

| Agente | Uso Principal |
|--------|---------------|
| ✅ Analista | Análises financeiras, tendências |
| ✅ Investimentos | Patrimônio, alocação |
| ✅ Planejamento | Orçamentos, metas |
| ✅ Pesquisa | Comparações, busca |
| ❌ Junior | Usa fluxo próprio simplificado |

---

## 📊 Performance

- Queries otimizadas com índices do MongoDB
- Agregações executadas no banco (não em JS)
- Target: < 500ms para queries complexas
- Caching pode ser implementado via `cache-manager.js` existente
