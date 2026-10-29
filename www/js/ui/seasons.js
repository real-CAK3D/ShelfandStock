// Seasonal themes: a little holiday pizazz (accent colors, drifting decorations, a garland on
// the header). "auto" picks by date; Settings can force one or turn them off.

import { state, subscribe } from '../store.js';
import { holidaysFor } from '../data/holidays.js';

export const SEASONS = {
  halloween: { name: 'Halloween', emoji: '🎃', parts: ['🦇', '🎃', '🍂', '👻', '🕸️'], deco: '🎃 🕸️ 🦇 🍬 🎃 🕸️ 🦇 🍬 🎃 🕸️ 🦇 🍬', count: 9 },
  thanksgiving: { name: 'Thanksgiving', emoji: '🦃', parts: ['🍂', '🍁', '🍂', '🌾'], deco: '🍂 🦃 🍁 🌽 🥧 🍂 🦃 🍁 🌽 🥧', count: 12 },
  christmas: { name: 'Christmas', emoji: '🎄', parts: ['❄️', '❄️', '❅', '❆', '⭐'], deco: '🔴 🟢 🟡 🔵 🔴 🟢 🟡 🔵 🔴 🟢 🟡 🔵 🔴 🟢 🟡 🔵', count: 16 },
  newyear: { name: 'New Year', emoji: '🥂', parts: ['✨', '🎉', '🎊', '✨'], deco: '✨ 🥂 🎉 ✨ 🥂 🎉 ✨ 🥂 🎉', count: 10, rise: true },
  valentines: { name: "Valentine's", emoji: '💝', parts: ['💕', '💖', '❤️', '💗'], deco: '💕 💖 💕 💖 💕 💖 💕 💖 💕 💖', count: 10, rise: true },
  stpatricks: { name: "St. Patrick's", emoji: '☘️', parts: ['☘️', '🍀', '☘️', '🌈'], deco: '☘️ 🍀 ☘️ 🍀 ☘️ 🍀 ☘️ 🍀 ☘️ 🍀', count: 10 },
  easter: { name: 'Easter', emoji: '🐣', parts: ['🥚', '🐣', '🌷', '🐰'], deco: '🥚 🌷 🐣 🥚 🌷 🐣 🥚 🌷 🐣', count: 8 },
  july4: { name: 'Fourth of July', emoji: '🎆', parts: ['🎆', '✨', '🎇', '⭐'], deco: '🔴 ⚪ 🔵 🔴 ⚪ 🔵 🔴 ⚪ 🔵 🔴 ⚪ 🔵', count: 10, rise: true },
};

// Which season is it today?
export function seasonFor(d = new Date()) {
  const y = d.getFullYear(), md = (d.getMonth() + 1) * 100 + d.getDate();
  const hol = Object.fromEntries(holidaysFor(y).map(h => [h.name, h.date]));
  const within = (date, before, after = 0) => { const t = (d - date) / 864e5; return t >= -before && t <= after + 1; };
  if (md >= 1001 && md <= 1031) return 'halloween';
  if (md >= 1101 && within(hol.Thanksgiving, 30, 1)) return 'thanksgiving';
  if (md >= 1201 && md <= 1226) return 'christmas';
  if (md >= 1227 || md <= 102) return 'newyear';
  if (md >= 207 && md <= 214) return 'valentines';
  if (md >= 310 && md <= 317) return 'stpatricks';
  if (within(hol.Easter, 7, 1)) return 'easter';
  if (md >= 628 && md <= 705) return 'july4';
  return null;
}

export const activeSeason = () => {
  const s = state.settings.season || 'auto';
  return s === 'off' ? null : s === 'auto' ? seasonFor() : SEASONS[s] ? s : null;
};

let current = undefined;
export function applySeason() {
  const id = activeSeason();
  if (id === current) return;
  current = id;
  document.querySelector('.season-layer')?.remove();
  const top = document.querySelector('.topbar');
  if (!id) { delete document.documentElement.dataset.season; top?.removeAttribute('data-deco'); return; }
  const s = SEASONS[id];
  document.documentElement.dataset.season = id;
  top?.setAttribute('data-deco', s.deco);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'season-layer' + (s.rise ? ' rise' : '');
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < s.count; i++) {
    const p = document.createElement('span');
    p.textContent = s.parts[i % s.parts.length];
    const dur = 14 + Math.random() * 14;
    p.style.cssText = `left:${Math.random() * 100}%;font-size:${12 + Math.random() * 12}px;animation-duration:${dur}s;animation-delay:${-Math.random() * dur}s;--dx:${(Math.random() - .5) * 120}px;--rot:${(Math.random() - .5) * 540}deg;opacity:${.35 + Math.random() * .4}`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
}

export function startSeasons() {
  applySeason();
  subscribe(applySeason);
}
