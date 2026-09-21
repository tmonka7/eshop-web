'use strict';
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies.accessToken) return req.cookies.accessToken;
  return null;
}

/** Requires a valid access token; attaches req.user. */
const protect = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication token missing');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
    );
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Account is deactivated');

  req.user = user;
  return next();
});

/** Attaches req.user when a token is present, but never rejects. */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.isActive) req.user = user;
  } catch (_err) {
    // Ignored on purpose: this route works fine for anonymous visitors.
  }
  return next();
});

/** Role gate, e.g. restrictTo('admin', 'manager'). */
const restrictTo = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('You do not have permission to perform this action'));
  }
  return next();
};

const adminOnly = restrictTo(ROLES.ADMIN, ROLES.MANAGER);

module.exports = { protect, optionalAuth, restrictTo, adminOnly };
