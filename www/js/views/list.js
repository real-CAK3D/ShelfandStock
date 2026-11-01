// Shopping list: tick things off in the store, then "put away" to move them into the kitchen
// and read their real dates off the packages.

import { state, update, addToList, checkOffToStock, suggestions, catOf, fmtQty, sectionById, tint, activeTrips, priceInfo, money, myTripStore, storeName, aisleAt, setAisle, aisleOrder } from '../store.js';
import { currentStore, storeEmoji, storeSearchUrl } from '../services/stores.js';
import { CATEGORIES, searchFoods, FOOD_BY_ID } from '../data/foods.js';
import { esc, attr, icon, $, $$, toast, haptic, confetti, flyTo, openSheet, confirmBox } from '../ui/dom.js';
import { labelWalk, dateSheet } from '../ui/itemSheet.js';
import { actions } from '../router.js';
import { tripBannerHTML, tripSheet, tripDetail, liveStripHTML } from '../ui/house.js';
import { receiptFlow } from '../ui/receipt.js';
import { me, memberById, firstName, avatar } from '../services/people.js';
import { recallMatches, recallSheet } from '../services/recalls.js';
import { unitPriceSheet } from '../ui/unitprice.js';
import { inSeason } from '../data/inseason.js';
import { recipeEditor } from './recipes.js';

const ORDER = CATEGORIES.map(c => c.id);
let morePerish = false, moreRestock = false; // the suggestion lists start short

