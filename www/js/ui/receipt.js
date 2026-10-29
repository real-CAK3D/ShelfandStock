// Scan a receipt → review the lines → save prices for that store (and tick matching list items).

import { state, update, recordReceipt, money } from '../store.js';
import { FOOD_BY_ID, matchFood } from '../data/foods.js';
import { readText, parseReceipt } from '../services/ocr.js';
import { openSheet, esc, attr, toast, haptic, confetti, icon } from './dom.js';
import { loader } from './loader.js';
import { currentStore } from '../services/stores.js';

export function receiptFlow() {
  openSheet({
    title: '🧾 Scan a receipt',
    html: `<p class="muted" style="margin-top:0">Snap the whole receipt. Prices get saved per store, so the app can tell you where things are cheapest, and they feed the weekly spending summary.</p>
      <div class="row" style="gap:8px"><label class="btn btn-brass grow">📸 Take a picture<input type="file" accept="image/*" capture="environment" data-rc hidden></label><label class="btn btn-ghost">🖼️ Photo<input type="file" accept="image/*" data-rc hidden></label></div>
      <div data-rcout></div>`,
    onMount: (b, close) => b.querySelectorAll('[data-rc]').forEach(inp => inp.onchange = async () => {
      const f = inp.files[0]; inp.value = ''; if (!f) return;
      const out = b.querySelector('[data-rcout]');
      out.innerHTML = loader('Reading your receipt…', ['🧾', '🔍', '💵']);
      try {
        const text = await readText(f, t => { const x = out.querySelector('.loader-text'); if (x) x.textContent = t; });
        const r = parseReceipt(text);
        if (!r.items.length) { out.innerHTML = '<div class="where-banner">🤔 <span>Couldn’t find any prices. Try a flatter, brighter photo of the whole receipt.</span></div>'; return; }
        close(); review(r);
      } catch (e) { out.innerHTML = '<div class="where-banner">📡 <span>The text reader needs an internet connection the first time.</span></div>'; }
    }),
  });
}

function guessStore(head) {
  const saved = state.stores || [];
  const chain = head.match(/hannaford|walmart|shaw'?s|target|costco|aldi|market basket|kroger|safeway|publix|whole foods|trader joe'?s|bj'?s|sam'?s club|stop ?& ?shop|price chopper|dollar general|cvs|walgreens/i)?.[0];
  return saved.find(s => head.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])) || currentStore() || (chain ? { name: chain.replace(/\b\w/g, c => c.toUpperCase()) } : null);
}

function review(r) {
  const guess = guessStore(r.head);
  const names = [...new Set([...(state.stores || []).map(s => s.name), ...(guess ? [guess.name] : [])])];
  openSheet({
    title: 'Check the receipt',
    html: `
      <label class="field"><span>Store</span><input class="input" data-store list="rc-stores" value="${attr(guess?.name || '')}" placeholder="Which store?"><datalist id="rc-stores">${names.map(n => `<option value="${attr(n)}">`).join('')}</datalist></label>
      <p class="small muted" style="margin:-6px 0 8px">Fix any names that came out wrong. Untick lines you don't want to save.</p>
      ${r.items.map((it, i) => `<div class="irow" style="padding:6px 8px">
        <input type="checkbox" data-on="${i}" checked style="width:20px;height:20px;accent-color:var(--sage)">
        <span class="em" style="width:34px;height:34px;font-size:18px" data-emo="${i}">${it.food?.emoji || '🛒'}</span>
        <span class="t"><input class="input" data-name="${i}" value="${attr(it.name)}" style="height:34px;font-size:14px;padding:0 8px"><small>${esc(it.raw)}</small></span>
        <input class="input" data-price="${i}" value="${it.price.toFixed(2)}" inputmode="decimal" style="width:74px;height:34px;font-size:14px;padding:0 6px;text-align:right">
      </div>`).join('')}
      <div class="row" style="justify-content:space-between;margin:10px 4px"><b>Total</b><b data-total>${money(r.total ?? r.items.reduce((a, i) => a + i.price, 0))}</b></div>
      <label class="row" style="margin:4px 0 12px"><span class="toggle"><input type="checkbox" data-tick checked><i></i></span><span>Tick these off the shopping list</span></label>
      <button class="btn btn-brass btn-block" data-save>${icon('check')} Save prices</button>`,
    onMount: (b, close) => {
      b.querySelectorAll('[data-name]').forEach(inp => inp.onchange = () => { const f = matchFood(inp.value); b.querySelector(`[data-emo="${inp.dataset.name}"]`).textContent = f?.emoji || '🛒'; });
      b.querySelector('[data-save]').onclick = () => {
        const store = b.querySelector('[data-store]').value.trim() || 'Unknown store';
        const items = r.items.map((it, i) => {
          if (!b.querySelector(`[data-on="${i}"]`).checked) return null;
          const name = b.querySelector(`[data-name="${i}"]`).value.trim(), food = matchFood(name);
          return { name: food?.name || name, foodId: food?.id || null, price: Number(b.querySelector(`[data-price="${i}"]`).value) || 0 };
        }).filter(x => x && x.price > 0);
        const storeId = (state.stores || []).find(s => s.name === store)?.id;
        recordReceipt({ store, storeId, total: r.total, items });
        let ticked = 0;
        if (b.querySelector('[data-tick]').checked) update(s => { for (const it of items) { const e = s.shopping.find(x => !x.done && (it.foodId ? x.foodId === it.foodId : x.name.toLowerCase() === it.name.toLowerCase())); if (e) { e.done = true; ticked++; } } }, 'list-check');
        close(); haptic(25); confetti(innerWidth / 2, innerHeight / 2, 22);
        toast(`Saved ${items.length} prices from ${store}${ticked ? ` · ticked ${ticked} off the list` : ''}`, { icon: '🧾' });
      };
    },
  });
}
