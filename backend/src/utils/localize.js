'use strict';
const { DEFAULT_LOCALE, LOCALES } = require('../i18n');

/**
 * Catalogue content (product names, category blurbs, banner copy) is stored as
 * a `translations.{en,zh,ja}` sub-document alongside the canonical English
 * fields. This module folds the right language into the flat fields on the way
 * out, so clients keep seeing `{ name, description }` and never have to know
 * the storage shape.
 *
 * The canonical field stays the fallback: an untranslated product still shows
 * its English name rather than an empty string.
 */
const TRANSLATABLE_FIELDS = ['name', 'description', 'shortDescription', 'title', 'subtitle', 'ctaText'];

/** Builds the `translations` sub-document from a request body. */
function buildTranslations(input, existing = {}) {
  const out = {};
  for (const locale of LOCALES) {
    const incoming = (input && input[locale]) || {};
    const current = (existing && existing[locale]) || {};
    const merged = {};
    for (const field of TRANSLATABLE_FIELDS) {
      const value = incoming[field] !== undefined ? incoming[field] : current[field];
      if (typeof value === 'string') merged[field] = value.trim();
    }
    if (Object.keys(merged).length) out[locale] = merged;
  }
  return out;
}

/** True for plain data objects we should walk into. */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Recursively folds `translations` into the flat fields.
 * `node` must already be plain JSON (see localizePayload).
 */
function foldNode(node, locale) {
  if (Array.isArray(node)) return node.map((item) => foldNode(item, locale));
  if (!isPlainObject(node)) return node;

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'translations') continue; // handled below, never leaked
    out[key] = foldNode(value, locale);
  }

  const translations = node.translations;
  if (isPlainObject(translations)) {
    const preferred = translations[locale];
    const fallback = translations[DEFAULT_LOCALE];
    for (const field of TRANSLATABLE_FIELDS) {
      const value =
        (isPlainObject(preferred) && preferred[field]) ||
        (isPlainObject(fallback) && fallback[field]) ||
        undefined;
      // Only override when a translation exists; otherwise keep the canonical
      // field the document already carries.
      if (typeof value === 'string' && value) out[field] = value;
    }
    out.locale = locale;
  }

  return out;
}

/**
 * Entry point used by the response helpers.
 * Serialises through toJSON first so mongoose documents, lean results and
 * aggregation rows all arrive as the same plain shape.
 */
function localizePayload(data, locale = DEFAULT_LOCALE) {
  if (data === null || data === undefined || typeof data !== 'object') return data;
  const plain = JSON.parse(JSON.stringify(data));
  return foldNode(plain, locale);
}

/**
 * Reads one translated field off a single document.
 * For the handful of places that build plain strings by hand (chart labels,
 * CSV cells, order line-item snapshots) rather than returning a document.
 */
function pickTranslated(doc, field, locale = DEFAULT_LOCALE) {
  if (!doc) return '';
  const translations = doc.translations;
  if (isPlainObject(translations)) {
    const preferred = translations[locale];
    if (isPlainObject(preferred) && preferred[field]) return preferred[field];
    const fallback = translations[DEFAULT_LOCALE];
    if (isPlainObject(fallback) && fallback[field]) return fallback[field];
  }
  return doc[field] || '';
}

module.exports = { localizePayload, buildTranslations, pickTranslated, TRANSLATABLE_FIELDS };
