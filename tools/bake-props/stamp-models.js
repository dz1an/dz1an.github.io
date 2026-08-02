// Rewrite every models/*.glb cache-buster in the HTML to a hash of that file's
// actual bytes. Run it after ANY rebake.
//
// Why this exists: sw.js is network-first only for documents, scripts and
// stylesheets. A .glb request has an empty `destination`, so it falls through to
// the cache-first branch — correct for an immutable asset, but it means a URL
// that stays the same while the file underneath changes is served from cache
// forever. That has now shipped a stale model twice: the hero appeared to render
// white, and the camp appeared tiny and off-centre because the browser was
// holding an earlier bake with a different bounding box.
//
// A hand-maintained ?v=2 only works if it is remembered. A content hash cannot
// be forgotten: rebake, run this, and the URL changes if and only if the bytes
// did.
//
// Run: node tools/bake-props/stamp-models.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const REPO = path.join(__dirname, '../..');
const PAGES = ['main.html', 'index.html', 'services.html'];
let changed = 0, checked = 0;

PAGES.forEach(page => {
  const file = path.join(REPO, page);
  if (!fs.existsSync(file)) return;
  // Node reads/writes UTF-8 faithfully. Do NOT round-trip these files through
  // PowerShell — it double-encodes every em-dash (see CLAUDE.md).
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(/(models\/[A-Za-z0-9_-]+\.glb)(\?v=[A-Za-z0-9]+)?/g, (m, rel) => {
    const target = path.join(REPO, rel);
    if (!fs.existsSync(target)) { console.log('  ! ' + page + ': ' + rel + ' does not exist'); return m; }
    checked++;
    const hash = crypto.createHash('sha1').update(fs.readFileSync(target)).digest('hex').slice(0, 8);
    return rel + '?v=' + hash;
  });
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
    console.log('  stamped ' + page);
  }
});

// Report the final mapping so a rebake that changed nothing is obvious.
const seen = {};
PAGES.forEach(page => {
  const file = path.join(REPO, page);
  if (!fs.existsSync(file)) return;
  const re = /models\/([A-Za-z0-9_-]+\.glb)\?v=([A-Za-z0-9]+)/g;
  let m;
  while ((m = re.exec(fs.readFileSync(file, 'utf8')))) seen[m[1]] = m[2];
});
Object.keys(seen).sort().forEach(k => console.log('  ' + k.padEnd(24) + ' v=' + seen[k]));
console.log(checked + ' reference(s) checked, ' + changed + ' file(s) rewritten');
