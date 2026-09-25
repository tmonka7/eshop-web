'use strict';
/**
 * DINOv3 image encoder running locally on onnxruntime (CPU).
 *
 * Everything the model needs - the ONNX graph, its external weight file and
 * the preprocessor config - is read from env.visualSearch.modelDir, so no
 * network access happens at runtime. Fetch the files once with
 * `npm run model:fetch` (or copy the folder over) - see ml/README.md.
 *
 * The native modules (onnxruntime-node, sharp) are required lazily: an API
 * without the model still boots and serves the rest of the shop.
 */
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const DEFAULT_PREPROCESS = {
  width: 224,
  height: 224,
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
  rescale: 1 / 255,
  patchSize: 16,
  prefixTokens: 5, // CLS + 4 register tokens
};

/**
 * Photos are decoded once, upright, and capped at this longest side. Both the
 * embedding (224x224) and region detection (<= 448) work from that copy, so a
 * 12-megapixel upload is never held at full size twice.
 */
const DECODE_MAX_SIDE = 1600;

let sessionPromise = null;
let session = null;
let lastError = null;
let preprocess = null;
let dim = null;

/** Thrown when the model files are missing or cannot be loaded. */
class ModelUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelUnavailableError';
    this.code = 'MODEL_UNAVAILABLE';
  }
}

function modelPath() {
  return path.join(env.visualSearch.modelDir, env.visualSearch.modelFile);
}

/**
 * Identifies the network a vector came from, e.g. "dinov3-vits16/model.onnx".
 * Stored beside every embedding so a model swap never mixes vector spaces.
 */
function modelId() {
  return path.basename(env.visualSearch.modelDir) + '/' + env.visualSearch.modelFile;
}

/**
 * Reads resize/normalisation settings from the model's own
 * preprocessor_config.json, and the patch size / register count from
 * config.json (region detection needs to know where the patch tokens start).
 */
function readPreprocessConfig() {
  const file = path.join(env.visualSearch.modelDir, 'preprocessor_config.json');
  const modelCfgFile = path.join(env.visualSearch.modelDir, 'config.json');
  const modelCfg = fs.existsSync(modelCfgFile) ? JSON.parse(fs.readFileSync(modelCfgFile, 'utf8')) : {};
  const layout = {
    patchSize: modelCfg.patch_size || DEFAULT_PREPROCESS.patchSize,
    prefixTokens: 1 + (modelCfg.num_register_tokens ?? DEFAULT_PREPROCESS.prefixTokens - 1),
  };
  if (!fs.existsSync(file)) return { ...DEFAULT_PREPROCESS, ...layout };
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const size = cfg.size || {};
  const edge = size.shortest_edge || cfg.image_size;
  return {
    ...layout,
    width: size.width || edge || DEFAULT_PREPROCESS.width,
    height: size.height || edge || DEFAULT_PREPROCESS.height,
    mean: cfg.image_mean || DEFAULT_PREPROCESS.mean,
    std: cfg.image_std || DEFAULT_PREPROCESS.std,
    rescale: cfg.do_rescale === false ? 1 : cfg.rescale_factor || DEFAULT_PREPROCESS.rescale,
  };
}

/** Loads the ONNX session once; concurrent callers share the same promise. */
function load() {
  if (!env.visualSearch.enabled) {
    return Promise.reject(new ModelUnavailableError('Visual search is disabled (VISUAL_SEARCH_ENABLED=false)'));
  }
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const file = modelPath();
      if (!fs.existsSync(file)) {
        throw new ModelUnavailableError(
          'DINOv3 model not found at ' + file + '. Run "npm run model:fetch" on a connected machine '
            + 'and copy backend/ml to this host (see backend/ml/README.md).',
        );
      }

      let ort;
      try {
        // eslint-disable-next-line global-require
        ort = require('onnxruntime-node');
      } catch (err) {
        throw new ModelUnavailableError('onnxruntime-node is not installed: ' + err.message);
      }

      const started = Date.now();
      const options = { executionProviders: ['cpu'], graphOptimizationLevel: 'all' };
      if (env.visualSearch.threads > 0) options.intraOpNumThreads = env.visualSearch.threads;

      let created;
      try {
        // Given a path, onnxruntime resolves model.onnx_data next to the graph.
        created = await ort.InferenceSession.create(file, options);
      } catch (err) {
        throw new ModelUnavailableError('Could not load ' + file + ': ' + err.message);
      }

      preprocess = readPreprocessConfig();
      session = { ort, handle: created };
      lastError = null;
      console.log('[visual] ' + modelId() + ' loaded in ' + (Date.now() - started) + 'ms');
      return session;
    })().catch((err) => {
      // Forget the failure so a later call can retry, e.g. once the files
      // have been copied into place.
      sessionPromise = null;
      lastError = err;
      throw err;
    });
  }
  return sessionPromise;
}

function requireSharp() {
  try {
    // eslint-disable-next-line global-require
    return require('sharp');
  } catch (err) {
    throw new ModelUnavailableError('sharp is not installed: ' + err.message);
  }
}

/**
 * Decodes any supported image once: EXIF-rotated upright, transparency
 * flattened onto white (how shoppers see it), sRGB, at most DECODE_MAX_SIDE.
 * Region boxes are fractions of THIS upright image, which is also what
 * browsers and the Android app display.
 * @returns {Promise<{ data: Buffer, width: number, height: number }>} raw RGB
 */
