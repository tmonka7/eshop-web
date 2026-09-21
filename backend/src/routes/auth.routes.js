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
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').optional().trim(),
  ],
  validate,
  c.register,
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
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
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  c.changePassword,
);

module.exports = router;
