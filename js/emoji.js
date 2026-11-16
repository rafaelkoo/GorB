// Pick any emoji for a reaction: your recent ones, a grid of common ones, or anything from the
// phone's own emoji keyboard (type it in the box). Resolves with the emoji, or null if closed.
import { t } from './i18n.js';
import { sheetIn } from './motion.js';

const RECENT_KEY = 'gob_recent_emoji';
const SETS = [
  ['Faces', '表情', '😀 😂 🤣 😅 😊 😍 🥰 😘 😎 🤩 🥳 😏 🤔 🫡 🤨 😐 😴 🥱 😮 😱 😭 😤 😡 🤯 🥵 🥶 🤢 🤮 😈 💀 🤡 👀'],
  ['Hands', '手勢', '👍 👎 👏 🙌 🙏 🤝 💪 🦾 ✌️ 🤞 🤟 🤘 👌 🤌 👊 ✊ 🫶 👋 ☝️ 🫵'],
  ['Gym', '健身', '🏋️ 🏃 🚴 🧗 🤸 🏊 🥊 ⚽ 🏀 🎾 🏆 🥇 🥈 🥉 🎯 ⏱️ 🔥 ⚡ 💯 🚀 📈 📉'],
  ['Hearts', '心心', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❤️‍🔥 💕 💖'],
  ['Food', '食物', '🍗 🥩 🍳 🥚 🥦 🍌 🍎 🥑 🍚 🍜 🍕 🍔 🍟 🍩 🍺 🥤 ☕ 🧃 💊'],
  ['Other', '其他', '🎉 ✨ 💤 💩 🐐 🦍 🐻 🐷 🐔 🦵 🧠 💀 ☠️ 🚨 ✅ ❌ ❓ ‼️ 🆗 🆒']
].map(([en, zh, s]) => [en, zh, s.split(' ')]);

const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
// the first emoji in what was typed (keeps skin tones, flags and joined emoji whole)
export function firstEmoji(s) {
  const parts = seg ? [...seg.segment(s)].map(x => x.segment) : Array.from(s);
  return parts.find(g => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g) && [...g].length <= 8) || null;
}

const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } };
export function rememberEmoji(e) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([e, ...recent().filter(x => x !== e)].slice(0, 16))); } catch { /* private mode */ }
}

export function pickEmoji(current) {
  return new Promise(done => {
    const back = document.activeElement;
    const box = document.createElement('div');
    box.className = 'sheet emoji-sheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t('Pick an emoji', '揀個 emoji'));
    const btn = e => `<button type="button" data-e="${e}" class="${e === current ? 'on' : ''}" aria-label="${e}">${e}</button>`;
    const rec = recent();
    box.innerHTML = `<div class="sheet-in">
      <div class="ex-head"><h3>${t('Pick an emoji', '揀個 emoji')}</h3><button type="button" class="ghost x" id="close" aria-label="${t('Close', '關閉')}">✕</button></div>
      <label class="field emoji-type">${t('Any emoji: type it from your keyboard', '任何 emoji：用鍵盤打')}
        <input id="anyEmoji" autocomplete="off" enterkeyhint="done" placeholder="${t('Tap here, then the 😊 key', '撳呢度，再撳鍵盤個 😊')}"></label>
      <div class="emoji-scroll">
        ${rec.length ? `<h4>${t('Recent', '最近用過')}</h4><div class="emoji-grid">${rec.map(btn).join('')}</div>` : ''}
        ${SETS.map(([en, zh, l]) => `<h4>${t(en, zh)}</h4><div class="emoji-grid">${l.map(btn).join('')}</div>`).join('')}
      </div></div>`;
    document.body.appendChild(box); sheetIn(box.querySelector('.sheet-in'));
    const end = e => {
      box.remove(); document.removeEventListener('keydown', esc);
      if (e) rememberEmoji(e);
      try { back?.focus?.({ preventScroll: true }); } catch { /* gone */ }
      done(e || null);
    };
    const esc = e => { if (e.key === 'Escape') end(null); };
    document.addEventListener('keydown', esc);
    box.onclick = e => { if (e.target === box) end(null); };
    box.querySelector('#close').onclick = () => end(null);
    box.querySelectorAll('[data-e]').forEach(b => b.onclick = () => end(b.dataset.e));
    const inp = box.querySelector('#anyEmoji');
    inp.oninput = () => { const e = firstEmoji(inp.value); if (e) end(e); else if (inp.value && !/\s$/.test(inp.value)) inp.setCustomValidity(t('That isn’t an emoji', '呢個唔係 emoji')); };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const x = firstEmoji(inp.value); if (x) end(x); else { inp.value = ''; } } };
    box.querySelector('[data-e]')?.focus({ preventScroll: true });
  });
}
