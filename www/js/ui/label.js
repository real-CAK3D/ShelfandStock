// Renders Open Food Facts data as an FDA-style "Nutrition Facts" panel plus grades/allergens.
import { esc } from './dom.js';

const DV = { fat: 78, satFat: 20, chol: 300, sodium: 2300, carbs: 275, fiber: 28 };
const pct = (v, k) => v == null ? '' : `<b>${Math.round((v / DV[k]) * 100)}%</b>`;
const g = (v, u = 'g') => v == null ? '—' : `${v}${u}`;

export function nutritionLabel(off) {
  if (!off?.nutrition) return '';
  const n = off.nutrition;
  if ([n.kcal, n.fat, n.carbs, n.protein].every(v => v == null)) return '<p class="muted small">No nutrition data on file for this product.</p>';
  return `<div class="nf">
    <h3>Nutrition Facts</h3>
    <div class="r" style="border:0"><b>Serving size</b><b>${esc(n.per)}</b></div>
    <div class="bar10"></div>
    <div class="small"><b>Amount per serving</b></div>
    <div class="cal"><span>Calories</span><span>${n.kcal ?? '—'}</span></div>
    <div class="bar5"></div>
    <div class="r" style="justify-content:flex-end;font-size:11px"><b>% Daily Value*</b></div>
    <div class="r"><span><b>Total Fat</b> ${g(n.fat)}</span>${pct(n.fat, 'fat')}</div>
    <div class="r ind"><span>Saturated Fat ${g(n.satFat)}</span>${pct(n.satFat, 'satFat')}</div>
    <div class="r ind"><span><i>Trans</i> Fat ${g(n.transFat)}</span><span></span></div>
    <div class="r"><span><b>Cholesterol</b> ${g(n.chol, 'mg')}</span>${pct(n.chol, 'chol')}</div>
    <div class="r"><span><b>Sodium</b> ${g(n.sodium, 'mg')}</span>${pct(n.sodium, 'sodium')}</div>
    <div class="r"><span><b>Total Carbohydrate</b> ${g(n.carbs)}</span>${pct(n.carbs, 'carbs')}</div>
    <div class="r ind"><span>Dietary Fiber ${g(n.fiber)}</span>${pct(n.fiber, 'fiber')}</div>
    <div class="r ind"><span>Total Sugars ${g(n.sugars)}</span><span></span></div>
    <div class="r"><span><b>Protein</b> ${g(n.protein)}</span><span></span></div>
    <div class="bar10"></div>
    <div class="fine">* Percent Daily Values are based on a 2,000 calorie diet. Data: Open Food Facts${n.per === '100 g' ? ', per 100 g' : ''}.</div>
  </div>`;
}

export function productBadges(off) {
  if (!off) return '';
  const nova = { 1: 'Unprocessed', 2: 'Culinary ingredient', 3: 'Processed', 4: 'Ultra-processed' };
  return `<div class="row wrap" style="margin:8px 0">
    ${off.nutriscore ? `<div class="row" style="gap:6px"><span class="grade ${off.nutriscore}">${off.nutriscore}</span><small class="muted">Nutri-Score</small></div>` : ''}
    ${off.nova ? `<span class="pill">NOVA ${off.nova} · ${nova[off.nova]}</span>` : ''}
    ${(off.labels || []).map(l => `<span class="pill ok">${esc(l)}</span>`).join('')}
  </div>
  ${off.allergens?.length ? `<div class="where-banner">⚠️ <span>Contains: <b>${esc(off.allergens.join(', '))}</b></span></div>` : ''}
  ${off.ingredients ? `<details style="margin:8px 0"><summary class="small" style="font-weight:600;cursor:pointer">Ingredients</summary><p class="small muted">${esc(off.ingredients)}</p></details>` : ''}`;
}
