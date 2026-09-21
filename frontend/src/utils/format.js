export const currency = (value, opts = {}) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    ...opts,
  }).format(Number(value) || 0);

export const compactNumber = (value) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number(value) || 0,
  );

export const formatDate = (value, opts = {}) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  });
};

export const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const relativeDate = (value) => {
  if (!value) return '-';
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
};

export const discountPercent = (price, comparePrice) => {
  if (!comparePrice || comparePrice <= price) return 0;
  return Math.round(((comparePrice - price) / comparePrice) * 100);
};

export const statusLabel = (status) =>
  String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Orders arrive with absolute image URLs from the API; guard the empty case. */
export const imageUrl = (src, fallback = '') => {
  if (!src) return fallback;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  const base = import.meta.env.VITE_ASSET_URL || 'http://localhost:5000';
  return `${base}${src.startsWith('/') ? '' : '/'}${src}`;
};
