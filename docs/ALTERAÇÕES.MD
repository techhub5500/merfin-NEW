# Instruções para Alteração do Sistema de Memória de Longo Prazo

## Visão Geral das Mudanças

Este documento contém instruções detalhadas para modificar o sistema de memória de longo prazo. As alterações incluem:

1. Redução de orçamentos e limites de palavras
2. Correção de categorização de exemplos
3. Implementação de descrições dinâmicas por categoria
4. Adição obrigatória de datas em todas as memórias

---

## 1. REDUÇÃO DE ORÇAMENTOS E LIMITES

### 1.1 Orçamento Total e Por Categoria

**Arquivo alvo:** `src/core/memory/shared/memory-types.js`

**Alterações necessárias:**

No objeto `MEMORY_BUDGETS`, modificar os seguintes valores:

- `LONG_TERM`: de 3500 para **1800 palavras**
- `LONG_TERM_PER_CATEGORY`: de 350 para **180 palavras**

**Impacto:** Isso reduzirá pela metade a capacidade de armazenamento, tornando o sistema mais focado em informações de alta relevância.

---

### 1.2 Limite de Palavras por Memória Individual

**Arquivo alvo:** `src/core/memory/longTerm/long-term-memory.js`

**Alterações necessárias:**

Na função `propose()`, localizar a seção de refinamento/compressão de conteúdo e ajustar dois valores:

1. **Limite inicial**: Reduzir de 100 para **60 palavras** por memória
2. **Compressão adicional**: Reduzir de 80 para **40 palavras** quando necessário

**Contexto:** Essas alterações garantem que cada memória seja mais concisa e objetiva, otimizando o uso do orçamento reduzido.

---

## 2. CORREÇÃO DE CATEGORIZAÇÃO DE EXEMPLOS

### 2.1 Reclassificação do Exemplo de "comportamento_gastos"

**Arquivo alvo:** `src/core/memory/longTerm/category-definitions.js`

**Problema identificado:**
O exemplo "João prefere investimentos com liquidez diária devido à necessidade de reserva de emergência" está atualmente na categoria `comportamento_gastos`, mas deveria estar em `investimentos`.

**Ações necessárias:**

1. **Remover** este exemplo da categoria `comportamento_gastos`
2. **Adicionar** este exemplo na categoria `investimentos`
3. **Substituir** na categoria `comportamento_gastos` por exemplos mais apropriados, como:
   - Padrões de consumo efetivos (gastos com alimentação, lazer, etc.)
   - Hábitos de compra (preferência por pagamento à vista, uso de crédito, etc.)
   - Assinaturas e gastos recorrentes

**Justificativa:** A preferência por investimentos com liquidez é uma característica de perfil de investimento, não de comportamento de gastos.

---

## 3. IMPLEMENTAÇÃO DE DESCRIÇÕES DINÂMICAS POR CATEGORIA

### 3.1 Modificação do Schema do MongoDB

**Arquivo alvo:** `src/core/memory/longTerm/long-term-memory.js`

**Adicionar nova estrutura ao schema:**

Incluir um objeto `categoryDescriptions` que armazenará descrições dinâmicas para cada uma das 10 categorias. Cada categoria deve ter:

- `description` (String): Texto resumido com **máximo 25 palavras**
- `lastUpdated` (Date): Data da última atualização da descrição
- `updateCount` (Number): Contador de quantas vezes a descrição foi atualizada

**Estrutura esperada:**
```
categoryDescriptions: {
  perfil_profissional: { description, lastUpdated, updateCount },
  situacao_financeira: { description, lastUpdated, updateCount },
  investimentos: { description, lastUpdated, updateCount },
  // ... para todas as 10 categorias
}
```

---

### 3.2 Inicialização de Descrições para Novos Usuários

**Arquivo alvo:** `src/core/memory/longTerm/long-term-memory.js`

**Criar função auxiliar:**

Desenvolver uma função privada que inicializa o objeto `categoryDescriptions` com valores vazios para todas as 10 categorias quando um novo usuário for criado no sistema.

**Uso:** Esta função deve ser chamada automaticamente ao criar o primeiro registro de memória de longo prazo para um usuário.

---

### 3.3 Atualização Automática de Descrições

**Arquivo alvo:** `src/core/memory/longTerm/long-term-memory.js`

**Implementar na função `propose()`:**

Após aceitar uma nova memória na memória de longo prazo, adicionar lógica para atualizar automaticamente a descrição da categoria correspondente.

**Processo esperado:**

1. Buscar todas as memórias existentes na mesma categoria
2. Incluir a nova memória aceita na análise
3. Chamar IA (DeepSeek) para gerar descrição resumida
4. Atualizar o objeto `categoryDescriptions` com:
   - Nova descrição
   - Data atual em `lastUpdated`
   - Incrementar `updateCount`

---

### 3.4 Prompt para Geração de Descrições Dinâmicas

**Criar função auxiliar de atualização de descrição:**

Desenvolver uma função privada que utilize o LLM (DeepSeek) para gerar descrições dinâmicas.

**Diretrizes para o prompt da IA:**

