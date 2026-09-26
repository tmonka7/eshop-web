'use strict';
/**
 * SAM2.1 (Segment Anything 2, Hiera-tiny) running locally on onnxruntime (CPU).
 *
 * SAM2 traces the outline of the object under a prompt. It does not decide
 * which object is the product - DINOv3 does that (regionDetect.js) and hands
 * over its box and its strongest point as the prompt. The mask SAM2 returns
 * gives a box that follows the product's real edges instead of 16 px patches.
 *
 * Two ONNX graphs from onnx-community/sam2.1-hiera-tiny-ONNX:
 *  - vision_encoder: 1024x1024 image -> three feature maps (~2 s on a CPU)
 *  - prompt_encoder_mask_decoder: features + points/box -> 3 candidate masks
 *    (256x256 logits) with a predicted IoU each, and an "is there an object"
 *    logit (~50 ms)
 *
 * The files live in env.visualSearch.sam2.dir (`npm run model:fetch -- --sam2`).
 * Without them the API still works and falls back to the DINOv3 box.
 */
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const dinov3 = require('./dinov3.service');
const { boxFromMask } = require('./regionDetect');

const DEFAULT_PREPROCESS = {
  size: 1024,
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
  rescale: 1 / 255,
};
/** SAM's "no point" label, for a box-only prompt. */
const PAD_LABEL = -1;

let sessionPromise = null;
let sessions = null;
let lastError = null;
let preprocess = DEFAULT_PREPROCESS;

const cfg = () => env.visualSearch.sam2;
const encoderPath = () => path.join(cfg().dir, cfg().encoderFile);
const decoderPath = () => path.join(cfg().dir, cfg().decoderFile);

/** Names the segmentation network, e.g. "sam2.1-hiera-tiny/vision_encoder_quantized.onnx". */
function modelId() {
  return path.basename(cfg().dir) + '/' + cfg().encoderFile;
}

const filesPresent = () => fs.existsSync(encoderPath()) && fs.existsSync(decoderPath());

/**
 * True when SAM2 is switched on and its files are in place, and it has not
 * failed to load. Checked synchronously (it is part of the detector id).
 */
function usable() {
  return Boolean(env.visualSearch.enabled && cfg().enabled && filesPresent() && !lastError);
}

function readPreprocessConfig() {
  const file = path.join(cfg().dir, 'preprocessor_config.json');
  if (!fs.existsSync(file)) return DEFAULT_PREPROCESS;
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    size: (c.size && (c.size.longest_edge || c.size.width)) || DEFAULT_PREPROCESS.size,
    mean: c.image_mean || DEFAULT_PREPROCESS.mean,
    std: c.image_std || DEFAULT_PREPROCESS.std,
    rescale: c.do_rescale === false ? 1 : c.rescale_factor || DEFAULT_PREPROCESS.rescale,
  };
}

/** Loads both graphs once; a failure is remembered so detection falls back quietly. */
function load() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      if (!filesPresent()) throw new Error('SAM2 model not found in ' + cfg().dir);
      // eslint-disable-next-line global-require
      const ort = require('onnxruntime-node');
      const started = Date.now();
      const options = { executionProviders: ['cpu'], graphOptimizationLevel: 'all' };
      if (env.visualSearch.threads > 0) options.intraOpNumThreads = env.visualSearch.threads;
      const [encoder, decoder] = await Promise.all([
        ort.InferenceSession.create(encoderPath(), options),
        ort.InferenceSession.create(decoderPath(), options),
      ]);
      preprocess = readPreprocessConfig();
      sessions = { ort, encoder, decoder };
      console.log('[visual] ' + modelId() + ' loaded in ' + (Date.now() - started) + 'ms');
      return sessions;
    })().catch((err) => {
      // Unlike DINOv3, a broken SAM2 is not retried on every photo: detection
      // carries on with the DINOv3 box until the API restarts.
      lastError = err;
      console.warn('[visual] SAM2 unavailable, using the DINOv3 box: ' + err.message);
      throw err;
    });
  }
  return sessionPromise;
}

/** Raw RGB (size x size) -> normalised CHW Float32Array. */
function toTensorData(rgb, size) {
  const { mean, std, rescale } = preprocess;
  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    for (let c = 0; c < 3; c += 1) out[c * plane + i] = (rgb[i * 3 + c] * rescale - mean[c]) / std[c];
  }
  return out;
}

// One segmentation at a time: the encoder already uses every core.
let queue = Promise.resolve();
function serial(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

/**
 * Segments the object under the prompt and returns its bounding box.
 *
 * Like the Hugging Face Sam2Processor, the photo is stretched to 1024x1024
 * (not letterboxed), so image fractions map straight onto the model's
 * coordinates and back.
 *
 * @param {{data: Buffer, width: number, height: number}} image from dinov3.decode()
 * @param {{ box?: {x,y,w,h}, point?: {x,y} }} prompt in image fractions
 * @returns {Promise<{x,y,w,h,area,score}|null>} null when SAM2 sees no object there
 */
async function segment(image, { box, point }) {
  const { ort, encoder, decoder } = await load();
  const { size } = preprocess;
  const pixels = toTensorData(await dinov3.resizeRaw(image, null, size, size), size);

  return serial(async () => {
    const features = await encoder.run({
      [encoder.inputNames[0]]: new ort.Tensor('float32', pixels, [1, 3, size, size]),
    });

    const points = point ? [point.x * size, point.y * size] : [0, 0];
    const labels = [point ? 1 : PAD_LABEL];
    const boxes = box ? [box.x * size, box.y * size, (box.x + box.w) * size, (box.y + box.h) * size] : [];
    const feeds = {
      input_points: new ort.Tensor('float32', Float32Array.from(points), [1, 1, 1, 2]),
      input_labels: new ort.Tensor('int64', BigInt64Array.from(labels.map(BigInt)), [1, 1, 1]),
      input_boxes: new ort.Tensor('float32', Float32Array.from(boxes), [1, box ? 1 : 0, 4]),
    };
    // The encoder's outputs are named after the decoder's feature inputs.
    for (const name of decoder.inputNames) if (features[name]) feeds[name] = features[name];
    const out = await decoder.run(feeds);

    if (out.object_score_logits.data[0] <= 0) return null;
    // Of the 3 candidate masks (part / object / whole), keep the one SAM2 rates best.
    const iou = out.iou_scores.data;
    let best = 0;
    for (let i = 1; i < iou.length; i += 1) if (iou[i] > iou[best]) best = i;
    const [maskH, maskW] = out.pred_masks.dims.slice(-2);
    const plane = maskH * maskW;
    const found = boxFromMask(out.pred_masks.data.subarray(best * plane, (best + 1) * plane), maskW, maskH);
    return found && { ...found, score: Math.round(iou[best] * 1000) / 1000 };
  });
}

function status() {
  return {
    enabled: cfg().enabled,
    model: modelId(),
    filesPresent: filesPresent(),
    loaded: Boolean(sessions),
    error: lastError ? lastError.message : null,
  };
}

module.exports = { load, segment, usable, modelId, status };
