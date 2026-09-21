'use strict';
const { PAYMENT_STATUS } = require('../config/constants');

/**
 * Mock payment gateway. It mimics the shape of a Stripe/PayPal charge so the
 * checkout flow is end-to-end runnable without external credentials. Swap the
 * body of `charge` for a real SDK call when you go live.
 */
async function charge({ method, amount, card = {} }) {
  if (method === 'cod') {
    return {
      status: PAYMENT_STATUS.UNPAID,
      transactionId: '',
      cardLast4: '',
      paidAt: null,
      message: 'Payment will be collected on delivery',
    };
  }

  if (method === 'card') {
    const number = String(card.number || '').replace(/\D/g, '');
    if (number.length < 12) {
      return { status: PAYMENT_STATUS.FAILED, message: 'Invalid card number' };
    }
    // Test hook: any card ending 0000 simulates a decline.
    if (number.endsWith('0000')) {
      return { status: PAYMENT_STATUS.FAILED, message: 'Card was declined by the issuer' };
    }
    return {
      status: PAYMENT_STATUS.PAID,
      transactionId: 'txn_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      cardLast4: number.slice(-4),
      paidAt: new Date(),
      message: 'Payment captured (' + amount.toFixed(2) + ')',
    };
  }

  // paypal / applepay: treated as an approved redirect flow.
  return {
    status: PAYMENT_STATUS.PAID,
    transactionId: method + '_' + Date.now().toString(36),
    cardLast4: '',
    paidAt: new Date(),
    message: 'Payment approved via ' + method,
  };
}

async function refund(order) {
  if (order.payment.status !== PAYMENT_STATUS.PAID) {
    return { status: order.payment.status, message: 'Nothing to refund' };
  }
  return {
    status: PAYMENT_STATUS.REFUNDED,
    message: 'Refunded ' + order.pricing.total.toFixed(2),
  };
}

module.exports = { charge, refund };
