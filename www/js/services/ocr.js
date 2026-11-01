// Read text from photos: printed dates on packages, grocery receipts and recipe cards.
// In the Android app this uses Google ML Kit (on the phone, offline, very accurate); in a browser it
// falls back to Tesseract.js (free, runs on the phone too, less accurate on crumpled receipts).

import { matchFood, FOODS } from '../data/foods.js';
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

// Draw the photo at a readable size. For Tesseract receipts, also turn it into crisp black-on-white
// (adaptive threshold: each pixel against the brightness around it, so shadows and creases drop out).
const RECEIPT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,@/$%&-#'* ";

async function prep(file, { maxW = 2000, maxScale = 2.5, binarize = false, contrast = false } = {}) {
  const img = await decode(file);
  {
    const s = Math.min(maxScale, maxW / img.width);
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const g = c.getContext('2d', { willReadFrequently: binarize });
    g.filter = binarize ? 'grayscale(1)' : contrast ? 'grayscale(1) contrast(1.3)' : 'none'; g.drawImage(img, 0, 0, c.width, c.height);
    if (binarize) threshold(g, c.width, c.height);
    return c;
  }
}

// createImageBitmap turns the photo upright from its camera rotation and keeps working if the app
// goes to the background mid-read (Image.decode() can stall there); older browsers fall back to <img>.
async function decode(file) {
  if (window.createImageBitmap) try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { }
  const url = URL.createObjectURL(file);
  const img = new Image(); img.src = url;
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return img;
}

function threshold(g, w, h) {
  const im = g.getImageData(0, 0, w, h), d = im.data, n = w * h;
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) gray[i] = d[i * 4];
  // integral image for fast local means
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) { let row = 0; for (let x = 1; x <= w; x++) { row += gray[(y - 1) * w + x - 1]; sum[y * (w + 1) + x] = sum[(y - 1) * (w + 1) + x] + row; } }
  const r = Math.max(8, Math.round(Math.min(w, h) / 40));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    const area = (x1 - x0) * (y1 - y0);
    const mean = (sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0]) / area;
    const v = gray[y * w + x] < mean * 0.86 ? 0 : 255, i = (y * w + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(im, 0, 0);
}

// ---------- the phone's own reader (Android app) ----------
let nid = 0;
const waiting = new Map();
window.__nativeOcrDone = (id, ok, b64) => {
  const done = waiting.get(id); if (!done) return;
  waiting.delete(id);
  try { done(ok ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)))) : null); } catch { done(null); }
};
async function nativeLines(file) {
  const c = await prep(file, { maxW: 2200 });
  const b64 = c.toDataURL('image/jpeg', 0.92).split(',')[1];
  return new Promise(res => {
    const id = ++nid; waiting.set(id, res);
    try { window.LarderNative.recognizeText(id, b64); } catch { waiting.delete(id); res(null); }
    setTimeout(() => { if (waiting.delete(id)) res(null); }, 30000);
  });
}

// ML Kit returns text lines as separate boxes: on a receipt the item name and its price are often two
// boxes on the same row. Straighten out any tilt, then group boxes whose middles sit on the same row.
export function rowsFromBoxes(lines) {
  if (!lines?.length) return [];
  const angles = lines.map(l => Math.atan2(l.y1 - l.y0, l.x1 - l.x0)).sort((a, b) => a - b);
  const a = -angles[Math.floor(angles.length / 2)], cos = Math.cos(a), sin = Math.sin(a);
  const rot = (x, y) => [x * cos - y * sin, x * sin + y * cos];
  const boxes = lines.map(l => {
    const [x0, y0] = rot(l.x0, l.y0), [, y3] = rot(l.x3, l.y3);
    return { t: l.t, x: x0, cy: (y0 + y3) / 2, h: Math.max(4, Math.abs(y3 - y0)) };
  }).sort((p, q) => p.cy - q.cy);
  const rows = [];
  for (const b of boxes) {
    const row = rows.find(r => Math.abs(r.cy - b.cy) < Math.min(r.h, b.h) * 0.55);
    if (row) { row.items.push(b); row.cy = (row.cy * (row.items.length - 1) + b.cy) / row.items.length; } else rows.push({ cy: b.cy, h: b.h, items: [b] });
  }
  return rows.sort((p, q) => p.cy - q.cy).map(r => r.items.sort((p, q) => p.x - q.x).map(b => b.t).join('   '));
}

