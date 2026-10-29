// Calendar: meals, gatherings, holidays — and what each one needs from the store and from storage.

import { state, recipeById, recipeMatch, allRecipes, saveEvent, removeEvent, uid, today, addDays, fmtDate, addToList, scaleQty, itemStatus, fmtQty } from '../store.js';
import { holidayMap, holidaysFor, iso } from '../data/holidays.js';
import { esc, attr, icon, $, $$, openSheet, toast, haptic, confirmBox, segmented, confetti } from '../ui/dom.js';
import { crumb } from '../ui/itemSheet.js';
import { actions } from '../router.js';

const ui = { month: null, sel: null };
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function render(root, params = {}) {
  if (params.date) { ui.sel = params.date; ui.month = params.date.slice(0, 7); }
  ui.sel ||= today(); ui.month ||= today().slice(0, 7);
  const [y, m] = ui.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const hols = holidayMap([y - 1, y, y + 1]);
  const byDate = {}; for (const e of state.events) (byDate[e.date] ||= []).push(e);
  const days = [];
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
  const title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  root.innerHTML = `
    <div class="cal-head">
      <h2>${title}</h2>
      <button class="cal-nav" data-m="-1" aria-label="Previous month">${icon('back')}</button>
      <button class="cal-nav" data-today aria-label="Today" style="width:auto;padding:0 12px;font-weight:700;font-size:13px">Today</button>
      <button class="cal-nav" data-m="1" aria-label="Next month">${icon('next')}</button>
    </div>
    <div class="cal" data-tour="calendar">
      <div class="cal-dow wood-dark">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${days.map(d => {
        const k = iso(d), evs = byDate[k] || [], h = hols[k];
        return `<button class="cal-day ${d.getMonth() !== m - 1 ? 'other' : ''} ${k === today() ? 'today' : ''} ${k === ui.sel ? 'sel' : ''}" data-d="${k}">
          <span class="d">${d.getDate()}</span>${h ? `<span class="hol">${h[0].emoji}</span>` : ''}
          <span class="marks">${evs.slice(0, 3).map(e => `<span>${e.emoji || '🍽️'}</span>`).join('')}</span>
          <span class="dots">${evs.map(e => `<i class="${e.kind === 'gathering' ? 'g' : e.kind === 'reminder' ? 'r' : ''}"></i>`).join('')}</span></button>`;
      }).join('')}</div>
    </div>
    <div class="row" style="margin:12px 12px 0;gap:8px">
      <button class="btn btn-brass grow" data-add>${icon('plus')} Add to ${esc(fmtDate(ui.sel, { month: 'short', day: 'numeric' }))}</button>
      <button class="btn btn-wood wood-mid" data-auto title="Fill empty dinners this week">✨ Auto-plan week</button>
    </div>
    <div class="section-title"><h2>${ui.sel === today() ? 'Today' : esc(fmtDate(ui.sel, { weekday: 'long', month: 'long', day: 'numeric' }))}</h2></div>
    <div class="agenda stagger" data-day></div>
    <div class="section-title"><h2>Coming up</h2><button class="link" data-shopall>Shop for 2 weeks</button></div>
    <div class="agenda stagger" data-upcoming></div>`;

  const dayEl = $('[data-day]', root);
  const dayHols = hols[ui.sel] || [], dayEvs = (byDate[ui.sel] || []).sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
  dayEl.innerHTML = dayHols.map(h => `<button class="ev holiday" data-hol="${h.iso}|${attr(h.name)}"><span class="em">${h.emoji}</span><span class="grow"><span class="when">Holiday</span><b>${esc(h.name)}</b><small class="muted">Recipes, storage &amp; a shopping plan</small></span>${icon('next')}</button>`).join('')
    + dayEvs.map(evRow).join('')
    + (!dayHols.length && !dayEvs.length ? `<div class="empty" style="padding:22px"><span class="big">🍽️</span>Nothing planned. Tap “Add” or auto-plan the week.</div>` : '');

  const upcoming = [
    ...state.events.filter(e => e.date > ui.sel).map(e => ({ t: e.date, html: evRow(e) })),
    ...[...holidaysFor(y), ...holidaysFor(y + 1)].filter(h => h.iso > ui.sel).slice(0, 4).map(h => ({ t: h.iso, html: `<button class="ev holiday" data-hol="${h.iso}|${attr(h.name)}"><span class="em">${h.emoji}</span><span class="grow"><span class="when">${fmtDate(h.iso)} · holiday</span><b>${esc(h.name)}</b></span>${icon('next')}</button>` })),
  ].sort((a, b) => a.t < b.t ? -1 : 1).slice(0, 8);
  $('[data-upcoming]', root).innerHTML = upcoming.map(x => x.html).join('') || '<p class="muted" style="margin:0 6px">Nothing else on the books.</p>';

  root.onclick = e => {
    const nav = e.target.closest('[data-m]');
    if (nav) { const d = new Date(y, m - 1 + Number(nav.dataset.m), 1); ui.month = iso(d).slice(0, 7); haptic(); return render(root); }
    if (e.target.closest('[data-today]')) { ui.sel = today(); ui.month = today().slice(0, 7); return render(root); }
    const d = e.target.closest('[data-d]'); if (d) { ui.sel = d.dataset.d; if (d.dataset.d.slice(0, 7) !== ui.month) ui.month = d.dataset.d.slice(0, 7); haptic(); return render(root); }
    if (e.target.closest('[data-add]')) return eventEditor({ date: ui.sel });
    if (e.target.closest('[data-auto]')) return autoPlan();
    if (e.target.closest('[data-shopall]')) return shopRange(today(), addDays(today(), 14));
    const ev = e.target.closest('[data-ev]'); if (ev) return openEvent(ev.dataset.ev);
    const h = e.target.closest('[data-hol]'); if (h) { const [date, name] = h.dataset.hol.split('|'); return openHoliday(date, name); }
  };
}

