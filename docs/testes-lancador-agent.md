# Testes do Agente Lançador — Objetivos 1 a 4

**Data:** 28/01/2026  
**Versão:** 1.0

---

## 📋 Introdução

Este documento contém os testes manuais para validar o funcionamento do Agente Lançador.
Cada teste inclui:
- **Entrada:** Mensagem a ser enviada
- **Logs Esperados:** O que deve aparecer no console
- **Resposta Esperada:** O que o usuário deve ver

---

## 🔧 Pré-requisitos

1. Servidor rodando (`npm start` ou `node server.js`)
2. MongoDB conectado com schemas de Transaction, CreditCard e Debt
3. Usuário autenticado com `userId` válido

---

## 🧪 Testes do Objetivo 1 (Estrutura Base)

### Teste 1.1: Validação de Parâmetros Faltantes

**Entrada:**
```json
{
  "message": "",
  "userId": "user123"
}
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: (vazio ou undefined)
[LancadorAgent] ❌ Parâmetros inválidos
```

**Resposta Esperada:**
```
Erro: parâmetros inválidos. message e userId são obrigatórios.
```

---

### Teste 1.2: Carregamento de Categorias

**Entrada:**
```json
{
  "message": "gastei 50 reais no mercado",
  "userId": "user123"
}
```

**Logs Esperados (deve incluir):**
```
[LancadorAgent] 📥 Nova mensagem: gastei 50 reais no mercado
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
```

**Verificação:**
- Arquivo `categorias-lancamento.json` carregado sem erros
- Cache populado após primeira execução

---

## 🧪 Testes do Objetivo 2 (Extração e Classificação)

### Teste 2.1: Extração Completa — Despesa Simples

**Entrada:**
```
Gastei R$ 150 no supermercado hoje
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: Gastei R$ 150 no supermercado hoje
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ✅ Extração: R$ 150.00 | despesa | Alimentação
[LancadorAgent] 📊 Classificado: DESPESA_SIMPLES → [statement]
```

**Resposta Esperada:**
```
💸 **Despesa registrada com sucesso!**

📝 **Valor:** R$ 150,00
📁 **Categoria:** Alimentação > Supermercado
📅 **Data:** 2026-01-28
💳 **Forma de pagamento:** dinheiro

✅ **Registrado em:**
• Card Extrato
```

---

### Teste 2.2: Extração Completa — Receita

**Entrada:**
```
Recebi meu salário de 5.000 reais
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: Recebi meu salário de 5.000 reais
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ✅ Extração: R$ 5000.00 | receita | Salário
[LancadorAgent] 📊 Classificado: RECEITA_SIMPLES → [statement]
```

**Resposta Esperada:**
```
💰 **Receita registrada com sucesso!**

📝 **Valor:** R$ 5.000,00
📁 **Categoria:** Salário
📅 **Data:** 2026-01-28
💳 **Forma de pagamento:** transferência

✅ **Registrado em:**
• Card Extrato
```

---

### Teste 2.3: Extração com Cartão de Crédito e Parcelas

**Entrada:**
```
Comprei uma TV de 3000 reais no cartão em 10x
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: Comprei uma TV de 3000 reais no cartão em 10x
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ✅ Extração: R$ 3000.00 | despesa | Lazer
[LancadorAgent] 📊 Classificado: GASTO_CARTAO → [credit_card, scheduled]
```

**Resposta Esperada:**
```
💸 **Despesa registrada com sucesso!**

📝 **Valor:** R$ 3.000,00
📁 **Categoria:** Lazer > Eletrônicos
📅 **Data:** 2026-01-28
💳 **Forma de pagamento:** cartão de crédito (10x de R$ 300,00)

✅ **Registrado em:**
• Card Cartão de Crédito
• Card Contas Futuras

📅 Ações adicionais executadas: 1
```

---

### Teste 2.4: Dados Incompletos — Valor Faltante

**Entrada:**
```
Fui ao cinema ontem
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: Fui ao cinema ontem
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ⚠️ Dados incompletos → Iniciando diálogo
[LancadorAgent] 💬 Diálogo iniciado para sessionId: ...
```

**Resposta Esperada:**
```
❓ Qual foi o valor gasto no cinema?
```

---

### Teste 2.5: Dados Incompletos — Tipo Faltante

**Entrada:**
```
200 reais
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: 200 reais
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ⚠️ Dados incompletos → Iniciando diálogo
```

**Resposta Esperada:**
```
❓ Isso foi uma despesa ou uma receita?
```

---

## 🧪 Testes do Objetivo 3 (Persistência)

### Teste 3.1: Persistência de Despesa Simples

**Entrada:**
```
Paguei 80 reais de conta de luz
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: Paguei 80 reais de conta de luz
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ✅ Extração: R$ 80.00 | despesa | Contas
[LancadorAgent] 📊 Classificado: DESPESA_SIMPLES → [statement]
[LancadorAgent] ✅ Lançamento confirmado: 1 transação(ões)
```

