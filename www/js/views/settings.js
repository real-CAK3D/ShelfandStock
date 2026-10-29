// Settings: finish, household, storage layout editor, staples, backup/restore, data sources.

import { state, update, replaceState, resetAll, seedSample, uid } from '../store.js';
import { ZONE_KINDS } from '../data/layout.js';
import { FOOD_BY_ID, searchFoods } from '../data/foods.js';
import { esc, attr, icon, $, $$, toast, haptic, confirmBox } from '../ui/dom.js';
import { actions } from '../router.js';
import { syncInfo, createHousehold, joinHousehold, leaveHousehold, pull, push } from '../services/sync.js';

const WOODS = [['walnut', '#3b2416', '#8a5a35'], ['oak', '#6b4a2b', '#b7884f'], ['cherry', '#5a2318', '#a4553a'], ['ash', '#4a4640', '#a89f90'], ['ebony', '#1d1612', '#4a3a2e']];

export function render(root) {
  const s = state.settings;
  const wasted = state.history.filter(h => h.type === 'tossed');
  const cooked = state.history.filter(h => h.type === 'cooked');
  root.innerHTML = `<div class="pad">
    <h2 style="font-size:26px;margin:4px 0 14px">Settings</h2>

    <div class="card pad" style="margin-bottom:14px">
      <h3 style="margin-bottom:14px">Wood finish</h3>
      <div class="swatches" style="margin-bottom:22px">${WOODS.map(([n, a, b]) => `<button class="swatch ${s.wood === n ? 'on' : ''}" data-wood="${n}" style="background:var(--grain) 0 0/300px 150px, linear-gradient(135deg, ${a}, ${b});background-blend-mode:soft-light"><span>${n[0].toUpperCase() + n.slice(1)}</span></button>`).join('')}</div>
      <div class="setting" style="border:0;padding-bottom:0"><div class="grow"><b>Cabinet doors</b><small>How cabinets look in the kitchen scene</small></div>
        <div class="seg" style="width:170px"><button data-cab="painted" class="${s.cabinets !== 'wood' ? 'on' : ''}" style="position:relative;z-index:1">Painted</button><button data-cab="wood" class="${s.cabinets === 'wood' ? 'on' : ''}" style="position:relative;z-index:1">Wood</button></div></div>
    </div>

    <div class="card pad" style="margin-bottom:14px">
      <div class="setting"><div class="grow"><b>Household size</b><small>Default servings when planning</small></div><div class="stepper" style="height:38px"><button data-hh="-1">−</button><input value="${s.household}" readonly style="width:40px"><button data-hh="1">+</button></div></div>
      <div class="setting"><div class="grow"><b>“Use soon” warning</b><small>Flag items this many days before their date</small></div><div class="stepper" style="height:38px"><button data-wd="-1">−</button><input value="${s.expiryWarnDays}" readonly style="width:40px"><button data-wd="1">+</button></div></div>
      <div class="setting" style="border:0"><div class="grow"><b>Haptics</b><small>Little buzzes when you tap</small></div><label class="toggle"><input type="checkbox" data-hap ${s.haptics ? 'checked' : ''}><i></i></label></div>
    </div>

    <div class="card pad" style="margin-bottom:14px">
      <h3>Always-on-hand staples</h3>
      <p class="small muted" style="margin:4px 0 10px">Recipes treat these as stocked even if you don't track them.</p>
      <div class="row wrap" style="gap:6px" data-staples>${s.stapleIds.map(id => `<button class="chip on" data-unstaple="${id}">${FOOD_BY_ID[id]?.emoji || ''} ${esc(FOOD_BY_ID[id]?.name || id)} ✕</button>`).join('')}</div>
      <input class="input" style="margin-top:10px" placeholder="Add a staple (e.g. sugar)…" data-staple list="staple-dl"><datalist id="staple-dl"></datalist>
    </div>

    <div class="card pad" style="margin-bottom:14px">
      <div class="row" style="justify-content:space-between;margin-bottom:10px"><h3>Your storage</h3><button class="btn btn-ghost btn-sm" data-addzone>${icon('plus')} Add place</button></div>
      <p class="small muted" style="margin:-4px 0 10px">Rename cabinets and shelves to match your real kitchen. Add a garage freezer, bar cart, basement shelves…</p>
      ${state.zones.map(z => `<div class="zone-edit" data-z="${z.id}">
        <div class="row"><input class="input" value="${attr(z.name)}" data-zname="${z.id}" style="height:40px;font-weight:600"><select class="input" style="width:120px;height:40px;font-size:13px" data-zkind="${z.id}">${Object.entries(ZONE_KINDS).map(([k, v]) => `<option value="${k}" ${z.kind === k ? 'selected' : ''}>${v.emoji} ${v.label}</option>`).join('')}</select><button class="icon-btn" style="color:var(--tomato);background:var(--tomato-2);border:0;width:40px;height:40px;flex:0 0 auto" data-zdel="${z.id}" aria-label="Delete">${icon('trash')}</button></div>
        ${z.sections.map(sec => `<div class="sec"><input class="input" value="${attr(sec.name)}" data-sname="${z.id}|${sec.id}"><button class="btn btn-ghost btn-sm" data-sdel="${z.id}|${sec.id}" aria-label="Delete shelf">${icon('minus')}</button></div>`).join('')}
        <button class="btn btn-ghost btn-sm" style="margin-top:8px" data-sadd="${z.id}">${icon('plus')} Shelf / section</button>
      </div>`).join('')}
    </div>

    <div class="card pad" style="margin-bottom:14px">
      <h3>Kitchen report</h3>
      <div class="kv"><div><small>Items tracked</small><b>${state.items.length}</b></div><div><small>Meals cooked</small><b>${cooked.length}</b></div><div><small>Tossed (waste)</small><b>${wasted.length}</b></div><div><small>Recipes saved</small><b>${state.recipes.length}</b></div></div>
      ${wasted.length ? `<p class="small muted">Most tossed: ${esc(Object.entries(wasted.reduce((a, h) => (a[h.name] = (a[h.name] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} (${c})`).join(', '))}</p>` : ''}
    </div>

    <div class="card pad" style="margin-bottom:14px" data-tour="sync">
      <h3>☁️ Household sync</h3>
      ${(() => { const si = syncInfo(); return si.code ? `
        <p class="small muted" style="margin:4px 0 10px">Everyone with this code shares one kitchen. Changes sync automatically.</p>
        <div class="row" style="gap:8px;margin-bottom:10px"><div class="input grow" style="display:flex;align-items:center;font:700 18px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em">${esc(si.code)}</div><button class="btn btn-ghost" data-sync-share>${icon('share')}</button></div>
        <p class="small muted" style="margin:0 0 10px">${si.status === 'offline' ? '⚠️ Offline — will catch up when you’re back online.' : `✅ Synced ${si.last ? new Date(si.last).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''} · version ${si.version}`}</p>
        <div class="row" style="gap:8px"><button class="btn btn-wood wood-mid grow" data-sync-now>Sync now</button><button class="btn btn-ghost" data-sync-leave>Leave</button></div>` : `
        <p class="small muted" style="margin:4px 0 10px">Share your kitchen with everyone in the house: start a household, then enter its code on the other phones.</p>
        <div class="row" style="gap:8px;margin-bottom:8px"><input class="input grow" data-sync-name placeholder="Household name" value="Our Kitchen"><button class="btn btn-brass" data-sync-create>Start</button></div>
        <div class="row" style="gap:8px"><input class="input grow" data-sync-code placeholder="XXXX-XXXX-XXXX-XXXX" style="text-transform:uppercase"><button class="btn btn-ghost" data-sync-join>Join</button></div>`; })()}
    </div>

    <div class="card pad" style="margin-bottom:14px">
      <h3 style="margin-bottom:10px">Backup</h3>
      <div class="row" style="gap:8px"><button class="btn btn-ghost grow" data-export>${icon('download')} Export</button><label class="btn btn-ghost grow">${icon('upload')} Import<input type="file" accept="application/json,.json" data-import hidden></label></div>
      <p class="small muted">Everything lives on this phone. Export a backup file to move to a new phone or share with your household.</p>
    </div>

    <div class="card pad" style="margin-bottom:14px">
      <button class="btn btn-wood wood-mid btn-block" data-tour-again>🧭 Replay the walkthrough</button>
      <div class="spacer"></div>
      <div class="row" style="gap:8px"><button class="btn btn-ghost grow btn-sm" data-sample>Load sample kitchen</button><button class="btn btn-danger grow btn-sm" data-wipe>Erase everything</button></div>
    </div>

    <p class="small muted" style="text-align:center;line-height:1.6">Shelf &amp; Stock 1.1 · Product labels &amp; nutrition from <b>Open Food Facts</b> (ODbL) · Online recipes from <b>TheMealDB</b> · Storage times adapted from <b>USDA FoodKeeper</b> guidance.</p>
  </div>`;

  root.onclick = async e => {
    const w = e.target.closest('.swatch[data-wood]'); // <html> also carries data-wood if (w) { update(s => { s.settings.wood = w.dataset.wood; }, 'wood'); document.documentElement.dataset.wood = w.dataset.wood; haptic(); return; }
    if (e.target.closest('[data-sync-create]')) {
      try { const code = await createHousehold($('[data-sync-name]', root).value); toast(`Household started · ${code}`, { icon: '☁️' }); } catch (err) { toast('Couldn’t reach the cloud — check your connection', { icon: '⚠️' }); }
      return render(root);
    }
    if (e.target.closest('[data-sync-join]')) {
      const code = $('[data-sync-code]', root).value.trim();
      if (!code) return toast('Enter the code from the other phone');
      if (!await confirmBox('Joining replaces the kitchen on this phone with the shared one.', { ok: 'Join' })) return;
      try { await joinHousehold(code); toast('Joined — your kitchens are linked', { icon: '☁️' }); } catch (err) { toast(err.message.includes('No household') ? 'No household with that code' : 'Couldn’t reach the cloud', { icon: '⚠️' }); }
      return render(root);
    }
    if (e.target.closest('[data-sync-now]')) { await pull(); await push(); toast('Synced', { icon: '☁️' }); return render(root); }
    if (e.target.closest('[data-sync-leave]')) { if (await confirmBox('Stop syncing this phone? Your kitchen stays on this phone.', { ok: 'Leave' })) { leaveHousehold(); render(root); } return; }
    if (e.target.closest('[data-sync-share]')) {
      const text = `Join our kitchen on Shelf & Stock: Settings › Household sync › code ${syncInfo().code}`;
      if (window.LarderNative?.share) window.LarderNative.share(text); else { try { await navigator.clipboard.writeText(syncInfo().code); toast('Code copied', { icon: '📋' }); } catch { } }
      return;
    }
    const cab = e.target.closest('[data-cab]'); if (cab) { haptic(); return update(s => { s.settings.cabinets = cab.dataset.cab; }); }
    const hh = e.target.closest('[data-hh]'); if (hh) return update(s => { s.settings.household = Math.max(1, s.settings.household + Number(hh.dataset.hh)); });
    const wd = e.target.closest('[data-wd]'); if (wd) return update(s => { s.settings.expiryWarnDays = Math.max(0, s.settings.expiryWarnDays + Number(wd.dataset.wd)); });
    const us = e.target.closest('[data-unstaple]'); if (us) return update(s => { s.settings.stapleIds = s.settings.stapleIds.filter(x => x !== us.dataset.unstaple); });
    if (e.target.closest('[data-addzone]')) { update(s => { s.zones.push({ id: 'z-' + uid(), name: 'New storage', kind: 'other', slot: 'custom', sections: [{ id: 's-' + uid(), name: 'Shelf 1' }] }); }); toast('Added — give it a name below', { icon: '🧰' }); return; }
    const zd = e.target.closest('[data-zdel]');
    if (zd) {
      const z = state.zones.find(x => x.id === zd.dataset.zdel), n = state.items.filter(i => z.sections.some(s => s.id === i.sectionId)).length;
      if (await confirmBox(`Delete “${z.name}”?${n ? ` Its ${n} items move to the first remaining shelf.` : ''}`, { ok: 'Delete', danger: true })) update(s => { s.zones = s.zones.filter(x => x.id !== z.id); const fallback = s.zones[0]?.sections[0]?.id; s.items.forEach(i => { if (z.sections.some(sec => sec.id === i.sectionId)) i.sectionId = fallback; }); });
      return;
    }
    const sa = e.target.closest('[data-sadd]'); if (sa) return update(s => { s.zones.find(z => z.id === sa.dataset.sadd).sections.push({ id: 's-' + uid(), name: 'New shelf' }); });
    const sd = e.target.closest('[data-sdel]');
    if (sd) {
      const [zid, sid] = sd.dataset.sdel.split('|'); const z = state.zones.find(x => x.id === zid);
      if (z.sections.length === 1) return toast('A place needs at least one shelf');
      update(s => { const zz = s.zones.find(x => x.id === zid); zz.sections = zz.sections.filter(x => x.id !== sid); s.items.forEach(i => { if (i.sectionId === sid) i.sectionId = zz.sections[0].id; }); });
      return;
    }
    if (e.target.closest('[data-export]')) return exportData();
    if (e.target.closest('[data-tour-again]')) return actions.tour(true);
    if (e.target.closest('[data-sample]')) { if (await confirmBox('Replace your kitchen with the sample kitchen?', { ok: 'Load sample' })) { seedSample(); toast('Sample kitchen loaded', { icon: '🏠' }); actions.go('kitchen'); } return; }
    if (e.target.closest('[data-wipe]')) { if (await confirmBox('Erase every item, list, plan and recipe? This cannot be undone.', { ok: 'Erase', danger: true })) { resetAll(); location.reload(); } }
  };
  root.onchange = e => {
    const t = e.target;
    if (t.dataset.zname) update(s => { s.zones.find(z => z.id === t.dataset.zname).name = t.value.trim() || 'Storage'; }, 'zone');
    if (t.dataset.zkind) update(s => { s.zones.find(z => z.id === t.dataset.zkind).kind = t.value; }, 'zone');
    if (t.dataset.sname) { const [zid, sid] = t.dataset.sname.split('|'); update(s => { s.zones.find(z => z.id === zid).sections.find(x => x.id === sid).name = t.value.trim() || 'Shelf'; }, 'zone'); }
    if (t.dataset.hap !== undefined) update(s => { s.settings.haptics = t.checked; });
    if (t.dataset.staple !== undefined) { const f = searchFoods(t.value, 1)[0]; if (f) update(s => { if (!s.settings.stapleIds.includes(f.id)) s.settings.stapleIds.push(f.id); }); t.value = ''; }
    if (t.dataset.import !== undefined && t.files[0]) importData(t.files[0]);
  };
  const st = $('[data-staple]', root);
  st.oninput = () => { $('#staple-dl', root).innerHTML = searchFoods(st.value, 6).map(f => `<option value="${attr(f.name)}">`).join(''); };
}

function exportData() {
  const name = `shelfandstock-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (window.LarderNative?.saveFile) { if (!window.LarderNative.saveFile(name, JSON.stringify(state, null, 1))) toast('Couldn’t save the backup', { icon: '⚠️' }); return; }
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `shelfandstock-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup saved', { icon: '💾' });
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.items) || !Array.isArray(data.zones)) throw new Error('Not a Shelf & Stock backup');
    if (!await confirmBox(`Restore ${data.items.length} items from this backup? Your current kitchen will be replaced.`, { ok: 'Restore' })) return;
    replaceState(data); toast('Backup restored', { icon: '✅' }); actions.go('kitchen');
  } catch (e) { toast('That file isn’t a Shelf & Stock backup', { icon: '⚠️' }); }
}
