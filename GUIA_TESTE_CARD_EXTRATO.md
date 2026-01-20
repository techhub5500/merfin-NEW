# Guia de Teste - Card Extrato (Receitas e Despesas)

## ✅ Implementação Concluída

Implementamos a integração dinâmica do **Card Extrato** (Receitas e Despesas) com o backend MongoDB através do serverAgent.js.

---

## 🏗️ O que foi implementado

### 1. **Schemas e Backend** ✅
- Schema de transações já existente em `transactions-schema.js`
- Endpoints do DataAgent já funcionais:
  - `fetchTransactions` - Busca transações com filtros
  - `createTransaction` - Cria nova transação
  - `getTransactionsSummary` - Sumário de receitas/despesas/saldo

### 2. **Frontend - dataService.js** ✅
- Adicionadas funções para comunicação com serverAgent:
  - `executeAgent()` - Função base para executar ações nos agentes
  - `fetchStatementTransactions()` - Busca transações do extrato
  - `fetchIncomes()` - Busca apenas receitas
  - `fetchExpenses()` - Busca apenas despesas
  - `fetchTransactionsSummary()` - Busca sumário (cards do topo)
  - `createStatementTransaction()` - Cria nova transação

### 3. **Frontend - dash-data.js** ✅
- Removidos dados mockados (`sampleTx`)
- Adicionadas funções assíncronas:
  - `renderIncomesFromAPI()` - Renderiza receitas da API
  - `renderExpensesFromAPI()` - Renderiza despesas da API
  - `updateStatsFromAPI()` - Atualiza cards do topo (Receitas/Despesas/Saldo)

### 4. **Frontend - dash.js** ✅
- Modificada função `applyFilter()` para usar as novas funções assíncronas da API

### 5. **Frontend - dash.html** ✅
- Adicionado script `dataService.js` antes de `dash-data.js`

### 6. **Testes** ✅
- Criado arquivo `teste-card-extrato.js` com funções completas de teste

---

## 🧪 Como Testar

### Pré-requisitos:
1. **MongoDB rodando** (com os schemas instalados)
2. **serverAgent.js rodando** na porta 5000
   ```bash
   cd server
   node serverAgent.js
   ```
3. **Usuário autenticado** no sistema (faça login primeiro)
4. **Abrir dash.html** no navegador

---

## 📝 Testes via Console

Abra o console do navegador (F12) e execute os testes:

### Teste 1: Criar uma Receita
```javascript
await criarReceitaTeste()
```
**Resultado esperado:**
- ✅ Mensagem de sucesso no console
- ✅ Nova receita aparece no card "Extrato" (aba Receitas)
- ✅ Card "Receitas" no topo é atualizado
- ✅ Card "Saldo" no topo é atualizado

---

### Teste 2: Criar uma Despesa
```javascript
await criarDespesaTeste()
```
**Resultado esperado:**
- ✅ Mensagem de sucesso no console
- ✅ Nova despesa aparece no card "Extrato" (aba Despesas)
- ✅ Card "Despesas" no topo é atualizado
- ✅ Card "Saldo" no topo é atualizado

---

### Teste 3: Criar Múltiplas Transações
```javascript
await criarTransacoesTeste()
```
**Resultado esperado:**
- ✅ 5 transações criadas (2 receitas + 3 despesas)
- ✅ Todas aparecem no card Extrato
- ✅ Cards do topo atualizados com novos valores

---

### Teste 4: Buscar Receitas
```javascript
await testarBuscarReceitas()
```
**Resultado esperado:**
- ✅ Lista todas as receitas do mês atual
- ✅ Exibe tabela formatada no console

---

### Teste 5: Buscar Despesas
```javascript
await testarBuscarDespesas()
```
**Resultado esperado:**
- ✅ Lista todas as despesas do mês atual
- ✅ Exibe tabela formatada no console

---

### Teste 6: Buscar Sumário
```javascript
await testarSumario()
```
**Resultado esperado:**
- ✅ Exibe Receitas, Despesas e Saldo formatados
- ✅ Valores correspondem aos cards do topo

---

### Teste 7: Teste Completo (Todos os testes acima)
```javascript
await testeCompleto()
```
**Resultado esperado:**
- ✅ Executa todos os testes em sequência
- ✅ Mostra resumo completo no console
- ✅ Cards são atualizados automaticamente

