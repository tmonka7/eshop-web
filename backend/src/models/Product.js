'use strict';
const mongoose = require('mongoose');
const slugify = require('slugify');
const {
  LOW_STOCK_THRESHOLD, PRODUCT_STATUS, CURRENCIES, CURRENCY_VALUES, VISUAL_INDEX_STATUS,
} = require('../config/constants');
const { translationsField } = require('./translations');

const variantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Color"
    value: { type: String, required: true, trim: true }, // e.g. "Red"
    hex: { type: String, default: '' },
    priceDelta: { type: Number, default: 0 },
    stock: { type: Number, default: 0, min: 0 },
  },
  { _id: true },
);

/**
 * The part of one product image that shows the product, as fractions (0..1)
 * of the upright image. `auto` regions come from the detector and are
 * refreshed when it changes; an admin's adjusted region (auto: false) is kept
 * and used as-is for the image-search vector.
 */
const imageRegionSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    w: { type: Number, required: true, min: 0, max: 1 },
    h: { type: Number, required: true, min: 0, max: 1 },
    auto: { type: Boolean, default: true },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160, index: 'text' },
    slug: { type: String, unique: true, index: true },
    sku: { type: String, unique: true, index: true },
    description: { type: String, default: '', trim: true },
    shortDescription: { type: String, default: '', trim: true, maxlength: 300 },
    // Localised name/description/shortDescription; English fields above are the fallback.
    translations: translationsField(),
    brand: { type: String, default: 'Generic', trim: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    images: { type: [String], default: [] },
    imageRegions: { type: [imageRegionSchema], default: [] },
    price: { type: Number, required: true, min: 0, index: true },
    // The currency this product is LISTED in. There is no rate between USD
    // and REM, so a price is only meaningful alongside this field - never
    // compare or sum two products without checking it first.
    currency: { type: String, enum: CURRENCY_VALUES, default: CURRENCIES.USD, index: true },
    comparePrice: { type: Number, default: 0, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    variants: { type: [variantSchema], default: [] },
    tags: { type: [String], default: [], index: true },
    colors: { type: [String], default: [] },
    rating: { type: Number, default: 0, min: 0, max: 5, index: true },
    reviewCount: { type: Number, default: 0, min: 0 },
    soldCount: { type: Number, default: 0, min: 0, index: true },
    viewCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    freeShipping: { type: Boolean, default: false },
    warrantyMonths: { type: Number, default: 12 },
    returnDays: { type: Number, default: 30 },
    // Bookkeeping for image search. The vectors themselves live in
    // ProductEmbedding; this is only what the admin panel needs to show.
    // Written by services/visualSearch.service.js, never from a request body.
    visualIndex: {
      status: {
        type: String,
        enum: Object.values(VISUAL_INDEX_STATUS),
        default: VISUAL_INDEX_STATUS.PENDING,
        index: true,
      },
      model: { type: String, default: '' },
      vectors: { type: Number, default: 0 },
      error: { type: String, default: '' },
      // Region detector the vectors were cropped with ('none' when off).
      detector: { type: String, default: '' },
      indexedAt: { type: Date },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

productSchema.index({ name: 'text', description: 'text', brand: 'text', tags: 'text' });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ createdAt: -1 });

productSchema.pre('validate', function makeSlugAndSku(next) {
  if (this.isModified('name') || !this.slug) {
    const base = slugify(this.name, { lower: true, strict: true });
    // The id suffix keeps the slug unique when two products share a name, and
    // is applied on renames too so an edit can never collide with another row.
    this.slug = `${base}-${String(this._id).slice(-5)}`;
  }
  if (!this.sku) {
    this.sku = `SKU-${String(this._id).slice(-8).toUpperCase()}`;
  }
  next();
});

productSchema.virtual('discountPercent').get(function discountPercent() {
  if (!this.comparePrice || this.comparePrice <= this.price) return 0;
  return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
});

productSchema.virtual('stockStatus').get(function stockStatus() {
  if (this.stock <= 0) return PRODUCT_STATUS.OUT_OF_STOCK;
  if (this.stock <= LOW_STOCK_THRESHOLD) return PRODUCT_STATUS.LOW_STOCK;
  return PRODUCT_STATUS.IN_STOCK;
});

module.exports = mongoose.model('Product', productSchema);
