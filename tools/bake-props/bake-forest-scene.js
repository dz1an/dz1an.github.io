// Rebuild the Sketchfab "Forest Scene" GLB into the small, vertex-coloured GLB
// that main.html's <model-viewer> actually wants (models/forest-scene.glb).
//
// Two things are wrong with the source for our purposes:
//
//  1. It ships a 78,000-unit skybox (Object_0) and a full-screen mist plane
//     around a forest that is only ~500 units across. model-viewer frames a
//     model by its bounding box, so the box wins: the forest collapses to a
//     speck and the enclosing geometry fills the frame. No camera-orbit value
//     can fix that — the geometry has to go.
//  2. Its colour lives in 2.7MB of JPEG atlases. Everything else on this site
//     bakes texture colour down to vertices at author time, and doing the same
//     here removes the texture pipeline from the page entirely.
//
// So: keep the five forest meshes, drop the skybox / ground quad / mist plane,
// flatten node transforms, sample each atlas per vertex into COLOR_0, recentre
// on the origin, and emit a GLB with no images, textures or samplers at all.
//
// The JPEGs are converted to PNG first (this file has a PNG decoder, not a JPEG
// one) — see PREP below. Run: node tools/bake-props/bake-forest-scene.js
//
// Source: "Forest Scene" by Dries Deryckere, CC-BY-4.0. Attribution required.
const fs = require('fs'), path = require('path'), zlib = require('zlib');

// PREP (already done once, rerun if the source GLB changes):
//   node -e "...extract j.images bufferViews to TEX/img<i>.<ext>..."
//   powershell -c "Add-Type -AssemblyName System.Drawing; ... Image.FromFile -> Save(Png)"
const TEX = path.join(__dirname, 'forest-scene-tex');   // img0.png .. img7.png
const SRC = path.join(__dirname, 'forest_scene.glb');
const DST = path.join(__dirname, '../../models/forest-scene.glb');

// Meshes to keep, by material name. Material__24 is the skybox, __45 the black
// ground quad, __43 the alpha-blended mist plane — all dropped.
const KEEP = ['Material__1', 'Material__20', 'Material__21', 'Material__22', 'Material__23'];

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
  if (bitDepth !== 8) throw new Error('unsupported bit depth ' + bitDepth);
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
  return { w, h, px(x, y) {
    x = ((x % w) + w) % w; y = ((y % h) + h) % h;      // UVs here run outside 0..1
    if (colorType === 3) { const i = out[y * stride + x]; return [plte[i * 3], plte[i * 3 + 1], plte[i * 3 + 2]]; }
    const o = y * stride + x * ch;
    return ch <= 2 ? [out[o], out[o], out[o]] : [out[o], out[o + 1], out[o + 2]];
  }};
}

const b = fs.readFileSync(SRC);
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

const texCache = {};
function texFor(matIndex) {
  const mat = (j.materials || [])[matIndex];
  const bct = mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
  if (!bct) return null;
  const src = j.textures[bct.index].source;
  if (texCache[src] === undefined) {
    const f = path.join(TEX, 'img' + src + '.png');
    try { texCache[src] = decodePNG(fs.readFileSync(f)); }
    catch (e) { console.log('  ! img' + src + ': ' + e.message); texCache[src] = null; }
  }
  return texCache[src];
}

function trs(node) {
  const t = node.translation || [0, 0, 0], q = node.rotation || [0, 0, 0, 1], s = node.scale || [1, 1, 1];
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1];
}
function mul(a, c) {
  const o = new Array(16);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) {
    o[i * 4 + k] = a[k] * c[i * 4] + a[4 + k] * c[i * 4 + 1] + a[8 + k] * c[i * 4 + 2] + a[12 + k] * c[i * 4 + 3];
  }
  return o;
}
const xfp = (m, x, y, z) => [m[0]*x + m[4]*y + m[8]*z + m[12], m[1]*x + m[5]*y + m[9]*z + m[13], m[2]*x + m[6]*y + m[10]*z + m[14]];
const xfn = (m, x, y, z) => { const v = [m[0]*x + m[4]*y + m[8]*z, m[1]*x + m[5]*y + m[9]*z, m[2]*x + m[6]*y + m[10]*z]; const l = Math.hypot(...v) || 1; return v.map(k => k / l); };

const kept = [];
function walk(nodeIdx, parent) {
  const node = j.nodes[nodeIdx];
  const m = parent ? mul(trs(node), parent) : trs(node);
  if (node.mesh !== undefined) {
    j.meshes[node.mesh].primitives.forEach(p => {
      const name = ((j.materials || [])[p.material] || {}).name || '';
      if (KEEP.indexOf(name) < 0) return;
      kept.push({
        pos: acc(p.attributes.POSITION),
        nor: acc(p.attributes.NORMAL),
        uv: p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null,
        idx: p.indices !== undefined ? acc(p.indices) : null,
        tex: texFor(p.material), m, name
      });
    });
  }
  (node.children || []).forEach(c => walk(c, m));
}
(j.scenes[j.scene || 0].nodes).forEach(n => walk(n, null));