**Verificação no MongoDB:**
```javascript
// Executar no MongoDB
db.transactions.findOne({ 
  userId: "user123", 
  amount: 80,
  category: "Contas"
})
```

**Deve retornar:**
```json
{
  "section": "statement",
  "type": "expense",
  "amount": 80,
  "category": "Contas",
  "status": "confirmed",
  "metadata": {
    "fonte": "lancador_agent"
  }
}
```

---

### Teste 3.2: Persistência com Parcelas

**Entrada:**
```
Comprei um celular de 2400 no cartão em 12x
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: Comprei um celular de 2400 no cartão em 12x
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ✅ Extração: R$ 2400.00 | despesa | Lazer
[LancadorAgent] 📊 Classificado: GASTO_CARTAO → [credit_card, scheduled]
[LancadorAgent] 📅 Parcelas criadas: 11
[LancadorAgent] ✅ Lançamento confirmado: 2 transação(ões)
```

**Verificação no MongoDB:**
```javascript
// Contar parcelas futuras
db.transactions.count({
  userId: "user123",
  "metadata.totalParcelas": 12,
  section: "scheduled"
})
// Deve retornar: 11 (parcelas 2 a 12)
```

---

### Teste 3.3: Conta a Pagar

**Entrada:**
```
Preciso pagar o IPTU de 1200 reais dia 15
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: Preciso pagar o IPTU de 1200 reais dia 15
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ✅ Extração: R$ 1200.00 | despesa | Impostos/Taxas
[LancadorAgent] 📊 Classificado: CONTA_PAGAR → [scheduled]
[LancadorAgent] ✅ Lançamento confirmado: 1 transação(ões)
```

**Verificação no MongoDB:**
```javascript
db.transactions.findOne({
  userId: "user123",
  section: "scheduled",
  "scheduled.scheduledType": "payable"
})
```

---

### Teste 3.4: Conta a Receber

**Entrada:**
```
Vou receber 500 reais do João semana que vem
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: Vou receber 500 reais do João semana que vem
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ✅ Extração: R$ 500.00 | receita | Renda Extra
[LancadorAgent] 📊 Classificado: CONTA_RECEBER → [scheduled]
[LancadorAgent] ✅ Lançamento confirmado: 1 transação(ões)
```

**Verificação no MongoDB:**
```javascript
db.transactions.findOne({
  userId: "user123",
  section: "scheduled",
  "scheduled.scheduledType": "receivable"
})
```

---

## 🧪 Testes do Objetivo 4 (Integração com Junior)

### Teste 4.1: Roteamento via Junior

**Entrada (via chat normal):**
```
Gastei 45 reais no Uber hoje
```

**Logs Esperados:**
```
[JuniorAgent] 📥 Mensagem recebida: Gastei 45 reais no Uber hoje
[JuniorAgent] 🎯 Classificação: lancamento
[JuniorAgent] 📝 Roteando para Lançador
[LancadorAgent] 📥 Nova mensagem: Gastei 45 reais no Uber hoje
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ✅ Extração: R$ 45.00 | despesa | Transporte
[LancadorAgent] 📊 Classificado: DESPESA_SIMPLES → [statement]
[LancadorAgent] ✅ Lançamento confirmado: 1 transação(ões)
[JuniorAgent] 💾 Lançamento salvo na memória
```

**Resposta Esperada:**
```
💸 **Despesa registrada com sucesso!**

📝 **Valor:** R$ 45,00
📁 **Categoria:** Transporte > Uber/99
📅 **Data:** 2026-01-28
💳 **Forma de pagamento:** aplicativo

✅ **Registrado em:**
• Card Extrato
```

---

### Teste 4.2: Diálogo Multi-turno via Junior

**Turno 1 — Entrada:**
```
Comprei uma roupa nova
```

**Logs Turno 1:**
```
[JuniorAgent] 📥 Mensagem recebida: Comprei uma roupa nova
[JuniorAgent] 🎯 Classificação: lancamento
[JuniorAgent] 📝 Roteando para Lançador
[LancadorAgent] 📥 Nova mensagem: Comprei uma roupa nova
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ⚠️ Dados incompletos → Iniciando diálogo
[LancadorAgent] 💬 Diálogo iniciado para sessionId: ...
```

**Resposta Turno 1:**
```
❓ Qual foi o valor gasto na roupa?
```

**Turno 2 — Entrada:**
```
150 reais
```

**Logs Turno 2:**
```
[JuniorAgent] 📥 Mensagem recebida: 150 reais
[JuniorAgent] 🎯 Classificação: lancamento
[JuniorAgent] 📝 Roteando para Lançador
[LancadorAgent] 📥 Nova mensagem: 150 reais
[LancadorAgent] 🔄 Continuando diálogo (pergunta 2)
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ✅ Extração: R$ 150.00 | despesa | Vestuário
[LancadorAgent] 📊 Classificado: DESPESA_SIMPLES → [statement]
[LancadorAgent] ✅ Diálogo concluído → Persistindo
[LancadorAgent] ✅ Lançamento confirmado: 1 transação(ões)
```

