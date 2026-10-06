export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/* number count-up; falls back to an instant write under reduced motion */
export function countTo(el, target, format, duration = 900) {
  if (reduced.matches || !Number.isFinite(target)) {
    el.textContent = format(target);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = format(target * easeOutExpo(t));
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = format(target);
  };
  requestAnimationFrame(step);
}

export function flash(el) {
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

export function initProgress() {
  const bar = document.getElementById('progress');
  if (!bar) return;
  let queued = false;
  const paint = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')';
  };
  addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  }, { passive: true });
  addEventListener('resize', paint);
  paint();
}

export function initReveal() {
  const nodes = [...document.querySelectorAll('[data-reveal]')];
  if (!nodes.length) return;
  if (reduced.matches || !('IntersectionObserver' in window)) {
    nodes.forEach((n) => n.classList.add('in'));
    return;
  }
  const groups = new Map();
  nodes.forEach((n) => {
    const list = groups.get(n.parentElement) || [];
    n.style.setProperty('--d', Math.min(list.length, 6) * 70 + 'ms');
    list.push(n);
    groups.set(n.parentElement, list);
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  nodes.forEach((n) => io.observe(n));
}

/* parallax at several depths: translate = distance from viewport centre * depth */
export function initParallax() {
  if (reduced.matches) return;
  const items = [...document.querySelectorAll('[data-depth]')].map((el) => ({ el, depth: Number(el.dataset.depth) || 0, mid: 0 }));
  if (!items.length) return;
  const measure = () => {
    items.forEach((it) => { it.el.style.transform = ''; });
    items.forEach((it) => {
      const r = it.el.getBoundingClientRect();
      it.mid = r.top + scrollY + r.height / 2;
    });
    paint();
  };
  let queued = false;
  function paint() {
    queued = false;
    const centre = scrollY + innerHeight / 2;
    items.forEach((it) => {
      const off = centre - it.mid;
      if (Math.abs(off) > innerHeight * 1.5) return;
      it.el.style.transform = 'translate3d(0,' + (-off * it.depth).toFixed(1) + 'px,0)';
    });
  }
  addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  }, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  measure();
}

export function initSpotlight() {
  document.querySelectorAll('[data-spot]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', e.clientX - r.left + 'px');
      el.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  });
}

export function initScrollSpy() {
  const links = [...document.querySelectorAll('.nav a')];
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const targets = [...map.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  if (!targets.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      const a = map.get(e.target.id);
      if (a) a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  targets.forEach((t) => io.observe(t));
}
