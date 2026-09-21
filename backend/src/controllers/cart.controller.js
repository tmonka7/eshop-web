'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok } = require('../utils/response');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { computeTotals, shippingRules } = require('../services/pricing.service');

const CART_PRODUCT_FIELDS =
  'name slug price comparePrice currency images stock isActive freeShipping brand sku';

/**
 * Refuses to mix listing currencies in one cart.
 *
 * There is no exchange rate between USD and REM, so a cart holding both has
 * no total that means anything. The check reads the currency of whatever is
 * already in the cart and compares it with the incoming product; an empty
 * cart accepts either.
 */
async function assertSingleCurrency(cart, incoming) {
  if (!cart.items.length) return;

  const ids = cart.items.map((i) => i.product);
  const existing = await Product.find({ _id: { $in: ids } }).select('currency').lean();
  const current = existing.find((p) => p.currency && p.currency !== incoming.currency);
  if (!current) return;

  throw ApiError.badRequest('error.currencyMismatch', undefined, {
    existing: current.currency,
    incoming: incoming.currency,
  });
}

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

/**
 * Re-reads live product data, drops items whose product vanished or was
 * deactivated, clamps quantities to available stock and returns the totals.
 */
async function buildCartPayload(cart) {
  await cart.populate({ path: 'items.product', select: CART_PRODUCT_FIELDS });

  let mutated = false;
  const notices = [];
  const keep = [];

  for (const item of cart.items) {
    const p = item.product;
    if (!p || !p.isActive) {
      notices.push('An item was removed because it is no longer available');
      mutated = true;
      continue;
    }
    if (p.stock <= 0) {
      notices.push(p.name + ' is out of stock and was removed');
      mutated = true;
      continue;
    }
    if (item.quantity > p.stock) {
      notices.push(p.name + ' quantity reduced to the ' + p.stock + ' left in stock');
      item.quantity = p.stock;
      mutated = true;
    }
    if (item.priceAtAdd !== p.price) {
      item.priceAtAdd = p.price;
      mutated = true;
    }
    keep.push(item);
  }

  if (keep.length !== cart.items.length) cart.items = keep;
  if (mutated) await cart.save();

  const lines = cart.items.map((item) => {
    const p = item.product;
    const unitPrice = p.price + (item.variant && item.variant.priceDelta ? item.variant.priceDelta : 0);
    return {
      _id: item._id,
      product: {
        _id: p._id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        brand: p.brand,
        image: p.images[0] || '',
        images: p.images,
        price: p.price,
        comparePrice: p.comparePrice,
        stock: p.stock,
        freeShipping: p.freeShipping,
      },
      variant: item.variant,
      quantity: item.quantity,
      price: unitPrice,
      subtotal: Math.round(unitPrice * item.quantity * 100) / 100,
    };
  });

  const priced = lines.map((l) => ({
    price: l.price,
    quantity: l.quantity,
    freeShipping: l.product.freeShipping,
  }));

  let discount = 0;
  let coupon = null;
  if (cart.coupon && cart.coupon.code) {
    const doc = await Coupon.findOne({ code: cart.coupon.code });
    const subtotal = priced.reduce((s, i) => s + i.price * i.quantity, 0);
    const check = doc ? doc.isRedeemable(subtotal) : { ok: false, reason: 'Coupon not found' };
    if (check.ok) {
      discount = doc.computeDiscount(subtotal);
      coupon = { code: doc.code, discountType: doc.discountType, discountValue: doc.discountValue };
    } else {
      // Coupon stopped qualifying (cart shrank, expired, ...) -> detach it.
      cart.coupon = { code: '', discountType: '', discountValue: 0 };
      await cart.save();
      notices.push(check.reason);
    }
  }

  const totals = computeTotals(priced, { discount });

  return {
    _id: cart._id,
    items: lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    coupon,
    totals,
    rules: shippingRules(),
    notices,
  };
}

exports.getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  return ok(res, await buildCartPayload(cart), 'success.cart');
});

