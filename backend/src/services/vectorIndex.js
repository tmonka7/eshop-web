'use strict';
/**
 * Nearest-neighbour index over product image vectors, backed by FAISS.
 *
 * Vectors are L2-normalised, so cosine similarity is the inner product and
 * every backend uses an inner-product metric:
 *
 *  - 'faiss-flat'  IndexFlatIP: exact, SIMD brute force. Default for small
 *                  catalogues, where it returns exactly what a full scan would.
 *  - 'faiss-hnsw'  HNSW graph: approximate, sub-linear. Used from
 *                  env.visualSearch.ann.hnswMinRows rows up.
 *  - 'js'          plain JavaScript scan, used when faiss-node is not
 *                  installed (it is an optional dependency: its install
 *                  downloads a prebuilt binary, which fails on an offline host
 *                  or an unsupported platform) or when ANN is switched off.
 *
 * Every backend ranks image rows; searchProducts() folds them into products,
 * each scored by its best-matching image.
 */
const env = require('../config/env');

// Rows added to FAISS per call; the loop yields between chunks so building a
// large HNSW graph does not stall other requests.
const ADD_CHUNK_ROWS = 2000;
// Upper bound on rows fetched per query. Large k makes HNSW slow (its search
// breadth grows to k) and is never needed for a page of results.
const MAX_K = 4096;

let faissModule;
/** The faiss-node module, or null when it is not installed or will not load. */
function loadFaiss() {
  if (faissModule !== undefined) return faissModule;
  try {
    // eslint-disable-next-line global-require
    faissModule = require('faiss-node');
  } catch (err) {
    faissModule = null;
    console.warn('[visual] faiss-node unavailable, using the JavaScript scan: ' + err.message);
  }
  return faissModule;
}

const yieldToLoop = () => new Promise((resolve) => setImmediate(resolve));

/** Which backend to build for `rows` vectors under the current settings. */
function chooseBackend(rows) {
  const { mode, hnswMinRows } = env.visualSearch.ann;
  if (mode === 'off' || !loadFaiss()) return 'js';
  if (mode === 'flat') return 'faiss-flat';
  if (mode === 'hnsw') return 'faiss-hnsw';
  return rows >= hnswMinRows ? 'faiss-hnsw' : 'faiss-flat';
}

/* --------------------------------- backends -------------------------------- */

function jsBackend(dim, matrix, rows) {
  return {
    /** @returns {{ rows: Int32Array, scores: Float32Array }} best first */
    search(query, k, minScore) {
      const hitRows = [];
      const hitScores = [];
      for (let row = 0; row < rows; row += 1) {
        let dot = 0;
        const offset = row * dim;
        for (let i = 0; i < dim; i += 1) dot += matrix[offset + i] * query[i];
        if (dot >= minScore) {
          hitRows.push(row);
          hitScores.push(dot);
        }
      }
      const order = hitRows.map((_, i) => i).sort((a, b) => hitScores[b] - hitScores[a]).slice(0, k);
      return {
        rows: Int32Array.from(order, (i) => hitRows[i]),
        scores: Float32Array.from(order, (i) => hitScores[i]),
      };
    },
  };
}

async function faissBackend(kind, dim, matrix, rows) {
  const faiss = loadFaiss();
  const index = kind === 'faiss-hnsw'
    ? faiss.Index.fromFactory(dim, 'HNSW' + env.visualSearch.ann.hnswM + ',Flat', faiss.MetricType.METRIC_INNER_PRODUCT)
    : new faiss.IndexFlatIP(dim);

  // faiss-node only accepts plain arrays, hence the Array.from copies.
  for (let start = 0; start < rows; start += ADD_CHUNK_ROWS) {
    const end = Math.min(start + ADD_CHUNK_ROWS, rows);
    index.add(Array.from(matrix.subarray(start * dim, end * dim)));
    if (end < rows) await yieldToLoop();
  }

  return {
    search(query, k) {
      // FAISS rejects k > ntotal.
      const { labels, distances } = index.search(Array.from(query), Math.min(k, rows));
      const outRows = [];
      const outScores = [];
      for (let i = 0; i < labels.length; i += 1) {
        // HNSW pads with -1 when it finds fewer than k neighbours.
        if (labels[i] < 0) continue;
        outRows.push(labels[i]);
        outScores.push(distances[i]);
      }
      return { rows: Int32Array.from(outRows), scores: Float32Array.from(outScores) };
    },
  };
}

/* ---------------------------------- build ---------------------------------- */

/**
 * Builds a searchable index.
 *
 * @param {object} data
 * @param {number} data.dim
 * @param {Float32Array} data.matrix rows x dim, L2-normalised rows
 * @param {Int32Array} data.rowProduct product position of each row
 * @param {string[]} data.productIds
 */
async function buildVectorIndex({ dim, matrix, rowProduct, productIds }) {
  const startedAt = Date.now();
  const rows = rowProduct.length;

  // The most images any one product has: fetching limit x this many rows is
  // enough to see the best row of each of the top `limit` products.
  const perProduct = new Int32Array(productIds.length);
  let maxRowsPerProduct = 0;
  for (let row = 0; row < rows; row += 1) {
    const n = (perProduct[rowProduct[row]] += 1);
    if (n > maxRowsPerProduct) maxRowsPerProduct = n;
  }

  let backend = chooseBackend(rows);
  let impl;
  if (rows && backend !== 'js') {
    try {
      impl = await faissBackend(backend, dim, matrix, rows);
    } catch (err) {
      console.warn('[visual] building the ' + backend + ' index failed, using the JavaScript scan: ' + err.message);
      backend = 'js';
    }
  }
  if (!impl) impl = jsBackend(dim, matrix, rows);

  return {
    backend,
    dim,
    rows,
    products: productIds.length,
    builtAt: new Date(),
    buildMs: Date.now() - startedAt,

    /**
     * Products ranked by their best-matching image.
     * @param {Float32Array} query L2-normalised, `dim` long
     * @returns {Array<{ productId: string, score: number }>} best first
     */
    searchProducts(query, { limit, minScore }) {
      if (!rows) return [];
      const k = Math.min(rows, Math.max(limit, limit * maxRowsPerProduct), MAX_K);
      const hits = impl.search(query, k, minScore);
      const seen = new Set();
      const ranked = [];
      for (let i = 0; i < hits.rows.length && ranked.length < limit; i += 1) {
        const score = hits.scores[i];
        // Rows come best first, so nothing after this can qualify either.
        if (score < minScore) break;
        const p = rowProduct[hits.rows[i]];
        if (seen.has(p)) continue;
        seen.add(p);
        ranked.push({ productId: productIds[p], score });
      }
      return ranked;
    },
  };
}

module.exports = { buildVectorIndex, chooseBackend, loadFaiss };
