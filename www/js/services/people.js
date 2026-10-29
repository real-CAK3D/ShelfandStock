// Household members and the PIN lock. Members (with salted PIN hashes) live in the shared
// state so the same people and PINs work on every synced phone; who is signed in is per phone.
// This is a family convenience lock, not bank-grade security.

import { state, update, uid } from '../store.js';

const SESSION = 'shelfstock.session';
export const DEFAULT_PIN = '0000';
export const COLORS = ['#c0533b', '#4f86a3', '#6f8f4e', '#9c6b8e', '#d9952b', '#7a5a3a', '#3f8f8a', '#b4523f'];
// Pick-able icons (not faces)
export const AVATARS = ['🍳', '🎮', '🌻', '⚓', '🥕', '🧀', '🍕', '🌮', '🍩', '☕', '🐾', '⭐', '🎸', '🏈', '🌙', '🍀', '🔥', '🌵', '🦋', '🚀'];

async function hash(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}:shelf&stock`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function newMember(name, emoji, color) {
  const salt = uid();
  return { id: 'm-' + uid(), name: name.trim(), emoji: emoji || '⭐', color: color || COLORS[state.members?.length % COLORS.length || 0], photo: '', salt, pin: await hash(DEFAULT_PIN, salt), mustReset: true };
}

export async function seedMembers(names = ['Andrew', 'Zayne', 'Gemmie', 'Poppy']) {
  const emojis = AVATARS;
  const out = [];
  for (const [i, n] of names.entries()) out.push(await newMember(n, emojis[i % emojis.length], COLORS[i % COLORS.length]));
  return out;
}

export async function addMember(name, emoji) {
  const m = await newMember(name, emoji, COLORS[(state.members || []).length % COLORS.length]);
  update(s => { (s.members ||= []).push(m); }, 'member');
  return m;
}

export const checkPin = async (m, pin) => (await hash(pin, m.salt)) === m.pin;

export async function setPin(memberId, pin) {
  const salt = uid(), h = await hash(pin, salt);
  update(s => { const m = s.members.find(x => x.id === memberId); m.salt = salt; m.pin = h; m.mustReset = false; }, 'member');
}

export async function resetPin(memberId) {
  const salt = uid(), h = await hash(DEFAULT_PIN, salt);
  update(s => { const m = s.members.find(x => x.id === memberId); m.salt = salt; m.pin = h; m.mustReset = true; }, 'member');
}

export function signIn(id) { try { localStorage.setItem(SESSION, id); } catch { } }
export function signOut() { try { localStorage.removeItem(SESSION); } catch { } }
export function currentId() { try { return localStorage.getItem(SESSION); } catch { return null; } }
export const me = () => (state.members || []).find(m => m.id === currentId()) || null;
export const memberById = id => (state.members || []).find(m => m.id === id) || null;
export const firstName = id => memberById(id)?.name || 'Someone';

export function avatar(m, size = 34) {
  if (!m) return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${size * .55}px;background:var(--paper-3)">👤</span>`;
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${size * .55}px;background:${m.color}">${m.photo ? `<img src="${m.photo}" alt="">` : m.emoji}</span>`;
}
