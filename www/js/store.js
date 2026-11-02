// App state: one JSON document persisted to localStorage, with versioned migrations and a
// tiny pub/sub. Every mutation goes through `update()` so views re-render consistently.

import { DEFAULT_ZONES, suggestSection, LEGACY_SECTIONS, PANTRY_SECTIONS, shedBoxes } from './data/layout.js';
import { FOOD_BY_ID, CAT_BY_ID, matchFood, slug, GEAR_CATS, SUPPLY_CATS } from './data/foods.js';
import { BUILTIN_RECIPES } from './data/recipes.js';
import { iso } from './data/holidays.js';

const KEY = 'shelfstock.state';
const OLD_KEY = 'larder.state'; // before the rename to Shelf & Stock
const VERSION = 14;

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
    items: [], shopping: [], events: [], recipes: [], favorites: [], history: [], members: [], trips: [], stores: [], prices: [], barcodes: [], boxes: shedBoxes(), approvals: [],
    settings: { onboarded: false, household: 2, tourDone: false, wood: 'walnut', cabinets: 'painted', season: 'auto', stapleIds: ['salt', 'black-pepper', 'vegetable-oil', 'olive-oil'], expiryWarnDays: 3, haptics: true },
  };
}

const MIGRATIONS = {
  // v13 → v14: the whole house. The bathroom, basement racks, garage walls and the shed's stacked boxes are
  // added after the kitchen's places (nothing already there is touched), plus storage boxes and approvals.
  14: s => {
    for (const d of DEFAULT_ZONES.filter(z => z.room)) if (!s.zones.some(x => x.id === d.id)) s.zones.push(structuredClone(d));
    s.boxes ||= [];
    for (const b of shedBoxes()) if (!s.boxes.some(x => x.id === b.id)) s.boxes.push(b);
    s.approvals ||= [];
  },
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
      if (!valid.has(it.sectionId)) it.sectionId = suggestSection(FOOD_BY_ID[it.foodId], s.zones, it);
    }
  },
  // v12 → v13: the household's barcode memory (what anyone here named a barcode as), seeded from items already saved with one
  13: s => {
    s.barcodes ||= [];
    for (const it of s.items || []) if (it.barcode && !s.barcodes.some(b => b.id === it.barcode)) s.barcodes.push({ id: it.barcode, name: it.name, brand: it.brand || '', foodId: it.foodId || null, emoji: it.emoji, image: /^https:/.test(it.image || '') ? it.image : '' });
  },
  // v11 → v12: fridge spots named like the real one (fresh box, small shelf, vegetable & produce drawers)
  12: s => {
    const z = s.zones.find(x => x.id === 'fridge'); if (!z) return;
    const NEW = { 'fr-drawer': ['Cheese Drawer', 'Fresh Box'], 'fr-mid': ['Middle Shelf', 'Small Shelf'], 'fr-crisp-l': ['Left Crisper', 'Vegetable Drawer'], 'fr-crisp-r': ['Right Crisper', 'Produce Drawer'] };
    for (const sec of z.sections) if (NEW[sec.id] && sec.name === NEW[sec.id][0]) sec.name = NEW[sec.id][1];
  },
  // v10 → v11: shelf counts from the real cabinets, a second big base on the corner wall, the laundry nook.
  // Only shelves still carrying their old default name are renamed; missing shelves and places are added.
  11: s => {
    const OLD = { 'afl-1': 'Shelf', 'afr-1': 'Shelf', 'cs-1': 'Coffee & Filters', 'sink-1': 'Cleaning Supplies', 'sink-2': 'Trash Bags & Sponges', 'bl-1': 'Shelf', 'bl-2': 'Floor', 'br-1': 'Shelf', 'br-2': 'Floor', 'bb-1': 'Shelf', 'bb-2': 'Floor' };
    for (const zid of ['above-fridge-l', 'above-fridge-r', 'corner-small', 'sink-base', 'base-l', 'base-r', 'base-big']) {
      const z = s.zones.find(x => x.id === zid), d = DEFAULT_ZONES.find(x => x.id === zid);
      if (!z || !d) continue;
      for (const sec of d.sections) {
        const have = z.sections.find(x => x.id === sec.id);
        if (!have) z.sections.push({ ...sec }); else if (have.name === OLD[sec.id]) have.name = sec.name;
      }
    }
    // every pantry shelf is a sliding drawer (1.4.1 named three of them "Pull-out Tray")
    const pz = s.zones.find(x => x.id === 'pantry');
    const WAS = { 'pa-1': ['Top Shelf · Bags', 'Top Shelf · Bulk'], 'pa-2': ['Shelf 2 · Pull-out Tray', 'Grains & Pasta'], 'pa-3': ['Shelf 3 · Pull-out Tray', 'Canned Overflow'], 'pa-4': ['Shelf 4 · Pull-out Tray', 'Snacks'] };
    if (pz) for (const d of PANTRY_SECTIONS) { const sec = pz.sections.find(x => x.id === d.id); if (sec && WAS[d.id]?.includes(sec.name)) sec.name = d.name; }
    const at = Math.max(0, s.zones.findIndex(x => x.id === 'g-fridge-fz'));
    for (const id of ['laundry-counter', 'laundry-mid', 'laundry-top', 'base-big-r']) if (!s.zones.some(x => x.id === id)) s.zones.splice(at, 0, structuredClone(DEFAULT_ZONES.find(x => x.id === id)));
  },
  // v9 → v10: the stand-up pantry closet left of the fridge (4 shelves + floor); only renames what's still the old default
  10: s => {
    let z = s.zones.find(x => x.id === 'pantry');
    if (!z) { z = structuredClone(DEFAULT_ZONES.find(x => x.id === 'pantry')); s.zones.splice(Math.max(0, s.zones.findIndex(x => x.id === 'holiday')), 0, z); return; }
    const OLD = { 'pa-1': 'Top Shelf · Bulk', 'pa-2': 'Grains & Pasta', 'pa-3': 'Canned Overflow', 'pa-4': 'Snacks', 'pa-5': 'Floor · Drinks & Potatoes' };
    if (z.name === 'Pantry') { z.name = 'Pantry Closet'; z.short = 'Pantry'; }
    for (const d of PANTRY_SECTIONS) {
      const sec = z.sections.find(x => x.id === d.id);
      if (!sec) z.sections.push({ ...d }); else if (sec.name === OLD[d.id]) sec.name = d.name;
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
      if (!valid.has(it.sectionId)) it.sectionId = suggestSection(FOOD_BY_ID[it.foodId], s.zones, it);
    }
  },
};

