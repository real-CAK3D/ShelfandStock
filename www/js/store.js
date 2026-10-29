// App state: one JSON document persisted to localStorage, with versioned migrations and a
// tiny pub/sub. Every mutation goes through `update()` so views re-render consistently.

import { DEFAULT_ZONES, suggestSection, LEGACY_SECTIONS } from './data/layout.js';
import { FOOD_BY_ID, CAT_BY_ID, matchFood, slug } from './data/foods.js';
import { BUILTIN_RECIPES } from './data/recipes.js';
import { iso } from './data/holidays.js';

const KEY = 'shelfstock.state';
const OLD_KEY = 'larder.state'; // before the rename to Shelf & Stock
const VERSION = 9;

// Who is signed in on this phone (see services/people.js); read directly to avoid an import cycle.
export const who = () => { try { return localStorage.getItem('shelfstock.session'); } catch { return null; } };

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const today = () => iso(new Date());
export const addDays = (d, n) => { const x = new Date(typeof d === 'string' ? d + 'T12:00' : d); x.setDate(x.getDate() + n); return iso(x); };
export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);

function blank() {
  return {
    v: VERSION,
    zones: structuredClone(DEFAULT_ZONES),
    items: [], shopping: [], events: [], recipes: [], favorites: [], history: [], members: [], trips: [], stores: [], prices: [],
    settings: { onboarded: false, household: 2, tourDone: false, wood: 'walnut', cabinets: 'painted', season: 'auto', stapleIds: ['salt', 'black-pepper', 'vegetable-oil', 'olive-oil'], expiryWarnDays: 3, haptics: true },
  };
}

const MIGRATIONS = {
  // v1 → v2: settings.stapleIds + expiryWarnDays were added
  2: s => { s.settings.stapleIds ||= ['salt', 'black-pepper']; s.settings.expiryWarnDays ||= 3; s.history ||= []; },
  // v2 → v3: garage upright freezer + garage top-freezer fridge
  3: s => { for (const z of DEFAULT_ZONES.filter(z => z.slot.startsWith('garage'))) if (!s.zones.some(x => x.id === z.id)) s.zones.splice(Math.max(0, s.zones.findIndex(x => x.id === 'holiday')), 0, structuredClone(z)); },
  // v3 → v4: the real kitchen layout (stove wall, sink wall, corner + island); keep custom zones, move items over
  4: s => {
    const custom = s.zones.filter(z => z.slot === 'custom');
    s.zones = [...structuredClone(DEFAULT_ZONES), ...custom];
    const valid = new Set(s.zones.flatMap(z => z.sections.map(x => x.id)));
    for (const it of s.items) {
      if (LEGACY_SECTIONS[it.sectionId]) it.sectionId = LEGACY_SECTIONS[it.sectionId];
      if (!valid.has(it.sectionId)) it.sectionId = suggestSection(FOOD_BY_ID[it.foodId], s.zones);
    }
  },
  // v8 → v9: price tracking from receipts
  9: s => { s.prices ||= []; },
  // v7 → v8: profile pictures are pick-able icons instead of faces; saved local stores
  8: s => {
    const faces = ['🧔', '🧒', '👩', '👴', '👵', '👨', '👧', '🧑'], icons = ['🍳', '🎮', '🌻', '⚓', '🥕', '🧀', '🍕', '🌮'];
    (s.members || []).forEach((m, i) => { if (faces.includes(m.emoji)) m.emoji = icons[i % icons.length]; });
    s.stores ||= [];
  },
  // v6 → v7: Clyde's food bowl and treats
  7: s => { for (const z of DEFAULT_ZONES.filter(z => z.kind === 'pet')) if (!s.zones.some(x => x.id === z.id)) s.zones.push(structuredClone(z)); },
  // v5 → v6: household members (PIN login) and store trips
  6: s => { s.members ||= []; s.trips ||= []; s.settings.season ||= 'auto'; },
  // v4 → v5: fridge & freezer modeled on the photos (door bins per door, cheese drawer, freezer tray)
  5: s => {
    for (const id of ['fridge', 'freezer']) {
      const z = s.zones.find(z => z.id === id), d = DEFAULT_ZONES.find(z => z.id === id);
      if (z) { z.sections = structuredClone(d.sections); z.layout = d.layout; z.name = z.name || d.name; }
    }
    const valid = new Set(s.zones.flatMap(z => z.sections.map(x => x.id)));
    for (const it of s.items) {
      if (LEGACY_SECTIONS[it.sectionId]) it.sectionId = LEGACY_SECTIONS[it.sectionId];
      if (!valid.has(it.sectionId)) it.sectionId = suggestSection(FOOD_BY_ID[it.foodId], s.zones);
    }
  },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw);
    for (let v = (s.v || 1) + 1; v <= VERSION; v++) MIGRATIONS[v]?.(s);
    s.v = VERSION;
    return { ...blank(), ...s, settings: { ...blank().settings, ...s.settings } };
  } catch (e) {
    console.warn('state load failed, starting fresh', e);
    return blank();
  }
}

export let state = load();
const subs = new Set();
export const subscribe = fn => (subs.add(fn), () => subs.delete(fn));

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error('save failed', e); }
  }, 120);
}

