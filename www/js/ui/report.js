// "This week" — spending from receipts, what got tossed, what got cooked, and who pitched in.

import { weekReport, money, catOf } from '../store.js';
import { memberById, avatar, firstName } from '../services/people.js';
import { openSheet, esc } from './dom.js';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const delta = (a, b, money_ = false) => {
  if (!b) return '';
  const d = a - b, pct = Math.round((d / b) * 100);
  if (!d) return '<small class="muted">same as last week</small>';
  return `<small style="color:${d > 0 ? 'var(--tomato)' : 'var(--sage)'}">${d > 0 ? '▲' : '▼'} ${money_ ? money(Math.abs(d)) : Math.abs(d)} (${Math.abs(pct)}%) vs last week</small>`;
};

export function weekCardHTML() {
  const w = weekReport();
  return `<button class="week-card card" data-week>
    <span class="wk"><b>${money(w.spent)}</b><small>spent</small></span>
    <span class="wk"><b style="color:${w.tossed ? 'var(--tomato)' : 'var(--sage)'}">${w.tossed}</b><small>tossed${w.tossedValue ? ` · ${money(w.tossedValue)}` : ''}</small></span>
    <span class="wk"><b>${w.cooked}</b><small>meals cooked</small></span>
  </button>`;
}

export function reportSheet() {
  const w = weekReport(), last = weekReport(1);
  const max = Math.max(1, ...w.spentByDay);
  const tips = [];
  if (w.tossed >= 2) tips.push(`You tossed ${w.tossed} things this week${w.tossedValue ? ` (about ${money(w.tossedValue)})` : ''}. Buy smaller packs of ${esc([...new Set(w.tossedItems)].slice(0, 2).join(' and '))}, or freeze them sooner.`);
  if (w.spent && last.spent && w.spent > last.spent * 1.25) tips.push('Spending is up this week. Check “You should get” before adding extras.');
  if (!w.receipts) tips.push('Scan your receipts (List › 🧾 Scan receipt) to track spending and find the cheapest store for each item.');
  if (w.cooked >= 4) tips.push(`Nice: ${w.cooked} home-cooked meals this week! 👩‍🍳`);
  openSheet({
    title: '📊 This week',
    html: `<p class="muted" style="margin-top:0">${new Date(w.start + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${new Date(w.end + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
      <div class="kv">
        <div><small>Spent</small><b>${money(w.spent)}</b>${delta(w.spent, last.spent, true)}</div>
        <div><small>Tossed</small><b>${w.tossed} item${w.tossed === 1 ? '' : 's'}</b>${w.tossedValue ? `<small class="muted">≈ ${money(w.tossedValue)} wasted</small>` : delta(w.tossed, last.tossed)}</div>
        <div><small>Used up</small><b>${w.usedUp}</b></div>
        <div><small>Meals cooked</small><b>${w.cooked}</b>${delta(w.cooked, last.cooked)}</div>
      </div>
      <div class="group-h">Spending by day<span class="line"></span></div>
      <div class="bars">${w.spentByDay.map((v, i) => `<div class="bar"><i style="height:${Math.round((v / max) * 100)}%" title="${money(v)}"></i><span>${DAYS[i]}</span>${v ? `<em>${Math.round(v)}</em>` : ''}</div>`).join('')}</div>
      ${w.tossed ? `<div class="group-h">What got tossed<span class="line"></span></div><p style="margin:0 0 6px">${esc([...new Set(w.tossedItems)].join(', '))}</p><div class="row wrap" style="gap:6px">${Object.entries(w.wasteCats).map(([c, n]) => `<span class="pill expired">${catOf(c).emoji} ${esc(catOf(c).name)} × ${n}</span>`).join('')}</div>` : ''}
      ${Object.keys(w.people).length ? `<div class="group-h">Who pitched in<span class="line"></span></div>${Object.entries(w.people).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<div class="act">${avatar(memberById(id), 28)}<span class="t"><b>${esc(firstName(id))}</b><small>${n} thing${n === 1 ? '' : 's'}: requested, shopped, cooked or used</small></span></div>`).join('')}` : ''}
      ${tips.length ? `<div class="group-h">Tips<span class="line"></span></div>${tips.map(t => `<div class="where-banner" style="background:var(--sky-2);color:var(--sky)">💡 <span>${t}</span></div>`).join('')}` : ''}`,
  });
}
