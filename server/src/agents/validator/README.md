# ✅ Agente Validador

## Propósito
Agente OBRIGATÓRIO que valida todas as respostas antes de enviá-las ao usuário. Garante conformidade com perfil de risco, compliance e adiciona disclaimers necessários.

## Arquivos que devem estar aqui
- `validator-agent.js` - Classe principal do agente
- `risk-profile-validator.js` - Valida conformidade com perfil de risco
- `compliance-checker.js` - Verifica regras de compliance
- `confidence-calculator.js` - Calcula score de confiança
- `disclaimer-generator.js` - Gera disclaimers obrigatórios
- `response-adjuster.js` - Ajusta recomendações não conformes

## Responsabilidades
1. Validar resposta final contra perfil de risco do usuário:
   - Limites de alocação em renda variável
   - Fundo de emergência mínimo
   - Concentração em ativos
2. Verificar regras de compliance:
   - Produtos sem FGC não podem ser reserva de emergência
   - Sempre mencionar IR em produtos tributados
   - Alertar sobre falta de liquidez
   - Mencionar risco de perda em renda variável
3. Calcular score de confiança (0-1)
4. Adicionar disclaimers obrigatórios
5. Ajustar recomendações não conformes
6. Retornar status: approved, needs_adjustment ou rejected

## Tools Implementadas
- `validate_investment_recommendation` - Validação completa
- `check_compliance_rules` - Verificação de compliance
- `calculate_confidence_score` - Score de confiança

## Regras de Negócio
- **Conservador**: máx 30% RV, mín 6 meses emergência
- **Moderado**: máx 60% RV, mín 3 meses emergência
- **Agressivo**: máx 90% RV, mín 3 meses emergência

## IMPORTANTE
Este agente SEMPRE deve ser chamado antes de retornar resposta ao usuário relacionadas a mudanças de investimentos ou recomendações.
