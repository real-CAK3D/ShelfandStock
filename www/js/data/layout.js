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
  closet: { label: 'Closet', emoji: '🚪' },
  shelf: { label: 'Open shelves', emoji: '🗄️' },
  rack: { label: 'Storage rack', emoji: '🗄️' },
  boxes: { label: 'Stacked boxes', emoji: '📦' },
  other: { label: 'Other', emoji: '📦' },
};

// The rooms of the house, each with its own walls. The kitchen keeps the garage fridges (they're
// drawn on the garage's right wall too). Zones say which room they belong to so lists can group them.
export const HOUSE_ROOMS = [
  { id: 'kitchen', label: 'Kitchen', emoji: '🍳' },
  { id: 'bathroom', label: 'Bathroom', emoji: '🛁' },
  { id: 'basement', label: 'Basement', emoji: '📦' },
  { id: 'garage', label: 'Garage', emoji: '🚗' },
  { id: 'shed', label: 'Shed', emoji: '🏚️' },
];
export const BASEMENT_RACKS = 13;
// the shed's walls of stacked storage boxes: how many stacks along each wall, four boxes high
export const SHED_WALLS = [{ id: 'shed-l', name: 'Shed · Left Side', short: 'Left', code: 'L', stacks: 8 }, { id: 'shed-back', name: 'Shed · Back Wall', short: 'Back', code: 'B', stacks: 6 }, { id: 'shed-r', name: 'Shed · Right Side', short: 'Right', code: 'R', stacks: 8 }];
export const SHED_HIGH = 4;

const shelves = (p, names) => names.map((name, i) => ({ id: `${p}-${i + 1}`, name }));

export const PANTRY_SECTIONS = [
  { id: 'pa-1', name: 'Top Drawer' }, { id: 'pa-2', name: 'Drawer 2' }, { id: 'pa-3', name: 'Drawer 3' },
  { id: 'pa-4', name: 'Drawer 4' }, { id: 'pa-5', name: 'Floor · Pots & Bins' },
];

