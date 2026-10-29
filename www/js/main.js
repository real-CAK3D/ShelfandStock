// App shell: routing, tab bar, global search, back handling and wiring between modules.

import { state, subscribe, addToList, addItem, allRecipes, sectionById, itemStatus, catOf } from './store.js';
import { searchFoods } from './data/foods.js';
import { $, $$, esc, icon, openSheet, closeSheet, sheetOpen, haptic, toast, flyTo, imgOrEmoji } from './ui/dom.js';
import { showItem, addFlow, crumb } from './ui/itemSheet.js';
import { register, actions } from './router.js';
import { welcome, tour } from './ui/tour.js';
import { toggleHelp } from './ui/help.js';
import { startSync } from './services/sync.js';
import * as kitchen from './views/kitchen.js';
import * as stock from './views/stock.js';
import * as recipes from './views/recipes.js';
import * as plan from './views/plan.js';
import * as list from './views/list.js';
import * as settings from './views/settings.js';

const VIEWS = { kitchen, stock, recipes, plan, list, settings };
const TABS = [['kitchen', 'Kitchen'], ['stock', 'Stock'], ['recipes', 'Recipes'], ['plan', 'Plan'], ['list', 'List']];
const SUBTITLE = { kitchen: () => new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), stock: () => `${state.items.length} items on hand`, recipes: () => `${allRecipes().length} recipes`, plan: () => 'Meals, gatherings & holidays', list: () => `${state.shopping.length} to buy`, settings: () => 'Make it yours' };

let current = 'kitchen';
const app = $('#app');

app.innerHTML = `
  <header class="topbar wood-dark">
    <div class="brand"><img class="brand-mark" src="icons/icon.svg" alt=""><div style="min-width:0"><h1>Shelf &amp; Stock</h1><div class="sub" data-sub></div></div></div>
    <button class="icon-btn" data-act="help" aria-label="Help" style="font:700 19px Fraunces,Georgia,serif">?</button>
    <button class="icon-btn" data-act="search" aria-label="Search">${icon('search')}</button>
    <button class="icon-btn" data-act="settings" aria-label="Settings">${icon('gear')}</button>
  </header>
  <main id="view"></main>
  <nav class="tabbar wood-dark" aria-label="Sections"><div class="tab-glow"></div>${TABS.map(([v, l]) => `<button class="tab" data-v="${v}" aria-label="${l}">${icon(v)}<span>${l}</span></button>`).join('')}</nav>
  <button class="fab" aria-label="Add groceries">${icon('plus')}</button>`;

const view = $('#view');

function placeGlow() {
  const t = $(`.tab[data-v=${current}]`), g = $('.tab-glow');
  if (!t) { g.style.opacity = 0; return; }
  g.style.opacity = 1; g.style.width = t.offsetWidth + 'px'; g.style.transform = `translateX(${t.offsetLeft - 8}px)`;
  g.style.left = '8px';
}

function badges() {
  const n = state.shopping.filter(s => !s.done).length;
  const t = $('.tab[data-v=list]');
  let d = t.querySelector('.dot');
  if (n) { if (!d) { d = document.createElement('span'); d.className = 'dot'; t.appendChild(d); } d.textContent = n; } else d?.remove();
  const exp = state.items.filter(i => itemStatus(i).key === 'expired').length;
  const s = $('.tab[data-v=stock]');
  let e = s.querySelector('.dot');
  if (exp) { if (!e) { e = document.createElement('span'); e.className = 'dot'; s.appendChild(e); } e.textContent = exp; } else e?.remove();
}

function go(name, params = {}, { animate = true } = {}) {
  if (!VIEWS[name]) name = 'kitchen';
  const same = name === current;
  current = name;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.v === name));
  placeGlow();
  $('[data-sub]').textContent = SUBTITLE[name]();
  VIEWS[name].render(view, params);
  if (!same) view.scrollTop = 0;
  if (animate && !same) { view.classList.remove('view-enter'); void view.offsetWidth; view.classList.add('view-enter'); }
  $('.fab').style.display = name === 'settings' ? 'none' : '';
  badges();
}

// Re-render the current view on any state change, keeping scroll and focus where they were.
subscribe(why => {
  if (why === 'replace') return go(current, {}, { animate: false });
  const y = view.scrollTop;
  const focused = document.activeElement && view.contains(document.activeElement) && document.activeElement.matches('input[type=text],input:not([type]),textarea') ? document.activeElement : null;
  if (focused) { badges(); return; }
  VIEWS[current].render(view, {});
  view.scrollTop = y;
  $('[data-sub]').textContent = SUBTITLE[current]();
  badges();
});

document.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (tab) { haptic(); closeOverlays(); return go(tab.dataset.v); }
  if (e.target.closest('.fab')) { haptic(); $('.fab').classList.add('spin'); setTimeout(() => $('.fab').classList.remove('spin'), 400); return addFlow(); }
  const act = e.target.closest('[data-act]');
  if (act?.dataset.act === 'settings') { haptic(); return go('settings'); }
  if (act?.dataset.act === 'search') { haptic(); return globalSearch(); }
  if (act?.dataset.act === 'help') return toggleHelp(() => current);
});

function closeOverlays() { document.querySelector('.inside')?._close?.(); }