export function update(fn, why = '') {
  fn(state);
  persist();
  subs.forEach(s => s(why));
}

export function replaceState(next) {
  state = { ...blank(), ...next, settings: { ...blank().settings, ...next.settings } };
  persist();
  subs.forEach(s => s('replace'));
}

// Start over: a blank kitchen (the welcome screen comes back), keeping the household's people and PINs.
// Saved right away, not on the debounce, because callers reload the page next.
export function resetAll() {
  replaceState({ ...blank(), members: state.members || [] });
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(state)); localStorage.removeItem(OLD_KEY); } catch (e) { console.error('save failed', e); }
}

// ---------- lookups ----------

export function allSections() {
  const out = [];
  for (const z of state.zones) for (const s of z.sections) out.push({ ...s, zone: z });
  return out;
}
export function sectionById(id) {
  for (const z of state.zones) { const s = z.sections.find(s => s.id === id); if (s) return { ...s, zone: z }; }
  return null;
}
export const zoneOfItem = it => sectionById(it.sectionId)?.zone || null;

export function storageKind(it) {
  const k = zoneOfItem(it)?.kind;
  return k === 'freezer' ? 'freezer' : k === 'fridge' ? 'fridge' : 'pantry';
}

export function shelfLifeDays(food, kind) {
  if (!food) return 0;
  return food.life[kind] || 0;
}

export function itemStatus(it) {
  if (!it.expires) return { key: 'none', days: null, label: '' };
  const d = daysBetween(today(), it.expires);
  const est = !it.dated && (it.dateType || 'Estimated') === 'Estimated' ? '≈ ' : '';
  const s = itemStatusRaw(d);
  return { ...s, label: s.key === 'expired' ? s.label : est + s.label, estimated: !!est };
}
function itemStatusRaw(d) {
  if (d < 0) return { key: 'expired', days: d, label: `Expired ${-d}d ago` };
  if (d === 0) return { key: 'today', days: 0, label: 'Use today' };
  if (d <= state.settings.expiryWarnDays) return { key: 'soon', days: d, label: `${d}d left` };
  return { key: 'ok', days: d, label: `${span(d)} left` };
}

// Compact duration: 5d, 3mo, 2yr (long=true → "5 days", "3 months", "2 years")
export function span(d, long = false) {
  if (d < 60) return long ? `${d} days` : `${d}d`;
  if (d < 365) return long ? `${Math.round(d / 30)} months` : `${Math.round(d / 30)}mo`;
  const y = Math.round(d / 36.5) / 10;
  return long ? `${y} year${y === 1 ? '' : 's'}` : `${y}yr`;
}

export const isLow =it => it.minQty != null && it.minQty !== '' && Number(it.qty) <= Number(it.minQty);

// ---------- items ----------

export function makeItem(partial) {
  const food = partial.foodId ? FOOD_BY_ID[partial.foodId] : matchFood(partial.name);
  const sectionId = partial.sectionId || suggestSection(food, state.zones);
  const it = {
    id: uid(), name: food?.name || partial.name || 'Item', foodId: food?.id || null,
    cat: food?.cat || partial.cat || 'pantry', emoji: food?.emoji || partial.emoji || '📦',
    qty: 1, unit: food?.unit || 'ea', sectionId, added: today(), expires: null,
    opened: false, openedOn: null, minQty: null, barcode: '', brand: '', image: '', off: null, tags: [], notes: '',
    dateType: 'Estimated', dated: false,
    ...partial,
  };
  if (!it.foodId && food) it.foodId = food.id;
  if (it.expires === null && !partial.noExpiry) {
    const sec = sectionById(it.sectionId);
    const kind = sec?.zone.kind === 'freezer' ? 'freezer' : sec?.zone.kind === 'fridge' ? 'fridge' : 'pantry';
    const life = shelfLifeDays(food, kind) || shelfLifeDays(food, food?.zone === 'fridge' ? 'fridge' : 'pantry');
    if (life && food?.cat !== 'kitchenware' && food?.cat !== 'household') it.expires = addDays(it.added, life);
  }
  delete it.noExpiry;
  return it;
}

export function addItem(partial) {
  const it = makeItem(partial);
  update(s => { s.items.push(it); s.history.push({ ts: Date.now(), by: who(), type: 'added', name: it.name, foodId: it.foodId, qty: it.qty }); }, 'item-add');
  return it;
}

export function saveItem(it) {
  syncBatches(it);
  update(s => { const i = s.items.findIndex(x => x.id === it.id); if (i >= 0) s.items[i] = it; else s.items.push(it); }, 'item-save');
}

export function removeItem(id, how = 'used') {
  update(s => {
    const it = s.items.find(x => x.id === id);
    if (it) s.history.push({ ts: Date.now(), by: who(), type: how, name: it.name, foodId: it.foodId, qty: it.qty, cat: it.cat, last: how === 'used' });
    s.items = s.items.filter(x => x.id !== id);
  }, 'item-remove');
}

