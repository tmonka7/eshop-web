'use strict';
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const ROOT = path.resolve(__dirname, '../../uploads');

function makeUploader(folder) {
  const dest = path.join(ROOT, folder);
  fs.mkdirSync(dest, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const base = path
        .basename(file.originalname, path.extname(file.originalname))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40);
      cb(null, base + '-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
    },
  });

  return multer({
    storage,
    limits: { fileSize: env.uploadMaxBytes, files: 8 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED.includes(file.mimetype)) {
        return cb(ApiError.badRequest('error.imageTypeNotAllowed'));
      }
      return cb(null, true);
    },
  });
}

/** Turns a stored file into a browser-reachable absolute URL. */
const publicUrl = (folder, filename) => env.publicUrl + '/uploads/' + folder + '/' + filename;

module.exports = {
  uploadProduct: makeUploader('products'),
  uploadAvatar: makeUploader('avatars'),
  uploadBanner: makeUploader('banners'),
  publicUrl,
  UPLOAD_ROOT: ROOT,
};
