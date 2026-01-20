# 🧪 Guia Rápido de Teste - Frontend Conectado

## ✅ Pré-requisitos

- [x] MongoDB rodando
- [x] Backend (server.js) rodando na porta 5000
- [x] Usuário cadastrado no banco

---

## 🚀 Passo a Passo

### 1. Iniciar Backend
```powershell
cd "c:\Users\edmar\OneDrive\Desktop\Nova pasta\server"
node server.js
```

**Saída esperada:**
```
Servidor rodando na porta 5000
MongoDB conectado com sucesso
```

### 2. Abrir Frontend no Navegador
```
Arquivo: client/html/index.html
```

### 3. Fazer Login
- **Email:** Use um usuário cadastrado no MongoDB
- **Senha:** Senha do usuário

**Deve:**
- ✅ Redirecionar para `dash.html`
- ✅ Salvar token no localStorage
- ✅ Mostrar dashboard com dados reais

---

## 🔍 Testes de Funcionalidade

### Teste 1: Verificar Console
Abra DevTools (F12) e digite:

```javascript
// Deve mostrar objeto com funções
console.log(window.API);

// Deve mostrar objeto com funções
console.log(window.Utils);

// Deve mostrar token JWT
console.log(localStorage.getItem('token'));

// Deve mostrar userId
console.log(Utils.getUserIdFromToken());
```

### Teste 2: Cards Superiores
**Verificar:**
- ✅ Card "Receitas" mostra valor real
- ✅ Card "Despesas" mostra valor real
- ✅ Card "Saldo" mostra valor calculado

**Como testar:**
1. Abra MongoDB Compass
2. Vá para collection `transactions`
3. Some manualmente os valores `type: 'income'`
4. Compare com o card "Receitas" no dashboard

### Teste 3: Lista de Transações
**Verificar:**
- ✅ Mostra últimas 5 transações
- ✅ Data formatada (ex: "15 Jan")
- ✅ Valor formatado (ex: "R$ 1.234,56")
- ✅ Cor verde para receitas
- ✅ Cor vermelha para despesas

**Se lista vazia:**
- Crie transações no MongoDB via backend

### Teste 4: Filtro de Mês
**Passos:**
1. Clique no botão do mês (ex: "Jan/2024")
2. Grid de 12 meses deve abrir
3. Selecione outro mês (ex: "Fev/2024")

**Verificar:**
- ✅ Botão atualiza para "Fev/2024"
- ✅ Cards superiores atualizam (receitas/despesas)
- ✅ Lista de transações filtra por mês
- ✅ Loading state aparece durante carregamento

### Teste 5: Tabs de Receitas/Despesas
**Passos:**
1. Clique na tab "Receitas"
2. Clique na tab "Despesas"

**Verificar:**
- ✅ Tab "Receitas" mostra apenas `type: 'income'`
- ✅ Tab "Despesas" mostra apenas `type: 'expense'`
- ✅ Loading state durante carregamento
- ✅ Mensagem "Nenhuma receita" se vazio

### Teste 6: Contas a Receber/Pagar
**Verificar:**
- ✅ Card "A Receber" lista transações futuras `type: 'income'`
- ✅ Card "A Pagar" lista transações futuras `type: 'expense'`
- ✅ Mostra data de vencimento
- ✅ Marca como "Vencida" se passou da data

### Teste 7: Cartão de Crédito
**Verificar:**
- ✅ Mostra valor utilizado
- ✅ Mostra limite disponível
- ✅ Mostra fatura atual
- ✅ Mostra data de vencimento
- ✅ Barra de progresso reflete utilização
- ✅ Percentual calculado corretamente

**Se vazio:**
- Crie um cartão via backend ou MongoDB

### Teste 8: Dívidas
**Verificar:**
- ✅ Card "Dívidas" lista dívidas ativas
- ✅ Mostra total pendente no topo
- ✅ Mostra descrição e instituição
- ✅ Mostra número de parcelas (ex: "24 - 6 parcelas")
- ✅ Mostra percentual pago (ex: "25%")

**Clicar em uma dívida:**
- ✅ Abre modal com detalhes
- ✅ Tab "Pendentes" mostra parcelas não pagas
- ✅ Tab "Pagas" mostra parcelas já pagas
- ✅ Botão "Pagar" em cada parcela pendente

### Teste 9: Pagar Parcela de Dívida
**Passos:**
1. Clique em uma dívida
2. Na tab "Pendentes", clique em "Pagar"

**Verificar:**
- ✅ Toast "Parcela paga com sucesso!"
- ✅ Parcela move para tab "Pagas"
- ✅ Percentual pago atualiza
- ✅ Total de dívidas no card diminui
- ✅ Modal atualiza automaticamente

### Teste 10: Chat
**Passos:**
1. Digite uma mensagem no chat
2. Pressione Enter ou clique em enviar

**Verificar:**
- ✅ Mensagem aparece na lista
- ✅ Mostra horário (ex: "14:35")
- ✅ Textarea reseta após enviar
- ✅ Scroll automático para última mensagem

