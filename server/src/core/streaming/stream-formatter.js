/**
 * NOTE (stream-formatter.js):
 * Purpose: Utilities to format events as Server-Sent Events (SSE).
 * The formatter produces strings following the SSE spec: "data: {json}\n\n".
 */

function formatEvent(type, payload) {
  const data = JSON.stringify({ type, payload });
  return `data: ${data}\n\n`;
}

module.exports = {
  formatEvent
};
