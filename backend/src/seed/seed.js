'use strict';
/**
 * Seeds a complete, demo-ready store: categories, products (with generated
 * images), customers, addresses, orders spread over the last 6 months, reviews,
 * coupons and banners.
 *
 * Running it wipes every collection first, so it is safe to re-run:
 *   npm run seed
 */
const slugify = require('slugify');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { writePlaceholder } = require('./placeholder');
const data = require('./data');
const i18nSeed = require('./translations');
const { orderNumber, trackingNumber } = require('../utils/ids');
const { computeTotals } = require('../services/pricing.service');
const {
  ORDER_STATUS, PAYMENT_STATUS, ROLES, PERMISSIONS, CURRENCIES,
} = require('../config/constants');

const { User, Category, Product, Cart, Order, Review, Coupon, Banner } = require('../models');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function wipe() {
  await Promise.all([
    Category.deleteMany({}),
    Product.deleteMany({}),
    Cart.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
    Coupon.deleteMany({}),
    Banner.deleteMany({}),
    User.deleteMany({}),
  ]);
  console.log('[seed] collections cleared');
}

async function seedCategories() {
  const byName = new Map();

  for (const c of data.categories) {
    const image = writePlaceholder(
      'products',
      'category-' + slugify(c.name, { lower: true, strict: true }) + '.png',
      { from: c.color[0], to: c.color[1] },
    );
    const doc = await Category.create({
      name: c.name,
      description: c.description,
      icon: c.icon,
      order: c.order,
      image: env.publicUrl + image,
      translations: i18nSeed.translationsFor(i18nSeed.categories, c.name),
    });
    byName.set(c.name, doc);
  }

  for (const s of data.subCategories) {
    const parent = byName.get(s.parent);
    const doc = await Category.create({
      name: s.name,
      parent: parent ? parent._id : null,
      order: 100,
      icon: 'tag',
      translations: i18nSeed.translationsFor(i18nSeed.categories, s.name),
    });
    byName.set(s.name, doc);
  }

  console.log('[seed] ' + byName.size + ' categories');
  return byName;
}

async function seedProducts(categoriesByName) {
  const created = [];
  let index = 0;

  for (const p of data.products) {
    const category = categoriesByName.get(p.category);
    if (!category) {
      console.warn('[seed] skipping ' + p.name + ' - unknown category ' + p.category);
      continue;
    }

    const base = slugify(p.name, { lower: true, strict: true });
    const images = [1, 2, 3].map(
      (i) => env.publicUrl + writePlaceholder('products', base + '-' + i + '.png', {
        from: p.gradient[0],
        to: p.gradient[1],
        seed: i - 1,
      }),
    );

    const doc = await Product.create({
      name: p.name,
      description: p.description,
      shortDescription: p.shortDescription,
      translations: i18nSeed.translationsFor(i18nSeed.products, p.name),
      brand: p.brand,
      category: category._id,
      // Every fourth product is listed in REM, so the two-currency handling -
      // the coloured badges and the cart's single-currency guard - is
      // exercised by seeded data rather than only by hand-made rows.
      currency: index % 4 === 3 ? CURRENCIES.REM : CURRENCIES.USD,
      images,
      price: p.price,
      comparePrice: p.comparePrice || 0,
      cost: p.cost || 0,
      stock: p.stock,
      variants: p.variants || [],
      tags: p.tags || [],
      colors: p.colors || [],
      rating: p.rating || 0,
      soldCount: p.soldCount || 0,
      viewCount: randInt(300, 4000),
      isFeatured: Boolean(p.isFeatured),
      freeShipping: Boolean(p.freeShipping),
    });
    index += 1;
    created.push(doc);
  }

  console.log('[seed] ' + created.length + ' products');
  return created;
}