export const DEFAULT_ZONES = [
  // ---- stove wall ----
  // French-door fridge as photographed: shelves down the middle (with the pull-out cheese
  // fresh box under the top shelf with a small shelf below it), the main bottom shelf, two drawers side by side,
  // and three bins on each door. col: l | c | r
  { id: 'fridge', name: 'Fridge', kind: 'fridge', slot: 'fridge', layout: 'french', sections: [
    { id: 'fr-dl-1', name: 'Left Door · Top', col: 'l' }, { id: 'fr-dl-2', name: 'Left Door · Middle', col: 'l' }, { id: 'fr-dl-3', name: 'Left Door · Bottom', col: 'l' },
    { id: 'fr-top', name: 'Top Shelf', col: 'c' }, { id: 'fr-drawer', name: 'Fresh Box', col: 'c' }, { id: 'fr-mid', name: 'Small Shelf', col: 'c' },
    { id: 'fr-bot', name: 'Bottom Shelf', col: 'c' }, { id: 'fr-crisp-l', name: 'Vegetable Drawer', col: 'c' }, { id: 'fr-crisp-r', name: 'Produce Drawer', col: 'c' },
    { id: 'fr-dr-1', name: 'Right Door · Top', col: 'r' }, { id: 'fr-dr-2', name: 'Right Door · Middle', col: 'r' }, { id: 'fr-dr-3', name: 'Right Door · Gallon Bin', col: 'r' },
  ] },
  // Bottom freezer drawer: a slide-out top tray (ice trays, boxes) over the deep basket.
  { id: 'freezer', name: 'Freezer Drawer', kind: 'freezer', slot: 'freezer', sections: [
    { id: 'fz-tray', name: 'Top Slide-out Tray' }, { id: 'fz-bin', name: 'Bottom Basket' },
  ] },
  { id: 'above-fridge-l', name: 'Above Fridge · Left', short: 'Above L', kind: 'cabinet', slot: 'above-fridge-l', sections: shelves('afl', ['Top Shelf', 'Bottom Shelf']) },
  { id: 'above-fridge-r', name: 'Above Fridge · Right', short: 'Above R', kind: 'cabinet', slot: 'above-fridge-r', sections: shelves('afr', ['Top Shelf', 'Bottom Shelf']) },
  { id: 'above-micro-l', name: 'Above Microwave · Left', short: 'Left', kind: 'cabinet', slot: 'above-micro-l', sections: shelves('aml', ['Top Shelf', 'Bottom Shelf']) },
  { id: 'above-micro-r', name: 'Above Microwave · Right', short: 'Right', kind: 'cabinet', slot: 'above-micro-r', sections: shelves('amr', ['Top Shelf', 'Bottom Shelf']) },
  { id: 'stove-drawer', name: 'Stove Drawer', short: 'Drawer', kind: 'drawer', slot: 'stove-drawer', sections: shelves('sd', ['Pans & Sheets']) },
  { id: 'tall-stove', name: 'Tall Cabinet by the Stove', short: 'Baking', kind: 'cabinet', slot: 'tall-stove', sections: shelves('ts', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'counter-stove', name: 'Counter by the Stove', short: 'Counter', kind: 'counter', slot: 'counter-stove', sections: [
    { id: 'ct-spice', name: 'Spice Rack' }, { id: 'ct-oil', name: 'Oils & Knife Block' },
  ] },
  // ---- sink wall ----
  // both sides under the sink are wide open, no shelves
  { id: 'sink-base', name: 'Under the Sink', short: 'Under Sink', kind: 'cabinet', slot: 'sink-base', sections: [
    { id: 'sink-1', name: 'Left Side' }, { id: 'sink-2', name: 'Right Side' },
  ] },
  { id: 'skinny-l', name: 'Skinny Upper · Left', short: 'Mugs', kind: 'cabinet', slot: 'skinny-l', sections: shelves('skl', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'skinny-r', name: 'Skinny Upper · Right', short: 'Snacks', kind: 'cabinet', slot: 'skinny-r', sections: shelves('skr', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'drawer-l', name: 'Drawer · Left of Pair', short: '', kind: 'drawer', slot: 'drawer-l', sections: shelves('drl', ['Wraps, Foil & Bags']) },
  { id: 'drawer-r', name: 'Drawer · Right of Pair', short: '', kind: 'drawer', slot: 'drawer-r', sections: shelves('drr', ['Utensils & Gadgets']) },
  { id: 'base-l', name: 'Base Cabinet · Left', short: 'Base L', kind: 'cabinet', slot: 'base-l', sections: shelves('bl', ['Top Shelf', 'Bottom']) },
  { id: 'base-r', name: 'Base Cabinet · Right', short: 'Base R', kind: 'cabinet', slot: 'base-r', sections: shelves('br', ['Top Shelf', 'Bottom']) },
  // ---- corner & island ----
  { id: 'corner-up', name: 'Tall Corner Cabinet', short: 'Corner', kind: 'cabinet', slot: 'corner-up', sections: shelves('cu', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'corner-small', name: 'Small Corner Cabinet', short: 'Small', kind: 'cabinet', slot: 'corner-small', sections: shelves('cs', ['Top Shelf', 'Bottom Shelf']) },
  { id: 'counter', name: 'Coffee Corner', short: 'Counter', kind: 'counter', slot: 'counter', sections: [
    { id: 'ct-coffee', name: 'Coffee Station' }, { id: 'ct-bread', name: 'Bread Box' }, { id: 'ct-fruit', name: 'Fruit Bowl' },
  ] },
  { id: 'big-l', name: 'Big Upper · Left', short: 'Canned', kind: 'cabinet', slot: 'big-l', sections: shelves('bgl', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'big-r', name: 'Big Upper · Right', short: 'Breakfast', kind: 'cabinet', slot: 'big-r', sections: shelves('bgr', ['Top Shelf', 'Middle Shelf', 'Bottom Shelf']) },
  { id: 'drawer-c', name: 'Corner Drawer', short: '', kind: 'drawer', slot: 'drawer-c', sections: shelves('drc', ['Junk Drawer']) },
  { id: 'base-big', name: 'Big Base Cabinet', short: 'Base', kind: 'cabinet', slot: 'base-big', sections: shelves('bb', ['Top Shelf', 'Bottom']) },
  { id: 'base-big-r', name: 'Double Base Cabinet', short: 'Base 2', kind: 'cabinet', slot: 'base-big-r', sections: shelves('bbr', ['Top Shelf', 'Bottom']) },
  { id: 'island', name: 'Island Cabinet', short: 'Island', kind: 'cabinet', slot: 'island', sections: shelves('isl', ['Shelf', 'Floor · Big Pots & Appliances']) },
  // ---- Clyde (the dog): food bowl + his food, and a bone for his treats ----
  { id: 'clyde', name: "Clyde's Food", short: 'Food', kind: 'pet', slot: 'clyde', sections: [
    { id: 'cl-bowl', name: 'Food Bowl' }, { id: 'cl-bag', name: 'Dog Food Bag' },
  ] },
  { id: 'clyde-treats', name: "Clyde's Treats", short: 'Treats', kind: 'pet', slot: 'clyde-treats', sections: [
    { id: 'cl-treats', name: 'Treats & Bones' },
  ] },
  // ---- laundry nook right of the island: two cedar shelves over a counter on the washer & dryer ----
  { id: 'laundry-top', name: 'Laundry · Top Shelf', short: 'Top Shelf', kind: 'other', slot: 'laundry-top', sections: [{ id: 'ln-top', name: 'Top Shelf' }] },
  { id: 'laundry-mid', name: 'Laundry · Lower Shelf', short: 'Lower Shelf', kind: 'other', slot: 'laundry-mid', sections: [{ id: 'ln-mid', name: 'Lower Shelf' }] },
  { id: 'laundry-counter', name: 'Over the Washer & Dryer', short: 'Counter', kind: 'counter', slot: 'laundry-counter', sections: [{ id: 'ln-wash', name: 'Over the Washer' }, { id: 'ln-dry', name: 'Over the Dryer' }] },
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
  // stand-up pantry closet left of the fridge: four shelves, each a sliding pull-out drawer, and the floor
  { id: 'pantry', name: 'Pantry Closet', short: 'Pantry', kind: 'pantry', slot: 'pantry', sections: PANTRY_SECTIONS },
  { id: 'holiday', name: 'Holiday Closet', kind: 'holiday', slot: 'holiday', sections: [
    { id: 'ho-thanks', name: 'Thanksgiving Bin' }, { id: 'ho-xmas', name: 'Christmas Bin' },
    { id: 'ho-party', name: 'Party Supplies' }, { id: 'ho-serve', name: 'Serving Ware' },
  ] },
  ...ROOM_ZONES(),
];

// ---- the rest of the house ----
function ROOM_ZONES() {
  const five = p => shelves(p, ['Top Shelf', 'Shelf 2', 'Shelf 3', 'Shelf 4', 'Bottom Shelf']);
  return [
    // bathroom, the vanity wall: the counter and the ledge under the mirror, a medicine cabinet of three
    // mirrored doors (a column of shelves behind each), an open space under the sink, two drawers, the towels
    { id: 'bath-counter', room: 'bathroom', name: 'Bathroom Counter', short: 'Counter', kind: 'counter', slot: 'bath-counter', sections: [
      { id: 'bc-l', name: 'Left of the Sink' }, { id: 'bc-r', name: 'Right of the Sink' }, { id: 'bc-ledge', name: 'Ledge Under the Mirror' },
    ] },
    { id: 'med-l', room: 'bathroom', name: 'Medicine Cabinet · Left', short: 'Left', kind: 'cabinet', slot: 'med-l', sections: five('mcl') },
    { id: 'med-c', room: 'bathroom', name: 'Medicine Cabinet · Middle', short: 'Middle', kind: 'cabinet', slot: 'med-c', sections: five('mcc') },
    { id: 'med-r', room: 'bathroom', name: 'Medicine Cabinet · Right', short: 'Right', kind: 'cabinet', slot: 'med-r', sections: five('mcr') },
    { id: 'bath-sink', room: 'bathroom', name: 'Under the Bathroom Sink', short: 'Under Sink', kind: 'cabinet', slot: 'bath-sink', sections: [{ id: 'bs-1', name: 'Under the Sink' }] },
    { id: 'bath-dr-1', room: 'bathroom', name: 'Bathroom Drawer · Top', short: '', kind: 'drawer', slot: 'bath-dr-1', sections: [{ id: 'bd1-1', name: 'Bath Towels' }] },
    { id: 'bath-dr-2', room: 'bathroom', name: 'Bathroom Drawer · Bottom', short: '', kind: 'drawer', slot: 'bath-dr-2', sections: [{ id: 'bd2-1', name: 'Hand Towels & Rags' }] },
    { id: 'bath-towels', room: 'bathroom', name: 'Towel Ring & Bar', short: 'Towels', kind: 'other', slot: 'bath-towels', sections: [{ id: 'bt-ring', name: 'Towel Ring' }, { id: 'bt-bar', name: 'Towel Bar' }] },
    // bathroom, the stand-up closet: five shelves and the floor
    { id: 'bath-closet', room: 'bathroom', name: 'Bathroom Closet', short: 'Closet', kind: 'closet', slot: 'bath-closet', sections: [
      { id: 'bcl-1', name: 'Top Shelf · Linens' }, { id: 'bcl-2', name: 'Shelf 2 · Medicine' }, { id: 'bcl-3', name: 'Shelf 3 · Toiletries' },
      { id: 'bcl-4', name: 'Shelf 4 · Cleaning' }, { id: 'bcl-5', name: 'Shelf 5 · Paper Goods' }, { id: 'bcl-6', name: 'Floor' },
    ] },
    // garage, left wall (left to right): camping shelves, the hanging two-door cabinet, bikes, skis & winter gear
    { id: 'gar-camp', room: 'garage', name: 'Camping Shelves', short: 'Camping', kind: 'shelf', slot: 'gar-camp', sections: shelves('gcp', ['Top Shelf', 'Bottom Shelf']) },
    { id: 'gar-cab', room: 'garage', name: 'Car Care Cabinet', short: 'Car Care', kind: 'cabinet', slot: 'gar-cab', sections: [
      { id: 'gcl-1', name: 'Left Door · Top Shelf' }, { id: 'gcl-2', name: 'Left Door · Bottom Shelf' },
      { id: 'gcm-1', name: 'Main · Oil, Fluids & Detailing' },
      { id: 'gcr-1', name: 'Right Door · Top Shelf' }, { id: 'gcr-2', name: 'Right Door · Bottom Shelf' },
    ] },
    { id: 'gar-bikes', room: 'garage', name: 'Bikes, Skis & Winter Gear', short: 'Bikes & Skis', kind: 'other', slot: 'gar-bikes', sections: [
      { id: 'gbk-1', name: 'Bikes' }, { id: 'gbk-2', name: 'Skis & Snowboards' }, { id: 'gbk-3', name: 'Winter Gear' },
    ] },
    // garage, back wall: the closed two-bay door with ladders and saw horses in front
    { id: 'gar-door', room: 'garage', name: 'By the Bay Doors', short: 'Ladders', kind: 'other', slot: 'gar-door', sections: [{ id: 'gdr-1', name: 'Ladders' }, { id: 'gdr-2', name: 'Saw Horses' }] },
    // garage, right wall (left to right): CAK3D's and Zayne's tools on the bench, painting & carpentry under it, the oil drum, then the fridges
    { id: 'bench-cak3d', room: 'garage', name: "CAK3D's Tools", short: 'CAK3D', kind: 'shelf', slot: 'bench-cak3d', sections: [{ id: 'bkc-1', name: 'On the Bench' }, { id: 'bkc-2', name: 'Wall Above' }] },
    { id: 'bench-zayne', room: 'garage', name: "Zayne's Tools", short: 'Zayne', kind: 'shelf', slot: 'bench-zayne', sections: [{ id: 'bkz-1', name: 'On the Bench' }, { id: 'bkz-2', name: 'Wall Above' }] },
    { id: 'bench-under', room: 'garage', name: 'Under the Bench', short: 'Paint & Wood', kind: 'shelf', slot: 'bench-under', sections: [{ id: 'bku-1', name: 'Painting' }, { id: 'bku-2', name: 'Carpentry' }] },
    { id: 'oil-drum', room: 'garage', name: 'Oil Drum', short: 'Drum', kind: 'other', slot: 'oil-drum', sections: [{ id: 'odr-1', name: 'Drum' }] },
    // basement: the numbered storage racks from Home Inventory, four levels each, holding numbered boxes
    ...Array.from({ length: BASEMENT_RACKS }, (_, i) => ({ id: `bsmt-${i + 1}`, room: 'basement', num: i + 1, name: `Basement · Section ${i + 1}`, short: `Section ${i + 1}`, kind: 'rack', slot: `bsmt-${i + 1}`,
      sections: ['Top Shelf', 'Middle Shelf', 'Bottom Shelf', 'Floor'].map((name, j) => ({ id: `b${i + 1}-${['top', 'mid', 'bot', 'floor'][j]}`, name })) })),
    // shed: storage boxes stacked four high along three walls; each stack is a section
    ...SHED_WALLS.map(w => ({ id: w.id, room: 'shed', name: w.name, short: w.short, kind: 'boxes', slot: w.id, code: w.code, high: SHED_HIGH,
      sections: Array.from({ length: w.stacks }, (_, i) => ({ id: `${w.id}-${i + 1}`, name: `Stack ${i + 1}` })) })),
  ];
}

// The storage boxes the shed starts with: every spot in every stack (codes like L1–L32, numbered
// stack by stack from the bottom up), empty and unnamed until someone fills one in.
export function shedBoxes() {
  const out = [];
  for (const w of SHED_WALLS) for (let s = 1; s <= w.stacks; s++) for (let lv = 1; lv <= SHED_HIGH; lv++)
    out.push({ id: `box-${w.id}-${s}-${lv}`, code: `${w.code}${(s - 1) * SHED_HIGH + lv}`, sectionId: `${w.id}-${s}`, level: lv, name: '', owner: null, locked: false, private: false, photo: null, inside: null, out: null, notes: '', added: null });
  return out;
}

// Section ids from the first (generic) layout → where those things live now.
export const LEGACY_SECTIONS = {
  'ul-top': 'ts-1', 'ul-bot': 'ts-2', 'ul-spice': 'ct-spice', 'um-top': 'bgl-1', 'um-bot': 'bgl-2',
  'ur-top': 'bgr-1', 'ur-bot': 'skr-2', 'll-top': 'isl-1', 'll-floor': 'isl-2', 'lr-wrap': 'drl-1', 'lr-clean': 'sink-1',
  // fridge/freezer before they were modeled on the photos
  'fr-deli': 'fr-drawer', 'fr-veg': 'fr-crisp-l', 'fr-fruit': 'fr-crisp-r', 'fr-door': 'fr-dr-2',
  'fz-top': 'fz-tray', 'fz-bot': 'fz-bin', 'fz-ice': 'fz-tray',
};

// Pick a sensible section for a catalog food.
// `hint` ({ name, cat }) places things that aren't in the food catalog, like custom items.
const COLD_CATS = ['dairy', 'meat', 'deli', 'leftovers'];
export function suggestSection(food, zones, hint) {
  const has = id => zones.some(z => z.sections.some(s => s.id === id));
  // when the usual spot is gone (a place was deleted or renamed away): cold food to the fridge, the rest
  // to a pantry, then a big base cabinet, then any cabinet; never just the first shelf in the list
  const cold = () => food && (food.zone === 'fridge' || food.zone === 'freezer' || food.cat === 'frozen' || COLD_CATS.includes(food.cat));
  const fallback = () => cold()
    ? ['fr-mid', 'fr-bot', 'gf-top', 'gf-bot'].find(has) || zones.find(z => z.kind === 'fridge')?.sections[0]?.id
    : zones.find(z => z.kind === 'pantry')?.sections[0]?.id || ['isl-1', 'bb-1', 'bbr-1', 'bgl-1'].find(has) || zones.find(z => z.kind === 'cabinet')?.sections[0]?.id;
  const pick = (...ids) => ids.find(has) || fallback() || zones[0]?.sections[0]?.id;
  if (!food) {
    if (!hint?.cat || hint.cat === 'pantry') return pick('pa-3');
    food = { cat: hint.cat, id: String(hint.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'), zone: COLD_CATS.includes(hint.cat) ? 'fridge' : hint.cat === 'frozen' ? 'freezer' : 'cabinet' };
  }
  const { cat, zone, id } = food;
  if (cat === 'pet') return /treat|bone|chew|ear|bully|stick/.test(id) ? pick('cl-treats') : pick('cl-bag');
  if (zone === 'holiday') {
    if (/napkin|candle|punch/.test(id)) return pick('ho-party');
    if (/cookie|cake/.test(id)) return pick('ho-xmas');
    if (/platter|gravy|bowl|plate|mug|tableware|tablecloth/.test(id)) return pick('ho-serve');
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
  // the bathroom: toothbrushes and soap on the counter, the medicine cabinet's columns, towels in the drawers,
  // spares in the closet, toilet paper and cleaners under the sink
  if (cat === 'bath') {
    if (/toothbrush|toothpaste|hand-soap|hairbrush/.test(id)) return pick('bc-l');
    if (/lotion/.test(id)) return pick('bc-r');
    if (/floss|cotton|nail/.test(id)) return pick('mcc-2');
    if (/face-mask/.test(id)) return pick('mcc-1');
    if (/shave|razor|clipper/.test(id)) return pick('mcc-4');
    if (/deodorant|body-spray/.test(id)) return pick('mcl-3');
    if (/hair-gel/.test(id)) return pick('mcl-4');
    if (/beard|cologne/.test(id)) return pick('mcr-4');
    if (/mouthwash/.test(id)) return pick('mcr-5');
    return pick('bcl-3');
  }
  if (cat === 'medicine') return /ointment|bandage/.test(id) ? pick('mcl-1', 'bcl-2') : pick('bcl-2');
  if (cat === 'linens') return /bath-towel/.test(id) ? pick('bd1-1') : /hand-towel|rag/.test(id) ? pick('bd2-1') : pick('bcl-1');
  if (cat === 'household' && zone === 'bath') return /tissue/.test(id) ? pick('bc-r') : /toilet-paper/.test(id) ? pick('bs-1', 'bcl-5') : pick('bs-1');
  // the garage
  if (cat === 'auto') return /funnel|jumper|gauge/.test(id) ? pick('gcl-1') : /microfiber|wax|tire-shine/.test(id) ? pick('gcr-1') : pick('gcm-1');
  if (cat === 'tools') {
    if (/paint/.test(id)) return pick('bku-1');
    if (/lumber|glue|sandpaper|clamp/.test(id)) return pick('bku-2');
    if (/ladder/.test(id)) return pick('gdr-1');
    if (/saw-horse/.test(id)) return pick('gdr-2');
    return pick('bkc-1');
  }
  if (cat === 'outdoor') return /fishing|tackle/.test(id) ? pick('gcp-2') : pick('gcp-1');
  if (cat === 'sports') return /bike/.test(id) ? pick('gbk-1') : /ski|snowboard/.test(id) ? pick('gbk-2') : pick('gbk-3');
  if (cat === 'storage') return pick('b1-floor');
  // cabinet foods
  if (cat === 'spices') return pick('ct-spice');
  if (cat === 'baking') return pick('ts-1', 'ts-2');
  if (cat === 'condiments') return /oil|spray/.test(id) ? pick('ct-oil') : pick('bgl-2');
  if (cat === 'canned') return pick('bgl-1', 'bgl-2');
  if (cat === 'snacks') return pick('skr-2');
  if (cat === 'beverages') return /coffee/.test(id) ? pick('ct-coffee') : /tea/.test(id) ? pick('skl-2') : pick('pa-5');
  if (cat === 'grains') return /cereal|oat|pancake/.test(id) ? pick('bgr-1') : pick('cu-2');
  if (cat === 'household' && /laundry|fabric|bleach|dryer|stain/.test(id)) return pick('ln-wash');
  if (cat === 'household') return /paper-towel|napkin|bag/.test(id) && !/zip/.test(id) ? pick('pa-4') : /soap|trash|towel|sponge/.test(id) ? pick('sink-1') : pick('drl-1');
  if (cat === 'kitchenware') {
    if (/slow/.test(id)) return pick('pa-3');
    if (/roast|stock-pot|dutch/.test(id)) return pick('pa-5');
    if (/mixer/.test(id)) return pick('isl-2');
    if (/baking-sheet|muffin|cake-pan|loaf|cooling|griddle/.test(id)) return pick('sd-1');
    if (/frying|skillet|saucepan|wok|casserole|pie-dish|mixing|colander/.test(id)) return pick('isl-1');
    if (/knife|knives|cutting/.test(id)) return pick('ct-oil');
    if (/rolling|measuring/.test(id)) return pick('ts-3');
    if (/silverware|spatula|spoon|ladle|whisk|tongs|opener|peeler|grater|mitt|thermometer/.test(id)) return pick('drr-1');
    if (/mug|glasses/.test(id)) return pick('skl-2');
    if (/plate|bowls/.test(id)) return pick('skl-3');
    if (/storage-container/.test(id)) return pick('br-1');
    return pick('sd-1', 'isl-1');
  }
  return pick('pa-3');
}
