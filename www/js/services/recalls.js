// Food recall alerts from openFDA (public domain, no key). Pulls ongoing US food recalls from the last
// 90 days, at most twice a day, and flags kitchen items whose barcode or brand + food shows up in one.

import { state } from '../store.js';
import { FOOD_BY_ID } from '../data/foods.js';
import { openSheet, esc } from '../ui/dom.js';

const KEY = 'shelfstock.recalls', TTL = 12 * 3600e3;
let cache = load();
const listeners = new Set();
export const onRecalls = fn => (listeners.add(fn), () => listeners.delete(fn));

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
// UPCs are often printed with spaces or dashes ("0 41190 46861 2"); glue digit runs back together
const codesIn = t => [...new Set((t.replace(/(\d)[\s-](?=\d)/g, '$1').match(/\d{11,14}/g) || []).map(c => c.replace(/^0+/, '')))];

export async function refreshRecalls(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.list;
  const to = new Date(), from = new Date(Date.now() - 90 * 864e5);
  const url = `https://api.fda.gov/food/enforcement.json?search=status:"Ongoing"+AND+report_date:[${ymd(from)}+TO+${ymd(to)}]&sort=report_date:desc&limit=1000`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    cache = { at: Date.now(), list: (j.results || []).map(x => ({
      id: x.recall_number, desc: x.product_description || '', reason: x.reason_for_recall || '', firm: x.recalling_firm || '',
      date: x.report_date, cls: x.classification || '', where: x.distribution_pattern || '', codes: codesIn(`${x.product_description} ${x.code_info || ''}`),
    })) };
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { }
    listeners.forEach(f => f());
  } catch (e) { /* offline: keep whatever we had */ }
  return cache?.list || [];
}

const words = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
const GENERIC = new Set(['great', 'value', 'store', 'brand', 'organic', 'the', 'co', 'inc', 'company', 'foods', 'food', 'farms']);

// Which of our items (and list entries) might be part of a recall. Barcode matches are certain; brand + food are "check the label".
export function recallMatches() {
  if (!cache?.list?.length) return [];
  const things = [...state.items.map(i => ({ ...i, where: 'kitchen' })), ...state.shopping.filter(e => !e.done).map(e => ({ ...e, where: 'list' }))];
  const out = [];
  for (const rc of cache.list) {
    const text = ` ${words(`${rc.desc} ${rc.firm}`).join(' ')} `;
    const hits = [];
    for (const it of things) {
      const code = (it.barcode || '').replace(/^0+/, '');
      if (code.length >= 8 && rc.codes.some(c => c === code || c.startsWith(code) || code.startsWith(c))) { hits.push({ it, sure: true }); continue; }
      const brand = words(it.brand || '').filter(w => w.length > 2 && !GENERIC.has(w));
      if (!brand.length || !brand.every(w => text.includes(` ${w} `))) continue;
      const food = FOOD_BY_ID[it.foodId];
      const names = [it.name, food?.name, ...(food?.aliases || [])].filter(Boolean).flatMap(n => words(n)).filter(w => w.length > 3);
      if (names.some(w => text.includes(` ${w}`))) hits.push({ it, sure: false });
    }
    if (hits.length) out.push({ rc, hits });
  }
  return out;
}

export function recallSheet() {
  const m = recallMatches(), list = cache?.list || [];
  const card = (rc, extra = '') => `<div class="recall ${rc.cls === 'Class I' ? 'c1' : ''}">
      ${extra}<b>${esc(rc.desc.slice(0, 160))}${rc.desc.length > 160 ? '…' : ''}</b>
      <small>${esc(rc.firm)} · ${esc(rc.cls)} · ${rc.date.replace(/(\d{4})(\d\d)(\d\d)/, '$2/$3/$1')}</small>
      <p>${esc(rc.reason.slice(0, 220))}${rc.reason.length > 220 ? '…' : ''}</p></div>`;
  openSheet({
    title: '🛡️ Food recalls',
    html: `${m.length ? `<div class="group-h">Might be in your house<span class="line"></span></div>
        ${m.map(({ rc, hits }) => card(rc, `<div class="recall-hit">${hits.map(h => `${h.sure ? '⚠️ Barcode match' : '🔎 Check the label'}: <b>${esc(h.it.name)}</b>${h.it.brand ? ` (${esc(h.it.brand)})` : ''} · ${h.it.where === 'list' ? 'on your list' : 'in your kitchen'}`).join('<br>')}</div>`)).join('')}
        <p class="small muted">A barcode match means that exact product is recalled. Otherwise the brand and food match, so compare the lot codes and dates on your package with the notice.</p>`
      : `<div class="where-banner">✅ <span>Nothing in your kitchen or on your list matches a current recall${list.length ? '' : ' (couldn’t load recalls; check your connection)'}.</span></div>`}
      ${list.length ? `<div class="group-h">Latest US food recalls<span class="line"></span></div>${list.slice(0, 15).map(rc => card(rc)).join('')}` : ''}
      <p class="small muted" style="margin-top:12px">From the FDA’s public recall reports (openFDA), last 90 days. Not every recall makes it here, and matches are best guesses.</p>`,
  });
}
