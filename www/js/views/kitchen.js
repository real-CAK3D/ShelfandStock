// Home: the illustrated house, room by room. Tap a door to swing it open and look inside.

import { state, itemStatus, isLow, fmtDate, fmtQty, recipeById, recipeMatch, today, suggestions, sectionById, allRecipes, subscribe, tint } from '../store.js';
import { FOOD_BY_ID } from '../data/foods.js';
import { HOUSE_ROOMS } from '../data/layout.js';
import { esc, attr, icon, $, $$, countUp, imgOrEmoji, haptic } from '../ui/dom.js';
import { showItem, labelWalk } from '../ui/itemSheet.js';
import { fillPhotos } from '../services/photos.js';
import { boxSheet, boxesOn, boxTileHTML, visibleItem, newBox, act, packSheet, waitingForMe, myAnswers, approvalsSheet } from '../ui/boxes.js';
import { actions } from '../router.js';
import { holidaysFor } from '../data/holidays.js';
import { activityHTML, tripBannerHTML, tripDetail, liveStripHTML } from '../ui/house.js';
import { weekCardHTML, reportSheet } from '../ui/report.js';
import { recallMatches, recallSheet } from '../services/recalls.js';

// ---------- the house: rooms, each with walls you swipe between ----------
// Boxes are [left, top, width, height] in % of the wall. In the kitchen, swiping right from the stove wall
// brings in the pantry and then the garage fridges, so those pages sit to the left and the kitchen continues right.
const Z = (zone, x, y, w, h, o = {}) => ({ zone, box: [x, y, w, h], ...o });
const D = (cls, x, y, w, h, html = '') => ({ deco: cls, box: [x, y, w, h], html });

const KITCHEN = [
  // the garage fridge & freezers belong to the kitchen (they're drawn on the garage's right wall as well)
  { id: 'g-fridges', label: '🧊 Garage Fridges', wall: 'concrete', parts: [
    D('g-track', 0, 0, 100, 5), D('g-pegboard', 6, 10, 26, 22, '<span>🔧</span><span>🪛</span><span>🔨</span>'),
    Z('g-fridge-fz', 6, 40, 34, 15, { type: 'steel', label: '❄️ Freezer' }),
    Z('g-fridge', 6, 56, 34, 33, { type: 'steel', label: 'Fridge' }),
    Z('g-upright', 50, 14, 44, 75, { type: 'steel', label: '❄️ Upright Freezer', tour: 'garage' }),
    D('g-floor', 0, 89, 100, 11),
  ] },
  // the stand-up pantry closet just left of the fridge (the fridge's edge peeks in on the right)
  { id: 'pantry', label: '🚪 Pantry', parts: [
    D('closet-frame', 12, 1.5, 56, 86.5),
    Z('pantry', 15, 4, 50, 84, { type: 'closet', tour: 'pantry' }),
    D('cab-edge', 84, 2, 30, 13), D('fridge-edge', 84, 16, 30, 72, '<i></i>'),
    D('floor', 0, 88, 100, 12),
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
    // the second big base: same size, two doors, a plain face where the drawer would be
    D('cab-edge', 33.5, 57, 30, 6.5), Z('base-big-r', 33.5, 64.5, 30, 23.5, { type: 'double' }),
    D('island-top', 66, 63, 33, 5), Z('island', 68, 68, 29, 20, { finish: 'espresso' }),
    D('floor', 0, 88, 100, 12),
    // Clyde's spot, all the way right on the floor: water, food, the bone lying flat, then his name
    D('clyde-mat', 46, 90, 52, 9, '<span>CLYDE</span>'),
    D('water-bowl', 48, 91.5, 10, 5.5, '<i></i>'),
    Z('clyde', 60, 90.8, 11, 6.5, { type: 'bowl' }),
    Z('clyde-treats', 73, 91.3, 11, 5.5, { type: 'bone' }),
  ] },
  // the laundry nook right of the island: cedar walls, two wraparound shelves, a counter on the washer & dryer
  { id: 'laundry', label: '🧺 Laundry', parts: [
    D('cedar', 3, 2, 94, 49),
    D('shelf-board', 3, 21, 94, 2.2), Z('laundry-top', 5, 9, 90, 12, { type: 'counter' }),
    D('shelf-board', 3, 37, 94, 2.2), Z('laundry-mid', 5, 25, 90, 12, { type: 'counter' }),
    D('laundry-board', 3, 49.5, 94, 2.8), Z('laundry-counter', 5, 39.5, 90, 10, { type: 'counter' }),
    D('washer', 5, 52.5, 44, 35.5, '<span class="panel"></span><span class="porthole"></span>'),
    D('dryer', 51, 52.5, 44, 35.5, '<span class="panel"></span><span class="porthole"></span>'),
    D('floor', 0, 88, 100, 12),
  ] },
];

