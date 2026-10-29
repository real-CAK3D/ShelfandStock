// Settings: finish, household, storage layout editor, staples, backup/restore, data sources.

import { state, update, replaceState, resetAll, seedSample, uid } from '../store.js';
import { ZONE_KINDS } from '../data/layout.js';
import { FOOD_BY_ID, searchFoods } from '../data/foods.js';
import { esc, attr, icon, $, $$, toast, haptic, confirmBox, openSheet } from '../ui/dom.js';
import { actions } from '../router.js';
import { syncInfo, createHousehold, joinHousehold, leaveHousehold, pull, push } from '../services/sync.js';
import { me, memberById, avatar, addMember, resetPin } from '../services/people.js';
import { SEASONS } from '../ui/seasons.js';
import { getPosition, findNearby, saveStore, removeStore, storeEmoji, miles, sharing, setSharing } from '../services/stores.js';
import { loader } from '../ui/loader.js';
import { reportSheet } from '../ui/report.js';
import { KINDS as NOTIFY_KINDS, notifyPrefs, setNotifyPref, askNotificationPermission } from '../services/notify.js';

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
      <div class="setting"><div class="grow"><b>Icon style</b><small>3D icons look the same on every phone</small></div>
        <div class="seg" style="width:170px"><button data-iconstyle="fluent" class="${(s.icons || 'fluent') === 'fluent' ? 'on' : ''}" style="position:relative;z-index:1">3D 🍎</button><button data-iconstyle="native" class="${s.icons === 'native' ? 'on' : ''}" style="position:relative;z-index:1" data-noemo>Phone 🍎</button></div></div>
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
      <div class="row" style="justify-content:space-between"><h3>Kitchen report</h3><button class="btn btn-ghost btn-sm" data-week>📊 This week</button></div>
      <div class="kv"><div><small>Items tracked</small><b>${state.items.length}</b></div><div><small>Meals cooked</small><b>${cooked.length}</b></div><div><small>Tossed (waste)</small><b>${wasted.length}</b></div><div><small>Recipes saved</small><b>${state.recipes.length}</b></div></div>
      ${wasted.length ? `<p class="small muted">Most tossed: ${esc(Object.entries(wasted.reduce((a, h) => (a[h.name] = (a[h.name] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} (${c})`).join(', '))}</p>` : ''}
    </div>

    <div class="card pad" style="margin-bottom:14px">
      <div class="row" style="justify-content:space-between;margin-bottom:6px"><h3>👥 People</h3><button class="btn btn-ghost btn-sm" data-person-add>${icon('plus')} Add</button></div>
      ${(state.members || []).map(m => `<div class="setting">${avatar(m, 40)}<div class="grow"><b>${esc(m.name)}${m.id === me()?.id ? ' <span class="pill ok">you</span>' : ''}</b><small>${m.mustReset ? 'Hasn’t set a PIN yet (0000)' : 'PIN set'}</small></div><button class="btn btn-ghost btn-sm" data-pin-reset="${m.id}">Reset PIN</button>${m.id !== me()?.id ? `<button class="btn btn-ghost btn-sm" data-person-del="${m.id}" aria-label="Remove ${attr(m.name)}">${icon('trash')}</button>` : ''}</div>`).join('')}
      <p class="small muted" style="margin:8px 0 0">Reset sets a PIN back to 0000; they choose a new one next time they sign in.</p>
    </div>

    <div class="card pad" style="margin-bottom:14px">
      <h3 style="margin-bottom:4px">🎉 Holiday themes</h3>
      <p class="small muted" style="margin:0 0 10px">A little seasonal pizazz: colors, drifting decorations and a garland on top. Auto follows the calendar.</p>
      <div class="row wrap" style="gap:6px">${[['auto', '✨ Auto'], ['off', 'Off'], ...Object.entries(SEASONS).map(([k, v]) => [k, `${v.emoji} ${v.name}`])].map(([k, l]) => `<button class="chip ${(s.season || 'auto') === k ? 'on' : ''}" data-season="${k}">${l}</button>`).join('')}</div>
    </div>

    <div class="card pad" style="margin-bottom:14px" data-tour="notify">
      <h3 style="margin-bottom:4px">🔔 Notifications</h3>
      <p class="small muted" style="margin:0 0 6px">${window.LarderNative?.configureNotices ? 'Shows up on this phone even when the app is closed (checks about every 15 minutes). Needs Household sync.' : 'Notifications when the app is closed work in the Android app. Here, things show up live while the app is open.'}</p>
      ${Object.entries(NOTIFY_KINDS).map(([k, l]) => `<div class="setting" style="padding:10px 4px"><div class="grow"><b style="font-weight:600">${l}</b></div><label class="toggle"><input type="checkbox" data-nk="${k}" ${notifyPrefs()[k] ? 'checked' : ''}><i></i></label></div>`).join('')}
      ${window.LarderNative?.requestNotifications ? '<button class="btn btn-ghost btn-sm" data-nperm style="margin-top:8px">Allow notifications on this phone</button>' : ''}
    </div>

    <div class="card pad" style="margin-bottom:14px" data-tour="stores">
      <h3 style="margin-bottom:4px">🛒 Our stores</h3>
      <p class="small muted" style="margin:0 0 10px">Save the stores you use. When someone is at one, the house sees “Poppy is at Hannaford” and their list pops up.</p>
      ${(state.stores || []).map(st => `<div class="setting"><span style="font-size:24px">${st.emoji}</span><div class="grow"><b>${esc(st.name)}</b><small>${esc(st.address || '')}</small></div><button class="btn btn-ghost btn-sm" data-store-del="${st.id}" aria-label="Remove ${attr(st.name)}">${icon('trash')}</button></div>`).join('') || '<p class="muted small">No stores saved yet.</p>'}
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn btn-brass grow" data-store-find>📍 Find stores near me</button><button class="btn btn-ghost" data-store-here>I'm at one</button></div>
      <div data-store-results></div>
      <div class="setting" style="border:0;padding-bottom:0"><div class="grow"><b>Tell the house when I'm at a store</b><small>Checks while the app is open on this phone</small></div><label class="toggle"><input type="checkbox" data-locshare ${sharing() ? 'checked' : ''}><i></i></label></div>
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
      <div class="row" style="gap:8px"><button class="btn btn-ghost grow btn-sm" data-sample>Load sample kitchen</button><button class="btn btn-danger grow btn-sm" data-wipe>Start over</button></div>
      <p class="small muted" style="margin:8px 0 0">Start over empties the kitchen and brings back the welcome screen, where you can pick an empty kitchen. People and PINs stay.</p>
    </div>

    <p class="small muted" style="text-align:center;line-height:1.6">Shelf &amp; Stock 1.3 · Product labels &amp; nutrition from <b>Open Food Facts</b> (ODbL) · Online recipes from <b>TheMealDB</b> · Storage times adapted from <b>USDA FoodKeeper</b> guidance.</p>
  </div>`;

  root.onclick = async e => {
    const w = e.target.closest('.swatch[data-wood]'); /* <html> also carries data-wood */ if (w) { update(s => { s.settings.wood = w.dataset.wood; }, 'wood'); document.documentElement.dataset.wood = w.dataset.wood; haptic(); return; }
    const sdel = e.target.closest('[data-store-del]'); if (sdel) { removeStore(sdel.dataset.storeDel); return; }
    if (e.target.closest('[data-store-find]')) {
      const box = $('[data-store-results]', root);
      box.innerHTML = loader('Finding where you are…', ['📍', '🛒', '🏪']);
      const status = t => { const x = box.querySelector('.loader-text'); if (x) x.textContent = t; };
      try {
        const pos = await getPosition();
        const found = await findNearby(pos, status);
        box.innerHTML = found.length ? `<div class="group-h">Near you<span class="line"></span></div>${found.slice(0, 25).map((f, i) => `<div class="setting"><span style="font-size:22px">${storeEmoji(f.name)}</span><div class="grow"><b>${esc(f.name)}</b><small>${miles(f.dist)} · ${esc(f.address)}</small></div><button class="btn btn-ghost btn-sm" data-store-add="${i}">${icon('plus')}</button></div>`).join('')}` : '<p class="muted small">No stores found nearby.</p>';
        box.querySelectorAll('[data-store-add]').forEach(b => b.onclick = ev => { ev.stopPropagation(); const f = found[Number(b.dataset.storeAdd)]; toast(saveStore(f) ? `${f.name} saved` : 'Already saved', { icon: '🛒' }); });
      } catch (err) { box.innerHTML = `<p class="muted small">⚠️ ${esc(err.message)}</p>`; }
      return;
    }
    if (e.target.closest('[data-store-here]')) {
      openSheet({ title: 'Save the store you’re at', html: `<label class="field"><span>Store name</span><input class="input" data-sname placeholder="e.g. Hannaford"></label><button class="btn btn-brass btn-block" data-sok>📍 Save with my location</button>`,
        onMount: (b, close) => { b.querySelector('[data-sok]').onclick = async () => { const name = b.querySelector('[data-sname]').value.trim(); if (!name) return; try { const pos = await getPosition(); saveStore({ name, lat: pos.lat, lon: pos.lon }); close(); toast(`${name} saved`, { icon: '🛒' }); } catch (err) { toast(err.message, { icon: '⚠️' }); } }; } });
      return;
    }
    const sz = e.target.closest('.chip[data-season]'); /* <html> also carries data-season */ if (sz) { haptic(); return update(st => { st.settings.season = sz.dataset.season; }); }
    if (e.target.closest('[data-person-add]')) {
      openSheet({ title: 'Add someone', html: `<label class="field"><span>Name</span><input class="input" data-pname maxlength="20"></label><p class="small muted" style="margin-top:-6px">Their first PIN is 0000; they pick their own when they first sign in.</p><button class="btn btn-brass btn-block" data-padd>Add</button>`,
        onMount: (b, close) => { setTimeout(() => b.querySelector('[data-pname]').focus(), 200); b.querySelector('[data-padd]').onclick = async () => { const name = b.querySelector('[data-pname]').value.trim(); if (!name) return; await addMember(name); close(); toast(`${name} added — first PIN is 0000`, { icon: '👋' }); }; } });
      return;
    }
    const pr = e.target.closest('[data-pin-reset]');
    if (pr) { const m = memberById(pr.dataset.pinReset); if (await confirmBox(`Reset ${m.name}'s PIN to 0000?`, { ok: 'Reset' })) { await resetPin(m.id); toast(`${m.name} can sign in with 0000 now`, { icon: '🔐' }); } return; }
    const pd = e.target.closest('[data-person-del]');
    if (pd) { const m = memberById(pd.dataset.personDel); if (await confirmBox(`Remove ${m.name}? Their past activity stays.`, { ok: 'Remove', danger: true })) update(st => { st.members = st.members.filter(x => x.id !== m.id); }, 'member'); return; }
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
    if (e.target.closest('[data-week]')) return reportSheet();
    if (e.target.closest('[data-nperm]')) return askNotificationPermission();
    const ics = e.target.closest('[data-iconstyle]'); if (ics) { haptic(); return update(st => { st.settings.icons = ics.dataset.iconstyle; }); }
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
    if (e.target.closest('[data-wipe]')) return startOver();
  };
  root.onchange = e => {
    const t = e.target;
    if (t.dataset.zname) update(s => { s.zones.find(z => z.id === t.dataset.zname).name = t.value.trim() || 'Storage'; }, 'zone');
    if (t.dataset.zkind) update(s => { s.zones.find(z => z.id === t.dataset.zkind).kind = t.value; }, 'zone');
    if (t.dataset.sname) { const [zid, sid] = t.dataset.sname.split('|'); update(s => { s.zones.find(z => z.id === zid).sections.find(x => x.id === sid).name = t.value.trim() || 'Shelf'; }, 'zone'); }
    if (t.dataset.hap !== undefined) update(s => { s.settings.haptics = t.checked; });
    if (t.dataset.nk) setNotifyPref(t.dataset.nk, t.checked);
    if (t.dataset.locshare !== undefined) { setSharing(t.checked); toast(t.checked ? 'The house will see when you’re at a saved store' : 'Store sharing off', { icon: '📍' }); }
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

// Start over. When this phone shares a household, ask whether to clear it for everyone or just break off this phone.
function startOver() {
  const synced = !!syncInfo().code;
  openSheet({
    title: 'Start over?',
    html: `<p style="margin:0 0 14px;color:var(--ink-2)">Every item, list, plan, recipe, store and price is erased, and the welcome screen comes back so you can pick <b>Start with an empty kitchen</b>. People and PINs stay. This can’t be undone; Export a backup first if you might want it.</p>
      ${synced ? `<button class="btn btn-danger btn-block" data-over="house">Start over for the whole house</button>
        <p class="small muted" style="margin:6px 2px 12px">Everyone’s phone gets the empty kitchen on its next sync.</p>
        <button class="btn btn-ghost btn-block" data-over="phone">Just this phone (leave the household)</button>
        <p class="small muted" style="margin:6px 2px 0">The shared kitchen stays as it is for everyone else.</p>`
      : `<button class="btn btn-danger btn-block" data-over="phone">Start over</button>`}`,
    onMount: (b, close) => b.querySelectorAll('[data-over]').forEach(btn => btn.onclick = async () => {
      b.querySelectorAll('button').forEach(x => x.disabled = true);
      if (btn.dataset.over === 'phone') leaveHousehold();
      resetAll();
      if (btn.dataset.over === 'house') { await push(); if (syncInfo().status === 'offline') { toast('Couldn’t reach the cloud; it’ll clear when you’re back online', { icon: '⚠️' }); await new Promise(r => setTimeout(r, 1500)); } }
      close(); location.reload();
    }),
  });
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.items) || !Array.isArray(data.zones)) throw new Error('Not a Shelf & Stock backup');
    if (!await confirmBox(`Restore ${data.items.length} items from this backup? Your current kitchen will be replaced.`, { ok: 'Restore' })) return;
    replaceState(data); toast('Backup restored', { icon: '✅' }); actions.go('kitchen');
  } catch (e) { toast('That file isn’t a Shelf & Stock backup', { icon: '⚠️' }); }
}
