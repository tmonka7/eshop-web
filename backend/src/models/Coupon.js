'use strict';
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, default: '' },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minPurchase: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

couponSchema.methods.isRedeemable = function isRedeemable(subtotal) {
  const now = new Date();
  if (!this.isActive) return { ok: false, reason: 'Coupon is inactive' };
  if (this.startsAt && now < this.startsAt) return { ok: false, reason: 'Coupon is not active yet' };
  if (this.expiresAt && now > this.expiresAt) return { ok: false, reason: 'Coupon has expired' };
  if (this.usageLimit > 0 && this.usedCount >= this.usageLimit) {
    return { ok: false, reason: 'Coupon usage limit reached' };
  }
  if (subtotal < this.minPurchase) {
    return { ok: false, reason: 'Minimum purchase of ' + this.minPurchase.toFixed(2) + ' required' };
  }
  return { ok: true };
};

couponSchema.methods.computeDiscount = function computeDiscount(subtotal) {
  let d = this.discountType === 'percent' ? (subtotal * this.discountValue) / 100 : this.discountValue;
  if (this.maxDiscount > 0) d = Math.min(d, this.maxDiscount);
  return Math.min(Math.round(d * 100) / 100, subtotal);
};

module.exports = mongoose.model('Coupon', couponSchema);