const slotOrder = s => ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Dessert'].indexOf(s);

function evRow(e) {
  const rs = (e.recipeIds || []).map(recipeById).filter(Boolean);
  const miss = rs.reduce((a, r) => a + recipeMatch(r, e.guests || r.servings).missing.length, 0);
  return `<button class="ev ${e.kind}" data-ev="${e.id}"><span class="em">${e.emoji || '🍽️'}</span><span class="grow"><span class="when">${e.date !== ui.sel ? fmtDate(e.date) + ' · ' : ''}${esc(e.slot || e.kind)}${e.guests ? ` · 👥 ${e.guests}` : ''}</span><b>${esc(e.title)}</b><small class="muted">${rs.length ? `${rs.map(r => esc(r.title)).join(', ')}` : esc(e.notes || '')}</small>${rs.length ? `<small style="display:block;font-weight:600;color:${miss ? 'var(--tomato)' : 'var(--sage)'}">${miss ? `${miss} ingredient${miss > 1 ? 's' : ''} to buy` : '✓ Everything on hand'}</small>` : ''}</span>${icon('next')}</button>`;
}

// ---------- event detail ----------
export function openEvent(id) {
  const e = state.events.find(x => x.id === id);
  if (!e) return;
  const rs = (e.recipeIds || []).map(recipeById).filter(Boolean);
  const recipeMatchE = r => recipeMatch(r, e.guests || r.servings);
  const tagHits = storageFor(e.title + ' ' + rs.flatMap(r => r.tags || []).join(' '));
  openSheet({
    hero: `<div class="sheet-hero ${e.kind === 'gathering' ? 'wood-mid' : 'wood-dark'}"><span class="em">${e.emoji || '🍽️'}</span><h2>${esc(e.title)}</h2><div class="crumb">${fmtDate(e.date, { weekday: 'long', month: 'long', day: 'numeric' })}${e.slot ? ' · ' + esc(e.slot) : ''}${e.guests ? ` · 👥 ${e.guests} people` : ''}</div></div>`,
    html: `
      ${e.notes ? `<p style="margin:0 0 12px;color:var(--ink-2)">📝 ${esc(e.notes)}</p>` : ''}
      ${countdown(e)}
      <h3 style="margin:6px 0 8px">Menu</h3>
      ${rs.length ? rs.map(r => { const m = recipeMatchE(r); return `<button class="irow" style="width:100%;text-align:left" data-r="${r.id}"><span class="em">${r.emoji}</span><span class="t"><b>${esc(r.title)}</b><small>${m.missing.length ? `<span style="color:var(--tomato)">Need ${m.missing.map(x => esc(x.food?.name || x.ing.name)).slice(0, 3).join(', ')}${m.missing.length > 3 ? ` +${m.missing.length - 3}` : ''}</span>` : '<span style="color:var(--sage)">Everything on hand</span>'}</small></span>${icon('next')}</button>`; }).join('') : '<p class="muted">No recipes yet.</p>'}
      <div class="row" style="gap:8px;margin:10px 0">
        ${rs.length ? `<button class="btn btn-brass grow" data-shop>${icon('cart')} Shop for ${e.guests || 'this'}${e.guests ? ' people' : ''}</button>` : ''}
        <button class="btn btn-ghost grow" data-edit>${icon('edit')} Edit</button>
      </div>
      ${tagHits.length ? `<h3 style="margin:16px 0 8px">Pull from storage</h3><p class="small muted" style="margin:-4px 0 8px">Tagged items for this occasion and exactly where they are.</p>${tagHits.map(storageRow).join('')}` : ''}
      <button class="btn btn-ghost btn-block btn-sm" data-del style="margin-top:14px;color:var(--tomato)">${icon('trash')} Delete event</button>`,
    onMount: (b, close) => {
      $$('[data-r]', b).forEach(x => x.onclick = () => actions.openRecipe(x.dataset.r));
      $('[data-shop]', b)?.addEventListener('click', () => { const n = shopFor(e); toast(n ? `${n} items added for ${e.title}` : 'You already have everything', { icon: '🛒' }); haptic(20); });
      $('[data-edit]', b).onclick = () => { close(); eventEditor(e); };
      $$('[data-item]', b).forEach(x => x.onclick = () => { close(); actions.revealItem(x.dataset.item); });
      $('[data-del]', b).onclick = async () => { if (!await confirmBox(`Delete “${e.title}”?`, { ok: 'Delete', danger: true })) return; removeEvent(e.id); close(); toast('Deleted'); };
    },
  });
}