// ---------- batches ----------
// An item may hold several batches (lots) bought at different times, each with its own
// printed date. qty is the sum, expires is the soonest date. Items without batches are
// a single implicit batch.
export const DATE_TYPES = ['Best by', 'Use by', 'Sell by', 'Freeze by', 'Estimated'];
const r2 = n => Math.round(n * 100) / 100;

export function syncBatches(it) {
  if (!it.batches?.length) return it;
  it.batches = it.batches.filter(b => Number(b.qty) > 0);
  if (!it.batches.length) { it.qty = 0; delete it.batches; return it; }
  it.batches.sort((a, b) => (a.expires || '9999') < (b.expires || '9999') ? -1 : 1);
  it.qty = r2(it.batches.reduce((a, b) => a + Number(b.qty), 0));
  it.expires = it.batches.find(b => b.expires)?.expires || null;
  it.dateType = it.batches[0].dateType || it.dateType;
  if (it.batches.length === 1) { delete it.batches; }
  return it;
}

const implicitBatch = it => ({ id: uid(), qty: Number(it.qty) || 0, expires: it.expires || null, added: it.added || today(), dateType: it.dateType || 'Estimated' });

export function restockItem(id, { qty, expires = null, dateType = 'Best by' }) {
  const nb = { id: uid(), qty: Number(qty) || 1, expires, added: today(), dateType };
  update(s => {
    const it = s.items.find(x => x.id === id);
    if (!it) return;
    const batches = it.batches?.length ? it.batches : (Number(it.qty) > 0 ? [implicitBatch(it)] : []);
    batches.push(nb);
    it.batches = batches;
    syncBatches(it);
    s.history.push({ ts: Date.now(), by: who(), type: 'bought', name: it.name, foodId: it.foodId, qty: Number(qty) || 1, cat: it.cat });
  }, 'item-restock');
  return nb.id;
}

export function setBatchDate(itemId, batchId, expires, dateType) {
  update(s => {
    const it = s.items.find(x => x.id === itemId);
    if (!it) return;
    if (!it.batches?.length) { it.expires = expires || null; if (dateType) it.dateType = dateType; it.dated = true; return; }
    const b = batchId ? it.batches.find(b => b.id === batchId) : it.batches[0];
    if (b) { b.expires = expires || null; if (dateType) b.dateType = dateType; }
    it.dated = true;
    syncBatches(it);
  }, 'item-date');
}

export function removeBatch(itemId, batchId) {
  update(s => {
    const it = s.items.find(x => x.id === itemId);
    if (!it?.batches) return;
    it.batches = it.batches.filter(b => b.id !== batchId);
    syncBatches(it);
  }, 'item-batch');
}

export function adjustQty(id, delta) {
  update(s => {
    const it = s.items.find(x => x.id === id);
    if (!it) return;
    if (it.batches?.length) {
      // first-in-first-out: use the soonest-expiring batch first
      if (delta < 0) {
        let left = -delta;
        for (const b of it.batches) { const take = Math.min(Number(b.qty), left); b.qty = r2(Number(b.qty) - take); left = r2(left - take); if (left <= 0) break; }
      } else it.batches[it.batches.length - 1].qty = r2(Number(it.batches[it.batches.length - 1].qty) + delta);
      const had = it.batches.length;
      syncBatches(it);
      if (had && !it.batches && it.qty === 0) it.qty = 0;
    } else it.qty = Math.max(0, r2(Number(it.qty) + delta));
    if (delta < 0) s.history.push({ ts: Date.now(), by: who(), type: 'used', name: it.name, foodId: it.foodId, qty: -delta, cat: it.cat, last: Number(it.qty) === 0 });
  }, 'item-qty');
}

// Find stock for a recipe ingredient / catalog food / free-text name.
export function stockFor(name, foodId) {
  const fid = foodId || matchFood(name)?.id;
  const n = name.toLowerCase();
  return state.items.filter(it => Number(it.qty) > 0 && (fid ? it.foodId === fid : it.name.toLowerCase().includes(n)));
}

// ---------- recipes ----------

export const allRecipes = () => [...state.recipes, ...BUILTIN_RECIPES];
export const recipeById = id => allRecipes().find(r => r.id === id);

const staples = () => new Set(state.settings.stapleIds);

// servings: scale the recipe; quantities are compared only when stock uses the same unit.
export function recipeMatch(r, servings = r.servings) {
  const st = staples();
  const rows = r.ingredients.map(ing => {
    const food = ing.foodId ? FOOD_BY_ID[ing.foodId] : matchFood(ing.name);
    const stock = stockFor(ing.name, food?.id);
    const staple = food && st.has(food.id);
    const need = scaleQty(ing.qty, r.servings, servings);
    const sameUnit = stock.filter(it => it.unit === ing.unit);
    const onHand = sameUnit.reduce((a, it) => a + Number(it.qty), 0);
    const short = !staple && sameUnit.length > 0 && sameUnit.length === stock.length && onHand < need ? Math.round((need - onHand) * 100) / 100 : 0;
    const have = (stock.length > 0 && !short) || staple;
    const expiring = stock.some(it => ['soon', 'today', 'expired'].includes(itemStatus(it).key));
    return { ing, food, stock, have, staple, expiring, short, need };
  });
  const need = rows.filter(r => !r.ing.optional);
  const haveN = need.filter(r => r.have).length;
  return {
    rows,
    have: haveN, total: need.length,
    pct: need.length ? haveN / need.length : 1,
    missing: need.filter(r => !r.have),
    usesExpiring: rows.some(r => r.expiring),
  };
}

