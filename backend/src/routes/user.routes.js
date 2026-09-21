'use strict';
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const c = require('../controllers/user.controller');

const router = express.Router();
router.use(protect);

router.patch('/profile', [body('name').optional().trim().isLength({ min: 2 })], validate, c.updateProfile);
router.post('/avatar', uploadAvatar.single('image'), c.uploadAvatar);

const addressRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('street').trim().notEmpty().withMessage('Street address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('zipCode').trim().notEmpty().withMessage('Zip / postal code is required'),
  body('country').trim().notEmpty().withMessage('Country is required'),
];

router.get('/addresses', c.listAddresses);
router.post('/addresses', addressRules, validate, c.addAddress);
router.patch('/addresses/:addressId', c.updateAddress);
router.delete('/addresses/:addressId', c.deleteAddress);
router.patch('/addresses/:addressId/default', c.setDefaultAddress);

router.get('/wishlist', c.getWishlist);
router.post('/wishlist/:productId', c.toggleWishlist);

module.exports = router;
