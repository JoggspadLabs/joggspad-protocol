import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATES = ['stated', 'absent', 'unconfirmed'];
/* base58 alphabet (no 0, O, I, l), 32 to 44 characters */
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/* a gate for malformed input only: any well-formed base58 string of the right length passes */
export const isAddress = (s) => typeof s === 'string' && ADDRESS.test(s);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* link rule: the URL is stored, the handle is derived from it */
export function deriveHandle(url, hosts) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !hosts.includes(u.hostname.replace(/^www\./, ''))) throw new Error('unexpected host in ' + url);
  const seg = u.pathname.split('/').filter(Boolean)[0];
  if (!seg) throw new Error('no handle in ' + url);
  return seg;
}

export function validateRegister(reg) {
  for (const k of ['chain', 'rpc', 'contract', 'x', 'github']) {
    if (!reg[k] || !STATES.includes(reg[k].state)) throw new Error('register: bad state for ' + k);
  }
  const { chain, rpc, contract, x, github } = reg;
  if (chain.state === 'stated') {
    if (!chain.name || !chain.llamaSlug || !chain.dexTag || !isAddress(chain.genesisHash)) throw new Error('register: chain record is incomplete');
    if ('id' in chain || 'idHex' in chain) throw new Error('register: Solana has no EVM chain id');
  }
  if (rpc.state === 'stated') {
    if (new URL(rpc.url).protocol !== 'https:') throw new Error('register: rpc must be https');
  }
  if (contract.state === 'stated' && !isAddress(contract.address)) throw new Error('register: contract address is malformed');
  if (x.state === 'stated') deriveHandle(x.url, ['x.com', 'twitter.com']);
  if (github.state === 'stated') deriveHandle(github.url, ['github.com']);
  return reg;
}

const X_PATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const GH_PATH = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';

function social(rec, name, hosts, viewBox, path) {
  const svg = `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false"><path fill="currentColor" d="${path}"/></svg>`;
  if (rec.state === 'stated') {
    const handle = deriveHandle(rec.url, hosts);
    return `<a class="soc" data-social="${name}" href="${esc(rec.url)}" target="_blank" rel="noopener noreferrer" aria-label="${name} @${esc(handle)}">${svg}</a>`;
  }
  return `<span class="soc" data-social="${name}" data-inert role="link" aria-disabled="true" aria-label="${name}, not linked yet">${svg}</span>`;
}

export function renderSocials(reg) {
  return social(reg.x, 'X', ['x.com', 'twitter.com'], '0 0 24 24', X_PATH) + social(reg.github, 'GitHub', ['github.com'], '0 0 16 16', GH_PATH);
}

export function renderCA(reg) {
  const c = reg.contract;
  if (c.state === 'stated') {
    return `<button class="ca" type="button" data-state="stated" data-copy="${esc(c.address)}" aria-label="Copy contract address ${esc(c.address)}"><span class="ca-label">Contract</span><code class="ca-value">${esc(c.address)}</code><span class="ca-act"><span data-copy-label>Copy</span></span><span class="ca-toast" role="status" aria-live="polite"></span></button>`;
  }
  return `<div class="ca" data-state="absent" aria-disabled="true"><span class="ca-label">Contract</span><span class="ca-value">Address not published yet</span></div>`;
}

export function renderInfoTiles(reg) {
  const { chain, rpc, contract } = reg;
  const host = new URL(rpc.url).host;
  const copyBtn = (v, label) => `<button class="copy-btn" type="button" data-copy="${esc(v)}" aria-label="${label}"><span data-copy-label>Copy</span></button>`;
  const chainTile = `<article class="tile" data-reveal data-spot><span class="label">Chain</span><span class="tile-val">${esc(chain.name)}</span><span class="tile-sub mono">${esc(chain.cluster)}</span></article>`;
  const contractTile = contract.state === 'stated'
    ? `<article class="tile" data-state="stated" data-reveal data-spot><span class="label">Contract</span><span class="tile-val mono tile-addr">${esc(contract.address)}</span>${copyBtn(contract.address, 'Copy contract address')}</article>`
    : `<article class="tile" data-state="absent" data-reveal data-spot><span class="label">Contract</span><span class="tile-val">Not published yet</span><span class="tile-sub">The strip above fills in as soon as an address is stated.</span></article>`;
  const rpcTile = `<article class="tile" data-reveal data-spot><span class="label">RPC</span><span class="tile-val mono tile-host">${esc(host)}</span>${copyBtn(rpc.url, 'Copy RPC endpoint')}</article>`;
  return [chainTile, contractTile, rpcTile].join('\n      ');
}

