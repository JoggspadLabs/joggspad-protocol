/* Reads brand/ and writes src/brand.json: palette with provenance, plus traced logo paths.
   Palette provenance: k-means (k=4..6) over each asset, each centroid snapped to the nearest real
   pixel; the coordinate of that pixel is recorded so it can be re-checked. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './lib/png.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

/* snapped colors; `png` ones are re-verified against the file on every run */
export const PALETTE = [
  { name: 'lime', hex: '#e8ff55', src: 'brand/LOGO JOGGSPAD PNG.png', x: 0, y: 0, png: true, role: 'brand fill, 88.7% of the mark tile' },
  { name: 'ink', hex: '#0a0a0b', src: 'brand/LOGO JOGGSPAD PNG.png', x: 1205, y: 489, png: true, role: 'logo glyph, 11.1% of the mark tile' },
  { name: 'lime-hi', hex: '#f5f85d', src: 'reference/SAMPUL JOGGSPAD JPG.jpg.jpeg', x: 1212, y: 225, role: 'highlight in the cover headline' },
  { name: 'bg', hex: '#0c0c0c', src: 'reference/SAMPUL JOGGSPAD JPG.jpg.jpeg', x: 44, y: 0, role: 'cover field, 53.7%' },
  { name: 'deep', hex: '#181d0d', src: 'reference/SAMPUL JOGGSPAD JPG.jpg.jpeg', x: 1166, y: 0, role: 'cover glow falloff, 19.3%' },
  { name: 'olive', hex: '#2a3111', src: 'reference/SAMPUL JOGGSPAD JPG.jpg.jpeg', x: 1249, y: 114, role: 'cover glow, 11.1%' },
  { name: 'olive-2', hex: '#586813', src: 'reference/JOGGSPAD 5.jpg.jpeg', x: 35, y: 741, role: 'scene glow mid' },
  { name: 'olive-3', hex: '#98ae1c', src: 'reference/JOGGSPAD 4.jpg.jpeg', x: 1129, y: 619, role: 'scene glow bright' },
  { name: 'void', hex: '#020701', src: 'reference/JOGGSPAD 1.jpg.jpeg', x: 585, y: 48, role: 'scene shadow, 44.6%' },
  { name: 'white', hex: '#fdfdfd', src: 'reference/SAMPUL JOGGSPAD JPG.jpg.jpeg', x: 414, y: 133, role: 'cover headline white' },
  { name: 'grey', hex: '#c1c1c1', src: 'reference/SAMPUL JOGGSPAD JPG.jpg.jpeg', x: 1340, y: 444, role: 'cover url text' },
];

/* ---- trace the alpha mask. Coverage is the mean alpha of a block, which is a premultiplied
   average: the pure-black RGB under fully transparent pixels never enters the result. ---- */
