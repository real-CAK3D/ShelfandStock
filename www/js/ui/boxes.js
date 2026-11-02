// Storage boxes (the basement racks, the shed's stacks): numbered boxes with an outside and an inside photo
// and a list of what's in them. Owners can lock a box or item (nobody else changes it without their OK)
// or make a box private (others see that it's there, not what's in it). Changes to someone else's unlocked
// things follow that person's choice: tell me, ask me first, or don't bother me. The rules are the ones
// Home Inventory used, so the basement works the way it did there.

import { state, update, uid, who, today, makeItem, sectionById, fmtQty } from '../store.js';
import { matchFood, CAT_BY_ID } from '../data/foods.js';
import { esc, attr, icon, $, $$, openSheet, toast, haptic, confirmBox } from './dom.js';
import { me, memberById, firstName, avatar } from '../services/people.js';
import { notifyHouse } from '../services/notify.js';
import { savePhoto, shrink, fillPhotos } from '../services/photos.js';
import { showItem } from './itemSheet.js';

export const BOX_COLORS = ['#c8955a', '#e07a5f', '#3d85c6', '#81b29a', '#f2cc8f', '#9b72cf', '#e56b9f', '#5bc0be', '#8d99ae', '#f4a261'];
export const DEFAULT_PREFS = { onEdit: 'tell', onRemove: 'ask' };

// ---------- looking things up ----------
export const boxById = id => (state.boxes || []).find(b => b.id === id) || null;
export const boxesOn = sectionId => (state.boxes || []).filter(b => b.sectionId === sectionId).sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
export const contentsOf = b => state.items.filter(i => i.boxId === b.id);
export const boxFilled = b => !!(b.name || b.photo || contentsOf(b).length);
const where = b => { const s = sectionById(b.sectionId); return s ? `${s.zone.short || s.zone.name} › ${s.name}${b.level && s.zone.kind === 'boxes' ? ` · ${['', 'bottom', '2nd from the bottom', '3rd from the bottom', 'top'][b.level] || 'level ' + b.level}` : ''}` : 'Somewhere'; };
export const boxTitle = b => `Box ${b.code}${b.name ? ` · ${b.name}` : ''}`;
// what a box shows on the wall: its name, else the first thing in it
export function boxLabel(b) {
  if (hiddenFromMe(b)) return '🙈';
  if (b.name) return b.name;
  const c = contentsOf(b); return c.length ? c[0].name + (c.length > 1 ? ` +${c.length - 1}` : '') : '';
}
export function boxTileHTML(b, style = '') {
  return `<button class="sbox ${boxFilled(b) ? 'full' : ''} ${b.locked ? 'locked' : ''} ${b.out ? 'out' : ''}" data-box="${b.id}" style="${style}${b.color ? `;--bx:${b.color}` : ''}" aria-label="Box ${attr(b.code)}"><b>${esc(b.code)}</b><small>${esc(boxLabel(b))}</small></button>`;
}

// ---------- who may do what ----------
const prefsOf = id => ({ ...DEFAULT_PREFS, ...(memberById(id)?.prefs || {}) });
export const hiddenFromMe = rec => { const b = rec && 'boxId' in rec ? boxById(rec.boxId) : rec; return !!(b?.private && b.owner && b.owner !== who()) || !!(rec?.private && rec.owner && rec.owner !== who()); };
// an item someone else keeps private (or one inside their private box): left out of lists and search on this phone
export const visibleItem = it => !(it.private && it.owner && it.owner !== who()) && !(it.boxId && hiddenFromMe(boxById(it.boxId)));

function protector(rec, kind) {
  const mine = who();
  if (rec.locked && rec.owner && rec.owner !== mine) return rec.owner;
  if (kind === 'item' && rec.boxId) { const b = boxById(rec.boxId); if (b?.locked && b.owner && b.owner !== mine) return b.owner; }
  return null;
}
const lockedBy = boxId => { const b = boxById(boxId); return b?.locked && b.owner && b.owner !== who() ? b.owner : null; };

