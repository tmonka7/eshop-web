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
 * Both sides embed only the product area of a photo, not the whole frame:
 * regionDetect.js finds it (the green box the clients draw) and a user can
 * override it - shoppers per search, admins per catalogue image.
 *
 * MongoDB 6 Community has no vector index, so search runs over an in-memory
 * FAISS index (vectorIndex.js) built from the collection: exact for small
 * catalogues, HNSW once it grows. It is rebuilt in the background after any
 * write; searches keep using the previous index until the new one is ready.
 */
const fs = require('fs/promises');
const path = require('path');
const env = require('../config/env');
const { VISUAL_INDEX_STATUS } = require('../config/constants');
const Product = require('../models/Product');
const ProductEmbedding = require('../models/ProductEmbedding');
const { UPLOAD_ROOT } = require('../middleware/upload');
const dinov3 = require('./dinov3.service');
const sam2 = require('./sam2.service');
const { buildVectorIndex } = require('./vectorIndex');
const {
  detectRegion, sanitizeBox, sameBox, DETECTOR_ID, PIXELS_PER_PATCH, WHOLE_IMAGE_COVERAGE,
} = require('./regionDetect');

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

/* ------------------------------ region detection -------------------------- */

const FULL_IMAGE = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

/**
 * Identifies how automatic regions are made right now: 'none' when detection
 * is off, the DINOv3 detector, or DINOv3 + SAM2. Stored with every product,
 * so switching SAM2 on or off re-detects the catalogue once.
 */
function detectorId() {
  if (!env.visualSearch.detect) return 'none';
  return sam2.usable() ? DETECTOR_ID + '+' + sam2.modelId() : DETECTOR_ID;
}

/**
 * Finds the product in a decoded image: DINOv3 decides which object is the
 * product, then SAM2 (when available) traces it and the box follows its
 * outline. On any SAM2 problem the DINOv3 box is used as it is.
 * @returns {Promise<{x,y,w,h,coverage,found,method}|null>} null when detection is off
 */
async function locate(image) {
  if (!env.visualSearch.detect) return null;
  const rough = detectRegion(await dinov3.patchGrid(image, env.visualSearch.detectSide, PIXELS_PER_PATCH));
  const { peak, ...region } = rough;
  // Nothing stood out: the whole photo is searched, there is nothing to trace.
  if (!rough.found || !sam2.usable()) return { ...region, method: 'dinov3' };
  try {
    const traced = await sam2.segment(image, { box: rough, point: peak });
    if (traced) {
      const coverage = Math.round(traced.w * traced.h * 10000) / 10000;
      return {
        x: traced.x, y: traced.y, w: traced.w, h: traced.h,
        coverage, found: coverage < WHOLE_IMAGE_COVERAGE, method: 'sam2',
      };
    }
  } catch (_err) {
    // Logged once by sam2.service; usable() is false from now on.
  }
  return { ...region, method: 'dinov3' };
}

/** The box to embed for an automatic region: the detection, or the whole image if nothing stood out. */
const autoBox = (found) => (found && found.found ? found : null);

/** Detects the product area of a stored catalogue image (admin "adjust area" dialog). */
async function detectForImage(src) {
  const image = await dinov3.decode(await loadImage(src));
  const found = await locate(image);
  return {
    ...(found || { ...FULL_IMAGE, coverage: 1, found: false }),
    auto: true,
    detector: detectorId(),
    width: image.width,
    height: image.height,
  };
}

/* ------------------------------ in-memory index --------------------------- */

// Bumped on every write; the cached index is stale when the two differ.
let generation = 0;
let cache = null; // { generation, model, index } - index from vectorIndex.js
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

  const index = await buildVectorIndex({ dim, matrix, rowProduct, productIds });
  console.log('[visual] ' + index.backend + ' index: ' + index.rows + ' vectors, '
    + index.products + ' products, built in ' + index.buildMs + ' ms');
  return { generation: startedGeneration, model, index };
}

