'use strict';
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const c = require('../controllers/user.controller');
const { LOCALES } = require('../i18n');

const router = express.Router();
router.use(protect);

router.patch('/profile', [body('name').optional().trim().isLength({ min: 2 })], validate, c.updateProfile);
router.post('/avatar', uploadAvatar.single('image'), c.uploadAvatar);
router.patch(
  '/language',
  [body('language').isIn(LOCALES).withMessage('validation.languageEnum')],
  validate,
  c.updateLanguage,
);

const addressRules = [
  body('fullName').trim().notEmpty().withMessage('validation.fullNameRequired'),
  body('street').trim().notEmpty().withMessage('validation.streetRequired'),
  body('city').trim().notEmpty().withMessage('validation.cityRequired'),
  body('zipCode').trim().notEmpty().withMessage('validation.zipRequired'),
  body('country').trim().notEmpty().withMessage('validation.countryRequired'),
];

router.get('/addresses', c.listAddresses);
router.post('/addresses', addressRules, validate, c.addAddress);
router.patch('/addresses/:addressId', c.updateAddress);
router.delete('/addresses/:addressId', c.deleteAddress);
router.patch('/addresses/:addressId/default', c.setDefaultAddress);

router.get('/wishlist', c.getWishlist);
router.post('/wishlist/:productId', c.toggleWishlist);

module.exports = router;
