// Typing a thing to buy: our own results under the box, readable in any theme (a phone's built-in
// suggestion popup isn't, and only shows a few). What this house has bought first, then the catalog,
// then real products online, and whatever was typed can always be added as it is.

import { state, subsFor, setSubs, swapToSub } from '../store.js';
import { searchFoods, FOOD_BY_ID } from '../data/foods.js';
import { searchProducts } from '../services/off.js';
import { esc, attr, icon, openSheet, toast, haptic } from './dom.js';

const AMOUNT = /^(\d*\.?\d+)\s*(lb|lbs|oz|gal|dozen|ea|can|cans|bag|bags|box|jar|pack|bottle)?\s+/i;
const clean = v => v.trim().replace(AMOUNT, '');

// names this house has used that aren't in the catalog
function ourOwn(q) {
  const t = q.toLowerCase(), seen = new Map();
  for (const x of [...state.items, ...state.shopping, ...(state.history || []).slice(-300)]) {
    if (!x.name || x.foodId || x.type === 'receipt' || !x.name.toLowerCase().includes(t)) continue;
    const k = x.name.toLowerCase();
    if (!seen.has(k)) seen.set(k, { name: x.name, emoji: x.emoji || '🛒', cat: x.cat, unit: x.unit, brand: x.brand || '', size: x.size || '', note: 'You’ve had this' });
  }
  return [...seen.values()].slice(0, 4);
}

// input: the box; onPick({ name, foodId, emoji, cat, unit, brand, size, typed })
export function attachPicker(input, onPick, { online = true } = {}) {
  const box = document.createElement('div');
  box.className = 'pick-list';
  box.hidden = true;
  (input.closest('.addbar, .pick-host') || input).after(box);
  let hits = [], seq = 0, timer = null;
  const paint = (q, web = [], looking = false) => {
    const foods = searchFoods(q, 12).map(f => ({ name: f.name, foodId: f.id, emoji: f.emoji, cat: f.cat, unit: f.unit, note: '' }));
    const mine = ourOwn(q), names = new Set([...mine, ...foods].map(x => x.name.toLowerCase()));
    const exact = names.has(q.toLowerCase());
    const label = [...new Set(web.map(p => p.name.toLowerCase()))].map(n => web.find(p => p.name.toLowerCase() === n)).filter(p => !names.has(p.name.toLowerCase())).slice(0, 6);
    hits = [...(exact ? [] : [{ name: q, typed: true, emoji: '✏️', note: 'Add it just like this' }]), ...mine, ...foods, ...label];
    box.innerHTML = hits.map((h, i) => `<button type="button" class="pick-row" data-pick="${i}"><span class="em">${h.image ? `<img src="${attr(h.image)}" alt="">` : h.emoji || '🛒'}</span><span class="t"><b>${esc(h.name)}</b>${h.note ? `<small>${esc(h.note)}</small>` : ''}</span></button>`).join('')
      + (looking ? '<div class="pick-more">Looking online…</div>' : '');
    box.hidden = !hits.length;
  };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const my = ++seq, q = clean(input.value);
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    const lookOnline = online && q.length >= 3 && navigator.onLine !== false;
    paint(q, [], lookOnline);
    if (!lookOnline) return;
    timer = setTimeout(async () => {
      const web = await searchProducts(q).catch(() => []);
      if (my !== seq) return;
      const food = p => p.foodId ? FOOD_BY_ID[p.foodId] : null;
      paint(q, web.map(p => ({ name: p.name, brand: p.brand, size: p.quantity, image: p.image, foodId: null, emoji: food(p)?.emoji || '🛒', cat: food(p)?.cat, unit: food(p)?.unit, note: [p.brand, p.quantity].filter(Boolean).join(' · ') || 'Product online' })));
    }, 450);
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    const h = hits[Number(b.dataset.pick)];
    seq++; clearTimeout(timer);
    box.hidden = true; box.innerHTML = '';
    onPick(h);
  });
  return { hide: () => { seq++; clearTimeout(timer); box.hidden = true; box.innerHTML = ''; } };
}

// "If it isn't there, get this instead." From a list line it can also swap to one in the store.
export function subsSheet({ foodId, name, entryId = null }) {
  openSheet({
    title: '🔁 If it isn’t there',
    html: `<p class="muted" style="margin-top:0">What to get instead of <b>${esc(name)}</b>. Everyone in the house sees these, and they come back whenever it’s on the list.</p>
      <div data-sublist></div>
      <div class="pick-host row" style="gap:8px;margin-top:10px"><input class="input grow" data-subnew placeholder="Get this instead…" autocomplete="off"><button class="btn btn-brass" data-subadd aria-label="Add">${icon('plus')}</button></div>`,
    onMount: (b, close) => {
      const inp = b.querySelector('[data-subnew]');
      const draw = () => {
        const subs = subsFor(foodId, name);
        b.querySelector('[data-sublist]').innerHTML = subs.length
          ? subs.map((s, i) => `<div class="irow"><span class="em">${s.emoji}</span><span class="t"><b>${esc(s.name)}</b></span>${entryId ? `<button class="btn btn-sage btn-sm" data-got="${i}">Got this</button>` : ''}<button class="icon-btn" style="width:32px;height:32px;color:var(--ink-3);background:none;border:0" data-subdel="${i}" aria-label="Remove ${attr(s.name)}">${icon('close')}</button></div>`).join('')
          : '<p class="small muted" style="margin:0">Nothing yet.</p>';
        b.querySelectorAll('[data-subdel]').forEach(x => x.onclick = () => { setSubs(foodId, name, subs.filter((_, i) => i !== Number(x.dataset.subdel))); draw(); });
        b.querySelectorAll('[data-got]').forEach(x => x.onclick = () => { const s = subs[Number(x.dataset.got)]; swapToSub(entryId, s); haptic(15); toast(`Got ${s.name} instead`, { icon: '🔁' }); close(); });
      };
      const add = h => {
        const nm = String(h.name || '').trim(); if (!nm) return;
        const subs = subsFor(foodId, name);
        if (nm.toLowerCase() === name.toLowerCase() || subs.some(s => s.name.toLowerCase() === nm.toLowerCase())) return;
        setSubs(foodId, name, [...subs, { name: nm, foodId: h.foodId || null, emoji: h.emoji && h.emoji !== '✏️' ? h.emoji : '🛒' }]);
        inp.value = ''; haptic(); draw();
      };
      const pick = attachPicker(inp, add, { online: false });
      b.querySelector('[data-subadd]').onclick = () => { pick.hide(); add({ name: inp.value, ...matchTyped(inp.value) }); };
      inp.onkeydown = e => { if (e.key === 'Enter') { pick.hide(); add({ name: inp.value, ...matchTyped(inp.value) }); } };
      draw();
    },
  });
}
const matchTyped = v => { const f = searchFoods(v, 1)[0]; return f && f.name.toLowerCase() === v.trim().toLowerCase() ? { foodId: f.id, emoji: f.emoji } : {}; };
