// Box photos (outside and inside), kept out of the saved house so it stays small. Each photo lives on
// this phone (IndexedDB) and, with household sync on, in the household's photo store so every phone
// sees it. A photo taken offline waits on this phone and goes up the next time there's a connection.

import { syncInfo, onSyncChange } from './sync.js';
import { uid } from '../store.js';

const URL = 'https://rmshsswlodfvdffnlqdy.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable__aWybeZVozOcTHsjHq9jGg_HrQXqSpU';
const DB = 'shelfstock-photos';

let dbp;
const db = () => dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('p');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('p', mode), s = t.objectStore('p'); const r = fn(s); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); };
const local = id => tx('readonly', s => s.get(id)).catch(() => null);
const keep = (id, rec) => tx('readwrite', s => s.put(rec, id)).catch(() => { });

async function rpc(fn, body) {
  const r = await fetch(URL + fn, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// A photo file → a JPEG data URL no bigger than `max` px on its long side
export async function shrink(file, max = 1280, q = 0.78) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(async () => {
    const url = URL_.createObjectURL(file); const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; }); return img;
  });
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
const URL_ = globalThis.URL;

// Save a new photo; returns its id right away (the upload happens in the background)
export async function savePhoto(dataUrl) {
  const id = 'ph' + uid();
  await keep(id, { data: dataUrl, sent: false });
  upload(id);
  return id;
}

// Keep a photo that already has an id (one brought in from Home Inventory)
export async function keepPhoto(id, dataUrl) {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id) || !/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) return;
  const had = await local(id);
  if (!had) await keep(id, { data: dataUrl, sent: false });
  await upload(id);
}

async function upload(id) {
  const code = syncInfo().code; if (!code) return;
  const rec = await local(id); if (!rec || rec.sent) return;
  try { await rpc('shelfstock_photo_put', { p_code: code, p_id: id, p_data: rec.data }); await keep(id, { ...rec, sent: true }); } catch { }
}

// Any photos taken offline (or before sync was set up) go up now
export async function sendWaiting() {
  if (!syncInfo().code) return;
  const keys = await tx('readonly', s => s.getAllKeys()).catch(() => []);
  for (const id of keys || []) await upload(id);
}

// A photo's data URL: from this phone, else from the household (then kept here)
const asked = new Map();
export async function photoURL(id) {
  if (!id) return null;
  const rec = await local(id);
  if (rec) return rec.data;
  const code = syncInfo().code; if (!code) return null;
  if (!asked.has(id)) asked.set(id, rpc('shelfstock_photo_get', { p_code: code, p_ids: [id] }).then(rows => rows?.[0]?.data || null).catch(() => null));
  const data = await asked.get(id);
  asked.delete(id);
  if (data) await keep(id, { data, sent: true });
  return data;
}

// Fill every <img data-photo="id"> under root once its photo is at hand
export function fillPhotos(root) {
  root.querySelectorAll('img[data-photo]').forEach(async img => { const u = await photoURL(img.dataset.photo); if (u) { img.src = u; img.closest('.ph-wrap')?.classList.add('has'); } });
}

addEventListener('online', sendWaiting);
onSyncChange(() => sendWaiting());
