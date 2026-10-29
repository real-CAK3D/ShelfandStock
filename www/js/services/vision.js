// Snap a photo → figure out what it is.
// 1) If the photo shows a barcode, look the product up in Open Food Facts (real label + picture).
// 2) Otherwise run MobileNet (free, runs on the phone via TensorFlow.js — no account, no API key)
//    and map what it sees onto the food catalog.

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
  'salt shaker': 'salt', 'dutch oven': 'roasting-pan', 'crock pot': 'slow-cooker', 'frying pan': 'roasting-pan', 'wok': 'roasting-pan',
  'teapot': 'tea', 'chocolate sauce': 'maple-syrup', 'trifle': 'cool-whip', 'plate': 'serving-platter', 'mixing bowl': 'punch-bowl',
  'measuring cup': 'all-purpose-flour', 'packet': 'zip-bags', 'paper towel': 'paper-towels', 'toilet tissue': 'paper-towels',
  'lotion': 'dish-soap', 'soap dispenser': 'dish-soap', 'ladle': 'gravy-boat', 'saltshaker': 'salt', 'carton': 'milk',
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
    const img = new Image(); img.src = url; await img.decode();
    const s = Math.min(1, size / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { thumb: c.toDataURL('image/jpeg', .72), img };
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

async function readBarcode(img) {
  try {
    if ('BarcodeDetector' in window) {
      const r = await new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(img);
      if (r[0]) return r[0].rawValue;
    }
    if (!window.ZXing) await load('vendor/zxing.min.js');
    const res = await new window.ZXing.BrowserMultiFormatReader().decodeFromImageElement(img);
    return res?.getText() || null;
  } catch { return null; }
}

export async function identify(file, onStatus) {
  onStatus?.('Looking at your photo…');
  const { thumb, img } = await photoFromFile(file);
  const out = { photo: thumb, product: null, candidates: [], labels: [] };
  onStatus?.('Checking for a barcode…');
  const code = await readBarcode(img);
  if (code) {
    onStatus?.(`Found barcode ${code} — reading the label…`);
    try { out.product = await lookupBarcode(code); } catch { }
    if (out.product) return out;
  }
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
