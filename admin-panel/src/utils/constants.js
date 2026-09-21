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

/** Categorical palette used across every chart in the panel. */
export const CHART_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#64748b',
  '#84cc16',
];

// Labels are catalogue keys; the components resolve them with t().
export const RANGE_OPTIONS = [
  { value: '7d', labelKey: 'range.7d' },
  { value: '30d', labelKey: 'range.30d' },
  { value: '90d', labelKey: 'range.90d' },
  { value: '12m', labelKey: 'range.12m' },
];
