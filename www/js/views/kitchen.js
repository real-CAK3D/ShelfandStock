// Home: the illustrated kitchen. Tap a door to swing it open and look inside.

import { state, itemStatus, isLow, fmtDate, fmtQty, recipeById, recipeMatch, today, suggestions, sectionById, allRecipes, subscribe, tint } from '../store.js';
import { FOOD_BY_ID } from '../data/foods.js';
import { esc, attr, icon, $, $$, countUp, imgOrEmoji, haptic } from '../ui/dom.js';
import { showItem, labelWalk } from '../ui/itemSheet.js';
import { actions } from '../router.js';
import { holidaysFor } from '../data/holidays.js';
import { activityHTML, tripBannerHTML, tripDetail, liveStripHTML } from '../ui/house.js';

// ---------- the rooms (swipe pages) ----------
// Boxes are [left, top, width, height] in % of the wall. Swiping right from the stove wall
// brings in the garage, so the garage page sits to the left and the kitchen continues right.
const Z = (zone, x, y, w, h, o = {}) => ({ zone, box: [x, y, w, h], ...o });
const D = (cls, x, y, w, h, html = '') => ({ deco: cls, box: [x, y, w, h], html });

const ROOMS = [
  { id: 'garage', label: '🚗 Garage', wall: 'concrete', parts: [
    D('g-track', 0, 0, 100, 5), D('g-pegboard', 6, 10, 26, 22, '<span>🔧</span><span>🪛</span><span>🔨</span>'),
    Z('g-fridge-fz', 6, 40, 34, 15, { type: 'steel', label: '❄️ Freezer' }),
    Z('g-fridge', 6, 56, 34, 33, { type: 'steel', label: 'Fridge' }),
    Z('g-upright', 50, 14, 44, 75, { type: 'steel', label: '❄️ Upright Freezer', tour: 'garage' }),
    D('g-floor', 0, 89, 100, 11),
  ] },
  { id: 'stove', label: '🍳 Stove', parts: [
    Z('above-fridge-l', 1, 2, 17, 13), Z('above-fridge-r', 18.5, 2, 17, 13, { hinge: 'right' }),
    Z('fridge', 1, 16, 34.5, 48, { type: 'french', tour: 'fridge' }),
    Z('freezer', 1, 64.6, 34.5, 23.4, { type: 'steel-drawer', label: '❄️ Freezer' }),
    Z('above-micro-l', 37, 2, 16.5, 21, { tour: 'cabinets' }), Z('above-micro-r', 54, 2, 16.5, 21, { hinge: 'right' }),
    D('microwave', 37, 24, 33.5, 13, '<span class="mw-win"></span><span class="mw-pad"></span>'),
    D('stove', 37, 49.5, 33.5, 38.5, '<span class="cooktop"></span><span class="dials"><i></i><i></i><i></i><i></i></span><span class="oven-win"></span>'),
    Z('stove-drawer', 38.5, 79.5, 30.5, 7, { type: 'enamel-drawer', label: 'Drawer' }),
    Z('tall-stove', 72, 2, 27, 40, { hinge: 'right' }),
    Z('counter-stove', 71, 40, 29, 12, { type: 'counter' }),
    D('countertop', 70.5, 52, 29.5, 4), D('dishwasher', 72, 56, 27, 32, '<span class="dw-bar"></span>'),
    D('floor', 0, 88, 100, 12),
  ] },
  { id: 'sink', label: '🚰 Sink', parts: [
    D('dishwasher', -22, 56, 27, 32, '<span class="dw-bar"></span>'),
    D('valance', 6, 3, 50, 7), D('window', 9, 10, 44, 34, '<span class="utensils"><i></i><i></i><i></i><i></i><i></i></span><span class="glass-art"></span>'),
    Z('skinny-l', 58, 2, 20, 42), Z('skinny-r', 79, 2, 20, 42, { hinge: 'right' }),
    D('appliances', 59, 41, 38, 11, '<span>☕</span><span>🍞</span>'),
    D('countertop', 0, 52, 100, 4), D('sink', 11, 52.6, 38, 3.2), D('faucet', 27, 43, 6, 10),
    D('oak-front', 8, 57, 44, 6),
    Z('sink-base', 8, 64, 44, 24, { type: 'double' }),
    Z('drawer-l', 58, 57, 20, 6.5, { type: 'drawer' }), Z('drawer-r', 79, 57, 20, 6.5, { type: 'drawer' }),
    Z('base-l', 58, 64.5, 20, 23.5), Z('base-r', 79, 64.5, 20, 23.5, { hinge: 'right' }),
    D('floor', 0, 88, 100, 12),
  ] },
  { id: 'corner', label: '☕ Corner', parts: [
    Z('corner-up', 1, 2, 24, 30), Z('corner-small', 1, 33, 24, 18.5),
    Z('big-l', 27, 2, 35, 40), Z('big-r', 63, 2, 35, 40, { hinge: 'right' }),
    Z('counter', 26, 40, 72, 12, { type: 'counter' }),
    D('countertop', 0, 52, 100, 4),
    Z('drawer-c', 2, 57, 30, 6.5, { type: 'drawer' }), Z('base-big', 2, 64.5, 30, 23.5),
    D('floor', 0, 88, 100, 12),
    // Clyde's spot on the floor: water bowl, food bowl (his food), bone (his treats)
    D('clyde-mat', 2, 90.5, 38, 8, '<span>CLYDE</span>'),
    D('water-bowl', 4, 91.5, 10, 5.5, '<i></i>'),
    Z('clyde', 15.5, 90.8, 11, 6.5, { type: 'bowl' }),
    Z('clyde-treats', 28, 91, 10, 6, { type: 'bone' }),
    D('island-top', 40, 63, 58, 5), Z('island', 43, 68, 52, 21, { finish: 'espresso' }),
  ] },
];
const HOME_ROOM = 1;
let room = HOME_ROOM; // kept across re-renders
export const showRoom = n => { room = n; };
export const roomOfZone = zoneId => ROOMS.findIndex(r => r.parts.some(p => p.zone === zoneId));
const DRAWN = new Set(ROOMS.flatMap(r => r.parts.map(p => p.zone).filter(Boolean)));
const itemsIn = zoneId => { const z = state.zones.find(z => z.id === zoneId); if (!z) return []; const ids = new Set(z.sections.map(s => s.id)); return state.items.filter(i => ids.has(i.sectionId)); };

