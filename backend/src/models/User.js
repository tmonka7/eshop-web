'use strict';
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');
const { LOCALES, DEFAULT_LOCALE } = require('../i18n');

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Home', trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true, default: '' },
    zipCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'Finland' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'validation.nameLength'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'validation.emailValid'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, trim: true, default: '' },
    avatar: { type: String, default: '' },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER, index: true },
    isActive: { type: Boolean, default: true },
    addresses: { type: [addressSchema], default: [] },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    refreshTokens: { type: [String], default: [], select: false },
    language: { type: String, enum: LOCALES, default: DEFAULT_LOCALE },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

// Exactly one default address per user.
userSchema.pre('save', function normaliseAddresses(next) {
  if (this.isModified('addresses') && this.addresses.length) {
    const defaults = this.addresses.filter((a) => a.isDefault);
    if (defaults.length === 0) {
      this.addresses[0].isDefault = true;
    } else if (defaults.length > 1) {
      const keep = defaults[defaults.length - 1]._id.toString();
      this.addresses.forEach((a) => {
        a.isDefault = a._id.toString() === keep;
      });
    }
  }
  next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.virtual('defaultAddress').get(function defaultAddress() {
  return this.addresses.find((a) => a.isDefault) || this.addresses[0] || null;
});

module.exports = mongoose.model('User', userSchema);
