// Bake the Sketchfab "Camping Bushcraft Ambience" GLB down to vertex-colour
// geometry (models/camp.js), so it can render in creative mode, which has no
// texture loader by design.
//
// The source is a 10MB scene: 293 meshes, ~19.4k verts, 7 PNG atlases — a camp
// sitting in its own forest. We keep only the camp (tent, fire, logs, crate,
// flame) and drop that forest, since //dzian already has one. The materials are
// KHR_materials_unlit, so their lighting is painted into the textures and
// survives a per-vertex bake cleanly.
// Run: node tools/bake-props/bake-camp.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');

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

const file = path.join(__dirname, 'camping_buscraft_ambience.glb');
const b = fs.readFileSync(file);
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

// decode each texture once
const texCache = {};
function texFor(matIndex) {
  const mat = (j.materials || [])[matIndex];
  if (!mat) return null;
  const bct = mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
  if (!bct) return null;
  const src = j.textures[bct.index].source;
  if (texCache[src] === undefined) {
    try { texCache[src] = decodePNG(bv(j.images[src].bufferView)); }
    catch (e) { console.log('  ! image ' + src + ': ' + e.message); texCache[src] = null; }
  }
  return texCache[src];
}

// world transforms: walk the node tree
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

// Which materials belong to which output. The source is a whole 30-unit forest
// scene; we keep only the camp itself. lambert6 (281 prims) is its trees/rocks
// and lambert3/7 are its ground — the //dzian forest supplies both already.
//
// The fire material covers two different things: the small burning log stack at
// the pit, and two big fallen logs a couple of units away. The scene wants those
// placed independently, so they split on the node's `fire3:` prefix.
const BUCKETS = { lambert5: 'tent', fire3lambert2: 'fire', lambert8: 'crate', lambert9: 'flame' };
const parts = { tent: [], fire: [], logs: [], crate: [], flame: [] };

function walk(nodeIdx, parent) {
  const node = j.nodes[nodeIdx];
  const m = parent ? mul(trs(node), parent) : trs(node);
  if (node.mesh !== undefined) {
    j.meshes[node.mesh].primitives.forEach(p => {
      const name = ((j.materials || [])[p.material] || {}).name || '';
      let bucket = BUCKETS[name.replace(/[^A-Za-z0-9]/g, '')];
      if (bucket === 'fire' && /^fire3:/.test(node.name || '')) bucket = 'logs';
      if (!bucket) return;                       // lambert6 = the 281-piece forest, lambert3/7 = ground
      const pos = acc(p.attributes.POSITION), nor = acc(p.attributes.NORMAL);
      const uv = p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null;
      const idx = p.indices !== undefined ? acc(p.indices) : null;
      const tex = texFor(p.material);
      parts[bucket].push({ pos, nor, uv, idx, tex, m });
    });
  }
  (node.children || []).forEach(c => walk(c, m));
}
(j.scenes[j.scene || 0].nodes).forEach(n => walk(n, null));

const srgb2lin = v => Math.round(Math.pow(v / 255, 2.2) * 255);

function build(list, label, tint) {
  const P = [], N = [], C = [], I = [];
  let vOff = 0;
  list.forEach(pr => {
    const count = pr.pos.length / 3;
    for (let k = 0; k < count; k++) {
      const wp = xfp(pr.m, pr.pos[k*3], pr.pos[k*3+1], pr.pos[k*3+2]);
      const wn = xfn(pr.m, pr.nor[k*3], pr.nor[k*3+1], pr.nor[k*3+2]);
      P.push(wp[0], wp[1], wp[2]); N.push(wn[0], wn[1], wn[2]);
      let c = [140, 140, 140];
      if (pr.tex && pr.uv) {
        c = pr.tex.px(Math.floor(pr.uv[k*2] * pr.tex.w), Math.floor(pr.uv[k*2+1] * pr.tex.h));
      }
      if (tint) c = tint(c);
      C.push(srgb2lin(c[0]), srgb2lin(c[1]), srgb2lin(c[2]));
    }
    if (pr.idx) for (let k = 0; k < pr.idx.length; k++) I.push(pr.idx[k] + vOff);
    else for (let k = 0; k < count; k++) I.push(k + vOff);
    vOff += count;
  });

  let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
  for (let k = 0; k < P.length; k += 3) for (let c = 0; c < 3; c++) {
    mn[c] = Math.min(mn[c], P[k+c]); mx[c] = Math.max(mx[c], P[k+c]);
  }
  const cx = (mn[0]+mx[0])/2, cz = (mn[2]+mx[2])/2;
  for (let k = 0; k < P.length; k += 3) { P[k] -= cx; P[k+1] -= mn[1]; P[k+2] -= cz; }
  console.log(label.padEnd(8), 'verts:', String(vOff).padEnd(6), 'tris:', String(Math.round(I.length/3)).padEnd(6),
    'size:', mx.map((v,i)=>(v-mn[i]).toFixed(2)).join(' x '));
  if (I.length && vOff > 65535) console.log('  ! over 65535 verts — needs Uint32 indices');
  const b64 = ta => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
  return { p: b64(new Float32Array(P)), n: b64(new Float32Array(N)),
           c: b64(new Uint8Array(C)), i: b64(new Uint16Array(I)) };
}

// The tarp atlas has a stray cyan region (9 verts) that reads as a hole punched
// in the canvas. Nothing else in the set is blue-dominant, so clamping those to
// the tarp's own average brown is safe and costs nothing at runtime.
const tarpTint = c => (c[2] > c[0] + 18 && c[2] > 30) ? [86, 64, 43] : c;

const out = {
  tent:  build(parts.tent,  'tent', tarpTint),
  fire:  build(parts.fire,  'fire'),
  logs:  build(parts.logs,  'logs'),
  crate: build(parts.crate, 'crate'),
  flame: build(parts.flame, 'flame')
};
const js = '// Camp set — tent, campfire, fallen logs, crate, flame. Baked from a Sketchfab\n' +
  '// GLB to vertex colours, because creative mode has no texture loader. Textures\n' +
  '// are sampled per vertex at bake time and then discarded; the source is unlit,\n' +
  '// so its shading comes along for free. Rebake: node tools/bake-props/bake-camp.js\n' +
  'window.DZ_CAMP = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '../../models/camp.js'), js);
console.log('written models/camp.js', (js.length / 1024).toFixed(0) + 'KB  (source GLB is 9910KB)');
