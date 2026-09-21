'use strict';
const express = require('express');
const mongoose = require('mongoose');
const env = require('../config/env');
const { t, LOCALES, DEFAULT_LOCALE } = require('../i18n');
const { ok } = require('../utils/response');

const router = express.Router();

router.get('/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    message: t('app.healthy', req.locale),
    data: {
      status: 'ok',
      env: env.nodeEnv,
      locale: req.locale,
      database: states[mongoose.connection.readyState] || 'unknown',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Lets any client discover what it can switch to instead of hard-coding the
 * list. Each entry carries the tag, the English name, the endonym for the
 * picker, and the Intl locale the clients format numbers and dates with.
 */
router.get('/languages', (req, res) => {
  const languages = LOCALES.map((tag) => ({
    tag,
    name: t('language.name', tag),
    nativeName: t('language.nativeName', tag),
    intlLocale: t('language.intlLocale', tag),
    isDefault: tag === DEFAULT_LOCALE,
    isCurrent: tag === req.locale,
  }));
  return ok(res, languages, 'success.languages');
});

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/', require('./catalog.routes'));
router.use('/', require('./shop.routes'));
router.use('/admin', require('./admin.routes'));

module.exports = router;
