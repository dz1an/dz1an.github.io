// Compose the two middle stages of main.html out of the CC0 Kenney sets that are
// already baked, and emit them as GLBs for <model-viewer>.
//
//   models/trail-scene.glb  -> #work        a lit path, one lantern per project
//   models/award-scene.glb  -> #background  the trophy on a stone cairn
//
// These are COMPOSITIONS of real models — pines, rocks, lamp posts, road tiles,
// the trophy — not hand-built primitive art. That distinction is the house rule:
// primitives got rejected twice, real models did not.
//
// Both sit on cream (.blocklight) sections, so they are lit and coloured to read
// against cream rather than against the night palette creative mode uses.
//
// Run: node tools/bake-props/bake-page-scenes.js
// Sources: Kenney Mini Forest + Fantasy Town Kit + Starter Kit Basic Scene, all
// CC0 — no attribution obligation, though the site credits Kenney anyway.
const fs = require('fs'), path = require('path');
const { Scene } = require('./glb-write');

const REPO = path.join(__dirname, '../..');
global.window = {};
eval(fs.readFileSync(path.join(REPO, 'models/forest.js'), 'utf8'));
eval(fs.readFileSync(path.join(REPO, 'models/town.js'), 'utf8'));
const F = global.window.DZ_FOREST, T = global.window.DZ_TOWN;

// A fixed pseudo-random so reruns are byte-identical. Math.random() would make
// every rebake a diff.
let seed = 20260802;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const between = (a, b) => a + (b - a) * rnd();

// ---------------------------------------------------------------- trail (#work)
// A path running away from the viewer with lamp posts down it — one per project
// in the section beside it. Kept deliberately short: a long thin scene framed by
// its bounding box ends up tiny and far away.
function buildTrail() {
  const b = new Scene();
  // The town kit's road is slate grey, which reads as urban concrete against
  // this page's cream. Warm and lift it so it passes for a packed-earth track.
  const PATH = [1.18, 1.10, 0.88];
  const LEN = 9;                                  // road tiles, 1 unit each
  const bend = z => Math.sin(z * 0.42) * 0.75;    // the path wanders
  for (let i = 0; i < LEN; i++) {
    const z = i - LEN / 2, drift = bend(z);
    b.add(T.road, drift - 0.5, 0, z, 1, 0, PATH);
    b.add(T.road, drift + 0.5, 0, z, 1, 0, [PATH[0]*0.95, PATH[1]*0.95, PATH[2]*0.95]);
  }
  // Lamp posts down the trail — one per project row in the section beside it.
  [-3.4, -1.7, 0.0, 1.7, 3.4].forEach((z, i) => {
    const side = i % 2 ? 1.35 : -1.35;
    b.add(T.lantern, bend(z) + side, 0, z, 1.1, rnd() * 6.28, [1.25, 1.15, 0.95]);
  });
  // Woods pressing in on both sides. Instancing makes each extra tree ~60 bytes,
  // so this can be a forest rather than the eight-tree token gesture it was.
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1;
    const z = between(-5.4, 5.4);
    const dist = between(2.1, 6.2);
    const x = side * dist + bend(z);
    const tall = rnd() > 0.5;
    // Further back reads cooler and darker, which fakes depth on a flat backdrop.
    const fade = 1 - Math.min(0.3, (dist - 2.1) * 0.055);
    b.add(tall ? F.treeHigh : F.pineRound, x, 0, z,
      between(0.9, 1.5), rnd() * 6.28, [fade * between(0.9, 1.1), fade, fade * 0.97]);
  }
  for (let i = 0; i < 14; i++) {
    b.add(rnd() > 0.4 ? F.grass : F.plant, (rnd() > 0.5 ? 1 : -1) * between(1.5, 4.6), 0,
      between(-5, 5), between(0.7, 1.2), rnd() * 6.28, between(0.9, 1.15));
  }
  for (let i = 0; i < 8; i++) {
    b.add(rnd() > 0.5 ? F.stones : F.rocksLow, (rnd() > 0.5 ? 1 : -1) * between(1.6, 4.2), 0,
      between(-5, 5), between(0.5, 0.95), rnd() * 6.28, between(0.95, 1.2));
  }
  return b.centre();
}

// ----------------------------------------------------------- award (#background)
// The trophy on a cairn. This one is literal: the section beside it lists the
// 2025 Productivity Olympics national win, so the 3D is the credential, not
// decoration.
function buildAward() {
  const b = new Scene();
  // Cairn — stacked rock, largest at the base.
  b.add(F.rocksHigh, 0, 0, 0, 1.30, 0.3, 0.98);
  b.add(F.rocksLow, 0.06, 0.92, -0.04, 0.95, 2.1, 1.06);
  b.add(F.stones, -0.02, 1.32, 0.03, 0.80, 4.0, 1.12);
  // The trophy sits on top, turned slightly off-axis so it reads as placed.
  b.add(F.trophy, 0, 1.62, 0, 1.55, 0.42, 1.18);
  // A low ring of stones and planting, so the cairn belongs somewhere. Same
  // vertex discipline as the trail — a handful reads as "a place", a dozen just
  // costs bandwidth.
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rnd() * 0.4, r = between(1.5, 3.0);
    b.add(rnd() > 0.5 ? F.stones : F.rocksLow, Math.cos(a) * r, 0, Math.sin(a) * r,
      between(0.3, 0.62), rnd() * 6.28, between(0.92, 1.15));
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.5, r = between(1.2, 3.4);
    b.add(rnd() > 0.45 ? F.grass : F.plant, Math.cos(a) * r, 0, Math.sin(a) * r,
      between(0.65, 1.15), rnd() * 6.28, between(0.88, 1.12));
  }
  // Pines set well back, framing the cairn without crowding it. Same depth
  // trick as the trail: the further ones sit darker.
  [[-3.4,-2.9,1.2,0.80],[3.6,-2.4,1.0,0.84],[-2.2,-4.1,0.95,0.72],[2.4,-4.4,1.15,0.70],[0.4,-4.9,0.9,0.66]]
    .forEach(([x,z,sc,f],i)=> b.add(i%2 ? F.treeHigh : F.pineRound, x, 0, z, sc, rnd()*6.28, [f*1.03,f,f*0.98]));
  return b.centre();
}


[['trail', buildTrail, 'models/trail-scene.glb'],
 ['award', buildAward, 'models/award-scene.glb']].forEach(([name, fn, out]) => {
  const r = fn().write(path.join(REPO, out), {
    name: name,
    title: 'Composed from Kenney CC0 kits (Mini Forest, Fantasy Town, Starter Kit)',
    license: 'CC0-1.0', source: 'https://kenney.nl'
  });
  console.log(name.padEnd(6), r.props + ' props stored (' + r.storedVerts + ' verts), ' +
    r.instances + ' instances, ' + r.drawnTris + ' tris drawn,  size ' + r.size +
    ',  ' + (r.bytes / 1024).toFixed(0) + 'KB  -> ' + out);
});
