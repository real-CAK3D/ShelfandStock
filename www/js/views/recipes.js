// Recipes matched against what's actually in the kitchen.

import { state, update, allRecipes, recipeById, recipeMatch, addToList, fmtQty, scaleQty, itemStatus, saveEvent, uid, today, removeItem, adjustQty, fmtDate, who } from '../store.js';
import { MEAL_TYPES } from '../data/recipes.js';
import { matchFood, FOOD_BY_ID } from '../data/foods.js';
import { readText, parseRecipeText } from '../services/ocr.js';
import { esc, attr, icon, $, $$, segmented, openSheet, toast, haptic, confetti, confirmBox, flyTo } from '../ui/dom.js';
import { crumb } from '../ui/itemSheet.js';
import { searchMeals, mealsWithIngredient, mealById, randomMeal, mealsFromKitchen } from '../services/mealdb.js';
import { actions } from '../router.js';
import { loader } from '../ui/loader.js';

const ui = { tab: 'now', type: 'all', q: '' };
let online = { results: [], q: '', loading: false, err: '' };

const ringColor = p => p >= .99 ? 'var(--sage)' : p >= .7 ? 'var(--honey)' : 'var(--tomato)';
const art = r => r.image ? `<img src="${attr(r.image)}" alt="" loading="lazy">` : `<span>${r.emoji || '🍽️'}</span>`;
const artBg = r => { const h = [...r.title].reduce((a, c) => a + c.charCodeAt(0), 0); const hues = ['#e9c58f', '#d8a777', '#c9d6a9', '#efc1a4', '#d9c39b', '#b9cfc9']; return hues[h % hues.length]; };

function card(r, m) {
  const fav = state.favorites.includes(r.id);
  return `<button class="rcard" data-r="${r.id}">
    <div class="art" style="background:${artBg(r)}">${art(r)}</div>
    <span class="fav ${fav ? 'on' : ''}" data-fav="${r.id}" role="button" aria-label="Favorite">${fav ? '❤️' : '🤍'}</span>
    ${m ? `<div class="ring" style="--p:${Math.round(m.pct * 100)};--rc:${ringColor(m.pct)}">${m.have}/${m.total}</div>` : ''}
    <div class="body"><h4>${esc(r.title)}</h4><div class="meta">${r.time ? `${icon('clock', 'ic')} ${r.time >= 60 ? Math.floor(r.time / 60) + 'h' + (r.time % 60 ? ' ' + (r.time % 60) + 'm' : '') : r.time + 'm'}` : esc(r.cuisine || '')}${m?.usesExpiring ? ' · <span style="color:var(--honey);font-weight:700">uses expiring</span>' : ''}</div></div>
  </button>`;
}

export function render(root, params = {}) {
  Object.assign(ui, params);
  root.innerHTML = `
    <div style="margin:14px 12px 4px"><div class="seg" data-tabs>${[['now', '🍳 Cook'], ['all', '📖 All'], ['fav', '❤️ Saved'], ['online', '🌍 Online']].map(([v, l]) => `<button data-v="${v}" class="${ui.tab === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div data-body></div>`;
  segmented($('[data-tabs]', root), v => { ui.tab = v; draw(root); });
  root.onclick = async e => {
    const fv = e.target.closest('[data-fav]');
    if (fv) { e.stopPropagation(); toggleFav(fv.dataset.fav); fv.classList.add('on'); return; }
    const r = e.target.closest('[data-r]'); if (r) return openRecipe(r.dataset.r, r);
    const t = e.target.closest('[data-type]'); if (t) { ui.type = t.dataset.type; haptic(); return draw(root); }
    const og = e.target.closest('[data-og]'); if (og) return runOnline(root, og.dataset.og, og.dataset.mode);
    if (e.target.closest('[data-random]')) { online.loading = true; draw(root); try { const m = await randomMeal(); online = { results: m ? [m] : [], q: 'Surprise!', loading: false }; } catch { online = { results: [], loading: false, err: 'offline' }; } return draw(root); }
    if (e.target.closest('[data-ideas]')) return runIdeas(root);
    if (e.target.closest('[data-new]')) return recipeEditor();
    if (e.target.closest('[data-newphoto]')) return recipeEditor({ fromPhoto: true });
  };
  draw(root);
}

function toggleFav(id) {
  update(s => { s.favorites = s.favorites.includes(id) ? s.favorites.filter(x => x !== id) : [...s.favorites, id]; }, 'fav');
  haptic();
}

