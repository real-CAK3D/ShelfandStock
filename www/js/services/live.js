// Live activity over Supabase Realtime (presence + broadcast on a channel per household).
// Everyone in the app shows up with what they're doing ("adding to the shopping list",
// "at Hannaford"); actions appear on the other phones as they happen, and a change on one phone
// makes the others pull the new kitchen right away. Needs Household sync to be on.

import { state, subscribe } from '../store.js';
import { syncInfo, pull, onSyncChange } from './sync.js';
import { me } from './people.js';
import { currentStore, onHere } from './stores.js';

const URL = 'https://rmshsswlodfvdffnlqdy.supabase.co';
const KEY = 'sb_publishable__aWybeZVozOcTHsjHq9jGg_HrQXqSpU';
let client, channel, channelCode = null, doing = 'just looking', online = [], feed = [];
const listeners = new Set();
export const onLive = fn => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach(f => f({ online, feed }));
export const liveState = () => ({ online, feed, connected: !!channel, enabled: !!syncInfo().code });

const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });

function payload() {
  const m = me();
  return m && { id: m.id, name: m.name, emoji: m.emoji, color: m.color, photo: m.photo ? 1 : 0, doing, store: currentStore()?.name || '', ts: Date.now() };
}

let trackT;
function retrack() { clearTimeout(trackT); trackT = setTimeout(() => { const p = payload(); if (channel && p) channel.track(p).catch(() => { }); }, 300); }

export function setDoing(text) { if (text && text !== doing) { doing = text; retrack(); } }

// Tell everyone else something happened ("Zayne added Dog Treats to the list").
export function announce(text, emoji) {
  const m = me();
  if (!channel || !m) return;
  channel.send({ type: 'broadcast', event: 'act', payload: { by: m.id, name: m.name, text, emoji, ts: Date.now() } }).catch(() => { });
}
export function pinged() { channel?.send({ type: 'broadcast', event: 'changed', payload: { by: me()?.id } }).catch(() => { }); }

async function connect() {
  const code = syncInfo().code;
  if (!code || !me()) return disconnect();
  if (channelCode === code && channel) return retrack();
  await disconnect();
  try {
    if (!window.supabase) await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
    client ||= window.supabase.createClient(URL, KEY, { auth: { persistSession: false } });
    channelCode = code;
    channel = client.channel(`shelfstock-${code}`, { config: { presence: { key: me().id }, broadcast: { self: false } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        const st = channel.presenceState();
        online = Object.values(st).map(list => list[list.length - 1]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
        emit();
      })
      .on('broadcast', { event: 'act' }, ({ payload: p }) => { feed.unshift(p); feed = feed.slice(0, 25); emit(); window.dispatchEvent(new CustomEvent('shelfstock:live-act', { detail: p })); })
      .on('broadcast', { event: 'changed' }, () => pull())
      .subscribe(s => { if (s === 'SUBSCRIBED') retrack(); });
  } catch { channel = null; }
  emit();
}

async function disconnect() {
  if (channel) { try { await client.removeChannel(channel); } catch { } }
  channel = null; channelCode = null; online = []; emit();
}

export function startLive() {
  connect();
  onSyncChange(() => connect());
  onHere(() => retrack());
  window.addEventListener('shelfstock:pushed', pinged);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { setDoing('just looking'); connect(); } else setDoing('away'); });
  // turn new history entries made on this phone into live announcements
  let seen = (state.history || []).length;
  subscribe(why => {
    const h = state.history || [];
    if (why === 'sync' || why === 'replace') { seen = h.length; return; }
    for (const e of h.slice(seen)) if (e.by === me()?.id) window.dispatchEvent(new CustomEvent('shelfstock:mine', { detail: e }));
    seen = h.length;
  });
}

export const reconnectLive = () => connect();
