// The weekly group boss (co-op raid): on each gym day you get one attack, a turn-based fight of up to
// 8 moves; what it counts for comes off the boss's HP, and lower-level players count for more.
// Beat it by Sunday night for loot. Numbers come from group_boss (migrations 026 and 032).
import * as api from './supa.js';
import { t, getLang } from './i18n.js';
import { esc, toast, showError } from './ui.js';
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
      <span class="muted small">${t(`${m.hits ?? 0} attack${m.hits === 1 ? '' : 's'}`, `攻擊 ${m.hits ?? 0} 次`)}</span><b>${m.dmg}</b></li>`).join('')}</ol>
    ${b.defeated && b.loot_elsewhere ? `<p class="muted small raid-wait">${t('You already got this week’s boss loot in another group (one per week).', '你今個星期已經喺另一個 group 攞咗戰利品（每星期一份）。')}</p>` : ''}
    ${b.defeated ? '' : b.open ? `<a class="button" href="#/battle/${b.open}">${t('Back to your attack', '返去繼續攻擊')}</a>`
      : b.can_attack ? `<button type="button" id="raidGo">⚔️ ${t('Attack the boss', '攻擊魔王')}</button>`
      : `<p class="muted small raid-wait">${t('One attack per gym day. Check in to attack.', '每個 gym 日攻擊一次。打卡之後就可以攻擊。')}</p>`}
    <details class="cc-how"><summary>${t('How it works', '點樣玩')}</summary><ul>
      <li>${t('A new boss every Monday. Its HP is 100 for every day of everyone’s weekly target.', '每個星期一有新魔王。血量 = 大家每星期目標日數加埋 × 100。')}</li>
      <li>${t('Each gym day you get one attack: up to 8 moves against the boss. Showing up is worth 70, fighting well up to 60 more.', '每個 gym 日有一次攻擊機會，同魔王打最多 8 招。出席已經值 70，打得好再加最多 60。')}</li>
      <li>${t('The boss is matched to you, so newcomers count as much as big lifters.', '魔王會跟你嘅實力調整，新手同大隻佬一樣有份。')}</li>
      <li>${t('Lower level than the group average? Your attack counts up to 50% more (⚡).', '等級低過 group 平均？攻擊最多多計 50%（⚡）。')}</li>
      <li>${t('Beat it by Sunday and everyone gets 60 💧 and 80 XP.', '星期日之前打低佢，全部人都有 60 💧 同 80 經驗。')}</li>
      <li>${t('In more than one group? One attack a day counts for all of them, and you get loot once a week.', '喺多過一個 group？每日一次攻擊會計落全部 group，戰利品每星期攞一份。')}</li></ul></details>
  </section>`;
}

export async function mountBoss(el, b, groupId) {
  const cv = el.querySelector('#bossCanvas'); if (!cv || !b) return;
  el.querySelector('#raidGo')?.addEventListener('click', async e => {
    e.target.disabled = true;
    try { const id = await api.raidFight(groupId); location.hash = `#/battle/${id}`; } catch (err) { e.target.disabled = false; showError(err); }
  });
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
