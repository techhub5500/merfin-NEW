/**
 * NOTE (audit-log-schema.js):
 * Purpose: Append-only audit log collection for traceability of operations.
 * Controls: timestamp, userId, actor, action, entity, entityId, beforeState, afterState.
 * Behavior: Adds Mongoose hooks to prevent updates/deletes; recommend DB-level policies
 * (roles/privileges) to enforce append-only at the database level.
 * Integration notes: Use `AuditLog.record(...)` helper to create entries with consistent shape.
 */
const mongoose = require('mongoose');

const { Schema } = mongoose;

const auditLogSchema = new Schema({
  timestamp: { type: Date, required: true, default: Date.now, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  actor: { type: String, required: true }, // ex: 'transaction-agent', 'auth-service', 'memory-curator'
  action: { type: String, required: true }, // ex: 'transaction:create', 'memory:update', 'decision:approve'
  entity: { type: String, required: true, index: true }, // ex: 'Transaction', 'Account', 'EpisodicMemory'
  entityId: { type: Schema.Types.ObjectId },

  // Snapshots for before/after states (store minimal data needed for traceability)
  beforeState: { type: Schema.Types.Mixed },
  afterState: { type: Schema.Types.Mixed },

  metadata: { type: Schema.Types.Mixed }, // extra context (requestId, reason, agentDecisionScore...)
  ip: { type: String },
  requestId: { type: String, index: true },

}, {
  strict: true,
  versionKey: false
});

// Indexes for fast queries (user activity, recent events, entity history)
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

// Prevent updates/deletes via Mongoose (append-only enforcement at application layer)
function denyModification(next) {
  const err = new Error('AuditLog collection is append-only: updates/deletes are forbidden');
  next(err);
}

auditLogSchema.pre('updateOne', denyModification);
auditLogSchema.pre('updateMany', denyModification);
auditLogSchema.pre('findOneAndUpdate', denyModification);
auditLogSchema.pre('replaceOne', denyModification);
auditLogSchema.pre('deleteOne', denyModification);
auditLogSchema.pre('deleteMany', denyModification);

/**
 * Helper static to create audit entries: garante shape consistente
 * Usage: AuditLog.record({ actor, action, entity, entityId, userId, beforeState, afterState, metadata })
 */
auditLogSchema.statics.record = async function (entry) {
  const AuditLog = this;
  const doc = new AuditLog(entry);
  return doc.save();
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