// ---------- shopping ----------

export function addToList(entry) {
  const food = entry.foodId ? FOOD_BY_ID[entry.foodId] : matchFood(entry.name);
  const name = food?.name || entry.name;
  let added = false;
  update(s => {
    const dup = s.shopping.find(x => !x.done && (food ? x.foodId === food.id : x.name.toLowerCase() === name.toLowerCase()));
    if (dup) {
      if (entry.reason && !dup.reasons.includes(entry.reason)) dup.reasons.push(entry.reason);
      if (entry.unit === dup.unit && entry.qty) dup.qty = Math.round((Number(dup.qty) + Number(entry.qty)) * 100) / 100;
      return;
    }
    added = true;
    s.history.push({ ts: Date.now(), by: who(), type: 'requested', name, foodId: food?.id || null, cat: food?.cat || entry.cat });
    s.shopping.push({ by: who(),
      id: uid(), name, foodId: food?.id || null, cat: food?.cat || entry.cat || 'pantry',
      emoji: food?.emoji || entry.emoji || '🛒', qty: entry.qty || 1, unit: entry.unit || food?.unit || 'ea',
      done: false, reasons: entry.reason ? [entry.reason] : [], added: today(), note: entry.note || '',
    });
  }, 'list-add');
  return added;
}

// Check off: move into stock (the satisfying part).
export function checkOffToStock(id) {
  const e = state.shopping.find(x => x.id === id);
  if (!e) return null;
  const existing = e.foodId && state.items.find(it => it.foodId === e.foodId && it.unit === e.unit);
  let it;
  if (existing) {
    // A new purchase is a new batch with its own (estimated until labeled) date.
    const food = FOOD_BY_ID[existing.foodId];
    const life = shelfLifeDays(food, storageKind(existing));
    const batchId = restockItem(existing.id, { qty: e.qty, expires: life ? addDays(today(), life) : null, dateType: 'Estimated' });
    update(s => { s.shopping = s.shopping.filter(y => y.id !== id); }, 'list-stock');
    return { item: state.items.find(i => i.id === existing.id), batchId };
  } else {
    it = makeItem({ name: e.name, foodId: e.foodId, qty: e.qty, unit: e.unit, cat: e.cat, emoji: e.emoji });
    update(s => {
      s.items.push(it);
      s.shopping = s.shopping.filter(y => y.id !== id);
      s.history.push({ ts: Date.now(), by: who(), type: 'bought', name: it.name, foodId: it.foodId, qty: e.qty, cat: it.cat });
    }, 'list-stock');
  }
  return { item: it, batchId: null };
}

// Smart suggestions: what you "should get".
export function suggestions() {
  const out = [];
  const onList = new Set(state.shopping.filter(x => !x.done).map(x => x.foodId || x.name.toLowerCase()));
  const seen = new Set();
  const push = (key, s) => { if (onList.has(key) || seen.has(key)) return; seen.add(key); out.push(s); };

  for (const it of state.items) {
    const key = it.foodId || it.name.toLowerCase();
    if (isLow(it)) push(key, { name: it.name, foodId: it.foodId, emoji: it.emoji, unit: it.unit, qty: Math.max(1, Number(it.minQty) * 2 - Number(it.qty)), reason: 'Running low', icon: '📉' });
    else if (Number(it.qty) === 0) push(key, { name: it.name, foodId: it.foodId, emoji: it.emoji, unit: it.unit, qty: 1, reason: 'Out of stock', icon: '🚫' });
  }
  // Upcoming plan (next 14 days)
  const horizon = addDays(today(), 14);
  for (const ev of state.events.filter(e => e.date >= today() && e.date <= horizon)) {
    for (const rid of ev.recipeIds || []) {
      const r = recipeById(rid); if (!r) continue;
      for (const m of recipeMatch(r, ev.guests || r.servings).missing) {
        const key = m.food?.id || m.ing.name.toLowerCase();
        push(key, { name: m.food?.name || m.ing.name, foodId: m.food?.id, emoji: m.food?.emoji || '🛒', unit: m.ing.unit, qty: m.short || m.need, reason: `${r.title} · ${fmtDate(ev.date)}`, icon: '📅' });
      }
    }
  }
  // About to perish or down to the last one: replace it while you're out
  for (const it of state.items) {
    const key = it.foodId || it.name.toLowerCase(), st = itemStatus(it);
    if (['today', 'soon'].includes(st.key) && it.cat !== 'leftovers') push(key, { name: it.name, foodId: it.foodId, emoji: it.emoji, unit: it.unit, qty: 1, reason: st.days === 0 ? 'Goes bad today — use it or replace it' : `Goes bad in ${st.days}d — use it or replace it`, icon: '⏰', kind: 'perish' });
    else if (Number(it.qty) === 1 && ['ea', 'dozen', 'gal', 'loaf', 'jar', 'bottle', 'carton', 'bag', 'box', 'can', 'pack'].includes(it.unit) && FOOD_BY_ID[it.foodId] && !['kitchenware', 'household', 'spices'].includes(it.cat) && it.cat !== 'leftovers') push(key, { name: it.name, foodId: it.foodId, emoji: it.emoji, unit: it.unit, qty: 1, reason: 'Only 1 left', icon: '🪫', kind: 'few' });
  }
  // Things you buy often but don't have
  const freq = {};
  for (const h of state.history) if ((h.type === 'bought' || h.type === 'used') && h.foodId) freq[h.foodId] = (freq[h.foodId] || 0) + 1;
  const inStock = new Set(state.items.filter(i => Number(i.qty) > 0).map(i => i.foodId));
  Object.entries(freq).filter(([id, n]) => n >= 2 && !inStock.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([id]) => {
    const f = FOOD_BY_ID[id]; if (f) push(id, { name: f.name, foodId: id, emoji: f.emoji, unit: f.unit, qty: 1, reason: 'You usually keep this', icon: '🔁' });
  });
  return out;
}

