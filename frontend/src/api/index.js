import client from './client';

/** Strips undefined/empty values so the query string stays readable. */
const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

export const authApi = {
  register: (payload) => client.post('/auth/register', payload),
  login: (payload) => client.post('/auth/login', payload),
  logout: (refreshToken) => client.post('/auth/logout', { refreshToken }),
  me: () => client.get('/auth/me'),
  changePassword: (payload) => client.patch('/auth/password', payload),
};

export const catalogApi = {
  categories: (params) => client.get('/categories', { params: clean(params) }),
  categoryTree: () => client.get('/categories/tree'),
  category: (slug) => client.get(`/categories/${slug}`),

  products: (params) => client.get('/products', { params: clean(params) }),
  filters: (params) => client.get('/products/filters', { params: clean(params) }),
  featured: (limit = 8) => client.get('/products/featured', { params: { limit } }),
  bestSellers: (limit = 8) => client.get('/products/best-sellers', { params: { limit } }),
  product: (slug) => client.get(`/products/${slug}`),
  related: (slug) => client.get(`/products/${slug}/related`),
  reviews: (slug, params) => client.get(`/products/${slug}/reviews`, { params: clean(params) }),
  reviewSummary: (slug) => client.get(`/products/${slug}/reviews/summary`),

  /** Status of the DINOv3 image search: `{ enabled, available }`. */
  visualSearchStatus: () => client.get('/products/visual-search/status'),
  /**
   * Products that look like the product in `file`, best match first, each
   * with `similarity`. The response's `region` is the area that was searched:
   * the detected product, or `box` ({x, y, w, h} fractions) when given.
   */
  visualSearch: (file, params, box) => {
    const body = new FormData();
    body.append('image', file);
    if (box) body.append('box', JSON.stringify(box));
    return client.post('/products/visual-search', body, {
      params: clean(params),
      headers: { 'Content-Type': 'multipart/form-data' },
      // The first search after a restart also loads the model.
      timeout: 60000,
    });
  },

  banners: (placement) => client.get('/banners', { params: clean({ placement }) }),
  promotions: () => client.get('/promotions'),
};

export const cartApi = {
  get: () => client.get('/cart'),
  addItem: (payload) => client.post('/cart/items', payload),
  updateItem: (itemId, quantity) => client.patch(`/cart/items/${itemId}`, { quantity }),
  removeItem: (itemId) => client.delete(`/cart/items/${itemId}`),
  clear: () => client.delete('/cart'),
  applyCoupon: (code) => client.post('/cart/coupon', { code }),
  removeCoupon: () => client.delete('/cart/coupon'),
  merge: (items) => client.post('/cart/merge', { items }),
};

export const orderApi = {
  preview: () => client.get('/checkout/preview'),
  create: (payload) => client.post('/orders', payload),
  list: (params) => client.get('/orders', { params: clean(params) }),
  get: (id) => client.get(`/orders/${id}`),
  track: (id) => client.get(`/orders/${id}/track`),
  cancel: (id, reason) => client.post(`/orders/${id}/cancel`, { reason }),
};

export const userApi = {
  updateProfile: (payload) => client.patch('/users/profile', payload),
  updateLanguage: (language) => client.patch('/users/language', { language }),
  addresses: () => client.get('/users/addresses'),
  addAddress: (payload) => client.post('/users/addresses', payload),
  updateAddress: (id, payload) => client.patch(`/users/addresses/${id}`, payload),
  deleteAddress: (id) => client.delete(`/users/addresses/${id}`),
  setDefaultAddress: (id) => client.patch(`/users/addresses/${id}/default`),
  wishlist: () => client.get('/users/wishlist'),
  toggleWishlist: (productId) => client.post(`/users/wishlist/${productId}`),
};

export const reviewApi = {
  create: (payload) => client.post('/reviews', payload),
  update: (id, payload) => client.patch(`/reviews/${id}`, payload),
  remove: (id) => client.delete(`/reviews/${id}`),
  helpful: (id) => client.post(`/reviews/${id}/helpful`),
};