O prompt deve instruir a IA a:

- Criar descrição com **máximo 25 palavras**
- **NÃO incluir datas** (exemplo: evitar "em janeiro", "ano passado")
- **NÃO incluir valores numéricos detalhados** (exemplo: evitar "R$ 12.500", usar "aumento salarial")
- Listar os principais eventos/tópicos já registrados na categoria
- Usar vírgulas para separar eventos
- Manter ordem cronológica implícita (eventos mais antigos primeiro)
- Ser concisa, informativa e evolutiva

**Exemplos de descrições esperadas:**

- `perfil_profissional`: "engenheiro de software, promoção para cargo sênior, mudança para trabalho remoto"
- `investimentos`: "CDBs liquidez diária, início em fundos imobiliários, aporte mensal regular"
- `situacao_financeira`: "renda mensal estável, quitação de dívida, construção de reserva emergência"

---

### 3.5 Integração com Formatação de Contexto

**Arquivo alvo:** `src/core/memory/memory-integration.js`

**Modificar função `formatContextForPrompt()`:**

Ao formatar o contexto de memória de longo prazo para incluir no prompt do agente, adicionar as descrições dinâmicas junto ao nome de cada categoria.

**Formato esperado:**
```
### perfil_profissional — engenheiro de software, promoção recente
- [memória 1]
- [memória 2]

### investimentos — CDBs, FIIs, aporte mensal
- [memória 1]
- [memória 2]
```

---

### 3.6 Atualização da Função `buildAgentContext()`

**Arquivo alvo:** `src/core/memory/memory-integration.js`

**Modificar para incluir descrições:**

Ao construir o contexto completo do agente, buscar e incluir o objeto `categoryDescriptions` junto com as memórias de longo prazo.

**Retorno esperado:**
```javascript
{
  sessionId,
  chatId,
  userId,
  workingMemory: {...},
  episodicMemory: {...},
  longTermMemory: [...],
  categoryDescriptions: {...}, // NOVO
  sessionMetadata: {...}
}
```

---

## 4. ADIÇÃO OBRIGATÓRIA DE DATAS NAS MEMÓRIAS

### 4.1 Modificação do Schema para Incluir Data do Evento

**Arquivo alvo:** `src/core/memory/longTerm/long-term-memory.js`

**Adicionar campo ao schema de `memoryItems`:**

Incluir um novo campo `eventDate` (tipo Date) que armazenará a data do evento descrito na memória, separado do campo `createdAt` (data de criação do registro).

**Estrutura esperada:**
```
memoryItems: [{
  content: String,        // Deve começar com "Em DD/MM/YYYY, ..."
  category: String,
  impactScore: Number,
  sourceChats: [String],
  createdAt: Date,        // Data de criação do registro
  eventDate: Date,        // NOVO: Data do evento descrito
  lastAccessed: Date,
  accessCount: Number,
  vectorId: String
}]
```

---

### 4.2 Formatação Obrigatória com Data

**Arquivo alvo:** `src/core/memory/longTerm/long-term-memory.js`

**Implementar na função `propose()`:**

Após o refinamento do conteúdo pela IA, mas antes de armazenar, adicionar lógica para:

1. Obter a data atual do sistema
2. Formatar no padrão brasileiro (DD/MM/YYYY)
3. Verificar se o conteúdo refinado já contém uma data no formato esperado
4. Se não contiver, adicionar automaticamente no início: `"Em DD/MM/YYYY, ..."`
5. Extrair a data para popular o campo `eventDate`

**Padrão obrigatório:**
Toda memória deve começar com "Em DD/MM/YYYY, " seguido do conteúdo.

---

### 4.3 Função Auxiliar de Extração de Data

**Criar função privada:**

Desenvolver uma função que extrai a data do texto da memória usando regex para o padrão DD/MM/YYYY.

**Comportamento esperado:**
- Se encontrar data no texto, converter para objeto Date e retornar
- Se não encontrar, retornar a data atual do sistema

---

### 4.4 Atualização do Prompt de Refinamento

**Arquivo alvo:** `src/core/memory/longTerm/long-term-memory.js`

**Modificar prompt da função de refinamento (`_refineWithLLM` ou similar):**

Adicionar instruções explícitas para a IA que refina memórias:

**Regras obrigatórias:**
1. O texto DEVE começar com "Em DD/MM/YYYY, ..."
2. Usar a data atual se a memória se refere a evento presente/recente
3. Se a memória menciona evento passado específico, extrair e usar essa data
4. Máximo de 60 palavras no total (incluindo a data)
5. Usar nome do usuário ao invés de "o usuário"
6. Preservar informações essenciais e numéricas relevantes

**Exemplos para o prompt:**
- ✅ "Em 15/01/2026, João recebeu promoção para engenheiro sênior com aumento de 20%."
- ✅ "Em 03/12/2025, João investiu R$ 50.000 em CDBs de liquidez diária do Banco Inter."
- ✅ "Em 20/11/2025, João decidiu priorizar construção de reserva de emergência de seis meses."
- ❌ "João trabalha como engenheiro de software" (sem data)
- ❌ "O usuário investiu em CDBs" (genérico, sem data, sem nome)

