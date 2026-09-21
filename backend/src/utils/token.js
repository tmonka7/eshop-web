'use strict';
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, email: user.email },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpires },
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: String(user._id), type: 'refresh' }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

function issueTokens(user) {
  return { accessToken: signAccessToken(user), refreshToken: signRefreshToken(user) };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokens,
};
