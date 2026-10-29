// Default kitchen layout, modeled on a real kitchen: a stove wall, a sink wall, a corner run
// with an island, plus the garage. Every zone has a `kind` (fridge/freezer/cabinet/…) and a
// `slot` naming where the kitchen scene draws it. Zones are user-editable; zones without a
// drawn slot show up under "More storage".

export const ZONE_KINDS = {
  fridge: { label: 'Fridge', emoji: '🧊' },
  freezer: { label: 'Freezer', emoji: '❄️' },
  cabinet: { label: 'Cabinet', emoji: '🗄️' },
  drawer: { label: 'Drawer', emoji: '🗃️' },
  pantry: { label: 'Pantry', emoji: '🚪' },
  counter: { label: 'Counter', emoji: '🍌' },
  holiday: { label: 'Holiday storage', emoji: '🎁' },
  pet: { label: 'Pet', emoji: '🐾' },
  other: { label: 'Other', emoji: '📦' },
};

const shelves = (p, names) => names.map((name, i) => ({ id: `${p}-${i + 1}`, name }));

export const DEFAULT_ZONES = [
  // ---- stove wall ----
  // French-door fridge as photographed: shelves down the middle (with the pull-out cheese
  // drawer under the top shelf), two crispers, and three bins on each door. col: l | c | r
  { id: 'fridge', name: 'Fridge', kind: 'fridge', slot: 'fridge', layout: 'french', sections: [
    { id: 'fr-dl-1', name: 'Left Door · Top', col: 'l' }, { id: 'fr-dl-2', name: 'Left Door · Middle', col: 'l' }, { id: 'fr-dl-3', name: 'Left Door · Bottom', col: 'l' },
    { id: 'fr-top', name: 'Top Shelf', col: 'c' }, { id: 'fr-drawer', name: 'Cheese Drawer', col: 'c' }, { id: 'fr-mid', name: 'Middle Shelf', col: 'c' },
    { id: 'fr-bot', name: 'Bottom Shelf', col: 'c' }, { id: 'fr-crisp-l', name: 'Left Crisper', col: 'c' }, { id: 'fr-crisp-r', name: 'Right Crisper', col: 'c' },
    { id: 'fr-dr-1', name: 'Right Door · Top', col: 'r' }, { id: 'fr-dr-2', name: 'Right Door · Middle', col: 'r' }, { id: 'fr-dr-3', name: 'Right Door · Gallon Bin', col: 'r' },
  ] },
  // Bottom freezer drawer: a slide-out top tray (ice trays, boxes) over the deep basket.
  { id: 'freezer', name: 'Freezer Drawer', kind: 'freezer', slot: 'freezer', sections: [
    { id: 'fz-tray', name: 'Top Slide-out Tray' }, { id: 'fz-bin', name: 'Bottom Basket' },
  ] },
  { id: 'above-fridge-l', name: 'Above Fridge · Left', short: 'Above L', kind: 'cabinet', slot: 'above-fridge-l', sections: shelves('afl', ['Shelf']) },
  { id: 'above-fridge-r', name: 'Above Fridge · Right', short: 'Above R', kind: 'cabinet', slot: 'above-fridge-r', sections: shelves('afr', ['Shelf']) },
  { id: 'above-micro-l', name: 'Above Microwave · Left', short: 'Left', kind: 'cabinet', slot: 'above-micro-l', sections: shelves('aml', ['Top Shelf', 'Bottom Shelf']) },
  { id: 'above-micro-r', name: 'Above Microwave · Right', short: 'Right', kind: 'cabinet', slot: 'above-micro-r', sections: shelves('amr', ['Top Shelf', 'Bottom Shelf']) },
  { id: 'stove-drawer', name: 'Stove Drawer', short: 'Drawer', kind: 'drawer', slot: 'stove-drawer', sections: shelves('sd', ['Pans & Sheets']) },
  { id: 'tall-stove', name: 'Tall Cabinet by the Stove', short: 'Baking', kind: 'cabinet', slot: 'tall-stove', sections: shelves('ts', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'counter-stove', name: 'Counter by the Stove', short: 'Counter', kind: 'counter', slot: 'counter-stove', sections: [
    { id: 'ct-spice', name: 'Spice Rack' }, { id: 'ct-oil', name: 'Oils & Knife Block' },
  ] },
  // ---- sink wall ----
  { id: 'sink-base', name: 'Under the Sink', short: 'Under Sink', kind: 'cabinet', slot: 'sink-base', sections: [
    { id: 'sink-1', name: 'Cleaning Supplies' }, { id: 'sink-2', name: 'Trash Bags & Sponges' },
  ] },
  { id: 'skinny-l', name: 'Skinny Upper · Left', short: 'Mugs', kind: 'cabinet', slot: 'skinny-l', sections: shelves('skl', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'skinny-r', name: 'Skinny Upper · Right', short: 'Snacks', kind: 'cabinet', slot: 'skinny-r', sections: shelves('skr', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'drawer-l', name: 'Drawer · Left of Pair', short: '', kind: 'drawer', slot: 'drawer-l', sections: shelves('drl', ['Wraps, Foil & Bags']) },
  { id: 'drawer-r', name: 'Drawer · Right of Pair', short: '', kind: 'drawer', slot: 'drawer-r', sections: shelves('drr', ['Utensils & Gadgets']) },
  { id: 'base-l', name: 'Base Cabinet · Left', short: 'Base L', kind: 'cabinet', slot: 'base-l', sections: shelves('bl', ['Shelf', 'Floor']) },
  { id: 'base-r', name: 'Base Cabinet · Right', short: 'Base R', kind: 'cabinet', slot: 'base-r', sections: shelves('br', ['Shelf', 'Floor']) },
  // ---- corner & island ----
  { id: 'corner-up', name: 'Tall Corner Cabinet', short: 'Corner', kind: 'cabinet', slot: 'corner-up', sections: shelves('cu', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'corner-small', name: 'Small Corner Cabinet', short: 'Small', kind: 'cabinet', slot: 'corner-small', sections: shelves('cs', ['Coffee & Filters']) },
  { id: 'counter', name: 'Coffee Corner', short: 'Counter', kind: 'counter', slot: 'counter', sections: [
    { id: 'ct-coffee', name: 'Coffee Station' }, { id: 'ct-bread', name: 'Bread Box' }, { id: 'ct-fruit', name: 'Fruit Bowl' },
  ] },
  { id: 'big-l', name: 'Big Upper · Left', short: 'Canned', kind: 'cabinet', slot: 'big-l', sections: shelves('bgl', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'big-r', name: 'Big Upper · Right', short: 'Breakfast', kind: 'cabinet', slot: 'big-r', sections: shelves('bgr', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'drawer-c', name: 'Corner Drawer', short: '', kind: 'drawer', slot: 'drawer-c', sections: shelves('drc', ['Junk Drawer']) },
  { id: 'base-big', name: 'Big Base Cabinet', short: 'Base', kind: 'cabinet', slot: 'base-big', sections: shelves('bb', ['Shelf', 'Floor']) },
  { id: 'island', name: 'Island Cabinet', short: 'Island', kind: 'cabinet', slot: 'island', sections: shelves('isl', ['Shelf', 'Floor · Big Pots & Appliances']) },
  // ---- Clyde (the dog): food bowl + his food, and a bone for his treats ----
  { id: 'clyde', name: "Clyde's Food", short: 'Food', kind: 'pet', slot: 'clyde', sections: [
    { id: 'cl-bowl', name: 'Food Bowl' }, { id: 'cl-bag', name: 'Dog Food Bag' },
  ] },
  { id: 'clyde-treats', name: "Clyde's Treats", short: 'Treats', kind: 'pet', slot: 'clyde-treats', sections: [
    { id: 'cl-treats', name: 'Treats & Bones' },
  ] },
  // ---- garage ----
  { id: 'g-fridge-fz', name: 'Garage Fridge Freezer', kind: 'freezer', slot: 'garage-fridge-fz', sections: [
    { id: 'gz-main', name: 'Freezer Shelf' }, { id: 'gz-door', name: 'Freezer Door' },
  ] },
  { id: 'g-fridge', name: 'Garage Fridge', kind: 'fridge', slot: 'garage-fridge', sections: [
    { id: 'gf-top', name: 'Top Shelf' }, { id: 'gf-bot', name: 'Bottom Shelf' }, { id: 'gf-crisp', name: 'Crisper' }, { id: 'gf-door', name: 'Door · Drinks' },
  ] },
  { id: 'g-upright', name: 'Garage Upright Freezer', kind: 'freezer', slot: 'garage-upright', sections: [
    { id: 'gu-1', name: 'Shelf 1 · Top' }, { id: 'gu-2', name: 'Shelf 2' }, { id: 'gu-3', name: 'Shelf 3' }, { id: 'gu-4', name: 'Shelf 4' },
    { id: 'gu-bin', name: 'Bottom Basket' }, { id: 'gu-door', name: 'Door Racks' },
  ] },
  // ---- elsewhere ----
  { id: 'pantry', name: 'Pantry', kind: 'pantry', slot: 'pantry', sections: [
    { id: 'pa-1', name: 'Top Shelf · Bulk' }, { id: 'pa-2', name: 'Grains & Pasta' }, { id: 'pa-3', name: 'Canned Overflow' },
    { id: 'pa-4', name: 'Snacks' }, { id: 'pa-5', name: 'Floor · Drinks & Potatoes' },
  ] },
  { id: 'holiday', name: 'Holiday Closet', kind: 'holiday', slot: 'holiday', sections: [
    { id: 'ho-thanks', name: 'Thanksgiving Bin' }, { id: 'ho-xmas', name: 'Christmas Bin' },
    { id: 'ho-party', name: 'Party Supplies' }, { id: 'ho-serve', name: 'Serving Ware' },
  ] },
];

// Section ids from the first (generic) layout → where those things live now.
export const LEGACY_SECTIONS = {
  'ul-top': 'ts-1', 'ul-bot': 'ts-2', 'ul-spice': 'ct-spice', 'um-top': 'bgl-1', 'um-bot': 'bgl-2',
  'ur-top': 'bgr-1', 'ur-bot': 'skr-2', 'll-top': 'isl-1', 'll-floor': 'isl-2', 'lr-wrap': 'drl-1', 'lr-clean': 'sink-1',
  // fridge/freezer before they were modeled on the photos
  'fr-deli': 'fr-drawer', 'fr-veg': 'fr-crisp-l', 'fr-fruit': 'fr-crisp-r', 'fr-door': 'fr-dr-2',
  'fz-top': 'fz-tray', 'fz-bot': 'fz-bin', 'fz-ice': 'fz-tray',
};

// Pick a sensible section for a catalog food.
export function suggestSection(food, zones) {
  const has = id => zones.some(z => z.sections.some(s => s.id === id));
  const pick = (...ids) => ids.find(has) || zones[0]?.sections[0]?.id;
  if (!food) return pick('fr-mid');
  const { cat, zone, id } = food;
  if (cat === 'pet') return /treat|bone|chew/.test(id) ? pick('cl-treats') : pick('cl-bag');
  if (zone === 'holiday') {
    if (/napkin|candle|punch/.test(id)) return pick('ho-party');
    if (/cookie|cake/.test(id)) return pick('ho-xmas');
    if (/platter|gravy|bowl/.test(id)) return pick('ho-serve');
    return pick('ho-thanks');
  }
  if (zone === 'freezer' || cat === 'frozen') return /ice-cream|fries|waffle|pie-shell|pizza/.test(id) || cat === 'meat' ? pick('fz-bin') : pick('fz-tray');
  if (zone === 'fridge') {
    if (cat === 'produce') return /apple|orange|lemon|lime|berr|grape|cranberr/.test(id) ? pick('fr-crisp-r') : pick('fr-crisp-l');
    if (cat === 'meat') return pick('fr-bot');
    if (cat === 'deli') return /cheese|turkey|ham|pepperoni/.test(id) ? pick('fr-drawer') : pick('fr-mid');
    if (/milk|juice|half-and-half|buttermilk|eggnog/.test(id)) return pick('fr-dr-3');
    if (/dressing|ranch|mayonnaise/.test(id)) return pick('fr-dl-2');
    if (/syrup/.test(id)) return pick('fr-dl-3');
    if (cat === 'condiments' || cat === 'canned') return pick('fr-dr-1', 'fr-dr-2');
    if (cat === 'beverages') return pick('fr-bot');
    if (cat === 'dairy') return /cheddar|mozzarella|feta/.test(id) ? pick('fr-drawer') : /egg/.test(id) ? pick('fr-top') : pick('fr-mid');
    if (cat === 'leftovers') return pick('fr-mid');
    if (cat === 'bakery') return pick('fr-bot');
    return pick('fr-mid');
  }
  if (zone === 'pantry') {
    if (cat === 'produce') return /potato|onion|garlic|pumpkin/.test(id) ? pick('pa-5') : pick('ct-fruit');
    if (cat === 'bakery') return pick('ct-bread');
    if (cat === 'beverages') return pick('pa-5');
    return pick('pa-3');
  }
  // cabinet foods
  if (cat === 'spices') return pick('ct-spice');
  if (cat === 'baking') return pick('ts-1', 'ts-2');
  if (cat === 'condiments') return /oil|spray/.test(id) ? pick('ct-oil') : pick('bgl-2');
  if (cat === 'canned') return pick('bgl-1', 'bgl-2');
  if (cat === 'snacks') return pick('skr-2');
  if (cat === 'beverages') return /coffee/.test(id) ? pick('ct-coffee') : /tea/.test(id) ? pick('skl-2') : pick('pa-5');
  if (cat === 'grains') return /cereal|oat|pancake/.test(id) ? pick('bgr-1') : pick('cu-2');
  if (cat === 'household') return /soap|trash|towel|sponge/.test(id) ? pick('sink-1') : pick('drl-1');
  if (cat === 'kitchenware') return /slow|mixer|roast/.test(id) ? pick('isl-2') : /thermometer/.test(id) ? pick('drr-1') : pick('sd-1', 'isl-1');
  return pick('pa-3');
}
