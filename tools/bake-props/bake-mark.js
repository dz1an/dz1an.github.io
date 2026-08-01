// Render the Kenney pine (models/forest.js "treeHigh") to flat SVG polygons —
// the //dzian brand mark. Vector, so it stays crisp at any size and can be
// inlined straight into the page (no request, instant in the loader).
// Run: node tools/bake-props/bake-mark.js
const fs = require('fs'), path = require('path');

global.window = {};
require(path.join(__dirname, '../../models/forest.js'));
const def = global.window.DZ_FOREST[process.argv[2] || "tree"];

const b64 = s => Buffer.from(s, 'base64');
const F32 = s => { const b = b64(s); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
const P = F32(def.p), N = F32(def.n);
const C = new Uint8Array(b64(def.c));
const idxBuf = b64(def.i);
const I = new Uint16Array(idxBuf.buffer, idxBuf.byteOffset, idxBuf.length / 2);

// ---- camera: orthographic, slight turn so the facets read as 3D ----
const YAW = 0.42, PITCH = 0.12;
const cy = Math.cos(YAW), sy = Math.sin(YAW);
const cp = Math.cos(PITCH), sp = Math.sin(PITCH);
function project(x, y, z) {
  let X = x * cy + z * sy;
  let Z = -x * sy + z * cy;
  let Y = y * cp - Z * sp;
  Z = y * sp + Z * cp;
  return [X, Y, Z];
}

// bounds after projection
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
for (let k = 0; k < P.length; k += 3) {
  const [x, y] = project(P[k], P[k + 1], P[k + 2]);
  minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const PAD = 0.06;
const w = (maxX - minX), h = (maxY - minY);
const VW = 1000;                                    // viewBox width
const scale = VW / (w * (1 + PAD * 2));
const VH = Math.round(h * scale * (1 + PAD * 2));
const ox = -minX * scale + w * PAD * scale;
const oy = maxY * scale + h * PAD * scale;          // flip Y for SVG
const px = (x, y) => [(x * scale + ox), (oy - y * scale)];

// ---- shading: one key light + ambient, applied to the baked vertex colours ----
const KEY = (() => { const v = [-0.45, 0.82, 0.36]; const l = Math.hypot(...v); return v.map(n => n / l); })();
const lin2srgb = v => Math.max(0, Math.min(255, Math.round(Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2) * 255)));

const faces = [];
for (let t = 0; t < I.length; t += 3) {
  const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
  // face normal in camera space (for backface cull + shading)
  const nx = (N[a] + N[b] + N[c]) / 3, ny = (N[a + 1] + N[b + 1] + N[c + 1]) / 3, nz = (N[a + 2] + N[b + 2] + N[c + 2]) / 3;
  const [pnx, pny, pnz] = project(nx, ny, nz);
  // No backface culling: with the faces sorted far-to-near below, the near
  // ones paint over the far ones and the silhouette comes out exact. A normal
  // -based cull here dropped most of the canopy and left only edge-on slivers.
  const pa = project(P[a], P[a + 1], P[a + 2]);
  const pb = project(P[b], P[b + 1], P[b + 2]);
  const pc = project(P[c], P[c + 1], P[c + 2]);
  const lit = 0.52 + 0.62 * Math.max(0, nx * KEY[0] + ny * KEY[1] + nz * KEY[2]);
  const col = [0, 0, 0];
  for (const vi of [a, b, c]) { col[0] += C[vi] / 3; col[1] += C[vi + 1] / 3; col[2] += C[vi + 2] / 3; }
  const hex = '#' + col.map(v => lin2srgb((v / 255) * lit).toString(16).padStart(2, '0')).join('');
  faces.push({ z: (pa[2] + pb[2] + pc[2]) / 3, pts: [pa, pb, pc].map(p => px(p[0], p[1])), hex });
}
faces.sort((f, g) => f.z - g.z);                    // painter's algorithm

const poly = faces.map(f =>
  '<path fill="' + f.hex + '" d="M' + f.pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z"/>'
).join('');

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH + '" ' +
  'shape-rendering="crispEdges" aria-hidden="true">' + poly + '</svg>';

const out = path.join(__dirname, '../../images/mark-pine.svg');
fs.writeFileSync(out, svg);
console.log('faces kept:', faces.length, 'of', I.length / 3);
console.log('viewBox:', VW + 'x' + VH);
console.log('written images/mark-pine.svg', (svg.length / 1024).toFixed(1) + 'KB');
