# 📋 Guia de Testes - Card Contas Futuras

## 🎯 Objetivo
Validar a integração completa do card "Contas Futuras" (A receber / A pagar) com o backend MongoDB.

## 🔧 Pré-requisitos

### Servidores Rodando
1. **serverAgent.js** (porta 5000)
   ```bash
   cd server
   node serverAgent.js
   ```

2. **server.js** (porta 3000)
   ```bash
   cd server
   node server.js
   ```

### Banco de Dados
- MongoDB conectado e acessível
- Connection string configurada no `.env`

### Autenticação
- Usuário logado no sistema
- Token JWT válido armazenado no localStorage

## 📝 Como Executar os Testes

### 1. Abrir o Dashboard
1. Navegue até: `http://localhost:porta/html/dash.html`
2. Faça login se necessário
3. Abra o Console do navegador (F12)

### 2. Executar Teste Completo
```javascript
await testeCompleto()
```

**O que este teste faz:**
- ✅ Verifica autenticação do usuário
- ✅ Cria uma conta a receber de exemplo
- ✅ Cria uma conta a pagar de exemplo
- ✅ Busca todas as contas a receber do mês
- ✅ Busca todas as contas a pagar do mês
- ✅ Renderiza os dados no card do dashboard
- ✅ Exibe resumo dos resultados

### 3. Testes Individuais

#### Criar Conta a Receber
```javascript
await criarContaReceber()
```
Cria uma conta a receber com vencimento em 10 dias.

#### Criar Conta a Pagar
```javascript
await criarContaPagar()
```
Cria uma conta a pagar com vencimento em 20 dias.

#### Buscar Contas a Receber
```javascript
await buscarContasReceber()
```
Lista todas as contas a receber do mês atual.

#### Buscar Contas a Pagar
```javascript
await buscarContasPagar()
```
Lista todas as contas a pagar do mês atual.

#### Renderizar no Card
```javascript
await testarRenderizacao()
```
Atualiza o card "Contas Futuras" no dashboard.

### 4. Testes Rápidos

#### Teste Apenas A Receber
```javascript
await testeReceber()
```
Cria, busca e renderiza uma conta a receber.

#### Teste Apenas A Pagar
```javascript
await testePagar()
```
Cria, busca e renderiza uma conta a pagar.

## 🔍 Validações Esperadas

### No Console
- ✅ Mensagens de sucesso em verde
- 📊 Dados das transações criadas
- 📈 Listas de contas encontradas
- ⚠️ Avisos se houver problemas (em amarelo)
- ❌ Erros detalhados se algo falhar (em vermelho)

### No Dashboard
1. **Card Contas Futuras visível no carrossel**
2. **Aba "A receber":**
   - Lista de contas a receber
   - Descrição de cada conta
   - Data de vencimento formatada
   - Valor em verde (positivo)
   - Ordenação por data (mais próximas primeiro)

3. **Aba "A pagar":**
   - Lista de contas a pagar
   - Descrição de cada conta
   - Data de vencimento formatada
   - Valor em vermelho (negativo)
   - Ordenação por data (mais próximas primeiro)

4. **Comportamento dos toggles:**
   - Clicar em "A receber" mostra apenas contas a receber
   - Clicar em "A pagar" mostra apenas contas a pagar
   - Alternância suave entre as abas

### No MongoDB
Execute no MongoDB Compass ou shell:
```javascript
db.transactions.find({
  section: 'scheduled',
  userId: ObjectId('SEU_USER_ID')
}).pretty()
```

**Campos esperados:**
- `section`: 'scheduled'
- `type`: 'income' (receber) ou 'expense' (pagar)
- `scheduled.scheduledType`: 'receivable' ou 'payable'
- `scheduled.dueDate`: data de vencimento
- `amount`: valor positivo
- `description`: descrição da conta
- `status`: 'pending'

## 🐛 Solução de Problemas

### Erro: "Usuário não autenticado"
**Solução:** Faça login novamente
```javascript
window.location.href = '/html/index.html'
```

