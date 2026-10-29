// First-run welcome slides + spotlight walkthrough. Replayable from Settings.

import { state, update, seedSample } from '../store.js';
import { $, esc, haptic, confetti } from './dom.js';
import { actions } from '../router.js';

const SLIDES = [
  { art: '🏡', orbit: ['🥛', '🥕', '🧀', '🍞', '🥫', '🍎'], title: 'Welcome to Shelf & Stock', body: 'Your whole kitchen in your pocket: the fridge, freezer, every cabinet, the pantry and the holiday closet.' },
  { art: '📅', orbit: ['🦃', '🎄', '🏈', '🥞', '🎂', '🌮'], title: 'Plan meals & gatherings', body: 'Put dinners and holidays on the calendar. Shelf & Stock checks your shelves and builds the shopping list for you.' },
  { art: '👩‍🍳', orbit: ['🍝', '🥗', '🍪', '🍲', '🥧', '🍳'], title: 'Cook with what you have', body: 'Recipes show what you can make right now, rescue food before it expires, and list only what you’re missing.' },
  { art: '🏷️', orbit: ['📷', '📦', '⏰', '✅', '🛒', '📍'], title: 'Real labels, real dates', body: 'Scan barcodes for real product labels and nutrition. Keep each batch’s printed date so “use soon” means something.' },
];

