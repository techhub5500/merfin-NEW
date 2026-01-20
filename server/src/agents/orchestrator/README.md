# 🎯 Agente Orquestrador

## Propósito
Agente central responsável por coordenar todos os outros agentes. Implementa o padrão ReAct (Reason-Act-Observe) com suporte a execução paralela.

## Arquivos que devem estar aqui
- `orchestrator.js` - Classe principal do orquestrador
- `complexity-classifier.js` - Classifica queries em níveis de complexidade
- `execution-planner.js` - Cria plano de execução detalhado
- `react-engine.js` - Motor do ciclo ReAct (reason, act, observe)
- `agent-dispatcher.js` - Despacha requisições para agentes especializados

## Responsabilidades
1. Receber query do usuário
2. Classificar complexidade (simple, basic, comparative, complex, research)
3. Definir limite máximo de ciclos baseado na complexidade
4. Criar plano de execução com objetivos claros
5. Coordenar execução paralela de ações independentes
6. Manter estado da sessão (ToolContext)
7. Consolidar respostas dos agentes
8. Chamar validador antes de responder usuário

## Fluxo Principal
```
Usuário → Classificação → Planejamento → Loop ReAct → Validação → Resposta
```
