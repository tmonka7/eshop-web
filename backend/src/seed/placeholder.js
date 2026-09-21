'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '../../uploads');
const SIZE = 480;

/* --------------------------- minimal PNG writer --------------------------- */
/*
 * Product images are generated rather than downloaded so the seeded store works
 * offline. PNG (not SVG) because Glide on Android cannot decode SVG without an
 * extra decoder, and every client here shares one image URL.
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encodes an RGB pixel buffer (width * height * 3) as a PNG file. */
function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Each scanline is prefixed with filter type 0 (None).
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------- drawing --------------------------------- */

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const mix = (a, b, t) => Math.round(a + (b - a) * t);

/**
 * Paints a diagonal gradient with two soft highlight circles - the same shape
 * language as the mockups, so a grid of these still reads as a product wall.
 */
function renderTile(size, fromHex, toHex, seed = 0) {
  const [r1, g1, b1] = hexToRgb(fromHex);
  const [r2, g2, b2] = hexToRgb(toHex);
  const buf = Buffer.alloc(size * size * 3);

  // Seed shifts the highlights so the three shots of one product differ.
  const circles = [
    { cx: size * (0.78 + seed * 0.04), cy: size * (0.2 + seed * 0.05), r: size * 0.3, a: 0.1 },
    { cx: size * (0.18 - seed * 0.03), cy: size * (0.82 - seed * 0.04), r: size * 0.22, a: 0.08 },
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = (x / size + y / size) / 2;
      let r = mix(r1, r2, t);
      let g = mix(g1, g2, t);
      let b = mix(b1, b2, t);

      for (const c of circles) {
        const dx = x - c.cx;
        const dy = y - c.cy;
        if (dx * dx + dy * dy <= c.r * c.r) {
          r = mix(r, 255, c.a);
          g = mix(g, 255, c.a);
          b = mix(b, 255, c.a);
        }
      }

      const i = (y * size + x) * 3;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
    }
  }

  return buf;
}

/**
 * Writes uploads/<folder>/<filename> and returns the path to store on the
 * document (the caller prefixes it with PUBLIC_URL).
 */
function writePlaceholder(folder, filename, { from = '#EF4444', to = '#F97316', seed = 0 } = {}) {
  const dir = path.join(ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });

  const name = filename.replace(/\.svg$/i, '.png');
  const pixels = renderTile(SIZE, from, to, seed);
  fs.writeFileSync(path.join(dir, name), encodePng(SIZE, SIZE, pixels));

  return '/uploads/' + folder + '/' + name;
}

module.exports = { writePlaceholder, encodePng, UPLOAD_ROOT: ROOT };
