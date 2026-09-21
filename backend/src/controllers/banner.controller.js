'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildTranslations } = require('../utils/localize');
const { ok, created } = require('../utils/response');
const Banner = require('../models/Banner');

exports.list = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.placement) filter.placement = req.query.placement;
  const banners = await Banner.find(filter).sort({ order: 1, createdAt: -1 });
  return ok(res, banners, 'success.banners');
});

exports.adminList = asyncHandler(async (_req, res) => {
  const banners = await Banner.find().sort({ placement: 1, order: 1 });
  return ok(res, banners, 'success.banners');
});

exports.create = asyncHandler(async (req, res) => {
  const banner = await Banner.create({
    ...req.body,
    translations: buildTranslations(req.body.translations),
  });
  return created(res, banner, 'success.bannerCreated');
});

exports.update = asyncHandler(async (req, res) => {
  const existing = await Banner.findById(req.params.id);
  if (!existing) throw ApiError.notFound('error.bannerNotFound');

  const { translations, ...rest } = req.body;
  Object.assign(existing, rest);
  // Merge rather than assign: a PATCH carrying only `ja` must not wipe en/zh.
  if (translations) {
    existing.translations = buildTranslations(translations, existing.toObject().translations);
  }
  await existing.save();
  return ok(res, existing, 'success.bannerUpdated');
});

exports.remove = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) throw ApiError.notFound('error.bannerNotFound');
  return ok(res, null, 'success.bannerDeleted');
});