// The bathroom as photographed: white tile over a wood wainscot. The vanity wall has the three-door
// mirrored medicine cabinet over the sink, the counter, one door on the left under it, two drawers on the right.
const BATHROOM = [
  { id: 'vanity', label: '🪥 Vanity', wall: 'tile', parts: [
    D('wainscot', 0, 44, 100, 56), D('chair-rail', 0, 43, 100, 2.5),
    Z('med-l', 22, 2, 18.5, 33, { type: 'mirror' }), Z('med-c', 41, 2, 18.5, 33, { type: 'mirror' }), Z('med-r', 60, 2, 18.5, 33, { type: 'mirror', hinge: 'right' }),
    D('mirror-ledge', 21, 35, 58.5, 2.6),
    Z('bath-counter', 18, 41, 66, 10.5, { type: 'counter' }),
    D('vanity-top', 16, 51.5, 70, 4.5), D('vanity-bowl', 38, 52, 26, 3.4), D('faucet', 48, 44.5, 6, 8),
    D('oak-front', 18, 56.5, 66, 6),
    Z('bath-sink', 18, 63, 34, 25, { finish: 'wood-v' }),
    Z('bath-dr-1', 53, 63, 31, 11.5, { type: 'drawer' }), Z('bath-dr-2', 53, 75.5, 31, 12.5, { type: 'drawer' }),
    Z('bath-towels', 2, 46, 13, 22, { type: 'towels' }),
    D('bath-floor', 0, 88, 100, 12),
  ] },
  // the stand-up closet: five shelves and the floor behind a tall door
  { id: 'closet', label: '🚪 Closet', wall: 'tile', parts: [
    D('wainscot', 0, 44, 100, 56), D('chair-rail', 0, 43, 100, 2.5),
    D('closet-frame', 20, 1.5, 60, 86.5),
    Z('bath-closet', 23, 4, 54, 84, { type: 'closet', cls: 'shelves' }),
    D('hamper', 82, 66, 15, 22, '<span>🧺</span>'),
    D('bath-floor', 0, 88, 100, 12),
  ] },
];

// The garage, walking around it: the left wall, the closed two-bay door at the back, then the right wall
// ending at the kitchen's garage fridge and freezers.
const GARAGE = [
  { id: 'g-left', label: '⬅️ Left Wall', wall: 'concrete', parts: [
    D('g-track', 0, 0, 100, 5),
    Z('gar-camp', 2, 8, 30, 52, { type: 'shelf' }),
    Z('gar-cab', 35, 8, 33, 34, { type: 'double', finish: 'wood-v' }),
    Z('gar-bikes', 70, 26, 28, 62, { type: 'counter', cls: 'gear-pile', empty: '🚲🎿🧤' }),
    D('g-floor', 0, 89, 100, 11),
  ] },
  { id: 'g-back', label: '🚪 Bay Doors', wall: 'concrete', parts: [
    D('g-track', 0, 0, 100, 5),
    D('bay-door', 3, 10, 45, 79), D('bay-door', 52, 10, 45, 79),
    Z('gar-door', 6, 52, 88, 36, { type: 'counter', cls: 'gear-pile', empty: '🪜🪵' }),
    D('g-floor', 0, 89, 100, 11),
  ] },
  { id: 'g-right', label: '➡️ Bench & Fridges', wall: 'concrete', parts: [
    D('g-track', 0, 0, 100, 5),
    Z('bench-cak3d', 1, 18, 25, 30, { type: 'shelf' }), Z('bench-zayne', 27, 18, 25, 30, { type: 'shelf' }),
    D('bench-top', 0, 48, 53, 4),
    Z('bench-under', 1, 53, 51, 35, { type: 'shelf' }),
    Z('oil-drum', 54, 56, 13, 32, { type: 'drum' }),
    Z('g-fridge-fz', 69, 36, 14, 13, { type: 'steel', label: '❄️' }), Z('g-fridge', 69, 50, 14, 38, { type: 'steel', label: 'Fridge' }),
    Z('g-upright', 84, 20, 15, 68, { type: 'steel', label: '❄️ Upright' }),
    D('g-floor', 0, 89, 100, 11),
  ] },
];

