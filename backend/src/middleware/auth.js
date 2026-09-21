'use strict';
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');
const { ROLES } = require('../config/constants');
const { applyUserLocale } = require('./locale');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies.accessToken) return req.cookies.accessToken;
  return null;
}

/** Requires a valid access token; attaches req.user. */
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('error.authTokenMissing');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
    );
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('error.userGone');
  if (!user.isActive) throw ApiError.forbidden('error.accountDeactivated');

  req.user = user;
  // Now that we know who is calling, their saved language can take effect.
  applyUserLocale(req, res);
  return next();
});

/** Attaches req.user when a token is present, but never rejects. */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.isActive) {
      req.user = user;
      applyUserLocale(req, res);
    }
  } catch (_err) {
    // Ignored on purpose: this route works fine for anonymous visitors.
  }
  return next();
});

/** Role gate, e.g. restrictTo('admin', 'manager'). */
const restrictTo = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('error.noPermission'));
  }
  return next();
};

const adminOnly = restrictTo(ROLES.ADMIN, ROLES.MANAGER);

module.exports = { protect, optionalAuth, restrictTo, adminOnly };
