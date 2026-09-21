'use strict';
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

function notFound(req, _res, next) {
  next(ApiError.notFound('Route ' + req.method + ' ' + req.originalUrl + ' not found'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let error = err;

  if (error.name === 'CastError') {
    error = ApiError.badRequest('Invalid ' + error.path + ': ' + error.value);
  } else if (error.name === 'ValidationError') {
    const details = Object.values(error.errors).map((e) => ({ field: e.path, message: e.message }));
    error = ApiError.unprocessable('Validation failed', details);
  } else if (error.code === 11000) {
    const field = Object.keys(error.keyValue || { field: '' })[0];
    error = ApiError.conflict(field + ' already exists');
  } else if (error.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid token');
  } else if (error.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token expired');
  } else if (error.name === 'MulterError') {
    error = ApiError.badRequest('Upload error: ' + error.message);
  }

  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) console.error('[error]', err);

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(error.details ? { errors: error.details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