export const scaleQty = (qty, servings, guests) => {
  if (!guests || !servings) return qty;
  return Math.round(qty * Math.max(1, guests / servings) * 4) / 4;
};

export function fmtDate(isoDate, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(isoDate + 'T12:00').toLocaleDateString(undefined, opts);
}

export const fmtQty = q => {
  const n = Number(q);
  if (!isFinite(n)) return q;
  const whole = Math.floor(n), frac = n - whole;
  const fr = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.66, '⅔'], [0.67, '⅔'], [0.75, '¾']].find(([v]) => Math.abs(frac - v) < 0.02);
  if (fr) return (whole ? whole : '') + fr[1];
  return String(Math.round(n * 100) / 100);
};

export const catOf = id => CAT_BY_ID[id] || { name: 'Other', emoji: '📦', color: '#888' };
// Inline style giving an element its category color (used to tint emoji backgrounds).
export const tint = cat => `--tint:${catOf(cat).color}`;

// ---------- prices (from receipts) ----------
// Every receipt line becomes a price point for that item at that store.
export function recordReceipt({ store, storeId, total, items }) {
  const date = today(), by = who();
  update(s => {
    s.prices ||= [];
    for (const i of items) s.prices.push({ id: uid(), foodId: i.foodId || null, name: i.name, store, storeId: storeId || null, price: Number(i.price), date, by });
    s.prices = s.prices.slice(-1500);
    s.history.push({ ts: Date.now(), by, type: 'receipt', name: store, total: total ?? items.reduce((a, i) => a + Number(i.price), 0), count: items.length });
  }, 'receipt');
}

const sameItem = (p, foodId, name) => foodId ? p.foodId === foodId : p.name.toLowerCase() === String(name).toLowerCase();
// Latest price at each store, cheapest first.
export function priceInfo(foodId, name) {
  const latest = new Map();
  for (const p of (state.prices || []).filter(p => sameItem(p, foodId, name))) { const prev = latest.get(p.store); if (!prev || p.date >= prev.date) latest.set(p.store, p); }
  const byStore = [...latest.values()].sort((a, b) => a.price - b.price);
  return { byStore, cheapest: byStore[0] || null, last: (state.prices || []).filter(p => sameItem(p, foodId, name)).at(-1) || null };
}
export const money = n => '$' + (Math.round(Number(n) * 100) / 100).toFixed(2);

// ---------- weekly report ----------
export function weekReport(weeksAgo = 0) {
  const now = new Date(); const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay() - weeksAgo * 7);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const inWeek = (state.history || []).filter(h => h.ts >= +start && h.ts < +end);
  const tossed = inWeek.filter(h => h.type === 'tossed');
  const value = h => { const pi = priceInfo(h.foodId, h.name); return pi.last ? pi.last.price : 0; };
  const spentByDay = Array(7).fill(0);
  for (const h of inWeek.filter(h => h.type === 'receipt')) spentByDay[new Date(h.ts).getDay()] += Number(h.total) || 0;
  const people = {};
  for (const h of inWeek) if (h.by && ['requested', 'bought', 'cooked', 'used', 'trip'].includes(h.type)) people[h.by] = (people[h.by] || 0) + 1;
  const wasteCats = {};
  for (const h of tossed) wasteCats[h.cat || 'other'] = (wasteCats[h.cat || 'other'] || 0) + 1;
  return {
    start: iso(start), end: iso(new Date(+end - 1)),
    spent: spentByDay.reduce((a, b) => a + b, 0), spentByDay, receipts: inWeek.filter(h => h.type === 'receipt').length,
    tossed: tossed.length, tossedValue: tossed.reduce((a, h) => a + value(h), 0), tossedItems: tossed.map(h => h.name),
    usedUp: inWeek.filter(h => h.type === 'used' && h.last).length, cooked: inWeek.filter(h => h.type === 'cooked').length,
    bought: inWeek.filter(h => h.type === 'bought').length, requested: inWeek.filter(h => h.type === 'requested').length,
    people, wasteCats,
  };
}

