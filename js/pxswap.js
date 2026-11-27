// Swaps the game emoji in the app's own text (coins, food, medals, tower, pets…) for the 16×16 pixel icons
// from pixel-icons.js, so they look the same on every phone. Each icon gets an aria-label in the current
// language. Text people typed themselves (chat, captions, reactions, inputs) is left alone.
import { pxIcon } from './pixel-icons.js';
import { t } from './i18n.js';

const MAP = {
  '💧': ['coin', 'coins', '金幣'], '🍫': ['protein_bar', 'Protein Bar', '蛋白棒'], '🥩': ['steak', 'Steak', '牛扒'],
  '🧃': ['potion', 'Drink', '飲品'], '🛡️': ['shield', 'Shield', '盾牌'], '🛡': ['shield', 'Shield', '盾牌'],
  '📜': ['scroll', 'Move scroll', '招式卷軸'], '🥇': ['medal_1', '1st', '第一'], '🥈': ['medal_2', '2nd', '第二'],
  '🥉': ['medal_3', '3rd', '第三'], '🏆': ['trophy', 'Trophy', '獎盃'], '🐶': ['bitch_dog', 'The bitch', '包尾狗'],
  '🗼': ['tower', 'Tower', '塔'], '🐾': ['pets', 'Pets', '寵物'], '📖': ['dex', 'Dex', '圖鑑'],
  '👑': ['lair', 'Crown', '皇冠'], '🏪': ['shop', 'Shop', '商店'],
};
const RE = /🛡️|🛡|💧|🍫|🥩|🧃|📜|🥇|🥈|🥉|🏆|🐶|🗼|🐾|📖|👑|🏪/g;
const SKIP = 'input, textarea, select, script, style, svg, canvas, [contenteditable], [data-no-px], .msg, .msg-menu, .emoji-grid, .emoji-scroll, .reacts, .react-pick, .post, .toast';

function swap(root) {
  if (!root || root.nodeType !== 1 && root.nodeType !== 3) return;
  const nodes = [];
  if (root.nodeType === 3) nodes.push(root);
  else { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) nodes.push(n); }
  for (const n of nodes) {
    const s = n.nodeValue; RE.lastIndex = 0;
    if (!s || !RE.test(s)) continue;
    const host = n.parentElement;
    if (!host || host.closest(SKIP)) continue;
    // inside an aria-label or title the emoji is plain text: only text nodes are changed
    const frag = document.createDocumentFragment(); let last = 0; RE.lastIndex = 0;
    for (const m of s.matchAll(RE)) {
      if (m.index > last) frag.append(s.slice(last, m.index));
      const [name, en, zh] = MAP[m[0]];
      const span = document.createElement('span'); span.className = 'px-wrap';
      span.innerHTML = pxIcon(name, 16, t(en, zh));
      frag.append(span); last = m.index + m[0].length;
    }
    if (last < s.length) frag.append(s.slice(last));
    n.replaceWith(frag);
  }
}

export function startPxSwap() {
  swap(document.body);
  new MutationObserver(list => {
    for (const r of list) {
      if (r.type === 'characterData') swap(r.target);
      else r.addedNodes.forEach(swap);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