### Erro: "Failed to fetch" ou "Network error"
**Causa:** Servidor não está rodando
**Solução:** Verifique se serverAgent.js está ativo na porta 5000

### Erro: "is not allowed"
**Causa:** Formato de requisição incorreto
**Solução:** Verifique se dataService.js está usando o formato correto:
```javascript
{
  agent_name: 'DataAgent',
  action: 'createTransaction',
  parameters: { ... },
  context: {
    session_id: 'xxx',
    user_id: 'yyy'
  }
}
```

### Contas não aparecem no card
**Possíveis causas:**
1. Filtro de mês diferente (use o seletor de data no topo)
2. Contas criadas em mês diferente do selecionado
3. Erro silencioso no console (verifique F12)

**Solução:**
```javascript
// Verificar mês selecionado
console.log('Mês atual:', getMesAtual())

// Forçar atualização
await testarRenderizacao()
```

## 📊 Exemplo de Saída Esperada

```
╔═══════════════════════════════════════════╗
║   TESTE COMPLETO - CARD CONTAS FUTURAS   ║
╚═══════════════════════════════════════════╝

1️⃣ Verificando autenticação...
✅ Usuário autenticado: 67890abcdef12345

2️⃣ Criando conta a receber...
✅ Conta a receber criada com sucesso!

3️⃣ Criando conta a pagar...
✅ Conta a pagar criada com sucesso!

4️⃣ Buscando contas a receber...
✅ Encontradas 3 contas a receber

5️⃣ Buscando contas a pagar...
✅ Encontradas 2 contas a pagar

6️⃣ Testando renderização...
✅ Renderização concluída!

╔═══════════════════════════════════════════╗
║            RESUMO DOS TESTES             ║
╚═══════════════════════════════════════════╝
✅ Conta a receber criada: SIM
✅ Conta a pagar criada: SIM
📥 Contas a receber encontradas: 3
📤 Contas a pagar encontradas: 2

🎉 Testes concluídos!
```

## 🎨 Validação Visual

### Checklist de Interface
- [ ] Card "Contas Futuras" visível no carrossel
- [ ] Botões de toggle "A receber" / "A pagar" funcionando
- [ ] Lista de contas a receber renderizada corretamente
- [ ] Lista de contas a pagar renderizada corretamente
- [ ] Datas formatadas corretamente (dd MMM)
- [ ] Valores monetários formatados (R$ X.XXX,XX)
- [ ] Cores adequadas (verde para receber, vermelho para pagar)
- [ ] Ordenação por data de vencimento
- [ ] Mensagem "Nenhuma conta..." quando não há dados
- [ ] Loading state durante busca
- [ ] Responsivo em diferentes tamanhos de tela

## 📚 Referências

### Arquivos Relacionados
- **Frontend:**
  - `client/js/dataService.js` - API calls
  - `client/js/dash-data.js` - Renderização
  - `client/js/dash.js` - Controle de UI
  - `client/html/dash.html` - Estrutura HTML

- **Backend:**
  - `server/serverAgent.js` - Servidor de agentes
  - `server/src/agents/data/data-agent.js` - DataAgent
  - `server/src/database/schemas/transactions-schema.js` - Schema

### Schemas Relevantes
```javascript
// transactions-schema.js - Section: scheduled
{
  section: 'scheduled',
  type: 'income' | 'expense',
  amount: Number,
  description: String,
  date: Date,
  status: 'pending' | 'confirmed',
  scheduled: {
    scheduledType: 'receivable' | 'payable',
    dueDate: Date,
    frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  }
}
```

## 🚀 Próximos Passos

Após validar este card, os próximos cards a implementar são:
1. ✅ Card Extrato (Receitas/Despesas) - **COMPLETO**
2. ✅ Card Contas Futuras (A receber/A pagar) - **COMPLETO**
3. ⏳ Card Últimas Transações
4. ⏳ Card Cartão de Crédito
5. ⏳ Card Dívidas
6. ⏳ Card Patrimônio

---

**Última atualização:** Janeiro 2026
**Versão:** 1.0.0
