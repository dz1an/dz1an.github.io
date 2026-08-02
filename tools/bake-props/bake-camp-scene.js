// Bake the camp half of the Sketchfab "Camping Bushcraft Ambience" GLB into the
// closing stage for main.html (models/camp-scene.glb).
//
// This is the sibling of bake-forest-scene.js: main.html renders through
// <model-viewer>, so it wants a GLB, not the window.DZ_* data files the creative
// mode uses. models/camp.js already carries this camp for the 3D playground —
// but that bake drops the surrounding forest and ground, because the playground
// grows its own. Here the opposite is true: the camp has to read as a PLACE on
// its own little island, matching the hero diorama's language.
//
// Cost control, in order of effect:
//   - only forest within KEEP_RADIUS of the fire survives (the source scene
//     stretches 30 units out; past ~6 it is set dressing nobody will see)
//   - the crate is dropped — terracotta is off the sage + firefly palette
//   - COLOR_0 is normalized UNSIGNED_BYTE rather than float: a third of the
//     bytes, and colour resolution is not what sells this shot
// ~19.4k verts -> ~7.5k, and the element is loading="lazy" at the foot of the
// page, so it never touches first paint.
//
// Run: node tools/bake-props/prep-camp-scene-tex.js && node tools/bake-props/bake-camp-scene.js
// Source: "camping buscraft ambience" by Edgar_koh, CC-BY-4.0. Attribution required.
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const SRC = path.join(__dirname, 'camping_buscraft_ambience.glb');
const DST = path.join(__dirname, '../../models/camp-scene.glb');
// Camp only — tent, fire, fallen logs, flame. NO ground and NO forest, and that
// is deliberate:
//
// This scene's "ground" is a 30-unit bowl, and the camp sits well off-centre on
// it. Recentre on the fire (which any orbit has to) and the near field ends up
// with no ground under it at all — the props read as floating with a stripe of
// terrain behind them. Trimming that bowl into a tidy island is not something
// the source geometry supports.
//
// So the page supplies the ground instead: this sits on the green contact block,
// and model-viewer's own shadow plane grounds it. Nothing to misalign, no hard
// terrain edge to read as a pasted-in rectangle, and a third of the vertices.
const KEEP = ['lambert5', 'fire3lambert2', 'lambert9'];   // tent, fire+logs, flame
const TARGET_HEIGHT = 4;       // same scale language as the hero diorama

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
    x = ((x % w) + w) % w; y = ((y % h) + h) % h;
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

// This GLB embeds PNGs, so unlike the forest scene it needs no prep step.
const texCache = {};
function texFor(matIndex) {
  const mat = (j.materials || [])[matIndex];
  const bct = mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
  if (!bct) return null;
  const src = j.textures[bct.index].source;
  if (texCache[src] === undefined) {
    try { texCache[src] = decodePNG(bv(j.images[src].bufferView)); }
    catch (e) { console.log('  ! image ' + src + ': ' + e.message); texCache[src] = null; }
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

// Pass 1 — collect every primitive with its world bbox, so the fire can be found
// and the forest culled around it.
const all = [];
function walk(nodeIdx, parent) {
  const node = j.nodes[nodeIdx];
  const m = parent ? mul(trs(node), parent) : trs(node);
  if (node.mesh !== undefined) {
    j.meshes[node.mesh].primitives.forEach(p => {
      const name = (((j.materials || [])[p.material] || {}).name || '').replace(/[^A-Za-z0-9]/g, '');
      if (KEEP.indexOf(name) < 0) return;
      // The fire material also covers two big fallen trunks parked several units
      // away. They drag the bounding box off to one side, and model-viewer frames
      // on that box — so the camp would sit off-centre in its own shot.
      if (/^fire3:/.test(node.name || '')) return;
      const pos = acc(p.attributes.POSITION);
      let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
      for (let k = 0; k < pos.length; k += 3) {
        const w = xfp(m, pos[k], pos[k+1], pos[k+2]);
        for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], w[c]); mx[c] = Math.max(mx[c], w[c]); }
      }
      all.push({ name, pos, nor: acc(p.attributes.NORMAL),
        uv: p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null,
        idx: p.indices !== undefined ? acc(p.indices) : null,
        tex: texFor(p.material), m, mn, mx });
    });
  }
  (node.children || []).forEach(c => walk(c, m));
}
(j.scenes[j.scene || 0].nodes).forEach(n => walk(n, null));

