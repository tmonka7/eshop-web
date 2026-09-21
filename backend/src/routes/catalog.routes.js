'use strict';
const express = require('express');
const { optionalAuth } = require('../middleware/auth');
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
router.get('/products/:slug', optionalAuth, products.getBySlug);
router.get('/products/:slug/related', products.related);
router.get('/products/:slug/reviews', reviews.listForProduct);
router.get('/products/:slug/reviews/summary', reviews.summaryForProduct);

/* merchandising */
router.get('/banners', banners.list);
router.get('/promotions', coupons.listPublic);
router.get('/coupons/validate', coupons.validate);

module.exports = router;
