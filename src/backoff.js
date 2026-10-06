/* Exponential backoff with jitter. rnd is injectable so the delay can be checked without a clock. */
export function nextDelay(base, max, fails, rnd = Math.random) {
  if (!fails) return Math.round(base * (0.9 + rnd() * 0.2));
  const cap = Math.min(max, base * Math.pow(2, fails));
  return Math.round(cap / 2 + rnd() * (cap / 2));
}
