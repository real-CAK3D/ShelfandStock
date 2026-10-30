// Help mode: tap "?" then tap anything on screen to learn what it is and how to use it.
// Entries are checked in order, so put specific selectors before general ones.

import { esc, haptic } from './dom.js';

const HELP = [
  // header & navigation
  ['[data-act=help]', '❓ Help mode', 'You’re in it! Tap anything on screen to see what it does. Tap “Done” at the top when you’re finished.'],
  ['.live-strip', '🟢 Live', 'Who’s in the app right now and what they’re doing: adding to the list, editing the fridge, or at the store. Tap for the live panel. Needs Household sync.'],
  ['[data-tour=stores]', '🛒 Our stores', 'Save the stores you use (find them near you or save the one you’re standing in). With sharing on, the house sees “Poppy is at Hannaford” and your list pops up when you walk in.'],
  ['[data-act=me]', '👤 You', 'Who’s signed in on this phone. Tap to switch person, change your picture (emoji or a photo), or change your PIN.'],
  ['.trip', '🚗 Store run', 'Someone’s heading to the store. Add what you need before the list closes. Tap to see who asked for what; the shopper taps Done shopping when they’re back.'],
  ['[data-trip-new]', '🚗 I’m going to the store', 'Tell everyone when you’re going and when the list closes (like noon today). It shows up for everybody with a countdown.'],
  ['.act', '🏠 Around the house', 'What everyone’s been up to: who requested what, who used the last of something, store runs and what got cooked.'],
  ['.by', '🙋 Requested by', 'Who put this on the list.'],
  ['.pet-bowl', '🐕 Clyde’s food bowl', 'Clyde’s kibble: what’s in the bowl and the dog food bag. Tap to open; when the bag runs low it shows up on the shopping list.'],
  ['.pet-bone', '🦴 Clyde’s treats', 'Clyde’s treats and bones. Set a restock level so you never run out.'],
  ['.d-water-bowl', '💧 Clyde’s water bowl', 'Just water. Keep it full!'],
  ['[data-v=snap]', '📸 Snap', 'Take a picture of any item. A barcode gets the real label; otherwise a free on-phone AI guesses what it is. Keep your photo or use the app’s picture.'],
  ['[data-act=search]', '🔍 Find anything', 'Search your shelves, recipes and the food catalog. Tap a result to swing open the right cabinet with the item highlighted. Try “cinnamon”.'],
  ['[data-act=settings]', '⚙️ Settings', 'Change the wood finish, rename cabinets and shelves, add storage like a garage freezer, set staples, and back up or restore your kitchen.'],
  ['.fab', '＋ Add groceries', 'Add something to your kitchen: search 200+ foods, scan a barcode for the real label and nutrition, search product labels, or make a custom item. Shelf & Stock suggests the shelf and an expiration date.'],
  ['.tab[data-v=kitchen]', '🏠 Kitchen', 'The illustrated kitchen. Tap a door to open it and see each shelf.'],
  ['.tab[data-v=stock]', '📋 Stock', 'Everything you have in one list. Filter by place (just the fridge), aisle, things expiring soon, low stock, or undated items. The red badge counts expired items.'],
  ['.tab[data-v=recipes]', '🍳 Recipes', 'Recipes ranked by what you already have. Open one to see what’s missing and add it to your list.'],
  ['.tab[data-v=plan]', '📅 Plan', 'Calendar for meals, gatherings and holidays. Shelf & Stock works out what to buy and what to pull from storage.'],
  ['.tab[data-v=list]', '🛒 Shopping list', 'What to buy, grouped by aisle. The badge shows how many items are on it.'],

  // kitchen scene
  ['.room-tab, .room-dots', '↔️ Rooms', 'Swipe the kitchen left to walk into the garage, or tap these tabs.'],
  ['[data-zone=g-upright]', '❄️ Garage upright freezer', 'The stand-up freezer in the garage: four shelves, a bottom basket and door racks. Good for bulk meat, the holiday turkey and overflow. Tap to open.'],
  ['[data-zone=g-fridge], [data-zone=g-fridge-fz]', '🧊 Garage fridge', 'The garage fridge with its freezer on top. Each part opens separately. Handy for drinks, party overflow and ice.'],
  ['[data-zone=fridge]','🧊 Fridge', 'Tap to open. Inside, each shelf, crisper, the deli drawer and the door bins are tracked separately. The badge is the item count: orange means something expires soon, red means something already has.'],
  ['[data-zone=freezer]', '❄️ Freezer', 'Tap to open the freezer drawer. Moving an item here from the fridge extends its date automatically.'],
  ['.slot-pantry', '🚪 Pantry', 'Tall pantry shelves: bulk goods, grains and pasta, canned overflow, snacks, and drinks and potatoes on the floor.'],
  ['.counter-zone', '🍌 Countertop', 'What’s sitting out: the spice rack and oils by the stove, and the coffee station, bread box and fruit bowl in the corner. Tap to see it all.'],
  ['.drawer-slot', '🗃️ Drawer', 'Tap and it slides open. Great for wraps, foil, utensils and the junk drawer.'],
  ['[data-zone=island]', '🏝️ Island', 'The big cabinet under the island, good for large pots, the slow cooker and the stand mixer.'],
  ['.wall .slot', '🗄️ Cabinet', 'Tap to swing the door open and see each shelf. Rename it in Settings to whatever you call it at home.'],
  ['.chest[data-zone=holiday]', '🎁 Holiday closet', 'Roasting pan, cookie cutters, the good platter. Tag items “thanksgiving”, “christmas” or “party” and they appear on that holiday in the calendar with their location.'],
  ['.chest[data-go=settings]', '🧰 Add storage', 'Have a garage freezer, basement shelf or bar cart? Add it in Settings and it shows up here.'],
  ['.stat', '📊 Quick counts', 'Use soon = expiring within your warning window. Running low = at or below the restock level you set. On the list = items still to buy. Tap one to jump to that list.'],
  ['[data-labelall]', '🏷️ Label your dates', 'These items only have estimated dates. Tap to walk through them one by one and enter the date printed on each package.'],
  ['.tile', '⏰ Use it or lose it', 'Items closest to their date. Tap one for details, to mark it used, or to find recipes that use it.'],
  ['.sugg', '💡 You should get', 'Suggestions from items running low, things you usually keep, and ingredients your planned meals need. Tap ＋ to add one to your list.'],

  // inside storage
  ['[data-labelsec], .inside [data-label]', '🏷️ Label this shelf', 'Walk the shelf item by item: confirm how much is there and enter the date printed on the package. That replaces the estimate.'],
  ['.add-jar', '＋ Add to this shelf', 'Add an item straight onto this shelf.'],
  ['.jar', '🫙 An item', 'Tap for details. Its color matches its aisle. A dot in the corner means red = expired, orange = use soon, blue = running low.'],
  ['.inside .chips .chip', '📂 Sections', 'Show one shelf or drawer at a time, or all of them.'],

  // stock
  ['[data-step]', '➕➖ Quick adjust', 'Tap − when you use some and ＋ when you add more. Items with several batches use up the oldest first.'],
  ['[data-status]', '🚦 Freshness filter', 'Use soon = close to the date. Low = at or below your restock level. Undated = still on estimated dates, so go label them.'],
  ['[data-zones] .chip', '📍 Place filter', 'Show only one place, like just the fridge or just the pantry.'],
  ['[data-cats] .chip', '🎨 Aisle filter', 'Show one aisle. Each aisle has a color, and items are tinted with it so similar emoji are easy to tell apart.'],
  ['[data-group]', '🗂️ Group by', 'Organize the list by location, aisle, or how soon things expire.'],
  ['.irow', '📦 Item', 'Shows its name, exact location and status. ≈ means the date is estimated. Tap for details, batches, restock and dates.'],

  // recipes
  ['[data-tabs]', '🍳 Recipe views', 'Cook = recipes ranked by what you have. All = the full book. Saved = your hearts. Online = search thousands more from TheMealDB.'],
  ['.ring', '⭕ Match score', 'How many required ingredients you have. Green = ready to cook, orange = close, red = you need several things.'],
  ['.fav', '❤️ Save', 'Heart a recipe to keep it under Saved.'],
  ['.rcard', '📖 Recipe', 'Tap to see ingredients checked against your shelves, scale servings, add missing items to your list, plan it on the calendar, or mark it cooked.'],
  ['[data-type]', '🍽️ Meal type', 'Filter by breakfast, lunch, dinner, sides, desserts, snacks or drinks.'],
  ['[data-addmissing]', '🛒 Add missing', 'Puts only what you don’t have, or don’t have enough of, on your shopping list, scaled to your servings.'],
  ['[data-cooked]', '👩‍🍳 I cooked this', 'Pick what you used and Shelf & Stock takes it out of stock. It can also save leftovers to the fridge.'],
  ['.ing', '🥕 Ingredient', '✓ = you have it, ½ = you have some but not enough, ✕ = missing. Tap the location to see exactly where it is.'],

  // plan
  ['[data-auto]', '✨ Auto-plan week', 'Fills empty dinners for the next 7 days with recipes you can make, using food that’s about to expire first.'],
  ['[data-shopall]', '🛒 Shop for 2 weeks', 'Adds everything your planned meals over the next 14 days still need.'],
  ['.cal-day', '📅 A day', 'Tap a day to see its plans. Emoji are planned meals. Dots: green = meal, gold = gathering, blue = reminder. The corner icon marks a holiday.'],
  ['.cal-nav', '↔️ Change month', 'Move between months, or jump back to today.'],
  ['.ev', '🍽️ Planned event', 'Tap for the menu, what to buy for your guest count, prep tips like when to thaw the turkey, and what to pull from storage.'],
  ['[data-add]', '➕ Add a plan', 'Plan a meal, a gathering with guests, or a reminder on the selected day.'],

  // list
  ['.addbar', '📝 Quick add', 'Type an item and press Enter. You can include an amount, like “2 lb apples”.'],
  ['[data-putaway]', '📦 Put away', 'Moves everything you checked off into your kitchen, then offers to walk through reading the real dates off the packages.'],
  ['.cb', '☑️ Check off', 'Tick items as you shop. Swipe a row right to check it, or left to remove it.'],
  ['[data-share]', '📤 Share', 'Send the list by text or any app, or copy it to the clipboard.'],
  ['.lrow', '🧾 List item', 'The note underneath explains why it’s here, like a planned recipe or running low.'],

  ['[data-tour=sync]', '☁️ Household sync', 'Start a household on one phone, then enter its code on the others. Everyone shares one kitchen, list and calendar, and changes sync automatically. It keeps working offline and catches up later.'],
  ['[data-recalls]', '🛡️ Food recalls', 'Checks the FDA’s public list of US food recalls from the last 90 days against what’s in your kitchen and on your list. A barcode match is that exact product; a brand match means check the lot code on your package.'],
  ['[data-unitprice]', '⚖️ Which is cheaper?', 'Type the price and size from two shelf tags and it tells you which is cheaper per ounce, fluid ounce or count, even across units like lb vs oz.'],
  ['[data-season-add]', '🌱 In season', 'Produce that’s in season this month, so it’s usually cheaper and tastier. Tap to add it to the list.'],
  ['[data-openprices]', '🏷️ Prices others reported', 'Prices other shoppers shared for this exact barcode through Open Prices, a free open database from Open Food Facts.'],
  ['[data-set-back]', '◀ Back', 'Goes back one step in Settings. The phone’s back button does the same.'],
  ['[data-room]', '🧱 A wall of the kitchen', 'Every cabinet, drawer and appliance on that wall. Tap to pick one and rename it or its shelves.'],
  ['[data-zone]', '🗄️ A storage place', 'Tap to rename it, change its type, add or remove shelves, or delete it.'],
  ['.set-row', '⚙️ Settings section', 'Tap to open it. The line underneath shows what it’s set to right now.'],
  ['.fr-door', '🚪 Door bins', 'The bins on the inside of each fridge door: dressings and syrups on the left, condiments, jams, milk and juice on the right.'],

  // sheets
  ['[data-a=restock]', '➕ Restock', 'Adds a new batch with its own printed date, so mixing old and new milk still gives accurate “use soon” alerts.'],
  ['[data-a=date]', '📅 Printed date', 'Enter the Best by / Use by / Sell by date from the package to replace the estimate.'],
  ['[data-a=used]', '✅ Used it up', 'Removes it from your kitchen and offers to add it to your shopping list.'],
  ['[data-a=toss]', '🗑️ Tossed', 'Removes it and logs it as waste, so Settings › Kitchen report can show what you throw out most.'],
  ['[data-a=move]', '↔️ Move', 'Move it to another shelf. Moving into or out of the freezer updates its date.'],
  ['[data-a=where]', '📍 Show me', 'Opens the cabinet it’s in with the item highlighted.'],
  ['[data-dtype]', '🏷️ Date type', 'Best by = quality, Use by = safety, Sell by = store date, Freeze by = freeze before this.'],
  ['.nf', '🧾 Nutrition Facts', 'Real label data from Open Food Facts, pulled from the barcode or label search.'],
  ['.grade', '🅰️ Nutri-Score', 'An A (best) to E nutrition grade from Open Food Facts.'],
  ['.stepper', '🔢 Amount', 'Use − and ＋ or type a number.'],
];

