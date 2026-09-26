'use strict';
/**
 * Finds the product in a photo without a detection model of its own: it
 * reuses the DINOv3 patch tokens the search model already produces.
 *
 * Every 16x16 patch gets a "foreground" score from two cues:
 *
 *  1. Feature cue - how unlike the image border the patch is. The border is
 *     taken as a sample of the background; a patch whose DINOv3 feature is far
 *     from its k most similar border patches belongs to something else.
 *  2. Colour cue - the mean RGB distance of the patch's pixels from the
 *     median border colour. It sharpens the edge on plain backgrounds, where
 *     features of the background next to the object still look "object-ish".
 *
 * score = norm(feature * (0.3 + 0.7 * colour)). Patches above
 * max(Otsu, 0.55 * max) form the mask; the connected component with the most
 * centre-weighted score is the product, and its bounding box is returned in
 * image fractions (0..1), with the component's strongest point (`peak`).
 * The same box algorithm runs on Android (util/RegionDetector.java); keep the
 * two in step.
 *
 * On the server the box and peak then prompt SAM2 (sam2.service.js), which
 * traces the object's outline; boxFromMask() turns that mask into the final
 * box. The DINOv3 box alone is patch-quantised and often cuts into or spills
 * past the object; SAM2 fixes the edges, DINOv3 picks which object.
 *
 * Pure functions only - no I/O - so it can be unit tested with plain arrays.
 */

const COLOR_SCALE = 48; // RGB distance treated as "clearly different"
const COLOR_WEIGHT = 0.7;
const REL_THRESHOLD = 0.55;
const OTSU_BINS = 64;
const PIXELS_PER_PATCH = 8; // colour cue sampled on an 8x8 grid per patch
/** A box covering more than this is reported as "nothing specific found". */
const WHOLE_IMAGE_COVERAGE = 0.92;
const DETECTOR_ID = 'dinov3-border-v1';

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Robust min-max scaling to [0, 1] using the 2nd and 98th percentiles. */
function normalize01(values) {
  const sorted = Float64Array.from(values).sort();
  const lo = percentile(sorted, 0.02);
  const hi = percentile(sorted, 0.98);
  const span = hi - lo + 1e-6;
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    out[i] = Math.min(1, Math.max(0, (values[i] - lo) / span));
  }
  return out;
}

function isBorder(i, gw, gh) {
  const x = i % gw;
  const y = Math.floor(i / gw);
  return x === 0 || y === 0 || x === gw - 1 || y === gh - 1;
}

/** Feature cue: dissimilarity of each patch to its k most similar border patches. */
function featureCue(patches, gw, gh, dim) {
  const n = gw * gh;
  const unit = new Float32Array(n * dim);
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    for (let k = 0; k < dim; k += 1) sum += patches[i * dim + k] ** 2;
    const norm = Math.sqrt(sum) || 1;
    for (let k = 0; k < dim; k += 1) unit[i * dim + k] = patches[i * dim + k] / norm;
  }
  const border = [];
  for (let i = 0; i < n; i += 1) if (isBorder(i, gw, gh)) border.push(i);
  const topK = Math.max(3, Math.floor(border.length / 8));

  const raw = new Float32Array(n);
  const sims = new Float32Array(border.length);
  for (let i = 0; i < n; i += 1) {
    for (let b = 0; b < border.length; b += 1) {
      let dot = 0;
      const o1 = i * dim;
      const o2 = border[b] * dim;
      for (let k = 0; k < dim; k += 1) dot += unit[o1 + k] * unit[o2 + k];
      sims[b] = dot;
    }
    sims.sort();
    let top = 0;
    for (let t = 0; t < topK; t += 1) top += sims[sims.length - 1 - t];
    raw[i] = -top / topK;
  }
  return normalize01(raw);
}

function median(values) {
  const sorted = Float64Array.from(values).sort();
  return percentile(sorted, 0.5);
}

/**
 * Colour cue from an RGB buffer of (gw*8) x (gh*8) pixels: mean distance of
 * each patch's pixels from the median colour of the outermost pixel ring.
 */
