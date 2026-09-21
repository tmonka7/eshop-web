'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const User = require('../models/User');
const { publicUrl } = require('../middleware/upload');

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (phone !== undefined) update.phone = phone;

  const user = await User.findByIdAndUpdate(req.user._id, update, {
    new: true,
    runValidators: true,
  });
  return ok(res, user, 'Profile updated');
});

exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image uploaded');
  const url = publicUrl('avatars', req.file.filename);
  const user = await User.findByIdAndUpdate(req.user._id, { avatar: url }, { new: true });
  return ok(res, user, 'Avatar updated');
});

/* ----------------------------- addresses ----------------------------- */

exports.listAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  return ok(res, user.addresses, 'Addresses');
});

exports.addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const isFirst = user.addresses.length === 0;
  user.addresses.push({ ...req.body, isDefault: isFirst || Boolean(req.body.isDefault) });
  await user.save();
  return created(res, user.addresses, 'Address added');
});

exports.updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('Address not found');

  Object.assign(address, req.body);
  if (req.body.isDefault) {
    user.addresses.forEach((a) => {
      a.isDefault = a._id.equals(address._id);
    });
  }
  await user.save();
  return ok(res, user.addresses, 'Address updated');
});

exports.deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('Address not found');

  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
  await user.save();
  return ok(res, user.addresses, 'Address removed');
});

exports.setDefaultAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('Address not found');

  user.addresses.forEach((a) => {
    a.isDefault = a._id.equals(address._id);
  });
  await user.save();
  return ok(res, user.addresses, 'Default address updated');
});

/* ------------------------------ wishlist ----------------------------- */

exports.getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'wishlist',
    select: 'name slug price comparePrice images rating reviewCount stock brand',
    populate: { path: 'category', select: 'name slug' },
  });
  return ok(res, user.wishlist, 'Wishlist');
});

exports.toggleWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const user = await User.findById(req.user._id);
  const index = user.wishlist.findIndex((id) => String(id) === productId);

  const added = index === -1;
  if (added) user.wishlist.push(productId);
  else user.wishlist.splice(index, 1);

  await user.save();
  return ok(res, { productId, inWishlist: added }, added ? 'Added to wishlist' : 'Removed from wishlist');
});
