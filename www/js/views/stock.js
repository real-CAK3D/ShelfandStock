// Everything you have, filterable by place, aisle and freshness.

import { state, itemStatus, isLow, fmtQty, adjustQty, catOf, sectionById, daysBetween, today, tint } from '../store.js';
import { CATEGORIES } from '../data/foods.js';
import { esc, icon, $, $$, segmented, imgOrEmoji, haptic, toast } from '../ui/dom.js';
import { showItem, crumb, labelWalk } from '../ui/itemSheet.js';

const ui = { q: '', zone: 'all', cat: 'all', status: 'all', group: 'zone' };

export function render(root, params = {}) {
  Object.assign(ui, params);
  root.innerHTML = `
    <div class="search" data-tour="stock-search">${icon('search')}<input class="input" placeholder="Where's the cinnamon?" value="${esc(ui.q)}" data-q></div>
    <div class="chips" data-zones></div>
    <div class="chips" data-cats></div>
    <div style="margin:6px 12px 0"><div class="seg" data-status>${[['all', 'All'], ['expiring', 'Use soon'], ['low', 'Low'], ['undated', 'Undated']].map(([v, l]) => `<button data-v="${v}" class="${ui.status === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="row" style="margin:10px 16px 0;justify-content:space-between">
      <span class="small muted" data-summary></span>
      <div class="row" style="gap:6px"><span class="small muted">Group</span><select class="input" style="height:34px;width:auto;font-size:13px;padding:0 10px" data-group>${[['zone', 'Location'], ['cat', 'Aisle'], ['exp', 'Expiry']].map(([v, l]) => `<option value="${v}" ${ui.group === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="list" data-list></div>`;
  const q = $('[data-q]', root);
  q.oninput = () => { ui.q = q.value; draw(root); };
  segmented($('[data-status]', root), v => { ui.status = v; draw(root); });
  $('[data-group]', root).onchange = e => { ui.group = e.target.value; draw(root); };
  root.onclick = e => {
    const z = e.target.closest('[data-zone]'); if (z) { ui.zone = z.dataset.zone; haptic(); return draw(root); }
    const c = e.target.closest('[data-cat]'); if (c) { ui.cat = c.dataset.cat; haptic(); return draw(root); }
    const st = e.target.closest('[data-step]');
    if (st) { e.stopPropagation(); haptic(); const it = state.items.find(i => i.id === st.dataset.id); adjustQty(st.dataset.id, Number(st.dataset.step) * ((['lb', 'gal', 'dozen'].includes(it.unit)) ? .5 : 1)); return; }
    if (e.target.closest('[data-labelall]')) return labelWalk(filtered().map(i => i.id), { title: 'Label these' });
    const row = e.target.closest('[data-item]'); if (row) return showItem(row.dataset.item);
  };
  draw(root);
}

function filtered() {
  const q = ui.q.trim().toLowerCase();
  return state.items.filter(i => {
    if (ui.zone !== 'all' && sectionById(i.sectionId)?.zone.id !== ui.zone) return false;
    if (ui.cat !== 'all' && i.cat !== ui.cat) return false;
    const st = itemStatus(i).key;
    if (ui.status === 'expiring' && !['expired', 'today', 'soon'].includes(st)) return false;
    if (ui.status === 'low' && !(isLow(i) || Number(i.qty) === 0)) return false;
    if (ui.status === 'undated' && (i.dated || (i.dateType && i.dateType !== 'Estimated'))) return false;
    if (q && !(`${i.name} ${i.brand} ${(i.tags || []).join(' ')} ${crumb(i)} ${catOf(i.cat).name}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

function draw(root) {
  const zc = {}; state.items.forEach(i => { const z = sectionById(i.sectionId)?.zone.id; zc[z] = (zc[z] || 0) + 1; });
  $('[data-zones]', root).innerHTML = `<button class="chip ${ui.zone === 'all' ? 'on' : ''}" data-zone="all">🏠 Everywhere</button>` + state.zones.map(z => `<button class="chip ${ui.zone === z.id ? 'on' : ''}" data-zone="${z.id}">${{ fridge: '🧊', freezer: '❄️', pantry: '🚪', counter: '🍌', holiday: '🎁' }[z.kind] || '🗄️'} ${esc(z.name)} <span class="n">${zc[z.id] || 0}</span></button>`).join('');
  const used = new Set(state.items.map(i => i.cat));
  $('[data-cats]', root).innerHTML = `<button class="chip ${ui.cat === 'all' ? 'on' : ''}" data-cat="all">All aisles</button>` + CATEGORIES.filter(c => used.has(c.id)).map(c => `<button class="chip ${ui.cat === c.id ? 'on' : ''}" data-cat="${c.id}" style="--tint:${c.color}"><span class="cdot"></span>${c.emoji} ${esc(c.name)}</button>`).join('');
  $$('.chips', root).forEach(ch => ch.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }));

  const list = filtered();
  $('[data-summary]', root).textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
  const groups = new Map();
  const keyOf = i => {
    if (ui.group === 'cat') return [i.cat, `${catOf(i.cat).emoji} ${catOf(i.cat).name}`];
    if (ui.group === 'exp') {
      const d = i.expires ? daysBetween(today(), i.expires) : null;
      return d == null ? ['z', 'No date'] : d < 0 ? ['a', '⚠️ Expired'] : d <= 3 ? ['b', '⏰ Next 3 days'] : d <= 7 ? ['c', 'This week'] : d <= 30 ? ['d', 'This month'] : ['e', 'Later'];
    }
    const s = sectionById(i.sectionId); return [s?.zone.id || 'zz', s ? s.zone.name : 'Unsorted'];
  };
  for (const i of list) { const [k, label] = keyOf(i); if (!groups.has(k)) groups.set(k, { label, items: [] }); groups.get(k).items.push(i); }
  const order = [...groups.keys()].sort((a, b) => ui.group === 'zone' ? state.zones.findIndex(z => z.id === a) - state.zones.findIndex(z => z.id === b) : a < b ? -1 : 1);
  const el = $('[data-list]', root);
  if (!list.length) {
    el.innerHTML = `<div class="empty"><span class="big">${ui.q ? '🔍' : '🧺'}</span>${ui.q ? `No “${esc(ui.q)}” in your kitchen.<br><button class="btn btn-brass" style="margin-top:14px" data-addq>Add it</button>` : 'Nothing matches these filters.'}</div>`;
    el.querySelector('[data-addq]')?.addEventListener('click', () => window.larder.addItem({ query: ui.q }));
    return;
  }
  el.innerHTML = (ui.status === 'undated' ? `<button class="where-banner" style="width:100%;text-align:left" data-labelall>🏷️ <span class="grow"><b>Label these ${list.length}</b> — read the dates off the packages one by one.</span>${icon('next')}</button>` : '') +
    order.map(k => { const g = groups.get(k); return `<div class="group-h">${esc(g.label)} <span class="n">${g.items.length}</span><span class="line"></span></div><div class="stagger">${g.items.sort((a, b) => a.name.localeCompare(b.name)).map(row).join('')}</div>`; }).join('');
}

function row(i) {
  const st = itemStatus(i);
  const low = isLow(i) || Number(i.qty) === 0;
  return `<div class="irow" data-item="${i.id}" role="button" tabindex="0" style="${tint(i.cat)}">
    <span class="em">${imgOrEmoji(i, '')}</span>
    <span class="t"><b>${esc(i.name)}${i.batches?.length ? ` <span class="pill" style="font-size:10px">${i.batches.length} batches</span>` : ''}</b><small>📍 ${esc(crumb(i))}</small>
      <span class="row" style="gap:4px;margin-top:3px">${st.label ? `<span class="pill ${st.key}">${st.label}</span>` : ''}${low ? `<span class="pill low">${Number(i.qty) === 0 ? 'Out' : 'Low'}</span>` : ''}${i.opened ? '<span class="pill">Opened</span>' : ''}</span></span>
    <span class="mini-step"><button data-step="-1" data-id="${i.id}" aria-label="Less">−</button><span>${fmtQty(i.qty)} <small class="muted">${esc(i.unit)}</small></span><button data-step="1" data-id="${i.id}" aria-label="More">+</button></span>
  </div>`;
}
