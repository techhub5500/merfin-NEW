# Working Memory - Memória Volátil de Sessão

Esta pasta contém o sistema de memória de trabalho, responsável por armazenar contexto temporário durante a execução de sessões, incluindo cálculos intermediários, parâmetros de ação atual e variáveis de raciocínio.

## Arquivos e Responsabilidades

### working-memory.js
Implementa armazenamento volátil chave-valor por sessão com curadoria de IA e orçamento de 700 palavras. Cada sessão tem seu próprio namespace isolado de memória.

A classe `WorkingMemory` mantém Map de sessões ativas, onde cada sessão tem seu próprio Map de chave-valor. Toda entrada passa por curadoria de IA DeepSeek antes do armazenamento: a IA valida se o dado deve ser armazenado em memória temporária, rejeitando dados sensíveis (senhas, tokens, CPF, cartões), PII e informações irrelevantes ou duplicadas.

A função `set()` executa validação de IA, verifica orçamento de palavras (700 max por sessão) e, se exceder, automaticamente remove entradas mais antigas para abrir espaço usando `_freeSpace()`. Se a curadoria de IA falhar, usa fallback de validação básica via `memory-validator`.

`get()` recupera valor por chave, `getAll()` retorna todos os pares chave-valor da sessão, `has()` verifica existência de chave, `delete()` remove chave específica e `clear()` limpa toda a memória da sessão.

Implementa limpeza automática de sessões inativas após 40 minutos (configurado em `CLEANUP_RULES.WORKING_SESSION_TIMEOUT`). O método `_cleanupInactive()` é executado periodicamente, removendo sessões expiradas e liberando memória.

A working memory é ideal para armazenar resultados temporários de cálculos, contexto imediato de ação, parâmetros de requisição atual e dados intermediários de análise. Nunca persiste no banco de dados - existe apenas em memória RAM do processo.

### session-store.js
Gerencia o ciclo de vida de sessões ativas com controle de timeout e limpeza automática.

A classe `SessionStore` mantém informações de sessão: ID único, userId associado, timestamps de criação e última atividade, e metadados opcionais. `createSession()` inicializa nova sessão registrando usuário e hora de criação.

`isActive()` verifica se sessão ainda está dentro do timeout (40 minutos de inatividade). `renewActivity()` atualiza timestamp de última atividade sempre que há interação, estendendo a validade da sessão.

`endSession()` encerra sessão manualmente, limpando sua working memory via `workingMemory.clear()` e removendo registro do store. `cleanupExpired()` varre todas as sessões procurando as expiradas, limpando suas memórias e removendo do store.

Timer automático executa cleanup a cada 5 minutos via `startCleanup()`. `stopCleanup()` para o timer quando necessário (útil em testes ou shutdown). `getStats()` retorna estatísticas úteis: total de sessões, quantas ativas, quantas expiradas e duração média.

`getUserSessions()` lista todas as sessões de um usuário específico, indicando quais estão ativas. `clearAll()` limpa tudo (cuidado - apenas para casos especiais como reset de sistema).

Exporta singleton que inicia cleanup automático imediatamente. Trabalha em conjunto com working-memory.js: quando SessionStore detecta sessão expirada, dispara limpeza da working memory correspondente.

### context-builder.js
Constrói contexto de execução unificado para agentes agregando dados de working memory, informações de sessão e metadados.

A função `buildContext()` é chamada no início de cada ciclo de agente. Recebe sessionId e opções configuráveis. Busca informações da sessão no `sessionStore` (userId, timestamps, duração) e dados da working memory do `workingMemory`.

Oferece dois modos de recuperação: específico (passa array de `keys` para buscar apenas essas chaves da working memory) ou completo (sem keys, retorna tudo). Opção `includeMetadata` controla se metadados de sessão são incluídos.

Retorna objeto estruturado: `sessionId`, `timestamp` atual, `userId`, `sessionCreatedAt`, `sessionDuration`, `sessionMetadata` (se solicitado) e `memory` (dados da working memory). Se sessão não existir ou estiver expirada, retorna com campo `error`.

`updateContext()` permite atualizar múltiplas chaves da working memory simultaneamente e automaticamente renova atividade da sessão. `clearContextKeys()` remove chaves específicas. `clearContext()` limpa toda memória da sessão.

Este arquivo funciona como interface de alto nível, escondendo complexidade de lidar diretamente com working memory e session store. Agentes simplesmente chamam `buildContext()` e recebem tudo que precisam em estrutura padronizada.

Útil especialmente no padrão ReAct onde agentes precisam manter estado entre ciclos: cada ciclo chama `buildContext()` para recuperar variáveis de raciocínio do ciclo anterior, executa ação, chama `updateContext()` para salvar novos resultados e continua no próximo ciclo.
