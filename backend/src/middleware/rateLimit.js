'use strict';
const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  // Rate limiting gets in the way while developing against the seeded data.
  skip: () => !env.isProd,
  message: { success: false, message: 'Too many requests, please try again later' },
};

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, ...common });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, ...common });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, ...common });

module.exports = { apiLimiter, authLimiter, writeLimiter };
