/**
 * NOTE (tool-context.js):
 * Purpose: In-memory per-process cache (ToolContext) used to avoid redundant DB/API calls
 * during an agent session. Stores entries with `expiresAt` and `tags` for fine-grained invalidation.
 * Controls: `set`, `get`, `has`, `invalidate`, `invalidateByTag`, `clear` and `_accessLog` for auditing.
 * Integration notes: Mutating operations should call `invalidateByTag(...)` with semantic tags
 * (e.g. `account:{id}`, `user:{id}:transactions`) to keep caches consistent.
 */
const TTLManager = require('./ttl-manager');
class ToolContext {
  constructor(opts = {}) {
    this.store = new Map(); // key -> { value, expiresAt, tags }
    this._accessLog = [];
    this.defaultTTL = typeof opts.defaultTTL === 'number' ? opts.defaultTTL : 300; // seconds
    this.cleanupIntervalSeconds = typeof opts.cleanupIntervalSeconds === 'number' ? opts.cleanupIntervalSeconds : 60;
    this.ttlManager = new TTLManager(this, { intervalSeconds: this.cleanupIntervalSeconds });
    this.ttlManager.start();
  }

  set(key, value, ttlSeconds = this.defaultTTL, tags = []) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt, tags });
    this._accessLog.push({ timestamp: new Date(), key, action: 'set', ttlSeconds, tags });
    return true;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this._accessLog.push({ timestamp: new Date(), key, action: 'get', hit: false });
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this._accessLog.push({ timestamp: new Date(), key, action: 'get', hit: false, reason: 'expired' });
      return null;
    }
    this._accessLog.push({ timestamp: new Date(), key, action: 'get', hit: true });
    return entry.value;
  }

  has(key) {
    const entry = this.store.get(key);
    return !!entry && entry.expiresAt > Date.now();
  }

  invalidate(key) {
    const removed = this.store.delete(key);
    if (removed) this._accessLog.push({ timestamp: new Date(), key, action: 'invalidate' });
    return removed;
  }

  // Invalidate all entries that include the provided tag
  invalidateByTag(tag) {
    let removed = 0;
    for (const [k, v] of this.store.entries()) {
      if (Array.isArray(v.tags) && v.tags.includes(tag)) {
        this.store.delete(k);
        this._accessLog.push({ timestamp: new Date(), key: k, action: 'invalidate_by_tag', tag });
        removed++;
      }
    }
    return removed;
  }

  clear() {
    this.store.clear();
    this._accessLog.push({ timestamp: new Date(), action: 'clear' });
  }

  getAccessLog({ since } = {}) {
    if (!since) return Array.from(this._accessLog);
    return this._accessLog.filter(e => e.timestamp >= since);
  }

  stop() {
    if (this.ttlManager) this.ttlManager.stop();
  }
}

module.exports = ToolContext;
