'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { buildTranslations } = require('../utils/localize');
const { LOCALES } = require('../i18n');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const visualSearch = require('../services/visualSearch.service');
const dinov3 = require('../services/dinov3.service');
const { sanitizeBox } = require('../services/regionDetect');

const { ModelUnavailableError } = dinov3;

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

// `translations` must stay selected or the response-layer fold has nothing to
// work with and every locale falls back to the English columns.
const LIST_FIELDS =
  'name slug sku brand price comparePrice currency stock images rating reviewCount soldCount ' +
  'category isActive isFeatured freeShipping shortDescription colors tags createdAt translations';

/** Category fields to populate; `translations` for the same reason as above. */
const CATEGORY_FIELDS = 'name slug translations';

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
    if (!cat) throw ApiError.notFound('error.categoryNotFound');
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
  // "On sale" is a relationship between two fields rather than a stored flag,
  // so it needs $expr. Kept off filter.$or, which the search branch owns.
  if (query.onSale === 'true') filter.$expr = { $gt: ['$comparePrice', '$price'] };
  if (query.inStock === 'true') filter.stock = { $gt: 0 };
  if (query.stock === 'out') filter.stock = { $lte: 0 };
  if (query.stock === 'low') filter.stock = { $gt: 0, $lte: 10 };

  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    // Search the translated names as well, so a Japanese shopper typing
    // "ヘッドホン" finds a product whose canonical name is English.
    filter.$or = [
      { name: rx },
      { brand: rx },
      { sku: rx },
      { tags: rx },
      ...LOCALES.map((locale) => ({ [`translations.${locale}.name`]: rx })),
    ];
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
      .populate('category', CATEGORY_FIELDS)
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total }, 'success.products');
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
    'success.productFilters',
  );
});

exports.featured = asyncHandler(async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 8, 50);
  const items = await Product.find({ isActive: true, isFeatured: true })
    .select(LIST_FIELDS)
    .populate('category', CATEGORY_FIELDS)
    .sort({ soldCount: -1 })
    .limit(limit);
  return ok(res, items, 'success.featuredProducts');
});

exports.bestSellers = asyncHandler(async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 8, 50);
  const items = await Product.find({ isActive: true })
    .select(LIST_FIELDS)
    .populate('category', CATEGORY_FIELDS)
    .sort({ soldCount: -1, rating: -1 })
    .limit(limit);
  return ok(res, items, 'success.bestSellers');
});

exports.getBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const query = /^[0-9a-fA-F]{24}$/.test(slug) ? { _id: slug } : { slug };

  const product = await Product.findOneAndUpdate(query, { $inc: { viewCount: 1 } }, { new: true })
    .select('-visualIndex')
    .populate('category', CATEGORY_FIELDS);

  if (!product) throw ApiError.notFound('error.productNotFound');
  // Deactivated products stay reachable for admins previewing a draft.
  const isStaff = req.user && req.user.role !== 'customer';
  if (!product.isActive && !isStaff) throw ApiError.notFound('error.productNotFound');

  return ok(res, product, 'success.product');
});

exports.related = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug }).lean();
  if (!product) throw ApiError.notFound('error.productNotFound');

  const items = await Product.find({
    _id: { $ne: product._id },
    isActive: true,
    $or: [{ category: product.category }, { brand: product.brand }],
  })
    .select(LIST_FIELDS)
    .populate('category', CATEGORY_FIELDS)
    .sort({ rating: -1, soldCount: -1 })
    .limit(8);

  return ok(res, items, 'success.relatedProducts');
});

/* ---------------------------- image search ---------------------------- */

/** Lets clients decide whether to show the camera button at all. */
exports.visualSearchStatus = asyncHandler(async (req, res) => {
  return ok(res, await visualSearch.status(), 'success.visualSearchStatus');
});

/**
 * Keeps only well-formed regions for images the product actually has. A
 * region an admin saved is manual (auto: false) unless it says otherwise.
 */
function sanitizeRegions(regions, images) {
  if (!Array.isArray(regions)) return undefined;
  const allowed = new Set(images || []);
  const seen = new Set();
  const out = [];
  for (const r of regions) {
    const box = r && allowed.has(r.image) && !seen.has(r.image) ? sanitizeBox(r) : null;
    if (!box) continue;
    seen.add(r.image);
    out.push({ image: r.image, ...box, auto: r.auto === true });
  }
  return out;
}

const truthy = (v) => v === true || v === 'true' || v === '1';

/** `limit` / `minScore` from the query string or JSON body. */
function searchOptions(source) {
  const limit = Math.min(Math.max(Number.parseInt(source.limit, 10) || 24, 1), 60);
  const minScore = Number.parseFloat(source.minScore);
  return { limit, ...(Number.isFinite(minScore) ? { minScore } : {}) };
}

/** Loads the ranked products and answers with them in ranking order. */
async function sendHits(res, hits, extra = {}) {
  const ids = hits.map((h) => h.productId);
  const docs = await Product.find({ _id: { $in: ids }, isActive: true })
    .select(LIST_FIELDS)
    .populate('category', CATEGORY_FIELDS);
  const byId = new Map(docs.map((d) => [String(d._id), d]));

  const items = hits
    .filter((h) => byId.has(h.productId))
    .map((h) => ({ ...byId.get(h.productId).toJSON(), similarity: h.score }));

  return ok(res, items, 'success.visualSearchResults', 200, extra, { count: items.length });
}

/**
 * POST multipart `image`: returns active products that look like the photo,
 * best match first, each with a cosine `similarity` in [-1, 1].
 */
