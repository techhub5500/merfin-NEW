# 🎯 Limitações de Memória e Histórico - Explicação Detalhada

## 📋 Visão Geral

O sistema implementa **limitações inteligentes** para otimizar o consumo de tokens e custo, sem perder a qualidade das respostas.

---

## 📖 LIMITE DE HISTÓRICO: 5 MENSAGENS

### ❓ O que significa?

Apenas as **últimas 5 trocas de mensagens** são enviadas para a IA a cada interação.

### 📊 Exemplo Prático:

**Conversa completa (10 mensagens):**
```
1. U: olá
   A: Olá! Como posso ajudar?

2. U: minha renda é R$ 5.000
   A: Entendi! Vou registrar sua renda.

3. U: gasto R$ 2.000 com aluguel
   A: Anotado. Aluguel de R$ 2.000.

4. U: e R$ 800 com alimentação
   A: Registrado. R$ 800 em alimentação.

5. U: tenho R$ 500 de conta de luz
   A: Ok, R$ 500 de luz.

6. U: quanto sobra no final do mês?
   A: Calculando... Sobram R$ 1.700 por mês.

7. U: posso investir esse valor?
   A: Sim! R$ 1.700 é um ótimo valor para investir.

8. U: que tipo de investimento você recomenda?
   A: Para iniciantes, recomendo Tesouro Direto e CDBs.

9. U: quanto rende por mês no Tesouro?
   A: Cerca de R$ 20-30 por mês, dependendo da taxa.

10. U: e na poupança? ← MENSAGEM ATUAL
    A: ???
```

**O que a IA VÊ (apenas últimas 5):**

```
🔍 CONTEXTO ENVIADO PARA IA:

### Conversa:
Usuário perguntou sobre rendimentos. Já discutimos renda, gastos e investimentos.

Histórico:
U: posso investir esse valor?
A: Sim! R$ 1.700 é um ótimo valor para investir.
U: que tipo de investimento você recomenda?
A: Para iniciantes, recomendo Tesouro Direto e CDBs.
U: quanto rende por mês no Tesouro?
A: Cerca de R$ 20-30 por mês, dependendo da taxa.

U: e na poupança?
A:
```

### ✅ Por que funciona?

1. **Memória Episódica** guarda o resumo da conversa completa
2. **Long-term Memory** armazena dados importantes (renda, gastos, objetivos)
3. **Histórico recente** mantém o contexto imediato

**Resultado:** A IA sabe que você tem R$ 5.000 de renda (LTM) e está comparando investimentos (histórico recente).

---

### 🔢 Impacto em Tokens:

| Cenário | Mensagens | Tokens Aprox. | Custo |
|---------|-----------|---------------|-------|
| **SEM limite** | 10 pares (20 msgs) | ~600 tokens | $0.00012 |
| **COM limite (5)** | 5 pares (10 msgs) | ~120 tokens | $0.00002 |
| **Economia** | -50% | **-80%** | **-83%** |

---

### ⚠️ Quando aumentar?

**Mantenha em 5 se:**
- Chat casual/simples
- Informações importantes são memorizadas (LTM)
- Conversas curtas (< 10 mensagens)

**Aumente para 10 se:**
- Conversas técnicas longas
- Contexto temporal crítico (ex: "como você disse há 7 mensagens...")
- Depuração/análise complexa

**Aumente para 20+ se:**
- Análise de longo prazo
- Planejamento financeiro detalhado
- Sessões de consultoria (aceitar custo maior)

---

### 💡 Como ajustar:

```javascript
// Em: server/src/agents/junior/junior/junior-agent.js

// PADRÃO (economiza tokens):
const agentHistory = chatIntegration.convertHistoryForAgent(history || []).slice(-5);

// AUMENTAR para 10 mensagens:
const agentHistory = chatIntegration.convertHistoryForAgent(history || []).slice(-10);

// AUMENTAR para 20 mensagens:
const agentHistory = chatIntegration.convertHistoryForAgent(history || []).slice(-20);

// SEM LIMITE (cuidado com tokens!):
const agentHistory = chatIntegration.convertHistoryForAgent(history || []);
```

---

## 💾 LIMITE DE LONG-TERM MEMORY: 3 MEMÓRIAS

