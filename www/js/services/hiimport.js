// Bring in Home Inventory: its numbered shelf sections become the basement racks, its boxes (with their
// photos, owners, locks and privacy) land on the same shelves, and its people are matched to this
// household's by name (anyone missing is added with the starting PIN). Running it twice adds nothing twice.

import { state, update, makeItem, today } from '../store.js';
import { matchFood } from '../data/foods.js';
import { addMember } from './people.js';
import { keepPhoto } from './photos.js';

const URL = 'https://rmshsswlodfvdffnlqdy.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable__aWybeZVozOcTHsjHq9jGg_HrQXqSpU';
const LEVELS = ['top', 'mid', 'bot', 'floor'];
const nice = s => String(s || '').replace(/\b\w/g, c => c.toUpperCase());

export async function takeImport(code) {
  const r = await fetch(URL + 'shelfstock_import_take', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_code: code }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'That code didn’t work');
  return r.json();
}

export async function applyImport(p, onStatus) {
  if (p?.source !== 'home-inventory') throw new Error('That isn’t a Home Inventory package');
  // people, matched by name
  const who = {};
  for (const hp of p.people || []) {
    let m = (state.members || []).find(x => x.name.trim().toLowerCase() === String(hp.name || '').trim().toLowerCase());
    if (!m && hp.name) { onStatus?.(`Adding ${hp.name}…`); m = await addMember(hp.name, hp.emoji || '⭐'); }
    if (m) who[hp.id] = m.id;
    // their "tell me / ask me first" choices come along if they haven't picked any here
    if (m && hp.prefs && !m.prefs) update(s => { const x = s.members.find(y => y.id === m.id); x.prefs = { onEdit: hp.prefs.onEdit || 'tell', onRemove: hp.prefs.onRemove || 'ask' }; }, 'member');
  }
  // photos onto this phone (and up to the household, if it syncs)
  const photos = Object.entries(p.photos || {});
  for (const [i, [id, data]] of photos.entries()) { onStatus?.(`Photo ${i + 1} of ${photos.length}…`); await keepPhoto(id, data); }
  const secId = (num, lv) => `b${num}-${LEVELS[lv] || 'floor'}`;
  let boxes = 0, items = 0;
  update(s => {
    s.boxes ||= [];
    // the racks: their names and photos, and the shelves' names and photos
    for (const sec of p.sections || []) {
      const z = s.zones.find(x => x.id === `bsmt-${sec.num}`); if (!z) continue;
      if (sec.name) { z.name = `Basement · ${sec.name}`; z.short = sec.name; }
      if (sec.photo) z.photo = sec.photo;
      (sec.levels || []).forEach((l, i) => { const shelf = z.sections.find(x => x.id === secId(sec.num, i)); if (shelf) { if (l.name) shelf.name = nice(l.name); if (l.photo) shelf.photo = l.photo; } });
    }
    for (const b of p.boxes || []) {
      const id = 'hi-' + b.id;
      if (s.boxes.some(x => x.id === id)) continue;
      s.boxes.push({ id, code: String(b.num ?? ''), sectionId: secId(b.sectionNum, b.level), level: null, name: b.name || (b.container && b.container !== 'Box' ? b.container : ''), color: b.color || null,
        owner: who[b.owner] || null, locked: !!b.locked, private: !!b.private, photo: b.photo || null, inside: b.inside || null,
        out: b.status === 'out' ? { by: who[b.outBy] || null, at: Date.now(), note: b.outNote || '' } : null, notes: '', added: today() });
      boxes++;
    }
    for (const it of p.items || []) {
      const food = matchFood(it.name || '');
      const boxId = it.boxId ? 'hi-' + it.boxId : null;
      const box = boxId && s.boxes.find(x => x.id === boxId);
      if (s.items.some(x => x.importedFrom === `${boxId}|${it.name}`)) continue;
      s.items.push(makeItem({ name: it.name || 'Something', foodId: food?.id || null, qty: Number(it.qty) || 1, unit: 'ea', cat: food?.cat || 'storage', emoji: food?.emoji || '📦',
        sectionId: box ? box.sectionId : secId(it.sectionNum, it.level), boxId, owner: who[it.owner] || null, locked: !!it.locked, private: !!it.private, notes: it.notes || '',
        out: it.status === 'out' ? { note: it.outNote || '' } : null, importedFrom: `${boxId}|${it.name}`, noExpiry: true }));
      items++;
    }
  }, 'hi-import');
  return { boxes, items, people: Object.keys(who).length, photos: photos.length };
}
