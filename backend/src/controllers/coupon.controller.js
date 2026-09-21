'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const Coupon = require('../models/Coupon');

/** Public: promotions a shopper can see on the storefront. */
exports.listPublic = asyncHandler(async (_req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({
    isActive: true,
    startsAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
  })
    .select('code description discountType discountValue minPurchase expiresAt')
    .sort({ createdAt: -1 });
  return ok(res, coupons, 'success.availablePromotions');
});

exports.validate = asyncHandler(async (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  const subtotal = Number.parseFloat(req.query.subtotal) || 0;

  const coupon = await Coupon.findOne({ code });
  if (!coupon) throw ApiError.notFound('error.couponInvalid');

  const check = coupon.isRedeemable(subtotal);
  if (!check.ok) throw ApiError.badRequest(check.reason);

  return ok(
    res,
    { code: coupon.code, discount: coupon.computeDiscount(subtotal), description: coupon.description },
    'success.couponValid',
  );
});

/* -------------------------------- admin ------------------------------- */

exports.adminList = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const filter = {};
  if (req.query.status === 'active') filter.isActive = true;
  if (req.query.status === 'inactive') filter.isActive = false;

  const [items, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Coupon.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total }, 'success.coupons');
});

exports.create = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  return created(res, coupon, 'success.couponCreated');
});

exports.update = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!coupon) throw ApiError.notFound('error.couponNotFound');
  return ok(res, coupon, 'success.couponUpdated');
});

exports.remove = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw ApiError.notFound('error.couponNotFound');
  return ok(res, null, 'success.couponDeleted');
});