function colorCue(rgb, gw, gh) {
  const w = gw * PIXELS_PER_PATCH;
  const h = gh * PIXELS_PER_PATCH;
  const ring = [[], [], []];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        const o = (y * w + x) * 3;
        for (let c = 0; c < 3; c += 1) ring[c].push(rgb[o + c]);
      }
    }
  }
  const bg = ring.map(median);
  const cue = new Float32Array(gw * gh);
  const perPatch = PIXELS_PER_PATCH * PIXELS_PER_PATCH;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * 3;
      const d = Math.hypot(rgb[o] - bg[0], rgb[o + 1] - bg[1], rgb[o + 2] - bg[2]);
      cue[Math.floor(y / PIXELS_PER_PATCH) * gw + Math.floor(x / PIXELS_PER_PATCH)] += d / perPatch;
    }
  }
  for (let i = 0; i < cue.length; i += 1) cue[i] = Math.min(1, cue[i] / COLOR_SCALE);
  return cue;
}

/** Otsu's threshold over [0, 1] with a fixed 64-bin histogram. */
function otsu(values) {
  const hist = new Float64Array(OTSU_BINS);
  for (const v of values) hist[Math.min(OTSU_BINS - 1, Math.floor(v * OTSU_BINS))] += 1;
  const total = values.length;
  let best = -1;
  let threshold = 0.5;
  for (let i = 1; i < OTSU_BINS; i += 1) {
    let w0 = 0;
    let s0 = 0;
    let s1 = 0;
    for (let b = 0; b < OTSU_BINS; b += 1) {
      const p = hist[b] / total;
      const centre = (b + 0.5) / OTSU_BINS;
      if (b < i) {
        w0 += p;
        s0 += p * centre;
      } else {
        s1 += p * centre;
      }
    }
    const w1 = 1 - w0;
    if (w0 <= 0 || w1 <= 0) continue;
    const variance = w0 * w1 * (s0 / w0 - s1 / w1) ** 2;
    if (variance > best) {
      best = variance;
      threshold = (i + 0.5) / OTSU_BINS;
    }
  }
  return threshold;
}

/** 4-connected components of `mask`; returns the component id per cell (0 = none). */
function label(mask, gw, gh) {
  const labels = new Int32Array(gw * gh);
  let next = 0;
  const stack = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || labels[start]) continue;
    next += 1;
    labels[start] = next;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      const x = i % gw;
      const y = Math.floor(i / gw);
      const neighbours = [
        x > 0 ? i - 1 : -1, x < gw - 1 ? i + 1 : -1, y > 0 ? i - gw : -1, y < gh - 1 ? i + gw : -1,
      ];
      for (const j of neighbours) {
        if (j >= 0 && mask[j] && !labels[j]) {
          labels[j] = next;
          stack.push(j);
        }
      }
    }
  }
  return { labels, count: next };
}

/**
 * @param {{ patches: Float32Array, gw: number, gh: number, dim: number, rgb: Uint8Array }} input
 *   patches: gw*gh patch tokens row-major; rgb: (gw*8)x(gh*8) RGB pixels.
 * @returns {{ x: number, y: number, w: number, h: number, coverage: number, found: boolean,
 *   peak: { x: number, y: number } }} peak: centre of the patch with the highest
 *   3x3-smoothed score inside the chosen component - a point on the product
 */
function detectRegion({ patches, gw, gh, dim, rgb }) {
  const feature = featureCue(patches, gw, gh, dim);
  const color = colorCue(rgb, gw, gh);
  const combined = new Float32Array(gw * gh);
  for (let i = 0; i < combined.length; i += 1) {
    combined[i] = feature[i] * (1 - COLOR_WEIGHT + COLOR_WEIGHT * color[i]);
  }
  const score = normalize01(combined);

  let max = 0;
  for (const v of score) max = Math.max(max, v);
  const threshold = Math.max(otsu(score), REL_THRESHOLD * max);
  const mask = Uint8Array.from(score, (v) => (v >= threshold ? 1 : 0));
  const { labels, count } = label(mask, gw, gh);
  if (!count) return { x: 0, y: 0, w: 1, h: 1, coverage: 1, found: false, peak: { x: 0.5, y: 0.5 } };

  // Prefer the component with the most score, weighted towards the centre.
  const weight = new Float64Array(count + 1);
  for (let i = 0; i < labels.length; i += 1) {
    if (!labels[i]) continue;
    const cx = ((i % gw) + 0.5) / gw - 0.5;
    const cy = (Math.floor(i / gw) + 0.5) / gh - 0.5;
    weight[labels[i]] += score[i] * (1 - 0.5 * Math.hypot(cx, cy));
  }
  let bestLabel = 1;
  for (let l = 2; l <= count; l += 1) if (weight[l] > weight[bestLabel]) bestLabel = l;

  let x0 = gw;
  let y0 = gh;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < labels.length; i += 1) {
    if (labels[i] !== bestLabel) continue;
    const x = i % gw;
    const y = Math.floor(i / gw);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const box = { x: x0 / gw, y: y0 / gh, w: (x1 + 1 - x0) / gw, h: (y1 + 1 - y0) / gh };
  const coverage = box.w * box.h;
  return {
    ...roundBox(box),
    coverage: round4(coverage),
    found: coverage < WHOLE_IMAGE_COVERAGE,
    peak: peakOf(score, labels, bestLabel, gw, gh),
  };
}

