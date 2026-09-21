'use strict';

/**
 * Tiny message catalogue for API responses.
 *
 * Controllers pass dotted keys ('error.productNotFound') instead of English
 * prose; the error handler and the response helpers resolve them against the
 * caller's locale. Anything that is not a known key is emitted verbatim, so
 * dynamic strings and third-party messages still pass through unharmed.
 */

const en = require('./locales/en.json');
const zh = require('./locales/zh.json');
const ja = require('./locales/ja.json');

const CATALOGUES = { en, zh, ja };

const LOCALES = Object.keys(CATALOGUES);
const DEFAULT_LOCALE = 'en';

/** Language tags we accept as aliases for a supported locale. */
const ALIASES = {
  'zh-cn': 'zh',
  'zh-hans': 'zh',
  'zh-sg': 'zh',
  'zh-tw': 'zh',
  'zh-hant': 'zh',
  'zh-hk': 'zh',
  'ja-jp': 'ja',
  'en-us': 'en',
  'en-gb': 'en',
};

/** 'ZH-Hans-CN' -> 'zh'. Returns null when nothing matches. */
function normaliseTag(tag) {
  if (!tag || typeof tag !== 'string') return null;
  const lower = tag.trim().toLowerCase();
  if (!lower) return null;
  if (CATALOGUES[lower]) return lower;
  if (ALIASES[lower]) return ALIASES[lower];
  const primary = lower.split('-')[0];
  return CATALOGUES[primary] ? primary : null;
}

/** Picks the best supported locale from an Accept-Language header value. */
function fromAcceptLanguage(header) {
  if (!header || typeof header !== 'string') return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .filter((p) => p.startsWith('q='))
        .map((p) => Number.parseFloat(p.slice(2)))[0];
      return { tag, q: Number.isFinite(q) ? q : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q);

  for (const entry of ranked) {
    const match = normaliseTag(entry.tag);
    if (match) return match;
  }
  return null;
}

/** First supported locale among the candidates, else DEFAULT_LOCALE. */
function resolveLocale(...candidates) {
  for (const candidate of candidates) {
    const match = normaliseTag(candidate);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

function lookup(catalogue, key) {
  return key.split('.').reduce((node, part) => {
    if (node && typeof node === 'object' && part in node) return node[part];
    return undefined;
  }, catalogue);
}

/** Replaces {{name}} placeholders; a missing param is left as-is. */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name) =>
    (params[name] === undefined || params[name] === null ? whole : String(params[name])),
  );
}

/**
 * Translate `key` into `locale`.
 * Falls back to English, then to the key itself so a missing translation
 * degrades to something readable instead of blowing up mid-request.
 */
function t(key, locale = DEFAULT_LOCALE, params = null) {
  if (typeof key !== 'string' || !key) return key;
  const lang = CATALOGUES[locale] ? locale : DEFAULT_LOCALE;

  let value = lookup(CATALOGUES[lang], key);
  if (typeof value !== 'string' && lang !== DEFAULT_LOCALE) {
    value = lookup(CATALOGUES[DEFAULT_LOCALE], key);
  }
  if (typeof value !== 'string') return interpolate(key, params);

  return interpolate(value, params);
}

/** True when the string is a key we can actually translate. */
function hasKey(key) {
  return typeof key === 'string' && typeof lookup(CATALOGUES[DEFAULT_LOCALE], key) === 'string';
}

module.exports = {
  t,
  hasKey,
  resolveLocale,
  fromAcceptLanguage,
  normaliseTag,
  LOCALES,
  DEFAULT_LOCALE,
};
