import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decodePng(file) {
  const b = readFileSync(file);
  let p = 8, ihdr, idat = [], plte = null, trns = null;
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') ihdr = { w: d.readUInt32BE(0), h: d.readUInt32BE(4), depth: d[8], ct: d[9], interlace: d[12] };
    if (type === 'IDAT') idat.push(d);
    if (type === 'PLTE') plte = d;
    if (type === 'tRNS') trns = d;
    p += 12 + len;
  }
  const { w, h, depth, ct } = ihdr;
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const bpp = Math.max(1, (ch * depth) >> 3);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = (w * ch * depth + 7) >> 3;
  const out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[y * stride + x] = v & 255;
    }
  }
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, bl, al = 255;
    if (ct === 6) { r = out[i * 4]; g = out[i * 4 + 1]; bl = out[i * 4 + 2]; al = out[i * 4 + 3]; }
    else if (ct === 2) { r = out[i * 3]; g = out[i * 3 + 1]; bl = out[i * 3 + 2]; }
    else if (ct === 0) { r = g = bl = out[i]; }
    else if (ct === 4) { r = g = bl = out[i * 2]; al = out[i * 2 + 1]; }
    else { const idx = out[i]; r = plte[idx * 3]; g = plte[idx * 3 + 1]; bl = plte[idx * 3 + 2]; al = trns && idx < trns.length ? trns[idx] : 255; }
    rgba.set([r, g, bl, al], i * 4);
  }
  return { ihdr, rgba, hasTrns: !!trns };
}
