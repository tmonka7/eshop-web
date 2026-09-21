'use strict';
const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Runs after express-validator chains and converts failures into a 422. */
function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((e) => ({ field: e.path || e.param, message: e.msg }));
  return next(ApiError.unprocessable('Validation failed', details));
}

module.exports = validate;
