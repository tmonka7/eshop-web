'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const User = require('../models/User');
const { publicUrl } = require('../middleware/upload');
const { LOCALES } = require('../i18n');

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, language } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (phone !== undefined) update.phone = phone;
  if (language !== undefined) {
    if (!LOCALES.includes(language)) {
      throw ApiError.badRequest('error.unsupportedLanguage', undefined, {
        locales: LOCALES.join(', '),
      });
    }
    update.language = language;
  }

  const user = await User.findByIdAndUpdate(req.user._id, update, {
    new: true,
    runValidators: true,
  });
  return ok(res, user, 'success.profileUpdated');
});

/**
 * Standalone language switch, so a client can persist the picker without
 * sending the whole profile. Answers in the language just selected.
 */
exports.updateLanguage = asyncHandler(async (req, res) => {
  const { language } = req.body;
  if (!LOCALES.includes(language)) {
    throw ApiError.badRequest('error.unsupportedLanguage', undefined, {
      locales: LOCALES.join(', '),
    });
  }

  const user = await User.findByIdAndUpdate(req.user._id, { language }, { new: true });
  // Reply in the newly chosen language rather than the one the request arrived in.
  res.locals.locale = language;
  return ok(res, user, 'success.languageUpdated');
});

exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('error.noImageUploaded');
  const url = publicUrl('avatars', req.file.filename);
  const user = await User.findByIdAndUpdate(req.user._id, { avatar: url }, { new: true });
  return ok(res, user, 'success.avatarUpdated');
});

/* ----------------------------- addresses ----------------------------- */

exports.listAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  return ok(res, user.addresses, 'success.addresses');
});

exports.addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const isFirst = user.addresses.length === 0;
  user.addresses.push({ ...req.body, isDefault: isFirst || Boolean(req.body.isDefault) });
  await user.save();
  return created(res, user.addresses, 'success.addressAdded');
});

exports.updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('error.addressNotFound');

  Object.assign(address, req.body);
  if (req.body.isDefault) {
    user.addresses.forEach((a) => {
      a.isDefault = a._id.equals(address._id);
    });
  }
  await user.save();
  return ok(res, user.addresses, 'success.addressUpdated');
});

exports.deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('error.addressNotFound');

  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
  await user.save();
  return ok(res, user.addresses, 'success.addressRemoved');
});

exports.setDefaultAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('error.addressNotFound');

  user.addresses.forEach((a) => {
    a.isDefault = a._id.equals(address._id);
  });
  await user.save();
  return ok(res, user.addresses, 'success.defaultAddressUpdated');
});

/* ------------------------------ wishlist ----------------------------- */

exports.getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'wishlist',
    select: 'name slug price comparePrice images rating reviewCount stock brand translations',
    populate: { path: 'category', select: 'name slug translations' },
  });
  return ok(res, user.wishlist, 'success.wishlist');
});

exports.toggleWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const user = await User.findById(req.user._id);
  const index = user.wishlist.findIndex((id) => String(id) === productId);

  const added = index === -1;
  if (added) user.wishlist.push(productId);
  else user.wishlist.splice(index, 1);

  await user.save();
  return ok(res, { productId, inWishlist: added }, added ? 'success.addedToWishlist' : 'success.removedFromWishlist');
});