export function render(root) {
  const open = state.shopping;
  const done = open.filter(x => x.done);
  const groups = {};
  for (const e of open) (groups[e.cat] ||= []).push(e);
  // By store: a section per store (where each thing is usually bought), "Anywhere" for the rest, aisles in order inside.
  // By aisle: the old way. Defaults to by store once anything on the list has a store.
  const byStore = (state.settings.listGroup || (open.some(e => e.store) ? 'store' : 'aisle')) === 'store';
  const aisleSort = (x, y) => (ORDER.indexOf(x.cat) + 99 * (ORDER.indexOf(x.cat) < 0)) - (ORDER.indexOf(y.cat) + 99 * (ORDER.indexOf(y.cat) < 0));
  const sections = byStore
    ? [...new Set(open.map(e => storeName(e.store)))].sort((x, y) => !x ? 1 : !y ? -1 : open.filter(e => e.store === y).length - open.filter(e => e.store === x).length || x.localeCompare(y))
        .map(st => { const items = open.filter(e => storeName(e.store) === st).sort((x, y) => { const a = aisleOrder(x.aisle), b2 = aisleOrder(y.aisle); return a[0] - b2[0] || a[1] - b2[1] || a[2].localeCompare(b2[2]) || aisleSort(x, y); }); return { name: st || 'Anywhere', emoji: st ? storeEmoji(st) : '🛒', items, total: st ? Math.round(items.reduce((a, e) => a + (priceInfo(e.foodId, e.name).byStore.find(p => p.store === st)?.price || 0) * (Number(e.qty) || 1), 0) * 100) / 100 : 0 }; })
    : ORDER.filter(c => groups[c]).concat(Object.keys(groups).filter(c => !ORDER.includes(c))).map(c => ({ name: catOf(c).name, emoji: catOf(c).emoji, items: groups[c], total: 0 }));
  const what = e => [e.brand, e.kind, e.size].filter(Boolean).join(' · ');
  const row = e => `<div class="lrow ${e.done ? 'done' : ''}" data-id="${e.id}">
          <button class="cb" data-check="${e.id}" aria-label="Check ${attr(e.name)}">${icon('check')}</button>
          <span class="lt" style="${tint(e.cat)}"><b><span class="lem">${e.emoji}</span>${esc(e.name)}${recalled.has(e.id) ? ' <span class="pill bad" title="Possible recall">⚠️ recall</span>' : ''}</b>${what(e) || e.aisle ? `<small class="l-what">${e.aisle ? `<span class="aisle-pill">${/^\d/.test(e.aisle) ? 'Aisle ' : ''}${esc(e.aisle)}</span> ` : ''}${esc(what(e))}</small>` : ''}${e.reasons?.length || e.by ? `<small>${e.by ? `<span class="by">${avatar(memberById(e.by), 16)} ${esc(firstName(e.by))}</span>${e.reasons?.length ? ' · ' : ''}` : ''}${esc((e.reasons || []).join(' · '))}</small>` : ''}
          ${byStore ? '' : `<button class="l-store" data-setstore="${e.id}">${e.store ? `${storeEmoji(e.store)} ${esc(e.store)}` : '＋ store'}</button>`}${byStore ? `<button class="l-store" data-setstore="${e.id}" aria-label="Move to another store">⇄</button>` : ''}</span>
          <span class="lq">${fmtQty(e.qty)} ${esc(e.unit)}${(() => { const pi = priceInfo(e.foodId, e.name), here = e.store && pi.byStore.find(p => p.store === e.store), c = pi.cheapest; return here ? `<small style="display:block;font-size:11px;color:var(--sage)">${money(here.price)}${c && c.store !== e.store && c.price < here.price ? ` · ${money(c.price)} ${esc(c.store)}` : ''}</small>` : c ? `<small style="display:block;font-size:11px;color:var(--sage)">${money(c.price)} ${esc(c.store)}</small>` : ''; })()}</span>
          <button class="icon-btn" style="width:32px;height:32px;color:var(--ink-3);background:none;border:0" data-del="${e.id}" aria-label="Remove">${icon('close')}</button>
        </div>`;
  const sugg = suggestions();

  const mineTrip = activeTrips().find(t => t.by === me()?.id);
  const perish = sugg.filter(x => x.kind === 'perish' || x.kind === 'few'), restock = sugg.filter(x => !x.kind);
  const recalls = recallMatches(), recalled = new Set(recalls.flatMap(r => r.hits.filter(h => h.it.where === 'list').map(h => h.it.id)));
  const onList = new Set(open.filter(e => !e.done).map(e => e.foodId));
  const season = inSeason().map(id => FOOD_BY_ID[id]).filter(f => f && !onList.has(f.id));
  const suggRow = s => `<div class="sugg" style="${tint(FOOD_BY_ID[s.foodId]?.cat)}"><span class="em" style="width:40px;height:40px;border-radius:11px;display:grid;place-items:center">${s.emoji}</span><span class="t"><b>${esc(s.name)}</b><small>${s.icon} ${esc(s.reason)}</small></span><button class="btn btn-ghost btn-sm" data-sugg="${sugg.indexOf(s)}">${icon('plus')}</button></div>`;
  root.innerHTML = `
    ${tripBannerHTML()}
    <div data-live>${liveStripHTML()}</div>
    <div class="row" style="margin:12px 12px 0;gap:8px">${mineTrip ? '' : `<button class="btn btn-wood wood-mid grow" data-trip-new>🚗 I'm going to the store</button>`}<button class="btn btn-ghost ${mineTrip ? 'grow' : ''}" data-receipt>🧾${mineTrip ? ' Scan receipt' : ''}</button></div>
    <div class="row" style="margin:8px 12px 0;gap:8px"><button class="btn btn-ghost btn-sm grow" data-unitprice>⚖️ Which is cheaper?</button><button class="btn btn-ghost btn-sm grow" data-recipephoto>📖 Recipe photo</button><button class="btn btn-ghost btn-sm grow ${recalls.length ? 'recall-btn' : ''}" data-recalls>🛡️ ${recalls.length ? `${recalls.length} recall${recalls.length > 1 ? 's' : ''} to check` : 'Recalls'}</button></div>
    <div class="addbar" data-tour="list-add"><input class="input" placeholder="Add to list… (e.g. 2 lb apples)" data-new list="food-dl"><button class="btn btn-brass" data-addnew aria-label="Add">${icon('plus')}</button></div>
    <datalist id="food-dl"></datalist>
    ${sugg.length ? `<div class="chips" style="margin-top:8px">${sugg.slice(0, 8).map(x => `<button class="chip" data-sugg="${sugg.indexOf(x)}" title="${attr(x.reason)}">${x.emoji} ${esc(x.name)} <span class="n">${x.icon}</span></button>`).join('')}</div>` : ''}
    ${done.length ? `<div style="margin:12px 12px 0"><button class="btn btn-sage btn-block" data-putaway>📦 Put away ${done.length} item${done.length > 1 ? 's' : ''} &amp; date them</button></div>` : ''}
    <div class="notepad-top wood-dark" style="margin-top:14px"></div>
    <div class="notepad" style="margin-top:0">
      ${open.length ? `<div class="seg seg-sm list-group" style="margin:6px 16px 6px 56px;width:auto" data-listgroup><button class="${byStore ? 'on' : ''}" data-v="store">🏪 By store</button><button class="${byStore ? '' : 'on'}" data-v="aisle">🥬 By aisle</button></div>` : ''}
      ${open.length ? sections.map(sec => `
        <div class="group-h list-sec" style="margin:4px 16px 2px 56px">${sec.emoji} ${esc(sec.name)} <span class="n">${sec.items.length}</span>${sec.total ? `<span class="sec-total">≈ ${money(sec.total)}</span>` : ''}</div>
        ${sec.items.map(row).join('')}`).join('') : `<div class="empty"><span class="big">📝</span>Your list is empty.<br><span class="small">Add things above, or grab suggestions below.</span></div>`}
    </div>
    ${open.length ? `<div class="row" style="margin:0 12px;gap:8px"><button class="btn btn-ghost grow btn-sm" data-receipt>🧾 Scan receipt</button><button class="btn btn-ghost grow btn-sm" data-share>${icon('share')} Share list</button><button class="btn btn-ghost grow btn-sm" data-clear>${icon('trash')} Clear all</button></div>` : ''}
    ${perish.length ? `<div class="section-title"><h2>Pick up while you're out</h2></div><p class="small muted" style="margin:-6px 16px 8px">Going bad soon or down to the last one.</p><div class="stagger">${(morePerish ? perish : perish.slice(0, 5)).map(suggRow).join('')}</div>${perish.length > 5 ? `<button class="btn btn-ghost btn-sm btn-block" style="width:auto;margin:0 12px" data-moreperish>${morePerish ? 'Show fewer' : `Show all ${perish.length}`}</button>` : ''}` : ''}
    ${season.length ? `<div class="section-title"><h2>🌱 In season now</h2></div><p class="small muted" style="margin:-6px 16px 8px">Usually cheaper and tastier this month. Tap to add.</p><div class="chips" data-tour="season">${season.slice(0, 14).map(f => `<button class="chip" data-season-add="${f.id}" style="${tint(f.cat)}">${f.emoji} ${esc(f.name)}</button>`).join('')}</div>` : ''}
    ${restock.length ? `<div class="section-title"><h2>You should get</h2><button class="link" data-addall>Add all</button></div><div class="stagger">${(moreRestock ? restock : restock.slice(0, 6)).map(suggRow).join('')}</div>${restock.length > 6 ? `<button class="btn btn-ghost btn-sm btn-block" style="width:auto;margin:0 12px 16px" data-morerestock>${moreRestock ? 'Show fewer' : `Show all ${restock.length}`}</button>` : ''}` : ''}
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
      update(s => { const x = s.shopping.find(y => y.id === id); if (x) { x.done = !x.done; x.boughtAt = x.done ? currentStore()?.name || myTripStore() || x.store || '' : ''; } }, 'list-check');
      return;
    }
    const lg = e.target.closest('[data-listgroup] [data-v]'); if (lg) { haptic(); return update(s => { s.settings.listGroup = lg.dataset.v; }); }
    const ss = e.target.closest('[data-setstore]'); if (ss) return storePicker(ss.dataset.setstore);
    const del = e.target.closest('[data-del]');
    if (del) { const row = del.closest('.lrow'); row.classList.add('leaving'); setTimeout(() => update(s => { s.shopping = s.shopping.filter(x => x.id !== del.dataset.del); }, 'list-del'), 300); return; }
    if (e.target.closest('[data-putaway]')) return putAway();
    if (e.target.closest('[data-receipt]')) return receiptFlow();
    if (e.target.closest('[data-moreperish]')) { morePerish = !morePerish; return render(root); }
    if (e.target.closest('[data-morerestock]')) { moreRestock = !moreRestock; return render(root); }
    if (e.target.closest('[data-unitprice]')) return unitPriceSheet();
    if (e.target.closest('[data-recipephoto]')) return recipeEditor({ fromPhoto: true }); // read a recipe, add what's missing
    if (e.target.closest('[data-recalls]')) return recallSheet();
    const sa = e.target.closest('[data-season-add]'); if (sa) { const f = FOOD_BY_ID[sa.dataset.seasonAdd]; addToList({ foodId: f.id, name: f.name, reason: 'In season' }); haptic(); toast(`${f.name} → list`, { icon: '🌱' }); return; }
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