function badge(zoneId) {
  const its = itemsIn(zoneId);
  if (!its.length) return '';
  const bad = its.some(i => itemStatus(i).key === 'expired'), warn = its.some(i => ['soon', 'today'].includes(itemStatus(i).key));
  return `<span class="badge ${bad ? 'bad' : warn ? 'warn' : ''}">${its.length}</span>`;
}
const peek = (zoneId, n = 8) => itemsIn(zoneId).slice(0, n).map(i => `<span>${i.emoji}</span>`).join('');
const zoneName = id => state.zones.find(z => z.id === id)?.name || id;
const has = id => state.zones.some(z => z.id === id);
// Doors are small: use the zone's short label (editable name's first word as a fallback).
const shortName = id => { const z = state.zones.find(z => z.id === id); return z?.short ?? z?.name.split(/[ &,·]+/)[0] ?? ''; };
const pct = ([x, y, w, h]) => `left:${x}%;top:${y}%;width:${w}%;height:${h}%`;

function part(p) {
  if (p.deco) return `<div class="pos d-${p.deco}" style="${pct(p.box)}">${p.html}</div>`;
  const id = p.zone;
  if (!has(id)) return '';
  const z = state.zones.find(z => z.id === id);
  const cold = z.kind === 'fridge' || z.kind === 'freezer';
  const fin = p.finish || (state.settings.cabinets === 'wood' ? 'wood-v' : 'painted');
  const label = esc(p.label ?? shortName(id));
  const aria = `aria-label="Open ${attr(z.name)}"`;
  const right = p.hinge === 'right';
  let doors;
  switch (p.type) {
    case 'french': doors = `<button class="door half steel" ${aria}><span class="handle" style="right:5px;top:14%;height:58%"></span><span class="label">${esc(z.name)}</span></button><button class="door half right steel" ${aria}><span class="handle" style="left:5px;top:14%;height:58%"></span></button>`; break;
    case 'double': doors = `<button class="door half ${fin}" ${aria}><span class="pull v" style="right:7px;top:10px"></span><span class="label">${label}</span></button><button class="door half right ${fin}" ${aria}><span class="pull v" style="left:7px;top:10px"></span></button>`; break;
    case 'steel': doors = `<button class="door steel ${right ? 'right' : ''}" ${aria}><span class="handle" style="${right ? 'left' : 'right'}:6px;top:16%;height:50%"></span><span class="label">${label}</span></button>`; break;
    case 'steel-drawer': doors = `<button class="door drawer steel" ${aria}><span class="handle h"></span><span class="label">${label}</span></button>`; break;
    case 'enamel-drawer': doors = `<button class="door drawer enamel" ${aria}><span class="label">${label}</span></button>`; break;
    case 'drawer': doors = `<button class="door drawer oak" ${aria}><span class="knob c"></span></button>`; break;
    case 'bowl': return `<button class="pos pet-bowl" data-zone="${id}" style="${pct(p.box)}" ${aria}><span class="kibble"></span>${badge(id)}</button>`;
    case 'bone': return `<button class="pos pet-bone" data-zone="${id}" style="${pct(p.box)}" ${aria}>🦴${badge(id)}</button>`;
    case 'counter': return `<button class="pos counter-zone" data-zone="${id}" style="${pct(p.box)}" ${aria}>${itemsIn(id).slice(0, 7).map((i, n) => `<span style="animation-delay:${n * .05}s">${i.emoji}</span>`).join('')}</button>`;
    default: doors = `<button class="door ${fin} ${right ? 'right' : ''}" ${aria}><span class="pull v" style="${right ? 'left' : 'right'}:7px;${p.box[1] < 40 ? 'bottom' : 'top'}:10px"></span><span class="label">${label}</span></button>`;
  }
  return `<div class="pos slot ${cold ? 'cold' : ''} ${p.type || 'door'}-slot ${p.cls || ''}" data-zone="${id}" ${p.tour ? `data-tour="${p.tour}"` : ''} style="${pct(p.box)}"><div class="interior">${peek(id, 12)}</div>${doors}${badge(id)}</div>`;
}

