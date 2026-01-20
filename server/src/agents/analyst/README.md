# 📊 Agente Analista

## Propósito
Agente responsável por cálculos financeiros complexos, análises quantitativas e comparações de investimentos. Utiliza modelos matemáticos robustos.

## Arquivos que devem estar aqui
- `analyst-agent.js` - Classe principal do agente
- `investment-comparator.js` - Compara múltiplas opções de investimento
- `returns-calculator.js` - Calcula retornos líquidos com impostos
- `risk-analyzer.js` - Análise de risco e volatilidade
- `projection-engine.js` - Projeções e simulações futuras
- `tax-calculator.js` - Cálculo de impostos (IR tabela regressiva)
- `scoring-engine.js` - Sistema de pontuação de investimentos

## Responsabilidades
1. Realizar cálculos financeiros precisos (juros compostos, retornos, etc)
2. Comparar investimentos considerando retorno, risco e liquidez
3. Calcular impostos (IR, IOF) conforme legislação brasileira
4. Gerar scores ponderados baseados no perfil do usuário
5. Analisar risco de ativos e portfólios
6. Criar projeções realistas (cenários otimista, realista, pessimista)
7. Garantir precisão matemática (arredondamentos corretos)

## Tools Implementadas
- `compare_investments` - Comparação multi-critério de investimentos
- `calculate_returns` - Cálculo de retorno líquido
- `analyze_risk` - Análise quantitativa de risco
- `project_growth` - Projeção de crescimento de investimentos
- `calculate_indicators` - Cálculo de indicadores financeiros

## Observações
- Usar modelos de pricing financeiro quando apropriado
- Sempre incluir metadata sobre premissas dos cálculos
