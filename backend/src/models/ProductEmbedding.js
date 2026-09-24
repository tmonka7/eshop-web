'use strict';
const mongoose = require('mongoose');

/**
 * One DINOv3 feature vector per product image.
 *
 * `vector` is the L2-normalised embedding packed as little-endian Float32
 * (384 dims -> 1.5 KB for ViT-S/16), so cosine similarity is a plain dot
 * product. `model` records which network produced it: vectors from two
 * different models are not comparable, and search only reads rows whose
 * model matches the one currently loaded.
 */
const productEmbeddingSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    image: { type: String, required: true },
    model: { type: String, required: true, index: true },
    dim: { type: Number, required: true, min: 1 },
    vector: { type: Buffer, required: true },
  },
  { timestamps: true },
);

productEmbeddingSchema.index({ product: 1, image: 1, model: 1 }, { unique: true });

/** Packs a Float32Array for storage. */
productEmbeddingSchema.statics.pack = function pack(f32) {
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
};

/**
 * Unpacks a stored vector. Lean reads hand back a BSON Binary rather than a
 * Buffer, so both shapes are accepted. The bytes are copied into a fresh
 * ArrayBuffer so the Float32Array is always 4-byte aligned.
 */
productEmbeddingSchema.statics.unpack = function unpack(stored) {
  let bytes = stored;
  if (bytes && !(bytes instanceof Uint8Array) && typeof bytes.read === 'function') {
    bytes = bytes.read(0, bytes.length());
  }
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Unsupported vector encoding');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
};

module.exports = mongoose.model('ProductEmbedding', productEmbeddingSchema);
