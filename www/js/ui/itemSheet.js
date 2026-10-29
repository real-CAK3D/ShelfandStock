// Item detail, editor, and the add-item flow (catalog search, barcode scan, label lookup).

import { state, makeItem, addItem, saveItem, removeItem, adjustQty, addToList, sectionById, itemStatus, isLow, fmtDate, fmtQty, catOf, allRecipes, recipeMatch, today, addDays, shelfLifeDays, storageKind, restockItem, setBatchDate, removeBatch, DATE_TYPES, span } from '../store.js';
import { FOOD_BY_ID, CATEGORIES, UNITS, searchFoods, matchFood, FOODS } from '../data/foods.js';
import { openSheet, closeSheet, esc, attr, icon, toast, haptic, confirmBox, segmented, $, $$, imgOrEmoji, confetti } from './dom.js';
import { nutritionLabel, productBadges } from './label.js';
import { lookupBarcode, searchProducts } from '../services/off.js';
import { actions } from '../router.js';

export const crumb = it => { const s = sectionById(it.sectionId); return s ? `${s.zone.name} › ${s.name}` : 'Unsorted'; };

export function locationSelect(selected, name = 'sectionId') {
  return `<select class="input" name="${name}">${state.zones.map(z => `<optgroup label="${attr(z.name)}">${z.sections.map(s => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(z.name)} › ${esc(s.name)}</option>`).join('')}</optgroup>`).join('')}</select>`;
}

// ---------- detail ----------
export function showItem(id) {
  const it = state.items.find(x => x.id === id);
  if (!it) return;
  const st = itemStatus(it);
  const uses = allRecipes().filter(r => r.ingredients.some(i => (it.foodId && (i.foodId || matchFood(i.name)?.id) === it.foodId))).slice(0, 8);
  const sheet = openSheet({
    hero: `<div class="sheet-hero wood-mid">${imgOrEmoji(it)}<h2>${esc(it.name)}</h2>${it.brand ? `<div class="crumb">${esc(it.brand)}</div>` : ''}<div class="crumb">📍 ${esc(crumb(it))}</div></div>`,
    html: `
      <div class="row" style="justify-content:space-between;margin-bottom:12px">
        <div class="stepper"><button data-q="-1" aria-label="Less">−</button><input value="${fmtQty(it.qty)}" readonly aria-label="Quantity"><button data-q="1" aria-label="More">+</button></div>
        <div class="muted" style="font-weight:600">${esc(it.unit)}</div>
        <div class="row" style="gap:6px">${st.label ? `<span class="pill ${st.key}">${st.label}</span>` : ''}${isLow(it) ? '<span class="pill low">Low</span>' : ''}</div>
      </div>
      <div class="row" style="gap:8px;margin-bottom:10px">
        <button class="btn btn-sage grow" data-a="used">${icon('check')} Used it up</button>
        <button class="btn btn-ghost grow" data-a="list">${icon('cart')} Add to list</button>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn btn-ghost btn-sm grow" data-a="edit">${icon('edit')} Edit</button>
        <button class="btn btn-ghost btn-sm grow" data-a="move">${icon('move')} Move</button>
        <button class="btn btn-ghost btn-sm grow" data-a="where">📍 Show me</button>
        <button class="btn btn-danger btn-sm" data-a="toss" title="Tossed / spoiled">${icon('trash')}</button>
      </div>
      <div class="row" style="gap:8px;margin-top:8px">
        <button class="btn btn-wood wood-mid btn-sm grow" data-a="restock">${icon('plus')} Restock</button>
        <button class="btn btn-wood wood-mid btn-sm grow" data-a="date">📅 ${it.dated || (it.dateType && it.dateType !== 'Estimated') ? 'Change date' : 'Set printed date'}</button>
      </div>
      ${batchList(it)}
      <div class="kv">
        <div><small>${esc(it.dateType && it.dateType !== 'Estimated' ? it.dateType : 'Expires (est.)')}</small><b>${it.expires ? fmtDate(it.expires) : 'No date'}</b></div>
        <div><small>Added</small><b>${fmtDate(it.added)}</b></div>
        <div><small>Restock at</small><b>${it.minQty != null && it.minQty !== '' ? `${fmtQty(it.minQty)} ${esc(it.unit)}` : 'Not set'}</b></div>
        <div><small>Category</small><b>${catOf(it.cat).emoji} ${esc(catOf(it.cat).name)}</b></div>
      </div>
      ${it.tags?.length ? `<div class="row wrap" style="gap:6px;margin-bottom:8px">${it.tags.map(t => `<span class="pill">#${esc(t)}</span>`).join('')}</div>` : ''}
      ${it.notes ? `<p style="margin:6px 0 10px;color:var(--ink-2)">📝 ${esc(it.notes)}</p>` : ''}
      ${tipFor(it)}
      ${it.off ? `<h3 style="margin:16px 0 4px">Label</h3>${productBadges(it.off)}${nutritionLabel(it.off)}` : ''}
      ${uses.length ? `<h3 style="margin:16px 0 8px">Cook with it</h3><div class="stagger">${uses.map(r => { const m = recipeMatch(r); return `<button class="irow" style="width:100%;text-align:left" data-r="${r.id}"><span class="em">${r.emoji}</span><span class="t"><b>${esc(r.title)}</b><small>${m.have}/${m.total} ingredients on hand</small></span>${icon('next')}</button>`; }).join('')}</div>` : ''}
    `,
    onMount: (b, close) => {
      b.querySelectorAll('[data-q]').forEach(btn => btn.onclick = () => {
        haptic(); adjustQty(it.id, Number(btn.dataset.q) * stepFor(it.unit));
        const cur = state.items.find(x => x.id === it.id); b.querySelector('.stepper input').value = fmtQty(cur?.qty ?? 0);
        if (cur && Number(cur.qty) === 0) toast(`${it.name} is out — add to your list?`, { action: 'Add', onAction: () => addToList({ name: it.name, foodId: it.foodId, unit: it.unit, reason: 'Ran out' }) });
      });
      b.querySelectorAll('[data-r]').forEach(btn => btn.onclick = () => { close(); actions.openRecipe(btn.dataset.r); });
      b.querySelector('[data-a=used]').onclick = () => {
        removeItem(it.id, 'used'); close(); haptic(20);
        toast(`Used up ${it.name}`, { icon: '✅', action: 'Add to list', onAction: () => { addToList({ name: it.name, foodId: it.foodId, unit: it.unit, reason: 'Used up' }); toast('On the list', { icon: '🛒' }); } });
      };
      b.querySelector('[data-a=toss]').onclick = async () => {
        if (!await confirmBox(`Toss ${it.name}? It'll be logged as wasted so you can spot patterns.`, { ok: 'Toss it', danger: true })) return;
        removeItem(it.id, 'tossed'); close(); toast(`Tossed ${it.name}`, { icon: '🗑️' });
      };
      b.querySelector('[data-a=list]').onclick = e => { const added = addToList({ name: it.name, foodId: it.foodId, unit: it.unit, reason: 'Restock' }); toast(added ? 'Added to shopping list' : 'Already on your list', { icon: '🛒' }); haptic(); };
      b.querySelector('[data-a=edit]').onclick = () => { close(); editItem(structuredClone(it)); };
      b.querySelector('[data-a=move]').onclick = () => moveItem(it, close);
      b.querySelector('[data-a=where]').onclick = () => { close(); actions.revealItem(it.id); };
      b.querySelector('[data-a=restock]').onclick = () => { close(); restockSheet(it.id); };
      b.querySelector('[data-a=date]').onclick = () => { close(); dateSheet(it.id, null, { after: () => showItem(it.id) }); };
      b.querySelectorAll('[data-bdate]').forEach(btn => btn.onclick = () => { close(); dateSheet(it.id, btn.dataset.bdate, { after: () => showItem(it.id) }); });
      b.querySelectorAll('[data-bdel]').forEach(btn => btn.onclick = () => { removeBatch(it.id, btn.dataset.bdel); close(); haptic(); toast('Batch removed'); showItem(it.id); });
    },
  });
  return sheet;
}

