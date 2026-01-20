/**
 * NOTE (ttl-manager.js):
 * Purpose: Background cleaner for `ToolContext` that removes expired entries periodically.
 * Controls: `start()`, `cleanup()`, `stop()` and writes `expired_cleanup` events to `ToolContext._accessLog`.
 * Integration notes: Keep interval short enough for your consistency needs but avoid CPU churn.
 */
class TTLManager {
  constructor(toolContext, opts = {}) {
    if (!toolContext || typeof toolContext.store === 'undefined') throw new Error('TTLManager requires a ToolContext instance');
    this.toolContext = toolContext;
    this.intervalSeconds = typeof opts.intervalSeconds === 'number' ? opts.intervalSeconds : 60;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.cleanup(), this.intervalSeconds * 1000);
    // Do an immediate cleanup pass
    this.cleanup();
  }

  cleanup() {
    const now = Date.now();
    for (const [k, v] of this.toolContext.store.entries()) {
      if (!v || !v.expiresAt) continue;
      if (v.expiresAt <= now) {
        this.toolContext.store.delete(k);
        // write to access log if available
        if (Array.isArray(this.toolContext._accessLog)) {
          this.toolContext._accessLog.push({ timestamp: new Date(), key: k, action: 'expired_cleanup' });
        }
      }
    }
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = TTLManager;
