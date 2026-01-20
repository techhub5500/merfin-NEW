# 🤖 Clientes de LLM

## Propósito
Clientes para modelos de linguagem (OpenAI, Anthropic, etc). Implementa roteamento por tier.

## Arquivos que devem estar aqui
- `llm-router.js` - Roteador de modelos por tier
- `openai-client.js` - Cliente OpenAI (GPT-4o, GPT-4o-mini)
- `anthropic-client.js` - Cliente Anthropic (Claude Opus, Haiku)
- `prompt-builder.js` - Construtor de prompts
- `token-counter.js` - Contador de tokens
- `cost-calculator.js` - Calculador de custos

## Responsabilidades
1. Rotear requisições para o modelo adequado baseado no tier
2. Construir prompts formatados
3. Fazer streaming quando necessário
4. Contar tokens e calcular custos
5. Implementar fallback entre providers
6. Cachear respostas determinísticas
7. Tratar rate limits

## Roteamento por Tier
**Tier 2 (Rápido e Barato):**
- Orquestrador (classificação, decisões simples)
- Agente de Dados (queries estruturadas)
- Agente de Lançamentos (parsing)
- Modelo: GPT-4o-mini ou Claude Haiku

**Tier 1 (Inteligente e Denso):**
- Agente Analista (cálculos complexos)
- Agente Estrategista (planejamento)
- Agente Validador (compliance)
- Modelo: GPT-4o ou Claude Opus

## Observações
- Orquestrador usa modelo rápido para decisões de fluxo
- Agentes analíticos usam modelo denso para raciocínio
- Custo pode variar 10-50x entre tiers
