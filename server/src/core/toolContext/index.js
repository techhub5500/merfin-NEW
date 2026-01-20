/**
 * NOTE (toolContext/index.js):
 * Purpose: Export a singleton `ToolContext` for application-wide caching.
 * Controls: Central entry for the in-memory cache used by agents and services.
 * Integration notes: Import this module (`require('../core/toolContext')`) to access
 * the shared cache instance and call `invalidateByTag` after writes.
 */
const ToolContext = require('./tool-context');

// Export a singleton ToolContext for application-wide use.
const DEFAULT_TTL = 300; // 3 minutes
const DEFAULT_CLEANUP = 60; // seconds

const singleton = new ToolContext({ defaultTTL: DEFAULT_TTL, cleanupIntervalSeconds: DEFAULT_CLEANUP });

module.exports = singleton;