function trace(a, W, H, bbox, cell, thr = 0.5) {
  const nx = Math.ceil(bbox.w / cell) + 1, ny = Math.ceil(bbox.h / cell) + 1;
  const val = new Float32Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    let s = 0, n = 0;
    const cx = bbox.x + i * cell - cell / 2, cy = bbox.y + j * cell - cell / 2;
    for (let y = Math.max(0, Math.floor(cy)); y < Math.min(H, Math.floor(cy + cell)); y++) for (let x = Math.max(0, Math.floor(cx)); x < Math.min(W, Math.floor(cx + cell)); x++) { s += a[(y * W + x) * 4 + 3]; n++; }
    val[j * (nx + 1) + i] = n ? s / n / 255 : 0;
  }
  const V = (i, j) => val[j * (nx + 1) + i];
  const pt = new Map(); const adj = new Map();
  const edge = (kind, i, j) => {
    const id = kind + i + ',' + j;
    if (!pt.has(id)) {
      const [i2, j2] = kind === 'h' ? [i + 1, j] : [i, j + 1];
      const v1 = V(i, j), v2 = V(i2, j2), t = (thr - v1) / (v2 - v1 || 1e-9);
      pt.set(id, [i + (i2 - i) * t, j + (j2 - j) * t]);
    }
    return id;
  };
  const link = (p, q) => { (adj.get(p) || adj.set(p, []).get(p)).push(q); (adj.get(q) || adj.set(q, []).get(q)).push(p); };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = (V(i, j) >= thr ? 8 : 0) + (V(i + 1, j) >= thr ? 4 : 0) + (V(i + 1, j + 1) >= thr ? 2 : 0) + (V(i, j + 1) >= thr ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const T = () => edge('h', i, j), B = () => edge('h', i, j + 1), L = () => edge('v', i, j), R = () => edge('v', i + 1, j);
    const segs = { 1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[T, R]], 5: [[T, L], [B, R]], 6: [[T, B]], 7: [[L, T]], 8: [[L, T]], 9: [[T, B]], 10: [[T, R], [L, B]], 11: [[T, R]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]] }[idx];
    for (const [p, q] of segs) link(p(), q());
  }
  const seen = new Set(); const loops = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let prev = null, cur = start;
    while (cur && !seen.has(cur)) { seen.add(cur); loop.push(pt.get(cur)); const nb = adj.get(cur).filter((n) => n !== prev && !seen.has(n)); prev = cur; cur = nb[0]; }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]]; let dmax = 0, im = 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len; if (d > dmax) { dmax = d; im = i; } }
  if (dmax <= eps) return [a, b];
  return [...rdp(pts.slice(0, im + 1), eps).slice(0, -1), ...rdp(pts.slice(im), eps)];
}
function simplifyClosed(loop, eps) {
  let far = 0, dm = 0; for (let i = 1; i < loop.length; i++) { const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > dm) { dm = d; far = i; } }
  const a = rdp(loop.slice(0, far + 1), eps), b = rdp([...loop.slice(far), loop[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
const toPath = (loops, f, dec) => loops.map((l) => 'M' + l.map((p) => f(p).map((v) => +v.toFixed(dec)).join(' ')).join('L') + 'Z').join('');

export function extract() {
  const file = join(ROOT, 'brand', 'LOGO JOGGSPAD PNG...png');
  const { ihdr, rgba } = decodePng(file);
  const { w: W, h: H } = ihdr;
  let minx = W, miny = H, maxx = 0, maxy = 0, blackTransparent = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (rgba[i + 3] === 0 && !rgba[i] && !rgba[i + 1] && !rgba[i + 2]) blackTransparent++;
    if (rgba[i + 3] > 127) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  }
  const bbox = { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 };

  /* verify the png-sourced palette entries against the real pixels */
  for (const c of PALETTE.filter((p) => p.png)) {
    const f = decodePng(join(ROOT, c.src));
    const i = (c.y * f.ihdr.w + c.x) * 4;
    if (hex(f.rgba[i], f.rgba[i + 1], f.rgba[i + 2]) !== c.hex) throw new Error('palette entry no longer matches its pixel: ' + c.name);
  }

  /* one lattice vertex per source pixel: the ball and the hook come within a few pixels of each
     other, and a coarser grid would fuse them into one contour */
  const raw = trace(rgba, W, H, bbox, 1);
  const unit = 4; // glyph units are source pixels / 4
  const loops = raw.map((l) => simplifyClosed(l, 0.8));
  const glyph = { viewBox: `0 0 ${+(bbox.w / unit).toFixed(2)} ${+(bbox.h / unit).toFixed(2)}`, d: toPath(loops, (p) => [p[0] / unit, p[1] / unit], 1) };

  /* favicon: 32x32 grid, glyph scaled to 21 tall, centered */
  const fl = raw.map((l) => simplifyClosed(l, 5));
  const s = 21 / bbox.h, ox = (32 - bbox.w * s) / 2, oy = (32 - 21) / 2;
  const favicon = { d: toPath(fl, (p) => [p[0] * s + ox, p[1] * s + oy], 2) };

  return {
    source: { file: 'brand/LOGO JOGGSPAD PNG...png', ihdr, bbox, pureBlackTransparentPixels: blackTransparent, premultiplied: blackTransparent > 0 },
    palette: PALETTE.map(({ name, hex: h, src, x, y, role }) => ({ name, hex: h, src, x, y, role })),
    glyph, favicon,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = extract();
  writeFileSync(join(ROOT, 'src', 'brand.json'), JSON.stringify(out, null, 1));
  console.log('brand.json:', 'glyph', out.glyph.d.length, 'chars,', 'favicon', out.favicon.d.length, 'chars, bbox', JSON.stringify(out.source.bbox), 'blackTransparent', out.source.pureBlackTransparentPixels);
}
