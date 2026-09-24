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
};

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

/** Reads resize/normalisation settings from the model's own preprocessor_config.json. */
function readPreprocessConfig() {
  const file = path.join(env.visualSearch.modelDir, 'preprocessor_config.json');
  if (!fs.existsSync(file)) return DEFAULT_PREPROCESS;
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const size = cfg.size || {};
  const edge = size.shortest_edge || cfg.image_size;
  return {
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

/** Decodes any supported image into a normalised CHW Float32Array. */
async function toTensorData(buffer) {
  let sharp;
  try {
    // eslint-disable-next-line global-require
    sharp = require('sharp');
  } catch (err) {
    throw new ModelUnavailableError('sharp is not installed: ' + err.message);
  }

  const { width, height, mean, std, rescale } = preprocess;
  // Matches DINOv3ViTImageProcessor: plain (non aspect-preserving) resize to
  // 224x224 with bilinear filtering, rescale to [0,1], ImageNet normalise.
  // Transparent PNGs are flattened onto white, which is how shoppers see them.
  const { data, info } = await sharp(buffer, { failOn: 'none', animated: false })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(width, height, { fit: 'fill', kernel: sharp.kernel.linear || sharp.kernel.cubic })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const plane = width * height;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    for (let c = 0; c < 3; c += 1) {
      // A greyscale source has one channel; reuse it for R, G and B.
      const value = data[i * channels + (channels >= 3 ? c : 0)];
      out[c * plane + i] = (value * rescale - mean[c]) / std[c];
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
 * Returns the L2-normalised global image descriptor for one image.
 *
 * The descriptor is DINOv3's `pooler_output` (the final-layer-normed CLS
 * token). If a different export only offers `last_hidden_state`, the CLS token
 * is taken from it instead.
 */
async function embed(buffer) {
  const { ort, handle } = await load();
  const pixels = await toTensorData(buffer);
  const { width, height } = preprocess;

  return serial(async () => {
    const input = new ort.Tensor('float32', pixels, [1, 3, height, width]);
    const outputs = await handle.run({ [handle.inputNames[0]]: input });

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

module.exports = { load, embed, modelId, status, ModelUnavailableError };
