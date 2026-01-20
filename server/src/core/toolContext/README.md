# ToolContext - Sistema de Cache em Memória

Esta pasta contém o sistema de cache em memória usado por agentes e serviços para evitar chamadas redundantes ao banco de dados ou APIs externas durante sessões.

## Arquivos e Responsabilidades

### tool-context.js
Implementa cache em memória por processo com suporte a TTL (time-to-live), tags semânticas e invalidação granular.

A classe `ToolContext` mantém Map onde cada chave armazena objeto com três propriedades: `value` (dado cacheado), `expiresAt` (timestamp de expiração) e `tags` (array de strings para invalidação semântica).

A função `set()` armazena valor com TTL customizável (padrão: 300 segundos / 5 minutos) e tags opcionais. Tags são identificadores semânticos como `account:123` ou `user:456:transactions` que permitem invalidação inteligente.

`get()` recupera valor apenas se não expirado. Se entrada expirou, é automaticamente deletada e retorna null. Logs de acesso registram hits e misses para análise de performance do cache.

`has()` verifica se chave existe e está válida (não expirada). `invalidate()` remove entrada específica por chave. `invalidateByTag()` é o diferencial: remove todas as entradas que contêm determinada tag, permitindo invalidação em massa de dados relacionados.

Por exemplo: quando conta é atualizada, chama `invalidateByTag('account:123')` para limpar todos os caches relacionados àquela conta (saldo, transações, detalhes). Isso mantém consistência sem precisar rastrear manualmente todas as chaves afetadas.

`clear()` limpa todo cache (usar com cuidado). `getAccessLog()` retorna histórico de operações para auditoria e análise de padrões de uso. `stop()` para timer de cleanup ao desligar aplicação.

Integra-se com `TTLManager` que limpa entradas expiradas periodicamente. Todos os access logs são timestamped para debugging e otimização de TTLs.

### ttl-manager.js
Limpador em background que remove entradas expiradas do `ToolContext` periodicamente, prevenindo vazamento de memória.

A classe `TTLManager` recebe instância de `ToolContext` no construtor e configura intervalo de limpeza (padrão: 60 segundos). `start()` inicia timer que executa `cleanup()` periodicamente e também executa limpeza imediata.

`cleanup()` varre todo o Map do ToolContext comparando `expiresAt` com timestamp atual. Entradas expiradas são deletadas e operação é logada como `expired_cleanup` no access log.

`stop()` para o timer quando aplicação está desligando ou ToolContext não é mais necessário. Essencial chamar stop() antes de destruir ToolContext para evitar memory leaks do interval timer.

O intervalo de limpeza é trade-off: muito curto consome CPU desnecessariamente, muito longo permite que memória de entradas expiradas fique retida por mais tempo. 60 segundos é balanceamento razoável para maioria dos casos.

Cleanup é não bloqueante e rápido: apenas itera Map e deleta entradas vencidas. Não faz I/O ou processamento pesado. Logging opcional permite ver quantas entradas foram limpas em cada passagem.

### index.js
Exporta singleton do `ToolContext` para uso application-wide. Garante que todo o sistema use a mesma instância de cache, evitando fragmentação.

Configura ToolContext com TTL padrão de 300 segundos (5 minutos) e cleanup a cada 60 segundos. Estes valores são razoáveis para maioria dos casos mas podem ser ajustados se necessário.

O singleton é inicializado na primeira importação e reutilizado em todas as importações subsequentes. Isso é crucial: se cada módulo criasse sua própria instância, invalidações não funcionariam corretamente.

Usado por DataAgent através do cache-manager, que adiciona lógica específica de chaveamento para dados financeiros. Também pode ser usado diretamente por outros módulos que precisam cache simples.

Import pattern: `const toolContext = require('../core/toolContext');` retorna instância pronta para uso. Chamar `toolContext.set()`, `toolContext.get()`, etc diretamente.

**Importante**: Após operações que modificam dados (updates, deletes), sempre chamar `toolContext.invalidateByTag()` com tags apropriadas para manter cache consistente. Não fazer isso resulta em dados stale sendo servidos.