export function welcome() {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'welcome wood-dark';
    el.innerHTML = `
      <div class="slides">${SLIDES.map((s, i) => `<div class="slide ${i === 0 ? 'cur' : ''}"><div class="art">${s.art}<div class="orbit">${s.orbit.map((o, j) => { const a = (j / s.orbit.length) * Math.PI * 2; return `<span style="left:${50 + 46 * Math.cos(a)}%;top:${50 + 46 * Math.sin(a)}%;margin:-18px 0 0 -18px">${o}</span>`; }).join('')}</div></div><h1>${esc(s.title)}</h1><p>${esc(s.body)}</p></div>`).join('')}</div>
      <div class="foot">
        <div class="wdots">${SLIDES.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
        <div data-nav style="width:100%;max-width:360px;display:flex;gap:10px"><button class="btn btn-wood grow" data-skip style="background:rgba(255,255,255,.08)">Skip</button><button class="btn btn-brass grow" data-next>Next</button></div>
        <div data-choose class="hidden" style="width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-brass btn-block" data-sample>🏠 Explore a sample kitchen</button>
          <button class="btn btn-wood btn-block" data-empty style="background:rgba(255,255,255,.08)">Start with an empty kitchen</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    let i = 0;
    const show = n => {
      i = n;
      el.querySelector('.slides').style.transform = `translateX(-${i * 100}%)`;
      el.querySelectorAll('.slide').forEach((s, k) => s.classList.toggle('cur', k === i));
      el.querySelectorAll('.wdots i').forEach((d, k) => d.classList.toggle('on', k === i));
      const last = i === SLIDES.length - 1;
      el.querySelector('[data-nav]').classList.toggle('hidden', last);
      el.querySelector('[data-choose]').classList.toggle('hidden', !last);
      haptic();
    };
    let x0 = null;
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (dx < -50 && i < SLIDES.length - 1) show(i + 1); if (dx > 50 && i > 0) show(i - 1); x0 = null; });
    const finish = sample => {
      if (sample) seedSample();
      update(s => { s.settings.onboarded = true; }, 'onboard');
      el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.08)' }], { duration: 450, easing: 'ease-in', fill: 'forwards' });
      setTimeout(() => { el.remove(); resolve(sample); }, 460);
    };
    el.querySelector('[data-next]').onclick = () => show(i + 1);
    el.querySelector('[data-skip]').onclick = () => show(SLIDES.length - 1);
    el.querySelector('[data-sample]').onclick = () => finish(true);
    el.querySelector('[data-empty]').onclick = () => finish(false);
  });
}

const STEPS = [
  { view: 'kitchen', sel: '[data-tour=scene]', title: 'This is your kitchen', body: 'Every door opens. Tap one to swing it open and see what’s on each shelf. Badges show counts — orange means something expires soon, red means it already did.' },
  { view: 'kitchen', sel: '[data-tour=fridge]', title: 'The fridge', body: 'Shelves, crispers, deli drawer and door bins, each one tracked separately. The freezer drawer sits below it.' },
  { view: 'kitchen', sel: '[data-tour=cabinets]', title: 'Cabinets & pantry', body: 'Baking and spices, canned goods, snacks, pots and pans. Rename them to match your real kitchen in Settings.' },
  { view: 'kitchen', sel: '[data-tour=holiday]', title: 'Holiday closet', body: 'Roasting pan, cookie cutters, the good platter. Tag them “thanksgiving” or “christmas” and they show up on that holiday with exactly where they are.' },
  { view: 'kitchen', sel: '[data-tour=garage-tab]', title: 'Swipe to the garage', body: 'Swipe the kitchen left, or tap Garage, to get to the upright freezer and the garage fridge with its top freezer. Every door opens the same way.' },
  { view: 'kitchen', sel: '[data-act=me]', title: 'That’s you', body: 'Everything you do is signed with your name, so the house sees things like “Andrew requested coffee”. Tap your picture to switch person or change your PIN.' },
  { view: 'kitchen', sel: '[data-act=help]', title: 'Help, anytime', body: 'Tap ? and then tap anything on screen. Shelf & Stock explains what it is and how to use it.' },
  { view: 'kitchen', sel: '.fab', title: 'Add groceries', body: 'Search 200+ foods, scan a barcode for the real label and nutrition, or add anything custom. Shelf & Stock suggests the shelf and an expiration date.' },
  { view: 'kitchen', sel: '[data-act=search]', title: 'Find anything', body: '“Where’s the cinnamon?” Search shows the exact cabinet and shelf, then opens it with the item highlighted.' },
  { view: 'stock', sel: '.tab[data-v=stock]', title: 'Stock', body: 'Everything in one list. Filter just the fridge, just one cabinet, one aisle, things expiring soon, or undated items you still need to label.' },
  { view: 'recipes', sel: '.tab[data-v=recipes]', title: 'Recipes', body: '“Cook now” ranks recipes by what you have. Open one to see what’s missing, where each ingredient is, and add the rest to your list in one tap.' },
  { view: 'plan', sel: '[data-tour=calendar]', title: 'Plan the week, and the year', body: 'Meals, gatherings and holidays. Auto-plan fills your dinners using food that’s about to expire. Gatherings scale recipes to your guest count.' },
  { view: 'list', sel: '[data-tour=list-add]', title: 'Shopping list', body: 'Tick items off in the store. At home, tap “Put away” and they go into your kitchen, then read the real dates off the packages.' },
  { view: 'kitchen', sel: null, title: 'You’re all set! 🎉', body: 'Try opening the fridge first. You can replay this tour anytime from Settings.' },
];

export async function tour() {
  let i = 0;
  const blocker = Object.assign(document.createElement('div'), { className: 'tour-blocker' });
  const hole = Object.assign(document.createElement('div'), { className: 'tour-hole' });
  const tip = Object.assign(document.createElement('div'), { className: 'tour-tip wood-dark' });
  document.body.append(blocker, hole, tip);
  const end = () => { blocker.remove(); hole.remove(); tip.remove(); update(s => { s.settings.tourDone = true; }, 'tour'); actions.go('kitchen'); };
  const step = async () => {
    const s = STEPS[i];
    if (actions.current() !== s.view) { actions.go(s.view); await new Promise(r => setTimeout(r, 380)); }
    const target = s.sel && document.querySelector(s.sel);
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 350));
      const r = target.getBoundingClientRect(), pad = 8;
      Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px', opacity: 1, borderRadius: target.classList.contains('fab') ? '50%' : '18px' });
      const below = r.top + r.height / 2 < innerHeight / 2;
      tip.style.top = below ? Math.min(r.bottom + 18, innerHeight - 230) + 'px' : 'auto';
      tip.style.bottom = below ? 'auto' : Math.max(innerHeight - r.top + 18, 20) + 'px';
    } else {
      Object.assign(hole.style, { left: '50%', top: '45%', width: '0px', height: '0px' });
      tip.style.top = '36%'; tip.style.bottom = 'auto';
      confetti(innerWidth / 2, innerHeight * .35, 50);
    }
    tip.innerHTML = `<h3>${esc(s.title)}</h3><p>${esc(s.body)}</p><div class="row"><div class="tour-dots">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div><div class="row" style="gap:8px">${i < STEPS.length - 1 ? '<button class="btn btn-sm btn-wood" data-skip style="background:rgba(255,255,255,.08)">Skip</button>' : ''}<button class="btn btn-sm btn-brass" data-next>${i < STEPS.length - 1 ? 'Next' : 'Let’s go'}</button></div></div>`;
    tip.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
    tip.querySelector('[data-next]').onclick = () => { haptic(); i++; i < STEPS.length ? step() : end(); };
    tip.querySelector('[data-skip]')?.addEventListener('click', end);
  };
  step();
}
