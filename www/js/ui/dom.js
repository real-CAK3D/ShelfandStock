// Small DOM toolkit: escaping, icons, sheets, toasts, confirms and celebratory effects.

import { state } from '../store.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = esc;

const P = {
  kitchen: '<path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-6h6v6"/>',
  stock: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M8 4v16"/>',
  recipes: '<path d="M6 3v8a3 3 0 0 0 6 0V3M9 3v18"/><path d="M17 21V3c2 0 3 2 3 5s-1 5-3 5"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.4" fill="currentColor"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 9v6M10 9v6M13 9v6M16 9v6"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  move: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a3.5 3.5 0 0 1 0 7M22 21a7 7 0 0 0-5-6.7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  minus: '<path d="M5 12h14"/>',
};
export const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export function haptic(ms = 12) {
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // browsers block vibration before the first tap
  if (state.settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch { }
}

// ---------- toasts ----------
let toastWrap;
export function toast(msg, opts = {}) {
  toastWrap ||= document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast-wrap' }));
  const t = document.createElement('div');
  t.className = 'toast wood-dark';
  t.innerHTML = `<span>${opts.icon ? opts.icon + ' ' : ''}${esc(msg)}</span>${opts.action ? `<button>${esc(opts.action)}</button>` : ''}`;
  toastWrap.appendChild(t);
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
  if (opts.action) t.querySelector('button').onclick = () => { opts.onAction?.(); kill(); };
  setTimeout(kill, opts.ms || (opts.action ? 4500 : 2400));
}

// ---------- sheets ----------
const stack = [];
export function openSheet({ title = '', html = '', hero = '', onMount, onClose, cls = '' }) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sh = document.createElement('div');
  sh.className = 'sheet ' + cls;
  sh.setAttribute('role', 'dialog');
  sh.innerHTML = `<div class="grab"></div>${title ? `<div class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-close style="color:var(--ink);background:var(--paper-2);border-color:var(--paper-3)">${icon('close')}</button></div>` : ''}<div class="sheet-body">${hero}${html}</div>`;
  document.body.append(scrim, sh);
  const entry = { sh, scrim, onClose };
  stack.push(entry);
  const close = () => closeSheet(entry);
  scrim.onclick = close;
  sh.querySelector('[data-close]')?.addEventListener('click', close);
  // drag-to-dismiss from the grab handle / header
  let y0 = null, dy = 0;
  const startDrag = e => { if (sh.querySelector('.sheet-body').scrollTop > 0) return; y0 = e.touches ? e.touches[0].clientY : e.clientY; sh.style.transition = 'none'; };
  const moveDrag = e => { if (y0 == null) return; dy = Math.max(0, (e.touches ? e.touches[0].clientY : e.clientY) - y0); sh.style.transform = `translateY(${dy}px)`; };
  const endDrag = () => { if (y0 == null) return; sh.style.transition = 'transform .3s var(--ease)'; if (dy > 110) close(); else sh.style.transform = ''; y0 = null; dy = 0; };
  for (const el of [sh.querySelector('.grab'), sh.querySelector('.sheet-head')].filter(Boolean)) {
    el.addEventListener('touchstart', startDrag, { passive: true });
    el.addEventListener('touchmove', moveDrag, { passive: true });
    el.addEventListener('touchend', endDrag);
  }
  onMount?.(sh.querySelector('.sheet-body'), close, sh);
  return { el: sh, body: sh.querySelector('.sheet-body'), close };
}

export function closeSheet(entry) {
  entry ||= stack[stack.length - 1];
  if (!entry || entry.closing) return;
  entry.closing = true;
  stack.splice(stack.indexOf(entry), 1);
  entry.sh.classList.add('out'); entry.scrim.classList.add('out');
  setTimeout(() => { entry.sh.remove(); entry.scrim.remove(); }, 300);
  entry.onClose?.();
}
export const closeAllSheets = () => [...stack].reverse().forEach(e => closeSheet(e));
export const sheetOpen = () => stack.length > 0;

export function confirmBox(message, { ok = 'Yes', cancel = 'Cancel', danger = false } = {}) {
  return new Promise(res => {
    let done = false;
    openSheet({
      title: 'Are you sure?',
      html: `<p style="margin:0 0 18px;color:var(--ink-2)">${esc(message)}</p><div class="row"><button class="btn btn-ghost grow" data-no>${esc(cancel)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-brass'} grow" data-yes>${esc(ok)}</button></div>`,
      onMount: (b, close) => {
        b.querySelector('[data-yes]').onclick = () => { done = true; res(true); close(); };
        b.querySelector('[data-no]').onclick = () => close();
      },
      onClose: () => { if (!done) res(false); },
    });
  });
}

// ---------- effects ----------
export function flyTo(fromEl, toSel, emoji) {
  const to = document.querySelector(toSel);
  if (!fromEl || !to) return;
  const a = fromEl.getBoundingClientRect(), b = to.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'flyer'; f.textContent = emoji;
  f.style.left = a.left + a.width / 2 - 14 + 'px'; f.style.top = a.top + a.height / 2 - 16 + 'px';
  document.body.appendChild(f);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    f.style.transform = `translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${b.top + b.height / 2 - a.top - a.height / 2}px) scale(.4)`;
    f.style.opacity = '.2';
  }));
  setTimeout(() => { f.remove(); to.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'cubic-bezier(.34,1.56,.64,1)' }); }, 700);
}

export function confetti(x = innerWidth / 2, y = innerHeight / 2, n = 26) {
  const colors = ['#c9a24a', '#e7c877', '#6f8f4e', '#c0533b', '#4f86a3', '#d9952b'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.background = colors[i % colors.length];
    document.body.appendChild(c);
    const ang = Math.random() * Math.PI * 2, v = 80 + Math.random() * 160;
    c.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * v}px, ${Math.sin(ang) * v + 160}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => c.remove();
  }
}

export function countUp(el, to, ms = 700) {
  const from = 0, t0 = performance.now();
  const step = t => { const p = Math.min(1, (t - t0) / ms); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

export function segmented(el, onChange) {
  const btns = $$('button', el);
  const thumb = document.createElement('div'); thumb.className = 'seg-thumb'; el.prepend(thumb);
  const place = () => { const on = btns.find(b => b.classList.contains('on')) || btns[0]; thumb.style.left = on.offsetLeft + 'px'; thumb.style.width = on.offsetWidth + 'px'; };
  btns.forEach(b => b.addEventListener('click', () => { btns.forEach(x => x.classList.toggle('on', x === b)); place(); onChange?.(b.dataset.v); }));
  requestAnimationFrame(place);
}

export const imgOrEmoji = (it, cls = 'em') => it.image ? `<img class="${cls}" src="${attr(it.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls}',textContent:'${it.emoji || '📦'}'}))">` : `<span class="${cls}">${it.emoji || '📦'}</span>`;