function batchList(it) {
  if (!it.batches?.length) return '';
  return `<div class="group-h">Batches<span class="n">${it.batches.length}</span><span class="line"></span></div>
    ${it.batches.map((bt, i) => { const st = itemStatus({ ...bt, dated: bt.dateType !== 'Estimated' }); return `<div class="irow" style="padding:8px 10px">
      <span class="em" style="width:34px;height:34px;font-size:14px;font-weight:700">#${i + 1}</span>
      <span class="t"><b>${fmtQty(bt.qty)} ${esc(it.unit)}</b><small style="white-space:normal">${esc(bt.dateType || 'Estimated')} ${bt.expires ? fmtDate(bt.expires) : '—'} · added ${fmtDate(bt.added)}</small></span>
      ${st.label ? `<span class="pill ${st.key}">${st.label}</span>` : ''}
      <button class="icon-btn" style="width:34px;height:34px;color:var(--ink-2);background:var(--paper-2)" data-bdate="${bt.id}" aria-label="Set date">📅</button>
      <button class="icon-btn" style="width:34px;height:34px;color:var(--tomato);background:var(--tomato-2)" data-bdel="${bt.id}" aria-label="Remove batch">${icon('minus')}</button>
    </div>`; }).join('')}`;
}

// ---------- dates & restocking ----------
function typicalDays(it) {
  const food = FOOD_BY_ID[it.foodId];
  return food ? shelfLifeDays(food, storageKind(it)) : 0;
}

