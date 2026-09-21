'use strict';
const mongoose = require('mongoose');
const { LOCALES } = require('../i18n');

/**
 * Per-language copy for catalogue documents.
 *
 * Every field is optional: the canonical top-level field (product.name and
 * friends) remains the source of truth and the fallback, so a product with no
 * Japanese translation still renders its English name to a ja visitor.
 * A model only ever sets the keys it has; the rest stay undefined.
 */
const localeCopySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    shortDescription: { type: String, trim: true, maxlength: 300 },
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    ctaText: { type: String, trim: true },
  },
  { _id: false },
);

/** `{ en: <copy>, zh: <copy>, ja: <copy> }`, ready to drop into a schema. */
function translationsField() {
  const shape = {};
  for (const locale of LOCALES) {
    shape[locale] = { type: localeCopySchema, default: () => ({}) };
  }
  return { type: shape, default: () => ({}) };
}

module.exports = { localeCopySchema, translationsField };
