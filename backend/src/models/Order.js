'use strict';
const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHODS } = require('../config/constants');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Denormalised so historical orders stay readable after a product is edited or removed.
    name: { type: String, required: true },
    image: { type: String, default: '' },
    sku: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    variant: {
      name: { type: String, default: '' },
      value: { type: String, default: '' },
    },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(ORDER_STATUS), required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, default: '' },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, default: '' },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    payment: {
      method: { type: String, enum: PAYMENT_METHODS, required: true },
      status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.UNPAID, index: true },
      transactionId: { type: String, default: '' },
      cardLast4: { type: String, default: '' },
      paidAt: { type: Date, default: null },
    },
    pricing: {
      subtotal: { type: Number, required: true, min: 0 },
      shipping: { type: Number, required: true, min: 0, default: 0 },
      tax: { type: Number, required: true, min: 0, default: 0 },
      discount: { type: Number, required: true, min: 0, default: 0 },
      total: { type: Number, required: true, min: 0 },
    },
    couponCode: { type: String, default: '' },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    timeline: { type: [timelineSchema], default: [] },
    trackingNumber: { type: String, default: '' },
    carrier: { type: String, default: 'UPS' },
    estimatedDelivery: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });

orderSchema.virtual('itemCount').get(function itemCount() {
  return this.items.reduce((n, i) => n + i.quantity, 0);
});

module.exports = mongoose.model('Order', orderSchema);
