// Prep step for bake-forest-scene.js.
//
// forest_scene.glb carries its colour in JPEG atlases, and the bakers here have
// a PNG decoder but no JPEG one. Rather than commit ~8MB of converted PNGs that
// are derivable from a file already in the repo, regenerate them on demand:
// pull each embedded image straight out of the GLB, then let Windows'
// System.Drawing re-encode the JPEGs as PNG.
//
// Output lands in forest-scene-tex/ (gitignored). Run this once before
// bake-forest-scene.js, or any time the source GLB changes.
// Run: node tools/bake-props/prep-forest-scene-tex.js
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const SRC = path.join(__dirname, 'forest_scene.glb');
const OUT = path.join(__dirname, 'forest-scene-tex');
fs.mkdirSync(OUT, { recursive: true });

const b = fs.readFileSync(SRC);
const jlen = b.readUInt32LE(12);
const j = JSON.parse(b.toString('utf8', 20, 20 + jlen));
const off = 20 + jlen, bin = b.slice(off + 8, off + 8 + b.readUInt32LE(off));

let jpegs = 0;
(j.images || []).forEach((im, i) => {
  const v = j.bufferViews[im.bufferView];
  const data = bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  const ext = im.mimeType === 'image/png' ? 'png' : 'jpg';
  fs.writeFileSync(path.join(OUT, 'img' + i + '.' + ext), data);
  if (ext === 'jpg') jpegs++;
  console.log('  extracted img' + i + '.' + ext, (data.length / 1024).toFixed(0) + 'KB');
});

if (jpegs) {
  // Re-encode to 24bpp PNG — no alpha, no interlacing, which is exactly the
  // subset decodePNG() in bake-forest-scene.js handles.
  const ps = [
    'Add-Type -AssemblyName System.Drawing;',
    '$d = "' + OUT.replace(/\\/g, '\\\\') + '";',
    'Get-ChildItem "$d\\*.jpg" | ForEach-Object {',
    '  $img = [System.Drawing.Image]::FromFile($_.FullName);',
    '  $bmp = New-Object System.Drawing.Bitmap $img.Width, $img.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb);',
    '  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.DrawImage($img, 0, 0, $img.Width, $img.Height); $g.Dispose();',
    '  $bmp.Save(($_.FullName -replace "\\.jpg$", ".png"), [System.Drawing.Imaging.ImageFormat]::Png);',
    '  $bmp.Dispose(); $img.Dispose();',
    '}'
  ].join(' ');
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' });
  fs.readdirSync(OUT).filter(f => f.endsWith('.jpg')).forEach(f => fs.unlinkSync(path.join(OUT, f)));
  console.log('  converted ' + jpegs + ' JPEG atlas(es) to PNG');
}
console.log('ready: tools/bake-props/forest-scene-tex/ — now run bake-forest-scene.js');
