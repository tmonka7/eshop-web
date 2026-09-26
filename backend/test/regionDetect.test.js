'use strict';
/* Unit tests for the product-area detector (no model needed): `npm test`. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  detectRegion, boxFromMask, sanitizeBox, sameBox, PIXELS_PER_PATCH,
} = require('../src/services/regionDetect');

/**
 * A gw x gh grid whose patches inside `box` (in patch units) carry one feature
 * direction and colour, and everything else another - a product on a plain
 * background as the model would see it.
 */
function syntheticGrid(gw, gh, box, { dim = 8, noise = 0.05, sameColour = false } = {}) {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  const inside = (x, y) => x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
  const patches = new Float32Array(gw * gh * dim);
  for (let y = 0; y < gh; y += 1) {
    for (let x = 0; x < gw; x += 1) {
      const hot = inside(x, y) ? 1 : 0;
      for (let k = 0; k < dim; k += 1) {
        patches[(y * gw + x) * dim + k] = (k === hot ? 1 : 0) + noise * rand();
      }
    }
  }
  const w = gw * PIXELS_PER_PATCH;
  const h = gh * PIXELS_PER_PATCH;
  const rgb = new Uint8Array(w * h * 3).fill(250);
  if (!sameColour) {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (inside(Math.floor(x / PIXELS_PER_PATCH), Math.floor(y / PIXELS_PER_PATCH))) {
          rgb.set([180, 40, 30], (y * w + x) * 3);
        }
      }
    }
  }
  return { patches, gw, gh, dim, rgb };
}

test('finds a product on a plain background', () => {
  const region = detectRegion(syntheticGrid(20, 15, { x: 5, y: 4, w: 6, h: 5 }));
  assert.equal(region.found, true);
  assert.deepEqual([region.x, region.y, region.w, region.h], [0.25, 0.2667, 0.3, 0.3333]);
});

test('the peak point, which prompts SAM2, lies on the product', () => {
  const { x, y, w, h, peak } = detectRegion(syntheticGrid(20, 15, { x: 5, y: 4, w: 6, h: 5 }));
  assert.ok(peak.x > x && peak.x < x + w, 'peak.x inside the box');
  assert.ok(peak.y > y && peak.y < y + h, 'peak.y inside the box');
});

test('uses the feature cue when the colours are identical', () => {
  const region = detectRegion(syntheticGrid(16, 16, { x: 9, y: 2, w: 4, h: 9 }, { sameColour: true }));
  assert.deepEqual([region.x, region.y, region.w, region.h], [0.5625, 0.125, 0.25, 0.5625]);
});

test('prefers the more central of two equal blobs', () => {
  const grid = syntheticGrid(20, 20, { x: 8, y: 8, w: 4, h: 4 });
  // A second, identical blob in the corner.
  const other = syntheticGrid(20, 20, { x: 1, y: 1, w: 4, h: 4 });
  for (let i = 0; i < 20 * 20; i += 1) {
    const x = i % 20;
    const y = Math.floor(i / 20);
    if (x >= 1 && x < 5 && y >= 1 && y < 5) grid.patches.set(other.patches.subarray(i * 8, i * 8 + 8), i * 8);
  }
  const region = detectRegion(grid);
  assert.equal(region.x, 0.4);
  assert.equal(region.y, 0.4);
});

test('reports nothing found when the whole photo is uniform', () => {
  const region = detectRegion(syntheticGrid(10, 10, { x: 0, y: 0, w: 0, h: 0 }, { noise: 0 }));
  assert.equal(region.found, false);
});

test('sanitizeBox clamps into the image and rejects junk', () => {
  assert.deepEqual(sanitizeBox({ x: -1, y: 0.5, w: 3, h: 0.1 }), { x: 0, y: 0.5, w: 1, h: 0.1 });
  assert.deepEqual(sanitizeBox('{"x":0.1,"y":0.2,"w":0.3,"h":0.4}'), { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  assert.equal(sanitizeBox({ x: 'a', y: 0, w: 1, h: 1 }), null);
  assert.equal(sanitizeBox('not json'), null);
  assert.equal(sanitizeBox(null), null);
  assert.equal(sanitizeBox({ x: 0.5, y: 0.5, w: 0, h: 0 }).w, 0.02);
});

test('sameBox tolerates rounding only', () => {
  assert.equal(sameBox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, { x: 0.1004, y: 0.2, w: 0.3, h: 0.4 }), true);
  assert.equal(sameBox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, { x: 0.12, y: 0.2, w: 0.3, h: 0.4 }), false);
  assert.equal(sameBox(null, { x: 0, y: 0, w: 1, h: 1 }), false);
});

/** A width x height mask (logits: +1 object, -1 background) with the given filled rectangles. */
function maskOf(width, height, rects) {
  const m = new Float32Array(width * height).fill(-1);
  for (const [x0, y0, w, h] of rects) {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) m[y * width + x] = 1;
  }
  return m;
}

test('boxFromMask bounds the object and ignores small specks', () => {
  // Object 40x20 at (10, 30); a 2x2 speck far away is < 10% of it.
  const box = boxFromMask(maskOf(100, 100, [[10, 30, 40, 20], [90, 90, 2, 2]]), 100, 100);
  assert.deepEqual([box.x, box.y, box.w, box.h], [0.1, 0.3, 0.4, 0.2]);
  assert.equal(box.area, 0.08);
});

test('boxFromMask keeps comparable separate parts', () => {
  // A cup body and its handle seen as two pieces: both belong in the box.
  const box = boxFromMask(maskOf(100, 100, [[10, 10, 30, 30], [50, 20, 10, 10]]), 100, 100);
  assert.deepEqual([box.x, box.y, box.w, box.h], [0.1, 0.1, 0.5, 0.3]);
});

test('boxFromMask returns null for an empty mask', () => {
  assert.equal(boxFromMask(maskOf(8, 8, []), 8, 8), null);
});