// Move a list entry to a store's section (or Anywhere); a new store name can be typed in.
function storePicker(id) {
  const e = state.shopping.find(x => x.id === id); if (!e) return;
  const pi = priceInfo(e.foodId, e.name);
  const names = [...new Set([...(state.stores || []).map(x => x.name), ...(state.prices || []).map(p => p.store), ...state.shopping.map(x => x.store)].map(storeName).filter(Boolean))];
  openSheet({
    title: `Where to get ${esc(e.name)}`,
    html: `${names.map(n => { const p = pi.byStore.find(x => x.store === n); return `<button class="irow" style="width:100%;text-align:left" data-pick="${attr(n)}"><span class="em">${storeEmoji(n)}</span><span class="t"><b>${esc(n)}</b>${p ? `<small>${money(p.price)} last time${pi.cheapest?.store === n && pi.byStore.length > 1 ? ' · cheapest' : ''}</small>` : ''}</span>${e.store === n ? icon('check') : ''}</button>`; }).join('')}
      <button class="irow" style="width:100%;text-align:left" data-pick=""><span class="em">🛒</span><span class="t"><b>Anywhere</b></span>${!e.store ? icon('check') : ''}</button>
      <div class="row" style="gap:8px;margin-top:8px"><input class="input grow" data-newstore placeholder="Another store…"><button class="btn btn-brass" data-addstore>${icon('plus')}</button></div>
      ${e.store ? `<div class="group-h">At ${esc(storeName(e.store))}<span class="line"></span></div>
        <div class="row" style="gap:8px"><label class="field grow" style="margin:0"><span>Aisle</span><input class="input" data-aisle value="${attr(e.aisle || '')}" placeholder="7, A12, Dairy…"></label><button class="btn btn-ghost" data-saveaisle style="align-self:flex-end">Save</button></div>
        <a class="btn btn-wood wood-mid btn-block" style="margin-top:10px" href="${attr(storeSearchUrl(e.store, e))}" target="_blank" rel="noopener">${storeEmoji(e.store)} Look it up at ${esc(storeName(e.store))}</a>
        <p class="small muted" style="margin:6px 2px 0">Opens ${esc(storeName(e.store))}'s own app or site: the real aisle and today's price. Note the aisle here and it's remembered for next time.</p>` : ''}`,
    onMount: (b, close) => {
      const set = n => { const st = storeName(n); update(s => { const x = s.shopping.find(y => y.id === id); if (x) { x.store = st; x.aisle = aisleAt(st, x.foodId, x.name); } }, 'list-store'); haptic(); close(); };
      b.querySelector('[data-saveaisle]')?.addEventListener('click', () => { setAisle(e.store, e.foodId, e.name, b.querySelector('[data-aisle]').value); update(s => { const x = s.shopping.find(y => y.id === id); if (x) x.aisle = b.querySelector('[data-aisle]').value.trim(); }, 'aisle'); toast('Aisle saved', { icon: '🧭' }); close(); });
      b.querySelectorAll('[data-pick]').forEach(x => x.onclick = () => set(x.dataset.pick));
      b.querySelector('[data-addstore]').onclick = () => { const n = b.querySelector('[data-newstore]').value.trim(); if (n) set(n); };
    },
  });
}

function putAway() {
  const done = state.shopping.filter(x => x.done);
  const placed = done.map(e => checkOffToStock(e.id, { store: e.boughtAt || '' })).filter(Boolean);
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
  const byStore = state.settings.listGroup !== 'aisle';
  for (const e of state.shopping.filter(x => !x.done)) (groups[byStore && e.store ? e.store : byStore ? 'Anywhere' : catOf(e.cat).name] ||= []).push(`☐ ${e.name}${[e.brand, e.kind, e.size].filter(Boolean).length ? ` (${[e.brand, e.kind, e.size].filter(Boolean).join(', ')})` : ''} — ${fmtQty(e.qty)} ${e.unit}`);
  const text = '🛒 Shelf & Stock shopping list\n\n' + Object.entries(groups).map(([k, v]) => `${k}\n${v.join('\n')}`).join('\n\n');
  try {
    if (window.LarderNative?.share) window.LarderNative.share(text);
    else if (navigator.share) await navigator.share({ title: 'Shopping list', text });
    else { await navigator.clipboard.writeText(text); toast('List copied to clipboard', { icon: '📋' }); }
  } catch { }
}