### ❓ O que significa?

Apenas as **3 memórias mais importantes** (maior `impactScore`) são enviadas para a IA.

### 📊 Exemplo Prático:

**Banco de memórias do usuário (10 memórias salvas):**

```javascript
Long-Term Memory (ordenado por impactScore):

1. [impactScore: 0.95] situacao_financeira
   "Edmar ganha R$ 5.000 por mês, trabalha como desenvolvedor"

2. [impactScore: 0.88] objetivos
   "Edmar quer comprar casa própria em 5 anos, precisa juntar R$ 150.000"

3. [impactScore: 0.82] dividas
   "Edmar deve R$ 2.000 no cartão de crédito, taxa de 12% a.m."

4. [impactScore: 0.75] habitos_gastos
   "Edmar gasta R$ 800/mês com delivery e streaming"

5. [impactScore: 0.68] investimentos_atuais
   "Edmar tem R$ 10.000 na poupança rendendo 0.5% a.m."

6. [impactScore: 0.60] preferencias_investimento
   "Edmar prefere investimentos conservadores, evita risco"

7. [impactScore: 0.52] historico_financeiro
   "Edmar já tentou criar orçamento 3 vezes, mas não manteve"

8. [impactScore: 0.45] contexto_familiar
   "Edmar é casado, tem 2 filhos (5 e 8 anos)"

9. [impactScore: 0.38] educacao_financeira
   "Edmar não tem conhecimento avançado sobre investimentos"

10. [impactScore: 0.30] preferencias_comunicacao
    "Edmar prefere explicações simples e diretas"
```

**O que a IA VÊ (apenas top 3):**

```
🔍 CONTEXTO ENVIADO PARA IA:

### Info Importante:
• Edmar ganha R$ 5.000 por mês, trabalha como desenvolvedor
• Edmar quer comprar casa própria em 5 anos, precisa juntar R$ 150.000
• Edmar deve R$ 2.000 no cartão de crédito, taxa de 12% a.m.
```

### ✅ Por que funciona?

1. **Impact Score** é calculado automaticamente
2. Memórias mais **relevantes e recentes** têm score maior
3. Top 3 cobre **80-90%** das informações críticas

### 🎯 Como o Impact Score é calculado:

```javascript
Impact Score = (
  Relevância do Conteúdo × 0.4 +        // Quão importante é o conteúdo?
  Recência × 0.3 +                       // Quão recente é?
  Frequência de Uso × 0.2 +              // Quantas vezes foi útil?
  Especificidade × 0.1                   // Quão específico/único é?
)

Exemplo:
- "Edmar ganha R$ 5.000" = 0.95 (alta relevância, sempre útil)
- "Edmar prefere tons claros" = 0.30 (baixa relevância, raramente útil)
```

---

### 🔢 Impacto em Tokens:

| Cenário | Memórias | Tokens Aprox. | Custo |
|---------|----------|---------------|-------|
| **SEM limite** | 10 memórias | ~300 tokens | $0.00006 |
| **COM limite (3)** | 3 memórias | ~80 tokens | $0.00002 |
| **Economia** | -70% | **-73%** | **-67%** |

---

### ⚠️ Quando aumentar?

**Mantenha em 3 se:**
- Perfil simples do usuário
- Chat casual
- Informações complementares não são críticas

**Aumente para 5 se:**
- Perfil complexo (muitos investimentos, dívidas, objetivos)
- Análises financeiras detalhadas
- Múltiplas contas/cartões

**Aumente para 10+ se:**
- Planejamento financeiro completo
- Consultoria personalizada
- Precisa de TODAS as informações do usuário

---

### 💡 Como ajustar:

```javascript
// Em: server/src/core/memory/memory-integration.js

// Buscar long-term memories (linha ~70)

// PADRÃO (economiza tokens):
const ltmData = await longTermMemory.retrieve(userId, '', {
  limit: 3,
  useVectorSearch: false
});

// AUMENTAR para 5 memórias:
const ltmData = await longTermMemory.retrieve(userId, '', {
  limit: 5,
  useVectorSearch: false
});

// AUMENTAR para 10 memórias:
const ltmData = await longTermMemory.retrieve(userId, '', {
  limit: 10,
  useVectorSearch: false
});

// SEM LIMITE (todas as memórias):
const ltmData = await longTermMemory.retrieve(userId, '', {
  limit: 100, // ou qualquer número alto
  useVectorSearch: false
});
```

