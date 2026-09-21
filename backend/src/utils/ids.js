'use strict';
const { customAlphabet } = require('nanoid');

const digits = customAlphabet('0123456789', 6);
const upper = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

/** Human friendly order number, e.g. ORD123456. */
const orderNumber = () => `ORD${digits()}`;
/** Carrier-style tracking number, e.g. AM-8KQ2R7XD4M. */
const trackingNumber = () => `AM-${upper()}`;
/** Short SKU suffix. */
const skuSuffix = () => upper().slice(0, 6);

module.exports = { orderNumber, trackingNumber, skuSuffix };
