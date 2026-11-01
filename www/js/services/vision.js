// Snap a photo (or a few: front, barcode, date label) → figure out what it is.
// 1) A barcode in any photo is looked up in the Open Food/Pet Food/Products Facts databases, then UPCitemdb.
// 2) The printing is read for a best-by date, and for the name when no database knows the barcode.
// 3) Otherwise MobileNet (free, runs on the phone via TensorFlow.js) guesses from the picture.

import { FOOD_BY_ID, matchFood } from '../data/foods.js';
import { lookupBarcode } from './off.js';

// ImageNet class (first name before the comma, lowercase) → catalog food id
const MAP = {
  'banana': 'bananas', 'granny smith': 'apples', 'orange': 'oranges', 'lemon': 'lemons', 'strawberry': 'strawberries',
  'pineapple': 'pineapple', 'broccoli': 'broccoli', 'cauliflower': 'cauliflower', 'head cabbage': 'lettuce',
  'bell pepper': 'bell-peppers', 'cucumber': 'cucumbers', 'zucchini': 'zucchini', 'mushroom': 'mushrooms', 'corn': 'corn',
  'ear': 'corn', 'pizza': 'frozen-pizza', 'ice cream': 'ice-cream', 'french loaf': 'bread', 'bagel': 'bagels',
  'pretzel': 'pretzels', 'hotdog': 'hot-dogs', 'cheeseburger': 'hamburger-buns', 'burrito': 'tortillas', 'guacamole': 'avocados',
  'espresso': 'coffee', 'coffee mug': 'coffee', 'wine bottle': 'wine', 'red wine': 'wine', 'beer bottle': 'beer', 'beer glass': 'beer',
  'pop bottle': 'soda', 'water bottle': 'bottled-water', 'water jug': 'bottled-water', 'milk can': 'milk', 'eggnog': 'eggnog',
  'carbonara': 'spaghetti', 'consomme': 'chicken-broth', 'meat loaf': 'ground-beef', 'dough': 'pie-crust', 'potpie': 'pie-crust',
  'acorn squash': 'pumpkin', 'butternut squash': 'pumpkin', 'spaghetti squash': 'zucchini', 'mashed potato': 'potatoes',
  'salt shaker': 'salt', 'dutch oven': 'dutch-oven', 'crock pot': 'slow-cooker', 'frying pan': 'frying-pan', 'wok': 'wok', 'spatula': 'spatula', 'wooden spoon': 'wooden-spoons', 'can opener': 'can-opener', 'strainer': 'colander',
  'teapot': 'tea', 'chocolate sauce': 'maple-syrup', 'trifle': 'cool-whip', 'plate': 'dinner-plates', 'mixing bowl': 'mixing-bowls',
  'measuring cup': 'measuring-cups', 'packet': 'zip-bags', 'paper towel': 'paper-towels', 'toilet tissue': 'paper-towels',
  'lotion': 'dish-soap', 'soap dispenser': 'dish-soap', 'ladle': 'ladle', 'saltshaker': 'salt', 'carton': 'milk',
};

let model;
const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
async function getModel(onStatus) {
  if (model) return model;
  onStatus?.('Waking up the food spotter (first time takes a few seconds)…');
  if (!window.tf) await load('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
  if (!window.mobilenet) await load('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');
  model = await window.mobilenet.load({ version: 2, alpha: 1.0 });
  return model;
}

// Shrink a photo to a small JPEG data URL so it can be stored and synced.
export async function photoFromFile(file, size = 320) {
  const url = URL.createObjectURL(file);
  try {
    // wait on load, not img.decode(): decode can stall if the app goes to the background mid-way
    const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const s = Math.min(1, size / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { thumb: c.toDataURL('image/jpeg', .72), img };
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

// Barcodes on real packages: glare on a shiny label, a curved bag, a jug photographed sideways.
// The phone's own detector first if there is one, then ZXing "try harder" on a few versions of the
// photo (resized, higher contrast, rotated) until one reads.
const bitmapOf = async file => { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { return (await photoFromFile(file, 2400)).img; } };
function variant(img, maxSide, rot, filter) {
  const s = Math.min(1, maxSide / Math.max(img.width, img.height)), w = Math.round(img.width * s), h = Math.round(img.height * s);
  const c = document.createElement('canvas'), sw = rot % 180 ? h : w, sh = rot % 180 ? w : h;
  c.width = sw; c.height = sh;
  const g = c.getContext('2d', { willReadFrequently: true }); g.filter = filter; g.translate(sw / 2, sh / 2); g.rotate(rot * Math.PI / 180); g.drawImage(img, -w / 2, -h / 2, w, h);
  return c;
}
// The Android app's native helpers: Google's scanner screen and ML Kit on photos. Both answer through one callback.
let codeSeq = 0;
const codeWaiting = new Map();
window.__nativeCodeDone = (id, ok, b64) => {
  const done = codeWaiting.get(id); if (!done) return;
  codeWaiting.delete(id);
  let v = ''; try { v = new TextDecoder().decode(Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))); } catch { }
  done(ok ? v : null);
};
const nativeCall = (fn, ...args) => new Promise(res => { const id = ++codeSeq; codeWaiting.set(id, res); try { window.LarderNative[fn](id, ...args); } catch { codeWaiting.delete(id); res(null); } });
export const hasNativeScanner = () => !!window.LarderNative?.scanCode;
export const nativeScan = () => nativeCall('scanCode'); // the barcode, or null if they backed out

// quick: the two most likely versions of the photo; thorough: every size, rotation and contrast
const QUICK = [[1600, 0, 'grayscale(1) contrast(1.4)'], [1600, 0, 'none']];
const THOROUGH = [1600, 1100, 2200, 800].flatMap(m => [0, 90, 270].flatMap(r => ['grayscale(1) contrast(1.4)', 'none'].map(f => [m, r, f])));
export async function readBarcode(file, { thorough = true } = {}) {
  const img = await bitmapOf(file);
  if (window.LarderNative?.readBarcode) {
    const c = variant(img, 1800, 0, 'none');
    const code = await nativeCall('readBarcode', c.toDataURL('image/jpeg', 0.9).split(',')[1]);
    if (code) return code;
  }
  try {
    if ('BarcodeDetector' in window) {
      const r = await new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(img);
      if (r[0]) return r[0].rawValue;
    }
  } catch { }
  try {
    if (!window.ZXing) await load('vendor/zxing.min.js');
    const Z = window.ZXing, hints = new Map();
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_E]);
    const reader = new Z.MultiFormatReader(); reader.setHints(hints);
    // with the phone's reader already tried, only a quick second opinion
    for (const [maxSide, rot, filter] of thorough && !window.LarderNative?.readBarcode ? THOROUGH : QUICK) {
      const c = variant(img, maxSide, rot, filter);
      for (const Bin of [Z.HybridBinarizer, Z.GlobalHistogramBinarizer]) {
        try { return reader.decode(new Z.BinaryBitmap(new Bin(new Z.HTMLCanvasElementLuminanceSource(c))), hints).getText(); } catch { }
      }
    }
  } catch { }
  return null;
}

