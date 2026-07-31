// Bake Kenney CC0 "Skyboxes" night panorama -> a small, palette-darkened
// equirectangular background for creative mode (images/sky-night.png).
// Run: node tools/bake-props/bake-sky.js
const fs = require('fs'), zlib = require('zlib'), path = require('path');

function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, colorType = 0, bitDepth = 8, idat = [], plte = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'PLTE') plte = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('only 8-bit PNG supported (got ' + bitDepth + ')');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 4 ? 2 : 1;
  const stride = w * ch, out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++], row = out.slice(y * stride, (y + 1) * stride);
    raw.copy(row, 0, rp, rp + stride); rp += stride;
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? row[x - ch] : 0, b = prev ? prev[x] : 0, c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = row[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      row[x] = v;
    }
  }
  return { w, h, ch, plte, colorType, data: out };
}

const CRC_T = []; for (let x = 0; x < 256; x++) { let c = x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[x] = c >>> 0; }
const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = CRC_T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};

// Truecolor out. A palette (even Floyd-Steinberg dithered) turns this sky's
// very smooth gradient into swirling oil-slick contours once the tone mapper
// stretches it, so quantizing is NOT worth the bytes here.
function writePNG(file, w, h, rgbFloat) {
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        // Ordered dither on the final rounding: ±0.5 level of noise keeps the
        // 8-bit steps from becoming visible bands in a near-black sky.
        const d = (((x * 7 + y * 3 + c * 5) % 8) / 8 - 0.5) * 0.9;
        const v = rgbFloat[(y * w + x) * 3 + c] + d;
        raw[y * (w * 3 + 1) + 1 + x * 3 + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]));
}

const src = decodePNG(fs.readFileSync(path.join(__dirname, 'sky/skybox-night.png')));
const OW = 512, OH = 256;                 // plenty for a soft night sky
const fx = src.w / OW, fy = src.h / OH;

// IMPORTANT: keep the source's FULL tonal range here. Darkening in the bake
// crushes the gradient into a handful of 8-bit levels, and creative.js renders
// the background through ACES tone mapping at exposure 1.8 (a ~3x linear gain)
// which turns those steps into hard contour lines — the sky came out looking
// like swirling marble. Brightness is placed at runtime instead, in float, via
// scene.backgroundIntensity. Here we only downsample and tint.
const wide = new Float32Array(OW * OH * 3);
for (let y = 0; y < OH; y++) {
  for (let x = 0; x < OW; x++) {
    let r = 0, g = 0, b = 0, n = 0, pr = 0, pg = 0, pb = 0;
    const x0 = Math.floor(x * fx), x1 = Math.floor((x + 1) * fx);
    const y0 = Math.floor(y * fy), y1 = Math.floor((y + 1) * fy);
    for (let sy = y0; sy < y1; sy++) {
      for (let sx = x0; sx < x1; sx++) {
        const o = (sy * src.w + sx) * src.ch;
        r += src.data[o]; g += src.data[o + 1]; b += src.data[o + 2]; n++;
        if (src.data[o] + src.data[o + 1] + src.data[o + 2] > pr + pg + pb) {
          pr = src.data[o]; pg = src.data[o + 1]; pb = src.data[o + 2];
        }
      }
    }
    r /= n; g /= n; b /= n;
    // Lean 35% toward the block's brightest pixel so stars survive the 5x
    // downsample instead of being averaged into the background
    const o2 = (y * OW + x) * 3;
    wide[o2]     = (r + (pr - r) * 0.35) * 0.86; // slight green pull so the sky
    wide[o2 + 1] = (g + (pg - g) * 0.35) * 1.00; // belongs to the sage palette
    wide[o2 + 2] = (b + (pb - b) * 0.35) * 0.94;
  }
}

// Gentle 3x3 blur of the CLOUD field only (pixels near the local mean) — keeps
// stars and the moon crisp while smoothing the blotchy cloud structure that
// reads as marbling once the tone mapper stretches it.
const out = new Float32Array(OW * OH * 3);
for (let y = 0; y < OH; y++) {
  for (let x = 0; x < OW; x++) {
    const o = (y * OW + x) * 3;
    let acc = [0, 0, 0], n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const sx = Math.min(OW - 1, Math.max(0, x + dx));
        const sy = Math.min(OH - 1, Math.max(0, y + dy));
        const so = (sy * OW + sx) * 3;
        acc[0] += wide[so]; acc[1] += wide[so + 1]; acc[2] += wide[so + 2]; n++;
      }
    }
    acc = acc.map(v => v / n);
    const here = (wide[o] + wide[o + 1] + wide[o + 2]) / 3;
    const around = (acc[0] + acc[1] + acc[2]) / 3;
    // highlight = much brighter than its surroundings -> leave it alone
    const isHighlight = Math.min(1, Math.max(0, (here - around - 8) / 20));
    for (let c = 0; c < 3; c++) {
      out[o + c] = Math.min(255, acc[c] + (wide[o + c] - acc[c]) * isHighlight);
    }
  }
}
const dest = path.join(__dirname, '../../images/sky-night.png');
writePNG(dest, OW, OH, out);
console.log('written images/sky-night.png', OW + 'x' + OH,
  (fs.statSync(dest).size / 1024).toFixed(1) + 'KB (source ' + src.w + 'x' + src.h + ')');
console.log('Brightness is set at runtime: creative.js scene.backgroundIntensity');
