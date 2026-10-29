// Read text from photos (Tesseract.js — free, runs on the phone): printed dates on packages and
// grocery receipts.

import { matchFood } from '../data/foods.js';
import { iso } from '../data/holidays.js';

const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
let worker;
async function getWorker(onStatus) {
  if (worker) return worker;
  onStatus?.('Getting the text reader ready (first time takes a few seconds)…');
  if (!window.Tesseract) await load('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  worker = await window.Tesseract.createWorker('eng');
  return worker;
}

// Scale and boost contrast so small print reads better.
async function prep(file, maxW = 1800) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const s = Math.min(2.5, maxW / img.width);
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const g = c.getContext('2d'); g.filter = 'grayscale(1) contrast(1.4)'; g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 4000); }
}

export async function readText(file, onStatus) {
  const w = await getWorker(onStatus);
  onStatus?.('Reading…');
  const { data } = await w.recognize(await prep(file));
  return data.text || '';
}

// ---------- dates ----------
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const TYPES = [[/best\s*(if\s*used\s*)?(by|before)|\bbb\b|\bbbe\b/i, 'Best by'], [/use\s*by|\bexp(ires|iry)?\b|\bex\b/i, 'Use by'], [/sell\s*by/i, 'Sell by'], [/freeze\s*by/i, 'Freeze by']];
const yr = y => { y = Number(y); return y < 100 ? 2000 + y : y; };
const endOfMonth = (y, m) => new Date(y, m, 0).getDate();

export function parseDates(text) {
  const out = [];
  const add = (y, m, d, idx, how) => {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100)) return;
    const dt = new Date(y, m - 1, d);
    if (dt.getMonth() !== m - 1) return;
    const before = text.slice(Math.max(0, idx - 24), idx);
    const type = (TYPES.find(([re]) => re.test(before)) || [, null])[1];
    out.push({ date: iso(dt), type, how, score: (type ? 2 : 0) + (dt > new Date(Date.now() - 864e5 * 30) ? 1 : 0) });
  };
  const t = text.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0').replace(/(?<=\d)[Il|](?=\d)/g, '1');
  for (const m of t.matchAll(/\b(20\d\d)[-./](\d{1,2})[-./](\d{1,2})\b/g)) add(+m[1], +m[2], +m[3], m.index, 'ymd');
  for (const m of t.matchAll(/\b(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})\b/g)) add(yr(m[3]), +m[1], +m[2], m.index, 'mdy');
  for (const m of t.matchAll(/\b([A-Za-z]{3,4})\.?\s*(\d{1,2})[,\s]+(\d{2,4})\b/g)) { const mo = MONTHS[m[1].toLowerCase()]; if (mo) add(yr(m[3]), mo, +m[2], m.index, 'mon-d-y'); }
  for (const m of t.matchAll(/\b(\d{1,2})\s*([A-Za-z]{3,4})\.?\s*(\d{2,4})\b/g)) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) add(yr(m[3]), mo, +m[1], m.index, 'd-mon-y'); }
  for (const m of t.matchAll(/\b([A-Za-z]{3,4})\.?\s*(20\d\d)\b/g)) { const mo = MONTHS[m[1].toLowerCase()]; if (mo) add(+m[2], mo, endOfMonth(+m[2], mo), m.index, 'mon-y'); }
  for (const m of t.matchAll(/\b(\d{1,2})[/-](\d{2})\b(?![/-]\d)/g)) { const mo = +m[1], y = yr(m[2]); if (mo <= 12 && /exp|best|use|bb/i.test(t.slice(Math.max(0, m.index - 16), m.index))) add(y, mo, endOfMonth(y, mo), m.index, 'm-y'); }
  const seen = new Set(), oldest = iso(new Date(Date.now() - 365 * 864e5));
  return out.filter(x => x.date >= oldest).sort((a, b) => b.score - a.score).filter(x => !seen.has(x.date) && seen.add(x.date));
}

// ---------- receipts ----------
const NOT_ITEMS = /(sub\s*total|total|tax|change|cash|visa|master|debit|credit|balance|saving|you saved|discount|coupon|bottle dep|items?\s*sold|tend|auth|approval|ref\s*#|thank|member|points|rewards|card|account|store\s*#|cashier|register|pay)/i;
const ABBR = {
  mlk: 'milk', whl: 'whole', wh: 'whole', bnls: 'boneless', chkn: 'chicken', chk: 'chicken', brst: 'breast', grnd: 'ground', gr: 'ground', bf: 'beef',
  bnna: 'bananas', ban: 'bananas', bnn: 'bananas', chs: 'cheese', ched: 'cheddar', shrd: 'shredded', ygrt: 'yogurt', yog: 'yogurt', brd: 'bread', wht: 'white',
  pb: 'peanut butter', oj: 'orange juice', ppr: 'paper', twl: 'towels', twls: 'towels', fd: 'food', trt: 'treats', trts: 'treats', crl: 'cereal', tom: 'tomatoes',
  pot: 'potatoes', pots: 'potatoes', onion: 'onions', strwb: 'strawberries', strw: 'strawberries', blbry: 'blueberries', lett: 'lettuce', rom: 'romaine',
  btr: 'butter', crm: 'cream', sr: 'sour', ice: 'ice', icecrm: 'ice cream', pza: 'pizza', frz: 'frozen', veg: 'vegetables', spag: 'spaghetti', sce: 'sauce',
  ktchp: 'ketchup', mayo: 'mayonnaise', mstd: 'mustard', cof: 'coffee', grd: 'ground', egg: 'eggs', lg: 'large', dz: 'dozen', aplj: 'apple juice', soda: 'soda',
};
const BRANDS = /\b(gv|great value|hnfd|hannaford|ks|kirkland|mkt|mkt pntry|market pantry|shaws?|wmt|walmart|sig|signature|nature'?s promise|cv|food club|essential everyday|ee)\b/gi;

export function cleanReceiptName(raw) {
  return raw.toLowerCase().replace(BRANDS, ' ').replace(/\b\d{4,}\b/g, ' ').replace(/[^a-z\s&]/g, ' ').split(/\s+/).filter(Boolean)
    .map(w => ABBR[w] || w).join(' ').replace(/\s+/g, ' ').trim();
}

export function parseReceipt(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  let total = null;
  for (const l of lines) {
    const m = l.match(/^(.*?[A-Za-z].*?)\s+\$?\s?(-?\d{1,4}[.,]\d{2})\s*-?\s*[A-Z]{0,2}\s*$/);
    if (!m) continue;
    const price = Number(m[2].replace(',', '.'));
    if (/^\s*(grand\s*)?total|amount\s*due|balance\s*due/i.test(m[1]) && !/sub/i.test(m[1])) { total = price; continue; }
    if (NOT_ITEMS.test(m[1]) || price <= 0) continue;
    const name = cleanReceiptName(m[1]);
    if (name.length < 2) continue;
    const food = matchFood(name);
    items.push({ raw: m[1].trim(), name: food?.name || name.replace(/\b\w/g, c => c.toUpperCase()), food, price });
  }
  const head = lines.slice(0, 6).join(' ');
  return { items, total, head };
}
