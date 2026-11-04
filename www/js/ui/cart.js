// To and from a store's online cart. Stores don't let other apps read or fill a cart, so: a list made from
// screenshots of the cart (or text copied from it), and a walk through the list in the store's own app or site.

import { state, addToList, storeName, fmtQty, parseQty } from '../store.js';
import { readText, parseReceipt, matchName, cleanReceiptName, usingPhoneReader } from '../services/ocr.js';
import { storeEmoji, storeSearchUrl } from '../services/stores.js';
import { mergeReceipts } from './receipt.js';
import { openSheet, esc, attr, icon, toast, haptic } from './dom.js';
import { loader } from './loader.js';

// what a cart page says around its products
const CART_JUNK = /\b(cart|checkout|check out|pickup|pick up|delivery|deliver|shipping|subtotal|total|tax|fees?|remove|save for later|saved|substitut\w*|in stock|out of stock|sold by|sign in|account|reserve|time slot|savings?|you save|coupon|promo|estimated|continue|see all|view|edit|qty|quantity|walmart\+?|hannaford|to go|free|aisle)\b|^\s*[-–$\d.,/@ ]+\s*$|^\s*\$?\d[\d.,]*\s*(each|ea)\s*$|\$\s?\d+(\.\d+)?\s*\/\s*\w+/i;

const SIZE = /[,\s-]*\b(\d+(?:\.\d+)?)\s?(fl oz|oz|lbs?|ct|count|pack|pk|gallon|gal|qt|kg|ml|g|l)\b.*$/i;
// The exact product stays in its words ("Honey Nut Cheerios Cereal"), with its size split off.
const productRow = (line, qty = 1) => {
  const size = line.match(SIZE), name = line.replace(SIZE, '').replace(/[,\s-]+each\s*$/i, '').trim() || line;
  return { name, size: size ? `${size[1]} ${size[2].toLowerCase()}` : '', food: matchName(cleanReceiptName(name) || name.toLowerCase()).food || null, qty, raw: line };
};

// Priced lines when there are any; a plain typed or copied list has none, so then each line is a thing.
export function parseCart(text) {
  const priced = parseReceipt(text).items.filter(it => !CART_JUNK.test(it.raw || ''));
  if (priced.length) return priced.map(it => productRow(it.raw || it.name, it.qty || 1));
  const seen = new Set();
  return text.split(/\n/).map(l => l.replace(/^\s*[-•*☐\d.)]+\s+/, '').trim()).filter(l => /[a-z]{3}/i.test(l) && l.length < 90 && !CART_JUNK.test(l)).flatMap(l => {
    const k = l.toLowerCase(); if (seen.has(k)) return []; seen.add(k);
    return [productRow(l)];
  });
}