function countdown(e) {
  const d = Math.round((new Date(e.date + 'T12:00') - new Date(today() + 'T12:00')) / 864e5);
  const tips = [];
  for (const r of (e.recipeIds || []).map(recipeById).filter(Boolean)) {
    if (r.ingredients.some(i => /turkey/i.test(i.name))) {
      const tk = state.items.find(i => i.foodId === 'whole-turkey');
      const lbs = tk ? Number(tk.qty) : 14;
      const thaw = Math.ceil(lbs / 4.5);
      tips.push(`🦃 Move the turkey to the fridge to thaw <b>${thaw} days before</b> (${fmtDate(addDays(e.date, -thaw))}) — about 1 day per 4–5 lb.`);
    }
    if ((r.tags || []).includes('make-ahead')) tips.push(`⏱️ ${esc(r.title)} can be made the day before.`);
  }
  if (d < 0 && !tips.length) return '';
  return `<div class="where-banner" style="flex-direction:column;align-items:flex-start;gap:4px">${d >= 0 ? `<b>${d === 0 ? 'Today!' : d === 1 ? 'Tomorrow' : `${d} days to go`}</b>` : ''}${tips.map(t => `<span>${t}</span>`).join('')}</div>`;
}

function shopFor(e) {
  let n = 0;
  for (const r of (e.recipeIds || []).map(recipeById).filter(Boolean))
    for (const x of recipeMatch(r, e.guests || r.servings).missing) if (addToList({ name: x.food?.name || x.ing.name, foodId: x.food?.id, qty: x.short || x.need, unit: x.ing.unit, reason: `${r.title} · ${fmtDate(e.date)}` })) n++;
  return n;
}

