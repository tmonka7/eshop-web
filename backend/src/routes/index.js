'use strict';
const express = require('express');
const mongoose = require('mongoose');
const env = require('../config/env');

const router = express.Router();

router.get('/health', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    message: 'AuraMart API is running',
    data: {
      status: 'ok',
      env: env.nodeEnv,
      database: states[mongoose.connection.readyState] || 'unknown',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/', require('./catalog.routes'));
router.use('/', require('./shop.routes'));
router.use('/admin', require('./admin.routes'));

module.exports = router;