async function getIndex() {
  const model = dinov3.modelId();
  const usable = cache && cache.model === model;
  if (usable && cache.generation === generation) return cache;
  if (!building) {
    building = buildIndex(model)
      .then((built) => {
        cache = built;
        return built;
      })
      .finally(() => {
        building = null;
      });
    // Callers that await `building` still see a failure; this only keeps a
    // background rebuild nobody waits on from being an unhandled rejection.
    building.catch((err) => console.error('[visual] index rebuild failed:', err.message));
  }
  // A large HNSW graph takes seconds to build, so meanwhile answer from the
  // previous one: removed or deactivated products are dropped again when the
  // hits are loaded, and new ones appear once it lands. The exact index
  // rebuilds quickly, and an empty one (built at boot before indexing
  // finished) must never be served, so otherwise wait for the fresh index.
  const serveStale = usable && cache.index.backend === 'faiss-hnsw' && cache.index.rows > 0;
  return serveStale ? cache : building;
}

/* -------------------------------- indexing -------------------------------- */

async function writeStatus(product, visualIndex, imageRegions) {
  const fields = { visualIndex: { detector: detectorId(), ...visualIndex } };
  if (imageRegions) fields.imageRegions = imageRegions;
  // updateOne rather than save(): no validation hooks, no updatedAt bump.
  await Product.updateOne({ _id: product._id }, { $set: fields }, { timestamps: false });
  Object.assign(product, fields);
  return fields.visualIndex;
}

/** The admin-set region for `src`, or null when the detector should choose. */
function manualRegion(product, src) {
  const r = (product.imageRegions || []).find((x) => x.image === src && x.auto === false);
  return r ? sanitizeBox(r) : null;
}

/** Whether a stored vector still matches how `src` should be cropped now. */
function isCurrent(embedding, manual) {
  if (manual) return embedding.regionAuto === false && sameBox(embedding.region, manual);
  return embedding.regionAuto !== false && embedding.detector === detectorId();
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
    }, []);
  }

  const existing = await ProductEmbedding.find({ product: product._id, model })
    .select('image region regionAuto detector')
    .lean();
  const byImage = new Map(existing.map((e) => [e.image, e]));
  // Regions shown in the admin panel: one per current image.
  const regions = new Map();
  const done = new Set();
  const todo = [];
  for (const src of images) {
    const manual = manualRegion(product, src);
    const stored = byImage.get(src);
    if (stored && isCurrent(stored, manual)) {
      done.add(src);
      regions.set(src, { image: src, ...(manual || stored.region || FULL_IMAGE), auto: !manual });
    } else {
      todo.push({ src, manual });
    }
  }
  const errors = [];

  for (const { src, manual } of todo) {
    let vector;
    let region;
    try {
      const image = await dinov3.decode(await loadImage(src));
      const box = manual || autoBox(await locate(image));
      region = sanitizeBox(box || FULL_IMAGE);
      vector = await dinov3.embed(image, box);
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
      {
        $set: {
          dim: vector.length,
          vector: ProductEmbedding.pack(vector),
          region,
          regionAuto: !manual,
          detector: detectorId(),
        },
      },
      { upsert: true },
    );
    regions.set(src, { image: src, ...region, auto: !manual });
    done.add(src);
    invalidate();
  }
  // Keep regions in image order, and keep an admin's region even if its
  // image failed to load this time.
  const imageRegions = images
    .map((src) => regions.get(src) || (product.imageRegions || []).find((r) => r.image === src))
    .filter(Boolean)
    .map((r) => ({ image: r.image, x: r.x, y: r.y, w: r.w, h: r.h, auto: r.auto !== false }));

  let status = VISUAL_INDEX_STATUS.INDEXED;
  if (errors.length) status = done.size ? VISUAL_INDEX_STATUS.PARTIAL : VISUAL_INDEX_STATUS.FAILED;
  if (errors.length) console.warn('[visual] ' + product.name + ': ' + errors.join('; '));

  return writeStatus(product, {
    status,
    model,
    vectors: done.size,
    error: errors.join('; ').slice(0, 500),
    indexedAt: new Date(),
  }, imageRegions);
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
 * missing, indexed by a different model before a swap, or cropped by another
 * region detector (automatic regions are then re-detected).
 */