exports.addItem = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, variant = null } = req.body;

  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw ApiError.notFound('error.productNotFound');
  if (product.stock <= 0) throw ApiError.badRequest('error.productOutOfStock');

  const qty = Math.max(1, Number.parseInt(quantity, 10) || 1);
  const cart = await getOrCreateCart(req.user._id);

  // USD and REM are separate price universes with no rate between them, so a
  // mixed cart has no meaningful total. Rejecting the add is the only honest
  // option: silently summing the two numbers would invent a figure, and
  // picking one currency to display would misprice the other's lines.
  await assertSingleCurrency(cart, product);

  const variantValue = variant && variant.value ? variant.value : '';
  const existing = cart.items.find(
    (i) => String(i.product) === String(product._id) && (i.variant.value || '') === variantValue,
  );

  const alreadyIn = existing ? existing.quantity : 0;
  if (alreadyIn + qty > product.stock) {
    throw ApiError.badRequest('error.onlyNUnitsAvailable', undefined, { count: product.stock });
  }

  if (existing) {
    existing.quantity += qty;
    existing.priceAtAdd = product.price;
  } else {
    cart.items.push({
      product: product._id,
      quantity: qty,
      variant: variant || { name: '', value: '', hex: '' },
      priceAtAdd: product.price,
    });
  }

  await cart.save();
  return ok(res, await buildCartPayload(cart), 'success.addedToCart');
});

exports.updateItem = asyncHandler(async (req, res) => {
  const quantity = Number.parseInt(req.body.quantity, 10);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw ApiError.badRequest('error.quantityMin');
  }

  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw ApiError.notFound('error.cartItemNotFound');

  if (quantity === 0) {
    item.deleteOne();
  } else {
    const product = await Product.findById(item.product);
    if (!product) throw ApiError.notFound('error.productGone');
    if (quantity > product.stock) throw ApiError.badRequest('error.onlyNUnitsAvailable', undefined, { count: product.stock });
    item.quantity = quantity;
  }

  await cart.save();
  return ok(res, await buildCartPayload(cart), 'success.cartUpdated');
});

exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw ApiError.notFound('error.cartItemNotFound');
  item.deleteOne();
  await cart.save();
  return ok(res, await buildCartPayload(cart), 'success.itemRemoved');
});

exports.clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  cart.coupon = { code: '', discountType: '', discountValue: 0 };
  await cart.save();
  return ok(res, await buildCartPayload(cart), 'success.cartCleared');
});

exports.applyCoupon = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) throw ApiError.badRequest('error.couponCodeRequired');

  const cart = await getOrCreateCart(req.user._id);
  const payload = await buildCartPayload(cart);
  if (!payload.items.length) throw ApiError.badRequest('error.cartEmpty');

  const coupon = await Coupon.findOne({ code });
  if (!coupon) throw ApiError.notFound('error.couponInvalid');

  const check = coupon.isRedeemable(payload.totals.subtotal);
  if (!check.ok) throw ApiError.badRequest(check.reason);

  cart.coupon = {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
  };
  await cart.save();

  return ok(res, await buildCartPayload(cart), 'success.couponApplied');
});

exports.removeCoupon = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.coupon = { code: '', discountType: '', discountValue: 0 };
  await cart.save();
  return ok(res, await buildCartPayload(cart), 'success.couponRemoved');
});

/** Merges a guest (localStorage) cart into the signed-in cart after login. */
exports.mergeCart = asyncHandler(async (req, res) => {
  const incoming = Array.isArray(req.body.items) ? req.body.items : [];
  const cart = await getOrCreateCart(req.user._id);

  for (const raw of incoming) {
    const product = await Product.findById(raw.productId);
    if (!product || !product.isActive || product.stock <= 0) continue;

    const qty = Math.max(1, Number.parseInt(raw.quantity, 10) || 1);
    const variantValue = raw.variant && raw.variant.value ? raw.variant.value : '';
    const existing = cart.items.find(
      (i) => String(i.product) === String(product._id) && (i.variant.value || '') === variantValue,
    );

    if (existing) {
      existing.quantity = Math.min(existing.quantity + qty, product.stock);
    } else {
      cart.items.push({
        product: product._id,
        quantity: Math.min(qty, product.stock),
        variant: raw.variant || { name: '', value: '', hex: '' },
        priceAtAdd: product.price,
      });
    }
  }

  await cart.save();
  return ok(res, await buildCartPayload(cart), 'success.cartMerged');
});

module.exports.getOrCreateCart = getOrCreateCart;
module.exports.buildCartPayload = buildCartPayload;
