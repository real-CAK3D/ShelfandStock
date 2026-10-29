// Open Food Facts — free, open database of real product labels (no API key).
// https://openfoodfacts.github.io/openfoodfacts-server/api/

import { matchFood } from '../data/foods.js';

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

export async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, '');
  if (!code) throw new Error('No barcode');
  if (cache.has(code)) return cache.get(code);
  const j = await getJSON(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`);
  const p = j.status === 1 || j.product ? normalize(j.product, code) : null;
  cache.set(code, p);
  return p;
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
    barcode: code, name, brand: (p.brands || '').split(',')[0].trim(), quantity: p.quantity || '',
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