---

## 5. DOCUMENTAÇÃO E EXEMPLOS

### 5.1 Atualizar Documentação Principal

**Arquivo alvo:** Documentação do sistema (README, docs, etc.)

**Seções a atualizar:**

1. **Orçamentos**: Atualizar valores para 1800 total e 180 por categoria
2. **Estrutura de Dados**: Documentar novos campos `categoryDescriptions` e `eventDate`
3. **Exemplos**: Adicionar exemplos de descrições dinâmicas e memórias com datas
4. **Fluxo de Operação**: Documentar nova lógica de atualização de descrições

---

### 5.2 Adicionar Comentários no Código

**Em todos os arquivos modificados:**

Adicionar comentários explicativos sobre:
- Limite de 25 palavras para descrições de categoria
- Obrigatoriedade de datas no início das memórias
- Formato "Em DD/MM/YYYY, ..." 
- Regras de não incluir datas nas descrições de categoria

---

## 6. CHECKLIST DE VALIDAÇÃO

Após implementar todas as alterações, verificar:

### Orçamentos
- [ ] Orçamento total de LTM é 1800 palavras
- [ ] Orçamento por categoria é 180 palavras
- [ ] Memórias individuais limitadas a 60 palavras
- [ ] Compressão adicional reduz para 40 palavras quando necessário

### Categorização
- [ ] Exemplo de investimentos movido de comportamento_gastos para investimentos
- [ ] Categoria comportamento_gastos tem exemplos apropriados de padrões de consumo

### Descrições Dinâmicas
- [ ] Schema inclui objeto categoryDescriptions
- [ ] Inicialização automática para novos usuários
- [ ] Descrições atualizadas quando nova memória é aceita
- [ ] Descrições limitadas a 25 palavras
- [ ] Descrições não contêm datas ou valores detalhados
- [ ] Contexto formatado inclui descrições junto aos nomes das categorias

### Datas Obrigatórias
- [ ] Schema inclui campo eventDate
- [ ] Todas memórias começam com "Em DD/MM/YYYY, ..."
- [ ] Campo eventDate populado corretamente
- [ ] Função de extração de data implementada
- [ ] Prompt de refinamento instrui IA sobre formato obrigatório

---

## 7. EXEMPLOS PRÁTICOS COMPLETOS

### Exemplo 1: Memória com Data e Descrição de Categoria

**Situação:** Usuário menciona que recebeu aumento salarial

**Memória armazenada:**
```
content: "Em 24/01/2026, João recebeu aumento salarial de 15% passando a ganhar R$ 10.500 mensais."
category: "perfil_profissional"
eventDate: Date(2026-01-24)
impactScore: 0.85
```

**Descrição da categoria atualizada:**
```
categoryDescriptions.perfil_profissional: {
  description: "engenheiro de software, aumento salarial",
  lastUpdated: Date(2026-01-24),
  updateCount: 1
}
```

---

### Exemplo 2: Evolução de Descrição de Categoria

**Histórico de memórias na categoria `investimentos`:**

1. Primeira memória aceita:
   - Memória: "Em 10/12/2025, João investiu R$ 30.000 em CDBs de liquidez diária."
   - Descrição: "CDBs liquidez diária"

2. Segunda memória aceita:
   - Memória: "Em 05/01/2026, João iniciou aportes mensais de R$ 2.000 em FIIs."
   - Descrição: "CDBs liquidez diária, início em fundos imobiliários"

3. Terceira memória aceita:
   - Memória: "Em 20/01/2026, João diversificou carteira incluindo Tesouro Direto."
   - Descrição: "CDBs, FIIs, aportes mensais, diversificação com Tesouro Direto"

**Observações:**
- Descrições não incluem datas específicas
- Valores podem ser mencionados de forma geral ("aportes mensais") mas não detalhados
- Mantém evolução cronológica implícita

---

### Exemplo 3: Contexto Formatado para o Agente

**Saída da função `formatContextForPrompt()`:**

```
## Perfil do Usuário (Memória de Longo Prazo):

### perfil_profissional — engenheiro de software, aumento salarial recente
- Em 15/11/2025, João foi contratado como engenheiro de software na Empresa XYZ. [impacto: 0.82]
- Em 24/01/2026, João recebeu aumento salarial de 15% passando a ganhar R$ 10.500 mensais. [impacto: 0.85]

### investimentos — CDBs, FIIs, aportes mensais regulares
- Em 10/12/2025, João investiu R$ 30.000 em CDBs de liquidez diária do Banco Inter. [impacto: 0.78]
- Em 05/01/2026, João iniciou aportes mensais de R$ 2.000 em fundos imobiliários. [impacto: 0.80]

### situacao_financeira — renda estável, construção de reserva
- Em 20/12/2025, João possui renda mensal de R$ 9.000 e gastos de R$ 6.500. [impacto: 0.75]
- Em 15/01/2026, João completou reserva de emergência de seis meses. [impacto: 0.88]
```


