'use strict';
const mongoose = require('mongoose');
const slugify = require('slugify');
const { LOW_STOCK_THRESHOLD, PRODUCT_STATUS } = require('../config/constants');
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
    price: { type: Number, required: true, min: 0, index: true },
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