exports.visualSearch = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('error.noImageUploaded');

  // `box` (JSON {x,y,w,h}, fractions of the upright photo) is the area the
  // shopper adjusted; without it the product area is detected automatically.
  const params = { ...req.query, ...req.body };
  let box;
  if (params.box !== undefined && params.box !== '') {
    box = sanitizeBox(params.box);
    if (!box) throw ApiError.badRequest('error.visualBoxInvalid');
  }
  let result;
  try {
    result = await visualSearch.search(req.file.buffer, {
      ...searchOptions(params),
      box,
      detect: params.detect === undefined ? true : truthy(params.detect),
    });
  } catch (err) {
    if (err instanceof ModelUnavailableError) throw new ApiError(503, 'error.visualSearchUnavailable');
    // sharp rejects files that claim to be images but do not decode.
    if (/unsupported image format|Input buffer|corrupt/i.test(err.message)) {
      throw ApiError.badRequest('error.imageUnreadable');
    }
    throw err;
  }
  return sendHits(res, result.hits, { region: result.region });
});

/**
 * POST JSON `{ model, vector, limit?, minScore? }`: the same ranking for a
 * feature vector the client computed itself (the Android app bundles
 * DINOv3). `model` must name the network this server indexed with, or the
 * two vector spaces would not be comparable.
 */
exports.visualSearchByVector = asyncHandler(async (req, res) => {
  const { model, vector } = req.body || {};
  if (model !== dinov3.modelId()) {
    throw ApiError.conflict('error.visualModelMismatch', { model: dinov3.modelId() });
  }
  if (!Array.isArray(vector) || vector.length === 0 || vector.length > 4096
      || !vector.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw ApiError.badRequest('error.visualVectorInvalid');
  }
  let hits;
  try {
    hits = await visualSearch.searchVector(vector, searchOptions(req.body));
  } catch (err) {
    if (err.code === 'DIMENSION_MISMATCH') throw ApiError.badRequest('error.visualVectorInvalid');
    throw err;
  }
  return sendHits(res, hits);
});

/* -------------------------------- admin ------------------------------- */

exports.adminList = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const filter = await buildFilter(req.query, { adminView: true });

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category', CATEGORY_FIELDS)
      .sort(SORTS[req.query.sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total }, 'success.products');
});

exports.create = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.body.category);
  if (!category) throw ApiError.badRequest('error.categoryNotExist');
  // visualIndex is server-owned bookkeeping; a client cannot set it.
  const { visualIndex, imageRegions, ...body } = req.body; // eslint-disable-line no-unused-vars
  const product = await Product.create({
    ...body,
    imageRegions: sanitizeRegions(imageRegions, body.images) || [],
    translations: buildTranslations(body.translations),
  });
  // Extract and store the DINOv3 features before answering, so the product is
  // searchable by image as soon as the admin sees it saved.
  await visualSearch.indexProductSafely(product);
  return created(res, product, 'success.productCreated');
});

exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('error.productNotFound');
  if (req.body.category) {
    const category = await Category.findById(req.body.category);
    if (!category) throw ApiError.badRequest('error.categoryNotExist');
  }
  const {
    translations, visualIndex, imageRegions, ...rest // eslint-disable-line no-unused-vars
  } = req.body;
  const imagesBefore = JSON.stringify(product.images);
  const regionsBefore = JSON.stringify(manualRegions(product.imageRegions));
  Object.assign(product, rest);
  if (imageRegions !== undefined) {
    product.imageRegions = sanitizeRegions(imageRegions, product.images) || [];
  } else if (rest.images) {
    product.imageRegions = (product.imageRegions || []).filter((r) => product.images.includes(r.image));
  }
  // Merge rather than assign: a PATCH carrying only `ja` must not wipe en/zh.
  if (translations) {
    product.translations = buildTranslations(translations, product.toObject().translations);
  }
  await product.save();
  // Only new or removed images, or re-drawn regions, need work; unchanged
  // images keep their vectors.
  if (JSON.stringify(product.images) !== imagesBefore
      || JSON.stringify(manualRegions(product.imageRegions)) !== regionsBefore) {
    await visualSearch.indexProductSafely(product);
  } else if (rest.isActive !== undefined) {
    visualSearch.invalidate();
  }
  return ok(res, product, 'success.productUpdated');
});

/** The admin-drawn regions only, in a comparable form. */
function manualRegions(regions) {
  return (regions || [])
    .filter((r) => r.auto === false)
    .map((r) => [r.image, r.x, r.y, r.w, r.h]);
}

exports.toggleActive = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('error.productNotFound');
  product.isActive =
    req.body.isActive !== undefined ? Boolean(req.body.isActive) : !product.isActive;
  await product.save();
  // The search index only holds active products.
  visualSearch.invalidate();
  return ok(res, product, product.isActive ? 'success.productActivated' : 'success.productDeactivated');
});

exports.updateStock = asyncHandler(async (req, res) => {
  const stock = Number.parseInt(req.body.stock, 10);
  if (!Number.isFinite(stock) || stock < 0) throw ApiError.badRequest('error.stockMin');
  const product = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true });
  if (!product) throw ApiError.notFound('error.productNotFound');
  return ok(res, product, 'success.stockUpdated');
});

exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('error.productNotFound');
  await Review.deleteMany({ product: product._id });
  await visualSearch.removeProduct(product._id);
  await product.deleteOne();
  return ok(res, null, 'success.productDeleted');
});
