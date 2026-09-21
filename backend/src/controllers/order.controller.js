'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { orderNumber, trackingNumber } = require('../utils/ids');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { getOrCreateCart, buildCartPayload } = require('./cart.controller');
const { runInTransaction } = require('../utils/transaction');
const payment = require('../services/payment.service');
const {
  ORDER_STATUS,
  ORDER_FLOW,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
} = require('../config/constants');

/** Checkout preview: totals for the current cart without creating an order. */
exports.preview = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const payload = await buildCartPayload(cart);
  if (!payload.items.length) throw ApiError.badRequest('Your cart is empty');
  return ok(res, payload, 'Checkout preview');
});

exports.create = asyncHandler(async (req, res) => {
  const { shippingAddress, addressId, paymentMethod, card = {}, notes = '' } = req.body;

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw ApiError.badRequest('Unsupported payment method');
  }

  const cart = await getOrCreateCart(req.user._id);
  const payload = await buildCartPayload(cart);
  if (!payload.items.length) throw ApiError.badRequest('Your cart is empty');

  // Address: either an explicit body payload or one of the saved addresses.
  let address = shippingAddress;
  if (!address) {
    const user = await User.findById(req.user._id);
    const saved = addressId ? user.addresses.id(addressId) : user.defaultAddress;
    if (!saved) throw ApiError.badRequest('A shipping address is required');
    address = {
      fullName: saved.fullName,
      phone: saved.phone,
      street: saved.street,
      city: saved.city,
      state: saved.state,
      zipCode: saved.zipCode,
      country: saved.country,
    };
  }

  const order = await runInTransaction(async (session) => {
    // Atomically decrement stock; the guard rejects concurrent oversell.
    const reserved = [];
    try {
      for (const line of payload.items) {
        const result = await Product.updateOne(
          { _id: line.product._id, stock: { $gte: line.quantity } },
          { $inc: { stock: -line.quantity, soldCount: line.quantity } },
          { session },
        );
        if (result.modifiedCount === 0) {
          throw ApiError.conflict(line.product.name + ' just went out of stock');
        }
        reserved.push(line);
      }

      const charge = await payment.charge({
        method: paymentMethod,
        amount: payload.totals.total,
        card,
      });
      if (charge.status === PAYMENT_STATUS.FAILED) {
        throw ApiError.badRequest(charge.message || 'Payment failed');
      }

      const now = new Date();
      const eta = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      const docs = await Order.create(
        [
          {
            orderNumber: orderNumber(),
            user: req.user._id,
            customerName: req.user.name,
            customerEmail: req.user.email,
            items: payload.items.map((l) => ({
              product: l.product._id,
              name: l.product.name,
              image: l.product.image,
              sku: l.product.sku,
              price: l.price,
              quantity: l.quantity,
              variant: { name: l.variant.name || '', value: l.variant.value || '' },
              subtotal: l.subtotal,
            })),
            shippingAddress: address,
            payment: {
              method: paymentMethod,
              status: charge.status,
              transactionId: charge.transactionId || '',
              cardLast4: charge.cardLast4 || '',
              paidAt: charge.paidAt || null,
            },
            pricing: payload.totals,
            couponCode: payload.coupon ? payload.coupon.code : '',
            status: ORDER_STATUS.PENDING,
            timeline: [{ status: ORDER_STATUS.PENDING, note: 'Order placed', at: now }],
            trackingNumber: trackingNumber(),
            estimatedDelivery: eta,
            notes,
          },
        ],
        { session },
      );

      if (payload.coupon) {
        await Coupon.updateOne(
          { code: payload.coupon.code },
          { $inc: { usedCount: 1 } },
          { session },
        );
      }

      cart.items = [];
      cart.coupon = { code: '', discountType: '', discountValue: 0 };
      await cart.save({ session });

      return docs[0];
    } catch (err) {
      // Without a transaction there is no rollback, so release what we reserved.
      if (!session) {
        for (const line of reserved) {
          await Product.updateOne(
            { _id: line.product._id },
            { $inc: { stock: line.quantity, soldCount: -line.quantity } },
          );
        }
      }
      throw err;
    }
  });

  return created(res, order, 'Order placed successfully');
});

exports.myOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 10);
  const filter = { user: req.user._id };
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total }, 'Your orders');
});

exports.getOne = asyncHandler(async (req, res) => {
  const order = await findOrderForRequest(req);
  return ok(res, order, 'Order');
});