// ---------- global search ----------
function globalSearch() {
  openSheet({
    title: 'Find anything',
    html: `<div class="search" style="margin:0 0 10px">${icon('search')}<input class="input" placeholder="Where's the cinnamon?" data-gq></div><div data-gres></div>`,
    onMount: (b, close) => {
      const q = $('[data-gq]', b), out = $('[data-gres]', b);
      setTimeout(() => q.focus(), 250);
      const draw = () => {
        const v = q.value.trim().toLowerCase();
        if (!v) { out.innerHTML = `<p class="muted small">Search your shelves, recipes and the food catalog.</p>`; return; }
        const items = state.items.filter(i => `${i.name} ${i.brand} ${(i.tags || []).join(' ')}`.toLowerCase().includes(v)).slice(0, 12);
        const rs = allRecipes().filter(r => r.title.toLowerCase().includes(v) || (r.tags || []).includes(v)).slice(0, 6);
        const have = new Set(items.map(i => i.foodId));
        const foods = searchFoods(v, 5).filter(f => !have.has(f.id));
        out.innerHTML = `
          ${items.length ? `<div class="group-h">In your kitchen<span class="line"></span></div>${items.map(i => { const st = itemStatus(i); return `<button class="irow" style="width:100%;text-align:left;--tint:${catOf(i.cat).color}" data-reveal="${i.id}"><span class="em">${imgOrEmoji(i, '')}</span><span class="t"><b>${esc(i.name)}</b><small>📍 ${esc(crumb(i))}</small></span>${st.label ? `<span class="pill ${st.key}">${st.label}</span>` : ''}</button>`; }).join('')}` : `<div class="where-banner">🤔 <span>No “${esc(q.value)}” in your kitchen.</span></div>`}
          ${foods.length ? `<div class="group-h">Not in stock<span class="line"></span></div>${foods.map(f => `<div class="irow"><span class="em">${f.emoji}</span><span class="t"><b>${esc(f.name)}</b><small>${esc(catOf(f.cat).name)}</small></span><button class="btn btn-ghost btn-sm" data-tolist="${f.id}">${icon('cart')}</button><button class="btn btn-ghost btn-sm" data-addf="${esc(f.name)}">${icon('plus')}</button></div>`).join('')}` : ''}
          ${rs.length ? `<div class="group-h">Recipes<span class="line"></span></div>${rs.map(r => `<button class="irow" style="width:100%;text-align:left" data-rec="${r.id}"><span class="em">${r.emoji}</span><span class="t"><b>${esc(r.title)}</b><small>${esc(r.type)}</small></span>${icon('next')}</button>`).join('')}` : ''}`;
      };
      q.oninput = draw; draw();
      out.onclick = e => {
        const rv = e.target.closest('[data-reveal]'); if (rv) { close(); return revealItem(rv.dataset.reveal); }
        const tl = e.target.closest('[data-tolist]'); if (tl) { addToList({ foodId: tl.dataset.tolist, name: '' }); flyTo(tl, '.tab[data-v=list]', '🛒'); toast('Added to list', { icon: '🛒' }); return; }
        const af = e.target.closest('[data-addf]'); if (af) { close(); return addFlow({ query: af.dataset.addf }); }
        const rc = e.target.closest('[data-rec]'); if (rc) { close(); return recipes.openRecipe(rc.dataset.rec); }
      };
    },
  });
}

// Close everything, go home, swing the right door open and highlight the item.
function revealItem(id) {
  const it = state.items.find(i => i.id === id);
  const sec = it && sectionById(it.sectionId);
  if (!sec) return;
  closeSheetsAll();
  closeOverlays();
  const r = kitchen.roomOfZone(sec.zone.id);
  if (r >= 0) kitchen.showRoom(r);
  go('kitchen', {}, { animate: false });
  setTimeout(() => {
    const slot = document.querySelector(`[data-zone="${sec.zone.id}"]`);
    if (slot) {
      slot.scrollIntoView({ block: 'center', behavior: 'smooth' });
      slot.classList.add('highlight');
      setTimeout(() => { slot.classList.remove('highlight'); slot.classList.add('opening'); }, 1100);
      setTimeout(() => { kitchen.openZone(sec.zone.id, { origin: slot, highlight: id, section: sec.id }); setTimeout(() => slot.classList.remove('opening'), 400); }, 1500);
    } else kitchen.openZone(sec.zone.id, { highlight: id, section: sec.id });
  }, 320);
}
function closeSheetsAll() { while (sheetOpen()) closeSheet(); }

register({
  go: (v, p) => go(v, p),
  current: () => current,
  openRecipe: id => recipes.openRecipe(id),
  openItem: id => showItem(id),
  openZone: (z, o) => kitchen.openZone(z, o),
  addItem: o => addFlow(o),
  openEvent: id => plan.openEvent(id),
  revealItem,
  tour: () => tour(),
  quickAdd: p => addItem(p),
  addToListFrom: (x, el) => { const ok = addToList({ ...x }); flyTo(el, '.tab[data-v=list]', x.emoji || '🛒'); haptic(); toast(ok ? `${x.name} → list` : 'Already on your list', { icon: '🛒' }); },
});
window.larder = actions;

// Hardware back (Android wrapper calls this; returns true if something was closed).
window.larderBack = () => {
  if (document.querySelector('.welcome, .tour-tip')) return true;
  if (sheetOpen()) { closeSheet(); return true; }
  const ins = document.querySelector('.inside'); if (ins) { ins._close?.(); return true; }
  if (current !== 'kitchen') { go('kitchen'); return true; }
  return false;
};
history.pushState(null, '', location.href);
window.addEventListener('popstate', () => { if (window.larderBack()) history.pushState(null, '', location.href); });

window.addEventListener('resize', placeGlow);
document.documentElement.dataset.wood = state.settings.wood;
subscribe(() => { document.documentElement.dataset.wood = state.settings.wood; });

// ---------- boot ----------
(async () => {
  go('kitchen', {}, { animate: false });
  startSync();
  if (!state.settings.onboarded) {
    const sample = await welcome();
    go('kitchen');
    setTimeout(() => tour(), 450);
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.hostname.match(/^(localhost|127\.)/)) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