const VIEW_HELP = {
  kitchen: ['🏠 Kitchen', 'Your kitchen at a glance. Tap doors to open storage, check what to use soon, see what’s planned and what you should buy.'],
  stock: ['📋 Stock', 'Every item you have, where it is, and how fresh it is.'],
  recipes: ['🍳 Recipes', 'Find something to cook with what you have.'],
  plan: ['📅 Plan', 'Meals, gatherings and holidays on a calendar.'],
  list: ['🛒 Shopping list', 'What to buy. Check things off in the store, then put them away at home.'],
  settings: ['⚙️ Settings', 'Make Shelf & Stock match your real kitchen. Pick a section to open it.'],
};

let on = false, banner, bubble, lit;

export function toggleHelp(currentView) {
  on ? exitHelp() : enterHelp(currentView);
}

function enterHelp(currentView) {
  on = true;
  document.body.classList.add('help-mode');
  banner = document.createElement('div');
  banner.className = 'help-banner wood-dark';
  banner.innerHTML = `<span>❓ <b>Help mode</b> — tap anything to learn about it</span><button class="btn btn-brass btn-sm" data-helpdone>Done</button>`;
  document.body.appendChild(banner);
  banner.querySelector('[data-helpdone]').onclick = exitHelp;
  document.addEventListener('click', intercept, true);
  haptic(15);
  show(null, ...VIEW_HELP[currentView()] || VIEW_HELP.kitchen, true);
  enterHelp.view = currentView;
}

