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
 * Checked with the data-viz validator against a white chart surface:
 *   adjacent pairs (bars, lines, stacked) — worst CVD ΔE 10.3, normal 31.1: passes.
 *   all pairs (the donut, where every segment is compared at once) — clears to
 *   five slots, with worst CVD ΔE 6.1, inside the 6–8 floor band. That band is
 *   only legal alongside secondary encoding, which is why the donut ships a
 *   legend and per-segment labels rather than relying on colour alone.
 */
export const CHART_COLORS = [
  '#16a34a',
  '#7c3aed',
  '#f59e0b',
  '#0891b2',
  '#db2777',
  '#4d7c0f',
  '#2563eb',
  '#b45309',
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
