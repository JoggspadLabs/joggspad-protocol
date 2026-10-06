import { countTo, flash } from './fx.js';
import { nextDelay } from './backoff.js';
import { DASH, fmtInt, fmtUsdCompact, fmtPrice, fmtPct } from './format.js';

const meta = (n) => document.querySelector('meta[name="' + n + '"]').content;
const RPC = meta('jp:rpc');
const GENESIS = meta('jp:genesis');
const LLAMA_SLUG = meta('jp:llama-slug').toLowerCase();
const DEX_TAG = meta('jp:dex-tag').toLowerCase();

const LLAMA = 'https://api.llama.fi/v2/chains';
const DEX = 'https://api.dexscreener.com/latest/dex/search?q=' + encodeURIComponent(DEX_TAG);

/* ---------- polling with exponential backoff + jitter, paused while hidden ---------- */
export function createPoller({ task, base, max, onFail }) {
  let fails = 0, timer = 0, busy = false;
  const schedule = () => {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = setTimeout(tick, nextDelay(base, max, fails));
  };
  async function tick() {
    if (document.hidden || busy) return;
    busy = true;
    try {
      await task();
      fails = 0;
    } catch (err) {
      if (document.hidden) { busy = false; return; }
      fails += 1;
      if (onFail) onFail(fails, err);
    }
    busy = false;
    schedule();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else tick();
  });
  tick();
}

async function getJson(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/* ---------- binding helpers ---------- */
const binds = (name) => [...document.querySelectorAll('[data-bind="' + name + '"]')];
const last = {};

function setBound(name, value, format) {
  binds(name).forEach((el) => {
    const first = !(name in last);
    if (first) {
      el.textContent = '';
      const span = document.createElement('span');
      el.appendChild(span);
      countTo(span, value, format);
    } else if (last[name] !== value) {
      el.textContent = format(value);
      flash(el);
    }
  });
  last[name] = value;
}

function setDash(name) {
  if (name in last) return;
  binds(name).forEach((el) => { el.textContent = DASH; });
}

function setHealth(state) {
  const text = { live: 'Live', connecting: 'Connecting', offline: 'Offline' }[state];
  document.querySelectorAll('[data-health]').forEach((el) => {
    el.dataset.state = state;
    const t = el.querySelector('.pill-text');
    if (t) t.textContent = text;
  });
}

/* ---------- block ticker + chain health ---------- */
async function rpcCall(method, params = []) {
  const j = await getJson(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (j.error || j.result === undefined || j.result === null) throw new Error('rpc');
  return j.result;
}

function startChain() {
  let verified = false;
  setHealth('connecting');
  createPoller({
    base: 2500,
    max: 30000,
    task: async () => {
      if (!verified) {
        if ((await rpcCall('getGenesisHash')) !== GENESIS) throw new Error('cluster mismatch');
        verified = true;
      }
      const n = Number(await rpcCall('getSlot', [{ commitment: 'confirmed' }]));
      if (!Number.isFinite(n)) throw new Error('slot');
      const moved = last.block !== n;
      setBound('block', n, fmtInt);
      if (moved) window.dispatchEvent(new CustomEvent('jp:block', { detail: n }));
      setHealth('live');
    },
    onFail: (fails) => {
      if (fails >= 2) setHealth('offline');
      if (fails >= 2) setDash('block');
    },
  });
}

/* ---------- TVL, matched on the DefiLlama chain slug ---------- */
function startTvl() {
  createPoller({
    base: 60000,
    max: 300000,
    task: async () => {
      const list = await getJson(LLAMA);
      const hit = Array.isArray(list) ? list.find((c) => String(c.gecko_id || '').toLowerCase() === LLAMA_SLUG || String(c.name || '').toLowerCase() === LLAMA_SLUG) : null;
      if (!hit || !Number.isFinite(Number(hit.tvl))) { setDash('tvl'); return; }
      setBound('tvl', Number(hit.tvl), fmtUsdCompact);
    },
    onFail: () => setDash('tvl'),
  });
}

/* ---------- top pairs ---------- */
const safeHost = (u, host) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && (x.hostname === host || x.hostname.endsWith('.' + host)) ? x.href : '';
  } catch { return ''; }
};

function pairRow(p, i) {
  const href = safeHost(p.url, 'dexscreener.com');
  const row = document.createElement(href ? 'a' : 'div');
  row.className = 'row';
  if (href) { row.href = href; row.target = '_blank'; row.rel = 'noopener noreferrer'; }
  const cell = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
  row.appendChild(cell('idx mono', String(i + 1).padStart(2, '0')));

  const pair = document.createElement('span');
  pair.className = 'pair';
  const logo = document.createElement('span');
  logo.className = 'logo';
  const sym = (p.baseToken && p.baseToken.symbol) || '?';
  const img = safeHost(p.info && p.info.imageUrl, 'dexscreener.com');
  if (img) {
    const im = document.createElement('img');
    im.src = img; im.alt = ''; im.width = 36; im.height = 36; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
    im.addEventListener('error', () => { im.remove(); logo.textContent = sym.charAt(0).toUpperCase(); });
    logo.appendChild(im);
  } else {
    logo.textContent = sym.charAt(0).toUpperCase();
  }
  const name = document.createElement('span');
  name.className = 'pair-name';
  const b = document.createElement('b'); b.textContent = sym;
  const q = document.createElement('span');
  q.textContent = '/ ' + ((p.quoteToken && p.quoteToken.symbol) || '?') + (p.dexId ? ' · ' + p.dexId : '');
  name.append(b, q);
  pair.append(logo, name);
  row.appendChild(pair);

  row.appendChild(cell('cell mono', fmtPrice(p.priceUsd)));
  row.appendChild(cell('cell mono', fmtUsdCompact(Number(p.volume && p.volume.h24))));
  row.appendChild(cell('cell mono hide-s', fmtPct(p.priceChange && p.priceChange.h24)));
  return row;
}

function startPairs() {
  const list = document.getElementById('pairs-list');
  const note = document.getElementById('pairs-note');
  if (!list) return;
  const paint = (pairs) => {
    list.replaceChildren(...pairs.map((p, i) => {
      const li = document.createElement('li');
      li.appendChild(pairRow(p, i));
      return li;
    }));
    list.setAttribute('aria-busy', 'false');
    note.hidden = pairs.length > 0;
  };
  createPoller({
    base: 45000,
    max: 300000,
    task: async () => {
      const j = await getJson(DEX);
      const pairs = (j.pairs || [])
        .filter((p) => String(p.chainId).toLowerCase() === DEX_TAG)
        .sort((a, b) => (Number(b.volume && b.volume.h24) || 0) - (Number(a.volume && a.volume.h24) || 0))
        .slice(0, 10);
      paint(pairs);
      setBound('pairs', pairs.length, fmtInt);
    },
    onFail: () => {
      if (list.getAttribute('aria-busy') === 'true') paint([]);
      setDash('pairs');
    },
  });
}

export function initLive() {
  startChain();
  startTvl();
  startPairs();
}
