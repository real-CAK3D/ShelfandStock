// Shopping list: tick things off in the store, then "put away" to move them into the kitchen
// and read their real dates off the packages.

import { state, update, addToList, checkOffToStock, suggestions, catOf, fmtQty, sectionById, tint, activeTrips } from '../store.js';
import { CATEGORIES, searchFoods, FOOD_BY_ID } from '../data/foods.js';
import { esc, attr, icon, $, $$, toast, haptic, confetti, flyTo, openSheet, confirmBox } from '../ui/dom.js';
import { labelWalk, dateSheet } from '../ui/itemSheet.js';
import { actions } from '../router.js';
import { tripBannerHTML, tripSheet, tripDetail, liveStripHTML } from '../ui/house.js';
import { me, memberById, firstName, avatar } from '../services/people.js';

const ORDER = CATEGORIES.map(c => c.id);

export function render(root) {
  const open = state.shopping;
  const done = open.filter(x => x.done);
  const groups = {};
  for (const e of open) (groups[e.cat] ||= []).push(e);
  const sugg = suggestions();

  const mineTrip = activeTrips().find(t => t.by === me()?.id);
  const perish = sugg.filter(x => x.kind === 'perish' || x.kind === 'few'), restock = sugg.filter(x => !x.kind);
  const suggRow = s => `<div class="sugg" style="${tint(FOOD_BY_ID[s.foodId]?.cat)}"><span class="em" style="width:40px;height:40px;border-radius:11px;display:grid;place-items:center">${s.emoji}</span><span class="t"><b>${esc(s.name)}</b><small>${s.icon} ${esc(s.reason)}</small></span><button class="btn btn-ghost btn-sm" data-sugg="${sugg.indexOf(s)}">${icon('plus')}</button></div>`;
  root.innerHTML = `
    ${tripBannerHTML()}
    <div data-live>${liveStripHTML()}</div>
    ${mineTrip ? '' : `<div style="margin:12px 12px 0"><button class="btn btn-wood wood-mid btn-block" data-trip-new>🚗 I'm going to the store</button></div>`}
    <div class="addbar" data-tour="list-add"><input class="input" placeholder="Add to list… (e.g. 2 lb apples)" data-new list="food-dl"><button class="btn btn-brass" data-addnew aria-label="Add">${icon('plus')}</button></div>
    <datalist id="food-dl"></datalist>
    ${sugg.length ? `<div class="chips" style="margin-top:8px">${sugg.slice(0, 8).map(x => `<button class="chip" data-sugg="${sugg.indexOf(x)}" title="${attr(x.reason)}">${x.emoji} ${esc(x.name)} <span class="n">${x.icon}</span></button>`).join('')}</div>` : ''}
    ${done.length ? `<div style="margin:12px 12px 0"><button class="btn btn-sage btn-block" data-putaway>📦 Put away ${done.length} item${done.length > 1 ? 's' : ''} &amp; date them</button></div>` : ''}
    <div class="notepad-top wood-dark" style="margin-top:14px"></div>
    <div class="notepad" style="margin-top:0">
      ${open.length ? ORDER.filter(c => groups[c]).concat(Object.keys(groups).filter(c => !ORDER.includes(c))).map(c => `
        <div class="group-h" style="margin:4px 16px 2px 56px">${catOf(c).emoji} ${esc(catOf(c).name)} <span class="n">${groups[c].length}</span></div>
        ${groups[c].map(e => `<div class="lrow ${e.done ? 'done' : ''}" data-id="${e.id}">
          <button class="cb" data-check="${e.id}" aria-label="Check ${attr(e.name)}">${icon('check')}</button>
          <span class="lt" style="${tint(e.cat)}"><b><span class="lem">${e.emoji}</span>${esc(e.name)}</b>${e.reasons?.length || e.by ? `<small>${e.by ? `<span class="by">${avatar(memberById(e.by), 16)} ${esc(firstName(e.by))}</span>${e.reasons?.length ? ' · ' : ''}` : ''}${esc((e.reasons || []).join(' · '))}</small>` : ''}</span>
          <span class="lq">${fmtQty(e.qty)} ${esc(e.unit)}</span>
          <button class="icon-btn" style="width:32px;height:32px;color:var(--ink-3);background:none;border:0" data-del="${e.id}" aria-label="Remove">${icon('close')}</button>
        </div>`).join('')}`).join('') : `<div class="empty"><span class="big">📝</span>Your list is empty.<br><span class="small">Add things above, or grab suggestions below.</span></div>`}
    </div>
    ${open.length ? `<div class="row" style="margin:0 12px;gap:8px"><button class="btn btn-ghost grow btn-sm" data-share>${icon('share')} Share list</button><button class="btn btn-ghost grow btn-sm" data-clear>${icon('trash')} Clear all</button></div>` : ''}
    ${perish.length ? `<div class="section-title"><h2>Pick up while you're out</h2></div><p class="small muted" style="margin:-6px 16px 8px">Going bad soon or down to the last one.</p><div class="stagger">${perish.map(suggRow).join('')}</div>` : ''}
    ${restock.length ? `<div class="section-title"><h2>You should get</h2><button class="link" data-addall>Add all</button></div><div class="stagger">${restock.map(suggRow).join('')}</div>` : ''}
  `;

  const inp = $('[data-new]', root);
  inp.oninput = () => { $('#food-dl', root).innerHTML = searchFoods(inp.value, 8).map(f => `<option value="${attr(f.name)}">`).join(''); };
  const addNew = () => {
    const v = inp.value.trim(); if (!v) return;
    const m = v.match(/^(\d*\.?\d+)\s*(lb|lbs|oz|gal|dozen|ea|can|cans|bag|bags|box|jar|pack|bottle)?\s+(.+)$/i);
    const added = m ? addToList({ name: m[3], qty: Number(m[1]), unit: m[2] ? m[2].toLowerCase().replace(/s$/, '') : undefined }) : addToList({ name: v });
    haptic(); toast(added ? 'Added' : 'Already on the list — bumped the amount', { icon: '📝' });
    setTimeout(() => $('[data-new]')?.focus(), 50);
  };
  $('[data-addnew]', root).onclick = addNew;
  inp.onkeydown = e => { if (e.key === 'Enter') addNew(); };

  root.onclick = async e => {
    const cb = e.target.closest('[data-check]');
    if (cb) {
      const id = cb.dataset.check;
      haptic(15);
      update(s => { const x = s.shopping.find(y => y.id === id); if (x) x.done = !x.done; }, 'list-check');
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) { const row = del.closest('.lrow'); row.classList.add('leaving'); setTimeout(() => update(s => { s.shopping = s.shopping.filter(x => x.id !== del.dataset.del); }, 'list-del'), 300); return; }
    if (e.target.closest('[data-putaway]')) return putAway();
    if (e.target.closest('[data-trip-new]')) return tripSheet();
    const tr = e.target.closest('[data-trip]'); if (tr) return tripDetail(tr.dataset.trip, () => { if (state.shopping.some(x => x.done)) putAway(); else toast('Tick off what you bought, then tap Put away', { icon: '🛒' }); });
    const sg = e.target.closest('[data-sugg]');
    if (sg) { const s = sugg[Number(sg.dataset.sugg)]; addToList({ ...s, reason: s.reason }); haptic(); (sg.closest('.sugg') || sg).animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(-40px)' }], { duration: 250 }); return; }
    if (e.target.closest('[data-addall]')) { restock.forEach(s => addToList({ ...s })); haptic(20); toast(`${restock.length} added`, { icon: '🛒' }); return; }
    if (e.target.closest('[data-share]')) return shareList();
    if (e.target.closest('[data-clear]')) { if (await confirmBox('Clear the whole shopping list?', { ok: 'Clear', danger: true })) update(s => { s.shopping = []; }, 'list-clear'); }
  };

  // swipe right = check, swipe left = remove
  $$('.lrow', root).forEach(row => {
    let x0 = null, dx = 0;
    row.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; dx = 0; row.style.transition = 'none'; }, { passive: true });
    row.addEventListener('touchmove', e => { if (x0 == null) return; dx = e.touches[0].clientX - x0; if (Math.abs(dx) > 10) row.style.transform = `translateX(${dx}px)`; row.style.background = dx > 40 ? 'var(--sage-2)' : dx < -40 ? 'var(--tomato-2)' : ''; }, { passive: true });
    row.addEventListener('touchend', () => {
      row.style.transition = ''; row.style.background = '';
      const id = row.dataset.id;
      if (dx > 90) { row.style.transform = ''; update(s => { const x = s.shopping.find(y => y.id === id); if (x) x.done = true; }, 'list-check'); haptic(15); }
      else if (dx < -90) { row.classList.add('leaving'); setTimeout(() => update(s => { s.shopping = s.shopping.filter(x => x.id !== id); }, 'list-del'), 300); haptic(15); }
      else row.style.transform = '';
      x0 = null;
    });
  });
}

function putAway() {
  const done = state.shopping.filter(x => x.done);
  const placed = done.map(e => checkOffToStock(e.id)).filter(Boolean);
  confetti(innerWidth / 2, innerHeight * .4, 40);
  flyTo($('[data-putaway]'), '.tab[data-v=kitchen]', '📦');
  const ids = placed.map(p => p.item.id);
  openSheet({
    title: 'Put away! 📦',
    html: `<p class="muted" style="margin-top:0">${placed.length} item${placed.length > 1 ? 's are' : ' is'} in your kitchen with <b>estimated</b> dates. Want to read the real dates off the packages now?</p>
      ${placed.map(p => { const s = sectionById(p.item.sectionId); return `<div class="irow"><span class="em">${p.item.emoji}</span><span class="t"><b>${esc(p.item.name)}</b><small>📍 ${s ? esc(s.zone.name + ' › ' + s.name) : ''}</small></span><button class="btn btn-ghost btn-sm" data-one="${p.item.id}" data-b="${p.batchId || ''}">📅</button></div>`; }).join('')}
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn btn-ghost grow" data-later>Later</button><button class="btn btn-brass grow" data-walk>🏷️ Date them now</button></div>`,
    onMount: (b, close) => {
      $('[data-later]', b).onclick = () => { close(); toast('Find them anytime under Stock › Undated', { icon: '🏷️' }); };
      $('[data-walk]', b).onclick = () => { close(); labelWalk(ids, { title: 'Date your groceries' }); };
      $$('[data-one]', b).forEach(x => x.onclick = () => dateSheet(x.dataset.one, x.dataset.b || null));
    },
  });
}

async function shareList() {
  const groups = {};
  for (const e of state.shopping.filter(x => !x.done)) (groups[catOf(e.cat).name] ||= []).push(`☐ ${e.name} — ${fmtQty(e.qty)} ${e.unit}`);
  const text = '🛒 Shelf & Stock shopping list\n\n' + Object.entries(groups).map(([k, v]) => `${k}\n${v.join('\n')}`).join('\n\n');
  try {
    if (window.LarderNative?.share) window.LarderNative.share(text);
    else if (navigator.share) await navigator.share({ title: 'Shopping list', text });
    else { await navigator.clipboard.writeText(text); toast('List copied to clipboard', { icon: '📋' }); }
  } catch { }
}
