// What the household is up to: an activity feed ("Andrew requested milk", "Gemmie used the
// last of the eggs") and store trips ("Poppy is going to the store Thursday — get your list in
// before noon today").

import { state, addTrip, finishTrip, activeTrips, today, addDays, fmtDate, priceInfo, money } from '../store.js';
import { memberById, firstName, avatar, me } from '../services/people.js';
import { esc, openSheet, toast, haptic, confetti, icon } from './dom.js';
import { liveState } from '../services/live.js';

const ago = ts => {
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
};

const dayWord = date => date === today() ? 'today' : date === addDays(today(), 1) ? 'tomorrow' : fmtDate(date, { weekday: 'long' });
const timeWord = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(':00', '');

export function line(h) {
  const who = `<b>${esc(firstName(h.by))}</b>`;
  const what = `<b>${esc(h.name)}</b>`;
  switch (h.type) {
    case 'requested': return `${who} requested ${what}`;
    case 'used': return `${who} used the last of ${what}`;
    case 'bought': return `${who} picked up ${what}`;
    case 'tossed': return `${who} tossed ${what}`;
    case 'cooked': return `${who} cooked ${what} 👩‍🍳`;
    case 'atstore': return `${who} is at ${what} 🛒`;
    case 'added': return `${who} put away ${what}`;
    case 'trip': { const t = (state.trips || []).find(x => x.id === h.tripId); return `${who} is going to ${esc(h.name)} ${t ? dayWord(t.date) : ''} 🚗`; }
    default: return '';
  }
}

export function activityHTML(n = 8) {
  const rows = (state.history || []).filter(h => h.by && (h.type !== 'used' || h.last) && ['requested', 'used', 'bought', 'tossed', 'cooked', 'trip', 'atstore'].includes(h.type))
    .slice(-60).reverse();
  // collapse bursts (e.g. "picked up" ×12 after one store run) into one line per person+type
  const out = [];
  for (const h of rows) {
    const prev = out[out.length - 1];
    if (prev && prev.by === h.by && prev.type === h.type && h.type === 'bought' && prev.ts - h.ts < 15 * 6e4) { prev.more = (prev.more || 0) + 1; continue; }
    out.push({ ...h });
    if (out.length >= n) break;
  }
  if (!out.length) return '';
  return out.map(h => `<div class="act">${avatar(memberById(h.by), 30)}<span class="t">${line(h)}${h.more ? ` and ${h.more} more` : ''}<small>${ago(h.ts)}</small></span></div>`).join('');
}

// ---------- trips ----------
export function tripBannerHTML() {
  return activeTrips().map(t => {
    const m = memberById(t.by), cutoff = t.cutoff ? new Date(t.cutoff) : null;
    const left = cutoff ? cutoff - Date.now() : null;
    const closed = left !== null && left <= 0;
    const clock = left === null ? '' : closed ? 'List closed' : left < 36e5 ? `${Math.max(1, Math.round(left / 6e4))}m left` : left < 864e5 ? `${Math.round(left / 36e5)}h left` : `${Math.round(left / 864e5)}d left`;
    const cutoffDay = cutoff ? (cutoff.toDateString() === new Date().toDateString() ? 'today' : cutoff.toDateString() === new Date(Date.now() + 864e5).toDateString() ? 'tomorrow' : cutoff.toLocaleDateString([], { weekday: 'long' })) : '';
    return `<button class="trip wood-mid ${closed ? 'closed' : ''}" data-trip="${t.id}">${avatar(m, 42)}<span style="min-width:0;text-align:left"><b>${esc(m?.name || 'Someone')} is going to ${esc(t.store || 'the store')} ${dayWord(t.date)}</b><small>${cutoff ? (closed ? 'The list is closed — talk to them directly' : `Get your list in before ${timeWord(t.cutoff)} ${cutoffDay}`) : 'Add what you need to the list'}${t.note ? ' · ' + esc(t.note) : ''}</small></span>${clock ? `<span class="clock">⏰ ${clock}</span>` : ''}</button>`;
  }).join('');
}

