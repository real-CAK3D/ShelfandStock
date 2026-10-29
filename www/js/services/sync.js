// Household sync through Supabase (project "TheGarden", isolated `shelfstock` schema).
// Devices that share a household code share one kitchen. Writes use optimistic versioning;
// on conflict the cloud copy wins, but anything created on this device since the last sync
// is carried over so a quick edit on two phones doesn't vanish.

import { state, update, subscribe } from '../store.js';

const URL = 'https://rmshsswlodfvdffnlqdy.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable__aWybeZVozOcTHsjHq9jGg_HrQXqSpU'; // publishable (client-safe) key
const LOCAL = 'shelfstock.sync';
const SHARED = ['zones', 'items', 'shopping', 'events', 'recipes', 'favorites', 'history', 'members', 'trips', 'stores'];
const MERGE = ['items', 'shopping', 'events', 'recipes', 'members', 'trips', 'stores'];

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

const payload = () => Object.fromEntries(SHARED.map(k => [k, state[k]]));
const idsOf = s => Object.fromEntries(MERGE.map(k => [k, (s[k] || []).map(x => x.id)]));

function applyRemote(remote) {
  update(s => { for (const k of SHARED) if (remote[k]) s[k] = remote[k]; }, 'sync');
}

export async function createHousehold(name) {
  const res = await rpc('shelfstock_create', { p_name: name, p_state: payload() });
  info = { code: res.code, version: res.version, name, baseIds: idsOf(state), last: Date.now(), status: 'ok' };
  save();
  return res.code;
}

export async function joinHousehold(code) {
  const res = await rpc('shelfstock_pull', { p_code: code });
  if (!res) throw new Error('No household with that code');
  info = { code: code.toUpperCase().trim(), version: res.version, name: res.name, baseIds: idsOf(res.state), last: Date.now(), status: 'ok' };
  save();
  applyRemote(res.state);
}

export function leaveHousehold() { info = {}; save(); }

export async function pull() {
  if (!info.code) return;
  try {
    const res = await rpc('shelfstock_pull', { p_code: info.code });
    if (!res) throw new Error('Household not found');
    if (res.version !== info.version) { applyRemote(res.state); info.version = res.version; info.baseIds = idsOf(res.state); }
    info.last = Date.now(); info.status = 'ok'; save();
  } catch (e) { info.status = 'offline'; save(); }
}

let pushing = false, again = false;
export async function push() {
  if (!info.code) return;
  if (pushing) { again = true; return; }
  pushing = true;
  try {
    let res = await rpc('shelfstock_push', { p_code: info.code, p_state: payload(), p_base: info.version });
    if (!res.ok) {
      // Someone else changed the kitchen first: take theirs, keep what's new here, push once more.
      const remote = res.state, base = info.baseIds || {};
      for (const k of MERGE) {
        const have = new Set((remote[k] || []).map(x => x.id)), was = new Set(base[k] || []);
        remote[k] = [...(remote[k] || []), ...(state[k] || []).filter(x => !have.has(x.id) && !was.has(x.id))];
      }
      applyRemote(remote);
      res = await rpc('shelfstock_push', { p_code: info.code, p_state: payload(), p_base: res.version });
    }
    if (res.ok) { info.version = res.version; info.baseIds = idsOf(state); info.last = Date.now(); info.status = 'ok'; window.dispatchEvent(new Event('shelfstock:pushed')); }
  } catch { info.status = 'offline'; }
  pushing = false; save();
  if (again) { again = false; push(); }
}

let timer;
export function startSync() {
  if (info.code) pull();
  subscribe(why => {
    if (!info.code || why === 'sync' || why === 'replace') return;
    clearTimeout(timer);
    timer = setTimeout(push, 2500);
  });
  // catch changes from other devices when the app comes back to the foreground
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
  setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 60000);
}
