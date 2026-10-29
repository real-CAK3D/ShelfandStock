// Fluent Emoji 3D icons (Microsoft, MIT): every emoji drawn in the app is swapped for a 3D
// picture so items look the same on every phone. Bundled images first (offline), the CDN for
// anything else, and the phone's own emoji if neither loads. Settings › Icon style can turn it off.

import { state, subscribe } from '../store.js';
import { LOCAL } from '../../vendor/emoji/index.js';

const CDN = 'https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets/';
const RE = /\p{Extended_Pictographic}[️⃣]?(?:‍\p{Extended_Pictographic}️?)*/gu;
const SKIP = new Set(['©', '®', '™', '‼', '⁉', '↔', '↔️', '▶']);
const NO = 'input,textarea,select,option,title,script,style,svg,[data-noemo],.emo';

const hex = e => [...e].map(c => c.codePointAt(0).toString(16)).join('-');
function srcFor(e) {
  for (const h of [hex(e), hex(e.replace(/️/g, '')), hex(e.replace(/️/g, '')) + '-fe0f']) if (LOCAL.has(h)) return 'vendor/emoji/' + h + '.webp';
  return CDN + hex(e) + '.webp';
}

export const fluentOn = () => (state.settings.icons || 'fluent') === 'fluent';

function img(e) {
  const i = document.createElement('img');
  i.className = 'emo'; i.alt = e; i.draggable = false; i.decoding = 'async';
  i.src = srcFor(e);
  i.onerror = () => { i.replaceWith(document.createTextNode(e)); };
  return i;
}

function swapText(node) {
  const t = node.nodeValue;
  if (!t || !RE.test(t)) return;
  RE.lastIndex = 0;
  const p = node.parentElement;
  if (!p || p.closest(NO)) return;
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of t.matchAll(RE)) {
    if (SKIP.has(m[0])) continue;
    if (m.index > last) frag.append(t.slice(last, m.index));
    frag.append(img(m[0]));
    last = m.index + m[0].length;
  }
  if (!last) return;
  if (last < t.length) frag.append(t.slice(last));
  node.replaceWith(frag);
}

function scan(root) {
  if (!fluentOn()) return;
  if (root.nodeType === 3) return swapText(root);
  if (root.nodeType !== 1 || root.closest?.(NO)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(swapText);
}

let obs;
export function startEmoji() {
  document.documentElement.dataset.icons = state.settings.icons || 'fluent';
  scan(document.body);
  obs = new MutationObserver(list => { if (!fluentOn()) return; for (const m of list) { if (m.type === 'characterData') swapText(m.target); else m.addedNodes.forEach(scan); } });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  let mode = state.settings.icons || 'fluent';
  subscribe(() => {
    const now = state.settings.icons || 'fluent';
    if (now === mode) return;
    mode = now; document.documentElement.dataset.icons = now;
    if (now === 'fluent') scan(document.body);
    else document.querySelectorAll('img.emo').forEach(i => i.replaceWith(document.createTextNode(i.alt)));
  });
}