// The basement: Home Inventory's numbered racks, four to a wall, like walking the aisle.
function basementWalls() {
  const racks = state.zones.filter(z => z.kind === 'rack').sort((a, b) => (a.num ?? 99) - (b.num ?? 99));
  const walls = [];
  for (let i = 0; i < racks.length; i += 4) {
    const four = racks.slice(i, i + 4);
    const nums = four.map(z => z.num ?? '?');
    walls.push({ id: `bsmt-w${i / 4}`, label: `🗄️ ${nums.length > 1 ? `${nums[0]}–${nums.at(-1)}` : nums[0]}`, wall: 'block', parts: [
      ...four.map((z, j) => Z(z.id, 1.5 + j * 24.6, 3, 23, 85, { type: 'rack' })),
      D('g-floor', 0, 89, 100, 11),
    ] });
  }
  return walls.length ? walls : [{ id: 'bsmt-empty', label: '🗄️ Basement', wall: 'block', parts: [D('g-floor', 0, 89, 100, 11)] }];
}

// The shed: a wall of stacked storage boxes on each side and at the back.
function shedWalls() {
  return state.zones.filter(z => z.kind === 'boxes').map(z => ({ id: z.id, label: `📦 ${z.short || z.name}`, wall: 'plank', parts: [
    Z(z.id, 2, 3, 96, 85, { type: 'boxwall' }), D('shed-floor', 0, 89, 100, 11),
  ] }));
}