const roomCount = r => r.parts.reduce((a, p) => a + (p.zone && !p.deco ? itemsIn(p.zone).length : 0), 0);

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late-night snack?' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function render(root) {
  const items = state.items;
  const expiring = items.filter(i => ['expired', 'today', 'soon'].includes(itemStatus(i).key)).sort((a, b) => (a.expires || '') < (b.expires || '') ? -1 : 1);
  const low = items.filter(isLow);
  const undated = items.filter(i => !i.dated && (i.dateType || 'Estimated') === 'Estimated' && i.expires);
  const todays = state.events.filter(e => e.date === today());
  const upcoming = state.events.filter(e => e.date > today()).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 3);
  const nextHol = [...holidaysFor(new Date().getFullYear()), ...holidaysFor(new Date().getFullYear() + 1)].find(h => h.iso >= today());
  const custom = state.zones.filter(z => !DRAWN.has(z.id) && z.id !== 'holiday');
  const garage = true; // the room pager is always on
  const cookable = allRecipes().map(r => ({ r, m: recipeMatch(r) })).filter(x => x.m.pct >= .99).length;

  root.innerHTML = `
    <div class="hero-greet"><h2>${greeting()} 👋</h2><p>${items.length ? `${items.length} things in your kitchen · ${cookable} recipes you can make right now` : 'Your kitchen is empty — tap ＋ to stock it.'}</p></div>

    ${tripBannerHTML()}
    <div data-live>${liveStripHTML()}</div>
    <div class="room-tabs">${ROOMS.map((r, i) => `<button class="room-tab ${room === i ? 'on' : ''}" data-room="${i}" ${r.id === 'garage' ? 'data-tour="garage-tab"' : ''}>${r.label} <span class="n">${roomCount(r)}</span></button>`).join('')}</div>
    <div class="rooms" data-rooms data-tour="scene">
      ${ROOMS.map(r => `<div class="room"><div class="wall wall-${r.wall || 'paint'}">${r.parts.map(part).join('')}</div></div>`).join('')}
    </div>
    <div class="room-dots">${ROOMS.map((r, i) => `<i class="${room === i ? 'on' : ''}"></i>`).join('')}</div>
    <p class="small muted" style="text-align:center;margin:4px 0 0">Swipe to walk around · swipe right for the garage</p>

    <div class="storage-row">
      ${has('holiday') ? `<button class="chest wood-mid" data-zone="holiday" data-tour="holiday"><h4>${esc(zoneName('holiday'))}</h4><p>${itemsIn('holiday').length} items${nextHol ? ` · ${nextHol.emoji} ${esc(nextHol.name)} in ${Math.max(0, Math.round((new Date(nextHol.iso + 'T12:00') - new Date()) / 864e5))}d` : ''}</p><span class="big">🎁</span></button>` : ''}
      ${custom.map(z => `<button class="chest wood-dark" data-zone="${z.id}"><h4>${esc(z.name)}</h4><p>${itemsIn(z.id).length} items</p><span class="big">${{ pantry: '🚪', freezer: '❄️', fridge: '🧊', counter: '🍌' }[z.kind] || '📦'}</span></button>`).join('')}
      <button class="chest wood-dark" data-go="settings" style="opacity:.85"><h4>＋ Storage</h4><p>Basement shelf, bar cart, camper…</p><span class="big">🧰</span></button>
    </div>

    <div class="stats stagger">
      <button class="stat t-tomato" data-filter="expiring"><b data-count="${expiring.length}">0</b><span>Use soon</span></button>
      <button class="stat t-sky" data-filter="low"><b data-count="${low.length}">0</b><span>Running low</span></button>
      <button class="stat t-sage" data-go="list"><b data-count="${state.shopping.filter(s => !s.done).length}">0</b><span>On the list</span></button>
    </div>

    ${undated.length ? `<button class="where-banner" style="margin:12px 12px 0;width:calc(100% - 24px);text-align:left" data-labelall>🏷️ <span class="grow"><b>${undated.length} items have estimated dates.</b> Walk through and read the real dates off the packages.</span>${icon('next')}</button>` : ''}

    ${expiring.length ? `<div class="section-title"><h2>Use it or lose it</h2><button class="link" data-filter="expiring">See all</button></div>
    <div class="shelf stagger">${expiring.slice(0, 10).map(i => { const st = itemStatus(i); return `<button class="tile" data-item="${i.id}" style="${tint(i.cat)}">${imgOrEmoji(i)}<div class="nm">${esc(i.name)}</div><span class="pill ${st.key}">${st.label}</span></button>`; }).join('')}</div>` : ''}

    ${todays.length || upcoming.length ? `<div class="section-title"><h2>On the menu</h2><button class="link" data-go="plan">Calendar</button></div>
    <div class="agenda stagger">${[...todays, ...upcoming].map(e => { const r = (e.recipeIds || []).map(recipeById).filter(Boolean); const miss = r.reduce((a, x) => a + recipeMatch(x).missing.length, 0); return `<button class="ev ${e.kind}" data-ev="${e.id}"><span class="em">${e.emoji || '🍽️'}</span><span class="grow"><span class="when">${e.date === today() ? 'Today' : fmtDate(e.date)}${e.slot ? ' · ' + esc(e.slot) : ''}</span><b>${esc(e.title)}</b><small class="muted">${r.length ? `${r.length} recipe${r.length > 1 ? 's' : ''} · ${miss ? `<span style="color:var(--tomato)">${miss} to buy</span>` : '<span style="color:var(--sage)">all set ✓</span>'}` : esc(e.notes || '')}${e.guests ? ` · 👥 ${e.guests}` : ''}</small></span>${icon('next')}</button>`; }).join('')}</div>` : ''}

    ${(() => { const a = activityHTML(6); return a ? `<div class="section-title"><h2>Around the house</h2></div><div class="activity card pad">${a}</div>` : ''; })()}

    ${(() => { const s = suggestions().slice(0, 4); return s.length ? `<div class="section-title"><h2>You should get</h2><button class="link" data-go="list">Shopping list</button></div><div class="stagger">${s.map(x => `<div class="sugg" style="${tint(FOOD_BY_ID[x.foodId]?.cat)}"><span class="em" style="width:40px;height:40px;border-radius:11px;display:grid;place-items:center">${x.emoji}</span><span class="t"><b>${esc(x.name)}</b><small>${x.icon} ${esc(x.reason)}</small></span><button class="btn btn-ghost btn-sm" data-sugg="${attr(JSON.stringify(x))}">${icon('plus')}</button></div>`).join('')}</div>` : ''; })()}
  `;

  $$('[data-count]', root).forEach(el => countUp(el, Number(el.dataset.count)));

  // Kitchen ⇄ Garage: a horizontal swipe between rooms (scroll-snap), synced with the tabs/dots.
  const rooms = $('[data-rooms]', root);
  if (rooms && garage) {
    rooms.scrollLeft = room * rooms.clientWidth;
    let t;
    rooms.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const r = Math.round(rooms.scrollLeft / rooms.clientWidth);
        if (r !== room) { room = r; haptic(8); }
        $$('.room-tab', root).forEach((b, i) => b.classList.toggle('on', i === room));
        $$('.room-dots i', root).forEach((d, i) => d.classList.toggle('on', i === room));
      }, 60);
    }, { passive: true });
  }
  root.onclick = e => {
    const tr = e.target.closest('[data-trip]'); if (tr) return tripDetail(tr.dataset.trip, () => actions.go('list'));
    const rt = e.target.closest('[data-room]');
    if (rt) { room = Number(rt.dataset.room); haptic(); return rooms.scrollTo({ left: room * rooms.clientWidth, behavior: 'smooth' }); }
    const z = e.target.closest('[data-zone]');
    if (z) { haptic(); return openZoneAnimated(z.dataset.zone, z); }
    const it = e.target.closest('[data-item]'); if (it) return showItem(it.dataset.item);
    const f = e.target.closest('[data-filter]'); if (f) return actions.go('stock', { status: f.dataset.filter });
    const g = e.target.closest('[data-go]'); if (g) return actions.go(g.dataset.go);
    const ev = e.target.closest('[data-ev]'); if (ev) return actions.openEvent(ev.dataset.ev);
    if (e.target.closest('[data-labelall]')) return labelWalk(undated.map(i => i.id), { title: 'Label your kitchen', onDone: () => actions.go('kitchen') });
    const sg = e.target.closest('[data-sugg]');
    if (sg) { const x = JSON.parse(sg.dataset.sugg); actions.addToListFrom(x, sg); }
  };
}

