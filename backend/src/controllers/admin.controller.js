'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { round2 } = require('../utils/money');
const { pickTranslated } = require('../utils/localize');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const { ORDER_STATUS, ROLES, LOW_STOCK_THRESHOLD } = require('../config/constants');

/** Orders that represent real revenue (everything except cancelled). */
const REVENUE_MATCH = { status: { $ne: ORDER_STATUS.CANCELLED } };

function rangeFromQuery(query) {
  const now = new Date();
  const preset = query.range || '30d';
  const days = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }[preset] || 30;

  const to = query.to ? new Date(query.to) : now;
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  return { from, to, days, preset };
}

function percentChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return round2(((current - previous) / previous) * 100);
}

/** Dashboard KPI tiles + trend vs. the immediately preceding window. */
exports.stats = asyncHandler(async (req, res) => {
  const { from, to } = rangeFromQuery(req.query);
  const span = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - span);

  const window = { createdAt: { $gte: from, $lte: to } };
  const prevWindow = { createdAt: { $gte: prevFrom, $lt: from } };

  const [current, previous, customers, newCustomers, prevNewCustomers, visitors, products] = await Promise.all([
    Order.aggregate([
      { $match: { ...REVENUE_MATCH, ...window } },
      { $group: { _id: null, revenue: { $sum: '$pricing.total' }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...REVENUE_MATCH, ...prevWindow } },
      { $group: { _id: null, revenue: { $sum: '$pricing.total' }, orders: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: ROLES.CUSTOMER }),
    User.countDocuments({ role: ROLES.CUSTOMER, ...window }),
    User.countDocuments({ role: ROLES.CUSTOMER, ...prevWindow }),
    Product.aggregate([{ $group: { _id: null, views: { $sum: '$viewCount' } } }]),
    Product.countDocuments({ isActive: true }),
  ]);

  const cur = current[0] || { revenue: 0, orders: 0 };
  const prev = previous[0] || { revenue: 0, orders: 0 };
  const totalViews = (visitors[0] && visitors[0].views) || 0;

  // Conversion = orders placed per product view in the window.
  const conversionRate = totalViews > 0 ? round2((cur.orders / totalViews) * 100) : 0;

  return ok(
    res,
    {
      range: { from, to },
      totalRevenue: { value: round2(cur.revenue), change: percentChange(cur.revenue, prev.revenue) },
      totalOrders: { value: cur.orders, change: percentChange(cur.orders, prev.orders) },
      totalCustomers: {
        value: customers,
        newInRange: newCustomers,
        change: percentChange(newCustomers, prevNewCustomers),
      },
      conversionRate: { value: conversionRate, change: percentChange(cur.orders, prev.orders) },
      activeProducts: products,
      averageOrderValue: cur.orders ? round2(cur.revenue / cur.orders) : 0,
    },
    'success.dashboardStats',
  );
});

/** Time series for the "Sales Overview" chart. */
exports.salesOverview = asyncHandler(async (req, res) => {
  const { from, to, preset } = rangeFromQuery(req.query);
  const monthly = preset === '12m';

  const rows = await Order.aggregate([
    { $match: { ...REVENUE_MATCH, createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: {
          $dateToString: { format: monthly ? '%Y-%m' : '%Y-%m-%d', date: '$createdAt' },
        },
        revenue: { $sum: '$pricing.total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byKey = new Map(rows.map((r) => [r._id, r]));
  const series = [];
  const cursor = new Date(from);

  while (cursor <= to) {
    const key = monthly
      ? cursor.toISOString().slice(0, 7)
      : cursor.toISOString().slice(0, 10);
    const hit = byKey.get(key);
    series.push({
      date: key,
      revenue: hit ? round2(hit.revenue) : 0,
      orders: hit ? hit.orders : 0,
    });
    if (monthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }

  return ok(res, series, 'success.salesOverview');
});

/** Donut data for "Sales by Category". */
exports.salesByCategory = asyncHandler(async (req, res) => {
  const { from, to } = rangeFromQuery(req.query);

  const rows = await Order.aggregate([
    { $match: { ...REVENUE_MATCH, createdAt: { $gte: from, $lte: to } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.category',
        revenue: { $sum: '$items.subtotal' },
        units: { $sum: '$items.quantity' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  const categories = await Category.find({ _id: { $in: rows.map((r) => r._id) } })
    .select('name slug translations')
    .lean();
  // Chart labels are plain strings, so the response-layer fold never sees them.
  const nameById = new Map(
    categories.map((c) => [String(c._id), pickTranslated(c, 'name', req.locale)]),
  );

  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const data = rows.map((r) => ({
    category: nameById.get(String(r._id)) || req.t('common.uncategorised'),
    revenue: round2(r.revenue),
    units: r.units,
    percent: total > 0 ? round2((r.revenue / total) * 100) : 0,
  }));

  return ok(res, { total: round2(total), segments: data }, 'success.salesByCategory');
});

/** Monthly new-customer bars. */
exports.customerGrowth = asyncHandler(async (req, res) => {
  const months = Math.min(Number.parseInt(req.query.months, 10) || 6, 24);
  const from = new Date();
  from.setMonth(from.getMonth() - (months - 1));
  from.setDate(1);
  from.setHours(0, 0, 0, 0);

  const rows = await User.aggregate([
    { $match: { role: ROLES.CUSTOMER, createdAt: { $gte: from } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const byKey = new Map(rows.map((r) => [r._id, r.count]));
  const series = [];
  const cursor = new Date(from);
  for (let i = 0; i < months; i += 1) {
    const key = cursor.toISOString().slice(0, 7);
    series.push({
      month: key,
      label: cursor.toLocaleString(req.t('language.intlLocale'), { month: 'short' }),
      count: byKey.get(key) || 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const total = await User.countDocuments({ role: ROLES.CUSTOMER });
  return ok(res, { total, series }, 'success.customerGrowth');
});

exports.recentOrders = asyncHandler(async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 5, 50);
  const orders = await Order.find()
    .populate('user', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('orderNumber customerName status pricing.total createdAt items');
  return ok(res, orders, 'success.recentOrders');
});

exports.topProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 5, 50);
  const products = await Product.find({ isActive: true })
    .sort({ soldCount: -1 })
    .limit(limit)
    .select('name slug images price soldCount stock rating translations');
  return ok(res, products, 'success.topProducts');
});

/** Inventory screen: what needs restocking. */
exports.inventoryAlerts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const filter = { isActive: true, stock: { $lte: LOW_STOCK_THRESHOLD } };

  const [items, total, outOfStock] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name translations')
      .sort({ stock: 1 })
      .skip(skip)
      .limit(limit)
      .select('name sku images stock price category translations'),
    Product.countDocuments(filter),
    Product.countDocuments({ isActive: true, stock: 0 }),
  ]);

  return res.status(200).json({
    success: true,
    message: 'Inventory alerts',
    data: items,
    summary: { lowStock: total - outOfStock, outOfStock, threshold: LOW_STOCK_THRESHOLD },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/* ------------------------------ customers ----------------------------- */

exports.listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const filter = { role: ROLES.CUSTOMER };

  if (req.query.status === 'active') filter.isActive = true;
  if (req.query.status === 'inactive') filter.isActive = false;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  // Attach per-customer order totals in one round trip.
  const stats = await Order.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) }, ...REVENUE_MATCH } },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$pricing.total' } } },
  ]);
  const byUser = new Map(stats.map((s) => [String(s._id), s]));

  const data = users.map((u) => {
    const s = byUser.get(String(u._id));
    return {
      ...u,
      password: undefined,
      refreshTokens: undefined,
      orderCount: s ? s.orders : 0,
      totalSpent: s ? round2(s.spent) : 0,
    };
  });

  return paginated(res, data, { page, limit, total }, 'success.customers');
});

exports.getCustomer = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('error.customerNotFound');

  const [orders, agg, reviews] = await Promise.all([
    Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(10),
    Order.aggregate([
      { $match: { user: user._id, ...REVENUE_MATCH } },
      { $group: { _id: null, orders: { $sum: 1 }, spent: { $sum: '$pricing.total' } } },
    ]),
    Review.countDocuments({ user: user._id }),
  ]);

  const totals = agg[0] || { orders: 0, spent: 0 };

  return ok(
    res,
    {
      customer: user,
      stats: {
        orderCount: totals.orders,
        totalSpent: round2(totals.spent),
        averageOrder: totals.orders ? round2(totals.spent / totals.orders) : 0,
        reviewCount: reviews,
      },
      recentOrders: orders,
    },
    'success.customerDetail',
  );
});

exports.toggleCustomerActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('error.customerNotFound');
  if (user.role !== ROLES.CUSTOMER) throw ApiError.forbidden('error.cannotDeactivateStaff');

  user.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !user.isActive;
  if (!user.isActive) user.refreshTokens = [];
  await user.save();

  return ok(res, user, user.isActive ? 'success.customerActivated' : 'success.customerDeactivated');
});

exports.exportCustomers = asyncHandler(async (req, res) => {
  const users = await User.find({ role: ROLES.CUSTOMER }).sort({ createdAt: -1 }).lean();
  const stats = await Order.aggregate([
    { $match: REVENUE_MATCH },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$pricing.total' } } },
  ]);
  const byUser = new Map(stats.map((s) => [String(s._id), s]));

  const esc = (v) => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';
  const header = ['name', 'email', 'phone', 'orders', 'totalSpent', 'status', 'joined'].map((k) =>
    req.t('csv.' + k),
  );
  const lines = [header.join(',')];

  users.forEach((u) => {
    const s = byUser.get(String(u._id));
    lines.push(
      [
        esc(u.name),
        esc(u.email),
        esc(u.phone),
        s ? s.orders : 0,
        s ? round2(s.spent) : 0,
        esc(u.isActive ? req.t('csv.active') : req.t('csv.inactive')),
        esc(new Date(u.createdAt).toISOString().slice(0, 10)),
      ].join(','),
    );
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
  // Excel only reads a UTF-8 CSV as UTF-8 when it starts with a BOM; without
  // it the Chinese and Japanese columns open as mojibake.
  return res.status(200).send('﻿' + lines.join('\n'));
});
