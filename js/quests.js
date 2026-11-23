// Personal quests (daily + weekly), scaled to your own habits on the server (migration 028).
import * as api from './supa.js';
import { t } from './i18n.js';
import { esc, toast, showError } from './ui.js';

const TITLE = {
  checkin: () => t('Check in at the gym', '去 gym 打卡'),
  sets: q => t(`Do ${q.target} sets`, `做 ${q.target} 組`),
  days: q => t(`Go ${q.target} day${q.target == 1 ? '' : 's'} this week`, `今個星期去夠 ${q.target} 日`),
  new: () => t('Try an exercise you’ve never done', '試一個未做過嘅動作'),
  cardio: q => t(`${q.target} min of cardio`, `做 ${q.target} 分鐘 cardio`)
};
const reward = q => `+${q.coins} 💧${q.xp ? ` +${q.xp} ${t('XP', '經驗')}` : ''}`;

function row(q) {
  const done = q.progress >= q.target, pct = Math.round(q.progress / q.target * 100);
  return `<li class="quest ${q.claimed ? 'claimed' : done ? 'ready' : ''}">
    <div class="q-main"><b>${esc((TITLE[q.id] || (() => q.id))(q))}</b>
      <span class="q-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
      <span class="muted small">${q.progress} / ${q.target} · ${reward(q)}</span></div>
    ${q.claimed ? `<span class="q-done">✓</span>` : done ? `<button class="small-btn" data-claim="${q.id}">${t('Claim', '領取')}</button>` : ''}</li>`;
}

export function questsCardHtml() {
  return `<section class="card quests-card" id="questsCard"><div class="card-head"><h3>${t('Quests', '任務')}</h3><span class="muted small" id="qCount"></span></div><div id="qBody"><p class="muted small">${t('Loading…', '載入緊…')}</p></div></section>`;
}

export async function mountQuests(el) {
  const card = el.querySelector('#questsCard'); if (!card) return;
  let qs;
  try { qs = await api.myQuests(); } catch { card.hidden = true; return; }
  const draw = () => {
    const day = qs.filter(q => q.period === 'day'), week = qs.filter(q => q.period === 'week');
    const ready = qs.filter(q => q.progress >= q.target && !q.claimed).length;
    card.querySelector('#qCount').textContent = ready ? t(`${ready} to claim`, `${ready} 個可以領`) : '';
    card.querySelector('#qBody').innerHTML = `<h4 class="q-h">${t('Today', '今日')}</h4><ul class="q-list">${day.map(row).join('')}</ul>
      <h4 class="q-h">${t('This week', '今個星期')}</h4><ul class="q-list">${week.map(row).join('')}</ul>
      <p class="muted small">${t('Targets follow your own usual, so they get harder as you get fitter.', '目標跟你自己平時嘅水平，你越勁目標就越高。')}</p>`;
    card.querySelectorAll('[data-claim]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await api.claimQuest(b.dataset.claim);
        const q = qs.find(x => x.id === b.dataset.claim); if (q) q.claimed = true;
        draw();
        if (r) { navigator.vibrate?.(30); toast(t(`Quest done! +${r.coins} 💧${r.xp ? ` +${r.xp} XP` : ''}`, `任務完成！+${r.coins} 💧${r.xp ? ` +${r.xp} 經驗` : ''}`)); }
      } catch (err) { b.disabled = false; showError(err); }
    });
  };
  draw();
}
