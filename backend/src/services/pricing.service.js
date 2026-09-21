'use strict';
const env = require('../config/env');
const { round2 } = require('../utils/money');

/**
 * Single source of truth for order maths. The cart, the checkout preview and the
 * order creation all call this so the three totals can never disagree.
 */
function computeTotals(items, { discount = 0, freeShipping = false } = {}) {
  const subtotal = round2(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const cappedDiscount = round2(Math.min(discount, subtotal));
  const taxable = round2(subtotal - cappedDiscount);

  const everyItemShipsFree = items.length > 0 && items.every((i) => i.freeShipping);
  const qualifies = freeShipping
    || everyItemShipsFree
    || taxable >= env.commerce.freeShippingThreshold
    || taxable === 0;

  const shipping = qualifies ? 0 : round2(env.commerce.shippingFlatRate);
  const tax = round2(taxable * env.commerce.taxRate);
  const total = round2(taxable + shipping + tax);

  return { subtotal, discount: cappedDiscount, shipping, tax, total };
}

const shippingRules = () => ({
  freeShippingThreshold: env.commerce.freeShippingThreshold,
  flatRate: env.commerce.shippingFlatRate,
  taxRate: env.commerce.taxRate,
});

module.exports = { computeTotals, shippingRules };
