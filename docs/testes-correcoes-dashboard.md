# 📋 Testes de Correções do Dashboard Financeiro

**Data:** 28/01/2026  
**Versão:** 2.2.0

Este documento contém os testes para validar todas as correções implementadas no Dashboard Financeiro.

## ⚠️ Correções Implementadas (v2.2.0)

### Problema 1: Dívidas não eram criadas
- **Causa:** O schema Debt requer campos obrigatórios (`installmentValue`, `firstPaymentDate`, `totalValue`, `debtDate`, `institution`) que não estavam sendo preenchidos.
- **Correção:** Funções `_criarNovaDivida()` e `_criarDividaCartao()` foram reescritas para usar os campos corretos do schema.

### Problema 2: Datas ficando um dia atrasadas
- **Causa:** Uso de `toISOString()` que converte para UTC, causando diferença de timezone (Brasil UTC-3).
- **Correção:** Nova função `_formatarDataLocal()` que formata datas usando timezone local, e uso de `T12:00:00` na criação de datas para evitar problemas de virada de dia.

### Problema 3: Cards do topo não atualizavam
- **Causa:** Cache de 1-5 minutos nos dados financeiros.
- **Correção:** TTL de cache reduzido para 5 segundos em `ACCOUNT_BALANCE`, `RECENT_TRANSACTIONS` e `ACCOUNT_SUMMARY`.

### Problema 4: Logs insuficientes
- **Causa:** Poucos logs estratégicos no fluxo de lançamento.
- **Correção:** Adicionados logs detalhados na persistência, criação de dívidas e classificação.

### Problema 5: Cartão de crédito não funcionava sem cadastro prévio
- **Causa:** A função `_buscarCartaoPrincipal()` retornava null se não houvesse cartão cadastrado.
- **Correção:** Agora cria automaticamente um cartão de crédito default (limite R$ 5.000) se não existir nenhum.

### Problema 6: Transações de cartão sem cardId
- **Causa:** Se não houvesse cartão, a transação era criada sem cardId e não aparecia na fatura.
- **Correção:** Garantido que sempre existe um cartão antes de criar transações de crédito.

---

## 🔧 IMPORTANTE: Reiniciar o serverAgent.js

Após estas correções, **reinicie o serverAgent.js** para aplicar as mudanças:
```bash
cd server
node serverAgent.js
```

---

## 1. ⚡ Atualização e Refresh em Tempo Real

### Teste 1.1 - Lançamento de Despesa Simples
**Pré-requisito:** Dashboard aberto, logado com usuário válido

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Digitar no chat: "Gastei 50 reais no supermercado" | ✅ Mensagem enviada |
| 2 | Aguardar resposta do agente | ✅ Confirmação de lançamento |
| 3 | Verificar card "Extrato" (aba Despesas) | ✅ "Supermercado - R$ 50,00" aparece SEM precisar recarregar |
| 4 | Verificar card "Últimas Transações" | ✅ Transação aparece no topo da lista |
| 5 | Verificar card "Despesas" no topo | ✅ Valor atualizado automaticamente |

### Teste 1.2 - Lançamento de Receita Simples
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Digitar: "Recebi 3000 reais de salário hoje" | ✅ Mensagem enviada |
| 2 | Aguardar resposta | ✅ Confirmação de lançamento de receita |
| 3 | Verificar card "Extrato" (aba Receitas) | ✅ "Salário - R$ 3.000,00" aparece imediatamente |
| 4 | Verificar card "Receitas" no topo | ✅ Valor atualizado automaticamente |
| 5 | Verificar card "Saldo" no topo | ✅ Saldo recalculado (receitas - despesas) |

### Teste 1.3 - Múltiplos Lançamentos Consecutivos
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Digitar: "Gastei 20 reais no Uber" | ✅ Confirmação |
| 2 | Imediatamente digitar: "Paguei 100 na conta de luz" | ✅ Confirmação |
| 3 | Verificar cards | ✅ Ambas transações aparecem sem refresh manual |

### Teste 1.4 - Navegação entre Páginas
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Fazer um lançamento | ✅ Cards atualizados |
| 2 | Navegar para outra página (Investimentos) | - |
| 3 | Voltar para Dashboard | ✅ Lançamento ainda visível nos cards |
| 4 | Console não mostra página sendo recarregada | ✅ Sem "[DEBUG-UNLOAD]" no console |

---

## 2. 📅 Filtro de Período e Inteligência de Data

### Teste 2.1 - Lançamento Futuro (Daqui a X dias)
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Digitar: "Vou receber 5000 reais de uma causa daqui a 15 dias" | ✅ Mensagem enviada |
| 2 | Verificar resposta do agente | ✅ Data calculada: 12/02/2026 (15 dias após 28/01) |
| 3 | Verificar card "Contas Futuras" (aba A Receber) | ✅ Aparece apenas no mês de Fevereiro/2026 |
| 4 | Mudar filtro para Janeiro/2026 | ✅ NÃO aparece em Janeiro |
| 5 | Verificar outros meses | ✅ NÃO replica em todos os meses |

