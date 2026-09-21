'use strict';
const { hasKey } = require('../i18n');

/**
 * Operational error with a translatable message.
 *
 * `message` may be either a catalogue key ('error.productNotFound') or plain
 * prose. Keys are resolved against the request locale in the error handler;
 * anything else is passed through untouched, so third-party and dynamic
 * messages keep working. `params` feeds {{placeholders}} in the template.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = undefined, params = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    // Only remember it as a key when the catalogue can actually resolve it.
    this.messageKey = hasKey(message) ? message : null;
    this.messageParams = params;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'error.badRequest', details, params) {
    return new ApiError(400, msg, details, params);
  }

  static unauthorized(msg = 'error.unauthorized', params) {
    return new ApiError(401, msg, undefined, params);
  }

  static forbidden(msg = 'error.forbidden', params) {
    return new ApiError(403, msg, undefined, params);
  }

  static notFound(msg = 'error.notFound', params) {
    return new ApiError(404, msg, undefined, params);
  }

  static conflict(msg = 'error.conflict', params) {
    return new ApiError(409, msg, undefined, params);
  }

  static unprocessable(msg = 'error.unprocessable', details, params) {
    return new ApiError(422, msg, details, params);
  }

  static internal(msg = 'error.internal', params) {
    return new ApiError(500, msg, undefined, params);
  }
}

module.exports = ApiError;