function draw(root) {
  const body = $('[data-body]', root);
  const types = `<div class="chips" style="margin-top:10px"><button class="chip ${ui.type === 'all' ? 'on' : ''}" data-type="all">Everything</button>${MEAL_TYPES.map(t => `<button class="chip ${ui.type === t ? 'on' : ''}" data-type="${t}">${t}</button>`).join('')}</div>`;
  const pool = allRecipes().filter(r => ui.type === 'all' || r.type === ui.type);
  if (ui.tab === 'now') {
    const scored = pool.map(r => ({ r, m: recipeMatch(r) })).sort((a, b) => b.m.pct - a.m.pct || Number(b.m.usesExpiring) - Number(a.m.usesExpiring) || a.m.missing.length - b.m.missing.length);
    const ready = scored.filter(x => x.m.pct >= .99), close = scored.filter(x => x.m.pct < .99 && x.m.missing.length <= 3), rescue = scored.filter(x => x.m.usesExpiring).slice(0, 8);
    body.innerHTML = types + `
      <div class="row" style="margin:6px 16px 0;justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-newphoto>📷 Add a recipe from a photo</button></div>
      ${rescue.length ? `<div class="section-title"><h2>Rescue what's expiring</h2></div><div class="shelf stagger">${rescue.map(x => card(x.r, x.m)).join('')}</div>` : ''}
      <div class="section-title"><h2>Ready to cook</h2><span class="small muted">${ready.length} recipes</span></div>
      ${ready.length ? `<div class="rgrid stagger">${ready.map(x => card(x.r, x.m)).join('')}</div>` : `<div class="empty" style="padding:20px"><span class="big">🧺</span>Nothing fully stocked yet — see what's close below.</div>`}
      <div class="section-title"><h2>Just a few things away</h2><span class="small muted">≤ 3 missing</span></div>
      <div class="rgrid stagger">${close.slice(0, 16).map(x => card(x.r, x.m)).join('')}</div>`;
  } else if (ui.tab === 'all' || ui.tab === 'fav') {
    const list = ui.tab === 'fav' ? pool.filter(r => state.favorites.includes(r.id)) : pool;
    const q = ui.q.toLowerCase();
    const shown = list.filter(r => !q || `${r.title} ${r.cuisine} ${(r.tags || []).join(' ')} ${r.ingredients.map(i => i.name).join(' ')}`.toLowerCase().includes(q));
    body.innerHTML = `<div class="search">${icon('search')}<input class="input" placeholder="Search title, tag, ingredient…" value="${attr(ui.q)}" data-rq></div>` + types +
      `<div class="row" style="margin:6px 16px 10px;justify-content:space-between"><span class="small muted">${shown.length} recipes</span><span class="row" style="gap:6px"><button class="btn btn-ghost btn-sm" data-newphoto>📷 From a photo</button><button class="btn btn-ghost btn-sm" data-new>${icon('plus')} New</button></span></div>` +
      (shown.length ? `<div class="rgrid stagger">${shown.map(r => card(r, recipeMatch(r))).join('')}</div>` : `<div class="empty"><span class="big">${ui.tab === 'fav' ? '🤍' : '📖'}</span>${ui.tab === 'fav' ? 'Tap the heart on any recipe to save it here.' : 'No recipes match.'}</div>`);
    const rq = $('[data-rq]', body);
    rq.oninput = () => { ui.q = rq.value; const pos = rq.selectionStart; draw(root); const n = $('[data-rq]', root); n.focus(); n.setSelectionRange(pos, pos); };
  } else {
    const exp = state.items.filter(i => ['soon', 'today'].includes(itemStatus(i).key) && i.foodId).slice(0, 6);
    const mains = ['Chicken', 'Beef', 'Salmon', 'Pork', 'Pasta', 'Rice', 'Potatoes', 'Eggs'];
    body.innerHTML = `
      <div class="search">${icon('globe')}<input class="input" placeholder="Search thousands of recipes…" value="${attr(online.q)}" data-oq></div>
      <div style="margin:0 16px 10px"><button class="btn btn-brass btn-block" data-ideas>🧑‍🍳 Ideas from what's in your kitchen</button></div>
      <div class="chips"><button class="chip" data-random>🎲 Surprise me</button>${exp.map(i => `<button class="chip" data-og="${attr(matchFood(i.name)?.name.split(' ')[0] || i.name)}" data-mode="ing">⏰ ${esc(i.name)}</button>`).join('')}${mains.map(m => `<button class="chip" data-og="${m}" data-mode="ing">${m}</button>`).join('')}</div>
      <p class="small muted" style="margin:4px 16px 10px">From TheMealDB. Save any recipe to your book and it gets matched against your kitchen like the rest.</p>
      <div data-oresults></div>`;
    const oq = $('[data-oq]', body);
    oq.onkeydown = e => { if (e.key === 'Enter' && oq.value.trim()) runOnline(root, oq.value.trim(), 'name'); };
    const out = $('[data-oresults]', body);
    if (online.loading) { out.innerHTML = loader(online.status || 'Flipping through cookbooks…', ['📖', '🍳', '🥘']); return; }
    if (online.ideas && online.results.length) {
      // already loaded in full, so each one shows how much of it is in the kitchen, best first
      const scored = online.results.map(r => ({ r, m: recipeMatch(r) })).sort((a, b) => b.m.pct - a.m.pct || a.m.missing.length - b.m.missing.length);
      out.innerHTML = `<div class="section-title" style="margin-top:6px"><h2 style="font-size:17px">Ideas from your kitchen</h2><span class="small muted">using ${esc(online.used.join(', '))}</span></div>
        <p class="small muted" style="margin:0 16px 8px">Ranked by how much you already have. Open one to see what you have, where it is, and add the rest to the list.</p>
        <div class="rgrid stagger">${scored.map(x => card(x.r, x.m)).join('')}</div>`;
      return;
    }
    else if (online.err) out.innerHTML = `<div class="empty"><span class="big">📡</span>Can't reach the recipe library right now. Your built-in recipes still work offline.</div>`;
    else if (online.results.length) out.innerHTML = `<div class="section-title" style="margin-top:6px"><h2 style="font-size:17px">${esc(online.q)}</h2><span class="small muted">${online.results.length} found</span></div><div class="rgrid stagger">${online.results.map(r => card(r, r.partial ? null : recipeMatch(r))).join('')}</div>`;
    else if (online.q) out.innerHTML = `<div class="empty"><span class="big">🤷</span>Nothing for “${esc(online.q)}”. Try one word, like “curry”.</div>`;
  }
}