export function cartFlow() {
  const photos = [];
  openSheet({
    title: '🛒 List from a cart',
    html: `<p class="muted" style="margin-top:0">Take screenshots of your Hannaford or Walmart cart, scrolling so every item is in one of them. You can also paste a list. You check it before anything is added.</p>
      <label class="field"><span>Which store?</span><input class="input" data-cstore list="cart-stores" placeholder="Hannaford, Walmart…"><datalist id="cart-stores">${knownStores().map(n => `<option value="${attr(n)}">`).join('')}</datalist></label>
      <div class="rc-thumbs" data-thumbs></div>
      <label class="btn btn-brass btn-block">🖼️ Choose screenshots<input type="file" accept="image/*" multiple data-shots hidden></label>
      <label class="field" style="margin-top:12px"><span>Or paste a list</span><textarea class="input" data-ctext rows="3" placeholder="One thing per line"></textarea></label>
      <button class="btn btn-sage btn-block" data-cread>🔍 Read it</button>
      ${usingPhoneReader() ? '' : '<p class="small muted" style="margin:10px 2px 0">Tip: the Android app reads screenshots much more accurately than the browser.</p>'}
      <div data-cout></div>`,
    onClose: () => photos.forEach(p => URL.revokeObjectURL(p.url)),
    onMount: (b, close) => {
      const out = b.querySelector('[data-cout]');
      const say = t => { out.innerHTML = `<div class="where-banner" style="margin-top:10px">🤔 <span>${esc(t)}</span></div>`; };
      const draw = () => { b.querySelector('[data-thumbs]').innerHTML = photos.map((p, i) => `<span class="rc-thumb"><img src="${attr(p.url)}" alt="Screenshot ${i + 1}"><button type="button" data-unshot="${i}" aria-label="Remove screenshot ${i + 1}">${icon('close')}</button></span>`).join(''); };
      b.querySelector('[data-shots]').onchange = e => { for (const file of e.target.files) photos.push({ file, url: URL.createObjectURL(file) }); e.target.value = ''; haptic(); draw(); };
      b.querySelector('[data-thumbs]').onclick = e => { const x = e.target.closest('[data-unshot]'); if (!x) return; URL.revokeObjectURL(photos.splice(Number(x.dataset.unshot), 1)[0].url); draw(); };
      b.querySelector('[data-cread]').onclick = async () => {
        const pasted = b.querySelector('[data-ctext]').value.trim(), store = b.querySelector('[data-cstore]').value.trim();
        if (!photos.length && !pasted) return say('Add a screenshot or paste a list first.');
        out.innerHTML = loader('Reading your cart…', ['🛒', '🔍']);
        try {
          const parts = [];
          for (const [n, p] of photos.entries()) parts.push(await readText(p.file, t => { const x = out.querySelector('.loader-text'); if (x) x.textContent = `Screenshot ${n + 1} of ${photos.length}: ${t}`; }, { mode: 'receipt' }));
          // screenshots overlap where you scrolled: each is read on its own, and the same line twice in a row counts once
          const fromShots = mergeReceipts(parts.map(t => ({ ...parseReceipt(t), items: parseCart(t).map(it => ({ ...it, paid: 0 })) }))).items;
          const seen = new Set(), rows = [...fromShots, ...(pasted ? parseCart(pasted) : [])].filter(r => { const k = r.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
          if (!rows.length) return say('Couldn’t find any items. Try a sharper screenshot, or paste the list.');
          close(); review(rows, store);
        } catch (e) { say('The text reader needs an internet connection the first time.'); }
      };
    },
  });
}

const knownStores = () => [...new Set([...(state.stores || []).map(x => x.name), ...state.shopping.map(x => x.store), ...state.items.map(x => x.store), 'Hannaford', 'Walmart'].map(storeName).filter(Boolean))];

function review(rows, store) {
  openSheet({
    title: 'Is this your cart?',
    html: `<p class="muted" style="margin-top:0">Fix any names, and untick anything that isn’t a product.</p>
      ${rows.map((r, i) => `<div class="rc-row"><input type="checkbox" data-on="${i}" checked aria-label="Include ${attr(r.name)}"><span class="em">${r.food?.emoji || '🛒'}</span><div class="rc-main"><input class="input rc-name" data-name="${i}" value="${attr(r.name)}"></div><input class="input rc-price" data-qty="${i}" value="${attr(r.qty)}" inputmode="decimal" aria-label="How many"></div>`).join('')}
      <button class="btn btn-brass btn-block" style="margin-top:12px" data-addcart>${icon('check')} Add to my list</button>`,
    onMount: (b, close) => {
      b.querySelector('[data-addcart]').onclick = () => {
        let n = 0;
        rows.forEach((r, i) => {
          if (!b.querySelector(`[data-on="${i}"]`).checked) return;
          const name = b.querySelector(`[data-name="${i}"]`).value.trim(); if (!name) return;
          const q = parseQty(b.querySelector(`[data-qty="${i}"]`).value);
          // the list line is the kind of thing; the exact product goes along as its details
          const food = name === r.name ? r.food : matchName(cleanReceiptName(name) || name.toLowerCase()).food;
          addToList({ name, foodId: food?.id, kind: food && food.name.toLowerCase() !== name.toLowerCase() ? name : '', size: r.size || '', qty: q > 0 ? q : 1, store, reason: store ? `From my ${storeName(store)} cart` : 'From a cart' });
          n++;
        });
        close(); haptic(20); toast(`${n} added to your list`, { icon: '🛒' });
      };
    },
  });
}

// One item at a time in the store's own app or site, where you're signed in and tap Add to Cart yourself.
export function fillCartSheet() {
  const open = state.shopping.filter(e => !e.done);
  const stores = [...new Set(['Hannaford', 'Walmart', ...open.map(e => storeName(e.store)).filter(Boolean)])];
  let store = open.find(e => e.store)?.store ? storeName(open.find(e => e.store).store) : stores[0];
  const opened = new Set();
  openSheet({
    title: '📤 Fill a pickup cart',
    html: `<p class="muted" style="margin-top:0">Stores don’t let other apps fill a cart for you. So tap each thing to find it in the store’s app or site, add it to your cart there, and come back for the next.</p>
      <div class="chips" data-cstores style="margin:0 -2px 10px"></div>
      <div data-crows></div>`,
    onMount: b => {
      const draw = () => {
        b.querySelector('[data-cstores]').innerHTML = stores.map(s => `<button class="chip ${s === store ? 'on' : ''}" data-st="${attr(s)}">${storeEmoji(s)} ${esc(s)}</button>`).join('');
        b.querySelector('[data-crows]').innerHTML = open.length ? open.map(e => `<a class="irow cart-walk ${opened.has(e.id) ? 'seen' : ''}" style="width:100%" data-open="${e.id}" href="${attr(storeSearchUrl(store, e))}" target="_blank" rel="noopener"><span class="em">${opened.has(e.id) ? '✅' : e.emoji}</span><span class="t"><b>${esc(e.name)}</b><small>${fmtQty(e.qty)} ${esc(e.unit)}${[e.brand, e.kind, e.size].filter(Boolean).length ? ` · ${esc([e.brand, e.kind, e.size].filter(Boolean).join(' · '))}` : ''}</small></span>${icon('next')}</a>`).join('') : '<p class="muted">Your list is empty.</p>';
      };
      b.querySelector('[data-cstores]').onclick = e => { const c = e.target.closest('[data-st]'); if (c) { store = c.dataset.st; draw(); } };
      // after the link has gone to the store, so the tap isn't lost to the redraw
      b.querySelector('[data-crows]').onclick = e => { const a = e.target.closest('[data-open]'); if (a) { opened.add(a.dataset.open); setTimeout(draw, 300); } };
      draw();
    },
  });
}
