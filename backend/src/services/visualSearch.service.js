'use strict';
/**
 * Image-based product search on top of DINOv3 embeddings.
 *
 *  - indexProduct() embeds each product image and stores the vectors in the
 *    ProductEmbedding collection. The product controller calls it whenever a
 *    product is created or its images change.
 *  - search() embeds the shopper's photo and ranks products by cosine
 *    similarity, scoring each product by its best-matching image.
 *
 * MongoDB 6 Community has no vector index, so search runs over an in-memory
 * matrix built from the collection. It is rebuilt lazily after any write,
 * which is cheap at catalogue scale: 10k products x 3 images x 384 dims is
 * ~46 MB, and a full scan takes a few milliseconds.
 */
const fs = require('fs/promises');
const path = require('path');
const env = require('../config/env');
const { VISUAL_INDEX_STATUS } = require('../config/constants');
const Product = require('../models/Product');
const ProductEmbedding = require('../models/ProductEmbedding');
const { UPLOAD_ROOT } = require('../middleware/upload');
const dinov3 = require('./dinov3.service');

const REMOTE_TIMEOUT_MS = 10000;

/* ------------------------------ image loading ----------------------------- */

/**
 * Maps a stored image URL onto a file under uploads/. Only the path is looked
 * at, so rows saved under an older PUBLIC_URL still resolve.
 */
function localUploadPath(src) {
  let pathname;
  try {
    pathname = new URL(src, 'http://local').pathname;
  } catch (_err) {
    return null;
  }
  if (!pathname.startsWith('/uploads/')) return null;
  const full = path.resolve(UPLOAD_ROOT, decodeURIComponent(pathname.slice('/uploads/'.length)));
  // Refuse anything that climbs out of uploads/.
  return full.startsWith(UPLOAD_ROOT + path.sep) ? full : null;
}

