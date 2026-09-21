'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');

const SORTS = {
  best_selling: { soldCount: -1, rating: -1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1, reviewCount: -1 },
  name_asc: { name: 1 },
  popular: { viewCount: -1 },
};

const LIST_FIELDS =
  'name slug sku brand price comparePrice stock images rating reviewCount soldCount ' +
  'category isActive isFeatured freeShipping shortDescription colors tags createdAt';

const csv = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Builds the mongo filter shared by the storefront list and the admin list. */
async function buildFilter(query, { adminView = false } = {}) {
  const filter = {};
  if (!adminView) filter.isActive = true;
  else if (query.status === 'active') filter.isActive = true;
  else if (query.status === 'inactive') filter.isActive = false;

  if (query.category) {
    // Accept either an id or a slug, and include sub-categories.
    const cat = /^[0-9a-fA-F]{24}$/.test(query.category)
      ? await Category.findById(query.category).lean()
      : await Category.findOne({ slug: query.category }).lean();
    if (!cat) throw ApiError.notFound('Category not found');
    const children = await Category.find({ parent: cat._id }).select('_id').lean();
    filter.category = { $in: [cat._id, ...children.map((c) => c._id)] };
  }

  const brands = csv(query.brand);
  if (brands.length) filter.brand = { $in: brands };

  const colors = csv(query.color);
  if (colors.length) filter.colors = { $in: colors };

  const tags = csv(query.tag);
  if (tags.length) filter.tags = { $in: tags };

  const min = Number.parseFloat(query.minPrice);
  const max = Number.parseFloat(query.maxPrice);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    filter.price = {};
    if (Number.isFinite(min)) filter.price.$gte = min;
    if (Number.isFinite(max)) filter.price.$lte = max;
  }

  const rating = Number.parseFloat(query.minRating);
  if (Number.isFinite(rating)) filter.rating = { $gte: rating };

  if (query.featured === 'true') filter.isFeatured = true;
  if (query.inStock === 'true') filter.stock = { $gt: 0 };
  if (query.stock === 'out') filter.stock = { $lte: 0 };
  if (query.stock === 'low') filter.stock = { $gt: 0, $lte: 10 };

  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: rx }, { brand: rx }, { sku: rx }, { tags: rx }];
  }

  return filter;
}

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 12);
  const filter = await buildFilter(req.query);
  const sort = SORTS[req.query.sort] || SORTS.best_selling;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .select(LIST_FIELDS)
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total }, 'Products');
});

/** Facet values so the storefront sidebar can render real filter options. */
exports.filters = asyncHandler(async (req, res) => {
  const filter = await buildFilter({ category: req.query.category });
  const rows = await Product.aggregate([
    { $match: filter },
    {
      $facet: {
        brands: [
          { $group: { _id: '$brand', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 30 },
        ],
        colors: [
          { $unwind: '$colors' },
          { $group: { _id: '$colors', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        price: [{ $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }],
      },
    },
  ]);

  const facets = rows[0] || { brands: [], colors: [], price: [] };
  const priceRange = facets.price[0];

  return ok(
    res,
    {
      brands: facets.brands.map((b) => ({ value: b._id, count: b.count })),
      colors: facets.colors.map((c) => ({ value: c._id, count: c.count })),
      price: priceRange
        ? { min: Math.floor(priceRange.min), max: Math.ceil(priceRange.max) }
        : { min: 0, max: 0 },
      ratings: [4, 3, 2, 1],
    },
    'Product filters',
  );
});

exports.featured = asyncHandler(async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 8, 50);
  const items = await Product.find({ isActive: true, isFeatured: true })
    .select(LIST_FIELDS)
    .populate('category', 'name slug')
    .sort({ soldCount: -1 })
    .limit(limit);
  return ok(res, items, 'Featured products');
});

exports.bestSellers = asyncHandler(async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 8, 50);
  const items = await Product.find({ isActive: true })
    .select(LIST_FIELDS)
    .populate('category', 'name slug')
    .sort({ soldCount: -1, rating: -1 })
    .limit(limit);
  return ok(res, items, 'Best sellers');
});

exports.getBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const query = /^[0-9a-fA-F]{24}$/.test(slug) ? { _id: slug } : { slug };

  const product = await Product.findOneAndUpdate(query, { $inc: { viewCount: 1 } }, { new: true })
    .populate('category', 'name slug');

  if (!product) throw ApiError.notFound('Product not found');
  // Deactivated products stay reachable for admins previewing a draft.
  const isStaff = req.user && req.user.role !== 'customer';
  if (!product.isActive && !isStaff) throw ApiError.notFound('Product not found');

  return ok(res, product, 'Product');
});

exports.related = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug }).lean();
  if (!product) throw ApiError.notFound('Product not found');

  const items = await Product.find({
    _id: { $ne: product._id },
    isActive: true,
    $or: [{ category: product.category }, { brand: product.brand }],
  })
    .select(LIST_FIELDS)
    .populate('category', 'name slug')
    .sort({ rating: -1, soldCount: -1 })
    .limit(8);

  return ok(res, items, 'Related products');
});

/* -------------------------------- admin ------------------------------- */

exports.adminList = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const filter = await buildFilter(req.query, { adminView: true });

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort(SORTS[req.query.sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total }, 'Products');
});

exports.create = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.body.category);
  if (!category) throw ApiError.badRequest('Category does not exist');
  const product = await Product.create(req.body);
  return created(res, product, 'Product created');
});

exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  if (req.body.category) {
    const category = await Category.findById(req.body.category);
    if (!category) throw ApiError.badRequest('Category does not exist');
  }
  Object.assign(product, req.body);
  await product.save();
  return ok(res, product, 'Product updated');
});

exports.toggleActive = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  product.isActive =
    req.body.isActive !== undefined ? Boolean(req.body.isActive) : !product.isActive;
  await product.save();
  return ok(res, product, product.isActive ? 'Product activated' : 'Product deactivated');
});

exports.updateStock = asyncHandler(async (req, res) => {
  const stock = Number.parseInt(req.body.stock, 10);
  if (!Number.isFinite(stock) || stock < 0) throw ApiError.badRequest('stock must be >= 0');
  const product = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true });
  if (!product) throw ApiError.notFound('Product not found');
  return ok(res, product, 'Stock updated');
});

exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  await Review.deleteMany({ product: product._id });
  await product.deleteOne();
  return ok(res, null, 'Product deleted');
});