// ---------- store trips ----------
// "Poppy is going to the store Thursday — get your list in before noon."
export function addTrip({ date, cutoff, store, note }) {
  const t = { id: uid(), by: who(), date, cutoff, store: store || '', note: note || '', done: false, created: Date.now() };
  update(s => { (s.trips ||= []).push(t); s.history.push({ ts: Date.now(), by: who(), type: 'trip', tripId: t.id, name: store || 'the store', date }); }, 'trip');
  return t;
}
export const finishTrip = id => update(s => { const t = (s.trips || []).find(x => x.id === id); if (t) t.done = true; }, 'trip');
export const activeTrips = () => (state.trips || []).filter(t => !t.done && t.date >= today()).sort((a, b) => a.date < b.date ? -1 : 1);

// ---------- events ----------

export function saveEvent(ev) {
  update(s => { const i = s.events.findIndex(e => e.id === ev.id); if (i >= 0) s.events[i] = ev; else s.events.push(ev); }, 'event-save');
}
export const removeEvent = id => update(s => { s.events = s.events.filter(e => e.id !== id); }, 'event-remove');

// ---------- sample kitchen ----------

export function seedSample() {
  const T = today();
  const add = (foodId, qty, extra = {}) => makeItem({ foodId, qty, ...extra });
  const items = [
    add('milk', 1, { minQty: 0.5, unit: 'gal', expires: addDays(T, 4) }),
    add('eggs', 1, { minQty: 0.5, unit: 'dozen' }),
    add('butter', 2, { unit: 'stick', minQty: 1 }),
    add('cheddar-cheese', 8, { opened: true }),
    add('greek-yogurt', 32, { expires: addDays(T, 2) }),
    add('sour-cream', 16, { expires: addDays(T, -1) }),
    add('chicken-breast', 2, { expires: addDays(T, 1) }),
    add('ground-beef', 1, { sectionId: 'fz-bin', expires: addDays(T, 90) }),
    add('bacon', 1),
    add('carrots', 2), add('celery', 1), add('lettuce', 1, { expires: addDays(T, 2) }),
    add('bell-peppers', 3), add('broccoli', 1), add('apples', 6), add('lemons', 3), add('strawberries', 1, { expires: addDays(T, 1) }),
    // as photographed: top shelf, cheese drawer, middle/bottom shelves and both doors
    add('pickles', 1, { name: 'Sweet Relish', emoji: '🥒', sectionId: 'fr-top' }), add('bottled-water', 2, { sectionId: 'fr-top', unit: 'bottle' }),
    add('mayonnaise', 1, { sectionId: 'fr-top' }), add('bbq-sauce', 1, { sectionId: 'fr-top' }),
    add('cream-cheese', 8, { sectionId: 'fr-mid' }), add('tortillas', 1, { name: 'Pillsbury Crescent Rolls', emoji: '🥐', cat: 'bakery', foodId: null, sectionId: 'fr-mid', expires: addDays(T, 12) }),
    add('ketchup', 1, { sectionId: 'fr-bot' }), add('soda', 1, { name: 'Pepsi', sectionId: 'fr-bot', unit: 'pack' }), add('parmesan', 1, { unit: 'jar', sectionId: 'fr-bot' }),
    add('bread', 1, { name: 'Cinnamon Swirl Bread', emoji: '🍞', sectionId: 'fr-bot', expires: addDays(T, 6) }),
    add('ranch-dressing', 1, { sectionId: 'fr-dl-2' }), add('ranch-dressing', 1, { name: 'Caesar Dressing', sectionId: 'fr-dl-2' }), add('ranch-dressing', 1, { name: 'Italian Dressing', sectionId: 'fr-dl-2' }),
    add('maple-syrup', 1, { sectionId: 'fr-dl-3' }), add('maple-syrup', 1, { name: 'Chocolate Syrup', emoji: '🍫', sectionId: 'fr-dl-3' }), add('hot-sauce', 2, { sectionId: 'fr-dl-1', unit: 'bottle' }),
    add('mustard', 1, { sectionId: 'fr-dr-1' }), add('bbq-sauce', 1, { name: 'Jim Beam BBQ Sauce', sectionId: 'fr-dr-1' }),
    add('jam', 2, { sectionId: 'fr-dr-2' }), add('soy-sauce', 1, { sectionId: 'fr-dr-2' }), add('worcestershire-sauce', 1, { sectionId: 'fr-dr-2' }),
    add('orange-juice', 1, { minQty: 0.5, sectionId: 'fr-dr-3' }), add('half-and-half', 1, { sectionId: 'fr-dr-3' }),
    add('leftovers', 2, { name: 'Leftover Chili', emoji: '🍲', expires: addDays(T, 2), sectionId: 'fr-mid' }),
    add('leftovers', 1, { name: 'Leftover Pineapple', emoji: '🍍', expires: addDays(T, 3), sectionId: 'fr-bot' }),
    // freezer drawer: slide-out tray over the deep basket
    add('ice', 2, { name: 'Ice Cube Trays', unit: 'tray', sectionId: 'fz-tray' }), add('mozzarella-sticks', 1, { sectionId: 'fz-tray' }),
    add('chicken-nuggets', 1, { name: 'Crispy Chicken Fries', sectionId: 'fz-tray' }), add('frozen-mixed-vegetables', 2, { name: 'Steam-in-Bag Veggies', sectionId: 'fz-tray' }),
    add('ice-cream', 2, { name: 'Hood Creamy Coffee Ice Cream', sectionId: 'fz-bin' }), add('french-fries', 1, { name: 'Crinkle Cut Fries', sectionId: 'fz-bin' }),
    add('frozen-waffles', 1, { name: 'Frozen Pancakes', emoji: '🥞', sectionId: 'fz-bin' }), add('frozen-peas', 1, { sectionId: 'fz-bin' }), add('frozen-pizza', 2, { sectionId: 'fz-bin' }),
    add('whole-turkey', 14, { sectionId: 'gu-bin', tags: ['thanksgiving'] }),
    add('dog-food', 1, { minQty: 1, notes: "Clyde's kibble", sectionId: 'cl-bag' }), add('dog-food', 1, { name: 'Kibble (in bowl)', unit: 'bowl', sectionId: 'cl-bowl', noExpiry: true, expires: null }),
    add('dog-treats', 1, { minQty: 1, sectionId: 'cl-treats' }), add('dog-bones', 3, { unit: 'ea', sectionId: 'cl-treats' }),
    add('steak', 3, { sectionId: 'gu-2', expires: addDays(T, 200) }), add('frozen-berries', 2, { sectionId: 'gu-3' }), add('shrimp', 2, { sectionId: 'gu-2' }),
    add('ice', 2, { sectionId: 'gz-main' }), add('frozen-waffles', 1, { sectionId: 'gz-door' }),
    add('beer', 2, { sectionId: 'gf-door' }), add('sparkling-water', 2, { sectionId: 'gf-door' }), add('eggnog', 1, { sectionId: 'gf-top', tags: ['christmas'] }),
    add('all-purpose-flour', 5, { minQty: 1 }), add('granulated-sugar', 4), add('brown-sugar', 1), add('baking-soda', 1), add('baking-powder', 1),
    add('vanilla-extract', 1), add('chocolate-chips', 1), add('cocoa-powder', 1), add('honey', 1),
    add('salt', 1), add('black-pepper', 1), add('garlic-powder', 1), add('cinnamon', 1), add('paprika', 1), add('chili-powder', 1), add('cumin', 1), add('italian-seasoning', 1), add('thyme', 1), add('sage', 1, { minQty: 1, qty: 0 }),
    add('diced-tomatoes', 3, { minQty: 2 }), add('black-beans', 2), add('kidney-beans', 1), add('chicken-broth', 2, { minQty: 2, qty: 1 }), add('marinara-sauce', 1), add('tuna', 4), add('peanut-butter', 1), add('pumpkin-puree', 1, { tags: ['thanksgiving'] }), add('cream-of-mushroom-soup', 1),
    add('olive-oil', 1), add('vegetable-oil', 1), add('soy-sauce', 1),
    add('cereal', 2), add('rolled-oats', 1), add('granola-bars', 1), add('tortilla-chips', 1), add('popcorn', 1),
    add('bread', 1, { expires: addDays(T, 3) }), add('bananas', 5, { expires: addDays(T, 2) }), add('avocados', 2), add('coffee', 1, { minQty: 1 }),
    add('spaghetti', 2), add('penne', 1), add('white-rice', 3), add('elbow-macaroni', 1), add('tortillas', 1),
    add('potatoes', 5), add('onions', 4), add('garlic', 2), add('soda', 1), add('bottled-water', 1),
    add('slow-cooker', 1), add('stand-mixer', 1), add('meat-thermometer', 1), add('pie-dish', 1),
    add('aluminum-foil', 1), add('zip-bags', 2), add('dish-soap', 1, { minQty: 1 }), add('paper-towels', 1),
    add('roasting-pan', 1, { tags: ['thanksgiving'] }), add('turkey-baster', 1, { tags: ['thanksgiving'] }), add('gravy-boat', 1, { tags: ['thanksgiving', 'christmas'] }),
    add('cookie-cutters', 1, { tags: ['christmas'], notes: 'Snowflake, tree, gingerbread man' }), add('holiday-napkins', 2, { tags: ['christmas'] }),
    add('serving-platter', 2, { sectionId: 'afl-1', notes: 'The good platters — up top, need the step stool' }), add('cake-stand', 1, { sectionId: 'afr-1' }), add('punch-bowl', 1, { tags: ['party'] }), add('birthday-candles', 1, { tags: ['party'] }),
  ];
  const nextDow = dow => { const d = new Date(); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7)); return iso(d); };
  const thanksgiving = (() => { const y = new Date().getFullYear(); const d = new Date(y, 10, 1); const off = (4 - d.getDay() + 7) % 7; const t = new Date(y, 10, 1 + off + 21); return t < new Date() ? null : iso(t); })();
  const events = [
    { id: uid(), date: addDays(T, 1), kind: 'meal', slot: 'Dinner', title: 'Taco night', emoji: '🌮', recipeIds: ['b-beef-tacos'], guests: 4, notes: '' },
    { id: uid(), date: addDays(T, 2), kind: 'meal', slot: 'Dinner', title: 'Stir-fry', emoji: '🥢', recipeIds: ['b-chicken-stir-fry'], guests: 4, notes: 'Use the chicken before it turns' },
    { id: uid(), date: nextDow(6), kind: 'meal', slot: 'Breakfast', title: 'Pancake Saturday', emoji: '🥞', recipeIds: ['b-fluffy-pancakes'], guests: 4, notes: '' },
    { id: uid(), date: nextDow(0), kind: 'gathering', slot: 'Dinner', title: 'Game day with friends', emoji: '🏈', recipeIds: ['b-game-day-seven-layer-dip', 'b-slow-cooker-pulled-pork'], guests: 10, notes: 'Mike bringing drinks' },
  ];
  if (thanksgiving) events.push({ id: uid(), date: thanksgiving, kind: 'gathering', slot: 'Dinner', title: 'Thanksgiving at our place', emoji: '🦃', recipeIds: ['b-classic-roast-turkey', 'b-herb-bread-stuffing', 'b-creamy-mashed-potatoes', 'b-green-bean-casserole', 'b-pumpkin-pie', 'b-fresh-cranberry-sauce'], guests: 12, notes: 'Aunt Jo is bringing rolls. Get the good platter out of the holiday closet.' });
  const shopping = [];
  update(s => {
    s.items = items; s.events = events; s.shopping = shopping;
    s.history = ['milk', 'eggs', 'bread', 'bananas', 'coffee', 'milk', 'eggs', 'bananas', 'butter', 'butter'].map((foodId, i) => ({ ts: Date.now() - i * 864e5 * 3, type: 'bought', foodId, name: FOOD_BY_ID[foodId].name, qty: 1 }));
    s.favorites = ['b-beef-tacos', 'b-chocolate-chip-cookies'];
    // a lived-in household: who asked for what, and Poppy's store run Thursday
    const [andrew, zayne, gemmie, poppy] = (s.members || []).map(m => m.id);
    if (poppy) {
      const now = Date.now(), H = 36e5;
      const thu = (() => { const d = new Date(); d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7)); return iso(d); })();
      const cut = new Date(); if (cut.getHours() >= 12) cut.setDate(cut.getDate() + 1); cut.setHours(12, 0, 0, 0);
      const trip = { id: uid(), by: poppy, date: thu, cutoff: cut.toISOString(), store: 'Hannaford', note: '', done: false, created: now - 3 * H };
      s.trips = [trip];
      const req = (by, foodId, reason, hoursAgo) => {
        const f = FOOD_BY_ID[foodId];
        s.shopping.push({ id: uid(), by, name: f.name, foodId, cat: f.cat, emoji: f.emoji, qty: 1, unit: f.unit, done: false, reasons: reason ? [reason] : [], added: T, note: '' });
        s.history.push({ ts: now - hoursAgo * H, by, type: 'requested', name: f.name, foodId, cat: f.cat });
      };
      req(andrew, 'coffee', 'Running low', 5); req(zayne, 'dog-treats', 'For Clyde', 2); req(gemmie, 'strawberries', '', 1);
      s.history.push({ ts: now - 26 * H, by: gemmie, type: 'used', last: true, name: 'Sage', foodId: 'sage', cat: 'spices' });
      s.history.push({ ts: now - 3 * H, by: poppy, type: 'trip', tripId: trip.id, name: 'Hannaford', date: thu });
      s.history.push({ ts: now - 30 * H, by: andrew, type: 'cooked', name: 'Spaghetti Bolognese', recipeId: 'b-spaghetti-bolognese' });
      const P = (foodId, store, price, daysAgo) => s.prices.push({ id: uid(), foodId, name: FOOD_BY_ID[foodId].name, store, storeId: null, price, date: addDays(T, -daysAgo), by: poppy });
      s.prices = [];
      [['milk', 3.49, 3.18], ['eggs', 3.99, 3.62], ['coffee', 8.99, 7.98], ['dog-food', 21.99, 18.97], ['dog-treats', 6.49, 5.88], ['strawberries', 3.99, 2.98], ['bananas', 1.38, 1.24], ['bread', 2.99, 2.48], ['cheddar-cheese', 3.29, 2.97], ['chicken-breast', 8.97, 7.94]]
        .forEach(([id, h, w]) => { P(id, 'Hannaford', h, 9); P(id, 'Walmart', w, 16); });
      s.history.push({ ts: now - 2 * 864e5, by: poppy, type: 'receipt', name: 'Hannaford', total: 64.12, count: 14 });
      s.history.push({ ts: now - 30 * H, by: zayne, type: 'tossed', name: 'Strawberries', foodId: 'strawberries', cat: 'produce' });
      s.history.push({ ts: now - 50 * H, by: gemmie, type: 'tossed', name: 'Lettuce', foodId: 'lettuce', cat: 'produce' });
      s.history.sort((a, b) => a.ts - b.ts);
    }
  }, 'seed');
}

export { slug };
