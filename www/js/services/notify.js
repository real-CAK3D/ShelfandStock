// Household notices for phones where the app is closed. The Android app checks for new notices
// in the background (every ~15 minutes) and shows them as notifications; it also keeps the
// home-screen widget up to date. In a browser these calls are harmless no-ops beyond the insert.

import { state, subscribe, itemStatus, who } from '../store.js';
import { syncInfo, onSyncChange } from './sync.js';

const URL = 'https://rmshsswlodfvdffnlqdy.supabase.co';
const KEY = 'sb_publishable__aWybeZVozOcTHsjHq9jGg_HrQXqSpU';
const PREFS = 'shelfstock.notify';
export const KINDS = { trip: 'Store runs', atstore: 'Someone is at the store', request: 'New list requests', out: 'Used the last of something' };

export function notifyPrefs() {
  try { return { trip: true, atstore: true, request: true, out: true, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch { return { trip: true, atstore: true, request: true, out: true }; }
}
export function setNotifyPref(kind, on) {
  const p = { ...notifyPrefs(), [kind]: on };
  try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { }
  configureNative();
}

export async function notifyHouse(kind, text, data = {}) {
  const code = syncInfo().code;
  if (!code) return;
  try {
    await fetch(`${URL}/rest/v1/rpc/shelfstock_notify`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_code: code, p_by: who(), p_kind: kind, p_text: text, p_data: data }) });
  } catch { }
}

// Tell the Android app (if we're inside it) where to look and what this person wants to hear about.
export function configureNative() {
  const N = window.LarderNative;
  if (!N?.configureNotices) return;
  try { N.configureNotices(URL, KEY, syncInfo().code || '', who() || '', JSON.stringify(notifyPrefs())); } catch { }
}

export function askNotificationPermission() { try { window.LarderNative?.requestNotifications?.(); } catch { } }

// Home-screen widget: the shopping list and what's about to go bad.
let wt;
function updateWidget() {
  const N = window.LarderNative;
  if (!N?.updateWidget) return;
  clearTimeout(wt);
  wt = setTimeout(() => {
    const list = state.shopping.filter(x => !x.done).slice(0, 7).map(x => `${x.emoji} ${x.name}`);
    const exp = state.items.map(i => ({ i, s: itemStatus(i) })).filter(x => ['expired', 'today', 'soon'].includes(x.s.key)).sort((a, b) => a.s.days - b.s.days).slice(0, 4).map(x => `${x.i.emoji} ${x.i.name} · ${x.s.label}`);
    const trip = (state.trips || []).find(t => !t.done);
    const tripText = trip ? `🚗 ${(state.members || []).find(m => m.id === trip.by)?.name || 'Someone'} → ${trip.store || 'the store'} ${new Date(trip.date + 'T12:00').toLocaleDateString([], { weekday: 'short' })}` : '';
    try { N.updateWidget(JSON.stringify({ list, more: Math.max(0, state.shopping.filter(x => !x.done).length - list.length), exp, trip: tripText })); } catch { }
  }, 800);
}

export function startNotify() {
  configureNative();
  onSyncChange(configureNative);
  updateWidget();
  subscribe(updateWidget);
}
