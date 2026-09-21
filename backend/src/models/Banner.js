'use strict';
const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '', trim: true },
    image: { type: String, default: '' },
    ctaText: { type: String, default: 'Shop Now' },
    ctaLink: { type: String, default: '/products' },
    placement: { type: String, enum: ['hero', 'promo', 'mobile'], default: 'hero', index: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Banner', bannerSchema);
