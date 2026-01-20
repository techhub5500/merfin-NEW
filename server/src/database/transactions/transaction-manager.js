/**
 * NOTE (transaction-manager.js):
 * Purpose: Central helper to execute MongoDB ACID transactions.
 * Controls: `executeTransaction(operationFn, options)` which starts a session,
 * runs the provided function with the session, and commits/aborts with audit logging.
 * Behavior: Uses readConcern 'snapshot' and writeConcern 'majority'.
 * Integration notes: Keep transactions short. Heavy work should occur outside the transaction.
 */
const mongoose = require('mongoose');

const AuditLog = require('../schemas/audit-log-schema');

async function executeTransaction(operationFn, options = {}) {
  const { actor = 'system', action = 'db:transaction', userId, metadata } = options;

  const session = await mongoose.startSession();
  session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });

  try {
    const result = await operationFn(session);

    await session.commitTransaction();

    // Registro de commit no audit log (fora de transação é aceitável, mas tentamos salvar com sessão)
    try {
      await new AuditLog({
        timestamp: new Date(),
        userId,
        actor,
        action: `${action}:commit`,
        entity: 'TransactionManager',
        metadata: Object.assign({}, metadata, { result })
      }).save();
    } catch (logErr) {
      // IMPORTANTE: Log de auditoria falhando é um problema de compliance
      console.error('[CRITICAL] Audit log commit failed - compliance risk:', logErr);
      // TODO: Implement fallback logging mechanism (file-based, external service)
    }

    session.endSession();
    return result;
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (abortErr) {
      console.error('Failed to abort transaction', abortErr);
    }

    // Registro de abort no audit log
    try {
      await new AuditLog({
        timestamp: new Date(),
        userId,
        actor,
        action: `${action}:abort`,
        entity: 'TransactionManager',
        metadata: Object.assign({}, metadata, { error: err.message })
      }).save();
    } catch (logErr) {
      console.error('[CRITICAL] Audit log abort failed - compliance risk:', logErr);
      // TODO: Implement fallback logging mechanism
    }

    session.endSession();
    throw err;
  }
}

module.exports = {
  executeTransaction
};