---

## 🔍 Verificação Visual

### Cards do Topo (Dashboard)
1. **Card Receitas** - Deve mostrar soma de todas as receitas do mês
2. **Card Despesas** - Deve mostrar soma de todas as despesas do mês
3. **Card Saldo** - Deve mostrar diferença (Receitas - Despesas)

### Card Extrato (Carrossel)
1. **Aba Receitas:**
   - ✅ Lista todas as receitas do mês selecionado
   - ✅ Ordenadas por data (mais recentes primeiro)
   - ✅ Formato: Descrição, Data, Valor (verde)

2. **Aba Despesas:**
   - ✅ Lista todas as despesas do mês selecionado
   - ✅ Ordenadas por data (mais recentes primeiro)
   - ✅ Formato: Descrição, Data, Valor (vermelho)

### Filtro de Mês
1. Ao alterar o mês no seletor:
   - ✅ Card Extrato atualiza automaticamente
   - ✅ Cards do topo atualizam com valores do mês selecionado
   - ✅ Transações filtradas por mês escolhido

---

## 🐛 Possíveis Problemas e Soluções

### Erro: "Usuário não autenticado"
**Solução:** Faça login primeiro na página de login (index.html)

### Erro: "Failed to fetch" ou "Network Error"
**Solução:** Verifique se o serverAgent.js está rodando na porta 5000
```bash
cd server
node serverAgent.js
```

### Erro: "Agent not found" ou "Action not found"
**Solução:** Verifique se o DataAgent está registrado no serverAgent.js

### Card vazio ou "Nenhuma transação"
**Solução:** Use os testes para criar transações de exemplo

### Cards do topo não atualizam
**Solução:** 
1. Verifique se há transações com `section: 'statement'`
2. Verifique se as transações têm `status: 'confirmed'`
3. Verifique se o mês selecionado tem transações

---

## 🔧 Debugging

### Ver logs completos no console:
```javascript
// Habilitar logs detalhados (se disponível)
localStorage.setItem('debug', 'true');

// Ver userId atual
DataService.getCurrentUserId()

// Ver token de autenticação
DataService.getAuthToken()

// Executar ação direta no agente
await DataService.executeAgent('DataAgent', 'fetchTransactions', {
  section: 'statement',
  status: 'confirmed'
})
```

---

## 📊 Formato dos Dados

### Transação (Schema MongoDB)
```javascript
{
  userId: ObjectId,
  section: 'statement',
  type: 'income' | 'expense',
  amount: Number,
  date: Date,
  description: String,
  category: String,
  status: 'confirmed' | 'pending',
  createdAt: Date
}
```

### Sumário (Resposta da API)
```javascript
{
  receitas: Number,
  despesas: Number,
  saldo: Number
}
```

---

## ✅ Checklist de Validação

- [ ] serverAgent.js está rodando
- [ ] MongoDB está conectado
- [ ] Usuário está autenticado
- [ ] dash.html carregou sem erros
- [ ] Console não mostra erros críticos
- [ ] Card Extrato está visível no carrossel
- [ ] Teste `criarReceitaTeste()` funciona
- [ ] Teste `criarDespesaTeste()` funciona
- [ ] Cards do topo atualizam após criar transação
- [ ] Filtro de mês funciona corretamente
- [ ] Transações aparecem ordenadas por data

---

## 📝 Notas Importantes

1. **Apenas o Card Extrato foi dinamizado** nesta etapa
2. **Outros cards** (Cartão, Dívidas, Patrimônio, etc.) ainda usam dados mockados
3. **Section 'statement'** é usado para transações executadas (extrato)
4. **Próxima etapa:** Implementar outros cards do carrossel

---

## 🎯 Próximos Passos

Após validar este card, implementaremos:
1. Card "Últimas Transações"
2. Card "Contas Futuras" (A Receber / A Pagar)
3. Card "Cartão de Crédito"
4. Card "Dívidas"
5. Card "Patrimônio"

---

## 🆘 Suporte

Se encontrar problemas:
1. Verifique o console do navegador (F12)
2. Verifique os logs do serverAgent.js
3. Verifique a conexão com MongoDB
4. Execute `testeCompleto()` para diagnóstico completo

---

**Implementado em:** Janeiro 2026  
**Versão:** 1.0  
**Status:** ✅ Pronto para teste
