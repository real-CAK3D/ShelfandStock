// Scan a receipt → check the lines → save prices for that store, put the groceries in the kitchen,
// and take them off the shopping list. Then offer to read the real dates off the packages.

import { state, update, recordReceipt, money, stockFromReceipt, matchingItem, sectionById, parseQty, kindFrom } from '../store.js';
import { FOOD_BY_ID, UNITS, GEAR_CATS } from '../data/foods.js';
import { suggestSection } from '../data/layout.js';
import { attachPicker } from './foodpicker.js';
import { readText, parseReceipt, matchName, cleanReceiptName, usingPhoneReader } from '../services/ocr.js';
import { openSheet, esc, attr, toast, haptic, confetti, icon } from './dom.js';
import { loader } from './loader.js';
import { currentStore } from '../services/stores.js';
import { labelWalk, locationSelect } from './itemSheet.js';

// Several photos: one long receipt in pieces, or a few different receipts. Each photo is read on its own;
// lines repeated where two photos overlap (or the same photo picked twice) only count once.
const lineKey = it => `${String(it.raw || it.name).toLowerCase().replace(/[^a-z0-9]/g, '')}|${Number(it.paid).toFixed(2)}`;
export function mergeReceipts(parts) {
  const items = [], totals = [];
  let store = '';
  for (const p of parts) {
    store = guessStore(p.head)?.name || store;
    const next = p.items.map(it => ({ ...it, store }));
    let overlap = 0;
    for (let k = Math.min(items.length, next.length); k > 0; k--) if (next.slice(0, k).every((x, n) => lineKey(x) === lineKey(items[items.length - k + n]))) { overlap = k; break; }
    items.push(...next.slice(overlap));
    if (p.total != null && !totals.includes(p.total)) totals.push(p.total);
  }
  return { items, total: totals.length ? Math.round(totals.reduce((a, t) => a + t, 0) * 100) / 100 : null, head: parts.map(p => p.head).join('\n') };
}

// prefill: { files } shared photos/screenshots, or { text } a receipt shared as text (e.g. from a store's app)
export function receiptFlow(prefill = {}) {
  if (prefill.text && !prefill.files?.length) { const r = parseReceipt(prefill.text); if (r.items.length) return oneByOne(mergeReceipts([r])); }
  const photos = [];
  openSheet({
    title: '🧾 Add a receipt',
    html: `<p class="muted" style="margin-top:0">Take a picture of each receipt, or of each part of a long one. We read them, then ask about one thing at a time before it goes in your kitchen.</p>
      <ul class="small muted" style="margin:0 0 12px 18px;padding:0;line-height:1.5"><li>Lay it flat on a dark table, smooth out the creases</li><li>Fill the screen with it and hold steady so the small print is sharp</li></ul>
      <div class="rc-thumbs" data-thumbs></div>
      <div class="row" style="gap:8px"><label class="btn btn-brass grow"><span data-takelbl>📸 Take a picture</span><input type="file" accept="image/*" capture="environment" data-rc hidden></label><label class="btn btn-ghost">🖼️ Choose photos<input type="file" accept="image/*" multiple data-rc hidden></label></div>
      <button class="btn btn-sage btn-block" style="margin-top:10px" data-read hidden></button>
      <p class="small muted" style="margin:10px 2px 0">${usingPhoneReader() ? '✨ Using your phone’s built-in text reader.' : 'Tip: the Android app reads receipts much more accurately than the browser.'}</p>
      <div data-rcout></div>`,
    onClose: () => photos.forEach(p => URL.revokeObjectURL(p.url)),
    onMount: (b, close) => {
      const out = b.querySelector('[data-rcout]');
      const draw = () => {
        b.querySelector('[data-thumbs]').innerHTML = photos.map((p, i) => `<span class="rc-thumb"><img src="${attr(p.url)}" alt="Receipt photo ${i + 1}"><button type="button" data-unphoto="${i}" aria-label="Remove photo ${i + 1}">${icon('close')}</button></span>`).join('');
        const read = b.querySelector('[data-read]');
        read.hidden = !photos.length;
        read.textContent = `🔍 Read ${photos.length} photo${photos.length === 1 ? '' : 's'}`;
        b.querySelector('[data-takelbl]').textContent = photos.length ? '📸 Take another' : '📸 Take a picture';
      };
      const addPhotos = files => { for (const file of files) photos.push({ file, url: URL.createObjectURL(file) }); out.innerHTML = ''; haptic(); draw(); };
      const go = async () => {
        out.innerHTML = loader('Reading your receipt…', ['🧾', '🔍', '💵']);
        try {
          const parts = [], unread = [];
          for (const [n, p] of photos.entries()) {
            const text = await readText(p.file, t => { const x = out.querySelector('.loader-text'); if (x) x.textContent = photos.length > 1 ? `Photo ${n + 1} of ${photos.length}: ${t}` : t; }, { mode: 'receipt' });
            const r = parseReceipt(text);
            if (r.items.length) parts.push(r); else unread.push(n + 1);
          }
          if (!parts.length) { out.innerHTML = '<div class="where-banner" style="margin-top:10px">🤔 <span>Couldn’t find any groceries. Try a flatter, brighter photo of the whole receipt.</span></div>'; return; }
          close();
          if (unread.length) toast(`Couldn’t read photo${unread.length > 1 ? 's' : ''} ${unread.join(', ')}`, { icon: '🤔', ms: 4500 });
          oneByOne(mergeReceipts(parts));
        } catch (e) { out.innerHTML = '<div class="where-banner" style="margin-top:10px">📡 <span>The text reader needs an internet connection the first time.</span></div>'; }
      };
      b.querySelectorAll('[data-rc]').forEach(inp => inp.onchange = () => { const files = [...inp.files]; inp.value = ''; if (files.length) addPhotos(files); });
      b.querySelector('[data-thumbs]').onclick = e => { const x = e.target.closest('[data-unphoto]'); if (!x) return; const [gone] = photos.splice(Number(x.dataset.unphoto), 1); URL.revokeObjectURL(gone.url); draw(); };
      b.querySelector('[data-read]').onclick = go;
      if (prefill.files?.length) { addPhotos(prefill.files); go(); }
    },
  });
}

