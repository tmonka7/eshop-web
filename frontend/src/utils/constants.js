export const ORDER_STATUS_META = {
  pending: { label: 'Pending', tone: 'warn' },
  processing: { label: 'Processing', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'purple' },
  delivered: { label: 'Delivered', tone: 'ok' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export const SORT_OPTIONS = [
  { value: 'best_selling', label: 'Best Selling' },
  { value: 'newest', label: 'Newest Arrivals' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'name_asc', label: 'Name: A to Z' },
];

export const PAYMENT_METHODS = [
  { value: 'card', label: 'Credit / Debit Card', hint: 'Visa, Mastercard, Amex' },
  { value: 'paypal', label: 'PayPal', hint: 'Redirects to PayPal' },
  { value: 'applepay', label: 'Apple Pay', hint: 'One tap checkout' },
  { value: 'cod', label: 'Cash on Delivery', hint: 'Pay the courier' },
];

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
