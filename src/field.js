import { reduced } from './fx.js';

/* Particle field on three depth layers. Colors are read from the token layer at runtime. */
export function initField() {
  const canvas = document.getElementById('field');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const hero = canvas.parentElement;
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const layers = [0.35, 0.65, 1];
  let w = 0, h = 0, dpr = 1, parts = [], rings = [], raf = 0, visible = true;
  const pointer = { x: -9999, y: -9999 };

  function build() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = hero.clientWidth;
    h = hero.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(36, Math.min(130, Math.round((w * h) / 11000)));
    parts = Array.from({ length: n }, (_, i) => {
      const z = layers[i % layers.length];
      return { x: Math.random() * w, y: Math.random() * h, z, vx: (Math.random() - 0.5) * 0.25 * z, vy: (Math.random() - 0.5) * 0.25 * z };
    });
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    const shift = scrollY * 0.12;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!reduced.matches) {
        p.x += p.vx;
        p.y += p.vy;
        const dx = p.x - pointer.x, dy = p.y - (pointer.y + 0);
        const d2 = dx * dx + dy * dy;
        if (d2 < 19600) {
          const f = (1 - Math.sqrt(d2) / 140) * 1.4 * p.z;
          const d = Math.sqrt(d2) || 1;
          p.x += (dx / d) * f;
          p.y += (dy / d) * f;
        }
        if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
      }
      const py = p.y - shift * p.z;
      ctx.globalAlpha = 0.18 + p.z * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, py, 0.6 + p.z * 1.4, 0, 6.2832);
      ctx.fill();
      for (let j = i + 1; j < parts.length; j++) {
        const q = parts[j];
        if (q.z !== p.z) continue;
        const ddx = p.x - q.x, ddy = py - (q.y - shift * q.z);
        const dd = ddx * ddx + ddy * ddy;
        if (dd < 12100) {
          ctx.globalAlpha = (1 - Math.sqrt(dd) / 110) * 0.22 * p.z;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, py);
          ctx.lineTo(q.x, q.y - shift * q.z);
          ctx.stroke();
        }
      }
    }
    rings = rings.filter((r) => t - r.t0 < 2200);
    rings.forEach((r) => {
      const k = (t - r.t0) / 2200;
      ctx.globalAlpha = (1 - k) * 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w * 0.72, h * 0.45, 40 + k * Math.max(w, h) * 0.6, 0, 6.2832);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    frame(t);
    raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
  }
  function start() {
    if (!raf && !reduced.matches) raf = requestAnimationFrame(loop);
  }

  build();
  frame(0);
  if (reduced.matches) {
    new ResizeObserver(() => { build(); frame(0); }).observe(hero);
    return;
  }
  new ResizeObserver(() => { build(); }).observe(hero);
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  });
  hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  window.addEventListener('jp:block', () => { if (rings.length < 4) rings.push({ t0: performance.now() }); });
  start();
}
