# Sistema de Memória Conversacional

## Visão Geral

Sistema automático de memória conversacional para IA que mantém contexto relevante ao longo do tempo, respeitando um limite máximo de **3.000 tokens**.

## Definições Básicas

### Ciclo de Interação
1 mensagem do usuário + 1 resposta da IA = 1 ciclo

### Janela de Memória Ativa
Conjunto de ciclos (inteiros ou resumidos) enviado à IA a cada nova interação.

## Regras de Retenção

### 1️⃣ Retenção Total (Memória Curta)
- **Últimos 4 ciclos** preservados integralmente
- Alta fidelidade, sem compressão

### 2️⃣ Resumo Progressivo (Memória Média e Longa)
A partir do 5º ciclo, aplica-se compressão progressiva:

| Camada | Ciclos | Compressão |
|--------|--------|------------|
| 1 | -5 a -7 | 25% do original |
| 2 | -8 a -10 | ~6% do original |
| 3 | -11 a -13 | ~1.5% do original |
| ... | ... | ... |

### 3️⃣ Limite Global
- Máximo: **3.000 tokens**
- Se exceder, funde resumos mais antigos

## Inteligência do Resumo

### ✅ Prioriza:
- O que foi decidido
- O que o usuário quer
- O que já foi tentado
- Mudanças ao longo da conversa
- Informações factuais críticas

### ❌ Elimina:
- Saudações e frases sociais
- Repetições
- Exemplos descartáveis
- Detalhes irrelevantes para decisões futuras

## Estrutura da Memória

```
[Histórico Resumido]
- [Ciclos 1-3, 75%] Resumo comprimido...
- [Ciclos 4-6, 50%] Resumo semi-comprimido...
- [Ciclos 7-9, 25%] Resumo leve...

[Conversa Recente]
U: Mensagem do ciclo -4
A: Resposta do ciclo -4
U: Mensagem do ciclo -3
A: Resposta do ciclo -3
...
```

## Arquivos

- `conversational-memory.js` - Módulo principal de memória
- `../memory-integration-new.js` - Integração com agentes

## Uso

```javascript
const memoryIntegration = require('./memory-integration-new');

// Construir contexto para IA
const context = await memoryIntegration.buildAgentContext(sessionId, chatId, userId);

// Contexto formatado para prompt
const formatted = memoryIntegration.formatContextForPrompt(context);
```

## Benefícios

- ✅ Continuidade de contexto
- ✅ Coerência nas respostas
- ✅ Baixo custo computacional
- ✅ Respeita limites de tokens
- ✅ Simples de manter
