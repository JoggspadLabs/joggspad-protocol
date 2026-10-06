import { readFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build, isAddress, deriveHandle, validateRegister, buildCsp } from './build.mjs';
import { nextDelay } from '../src/backoff.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, '.gate-tmp');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const live = JSON.parse(read('src/register.json'));

/* ---------- synthetic fixtures: derived from the live register, never from its values ---------- */
const FIX_ADDR = '7Kf3mQp9XvTn2LdRz8WbYc4HsJ6uGaE5NtPyBhVxCrDq';
const fixAbsent = structuredClone(live);
fixAbsent.contract = { state: 'absent', address: null };
fixAbsent.x = { state: 'absent', url: null };
fixAbsent.github = { state: 'absent', url: null };
const fixStated = structuredClone(live);
fixStated.contract = { state: 'stated', address: FIX_ADDR };
fixStated.x = { state: 'stated', url: 'https://x.com/fixture_handle' };
fixStated.github = { state: 'stated', url: 'https://github.com/fixture-org' };

const files = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (['node_modules', '.gate-tmp'].includes(n)) continue;
    statSync(p).isDirectory() ? files(p, out) : out.push(p);
  }
  return out;
};

const visibleText = (html) => html
  .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ')
  .replace(/<head[\s\S]*?<\/head>/, (h) => (h.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1] + ' ' + ((h.match(/name="description" content="([^"]*)"/) || [, ''])[1]))
  .replace(/<[^>]+>/g, '\n')
  .replace(/&middot;|&mdash;|&ndash;|&copy;|&amp;/g, ' ')
  .replace(/&[a-z]+;/g, ' ');

const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10);
const refBigrams = new Set(JSON.parse(read('tools/fixtures/ref-bigrams.json')));
export function sharedBigrams(text) {
  const hits = [];
  for (const chunk of text.toLowerCase().split(/[\n.?!;:,—→]+/)) {
    const w = chunk.match(/[a-z0-9$']+/g) || [];
    for (let i = 0; i < w.length - 1; i++) if (refBigrams.has(sha(w[i] + ' ' + w[i + 1]))) hits.push(w[i] + ' ' + w[i + 1]);
  }
  return hits;
}

/* ---------- context ---------- */
const b1 = build({ outDir: join(TMP, 'absent'), register: fixAbsent });
const b2 = build({ outDir: join(TMP, 'stated'), register: fixStated });
const ctx = {
  absent: { html: readFileSync(join(b1.out, 'index.html'), 'utf8') },
  stated: { html: readFileSync(join(b2.out, 'index.html'), 'utf8') },
  css: read('src/styles.css'),
  tokens: read('src/tokens.css'),
  brand: JSON.parse(read('src/brand.json')),
  liveJs: read('src/live.js'),
  fxJs: read('src/fx.js'),
  fieldJs: read('src/field.js'),
  headers: readFileSync(join(b1.out, '_headers'), 'utf8'),
  favicon: readFileSync(join(b1.out, 'favicon.svg'), 'utf8'),
  validator: isAddress,
  csp: buildCsp(live),
};

const socialTags = (html) => [...html.matchAll(/<(a|span)\b[^>]*data-social="([^"]+)"[^>]*>/g)].map((m) => ({ tag: m[0], name: m[2] }));
const caTag = (html) => (html.match(/<(button|div)\b[^>]*class="ca"[^>]*>/) || [])[0] || '';
const tilesBlock = (html) => (html.match(/<section class="panel light" id="chain">([\s\S]*?)<\/section>/) || [, ''])[1];
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|color)\(|\b(?:oklch)\(/;
const NAMED = /:\s*[^;{}]*\b(?:white|black|red|green|blue|gray|grey|silver|yellow|orange|purple|pink|cyan|magenta)\b/i;

/* ---------- checks: pure functions of context, so the mutation harness can feed them altered input ---------- */
const checks = {
  absentCaInert: (c) => {
    const tag = caTag(c.absent.html);
    return /^<div/.test(tag) && /aria-disabled="true"/.test(tag) && !/data-copy/.test(c.absent.html.split('<main')[0]) && !/<button class="ca"/.test(c.absent.html);
  },
  statedCaLive: (c) => {
    const tag = caTag(c.stated.html);
    const head = c.stated.html.split('<main')[0];
    return /^<button/.test(tag) && tag.includes(`data-copy="${FIX_ADDR}"`) && head.includes(`<code class="ca-value">${FIX_ADDR}</code>`) && /data-copy-label/.test(head) && /role="status"/.test(head);
  },
  absentSocialsInert: (c) => {
    const s = socialTags(c.absent.html);
    return s.length === 2 && s.every((t) => t.tag.startsWith('<span') && !/href=/.test(t.tag) && /aria-disabled="true"/.test(t.tag));
  },
  noHrefForUnstated: (c) => !/href="https?:\/\/(?:www\.)?(?:x\.com|twitter\.com|github\.com)/.test(c.absent.html),
  statedSocialsLive: (c) => {
    const s = socialTags(c.stated.html);
    const x = s.find((t) => t.name === 'X'), g = s.find((t) => t.name === 'GitHub');
    return !!x && !!g && x.tag.includes(`href="${fixStated.x.url}"`) && x.tag.includes(`@${deriveHandle(fixStated.x.url, ['x.com'])}"`) && g.tag.includes(`href="${fixStated.github.url}"`) && g.tag.includes(`@${deriveHandle(fixStated.github.url, ['github.com'])}"`);
  },
  socialsTopRightAllWidths: (c) => {
    const both = [c.absent.html, c.stated.html].every((h) => /<div class="head-right">[\s\S]*<div class="socials">[\s\S]*data-social="X"[\s\S]*data-social="GitHub"[\s\S]*<\/header>/.test(h));
    const hidden = /(\.soc\b|\.socials\b)[^{]*\{[^}]*display:\s*none/.test(c.css);
    return both && !hidden;
  },
  socialsIconOnly: (c) => socialTags(c.stated.html).length === 2 && !/<a class="soc"[^>]*>[^<]*[A-Za-z]{2}[^<]*<svg/.test(c.stated.html) && !/<\/svg>\s*[A-Za-z]/.test((c.stated.html.match(/<div class="socials">[\s\S]*?<\/div>/) || [''])[0]),
  infoTilesOnlyThree: (c) => {
    const labels = [...tilesBlock(c.absent.html).matchAll(/<span class="label">([^<]+)<\/span>/g)].map((m) => m[1]);
    return labels.join('|') === 'Chain|Contract|RPC' && !/github|x\.com/i.test(tilesBlock(c.absent.html));
  },
  paletteTokens: (c) => {
    const lits = [...c.tokens.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    const known = new Set(c.brand.palette.map((p) => p.hex.toLowerCase()));
    const rest = c.tokens.replace(/#[0-9a-fA-F]{3,8}\b/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    return lits.length === known.size && lits.every((h) => known.has(h)) && !/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/.test(rest) && c.brand.palette.every((p) => p.src && Number.isInteger(p.x) && Number.isInteger(p.y)) && /k-means/.test(c.tokens) && /snapped/.test(c.tokens);
  },
  paletteNoLiterals: (c) => !COLOR_LITERAL.test(c.css) && !NAMED.test(c.css) && !COLOR_LITERAL.test(c.liveJs + c.fxJs + c.fieldJs) && !COLOR_LITERAL.test(c.absent.html.replace(/<meta name="theme-color"[^>]*>/, '')),
  faviconValid: (c) => /viewBox="0 0 32 32"/.test(c.favicon) && /width="32"/.test(c.favicon) && !/<!--/.test(c.favicon) && !/--/.test(c.favicon) && [...c.favicon.matchAll(/fill="(#[0-9a-f]{6})"/g)].every((m) => c.brand.palette.some((p) => p.hex === m[1])) && (c.favicon.match(/fill="#/g) || []).length === 2 && c.favicon.includes(c.brand.favicon.d),
  noVisibleDates: (c) => {
    const t = visibleText(c.absent.html);
    return !/\b(19|20)\d{2}\b/.test(t) && !/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?[ \t]+\d{1,2}\b/i.test(t) && !/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(t) && !/<time\b/.test(c.absent.html);
  },
  noChUnits: (c) => !/\d(?:\.\d+)?ch\b/.test(c.css),
  cspCoversLive: (c) => {
    const meta = (c.absent.html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [, ''])[1].replace(/&#39;/g, "'");
    const origins = [...c.liveJs.matchAll(/https:\/\/[a-z0-9.-]+/g)].map((m) => m[0]);
    const rpcOrigin = new URL(live.rpc.url).origin;
    const all = [...origins, rpcOrigin];
    const conn = (s) => (s.match(/connect-src ([^;]*)/) || [, ''])[1];
    return [c.csp, meta, (c.headers.match(/Content-Security-Policy: (.*)/) || [, ''])[1]].every((s) => s && !/unsafe-(inline|eval)/.test(s) && /default-src 'none'/.test(s) && all.filter((o) => !/fonts|dexscreener\.com$/.test(o) || /api\.dexscreener/.test(o)).every((o) => conn(s).includes(o)) && /script-src 'self'/.test(s));
  },
  noInlineCode: (c) => [c.absent.html, c.stated.html].every((h) => !/\sstyle="/.test(h) && !/\son[a-z]+="/.test(h) && !/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/.test(h)),
  reducedMotion: (c) => /@media \(prefers-reduced-motion: reduce\)/.test(c.css) && /prefers-reduced-motion/.test(c.fxJs) && /reduced\.matches/.test(c.fieldJs),
  liveFeaturesWired: (c) => ['getSlot', 'getGenesisHash', "'Live'", "'Connecting'", "'Offline'", 'api.llama.fi/v2/chains', 'LLAMA_SLUG', 'api.dexscreener.com', "meta('jp:dex-tag')", 'visibilitychange', 'nextDelay', 'DASH'].every((k) => c.liveJs.includes(k)) && /skel/.test(c.absent.html) && /class="dot"/.test(c.absent.html),
  backoffMath: () => {
    const lo = () => 0, hi = () => 1;
    let prevCap = 0;
    for (let f = 1; f <= 12; f++) {
      const a = nextDelay(2000, 30000, f, lo), z = nextDelay(2000, 30000, f, hi);
      const cap = Math.min(30000, 2000 * 2 ** f);
      if (a !== cap / 2 || z !== cap || z < prevCap || z > 30000) return false;
      prevCap = z;
    }
    return nextDelay(2000, 30000, 0, lo) === 1800 && nextDelay(2000, 30000, 0, hi) === 2200 && nextDelay(2000, 30000, 6, lo) !== nextDelay(2000, 30000, 6, hi);
  },
  addressGateNeverBlanket: (c) => {
    const v = c.validator;
    const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const accepts = [FIX_ADDR, b58.slice(0, 32), b58.slice(10, 54), '1'.repeat(32), 'z'.repeat(44), 'A' + b58.slice(1, 40)];
    const rejects = [b58.slice(0, 31), b58 + 'z', '0'.repeat(40), 'O'.repeat(40), 'I'.repeat(40), 'l'.repeat(40), FIX_ADDR + ' ', '', null, 42];
    return accepts.every((a) => v(a)) && rejects.every((r) => !v(r));
  },
  copyDistinctFromReference: (c) => sharedBigrams(visibleText(c.absent.html)).length === 0,
};

/* ---------- gate list (max 30) ---------- */
const gates = [];
const gate = (name, fn) => gates.push({ name, fn });

gate('register: every record has a valid state and validates', () => { validateRegister(live); return true; });
gate('register: stated records carry values, absent records carry none', () => {
  const v = (r) => (r.state === 'stated' ? Boolean(r.url || r.address || r.id) : !(r.url || r.address));
  return ['contract', 'x', 'github', 'rpc'].every((k) => v(live[k]));
});
gate('register: Solana mainnet, no EVM id, stated https rpc, slug and tag set', () => live.chain.name === 'Solana' && live.chain.cluster === 'mainnet-beta' && !('id' in live.chain) && !('idHex' in live.chain) && live.chain.llamaSlug === 'solana' && live.chain.dexTag === 'solana' && isAddress(live.chain.genesisHash) && live.rpc.url === 'https://solana-rpc.publicnode.com' && /^\d{4}-\d{2}-\d{2}$/.test(live.chain.statedOn) && !files(join(ROOT, 'src')).some((f) => /\.(js|html|css)$/.test(f) && /eth_|0x[0-9a-f]{4}|chain-id/i.test(readFileSync(f, 'utf8'))));
gate('gate warning: base58 validator accepts every valid 32-44 char string, rejects only malformed', () => checks.addressGateNeverBlanket(ctx));
gate('brand: palette from assets with provenance, glyph traced, premultiplied handling recorded', () => ctx.brand.source.premultiplied === true && ctx.brand.source.pureBlackTransparentPixels > 0 && ctx.brand.glyph.d.length > 300 && /^0 0 [\d.]+ [\d.]+$/.test(ctx.brand.glyph.viewBox) && ctx.absent.html.includes(ctx.brand.glyph.d) && ctx.brand.palette.length === 11);
gate('branch absent: CA slot rendered, full width, inert', () => checks.absentCaInert(ctx));
gate('branch stated: CA slot shows full address, click-to-copy with feedback', () => checks.statedCaLive(ctx));
gate('branch absent: X and GitHub icons present, inert, no href', () => checks.absentSocialsInert(ctx) && checks.noHrefForUnstated(ctx));
gate('branch stated: X and GitHub link to stored URL, handle derived', () => checks.statedSocialsLive(ctx));
gate('socials: top-right in header, never hidden at any breakpoint, icon only', () => checks.socialsTopRightAllWidths(ctx) && checks.socialsIconOnly(ctx));
gate('info tiles: Chain, Contract, RPC only', () => checks.infoTilesOnlyThree(ctx));
gate('palette: tokens are the sampled brand colors, no literals anywhere else', () => checks.paletteTokens(ctx) && checks.paletteNoLiterals(ctx));
gate('favicon: 32x32 svg traced from the logo, palette fills, no comments', () => checks.faviconValid(ctx));
gate('no dates render on the page', () => checks.noVisibleDates(ctx));
gate('no ch units in css', () => checks.noChUnits(ctx));
gate('csp: meta and headers cover every live origin, no unsafe directives', () => checks.cspCoversLive(ctx));
gate('no inline script, style attribute or event handler', () => checks.noInlineCode(ctx));
gate('reduced motion honored in css, parallax/count and canvas', () => checks.reducedMotion(ctx));
gate('live features wired: slot, health, tvl by slug, pairs, dash fallback', () => checks.liveFeaturesWired(ctx));
gate('backoff: exponential, capped, jittered', () => checks.backoffMath());
gate('copy: zero shared two-word runs with the reference', () => {
  const docs = ['README.md', ...readdirSync(join(ROOT, 'docs')).map((f) => 'docs/' + f)].map((f) => visibleText(read(f)).replace(/[`#*|>_-]/g, ' '));
  return checks.copyDistinctFromReference(ctx) && docs.every((d) => sharedBigrams(d).length === 0);
});
gate('hygiene: no agent config files, no AI attribution, no reference name', () => {
  const banned = new RegExp([['cl', 'aude'], ['anthr', 'opic'], ['gener', 'ated by'], ['co-auth', 'ored-by'], ['chat', 'gpt'], ['hig', 'gs'], ['AI-gener', 'ated']].map((p) => p.join('')).join('|'), 'i');
  const agentFile = ['CL', 'AUDE.md'].join(''), agentDir = ['.cl', 'aude'].join('');
  if (existsSync(join(ROOT, agentFile)) || existsSync(join(ROOT, agentDir))) return false;
  return files(ROOT).filter((f) => !/\.(png|jpg|woff2?)$/.test(f) && !f.endsWith('ref-bigrams.json')).every((f) => !banned.test(readFileSync(f, 'utf8')) && !banned.test(relative(ROOT, f)));
});
gate('supporting files present and substantial', () => ['README.md', 'docs/whitepaper.md', 'docs/tokenomics.md', 'docs/roadmap.md', 'docs/architecture.md', '.github/CONTRIBUTING.md', '.github/SECURITY.md', 'LICENSE'].every((f) => existsSync(join(ROOT, f)) && statSync(join(ROOT, f)).size > 400));
gate('deploy output: dist/ matches a fresh build, with headers', () => {
  const real = build({ outDir: join(ROOT, 'dist') });
  return ['index.html', 'favicon.svg', '_headers', 'app.js', 'tokens.css'].every((f) => existsSync(join(real.out, f))) && !files(real.out).some((f) => f.endsWith('.map'));
});

/* ---------- mutation harness: anchors read the current record at runtime ---------- */
const mutations = [
  { name: 'inject href into an inert social', gate: 'absentSocialsInert', mutate: (c) => ({ ...c, absent: { html: c.absent.html.replace(/<span class="soc"( data-social="[^"]+")/, '<a class="soc" href="https://x.com/zz"$1') } }) },
  { name: 'make the absent CA slot a copy button', gate: 'absentCaInert', mutate: (c) => ({ ...c, absent: { html: c.absent.html.replace(/<div class="ca" data-state="absent"/, '<button class="ca" data-copy="0x' + '1'.repeat(40) + '"') } }) },
  { name: 'corrupt the stated CA copy payload', gate: 'statedCaLive', mutate: (c) => ({ ...c, stated: { html: c.stated.html.replace(`data-copy="${FIX_ADDR}"`, 'data-copy="0xdead"') } }) },
  { name: 'drop the derived handle from a stated social', gate: 'statedSocialsLive', mutate: (c) => ({ ...c, stated: { html: c.stated.html.replace(/aria-label="X @[^"]+"/, 'aria-label="X"') } }) },
  { name: 'blanket-reject by leading character', gate: 'addressGateNeverBlanket', mutate: (c) => ({ ...c, validator: (s) => typeof s === 'string' && !/^[1-9]/.test(s) && isAddress(s) }) },
  { name: 'accept a hex-style address', gate: 'addressGateNeverBlanket', mutate: (c) => ({ ...c, validator: (s) => typeof s === 'string' && (isAddress(s) || /^0x[0-9a-f]{40}$/.test(s) || s.length === 40) }) },
  { name: 'add a color literal to css', gate: 'paletteNoLiterals', mutate: (c) => ({ ...c, css: c.css + '\n.x { color: #ff0000; }' }) },
  { name: 'add an off-palette token', gate: 'paletteTokens', mutate: (c) => ({ ...c, tokens: c.tokens.replace(':root {', ':root {\n  --stray: #123456;') }) },
  { name: 'render a year on the page', gate: 'noVisibleDates', mutate: (c) => ({ ...c, absent: { html: c.absent.html.replace('<span>&copy; Joggspad</span>', '<span>&copy; Joggspad ' + (live.chain.statedOn || '2000-01-01').slice(0, 4) + '</span>') } }) },
  { name: 'use a ch unit', gate: 'noChUnits', mutate: (c) => ({ ...c, css: c.css + '\n.y { max-width: 60ch; }' }) },
  { name: 'drop the reduced-motion block', gate: 'reducedMotion', mutate: (c) => ({ ...c, css: c.css.replace('@media (prefers-reduced-motion: reduce)', '@media print') }) },
  { name: 'inline style attribute', gate: 'noInlineCode', mutate: (c) => ({ ...c, absent: { html: c.absent.html.replace('<body>', '<body style="margin:0">') } }) },
  { name: 'add a fourth info tile label', gate: 'infoTilesOnlyThree', mutate: (c) => ({ ...c, absent: { html: c.absent.html.replace(/(<span class="label">RPC<\/span>)/, '$1<span class="label">GitHub</span>') } }) },
];
gate('mutation harness: every mutation is caught by its gate', () => {
  let killed = 0;
  for (const m of mutations) {
    const clean = checks[m.gate](ctx);
    let mutated;
    try { mutated = checks[m.gate](m.mutate(ctx)); } catch { mutated = false; }
    if (clean && !mutated) killed += 1;
    else console.log('   survived or baseline broken:', m.name, { clean, mutated });
  }
  console.log(`   mutations killed ${killed}/${mutations.length}`);
  return killed === mutations.length;
});

if (gates.length > 30) throw new Error('gate budget exceeded: ' + gates.length);

const started = Date.now();
let failed = 0;
for (const g of gates) {
  let ok = false;
  try { ok = g.fn() === true; } catch (e) { console.log('   error:', e.message); }
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + g.name);
}
rmSync(TMP, { recursive: true, force: true });
console.log(`\n${gates.length - failed}/${gates.length} gates passed in ${Date.now() - started}ms (budget 30 gates, 5 min)`);
console.log(`branches proven: absent -> CA inert [${checks.absentCaInert(ctx)}], socials inert [${checks.absentSocialsInert(ctx)}]; stated -> CA live [${checks.statedCaLive(ctx)}], socials live [${checks.statedSocialsLive(ctx)}]`);
process.exit(failed ? 1 : 0);