function shopRange(a, b) {
  const evs = state.events.filter(e => e.date >= a && e.date <= b);
  const n = evs.reduce((s, e) => s + shopFor(e), 0);
  toast(n ? `${n} items added for ${evs.length} planned meals` : 'Your plan is fully stocked', { icon: '🛒', action: n ? 'View list' : '', onAction: () => actions.go('list') });
}

// Items tagged for an occasion (thanksgiving, christmas, party…) + holiday-storage items.
function storageFor(text) {
  const t = text.toLowerCase();
  const keys = ['thanksgiving', 'christmas', 'easter', 'party', 'birthday', 'game day', 'halloween', 'gathering', 'holiday'].filter(k => t.includes(k));
  if (/turkey|stuffing|pumpkin/.test(t)) keys.push('thanksgiving');
  if (!keys.length) return [];
  return state.items.filter(i => (i.tags || []).some(tag => keys.includes(tag) || (keys.includes('gathering') && tag === 'party')));
}
const storageRow = i => `<button class="irow" style="width:100%;text-align:left" data-item="${i.id}"><span class="em">${i.emoji}</span><span class="t"><b>${esc(i.name)}</b><small>📍 ${esc(crumb(i))}${i.notes ? ' · ' + esc(i.notes) : ''}</small></span><span class="small muted">Show</span></button>`;

