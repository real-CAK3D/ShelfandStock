// Out shopping: anything someone else adds to the list after you started shows up red and pulsing, and this
// phone chimes and buzzes. In the Android app a small service keeps listening while the phone is in a pocket.

import { state, subscribe, who } from '../store.js';
import { firstName } from './people.js';
import { toast } from '../ui/dom.js';
import { notifyPrefs } from './notify.js';

const KEY = 'shelfstock.shopping';
const MAX_MS = 8 * 3600 * 1000; // forgotten about: stop after a long trip's worth of hours

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s && Date.now() - s.at < MAX_MS ? s : null;
  } catch { return null; }
}
function save(s) { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { } }
const native = () => window.LarderNative;
const soundOn = () => notifyPrefs().shopAlert !== false;

export const isShopping = () => !!load();

export function startShopping() {
  if (!load()) save({ at: Date.now(), known: state.shopping.map(e => e.id), alerted: [] });
  try { native()?.startShopping?.(soundOn()); } catch { }
}
export function stopShopping() {
  save(null);
  try { native()?.stopShopping?.(); } catch { }
}

// added by someone else since this trip started
export function isLate(e) {
  const s = load();
  return !!s && !s.known.includes(e.id) && e.by !== who();
}

let audio;
export function chime() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
    [[880, 0], [1175, .16]].forEach(([hz, at]) => {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + at;
      o.frequency.value = hz; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .3);
      o.start(t); o.stop(t + .32);
    });
  } catch { }
  try { navigator.vibrate?.([250, 120, 250]); } catch { }
}

function check() {
  const s = load(); if (!s) return;
  const fresh = state.shopping.filter(e => !e.done && isLate(e) && !s.alerted.includes(e.id));
  if (!fresh.length) return;
  s.alerted.push(...fresh.map(e => e.id)); save(s);
  if (soundOn()) chime();
  const e = fresh[0];
  toast(fresh.length > 1 ? `${fresh.length} new things on the list` : `${firstName(e.by) || 'Someone'} added ${e.name}`, { icon: '🔔', ms: 5000 });
}

export function startShoppingWatch() {
  if (load()) startShopping(); // the app was closed mid-trip
  subscribe(check);
}
