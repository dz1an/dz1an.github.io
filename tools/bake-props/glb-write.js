// Shared glTF-binary writer for the main.html stages.
//
// main.html renders through <model-viewer>, which wants a GLB — unlike creative
// mode, which eats the window.DZ_* data files directly.
//
// The important thing this does is NOT merge. A composed scene places the same
// pine eight times; merging would write that pine's ~680 vertices eight times and
// the file balloons (the first cut of the trail scene was 661KB). glTF already
// solves this: store each prop's geometry ONCE, then add a node per placement
// with its own transform. Same pixels, a fraction of the bytes.
//
// Per-instance brightness still works without duplicating geometry either: a mesh
// primitive binds accessors AND a material, so tinted variants are extra meshes
// pointing at the *same* accessors with a different baseColorFactor.
//
// COLOR_0 is linear per the glTF spec. The DZ_* bakes already store linear bytes
// (bake.js/bake-forest.js apply the sRGB->linear ramp at author time), so colour
// bytes pass through untouched — do NOT de-gamma them a second time.
const fs = require('fs');

const b64 = s => Buffer.from(s, 'base64');
function decodeProp(def) {
  const bp = b64(def.p), bn = b64(def.n), bi = b64(def.i);
  return {
    p: new Float32Array(bp.buffer, bp.byteOffset, bp.length / 4),
    n: new Float32Array(bn.buffer, bn.byteOffset, bn.length / 4),
    c: new Uint8Array(b64(def.c)),
    i: new Uint16Array(bi.buffer, bi.byteOffset, bi.length / 2)
  };
}

function Scene() {
  this.props = new Map();   // def -> { key, geo }
  this.tints = [];          // unique brightness multipliers
  this.nodes = [];          // { key, tint, x, y, z, s, ry }
}

// Place one copy of a baked DZ_* prop. Nothing is merged; this only records a
// placement, so extra instances cost ~60 bytes of JSON each — density is cheap
// here, geometry variety is not.
//
// `tint` is either a brightness multiplier or an [r,g,b] triple, applied through
// the material's baseColorFactor. Per-channel matters because these props were
// baked for creative mode's night palette and some need warming to sit on cream.
Scene.prototype.add = function (def, x, y, z, s, ry, tint) {
  if (!this.props.has(def)) {
    this.props.set(def, { key: 'p' + this.props.size, geo: decodeProp(def) });
  }
  let t = tint === undefined ? [1, 1, 1] : (Array.isArray(tint) ? tint.slice() : [tint, tint, tint]);
  t = t.map(v => Math.round(v * 20) / 20);            // bucket to 0.05 to limit materials
  const tk = t.join(',');
  if (this.tints.indexOf(tk) < 0) this.tints.push(tk);
  this.nodes.push({ key: this.props.get(def).key, tint: tk,
    x: x, y: y, z: z, s: s === undefined ? 1 : s, ry: ry || 0 });
  return this;
};

// Centre the whole composition on X/Z and drop it to y=0, by shifting the node
// translations — the shared geometry is never touched.
Scene.prototype.centre = function () {
  const byKey = {};
  this.props.forEach(v => {
    const g = v.geo;
    let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
    for (let k = 0; k < g.p.length; k += 3) for (let c = 0; c < 3; c++) {
      mn[c] = Math.min(mn[c], g.p[k+c]); mx[c] = Math.max(mx[c], g.p[k+c]);
    }
    byKey[v.key] = { mn, mx };
  });
  let MN = [1e9,1e9,1e9], MX = [-1e9,-1e9,-1e9];
  this.nodes.forEach(nd => {
    const bb = byKey[nd.key], cy = Math.cos(nd.ry), sy = Math.sin(nd.ry);
    // rotate the box corners about Y so the bounds stay honest
    for (const cx of [bb.mn[0], bb.mx[0]]) for (const cz of [bb.mn[2], bb.mx[2]]) {
      const wx = (cx * cy + cz * sy) * nd.s + nd.x, wz = (-cx * sy + cz * cy) * nd.s + nd.z;
      MN[0] = Math.min(MN[0], wx); MX[0] = Math.max(MX[0], wx);
      MN[2] = Math.min(MN[2], wz); MX[2] = Math.max(MX[2], wz);
    }
    MN[1] = Math.min(MN[1], bb.mn[1] * nd.s + nd.y);
    MX[1] = Math.max(MX[1], bb.mx[1] * nd.s + nd.y);
  });
  const dx = (MN[0] + MX[0]) / 2, dz = (MN[2] + MX[2]) / 2, dy = MN[1];
  this.nodes.forEach(nd => { nd.x -= dx; nd.y -= dy; nd.z -= dz; });
  this.size = [MX[0]-MN[0], MX[1]-MN[1], MX[2]-MN[2]];
  return this;
};

