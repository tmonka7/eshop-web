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

export const RANGE_OPTIONS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '3 Months' },
  { value: '12m', label: '1 Year' },
];
