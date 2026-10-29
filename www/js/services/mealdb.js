// TheMealDB — free recipe API (public test key "1"). Results are converted to Larder's
// recipe shape so they can be saved, planned and matched against stock like built-ins.

import { matchFood } from '../data/foods.js';

const BASE = 'https://www.themealdb.com/api/json/v1/1';

async function get(path) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(BASE + path, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.33, '⅔': 0.67 };
const UNIT_WORDS = { cups: 'cup', cup: 'cup', tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', g: 'g', kg: 'kg', ml: 'ml', l: 'L', lb: 'lb', lbs: 'lb', oz: 'oz', can: 'can', cans: 'can', clove: 'clove', cloves: 'clove', pinch: 'pinch', handful: 'handful' };

function parseMeasure(m) {
  m = (m || '').trim().toLowerCase();
  let qty = 1, unit = 'ea';
  const num = m.match(/^(\d+\s+\d\/\d|\d+\/\d|\d*\.?\d+|[½¼¾⅓⅔])\s*([a-z]+)?/);
  if (num) {
    const raw = num[1];
    if (FRACTIONS[raw]) qty = FRACTIONS[raw];
    else if (raw.includes('/')) { const parts = raw.split(/\s+/); qty = parts.reduce((a, p) => { const [x, y] = p.split('/'); return a + (y ? x / y : Number(x)); }, 0); }
    else qty = Number(raw);
    if (num[2]) unit = UNIT_WORDS[num[2]] || num[2];
  } else if (m) { unit = UNIT_WORDS[m.split(' ')[0]] || m; qty = 1; }
  return { qty: Math.round(qty * 100) / 100 || 1, unit };
}

const EMOJI_BY_CAT = { Beef: '🥩', Chicken: '🍗', Dessert: '🍰', Lamb: '🍖', Pasta: '🍝', Pork: '🐖', Seafood: '🦐', Side: '🥗', Starter: '🥟', Vegan: '🥦', Vegetarian: '🥕', Breakfast: '🍳', Goat: '🍖', Miscellaneous: '🍲' };

function convert(m) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m['strIngredient' + i] || '').trim();
    if (!name) continue;
    const { qty, unit } = parseMeasure(m['strMeasure' + i]);
    const food = matchFood(name);
    ingredients.push({ qty, unit, name: food?.name || name, note: m['strMeasure' + i] || '', optional: false, foodId: food?.id || null });
  }
  const steps = (m.strInstructions || '').split(/\r?\n+|(?<=\.)\s+(?=[A-Z])/).map(s => s.replace(/^step\s*\d+[:.]?\s*/i, '').trim()).filter(s => s.length > 3);
  return {
    id: 'mdb-' + m.idMeal, source: 'mealdb', title: m.strMeal, emoji: EMOJI_BY_CAT[m.strCategory] || '🍽️',
    type: m.strCategory === 'Dessert' ? 'Dessert' : m.strCategory === 'Breakfast' ? 'Breakfast' : m.strCategory === 'Side' || m.strCategory === 'Starter' ? 'Side' : 'Dinner',
    cuisine: m.strArea || '', time: null, servings: 4,
    tags: (m.strTags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
    image: m.strMealThumb, video: m.strYoutube || '', url: m.strSource || '', ingredients, steps,
  };
}

export async function searchMeals(q) {
  const j = await get('/search.php?s=' + encodeURIComponent(q));
  return (j.meals || []).map(convert);
}

// Recipes that use a given main ingredient — great for "what can I make with chicken?"
export async function mealsWithIngredient(ing) {
  const j = await get('/filter.php?i=' + encodeURIComponent(ing.replace(/\s+/g, '_')));
  return (j.meals || []).slice(0, 12).map(m => ({ id: 'mdb-' + m.idMeal, idMeal: m.idMeal, title: m.strMeal, image: m.strMealThumb, partial: true }));
}

export async function mealById(idMeal) {
  const j = await get('/lookup.php?i=' + idMeal);
  return j.meals?.[0] ? convert(j.meals[0]) : null;
}

export async function randomMeal() {
  const j = await get('/random.php');
  return j.meals?.[0] ? convert(j.meals[0]) : null;
}
