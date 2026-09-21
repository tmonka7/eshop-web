'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { ORDER_STATUS } = require('../config/constants');

exports.listForProduct = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 10);

  const product = await Product.findOne({ slug: req.params.slug }).select('_id').lean();
  if (!product) throw ApiError.notFound('Product not found');

  const filter = { product: product._id, isApproved: true };
  if (req.query.rating) filter.rating = Number.parseInt(req.query.rating, 10);

  const sort = req.query.sort === 'helpful'
    ? { helpfulCount: -1, createdAt: -1 }
    : req.query.sort === 'rating_desc'
      ? { rating: -1, createdAt: -1 }
      : { createdAt: -1 };

  const [items, total] = await Promise.all([
    Review.find(filter).populate('user', 'name avatar').sort(sort).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total }, 'Reviews');
});

/** Star-bucket breakdown for the rating bars on a product page. */
exports.summaryForProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug }).select('_id rating reviewCount').lean();
  if (!product) throw ApiError.notFound('Product not found');

  const rows = await Review.aggregate([
    { $match: { product: product._id, isApproved: true } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);

  const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rows.forEach((r) => {
    buckets[r._id] = r.count;
  });

  return ok(
    res,
    { average: product.rating, total: product.reviewCount, buckets },
    'Review summary',
  );
});

exports.create = asyncHandler(async (req, res) => {
  const { productId, rating, title = '', comment = '' } = req.body;

  const product = await Product.findById(productId);
  if (!product) throw ApiError.notFound('Product not found');

  const existing = await Review.findOne({ product: productId, user: req.user._id });
  if (existing) throw ApiError.conflict('You have already reviewed this product');

  // A review counts as verified when the user actually received the item.
  const purchase = await Order.findOne({
    user: req.user._id,
    'items.product': productId,
    status: ORDER_STATUS.DELIVERED,
  }).select('_id');

  const review = await Review.create({
    product: productId,
    user: req.user._id,
    order: purchase ? purchase._id : null,
    rating,
    title,
    comment,
    isVerifiedPurchase: Boolean(purchase),
  });

  await Review.syncProductRating(productId);
  await review.populate('user', 'name avatar');

  return created(res, review, 'Review submitted');
});

exports.update = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');
  if (String(review.user) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only edit your own review');
  }

  ['rating', 'title', 'comment'].forEach((f) => {
    if (req.body[f] !== undefined) review[f] = req.body[f];
  });
  await review.save();
  await Review.syncProductRating(review.product);

  return ok(res, review, 'Review updated');
});

exports.remove = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');

  const isStaff = req.user.role !== 'customer';
  if (!isStaff && String(review.user) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only delete your own review');
  }

  const productId = review.product;
  await review.deleteOne();
  await Review.syncProductRating(productId);

  return ok(res, null, 'Review deleted');
});

exports.markHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { $inc: { helpfulCount: 1 } },
    { new: true },
  );
  if (!review) throw ApiError.notFound('Review not found');
  return ok(res, { helpfulCount: review.helpfulCount }, 'Thanks for the feedback');
});

/* -------------------------------- admin ------------------------------- */

exports.adminList = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const filter = {};
  if (req.query.approved === 'true') filter.isApproved = true;
  if (req.query.approved === 'false') filter.isApproved = false;
  if (req.query.rating) filter.rating = Number.parseInt(req.query.rating, 10);

  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('user', 'name email avatar')
      .populate('product', 'name slug images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total }, 'Reviews');
});

exports.moderate = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');

  review.isApproved = req.body.isApproved !== undefined
    ? Boolean(req.body.isApproved)
    : !review.isApproved;
  await review.save();
  await Review.syncProductRating(review.product);

  return ok(res, review, review.isApproved ? 'Review approved' : 'Review hidden');
});