function datePickerHTML(it, current, currentType) {
  const typ = typicalDays(it);
  const quick = [['+3 days', 3], ['+1 wk', 7], ['+2 wks', 14], ['+1 mo', 30], ['+3 mo', 91], ['+6 mo', 182], ['+1 yr', 365], ['+2 yrs', 730]];
  const types = DATE_TYPES.filter(t => t !== 'Estimated');
  return `
    <div class="seg" data-dtype style="margin-bottom:12px">${types.map(t => `<button type="button" data-v="${t}" class="${t === (currentType && currentType !== 'Estimated' ? currentType : 'Best by') ? 'on' : ''}">${t}</button>`).join('')}</div>
    <label class="field"><span>Date printed on the package</span><input class="input" type="date" data-date value="${attr(current || '')}"></label>
    <div class="row wrap" style="gap:6px;margin:-4px 0 12px">
      ${typ ? `<button type="button" class="chip on" data-plus="${typ}">✨ Typical ${span(typ)}</button>` : ''}
      ${quick.map(([l, d]) => `<button type="button" class="chip" data-plus="${d}">${l}</button>`).join('')}
      <button type="button" class="chip" data-nodate>No date</button>
    </div>`;
}

function wireDatePicker(b) {
  let type = $('[data-dtype] .on', b)?.dataset.v || 'Best by';
  segmented($('[data-dtype]', b), v => { type = v; haptic(); });
  const input = $('[data-date]', b);
  b.querySelectorAll('[data-plus]').forEach(c => c.onclick = () => { input.value = addDays(today(), Number(c.dataset.plus)); haptic(); input.animate([{ background: 'var(--honey-2)' }, { background: 'var(--paper)' }], { duration: 600 }); });
  $('[data-nodate]', b).onclick = () => { input.value = ''; haptic(); };
  return () => ({ expires: input.value || null, dateType: type });
}

export function dateSheet(itemId, batchId = null, { after } = {}) {
  const it = state.items.find(x => x.id === itemId);
  if (!it) return;
  const bt = batchId && it.batches?.find(b => b.id === batchId);
  openSheet({
    title: `Date for ${esc(it.name)}`,
    html: `<p class="muted small" style="margin-top:0">Read the date off the package — swap the estimate for the real one.</p>${datePickerHTML(it, bt ? bt.expires : it.expires, bt ? bt.dateType : it.dateType)}
      <button class="btn btn-brass btn-block" data-save>${icon('check')} Save date</button>`,
    onMount: (b, close) => {
      const read = wireDatePicker(b);
      $('[data-save]', b).onclick = () => { const v = read(); setBatchDate(itemId, bt ? bt.id : null, v.expires, v.dateType); haptic(20); close(); toast(v.expires ? `${v.dateType} ${fmtDate(v.expires)}` : 'Date cleared', { icon: '📅' }); after?.(); };
    },
  });
}

export function restockSheet(itemId) {
  const it = state.items.find(x => x.id === itemId);
  if (!it) return;
  const typ = typicalDays(it);
  openSheet({
    title: `Restock ${esc(it.name)}`,
    html: `<p class="muted small" style="margin-top:0">New purchases are kept as their own batch so each one keeps its own date. You have <b>${fmtQty(it.qty)} ${esc(it.unit)}</b> now.</p>
      <label class="field"><span>How many did you add?</span><div class="stepper" style="width:fit-content"><button type="button" data-d="-1">−</button><input data-qty inputmode="decimal" value="1"><button type="button" data-d="1">+</button></div></label>
      ${datePickerHTML(it, typ ? addDays(today(), typ) : '', 'Best by')}
      <button class="btn btn-brass btn-block" data-save>${icon('check')} Add batch</button>`,
    onMount: (b, close) => {
      const q = $('[data-qty]', b);
      b.querySelectorAll('[data-d]').forEach(btn => btn.onclick = () => { q.value = Math.max(0, Math.round((Number(q.value || 0) + Number(btn.dataset.d) * stepFor(it.unit)) * 100) / 100); haptic(); });
      const read = wireDatePicker(b);
      $('[data-save]', b).onclick = () => {
        const v = read();
        restockItem(itemId, { qty: Number(q.value) || 1, ...v });
        haptic(20); close(); confetti(innerWidth / 2, innerHeight * .6, 14);
        toast(`Restocked ${it.name}`, { icon: '📦', action: 'View', onAction: () => showItem(itemId) });
      };
    },
  });
}

