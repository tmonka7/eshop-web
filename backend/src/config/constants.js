'use strict';

const ROLES = { CUSTOMER: 'customer', ADMIN: 'admin', MANAGER: 'manager' };

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

module.exports = {
  ROLES,
  ORDER_STATUS,
  ORDER_FLOW,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  PRODUCT_STATUS,
  LOW_STOCK_THRESHOLD,
};