// Merge everything into one primitive: one mesh, one material, one draw call.
const P = [], N = [], C = [], I = [];
let vOff = 0;
kept.forEach(pr => {
  const count = pr.pos.length / 3;
  for (let k = 0; k < count; k++) {
    const wp = xfp(pr.m, pr.pos[k*3], pr.pos[k*3+1], pr.pos[k*3+2]);
    const wn = xfn(pr.m, pr.nor[k*3], pr.nor[k*3+1], pr.nor[k*3+2]);
    P.push(wp[0], wp[1], wp[2]); N.push(wn[0], wn[1], wn[2]);
    let c = [140, 140, 140];
    if (pr.tex && pr.uv) c = pr.tex.px(Math.floor(pr.uv[k*2] * pr.tex.w), Math.floor(pr.uv[k*2+1] * pr.tex.h));
    // glTF defines COLOR_0 as linear, and three.js multiplies it into the base
    // colour in linear space — so the sRGB texel has to be de-gamma'd here or
    // the whole model renders washed out.
    C.push(Math.pow(c[0] / 255, 2.2), Math.pow(c[1] / 255, 2.2), Math.pow(c[2] / 255, 2.2));
  }
  if (pr.idx) for (let k = 0; k < pr.idx.length; k++) I.push(pr.idx[k] + vOff);
  else for (let k = 0; k < count; k++) I.push(k + vOff);
  vOff += count;
  console.log('  kept', pr.name.padEnd(14), count, 'v');
});

// This scene is authored Z-up, even after its node transforms are applied: the
// normal histogram comes out +Z 896 / -Z 264 while X and Y sit balanced, which
// is the signature of a ground surface facing +Z. glTF is Y-up, so rotate -90°
// about X — (x, y, z) -> (x, z, -y) — or the diorama stands on its edge.
for (let k = 0; k < P.length; k += 3) {
  const y = P[k+1], z = P[k+2];
  P[k+1] = z; P[k+2] = -y;
  const ny = N[k+1], nz = N[k+2];
  N[k+1] = nz; N[k+2] = -ny;
}

// Recentre: X/Z to the middle, Y so the model sits on its own ground. Then scale
// the whole thing to ~4 units tall, so it composes with the rest of the page in
// sane numbers instead of hundreds.
let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
for (let k = 0; k < P.length; k += 3) for (let c = 0; c < 3; c++) {
  mn[c] = Math.min(mn[c], P[k+c]); mx[c] = Math.max(mx[c], P[k+c]);
}
const cx = (mn[0]+mx[0])/2, cz = (mn[2]+mx[2])/2;
const S = 4 / (mx[1] - mn[1]);
for (let k = 0; k < P.length; k += 3) {
  P[k] = (P[k] - cx) * S; P[k+1] = (P[k+1] - mn[1]) * S; P[k+2] = (P[k+2] - cz) * S;
}
console.log('source size', mx.map((v,i)=>(v-mn[i]).toFixed(0)).join(' x '), '-> scaled x', S.toFixed(4));

// --- emit a fresh GLB: one buffer, four accessors, no images ---
const pos = new Float32Array(P), nor = new Float32Array(N), col = new Float32Array(C);
const idx = vOff > 65535 ? new Uint32Array(I) : new Uint16Array(I);
const pad4 = n => (4 - (n % 4)) % 4;

const parts = [pos, nor, col, idx];
const views = [], chunks = [];
let cursor = 0;
parts.forEach(ta => {
  const buf = Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength);
  views.push({ buffer: 0, byteOffset: cursor, byteLength: buf.length });
  chunks.push(buf);
  const pad = pad4(buf.length);
  if (pad) { chunks.push(Buffer.alloc(pad)); }
  cursor += buf.length + pad;
});
const binBuf = Buffer.concat(chunks);

let pmn = [1e9,1e9,1e9], pmx = [-1e9,-1e9,-1e9];
for (let k = 0; k < P.length; k += 3) for (let c = 0; c < 3; c++) {
  pmn[c] = Math.min(pmn[c], P[k+c]); pmx[c] = Math.max(pmx[c], P[k+c]);
}

const gltf = {
  asset: {
    version: '2.0',
    generator: 'dzian bake-forest-scene',
    extras: {
      title: 'Forest Scene (trimmed, vertex-coloured)',
      author: 'Dries Deryckere (https://sketchfab.com/deryckeredries)',
      license: 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
      source: 'https://sketchfab.com/3d-models/forest-scene-e5eb4867faba465d99deda487c56fbd6'
    }
  },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'forest' }],
  meshes: [{ name: 'forest', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0 }] }],
  // White base colour so COLOR_0 comes through unchanged; fully rough, no metal.
  materials: [{ name: 'forest', doubleSided: true,
    pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: vOff, type: 'VEC3', min: pmn, max: pmx },
    { bufferView: 1, componentType: 5126, count: vOff, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: vOff, type: 'VEC3' },
    { bufferView: 3, componentType: vOff > 65535 ? 5125 : 5123, count: I.length, type: 'SCALAR' }
  ],
  bufferViews: views.map((v, i) => (i === 3 ? { ...v, target: 34963 } : { ...v, target: 34962 })),
  buffers: [{ byteLength: binBuf.length }]
};

let jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
if (pad4(jsonBuf.length)) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length), 0x20)]);

const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
const jHead = Buffer.alloc(8); jHead.writeUInt32LE(jsonBuf.length, 0); jHead.write('JSON', 4, 'ascii');
const bHead = Buffer.alloc(8); bHead.writeUInt32LE(binBuf.length, 0); bHead.write('BIN\0', 4, 'ascii');

const glb = Buffer.concat([header, jHead, jsonBuf, bHead, binBuf]);
fs.writeFileSync(DST, glb);
console.log('written models/forest-scene.glb', (glb.length / 1024).toFixed(0) + 'KB  ' +
  vOff + ' verts, ' + Math.round(I.length / 3) + ' tris  (source GLB was ' + Math.round(b.length / 1024) + 'KB)');
