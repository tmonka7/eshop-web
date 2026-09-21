'use strict';
const path = require('path');
const fs = require('fs/promises');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { publicUrl, UPLOAD_ROOT } = require('../middleware/upload');

exports.uploadImages = (folder) => asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) throw ApiError.badRequest('No image uploaded');

  const urls = files.map((f) => ({
    url: publicUrl(folder, f.filename),
    filename: f.filename,
    size: f.size,
    mimetype: f.mimetype,
  }));

  return created(res, urls, urls.length + ' image(s) uploaded');
});

exports.deleteImage = asyncHandler(async (req, res) => {
  const { folder, filename } = req.params;
  if (!['products', 'avatars', 'banners'].includes(folder)) {
    throw ApiError.badRequest('Unknown upload folder');
  }
  // Reject traversal attempts such as ..%2F..%2Fetc%2Fpasswd.
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw ApiError.badRequest('Invalid filename');
  }

  const target = path.join(UPLOAD_ROOT, folder, filename);
  if (!target.startsWith(path.join(UPLOAD_ROOT, folder))) {
    throw ApiError.badRequest('Invalid filename');
  }

  try {
    await fs.unlink(target);
  } catch (err) {
    if (err.code === 'ENOENT') throw ApiError.notFound('File not found');
    throw err;
  }

  return ok(res, null, 'Image deleted');
});