// op: { kind: 'box'|'item', type: 'create'|'update'|'delete', id?, data? (new record), patch? }
// → { mode: 'apply'|'request'|'deny', to?, tell: [ids], reason? }
export function decide(op) {
  const mine = who(), tell = [];
  if (op.type === 'create') {
    const guard = op.kind === 'item' ? lockedBy(op.data?.boxId) : null;
    if (guard) return { mode: 'request', to: guard, tell: [guard] };
    const owner = op.kind === 'item' && op.data?.boxId ? boxById(op.data.boxId)?.owner : null;
    if (owner && owner !== mine && prefsOf(owner).onEdit !== 'quiet') tell.push(owner);
    return { mode: 'apply', tell };
  }
  const cur = op.kind === 'box' ? boxById(op.id) : state.items.find(i => i.id === op.id);
  if (!cur) return { mode: 'deny', tell, reason: 'That isn’t here any more' };
  const owner = cur.owner || null;
  if (hiddenFromMe(cur)) return { mode: 'deny', tell, reason: 'That’s private' };
  const patch = op.patch || {};
  // taking something out or putting it back never needs an OK: you're holding it
  const outIn = op.type === 'update' && Object.keys(patch).every(k => k === 'out');
  const dest = op.kind === 'item' && patch.boxId && patch.boxId !== cur.boxId ? lockedBy(patch.boxId) : null;
  const guard = outIn ? null : protector(cur, op.kind) || dest;
  if (guard) return { mode: 'request', to: guard, tell: [guard] };
  if (!owner || owner === mine) return { mode: 'apply', tell };
  const p = prefsOf(owner);
  if (op.type === 'delete') return p.onRemove === 'ask' ? { mode: 'request', to: owner, tell: [owner] } : { mode: 'apply', tell: [owner] };
  if (outIn) return { mode: 'apply', tell: [owner] };
  if (p.onEdit === 'ask') return { mode: 'request', to: owner, tell: [owner] };
  return { mode: 'apply', tell: p.onEdit === 'quiet' ? [] : [owner] };
}

// what the change is, in words: "move Box 12 to Section 3 › Top Shelf"
function describe(op) {
  const cur = op.kind === 'box' ? boxById(op.id) : state.items.find(i => i.id === op.id);
  const name = op.kind === 'box' ? `Box ${(cur || op.data)?.code}` : (cur || op.data)?.name || 'something';
  const p = op.patch || {};
  if (op.type === 'create') return op.kind === 'item' ? `add ${name} to ${op.data?.boxId ? `Box ${boxById(op.data.boxId)?.code}` : 'a shelf'}` : `add ${name}`;
  if (op.type === 'delete') return `remove ${name}`;
  if ('out' in p) return p.out ? `take out ${name}${p.out.note ? ` (“${p.out.note}”)` : ''}` : `put back ${name}`;
  if ('sectionId' in p || 'boxId' in p || 'level' in p) {
    const to = p.boxId ? `Box ${boxById(p.boxId)?.code}` : (() => { const s = sectionById(p.sectionId || cur?.sectionId); return s ? `${s.zone.short || s.zone.name} › ${s.name}` : 'somewhere else'; })();
    return `move ${name} to ${to}`;
  }
  if ('locked' in p) return `${p.locked ? 'lock' : 'unlock'} ${name}`;
  if ('owner' in p) return `give ${name} to ${p.owner ? firstName(p.owner) : 'the whole family'}`;
  return `change ${name}`;
}
const past = s => s.replace(/^(add|remove|take out|put back|move|lock|unlock|give|change)\b/, w => ({ add: 'added', remove: 'removed', 'take out': 'took out', 'put back': 'put back', move: 'moved', lock: 'locked', unlock: 'unlocked', give: 'gave', change: 'changed' }[w]));

// make the change on this phone (and so, through sync, everywhere)
function applyOp(op, by = who()) {
  update(s => {
    s.boxes ||= [];
    const list = op.kind === 'box' ? s.boxes : s.items;
    if (op.type === 'create') list.push(op.data);
    else if (op.type === 'delete') {
      const i = list.findIndex(x => x.id === op.id); if (i < 0) return;
      const rec = list[i]; list.splice(i, 1);
      if (op.kind === 'box') s.items = s.items.filter(it => it.boxId !== rec.id); // a removed box takes its contents with it
      s.history.push({ ts: Date.now(), by, type: 'removed', name: op.kind === 'box' ? `Box ${rec.code}` : rec.name, cat: rec.cat || 'storage' });
    } else {
      const rec = list.find(x => x.id === op.id); if (!rec) return;
      Object.assign(rec, op.patch);
      // a box that moves takes its contents along
      if (op.kind === 'box' && op.patch.sectionId) for (const it of s.items) if (it.boxId === rec.id) it.sectionId = op.patch.sectionId;
    }
  }, 'box');
}

