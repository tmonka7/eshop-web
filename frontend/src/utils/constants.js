/**
 * Option lists carry catalogue keys rather than English labels; the components
 * that render them resolve the key with `t()`. Keeping the `value` as the wire
 * format means nothing about the API contract changes when a language does.
 */
export const ORDER_STATUS_META = {
  pending: { labelKey: 'orderStatus.pending', tone: 'warn' },
  processing: { labelKey: 'orderStatus.processing', tone: 'info' },
  shipped: { labelKey: 'orderStatus.shipped', tone: 'purple' },
  delivered: { labelKey: 'orderStatus.delivered', tone: 'ok' },
  cancelled: { labelKey: 'orderStatus.cancelled', tone: 'danger' },
};

export const SORT_OPTIONS = [
  { value: 'best_selling', labelKey: 'sort.best_selling' },
  { value: 'newest', labelKey: 'sort.newest' },
  { value: 'price_asc', labelKey: 'sort.price_asc' },
  { value: 'price_desc', labelKey: 'sort.price_desc' },
  { value: 'rating', labelKey: 'sort.rating' },
  { value: 'name_asc', labelKey: 'sort.name_asc' },
];

export const PAYMENT_METHODS = [
  { value: 'card', labelKey: 'payment.card', hintKey: 'payment.cardHint' },
  { value: 'paypal', labelKey: 'payment.paypal', hintKey: 'payment.paypalHint' },
  { value: 'applepay', labelKey: 'payment.applepay', hintKey: 'payment.applepayHint' },
  { value: 'cod', labelKey: 'payment.cod', hintKey: 'payment.codHint' },
];

// Swatch keys are the colour values stored on the product, not display copy.
export const COLOR_SWATCHES = {
  Black: '#111827',
  White: '#F3F4F6',
  Red: '#EF4444',
  Blue: '#2563EB',
  Green: '#059669',
  Grey: '#6B7280',
  Silver: '#D1D5DB',
  Purple: '#8B5CF6',
  'Space Grey': '#4B5563',
};