### Teste 2.2 - Lançamento com Data Específica
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Digitar: "Paguei 500 reais de aluguel dia 05/01" | ✅ Mensagem enviada |
| 2 | Verificar data na confirmação | ✅ Data: 2026-01-05 |
| 3 | Filtrar por Janeiro/2026 | ✅ Aparece no extrato de Janeiro |
| 4 | Filtrar por Fevereiro/2026 | ✅ NÃO aparece em Fevereiro |

### Teste 2.3 - Expressões Temporais Relativas
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | "Gastei 80 reais ontem" | ✅ Data: 27/01/2026 |
| 2 | "Fui ao cinema semana passada e gastei 60" | ✅ Data: ~21/01/2026 (7 dias atrás) |
| 3 | "Vou receber 1000 mês que vem" | ✅ Data: 01/02/2026 + vai para Contas Futuras |
| 4 | "Paguei 200 há 3 dias" | ✅ Data: 25/01/2026 |

### Teste 2.4 - Data Padrão (Sem Mencionar Data)
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Digitar: "Comprei um lanche por 25 reais" | ✅ Mensagem enviada |
| 2 | Verificar data na confirmação | ✅ Data: 28/01/2026 (hoje) |
| 3 | Verificar se está no mês atual | ✅ Aparece em Janeiro/2026 |

---

## 3. 💳 Lógica de Cartão de Crédito e Contas Futuras

### Teste 3.1 - Gasto no Cartão de Crédito (À Vista)
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Digitar: "Comprei 200 reais no cartão no supermercado" | ✅ Mensagem enviada |
| 2 | Verificar card "Cartão de Crédito" | ✅ Valor utilizado aumentou R$ 200 |
| 3 | Verificar card "Extrato" | ❌ NÃO aparece no extrato imediatamente |
| 4 | Verificar fatura aberta (clicando no card) | ✅ Compra listada na fatura |

### Teste 3.2 - Compra Parcelada no Cartão
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Digitar: "Parcelei um celular de 2400 em 12x no cartão" | ✅ Mensagem enviada |
| 2 | Verificar card "Cartão de Crédito" | ✅ Valor de R$ 200 (primeira parcela) adicionado |
| 3 | Verificar card "Dívidas" | ✅ Nova dívida: "Parcelamento: celular" 12x R$ 200 |
| 4 | Verificar card "Extrato" | ❌ NÃO aparece no extrato (não foi pago ainda) |
| 5 | Verificar "Contas Futuras" próximos meses | ✅ Parcelas 2-12 como contas a pagar |

### Teste 3.3 - Parcelamento com Entrada
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Digitar: "Comprei um sofá de 3000, paguei 500 de entrada e parcelei o resto em 5x" | ✅ Análise correta |
| 2 | Verificar extrato | ✅ R$ 500 (entrada) aparece no extrato |
| 3 | Verificar "Contas Futuras" | ✅ 5 parcelas de R$ 500 em meses futuros |

### Teste 3.4 - Fatura do Cartão (Agrupamento)
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Fazer 3 compras no cartão | ✅ Confirmações |
| 2 | Clicar no card "Cartão de Crédito" | ✅ Modal abre com detalhes |
| 3 | Verificar lista de compras | ✅ Todas as 3 compras listadas separadamente |
| 4 | Verificar total da fatura | ✅ Soma das 3 compras |

---

## 4. 📊 Gerenciamento de Dívidas

### Teste 4.1 - Criar Nova Dívida (Financiamento)
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Digitar: "Financiei um carro de 45000 em 48x" | ✅ Mensagem enviada |
| 2 | Verificar resposta | ✅ "Nova dívida registrada" |
| 3 | Verificar card "Dívidas" | ✅ Nova dívida aparece com 0% pago |
| 4 | Clicar na dívida | ✅ Modal com detalhes: 48 parcelas de ~R$ 937,50 |
| 5 | Verificar próximo pagamento | ✅ Data da primeira parcela |

### Teste 4.2 - Pagamento de Parcela de Dívida
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Abrir modal de uma dívida existente | ✅ Modal aberto |
| 2 | Clicar em "Pagar" na primeira parcela pendente | ✅ Parcela marcada como paga |
| 3 | Verificar porcentagem no card | ✅ Progresso atualizado |
| 4 | Verificar extrato | ✅ Pagamento registrado como despesa |

### Teste 4.3 - Dívida de Parcelamento no Cartão
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Fazer compra parcelada (teste 3.2) | ✅ Parcelamento registrado |
| 2 | Verificar card "Dívidas" | ✅ Dívida de parcelamento aparece |
| 3 | Descrição mostra "Parcelamento: [item]" | ✅ Identificador claro |
| 4 | Progresso atualiza conforme faturas são pagas | ✅ Abatimento correto |