export function tripSheet(onChange) {
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(today(), i));
  const noonPassed = new Date().getHours() >= 12;
  openSheet({
    title: '🚗 Going to the store',
    html: `
      <p class="muted" style="margin-top:0">Everyone gets a heads-up to add what they need before you go.</p>
      <label class="field"><span>Store</span><input class="input" data-store placeholder="e.g. Hannaford, Walmart, Costco"></label>
      <label class="field"><span>When are you going?</span></label>
      <div class="row wrap" style="gap:6px;margin:-8px 0 14px" data-days>${days.map((d, i) => `<button type="button" class="chip ${i === 1 ? 'on' : ''}" data-d="${d}">${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDate(d, { weekday: 'short' })}</button>`).join('')}</div>
      <div class="row" style="gap:10px">
        <label class="field grow"><span>List closes</span><select class="input" data-cday>${days.slice(0, 7).map((d, i) => `<option value="${d}" ${i === (noonPassed ? 1 : 0) ? 'selected' : ''}>${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDate(d, { weekday: 'long' })}</option>`).join('')}</select></label>
        <label class="field grow"><span>at</span><select class="input" data-ctime>${[['', 'No deadline'], ['09:00', '9 AM'], ['12:00', 'Noon'], ['15:00', '3 PM'], ['18:00', '6 PM'], ['21:00', '9 PM']].map(([v, l]) => `<option value="${v}" ${v === '12:00' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Note (optional)</span><input class="input" data-note placeholder="Using the coupons, back by 5"></label>
      <button class="btn btn-brass btn-block" data-go>${icon('check')} Tell everyone</button>`,
    onMount: (b, close) => {
      let date = days[1];
      b.querySelectorAll('[data-d]').forEach(c => c.onclick = () => { date = c.dataset.d; b.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === c)); haptic(); });
      b.querySelector('[data-go]').onclick = () => {
        const ct = b.querySelector('[data-ctime]').value;
        const cutoff = ct ? new Date(`${b.querySelector('[data-cday]').value}T${ct}`).toISOString() : null;
        addTrip({ date, cutoff, store: b.querySelector('[data-store]').value.trim(), note: b.querySelector('[data-note]').value.trim() });
        close(); confetti(innerWidth / 2, innerHeight / 2, 20); toast('Everyone can see your trip now', { icon: '🚗' }); onChange?.();
      };
    },
  });
}

export function tripDetail(id, onPutAway) {
  const t = (state.trips || []).find(x => x.id === id);
  if (!t) return;
  const mine = t.by === me()?.id;
  const reqBy = {};
  for (const e of state.shopping) if (e.by) (reqBy[e.by] ||= []).push(e.name);
  openSheet({
    title: `${esc(firstName(t.by))}'s store run`,
    html: `<p class="muted" style="margin-top:0">${esc(t.store || 'The store')} · ${dayWord(t.date)}${t.cutoff ? ` · list closes ${timeWord(t.cutoff)}` : ''}</p>
      ${(() => { const est = state.shopping.reduce((a, e) => { const pi = priceInfo(e.foodId, e.name); const at = pi.byStore.find(p => p.store === t.store) || pi.cheapest; return a + (at ? at.price * (Number(e.qty) || 1) : 0); }, 0); return est ? `<div class="where-banner" style="background:var(--sage-2);color:var(--sage)">💵 <span>Estimated total: <b>${money(est)}</b> (from past receipts)</span></div>` : ''; })()}
      ${Object.keys(reqBy).length ? `<div class="group-h">Who asked for what<span class="line"></span></div>${Object.entries(reqBy).map(([by, names]) => `<div class="act">${avatar(memberById(by), 30)}<span class="t"><b>${esc(firstName(by))}</b><small>${esc(names.join(', '))}</small></span></div>`).join('')}` : '<p class="muted">Nobody has added anything yet.</p>'}
      ${mine ? `<div class="row" style="gap:8px;margin-top:14px"><button class="btn btn-sage grow" data-done>✅ Done shopping</button><button class="btn btn-ghost" data-cancel>Cancel trip</button></div>` : ''}`,
    onMount: (b, close) => {
      b.querySelector('[data-done]')?.addEventListener('click', () => { finishTrip(t.id); close(); onPutAway?.(); });
      b.querySelector('[data-cancel]')?.addEventListener('click', () => { finishTrip(t.id); close(); toast('Trip cancelled'); });
    },
  });
}

// ---------- live ----------
const dot = p => `<span class="live-av">${avatar(memberById(p.id) || p, 28)}<i></i></span>`;
export function liveStripHTML() {
  const { online, enabled } = liveState();
  if (!enabled) return `<button class="live-strip off" data-live-open><span class="live-dot off"></span><span>Live activity is off — turn on Household sync</span></button>`;
  const others = online.filter(p => p.id !== me()?.id);
  const atStore = online.find(p => p.store);
  return `<button class="live-strip" data-live-open><span class="live-dot"></span><span class="live-avs">${online.slice(0, 5).map(dot).join('')}</span><span class="grow" style="min-width:0;text-align:left"><b>${online.length ? `${online.length} in the app now` : 'Live'}</b><small>${atStore ? `${esc(atStore.name)} is at ${esc(atStore.store)} 🛒` : others[0] ? `${esc(others[0].name)} is ${esc(others[0].doing)}` : 'Nobody else right now'}</small></span>${icon('next')}</button>`;
}

export function liveSheet() {
  const { online, feed, enabled } = liveState();
  const mins = ts => { const m = Math.round((Date.now() - ts) / 6e4); return m < 1 ? 'now' : `${m}m ago`; };
  openSheet({
    title: '🟢 Live in the app',
    html: enabled ? `
      ${online.length ? online.map(p => `<div class="act">${dot(p)}<span class="t"><b>${esc(p.name)}</b>${p.id === me()?.id ? ' <span class="pill ok">you</span>' : ''}<small>${p.store ? `🛒 at ${esc(p.store)} · ` : ''}${esc(p.doing)} · ${mins(p.ts)}</small></span></div>`).join('') : '<p class="muted">Nobody is in the app right now.</p>'}
      <div class="group-h">Happening now<span class="line"></span></div>
      ${feed.length ? feed.map(f => `<div class="act">${avatar(memberById(f.by), 26)}<span class="t">${f.emoji || ''} <b>${esc(f.name)}</b> ${esc(f.text)}<small>${mins(f.ts)}</small></span></div>`).join('') : '<p class="muted small">When someone adds, uses or edits something, it shows up here the moment it happens.</p>'}`
      : `<p>See who's in the app and what they're doing as it happens (adding to the list, editing the fridge, at the store).</p><p class="muted">Turn on <b>Settings › Household sync</b> on each phone with the same code.</p>`,
  });
}
