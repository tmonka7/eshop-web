'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const int = (v, d) => (v === undefined || v === '' ? d : Number.parseInt(v, 10));
const float = (v, d) => (v === undefined || v === '' ? d : Number.parseFloat(v));
const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v));

const BACKEND_ROOT = path.resolve(__dirname, '../..');

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
  // Image search. The DINOv3 ONNX model is read from disk and never fetched at
  // runtime, so the feature works on an air-gapped host (see ml/README.md).
  visualSearch: {
    enabled: bool(process.env.VISUAL_SEARCH_ENABLED, true),
    modelDir: path.resolve(BACKEND_ROOT, process.env.VISUAL_SEARCH_MODEL_DIR || 'ml/dinov3-vits16'),
    modelFile: process.env.VISUAL_SEARCH_MODEL_FILE || 'model.onnx',
    // 0 lets onnxruntime pick (one thread per physical core).
    threads: int(process.env.VISUAL_SEARCH_THREADS, 0),
    minScore: float(process.env.VISUAL_SEARCH_MIN_SCORE, 0.25),
    // Index products that are still pending once the API has booted.
    indexOnBoot: bool(process.env.VISUAL_SEARCH_INDEX_ON_BOOT, true),
    // Product images hosted elsewhere are only downloaded when this is on;
    // files under /uploads are always read straight from disk.
    fetchRemote: bool(process.env.VISUAL_SEARCH_FETCH_REMOTE, false),
    // Find the product inside a photo (green box) and embed only that area,
    // for both shopper photos and catalogue images. See regionDetect.js.
    detect: bool(process.env.VISUAL_SEARCH_DETECT, true),
    // Longest side, in pixels, the photo is scaled to for detection.
    detectSide: int(process.env.VISUAL_SEARCH_DETECT_SIDE, 448),
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@auramart.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  },
};

env.isProd = env.nodeEnv === 'production';
module.exports = env;