---

### 📊 E no formatContextForPrompt:

```javascript
// Em: server/src/core/memory/memory-integration.js

// PADRÃO (máximo 3 na saída):
const topMemories = context.longTermMemory.slice(0, 3);

// AUMENTAR para 5:
const topMemories = context.longTermMemory.slice(0, 5);

// AUMENTAR para 10:
const topMemories = context.longTermMemory.slice(0, 10);

// TODAS (já limitadas no retrieve):
const topMemories = context.longTermMemory; // sem slice
```

---

## 📊 RESUMO COMPARATIVO

### Consumo Total por Interação:

| Configuração | Input Tokens | Output Tokens | Custo/Msg | Qualidade |
|--------------|--------------|---------------|-----------|-----------|
| **Sem limites** | ~600 | ~200 | $0.00028 | ⭐⭐⭐⭐⭐ |
| **Limites padrão (5 hist, 3 LTM)** | ~150 | ~200 | $0.00019 | ⭐⭐⭐⭐ |
| **Limites agressivos (3 hist, 1 LTM)** | ~80 | ~200 | $0.00017 | ⭐⭐⭐ |
| **Limites altos (10 hist, 5 LTM)** | ~280 | ~200 | $0.00023 | ⭐⭐⭐⭐⭐ |

### Recomendação por Caso de Uso:

| Caso de Uso | Histórico | LTM | Custo/1000 msgs | Qualidade |
|-------------|-----------|-----|-----------------|-----------|
| **Chat Casual** | 3-5 | 1-3 | $0.17-0.19 | ⭐⭐⭐⭐ |
| **Assistente Financeiro** | 5-7 | 3-5 | $0.19-0.23 | ⭐⭐⭐⭐⭐ |
| **Consultoria Premium** | 10-20 | 5-10 | $0.23-0.28 | ⭐⭐⭐⭐⭐ |
| **Análise Complexa** | 20+ | 10+ | $0.28+ | ⭐⭐⭐⭐⭐ |

---

## 🎯 QUANDO AJUSTAR AS LIMITAÇÕES?

### 🟢 Sinais de que limites estão OK:
- ✅ IA responde coerentemente
- ✅ Não pede informações já fornecidas
- ✅ Custo controlado (~$0.20 por 1000 mensagens)
- ✅ Conversas naturais

### 🟡 Sinais de que pode AUMENTAR limites:
- ⚠️ IA esquece contexto importante
- ⚠️ Pede dados já informados 5+ mensagens atrás
- ⚠️ Respostas genéricas (não usa memórias)
- ⚠️ Qualidade abaixo do esperado

### 🔴 Sinais de que deve DIMINUIR limites:
- ❌ Custo alto demais (>$0.30 por 1000 msgs)
- ❌ Timeouts/lentidão
- ❌ Tokens de input > 400 constantemente
- ❌ Conversas simples não justificam contexto grande

---

## 💡 DICAS FINAIS

### 1. Monitore os logs:
```
[JuniorAgent] 💰 CONSUMO DE TOKENS: {
  input: 156,
  output: 200,
  reasoning: 350,
  total: 706
}
```

Se `input` estiver consistentemente alto (>300), considere reduzir limites.

### 2. Ajuste gradualmente:
- Não pule de 3→10 de uma vez
- Teste 3→5→7→10
- Avalie impacto em qualidade E custo

### 3. Personalize por tipo de conversa:
```javascript
// Para análises financeiras complexas:
if (isFinancialAnalysis) {
  historyLimit = 10;
  ltmLimit = 5;
}

// Para chat casual:
else {
  historyLimit = 5;
  ltmLimit = 3;
}
```

### 4. Use Category Descriptions:
- Resumos automáticos salvam tokens
- 1 resumo substitui 5-10 memórias individuais
- Atualizados automaticamente

---

**Data:** 25/01/2026
**Versão:** 1.0
**Autor:** Sistema de IA
