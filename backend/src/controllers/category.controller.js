'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildTranslations } = require('../utils/localize');
const { ok, created } = require('../utils/response');
const Category = require('../models/Category');
const Product = require('../models/Product');

exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.all !== 'true') filter.isActive = true;
  if (req.query.parent === 'root') filter.parent = null;

  const categories = await Category.find(filter).sort({ order: 1, name: 1 }).lean();

  if (req.query.withCounts === 'true') {
    const counts = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const map = new Map(counts.map((c) => [String(c._id), c.count]));
    categories.forEach((c) => {
      c.productCount = map.get(String(c._id)) || 0;
    });
  }

  return ok(res, categories, 'success.categories');
});

exports.tree = asyncHandler(async (_req, res) => {
  const all = await Category.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
  const byId = new Map(all.map((c) => [String(c._id), { ...c, children: [] }]));
  const roots = [];
  byId.forEach((node) => {
    if (node.parent && byId.has(String(node.parent))) {
      byId.get(String(node.parent)).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return ok(res, roots, 'success.categoryTree');
});

exports.getBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug }).lean();
  if (!category) throw ApiError.notFound('error.categoryNotFound');
  category.productCount = await Product.countDocuments({ category: category._id, isActive: true });
  return ok(res, category, 'success.category');
});

exports.create = asyncHandler(async (req, res) => {
  const category = await Category.create({
    ...req.body,
    translations: buildTranslations(req.body.translations),
  });
  return created(res, category, 'success.categoryCreated');
});

exports.update = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('error.categoryNotFound');
  if (req.body.parent && String(req.body.parent) === String(category._id)) {
    throw ApiError.badRequest('error.categoryOwnParent');
  }
  const { translations, ...rest } = req.body;
  Object.assign(category, rest);
  // Merge rather than assign: a PATCH carrying only `ja` must not wipe en/zh.
  if (translations) {
    category.translations = buildTranslations(translations, category.toObject().translations);
  }
  await category.save();
  return ok(res, category, 'success.categoryUpdated');
});

exports.remove = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('error.categoryNotFound');

  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    throw ApiError.conflict(
      'Cannot delete: ' + productCount + ' product(s) still use this category',
    );
  }
  const childCount = await Category.countDocuments({ parent: category._id });
  if (childCount > 0) throw ApiError.conflict('error.categoryHasChildren');

  await category.deleteOne();
  return ok(res, null, 'success.categoryDeleted');
});