const RC_UNITS = () => [...new Set(['ea', 'pack', 'lb', 'oz', 'gal', 'dozen', 'bag', 'box', 'can', 'jar', 'bottle', ...UNITS])];
const lineFor = (x, store) => ({ name: x.name, foodId: x.food?.id || null, qty: x.qty, unit: x.unit, cat: x.food?.cat || 'pantry', emoji: x.food?.emoji || '🛒', store, price: Number(x.paid) || null, raw: x.raw, brand: brandOf(x.raw), size: sizeOf(x.raw), kind: kindFrom(cleanReceiptName(x.raw), '', x.food), sectionId: x.sectionId });

// One thing at a time: is this right? Each yes goes into the kitchen right then, so stopping halfway keeps
// what's been checked. Back takes the last one out again.
function oneByOne(r) {
  const rows = r.items.map(it => ({ ...it }));
  const guess = guessStore(r.head);
  const names = [...new Set([...(state.stores || []).map(s => s.name), ...(guess ? [guess.name] : []), ...rows.map(x => x.store).filter(Boolean)])];
  let i = 0, stopped = false, seeAll = false;
  const added = () => rows.filter(x => x.done);
  const spent = () => Math.round(added().reduce((a, x) => a + (Number(x.paid) || 0), 0) * 100) / 100;
  const finish = () => {
    const by = new Map();
    for (const x of added()) if (Number(x.paid) > 0) (by.get(x.done.store) || by.set(x.done.store, []).get(x.done.store)).push({ name: x.name, foodId: x.food?.id || null, price: Number(x.paid) });
    for (const [store, items] of by) recordReceipt({ store, storeId: (state.stores || []).find(s => s.name === store)?.id, total: by.size === 1 ? r.total : undefined, items });
  };
  openSheet({
    title: '🧾 Is this right?',
    html: '<div data-one></div>',
    onClose: () => { if (!stopped) { stopped = true; finish(); if (!seeAll && !added().length) toast('Nothing added', { icon: '🧾' }); } },
    onMount: (b, close) => {
      const host = b.querySelector('[data-one]');
      let store = rows[0]?.store || guess?.name || '';
      const draw = () => {
        if (i >= rows.length) {
          const placed = added().map(x => x.done.placed), ticked = added().filter(x => x.done.ticked).length, t = r.total, s = spent();
          close(); haptic(25);
          if (!placed.length) return;
          confetti(innerWidth / 2, innerHeight / 2, 26);
          putAwaySheet(placed, added()[0].done.store, ticked, t == null ? '' : Math.abs(s - t) <= Math.max(0.05, t * 0.12) ? `✅ These add up to ${money(s)} of the ${money(t)} total.` : `⚠️ These add up to ${money(s)} but the receipt says ${money(t)}. Tax, or something skipped or misread.`);
          return;
        }
        const it = rows[i];
        it.store ||= store;
        const have = matchingItem(it.food?.id, it.unit, brandOf(it.raw), kindFrom(cleanReceiptName(it.raw), '', it.food), it.name);
        it.sectionId ||= suggestSection(it.food, state.zones, { cat: it.food?.cat || 'pantry', name: it.name });
        host.innerHTML = `
          <div class="rc-progress"><span>${i + 1} of ${rows.length}</span><i style="width:${Math.round((i + 1) / rows.length * 100)}%"></i></div>
          <label class="field"><span>Store</span><input class="input" data-store list="rc-stores1" value="${attr(store)}" placeholder="Which store?"><datalist id="rc-stores1">${names.map(n => `<option value="${attr(n)}">`).join('')}</datalist></label>
          <p class="small muted" style="margin:-4px 2px 10px">On the receipt: <span class="rc-raw">${esc(it.raw)}</span>${it.sure === 'check' ? ' <span class="pill warn">best guess</span>' : ''}${it.discount ? ` <span class="pill ok">saved ${money(it.discount)}</span>` : ''}${it.fixed ? ' <span class="pill warn">price fixed from its quantity line</span>' : ''}</p>
          <div class="row pick-host" style="gap:10px;align-items:flex-end;margin-bottom:12px"><span class="em rc-one-em">${it.food?.emoji || '🛒'}</span><label class="field grow" style="margin:0"><span>What is it?</span><input class="input" data-name value="${attr(it.name)}" autocomplete="off"></label></div>
          <div class="row" style="gap:8px"><label class="field" style="width:25%"><span>Amount</span><input class="input" data-qty value="${attr(it.qty)}" inputmode="decimal"></label><label class="field grow"><span>Unit</span><select class="input" data-unit>${RC_UNITS().map(u => `<option ${u === it.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label><label class="field" style="width:30%"><span>Paid</span><input class="input" data-price value="${Number(it.paid).toFixed(2)}" inputmode="decimal"></label></div>
          ${have ? `<div class="where-banner" style="margin-bottom:12px">➕ <span>Adds to the <b>${esc(have.name)}</b> you already have</span></div>` : `<label class="field"><span>Where it goes</span>${locationSelect(it.sectionId)}</label>`}
          <button class="btn btn-brass btn-block" data-yes>${icon('check')} Yes, add it</button>
          <div class="row" style="gap:8px;margin-top:8px"><button class="btn btn-ghost grow" data-back ${i ? '' : 'disabled'}>← Back</button><button class="btn btn-ghost grow" data-skip>Skip it</button></div>
          ${rows.length - i > 1 ? `<button class="link" style="display:block;margin:12px auto 0" data-seeall>See ${i ? `the remaining ${rows.length - i}` : `all ${rows.length}`} at once</button>` : ''}`;
        const q = s => host.querySelector(s);
        const take = () => {
          store = q('[data-store]').value.trim(); it.store = store;
          const v = parseQty(q('[data-qty]').value); if (isFinite(v) && v > 0) it.qty = v;
          it.unit = q('[data-unit]').value;
          const p = Number(q('[data-price]').value.replace('$', '')); if (isFinite(p)) it.paid = p;
          if (q('[name=sectionId]')) it.sectionId = q('[name=sectionId]').value;
          const nm = q('[data-name]').value.trim();
          if (nm && nm !== it.name) rename(it, { name: nm, typed: true });
        };
        const rename = (x, h) => {
          const m = h.typed ? matchName(cleanReceiptName(h.name) || h.name.toLowerCase()) : { food: h.foodId ? FOOD_BY_ID[h.foodId] : null };
          x.name = m.food?.name || h.name; x.food = m.food || null; x.sectionId = null;
          if (m.food) x.unit = m.food.unit;
        };
        attachPicker(q('[data-name]'), h => { take(); rename(it, h); draw(); }, { online: false });
        q('[data-yes]').onclick = () => {
          take();
          const was = structuredClone(state.items), list = structuredClone(state.shopping), hist = state.history.length;
          const [placed] = stockFromReceipt([lineFor(it, store || 'Unknown store')]);
          it.done = { placed, prev: was.find(x => x.id === placed.item.id) || null, list, hist, store: store || 'Unknown store', ticked: list.length > state.shopping.length };
          haptic(15); i++; draw();
        };
        q('[data-skip]').onclick = () => { take(); haptic(); i++; draw(); };
        q('[data-back]').onclick = () => { take(); i = Math.max(0, i - 1); undo(rows[i]); draw(); };
        q('[data-seeall]')?.addEventListener('click', () => { take(); seeAll = true; const rest = rows.slice(i); close(); review({ ...r, items: rest, storeHint: store }); });
      };
      draw();
    },
  });
}

// put a line that was said yes to back the way it was
function undo(x) {
  if (!x?.done) return;
  const { placed, prev, list, hist } = x.done;
  update(s => {
    s.items = prev ? s.items.map(it => it.id === prev.id ? prev : it) : s.items.filter(it => it.id !== placed.item.id);
    for (const e of list) if (!s.shopping.some(y => y.id === e.id)) s.shopping.push(e);
    if (s.history.length > hist) s.history.length = hist;
  }, 'item-undo');
  x.done = null;
}

// store brands as receipts print them, and the pack size on the line ("GV 2% MLK GAL" → Great Value, "5LB" → 5 lb)
const STORE_BRANDS = [[/\bgv\b|great value/i, 'Great Value'], [/\bhnfd\b|hannaford/i, 'Hannaford'], [/\bks\b|kirkland/i, 'Kirkland'], [/mkt\s*pntry|market pantry/i, 'Market Pantry'], [/good\s*&\s*gather/i, 'Good & Gather'], [/\bsig\b|signature/i, 'Signature Select'], [/nature'?s promise/i, "Nature's Promise"], [/members mark|\bmm\b/i, "Member's Mark"]];
const brandOf = raw => (STORE_BRANDS.find(([re]) => re.test(raw)) || [, ''])[1];
const sizeOf = raw => { const m = raw.match(/\b(\d+(?:\.\d+)?)\s?(lb|lbs|oz|fl oz|gal|ct|pk|dz|qt)\b/i) || raw.match(/\b(gal|gallon|half gal|dozen)\b/i); return m ? (m[2] ? `${m[1]} ${m[2].toLowerCase().replace('lbs', 'lb')}` : m[1].toLowerCase()) : ''; };

function guessStore(head) {
  const saved = state.stores || [];
  const chain = head.match(/hannaford|walmart|shaw'?s|target|costco|aldi|market basket|kroger|safeway|publix|whole foods|trader joe'?s|bj'?s|sam'?s club|stop ?& ?shop|price chopper|dollar general|cvs|walgreens/i)?.[0];
  return saved.find(s => head.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])) || currentStore() || (chain ? { name: chain.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/'S\b/, "'s") } : null); // HANNAFORD → Hannaford
}

// where a line will go in the kitchen, for the review screen
const whereFor = it => {
  const ex = it.food && state.items.find(x => x.foodId === it.food.id && x.unit === it.unit);
  if (ex) return `➕ adds to your ${esc(ex.name)}`;
  return it.food ? `📍 ${esc(GEAR_CATS.has(it.food.cat) ? 'gear' : 'new item')}` : '📍 new item';
};

function review(r) {
  const guess = r.storeHint ? { name: r.storeHint } : guessStore(r.head);
  const names = [...new Set([...(state.stores || []).map(s => s.name), ...(guess ? [guess.name] : [])])];
  const units = RC_UNITS();
  const rows = r.items.map(it => ({ ...it, on: true }));
  const sum = () => Math.round(rows.filter(x => x.on).reduce((a, x) => a + (Number(x.paid) || 0), 0) * 100) / 100;
  openSheet({
    title: 'Check the receipt',
    html: `
      <label class="field"><span>Store</span><input class="input" data-store list="rc-stores" value="${attr(guess?.name || '')}" placeholder="Which store?"><datalist id="rc-stores">${names.map(n => `<option value="${attr(n)}">`).join('')}</datalist></label>
      <div data-check></div>
      <p class="small muted" style="margin:-4px 0 8px">Fix anything that came out wrong. <span class="pill warn" style="font-size:10.5px">check</span> means it’s a best guess; untick lines that aren’t groceries.</p>
      ${rows.map((it, i) => `<div class="rc-row ${it.sure === 'check' ? 'guess' : !it.food ? 'nomatch' : ''}" data-row="${i}">
        <input type="checkbox" data-on="${i}" checked aria-label="Include ${attr(it.name)}">
        <span class="em" data-emo="${i}">${it.food?.emoji || '🛒'}</span>
        <div class="rc-main">
          <input class="input rc-name" data-name="${i}" value="${attr(it.name)}">
          <small><span class="rc-raw">${esc(it.raw)}</span>${it.sure === 'check' ? ' <span class="pill warn">check</span>' : !it.food ? ' <span class="pill">not in catalog</span>' : ''}${it.discount ? ` <span class="pill ok">saved ${money(it.discount)}</span>` : ''}${it.fixed ? ' <span class="pill warn">price fixed from its quantity line</span>' : ''}</small>
          <div class="rc-sub"><input class="input rc-qty" data-qty="${i}" value="${attr(it.qty)}" inputmode="decimal" aria-label="Amount"><select class="input rc-unit" data-unit="${i}">${units.map(u => `<option ${u === it.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select><span class="rc-where" data-where="${i}">${whereFor(it)}</span></div>
        </div>
        <input class="input rc-price" data-price="${i}" value="${Number(it.paid).toFixed(2)}" inputmode="decimal" aria-label="Price">
      </div>`).join('')}
      <label class="row" style="margin:12px 0 6px"><span class="toggle"><input type="checkbox" data-stock checked><i></i></span><span><b>Put these in the kitchen</b><br><small class="muted">New batches on what you have, new items on their usual shelf</small></span></label>
      <label class="row" style="margin:6px 0 12px"><span class="toggle"><input type="checkbox" data-tick checked><i></i></span><span>Take them off the shopping list</span></label>
      <button class="btn btn-brass btn-block" data-save>${icon('check')} Save</button>`,
    onMount: (b, close) => {
      const check = () => {
        const s = sum(), t = r.total;
        b.querySelector('[data-check]').innerHTML = t == null
          ? `<div class="where-banner" style="margin-bottom:10px">🧮 <span>${rows.filter(x => x.on).length} items, ${money(s)}. No total found on the receipt to compare with.</span></div>`
          : Math.abs(s - t) <= Math.max(0.05, t * 0.12)
            ? `<div class="where-banner" style="margin-bottom:10px;background:var(--sage-2);color:var(--sage)">✅ <span>${rows.filter(x => x.on).length} items add up to ${money(s)} of the ${money(t)} total${Math.abs(s - t) > 0.05 ? ' (the rest is likely tax or deposits)' : ''}.</span></div>`
            : `<div class="where-banner" style="margin-bottom:10px">⚠️ <span>These add up to ${money(s)} but the receipt says ${money(t)}. ${s < t ? 'A line may be missing or misread: compare with the paper, or add a second photo.' : 'Something may be counted twice: check the prices.'}</span></div>`;
      };
      check();
      b.querySelectorAll('[data-on]').forEach(cb => cb.onchange = () => { rows[cb.dataset.on].on = cb.checked; cb.closest('.rc-row').classList.toggle('off', !cb.checked); check(); });
      b.querySelectorAll('[data-price]').forEach(inp => inp.onchange = () => { rows[inp.dataset.price].paid = Number(inp.value) || 0; check(); });
      b.querySelectorAll('[data-qty]').forEach(inp => inp.onchange = () => { const v = parseQty(inp.value); if (isFinite(v) && v > 0) rows[inp.dataset.qty].qty = v; else inp.value = rows[inp.dataset.qty].qty; });
      b.querySelectorAll('[data-unit]').forEach(sel => sel.onchange = () => { const it = rows[sel.dataset.unit]; it.unit = sel.value; it.unitTouched = true; b.querySelector(`[data-where="${sel.dataset.unit}"]`).innerHTML = whereFor(it); });
      b.querySelectorAll('[data-name]').forEach(inp => inp.onchange = () => {
        const i = inp.dataset.name, it = rows[i], m = matchName(cleanReceiptName(inp.value) || inp.value.toLowerCase());
        it.name = m.food?.name || inp.value.trim(); it.food = m.food; it.sure = m.food ? 'high' : null;
        if (m.food && !rows[i].unitTouched) { it.unit = m.food.unit; b.querySelector(`[data-unit="${i}"]`).value = it.unit; }
        b.querySelector(`[data-emo="${i}"]`).textContent = m.food?.emoji || '🛒';
        b.querySelector(`[data-where="${i}"]`).innerHTML = whereFor(it);
        inp.closest('.rc-row').classList.remove('guess', 'nomatch'); if (!m.food) inp.closest('.rc-row').classList.add('nomatch');
      });
      b.querySelector('[data-save]').onclick = () => {
        const store = b.querySelector('[data-store]').value.trim() || 'Unknown store';
        const chosen = rows.filter(x => x.on && x.name);
        const storeId = (state.stores || []).find(s => s.name === store)?.id;
        recordReceipt({ store, storeId, total: r.total, items: chosen.map(x => ({ name: x.name, foodId: x.food?.id || null, price: Number(x.paid) || 0 })).filter(x => x.price > 0) });
        let placed = [], ticked = 0;
        if (b.querySelector('[data-stock]').checked) {
          const before = state.shopping.length;
          placed = stockFromReceipt(chosen.map(x => lineFor(x, store)));
          ticked = before - state.shopping.length;
        } else if (b.querySelector('[data-tick]').checked) update(s => { for (const x of chosen) { const e = s.shopping.find(y => !y.done && (x.food ? y.foodId === x.food.id : y.name.toLowerCase() === x.name.toLowerCase())); if (e) { e.done = true; ticked++; } } }, 'list-check');
        close(); haptic(25); confetti(innerWidth / 2, innerHeight / 2, 26);
        if (!placed.length) { toast(`Saved ${chosen.length} prices from ${store}${ticked ? ` · ticked ${ticked} off the list` : ''}`, { icon: '🧾' }); return; }
        putAwaySheet(placed, store, ticked);
      };
    },
  });
}

// What went where, and a nudge to read the real dates off the packages.
function putAwaySheet(placed, store, ticked, totalNote = '') {
  const ids = [...new Set(placed.map(p => p.item.id))];
  openSheet({
    title: 'In the kitchen 📦',
    html: `<p class="muted" style="margin-top:0">${placed.length} thing${placed.length > 1 ? 's' : ''} from ${esc(store)} put away${ticked ? `, ${ticked} taken off the shopping list` : ''}. Dates are estimates until you read them off the packages.</p>
      ${totalNote ? `<div class="where-banner" style="margin-bottom:10px"><span>${esc(totalNote)}</span></div>` : ''}
      ${placed.map(p => { const s = sectionById(p.item.sectionId); return `<div class="irow"><span class="em">${p.item.emoji}</span><span class="t"><b>${esc(p.item.name)}</b><small>📍 ${s ? esc(s.zone.name + ' › ' + s.name) : ''}</small></span></div>`; }).join('')}
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn btn-ghost grow" data-later>Later</button><button class="btn btn-brass grow" data-walk>🏷️ Date them now</button></div>`,
    onMount: (b, close) => {
      b.querySelector('[data-later]').onclick = () => { close(); toast('Find them anytime under Stock › Undated', { icon: '🏷️' }); };
      b.querySelector('[data-walk]').onclick = () => { close(); labelWalk(ids.filter(id => !GEAR_CATS.has(FOOD_BY_ID[state.items.find(i => i.id === id)?.foodId]?.cat)), { title: 'Date your groceries' }); };
    },
  });
}
