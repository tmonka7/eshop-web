import { translate } from '../i18n';
import { getActiveLocale } from '../i18n/activeLocale';
import { INTL_BY_LOCALE, DEFAULT_LOCALE } from '../i18n/constants';

/**
 * Formatting helpers.
 *
 * Prices stay in USD in every language — only the presentation follows the
 * locale, so zh-CN renders "US$1,299.00" and ja-JP "$1,299.00". The locale is
 * read from the active-locale holder rather than passed in, which keeps every
 * `currency(product.price)` call site unchanged; the whole tree re-renders when
 * the language changes, so these always run with the current value.
 */
const intlTag = (locale) => INTL_BY_LOCALE[locale || getActiveLocale()] || INTL_BY_LOCALE[DEFAULT_LOCALE];

/**
 * Formats a price in its product's listing currency.
 *
 * USD goes through Intl as a real currency. REM is not an ISO 4217 code, so
 * Intl would throw on it - it is formatted as a plain grouped number with the
 * code appended, which also makes it visually obvious that the two are not
 * interchangeable.
 */
export const currency = (value, code = 'USD', opts = {}) => {
  const amount = Number(value) || 0;
  if (code === 'REM') {
    const n = new Intl.NumberFormat(intlTag(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...opts,
    }).format(amount);
    return `${n} REM`;
  }
  return new Intl.NumberFormat(intlTag(), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    ...opts,
  }).format(amount);
};

export const compactNumber = (value) =>
  new Intl.NumberFormat(intlTag(), { notation: 'compact', maximumFractionDigits: 1 })
    .format(Number(value) || 0);

export const formatNumber = (value) => new Intl.NumberFormat(intlTag()).format(Number(value) || 0);

// For KPI tiles that count up to a plain integer: the intermediate frames are
// fractional, so they have to be rounded before they are grouped.
export const wholeNumber = (value) => formatNumber(Math.round(Number(value) || 0));

export const formatDate = (value, opts = {}) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(intlTag(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  });
};

export const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString(intlTag(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** "3 days ago" / "3 天前" / "3 日前" — wording comes from the catalogue. */
export const relativeDate = (value) => {
  if (!value) return '-';
  const locale = getActiveLocale();
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return translate(locale, 'date.today');
  if (days === 1) return translate(locale, 'date.yesterday');
  if (days < 30) return translate(locale, 'date.daysAgo', { count: days });
  if (days < 365) return translate(locale, 'date.monthsAgo', { count: Math.floor(days / 30) });
  return translate(locale, 'date.yearsAgo', { count: Math.floor(days / 365) });
};

export const discountPercent = (price, comparePrice) => {
  if (!comparePrice || comparePrice <= price) return 0;
  return Math.round(((comparePrice - price) / comparePrice) * 100);
};

/**
 * Order and payment statuses arrive as snake_case enum values; the catalogue
 * has a translation for each. `namespace` picks which section to read, and an
 * unknown value falls back to a title-cased version so a status added
 * server-side still reads sensibly.
 */
export const statusLabel = (status, namespace = 'orderStatus') => {
  const key = String(status || '');
  if (!key) return '';
  const path = `${namespace}.${key}`;
  const translated = translate(getActiveLocale(), path);
  if (translated !== path) return translated;
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/** Orders arrive with absolute image URLs from the API; guard the empty case. */
export const imageUrl = (src, fallback = '') => {
  if (!src) return fallback;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  const base = import.meta.env.VITE_ASSET_URL || 'http://localhost:5000';
  return `${base}${src.startsWith('/') ? '' : '/'}${src}`;
};