export const helpOn = () => on;

export function exitHelp() {
  on = false;
  document.body.classList.remove('help-mode');
  document.removeEventListener('click', intercept, true);
  banner?.remove(); bubble?.remove(); lit?.classList.remove('help-lit');
  banner = bubble = lit = null;
}

function intercept(e) {
  if (e.target.closest('.help-banner')) return;
  if (e.target.closest('[data-act=help]')) { e.preventDefault(); e.stopPropagation(); return exitHelp(); } // ? again = done
  if (e.target.closest('.help-bubble')) { if (e.target.closest('[data-gotit]')) { bubble.remove(); lit?.classList.remove('help-lit'); } return; }
  e.preventDefault(); e.stopPropagation();
  for (const [sel, title, body] of HELP) {
    const el = e.target.closest(sel);
    if (el) return show(el, title, body);
  }
  const v = enterHelp.view?.() || 'kitchen';
  show(null, ...VIEW_HELP[v], true);
}

function show(el, title, body, general = false) {
  haptic(10);
  lit?.classList.remove('help-lit');
  lit = el; el?.classList.add('help-lit');
  bubble?.remove();
  bubble = document.createElement('div');
  bubble.className = 'help-bubble wood-dark';
  bubble.innerHTML = `<h3>${esc(title)}</h3><p>${esc(body)}</p>${general ? '<p class="small" style="opacity:.75;margin-top:-4px">Tap any button, door or item to learn what it does.</p>' : ''}<div style="text-align:right"><button class="btn btn-brass btn-sm" data-gotit>Got it</button></div>`;
  document.body.appendChild(bubble);
  if (el) {
    const r = el.getBoundingClientRect();
    const below = r.top + r.height / 2 < innerHeight * 0.5;
    bubble.style.top = below ? Math.min(r.bottom + 12, innerHeight - bubble.offsetHeight - 16) + 'px' : Math.max(70, r.top - bubble.offsetHeight - 12) + 'px';
  } else { bubble.style.top = 'auto'; bubble.style.bottom = 'calc(var(--nav-h) + var(--safe-b) + 16px)'; }
}
