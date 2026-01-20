# 🎯 Agente Estrategista

## Propósito
Agente responsável por planejamento financeiro de longo prazo, construção de portfólios e estratégias personalizadas de investimento.

## Arquivos que devem estar aqui
- `strategist-agent.js` - Classe principal do agente
- `portfolio-builder.js` - Construtor de portfólios diversificados
- `allocation-recommender.js` - Recomendações de alocação
- `financial-planner.js` - Planejamento para objetivos de longo prazo
- `rebalancing-advisor.js` - Sugestões de rebalanceamento
- `goal-tracker.js` - Acompanhamento de metas financeiras

## Responsabilidades
1. Construir portfólios balanceados baseados em:
   - Perfil de risco do usuário
   - Objetivos financeiros
   - Horizonte de investimento
   - Condições de mercado
2. Definir alocações estratégicas (renda fixa, variável, emergência)
3. Criar planos financeiros para aposentadoria, educação, imóveis, etc
4. Calcular contribuições mensais necessárias
5. Gerar milestones anuais para acompanhamento
6. Sugerir ajustes quando metas estão fora do track
7. Considerar eficiência tributária

## Tools Implementadas
- `build_portfolio` - Construção completa de portfólio
- `recommend_allocation` - Alocação de valor específico
- `create_financial_plan` - Plano financeiro para objetivos
- `suggest_rebalancing` - Sugestões de rebalanceamento

## Alocações Base por Perfil
- **Conservador**: 70% RF, 10% RV, 20% Emergência
- **Moderado**: 50% RF, 30% RV, 20% Emergência
- **Agressivo**: 30% RF, 60% RV, 10% Emergência
