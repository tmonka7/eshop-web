'use strict';
const env = require('./config/env');
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

let server;

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('[boot] Could not connect to MongoDB:', err.message);
    console.error('[boot] Is mongod running? MONGO_URI =', env.mongoUri);
    process.exit(1);
  }

  server = app.listen(env.port, () => {
    console.log('');
    console.log('  AuraMart API');
    console.log('  env      : ' + env.nodeEnv);
    console.log('  listening: http://localhost:' + env.port);
    console.log('  health   : http://localhost:' + env.port + env.apiPrefix + '/health');
    console.log('');
  });
}

async function shutdown(signal) {
  console.log('\n[shutdown] ' + signal + ' received, closing gracefully...');
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
  process.exit(0);
}

['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught exception:', err);
  process.exit(1);
});

start();