function openZoneAnimated(zoneId, el) {
  el.classList.add('opening');
  setTimeout(() => { openZone(zoneId, { origin: el }); setTimeout(() => el.classList.remove('opening'), 400); }, 380);
}

// ---------- inside a zone ----------
export function openZone(zoneId, { origin, highlight, section } = {}) {
  const z = state.zones.find(z => z.id === zoneId);
  if (!z) return;
  document.querySelector('.inside')?.remove();
  const cold = z.kind === 'fridge' || z.kind === 'freezer';
  const ov = document.createElement('div');
  ov.className = 'inside ' + (cold ? 'cold' : 'wooden');
  if (origin) { const r = origin.getBoundingClientRect(); ov.style.setProperty('--ox', r.left + r.width / 2 + 'px'); ov.style.setProperty('--oy', r.top + r.height / 2 + 'px'); }
  let filter = section || 'all';
  const secHTML = (s, door = false) => {
    const its = state.items.filter(i => i.sectionId === s.id);
    const title = door ? s.name.replace(/^.*Door · /, '') : s.name;
    return `
            <div class="shelf-sec ${door ? 'bin' : ''}">
              <h3>${esc(title)} <span style="opacity:.6;font-weight:600">${its.length}</span>${its.length && !door ? `<button class="btn btn-sm" style="margin-left:auto;height:28px;font-size:11.5px;background:rgba(255,255,255,.18);color:inherit" data-labelsec="${s.id}">🏷️${z.layout === 'french' ? '' : ' Label shelf'}</button>` : ''}</h3>
              <div class="shelf-items">
                ${its.map((i, n) => { const st = itemStatus(i); const k = st.key === 'ok' || st.key === 'none' ? (isLow(i) ? 'low' : '') : st.key; return `<button class="jar ${highlight === i.id ? 'hl' : ''}" data-item="${i.id}" style="animation-delay:${n * .04}s;${tint(i.cat)}">${k ? `<span class="st ${k}"></span>` : ''}${imgOrEmoji(i)}<div class="nm">${esc(i.name)}</div><div class="qt">${fmtQty(i.qty)} ${esc(i.unit)}</div></button>`; }).join('')}
                <button class="add-jar" data-addsec="${s.id}" aria-label="Add to ${attr(s.name)}">＋</button>
              </div>
            </div>`;
  };
  const draw = () => {
    const secs = z.sections.filter(s => filter === 'all' || s.id === filter);
    const all = itemsIn(zoneId);
    ov.innerHTML = `
      <div class="inside-panel">
        <div class="inside-head ${cold ? '' : 'wood-dark'}">
          <button class="icon-btn" data-x aria-label="Close">${icon('back')}</button>
          <div class="grow"><h2>${esc(z.name)}</h2><div class="small" style="opacity:.8">${all.length} items · ${z.sections.length} sections</div></div>
          <button class="icon-btn" data-label aria-label="Label shelf" title="Label dates on this shelf">🏷️</button>
          <button class="icon-btn" data-add aria-label="Add here">${icon('plus')}</button>
        </div>
        <div class="inside-body" style="position:relative">
          ${cold ? '<div class="light-glow"></div>' : ''}
          <div class="chips" style="padding:12px 0 4px;margin:0 -2px">
            <button class="chip ${filter === 'all' ? 'on' : ''}" data-sec="all">All <span class="n">${all.length}</span></button>
            ${z.sections.map(s => `<button class="chip ${filter === s.id ? 'on' : ''}" data-sec="${s.id}">${esc(s.name)} <span class="n">${state.items.filter(i => i.sectionId === s.id).length}</span></button>`).join('')}
          </div>
          ${z.layout === 'french' && filter === 'all' ? `<div class="fr-grid">
            <div class="fr-door">${z.sections.filter(s => s.col === 'l').map(s => secHTML(s, true)).join('')}</div>
            <div class="fr-center">${z.sections.filter(s => s.col === 'c').map(s => secHTML(s)).join('')}</div>
            <div class="fr-door">${z.sections.filter(s => s.col === 'r').map(s => secHTML(s, true)).join('')}</div>
          </div>` : secs.map(s => secHTML(s)).join('')}
          ${!all.length ? `<div class="empty" style="color:inherit;opacity:.8"><span class="big">${cold ? '🧊' : '🕸️'}</span>Nothing in here yet.</div>` : ''}
        </div>
      </div>`;
    if (highlight) {
      const el = ov.querySelector(`[data-item="${highlight}"]`);
      if (el) setTimeout(() => { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.animate([{ transform: 'scale(1)', boxShadow: '0 0 0 0 #e7c877' }, { transform: 'scale(1.18)', boxShadow: '0 0 0 6px #e7c877' }, { transform: 'scale(1)', boxShadow: '0 0 0 3px #e7c877' }], { duration: 900, iterations: 2 }); }, 500);
      highlight = null;
    }
  };
  draw();
  document.body.appendChild(ov);
  const close = () => { ov.querySelector('.inside-panel').animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.3)', opacity: 0 }], { duration: 260, easing: 'ease-in' }).onfinish = () => { ov.remove(); unsub(); }; };
  ov.onclick = e => {
    if (e.target === ov || e.target.closest('[data-x]')) return close();
    const s = e.target.closest('[data-sec]'); if (s) { filter = s.dataset.sec; haptic(); return draw(); }
    const it = e.target.closest('[data-item]'); if (it) return showItem(it.dataset.item);
    const ad = e.target.closest('[data-addsec]'); if (ad) return actions.addItem({ sectionId: ad.dataset.addsec });
    if (e.target.closest('[data-add]')) return actions.addItem({ sectionId: filter !== 'all' ? filter : z.sections[0]?.id });
    const ls = e.target.closest('[data-labelsec]'); if (ls) return labelWalk(state.items.filter(i => i.sectionId === ls.dataset.labelsec).map(i => i.id), { title: `Label: ${sectionById(ls.dataset.labelsec)?.name}` });
    if (e.target.closest('[data-label]')) return labelWalk(itemsIn(zoneId).filter(i => filter === 'all' || i.sectionId === filter).map(i => i.id), { title: `Label: ${z.name}` });
  };
  // live-refresh while open
  const unsub = subscribe(() => { if (document.body.contains(ov)) draw(); });
  ov._close = close;
  return close;
}