async function seedUsers() {
  const admin = await User.create({
    name: 'Store Admin',
    email: env.seed.adminEmail,
    password: env.seed.adminPassword,
    // The seeded account is the super admin: someone has to be able to create
    // the first regular administrator, and the API deliberately refuses to
    // mint a super admin over HTTP.
    role: ROLES.SUPER_ADMIN,
    phone: '+358 40 000 0000',
    addresses: [
      {
        label: 'Office',
        fullName: 'Store Admin',
        street: 'Mannerheimintie 1',
        city: 'Helsinki',
        state: 'Uusimaa',
        zipCode: '00100',
        country: 'Finland',
        isDefault: true,
      },
    ],
  });

  const manager = await User.create({
    name: 'Store Manager',
    email: 'manager@auramart.com',
    password: 'Manager@123',
    role: ROLES.MANAGER,
    // A regular staff account with a deliberately partial grant, so the
    // permission gates are exercised by the seed rather than only in theory.
    permissions: [PERMISSIONS.ORDERS, PERMISSIONS.REVIEWS, PERMISSIONS.CUSTOMERS],
  });

  const customers = [];
  for (let i = 0; i < data.customers.length; i += 1) {
    const c = data.customers[i];
    const user = await User.create({
      name: c.name,
      email: c.email,
      password: 'Password@123',
      phone: c.phone,
      role: ROLES.CUSTOMER,
      addresses: [
        {
          label: 'Home',
          fullName: c.name,
          phone: c.phone,
          street: randInt(1, 200) + ' Main Street',
          city: c.city,
          state: 'Uusimaa',
          zipCode: String(randInt(10, 99)) + '100',
          country: 'Finland',
          isDefault: true,
        },
      ],
    });
    // Mongoose stamps createdAt on save, so backdate it afterwards to give the
    // customer-growth chart six months of history.
    const joined = daysAgo(randInt(10, 180));
    await User.updateOne({ _id: user._id }, { $set: { createdAt: joined } }, { timestamps: false });
    user.createdAt = joined;

    customers.push(user);
    await Cart.create({ user: user._id, items: [] });
  }

  await Cart.create({ user: admin._id, items: [] });
  await Cart.create({ user: manager._id, items: [] });

  console.log('[seed] ' + (customers.length + 2) + ' users (admin: ' + env.seed.adminEmail + ')');
  return { admin, manager, customers };
}

