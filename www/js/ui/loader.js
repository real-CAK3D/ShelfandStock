// A small wood-shelf loading animation: three items hop in turn while something loads.
import { esc } from './dom.js';

export const loader = (text = 'Loading…', items = ['🫙', '🥫', '📦']) => `
  <div class="loader" role="status" aria-live="polite">
    <div class="loader-shelf">${items.map((e, i) => `<span style="animation-delay:${i * .18}s">${e}</span>`).join('')}</div>
    <div class="loader-text">${esc(text)}</div>
  </div>`;

// Full-screen version for longer waits (e.g. loading the photo AI the first time).
export function busy(text, items) {
  const el = document.createElement('div');
  el.className = 'busy';
  el.innerHTML = loader(text, items);
  document.body.appendChild(el);
  return { set: t => { const x = el.querySelector('.loader-text'); if (x) x.textContent = t; }, done: () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); } };
}
