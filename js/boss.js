// The weekly group boss (co-op): everyone's gym days and sets chip away at its HP; lower-level players
// hit harder. Beat it by Sunday night for loot. Numbers come from group_boss (migration 026).
import * as api from './supa.js';
import { t, getLang } from './i18n.js';
import { esc, toast } from './ui.js';
import { drawBoss, BOSSES } from './pixel.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const bossName = i => { const b = BOSSES[i % BOSSES.length]; return t(b.en, b.zh); };
const londonToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());

export function bossCardHtml(b) {
  if (!b || !b.members?.length) return '';
  const left = Math.max(0, b.hp - b.dmg), pct = b.hp ? Math.round(left / b.hp * 100) : 0;
  const daysLeft = Math.max(0, Math.round((new Date(`${b.week_end}T12:00:00Z`) - new Date(`${londonToday()}T12:00:00Z`)) / 864e5) + 1);
  const name = bossName(b.boss);
  return `<section class="card boss-card ${b.defeated ? 'beaten' : ''}" id="bossCard">
    <div class="card-head"><h3>${b.defeated ? t(`${name} is down! 🎉`, `${name} 打低咗！🎉`) : t(`This week’s boss: ${name}`, `本週魔王：${name}`)}</h3>
      <span class="muted small">${b.defeated ? '' : t(`${daysLeft} day${daysLeft === 1 ? '' : 's'} left`, `仲有 ${daysLeft} 日`)}</span></div>
    <div class="boss-stage"><canvas id="bossCanvas" width="192" height="160" role="img" aria-label="${esc(name)}"></canvas></div>
    <div class="boss-hp" role="progressbar" aria-valuemin="0" aria-valuemax="${b.hp}" aria-valuenow="${left}" aria-label="${t('Boss HP', '魔王血量')}"><i style="width:${pct}%"></i><span>HP ${left} / ${b.hp}</span></div>
    <ol class="boss-dmg">${b.members.map(m => `<li><span class="nm">${esc(m.name)}</span>
      ${m.mult > 1 ? `<span class="ud" title="${t('Underdog bonus: lower level than the group average', '以弱勝強：等級低過 group 平均')}">⚡ ×${m.mult}</span>` : ''}
      <span class="muted small">${t(`${m.days} day${m.days === 1 ? '' : 's'}`, `${m.days} 日`)}</span><b>${m.dmg}</b></li>`).join('')}</ol>
    <details class="cc-how"><summary>${t('How it works', '點樣玩')}</summary><ul>
      <li>${t('A new boss every Monday. Its HP is 100 for every day of everyone’s weekly target.', '每個星期一有新魔王。血量 = 大家每星期目標日數加埋 × 100。')}</li>
      <li>${t('Each gym day hits it for 100, each set for 2 more.', '每日去 gym 打 100，每做一組再打多 2。')}</li>
      <li>${t('Lower level than the group average? You hit up to 50% harder (⚡).', '等級低過 group 平均？攻擊最多加 50%（⚡）。')}</li>
      <li>${t('Beat it by Sunday and everyone gets 60 💧 and 80 XP.', '星期日之前打低佢，全部人都有 60 💧 同 80 經驗。')}</li></ul></details>
  </section>`;
}

export async function mountBoss(el, b, groupId) {
  const cv = el.querySelector('#bossCanvas'); if (!cv || !b) return;
  const state = b.defeated ? 'ko' : 'idle';
  let f = 0; drawBoss(cv, b.boss, 0, state);
  const tick = setInterval(() => { if (!document.body.contains(cv)) return clearInterval(tick); if (!reduced()) { f ^= 1; drawBoss(cv, b.boss, f, state); } }, 600);
  // loot: this week's if beaten, and last week's if it was beaten and not picked up yet
  const lastWeek = new Date(`${b.week_start}T12:00:00Z`); lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  const got = [];
  try {
    if (b.defeated && !b.claimed) { const r = await api.claimBoss(groupId); if (r) got.push(r); }
    const r2 = await api.claimBoss(groupId, lastWeek.toISOString().slice(0, 10)); if (r2) got.push(r2);
  } catch { /* try next time */ }
  if (got.length) toast(got.map(r => t(`Loot from ${bossName(r.boss)}: +${r.coins} 💧 +${r.xp} XP`, `${bossName(r.boss)} 戰利品：+${r.coins} 💧 +${r.xp} 經驗`)).join(' · '));
}
