# 📊 Consumo de Tokens - Sistema de Chat com IA

## 🎯 O que são Tokens?

Tokens são **pedaços de texto** que o modelo de IA processa. Uma palavra pode ser 1 ou mais tokens:
- "Olá" = 1 token
- "assistente" = 1 token
- "R$" = 1-2 tokens
- "5.000" = 1-2 tokens

**Regra aproximada**: 1 token ≈ 4 caracteres em português

---

## 💰 Custos de Tokens

Você paga por **tokens de entrada (input)** e **tokens de saída (output)**:

| Modelo | Input | Output | Reasoning |
|--------|-------|--------|-----------|
| gpt-5-nano | $0.0002/1K | $0.0008/1K | $0.0032/1K |

**Exemplo do seu caso:**
- 156 tokens input × $0.0002/1K = **$0.00003**
- 768 tokens reasoning × $0.0032/1K = **$0.00246**
- 0 tokens output × $0.0008/1K = **$0.00000**
- **TOTAL: ~$0.0025 por mensagem** ❌ (muito caro pois não gerou resposta)

---

## 📥 TOKENS DE INPUT (Entrada)

### O que conta como INPUT:
1. **System Prompt** (instruções para o modelo)
2. **Contexto de Memória** (Working, Episodic, Long-term)
3. **Histórico da Conversa**
4. **Mensagem do Usuário**

### Breakdown detalhado:

#### 1️⃣ System Prompt
```
ANTES (otimização):
"Você é um assistente financeiro prestativo. Responda de forma clara, 
objetiva e concisa em português brasileiro. Seja direto e útil."
≈ 80 tokens ❌

DEPOIS (otimizado):
"Assistente financeiro. Respostas claras e concisas em português."
≈ 15 tokens ✅
```
**Economia: 65 tokens (~81%)**

---

#### 2️⃣ Contexto de Memória

##### Working Memory (Sessão Atual)
```
ANTES:
## Memória de Trabalho (Sessão Atual):
- variavel_x: {"valor": 123, "timestamp": "2026-01-25T..."}
- variavel_y: {"tipo": "financeiro", "categoria": "renda"}
≈ 40-60 tokens por variável ❌

DEPOIS:
### Sessão:
variavel_x: {"valor":123}
variavel_y: financeiro
≈ 15-25 tokens por variável ✅
```
**Economia: ~50%**

---

##### Episodic Memory (Conversa Atual)
```
ANTES:
## Contexto da Conversa:
{
  "contexto_conversa": "Usuário perguntou sobre: \"ola\". Eu respondi: \"Olá! Como posso ajudar hoje? Posso: \n- montar/ajudar a controlar o orçamento\n- o\".",
  "preferencias_mencionadas": "Nenhuma preferência explícita",
  "decisoes_tomadas": "Nenhuma decisão explícita"
}
≈ 120-150 tokens ❌

DEPOIS (compacto):
### Conversa:
Usuário perguntou sobre: "ola". Eu respondi: "Olá! Como posso ajudar hoje?..."
≈ 60-80 tokens ✅

(Campos vazios como "Nenhuma preferência explícita" são REMOVIDOS)
```
**Economia: ~50%**

---

##### Long-Term Memory (Memórias Importantes)
```
ANTES (sem limite):
## Informações Importantes sobre o Usuário:
- [Situação Financeira] edmar1 ganha R$ 5.000 por mês
- [Objetivos] edmar1 quer economizar para casa própria
- [Hábitos] edmar1 gasta muito com delivery
- [Investimentos] edmar1 tem R$ 10.000 na poupança
- [Dívidas] edmar1 deve R$ 2.000 no cartão
- [Preferências] edmar1 prefere investimentos conservadores
- [Histórico] edmar1 já tentou criar orçamento antes
- [Família] edmar1 é casado com 2 filhos
≈ 200-300 tokens ❌

DEPOIS (máximo 3):
### Info Importante:
• edmar1 ganha R$ 5.000 por mês
• edmar1 quer economizar para casa própria
• edmar1 tem R$ 10.000 na poupança
≈ 60-80 tokens ✅
```
**Economia: ~70%**

**🎯 POR QUE LIMITAR A 3?**
- Apenas as **3 memórias mais importantes** (maior impactScore)
- Evita sobrecarregar o prompt com informações secundárias
- Foca no que é ESSENCIAL para responder

---