// Name a package from the words printed on it ("PIG EARS", "Snuggle", "Health Bars ... dog biscuits").
function foodsFromText(text) {
  const out = new Map();
  const lines = text.split('\n').map(l => l.replace(/[^A-Za-z&'\s-]/g, ' ').replace(/\s+/g, ' ').trim()).filter(l => l.length >= 3);
  for (const l of lines) { const f = matchFood(l); if (f && !out.has(f.id)) out.set(f.id, { food: f, why: l }); }
  const whole = matchFood(lines.join(' ')); if (whole && !out.has(whole.id)) out.set(whole.id, { food: whole, why: 'the label' });
  return [...out.values()];
}

// Several photos of one thing (front, barcode, date label) → what it is, its label, and its date.
export async function identify(files, onStatus) {
  files = [].concat(files);
  onStatus?.('Looking at your photo' + (files.length > 1 ? 's' : '') + '…');
  const { thumb, img } = await photoFromFile(files[0]);
  const out = { photo: thumb, product: null, candidates: [], labels: [], code: null, date: null, textFoods: [] };
  // a quick look at every photo first (the barcode is usually one of them), then the slow careful look
  for (const thorough of [false, true]) {
    for (const [i, f] of files.entries()) {
      onStatus?.(files.length > 1 ? `Checking photo ${i + 1} for a barcode…` : 'Checking for a barcode…');
      out.code = await readBarcode(f, { thorough });
      if (out.code) break;
    }
    if (out.code) break;
  }
  if (out.code) {
    onStatus?.(`Found barcode ${out.code}. Looking it up…`);
    try { out.product = await lookupBarcode(out.code); } catch { }
  }
  // read the printing: a best-by date, and (when the barcode didn't name it) what it is
  try {
    const { readText, parseDates } = await import('./ocr.js');
    let text = '';
    for (const [i, f] of files.entries()) { onStatus?.(files.length > 1 ? `Reading photo ${i + 1} of ${files.length}…` : 'Reading the label…'); text += '\n' + await readText(f, onStatus); }
    out.date = parseDates(text)[0] || null;
    out.text = text;
    out.textFoods = foodsFromText(text);
  } catch { }
  // a database entry with a name but no food type ("Health bars"): the package's own words decide
  if (out.product && !out.product.foodId) {
    const f = out.textFoods[0]?.food || matchFood(`${out.product.name} ${out.product.brand || ''}`);
    if (f) out.product = { ...out.product, foodId: f.id, emoji: out.product.emoji || f.emoji };
  }
  if (out.product) return out;
  for (const t of out.textFoods) out.candidates.push({ food: t.food, prob: 1, label: t.why, fromText: true });
  if (out.candidates.length) return out;
  try {
    const m = await getModel(onStatus);
    onStatus?.('Figuring out what that is…');
    const preds = await m.classify(img, 5);
    out.labels = preds.map(p => ({ label: p.className.split(',')[0], prob: p.probability }));
    const seen = new Set();
    for (const p of preds) {
      const names = p.className.toLowerCase().split(',').map(s => s.trim());
      const food = names.map(n => FOOD_BY_ID[MAP[n]]).find(Boolean) || names.map(n => matchFood(n)).find(Boolean);
      if (food && !seen.has(food.id)) { seen.add(food.id); out.candidates.push({ food, prob: p.probability, label: names[0] }); }
    }
  } catch (e) {
    out.offline = true;
  }
  return out;
}
