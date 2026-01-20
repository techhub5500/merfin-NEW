/**
 * NOTE (event-emitter.js):
 * Purpose: Singleton EventEmitter used by agents and server to publish
 * streaming events to connected frontend clients. Events are namespaced
 * by `sessionId` so multiple clients can listen to their own streams.
 * Usage:
 *   const streaming = require('./event-emitter');
 *   streaming.emit(sessionId, type, payload);
 */

const EventEmitter = require('events');

class AgentEmitter extends EventEmitter {}

const emitter = new AgentEmitter();

module.exports = {
  emit(sessionId, type, payload) {
    emitter.emit(sessionId, { type, payload });
  },
  on(sessionId, fn) {
    emitter.on(sessionId, fn);
  },
  off(sessionId, fn) {
    emitter.off(sessionId, fn);
  },
  raw: emitter
};
