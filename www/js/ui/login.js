// "Who's in the kitchen?" — tap your picture, enter your 4-digit PIN.
// First time: the PIN is 0000, then you must choose your own PIN and confirm it.

import { state } from '../store.js';
import { me, checkPin, setPin, signIn, addMember, avatar, DEFAULT_PIN, AVATARS } from '../services/people.js';
import { esc, haptic, toast, confetti } from './dom.js';

export function loginScreen({ cancellable = false } = {}) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'login wood-dark';
    document.body.appendChild(el);
    const close = m => { el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.04)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' }); setTimeout(() => { el.remove(); resolve(m); }, 310); };

    const pickScreen = () => {
      el.innerHTML = `
        <div class="login-inner">
          <img src="icons/icon.svg" alt="" class="login-logo">
          <h1>Who's in the kitchen?</h1>
          <p>Tap your picture to sign in.</p>
          <div class="login-grid">
            ${(state.members || []).map((m, i) => `<button class="login-person" data-m="${m.id}" style="animation-delay:${i * .07}s">${avatar(m, 76)}<b>${esc(m.name)}</b>${m.mustReset ? '<small>New · PIN 0000</small>' : ''}</button>`).join('')}
            <button class="login-person add" data-add style="animation-delay:${(state.members || []).length * .07}s"><span class="avatar" style="width:76px;height:76px;font-size:34px;background:rgba(255,255,255,.12)">＋</span><b>Add person</b></button>
          </div>
          ${cancellable ? '<button class="btn btn-wood" data-cancel style="background:rgba(255,255,255,.08);margin-top:18px">Cancel</button>' : ''}
        </div>`;
      el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { haptic(); pinScreen(state.members.find(m => m.id === b.dataset.m)); });
      el.querySelector('[data-add]').onclick = addScreen;
      el.querySelector('[data-cancel]')?.addEventListener('click', () => close(null));
    };

    const addScreen = () => {
      let emoji = AVATARS[(state.members || []).length % AVATARS.length];
      el.innerHTML = `
        <div class="login-inner">
          <h1>Add someone</h1>
          <p>Their first PIN will be <b>0000</b>. They'll pick their own the first time they sign in.</p>
          <input class="input" data-name placeholder="Name" maxlength="20" style="max-width:300px;margin:8px auto 14px;text-align:center;font-size:18px">
          <div class="login-emojis">${AVATARS.map(a => `<button data-e="${a}" class="${a === emoji ? 'on' : ''}">${a}</button>`).join('')}</div>
          <div class="row" style="justify-content:center;gap:10px;margin-top:18px"><button class="btn btn-wood" data-back style="background:rgba(255,255,255,.08)">Back</button><button class="btn btn-brass" data-save>Add</button></div>
        </div>`;
      el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { emoji = b.dataset.e; el.querySelectorAll('[data-e]').forEach(x => x.classList.toggle('on', x === b)); haptic(); });
      el.querySelector('[data-back]').onclick = pickScreen;
      el.querySelector('[data-save]').onclick = async () => {
        const name = el.querySelector('[data-name]').value.trim();
        if (!name) return toast('Type a name first');
        await addMember(name, emoji); haptic(20); pickScreen();
      };
      setTimeout(() => el.querySelector('[data-name]').focus(), 100);
    };

    // stage: 'enter' → (first time) 'new' → 'confirm'
    const pinScreen = (m, stage = 'enter', first = '') => {
      const titles = { enter: `Hi ${m.name}!`, new: 'Choose your own PIN', confirm: 'Type it again to verify' };
      const subs = { enter: m.mustReset ? 'First time? Your PIN is 0000.' : 'Enter your 4-digit PIN.', new: 'Pick 4 digits only you know.', confirm: 'Just to be sure.' };
      let pin = '';
      el.innerHTML = `
        <div class="login-inner">
          ${avatar(m, 84)}
          <h1>${esc(titles[stage])}</h1>
          <p data-sub>${esc(subs[stage])}</p>
          <div class="pin-dots">${[0, 1, 2, 3].map(() => '<i></i>').join('')}</div>
          <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button data-back class="ghost">‹ Back</button><button data-n="0">0</button><button data-del class="ghost">⌫</button></div>
        </div>`;
      const dots = [...el.querySelectorAll('.pin-dots i')];
      const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
      const shake = msg => { haptic(60); el.querySelector('.pin-dots').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-12px)' }, { transform: 'translateX(12px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(0)' }], { duration: 380 }); el.querySelector('[data-sub]').textContent = msg; pin = ''; paint(); };
      const submit = async () => {
        if (stage === 'enter') {
          if (!await checkPin(m, pin)) return shake('That’s not it — try again.');
          if (m.mustReset) return pinScreen(m, 'new');
          return finish(m);
        }
        if (stage === 'new') {
          if (pin === DEFAULT_PIN) return shake('Pick something other than 0000.');
          return pinScreen(m, 'confirm', pin);
        }
        if (pin !== first) return shake('Those didn’t match — try again.');
        await setPin(m.id, pin);
        toast('PIN saved', { icon: '🔐' });
        finish(state.members.find(x => x.id === m.id));
      };
      el.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { if (pin.length >= 4) return; pin += b.dataset.n; haptic(8); paint(); if (pin.length === 4) setTimeout(submit, 120); });
      el.querySelector('[data-del]').onclick = () => { pin = pin.slice(0, -1); paint(); };
      el.querySelector('[data-back]').onclick = pickScreen;
    };

    const finish = m => {
      signIn(m.id);
      confetti(innerWidth / 2, innerHeight / 2, 24);
      toast(`Welcome, ${m.name}!`, { icon: m.emoji });
      close(m);
    };

    pickScreen();
  });
}

export const signedIn = () => !!me();
