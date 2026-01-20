/**
 * NOTE (account-transactions.js):
 * Purpose: Helper functions to update account balances and perform atomic transfers.
 * Controls: `updateAccountBalance(accountId, amount, session)` and `transferFunds(from, to, amount, opts)`.
 * Behavior: All balance mutations must run inside a MongoDB session/transaction and register audit logs.
 * Integration notes: After successful commit, this module invalidates cache tags (ToolContext) related to
 * affected accounts and user transaction summaries.
 */
const mongoose = require('mongoose');
const Account = require('../schemas/accounts-schema');
const TransactionModel = require('../schemas/transactions-schema');
const AuditLog = require('../schemas/audit-log-schema');
const { executeTransaction } = require('./transaction-manager');
const toolContext = require('../../core/toolContext');

/**
 * updateAccountBalance - altera o saldo de uma conta dentro de uma sessão
 * @param {ObjectId|string} accountId
 * @param {Number} amount - valor a somar (positivo = crédito, negativo = débito)
 * @param {ClientSession} session - sessão MongoDB obrigatória
 * @returns {Promise<{ accountId, oldBalance, newBalance }>} 
 */
async function updateAccountBalance(accountId, amount, session) {
  if (!session) throw new Error('updateAccountBalance must be called with a MongoDB session');

  const account = await Account.findById(accountId).session(session).exec();
  if (!account) throw new Error('Account not found: ' + accountId);

  const oldBalance = Number(account.balance || 0);
  const newBalance = Number((oldBalance + Number(amount)).toFixed(2));

  if (newBalance < 0) {
    throw new Error('Insufficient funds for account ' + accountId);
  }

  await Account.updateOne({ _id: accountId }, { $set: { balance: newBalance } }).session(session).exec();

  return { accountId, oldBalance, newBalance };
}

/**
 * transferFunds - debita uma conta e credita outra de forma atômica
 * @param {ObjectId|string} fromAccountId
 * @param {ObjectId|string} toAccountId
 * @param {Number} amount - valor positivo (será debitado de -> creditado em)
 * @param {Object} opts - { actor, userId, description }
 */
async function transferFunds(fromAccountId, toAccountId, amount, opts = {}) {
  if (!fromAccountId || !toAccountId) throw new Error('Both fromAccountId and toAccountId are required');
  if (!(amount > 0)) throw new Error('Amount must be a positive number');

  const { actor = 'transaction-agent', userId, description } = opts;

  const result = await executeTransaction(async (session) => {
    // Snapshot before
    const fromBefore = await Account.findById(fromAccountId).session(session).lean();
    const toBefore = await Account.findById(toAccountId).session(session).lean();

    // Update balances (debit then credit)
    const debited = await updateAccountBalance(fromAccountId, -Math.abs(amount), session);
    const credited = await updateAccountBalance(toAccountId, Math.abs(amount), session);

    // Optionally create a transaction record
    try {
      await new TransactionModel({
        userId: userId || null,
        accountId: fromAccountId,
        section: 'statement',
        type: 'transfer',
        amount: amount,
        currency: 'BRL',
        date: new Date(),
        status: 'confirmed',
        description: description || `Transfer to ${toAccountId}`,
        metadata: { from: fromAccountId, to: toAccountId }
      }).save({ session });
    } catch (txErr) {
      console.error('Failed to create transaction record', txErr);
      // Not critical for commit, but we continue
    }

    // Snapshot after
    const fromAfter = await Account.findById(fromAccountId).session(session).lean();
    const toAfter = await Account.findById(toAccountId).session(session).lean();

    // Register audit log inside the same session (will be committed together)
    await new AuditLog({
      timestamp: new Date(),
      userId,
      actor,
      action: 'transaction:transfer',
      entity: 'Account',
      entityId: fromAccountId,
      beforeState: { account: fromBefore },
      afterState: { account: fromAfter },
      metadata: { toAccountId, amount, credited, debited, description }
    }).save({ session });

    // also log for the destination account
    await new AuditLog({
      timestamp: new Date(),
      userId,
      actor,
      action: 'transaction:transfer',
      entity: 'Account',
      entityId: toAccountId,
      beforeState: { account: toBefore },
      afterState: { account: toAfter },
      metadata: { fromAccountId, amount, credited, debited, description }
    }).save({ session });

    return { debited, credited };
  }, { actor, action: 'transaction:transfer', userId, metadata: { description } });

  // After successful commit, invalidate cache entries related to the affected accounts and user
  try {
    // account-specific tags
    toolContext.invalidateByTag(`account:${fromAccountId}`);
    toolContext.invalidateByTag(`account:${toAccountId}`);

    // transaction lists / summaries for user
    if (userId) {
      toolContext.invalidateByTag(`user:${userId}:summary`);
      toolContext.invalidateByTag(`user:${userId}:transactions`);
    }

    // generic transaction/account keys
    toolContext.invalidateByTag(`transactions:account:${fromAccountId}`);
    toolContext.invalidateByTag(`transactions:account:${toAccountId}`);
  } catch (invErr) {
    console.error('Cache invalidation failed', invErr);
  }

  return result;
}

module.exports = {
  updateAccountBalance,
  transferFunds
};
