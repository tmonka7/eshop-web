'use strict';
const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { uploadSearchImage } = require('../middleware/upload');
const { visualSearchLimiter } = require('../middleware/rateLimit');
const products = require('../controllers/product.controller');
const categories = require('../controllers/category.controller');
const reviews = require('../controllers/review.controller');
const banners = require('../controllers/banner.controller');
const coupons = require('../controllers/coupon.controller');

const router = express.Router();

/* categories */
router.get('/categories', categories.list);
router.get('/categories/tree', categories.tree);
router.get('/categories/:slug', categories.getBySlug);

/* products */
router.get('/products', products.list);
router.get('/products/filters', products.filters);
router.get('/products/featured', products.featured);
router.get('/products/best-sellers', products.bestSellers);
// Image search: declared before /products/:slug so the paths never collide.
router.get('/products/visual-search/status', products.visualSearchStatus);
router.post(
  '/products/visual-search',
  visualSearchLimiter,
  uploadSearchImage.single('image'),
  products.visualSearch,
);
router.post('/products/visual-search/vector', visualSearchLimiter, products.visualSearchByVector);
router.get('/products/:slug', optionalAuth, products.getBySlug);
router.get('/products/:slug/related', products.related);
router.get('/products/:slug/reviews', reviews.listForProduct);
router.get('/products/:slug/reviews/summary', reviews.summaryForProduct);

/* merchandising */
router.get('/banners', banners.list);
router.get('/promotions', coupons.listPublic);
router.get('/coupons/validate', coupons.validate);

module.exports = router;