### Teste 4.4 - Botão de Adicionar Dívida (FAB)
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Navegar no carrossel até card "Dívidas" | ✅ Card visível |
| 2 | Verificar botão flutuante vermelho | ✅ Botão "+" aparece no canto inferior |
| 3 | Clicar no botão | ✅ Modal "Adicionar Nova Dívida" abre |
| 4 | Preencher formulário e salvar | ✅ Dívida criada com sucesso |

---

## 5. 🎨 Interface e Ajustes Finais

### Teste 5.1 - Ordenação (Mais Recente no Topo)
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Fazer 3 lançamentos em sequência | ✅ Registrados |
| 2 | Verificar card "Últimas Transações" | ✅ Ordem: último lançamento no TOPO |
| 3 | Verificar card "Extrato" (Receitas) | ✅ Ordem decrescente por data |
| 4 | Verificar card "Extrato" (Despesas) | ✅ Ordem decrescente por data |

### Teste 5.2 - Botão FAB de Editar Cartão
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Navegar no carrossel até card "Cartão de Crédito" | ✅ Card visível |
| 2 | Verificar botão flutuante amarelo | ✅ Botão lápis aparece no canto inferior direito |
| 3 | Clicar no botão | ✅ Modal "Editar Cartão de Crédito" abre |
| 4 | Alterar limite e salvar | ✅ Limite atualizado |

### Teste 5.3 - Cards do Topo (Filtro de Período)
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Selecionar Janeiro/2026 no filtro | ✅ Filtro aplicado |
| 2 | Verificar card "Receitas" | ✅ Soma apenas receitas de Janeiro |
| 3 | Verificar card "Despesas" | ✅ Soma apenas despesas de Janeiro |
| 4 | Verificar card "Saldo" | ✅ Saldo = Receitas - Despesas de Janeiro |
| 5 | Mudar para Fevereiro/2026 | ✅ Valores recalculados para Fevereiro |

### Teste 5.4 - Scrollbar nos Cards
| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Adicionar muitos lançamentos (>5) | ✅ Lançamentos registrados |
| 2 | Verificar card "Extrato" | ✅ Scrollbar visível, permite rolar |
| 3 | Verificar card "Últimas Transações" | ✅ Scrollbar visível |
| 4 | Verificar card "Contas Futuras" | ✅ Scrollbar visível |
| 5 | Verificar card "Dívidas" | ✅ Scrollbar visível |

---

## 📌 Checklist Resumido

| # | Funcionalidade | Status |
|---|----------------|--------|
| 1.1 | Refresh automático após lançamento | ⬜ |
| 1.2 | Receita atualiza cards do topo | ⬜ |
| 1.3 | Múltiplos lançamentos consecutivos | ⬜ |
| 1.4 | Sem refresh da página | ⬜ |
| 2.1 | Lançamento futuro não duplica | ⬜ |
| 2.2 | Data específica funciona | ⬜ |
| 2.3 | Expressões temporais ("daqui a X dias") | ⬜ |
| 2.4 | Data padrão é hoje | ⬜ |
| 3.1 | Cartão não vai para extrato | ⬜ |
| 3.2 | Parcelado cria dívida | ⬜ |
| 3.3 | Entrada vai para extrato | ⬜ |
| 3.4 | Modal do cartão funciona | ⬜ |
| 4.1 | Criar nova dívida | ⬜ |
| 4.2 | Pagar parcela funciona | ⬜ |
| 4.3 | Parcelamento cartão → dívida | ⬜ |
| 4.4 | FAB de adicionar dívida | ⬜ |
| 5.1 | Ordenação (recente no topo) | ⬜ |
| 5.2 | FAB de editar cartão | ⬜ |
| 5.3 | Filtro afeta cards do topo | ⬜ |
| 5.4 | Scrollbar nos cards | ⬜ |

---

## 🔧 Comandos de Teste Sugeridos

```
# Despesa simples
Gastei 50 reais no supermercado

# Receita simples
Recebi 3000 reais de salário hoje

# Lançamento futuro
Vou receber 5000 reais de uma causa daqui a 15 dias

# Data específica
Paguei 500 reais de aluguel dia 05/01

# Semana passada
Fui ao cinema semana passada e gastei 60 reais

# Cartão de crédito
Comprei 200 reais no cartão no supermercado

# Parcelamento
Parcelei um celular de 2400 em 12x no cartão

# Nova dívida
Financiei um carro de 45000 em 48x

# Empréstimo
Peguei um empréstimo de 10000 em 24 parcelas
```

---

**Legenda:**
- ✅ Esperado/Passou
- ❌ Não deve acontecer
- ⬜ Não testado ainda