// ---------- keeping user text safe ----------
// Icons are printed straight into the page, so they're kept to a short emoji: markup characters are
// dropped. Photos must be image data or https links, colors must be colors. Run on every save, load,
// restored backup and synced kitchen, so nothing typed on any phone can inject code into another.
export const cleanEmoji = (e, fallback = '📦') => String(e ?? '').replace(/[<>&"'`\\]/g, '').trim().slice(0, 16) || fallback;
const cleanImg = u => typeof u === 'string' && /^(data:image\/[a-z+.-]+;base64,[a-z0-9+/=]+|https:\/\/[^"'<>\s`]+)$/i.test(u) ? u : '';
const cleanColor = c => typeof c === 'string' && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(c) ? c : '#a0703e';
export function sanitize(s) {
  for (const i of s.items || []) { i.emoji = cleanEmoji(i.emoji); if (i.image) i.image = cleanImg(i.image); }
  for (const e of s.shopping || []) if (e.emoji != null) e.emoji = cleanEmoji(e.emoji, '🛒');
  for (const e of s.events || []) if (e.emoji != null) e.emoji = cleanEmoji(e.emoji, '🍽️');
  for (const r of s.recipes || []) { r.emoji = cleanEmoji(r.emoji, '🍲'); if (r.image) r.image = cleanImg(r.image); }
  for (const m of s.members || []) { m.emoji = cleanEmoji(m.emoji, '⭐'); m.color = cleanColor(m.color); if (m.photo) m.photo = cleanImg(m.photo); }
  for (const b of s.barcodes || []) { b.emoji = cleanEmoji(b.emoji); if (b.image) b.image = cleanImg(b.image); }
  // storage boxes: photos are ids into the photo store, nothing else
  const photoId = p => typeof p === 'string' && /^[a-z0-9_-]{4,64}$/i.test(p) ? p : null;
  for (const b of s.boxes || []) { b.code = String(b.code ?? '').slice(0, 12); b.color = b.color ? cleanColor(b.color) : null; b.photo = photoId(b.photo); b.inside = photoId(b.inside); }
  return s;
}

// Bring a saved kitchen (this phone's, a backup file) up to date.
export function migrate(s) {
  s.settings ||= {}; s.zones ||= []; s.items ||= [];
  for (let v = (s.v || 1) + 1; v <= VERSION; v++) MIGRATIONS[v]?.(s);
  s.v = VERSION;
  return sanitize(s);
}

// The shared part of a kitchen from household sync. Phones on older versions don't send a version
// and know nothing of newer storage, so re-run the layout steps (10 and up only touch zones and only
// add or rename defaults, so running them again is harmless).
export function upgradeShared(r) {
  if (!r?.zones) return r;
  r.items ||= [];
  for (let v = Math.max(r.v ?? 9, 9) + 1; v <= VERSION; v++) MIGRATIONS[v]?.(r);
  r.v = VERSION;
  return sanitize(r);
}

// The Android app keeps its own copy in a file, written on every save: the WebView only writes localStorage
// to disk now and then (it rations writes), so a phone that kills the app could lose the last few minutes.
// Each copy carries when it was saved; the newer one wins.
const AT_KEY = KEY + '.at';
function writeCopies(json) {
  const at = Date.now();
  try { localStorage.setItem(KEY, json); localStorage.setItem(AT_KEY, String(at)); } catch (e) { console.error('save failed', e); }
  try { window.LarderNative?.saveState?.(JSON.stringify({ at, json })); } catch { }
}
function newestSaved() {
  let raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
  try {
    const f = window.LarderNative?.loadState?.();
    const copy = f && JSON.parse(f);
    if (copy?.json && copy.at > Number(localStorage.getItem(AT_KEY) || 0)) raw = copy.json;
  } catch { }
  return raw;
}

function load() {
  try {
    const raw = newestSaved();
    if (!raw) return blank();
    const s = migrate(JSON.parse(raw));
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
  saveTimer = setTimeout(() => writeCopies(JSON.stringify(state)), 120);
}

export function update(fn, why = '') {
  fn(state);
  sanitize(state);
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
  writeCopies(JSON.stringify(state));
  try { localStorage.removeItem(OLD_KEY); } catch { }
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
  // a shelf that no longer exists (deleted, or from another phone's layout) gets a suggested one instead
  const sectionId = (partial.sectionId && state.zones.some(z => z.sections.some(x => x.id === partial.sectionId)) && partial.sectionId) || suggestSection(food, state.zones, partial);
  const it = {
    id: uid(), name: food?.name || partial.name || 'Item', foodId: food?.id || null,
    cat: food?.cat || partial.cat || 'pantry', emoji: food?.emoji || partial.emoji || '📦',
    qty: 1, unit: food?.unit || 'ea', sectionId, added: today(), expires: null,
    opened: false, openedOn: null, minQty: null, barcode: '', brand: '', image: '', off: null, tags: [], notes: '',
    // what exactly it is, and the purchase: kind/variety ("Blue Sparkle", "2%"), package size, store, price paid, who bought it
    kind: '', size: '', store: '', price: null, boughtBy: who() || null,
    dateType: 'Estimated', dated: false,
    ...partial,
    sectionId,
  };
  if (!it.foodId && food) it.foodId = food.id;
  if (it.expires === null && !partial.noExpiry) {
    const sec = sectionById(it.sectionId);
    const kind = sec?.zone.kind === 'freezer' ? 'freezer' : sec?.zone.kind === 'fridge' ? 'fridge' : 'pantry';
    const life = shelfLifeDays(food, kind) || shelfLifeDays(food, food?.zone === 'fridge' ? 'fridge' : 'pantry');
    if (life && !GEAR_CATS.has(food?.cat) && !SUPPLY_CATS.has(food?.cat)) it.expires = addDays(it.added, life);
  }
  delete it.noExpiry;
  return it;
}

export function addItem(partial) {
  const it = makeItem(partial);
  update(s => { s.items.push(it); rememberBarcode(s, it); s.history.push({ ts: Date.now(), by: who(), type: 'added', name: it.name, foodId: it.foodId, qty: it.qty }); }, 'item-add');
  return it;
}

export function saveItem(it) {
  syncBatches(it);
  update(s => { const i = s.items.findIndex(x => x.id === it.id); if (i >= 0) s.items[i] = it; else s.items.push(it); rememberBarcode(s, it); }, 'item-save');
}

// The household's own barcode list: once anyone names a barcode, every phone here knows it next time.
// Same idea the big scanner apps grew from. Photos stay out (too big to sync); label links are kept.
function rememberBarcode(s, it) {
  const code = String(it.barcode || '').replace(/\D/g, '');
  if (code.length < 8 || !it.name) return;
  s.barcodes ||= [];
  const entry = { id: code, name: it.name, brand: it.brand || '', foodId: it.foodId || null, emoji: it.emoji, image: /^https:/.test(it.image || '') ? it.image : '' };
  const i = s.barcodes.findIndex(b => b.id.replace(/^0+/, '') === code.replace(/^0+/, ''));
  if (i >= 0) s.barcodes[i] = { ...s.barcodes[i], ...entry }; else s.barcodes.push(entry);
  if (s.barcodes.length > 2000) s.barcodes = s.barcodes.slice(-2000);
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

const implicitBatch = it => ({ id: uid(), qty: Number(it.qty) || 0, expires: it.expires || null, added: it.added || today(), dateType: it.dateType || 'Estimated', store: it.store || '', price: it.price ?? null, by: it.boughtBy || null });

// A new purchase of something you have: its own batch with its own date, store, price and buyer.
export function restockItem(id, { qty, expires = null, dateType = 'Best by', store = '', price = null, size = '' }) {
  const nb = { id: uid(), qty: Number(qty) || 1, expires, added: today(), dateType, store: store || '', price: price ?? null, by: who() || null };
  update(s => {
    const it = s.items.find(x => x.id === id);
    if (!it) return;
    const batches = it.batches?.length ? it.batches : (Number(it.qty) > 0 ? [implicitBatch(it)] : []);
    // then the item shows its latest purchase
    if (store) it.store = store;
    if (price != null) it.price = price;
    if (size) it.size = size;
    it.boughtBy = who() || it.boughtBy || null;
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
// water in a recipe comes from the tap: always on hand, never on the list
const TAP_WATER = /^\s*(cold |warm |hot |boiling |ice |lukewarm |tap )?water\s*$/i;

export function recipeMatch(r, servings = r.servings) {
  const st = staples();
  const rows = r.ingredients.map(ing => {
    const tap = TAP_WATER.test(ing.name);
    const food = tap ? null : ing.foodId ? FOOD_BY_ID[ing.foodId] : matchFood(ing.name);
    const stock = tap ? [] : stockFor(ing.name, food?.id);
    const staple = tap || (food && st.has(food.id));
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
      // the same need asked for again (tapping "Shop for…" twice) doesn't double it; a different reason adds up
      if (entry.reason && dup.reasons.includes(entry.reason)) return;
      if (entry.reason) dup.reasons.push(entry.reason);
      if (entry.unit === dup.unit && entry.qty) dup.qty = Math.round((Number(dup.qty) + Number(entry.qty)) * 100) / 100;
      return;
    }
    added = true;
    s.history.push({ ts: Date.now(), by: who(), type: 'requested', name, foodId: food?.id || null, cat: food?.cat || entry.cat });
    s.shopping.push({ by: who(),
      brand: entry.brand || '', kind: entry.kind || '', size: entry.size || '', store: entry.store || usualStore(food?.id, name) || '',
      aisle: aisleAt(entry.store || usualStore(food?.id, name), food?.id, name),
      id: uid(), name, foodId: food?.id || null, cat: food?.cat || entry.cat || 'pantry',
      emoji: food?.emoji || entry.emoji || '🛒', qty: entry.qty || 1, unit: entry.unit || food?.unit || 'ea',
      done: false, reasons: entry.reason ? [entry.reason] : [], added: today(), note: entry.note || '',
    });
  }, 'list-add');
  return added;
}

// Check off: move into stock (the satisfying part).
export function checkOffToStock(id, { store = '' } = {}) {
  const e = state.shopping.find(x => x.id === id);
  if (!e) return null;
  const existing = matchingItem(e.foodId, e.unit, e.brand, e.kind);
  const where = store || myTripStore() || '';
  const paid = where ? priceInfo(e.foodId, e.name).byStore.find(p => p.store === where)?.price ?? null : null;
  let it;
  if (existing) {
    // A new purchase is a new batch with its own (estimated until labeled) date.
    const food = FOOD_BY_ID[existing.foodId];
    const life = shelfLifeDays(food, storageKind(existing));
    const batchId = restockItem(existing.id, { qty: e.qty, expires: life ? addDays(today(), life) : null, dateType: 'Estimated', store: where, price: paid, size: e.size || '' });
    update(s => { s.shopping = s.shopping.filter(y => y.id !== id); }, 'list-stock');
    return { item: state.items.find(i => i.id === existing.id), batchId };
  } else {
    it = makeItem({ name: e.name, foodId: e.foodId, qty: e.qty, unit: e.unit, cat: e.cat, emoji: e.emoji, brand: e.brand || '', kind: e.kind || '', size: e.size || '', store: where, price: paid });
    update(s => {
      s.items.push(it);
      s.shopping = s.shopping.filter(y => y.id !== id);
      s.history.push({ ts: Date.now(), by: who(), type: 'bought', name: it.name, foodId: it.foodId, qty: e.qty, cat: it.cat });
    }, 'list-stock');
  }
  return { item: it, batchId: null };
}

// The item a new purchase belongs to: same food and unit, preferring the same brand and kind
// (so Hood 2% doesn't land on the store-brand whole milk).
export function matchingItem(foodId, unit, brand = '', kind = '') {
  if (!foodId) return null;
  const same = state.items.filter(it => it.foodId === foodId && it.unit === unit);
  const b = (brand || '').toLowerCase(), k = (kind || '').toLowerCase();
  return same.find(it => b && (it.brand || '').toLowerCase() === b && (!k || (it.kind || '').toLowerCase() === k))
    || same.find(it => b && (it.brand || '').toLowerCase() === b)
    || (b ? same.find(it => !it.brand) : null)
    || (b ? null : same[0]) || null;
}

// Where something is usually bought: the store it was bought at most often (batches, receipts, prices).
// "HANNAFORD", "hannaford" and "Hannaford" are one store: the saved store's spelling wins, else title case
export function storeName(name) {
  const n = String(name || '').trim(); if (!n) return '';
  const saved = (state.stores || []).find(x => x.name.toLowerCase() === n.toLowerCase());
  return saved ? saved.name : n === n.toUpperCase() || n === n.toLowerCase() ? n.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/'S\b/g, "'s") : n;
}

export function usualStore(foodId, name) {
  const n = (name || '').toLowerCase(), count = {};
  const add = st => { st = storeName(st); if (st) count[st] = (count[st] || 0) + 1; };
  for (const it of state.items) if ((foodId && it.foodId === foodId) || (!foodId && it.name.toLowerCase() === n)) { add(it.store); for (const b of it.batches || []) add(b.store); }
  for (const p of state.prices || []) if ((foodId && p.foodId === foodId) || (!foodId && p.name.toLowerCase() === n)) add(p.store);
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}
// Which aisle it's in at a store, from any item of that food that's been given one ("Aisle 7").
export function aisleAt(store, foodId, name) {
  if (!store) return '';
  const st = storeName(store), n = (name || '').toLowerCase();
  for (const it of state.items) if ((foodId && it.foodId === foodId) || (!foodId && it.name.toLowerCase() === n)) { const a = it.aisles?.[st]; if (a) return a; }
  return '';
}
// Remember an aisle for every item of that food, and every list entry for it at that store.
export function setAisle(store, foodId, name, aisle) {
  const st = storeName(store), n = (name || '').toLowerCase(), a = String(aisle || '').trim();
  update(s => {
    for (const it of s.items) if ((foodId && it.foodId === foodId) || (!foodId && it.name.toLowerCase() === n)) { it.aisles ||= {}; if (a) it.aisles[st] = a; else delete it.aisles[st]; }
    for (const e of s.shopping) if (storeName(e.store) === st && ((foodId && e.foodId === foodId) || (!foodId && e.name.toLowerCase() === n))) e.aisle = a;
  }, 'aisle');
}
// "A12" < "Aisle 3" < "7" < "12" < no aisle: natural order for walking the store
export const aisleOrder = a => { if (!a) return [1, 0, '']; const m = String(a).match(/\d+/); return [0, m ? Number(m[0]) : 0, String(a).toLowerCase()]; };

// the store run this person is on right now, if any
export function myTripStore() { const me = who(); return activeTrips().find(t => t.by === me)?.store || ''; }

// The rest of "what kind": a product's name minus its brand, the food it is, and the size.
// "Snuggle Liquid Fabric Softener Blue Sparkle" → "Blue Sparkle"; "Harvest Frosted Sugar Cookies" → "Harvest Frosted Sugar".
export function kindFrom(name, brand, food) {
  const drop = new Set([...(brand || '').toLowerCase().split(/\s+/), ...(food ? [food.name, ...food.aliases].join(' ').toLowerCase().split(/\s+/) : []), 'liquid', 'the', 'and', 'with', 'of', 'gallon', 'gal', 'pack', 'size', 'family', 'value', 'new']);
  return String(name || '').replace(/\b\d+(\.\d+)?\s?(oz|fl oz|lb|lbs|ct|count|g|kg|ml|l|qt|gal|pk|loads?)\b/gi, ' ').split(/\s+/).filter(w => w && !drop.has(w.toLowerCase().replace(/[^a-z0-9%]/g, ''))).join(' ').replace(/[,&-]+$/, '').trim();
}

// Groceries straight off a receipt into the kitchen: each line becomes a new batch on the item you
// already have (same food and unit) or a new item on its usual shelf, with an estimated date, and
// anything it covers comes off the shopping list. Returns [{ item, batchId }] for dating afterwards.
// About how much one weighs, for produce sold by the pound but counted one by one at home
const EACH_LB = { bananas: 0.4, apples: 0.4, oranges: 0.5, lemons: 0.25, limes: 0.15, potatoes: 0.5, 'sweet-potatoes': 0.6, onions: 0.5, tomatoes: 0.3, avocados: 0.4, 'bell-peppers': 0.4, cucumbers: 0.6, zucchini: 0.5 };

export function stockFromReceipt(lines) {
  const placed = [];
  for (let l of lines) {
    const food = l.foodId ? FOOD_BY_ID[l.foodId] : null;
    // 2.31 lb of bananas joins the bananas already counted one by one: about 6
    const lb = l.unit === 'lb' ? l.qty : l.unit === 'kg' ? l.qty * 2.2046 : null;
    if (food && lb && EACH_LB[food.id] && !matchingItem(food.id, l.unit, l.brand, l.kind) && matchingItem(food.id, 'ea', l.brand, l.kind))
      l = { ...l, qty: Math.max(1, Math.round(lb / EACH_LB[food.id])), unit: 'ea' };
    const existing = food && matchingItem(food.id, l.unit, l.brand, l.kind);
    if (existing) {
      const life = shelfLifeDays(food, storageKind(existing));
      const batchId = restockItem(existing.id, { qty: l.qty, expires: life ? addDays(today(), life) : null, dateType: 'Estimated', store: l.store || '', price: l.price ?? null, size: l.size || '' });
      placed.push({ item: state.items.find(i => i.id === existing.id), batchId });
    } else {
      const it = makeItem({ name: l.name, foodId: food?.id || null, qty: l.qty, unit: l.unit, cat: food?.cat || l.cat, emoji: food?.emoji || l.emoji, store: l.store || '', price: l.price ?? null, size: l.size || '', kind: l.kind || '', brand: l.brand || '', notes: l.raw ? `On the receipt as “${l.raw}”` : '' });
      update(s => { s.items.push(it); }, 'item-add');
      placed.push({ item: it, batchId: null });
    }
  }
  update(s => {
    for (const l of lines) {
      s.history.push({ ts: Date.now(), by: who(), type: 'bought', name: l.name, foodId: l.foodId || null, qty: l.qty, cat: l.cat || FOOD_BY_ID[l.foodId]?.cat });
      const e = s.shopping.find(x => !x.done && (l.foodId ? x.foodId === l.foodId : x.name.toLowerCase() === l.name.toLowerCase()));
      if (e) s.shopping = s.shopping.filter(x => x !== e);
    }
  }, 'list-stock');
  return placed;
}

// Smart suggestions: what you "should get".
export function suggestions() {
  const out = [];
  const onList = new Set(state.shopping.filter(x => !x.done).map(x => x.foodId || x.name.toLowerCase()));
  const seen = new Set();
  // what the kitchen knows about it (brand, kind, size) and where it's usually bought go along to the list
  const detail = key => { const it = state.items.find(i => (i.foodId || i.name.toLowerCase()) === key); return { brand: it?.brand || '', kind: it?.kind || '', size: it?.size || '', store: usualStore(it?.foodId || (FOOD_BY_ID[key] ? key : null), it?.name || key) }; };
  const push = (key, s) => { if (onList.has(key) || seen.has(key)) return; seen.add(key); out.push({ ...detail(key), ...s }); };

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
    else if (Number(it.qty) === 1 && ['ea', 'dozen', 'gal', 'loaf', 'jar', 'bottle', 'carton', 'bag', 'box', 'can', 'pack'].includes(it.unit) && FOOD_BY_ID[it.foodId] && !GEAR_CATS.has(it.cat) && !['household', 'spices', 'leftovers', 'storage'].includes(it.cat)) push(key, { name: it.name, foodId: it.foodId, emoji: it.emoji, unit: it.unit, qty: 1, reason: 'Only 1 left', icon: '🪫', kind: 'few' });
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
  // scales both ways (a recipe for 4 made for 2 halves), to the nearest quarter, never below a quarter
  return Math.max(0.25, Math.round(qty * (guests / servings) * 4) / 4);
};

export function fmtDate(isoDate, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(isoDate + 'T12:00').toLocaleDateString(undefined, opts);
}

// Read an amount someone typed or that fmtQty showed: "2", "0.5", "½", "1½", "1 1/2", "3/4". NaN if it isn't one.
const VULGAR = { '¼': .25, '½': .5, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875 };
export const parseQty = v => {
  const t = String(v ?? '').trim().replace(',', '.');
  if (!t) return NaN;
  const m = t.match(/^(\d+(?:\.\d+)?)?\s*(?:([¼½¾⅓⅔⅛⅜⅝⅞])|(\d+)\s*\/\s*(\d+))?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return NaN;
  const whole = m[1] ? Number(m[1]) : 0, frac = m[2] ? VULGAR[m[2]] : m[3] ? Number(m[3]) / Number(m[4] || 1) : 0;
  return m[3] && Number(m[4]) === 0 ? NaN : Math.round((whole + frac) * 1000) / 1000;
};
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
    store = storeName(store);
    for (const i of items) s.prices.push({ id: uid(), foodId: i.foodId || null, name: i.name, store, storeId: storeId || null, price: Number(i.price), date, by });
    s.prices = s.prices.slice(-1500);
    s.history.push({ ts: Date.now(), by, type: 'receipt', name: store, total: total ?? items.reduce((a, i) => a + Number(i.price), 0), count: items.length });
  }, 'receipt');
}

const sameItem = (p, foodId, name) => foodId ? p.foodId === foodId : p.name.toLowerCase() === String(name).toLowerCase();
// Latest price at each store, cheapest first.
export function priceInfo(foodId, name) {
  const latest = new Map();
  for (const p0 of (state.prices || []).filter(p => sameItem(p, foodId, name))) { const p = { ...p0, store: storeName(p0.store) }, prev = latest.get(p.store); if (!prev || p.date >= prev.date) latest.set(p.store, p); }
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
    // as photographed: top shelf, fresh box, small and bottom shelves, and both doors
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
    add('dog-treats', 1, { minQty: 1, sectionId: 'cl-treats' }),
    // the laundry nook as photographed: everything's on the counter over the machines, the shelves are still empty
    add('laundry-detergent', 1, { name: 'Gain Laundry Detergent', minQty: 1, sectionId: 'ln-wash' }), add('bleach', 1, { sectionId: 'ln-wash' }),
    add('fabric-softener', 1, { name: 'Snuggle Blue Sparkle', sectionId: 'ln-wash' }), add('dog-treats', 1, { name: 'Blue Buffalo Health Bars', sectionId: 'ln-wash', notes: "Clyde's extra treats" }),
    add('fruit-snacks', 2, { name: 'Great Value Fruit Snacks', sectionId: 'ln-dry' }), add('dog-bones', 3, { unit: 'ea', sectionId: 'cl-treats' }),
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
    add('slow-cooker', 1, { name: 'Crockery Chef Slow Cooker', sectionId: 'pa-3' }), add('stand-mixer', 1), add('meat-thermometer', 1), add('pie-dish', 1),
    add('aluminum-foil', 1), add('zip-bags', 2), add('dish-soap', 1, { minQty: 1 }), add('paper-towels', 2, { name: 'Bulk Paper Towels', sectionId: 'pa-4' }),
    add('paper-towels', 3, { name: 'Reusable Shopping Bags', emoji: '🛍️', foodId: null, cat: 'household', unit: 'ea', sectionId: 'pa-1', noExpiry: true, expires: null }),
    add('coffee', 1, { name: 'Folgers (backup can)', sectionId: 'pa-2' }),
    add('roasting-pan', 1, { tags: ['thanksgiving'], sectionId: 'pa-5', notes: 'Pantry floor, with the big pots' }), add('turkey-baster', 1, { tags: ['thanksgiving'] }), add('gravy-boat', 1, { tags: ['thanksgiving', 'christmas'] }),
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