function footContract(reg) {
  return reg.contract.state === 'stated'
    ? '<a href="#top">Contract</a>'
    : '<span class="inert" aria-disabled="true">Contract (pending)</span>';
}

function skeletons(n) {
  const row = '<li><div class="row"><span class="skel skel-line"></span><span class="pair"><span class="logo skel"></span><span class="pair-name"><span class="skel skel-line"></span></span></span><span class="skel skel-line"></span><span class="skel skel-line"></span><span class="skel skel-line hide-s"></span></div></li>';
  return Array.from({ length: n }, () => row).join('\n        ');
}

export function buildCsp(reg, { forMeta = false } = {}) {
  const rpcOrigin = new URL(reg.rpc.url).origin;
  const parts = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data: https://*.dexscreener.com",
    `connect-src ${rpcOrigin} https://api.llama.fi https://api.dexscreener.com`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ];
  if (!forMeta) parts.push("frame-ancestors 'none'");
  return parts.join('; ');
}

const tokenValue = (css, name) => {
  const m = css.match(new RegExp('--' + name + ':\\s*([^;]+);'));
  if (!m) throw new Error('token missing: ' + name);
  return m[1].trim();
};

const FILES = ['tokens.css', 'styles.css', 'boot.js', 'app.js', 'fx.js', 'ui.js', 'field.js', 'live.js', 'format.js', 'backoff.js'];

export function build({ srcDir = join(ROOT, 'src'), outDir = join(ROOT, 'dist'), register } = {}) {
  const reg = validateRegister(register || JSON.parse(readFileSync(join(srcDir, 'register.json'), 'utf8')));
  const out = resolve(outDir);
  if (!out.startsWith(ROOT)) throw new Error('refusing to write outside the project: ' + out);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const tokens = readFileSync(join(srcDir, 'tokens.css'), 'utf8');
  const brand = JSON.parse(readFileSync(join(srcDir, 'brand.json'), 'utf8'));
  const map = {
    THEME_COLOR: tokenValue(tokens, 'bg'),
    CSP: buildCsp(reg, { forMeta: true }),
    RPC_URL: reg.rpc.url,
    GENESIS: reg.chain.genesisHash,
    LLAMA_SLUG: reg.chain.llamaSlug,
    DEX_TAG: reg.chain.dexTag,
    CHAIN_NAME: reg.chain.name,
    GLYPH_VB: brand.glyph.viewBox,
    GLYPH_D: brand.glyph.d,
    CA_BLOCK: renderCA(reg),
    SOCIALS: renderSocials(reg),
    INFO_TILES: renderInfoTiles(reg),
    FOOT_CONTRACT: footContract(reg),
    PAIR_SKELETONS: skeletons(8),
  };
  let html = readFileSync(join(srcDir, 'index.template.html'), 'utf8');
  html = html.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => {
    if (!(k in map)) throw new Error('unknown placeholder ' + k);
    return /^(CSP|THEME_COLOR|RPC_URL|GENESIS|LLAMA_SLUG|DEX_TAG|CHAIN_NAME|GLYPH_VB|GLYPH_D)$/.test(k) ? esc(map[k]) : map[k];
  });
  writeFileSync(join(out, 'index.html'), html);

  for (const f of FILES) copyFileSync(join(srcDir, f), join(out, f));

  const fav = readFileSync(join(srcDir, 'favicon.svg.tpl'), 'utf8')
    .replace('{{BG}}', tokenValue(tokens, 'lime'))
    .replace('{{INK}}', tokenValue(tokens, 'ink'))
    .replace('{{D}}', brand.favicon.d);
  writeFileSync(join(out, 'favicon.svg'), fav);

  writeFileSync(join(out, '_headers'), [
    '/*',
    '  Content-Security-Policy: ' + buildCsp(reg),
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: DENY',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
    '',
    '/*.js',
    '  Cache-Control: public, max-age=3600',
    '',
  ].join('\n'));
  writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  return { out, reg };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { out } = build();
  console.log('built ->', out);
}
