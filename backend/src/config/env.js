'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const int = (v, d) => (v === undefined || v === '' ? d : Number.parseInt(v, 10));
const float = (v, d) => (v === undefined || v === '' ? d : Number.parseFloat(v));

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 5000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auramart',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  },
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:5000').replace(/\/+$/, ''),
  uploadMaxBytes: int(process.env.UPLOAD_MAX_MB, 5) * 1024 * 1024,
  commerce: {
    freeShippingThreshold: float(process.env.FREE_SHIPPING_THRESHOLD, 50),
    shippingFlatRate: float(process.env.SHIPPING_FLAT_RATE, 9.99),
    taxRate: float(process.env.TAX_RATE, 0.1),
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@auramart.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  },
};

env.isProd = env.nodeEnv === 'production';
module.exports = env;
