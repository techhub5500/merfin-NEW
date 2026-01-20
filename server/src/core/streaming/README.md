# Streaming - Sistema de Eventos em Tempo Real

Esta pasta contém o subsistema de streaming que permite aos agentes comunicar progresso em tempo real para clientes frontend via Server-Sent Events (SSE).

## Arquivos e Responsabilidades

### event-emitter.js
Singleton EventEmitter que funciona como hub central de eventos de streaming, permitindo que agentes publiquem eventos e que múltiplos clientes escutem streams isolados.

Estende o EventEmitter nativo do Node.js criando a classe `AgentEmitter`. Exporta interface simplificada com três métodos principais: `emit()`, `on()` e `off()`.

Os eventos são namespacados por `sessionId`, permitindo que múltiplos clientes conectados simultaneamente recebam apenas os eventos de suas próprias sessões. Quando um agente chama `emit(sessionId, type, payload)`, apenas listeners registrados naquele sessionId recebem o evento.

A função `emit()` publica evento com tipo e payload para uma sessão específica. `on(sessionId, fn)` registra listener para receber eventos daquela sessão. `off(sessionId, fn)` remove listener quando conexão é fechada.

Também exporta `raw` que expõe o EventEmitter subjacente para casos avançados onde controle direto é necessário.

Usado por agentes para reportar progresso: início de nó de raciocínio, chamadas de ferramentas, dados parciais, pensamentos e resposta final. Também usado pelo servidor para conectar rotas SSE aos eventos das sessões.

### event-types.js
Define constantes centralizadas para todos os tipos de eventos de streaming do sistema. Importar este arquivo garante que produtores (agentes) e consumidores (frontend) usem exatamente os mesmos identificadores de evento.

Define cinco tipos principais:

- **NODE_START** (`node:start`) - Dispara quando agente inicia um novo nó de raciocínio no padrão ReAct. Indica que novo ciclo de pensamento começou.

- **TOOL_CALL** (`tool:call`) - Dispara quando agente decide chamar uma ferramenta/ação. Inclui payload com nome da ferramenta e parâmetros.

- **DATA_PARTIAL** (`data:partial`) - Dispara quando dados parciais estão disponíveis antes do resultado completo. Útil para mostrar progresso gradual de queries longas.

- **THOUGHT_REASONING** (`thought:reasoning`) - Dispara com raciocínio do agente em linguagem natural. Mostra ao usuário "o que o agente está pensando".

- **FINAL_ANSWER** (`final:answer`) - Dispara quando agente tem resposta completa e final para enviar ao usuário.

Estes tipos podem ser estendidos no futuro adicionando novas constantes. Importar via destructuring: `const { EVENT_TYPES } = require('./event-types');` e usar como `EVENT_TYPES.TOOL_CALL`.

### stream-formatter.js
Utilitário para formatar eventos no padrão Server-Sent Events (SSE), protocolo usado para streaming unidirecional de servidor para cliente.

A função `formatEvent()` recebe tipo e payload, serializa para JSON e envolve no formato SSE: `data: {json}\n\n`. Este formato é reconhecido por `EventSource` no navegador e outros clientes SSE.

O formato SSE é simples: cada evento é prefixado com `data: `, seguido do conteúdo JSON, e terminado com duas newlines (`\n\n`) indicando fim do evento. Este formato permite que o cliente diferencie onde um evento termina e outro começa.

Usado pelo servidor ao escrever eventos na response stream SSE. Quando evento é emitido via `event-emitter`, o servidor chama `formatEvent()` antes de escrever no socket HTTP.

Mantém separação de responsabilidades: agents não precisam saber nada sobre formato SSE, apenas chamam `emit()`. Este formatter cuida de toda serialização e formatação necessária para o protocolo.

Simples e focado: apenas uma função pura que transforma objeto JavaScript em string SSE válida. Sem estado, sem side effects, fácil de testar.