// ---------- holidays ----------
function openHoliday(date, name) {
  const h = [...holidaysFor(Number(date.slice(0, 4)))].find(x => x.iso === date && x.name === name) || { name, emoji: '🎉', tag: 'party' };
  const rs = allRecipes().filter(r => (r.tags || []).includes(h.tag)).map(r => ({ r, m: recipeMatch(r) })).sort((a, b) => b.m.pct - a.m.pct);
  const stored = storageFor(h.tag + ' ' + h.name);
  const existing = state.events.filter(e => e.date === date);
  openSheet({
    hero: `<div class="sheet-hero wood-mid"><span class="em">${h.emoji}</span><h2>${esc(h.name)}</h2><div class="crumb">${fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div></div>`,
    html: `
      ${existing.length ? `<p class="small muted">Already planned: ${existing.map(e => esc(e.title)).join(', ')}</p>` : ''}
      <button class="btn btn-brass btn-block" data-host>${icon('users')} Host a ${esc(h.name)} gathering</button>
      ${stored.length ? `<h3 style="margin:16px 0 8px">Get out of storage</h3>${stored.map(storageRow).join('')}` : `<p class="small muted" style="margin-top:14px">Tip: tag things like the roasting pan or cookie cutters with “${esc(h.tag)}” and they'll show up here with their exact location.</p>`}
      ${rs.length ? `<h3 style="margin:16px 0 8px">Recipes for the day</h3>${rs.slice(0, 10).map(({ r, m }) => `<button class="irow" style="width:100%;text-align:left" data-r="${r.id}"><span class="em">${r.emoji}</span><span class="t"><b>${esc(r.title)}</b><small>${m.have}/${m.total} on hand</small></span>${icon('next')}</button>`).join('')}` : ''}`,
    onMount: (b, close) => {
      $$('[data-r]', b).forEach(x => x.onclick = () => actions.openRecipe(x.dataset.r));
      $$('[data-item]', b).forEach(x => x.onclick = () => { close(); actions.revealItem(x.dataset.item); });
      $('[data-host]', b).onclick = () => { close(); eventEditor({ date, kind: 'gathering', title: h.name, emoji: h.emoji, guests: 8, recipeIds: rs.slice(0, 4).map(x => x.r.id), slot: 'Dinner' }); };
    },
  });
}

// ---------- editor ----------
export function eventEditor(e = {}) {
  const isNew = !e.id;
  const ev = { id: uid(), date: today(), kind: 'meal', slot: 'Dinner', title: '', emoji: '🍽️', recipeIds: [], guests: state.settings.household || 2, notes: '', ...e };
  let picked = new Set(ev.recipeIds);
  openSheet({
    title: isNew ? 'Plan something' : 'Edit plan',
    html: `
      <div class="seg" data-kind style="margin-bottom:14px">${[['meal', '🍽️ Meal'], ['gathering', '🎉 Gathering'], ['reminder', '🔔 Reminder']].map(([v, l]) => `<button type="button" data-v="${v}" class="${ev.kind === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="row" style="gap:10px"><label class="field" style="width:76px"><span>Icon</span><input class="input" name="emoji" value="${attr(ev.emoji)}" style="text-align:center;font-size:24px"></label><label class="field grow"><span>Title</span><input class="input" name="title" value="${attr(ev.title)}" placeholder="Taco Tuesday"></label></div>
      <div class="row" style="gap:10px"><label class="field grow"><span>Date</span><input class="input" type="date" name="date" value="${ev.date}"></label><label class="field grow"><span>Meal</span><select class="input" name="slot">${['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', ''].map(s => `<option value="${s}" ${s === ev.slot ? 'selected' : ''}>${s || '—'}</option>`).join('')}</select></label></div>
      <label class="field"><span>People</span><div class="stepper" style="width:fit-content"><button type="button" data-g="-1">−</button><input name="guests" inputmode="numeric" value="${ev.guests}"><button type="button" data-g="1">+</button></div></label>
      <label class="field"><span>Recipes <small data-pc style="text-transform:none"></small></span><input class="input" data-rs placeholder="Search recipes to add…"></label>
      <div data-picked class="row wrap" style="gap:6px;margin:-6px 0 8px"></div>
      <div data-rlist style="max-height:220px;overflow:auto;margin-bottom:12px"></div>
      <label class="field"><span>Notes</span><textarea class="input" name="notes" rows="2" placeholder="Who's bringing what…">${esc(ev.notes)}</textarea></label>
      <button class="btn btn-brass btn-block" data-save>${icon('check')} ${isNew ? 'Add to calendar' : 'Save'}</button>`,
    onMount: (b, close) => {
      let kind = ev.kind;
      segmented($('[data-kind]', b), v => { kind = v; });
      const g = $('[name=guests]', b);
      $$('[data-g]', b).forEach(x => x.onclick = () => { g.value = Math.max(1, Number(g.value || 1) + Number(x.dataset.g)); haptic(); });
      const drawPicked = () => {
        $('[data-picked]', b).innerHTML = [...picked].map(id => recipeById(id)).filter(Boolean).map(r => `<button class="chip on" data-unpick="${r.id}">${r.emoji} ${esc(r.title)} ✕</button>`).join('');
        $$('[data-unpick]', b).forEach(x => x.onclick = () => { picked.delete(x.dataset.unpick); drawPicked(); drawList(); });
      };
      const drawList = () => {
        const q = $('[data-rs]', b).value.toLowerCase();
        const list = allRecipes().filter(r => !q || r.title.toLowerCase().includes(q) || (r.tags || []).some(t => t.includes(q))).slice(0, 30);
        $('[data-rlist]', b).innerHTML = list.map(r => `<label class="irow" style="margin-bottom:6px;padding:6px 10px"><span class="em" style="width:34px;height:34px;font-size:20px">${r.emoji}</span><span class="t"><b style="font-size:14px">${esc(r.title)}</b><small>${recipeMatch(r).have}/${recipeMatch(r).total} on hand</small></span><input type="checkbox" data-pick="${r.id}" ${picked.has(r.id) ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--sage)"></label>`).join('');
        $$('[data-pick]', b).forEach(x => x.onchange = () => { x.checked ? picked.add(x.dataset.pick) : picked.delete(x.dataset.pick); drawPicked(); haptic(); if (!$('[name=title]', b).value && x.checked) { const r = recipeById(x.dataset.pick); $('[name=title]', b).value = r.title; $('[name=emoji]', b).value = r.emoji; } });
      };
      $('[data-rs]', b).oninput = drawList;
      drawPicked(); drawList();
      $('[data-save]', b).onclick = () => {
        const title = $('[name=title]', b).value.trim() || (picked.size ? recipeById([...picked][0])?.title : '') || 'Plan';
        const next = { ...ev, kind, title, emoji: $('[name=emoji]', b).value || '🍽️', date: $('[name=date]', b).value || today(), slot: $('[name=slot]', b).value, guests: Number(g.value) || 1, notes: $('[name=notes]', b).value, recipeIds: [...picked] };
        saveEvent(next); close(); haptic(20);
        const need = next.recipeIds.map(recipeById).filter(Boolean).reduce((a, r) => a + recipeMatch(r).missing.length, 0);
        toast(isNew ? 'Added to your calendar' : 'Saved', { icon: '📅', action: need ? `Shop ${need}` : '', onAction: () => { const n = shopFor(next); toast(`${n} items on your list`, { icon: '🛒' }); } });
        if (isNew) confetti(innerWidth / 2, innerHeight * .5, 16);
      };
    },
  });
}

// Fill empty dinner slots for the next 7 days, prioritizing recipes that rescue expiring food.
async function autoPlan() {
  const ranked = allRecipes().filter(r => r.type === 'Dinner').map(r => ({ r, m: recipeMatch(r) })).sort((a, b) => (b.m.pct + (b.m.usesExpiring ? .5 : 0)) - (a.m.pct + (a.m.usesExpiring ? .5 : 0)));
  const used = new Set(state.events.filter(e => e.date >= today()).flatMap(e => e.recipeIds || []));
  const plan = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(today(), i);
    if (state.events.some(e => e.date === d && e.slot === 'Dinner')) continue;
    const pick = ranked.find(x => !used.has(x.r.id));
    if (!pick) break;
    used.add(pick.r.id); plan.push({ d, r: pick.r, m: pick.m });
  }
  if (!plan.length) { toast('Your dinners are already planned this week', { icon: '✅' }); return; }
  openSheet({
    title: '✨ Suggested week',
    html: `<p class="muted" style="margin-top:0">Built from what you have, using up what's expiring first.</p>${plan.map((p, i) => `<label class="irow"><span class="em">${p.r.emoji}</span><span class="t"><small>${fmtDate(p.d)}</small><b>${esc(p.r.title)}</b><small>${p.m.missing.length ? `${p.m.missing.length} to buy` : 'All on hand'}${p.m.usesExpiring ? ' · rescues expiring food' : ''}</small></span><input type="checkbox" checked data-i="${i}" style="width:22px;height:22px;accent-color:var(--sage)"></label>`).join('')}
      <button class="btn btn-brass btn-block" data-ok style="margin-top:8px">${icon('check')} Plan these</button>`,
    onMount: (b, close) => {
      $('[data-ok]', b).onclick = () => {
        const chosen = $$('[data-i]', b).filter(x => x.checked).map(x => plan[Number(x.dataset.i)]);
        chosen.forEach(p => saveEvent({ id: uid(), date: p.d, kind: 'meal', slot: 'Dinner', title: p.r.title, emoji: p.r.emoji, recipeIds: [p.r.id], guests: state.settings.household, notes: '' }));
        close(); confetti(innerWidth / 2, innerHeight / 2, 30);
        toast(`${chosen.length} dinners planned`, { icon: '📅', action: 'Shop for them', onAction: () => shopRange(today(), addDays(today(), 7)) });
      };
    },
  });
}
