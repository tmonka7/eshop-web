'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok } = require('../utils/response');
const Product = require('../models/Product');
const visualSearch = require('../services/visualSearch.service');
const { ModelUnavailableError } = require('../services/dinov3.service');

/** Model state, index coverage and progress of any running re-index. */
exports.status = asyncHandler(async (req, res) => {
  return ok(res, await visualSearch.status({ detailed: true }), 'success.visualSearchStatus');
});

/**
 * Starts a background re-index of the whole catalogue. `force: true`
 * re-extracts every vector; otherwise only missing or stale ones are computed.
 */
exports.reindex = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await visualSearch.reindexAll({ force: Boolean(req.body && req.body.force) });
  } catch (err) {
    if (err instanceof ModelUnavailableError) throw new ApiError(503, 'error.visualSearchUnavailable');
    throw err;
  }
  const message = result.started ? 'success.visualReindexStarted' : 'success.visualReindexRunning';
  return ok(res, result.job, message, result.started ? 202 : 200);
});

/**
 * Detects the product area of a catalogue image (body `{ image: url }`) so the
 * admin can check or adjust the green box before saving.
 */
exports.detect = asyncHandler(async (req, res) => {
  const image = req.body && req.body.image;
  if (typeof image !== 'string' || !image) throw ApiError.badRequest('error.noImageUploaded');
  try {
    return ok(res, await visualSearch.detectForImage(image), 'success.visualRegionDetected');
  } catch (err) {
    if (err instanceof ModelUnavailableError) throw new ApiError(503, 'error.visualSearchUnavailable');
    if (err.code === 'ENOENT' || /unsupported|remote image|HTTP \d+/i.test(err.message)) {
      throw ApiError.badRequest('error.imageUnreadable');
    }
    throw err;
  }
});

/** Re-extracts one product's features synchronously and returns its new status. */
exports.reindexProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('error.productNotFound');
  const visualIndex = await visualSearch.indexProduct(product, { force: true });
  return ok(res, { _id: product._id, visualIndex }, 'success.visualProductIndexed');
});