**Resposta Turno 2:**
```
💸 **Despesa registrada com sucesso!**

📝 **Valor:** R$ 150,00
📁 **Categoria:** Vestuário
📅 **Data:** 2026-01-28
💳 **Forma de pagamento:** dinheiro

✅ **Registrado em:**
• Card Extrato
```

---

### Teste 4.3: Cancelamento de Diálogo

**Turno 1:**
```
Comprei algo
```

**Turno 2:**
```
deixa, esquece
```

**Logs Turno 2:**
```
[LancadorAgent] 📥 Nova mensagem: deixa, esquece
[LancadorAgent] 🔄 Continuando diálogo (pergunta 2)
```

**Resposta Turno 2:**
```
✅ Ok, lançamento cancelado. Se precisar registrar algo, é só me dizer!
```

---

### Teste 4.4: Erro de Persistência (Teste de Falha)

**Cenário:** Simular falha do MongoDB (desconectar banco)

**Entrada:**
```
Gastei 100 reais
```

**Logs Esperados:**
```
[LancadorAgent] 📥 Nova mensagem: Gastei 100 reais
[LancadorAgent] 🤖 Extraindo dados via GPT-5 Mini
[LancadorAgent] ✅ Extração: R$ 100.00 | despesa | Outros
[LancadorAgent] 📊 Classificado: DESPESA_SIMPLES → [statement]
[LancadorAgent] ❌ Erro ao persistir: <mensagem do MongoDB>
[JuniorAgent] ❌ Erro no Lançador: <mensagem>
```

**Resposta Esperada:**
```
❌ Desculpe, ocorreu um erro ao processar seu lançamento. Por favor, tente novamente.
```

---

## 📊 Resumo de Logs Essenciais

### Logs Sempre Visíveis (Estratégicos)

| Prefixo | Significado | Quando Aparece |
|---------|-------------|----------------|
| `[LancadorAgent] 📥` | Entrada recebida | Início de cada execução |
| `[LancadorAgent] 🤖` | Chamada ao GPT-5 | Extração de dados |
| `[LancadorAgent] ✅ Extração:` | Resultado da extração | Após GPT responder |
| `[LancadorAgent] 📊 Classificado:` | Tipo de lançamento | Após classificação |
| `[LancadorAgent] ⚠️ Dados incompletos` | Dados faltantes | Quando inicia diálogo |
| `[LancadorAgent] 💬 Diálogo iniciado` | Sessão de diálogo | Primeiro turno incompleto |
| `[LancadorAgent] 🔄 Continuando diálogo` | Turno adicional | Diálogo multi-turno |
| `[LancadorAgent] ✅ Diálogo concluído` | Fim do diálogo | Dados completados |
| `[LancadorAgent] 📅 Parcelas criadas:` | Parcelas futuras | Compras parceladas |
| `[LancadorAgent] ✅ Lançamento confirmado:` | Persistência OK | Sucesso no MongoDB |
| `[LancadorAgent] ❌ Erro` | Falha | Qualquer erro crítico |
| `[JuniorAgent] 📝 Roteando` | Handover | Antes de chamar Lançador |
| `[JuniorAgent] 💾 Lançamento salvo` | Memória OK | Após salvar memória |

---

## ✅ Checklist de Validação

- [ ] **Objetivo 1:** Logs de entrada e validação aparecem
- [ ] **Objetivo 2:** Extração retorna valor, tipo e categoria corretamente
- [ ] **Objetivo 2:** Classificação mapeia para sections corretas
- [ ] **Objetivo 2:** Diálogo inicia quando dados faltam
- [ ] **Objetivo 3:** Transações são salvas no MongoDB
- [ ] **Objetivo 3:** Parcelas futuras são criadas para compras parceladas
- [ ] **Objetivo 3:** Cards corretos são populados (statement, scheduled, etc.)
- [ ] **Objetivo 4:** Junior roteia corretamente para Lançador
- [ ] **Objetivo 4:** Diálogo multi-turno funciona via Junior
- [ ] **Objetivo 4:** Memória é salva após lançamento (WRITE_ONLY)
- [ ] **Objetivo 4:** Erros são tratados e mensagem amigável é retornada

---

## 🔍 Comandos Úteis para Debug

### Verificar Transações no MongoDB
```javascript
// Listar últimos lançamentos
db.transactions.find({ "metadata.fonte": "lancador_agent" })
  .sort({ createdAt: -1 })
  .limit(10)

// Contar por section
db.transactions.aggregate([
  { $match: { "metadata.fonte": "lancador_agent" } },
  { $group: { _id: "$section", count: { $sum: 1 } } }
])

// Verificar parcelas
db.transactions.find({ 
  "metadata.fonte": "lancador_agent",
  "metadata.parcela": { $exists: true }
})
```

### Limpar Dados de Teste
```javascript
// CUIDADO: Remove todos os lançamentos do agente
db.transactions.deleteMany({ "metadata.fonte": "lancador_agent" })
```
