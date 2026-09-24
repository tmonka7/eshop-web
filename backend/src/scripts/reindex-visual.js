'use strict';
/**
 * Rebuilds the DINOv3 image-search index from the command line.
 *
 *   npm run visual:reindex            # only missing or stale vectors
 *   npm run visual:reindex -- --force # re-extract every image
 */
const { connectDB, disconnectDB } = require('../config/db');
const visualSearch = require('../services/visualSearch.service');

async function run() {
  const force = process.argv.includes('--force');
  await connectDB();

  const { job, done } = await visualSearch.reindexAll({ force });
  console.log('[visual] indexing ' + job.total + ' product(s)' + (force ? ' (forced)' : '') + '...');
  await done;

  const status = await visualSearch.status({ detailed: true });
  console.log('[visual] ' + status.vectors + ' vectors for ' + status.model);
  console.log('[visual] products by status:', status.byStatus);

  await disconnectDB();
  process.exit(status.job.failed ? 1 : 0);
}

run().catch(async (err) => {
  console.error('[visual] ' + err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