// Run a change through the rules: do it now, or ask the owner. Returns true if it was done now.
export async function act(op) {
  const d = decide(op);
  const text = describe(op);
  if (d.mode === 'deny') { toast(d.reason, { icon: '🔒' }); return false; }
  const name = me()?.name || 'Someone';
  if (d.mode === 'request') {
    update(s => { s.approvals ||= []; s.approvals.push({ id: uid(), by: who(), to: d.to, op, text, status: 'pending', at: Date.now() }); }, 'ask');
    notifyHouse('ask', `${name} wants to ${text}. Open Shelf & Stock to say yes or no.`, { to: d.to });
    toast(`Asked ${firstName(d.to)} first: it happens when they say yes`, { icon: '🙋' });
    return false;
  }
  applyOp(op);
  for (const t of d.tell) notifyHouse('box', `${name} ${past(text)}`, { to: t });
  return true;
}

// ---------- approvals ----------
export const waitingForMe = () => (state.approvals || []).filter(a => a.status === 'pending' && a.to === who());
export const myAnswers = () => (state.approvals || []).filter(a => a.by === who() && a.status !== 'pending' && !a.seen);

export function answer(id, yes) {
  const a = (state.approvals || []).find(x => x.id === id); if (!a || a.status !== 'pending') return;
  if (yes) applyOp(a.op, a.by);
  update(s => { const x = s.approvals.find(y => y.id === id); x.status = yes ? 'yes' : 'no'; x.answeredAt = Date.now(); s.approvals = s.approvals.filter(y => y.status === 'pending' || Date.now() - (y.answeredAt || y.at) < 30 * 864e5); }, 'answer');
  notifyHouse('ask', `${me()?.name || 'Someone'} said ${yes ? 'yes' : 'no'}: ${a.text}`, { to: a.by });
  toast(yes ? 'Done: they’ll see it went through' : 'Told them no', { icon: yes ? '✅' : '✋' });
}

