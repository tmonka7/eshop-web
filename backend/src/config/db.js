'use strict';
const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDB() {
  mongoose.connection.on('connected', () => console.log('[db] MongoDB connected'));
  mongoose.connection.on('error', (e) => console.error('[db] MongoDB error:', e.message));
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
  });
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB, mongoose };
