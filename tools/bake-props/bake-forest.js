// Bake Kenney CC0 forest GLBs (Mini Forest + Starter Kit Basic Scene column)
// -> sage-recolored vertex-color geometry for InstancedMesh (models/forest.js)
// Run: node tools/bake-props/bake-forest.js
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

// ---- Palette remap: hue-family classify, then lerp along a target ramp by
// source luminance so the pack's smooth shading gradients survive the recolor.
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
// Target ramps (our palette)
const FOLIAGE = ramp([0x344E41, 0x5C7650, 0xA9C46C], 150, 200); // deep sage -> lit tips
const GROUND  = ramp([0x2E4636, 0x4A5F45], 150, 200);           // grass patches sit dark
const WOOD    = ramp([0x2E2116, 0x4A3726], 100, 190); // dark bark — warm trunks read orange at night
const STONE   = ramp([0x2F3340, 0x565C68], 95, 145);            // rocks — dark slate, night-legible
const GOLD    = ramp([0x6B5424, 0xE8C87A, 0xFFE9B0], 110, 215); // award trophy -> firefly gold

function classify(kind, c) {
  const [r, g, b] = c, L = (r + g + b) / 3;
  const isGreen = g > r + 12;
  if (kind === 'tree') return isGreen ? FOLIAGE(L) : WOOD(L);
  if (kind === 'ground') return isGreen ? GROUND(L) : WOOD(L);
  if (kind === 'plant') return isGreen ? FOLIAGE(L * 0.92) : WOOD(L);
  if (kind === 'stone') return STONE(L);
  if (kind === 'gold') return GOLD(L);
  if (kind === 'wood') return WOOD(L);
  return [L, L, L];
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

function bake(file, kind, png) {
  const b = fs.readFileSync(path.join(__dirname, 'forest', file + '.glb'));
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
      const pos = acc(p.attributes.POSITION), nor = acc(p.attributes.NORMAL), uv = acc(p.attributes.TEXCOORD_0);
      const idx = p.indices !== undefined ? acc(p.indices) : null;
      const count = pos.length / 3;
      for (let k = 0; k < count; k++) {
        const wp = xfp(m, pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
        const wn = xfn(m, nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
        P.push(wp[0], wp[1], wp[2]); N.push(wn[0], wn[1], wn[2]);
        const c = png.px(Math.floor(uv[k * 2] * png.w), Math.floor(uv[k * 2 + 1] * png.h));
        const rc = classify(kind, c);
        C.push(srgb2lin(rc[0]), srgb2lin(rc[1]), srgb2lin(rc[2]));
      }
      if (idx) for (let k = 0; k < idx.length; k++) I.push(idx[k] + vOff);
      else for (let k = 0; k < count; k++) I.push(k + vOff);
      vOff += count;
    });
  });

  // Normalize: center x/z, floor y=0 — native scale kept (instances scale at runtime)
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let k = 0; k < P.length; k += 3) {
    minX = Math.min(minX, P[k]); maxX = Math.max(maxX, P[k]);
    minY = Math.min(minY, P[k + 1]); maxY = Math.max(maxY, P[k + 1]);
    minZ = Math.min(minZ, P[k + 2]); maxZ = Math.max(maxZ, P[k + 2]);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  for (let k = 0; k < P.length; k += 3) { P[k] -= cx; P[k + 1] -= minY; P[k + 2] -= cz; }
  console.log(file.padEnd(16), 'verts:', String(vOff).padEnd(5), 'tris:', String(I.length / 3).padEnd(5),
    'size:', (maxX - minX).toFixed(2) + ' x ' + (maxY - minY).toFixed(2) + ' x ' + (maxZ - minZ).toFixed(2));

  const b64 = ta => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
  return {
    p: b64(new Float32Array(P)), n: b64(new Float32Array(N)),
    c: b64(new Uint8Array(C)), i: b64(new Uint16Array(I))
  };
}