let f = [1e9,1e9,1e9], F = [-1e9,-1e9,-1e9];
all.filter(x => /fire/i.test(x.name)).forEach(x => {
  for (let c = 0; c < 3; c++) { f[c] = Math.min(f[c], x.mn[c]); F[c] = Math.max(F[c], x.mx[c]); }
});
const fx = (f[0]+F[0])/2, fz = (f[2]+F[2])/2;

const kept = all;
console.log('  fire at', fx.toFixed(2) + ',' + fz.toFixed(2), '— kept', kept.length, 'primitives');

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
    // COLOR_0 is linear per the glTF spec, so de-gamma the sRGB texel. Stored as
    // a normalized byte + opaque alpha (VEC3 ubyte would need padding anyway).
    C.push(Math.round(Math.pow(c[0]/255, 2.2) * 255),
           Math.round(Math.pow(c[1]/255, 2.2) * 255),
           Math.round(Math.pow(c[2]/255, 2.2) * 255), 255);
  }
  if (pr.idx) for (let k = 0; k < pr.idx.length; k++) I.push(pr.idx[k] + vOff);
  else for (let k = 0; k < count; k++) I.push(k + vOff);
  vOff += count;
});

let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
for (let k = 0; k < P.length; k += 3) for (let c = 0; c < 3; c++) {
  mn[c] = Math.min(mn[c], P[k+c]); mx[c] = Math.max(mx[c], P[k+c]);
}
// Centre on the bounding box so the tent and the fire straddle the origin
// evenly — model-viewer frames and orbits around that box, so anything else
// puts the camp off to one side of its own shot. (With the ground gone there
// is nothing left that needs the fire as the origin.)
const S = TARGET_HEIGHT / (mx[1] - mn[1]);
const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
for (let k = 0; k < P.length; k += 3) {
  P[k] = (P[k] - cx) * S; P[k+1] = (P[k+1] - mn[1]) * S; P[k+2] = (P[k+2] - cz) * S;
}
console.log('  source size', mx.map((v,i)=>(v-mn[i]).toFixed(1)).join(' x '), '-> scaled x', S.toFixed(4));

const pos = new Float32Array(P), nor = new Float32Array(N), col = new Uint8Array(C);
const idx = vOff > 65535 ? new Uint32Array(I) : new Uint16Array(I);
const pad4 = n => (4 - (n % 4)) % 4;
const views = [], chunks = [];
let cursor = 0;
[pos, nor, col, idx].forEach(ta => {
  const buf = Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength);
  views.push({ buffer: 0, byteOffset: cursor, byteLength: buf.length });
  chunks.push(buf);
  const pad = pad4(buf.length);
  if (pad) chunks.push(Buffer.alloc(pad));
  cursor += buf.length + pad;
});
const binBuf = Buffer.concat(chunks);

let pmn = [1e9,1e9,1e9], pmx = [-1e9,-1e9,-1e9];
for (let k = 0; k < P.length; k += 3) for (let c = 0; c < 3; c++) {
  pmn[c] = Math.min(pmn[c], P[k+c]); pmx[c] = Math.max(pmx[c], P[k+c]);
}

const gltf = {
  asset: { version: '2.0', generator: 'dzian bake-camp-scene', extras: {
    title: 'camping buscraft ambience (camp only, vertex-coloured)',
    author: 'Edgar_koh (https://sketchfab.com/edgar_koh)',
    license: 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
    source: 'https://sketchfab.com/3d-models/camping-buscraft-ambience-7b65e4df95c3492fbf4e0641e3b472c1' } },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'camp' }],
  meshes: [{ name: 'camp', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0 }] }],
  materials: [{ name: 'camp', doubleSided: true,
    pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: vOff, type: 'VEC3', min: pmn, max: pmx },
    { bufferView: 1, componentType: 5126, count: vOff, type: 'VEC3' },
    { bufferView: 2, componentType: 5121, normalized: true, count: vOff, type: 'VEC4' },
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
console.log('written models/camp-scene.glb', (glb.length / 1024).toFixed(0) + 'KB  ' +
  vOff + ' verts, ' + Math.round(I.length / 3) + ' tris  (source GLB was ' + Math.round(b.length / 1024) + 'KB)');
