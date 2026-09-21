'use strict';
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');
const { rawTranslations } = require('../middleware/locale');
const { CURRENCY_VALUES } = require('../config/constants');
const { uploadProduct, uploadBanner } = require('../middleware/upload');
const admin = require('../controllers/admin.controller');
const products = require('../controllers/product.controller');
const categories = require('../controllers/category.controller');
const orders = require('../controllers/order.controller');
const reviews = require('../controllers/review.controller');
const coupons = require('../controllers/coupon.controller');
const banners = require('../controllers/banner.controller');
const uploads = require('../controllers/upload.controller');
const staff = require('../controllers/staff.controller');

const router = express.Router();
router.use(protect, adminOnly, rawTranslations);

/* ------------------------- administrators (super admin) ------------------- */
/* Mounted before the dashboard block so the extra gate is impossible to miss
   when scanning this file. Every route here needs the super-admin tier. */
const staffRules = [
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
];

router.get('/staff/options', superAdminOnly, staff.options);
router.get('/staff', superAdminOnly, staff.list);
router.post('/staff', superAdminOnly, staffRules, validate, staff.create);
router.get('/staff/:id', superAdminOnly, staff.getOne);
router.patch('/staff/:id', superAdminOnly, staff.update);
router.delete('/staff/:id', superAdminOnly, staff.remove);

/* ------------------------------- dashboard ------------------------------- */
router.get('/dashboard/stats', admin.stats);
router.get('/dashboard/sales-overview', admin.salesOverview);
router.get('/dashboard/sales-by-category', admin.salesByCategory);
router.get('/dashboard/customer-growth', admin.customerGrowth);
router.get('/dashboard/recent-orders', admin.recentOrders);
router.get('/dashboard/top-products', admin.topProducts);

/* -------------------------------- products ------------------------------- */
const productRules = [
  body('name').trim().isLength({ min: 2 }).withMessage('validation.productNameRequired'),
  body('price').isFloat({ min: 0 }).withMessage('validation.priceMin'),
  body('category').isMongoId().withMessage('validation.categoryValid'),
  body('stock').optional().isInt({ min: 0 }).withMessage('validation.stockMin'),
  // Explicit, so a bad value is a clear 400 rather than a Mongoose cast error.
  body('currency').optional().isIn(CURRENCY_VALUES).withMessage('validation.currencyValid'),
];

router.get('/products', products.adminList);
router.post('/products', productRules, validate, products.create);
router.patch('/products/:id', products.update);
router.patch('/products/:id/status', products.toggleActive);
router.patch('/products/:id/stock', products.updateStock);
router.delete('/products/:id', products.remove);

/* ------------------------------- categories ------------------------------ */
router.post(
  '/categories',
  [body('name').trim().isLength({ min: 2 }).withMessage('validation.categoryNameRequired')],
  validate,
  categories.create,
);
router.patch('/categories/:id', categories.update);
router.delete('/categories/:id', categories.remove);

/* --------------------------------- orders -------------------------------- */
router.get('/orders', orders.adminList);
router.get('/orders/:id', orders.adminGetOne);
router.patch(
  '/orders/:id/status',
  [body('status').notEmpty().withMessage('validation.statusRequired')],
  validate,
  orders.updateStatus,
);
router.patch('/orders/:id/tracking', orders.updateTracking);

/* ------------------------------- customers ------------------------------- */
router.get('/customers', admin.listCustomers);
router.get('/customers/export', admin.exportCustomers);
router.get('/customers/:id', admin.getCustomer);
router.patch('/customers/:id/status', admin.toggleCustomerActive);

/* ------------------------------- inventory ------------------------------- */
router.get('/inventory/alerts', admin.inventoryAlerts);

/* --------------------------------- reviews ------------------------------- */
router.get('/reviews', reviews.adminList);
router.patch('/reviews/:id/moderate', reviews.moderate);
router.delete('/reviews/:id', reviews.remove);

/* -------------------------------- promotions ----------------------------- */
router.get('/coupons', coupons.adminList);
router.post(
  '/coupons',
  [
    body('code').trim().isLength({ min: 3 }).withMessage('validation.couponCodeRequired'),
    body('discountType').isIn(['percent', 'fixed']).withMessage('validation.discountTypeEnum'),
    body('discountValue').isFloat({ min: 0 }).withMessage('validation.discountValueMin'),
  ],
  validate,
  coupons.create,
);
router.patch('/coupons/:id', coupons.update);
router.delete('/coupons/:id', coupons.remove);

/* --------------------------------- content ------------------------------- */
router.get('/banners', banners.adminList);
router.post('/banners', [body('title').trim().notEmpty()], validate, banners.create);
router.patch('/banners/:id', banners.update);
router.delete('/banners/:id', banners.remove);

/* --------------------------------- uploads ------------------------------- */
router.post('/uploads/products', uploadProduct.array('images', 8), uploads.uploadImages('products'));
router.post('/uploads/banners', uploadBanner.single('image'), uploads.uploadImages('banners'));
router.delete('/uploads/:folder/:filename', uploads.deleteImage);

module.exports = router;
