'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { issueTokens, verifyRefreshToken } = require('../utils/token');
const User = require('../models/User');
const Cart = require('../models/Cart');

/** Keeps at most 5 live sessions per user. */
async function persistRefreshToken(userId, token) {
  await User.findByIdAndUpdate(userId, {
    $push: { refreshTokens: { $each: [token], $slice: -5 } },
  });
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw ApiError.conflict('error.emailExists');

  const user = await User.create({ name, email, password, phone });
  await Cart.create({ user: user._id, items: [] });

  const tokens = issueTokens(user);
  await persistRefreshToken(user._id, tokens.refreshToken);
  user.lastLoginAt = new Date();
  await user.save();

  return created(res, { user: user.toJSON(), ...tokens }, 'success.accountCreated');
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('error.incorrectCredentials');
  }
  if (!user.isActive) throw ApiError.forbidden('error.accountDeactivated');

  const tokens = issueTokens(user);
  await persistRefreshToken(user._id, tokens.refreshToken);
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  await Cart.findOneAndUpdate(
    { user: user._id },
    { $setOnInsert: { user: user._id, items: [] } },
    { upsert: true },
  );

  return ok(res, { user: user.toJSON(), ...tokens }, 'success.signedIn');
});

exports.refresh = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || (req.cookies && req.cookies.refreshToken);
  if (!token) throw ApiError.unauthorized('error.refreshMissing');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (_err) {
    throw ApiError.unauthorized('error.refreshInvalid');
  }

  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(token)) {
    throw ApiError.unauthorized('error.refreshRevoked');
  }

  const tokens = issueTokens(user);
  // Rotate: drop the used token, store the new one.
  user.refreshTokens = user.refreshTokens.filter((t) => t !== token).concat(tokens.refreshToken).slice(-5);
  await user.save({ validateBeforeSave: false });

  return ok(res, tokens, 'success.tokenRefreshed');
});

exports.logout = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken;
  if (token) {
    await User.findByIdAndUpdate(req.user._id, { $pull: { refreshTokens: token } });
  } else {
    await User.findByIdAndUpdate(req.user._id, { $set: { refreshTokens: [] } });
  }
  return ok(res, null, 'success.signedOut');
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist', 'name slug price images rating translations');
  return ok(res, user, 'success.currentUser');
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('error.currentPasswordIncorrect');
  }
  user.password = newPassword;
  user.refreshTokens = [];
  await user.save();
  return ok(res, null, 'success.passwordUpdated');
});