const PLACES = { kitchen: { walls: () => KITCHEN, home: 2 }, bathroom: { walls: () => BATHROOM, home: 0 }, basement: { walls: basementWalls, home: 0 }, garage: { walls: () => GARAGE, home: 0 }, shed: { walls: shedWalls, home: 0 } };
let place = 'kitchen';
let room = PLACES.kitchen.home; // the wall within the room; kept across re-renders
const wallsHere = () => PLACES[place].walls();
export const showRoom = (p, n) => { if (PLACES[p]) { place = p; room = n ?? PLACES[p].home; } };
// where a place is drawn: the first room and wall that has it (the garage fridges count as the kitchen's)
export function roomOfZone(zoneId) {
  for (const p of Object.keys(PLACES)) { const i = PLACES[p].walls().findIndex(r => r.parts.some(x => x.zone === zoneId)); if (i >= 0) return { place: p, wall: i }; }
  return null;
}
// every wall of every room in walking order, for grouping storage in Settings
export const roomList = () => HOUSE_ROOMS.flatMap(h => {
  const walls = PLACES[h.id].walls(), home = PLACES[h.id].home;
  const ordered = h.id === 'kitchen' ? [...walls.slice(home), ...walls.slice(0, home).reverse()] : walls;
  return ordered.map(r => ({ id: r.id, room: h.id, label: `${h.emoji} ${h.label} · ${r.label.replace(/^\S+\s/, '')}`, zones: [...new Set(r.parts.filter(p => p.zone).map(p => p.zone))] }));
});
const drawnZones = () => new Set(Object.values(PLACES).flatMap(p => p.walls().flatMap(r => r.parts.map(x => x.zone).filter(Boolean))));
const itemsIn = zoneId => { const z = state.zones.find(z => z.id === zoneId); if (!z) return []; const ids = new Set(z.sections.map(s => s.id)); return state.items.filter(i => ids.has(i.sectionId) && visibleItem(i)); };

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
    case 'bone': return `<button class="pos pet-bone" data-zone="${id}" style="${pct(p.box)}" ${aria}><span class="bone">🦴</span>${badge(id)}</button>`;
    case 'mirror': doors = `<button class="door mirror ${right ? 'right' : ''}" ${aria}><span class="label">${label}</span></button>`; break;
    case 'towels': { const its = itemsIn(id); return `<button class="pos towel-zone" data-zone="${id}" style="${pct(p.box)}" ${aria}><span class="t-ring"></span><span class="t-cloth">${its.slice(0, 3).map(i => i.emoji).join('') || '🧺'}</span>${badge(id)}</button>`; }
    case 'drum': return `<button class="pos oil-drum" data-zone="${id}" style="${pct(p.box)}" ${aria}><span class="rib"></span><span class="rib"></span><em>${label}</em>${badge(id)}</button>`;
    // open shelving, no door: each shelf shows what's on it
    case 'shelf': return `<button class="pos open-shelf" data-zone="${id}" style="${pct(p.box)}" ${aria}><em class="os-name">${label}</em>${z.sections.map(sec => `<span class="os-row">${state.items.filter(i => i.sectionId === sec.id).slice(0, 7).map(i => `<i>${i.emoji}</i>`).join('')}</span>`).join('')}${badge(id)}</button>`;
    // a basement rack: its number, then each level with the boxes on it (and anything loose beside them)
    case 'rack': return `<button class="pos rack" data-zone="${id}" style="${pct(p.box)}" ${aria}><em class="rk-num">${esc(String(z.num ?? label))}</em>${z.sections.map(sec => {
      const bxs = boxesOn(sec.id), loose = state.items.filter(i => i.sectionId === sec.id && !i.boxId);
      return `<span class="rk-row">${bxs.slice(0, 4).map(b => `<b class="mini-box ${b.locked ? 'locked' : ''}" ${b.color ? `style="--bx:${b.color}"` : ''}>${esc(b.code)}</b>`).join('')}${bxs.length > 4 ? `<small>+${bxs.length - 4}</small>` : ''}${loose.slice(0, 3).map(i => `<i>${i.emoji}</i>`).join('')}</span>`;
    }).join('')}${badge(id)}</button>`;
    // the shed: every box in every stack, stacked bottom up; tap a box to open it
    case 'boxwall': {
      const high = z.high || 4;
      return `<div class="pos boxwall" style="${pct(p.box)};--cols:${z.sections.length};--rows:${high}">${z.sections.map((sec, c) => Array.from({ length: high }, (_, k) => {
        const lv = high - k, b = state.boxes.find(x => x.sectionId === sec.id && x.level === lv), at = `grid-column:${c + 1};grid-row:${k + 1}`;
        return b ? boxTileHTML(b, at) : `<span class="sbox gap" style="${at}"></span>`;
      }).join('')).join('')}</div>`;
    }
    case 'closet': doors = `<button class="door cherry" ${aria}><span class="knob" style="right:8%;top:50%;width:11px;height:11px"></span><span class="label">${label}</span></button>`; break;
    case 'counter': { const its = itemsIn(id); return `<button class="pos counter-zone ${p.cls || ''}" data-zone="${id}" style="${pct(p.box)}" ${aria}>${its.length ? its.slice(0, 7).map((i, n) => `<span style="animation-delay:${n * .05}s">${i.emoji}</span>`).join('') : p.empty ? `<em class="cz-ghost">${p.empty}</em>` : `<em class="cz-empty">${label}</em>`}</button>`; }
    default: doors = `<button class="door ${fin} ${right ? 'right' : ''}" ${aria}><span class="pull v" style="${right ? 'left' : 'right'}:7px;${p.box[1] < 40 ? 'bottom' : 'top'}:10px"></span><span class="label">${label}</span></button>`;
  }
  // the closet shows each shelf behind the door, the rest just a peek of what's inside
  const inside = p.type === 'closet' ? z.sections.map(sec => `<div class="cl-shelf">${state.items.filter(i => i.sectionId === sec.id).slice(0, 6).map(i => `<span>${i.emoji}</span>`).join('')}</div>`).join('') : peek(id, 12);
  return `<div class="pos slot ${cold ? 'cold' : ''} ${p.type || 'door'}-slot ${p.cls || ''}" data-zone="${id}" ${p.tour ? `data-tour="${p.tour}"` : ''} style="${pct(p.box)}"><div class="interior">${inside}</div>${doors}${badge(id)}</div>`;
}

