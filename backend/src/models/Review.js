'use strict';
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: '', trim: true, maxlength: 120 },
    comment: { type: String, default: '', trim: true, maxlength: 2000 },
    images: { type: [String], default: [] },
    isApproved: { type: Boolean, default: true, index: true },
    isVerifiedPurchase: { type: Boolean, default: false },
    helpfulCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// One review per user per product.
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Recomputes the denormalised rating/reviewCount on the parent product.
reviewSchema.statics.syncProductRating = async function syncProductRating(productId) {
  const rows = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), isApproved: true } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const agg = rows[0];
  await mongoose.model('Product').findByIdAndUpdate(productId, {
    rating: agg ? Math.round(agg.avg * 10) / 10 : 0,
    reviewCount: agg ? agg.count : 0,
  });
};

module.exports = mongoose.model('Review', reviewSchema);
