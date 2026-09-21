'use strict';
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { detectLocale } = require('./middleware/locale');
const { apiLimiter } = require('./middleware/rateLimit');
const { t } = require('./i18n');

const app = express();

app.set('trust proxy', 1);

// crossOriginResourcePolicy is relaxed so the SPAs and the Android emulator can
// load product images served from /uploads on a different origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: curl, server-to-server, and the Android OkHttp client.
      if (!origin) return callback(null, true);
      if (env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (!env.isProd && /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin ' + origin + ' is not allowed by CORS'));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(compression());
app.use(mongoSanitize());
app.use(morgan(env.isProd ? 'combined' : 'dev'));

// Sits ahead of every route so handlers, and the error handler, can answer in
// the caller's language. Re-runs after auth on routes that care (see locale.js).
app.use(detectLocale);

app.use('/uploads', express.static(path.resolve(__dirname, '../uploads'), { maxAge: '7d' }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: t('app.name', req.locale),
    data: { version: '1.0.0', docs: env.apiPrefix + '/health' },
  });
});

app.use(env.apiPrefix, apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
