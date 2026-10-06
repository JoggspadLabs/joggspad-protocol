const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nfCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

export const DASH = '–';

export function fmtInt(n) {
  return Number.isFinite(n) ? nf0.format(n) : DASH;
}

export function fmtUsdCompact(n) {
  return Number.isFinite(n) ? '$' + nfCompact.format(n) : DASH;
}

export function fmtPrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return DASH;
  if (n >= 1000) return '$' + nf0.format(n);
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  // sub-cent prices keep four significant digits
  return '$' + n.toFixed(Math.min(14, 3 - Math.floor(Math.log10(n))));
}

export function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DASH;
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return sign + Math.abs(n).toFixed(2) + '%';
}
