// Rewards you get for showing up: the check-in treasure chest (and the welcome-back bonus).
// The server decides what's inside (migration 024); this just opens it with a bit of drama.
import * as api from './supa.js';
import { t } from './i18n.js';
import { drawChest } from './pixel.js';

const londonDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// after a check-in: show today's chest if it hasn't been opened on this phone yet
export async function openTodayChest() {
  const day = londonDay(), seenKey = `gob_chest_${day}`;
  try { if (localStorage.getItem(seenKey)) return; } catch { /* fine */ }
  let rows = [];
  try { rows = await api.todayRewards(day); } catch { return; }
  const chest = rows.find(r => r.kind === 'chest');
  if (!chest) return;
  try { localStorage.setItem(seenKey, '1'); } catch { /* fine */ }
  const back = rows.find(r => r.kind === 'comeback');
  return new Promise(done => {
    const box = document.createElement('div');
    box.className = 'chest-wrap'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t('Treasure chest', '寶箱'));
    box.innerHTML = `<div class="chest-card">
      <h3>${back ? t('Welcome back! 💪', '歡迎返嚟！💪') : t('You showed up!', '你嚟咗 gym！')}</h3>
      <canvas width="240" height="216" aria-hidden="true"></canvas>
      <p class="chest-msg" aria-live="polite">${t('Tap the chest to open it', '撳個寶箱打開佢')}</p>
      <button class="big" id="chestBtn">${t('Open', '打開')}</button></div>`;
    document.body.appendChild(box);
    const cv = box.querySelector('canvas'), msg = box.querySelector('.chest-msg'), btn = box.querySelector('#chestBtn');
    let f = 0, state = 'shut', timer = setInterval(() => { f ^= 1; drawChest(cv, state, f, chest.meta?.big); }, 260);
    drawChest(cv, 'shut', 0, chest.meta?.big);
    btn.focus();
    const close = () => { clearInterval(timer); box.remove(); done(); };
    const open = () => {
      if (state !== 'shut') return close();
      state = 'shake'; btn.disabled = true; navigator.vibrate?.([30, 40, 30]);
      setTimeout(() => {
        state = 'open'; drawChest(cv, 'open', 0, chest.meta?.big); navigator.vibrate?.(chest.meta?.big ? [60, 50, 120] : 40);
        const lines = [`<b class="chest-coins">+${chest.coins} 💧</b>`];
        if (chest.meta?.big) lines.unshift(`<span class="chest-big">${t('BIG CHEST!', '大獎！')}</span>`);
        if (chest.xp) lines.push(t(`+${chest.xp} XP`, `+${chest.xp} 經驗`));
        if (back) lines.push(t(`Welcome-back bonus: +${back.xp} XP (${back.meta?.days_away} days away)`, `歡迎返嚟獎勵：+${back.xp} 經驗（停咗 ${back.meta?.days_away} 日）`));
        msg.innerHTML = lines.join('<br>');
        btn.disabled = false; btn.textContent = t('Nice', '正'); btn.focus();
      }, reduced() ? 0 : 900);
    };
    btn.onclick = open; cv.onclick = open;
    box.onkeydown = e => { if (e.key === 'Escape') close(); };
  });
}