Scene.prototype.write = function (dst, meta) {
  const pad4 = n => (4 - (n % 4)) % 4;
  const views = [], chunks = [], accessors = [];
  let cursor = 0;
  const pushView = (ta, target) => {
    const buf = Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength);
    views.push({ buffer: 0, byteOffset: cursor, byteLength: buf.length, target: target });
    chunks.push(buf);
    const pad = pad4(buf.length);
    if (pad) chunks.push(Buffer.alloc(pad));
    cursor += buf.length + pad;
    return views.length - 1;
  };

  // One set of accessors per distinct prop.
  const accOf = {};
  let totalVerts = 0, totalTris = 0;
  this.props.forEach(v => {
    const g = v.geo, count = g.p.length / 3;
    let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
    for (let k = 0; k < g.p.length; k += 3) for (let c = 0; c < 3; c++) {
      mn[c] = Math.min(mn[c], g.p[k+c]); mx[c] = Math.max(mx[c], g.p[k+c]);
    }
    const col = new Uint8Array(count * 4);
    for (let k = 0; k < count; k++) {
      col[k*4] = g.c[k*3]; col[k*4+1] = g.c[k*3+1]; col[k*4+2] = g.c[k*3+2]; col[k*4+3] = 255;
    }
    const vp = pushView(g.p, 34962), vn = pushView(g.n, 34962),
          vc = pushView(col, 34962), vi = pushView(g.i, 34963);
    accOf[v.key] = {
      POSITION: accessors.push({ bufferView: vp, componentType: 5126, count: count, type: 'VEC3', min: mn, max: mx }) - 1,
      NORMAL:   accessors.push({ bufferView: vn, componentType: 5126, count: count, type: 'VEC3' }) - 1,
      COLOR_0:  accessors.push({ bufferView: vc, componentType: 5121, normalized: true, count: count, type: 'VEC4' }) - 1,
      indices:  accessors.push({ bufferView: vi, componentType: 5123, count: g.i.length, type: 'SCALAR' }) - 1
    };
    totalVerts += count;
  });

  // A material per brightness bucket; meshes are (prop x bucket) pairs sharing
  // the same accessors.
  const materials = this.tints.map(t => {
    const rgb = t.split(',').map(Number);
    return { name: 'vc' + t, doubleSided: true,
      pbrMetallicRoughness: { baseColorFactor: [rgb[0], rgb[1], rgb[2], 1], metallicFactor: 0, roughnessFactor: 1 } };
  });
  const meshes = [], meshIndex = {};
  this.nodes.forEach(nd => {
    const id = nd.key + '|' + nd.tint;
    if (meshIndex[id] === undefined) {
      const a = accOf[nd.key];
      meshIndex[id] = meshes.push({ name: id, primitives: [{
        attributes: { POSITION: a.POSITION, NORMAL: a.NORMAL, COLOR_0: a.COLOR_0 },
        indices: a.indices, material: this.tints.indexOf(nd.tint) }] }) - 1;
    }
    totalTris += accessors[accOf[nd.key].indices].count / 3;
  });

  const nodes = this.nodes.map(nd => {
    const o = { mesh: meshIndex[nd.key + '|' + nd.tint] };
    if (nd.x || nd.y || nd.z) o.translation = [nd.x, nd.y, nd.z];
    if (nd.ry) o.rotation = [0, Math.sin(nd.ry / 2), 0, Math.cos(nd.ry / 2)];
    if (nd.s !== 1) o.scale = [nd.s, nd.s, nd.s];
    return o;
  });

  const binBuf = Buffer.concat(chunks);
  const gltf = {
    asset: { version: '2.0', generator: 'dzian glb-write', extras: meta || {} },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes: nodes, meshes: meshes, materials: materials, accessors: accessors,
    bufferViews: views, buffers: [{ byteLength: binBuf.length }]
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
  fs.writeFileSync(dst, glb);
  return { bytes: glb.length, storedVerts: totalVerts, drawnTris: Math.round(totalTris),
           props: this.props.size, instances: this.nodes.length,
           size: (this.size || [0,0,0]).map(v => v.toFixed(2)).join(' x ') };
};

module.exports = { Scene };