/**
 * Centre of the component's patch with the highest 3x3 mean score. The
 * smoothing keeps the point off thin or noisy spots, so it lands well inside
 * the product - SAM2 then segments the object under it.
 */
function peakOf(score, labels, target, gw, gh) {
  let best = -1;
  let at = 0;
  for (let i = 0; i < labels.length; i += 1) {
    if (labels[i] !== target) continue;
    const x = i % gw;
    const y = Math.floor(i / gw);
    let sum = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        // Outside the grid counts as 0, which nudges the point away from the photo edge.
        if (nx >= 0 && ny >= 0 && nx < gw && ny < gh) sum += score[ny * gw + nx];
      }
    }
    if (sum > best) {
      best = sum;
      at = i;
    }
  }
  return { x: round4(((at % gw) + 0.5) / gw), y: round4((Math.floor(at / gw) + 0.5) / gh) };
}

/** Parts of a mask smaller than this share of its largest part are dropped as specks. */
const MIN_MASK_PART = 0.1;

/**
 * Bounding box (image fractions) of a segmentation mask. Separate parts
 * smaller than MIN_MASK_PART of the largest one are ignored, so stray specks
 * elsewhere in the photo do not stretch the box; comparable parts - a handle
 * seen apart from its cup - are kept.
 * @param {ArrayLike<number>} mask width*height values, > 0 = object (e.g. logits)
 * @returns {{x,y,w,h,area}|null} area: kept pixels / all pixels; null if empty
 */
function boxFromMask(mask, width, height) {
  const on = Uint8Array.from(mask, (v) => (v > 0 ? 1 : 0));
  const { labels, count } = label(on, width, height);
  if (!count) return null;
  const size = new Float64Array(count + 1);
  for (const l of labels) if (l) size[l] += 1;
  let largest = 0;
  for (let l = 1; l <= count; l += 1) largest = Math.max(largest, size[l]);

  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  let area = 0;
  for (let i = 0; i < labels.length; i += 1) {
    const l = labels[i];
    if (!l || size[l] < MIN_MASK_PART * largest) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
    area += 1;
  }
  return {
    ...roundBox({ x: x0 / width, y: y0 / height, w: (x1 + 1 - x0) / width, h: (y1 + 1 - y0) / height }),
    area: round4(area / (width * height)),
  };
}

const round4 = (v) => Math.round(v * 10000) / 10000;

function roundBox({ x, y, w, h }) {
  return { x: round4(x), y: round4(y), w: round4(w), h: round4(h) };
}

/** Smallest side a user-drawn region may have, as a fraction of the image. */
const MIN_SIDE = 0.02;

/**
 * Validates a client-supplied region: finite numbers, inside the image, not
 * degenerate. Returns null for anything unusable.
 * @param {unknown} input { x, y, w, h } or a JSON string of it
 */
function sanitizeBox(input) {
  let box = input;
  if (typeof box === 'string') {
    try {
      box = JSON.parse(box);
    } catch (_err) {
      return null;
    }
  }
  if (!box || typeof box !== 'object') return null;
  const nums = ['x', 'y', 'w', 'h'].map((k) => Number(box[k]));
  if (!nums.every(Number.isFinite)) return null;
  let [x, y, w, h] = nums;
  x = Math.min(Math.max(x, 0), 1 - MIN_SIDE);
  y = Math.min(Math.max(y, 0), 1 - MIN_SIDE);
  w = Math.min(Math.max(w, MIN_SIDE), 1 - x);
  h = Math.min(Math.max(h, MIN_SIDE), 1 - y);
  return roundBox({ x, y, w, h });
}

function sameBox(a, b) {
  if (!a || !b) return false;
  return ['x', 'y', 'w', 'h'].every((k) => Math.abs(Number(a[k]) - Number(b[k])) < 1e-3);
}

module.exports = {
  detectRegion,
  boxFromMask,
  WHOLE_IMAGE_COVERAGE,
  sanitizeBox,
  sameBox,
  DETECTOR_ID,
  PIXELS_PER_PATCH,
  // exported for tests
  _internal: { normalize01, featureCue, colorCue, otsu, label },
};
