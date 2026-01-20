/**
 * NOTE (event-types.js):
 * Purpose: Centralized enum of event type constants used by the streaming
 * subsystem. Import these to keep producers and consumers in sync.
 */

const EVENT_TYPES = {
  NODE_START: 'node:start',
  TOOL_CALL: 'tool:call',
  DATA_PARTIAL: 'data:partial',
  THOUGHT_REASONING: 'thought:reasoning',
  FINAL_ANSWER: 'final:answer'
};

module.exports = { EVENT_TYPES };