async function decode(buffer) {
  const sharp = requireSharp();
  const { data, info } = await sharp(buffer, { failOn: 'none', animated: false })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(DECODE_MAX_SIDE, DECODE_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Pixel rectangle of a 0..1 region inside a decoded image. */
function pixelRect(image, box) {
  const left = Math.min(image.width - 1, Math.max(0, Math.round(box.x * image.width)));
  const top = Math.min(image.height - 1, Math.max(0, Math.round(box.y * image.height)));
  const width = Math.max(1, Math.min(image.width - left, Math.round(box.w * image.width)));
  const height = Math.max(1, Math.min(image.height - top, Math.round(box.h * image.height)));
  return { left, top, width, height };
}

/** Resizes a decoded image (optionally cut to `box`) to width x height raw RGB. */
async function resizeRaw(image, box, width, height) {
  const sharp = requireSharp();
  let pipeline = sharp(image.data, { raw: { width: image.width, height: image.height, channels: 3 } });
  if (box) pipeline = pipeline.extract(pixelRect(image, box));
  const { data } = await pipeline
    .resize(width, height, { fit: 'fill', kernel: sharp.kernel.linear || sharp.kernel.cubic })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/** Raw RGB -> normalised CHW Float32Array. */
function toTensorData(rgb, width, height) {
  const { mean, std, rescale } = preprocess;
  const plane = width * height;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    for (let c = 0; c < 3; c += 1) {
      out[c * plane + i] = (rgb[i * 3 + c] * rescale - mean[c]) / std[c];
    }
  }
  return out;
}

function l2normalize(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i += 1) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < vec.length; i += 1) vec[i] /= norm;
  return vec;
}

// Inference is CPU bound and each run already fans out across cores, so runs
// are queued rather than overlapped - this bounds memory under load too.
let queue = Promise.resolve();
function serial(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

/**
 * Returns the L2-normalised global image descriptor.
 *
 * The descriptor is DINOv3's `pooler_output` (the final-layer-normed CLS
 * token). If a different export only offers `last_hidden_state`, the CLS token
 * is taken from it instead.
 *
 * Matches DINOv3ViTImageProcessor: plain (non aspect-preserving) resize to
 * 224x224 with bilinear filtering, rescale to [0,1], ImageNet normalise.
 *
 * @param {Buffer|{data: Buffer, width: number, height: number}} input
 *   an encoded image, or the result of decode()
 * @param {{x:number,y:number,w:number,h:number}|null} [box] embed only this region
 */
async function embed(input, box = null) {
  const { ort, handle } = await load();
  const image = Buffer.isBuffer(input) ? await decode(input) : input;
  const { width, height } = preprocess;
  const pixels = toTensorData(await resizeRaw(image, box, width, height), width, height);

  return serial(async () => {
    const tensor = new ort.Tensor('float32', pixels, [1, 3, height, width]);
    const outputs = await handle.run({ [handle.inputNames[0]]: tensor });

    let vector;
    if (outputs.pooler_output) {
      vector = Float32Array.from(outputs.pooler_output.data);
    } else {
      const hidden = outputs.last_hidden_state || outputs[handle.outputNames[0]];
      const hiddenDim = hidden.dims[hidden.dims.length - 1];
      vector = Float32Array.from(hidden.data.subarray(0, hiddenDim));
    }
    dim = vector.length;
    return l2normalize(vector);
  });
}

/**
 * Runs the model on the whole image at an aspect-preserving size whose
 * longest side is about `longSide`, and returns the patch-token grid used by
 * region detection plus a (gw*ppp)x(gh*ppp) RGB thumbnail for its colour cue.
 * DINOv3 uses rotary position embeddings, so any multiple of 16 is valid.
 */
async function patchGrid(image, longSide, pixelsPerPatch) {
  const { ort, handle } = await load();
  const { patchSize, prefixTokens } = preprocess;
  const scale = longSide / Math.max(image.width, image.height);
  const gw = Math.max(2, Math.round((image.width * scale) / patchSize));
  const gh = Math.max(2, Math.round((image.height * scale) / patchSize));
  const w = gw * patchSize;
  const h = gh * patchSize;
  const pixels = toTensorData(await resizeRaw(image, null, w, h), w, h);
  const rgb = await resizeRaw(image, null, gw * pixelsPerPatch, gh * pixelsPerPatch);

  return serial(async () => {
    const tensor = new ort.Tensor('float32', pixels, [1, 3, h, w]);
    const outputs = await handle.run({ [handle.inputNames[0]]: tensor });
    const hidden = outputs.last_hidden_state || outputs[handle.outputNames[0]];
    const tokenDim = hidden.dims[hidden.dims.length - 1];
    const patches = Float32Array.from(hidden.data.subarray(prefixTokens * tokenDim));
    if (patches.length !== gw * gh * tokenDim) {
      throw new Error('Unexpected token layout ' + hidden.dims.join('x') + ' for a ' + gw + 'x' + gh + ' grid');
    }
    return { patches, gw, gh, dim: tokenDim, rgb };
  });
}

function status() {
  return {
    enabled: env.visualSearch.enabled,
    model: modelId(),
    modelPath: modelPath(),
    filesPresent: fs.existsSync(modelPath()),
    loaded: Boolean(session),
    dim,
    error: lastError ? lastError.message : null,
  };
}

module.exports = {
  load, decode, embed, patchGrid, modelId, status, ModelUnavailableError,
};
