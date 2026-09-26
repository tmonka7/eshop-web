'use strict';
/* Unit tests for the image-search index (no model or database needed): `npm test`. */
const test = require('node:test');
const assert = require('node:assert/strict');
const env = require('../src/config/env');
const { buildVectorIndex, loadFaiss } = require('../src/services/vectorIndex');

function randomUnit(dim, rand) {
  const v = new Float32Array(dim);
  let norm = 0;
  for (let i = 0; i < dim; i += 1) {
    v[i] = rand();
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < dim; i += 1) v[i] /= norm;
  return v;
}

/** `products` products with 1..maxImages random unit vectors each. */
function catalogue(products, maxImages, dim) {
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  const vectors = [];
  const owners = [];
  for (let p = 0; p < products; p += 1) {
    const images = 1 + (p % maxImages);
    for (let i = 0; i < images; i += 1) {
      vectors.push(randomUnit(dim, rand));
      owners.push(p);
    }
  }
  const matrix = new Float32Array(vectors.length * dim);
  vectors.forEach((v, i) => matrix.set(v, i * dim));
  return {
    data: {
      dim,
      matrix,
      rowProduct: Int32Array.from(owners),
      productIds: Array.from({ length: products }, (_, p) => 'p' + p),
    },
    query: randomUnit(dim, rand),
  };
}

/** Reference ranking: every product scored by its best image. */
function bruteForce({ dim, matrix, rowProduct, productIds }, query, { limit, minScore }) {
  const best = new Float64Array(productIds.length).fill(-Infinity);
  for (let row = 0; row < rowProduct.length; row += 1) {
    let dot = 0;
    for (let i = 0; i < dim; i += 1) dot += matrix[row * dim + i] * query[i];
    if (dot > best[rowProduct[row]]) best[rowProduct[row]] = dot;
  }
  return productIds
    .map((productId, p) => ({ productId, score: best[p] }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function withMode(mode, fn) {
  const saved = env.visualSearch.ann.mode;
  env.visualSearch.ann.mode = mode;
  try {
    return await fn();
  } finally {
    env.visualSearch.ann.mode = saved;
  }
}

const faiss = loadFaiss();

for (const mode of ['off', 'flat']) {
  test('exact index (' + mode + ') ranks products like a full scan', { skip: mode !== 'off' && !faiss }, async () => {
    const { data, query } = catalogue(500, 4, 32);
    const index = await withMode(mode, () => buildVectorIndex(data));
    assert.equal(index.backend, mode === 'off' ? 'js' : 'faiss-flat');

    const options = { limit: 20, minScore: -1 };
    const got = index.searchProducts(query, options);
    const want = bruteForce(data, query, options);
    assert.deepEqual(got.map((r) => r.productId), want.map((r) => r.productId));
    got.forEach((r, i) => assert.ok(Math.abs(r.score - want[i].score) < 1e-4));
    assert.equal(new Set(got.map((r) => r.productId)).size, got.length, 'each product appears once');
  });
}

test('minScore drops weak matches', async () => {
  const { data, query } = catalogue(200, 3, 16);
  const index = await withMode('off', () => buildVectorIndex(data));
  const hits = index.searchProducts(query, { limit: 200, minScore: 0.3 });
  assert.ok(hits.every((r) => r.score >= 0.3));
  assert.deepEqual(hits.map((r) => r.productId),
    bruteForce(data, query, { limit: 200, minScore: 0.3 }).map((r) => r.productId));
});

test('HNSW index finds most of the exact top results', { skip: !faiss }, async () => {
  const { data, query } = catalogue(3000, 3, 64);
  const index = await withMode('hnsw', () => buildVectorIndex(data));
  assert.equal(index.backend, 'faiss-hnsw');

  const options = { limit: 20, minScore: -1 };
  const want = new Set(bruteForce(data, query, options).map((r) => r.productId));
  const got = index.searchProducts(query, options);
  const recall = got.filter((r) => want.has(r.productId)).length / want.size;
  assert.ok(recall >= 0.8, 'recall ' + recall);
});

test('an empty catalogue returns no hits', async () => {
  const index = await buildVectorIndex({
    dim: 8, matrix: new Float32Array(0), rowProduct: new Int32Array(0), productIds: [],
  });
  assert.deepEqual(index.searchProducts(new Float32Array(8), { limit: 10, minScore: 0 }), []);
});
