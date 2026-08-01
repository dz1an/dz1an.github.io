// Bake Kenney CC0 Fantasy Town Kit pieces -> brand-recoloured vertex-colour
// geometry for InstancedMesh (models/town.js).
// Run: node tools/bake-props/bake-town.js
//
// The kit ships a fantasy palette (terracotta timber, lavender roof tiles,
// blue-grey stone). None of that belongs on a sage/cream page, so every
// texel is classified by hue family and remapped to the //dzian palette:
// plaster -> cream, timber -> brown, stone -> slate, ROOFS -> firefly gold,
// foliage -> the same sage ramp the forest uses.
const fs = require('fs'), zlib = require('zlib'), path = require('path');

function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, colorType = 0, idat = [], plte = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'PLTE') plte = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = colorType === 2 ? 3 : colorType === 6 ? 4 : 1;
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
  return { w, h, px(x, y) {
    x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y));
    if (colorType === 3) { const i = out[y * stride + x]; return [plte[i * 3], plte[i * 3 + 1], plte[i * 3 + 2]]; }
    const o = y * stride + x * ch;
    return ch === 1 ? [out[o], out[o], out[o]] : [out[o], out[o + 1], out[o + 2]];
  }};
}

const HEX = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const lerpC = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
function ramp(stops, lo, hi) {
  const cs = stops.map(HEX);
  return L => {
    let t = (L - lo) / (hi - lo);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const seg = t * (cs.length - 1), i = Math.min(cs.length - 2, Math.floor(seg));
    return lerpC(cs[i], cs[i + 1], seg - i);
  };
}

const FOLIAGE = ramp([0x344E41, 0x5C7650, 0xA9C46C], 90, 175);  // same sage as the forest
const PLASTER = ramp([0xCFCCC0, 0xE8E6DC, 0xF4F2EA], 185, 215); // walls
const TIMBER  = ramp([0x3B2A1A, 0x5C4430, 0x7A5C40], 105, 165); // beams, carts, stalls
const STONE   = ramp([0x474C5A, 0x666C7C, 0x8A90A0], 110, 175); // foundations, rock
const GOLD    = ramp([0xB8933F, 0xE8C87A, 0xF4E2B0], 175, 215); // ROOFS — the brand accent

function classify(c) {
  const [r, g, b] = c, L = (r + g + b) / 3;
  if (g > r + 12 && g > b + 12) return FOLIAGE(L);      // greens -> sage
  if (b > r + 12) return L > 178 ? GOLD(L) : STONE(L);  // pale tiles vs blue-grey stone
  return L > 190 ? PLASTER(L) : TIMBER(L);              // light plaster vs timber
}
const srgb2lin = v => Math.round(Math.pow(v / 255, 2.2) * 255);

function composeTRS(node) {
  const t = node.translation || [0, 0, 0];
  const q = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1
  ];
}
const xfp = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const xfn = (m, x, y, z) => { const v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z]; const l = Math.hypot(...v) || 1; return v.map(k => k / l); };

// Kenney's modular pieces are authored in place on a 1-unit grid: a wall sits
// on its cell's +X edge, a roof caps the cell. Their origins MUST be kept
// (unlike the forest props, which are centred) or nothing snaps together.
function bake(file, png) {
  const b = fs.readFileSync(path.join(__dirname, 'town', file + '.glb'));
  const jlen = b.readUInt32LE(12);
  const j = JSON.parse(b.toString('utf8', 20, 20 + jlen));
  const off = 20 + jlen, bin = b.slice(off + 8, off + 8 + b.readUInt32LE(off));
  const bv = i => { const v = j.bufferViews[i]; return bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  const acc = i => {
    const a = j.accessors[i], d = bv(a.bufferView), o = a.byteOffset || 0;
    const T = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[a.componentType];
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    return new T(d.buffer.slice(d.byteOffset + o, d.byteOffset + o + a.count * comps * T.BYTES_PER_ELEMENT));
  };

  const P = [], N = [], C = [], I = [];
  let vOff = 0;
  (j.nodes || []).forEach(node => {
    if (node.mesh === undefined) return;
    const m = composeTRS(node);
    j.meshes[node.mesh].primitives.forEach(p => {
      const pos = acc(p.attributes.POSITION), nor = acc(p.attributes.NORMAL);
      const uv = p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null;
      const idx = p.indices !== undefined ? acc(p.indices) : null;
      const count = pos.length / 3;
      // Untextured primitives (e.g. the fountain's Water material) fall back to
      // that material's own colour rather than an atlas lookup.
      let flat = null;
      if (!uv) {
        const mat = (j.materials || [])[p.material] || {};
        const f = (mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorFactor) || [0.5, 0.5, 0.5, 1];
        flat = [0, 1, 2].map(k => Math.round(Math.pow(f[k], 1 / 2.2) * 255)); // linear -> sRGB for classify
      }
      for (let k = 0; k < count; k++) {
        const wp = xfp(m, pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
        const wn = xfn(m, nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
        P.push(wp[0], wp[1], wp[2]); N.push(wn[0], wn[1], wn[2]);
        const src = flat || png.px(Math.floor(uv[k * 2] * png.w), Math.floor(uv[k * 2 + 1] * png.h));
        const rc = classify(src);
        C.push(srgb2lin(rc[0]), srgb2lin(rc[1]), srgb2lin(rc[2]));
      }
      if (idx) for (let k = 0; k < idx.length; k++) I.push(idx[k] + vOff);
      else for (let k = 0; k < count; k++) I.push(k + vOff);
      vOff += count;
    });
  });

  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let k = 0; k < P.length; k += 3) for (let c = 0; c < 3; c++) {
    mn[c] = Math.min(mn[c], P[k + c]); mx[c] = Math.max(mx[c], P[k + c]);
  }
  console.log(file.padEnd(22), 'verts:', String(vOff).padEnd(5), 'tris:', String(I.length / 3).padEnd(5),
    'size:', mx.map((v, i) => (v - mn[i]).toFixed(2)).join(' x '));

  const b64 = ta => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
  return {
    p: b64(new Float32Array(P)), n: b64(new Float32Array(N)),
    c: b64(new Uint8Array(C)), i: b64(new Uint16Array(I))
  };
}

const png = decodePNG(fs.readFileSync(path.join(__dirname, 'town/colormap-town.png')));
const town = {
  wall:      bake('wall', png),
  wallDoor:  bake('wall-door', png),
  wallWin:   bake('wall-window-shutters', png),
  roofPoint: bake('roof-point', png),
  roofGable: bake('roof-gable', png),
  roofEnd:   bake('roof-gable-end', png),
  tree:      bake('tree', png),
  treeHigh:  bake('tree-high', png),
  fountain:  bake('fountain-round', png),
  stall:     bake('stall-red', png),
  lantern:   bake('lantern', png),
  windmill:  bake('windmill', png),
  rock:      bake('rock-large', png)
};

const out = '// Town set — CC0 Fantasy Town Kit by Kenney (kenney.nl), atlas-sampled and\n' +
  '// recoloured to the //dzian palette at bake time (cream plaster, timber,\n' +
  '// slate stone, FIREFLY-GOLD roofs, sage foliage). Modular: every piece keeps\n' +
  '// its authored origin so the 1-unit grid still snaps.\n' +
  '// Do not edit by hand — rebake with tools/bake-props/bake-town.js.\n' +
  'window.DZ_TOWN = ' + JSON.stringify(town) + ';\n';
fs.writeFileSync(path.join(__dirname, '../../models/town.js'), out);
console.log('written models/town.js', (out.length / 1024).toFixed(1) + 'KB');