### Teste 11: Carrossel de Cards
**Verificar:**
- ✅ Botões prev/next funcionam
- ✅ Indicadores (dots) mudam conforme card
- ✅ Animação suave de transição

---

## 🔧 Teste de API no Console

### Testar Endpoints Diretamente

```javascript
// 1. Resumo de transações
const summary = await API.getTransactionsSummary('2024-01-01', '2024-01-31');
console.log('Resumo:', summary);
// Esperado: { receitas: 1000, despesas: 500, saldo: 500 }

// 2. Últimas transações
const latest = await API.getLatestTransactions(5);
console.log('Últimas:', latest);
// Esperado: { transactions: [...], count: 5 }

// 3. Contas a receber
const receivables = await API.getReceivables(10);
console.log('A receber:', receivables);
// Esperado: { receivables: [...], count: 3, totalAmount: 1500 }

// 4. Cartões de crédito
const cards = await API.getCreditCards('active');
console.log('Cartões:', cards);
// Esperado: { cards: [...], count: 1 }

// 5. Utilização do cartão
const utilization = await API.getCreditCardUtilization('CARD_ID_AQUI');
console.log('Utilização:', utilization);
// Esperado: { utilizationPercentage: 45.5, currentBill: 2000, ... }

// 6. Dívidas
const debts = await API.getDebts('active');
console.log('Dívidas:', debts);
// Esperado: { debts: [...], count: 2, totalPending: 15000 }

// 7. Detalhes de dívida
const debtDetails = await API.getDebtDetails('DEBT_ID_AQUI');
console.log('Detalhes:', debtDetails);
// Esperado: { description, installmentCount, pendingInstallments: [...], ... }

// 8. Pagar parcela
const payment = await API.payInstallment('DEBT_ID_AQUI', 7);
console.log('Pagamento:', payment);
// Esperado: { message: 'Parcela paga', debt: {...} }
```

---

## 🐛 Problemas Comuns

### 1. "API is not defined"
**Causa:** Scripts carregados em ordem errada

**Solução:**
```html
<!-- Ordem CORRETA em dash.html -->
<script src="../js/utils.js"></script>     <!-- 1º -->
<script src="../js/api.js"></script>       <!-- 2º -->
<script src="../js/dashboard-ui.js"></script> <!-- 3º -->
```

### 2. "Failed to fetch"
**Causa:** Backend não está rodando

**Solução:**
```powershell
cd server
node server.js
```

### 3. "Token inválido"
**Causa:** Token JWT expirado ou corrompido

**Solução:**
```javascript
// Limpar localStorage e fazer login novamente
localStorage.clear();
window.location.href = 'index.html';
```

### 4. "userId is null"
**Causa:** Token não contém userId

**Solução:**
```javascript
// Verificar token no console
const token = localStorage.getItem('token');
const decoded = JSON.parse(atob(token.split('.')[1]));
console.log('Token decoded:', decoded);
// Deve conter: { id: '...', email: '...', ... }
```

### 5. Dados não aparecem
**Causa:** Usuário não tem dados no MongoDB

**Solução:**
```javascript
// Criar dados de teste via backend
await API.createTransaction({
  description: 'Teste',
  amount: 100,
  type: 'income',
  section: 'statement',
  date: new Date().toISOString()
});
```

### 6. CORS Error
**Causa:** Frontend e backend em domínios diferentes

**Solução:**
- Use mesmo domínio (localhost)
- Ou configure CORS no server.js

---

## 📊 Checklist de Validação

### Backend
- [ ] MongoDB conectado
- [ ] Server.js rodando (porta 5000)
- [ ] Collections criadas (users, transactions, etc)
- [ ] Usuário cadastrado

### Frontend
- [ ] api.js carregado (window.API existe)
- [ ] utils.js carregado (window.Utils existe)
- [ ] dashboard-ui.js carregado
- [ ] Token no localStorage
- [ ] userId extraído do token

### Funcionalidades
- [ ] Login funciona
- [ ] Cards superiores com valores reais
- [ ] Lista de transações carrega
- [ ] Filtro de mês atualiza dados
- [ ] Tabs de receitas/despesas funcionam
- [ ] Cartão de crédito mostra utilização
- [ ] Lista de dívidas carrega
- [ ] Modal de dívida abre ao clicar
- [ ] Pagar parcela atualiza banco
- [ ] Loading states aparecem
- [ ] Mensagens de erro amigáveis
- [ ] Estados vazios informativos

---

## ✅ Teste Completo Passou?

Se todos os itens acima funcionarem:

🎉 **PARABÉNS!** 🎉

O frontend está **100% conectado ao backend MongoDB** e funcionando perfeitamente!

---

## 📝 Relatório de Bugs

Se encontrou problemas, anote:

1. **Qual teste falhou?**
2. **Mensagem de erro no console?**
3. **Response da API no Network tab?**
4. **Estado do localStorage?**
5. **Server logs mostrando erro?**

Com essas informações, é fácil debugar! 🔧