async function loadImage(src) {
  const local = localUploadPath(src);
  if (local) return fs.readFile(local);
  if (!/^https?:\/\//i.test(src)) throw new Error('unsupported image reference');
  if (!env.visualSearch.fetchRemote) {
    throw new Error('remote image skipped (VISUAL_SEARCH_FETCH_REMOTE=false)');
  }
  const res = await fetch(src, { signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

/* ------------------------------ in-memory index --------------------------- */

// Bumped on every write; the cached matrix is stale when the two differ.
let generation = 0;
let cache = null; // { generation, model, dim, matrix, rowProduct, productIds }
let building = null;

function invalidate() {
  generation += 1;
}

async function buildIndex(model) {
  const startedGeneration = generation;
  // Inactive products are left out here rather than filtered after ranking,
  // so they can never push live products out of the top results.
  const activeIds = new Set(
    (await Product.find({ isActive: true }).select('_id').lean()).map((p) => String(p._id)),
  );

  const rows = [];
  const productIndex = new Map();
  const productIds = [];
  let dim = 0;

  const cursor = ProductEmbedding.find({ model }).select('product dim vector').lean().cursor();
  for await (const doc of cursor) {
    const id = String(doc.product);
    if (!activeIds.has(id)) continue;
    const vector = ProductEmbedding.unpack(doc.vector);
    if (!dim) dim = vector.length;
    if (vector.length !== dim) continue;
    if (!productIndex.has(id)) {
      productIndex.set(id, productIds.length);
      productIds.push(id);
    }
    rows.push({ product: productIndex.get(id), vector });
  }

  const matrix = new Float32Array(rows.length * dim);
  const rowProduct = new Int32Array(rows.length);
  rows.forEach((row, i) => {
    matrix.set(row.vector, i * dim);
    rowProduct[i] = row.product;
  });

  return { generation: startedGeneration, model, dim, matrix, rowProduct, productIds };
}

async function getIndex() {
  const model = dinov3.modelId();
  if (cache && cache.generation === generation && cache.model === model) return cache;
  if (!building) {
    building = buildIndex(model)
      .then((built) => {
        cache = built;
        return built;
      })
      .finally(() => {
        building = null;
      });
  }
  return building;
}

/* -------------------------------- indexing -------------------------------- */

async function writeStatus(product, visualIndex) {
  // updateOne rather than save(): no validation hooks, no updatedAt bump.
  await Product.updateOne({ _id: product._id }, { $set: { visualIndex } }, { timestamps: false });
  product.visualIndex = visualIndex; // eslint-disable-line no-param-reassign
  return visualIndex;
}

/**
 * Brings one product's vectors in line with its current images: embeds new
 * images, drops vectors for removed ones, and records the outcome on
 * product.visualIndex. Never throws for per-image problems - they are
 * reported in the status instead - so a product save cannot fail because of
 * the index.
 *
 * @param {import('mongoose').Document|string} productOrId
 * @param {{ force?: boolean }} [options] force re-embeds every image.
 */
async function indexProduct(productOrId, { force = false } = {}) {
  const product = productOrId instanceof Product ? productOrId : await Product.findById(productOrId);
  if (!product) return null;

  const model = dinov3.modelId();
  const images = [...new Set((product.images || []).filter(Boolean))];

  // Vectors for removed images, or from a different model, are dead weight.
  const stale = force
    ? { product: product._id }
    : { product: product._id, $or: [{ model: { $ne: model } }, { image: { $nin: images } }] };
  const removed = await ProductEmbedding.deleteMany(stale);
  if (removed.deletedCount) invalidate();

  if (!images.length) {
    return writeStatus(product, {
      status: VISUAL_INDEX_STATUS.NO_IMAGES, model, vectors: 0, error: '', indexedAt: new Date(),
    });
  }

  const existing = await ProductEmbedding.find({ product: product._id, model }).select('image').lean();
  const done = new Set(existing.map((e) => e.image));
  const todo = images.filter((src) => !done.has(src));
  const errors = [];

  for (const src of todo) {
    let vector;
    try {
      vector = await dinov3.embed(await loadImage(src));
    } catch (err) {
      if (err instanceof dinov3.ModelUnavailableError) {
        return writeStatus(product, {
          status: VISUAL_INDEX_STATUS.UNAVAILABLE, model, vectors: done.size, error: err.message,
        });
      }
      // ENOENT messages carry the absolute server path; keep that out of the admin UI.
      errors.push(path.basename(src) + ': ' + (err.code === 'ENOENT' ? 'file not found' : err.message));
      continue;
    }
    await ProductEmbedding.updateOne(
      { product: product._id, image: src, model },
      { $set: { dim: vector.length, vector: ProductEmbedding.pack(vector) } },
      { upsert: true },
    );
    done.add(src);
    invalidate();
  }

  let status = VISUAL_INDEX_STATUS.INDEXED;
  if (errors.length) status = done.size ? VISUAL_INDEX_STATUS.PARTIAL : VISUAL_INDEX_STATUS.FAILED;
  if (errors.length) console.warn('[visual] ' + product.name + ': ' + errors.join('; '));

  return writeStatus(product, {
    status,
    model,
    vectors: done.size,
    error: errors.join('; ').slice(0, 500),
    indexedAt: new Date(),
  });
}

/**
 * The controller-facing wrapper: indexing problems are logged, never thrown,
 * so creating or editing a product always succeeds.
 */
async function indexProductSafely(product, options) {
  try {
    return await indexProduct(product, options);
  } catch (err) {
    console.error('[visual] indexing ' + (product && product._id) + ' failed:', err.message);
    return null;
  }
}

async function removeProduct(productId) {
  await ProductEmbedding.deleteMany({ product: productId });
  invalidate();
}

/* ----------------------------- bulk re-indexing --------------------------- */

const job = {
  running: false,
  force: false,
  total: 0,
  processed: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
};

/**
 * Products that still need a pass: never indexed, indexed while the model was
 * missing, or indexed by a different model before a swap.
 */
function needsIndexFilter(model) {
  return {
    $or: [
      { 'visualIndex.status': { $in: [VISUAL_INDEX_STATUS.PENDING, VISUAL_INDEX_STATUS.UNAVAILABLE] } },
      { 'visualIndex.status': { $exists: false } },
      { 'visualIndex.model': { $nin: [model, '', null] } },
    ],
  };
}

async function runJob(filter, force) {
  try {
    for await (const product of Product.find(filter).cursor()) {
      const result = await indexProductSafely(product, { force });
      job.processed += 1;
      if (!result || [VISUAL_INDEX_STATUS.FAILED, VISUAL_INDEX_STATUS.UNAVAILABLE].includes(result.status)) {
        job.failed += 1;
      }
    }
  } catch (err) {
    job.error = err.message;
    console.error('[visual] re-index stopped:', err.message);
  } finally {
    job.running = false;
    job.finishedAt = new Date();
    console.log('[visual] re-index finished: ' + job.processed + '/' + job.total + ', ' + job.failed + ' failed');
  }
}

/**
 * Starts a background pass over the catalogue and returns immediately; poll
 * status() for progress. `onlyPending` limits it to products that were never
 * indexed (used at boot). Rejects with ModelUnavailableError up front so the
 * caller can report a missing model instead of marking every product failed.
 */
async function reindexAll({ force = false, onlyPending = false } = {}) {
  if (job.running) return { started: false, job: { ...job } };
  await dinov3.load();

  const filter = onlyPending ? needsIndexFilter(dinov3.modelId()) : {};
  Object.assign(job, {
    running: true,
    force,
    total: await Product.countDocuments(filter),
    processed: 0,
    failed: 0,
    startedAt: new Date(),
    finishedAt: null,
    error: null,
  });
  // Deliberately not awaited: the job runs in the background.
  const run = runJob(filter, force);
  return { started: true, job: { ...job }, done: run };
}

/* --------------------------------- search --------------------------------- */

/**
 * Ranks products by visual similarity to `buffer`.
 * @returns {Promise<Array<{ productId: string, score: number }>>} best first
 */
async function search(buffer, options) {
  return searchVector(await dinov3.embed(buffer), options);
}

/**
 * Ranks products against a feature vector computed elsewhere - the Android
 * app runs the same DINOv3 model on the phone and sends only the vector.
 * The vector is L2-normalised here, so callers may send it raw.
 * @param {ArrayLike<number>} vector
 */
async function searchVector(vector, { limit = 24, minScore = env.visualSearch.minScore } = {}) {
  const query = Float32Array.from(vector);
  let norm = 0;
  for (let i = 0; i < query.length; i += 1) norm += query[i] * query[i];
  norm = Math.sqrt(norm);
  if (!norm) return [];
  for (let i = 0; i < query.length; i += 1) query[i] /= norm;

  const index = await getIndex();
  if (!index.rowProduct.length) return [];
  if (index.dim !== query.length) {
    const err = new Error('Expected a ' + index.dim + '-d vector, got ' + query.length);
    err.code = 'DIMENSION_MISMATCH';
    throw err;
  }

  const { dim, matrix, rowProduct, productIds } = index;
  const best = new Float32Array(productIds.length).fill(-Infinity);
  for (let row = 0; row < rowProduct.length; row += 1) {
    let dot = 0;
    const offset = row * dim;
    for (let k = 0; k < dim; k += 1) dot += matrix[offset + k] * query[k];
    const p = rowProduct[row];
    if (dot > best[p]) best[p] = dot;
  }

  const ranked = [];
  for (let p = 0; p < best.length; p += 1) {
    if (best[p] >= minScore) ranked.push({ productId: productIds[p], score: best[p] });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((r) => ({ ...r, score: Math.round(r.score * 10000) / 10000 }));
}

/* --------------------------------- status --------------------------------- */

async function status({ detailed = false } = {}) {
  const model = dinov3.status();
  const base = { ...model, available: model.enabled && model.filesPresent && !model.error };
  // `model` lets on-device clients check their bundled network matches ours.
  if (!detailed) return { enabled: base.enabled, available: base.available, model: base.model };

  const [vectors, products, byStatus] = await Promise.all([
    ProductEmbedding.countDocuments({ model: model.model }),
    Product.countDocuments(),
    Product.aggregate([{ $group: { _id: '$visualIndex.status', count: { $sum: 1 } } }]),
  ]);
  return {
    ...base,
    vectors,
    products,
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id || VISUAL_INDEX_STATUS.PENDING, s.count])),
    job: { ...job },
  };
}

/**
 * Called once the API is listening: loads the model in the background and,
 * if configured, indexes products that were created while it was missing
 * (for example a fresh seed on a host where the model was copied later).
 */
async function warmUp() {
  if (!env.visualSearch.enabled) return;
  try {
    if (env.visualSearch.indexOnBoot) {
      const { started, job: j } = await reindexAll({ onlyPending: true });
      if (started && j.total) console.log('[visual] indexing ' + j.total + ' pending product(s) in the background');
    } else {
      await dinov3.load();
    }
  } catch (err) {
    console.warn('[visual] image search unavailable: ' + err.message);
  }
}

module.exports = {
  indexProduct,
  indexProductSafely,
  removeProduct,
  reindexAll,
  search,
  searchVector,
  status,
  warmUp,
  invalidate,
};
