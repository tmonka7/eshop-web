'use strict';
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const cart = require('../controllers/cart.controller');
const orders = require('../controllers/order.controller');
const reviews = require('../controllers/review.controller');

const router = express.Router();
router.use(protect);

/* ---------------------------------- cart --------------------------------- */
router.get('/cart', cart.getCart);
router.post(
  '/cart/items',
  [body('productId').isMongoId().withMessage('validation.productIdValid')],
  validate,
  cart.addItem,
);
router.patch('/cart/items/:itemId', cart.updateItem);
router.delete('/cart/items/:itemId', cart.removeItem);
router.delete('/cart', cart.clearCart);
router.post('/cart/coupon', cart.applyCoupon);
router.delete('/cart/coupon', cart.removeCoupon);
router.post('/cart/merge', cart.mergeCart);

/* -------------------------------- checkout ------------------------------- */
router.get('/checkout/preview', orders.preview);
router.post(
  '/orders',
  writeLimiter,
  [body('paymentMethod').notEmpty().withMessage('validation.paymentMethodRequired')],
  validate,
  orders.create,
);
router.get('/orders', orders.myOrders);
router.get('/orders/:id', orders.getOne);
router.get('/orders/:id/track', orders.track);
router.post('/orders/:id/cancel', orders.cancel);

/* --------------------------------- reviews ------------------------------- */
router.post(
  '/reviews',
  writeLimiter,
  [
    body('productId').isMongoId().withMessage('validation.productIdValid'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('validation.ratingRange'),
  ],
  validate,
  reviews.create,
);
router.patch('/reviews/:id', reviews.update);
router.delete('/reviews/:id', reviews.remove);
router.post('/reviews/:id/helpful', reviews.markHelpful);

module.exports = router;