// mode: 'receipt' (rows, prices), 'recipe' (paragraphs), or 'text' (package dates)
export async function readText(file, onStatus, { mode = 'text' } = {}) {
  if (window.LarderNative?.recognizeText) {
    onStatus?.('Reading with the phone’s text reader…');
    const lines = await nativeLines(file);
    if (lines?.length) return rowsFromBoxes(lines).join('\n');
  }
  const w = await getWorker(onStatus);
  onStatus?.('Reading…');
  // Receipts: read each line straight across (so the price column isn't dropped), only the characters
  // receipts use (a colon can't sneak into a price), at a size where small print is ~40px tall.
  const receipt = mode === 'receipt';
  await w.setParameters({ tessedit_pageseg_mode: receipt ? '6' : '3', preserve_interword_spaces: '1', tessedit_char_whitelist: receipt ? RECEIPT_CHARS : '' });
  const { data } = await w.recognize(await prep(file, { maxW: receipt ? 2600 : 2000, maxScale: receipt ? 3 : 2.5, contrast: receipt }));
  return data.text || '';
}
export const usingPhoneReader = () => !!window.LarderNative?.recognizeText;

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
// whole words only, so "Cashews", "Pork Tenderloin", "Papaya" and "Cardamom" aren't mistaken for payment lines
const NOT_ITEMS = /\b(sub\s*total|total|tax|change|cash|visa|master\s*card|mastercard|amex|discover|debit|credit|balance|items?\s*sold|tend(ered)?|auth|approval|ref\s*#|thank|member|points|rewards|card|account|store\s*#|cashier|register|pay(ment)?|amount due|ebt|snap|wic|tran(saction)?|terminal|aid|tc#|survey|receipt|manager|phone|www|\.com)\b/i;
const SAVINGS = /\b(savings?|you saved|bonus|coupon|disc(ount)?|promo|price cut|sale|mfr|mfg cpn|cpn|instant savings|card savings|rollback|sc)\b/i;
// store shorthand → words the food catalog knows (Walmart, Hannaford, Shaw's, Market Basket, Target, Aldi…)
const ABBR = {
  mlk: 'milk', mk: 'milk', whl: 'whole', wh: 'whole', wm: 'whole', '2pct': '2%', rf: 'reduced fat', ff: 'fat free', sk: 'skim', hg: 'half gallon', gal: 'gallon',
  bnls: 'boneless', bnl: 'boneless', sknls: 'skinless', chkn: 'chicken', chk: 'chicken', ckn: 'chicken', chix: 'chicken', brst: 'breast', bst: 'breast', thgh: 'thighs', thg: 'thighs', drmstk: 'drumsticks', wng: 'wings', wngs: 'wings',
  grnd: 'ground', gr: 'ground', grd: 'ground', bf: 'beef', bef: 'beef', hmbg: 'hamburger', stk: 'steak', prk: 'pork', chp: 'chops', chps: 'chops', bcn: 'bacon', sausg: 'sausage', saus: 'sausage', hm: 'ham', trky: 'turkey', tky: 'turkey', slcd: 'sliced', sl: 'sliced',
  bnna: 'bananas', ban: 'bananas', bnn: 'bananas', bnns: 'bananas', aple: 'apples', apl: 'apples', grp: 'grapes', grps: 'grapes', strwb: 'strawberries', strw: 'strawberries', strwbry: 'strawberries', blbry: 'blueberries', blub: 'blueberries', rasp: 'raspberries', lmn: 'lemons', lme: 'limes', orng: 'oranges', avcd: 'avocados', avo: 'avocados',
  tom: 'tomatoes', toms: 'tomatoes', tmto: 'tomatoes', pot: 'potatoes', pots: 'potatoes', ptto: 'potatoes', russ: 'russet', swt: 'sweet', onion: 'onions', onn: 'onions', yel: 'yellow', grn: 'green', lett: 'lettuce', rom: 'romaine', icbrg: 'iceberg', spnch: 'spinach', brocc: 'broccoli', broc: 'broccoli', caul: 'cauliflower', crrt: 'carrots', crt: 'carrots', cel: 'celery', cuc: 'cucumbers', pep: 'peppers', ppr: 'peppers', mush: 'mushrooms', mshrm: 'mushrooms', grlc: 'garlic', orgnc: 'organic', org: 'organic',
  chs: 'cheese', ched: 'cheddar', chdr: 'cheddar', mozz: 'mozzarella', moz: 'mozzarella', parm: 'parmesan', amer: 'american', shrd: 'shredded', shr: 'shredded', crm: 'cream', sr: 'sour', crmchs: 'cream cheese', ygrt: 'yogurt', yog: 'yogurt', ygt: 'yogurt', grk: 'greek', btr: 'butter', bttr: 'butter', marg: 'margarine', egg: 'eggs', eggs: 'eggs', lg: 'large', xl: 'extra large', dz: 'dozen', dzn: 'dozen', hlf: 'half', hh: 'half and half', hnh: 'half and half',
  brd: 'bread', wht: 'white', wht_brd: 'white bread', bgl: 'bagels', bgls: 'bagels', tort: 'tortillas', trtla: 'tortillas', bns: 'buns', hb: 'hamburger', hd: 'hot dog', engl: 'english', mffn: 'muffins',
  pb: 'peanut butter', pnt: 'peanut', btr2: 'butter', oj: 'orange juice', aplj: 'apple juice', jce: 'juice', jc: 'juice', cof: 'coffee', cfe: 'coffee', grd2: 'ground', kcup: 'k cups', tea: 'tea', sda: 'soda', soda: 'soda', wtr: 'water', spk: 'sparkling', pk: 'pack', pck: 'pack',
  crl: 'cereal', cer: 'cereal', oat: 'oats', oatml: 'oatmeal', spag: 'spaghetti', spgt: 'spaghetti', pst: 'pasta', mac: 'macaroni', rce: 'rice', rc: 'rice', flr: 'flour', ap: 'all purpose', sgr: 'sugar', brn: 'brown', bkg: 'baking', sd: 'soda', pwdr: 'powder', van: 'vanilla', ext: 'extract', choc: 'chocolate', chips: 'chips', chp2: 'chips',
  sce: 'sauce', sc2: 'sauce', ktchp: 'ketchup', ktch: 'ketchup', mayo: 'mayonnaise', myo: 'mayonnaise', mstd: 'mustard', mstrd: 'mustard', rnch: 'ranch', drsg: 'dressing', dres: 'dressing', bbq: 'bbq sauce', soy: 'soy sauce', slsa: 'salsa', pkl: 'pickles', pkls: 'pickles', jly: 'jelly', jam: 'jam', hny: 'honey', syr: 'syrup', vin: 'vinegar', oil: 'oil', veg: 'vegetable', evoo: 'olive oil', olv: 'olive',
  bns2: 'beans', blk: 'black', kdny: 'kidney', tna: 'tuna', sp: 'soup', soup: 'soup', brth: 'broth', stck: 'stock', dcd: 'diced', crshd: 'crushed', pste: 'paste', cn: 'can', cnd: 'canned',
  ice: 'ice', icecrm: 'ice cream', icrm: 'ice cream', frz: 'frozen', fz: 'frozen', pza: 'pizza', piz: 'pizza', wfl: 'waffles', wffl: 'waffles', fry: 'fries', frs: 'fries', veggie: 'vegetables', vegs: 'vegetables', nug: 'nuggets', nugg: 'nuggets',
  ppr2: 'paper', twl: 'towels', twls: 'towels', ptwl: 'paper towels', tp: 'toilet paper', bth: 'bath', tis: 'tissue', dsh: 'dish', dtrg: 'detergent', det: 'detergent', ldy: 'laundry', lndry: 'laundry', sftnr: 'softener', blch: 'bleach', trsh: 'trash', bgs: 'bags', fl: 'foil', alum: 'aluminum', wrp: 'wrap', zip: 'zip bags', ziploc: 'zip bags', spng: 'sponges', dog: 'dog', dg: 'dog', fd: 'food', trt: 'treats', trts: 'treats', bisc: 'biscuits',
  chps: 'chips', crkr: 'crackers', crkrs: 'crackers', ckie: 'cookies', cki: 'cookies', ckies: 'cookies', pptc: 'popcorn', pcrn: 'popcorn', grnla: 'granola', bar: 'bars', brs: 'bars', frt: 'fruit', snk: 'snacks', gummy: 'gummies',
};
// store brands and label noise to drop before matching
const BRANDS = /\b(gv|great value|hnfd|hannaford|ks|kirkland|mkt|mkt pntry|market pantry|good ?& ?gather|shaws?|wmt|walmart|sig|signature( select)?|nature'?s promise|cv|food club|essential everyday|ee|mm|members mark|simply nature|millville|friendly farms|happy farms|clancy'?s|aldi|smpl|best yr|taste of inspirations|ahold|stop ?& ?shop|price chopper|psr|market basket|mb|wf|365|whole foods|trader joe'?s|tj|kroger|krg|private selection|hy-?vee)\b/gi;

// Fix the usual OCR slips inside a price: O→0, I/l→1, S→5, B→8, a colon or space for the dot.
const fixPrice = l => l.replace(/([0-9OoIlSB]{1,4})\s?[.,:;]\s?([0-9OoIlSB]{2})(\s*-?\s*[A-Z]{0,2}\s*)$/, (m, a, b, rest) => /\d/.test(a + b) ? `${a.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/S/g, '5').replace(/B/g, '8')}.${b.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/S/g, '5').replace(/B/g, '8')}${rest}` : m);

// a pack size misread as letters: "SLB" → "5LB", "lOZ" → "1OZ", "OCT" stays (it's a word)
const fixSizes = l => l.replace(/\b([SsIlO]{1,2})(LB|LBS|OZ|CT|PK)\b/g, (m, d, u) => d === 'O' && u === 'CT' ? m : d.replace(/[Ss]/g, '5').replace(/[Il]/g, '1').replace(/O/g, '0') + u);

export function cleanReceiptName(raw) {
  return raw.toLowerCase().replace(BRANDS, ' ').replace(/\b\d{4,}\b/g, ' ').replace(/\b\d+(\.\d+)?\s?(oz|ct|pk|lb|lbs|gal|qt|pt|fl|ml|l)\b/g, ' ').replace(/[^a-z%\s&]/g, ' ').split(/\s+/).filter(Boolean)
    .map(w => ABBR[w] || w).join(' ').replace(/\s+/g, ' ').trim();
}

// ---------- matching names to foods, typo-tolerant ----------
const lev = (a, b) => {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const near = (w, c) => w === c || w === c + 's' || c === w + 's' || w === c + 'es' || (w.length >= 4 && c.startsWith(w)) || (c.length >= 5 && lev(w, c) <= (c.length >= 8 ? 2 : 1));
// a catalog food for a cleaned receipt/recipe name, and how sure we are ('high' or 'check')
export function matchName(name) {
  const exact = matchFood(name);
  if (exact) return { food: exact, sure: 'high' };
  const words = name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return { food: null, sure: null };
  let best = null, bestLen = 0;
  for (const f of FOODS) for (const cand of [f.name, ...f.aliases]) {
    const cw = cand.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    if (!cw.length || !cw.every(c => words.some(w => near(w, c)))) continue;
    const len = cw.join('').length;
    if (len > bestLen) { bestLen = len; best = f; }
  }
  return best && bestLen >= 4 ? { food: best, sure: 'check' } : { food: null, sure: null };
}

export function parseReceipt(text) {
  const lines = text.split(/\n/).map(l => fixPrice(fixSizes(l.replace(/\s+/g, ' ').replace(/\b1b(s?)\b/g, 'lb$1').trim()))).filter(Boolean);
  const items = [];
  let total = null, last = null, pendingQty = null, nameOnly = null, voidNext = false;
  const num = s => Number(String(s).replace(',', '.'));
  for (const l of lines) {
    // "2 @ 1.29", "2 @ 2/3.00", "QTY 2 @ $1.29   2.58": how many of the item next to it
    const q = l.match(/^(?:qty\.?\s*)?(\d{1,3})\s*@\s*(?:(\d)\s*\/\s*)?\$?\s*(\d{1,4}[.,]\d{2})(?:.*?(\d{1,4}[.,]\d{2}))?/i);
    // "2.38 lb @ 0.52 /lb", "1.25 LB @ $3.99/LB"
    const wt = !q && l.match(/(\d{1,3}[.,]\d{1,3})\s*(lb|lbs|kg|oz)\b[^@]*@[^\d$]*(?:1\s*(?:lb|kg)\s*\/\s*)?\$?\s*(\d{1,4}[.,]\d{2})/i);
    const rate = !q && !wt && l.match(/@[^\d$]*(?:1\s*(lb|kg)\s*\/\s*)?\$?\s*(\d{1,4}[.,]\d{2})\s*(?:\/\s*(lb|lbs|kg))?/i);
    if (rate && (rate[1] || rate[3]) && last && !last.qtySet) {
      const per = num(rate[2]);
      if (per > 0) { last.qty = Math.round(last.price / per * 100) / 100; last.unit = (rate[1] || rate[3]).toLowerCase().replace('lbs', 'lb'); last.qtySet = true; last.weighed = true; }
      continue;
    }
    if (q || wt) {
      const n = q ? Number(q[1]) : num(wt[1]), unit = q ? null : wt[2].toLowerCase().replace('lbs', 'lb');
      const each = q ? num(q[3]) / (q[2] ? Number(q[2]) : 1) : num(wt[3]), ext = Math.round(n * each * 100) / 100;
      const lineTotal = q?.[4] ? num(q[4]) : null;
      if (last && !last.qtySet && Math.abs(last.price - ext) < 0.03) { last.qty = n; last.qtySet = true; if (unit) { last.unit = unit; last.weighed = true; } }
      else if (nameOnly && lineTotal) { last = pushItem(items, nameOnly, lineTotal || ext); if (last) { last.qty = n; last.qtySet = true; if (unit) { last.unit = unit; last.weighed = true; } } nameOnly = null; }
      else if (last && !last.qtySet && oneDigitOff(last.price, ext)) { last.qty = n; last.qtySet = true; if (unit) { last.unit = unit; last.weighed = true; } last.price = ext; last.sure = 'check'; last.fixed = true; }
      else pendingQty = { n, unit, ext };
      continue;
    }
    const m = l.match(/^(.*?[A-Za-z].*?)\s+(-)?\$?\s?(\d{1,4}[.,]\d{2})\s*(-)?\s*[A-Z]{0,2}\s*$/);
    if (!m) {
      if (/^\s*void\s*$/i.test(l)) { voidNext = true; continue; } // the next line is the item being taken back off
      // a name with its price on the next line ("BANANAS" then "2 @ 0.25 0.50")
      if (/[A-Za-z]{3}/.test(l) && !NOT_ITEMS.test(l) && !SAVINGS.test(l) && l.length < 40) nameOnly = l; else nameOnly = null;
      continue;
    }
    nameOnly = null;
    const label = m[1], neg = !!(m[2] || m[4]);
    const price = num(m[3]);
    if (/^\s*(grand\s*)?total\b|amount\s*due|balance\s*due/i.test(label) && !/sub|sav|tax|disc|items?|coupon|you saved/i.test(label)) { if (total == null || price > total) total = price; continue; }
    if (/^\s*void\b/i.test(label) || voidNext) {
      // "VOID COFFEE 9.99-" or a lone VOID line before the item: take that item back off
      const nm = label.replace(/^\s*void\b/i, '').trim().toLowerCase(), hit = [...items].reverse().find(it => !nm || it.raw.toLowerCase() === nm || it.raw.toLowerCase().includes(nm));
      if (hit) items.splice(items.indexOf(hit), 1);
      voidNext = false; last = null; continue;
    }
    // coupons and savings come off the item above them
    if (neg || SAVINGS.test(label)) { if (last && !/total|tax|tend|change/i.test(label) && price < last.price) last.discount = Math.round(((last.discount || 0) + price) * 100) / 100; continue; }
    if (NOT_ITEMS.test(label) || price <= 0) continue;
    last = pushItem(items, label, price);
    if (last && pendingQty) {
      last.qty = pendingQty.n; last.qtySet = true; if (pendingQty.unit) { last.unit = pendingQty.unit; last.weighed = true; }
      if (pendingQty.ext && Math.abs(last.price - pendingQty.ext) >= 0.03 && oneDigitOff(last.price, pendingQty.ext)) { last.price = pendingQty.ext; last.sure = 'check'; last.fixed = true; }
      pendingQty = null;
    }
  }
  for (const it of items) { it.paid = Math.round((it.price - (it.discount || 0)) * 100) / 100; if (!it.qtySet) packSize(it); else if (!it.weighed && ['oz', 'lb', 'g', 'kg'].includes(it.unit)) it.unit = 'pack'; delete it.qtySet; delete it.weighed; }
  const head = lines.slice(0, 6).join(' ');
  return { items: items.filter(Boolean), total, head };
}

// "RUSSET POTATOES 5LB" → 5 lb; "EGGS 18 CT" → 1.5 dozen; a bag of shredded cheese with no size → 1 pack, not "1 oz"
function packSize(it) {
  const m = it.raw.match(/\b(\d+(?:\.\d+)?)\s?(lb|lbs|oz|gal|ct|pk|dz)\b/i);
  const size = m ? Number(m[1]) : null, u = m ? m[2].toLowerCase().replace('lbs', 'lb') : null;
  const want = it.food?.unit;
  if (size && u === want) it.qty = Math.round(size * it.qty * 100) / 100;
  else if (size && u === 'ct' && want === 'dozen') it.qty = Math.round(size / 12 * it.qty * 100) / 100;
  else if (size && (u === 'ct' || u === 'pk') && want === 'ea') it.qty = size * it.qty;
  else if (['oz', 'lb', 'g', 'kg'].includes(want) && it.unit === want) it.unit = 'pack';
}

// 2.98 vs 2.58: same length, one digit different, so one of them was misread
const oneDigitOff = (a, b) => { const x = a.toFixed(2), y = b.toFixed(2); return x.length === y.length && [...x].filter((ch, i) => ch !== y[i]).length === 1; };

function pushItem(items, label, price) {
  const name = cleanReceiptName(label);
  if (name.replace(/[^a-z]/g, '').length < 2) return null;
  const { food, sure } = matchName(name);
  const it = { raw: label.trim(), name: food?.name || name.replace(/\b\w/g, c => c.toUpperCase()), food, sure, price, qty: 1, unit: food?.unit || 'ea' };
  items.push(it);
  return it;
}

// ---------- recipe cards and cookbook pages ----------
const VULGAR = { '¼': ' 1/4', '½': ' 1/2', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' };
const QTY_START = /^\s*([-•*·▪●o]\s*)?(\d+\s+\d\/\d|\d+\/\d|\d*[.,]?\d+|one|two|three|four|a|an|half|pinch|dash)\b/i;
const UNIT_WORD = /\b(cups?|c\.|tbsps?|tablespoons?|tsps?|teaspoons?|t\.|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|cans?|cloves?|slices?|sticks?|pinch|dash|packages?|pkgs?|bunch(es)?|heads?|stalks?|pints?|quarts?|gallons?|jars?|bottles?|boxes?|bags?|large|medium|small)\b/i;
const STEP_START = /^\s*(\d{1,2}[.)]|step\s*\d+|[a-z]+ the |preheat|in a |heat |mix |stir |combine |add |bake |cook |place |pour |whisk |bring |season |serve |remove |cover |let |cut |chop |slice )/i;

// "Serves 6", "Prep 20 min", "Cook time: 2 hours", "Makes 12": details, not steps
const META = /^(serves|servings?|yield|makes|prep(\s*time)?|cook(\s*time)?|total(\s*time)?|ready in)\b\s*[:\d-]/i;

// Split OCR text from a recipe photo into title, servings, time, ingredient lines and steps.
export function parseRecipeText(text) {
  const raw = text.replace(/[¼½¾⅓⅔⅛]/g, c => VULGAR[c]).split(/\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = { title: '', servings: null, time: null, ingredients: [], steps: [] };
  const all = raw.join(' ');
  const sv = all.match(/\b(?:serves|servings?|yield|makes)\s*:?\s*(\d{1,2})/i); if (sv) out.servings = Number(sv[1]);
  const hr = all.match(/(\d+)\s*(?:hours?|hrs?)\b/i), mn = all.match(/(\d+)\s*(?:minutes?|mins?)\b/i);
  if (hr || mn) out.time = (hr ? Number(hr[1]) * 60 : 0) + (mn ? Number(mn[1]) : 0);
  const iIng = raw.findIndex(l => /^ingredients?\b/i.test(l)), iDir = raw.findIndex(l => /^(directions|instructions|method|preparation|steps|how to make)\b/i.test(l));
  out.title = (raw.find((l, i) => (iIng < 0 || i < iIng) && /[a-z]{3}/i.test(l) && !/^ingredients?\b/i.test(l) && !META.test(l) && l.length < 60) || 'Recipe from a photo').replace(/[^\w\s'&,-]/g, '').trim();
  const isIng = l => l.length < 70 && (QTY_START.test(l) || (UNIT_WORD.test(l) && l.split(' ').length <= 7) || /^\s*[-•*·▪●]\s*/.test(l)) && !STEP_START.test(l.replace(QTY_START, ''));
  let steps = [];
  raw.forEach((l, i) => {
    if (i === iIng || i === iDir || l === out.title || META.test(l)) return;
    const inIngSection = iIng >= 0 && i > iIng && (iDir < 0 || i < iDir), inDirSection = iDir >= 0 && i > iDir;
    if (inDirSection) return steps.push(l);
    if (inIngSection || (iIng < 0 && isIng(l))) return out.ingredients.push(l.replace(/^\s*[-•*·▪●]\s*/, ''));
    if (iIng < 0 || i > iIng) steps.push(l);
  });
  // wrapped step lines belong to the step before them unless they start a new one
  for (const l of steps) { if (out.steps.length && !/^\s*(\d{1,2}[.)]|step\s*\d+)/i.test(l) && /^[a-z(]/.test(l)) out.steps[out.steps.length - 1] += ' ' + l; else out.steps.push(l.replace(/^\s*(\d{1,2}[.)]|step\s*\d+[:.]?)\s*/i, '')); }
  return out;
}
