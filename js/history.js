// Past months of the gym/bitch board. The board itself restarts on the 1st of every month (London
// time); finished months land here with who went most (🏆) and who was the bitch (fewest days).
import * as api from './supa.js';
import { t, getLang } from './i18n.js';
import { esc, render } from './ui.js';
import { tally } from './icons.js';

const monthLabel = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString(getLang() === 'zh' ? 'zh-HK' : 'en-GB', { month: 'long', year: 'numeric' });

// a month's result: winners (most days) and bitches (fewest), with no bitch when everyone tied
export function monthResult(rows) {
  if (!rows.length) return { top: [], low: [] };
  const hi = Math.max(...rows.map(r => r.days)), lo = Math.min(...rows.map(r => r.days));
  return {
    top: hi > 0 ? rows.filter(r => r.days === hi) : [],
    low: rows.length > 1 && lo !== hi ? rows.filter(r => r.days === lo) : []
  };
}

export async function historyScreen(user, groupId) {
  const groups = await api.myGroups();
  const g = groups.find(x => x.id === groupId) || groups[0];
  if (!g) { location.hash = '#/all'; return; }
  const rows = await api.groupHistory(g.id);
  const months = [...new Set(rows.map(r => r.month))];
  const byMonth = Object.fromEntries(months.map(m => [m, rows.filter(r => r.month === m)]));

  // all-time tally of titles per person
  const titles = {};
  for (const m of months) {
    const { top, low } = monthResult(byMonth[m]);
    for (const r of byMonth[m]) titles[r.user_id] ||= { name: r.display_name, gym: 0, bitch: 0, days: 0 };
    top.forEach(r => titles[r.user_id].gym++);
    low.forEach(r => titles[r.user_id].bitch++);
    byMonth[m].forEach(r => { titles[r.user_id].days += r.days; });
  }
  const people = Object.entries(titles).sort((a, b) => b[1].gym - a[1].gym || a[1].bitch - b[1].bitch || b[1].days - a[1].days);
  const nextReset = new Date(); nextReset.setMonth(nextReset.getMonth() + 1, 1);
  const resetLabel = nextReset.toLocaleDateString(getLang() === 'zh' ? 'zh-HK' : 'en-GB', { day: 'numeric', month: 'long' });

  render(`<header class="page-head"><div><h2>${t('History', '歷史')}</h2><p class="muted">${esc(g.name)}</p></div>
      <a class="link" href="#/g/${g.id}">‹ ${t('Group', 'Group')}</a></header>
    <p class="muted small">${t(`The board restarts on the 1st of every month. This month moves here on ${resetLabel}.`, `排行榜每個月 1 號重新計。今個月嘅結果會喺 ${resetLabel} 搬嚟呢度。`)}</p>
    ${months.length ? `
      <section class="card"><div class="card-head"><h3>${t('All time', '總計')}</h3><span class="muted small">${t(`${months.length} month${months.length === 1 ? '' : 's'}`, `${months.length} 個月`)}</span></div>
        <ol class="titles">${people.map(([id, p]) => `<li class="${id === user.id ? 'me' : ''}"><a href="#/p/${id}">${esc(p.name)}</a>
          <span class="tt"><span title="${t('Months with the most days', '最多日數嘅月份')}">🏆 ${p.gym}</span><span title="${t('Months as the bitch', '包尾嘅月份')}">🐶 ${p.bitch}</span><span class="muted">${t(`${p.days} days`, `${p.days} 日`)}</span></span></li>`).join('')}</ol>
      </section>
      ${months.map(m => {
        const list = byMonth[m], { top, low } = monthResult(list);
        return `<section class="card hist-month"><div class="card-head"><h3>${esc(monthLabel(m))}</h3></div>
          <div class="hist-badges">
            ${top.length ? `<span class="hb gym">🏆 ${t('Gym', '最勤力')}: <b>${esc(top.map(r => r.display_name).join(', '))}</b> · ${t(`${top[0].days} days`, `${top[0].days} 日`)}</span>` : ''}
            ${low.length ? `<span class="hb bitch">🐶 ${t('Bitch', '包尾')}: <b>${esc(low.map(r => r.display_name).join(', '))}</b> · ${t(`${low[0].days} days`, `${low[0].days} 日`)}</span>` : `<span class="hb">${t('No bitch: everyone tied', '冇人包尾：大家一樣')}</span>`}
          </div>
          <details><summary>${t('Full table', '成個排行榜')}</summary>
            <ol class="board">${list.map((r, i) => `<li class="${r.user_id === user.id ? 'me' : ''}${low.includes(r) ? ' bitch' : ''}"><span class="pos">${i + 1}</span>
              <div class="who"><span class="name">${esc(r.display_name || '?')}</span>${tally(r.days, t(`${r.days} days`, `${r.days} 日`))}</div><b>${r.days}</b></li>`).join('')}</ol>
          </details></section>`;
      }).join('')}`
    : `<section class="card empty"><p>${t('No finished months yet.', '仲未有完咗嘅月份。')}</p>
        <p class="muted">${t(`This month's board moves here on ${resetLabel}, and a new month starts from zero.`, `今個月嘅排行榜會喺 ${resetLabel} 搬嚟呢度，然後新一個月由零開始。`)}</p></section>`}`);
}