export function approvalsSheet() {
  openSheet({
    title: '🙋 Asking for your OK',
    html: `<div data-ap></div>`,
    onMount: (b, close) => {
      const draw = () => {
        const mine = waitingForMe(), answers = myAnswers(), asked = (state.approvals || []).filter(a => a.by === who() && a.status === 'pending');
        b.querySelector('[data-ap]').innerHTML = `
          ${mine.length ? mine.map(a => `<div class="ask-card"><div class="row" style="gap:10px">${avatar(memberById(a.by), 34)}<span class="grow"><b>${esc(firstName(a.by))}</b> wants to <b>${esc(a.text)}</b><small class="muted" style="display:block">${new Date(a.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</small></span></div>
            <div class="row" style="gap:8px;margin-top:10px"><button class="btn btn-sage grow" data-yes="${a.id}">${icon('check')} Yes</button><button class="btn btn-danger grow" data-no="${a.id}">No</button></div></div>`).join('') : '<p class="muted" style="text-align:center">Nothing waiting for you.</p>'}
          ${answers.length ? `<div class="group-h">Answers to what you asked<span class="line"></span></div>${answers.map(a => `<div class="ask-card small">${a.status === 'yes' ? '✅' : '✋'} <b>${esc(firstName(a.to))}</b> said ${a.status}: ${esc(a.text)}</div>`).join('')}` : ''}
          ${asked.length ? `<div class="group-h">Still waiting on<span class="line"></span></div>${asked.map(a => `<div class="ask-card small">⏳ ${esc(firstName(a.to))}: ${esc(a.text)}</div>`).join('')}` : ''}`;
        b.querySelectorAll('[data-yes]').forEach(x => x.onclick = () => { answer(x.dataset.yes, true); draw(); });
        b.querySelectorAll('[data-no]').forEach(x => x.onclick = () => { answer(x.dataset.no, false); draw(); });
      };
      draw();
      // answers you've now seen don't come back
      if (myAnswers().length) update(s => { for (const a of s.approvals || []) if (a.by === who() && a.status !== 'pending') a.seen = true; }, 'seen');
    },
  });
}

// ---------- adding things ----------
// "4 mugs, blender, knives" → items in the box
export function parseContents(text) {
  return String(text || '').split(/[,\n;]+/).map(t => t.trim()).filter(Boolean).map(t => {
    const m = t.match(/^(\d+(?:\.\d+)?)\s+(.+)$/), qty = m ? Number(m[1]) : 1, name = (m ? m[2] : t).trim();
    const food = matchFood(name);
    return { name: name.charAt(0).toUpperCase() + name.slice(1), qty, food };
  });
}
export async function addToBox(b, text) {
  let n = 0;
  for (const x of parseContents(text)) {
    const it = makeItem({ name: x.name, foodId: x.food?.id || null, qty: x.qty, unit: x.food?.unit && x.qty === 1 ? x.food.unit : 'ea', cat: x.food?.cat || 'storage', emoji: x.food?.emoji || '📦', sectionId: b.sectionId, boxId: b.id, noExpiry: !x.food });
    if (await act({ kind: 'item', type: 'create', data: it })) n++;
  }
  return n;
}

// the next free number for a basement box (they count up, like Home Inventory's)
export function nextBoxCode() {
  const nums = (state.boxes || []).map(b => Number(b.code)).filter(Number.isFinite);
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}
export function newBox(sectionId, extra = {}) {
  return { id: 'box-' + uid(), code: nextBoxCode(), sectionId, level: null, name: '', color: BOX_COLORS[0], owner: who() || null, locked: false, private: false, photo: null, inside: null, out: null, notes: '', added: today(), ...extra };
}

// ---------- the box ----------
export function boxSheet(id, { onClose } = {}) {
  const b0 = boxById(id); if (!b0) return;
  openSheet({
    title: `📦 Box ${esc(b0.code)}`,
    html: `<div data-bx></div>`,
    onClose,
    onMount: (host, close) => {
      const draw = () => {
        const b = boxById(id); if (!b) { close(); return; }
        const hidden = hiddenFromMe(b), mineOrFamily = !b.owner || b.owner === who();
        const items = hidden ? [] : contentsOf(b);
        const owner = b.owner ? memberById(b.owner) : null;
        host.querySelector('[data-bx]').innerHTML = `
          <div class="box-head" style="--bx:${b.color || '#c8955a'}">
            <div class="grow"><input class="input box-name" value="${attr(b.name)}" placeholder="Name this box (e.g. Christmas lights)" ${hidden ? 'disabled' : ''} data-name>
              <div class="crumb">📍 ${esc(where(b))}</div></div>
          </div>
          <div class="row wrap" style="gap:6px;margin:8px 0 12px">
            <span class="pill">${owner ? `${avatar(owner, 18)} ${esc(owner.name)}'s` : '👪 Whole family'}</span>
            ${b.locked ? '<span class="pill warn">🔒 Locked</span>' : ''}${b.private ? '<span class="pill">🙈 Private</span>' : ''}
            ${b.out ? `<span class="pill soon">📤 Taken out by ${esc(firstName(b.out.by))}${b.out.note ? ` · ${esc(b.out.note)}` : ''}</span>` : ''}
          </div>
          ${hidden ? `<div class="where-banner">🙈 <span>This box is private to ${esc(owner?.name || 'someone')}. You can see where it is, not what's in it.</span></div>` : `
          <div class="box-photos">
            ${['photo', 'inside'].map(k => `<label class="ph-wrap ${b[k] ? '' : 'empty'}"><img data-photo="${attr(b[k] || '')}" alt=""><span>${k === 'photo' ? '📷 Outside' : '📷 Inside'}</span><input type="file" accept="image/*" capture="environment" data-shot="${k}" hidden></label>`).join('')}
          </div>
          <div class="group-h">What's in it <span class="n">${items.length}</span><span class="line"></span></div>
          ${items.length ? `<div class="box-items">${items.map(i => `<button class="box-item" data-item="${i.id}"><span class="em">${i.emoji}</span><span class="grow">${esc(i.name)}${i.out ? ' <small class="muted">· taken out</small>' : ''}</span><b>${fmtQty(i.qty)}${i.unit !== 'ea' ? ' ' + esc(i.unit) : ''}</b>${i.locked ? '🔒' : ''}</button>`).join('')}</div>` : '<p class="muted small" style="margin:4px 2px 10px">Nothing listed yet.</p>'}
          <div class="row" style="gap:8px;margin:6px 0 14px"><input class="input grow" placeholder="4 mugs, blender, knives" data-add><button class="btn btn-brass" data-addgo>${icon('plus')} Add</button></div>`}
          <div class="row wrap" style="gap:8px">
            ${b.out ? '<button class="btn btn-sage grow" data-back>📥 Put it back</button>' : '<button class="btn btn-ghost grow" data-out>📤 Take it out</button>'}
            <button class="btn btn-ghost grow" data-move>${icon('move')} Move</button>
            ${mineOrFamily ? `<button class="btn btn-ghost grow" data-lock>${b.locked ? '🔓 Unlock' : '🔒 Lock'}</button><button class="btn btn-ghost grow" data-priv>${b.private ? '👁️ Not private' : '🙈 Private'}</button>` : ''}
          </div>
          <div class="field" style="margin-top:12px"><span>Whose box</span><select class="input" data-owner ${mineOrFamily ? '' : 'disabled'}><option value="">👪 Whole family</option>${(state.members || []).map(m => `<option value="${m.id}" ${b.owner === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
          <div class="row" style="gap:6px;margin:10px 0">${BOX_COLORS.map(c => `<button class="swatch ${b.color === c ? 'on' : ''}" style="background:${c}" data-color="${c}" aria-label="Box color"></button>`).join('')}</div>
          <button class="btn btn-ghost btn-block btn-sm" data-del style="color:var(--tomato)">${icon('trash')} ${items.length ? 'Remove the box and everything in it' : 'Remove this box'}</button>`;
        fillPhotos(host);
        const on = (sel, fn) => host.querySelector(sel)?.addEventListener('click', fn);
        host.querySelector('[data-name]')?.addEventListener('change', e => act({ kind: 'box', type: 'update', id, patch: { name: e.target.value.trim().slice(0, 60) } }).then(draw));
        host.querySelectorAll('[data-shot]').forEach(inp => inp.onchange = async () => {
          const f = inp.files[0]; inp.value = ''; if (!f) return;
          const pid = await savePhoto(await shrink(f));
          await act({ kind: 'box', type: 'update', id, patch: { [inp.dataset.shot]: pid } }); haptic(); draw();
        });
        const add = async () => { const inp = host.querySelector('[data-add]'); if (!inp.value.trim()) return; const n = await addToBox(b, inp.value); if (n) toast(`${n} thing${n > 1 ? 's' : ''} added to Box ${b.code}`, { icon: '📦' }); inp.value = ''; draw(); };
        on('[data-addgo]', add); host.querySelector('[data-add]')?.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
        host.querySelectorAll('[data-item]').forEach(x => x.onclick = () => showItem(x.dataset.item));
        on('[data-out]', async () => { const note = prompt('Where is it going? (optional)', '') ?? null; if (note === null) return; await act({ kind: 'box', type: 'update', id, patch: { out: { by: who(), at: Date.now(), note: note.trim().slice(0, 80) } } }); draw(); });
        on('[data-back]', async () => { await act({ kind: 'box', type: 'update', id, patch: { out: null } }); draw(); });
        on('[data-lock]', async () => { await act({ kind: 'box', type: 'update', id, patch: { locked: !b.locked, owner: b.owner || who() } }); draw(); });
        on('[data-priv]', async () => { await act({ kind: 'box', type: 'update', id, patch: { private: !b.private, owner: b.owner || who() } }); draw(); });
        host.querySelector('[data-owner]')?.addEventListener('change', async e => { await act({ kind: 'box', type: 'update', id, patch: { owner: e.target.value || null } }); draw(); });
        host.querySelectorAll('[data-color]').forEach(x => x.onclick = async () => { await act({ kind: 'box', type: 'update', id, patch: { color: x.dataset.color } }); draw(); });
        on('[data-move]', () => moveBoxSheet(id, draw));
        on('[data-del]', async () => { if (!await confirmBox(`Remove Box ${b.code}${items.length ? ` and the ${items.length} thing${items.length > 1 ? 's' : ''} in it` : ''}?`, { ok: 'Remove', danger: true })) return; if (await act({ kind: 'box', type: 'delete', id })) { toast(`Box ${b.code} removed`); close(); } else draw(); });
      };
      draw();
    },
  });
}

// Move a box: to another shelf (basement), or another spot in a stack (shed)
function moveBoxSheet(id, after) {
  const b = boxById(id);
  const spots = state.zones.filter(z => z.kind === 'rack' || z.kind === 'boxes');
  openSheet({
    title: `Move Box ${esc(b.code)}`,
    html: spots.map(z => `<div class="group-h">${esc(z.name)}<span class="line"></span></div><div class="row wrap" style="gap:6px;margin-bottom:8px">${z.sections.map(s => {
      if (z.kind !== 'boxes') return `<button class="chip ${b.sectionId === s.id ? 'on' : ''}" data-to="${s.id}">${esc(s.name)} <span class="n">${boxesOn(s.id).length}</span></button>`;
      const free = Array.from({ length: z.high || 4 }, (_, i) => i + 1).filter(lv => !state.boxes.some(x => x.sectionId === s.id && x.level === lv && x.id !== id));
      return free.length ? `<button class="chip" data-to="${s.id}" data-lv="${free[0]}">${esc(s.name)} <span class="n">${free.length} free</span></button>` : '';
    }).join('')}</div>`).join(''),
    onMount: (host, close) => host.querySelectorAll('[data-to]').forEach(x => x.onclick = async () => {
      const patch = { sectionId: x.dataset.to, level: x.dataset.lv ? Number(x.dataset.lv) : null };
      if (await act({ kind: 'box', type: 'update', id, patch })) toast(`Box ${b.code} moved`, { icon: '📦' });
      close(); after?.();
    }),
  });
}

// ---------- pack mode: shelf after shelf, box after box ----------
// The loop Home Inventory used: photo of the box, photo of the inside, type what's in it, next box.
export function packSheet(sectionId) {
  const sec = sectionById(sectionId); if (!sec) return;
  let done = 0;
  openSheet({
    title: `📦 Pack ${esc(sec.zone.short || sec.zone.name)} › ${esc(sec.name)}`,
    html: `<div data-pk></div>`,
    onMount: (host, close) => {
      const step = () => {
        const code = nextBoxCode();
        let photo = null, inside = null;
        host.querySelector('[data-pk]').innerHTML = `
          <p class="muted small" style="margin:0 2px 10px">${done ? `${done} box${done > 1 ? 'es' : ''} packed. ` : ''}Next up: <b>Box ${esc(code)}</b>. Snap the outside and the inside, then list what's in it.</p>
          <div class="box-photos">${['photo', 'inside'].map(k => `<label class="ph-wrap empty"><img alt=""><span>📷 ${k === 'photo' ? 'Outside' : 'Inside'}</span><input type="file" accept="image/*" capture="environment" data-shot="${k}" hidden></label>`).join('')}</div>
          <label class="field"><span>Name (optional)</span><input class="input" data-name placeholder="Kitchen extras"></label>
          <label class="field"><span>What's in it</span><textarea class="input" rows="3" data-what placeholder="4 mugs, blender, knives"></textarea></label>
          <div class="row" style="gap:8px"><button class="btn btn-brass grow" data-next>${icon('check')} Save, next box</button><button class="btn btn-ghost" data-done>Done</button></div>`;
        host.querySelectorAll('[data-shot]').forEach(inp => inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return;
          const url = await shrink(f), pid = await savePhoto(url);
          if (inp.dataset.shot === 'photo') photo = pid; else inside = pid;
          const wrap = inp.closest('.ph-wrap'); wrap.classList.remove('empty'); wrap.classList.add('has'); wrap.querySelector('img').src = url; haptic();
        });
        const save = async () => {
          const name = host.querySelector('[data-name]').value.trim(), what = host.querySelector('[data-what]').value;
          if (!photo && !inside && !name && !what.trim()) return false;
          const b = newBox(sectionId, { code, name, photo, inside });
          if (!await act({ kind: 'box', type: 'create', data: b })) return false;
          if (what.trim()) await addToBox(b, what);
          done++; haptic(20); return true;
        };
        host.querySelector('[data-next]').onclick = async () => { if (await save()) { toast(`Box ${code} saved`, { icon: '📦' }); step(); } };
        host.querySelector('[data-done]').onclick = async () => { await save(); close(); };
      };
      step();
    },
  });
}

// ---------- search help: "box 12", "12", "L5" ----------
export function findBoxes(q) {
  const t = String(q || '').trim().toLowerCase().replace(/^box\s*/, '');
  if (!t) return [];
  return (state.boxes || []).filter(b => !hiddenFromMe(b) || String(b.code).toLowerCase() === t).filter(b => String(b.code).toLowerCase() === t || (b.name && b.name.toLowerCase().includes(t)));
}
export const boxWhere = where;
export const catName = id => CAT_BY_ID[id]?.name || '';
