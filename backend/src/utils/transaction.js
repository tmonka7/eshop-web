'use strict';
const mongoose = require('mongoose');

/**
 * Multi-document transactions require a replica set. A plain `mongod` install
 * (the default for local development) is a standalone and rejects them, so we
 * detect that one specific failure and re-run the body without a session.
 *
 * The retry is safe because MongoDB refuses the *first* session-bound write,
 * meaning nothing has been persisted when we fall back.
 */
function isTransactionUnsupported(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  return (
    err.code === 20 // IllegalOperation
    || err.codeName === 'IllegalOperation'
    || /Transaction numbers are only allowed on a replica set member or mongos/i.test(msg)
    || /Transactions are not supported/i.test(msg)
    || /This MongoDB deployment does not support retryable writes/i.test(msg)
  );
}

let standaloneWarned = false;

/**
 * Runs `fn(session)` inside a transaction when the deployment supports one,
 * otherwise runs `fn(null)` directly.
 */
async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (!isTransactionUnsupported(err)) throw err;
    if (!standaloneWarned) {
      standaloneWarned = true;
      console.warn(
        '[db] Standalone MongoDB detected - running writes without transactions. '
        + 'Start mongod with --replSet for atomic checkout.',
      );
    }
    // Awaited so the session is not ended while the fallback is still running.
    return await fn(null);
  } finally {
    await session.endSession();
  }
}

module.exports = { runInTransaction, isTransactionUnsupported };