function needsIndexFilter(model) {
  return {
    $or: [
      { 'visualIndex.status': { $in: [VISUAL_INDEX_STATUS.PENDING, VISUAL_INDEX_STATUS.UNAVAILABLE] } },
      { 'visualIndex.status': { $exists: false } },
      { 'visualIndex.model': { $nin: [model, '', null] } },
      { 'visualIndex.detector': { $ne: detectorId() } },
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
 * Ranks products by visual similarity to the product in a shopper's photo.
 *
 * @param {Buffer} buffer the encoded photo
 * @param {object} [options]
 * @param {object|string} [options.box] region chosen by the shopper (0..1);
 *   when absent the product area is detected automatically
 * @param {boolean} [options.detect=true] false embeds the whole photo
 * @returns {Promise<{ hits: Array<{ productId: string, score: number }>, region: object }>}
 *   hits best first; region is the box that was searched, for the client to draw
 */
async function search(buffer, { box, detect = true, ...options } = {}) {
  const image = await dinov3.decode(buffer);
  const chosen = box ? sanitizeBox(box) : null;
  let region;
  if (chosen) {
    region = { ...chosen, auto: false, found: true };
  } else {
    const found = detect ? await locate(image) : null;
    region = found ? { ...found, auto: true } : { ...FULL_IMAGE, coverage: 1, found: false, auto: true };
  }
  const embedBox = region.auto ? autoBox(region) : chosen;
  const hits = await searchVector(await dinov3.embed(image, embedBox), options);
  return {
    hits,
    region: {
      x: region.x,
      y: region.y,
      w: region.w,
      h: region.h,
      auto: region.auto,
      found: region.found,
      // 'sam2' (traced outline), 'dinov3' (patch box) or 'manual'
      method: region.auto ? region.method || 'dinov3' : 'manual',
    },
  };
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

  const { index } = await getIndex();
  if (!index.rows) return [];
  if (index.dim !== query.length) {
    const err = new Error('Expected a ' + index.dim + '-d vector, got ' + query.length);
    err.code = 'DIMENSION_MISMATCH';
    throw err;
  }

  return index.searchProducts(query, { limit, minScore })
    .map((r) => ({ ...r, score: Math.round(r.score * 10000) / 10000 }));
}

/* --------------------------------- status --------------------------------- */

async function status({ detailed = false } = {}) {
  const model = dinov3.status();
  const base = {
    ...model,
    available: model.enabled && model.filesPresent && !model.error,
    detector: detectorId(),
    segmenter: sam2.usable() ? sam2.modelId() : null,
  };
  // `model` lets on-device clients check their bundled network matches ours;
  // `segmenter` tells the Android app the server's boxes are SAM2-traced, so
  // it lets the server find the product instead of doing it on the phone.
  if (!detailed) {
    return {
      enabled: base.enabled, available: base.available, model: base.model, segmenter: base.segmenter,
    };
  }

  const [vectors, products, byStatus] = await Promise.all([
    ProductEmbedding.countDocuments({ model: model.model }),
    Product.countDocuments(),
    Product.aggregate([{ $group: { _id: '$visualIndex.status', count: { $sum: 1 } } }]),
  ]);
  return {
    ...base,
    sam2: sam2.status(),
    vectors,
    products,
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id || VISUAL_INDEX_STATUS.PENDING, s.count])),
    job: { ...job },
    // The search index currently served; null until the first search builds it.
    index: cache && {
      backend: cache.index.backend,
      rows: cache.index.rows,
      products: cache.index.products,
      builtAt: cache.index.builtAt,
      buildMs: cache.index.buildMs,
      stale: cache.generation !== generation,
    },
  };
}

/**
 * Called once the API is listening: loads the model in the background and,
 * if configured, indexes products that were created while it was missing
 * (for example a fresh seed on a host where the model was copied later).
 */
async function warmUp() {
  if (!env.visualSearch.enabled) return;
  // Settle whether SAM2 works before choosing what to re-index: the detector
  // id (and so which products count as stale) depends on it.
  if (env.visualSearch.detect && sam2.usable()) await sam2.load().catch(() => {});
  let pending = null;
  try {
    if (env.visualSearch.indexOnBoot) {
      const { started, job: j, done } = await reindexAll({ onlyPending: true });
      if (started && j.total) console.log('[visual] indexing ' + j.total + ' pending product(s) in the background');
      if (started) pending = done;
    } else {
      await dinov3.load();
    }
  } catch (err) {
    console.warn('[visual] image search unavailable: ' + err.message);
  }
  // Build the search index now rather than on the first shopper's search,
  // but only once the pending products are in it.
  await pending;
  getIndex().catch(() => {});
}

module.exports = {
  detectForImage,
  locate,
  detectorId,
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
