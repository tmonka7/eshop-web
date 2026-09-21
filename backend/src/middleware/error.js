'use strict';
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { t, hasKey, DEFAULT_LOCALE } = require('../i18n');

function notFound(req, _res, next) {
  next(
    ApiError.notFound('error.routeNotFound', {
      method: req.method,
      url: req.originalUrl,
    }),
  );
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const locale = req.locale || DEFAULT_LOCALE;
  let error = err;

  if (error.name === 'CastError') {
    error = ApiError.badRequest('error.invalidValue', undefined, {
      field: error.path,
      value: error.value,
    });
  } else if (error.name === 'ValidationError') {
    // Mongoose `required: ['validation.x', ...]` messages are keys too.
    const details = Object.values(error.errors).map((e) => ({
      field: e.path,
      message: t(e.message, locale),
    }));
    error = ApiError.unprocessable('error.validationFailed', details);
  } else if (error.code === 11000) {
    const field = Object.keys(error.keyValue || { field: '' })[0];
    error = ApiError.conflict('error.duplicateField', { field });
  } else if (error.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('error.invalidToken');
  } else if (error.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('error.tokenExpired');
  } else if (error.name === 'MulterError') {
    error = ApiError.badRequest('error.uploadError', undefined, { message: error.message });
  }

  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) console.error('[error]', err);

  // A key resolves against the locale; anything else is passed through.
  const key = error.messageKey || (hasKey(error.message) ? error.message : null);
  const message = key
    ? t(key, locale, error.messageParams)
    : error.message || t('error.internal', locale);

  // Detail messages come from express-validator chains, which now carry keys.
  const details = Array.isArray(error.details)
    ? error.details.map((d) =>
        (d && typeof d.message === 'string' ? { ...d, message: t(d.message, locale) } : d))
    : error.details;

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { errors: details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
