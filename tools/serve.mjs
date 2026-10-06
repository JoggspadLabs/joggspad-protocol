import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(ROOT, process.argv[2] || 'dist');
const port = Number(process.argv[3] || process.env.PORT || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = resolve(join(dir, p === '/' ? 'index.html' : p));
  if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const headers = { 'content-type': TYPES[extname(file)] || 'application/octet-stream' };
  const h = existsSync(join(dir, '_headers')) ? readFileSync(join(dir, '_headers'), 'utf8') : '';
  const csp = (h.match(/Content-Security-Policy:\s*(.+)/) || [])[1];
  if (csp) headers['content-security-policy'] = csp;
  res.writeHead(200, headers);
  res.end(readFileSync(file));
}).listen(port, () => console.log('serving', dir, 'on http://localhost:' + port));
