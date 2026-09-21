'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const Banner = require('../models/Banner');

exports.list = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.placement) filter.placement = req.query.placement;
  const banners = await Banner.find(filter).sort({ order: 1, createdAt: -1 });
  return ok(res, banners, 'Banners');
});

exports.adminList = asyncHandler(async (_req, res) => {
  const banners = await Banner.find().sort({ placement: 1, order: 1 });
  return ok(res, banners, 'Banners');
});

exports.create = asyncHandler(async (req, res) => {
  const banner = await Banner.create(req.body);
  return created(res, banner, 'Banner created');
});

exports.update = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!banner) throw ApiError.notFound('Banner not found');
  return ok(res, banner, 'Banner updated');
});

exports.remove = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) throw ApiError.notFound('Banner not found');
  return ok(res, null, 'Banner deleted');
});
