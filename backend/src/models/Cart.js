'use strict';
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    variant: {
      name: { type: String, default: '' },
      value: { type: String, default: '' },
      hex: { type: String, default: '' },
      priceDelta: { type: Number, default: 0 },
    },
    // Snapshot so the cart survives a price change mid-session; refreshed on read.
    priceAtAdd: { type: Number, required: true, min: 0 },
  },
  { _id: true, timestamps: true },
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: { type: [cartItemSchema], default: [] },
    coupon: {
      code: { type: String, default: '' },
      discountType: { type: String, enum: ['percent', 'fixed', ''], default: '' },
      discountValue: { type: Number, default: 0 },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

module.exports = mongoose.model('Cart', cartSchema);
