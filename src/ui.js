async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.className = 'sr-copy';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
}

/* click-to-copy: only elements rendered with data-copy exist when a value is stated */
export function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const label = btn.querySelector('[data-copy-label]');
    const toast = btn.querySelector('.ca-toast');
    const idle = label ? label.textContent : '';
    let timer = 0;
    btn.addEventListener('click', async () => {
      let msg = 'Copied';
      try {
        await writeClipboard(btn.dataset.copy);
      } catch {
        msg = 'Copy blocked';
      }
      btn.dataset.copied = msg === 'Copied' ? 'true' : 'false';
      if (label) label.textContent = msg;
      if (toast) toast.textContent = msg;
      clearTimeout(timer);
      timer = setTimeout(() => {
        delete btn.dataset.copied;
        if (label) label.textContent = idle;
        if (toast) toast.textContent = '';
      }, 1800);
    });
  });
}

export function initTabs() {
  const list = document.querySelector('.tablist');
  if (!list) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const ink = list.querySelector('.tab-ink');
  const place = () => {
    const cur = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    if (!cur || !ink) return;
    ink.style.width = cur.offsetWidth + 'px';
    ink.style.transform = 'translateX(' + cur.offsetLeft + 'px)';
  };
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    place();
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t, false));
    t.addEventListener('keydown', (e) => {
      const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      select(tabs[(keys[e.key] + tabs.length) % tabs.length], true);
    });
  });
  addEventListener('resize', place);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  place();
}
