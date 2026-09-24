'use strict';

/**
 * SUPER_ADMIN sits above ADMIN: it is the only role that may manage other
 * staff accounts. Existing `admin` accounts keep every other power they had,
 * so adding the tier does not demote anyone by accident - the seed promotes
 * the original admin account explicitly.
 */
const ROLES = {
  CUSTOMER: 'customer',
  MANAGER: 'manager',
  ADMIN: 'admin',
  SUPER_ADMIN: 'superadmin',
};

/** Roles that may sign in to the admin panel at all. */
const STAFF_ROLES = [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN];

/**
 * Fine-grained permissions a super admin can grant to a staff account.
 *
 * These gate admin-panel sections. A super admin implicitly holds all of
 * them - the check is "is super admin OR has the permission" - so the list is
 * only ever consulted for the roles below it.
 */
const PERMISSIONS = {
  PRODUCTS: 'products',
  ORDERS: 'orders',
  CUSTOMERS: 'customers',
  REVIEWS: 'reviews',
  CONTENT: 'content',
  REPORTS: 'reports',
  SETTINGS: 'settings',
};

const PERMISSION_VALUES = Object.values(PERMISSIONS);

/**
 * Listing currencies. REM is not an ISO 4217 code and no exchange rate exists
 * between the two, so they are separate price universes rather than two views
 * of one number - see the cart's single-currency guard.
 */
const CURRENCIES = { USD: 'USD', REM: 'REM' };
const CURRENCY_VALUES = Object.values(CURRENCIES);

const ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

/** Allowed forward transitions for admin status updates. */
const ORDER_FLOW = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

const PAYMENT_METHODS = ['card', 'paypal', 'applepay', 'cod'];

const PRODUCT_STATUS = { IN_STOCK: 'in_stock', LOW_STOCK: 'low_stock', OUT_OF_STOCK: 'out_of_stock' };

const LOW_STOCK_THRESHOLD = 10;

/** Where a product stands in the DINOv3 image-search index. */
const VISUAL_INDEX_STATUS = {
  PENDING: 'pending', // never indexed, or its images changed since
  INDEXED: 'indexed', // every image has a feature vector
  PARTIAL: 'partial', // some images could not be read
  FAILED: 'failed', // none of its images could be read
  NO_IMAGES: 'no_images',
  UNAVAILABLE: 'unavailable', // the model files are missing on this host
};

module.exports = {
  ROLES,
  STAFF_ROLES,
  PERMISSIONS,
  PERMISSION_VALUES,
  CURRENCIES,
  CURRENCY_VALUES,
  ORDER_STATUS,
  ORDER_FLOW,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  PRODUCT_STATUS,
  LOW_STOCK_THRESHOLD,
  VISUAL_INDEX_STATUS,
};
