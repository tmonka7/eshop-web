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
  if (!product) throw ApiError.notFound('error.productNotFound');

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

  return paginated(res, items, { page, limit, total }, 'success.reviews');
});

/** Star-bucket breakdown for the rating bars on a product page. */
exports.summaryForProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug }).select('_id rating reviewCount').lean();
  if (!product) throw ApiError.notFound('error.productNotFound');

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
    'success.reviewSummary',
  );
});

exports.create = asyncHandler(async (req, res) => {
  const { productId, rating, title = '', comment = '' } = req.body;

  const product = await Product.findById(productId);
  if (!product) throw ApiError.notFound('error.productNotFound');

  const existing = await Review.findOne({ product: productId, user: req.user._id });
  if (existing) throw ApiError.conflict('error.alreadyReviewed');

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

  return created(res, review, 'success.reviewSubmitted');
});

exports.update = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('error.reviewNotFound');
  if (String(review.user) !== String(req.user._id)) {
    throw ApiError.forbidden('error.editOwnReviewOnly');
  }

  ['rating', 'title', 'comment'].forEach((f) => {
    if (req.body[f] !== undefined) review[f] = req.body[f];
  });
  await review.save();
  await Review.syncProductRating(review.product);

  return ok(res, review, 'success.reviewUpdated');
});

exports.remove = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('error.reviewNotFound');

  const isStaff = req.user.role !== 'customer';
  if (!isStaff && String(review.user) !== String(req.user._id)) {
    throw ApiError.forbidden('error.deleteOwnReviewOnly');
  }

  const productId = review.product;
  await review.deleteOne();
  await Review.syncProductRating(productId);

  return ok(res, null, 'success.reviewDeleted');
});

exports.markHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { $inc: { helpfulCount: 1 } },
    { new: true },
  );
  if (!review) throw ApiError.notFound('error.reviewNotFound');
  return ok(res, { helpfulCount: review.helpfulCount }, 'success.thanksForFeedback');
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
      .populate('product', 'name slug images translations')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total }, 'success.reviews');
});

exports.moderate = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('error.reviewNotFound');

  review.isApproved = req.body.isApproved !== undefined
    ? Boolean(req.body.isApproved)
    : !review.isApproved;
  await review.save();
  await Review.syncProductRating(review.product);

  return ok(res, review, review.isApproved ? 'success.reviewApproved' : 'success.reviewHidden');
});
