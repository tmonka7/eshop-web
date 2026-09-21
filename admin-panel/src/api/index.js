import client from './client';

const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

export const authApi = {
  login: (payload) => client.post('/auth/login', payload),
  logout: (refreshToken) => client.post('/auth/logout', { refreshToken }),
  me: () => client.get('/auth/me'),
  changePassword: (payload) => client.patch('/auth/password', payload),
  updateLanguage: (language) => client.patch('/users/language', { language }),
};

export const dashboardApi = {
  stats: (params) => client.get('/admin/dashboard/stats', { params: clean(params) }),
  salesOverview: (params) => client.get('/admin/dashboard/sales-overview', { params: clean(params) }),
  salesByCategory: (params) => client.get('/admin/dashboard/sales-by-category', { params: clean(params) }),
  customerGrowth: (params) => client.get('/admin/dashboard/customer-growth', { params: clean(params) }),
  recentOrders: (limit = 6) => client.get('/admin/dashboard/recent-orders', { params: { limit } }),
  topProducts: (limit = 6) => client.get('/admin/dashboard/top-products', { params: { limit } }),
};

export const productApi = {
  list: (params) => client.get('/admin/products', { params: clean(params) }),
  create: (payload) => client.post('/admin/products', payload),
  update: (id, payload) => client.patch(`/admin/products/${id}`, payload),
  toggleStatus: (id, isActive) => client.patch(`/admin/products/${id}/status`, { isActive }),
  updateStock: (id, stock) => client.patch(`/admin/products/${id}/stock`, { stock }),
  remove: (id) => client.delete(`/admin/products/${id}`),
};

export const categoryApi = {
  list: (params) => client.get('/categories', { params: clean({ all: true, withCounts: true, ...params }) }),
  create: (payload) => client.post('/admin/categories', payload),
  update: (id, payload) => client.patch(`/admin/categories/${id}`, payload),
  remove: (id) => client.delete(`/admin/categories/${id}`),
};

export const orderApi = {
  list: (params) => client.get('/admin/orders', { params: clean(params) }),
  get: (id) => client.get(`/admin/orders/${id}`),
  updateStatus: (id, status, note) => client.patch(`/admin/orders/${id}/status`, { status, note }),
  updateTracking: (id, payload) => client.patch(`/admin/orders/${id}/tracking`, payload),
};

export const customerApi = {
  list: (params) => client.get('/admin/customers', { params: clean(params) }),
  get: (id) => client.get(`/admin/customers/${id}`),
  toggleStatus: (id, isActive) => client.patch(`/admin/customers/${id}/status`, { isActive }),
  exportUrl: () => `${client.defaults.baseURL}/admin/customers/export`,
};

export const inventoryApi = {
  alerts: (params) => client.get('/admin/inventory/alerts', { params: clean(params) }),
};

export const reviewApi = {
  list: (params) => client.get('/admin/reviews', { params: clean(params) }),
  moderate: (id, isApproved) => client.patch(`/admin/reviews/${id}/moderate`, { isApproved }),
  remove: (id) => client.delete(`/admin/reviews/${id}`),
};

export const couponApi = {
  list: (params) => client.get('/admin/coupons', { params: clean(params) }),
  create: (payload) => client.post('/admin/coupons', payload),
  update: (id, payload) => client.patch(`/admin/coupons/${id}`, payload),
  remove: (id) => client.delete(`/admin/coupons/${id}`),
};

export const bannerApi = {
  list: () => client.get('/admin/banners'),
  create: (payload) => client.post('/admin/banners', payload),
  update: (id, payload) => client.patch(`/admin/banners/${id}`, payload),
  remove: (id) => client.delete(`/admin/banners/${id}`),
};

export const uploadApi = {
  products: (files) => {
    const body = new FormData();
    Array.from(files).forEach((f) => body.append('images', f));
    return client.post('/admin/uploads/products', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  banner: (file) => {
    const body = new FormData();
    body.append('image', file);
    return client.post('/admin/uploads/banners', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

/**
 * Staff accounts. Every route here is super-admin only on the server, so a
 * regular administrator calling them gets a 403 rather than a partial result -
 * the panel hides the section as well, but the server is what enforces it.
 */
export const staffApi = {
  list: (params) => client.get('/admin/staff', { params: clean(params) }),
  options: () => client.get('/admin/staff/options'),
  get: (id) => client.get(`/admin/staff/${id}`),
  create: (payload) => client.post('/admin/staff', payload),
  update: (id, payload) => client.patch(`/admin/staff/${id}`, payload),
  remove: (id) => client.delete(`/admin/staff/${id}`),
};
