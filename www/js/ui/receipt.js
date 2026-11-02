// Scan a receipt → check the lines → save prices for that store, put the groceries in the kitchen,
// and take them off the shopping list. Then offer to read the real dates off the packages.

import { state, update, recordReceipt, money, stockFromReceipt, sectionById, parseQty, kindFrom } from '../store.js';
import { FOOD_BY_ID, UNITS, GEAR_CATS } from '../data/foods.js';
import { readText, parseReceipt, matchName, cleanReceiptName, usingPhoneReader } from '../services/ocr.js';
import { openSheet, esc, attr, toast, haptic, confetti, icon } from './dom.js';
import { loader } from './loader.js';
import { currentStore } from '../services/stores.js';
import { labelWalk } from './itemSheet.js';

// prefill: { files } shared photos/screenshots, or { text } a receipt shared as text (e.g. from a store's app)
export function receiptFlow(prefill = {}) {
  if (prefill.text && !prefill.files?.length) { const r = parseReceipt(prefill.text); if (r.items.length) return review(r); }
  openSheet({
    title: '🧾 Scan a receipt',
    html: `<p class="muted" style="margin-top:0">Snap the whole receipt, flat and in good light. Every grocery on it goes into your kitchen (you check the list first), comes off the shopping list, and its price is saved for that store.</p>
      <ul class="small muted" style="margin:0 0 12px 18px;padding:0;line-height:1.5"><li>Lay it flat on a dark table, smooth out the creases</li><li>Fill the screen with it; a long receipt can be done in two photos</li><li>Hold steady so the small print is sharp</li></ul>
      <div class="row" style="gap:8px"><label class="btn btn-brass grow">📸 Take a picture<input type="file" accept="image/*" capture="environment" data-rc hidden></label><label class="btn btn-ghost">🖼️ Photo<input type="file" accept="image/*" multiple data-rc hidden></label></div>
      <p class="small muted" style="margin:10px 2px 0">${usingPhoneReader() ? '✨ Using your phone’s built-in text reader.' : 'Tip: the Android app reads receipts much more accurately than the browser.'}</p>
      <div data-rcout></div>`,
    onMount: (b, close) => {
      const go = async files => {
      const out = b.querySelector('[data-rcout]');
      out.innerHTML = loader('Reading your receipt…', ['🧾', '🔍', '💵']);
      try {
        // a long receipt in two or more photos: read each and put the text together
        let text = '';
        for (const [n, f] of files.entries()) text += '\n' + await readText(f, t => { const x = out.querySelector('.loader-text'); if (x) x.textContent = files.length > 1 ? `Photo ${n + 1} of ${files.length}: ${t}` : t; }, { mode: 'receipt' });
        const r = parseReceipt(text);
        if (!r.items.length) { out.innerHTML = '<div class="where-banner">🤔 <span>Couldn’t find any groceries. Try a flatter, brighter photo of the whole receipt.</span></div>'; return; }
        close(); review(r);
      } catch (e) { out.innerHTML = '<div class="where-banner">📡 <span>The text reader needs an internet connection the first time.</span></div>'; }
      };
      b.querySelectorAll('[data-rc]').forEach(inp => inp.onchange = () => { const files = [...inp.files]; inp.value = ''; if (files.length) go(files); });
      if (prefill.files?.length) go(prefill.files);
    },
  });
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
  const guess = guessStore(r.head);
  const names = [...new Set([...(state.stores || []).map(s => s.name), ...(guess ? [guess.name] : [])])];
  const units = [...new Set(['ea', 'pack', 'lb', 'oz', 'gal', 'dozen', 'bag', 'box', 'can', 'jar', 'bottle', ...UNITS])];
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
          placed = stockFromReceipt(chosen.map(x => ({ name: x.name, foodId: x.food?.id || null, qty: x.qty, unit: x.unit, cat: x.food?.cat || 'pantry', emoji: x.food?.emoji || '🛒', store, price: Number(x.paid) || null, raw: x.raw, brand: brandOf(x.raw), size: sizeOf(x.raw), kind: kindFrom(cleanReceiptName(x.raw), '', x.food) })));
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
function putAwaySheet(placed, store, ticked) {
  const ids = [...new Set(placed.map(p => p.item.id))];
  openSheet({
    title: 'In the kitchen 📦',
    html: `<p class="muted" style="margin-top:0">${placed.length} thing${placed.length > 1 ? 's' : ''} from ${esc(store)} put away${ticked ? `, ${ticked} taken off the shopping list` : ''}. Dates are estimates until you read them off the packages.</p>
      ${placed.map(p => { const s = sectionById(p.item.sectionId); return `<div class="irow"><span class="em">${p.item.emoji}</span><span class="t"><b>${esc(p.item.name)}</b><small>📍 ${s ? esc(s.zone.name + ' › ' + s.name) : ''}</small></span></div>`; }).join('')}
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn btn-ghost grow" data-later>Later</button><button class="btn btn-brass grow" data-walk>🏷️ Date them now</button></div>`,
    onMount: (b, close) => {
      b.querySelector('[data-later]').onclick = () => { close(); toast('Find them anytime under Stock › Undated', { icon: '🏷️' }); };
      b.querySelector('[data-walk]').onclick = () => { close(); labelWalk(ids.filter(id => !GEAR_CATS.has(FOOD_BY_ID[state.items.find(i => i.id === id)?.foodId]?.cat)), { title: 'Date your groceries' }); };
    },
  });
}