##### Category Descriptions (Resumos por Categoria)
```
ANTES (todas as categorias):
## Resumo do Perfil do Usuário:
- **Situação Financeira**: Renda mensal de R$ 5.000, com...
- **Objetivos Financeiros**: Deseja comprar casa própria em 5 anos...
- **Hábitos De Gastos**: Gasta excessivamente com delivery e streaming...
- **Investimentos Atuais**: Possui R$ 10.000 na poupança e R$ 5.000...
- **Dívidas Pendentes**: Cartão de crédito com R$ 2.000 a pagar...
- **Preferências Investimento**: Perfil conservador, evita risco...
≈ 180-250 tokens ❌

DEPOIS (máximo 2):
### Perfil:
situacao financeira: Renda mensal de R$ 5.000, com...
objetivos financeiros: Deseja comprar casa própria em 5 anos...
≈ 60-90 tokens ✅
```
**Economia: ~65%**

**🎯 POR QUE LIMITAR A 2?**
- Category Descriptions são **resumos automáticos** gerados pela IA
- Podem ser MUITO longos (100+ tokens cada)
- 2 categorias principais já dão contexto suficiente

---

#### 3️⃣ Histórico da Conversa
```
ANTES (sem limite):
Histórico da conversa:
Usuário: ola
Assistente: Olá! Como posso ajudar hoje? Posso:...
Usuário: quero investir
Assistente: Ótimo! Para sugerir investimentos adequados...
Usuário: quanto tenho na poupança?
Assistente: Consultando seus dados... Você tem R$ 10.000 na poupança...
Usuário: e no tesouro direto?
Assistente: Você possui R$ 5.000 aplicados no Tesouro Selic...
Usuário: quero aumentar meus investimentos
Assistente: Excelente decisão! Com base no seu perfil conservador...
Usuário: quanto posso investir por mês?
Assistente: Analisando sua renda e despesas... Você pode investir cerca de...
≈ 400-600 tokens ❌

DEPOIS (últimas 5 mensagens):
Histórico:
U: quanto tenho na poupança?
A: Você tem R$ 10.000 na poupança...
U: e no tesouro direto?
A: Você possui R$ 5.000 no Tesouro Selic...
U: quero aumentar investimentos
A: Com base no seu perfil... pode investir...
≈ 80-120 tokens ✅
```
**Economia: ~80%**

**🎯 POR QUE LIMITAR A 5 MENSAGENS?**
- **Memória recente suficiente**: 5 trocas = contexto das últimas interações
- **Memória Episódica guarda o essencial**: decisões e preferências ficam salvas
- **Economia massiva**: Conversas longas não inflam o prompt
- **Formato compacto**: `U:` e `A:` ao invés de "Usuário:" e "Assistente:"

---

#### 4️⃣ Mensagem Atual
```
U: Olá! Me chamo Edmar e ganho R$ 5.000 por mês
A:
≈ 15-20 tokens
```

---

## 📤 TOKENS DE OUTPUT (Saída)

### O que conta como OUTPUT:
- A **resposta gerada** pela IA para o usuário

### Custo:
```
Resposta esperada (~200 palavras):
"Olá Edmar! Prazer em conhecê-lo.

Vi que sua renda mensal é de R$ 5.000. Como posso ajudá-lo hoje?

Posso auxiliar com:
- Planejamento financeiro e orçamento
- Análise de gastos
- Sugestões de investimento
- Controle de despesas

O que gostaria de fazer?"

≈ 150-200 tokens de output
Custo: ~$0.00016
```

---

## 🧠 TOKENS DE REASONING (Raciocínio)

### O que é Reasoning?
- O modelo **pensa internamente** antes de responder
- Não é visível para o usuário
- **Consome tokens** (e são os mais caros!)

### Configurações:
```javascript
// ANTES:
reasoning_effort: 'medium'
max_output_tokens: 800

Resultado:
- Reasoning: 768 tokens ($0.00246) ❌
- Output: 0 tokens ($0.00000) ❌
- Total: $0.00246 (sem resposta!)

// DEPOIS:
reasoning_effort: 'low'
max_output_tokens: 2000

Resultado esperado:
- Reasoning: ~300-400 tokens ($0.00128)
- Output: ~150-200 tokens ($0.00016)
- Total: ~$0.00144 (COM resposta!) ✅
```