// Walk a shelf (or any list of items) one at a time, confirming quantity and printed date.
export function labelWalk(itemIds, { title = 'Label this shelf', onDone } = {}) {
  const ids = itemIds.filter(id => state.items.some(i => i.id === id));
  if (!ids.length) { toast('Nothing to label here yet'); return; }
  let i = 0;
  const sheet = openSheet({ title, html: '<div data-walk></div>', onMount: (b, close) => { b._close = close; } });
  const host = $('[data-walk]', sheet.body);
  const render = () => {
    const it = state.items.find(x => x.id === ids[i]);
    if (!it) { i++; return i < ids.length ? render() : finish(); }
    const st = itemStatus(it);
    host.innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:10px"><span class="pill">${i + 1} of ${ids.length}</span><div style="flex:1;height:6px;border-radius:3px;background:var(--paper-2);margin:0 10px;overflow:hidden"><div style="height:100%;width:${(i / ids.length) * 100}%;background:var(--sage);transition:width .4s var(--ease)"></div></div><button class="btn btn-ghost btn-sm" data-skipall>Done</button></div>
      <div class="sheet-hero wood-mid" style="margin:0 -18px 14px;padding:14px">${imgOrEmoji(it)}<h2 style="font-size:20px">${esc(it.name)}</h2><div class="crumb">📍 ${esc(crumb(it))}${st.label ? ' · ' + st.label : ''}</div></div>
      <label class="field"><span>How much is there?</span><div class="row"><div class="stepper"><button type="button" data-d="-1">−</button><input data-qty inputmode="decimal" value="${fmtQty(it.qty)}"><button type="button" data-d="1">+</button></div><span class="muted" style="font-weight:600">${esc(it.unit)}</span></div></label>
      ${datePickerHTML(it, it.expires, it.dateType)}
      <div class="row" style="gap:8px"><button class="btn btn-ghost grow" data-skip>Skip</button><button class="btn btn-brass grow" data-next>${icon('check')} ${i === ids.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    host.firstElementChild.nextElementSibling.animate([{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const q = $('[data-qty]', host);
    host.querySelectorAll('[data-d]').forEach(btn => btn.onclick = () => { q.value = Math.max(0, Math.round((Number(q.value || 0) + Number(btn.dataset.d) * stepFor(it.unit)) * 100) / 100); haptic(); });
    const read = wireDatePicker(host);
    $('[data-next]', host).onclick = () => {
      const v = read();
      const cur = structuredClone(state.items.find(x => x.id === it.id));
      const newQ = Number(q.value);
      if (!cur.batches?.length && isFinite(newQ)) cur.qty = newQ;
      saveItem(cur);
      setBatchDate(it.id, null, v.expires, v.dateType);
      haptic(15); i++;
      i < ids.length ? render() : finish();
    };
    $('[data-skip]', host).onclick = () => { i++; i < ids.length ? render() : finish(); };
    $('[data-skipall]', host).onclick = finish;
  };
  const finish = () => { sheet.close(); confetti(innerWidth / 2, innerHeight / 2, 30); toast('Shelf labeled — dates are legit now', { icon: '🏷️' }); onDone?.(); };
  render();
}

const stepFor = unit => ['lb', 'gal', 'dozen', 'loaf', 'bag', 'box', 'jar', 'bottle', 'carton'].includes(unit) ? 0.5 : 1;

function tipFor(it) {
  const food = FOOD_BY_ID[it.foodId];
  if (!food) return '';
  const lines = [];
  const L = food.life;
  const fmt = d => span(d, true);
  const where = [L.pantry && `pantry ${fmt(L.pantry)}`, L.fridge && `fridge ${fmt(L.fridge)}`, L.freezer && `freezer ${fmt(L.freezer)}`].filter(Boolean);
  if (where.length && food.cat !== 'kitchenware' && food.cat !== 'household') lines.push(`Keeps about: ${where.join(' · ')}.`);
  const kind = storageKind(it);
  if (kind !== 'freezer' && L.freezer && itemStatus(it).key === 'soon') lines.push(`Won't use it in time? Freeze it — buys you ~${fmt(L.freezer)}.`);
  if (!lines.length) return '';
  return `<div class="where-banner" style="background:var(--sky-2);color:var(--sky)">💡 <span>${lines.join(' ')}</span></div>`;
}

function moveItem(it, closeDetail) {
  openSheet({
    title: 'Move to…',
    html: `<div class="stagger">${state.zones.map(z => `<div class="group-h">${esc(z.name)}<span class="line"></span></div>${z.sections.map(s => `<button class="irow" style="width:100%;text-align:left" data-s="${s.id}"><span class="em">${s.id === it.sectionId ? '📍' : '📦'}</span><span class="t"><b>${esc(s.name)}</b><small>${state.items.filter(i => i.sectionId === s.id).length} items</small></span></button>`).join('')}`).join('')}</div>`,
    onMount: (b, close) => b.querySelectorAll('[data-s]').forEach(btn => btn.onclick = () => {
      const cur = state.items.find(x => x.id === it.id);
      const sec = sectionById(btn.dataset.s);
      const food = FOOD_BY_ID[cur.foodId];
      const next = { ...cur, sectionId: btn.dataset.s };
      // Moving into/out of the freezer changes how long it keeps.
      const newKind = sec.zone.kind === 'freezer' ? 'freezer' : sec.zone.kind === 'fridge' ? 'fridge' : 'pantry';
      if (food && newKind !== storageKind(cur) && shelfLifeDays(food, newKind)) next.expires = addDays(today(), shelfLifeDays(food, newKind));
      saveItem(next); close(); closeDetail(); haptic();
      toast(`Moved to ${sec.zone.name} › ${sec.name}`, { icon: '📦' });
    }),
  });
}

// ---------- editor ----------
export function editItem(it, { isNew = false } = {}) {
  const tagsStr = (it.tags || []).join(', ');
  openSheet({
    title: isNew ? 'Add to your kitchen' : 'Edit item',
    html: `
      <form class="item-form" autocomplete="off">
        <div class="row" style="align-items:flex-end;gap:10px">
          <label class="field" style="width:76px"><span>Icon</span><input class="input" name="emoji" value="${attr(it.emoji)}" style="text-align:center;font-size:24px" maxlength="4"></label>
          <label class="field grow"><span>Name</span><input class="input" name="name" value="${attr(it.name)}" required></label>
        </div>
        ${it.off ? `<div class="where-banner" style="background:var(--sage-2);color:var(--sage)">🏷️ <span>Label found: <b>${esc(it.brand || '')} ${esc(it.off.name)}</b>${it.off.quantity ? ' · ' + esc(it.off.quantity) : ''}</span></div>` : ''}
        <div class="row" style="gap:10px">
          <label class="field"><span>Quantity</span><div class="stepper"><button type="button" data-d="-1">−</button><input name="qty" inputmode="decimal" value="${attr(it.qty)}"><button type="button" data-d="1">+</button></div></label>
          <label class="field grow"><span>Unit</span><select class="input" name="unit">${[...new Set([it.unit, ...UNITS])].map(u => `<option ${u === it.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Where it lives</span>${locationSelect(it.sectionId)}</label>
        <div class="row" style="gap:10px">
          <label class="field" style="width:42%"><span>Date type</span><select class="input" name="dateType">${DATE_TYPES.map(t => `<option ${t === (it.dateType || 'Estimated') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="field grow"><span>${it.batches?.length ? 'Soonest date' : 'Date'}</span><input class="input" type="date" name="expires" value="${attr(it.expires || '')}"></label>
        </div>
        <p class="small muted expiry-hint" style="margin:-6px 0 12px"></p>
        <div class="row" style="gap:10px">
          <label class="field grow"><span>Opened on</span><input class="input" type="date" name="openedOn" value="${attr(it.openedOn || '')}"></label>
          <label class="field grow"><span>Restock when ≤</span><input class="input" name="minQty" inputmode="decimal" placeholder="e.g. 1" value="${attr(it.minQty ?? '')}"></label>
        </div>
        ${it.batches?.length ? `<p class="small muted" style="margin:-6px 0 12px">This item has ${it.batches.length} batches — quantity changes come out of the oldest first.</p>` : ''}
        <label class="field"><span>Category</span><select class="input" name="cat">${CATEGORIES.map(c => `<option value="${c.id}" ${c.id === it.cat ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Tags <small style="text-transform:none;letter-spacing:0">(e.g. thanksgiving, christmas, party)</small></span><input class="input" name="tags" value="${attr(tagsStr)}"></label>
        <label class="field"><span>Notes</span><textarea class="input" name="notes" rows="2">${esc(it.notes || '')}</textarea></label>
        <div class="row" style="gap:10px;margin-top:4px">
          ${isNew ? '' : '<button type="button" class="btn btn-danger" data-del>' + icon('trash') + '</button>'}
          <button class="btn btn-brass grow" type="submit">${icon('check')} ${isNew ? 'Put it away' : 'Save'}</button>
        </div>
      </form>`,
    onMount: (b, close) => {
      const f = b.querySelector('form');
      const qty = f.qty;
      f.querySelectorAll('[data-d]').forEach(btn => btn.onclick = () => { qty.value = Math.max(0, Math.round((Number(qty.value || 0) + Number(btn.dataset.d) * stepFor(f.unit.value)) * 100) / 100); haptic(); });
      const hint = () => {
        const food = FOOD_BY_ID[it.foodId] || matchFood(f.name.value);
        const sec = sectionById(f.sectionId.value);
        if (!food || !sec) { b.querySelector('.expiry-hint').textContent = ''; return; }
        const kind = sec.zone.kind === 'freezer' ? 'freezer' : sec.zone.kind === 'fridge' ? 'fridge' : 'pantry';
        const d = shelfLifeDays(food, kind);
        b.querySelector('.expiry-hint').innerHTML = d ? `Typical: about <b>${span(d, true)}</b> in the ${kind}. <button type="button" style="color:var(--brass-dark);font-weight:700" data-setexp="${d}">Use that</button>` : (food.life.fridge || food.life.freezer || food.life.pantry) ? `Not recommended to store in the ${kind}.` : '';
        b.querySelector('[data-setexp]')?.addEventListener('click', e => { f.expires.value = addDays(today(), Number(e.target.dataset.setexp)); haptic(); });
      };
      f.sectionId.onchange = hint; f.name.onchange = hint; hint();
      b.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!await confirmBox(`Remove ${it.name} from your kitchen?`, { ok: 'Remove', danger: true })) return;
        removeItem(it.id, 'removed'); close(); toast('Removed', { icon: '🗑️' });
      });
      f.onsubmit = e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(f));
        const next = {
          ...it, ...data,
          name: data.name.trim() || it.name, emoji: data.emoji.trim() || it.emoji,
          qty: Number(data.qty) || 0, minQty: data.minQty === '' ? null : Number(data.minQty),
          expires: data.expires || null, tags: data.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
          openedOn: data.openedOn || null, opened: !!data.openedOn,
        };
        if (data.expires !== (it.expires || '') || data.dateType !== (it.dateType || 'Estimated')) next.dated = data.dateType !== 'Estimated';
        if (it.batches?.length) {
          // reconcile edits onto batches: dates go to the soonest batch, qty changes FIFO / newest
          const bs = next.batches = structuredClone(it.batches);
          bs[0].expires = next.expires; bs[0].dateType = next.dateType;
          let diff = Math.round((next.qty - it.qty) * 100) / 100;
          if (diff > 0) bs[bs.length - 1].qty = Number(bs[bs.length - 1].qty) + diff;
          else for (const bt of bs) { if (diff >= 0) break; const take = Math.min(Number(bt.qty), -diff); bt.qty = Number(bt.qty) - take; diff += take; }
        }
        if (!next.foodId) next.foodId = matchFood(next.name)?.id || null;
        if (isNew) { const added = addItem({ ...next, noExpiry: true }); afterAdd(added); } else { saveItem(next); toast('Saved', { icon: '✅' }); }
        haptic(20); close();
      };
    },
  });
}

function afterAdd(it) {
  const s = sectionById(it.sectionId);
  toast(`${it.name} → ${s ? s.zone.name + ' › ' + s.name : 'kitchen'}`, { icon: it.emoji, action: 'Show me', onAction: () => actions.revealItem(it.id) });
  confetti(innerWidth / 2, innerHeight * .6, 18);
}

// ---------- add flow ----------
let scanStop = null;

export function addFlow({ sectionId = null, query = '' } = {}) {
  const popular = ['milk', 'eggs', 'bread', 'butter', 'bananas', 'chicken-breast', 'ground-beef', 'cheddar-cheese', 'apples', 'onions', 'potatoes', 'coffee', 'orange-juice', 'spaghetti', 'white-rice', 'lettuce', 'tomatoes', 'greek-yogurt'];
  openSheet({
    title: 'Add groceries',
    html: `
      <div class="seg" style="margin-bottom:14px"><button class="on" data-v="catalog">🔎 Search</button><button data-v="scan">📷 Scan</button><button data-v="label">🏷️ Labels</button><button data-v="custom">✏️ Custom</button></div>
      <div data-pane="catalog">
        <div class="search" style="margin:0 0 10px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input class="input" placeholder="Milk, cumin, turkey baster…" value="${attr(query)}" data-q></div>
        <div data-results class="stagger"></div>
        <div data-popular>
          <div class="group-h">Quick add<span class="line"></span></div>
          <div class="row wrap" style="gap:8px">${popular.map(id => FOOD_BY_ID[id]).filter(Boolean).map(f => `<button class="chip" data-f="${f.id}">${f.emoji} ${esc(f.name)}</button>`).join('')}</div>
          <div class="group-h">Browse by aisle<span class="line"></span></div>
          <div class="row wrap" style="gap:8px">${CATEGORIES.map(c => `<button class="chip" data-c="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}</div>
        </div>
      </div>
      <div data-pane="scan" class="hidden">
        <div class="scanner"><video playsinline muted></video><div class="reticle"></div><div class="laser"></div></div>
        <p class="small muted" data-scanmsg style="text-align:center">Point at a barcode. We'll pull the real product label from Open Food Facts.</p>
        <div class="row"><input class="input grow" inputmode="numeric" placeholder="…or type the barcode digits" data-code><button class="btn btn-brass" data-lookup>Look up</button></div>
      </div>
      <div data-pane="label" class="hidden">
        <p class="small muted" style="margin-top:0">Search millions of real products (brands, sizes, nutrition labels) from the open Open Food Facts database.</p>
        <div class="row"><input class="input grow" placeholder="e.g. Cheerios, Heinz ketchup" data-lq><button class="btn btn-brass" data-lgo>Search</button></div>
        <div data-lres class="stagger" style="margin-top:12px"></div>
      </div>
      <div data-pane="custom" class="hidden"><p class="muted">Anything at all — homemade sauce, a gift basket, grandma's gravy boat.</p><button class="btn btn-brass btn-block" data-custom>${icon('edit')} Start a custom item</button></div>
    `,
    onMount: (b, close) => {
      const panes = $$('[data-pane]', b);
      segmented($('.seg', b), v => {
        panes.forEach(p => p.classList.toggle('hidden', p.dataset.pane !== v));
        if (v === 'scan') startScan(b, close); else stopScan();
        if (v === 'label') setTimeout(() => $('[data-lq]', b).focus(), 50);
      });
      const pick = (food, extra = {}) => { stopScan(); close(); editItem(makeItem({ foodId: food?.id, name: food?.name, ...(sectionId ? { sectionId } : {}), ...extra }), { isNew: true }); };
      const q = $('[data-q]', b), res = $('[data-results]', b), pop = $('[data-popular]', b);
      const run = () => {
        const v = q.value.trim();
        pop.classList.toggle('hidden', !!v);
        if (!v) { res.innerHTML = ''; return; }
        const hits = searchFoods(v);
        res.innerHTML = hits.map(f => `<button class="irow" style="width:100%;text-align:left;--tint:${catOf(f.cat).color}" data-f="${f.id}"><span class="em">${f.emoji}</span><span class="t"><b>${esc(f.name)}</b><small>${catOf(f.cat).name}${f.life.fridge || f.life.pantry || f.life.freezer ? ' · keeps ' + bestLife(f) : ''}</small></span>${icon('plus')}</button>`).join('')
          + `<button class="irow" style="width:100%;text-align:left" data-new><span class="em">✏️</span><span class="t"><b>Add “${esc(v)}”</b><small>Custom item</small></span>${icon('plus')}</button>`
          + `<button class="irow" style="width:100%;text-align:left" data-off><span class="em">🏷️</span><span class="t"><b>Search labels for “${esc(v)}”</b><small>Real products from Open Food Facts</small></span>${icon('next')}</button>`;
      };
      q.oninput = run; if (query) run(); else setTimeout(() => q.focus(), 300);
      b.addEventListener('click', e => {
        const f = e.target.closest('[data-f]'); if (f) return pick(FOOD_BY_ID[f.dataset.f]);
        const c = e.target.closest('[data-c]');
        if (c) { q.value = ''; pop.classList.add('hidden'); res.innerHTML = FOODS.filter(x => x.cat === c.dataset.c).map(x => `<button class="irow" style="width:100%;text-align:left" data-f="${x.id}"><span class="em">${x.emoji}</span><span class="t"><b>${esc(x.name)}</b></span>${icon('plus')}</button>`).join('') + '<button class="btn btn-ghost btn-block" data-back>← All aisles</button>'; return; }
        if (e.target.closest('[data-back]')) { res.innerHTML = ''; pop.classList.remove('hidden'); return; }
        if (e.target.closest('[data-new]')) return pick(null, { name: q.value.trim(), emoji: '📦' });
        if (e.target.closest('[data-off]')) { $('.seg button[data-v=label]', b).click(); $('[data-lq]', b).value = q.value; labelSearch(b, pick); return; }
        if (e.target.closest('[data-custom]')) return pick(null, { name: '', emoji: '📦' });
        const lr = e.target.closest('[data-lr]'); if (lr) { const p = b._labelHits[Number(lr.dataset.lr)]; return pickProduct(p, pick); }
      });
      $('[data-lgo]', b).onclick = () => labelSearch(b, pick);
      $('[data-lq]', b).onkeydown = e => { if (e.key === 'Enter') labelSearch(b, pick); };
      $('[data-lookup]', b).onclick = () => barcodeLookup($('[data-code]', b).value, b, pick);
      b._pick = pick;
    },
    onClose: stopScan,
  });
}

const bestLife = f => { const d = Math.max(f.life.pantry, f.life.fridge); const z = f.life.freezer; const s = x => span(x); return [d && s(d), z && s(z) + ' frozen'].filter(Boolean).join(' / '); };

function pickProduct(p, pick) {
  const food = p.foodId ? FOOD_BY_ID[p.foodId] : null;
  pick(food, { name: p.name || food?.name, brand: p.brand, barcode: p.barcode, image: p.image, off: p, emoji: food?.emoji || '🛒', foodId: food?.id || null });
}

async function labelSearch(b, pick) {
  const q = $('[data-lq]', b).value.trim();
  const out = $('[data-lres]', b);
  if (!q) return;
  out.innerHTML = `<div class="empty"><span class="big">🔎</span>Reading labels…</div>`;
  try {
    const hits = await searchProducts(q);
    b._labelHits = hits;
    out.innerHTML = hits.length ? hits.map((p, i) => `<button class="irow" style="width:100%;text-align:left" data-lr="${i}"><span class="em">${p.image ? `<img src="${attr(p.image)}" alt="" loading="lazy">` : '🛒'}</span><span class="t"><b>${esc(p.name)}</b><small>${esc([p.brand, p.quantity].filter(Boolean).join(' · '))}${p.nutrition.kcal != null ? ` · ${p.nutrition.kcal} kcal/${esc(p.nutrition.per)}` : ''}</small></span>${p.nutriscore ? `<span class="grade ${p.nutriscore}" style="width:26px;height:26px;font-size:13px">${p.nutriscore}</span>` : ''}</button>`).join('') : `<div class="empty"><span class="big">🤷</span>No products found. Try a brand name.</div>`;
  } catch (e) {
    out.innerHTML = `<div class="empty"><span class="big">📡</span>${window.LarderNative ? "Couldn't reach Open Food Facts. Check your connection — the built-in catalog still works offline." : 'Label search needs the Larder Android app (the browser blocks it). Barcode lookup and the built-in catalog work here.'}</div>`;
  }
}

async function barcodeLookup(code, b, pick) {
  code = String(code || '').replace(/\D/g, '');
  if (code.length < 6) { toast('That barcode looks too short'); return; }
  const msg = $('[data-scanmsg]', b);
  msg.textContent = `Looking up ${code}…`;
  try {
    const p = await lookupBarcode(code);
    if (!p) { msg.textContent = `No label found for ${code}. You can still add it as a custom item.`; toast('Not in the label database yet'); stopScan(); pick(null, { name: '', barcode: code, emoji: '📦' }); return; }
    haptic(30); stopScan(); pickProduct(p, pick);
  } catch {
    msg.textContent = 'Offline? Couldn\'t reach Open Food Facts.';
  }
}

async function startScan(b, close) {
  stopScan();
  const video = $('video', b), msg = $('[data-scanmsg]', b);
  if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = 'Camera not available here — type the barcode instead.'; return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
  } catch (e) { msg.textContent = 'Camera permission was denied — type the barcode instead.'; return; }
  video.srcObject = stream; await video.play().catch(() => { });
  let alive = true;
  const found = code => { if (!alive) return; alive = false; $('[data-code]', b).value = code; barcodeLookup(code, b, b._pick); };
  if ('BarcodeDetector' in window) {
    const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    const tick = async () => { if (!alive) return; try { const r = await det.detect(video); if (r[0]) return found(r[0].rawValue); } catch { } setTimeout(tick, 220); };
    tick();
  } else {
    await loadZXing();
    const reader = new window.ZXing.BrowserMultiFormatReader();
    reader.decodeFromVideoElementContinuously(video, (res) => { if (res) found(res.getText()); }).catch(() => { });
    const prev = scanStop;
    scanStop = () => { prev?.(); try { reader.reset(); } catch { } };
  }
  const prevStop = scanStop;
  scanStop = () => { alive = false; prevStop?.(); stream.getTracks().forEach(t => t.stop()); scanStop = null; };
}
function stopScan() { scanStop?.(); scanStop = null; }
let zx;
function loadZXing() { return zx ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/zxing.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
