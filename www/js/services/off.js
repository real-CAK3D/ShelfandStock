// Product labels by barcode: Open Food Facts and its sister databases, UPCitemdb, and the household's own memory.
// Open Food Facts — free, open database of real product labels (no API key).
// https://openfoodfacts.github.io/openfoodfacts-server/api/

import { matchFood } from '../data/foods.js';
import { state } from '../store.js';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,brands,quantity,image_front_small_url,image_front_url,nutriments,nutriscore_grade,nova_group,allergens_tags,ingredients_text,serving_size,categories_tags,labels_tags';
const cache = new Map();

// Some OFF endpoints don't send CORS headers. Inside the Android app a native bridge
// (window.LarderNative) can fetch them directly; in a browser we fall back gracefully.
let seq = 0;
const pending = new Map();
window.__nativeFetchDone = (id, ok, b64) => {
  const p = pending.get(id); if (!p) return;
  pending.delete(id);
  if (!ok) return p.reject(new Error('native fetch failed'));
  try { p.resolve(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))))); } catch (e) { p.reject(e); }
};
function nativeJSON(url, ms) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    window.LarderNative.fetch(id, url);
    setTimeout(() => { if (pending.delete(id)) reject(new Error('timeout')); }, ms);
  });
}

async function getJSON(url, ms = 9000) {
  if (window.LarderNative?.fetch) return nativeJSON(url, ms);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// What a barcode is, from the free sources in order:
//   1. this household's own memory (anything anyone here named before, shared over sync)
//   2. Open Food Facts, then its sister databases for pet food, household products and beauty
//   3. UPCitemdb (free, 100 lookups a day; only from the Android app, it doesn't allow browsers)
// Same idea as the big scanner apps: open data first, then build your own list from what you scan.
const SISTERS = ['https://world.openpetfoodfacts.org', 'https://world.openproductsfacts.org', 'https://world.openbeautyfacts.org'];
const keyOf = code => String(code).replace(/\D/g, '').replace(/^0+/, '');

export function rememberedBarcode(code) {
  const k = keyOf(code);
  return (state.barcodes || []).find(b => keyOf(b.id) === k) || null;
}

export async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, '');
  if (!code) throw new Error('No barcode');
  const mine = rememberedBarcode(code);
  if (mine) return { barcode: code, name: mine.name, brand: mine.brand || '', quantity: '', image: mine.image || '', foodId: mine.foodId || null, emoji: mine.emoji, source: 'household', nutrition: {}, allergens: [], labels: [] };
  if (cache.has(code)) return cache.get(code);
  let p = null;
  const j = await getJSON(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`).catch(() => null);
  if (j && (j.status === 1 || j.product)) p = { ...normalize(j.product, code), source: 'Open Food Facts' };
  for (const host of p ? [] : SISTERS) {
    const r = await getJSON(`${host}/api/v2/product/${code}.json?fields=${FIELDS}`).catch(() => null);
    if (r && (r.status === 1 || r.product) && r.product?.product_name) { p = { ...normalize(r.product, code), source: { 'https://world.openpetfoodfacts.org': 'Open Pet Food Facts', 'https://world.openproductsfacts.org': 'Open Products Facts', 'https://world.openbeautyfacts.org': 'Open Beauty Facts' }[host] }; break; }
  }
  if (!p && window.LarderNative?.fetch) p = await upcItemDb(code).catch(() => null);
  if (p) cache.set(code, p);
  return p;
}

async function upcItemDb(code) {
  const j = await getJSON(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, 9000);
  const it = j?.items?.[0];
  if (!it?.title) return null;
  // "Snuggle Liquid Fabric Softener  Blue Sparkle  123.1 oz  181 Loads" → name without the size noise
  const name = it.title.replace(/\s{2,}/g, ' ').replace(/\b\d+(\.\d+)?\s?(oz|fl oz|lb|lbs|ct|count|pack|pk|g|kg|ml|l|loads?)\b.*$/i, '').replace(/[-,\s]+$/, '').trim();
  const cat = (it.category || '').split('>').pop().trim();
  const guess = matchFood(name) || matchFood(cat) || matchFood(it.title);
  return { barcode: code, name, brand: it.brand || '', quantity: (it.title.match(/\b\d+(\.\d+)?\s?(oz|fl oz|lb|ct|count|g|kg|ml|l)\b/i) || [''])[0], image: (it.images || []).find(u => /^https:/.test(u)) || '', foodId: guess?.id || null, source: 'UPCitemdb', nutrition: {}, allergens: [], labels: [], ingredients: '' };
}

// Full-text search: the newer search service first, the classic endpoint as a fallback.
export async function searchProducts(q, page = 1) {
  try {
    const j = await getJSON(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=12&page=${page}&fields=${FIELDS}`, 12000);
    const hits = (j.hits || []).map(h => ({ ...h, brands: Array.isArray(h.brands) ? h.brands.join(',') : h.brands }));
    if (hits.length) return hits.filter(p => p.product_name).map(p => normalize(p, p.code));
  } catch { /* fall through */ }
  const j = await getJSON(`${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12&page=${page}&fields=${FIELDS}`, 12000);
  return (j.products || []).filter(p => p.product_name).map(p => normalize(p, p.code));
}

function normalize(p, code) {
  if (!p) return null;
  const n = p.nutriments || {};
  const per = n['energy-kcal_serving'] != null ? 'serving' : '100g';
  const v = k => { const x = n[`${k}_${per}`]; return x == null || x === '' ? null : Math.round(Number(x) * 10) / 10; };
  const name = (p.product_name || '').trim();
  const guess = matchFood(name) || matchFood((p.categories_tags || []).map(t => t.split(':')[1]).join(' '));
  return {
    barcode: code, name, brand: (p.brands || '').split(',')[0].trim(), quantity: (p.quantity || '').replace(/\s*(℮|\be)$/u, '').trim(), // "400 g ℮": the EU estimated-weight mark
    image: p.image_front_small_url || p.image_front_url || '',
    nutriscore: (p.nutriscore_grade || '').toLowerCase().replace(/[^a-e]/g, ''), nova: p.nova_group || null,
    allergens: (p.allergens_tags || []).map(t => t.split(':')[1].replace(/-/g, ' ')),
    ingredients: p.ingredients_text || '',
    labels: (p.labels_tags || []).slice(0, 6).map(t => t.split(':')[1].replace(/-/g, ' ')),
    nutrition: {
      per: per === 'serving' ? (p.serving_size || '1 serving') : '100 g',
      kcal: v('energy-kcal'), fat: v('fat'), satFat: v('saturated-fat'), transFat: v('trans-fat'),
      chol: n[`cholesterol_${per}`] != null ? Math.round(n[`cholesterol_${per}`] * 1000) : null,
      sodium: n[`sodium_${per}`] != null ? Math.round(n[`sodium_${per}`] * 1000) : null,
      carbs: v('carbohydrates'), fiber: v('fiber'), sugars: v('sugars'), protein: v('proteins'),
    },
    foodId: guess?.id || null,
  };
}