**Níveis de Reasoning:**
- `'low'`: 200-400 tokens (~$0.001)
- `'medium'`: 500-800 tokens (~$0.002)
- `'high'`: 1000-1500 tokens (~$0.004)

---

## 📊 EXEMPLO COMPLETO: Sua Mensagem

### Mensagem: "Olá! Me chamo Edmar e ganho R$ 5.000 por mês"

#### ANTES das otimizações:
```
INPUT TOKENS (156):
├─ System Prompt: 80 tokens
├─ Memória Episódica: 40 tokens
├─ Long-term Memory: 0 tokens (ainda não tinha)
├─ Histórico: 20 tokens
└─ Mensagem atual: 16 tokens

REASONING TOKENS: 768 tokens (medium)
OUTPUT TOKENS: 0 tokens (estourou o limite!)

TOTAL: 924 tokens
CUSTO: ~$0.0025
RESULTADO: ❌ Sem resposta
```

#### DEPOIS das otimizações:
```
INPUT TOKENS (estimado ~100):
├─ System Prompt: 15 tokens ✅ (-81%)
├─ Memória Episódica: 30 tokens ✅ (-25%)
├─ Long-term Memory: 25 tokens (máx 3) ✅
├─ Histórico: 20 tokens (máx 5 msgs) ✅
└─ Mensagem atual: 16 tokens

REASONING TOKENS: ~350 tokens (low) ✅ (-54%)
OUTPUT TOKENS: ~180 tokens ✅
└─ "Olá Edmar! Prazer em conhecê-lo..."

TOTAL: ~630 tokens
CUSTO: ~$0.0014
RESULTADO: ✅ Resposta completa
ECONOMIA: 44% menos custo
```

---

## 🎯 RESUMO DAS OTIMIZAÇÕES

| Otimização | Economia de Tokens | Impacto no Custo |
|------------|-------------------|------------------|
| System Prompt compacto | 65 tokens | -81% |
| Memória Episódica filtrada | 40-70 tokens | -50% |
| LTM limitada a 3 | 120-220 tokens | -70% |
| Category Desc limitada a 2 | 90-160 tokens | -65% |
| Histórico limitado a 5 | 280-480 tokens | -80% |
| Reasoning 'low' | 300-400 tokens | -54% |
| **TOTAL** | **~900-1400 tokens** | **~44%** |

---

## 💡 RECOMENDAÇÕES

### ✅ Boas Práticas:
1. **Histórico curto**: 5 mensagens recentes são suficientes
2. **LTM focada**: Apenas top 3 memórias por importância
3. **Reasoning baixo**: `'low'` é suficiente para chat casual
4. **Prompts concisos**: Vá direto ao ponto

### ⚠️ Quando Aumentar:
- **Histórico > 5**: Conversas que exigem muito contexto temporal
- **LTM > 3**: Perfis complexos com muitas dependências
- **Reasoning 'medium'/'high'**: Análises financeiras complexas, planejamentos estratégicos

### 📉 Monitoramento:
- **Média ideal**: 500-1000 tokens por interação
- **Alerta amarelo**: 1000-1500 tokens (revisar prompt)
- **Alerta vermelho**: >1500 tokens (otimizar urgente)

---

## 🔍 COMO INTERPRETAR OS LOGS

```javascript
{
  "input_tokens": 156,           // Prompt completo (system + memória + histórico + mensagem)
  "output_tokens": 768,          // Resposta + Reasoning
  "output_tokens_details": {
    "reasoning_tokens": 768      // Apenas reasoning (mais caro!)
  },
  "total_tokens": 924            // input + output
}

// CUSTO CALCULADO:
// Input: 156 × $0.0002/1K = $0.00003
// Reasoning: 768 × $0.0032/1K = $0.00246
// Output: 0 × $0.0008/1K = $0.00000
// TOTAL: ~$0.00249
```

---

## 🚀 PRÓXIMOS PASSOS

1. **Monitorar consumo real** com os logs implementados
2. **Ajustar limites** conforme necessidade:
   - Aumentar LTM se perder contexto importante
   - Aumentar histórico se conversas ficarem sem sentido
3. **Testar diferentes níveis de reasoning**:
   - `'low'` para chat casual
   - `'medium'` para análises financeiras
   - `'high'` apenas para planejamentos complexos

---

**Data:** 25/01/2026
**Versão:** 1.0
**Autor:** Sistema de IA
