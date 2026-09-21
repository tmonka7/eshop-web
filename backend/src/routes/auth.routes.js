'use strict';
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const c = require('../controllers/auth.controller');

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('validation.nameLength'),
    body('email').isEmail().withMessage('validation.emailValid').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('validation.passwordMin'),
    body('phone').optional().trim(),
  ],
  validate,
  c.register,
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('validation.emailValid'),
    body('password').notEmpty().withMessage('validation.passwordRequired'),
  ],
  validate,
  c.login,
);

router.post('/refresh', c.refresh);
router.post('/logout', protect, c.logout);
router.get('/me', protect, c.me);

router.patch(
  '/password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('validation.currentPasswordRequired'),
    body('newPassword').isLength({ min: 6 }).withMessage('validation.newPasswordMin'),
  ],
  validate,
  c.changePassword,
);

module.exports = router;