async function seedOrders(customers, products) {
  const statuses = [
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.PENDING,
    ORDER_STATUS.CANCELLED,
  ];
  const methods = ['card', 'paypal', 'applepay', 'cod'];
  const orders = [];

  // 6 months of history so the dashboard charts have a real shape.
  for (let i = 0; i < 90; i += 1) {
    const customer = pick(customers);
    const address = customer.addresses[0];
    const createdAt = daysAgo(randInt(0, 180));
    const status = pick(statuses);

    const lineCount = randInt(1, 3);
    const chosen = [];
    while (chosen.length < lineCount) {
      const p = pick(products);
      if (!chosen.find((c) => String(c._id) === String(p._id))) chosen.push(p);
    }

    const items = chosen.map((p) => {
      const quantity = randInt(1, 3);
      return {
        product: p._id,
        name: p.name,
        image: p.images[0],
        sku: p.sku,
        price: p.price,
        quantity,
        variant: { name: '', value: '' },
        subtotal: Math.round(p.price * quantity * 100) / 100,
      };
    });

    const totals = computeTotals(
      items.map((it) => ({ price: it.price, quantity: it.quantity, freeShipping: false })),
    );

    const paid = status !== ORDER_STATUS.CANCELLED && status !== ORDER_STATUS.PENDING;
    const timeline = [{ status: ORDER_STATUS.PENDING, note: 'Order placed', at: createdAt }];
    const flow = [ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED];
    const upTo = flow.indexOf(status);
    for (let s = 0; s <= upTo; s += 1) {
      timeline.push({
        status: flow[s],
        note: '',
        at: new Date(createdAt.getTime() + (s + 1) * 24 * 60 * 60 * 1000),
      });
    }
    if (status === ORDER_STATUS.CANCELLED) {
      timeline.push({
        status: ORDER_STATUS.CANCELLED,
        note: 'Cancelled by customer',
        at: new Date(createdAt.getTime() + 12 * 60 * 60 * 1000),
      });
    }

    orders.push({
      orderNumber: orderNumber(),
      user: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      items,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        street: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
      },
      payment: {
        method: pick(methods),
        status: paid ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.UNPAID,
        transactionId: paid ? 'txn_seed_' + i : '',
        cardLast4: paid ? String(randInt(1000, 9999)) : '',
        paidAt: paid ? createdAt : null,
      },
      pricing: totals,
      status,
      timeline,
      trackingNumber: trackingNumber(),
      estimatedDelivery: new Date(createdAt.getTime() + 5 * 24 * 60 * 60 * 1000),
      deliveredAt: status === ORDER_STATUS.DELIVERED
        ? new Date(createdAt.getTime() + 4 * 24 * 60 * 60 * 1000)
        : null,
      cancelledAt: status === ORDER_STATUS.CANCELLED ? createdAt : null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // insertMany with timestamps off keeps our backdated createdAt values.
  const docs = await Order.insertMany(orders, { timestamps: false });
  console.log('[seed] ' + docs.length + ' orders');
  return docs;
}

async function seedReviews(customers, products, orders) {
  const delivered = orders.filter((o) => o.status === ORDER_STATUS.DELIVERED);
  const seen = new Set();
  const reviews = [];

  for (const order of delivered) {
    for (const item of order.items) {
      const key = String(order.user) + ':' + String(item.product);
      if (seen.has(key)) continue;
      if (Math.random() > 0.55) continue;
      seen.add(key);

      const snippet = pick(data.reviewSnippets);
      reviews.push({
        product: item.product,
        user: order.user,
        order: order._id,
        rating: snippet.rating,
        title: snippet.title,
        comment: snippet.comment,
        isApproved: true,
        isVerifiedPurchase: true,
        helpfulCount: randInt(0, 42),
        createdAt: new Date(order.createdAt.getTime() + 6 * 24 * 60 * 60 * 1000),
      });
    }
  }

  if (reviews.length) await Review.insertMany(reviews, { timestamps: false });

  for (const product of products) {
    await Review.syncProductRating(product._id);
  }

  console.log('[seed] ' + reviews.length + ' reviews');
}

async function seedPromotions() {
  await Coupon.insertMany(
    data.coupons.map((c) => ({
      ...c,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      usedCount: randInt(0, 20),
    })),
  );

  await Banner.insertMany(
    data.banners.map((b) => ({
      title: b.title,
      subtitle: b.subtitle,
      ctaText: b.ctaText,
      ctaLink: b.ctaLink,
      translations: i18nSeed.translationsFor(i18nSeed.banners, b.title),
      placement: b.placement,
      order: b.order,
      image: env.publicUrl + writePlaceholder(
        'banners',
        slugify(b.title, { lower: true, strict: true }) + '.png',
        { from: b.gradient[0], to: b.gradient[1] },
      ),
    })),
  );

  console.log('[seed] ' + data.coupons.length + ' coupons, ' + data.banners.length + ' banners');
}

async function run() {
  console.log('[seed] connecting to ' + env.mongoUri);
  await connectDB();

  await wipe();
  const categories = await seedCategories();
  const products = await seedProducts(categories);
  const { customers } = await seedUsers();
  const orders = await seedOrders(customers, products);
  await seedReviews(customers, products, orders);
  await seedPromotions();

  console.log('');
  console.log('  Seed complete.');
  console.log('  Admin    : ' + env.seed.adminEmail + ' / ' + env.seed.adminPassword);
  console.log('  Manager  : manager@auramart.com / Manager@123');
  console.log('  Customer : john@example.com / Password@123');
  console.log('');

  await disconnectDB();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('[seed] failed:', err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
