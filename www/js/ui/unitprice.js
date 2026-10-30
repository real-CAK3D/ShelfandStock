// "Which is cheaper?" — compare two package sizes in the store by price per ounce / fl oz / count.

import { openSheet, esc } from './dom.js';
import { money } from '../store.js';

// everything converts to ounces (weight), fluid ounces (volume) or each (count)
const UNITS = {
  oz: ['wt', 1, 'oz'], lb: ['wt', 16, 'oz'], g: ['wt', 1 / 28.3495, 'oz'], kg: ['wt', 35.274, 'oz'],
  'fl oz': ['vol', 1, 'fl oz'], ml: ['vol', 1 / 29.5735, 'fl oz'], L: ['vol', 33.814, 'fl oz'], qt: ['vol', 32, 'fl oz'], gal: ['vol', 128, 'fl oz'],
  ct: ['ea', 1, 'each'],
};

export function unitPriceSheet() {
  const side = k => `<div class="up-side" data-side="${k}">
      <b>${k === 'a' ? 'Package A' : 'Package B'}</b>
      <label class="field"><span>Price</span><input class="input" inputmode="decimal" data-p placeholder="3.49"></label>
      <div class="row" style="gap:6px"><label class="field grow"><span>Size</span><input class="input" inputmode="decimal" data-s placeholder="16"></label>
      <label class="field" style="width:84px"><span>Unit</span><select class="input" data-u>${Object.keys(UNITS).map(u => `<option ${u === 'oz' ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
      <div class="up-per" data-per>—</div>
    </div>`;
  openSheet({
    title: '⚖️ Which is cheaper?',
    html: `<p class="small muted" style="margin:0 0 10px">Type the price and size from each shelf tag. Works across units, like a 2 lb bag against a 24 oz box.</p>
      <div class="up-grid">${side('a')}${side('b')}</div>
      <div class="where-banner" data-verdict style="margin-top:12px">🤔 <span>Fill in both to compare.</span></div>`,
    onMount: b => {
      const read = k => {
        const el = b.querySelector(`[data-side=${k}]`), p = Number(el.querySelector('[data-p]').value.replace(/[$,]/g, '')), s = Number(el.querySelector('[data-s]').value);
        const [kind, f, base] = UNITS[el.querySelector('[data-u]').value];
        return { el, kind, base, per: p > 0 && s > 0 ? p / (s * f) : null };
      };
      const calc = () => {
        const A = read('a'), B = read('b');
        for (const x of [A, B]) { x.el.querySelector('[data-per]').textContent = x.per ? `${money(x.per)} per ${x.base}` : '—'; x.el.classList.remove('win'); }
        const v = b.querySelector('[data-verdict]');
        if (!A.per || !B.per) { v.innerHTML = '🤔 <span>Fill in both to compare.</span>'; return; }
        if (A.kind !== B.kind) { v.innerHTML = '⚠️ <span>One is by weight and one is by volume or count, so they can’t be compared.</span>'; return; }
        if (Math.abs(A.per - B.per) / Math.max(A.per, B.per) < 0.01) { v.innerHTML = '🤝 <span>Same price per unit. Get whichever size you’ll use up.</span>'; return; }
        const [w, l] = A.per < B.per ? [A, B] : [B, A];
        w.el.classList.add('win');
        v.innerHTML = `✅ <span><b>${w === A ? 'Package A' : 'Package B'}</b> is ${Math.round((1 - w.per / l.per) * 100)}% cheaper per ${esc(w.base)}.</span>`;
      };
      b.addEventListener('input', calc); b.addEventListener('change', calc);
    },
  });
}
