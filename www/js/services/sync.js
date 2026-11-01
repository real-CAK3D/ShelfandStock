// Household sync through Supabase (project "TheGarden", isolated `shelfstock` schema).
// Devices that share a household code share one kitchen. Writes use optimistic versioning;
// on conflict the cloud copy wins, but anything created on this device since the last sync
// is carried over so a quick edit on two phones doesn't vanish.

import { state, update, subscribe, upgradeShared } from '../store.js';

const URL = 'https://rmshsswlodfvdffnlqdy.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable__aWybeZVozOcTHsjHq9jGg_HrQXqSpU'; // publishable (client-safe) key
const LOCAL = 'shelfstock.sync';
const SHARED = ['zones', 'items', 'shopping', 'events', 'recipes', 'favorites', 'history', 'members', 'trips', 'stores', 'prices', 'barcodes'];
const MERGE = ['items', 'shopping', 'events', 'recipes', 'members', 'trips', 'stores', 'prices', 'barcodes'];

let info = load();
const listeners = new Set();
export const onSyncChange = fn => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach(f => f(info));

function load() { try { return JSON.parse(localStorage.getItem(LOCAL)) || {}; } catch { return {}; } }
function save() { try { localStorage.setItem(LOCAL, JSON.stringify(info)); } catch { } emit(); }
export const syncInfo = () => info;

async function rpc(fn, body) {
  const r = await fetch(URL + fn, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'HTTP ' + r.status);
  return (await r.json())[0];
}

// v tells other phones which layout version this kitchen is in
// v tells other phones which layout version this kitchen is in
const payload = () => ({ v: state.v, ...Object.fromEntries(SHARED.map(k => [k, state[k]])) });

// ---- what the cloud last had ----
// `info.base` fingerprints the cloud copy we last saw or sent: the whole shared kitchen, every record in
// the merged lists, and the zones/favorites as a whole. Anything on this phone that differs from it is
// an unsent change, so a pull never throws it away, and a conflict knows exactly what was edited here.
// field order doesn't count: the database hands records back with their keys reordered
const canon = o => Array.isArray(o) ? o.map(canon) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => [k, canon(o[k])])) : o;
const fp = o => { const t = JSON.stringify(canon(o ?? null)); let x = 2166136261; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
const fpAll = s => fp(SHARED.map(k => s[k] ?? null));
const snapshot = s => ({ all: fpAll(s), zones: fp(s.zones), favorites: fp(s.favorites), rec: Object.fromEntries(MERGE.map(k => [k, Object.fromEntries((s[k] || []).map(x => [x.id, fp(x)]))])) });
const dirty = () => !!info.code && (!info.base || fpAll(state) !== info.base.all);

// Cloud copy + this phone's changes since `base`. Records edited here win; records added here are kept;
// records deleted here go unless the other phone changed them meanwhile. History is combined.
function merge(remote, base = {}) {
  const out = { ...remote };
  for (const k of MERGE) {
    const was = base.rec?.[k] || {}, all = new Map((remote[k] || []).map(x => [x.id, x])), here = new Set();
    for (const r of state[k] || []) {
      here.add(r.id);
      if (!(r.id in was)) { if (!all.has(r.id)) all.set(r.id, r); }
      else if (fp(r) !== was[r.id]) all.set(r.id, r);
    }
    for (const id of Object.keys(was)) if (!here.has(id) && all.has(id) && fp(all.get(id)) === was[id]) all.delete(id);
    out[k] = [...all.values()];
  }
  if (fp(state.zones) !== base.zones) out.zones = state.zones;
  if (fp(state.favorites) !== base.favorites) out.favorites = state.favorites;
  const seen = new Map();
  for (const h of [...(remote.history || []), ...(state.history || [])]) seen.set(`${h.ts}|${h.type}|${h.name}|${h.by}`, h);
  out.history = [...seen.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return out;
}

// Take the cloud copy as-is (nothing unsent here). Older phones' layouts get upgraded on the way in;
// `base` stays the raw cloud copy, so the upgrade counts as a change and gets sent back up.
function applyRemote(raw, version) {
  info.base = snapshot(raw); info.version = version;
  const remote = upgradeShared(structuredClone(raw));
  update(s => { for (const k of SHARED) if (remote[k]) s[k] = remote[k]; }, 'sync');
  if (dirty()) schedule();
}

export async function createHousehold(name) {
  const sent = payload();
  const res = await rpc('shelfstock_create', { p_name: name, p_state: sent });
  info = { code: res.code, version: res.version, name, base: snapshot(sent), last: Date.now(), status: 'ok' };
  save();
  return res.code;
}

export async function joinHousehold(code) {
  const res = await rpc('shelfstock_pull', { p_code: code });
  if (!res) throw new Error('No household with that code');
  info = { code: code.toUpperCase().trim(), name: res.name, last: Date.now(), status: 'ok' };
  applyRemote(res.state, res.version);
  save();
}

export function leaveHousehold() { info = {}; save(); }

export async function pull() {
  if (!info.code) return;
  if (dirty()) return push(); // send what's waiting first; a conflict merges both sides
  try {
    const res = await rpc('shelfstock_pull', { p_code: info.code });
    if (!res) throw new Error('Household not found');
    if (res.version !== info.version) {
      if (dirty()) return push(); // something changed here while we waited
      applyRemote(res.state, res.version);
    }
    info.last = Date.now(); info.status = 'ok'; save();
  } catch (e) { info.status = 'offline'; save(); }
}

let pushing = false, again = false;
export async function push() {
  if (!info.code) return;
  if (pushing) { again = true; return; }
  pushing = true;
  try {
    let sent = payload();
    let res = await rpc('shelfstock_push', { p_code: info.code, p_state: sent, p_base: info.version });
    if (!res.ok) {
      // Someone else changed the kitchen first: their copy plus everything changed here, then send that.
      const merged = merge(upgradeShared(structuredClone(res.state)), info.base);
      info.base = snapshot(res.state); info.version = res.version;
      update(s => { for (const k of SHARED) if (merged[k]) s[k] = merged[k]; }, 'sync');
      sent = payload();
      res = await rpc('shelfstock_push', { p_code: info.code, p_state: sent, p_base: info.version });
    }
    if (res.ok) { info.version = res.version; info.base = snapshot(sent); info.last = Date.now(); info.status = 'ok'; window.dispatchEvent(new Event('shelfstock:pushed')); }
  } catch { info.status = 'offline'; }
  pushing = false; save();
  if (again || (info.status === 'ok' && dirty())) { again = false; schedule(); }
}

let timer;
const schedule = (ms = 2500) => { clearTimeout(timer); timer = setTimeout(push, ms); };
export function startSync() {
  if (info.code) pull();
  // every local change, including Start over and restoring a backup, goes up; changes that came from the cloud don't
  subscribe(why => { if (info.code && why !== 'sync') schedule(); });
  window.addEventListener('online', () => pull()); // retry anything that failed to send while offline
  // catch changes from other devices when the app comes back to the foreground
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
  setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 60000);
}
