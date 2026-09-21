export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export const STATUS_TONE = {
  pending: 'warn',
  processing: 'info',
  shipped: 'purple',
  delivered: 'ok',
  cancelled: 'danger',
};

/** Mirrors ORDER_FLOW in the API so the UI only offers legal transitions. */
export const STATUS_FLOW = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const PAYMENT_TONE = {
  paid: 'ok',
  unpaid: 'warn',
  failed: 'danger',
  refunded: 'info',
};

/**
 * Categorical chart palette — a fixed hue order, never cycled.
 *
 * Brand green leads; red is deliberately absent because it is reserved for
 * status (negative deltas, destructive actions) and a status colour must never
 * double as "series 6".
 *
 * Validated against a white chart surface in the strictest all-pairs mode —
 * every segment compared with every other, not just its neighbour:
 *   lightness band, chroma floor, contrast — all pass
 *   worst normal-vision ΔE 16.7, above the 15 floor
 *   worst CVD ΔE 6.1 (green↔magenta, deutan) — inside the 6–8 floor band,
 *     which is legal ONLY alongside secondary encoding. That is why the donut
 *     ships a legend, a label on every segment and 2px gaps between them,
 *     rather than leaving colour to carry identity on its own.
 *
 * The amber slot is #b45309 rather than a brighter #f59e0b, which is 2.15:1
 * against white — a mark that faint obliges a table view on its own.
 *
 * Past CHART_SERIES_CAP the tail folds into one neutral "Other" segment
 * instead of cycling hues back to the start.
 */
export const CHART_COLORS = [
  '#16a34a',
  '#7c3aed',
  '#b45309',
  '#0891b2',
  '#db2777',
];

/** Segments past this many must fold into "Other" on all-pairs forms. */
export const CHART_SERIES_CAP = 5;

// Labels are catalogue keys; the components resolve them with t().
export const RANGE_OPTIONS = [
  { value: '7d', labelKey: 'range.7d' },
  { value: '30d', labelKey: 'range.30d' },
  { value: '90d', labelKey: 'range.90d' },
  { value: '12m', labelKey: 'range.12m' },
];

/**
 * Listing currencies offered when a product is registered.
 *
 * REM is not an ISO 4217 code, so `Intl.NumberFormat` cannot format it and
 * there is no exchange rate to USD - see `currency()` in utils/format.js and
 * the cart's single-currency guard on the server.
 *
 * The colours are fixed by the spec: USD red, REM blue. They are the one
 * place in this app where red is not a status colour, so both tones are
 * checked against their own tint rather than borrowed from the badge scale.
 */
export const CURRENCIES = [
  { value: 'USD', labelKey: 'products.currencyUsd', tone: 'usd' },
  { value: 'REM', labelKey: 'products.currencyRem', tone: 'rem' },
];

export const DEFAULT_CURRENCY = 'USD';