/** Compact payload for the "Order Tracking" screen. */
exports.track = asyncHandler(async (req, res) => {
  const order = await findOrderForRequest(req);

  const steps = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.DELIVERED,
  ];
  const doneAt = new Map(order.timeline.map((t) => [t.status, t.at]));
  const currentIndex = steps.indexOf(order.status);

  return ok(
    res,
    {
      orderNumber: order.orderNumber,
      status: order.status,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      estimatedDelivery: order.estimatedDelivery,
      cancelled: order.status === ORDER_STATUS.CANCELLED,
      itemCount: order.itemCount,
      steps: steps.map((s, i) => ({
        status: s,
        reached: order.status !== ORDER_STATUS.CANCELLED && i <= currentIndex,
        at: doneAt.get(s) || null,
      })),
      timeline: order.timeline,
    },
    'Order tracking',
  );
});

exports.cancel = asyncHandler(async (req, res) => {
  const order = await findOrderForRequest(req);

  if (![ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING].includes(order.status)) {
    throw ApiError.badRequest('This order can no longer be cancelled');
  }

  // Put the reserved stock back.
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { stock: item.quantity, soldCount: -item.quantity } },
    );
  }

  const refunded = await payment.refund(order);
  order.status = ORDER_STATUS.CANCELLED;
  order.cancelledAt = new Date();
  order.cancelReason = req.body.reason || 'Cancelled by customer';
  order.payment.status = refunded.status;
  order.timeline.push({ status: ORDER_STATUS.CANCELLED, note: order.cancelReason });
  await order.save();

  return ok(res, order, 'Order cancelled');
});

/* -------------------------------- admin ------------------------------- */

exports.adminList = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const filter = {};

  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.paymentStatus) filter['payment.status'] = req.query.paymentStatus;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ orderNumber: rx }, { customerName: rx }, { customerEmail: rx }];
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const [items, total] = await Promise.all([
    Order.find(filter).populate('user', 'name email avatar').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  const counts = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const statusCounts = Object.values(ORDER_STATUS).reduce((acc, s) => ({ ...acc, [s]: 0 }), { all: 0 });
  counts.forEach((c) => {
    statusCounts[c._id] = c.count;
    statusCounts.all += c.count;
  });

  return res.status(200).json({
    success: true,
    message: 'Orders',
    data: items,
    statusCounts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
});

exports.adminGetOne = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email phone avatar');
  if (!order) throw ApiError.notFound('Order not found');
  return ok(res, order, 'Order');
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, note = '' } = req.body;
  if (!Object.values(ORDER_STATUS).includes(status)) throw ApiError.badRequest('Unknown status');

  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status === status) return ok(res, order, 'Status unchanged');

  const allowed = ORDER_FLOW[order.status] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      'Cannot move an order from ' + order.status + ' to ' + status,
    );
  }

  if (status === ORDER_STATUS.CANCELLED) {
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity, soldCount: -item.quantity } },
      );
    }
    const refunded = await payment.refund(order);
    order.payment.status = refunded.status;
    order.cancelledAt = new Date();
    order.cancelReason = note || 'Cancelled by store';
  }

  if (status === ORDER_STATUS.DELIVERED) {
    order.deliveredAt = new Date();
    if (order.payment.method === 'cod') {
      order.payment.status = PAYMENT_STATUS.PAID;
      order.payment.paidAt = new Date();
    }
  }

  order.status = status;
  order.timeline.push({ status, note });
  await order.save();

  return ok(res, order, 'Order status updated');
});

exports.updateTracking = asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    {
      ...(req.body.trackingNumber !== undefined ? { trackingNumber: req.body.trackingNumber } : {}),
      ...(req.body.carrier !== undefined ? { carrier: req.body.carrier } : {}),
      ...(req.body.estimatedDelivery ? { estimatedDelivery: new Date(req.body.estimatedDelivery) } : {}),
    },
    { new: true },
  );
  if (!order) throw ApiError.notFound('Order not found');
  return ok(res, order, 'Tracking updated');
});

/* ------------------------------- helpers ------------------------------ */

/** Loads an order by id or orderNumber, enforcing ownership for customers. */
async function findOrderForRequest(req) {
  const { id } = req.params;
  const query = /^[0-9a-fA-F]{24}$/.test(id) ? { _id: id } : { orderNumber: id.toUpperCase() };

  const order = await Order.findOne(query);
  if (!order) throw ApiError.notFound('Order not found');

  const isStaff = req.user.role !== 'customer';
  if (!isStaff && String(order.user) !== String(req.user._id)) {
    throw ApiError.forbidden('This order belongs to another account');
  }
  return order;
}