const onlineCache = new Map();
async function runOnline(root, q, mode) {
  online = { results: [], q: mode === 'ing' ? `With ${q}` : q, loading: true };
  draw(root);
  try {
    const res = mode === 'ing' ? await mealsWithIngredient(q) : await searchMeals(q);
    res.forEach(r => onlineCache.set(r.id, r));
    online = { results: res, q: online.q, loading: false };
  } catch { online = { results: [], q: online.q, loading: false, err: 'offline' }; }
  draw(root);
}

// The main foods in the kitchen to cook around: what's about to go off first, then meat, produce, dairy, grains.
// Not drinks, snacks, sauces, spices, pet food or pans.
const IDEA_WEIGHT = { meat: 3, produce: 2, dairy: 1.5, grains: 1.5, frozen: 1, deli: 1, canned: 0.5, bakery: 0.5 };
function ideaFoods(n = 5) {
  const best = new Map();
  for (const i of state.items) {
    const f = i.foodId && FOOD_BY_ID[i.foodId];
    if (!f || !IDEA_WEIGHT[f.cat] || i.qty <= 0) continue;
    const st = itemStatus(i).key;
    if (st === 'expired') continue;
    const score = IDEA_WEIGHT[f.cat] + (['soon', 'today'].includes(st) ? 3 : 0);
    if ((best.get(f.id)?.score || 0) < score) best.set(f.id, { food: f, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, n).map(x => x.food);
}

async function runIdeas(root) {
  const foods = ideaFoods();
  if (!foods.length) return toast('Add some food to the kitchen first', { icon: '🧺' });
  online = { results: [], q: '', loading: true, status: 'Looking at your kitchen…' };
  draw(root);
  try {
    const res = await mealsFromKitchen(foods, { onStatus: t => { online.status = t; const x = root.querySelector('.loader-text'); if (x) x.textContent = t; } });
    res.forEach(r => onlineCache.set(r.id, r));
    online = { results: res, q: '', loading: false, ideas: true, used: foods.map(f => f.name.toLowerCase()) };
    if (!res.length) online = { results: [], q: 'Ideas from your kitchen', loading: false };
  } catch { online = { results: [], q: '', loading: false, err: 'offline' }; }
  draw(root);
}

async function resolve(id) {
  let r = recipeById(id) || onlineCache.get(id);
  if (r?.partial) { try { r = await mealById(r.idMeal); onlineCache.set(id, r); } catch { toast('Offline — can’t load that recipe'); return null; } }
  return r;
}

// ---------- detail ----------
export async function openRecipe(id, fromEl) {
  const r = await resolve(id);
  if (!r) return;
  const saved = !!recipeById(r.id);
  let servings = r.servings || 4;
  const sheet = openSheet({
    hero: `<div class="sheet-hero" style="background:${artBg(r)};color:var(--ink);padding:0">${r.image ? `<img src="${attr(r.image)}" alt="" style="width:100%;height:200px;object-fit:cover;display:block">` : `<span class="em" style="padding:24px 0 8px">${r.emoji}</span>`}<div style="padding:10px 18px 14px"><h2>${esc(r.title)}</h2><div class="crumb" style="opacity:.75">${[r.type, r.cuisine, r.time && `${r.time} min`].filter(Boolean).map(esc).join(' · ')}</div></div></div>`,
    html: `<div data-rd></div>`,
    onMount: (b, close) => {
      const host = $('[data-rd]', b);
      const draw = () => {
        const m = recipeMatch(r, servings);
        const scale = q => scaleQty(q, r.servings, servings);
        host.innerHTML = `
          <div class="row" style="justify-content:space-between;margin:4px 0 12px">
            <div class="row" style="gap:6px"><span class="muted small" style="font-weight:600">Serves</span><div class="stepper" style="height:38px"><button data-sv="-1">−</button><input value="${servings}" readonly style="width:44px"><button data-sv="1">+</button></div></div>
            <div class="ring" style="position:static;--p:${Math.round(m.pct * 100)};--rc:${ringColor(m.pct)}">${Math.round(m.pct * 100)}%</div>
          </div>
          ${(r.tags || []).length ? `<div class="row wrap" style="gap:6px;margin-bottom:10px">${r.tags.slice(0, 8).map(t => `<span class="pill">#${esc(t)}</span>`).join('')}</div>` : ''}
          <div class="row" style="gap:8px;margin-bottom:8px">
            ${m.missing.length ? `<button class="btn btn-brass grow" data-addmissing>${icon('cart')} Add ${m.missing.length} missing</button>` : `<button class="btn btn-sage grow" data-cooked>${icon('check')} I cooked this</button>`}
            <button class="btn btn-ghost" data-plan>📅 Plan</button>
            <button class="btn btn-ghost" data-fav>${state.favorites.includes(r.id) ? '❤️' : '🤍'}</button>
          </div>
          ${!saved ? `<button class="btn btn-wood wood-mid btn-block" data-save style="margin-bottom:8px">${icon('download')} Save to my recipe book</button>` : ''}
          ${m.missing.length ? `<button class="btn btn-ghost btn-block btn-sm" data-cooked style="margin-bottom:8px">Cook it anyway</button>` : ''}
          ${(() => { // the answer at a glance: what's here and what to buy
            const nm = x => esc((x.food?.name || x.ing.name).toLowerCase());
            const have = m.rows.filter(x => x.have), buy = m.rows.filter(x => !x.have && !x.ing.optional);
            return `<div class="rc-sum">${have.length ? `<div><b>✅ You have ${have.length}</b> ${have.map(nm).join(', ')}</div>` : ''}${buy.length ? `<div><b>🛒 To buy ${buy.length}</b> ${buy.map(x => nm(x) + (x.short ? ' (more)' : '')).join(', ')}</div>` : '<div><b>🎉 Everything is here.</b></div>'}</div>`;
          })()}
          <h3 style="margin:14px 0 4px">Ingredients</h3>
          <div>${m.rows.map(x => { const k = x.have ? 'have' : x.short ? 'short' : x.ing.optional ? 'opt' : 'miss'; const where = x.stock[0]; return `<div class="ing ${k}"><span class="mark">${x.have ? '✓' : x.short ? '½' : x.ing.optional ? '–' : '✕'}</span><span class="grow"><b style="font-weight:600">${fmtQty(scale(x.ing.qty))} ${esc(x.ing.unit)}</b> ${esc(x.ing.name)}${x.ing.note ? ` <span class="muted">· ${esc(x.ing.note)}</span>` : ''}${x.ing.optional ? ' <span class="muted">(optional)</span>' : ''}
            <div class="where">${where ? `📍 <button data-where="${where.id}">${esc(crumb(where))}</button> · ${fmtQty(where.qty)} ${esc(where.unit)}${x.short ? ` · <span style="color:var(--honey);font-weight:700">need ${fmtQty(x.short)} ${esc(x.ing.unit)} more</span>` : ''}${x.expiring ? ' · <span style="color:var(--honey);font-weight:700">use soon</span>' : ''}` : x.staple ? 'Pantry staple' : x.have ? '' : 'Not in your kitchen'}</div></span>
            ${!x.have ? `<button class="btn btn-ghost btn-sm" data-one="${attr(x.food?.name || x.ing.name)}" data-q="${x.short || x.need}" data-u="${attr(x.ing.unit)}">${icon('plus')}</button>` : ''}</div>`; }).join('')}</div>
          <h3 style="margin:18px 0 10px">Steps</h3>
          <ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          ${r.video ? `<a class="btn btn-ghost btn-block" href="${attr(r.video)}" target="_blank" rel="noopener">▶ Watch video</a>` : ''}
          ${r.source === 'user' || r.source === 'mealdb' ? `<button class="btn btn-ghost btn-block btn-sm" data-delete style="margin-top:10px;color:var(--tomato)">${icon('trash')} Remove from my book</button>` : ''}
          ${r.source === 'mealdb' ? '<p class="small muted" style="text-align:center">Recipe via TheMealDB</p>' : ''}`;
        $$('[data-sv]', host).forEach(btn => btn.onclick = () => { servings = Math.max(1, servings + Number(btn.dataset.sv) * (servings >= 12 ? 2 : 1)); haptic(); draw(); });
        $('[data-addmissing]', host)?.addEventListener('click', e => {
          let n = 0;
          for (const x of m.missing) if (addToList({ name: x.food?.name || x.ing.name, foodId: x.food?.id, qty: x.short || x.need, unit: x.ing.unit, reason: r.title })) n++;
          flyTo(e.currentTarget, '.tab[data-v=list]', '🛒'); haptic(25);
          toast(n ? `${n} item${n > 1 ? 's' : ''} added to your list` : 'Already on your list', { icon: '🛒' }); draw();
        });
        $$('[data-one]', host).forEach(btn => btn.onclick = () => { addToList({ name: btn.dataset.one, qty: Number(btn.dataset.q), unit: btn.dataset.u, reason: r.title }); flyTo(btn, '.tab[data-v=list]', '🛒'); haptic(); toast(`${btn.dataset.one} → list`, { icon: '🛒' }); });
        $$('[data-where]', host).forEach(btn => btn.onclick = () => { close(); actions.revealItem(btn.dataset.where); });
        $('[data-fav]', host).onclick = () => { if (!saved && !recipeById(r.id)) saveRecipe(r); toggleFav(r.id); draw(); };
        $('[data-save]', host)?.addEventListener('click', () => { saveRecipe(r); toast('Saved to your recipe book', { icon: '📖' }); confetti(innerWidth / 2, 200, 16); $('[data-save]', host)?.remove(); });
        $$('[data-cooked]', host).forEach(btn => btn.onclick = () => cookedFlow(r, m, servings));
        $('[data-plan]', host).onclick = () => planRecipe(r, servings);
        $$('.steps li', host).forEach(li => li.onclick = () => { li.classList.toggle('done'); haptic(); });
        $('[data-delete]', host)?.addEventListener('click', async () => { if (!await confirmBox(`Remove “${r.title}” from your book?`, { ok: 'Remove', danger: true })) return; update(s => { s.recipes = s.recipes.filter(x => x.id !== r.id); s.favorites = s.favorites.filter(x => x !== r.id); }); close(); toast('Removed'); });
      };
      draw();
    },
  });
  return sheet;
}

function saveRecipe(r) {
  if (recipeById(r.id)) return;
  update(s => { s.recipes.unshift({ ...r, partial: undefined }); }, 'recipe-save');
}

function cookedFlow(r, m, servings) {
  const used = m.rows.filter(x => x.stock.length);
  openSheet({
    title: 'Nice! What did you use?',
    html: `<p class="muted" style="margin-top:0">Tick anything you used. “Used up” removes it; otherwise we'll take one off.</p>
      ${used.map((x, i) => { const it = x.stock[0]; return `<div class="irow"><span class="em">${it.emoji}</span><span class="t"><b>${esc(it.name)}</b><small>${fmtQty(it.qty)} ${esc(it.unit)} · ${esc(crumb(it))}</small></span>
        <select class="input" style="width:118px;height:38px;font-size:13px" data-use="${it.id}"><option value="none">Didn’t use</option><option value="some" ${it.unit === x.ing.unit || it.unit === 'ea' ? '' : 'selected'}>Used some</option><option value="one" ${it.unit === x.ing.unit || it.unit === 'ea' ? 'selected' : ''}>Take ${fmtQty(it.unit === x.ing.unit ? scaleQty(x.ing.qty, r.servings, servings) : 1)}</option><option value="all">Used up</option></select></div>`; }).join('') || '<p class="muted">Nothing from your kitchen matched.</p>'}
      <label class="row" style="margin:12px 0"><span class="toggle"><input type="checkbox" data-left checked><i></i></span><span>Save leftovers to the fridge</span></label>
      <button class="btn btn-brass btn-block" data-done>${icon('check')} Done</button>`,
    onMount: (b, close) => {
      $('[data-done]', b).onclick = () => {
        for (const sel of $$('[data-use]', b)) {
          const it = state.items.find(i => i.id === sel.dataset.use); if (!it) continue;
          const x = used.find(u => u.stock[0].id === it.id);
          if (sel.value === 'all') removeItem(it.id, 'used');
          else if (sel.value === 'one') adjustQty(it.id, -(it.unit === x.ing.unit ? scaleQty(x.ing.qty, r.servings, servings) : 1));
          else if (sel.value === 'some') adjustQty(it.id, -Math.min(Number(it.qty), Number(it.qty) * 0.25));
        }
        if ($('[data-left]', b).checked) actions.quickAdd({ name: `Leftover ${r.title}`, foodId: 'leftovers', emoji: r.emoji, qty: 1, unit: 'container', ...(state.zones.some(z => z.sections.some(x => x.id === 'fr-top')) ? { sectionId: 'fr-top' } : {}) }); // top shelf, if it's still there
        update(s => { s.history.push({ ts: Date.now(), by: who(), type: 'cooked', name: r.title, recipeId: r.id }); }, 'cooked');
        close(); confetti(innerWidth / 2, innerHeight / 2, 40); toast(`Cooked ${r.title}!`, { icon: '👩‍🍳' });
      };
    },
  });
}

function planRecipe(r, servings) {
  openSheet({
    title: `Plan ${esc(r.title)}`,
    html: `<label class="field"><span>Day</span><input class="input" type="date" name="date" value="${today()}"></label>
      <label class="field"><span>Meal</span><select class="input" name="slot">${['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].map(s => `<option ${s === (r.type === 'Breakfast' ? 'Breakfast' : r.type === 'Lunch' ? 'Lunch' : 'Dinner') ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="field"><span>People</span><input class="input" type="number" name="guests" value="${servings}" min="1"></label>
      <label class="row" style="margin:4px 0 14px"><span class="toggle"><input type="checkbox" name="shop" checked><i></i></span><span>Put missing ingredients on the list</span></label>
      <button class="btn btn-brass btn-block" data-ok>📅 Add to calendar</button>`,
    onMount: (b, close) => {
      $('[data-ok]', b).onclick = () => {
        if (!recipeById(r.id)) saveRecipe(r);
        const date = $('[name=date]', b).value || today(), guests = Number($('[name=guests]', b).value) || servings;
        saveEvent({ id: uid(), date, kind: 'meal', slot: $('[name=slot]', b).value, title: r.title, emoji: r.emoji, recipeIds: [r.id], guests, notes: '' });
        if ($('[name=shop]', b).checked) for (const x of recipeMatch(r, guests).missing) addToList({ name: x.food?.name || x.ing.name, foodId: x.food?.id, qty: x.short || x.need, unit: x.ing.unit, reason: `${r.title} · ${fmtDate(date)}` });
        close(); haptic(20); toast(`Planned for ${fmtDate(date)}`, { icon: '📅', action: 'View', onAction: () => actions.go('plan', { date }) });
      };
    },
  });
}

// ---------- create your own (typed, or read off a photo of a recipe card or cookbook page) ----------
export function recipeEditor({ fromPhoto = false } = {}) {
  openSheet({
    title: fromPhoto ? '📷 Recipe from a photo' : 'New recipe',
    html: `<form autocomplete="off">
      <div class="row" style="gap:8px;margin-bottom:6px"><label class="btn ${fromPhoto ? 'btn-brass' : 'btn-wood wood-mid'} grow">📷 ${fromPhoto ? 'Take a picture of the recipe' : 'Fill from a photo'}<input type="file" accept="image/*" capture="environment" data-rphoto hidden></label><label class="btn btn-ghost" title="Pick photos (a recipe on two pages works too)">🖼️<input type="file" accept="image/*" multiple data-rphoto hidden></label></div>
      <div data-rpout>${fromPhoto ? '<p class="small muted" style="margin:4px 2px 10px">A recipe card, a cookbook page or a printout. Flat, in good light, filling the screen. Then check what was read before saving.</p>' : ''}</div>
      <div class="row" style="gap:10px"><label class="field" style="width:76px"><span>Icon</span><input class="input" name="emoji" value="🍲" maxlength="4" style="text-align:center;font-size:24px"></label><label class="field grow"><span>Title</span><input class="input" name="title" required placeholder="Grandma's chili"></label></div>
      <div class="row" style="gap:10px"><label class="field grow"><span>Type</span><select class="input" name="type">${MEAL_TYPES.map(t => `<option ${t === 'Dinner' ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="field" style="width:90px"><span>Serves</span><input class="input" name="servings" type="number" value="4"></label><label class="field" style="width:90px"><span>Minutes</span><input class="input" name="time" type="number" value="30"></label></div>
      <label class="field"><span>Ingredients — one per line</span><textarea class="input" name="ing" rows="6" placeholder="2 lb ground beef&#10;1 can kidney beans&#10;1 onion, diced&#10;2 tbsp chili powder"></textarea></label>
      <div data-ingprev class="ing-prev"></div>
      <label class="field"><span>Steps — one per line</span><textarea class="input" name="steps" rows="5"></textarea></label>
      <label class="field"><span>Tags</span><input class="input" name="tags" placeholder="comfort, game day"></label>
      <label class="row" style="margin:4px 0 12px"><span class="toggle"><input type="checkbox" name="shop" ${fromPhoto ? 'checked' : ''}><i></i></span><span>Add what I’m missing to the shopping list</span></label>
      <button class="btn btn-brass btn-block">${icon('check')} Save recipe</button></form>`,
    onMount: (b, close) => {
      const f = $('form', b), prev = $('[data-ingprev]', b);
      // how each ingredient line was understood, and whether it's already in the kitchen
      const preview = () => {
        const lines = f.ing.value.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) { prev.innerHTML = ''; return; }
        const ings = lines.map(parseLine), servings = Number(f.servings.value) || 4;
        const missing = new Set(recipeMatch({ ingredients: ings, servings }, servings).missing.map(x => x.ing));
        const tap = i => /^\s*(cold |warm |hot |boiling |ice |lukewarm |tap )?water\s*$/i.test(i.name);
        prev.innerHTML = ings.map(i => `<div class="ing-row ${tap(i) ? 'have' : !i.foodId ? 'unknown' : missing.has(i) ? 'missing' : 'have'}"><span>${tap(i) ? '🚰' : !i.foodId ? '❓' : missing.has(i) ? '🛒' : '✅'}</span><b>${esc(fmtQty(i.qty))} ${esc(i.unit === 'ea' ? '' : i.unit)} ${esc(i.name)}</b><small>${tap(i) ? 'from the tap' : !i.foodId ? 'not in the food list (still saved)' : missing.has(i) ? 'need to buy' : 'you have it'}</small></div>`).join('');
      };
      f.ing.addEventListener('input', preview); f.servings.addEventListener('input', preview);
      b.querySelectorAll('[data-rphoto]').forEach(inp => inp.onchange = async () => {
        const files = [...inp.files]; inp.value = ''; if (!files.length) return;
        const out = $('[data-rpout]', b);
        out.innerHTML = loader('Reading the recipe…', ['📖', '🔍', '🥕']);
        try {
          let text = '';
          for (const file of files) text += '\n' + await readText(file, t => { const x = out.querySelector('.loader-text'); if (x) x.textContent = t; }, { mode: 'recipe' });
          const r = parseRecipeText(text);
          if (!r.ingredients.length && !r.steps.length) { out.innerHTML = '<div class="where-banner">🤔 <span>Couldn’t make out a recipe. Try a flatter, closer photo.</span></div>'; return; }
          if (r.title) f.title.value = r.title;
          if (r.servings) f.servings.value = r.servings;
          if (r.time) f.time.value = r.time;
          f.ing.value = r.ingredients.join('\n'); f.steps.value = r.steps.join('\n');
          const guess = matchFood(r.title); if (guess) f.emoji.value = guess.emoji;
          out.innerHTML = `<div class="where-banner" style="background:var(--sage-2);color:var(--sage);margin-bottom:10px">📖 <span>Read <b>${r.ingredients.length} ingredients</b> and <b>${r.steps.length} steps</b>. Check them below and fix anything that came out wrong.</span></div>`;
          preview(); haptic(20);
        } catch (e) { out.innerHTML = '<div class="where-banner">📡 <span>The text reader needs an internet connection the first time.</span></div>'; }
      });
      f.onsubmit = e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        const ingredients = d.ing.split('\n').map(l => l.trim()).filter(Boolean).map(parseLine);
        const r = { id: 'u-' + uid(), source: 'user', title: d.title.trim(), emoji: d.emoji || '🍲', type: d.type, cuisine: '', time: Number(d.time) || null, servings: Number(d.servings) || 4, tags: d.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean), ingredients, steps: d.steps.split('\n').map(s => s.trim()).filter(Boolean) };
        update(s => { s.recipes.unshift(r); }, 'recipe-new');
        let n = 0;
        if (d.shop) for (const x of recipeMatch(r).missing) if (addToList({ name: x.food?.name || x.ing.name, foodId: x.food?.id, qty: x.short || x.need, unit: x.ing.unit, reason: r.title })) n++;
        close(); toast(n ? `Recipe saved · ${n} item${n > 1 ? 's' : ''} added to your list` : 'Recipe saved', { icon: '📖' }); openRecipe(r.id);
      };
    },
  });
}

const UNITS_RE = /^(cups?|tbsp|tablespoons?|tsp|teaspoons?|lbs?|pounds?|oz|ounces?|g|grams?|kg|ml|l|cans?|jars?|cloves?|bunch(?:es)?|heads?|packets?|pinch|dozen|pints?|quarts?|qt|gal|bags?|box(?:es)?|sticks?|slices?)\b/i;
export function parseLine(line) {
  // ½, 1½, ¾ … as 1/2, 1 1/2, 3/4
  line = line.replace(/(\d)?\s*([¼½¾⅓⅔⅛])/g, (m, w, f) => `${w ? w + ' ' : ''}${{ '¼': '1/4', '½': '1/2', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8' }[f]}`);
  // common photo misreads: "lb" as "1b"/"Ib", and "1 1/2" run together as "11/2" (eleven halves)
  line = line.replace(/(\d)\s*[1I]b(s?)\b/g, '$1 lb$2').replace(/^(\s*)(\d)([1-7])\/([2348])\b/, (m, sp, w, n, d) => Number(n) < Number(d) ? `${sp}${w} ${n}/${d}` : m);
  let qty = 1, unit = 'ea', rest = line;
  const m = rest.match(/^(\d+\s+\d\/\d|\d+\/\d|\d*\.?\d+)\s*/);
  if (m) { qty = m[1].includes('/') ? m[1].split(/\s+/).reduce((a, p) => { const [x, y] = p.split('/'); return a + (y ? x / y : Number(x)); }, 0) : Number(m[1]); rest = rest.slice(m[0].length); }
  const u = rest.match(UNITS_RE);
  if (u) { unit = u[1].toLowerCase().replace(/^tablespoons?$/, 'tbsp').replace(/^teaspoons?$/, 'tsp').replace(/^(pounds?|lbs)$/, 'lb').replace(/^ounces?$/, 'oz').replace(/(ch|sh|x|ss)es$/, '$1').replace(/([^s])s$/, '$1'); rest = rest.slice(u[0].length).trim(); } // bunches → bunch, boxes → box, cans → can
  const [name, ...note] = rest.split(',');
  // "water", "hot water", "ice water" in a recipe is from the tap, not something to buy
  const food = /^\s*(cold |warm |hot |boiling |ice |lukewarm |tap )?water\s*$/i.test(name) ? null : matchFood(name);
  return { qty: Math.round(qty * 100) / 100, unit, name: food?.name || name.trim(), note: note.join(',').trim(), optional: /optional/i.test(line), foodId: food?.id || null };
}