// The Nature Kit pine (models/pine.glb) carries flat material colours rather
// than an atlas, so it gets its own path: vertex colour = the material's
// baseColorFactor, which glTF already stores linear — exactly our format.
function bakeByMaterial(absFile, tint) {
  const b = fs.readFileSync(absFile);
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
      const idx = p.indices !== undefined ? acc(p.indices) : null;
      const mat = (j.materials || [])[p.material] || {};
      const f = (mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorFactor) || [0.5, 0.5, 0.5, 1];
      let rgb = [0, 1, 2].map(k => Math.max(0, Math.min(255, Math.round(f[k] * 255))));
      if (tint) rgb = tint(rgb);
      const count = pos.length / 3;
      for (let k = 0; k < count; k++) {
        const wp = xfp(m, pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
        const wn = xfn(m, nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
        P.push(wp[0], wp[1], wp[2]); N.push(wn[0], wn[1], wn[2]);
        C.push(rgb[0], rgb[1], rgb[2]);
      }
      if (idx) for (let k = 0; k < idx.length; k++) I.push(idx[k] + vOff);
      else for (let k = 0; k < count; k++) I.push(k + vOff);
      vOff += count;
    });
  });

  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let k = 0; k < P.length; k += 3) {
    minX = Math.min(minX, P[k]); maxX = Math.max(maxX, P[k]);
    minY = Math.min(minY, P[k + 1]); maxY = Math.max(maxY, P[k + 1]);
    minZ = Math.min(minZ, P[k + 2]); maxZ = Math.max(maxZ, P[k + 2]);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  for (let k = 0; k < P.length; k += 3) { P[k] -= cx; P[k + 1] -= minY; P[k + 2] -= cz; }
  console.log(path.basename(absFile).padEnd(16), 'verts:', String(vOff).padEnd(5), 'tris:', String(I.length / 3).padEnd(5),
    'size:', (maxX - minX).toFixed(2) + ' x ' + (maxY - minY).toFixed(2) + ' x ' + (maxZ - minZ).toFixed(2));

  const b64 = ta => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
  return {
    p: b64(new Float32Array(P)), n: b64(new Float32Array(N)),
    c: b64(new Uint8Array(C)), i: b64(new Uint16Array(I))
  };
}

const mf = decodePNG(fs.readFileSync(path.join(__dirname, 'forest/colormap-miniforest.png')));
const ar = decodePNG(fs.readFileSync(path.join(__dirname, 'forest/colormap-arena.png')));

const forest = {
  tree:      bake('tree', 'tree', mf),
  treeHigh:  bake('tree-high', 'tree', mf),
  rocksLow:  bake('rocks-low', 'stone', mf),
  rocksHigh: bake('rocks-high', 'stone', mf),
  stones:    bake('stones', 'stone', mf),
  plant:     bake('plant', 'plant', mf),
  grass:     bake('patch-grass', 'ground', mf),
  trophy:    bake('trophy', 'gold', ar),
  // Nature Kit rounded pine — the brand tree (main.html hero + the //dzian mark)
  pineRound: bakeByMaterial(path.join(__dirname, '../../models/pine.glb')),
  // The journal at the camp — Kenney Furniture Kit 'books', recoloured from
  // its carpet/metal palette to leather, paper and a gold clasp.
  journal:   bakeByMaterial(path.join(__dirname, 'forest/books.glb'), function (c) {
    const L = (c[0] + c[1] + c[2]) / 3;
    if (L > 205) return [232, 230, 220];   // pages
    if (L > 120) return [232, 200, 122];   // clasp / ribbon, firefly gold
    return [59, 42, 26];                   // leather cover
  })
};

const out = '// Forest set — CC0 models by Kenney (kenney.nl): Mini Forest + Starter Kit\n' +
  '// Basic Scene, atlas-sampled and recolored to the //dzian palette at bake\n' +
  '// time. Vertex-color geometry for InstancedMesh; decoded by creative.js.\n' +
  '// Do not edit by hand — rebake with tools/bake-props/bake-forest.js.\n' +
  'window.DZ_FOREST = ' + JSON.stringify(forest) + ';\n';
fs.writeFileSync(path.join(__dirname, '../../models/forest.js'), out);
console.log('written models/forest.js', (out.length / 1024).toFixed(1) + 'KB');
