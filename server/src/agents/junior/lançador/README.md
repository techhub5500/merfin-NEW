# Agente Lançador — Documentação Técnica

**Versão:** 1.0  
**Data:** 28/01/2026  
**Status:** Objetivos 1 e 2 implementados (Extração e Classificação)

---

## 📋 Visão Geral

O **Agente Lançador** é responsável por processar lançamentos financeiros em linguagem natural, extraindo dados estruturados e classificando-os para persistência no banco de dados.

### Responsabilidades

1. **Receber** queries de lançamento do Agente Junior (via `routeToLancador()`)
2. **Extrair** informações financeiras usando GPT-5 Mini
3. **Classificar** tipo de lançamento (receita, despesa, cartão, futuras, dívidas)
4. **Persistir** no banco de dados (Objetivo 3 - pendente)
5. **Confirmar** ao usuário o que foi registrado
6. **Dialogar** quando informações estão incompletas

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     AGENTE JUNIOR                            │
│                   routeToLancador()                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   AGENTE LANÇADOR                            │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   execute()   │───▶│  _extrair    │───▶│ _classificar │   │
│  │              │    │ DadosLanc()  │    │ Lancamento() │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                                       │            │
│         ▼                                       ▼            │
│  ┌──────────────┐                      ┌──────────────┐     │
│  │  _iniciar    │                      │  _montar     │     │
│  │   Dialogo()  │                      │ Confirmacao  │     │
│  └──────────────┘                      └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Arquivos

```
server/src/agents/
├── junior/
│   └── lançador/
│       ├── lancador-agent.js     ← Agente principal
│       └── README.md             ← Esta documentação
└── jsons/
    └── categorias-lancamento.json ← Categorias e palavras-chave
```

---

## 🔧 Constantes e Tipos

### Tipos de Lançamento (`LANCAMENTO_TYPES`)

| ID | Descrição | Cards Afetados |
|----|-----------|----------------|
| `receita_simples` | Receita à vista (salário, freelance) | Extrato, Últimas Transações, Cards Topo |
| `despesa_simples` | Despesa à vista (supermercado, contas) | Extrato, Últimas Transações, Cards Topo |
| `gasto_cartao` | Compra no cartão de crédito | Extrato + Cartão de Crédito |
| `pagamento_fatura` | Pagamento de fatura | Extrato, atualiza utilização |
| `conta_receber` | Conta futura a receber | Contas Futuras (A receber) |
| `conta_pagar` | Conta futura a pagar | Contas Futuras (A pagar) |
| `pagamento_divida` | Pagamento de parcela de dívida | Extrato + Dívidas |
| `nova_divida` | Criação de nova dívida | Dívidas |

### Categorias (`CATEGORIAS`)

- Alimentação, Transporte, Moradia, Saúde, Educação
- Lazer, Vestuário, Contas, Salário, Investimentos, Outros

---

## 🧠 Fluxo de Processamento

### 1. Extração de Dados

O método `_extrairDadosLancamento()` usa GPT-5 Mini para extrair:

```javascript
{
  valor: 150.00,           // Obrigatório
  tipo: "despesa",         // Obrigatório: "receita" | "despesa"
  categoria: "Alimentação",
  subcategoria: "Supermercado",
  descricao: "Compra supermercado",
  data: "2026-01-28",      // Formato ISO
  forma_pagamento: "À vista",
  parcelas: null,          // Número se parcelado
  cartao_credito: false,
  conta_futura: false,
  divida_relacionada: false,
  incompleto: false,
  campos_faltantes: [],
  pergunta_sugerida: null
}
```

### 2. Classificação

O método `_classificarLancamento()` determina:
- **Tipo de lançamento**: Qual constante `LANCAMENTO_TYPES`
- **Sections**: Em qual(is) seção(ões) do banco persistir
- **Ações adicionais**: Criar parcelas, atualizar dívidas, etc.

### 3. Diálogo (Informações Incompletas)

Se `incompleto: true`, inicia diálogo:
- Máximo de 3 perguntas
- Usuário pode cancelar com "esquece", "cancela", etc.
- Após completar dados, prossegue para classificação

---

## 💬 Exemplos de Uso

### Receita
```
Usuário: "Recebi meu salário de R$ 5.000"
→ Tipo: receita_simples
→ Categoria: Salário
→ Section: statement (type: income)
→ Cards: Extrato, Últimas Transações, Cards Topo
```

### Despesa Simples
```
Usuário: "Gastei R$ 150 no supermercado"
→ Tipo: despesa_simples
→ Categoria: Alimentação > Supermercado
→ Section: statement (type: expense)
→ Cards: Extrato, Últimas Transações, Cards Topo
```

### Gasto no Cartão
```
Usuário: "Comprei um celular de R$ 2.400 em 12x no cartão"
→ Tipo: gasto_cartao
→ Sections: statement + credit_card
→ Ações: criar_parcelas (11 parcelas futuras)
→ Cards: Extrato, Cartão de Crédito, Contas Futuras
```

### Informação Incompleta
```
Usuário: "Gastei no mercado"
→ incompleto: true
→ Pergunta: "Qual foi o valor exato dessa transação?"
```

---

## 🔌 Integração com Junior Agent

O Junior Agent chama o Lançador via `routeToLancador()`:

```javascript
// Em junior-agent.js
async routeToLancador(params) {
  const lancador = new LancadorAgent();
  return await lancador.run({ parameters: params });
}
```

**Política de Memória:** WRITE_ONLY
- Não recebe contexto de memória
- Apenas salva a interação após processar

---

## 📊 Mapeamento Sections → Cards

| Section | scheduledType | type | Cards Afetados |
|---------|--------------|------|----------------|
| `statement` | - | income | Extrato (Receitas), Últimas Tx, Cards Topo |
| `statement` | - | expense | Extrato (Despesas), Últimas Tx, Cards Topo |
| `credit_card` | - | expense | Cartão de Crédito |
| `scheduled` | receivable | income | Contas Futuras (A receber) |
| `scheduled` | payable | expense | Contas Futuras (A pagar) |
| `debt` | - | - | Dívidas |

---

## 🚧 Pendências (Objetivos 3 e 4)

### Objetivo 3: Persistência
- [ ] Implementar `_persistirLancamento()`
- [ ] Integrar com `Transaction.create()`
- [ ] Implementar `_criarParcelasCartao()`
- [ ] Implementar `_atualizarDivida()`
- [ ] Implementar `_buscarCartaoPrincipal()`

### Objetivo 4: Integração Completa
- [ ] Atualizar `routeToLancador()` no Junior Agent
- [ ] Testes end-to-end
- [ ] Verificar atualização dos cards no dashboard

---

## 📝 Modelo de IA

- **Modelo:** GPT-5 Mini
- **Reasoning:** low (velocidade)
- **Verbosity:** low (economia de tokens)
- **Timeout:** 30 segundos
- **Max tokens:** 500

---

## 🧪 Queries de Teste

```javascript
// Receitas
"Recebi meu salário de R$ 5.000"
"Entrou R$ 500 de freelance"

// Despesas
"Gastei R$ 150 no supermercado"
"Paguei R$ 180 de conta de luz"

// Cartão
"Gastei R$ 500 no cartão no restaurante"
"Comprei um celular de R$ 2.400 em 12x no cartão"

// Incompletos
"Gastei 200 reais"        // Sem categoria
"Comprei algo hoje"       // Sem valor

// Cancelamento
"esquece"
"cancela"
```
