# Working Memory - Memória de Trabalho Persistente

Esta pasta contém o sistema de memória de trabalho, responsável por armazenar contexto temporário durante a execução de sessões, incluindo cálculos intermediários, parâmetros de ação atual e variáveis de raciocínio. Agora persistida no MongoDB com expiração automática após 500 horas.

## Arquivos e Responsabilidades

### working-memory.js
Implementa armazenamento persistente chave-valor por sessão com curadoria de IA e orçamento de 600 palavras. Cada sessão tem seu próprio namespace isolado de memória, armazenado no MongoDB com cache em RAM para performance.

A classe `WorkingMemory` mantém cache em RAM de sessões ativas, onde cada sessão tem seu próprio Map de chave-valor. Toda entrada passa por curadoria de IA DeepSeek antes do armazenamento: a IA valida se o dado deve ser armazenado em memória temporária, rejeitando dados sensíveis (senhas, tokens, CPF, cartões), PII e informações irrelevantes ou duplicadas.

A função `set()` executa validação de IA, verifica orçamento de palavras (600 max por sessão) e, se exceder, automaticamente remove entradas mais antigas para abrir espaço usando `_freeSpace()`. Se a curadoria de IA falhar, usa fallback de validação básica via `memory-validator`. Os dados são persistidos no MongoDB com TTL de 500 horas.

`get()` recupera valor por chave, primeiro do cache RAM, depois do MongoDB se necessário. `getAll()` retorna todos os pares chave-valor da sessão. `has()` verifica existência de chave, `delete()` remove chave específica e `clear()` limpa toda a memória da sessão do cache e DB.

Implementa limpeza automática de sessões inativas após 500 minutos (configurado em `CLEANUP_RULES.WORKING_SESSION_TIMEOUT`), mas a persistência no MongoDB tem TTL automático de 500 horas. O método `_cleanupInactive()` é executado periodicamente, removendo sessões expiradas do cache (o DB cuida da expiração).

A working memory é ideal para armazenar resultados temporários de cálculos, contexto imediato de ação, parâmetros de requisição atual e dados intermediários de análise. Persiste no MongoDB por até 500 horas, depois é automaticamente excluída pelo TTL do banco.

### session-store.js
Gerencia o ciclo de vida de sessões ativas com controle de timeout e limpeza automática. Trabalha com working memory persistente no MongoDB.

A classe `SessionStore` mantém informações de sessão: ID único, userId associado, timestamps de criação e última atividade, e metadados opcionais. `createSession()` inicializa nova sessão registrando usuário e hora de criação.

`isActive()` verifica se sessão ainda está dentro do timeout (500 minutos de inatividade). `renewActivity()` atualiza timestamp de última atividade sempre que há interação, estendendo a validade da sessão.

`endSession()` encerra sessão manualmente, limpando sua working memory do cache e MongoDB via `workingMemory.clear()` e removendo registro do store. `cleanupExpired()` varre todas as sessões procurando as expiradas, limpando suas memórias e removendo do store.

Timer automático executa cleanup a cada 5 minutos via `startCleanup()`. `stopCleanup()` para o timer quando necessário (útil em testes ou shutdown). `getStats()` retorna estatísticas úteis: total de sessões, quantas ativas, quantas expiradas e duração média.

`getUserSessions()` lista todas as sessões de um usuário específico, indicando quais estão ativas. `clearAll()` limpa tudo (cuidado - apenas para casos especiais como reset de sistema).

Exporta singleton que inicia cleanup automático imediatamente. Trabalha em conjunto com working-memory.js: quando SessionStore detecta sessão expirada, dispara limpeza da working memory correspondente no cache e DB.

### context-builder.js
Constrói contexto de execução unificado para agentes agregando dados de working memory persistente, informações de sessão e metadados.

A função `buildContext()` é chamada no início de cada ciclo de agente. Recebe sessionId e opções configuráveis. Busca informações da sessão no `sessionStore` (userId, timestamps, duração) e dados da working memory do `workingMemory` (do cache ou MongoDB). 

Oferece dois modos de recuperação: específico (passa array de `keys` para buscar apenas essas chaves da working memory) ou completo (sem keys, retorna tudo). Opção `includeMetadata` controla se metadados de sessão são incluídos.

Retorna objeto estruturado: `sessionId`, `timestamp` atual, `userId`, `sessionCreatedAt`, `sessionDuration`, `sessionMetadata` (se solicitado) e `memory` (dados da working memory). Se sessão não existir ou estiver expirada, retorna com campo `error`.

`updateContext()` permite atualizar múltiplas chaves da working memory simultaneamente e automaticamente renova atividade da sessão. `clearContextKeys()` remove chaves específicas. `clearContext()` limpa toda memória da sessão do cache e DB.

Este arquivo funciona como interface de alto nível, escondendo complexidade de lidar diretamente com working memory e session store. Agentes simplesmente chamam `buildContext()` e recebem tudo que precisam em estrutura padronizada.

Útil especialmente no padrão ReAct onde agentes precisam manter estado entre ciclos: cada ciclo chama `buildContext()` para recuperar variáveis de raciocínio do ciclo anterior, executa ação, chama `updateContext()` para salvar novos resultados e continua no próximo ciclo.

## Integração com Chat

Working memory é sempre enviada ao modelo de IA quando existe para a sessão. O sistema verifica status de processamento antes de permitir novos envios, garantindo que memórias estejam sincronizadas.