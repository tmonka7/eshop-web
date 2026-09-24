'use strict';
/**
 * Downloads the DINOv3 ONNX export into backend/ml/<model>/ and verifies every
 * weight file against its published SHA-256. Run it once on a machine with
 * internet access, then ship the backend/ml folder to the offline host; the
 * API itself never downloads anything.
 *
 *   npm run model:fetch                                  # ViT-S/16, fp32 (default)
 *   npm run model:fetch -- --variant quantized           # int8, ~4x smaller
 *   npm run model:fetch -- --model vitb16                # ViT-B/16, 768-d, slower
 *
 * Set HF_ENDPOINT to use a Hugging Face mirror.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const ENDPOINT = (process.env.HF_ENDPOINT || 'https://huggingface.co').replace(/\/+$/, '');

// SHA-256 of each LFS object, from the Hugging Face repositories.
const MODELS = {
  vits16: {
    repo: 'onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX',
    dir: 'dinov3-vits16',
    variants: {
      fp32: {
        'model.onnx': 'bb75e9e30ff382ecdbd150266445ab41272be4acc85fd3563218dd89781e36da',
        'model.onnx_data': '1eff0bb9f4fdef831ca61c8bc2b5c88d8cc21ef4756d3b483d9b9c15d8d5d27f',
      },
      quantized: {
        'model_quantized.onnx': '7686e8c849202c4fdd67d1cd336449c29bdddbcca535d765d3014f50d04d516d',
        'model_quantized.onnx_data': '51572f7fc3c272eb574a70509ea1eeb7e674e5ca2cd96fec1632edb38983d529',
      },
      q4: {
        'model_q4.onnx': '48272ed591191c5fb85d5c300192324205155079ff32ff8b3bb305445f64ea3c',
        'model_q4.onnx_data': '4a9337a591b7d4b7ede09b57fb455f9a7ebc8adc15c27c92031f57a2a870c29c',
      },
    },
  },
  vitb16: {
    repo: 'onnx-community/dinov3-vitb16-pretrain-lvd1689m-ONNX',
    dir: 'dinov3-vitb16',
    variants: {
      fp32: {
        'model.onnx': '0d68aa8f33d21a5616a468239dbe80608abe53619a2663f05e269785eaceb746',
        'model.onnx_data': '6f292af27497d258257d256bf5eee4151edb67d92f586196beaa182767060353',
      },
      quantized: {
        'model_quantized.onnx': 'b746a7237f72ae08349d59fe688b39fb02d766cafe4901c5cf74220624501357',
        'model_quantized.onnx_data': 'ab851638488657a9511f23ac9d3352655994672abcb16b23dee730755ae1838b',
      },
      q4: {
        'model_q4.onnx': 'd146e67e6de785e1fa27fb7f1d92dce3816846c682116a986535297be7c540bc',
        'model_q4.onnx_data': 'f0f7872ebe9a1a7d3366dcbeb170e8e609c6c2a8967844114291057139fc4fe6',
      },
    },
  },
};

// Small text files, stored without LFS hashes.
const CONFIG_FILES = ['config.json', 'preprocessor_config.json', 'LICENSE.md'];

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

async function download(url, target) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error('GET ' + url + ' -> HTTP ' + res.status);
  const tmp = target + '.part';
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  fs.renameSync(tmp, target);
}

async function run() {
  const modelKey = arg('model', 'vits16');
  const variantKey = arg('variant', 'fp32');
  const model = MODELS[modelKey];
  if (!model) throw new Error('Unknown --model ' + modelKey + ' (use ' + Object.keys(MODELS).join(', ') + ')');
  const weights = model.variants[variantKey];
  if (!weights) throw new Error('Unknown --variant ' + variantKey + ' (use ' + Object.keys(model.variants).join(', ') + ')');

  const dest = path.resolve(__dirname, '../../ml', model.dir);
  fs.mkdirSync(dest, { recursive: true });
  const base = ENDPOINT + '/' + model.repo + '/resolve/main/';

  for (const file of CONFIG_FILES) {
    console.log('[model] ' + file);
    await download(base + file, path.join(dest, file));
  }

  for (const [file, expected] of Object.entries(weights)) {
    const target = path.join(dest, file);
    if (fs.existsSync(target) && (await sha256(target)) === expected) {
      console.log('[model] ' + file + ' already present, checksum ok');
      continue;
    }
    console.log('[model] downloading onnx/' + file + ' ...');
    await download(base + 'onnx/' + file, target);
    const actual = await sha256(target);
    if (actual !== expected) {
      fs.unlinkSync(target);
      throw new Error(file + ' checksum mismatch: expected ' + expected + ', got ' + actual);
    }
    console.log('[model] ' + file + ' checksum ok');
  }

  const modelFile = Object.keys(weights).find((f) => f.endsWith('.onnx'));
  console.log('');
  console.log('  DINOv3 ready in ' + dest);
  if (model.dir !== 'dinov3-vits16') console.log('  VISUAL_SEARCH_MODEL_DIR=ml/' + model.dir);
  if (modelFile !== 'model.onnx') console.log('  VISUAL_SEARCH_MODEL_FILE=' + modelFile);
  console.log('  Use of these weights is governed by ' + path.join(dest, 'LICENSE.md'));
  console.log('');
}

run().catch((err) => {
  console.error('[model] ' + err.message);
  process.exit(1);
});
