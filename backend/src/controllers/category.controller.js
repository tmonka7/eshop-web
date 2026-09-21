'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
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

  return ok(res, categories, 'Categories');
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
  return ok(res, roots, 'Category tree');
});

exports.getBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug }).lean();
  if (!category) throw ApiError.notFound('Category not found');
  category.productCount = await Product.countDocuments({ category: category._id, isActive: true });
  return ok(res, category, 'Category');
});

exports.create = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  return created(res, category, 'Category created');
});

exports.update = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  if (req.body.parent && String(req.body.parent) === String(category._id)) {
    throw ApiError.badRequest('A category cannot be its own parent');
  }
  Object.assign(category, req.body);
  await category.save();
  return ok(res, category, 'Category updated');
});

exports.remove = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');

  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    throw ApiError.conflict(
      'Cannot delete: ' + productCount + ' product(s) still use this category',
    );
  }
  const childCount = await Category.countDocuments({ parent: category._id });
  if (childCount > 0) throw ApiError.conflict('Cannot delete: category has sub-categories');

  await category.deleteOne();
  return ok(res, null, 'Category deleted');
});
