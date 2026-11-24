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
  let qs, sh = null;
  try { [qs, sh] = await Promise.all([api.myQuests(), api.shieldStatus().catch(() => null)]); } catch { card.hidden = true; return; }
  const draw = () => {
    const day = qs.filter(q => q.period === 'day'), week = qs.filter(q => q.period === 'week');
    const ready = qs.filter(q => q.progress >= q.target && !q.claimed).length;
    card.querySelector('#qCount').textContent = ready ? t(`${ready} to claim`, `${ready} 個可以領`) : '';
    const shield = sh?.worth ? `<div class="q-shield"><b>🛡️ ${t(`You missed your target last week (${sh.last_week_days}/${sh.target} days)`, `上個星期未達標（${sh.last_week_days}/${sh.target} 日）`)}</b>
      <span class="small">${t(`A shield keeps your ${sh.streak_if_shielded - 1}-week streak going.`, `用保護盾可以保住你連續 ${sh.streak_if_shielded - 1} 個星期嘅紀錄。`)}</span>
      ${sh.shields > 0 ? `<button type="button" class="small-btn" id="qShield">🛡️ ${t(`Use a shield (you have ${sh.shields})`, `用保護盾（你有 ${sh.shields} 個）`)}</button>`
        : `<a class="link small" href="#/shop">${t('No shields left: get one in the shop', '冇保護盾喇：去商店買')}</a>`}</div>` : '';
    card.querySelector('#qBody').innerHTML = `${shield}<h4 class="q-h">${t('Today', '今日')}</h4><ul class="q-list">${day.map(row).join('')}</ul>
      <h4 class="q-h">${t('This week', '今個星期')}${week[0]?.streak ? ` <span class="q-streak">🔥 ${t(`${week[0].streak}-week streak: +${Math.min(5, week[0].streak) * 10}% coins`, `連續 ${week[0].streak} 個星期達標：金幣 +${Math.min(5, week[0].streak) * 10}%`)}</span>` : ''}</h4><ul class="q-list">${week.map(row).join('')}</ul>
      <p class="muted small">${t('Targets follow your own usual, so they get harder as you get fitter. Hit your days target week after week for up to +50% coins on weekly quests.', '目標跟你自己平時嘅水平，你越勁目標就越高。連續每個星期達到目標日數，每週任務金幣最多 +50%。')}</p>`;
    card.querySelector('#qShield')?.addEventListener('click', async e => {
      e.target.disabled = true;
      try { sh = await api.useShield(); qs = await api.myQuests(); toast(t(`Streak kept: ${sh.streak} weeks 🔥`, `保住咗：連續 ${sh.streak} 個星期 🔥`)); draw(); }
      catch (err) { e.target.disabled = false; showError(err); }
    });
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
