// Bake Kenney CC0 camp GLBs -> sage-recolored vertex-color props (models/props.js)
// Source models: Kenney Survival Kit (kenney.nl, CC0). Run: node tools/bake-props/bake.js
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

const png = decodePNG(fs.readFileSync(path.join(__dirname, 'colormap.png')));

// Palette remap — exact atlas-color tables per prop (dumped earlier), nearest-key
// fallback for stray texels. Targets are OUR palette.
const HEX = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const TABLES = {
  tent: {
    // outer canvas (the bright oranges ARE the sunlit canvas, not trim)
    0xffbd51: 0x77835F, 0xffa139: 0x6E7A55, 0xff9a33: 0x66714E,
    // inner/under canvas
    0xea9167: 0x7A8663, 0xdf8860: 0x6E7A55, 0xcf7a55: 0x616D4B, 0xbc6a49: 0x57624A,
    // frame poles
    0xb46444: 0x3B2A1A
  },
  fire: {
    // stone ring
    0xcb865e: 0x5F5F6E, 0xdc9e77: 0x767686,
    // stacked firewood, dark to light
    0xb46444: 0x352518, 0xc06e4c: 0x3B2A1A, 0xc77450: 0x40301E,
    0xcf7a55: 0x46331F, 0xdf8860: 0x4A3524, 0xdea27b: 0x503A26
  },
  log: {
    // bark
    0xb46444: 0x3B2A1A, 0xc06e4c: 0x42301D, 0xd7815b: 0x4A3524, 0xcb865e: 0x52402A,
    // cut faces
    0xea9167: 0x8A6B47, 0xdf8860: 0x7E6140, 0xe48c63: 0x75593A, 0xdc9e77: 0x8A6B47
  }
};
const MAPS = {};
for (const name of Object.keys(TABLES)) {
  const keys = Object.keys(TABLES[name]).map(Number);
  MAPS[name] = c => {
    let best = keys[0], bd = 1e9;
    for (const k of keys) {
      const kr = (k >> 16) & 255, kg = (k >> 8) & 255, kb = k & 255;
      const d = (c[0] - kr) ** 2 + (c[1] - kg) ** 2 + (c[2] - kb) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return HEX(TABLES[name][best]);
  };
}
const srgb2lin = v => Math.round(Math.pow(v / 255, 2.2) * 255);

function composeTRS(node) {
  // column-major 4x4
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

function bake(file, mapName, targetH) {
  const b = fs.readFileSync(path.join(__dirname, file + '.glb'));
  const jlen = b.readUInt32LE(12);
  const j = JSON.parse(b.toString('utf8', 20, 20 + jlen));
  const off = 20 + jlen, blen = b.readUInt32LE(off), bin = b.slice(off + 8, off + 8 + blen);
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
      const pos = acc(p.attributes.POSITION), nor = acc(p.attributes.NORMAL), uv = acc(p.attributes.TEXCOORD_0);
      const idx = p.indices !== undefined ? acc(p.indices) : null;
      const count = pos.length / 3;
      for (let k = 0; k < count; k++) {
        const wp = xfp(m, pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
        const wn = xfn(m, nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
        P.push(wp[0], wp[1], wp[2]); N.push(wn[0], wn[1], wn[2]);
        const c = png.px(Math.floor(uv[k * 2] * png.w), Math.floor(uv[k * 2 + 1] * png.h));
        const rc = MAPS[mapName](c);
        C.push(srgb2lin(rc[0]), srgb2lin(rc[1]), srgb2lin(rc[2]));
      }
      if (idx) for (let k = 0; k < idx.length; k++) I.push(idx[k] + vOff);
      else for (let k = 0; k < count; k++) I.push(k + vOff);
      vOff += count;
    });
  });

  // Normalize: center x/z, floor y=0, scale to target height
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let k = 0; k < P.length; k += 3) {
    minX = Math.min(minX, P[k]); maxX = Math.max(maxX, P[k]);
    minY = Math.min(minY, P[k + 1]); maxY = Math.max(maxY, P[k + 1]);
    minZ = Math.min(minZ, P[k + 2]); maxZ = Math.max(maxZ, P[k + 2]);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const sc = targetH / (maxY - minY);
  for (let k = 0; k < P.length; k += 3) {
    P[k] = (P[k] - cx) * sc; P[k + 1] = (P[k + 1] - minY) * sc; P[k + 2] = (P[k + 2] - cz) * sc;
  }
  console.log(file, '-> verts:', vOff, 'tris:', I.length / 3,
    'size:', ((maxX - minX) * sc).toFixed(2) + ' x ' + ((maxY - minY) * sc).toFixed(2) + ' x ' + ((maxZ - minZ) * sc).toFixed(2));

  const b64 = ta => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
  return {
    p: b64(new Float32Array(P)), n: b64(new Float32Array(N)),
    c: b64(new Uint8Array(C)), i: b64(new Uint16Array(I))
  };
}

const props = {
  tent: bake('tent-canvas', 'tent', 2.1),
  fire: bake('campfire-pit', 'fire', 0.70),
  log:  bake('tree-log', 'log', 0.34)
};

const out = '// Camp props — CC0 models by Kenney (kenney.nl), atlas-sampled and\n' +
  '// recolored to the //dzian palette at bake time. Vertex-color geometry;\n' +
  '// decode with creative.js buildProp(). Do not edit by hand — rebaked from\n' +
  '// the Survival Kit GLBs.\n' +
  'window.DZ_PROPS = ' + JSON.stringify(props) + ';\n';
fs.writeFileSync(path.join(__dirname, '../../models/props.js'), out);
console.log('written models/props.js', (out.length / 1024).toFixed(1) + 'KB');
