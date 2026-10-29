// Local stores: find grocery/convenience/big-box stores near you (OpenStreetMap Nominatim, free),
// save the ones the house uses, and notice when someone is at one ("Poppy is at Hannaford").

import { state, update, uid, who } from '../store.js';

const SHARE = 'shelfstock.locshare';   // per phone: share when I'm at a store
const NEAR_M = 250;                    // how close counts as "at the store"
const listeners = new Set();
let here = null;                       // the saved store this phone is at right now
export const onHere = fn => (listeners.add(fn), () => listeners.delete(fn));
export const currentStore = () => here;
export const sharing = () => { try { return localStorage.getItem(SHARE) === '1'; } catch { return false; } };
export const setSharing = on => { try { localStorage.setItem(SHARE, on ? '1' : '0'); } catch { } if (on) check(); else setHere(null); };

const BRAND = [[/walmart|target|kmart/i, '🏬'], [/costco|bj'?s|sam'?s club/i, '📦'], [/cumberland|circle k|7-eleven|irving|mobil|shell|variety|mart\b/i, '🏪'], [/pharmacy|cvs|walgreens|rite aid/i, '💊'], [/dollar/i, '💵']];
export const storeEmoji = name => (BRAND.find(([re]) => re.test(name)) || [, '🛒'])[1];

export function distanceM(a, b) {
  const R = 6371e3, t = x => x * Math.PI / 180;
  const dLat = t(b.lat - a.lat), dLon = t(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const miles = m => m < 160 ? 'right here' : `${(m / 1609).toFixed(m < 16090 ? 1 : 0)} mi`;

export function getPosition(opts = {}) {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Location isn’t available on this device'));
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      e => rej(new Error(e.code === 1 ? 'Location permission was denied' : 'Couldn’t get your location')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000, ...opts });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// Nominatim asks for ≤1 request/second, so the category searches run one after another.
export async function findNearby(pos, onProgress) {
  const d = 0.13; // ~9 miles
  const box = `${pos.lon - d},${pos.lat + d},${pos.lon + d},${pos.lat - d}`;
  const out = new Map();
  const kinds = ['supermarket', 'grocery store', 'convenience store', 'department store', 'wholesale club'];
  for (const [i, q] of kinds.entries()) {
    onProgress?.(`Looking for ${q}s…`);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=30&bounded=1&viewbox=${box}&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
      for (const x of await r.json()) {
        if (!x.name) continue;
        const s = { name: x.name, kind: x.type, lat: Number(x.lat), lon: Number(x.lon), address: x.display_name.split(',').slice(1, 3).join(',').trim() };
        s.dist = distanceM(pos, s);
        const key = `${s.name}|${s.lat.toFixed(3)}|${s.lon.toFixed(3)}`;
        if (!out.has(key)) out.set(key, s);
      }
    } catch { }
    if (i < kinds.length - 1) await sleep(1100);
  }
  return [...out.values()].sort((a, b) => a.dist - b.dist);
}

export function saveStore(s) {
  if ((state.stores || []).some(x => x.name === s.name && distanceM(x, s) < 100)) return false;
  update(st => { (st.stores ||= []).push({ id: uid(), name: s.name, lat: s.lat, lon: s.lon, address: s.address || '', emoji: storeEmoji(s.name) }); }, 'stores');
  return true;
}
export const removeStore = id => update(st => { st.stores = (st.stores || []).filter(x => x.id !== id); }, 'stores');

function setHere(store) {
  if ((here?.id || null) === (store?.id || null)) return;
  here = store;
  if (store) {
    // log the visit once per few hours so the house sees "Poppy is at Hannaford"
    const recent = (state.history || []).some(h => h.type === 'atstore' && h.by === who() && h.storeId === store.id && Date.now() - h.ts < 3 * 36e5);
    if (!recent && who()) update(st => { st.history.push({ ts: Date.now(), by: who(), type: 'atstore', name: store.name, storeId: store.id }); }, 'atstore');
  }
  listeners.forEach(f => f(here));
}

async function check() {
  if (!sharing() || !(state.stores || []).length || document.visibilityState !== 'visible') return;
  try {
    const pos = await getPosition({ enableHighAccuracy: false, maximumAge: 120000 });
    const near = (state.stores || []).map(s => ({ s, d: distanceM(pos, s) })).sort((a, b) => a.d - b.d)[0];
    setHere(near && near.d <= NEAR_M + Math.min(pos.acc || 0, 150) ? near.s : null);
  } catch { }
}

export function startStoreWatch() {
  check();
  setInterval(check, 90000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
}