const zonesOn = walls => [...new Set(walls.flatMap(r => r.parts.map(p => p.zone).filter(Boolean)))];
const countIn = zoneIds => zoneIds.reduce((a, id) => a + itemsIn(id).length, 0);
const roomCount = r => countIn(zonesOn([r]));
// things in the room, plus its boxes that hold something (an empty, unnamed shed box doesn't count)
const placeCount = p => { const zs = zonesOn(PLACES[p].walls()), n = countIn(zs); const secs = new Set(state.zones.filter(z => zs.includes(z.id)).flatMap(z => z.sections.map(x => x.id))); const bx = (state.boxes || []).filter(b => secs.has(b.sectionId) && (b.name || b.photo || b.inside || state.items.some(i => i.boxId === b.id))).length; return bx ? `${n} · ${bx} 📦` : n; };

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
  const drawn = drawnZones(), custom = state.zones.filter(z => !drawn.has(z.id) && z.id !== 'holiday');
const ROOMS = wallsHere();
if (room >= ROOMS.length) room = 0;
const here = HOUSE_ROOMS.find(h => h.id === place);
  const garage = true; // the room pager is always on
  const cookable = allRecipes().map(r => ({ r, m: recipeMatch(r) })).filter(x => x.m.pct >= .99).length;

  root.innerHTML = `
    <div class="hero-greet"><h2>${greeting()} 👋</h2><p>${items.length ? `${items.length} things in your house · ${cookable} recipes you can make right now` : 'Your kitchen is empty — tap ＋ to stock it.'}</p></div>

    ${tripBannerHTML()}
    ${(() => { const m = recallMatches(); return m.length ? `<button class="recall-banner" data-recalls>🛡️ <span><b>${m.length} possible recall${m.length > 1 ? 's' : ''}</b> for something in your house. Tap to check the label.</span></button>` : ''; })()}
    <div data-live>${liveStripHTML()}</div>
    ${(() => { const w = waitingForMe().length, a = myAnswers().length; return w || a ? `<button class="recall-banner ask-banner" data-asks>🙋 <span><b>${w ? `${w} request${w > 1 ? "s" : ""} waiting for your OK` : `${a} answer${a > 1 ? "s" : ""} to what you asked`}</b>${w ? " · tap to say yes or no" : ""}</span></button>` : ""; })()}
    <div class="house-tabs" data-tour="house">${HOUSE_ROOMS.map(h => `<button class="house-tab ${place === h.id ? 'on' : ''}" data-place="${h.id}"><span class="hi">${h.emoji}</span><b>${h.label}</b><span class="n">${placeCount(h.id)}</span></button>`).join('')}</div>
    <div class="room-tabs">${ROOMS.map((r, i) => `<button class="room-tab ${room === i ? 'on' : ''}" data-room="${i}" ${r.id === 'g-fridges' ? 'data-tour="garage-tab"' : ''}>${r.label} <span class="n">${roomCount(r)}</span></button>`).join('')}</div>
    <div class="rooms" data-rooms data-tour="scene">
      ${ROOMS.map(r => `<div class="room"><div class="wall wall-${r.wall || 'paint'}">${r.parts.map(part).join('')}</div></div>`).join('')}
    </div>
    <div class="room-dots">${ROOMS.map((r, i) => `<i class="${room === i ? 'on' : ''}"></i>`).join('')}</div>
    <p class="small muted" style="text-align:center;margin:4px 0 0">Swipe to walk around the ${esc(here.label.toLowerCase())}</p>

    <div class="storage-row">
      ${has('holiday') ? `<button class="chest wood-mid" data-zone="holiday" data-tour="holiday"><h4>${esc(zoneName('holiday'))}</h4><p>${itemsIn('holiday').length} items${nextHol ? ` · ${nextHol.emoji} ${esc(nextHol.name)} in ${Math.max(0, Math.round((new Date(nextHol.iso + 'T12:00') - new Date()) / 864e5))}d` : ''}</p><span class="big">🎁</span></button>` : ''}
      ${custom.map(z => `<button class="chest wood-dark" data-zone="${z.id}"><h4>${esc(z.name)}</h4><p>${itemsIn(z.id).length} items</p><span class="big">${{ pantry: '🚪', freezer: '❄️', fridge: '🧊', counter: '🍌' }[z.kind] || '📦'}</span></button>`).join('')}
      <button class="chest wood-dark" data-go="settings" style="opacity:.85"><h4>＋ Storage</h4><p>Basement shelf, bar cart, camper…</p><span class="big">🧰</span></button>
    </div>

    ${weekCardHTML()}
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
        $$('.room-tab', root).forEach((b, i) => { b.classList.toggle('on', i === room); if (i === room) b.parentElement.scrollTo({ left: b.offsetLeft - (b.parentElement.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' }); }); // sideways only
        $$('.room-dots i', root).forEach((d, i) => d.classList.toggle('on', i === room));
      }, 60);
    }, { passive: true });
  }
  root.onclick = e => {
    if (e.target.closest('[data-week]')) return reportSheet();
    if (e.target.closest('[data-recalls]')) return recallSheet();
    if (e.target.closest('[data-asks]')) return approvalsSheet();
    const tr = e.target.closest('[data-trip]'); if (tr) return tripDetail(tr.dataset.trip, () => actions.go('list'));
    const pl = e.target.closest('[data-place]');
    if (pl) { if (pl.dataset.place !== place) { place = pl.dataset.place; room = PLACES[place].home; haptic(); render(root); } return; }
    const bx = e.target.closest('[data-box]'); if (bx) { haptic(); return boxSheet(bx.dataset.box); }
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

// ---------- the french-door fridge, opened ----------
// Three pages you swipe between: the left door's bins, the inside (top shelf, the sliding fresh box with
// a small shelf under it, the main bottom shelf, two drawers side by side), and the right door's bins.
// Shelves added in Settings have no column, so they go inside.
const FR_STYLE = { 'fr-drawer': 'box', 'fr-mid': 'small', 'fr-crisp-l': 'crisper', 'fr-crisp-r': 'crisper' };
function frenchHTML(z, secHTML, page) {
  const col = c => z.sections.filter(s => (s.col || 'c') === c);
  const door = (c, name) => `<section class="fr-page fr-door-page"><div class="fr-door-liner">
      <div class="fr-door-hinge ${c}"></div>
      ${col(c).map(s => `<div class="fr-bin">${secHTML(s, true)}</div>`).join('') || '<p class="small muted" style="text-align:center">No bins on this door.</p>'}
    </div><p class="fr-hint">${c === 'l' ? 'Swipe left for the inside →' : '← Swipe right for the inside'}</p></section>`;
  // shelves top to bottom, then the drawers side by side at the very bottom
  const drawers = col('c').filter(s => FR_STYLE[s.id] === 'crisper');
  const inside = col('c').filter(s => FR_STYLE[s.id] !== 'crisper').map(s => ({ s, kind: FR_STYLE[s.id] || 'shelf' }));
  if (drawers.length) inside.push({ crispers: drawers });
  const insideHTML = inside.map(x => x.crispers
    ? `<div class="fr-crispers">${x.crispers.map(s => `<div class="fr-crisper">${secHTML(s)}<span class="fr-lip"></span></div>`).join('')}</div>`
    : x.kind === 'box' ? `<div class="fr-box">${secHTML(x.s)}<span class="fr-lip"></span></div>`
    : `<div class="fr-shelf ${x.kind === 'small' ? 'small' : ''}">${secHTML(x.s)}</div>`).join('');
  return `<div class="fr-tabs">${['‹ Left door', 'Inside', 'Right door ›'].map((t, i) => `<button class="${i === page ? 'on' : ''}" data-frgo="${i}">${t}</button>`).join('')}</div>
    <div class="fr-pager" data-frpager>
      ${door('l')}
      <section class="fr-page fr-main"><div class="fr-cavity">${insideHTML}</div><p class="fr-hint">← Doors on both sides →</p></section>
      ${door('r')}
    </div>`;
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
  // french-door fridge: 0 = left door, 1 = inside (where it opens), 2 = right door
  const colOf = sid => z.sections.find(x => x.id === sid)?.col || 'c';
  const hlItem = highlight && state.items.find(i => i.id === highlight);
  let frPage = hlItem ? { l: 0, c: 1, r: 2 }[colOf(hlItem.sectionId)] : 1;
  const secHTML = (s, door = false) => {
    // things inside a box are listed in the box, not loose on the shelf; someone else's private things stay hidden
    const its = state.items.filter(i => i.sectionId === s.id && !i.boxId && visibleItem(i));
    const title = door ? s.name.replace(/^.*Door · /, '') : s.name;
    const boxy = z.kind === 'rack' || z.kind === 'boxes', bxs = boxy ? boxesOn(s.id) : [];
    return `
            <div class="shelf-sec ${door ? 'bin' : ''}">
              <h3>${esc(title)} <span style="opacity:.6;font-weight:600">${its.length + bxs.length}</span>${its.length && !door && !boxy ? `<button class="btn btn-sm" style="margin-left:auto;height:28px;font-size:11.5px;background:rgba(255,255,255,.18);color:inherit" data-labelsec="${s.id}">🏷️${z.layout === 'french' ? '' : ' Label shelf'}</button>` : ''}${boxy ? `<button class="btn btn-sm" style="margin-left:auto;height:28px;font-size:11.5px;background:rgba(255,255,255,.18);color:inherit" data-pack="${s.id}">📦 Pack</button>` : ''}</h3>
              ${boxy ? `<div class="shelf-boxes">${bxs.map(b => boxTileHTML(b)).join('')}${z.kind === 'rack' ? `<button class="sbox add" data-newbox="${s.id}" aria-label="Add a box to ${attr(s.name)}">＋<small>Box</small></button>` : ''}</div>` : ''}
              <div class="shelf-items">
                ${its.map((i, n) => { const st = itemStatus(i); const k = st.key === 'ok' || st.key === 'none' ? (isLow(i) ? 'low' : '') : st.key; return `<button class="jar ${highlight === i.id ? 'hl' : ''}" data-item="${i.id}" style="animation-delay:${n * .04}s;${tint(i.cat)}">${k ? `<span class="st ${k}"></span>` : ''}${imgOrEmoji(i)}<div class="nm">${esc(i.name)}</div><div class="qt">${fmtQty(i.qty)} ${esc(i.unit)}</div></button>`; }).join('')}
                <button class="add-jar" data-addsec="${s.id}" aria-label="Add to ${attr(s.name)}">＋</button>
              </div>
            </div>`;
  };
  // put the fridge back on the page you were looking at (needs the overlay on screen to know its width)
  const syncPager = () => { const pg = ov.querySelector('[data-frpager]'); if (pg && pg.clientWidth) pg.scrollLeft = frPage * pg.clientWidth; };
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
          ${z.photo ? `<div class="ph-wrap zone-photo"><img data-photo="${attr(z.photo)}" alt=""><span>📷 ${esc(z.short || z.name)}</span></div>` : ""}
          <div class="chips" style="padding:12px 0 4px;margin:0 -2px">
            <button class="chip ${filter === 'all' ? 'on' : ''}" data-sec="all">All <span class="n">${all.length}</span></button>
            ${z.sections.map(s => `<button class="chip ${filter === s.id ? 'on' : ''}" data-sec="${s.id}">${esc(s.name)} <span class="n">${state.items.filter(i => i.sectionId === s.id).length}</span></button>`).join('')}
          </div>
          ${z.layout === 'french' && filter === 'all' ? frenchHTML(z, secHTML, frPage) : secs.map(s => secHTML(s)).join('')}
          ${!all.length ? `<div class="empty" style="color:inherit;opacity:.8"><span class="big">${cold ? '🧊' : '🕸️'}</span>Nothing in here yet.</div>` : ''}
        </div>
      </div>`;
    fillPhotos(ov);
    const pager = ov.querySelector('[data-frpager]');
    if (pager) {
      syncPager();
      let t;
      pager.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => {
        const n = Math.round(pager.scrollLeft / pager.clientWidth);
        if (n !== frPage) { frPage = n; haptic(8); }
        ov.querySelectorAll('[data-frgo]').forEach(b => b.classList.toggle('on', Number(b.dataset.frgo) === frPage));
      }, 60); }, { passive: true });
    }
    if (highlight) {
      const el = ov.querySelector(`[data-item="${highlight}"]`);
      if (el) setTimeout(() => { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.animate([{ transform: 'scale(1)', boxShadow: '0 0 0 0 #e7c877' }, { transform: 'scale(1.18)', boxShadow: '0 0 0 6px #e7c877' }, { transform: 'scale(1)', boxShadow: '0 0 0 3px #e7c877' }], { duration: 900, iterations: 2 }); }, 500);
      highlight = null;
    }
  };
  draw();
  document.body.appendChild(ov);
  syncPager();
  // remove on a timer too: animation callbacks don't fire while the app is in the background
  let closed = false;
  const close = () => { if (closed) return; closed = true; ov.querySelector('.inside-panel').animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.3)', opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' }); setTimeout(() => { ov.remove(); unsub(); }, 270); };
  ov.onclick = e => {
    if (e.target === ov || e.target.closest('[data-x]')) return close();
    const fg = e.target.closest('[data-frgo]'); if (fg) { const pg = ov.querySelector('[data-frpager]'); haptic(); return pg.scrollTo({ left: Number(fg.dataset.frgo) * pg.clientWidth, behavior: 'smooth' }); }
    const s = e.target.closest('[data-sec]'); if (s) { filter = s.dataset.sec; haptic(); return draw(); }
    const it = e.target.closest('[data-item]'); if (it) return showItem(it.dataset.item);
    const bx = e.target.closest('[data-box]'); if (bx) return boxSheet(bx.dataset.box);
    const nb = e.target.closest('[data-newbox]'); if (nb) { const b = newBox(nb.dataset.newbox); act({ kind: 'box', type: 'create', data: b }).then(ok => ok && boxSheet(b.id)); return; }
    const pk = e.target.closest('[data-pack]'); if (pk) return packSheet(pk.dataset.pack);
    const ad = e.target.closest('[data-addsec]'); if (ad) return actions.addItem({ sectionId: ad.dataset.addsec });
    if (e.target.closest('[data-add]')) return actions.addItem({ sectionId: filter !== 'all' ? filter : z.sections[0]?.id });
    const ls = e.target.closest('[data-labelsec]'); if (ls) return labelWalk(state.items.filter(i => i.sectionId === ls.dataset.labelsec).map(i => i.id), { title: `Label: ${esc(sectionById(ls.dataset.labelsec)?.name || '')}` });
    if (e.target.closest('[data-label]')) return labelWalk(itemsIn(zoneId).filter(i => filter === 'all' || i.sectionId === filter).map(i => i.id), { title: `Label: ${esc(z.name)}` });
  };
  // live-refresh while open
  const unsub = subscribe(() => { if (document.body.contains(ov)) draw(); });
  ov._close = close;
  return close;
}
