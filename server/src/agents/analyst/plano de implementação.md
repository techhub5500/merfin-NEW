Objetivo
- Criar um plano de implementação prático e conciso (instruções) para a lógica do `Agente Analista`, a ser implementada em JavaScript. O documento foca no comportamento, contratos e fluxos — sem impor bibliotecas ou infra específica — para que você possa implementar gradualmente.

Escopo e premissas
- Toda lógica será escrita em JavaScript (Node.js compatível).  
- Não há dependência de bancos específicos no plano: o agente acessa dados via adaptador (`queryData`) que delega ao Sistema de Dados Internos (data-agent).  
- O plano assume existirem os loaders de frameworks (níveis 1–3) conforme `frameworks-taxonomy.md`.

Resumo de integração com dados (baseado em `server/src/agents/data/README.md`)
- O Sistema de Dados Internos expõe ações como: `fetchAccountBalance`, `fetchTransactions`, `fetchUserProfile`, `fetchAccountSummary`, `validateDataIntegrity`.  
- Use um adaptador único `queryData(category, filters)` que encapsula chamadas ao `data-agent` e respeita políticas de cache: perfis têm TTL longo (~30m), saldos/transações têm TTL curto (~5m).  
- O módulo `data-agent` já aplica cache, valida parâmetros e devolve objetos padronizados; trate erros e issues retornados por `data-validator` (que não altera dados).

Como usar este plano
- Cada item é uma instrução para implementar uma função/módulo JS testável e independente.  
- Progrida incrementalmente: implemente o esqueleto de `state` + `handleMessage` + loader stubs, depois o pipeline mínimo, depois módulos de análise e fallbacks.

Etapas (instruções)

1. Inicialização e contrato público do agente
- Implemente `initAgent(config)` que retorna um objeto com métodos públicos: `handleMessage`, `onMissionStart`, `onMissionEnd`, `clearCache`.  
- Defina o formato esperado de `config` (ex.: `orchestratorEndpoint`, `defaultTimeout`, `logAdapter`).  
- Não implemente adaptadores concretos ainda — aceite funções em `config` para injeção (ex.: `queryData`, `loadFramework`).

2. Modelo de estado interno (objeto JS)
- Crie `state` com chaves: `mission`, `workingMemory`, `selectedFrameworks`, `frameworkCache`, `dataCache`, `analysisResults`, `metrics`, `explainTrace`.  
- Exemplos mínimos: `mission = { id, objective, budget, timeout, requester }`; `analysisResults = []`.

3. Interface de mensagens e ciclo de comandos
- Defina `handleMessage(message)` com `message = { action, payload, missionMeta }`. Ações suportadas: `plan`, `execute`, `evaluate`, `consolidate`, `abort`.  
- `handleMessage` valida a entrada, atualiza o `state` e encaminha ao pipeline apropriado.

4. Loader/validador de frameworks (contrato)
- Implemente stubs (fáceis de testar): `loadLevel1()`, `loadLevel2(centralId)`, `loadLevel3(secondaryId, version)`, `getLatestVersion(frameworkId)`. Todas retornam `Promise`.  
- Valide existência e versão; lance erros explicativos quando inválido.

5. Adaptador de acesso a dados (encapsula data-agent)
- Implementar `queryData(category, filters)` que retorna `Promise<records>`. Mapear categorias esperadas: `Dados_receitas_e_despesas`, `Dados_transacoes`, `Dados_dividas`, `Dados_contas`, `Dados_perfil`.  
- Respeitar TTLs locais quando apropriado e capturar erros/issue do `data-validator`. Esse adaptador será injetado via `config` para facilitar testes.

6. Pipeline de decisão modular e encadeável
- Defina funções puras/async: `preprocess(state)`, `classifyIntent(state)`, `selectFrameworks(state)`, `fetchDataForFrameworks(state)`, `applyFrameworks(state)`, `evaluateOutcomes(state)`, `consolidate(state)`.  
- Cada função recebe e retorna `state` (ou `Promise<state>`). Evite efeitos colaterais fora do `state` salvo logs/metrics.

7. Módulos de análise por framework
- Para cada domínio (ex.: endividamento, orçamento, investimentos) crie um módulo com `analyzeWithFramework(state, framework)` que:  
	- recebe `state` e `framework` (conteúdo Nível 3)  
	- executa etapas do framework sobre dados do `state`  
	- retorna `outcome = { frameworkId, passedCriteria, failedCriteria, metrics, recommendations }`.

8. Regras, thresholds e mesclagem de configurações
- Padronize `rules` como objeto: `{ criterioId: { threshold, weight, description } }`.  
- Ao carregar um framework, mescle thresholds fornecidos pelo framework com defaults globais via `mergeRules(defaultRules, framework.rules)`.

9. Estratégias de fallback e degradação graciosa
- Implemente `handleFallback(state, reason)` com tentativas ordenadas: (a) usar versão anterior do framework, (b) combinar frameworks similares, (c) executar análise simplificada (modo manual).  
- Documente condições de retry e quando parar e consolidar parcial.

10. Traço de explicabilidade e saída estruturada
- Mantenha `state.explainTrace` como array de eventos `{ step, timestamp, decision, reason, meta }`.  
- `consolidate(state)` produz `result = { missionId, frameworksUsed, criteriaResults, risks, recommendations, explainTrace, meta }`.

11. Observability: logs e métricas (contratos, não implementação)
- Defina chamadas padrão: `emitLog(level, msg, meta)` e `recordMetric(name, value, tags)`. Injete adaptadores via `config` para integração com qualquer sistema de logs/metrics.

12. Ciclo de missão, timeouts e limpeza
- `onMissionStart(mission)` inicializa `state` e `mission` cache; `onMissionEnd(result)` chama `clearCache()` e envia `result` ao orquestrador.  
- Em `timeout`, priorize `consolidate(state)` com explicação parcial e razão de timeout.

13. Validações e integração com `data-validator`
- Antes de executar análises críticas, chame uma rotina que solicita `validateDataIntegrity` para conjuntos de dados sensíveis; trate issues como `warning` ou `blocking` conforme severidade.

14. Testes, simulações e harness local
- Especifique testes unitários para funções puras e testes de integração com stubs para `loadLevel3` e `queryData`. Inclua cenários: dados completos, dados faltantes, múltiplos frameworks, erros de dados, timeouts.

15. Integração, versionamento e evolução
- Implemente `getEffectiveVersion(frameworkId, requestedVersion)` que seleciona versão compatível; registre `framework.version` em `metrics` e `explainTrace`.  
- Documente como aplicar atualizações minor sem breaking changes.

Observações finais
- Implemente tudo como módulos JS testáveis e injetáveis. Priorize clareza das entradas/saídas e traceabilidade.  
- Próximo passo sugerido: gerar o esqueleto JS com `state`, `handleMessage`, loader stubs e adaptador `queryData` para começar a codificação.
