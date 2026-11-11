// Group rankings: one ranked list per measure, everyone in the group.
import * as api from './supa.js';
import { t, monthName } from './i18n.js';
import { exName, pbBoardHtml } from './tracker.js';
import { LEVEL_XP } from './score.js';
import { esc, render } from './ui.js';

const MEDAL = ['🥇', '🥈', '🥉'];

function measures() {
  const m = monthName();
  return [
    { id: 'points', zero: true, label: t('Points', '分數'), note: t(`Points in ${m}: set 5 · workout 15 · PR 25 · habit 5 · check-in 10`, `${m}分數：每組 5 · 訓練 15 · PR 25 · 習慣 5 · 打卡 10`), get: r => r.points_month, fmt: v => t(`${v.toLocaleString()} pts`, `${v.toLocaleString()} 分`) },
    { id: 'sets', zero: true, label: t('Sets', '組數'), note: t(`Sets done in ${m}, at least 1 rep`, `${m}做咗嘅組數（最少 1 下）`), get: r => r.sets_month, fmt: v => t(`${v} set${v === 1 ? '' : 's'}`, `${v} 組`) },
    { id: 'level', zero: true, label: t('Level', '等級'), note: t(`All-time points, a level every ${LEVEL_XP}`, `總分數，每 ${LEVEL_XP} 分升一級`), get: r => r.points_total, fmt: v => t(`Lv ${Math.floor(v / LEVEL_XP) + 1} · ${v.toLocaleString()}`, `第 ${Math.floor(v / LEVEL_XP) + 1} 級 · ${v.toLocaleString()}`) },
    { id: 'days', zero: true, label: t('Gym days', '去 gym 日數'), note: t(`Check-in days in ${m}`, `${m}打卡日數`), get: r => r.days_month, fmt: v => t(`${v} day${v === 1 ? '' : 's'}`, `${v} 日`) },
    { id: 'target', label: t('Weekly target', '每週目標'), note: t('Days each week they aim for', '每星期想去幾多日'), get: r => r.days_target, fmt: v => t(`${v}/week`, `每星期 ${v} 日`) },
    { id: 'workouts', zero: true, label: t('Workouts', '訓練次數'), note: t(`Workouts logged in ${m}`, `${m}記錄嘅訓練`), get: r => r.workouts_month, fmt: v => `${v}` },
    { id: 'volume', zero: true, label: t('Volume', '總重量'), note: t(`kg × reps, all sets in ${m}`, `${m}所有組數 kg × 次數`), get: r => +r.volume_month, fmt: v => `${Math.round(v).toLocaleString()} kg` },
    { id: 'total', label: t('Big 4 total', '四大項總和'), note: t('Bench + deadlift + squat + OHP bests', '臥推 + 硬舉 + 深蹲 + 推舉最佳'), get: r => ['bench', 'deadlift', 'squat', 'ohp'].reduce((s, k) => s + (+r[k] || 0), 0) || null, fmt: v => `${+v.toFixed(1)} kg` },
    { id: 'bench', label: exName('bench_press'), note: t('Heaviest set, at least 1 rep', '最少 1 下嘅最重一組'), get: r => r.bench && +r.bench, fmt: v => `${+v} kg` },
    { id: 'deadlift', label: exName('deadlift'), note: t('Heaviest set, at least 1 rep', '最少 1 下嘅最重一組'), get: r => r.deadlift && +r.deadlift, fmt: v => `${+v} kg` },
    { id: 'squat', label: exName('squat'), note: t('Heaviest set, at least 1 rep', '最少 1 下嘅最重一組'), get: r => r.squat && +r.squat, fmt: v => `${+v} kg` },
    { id: 'ohp', label: exName('ohp'), note: t('Heaviest set, at least 1 rep', '最少 1 下嘅最重一組'), get: r => r.ohp && +r.ohp, fmt: v => `${+v} kg` },
    { id: 'weight', zero: true, label: t('Weight change', '體重變化'), note: t('Since first weigh-in. Only people who share body details, most lost first.', '由第一次記錄計起。只計有分享身體資料嘅人，減得最多排先。'), get: r => r.weight_change_kg == null ? null : +r.weight_change_kg, fmt: v => `${v > 0 ? '+' : ''}${+v.toFixed(1)} kg`, asc: true }
  ];
}

export async function ranksScreen(user, groupId, measureId = 'points') {
  const groups = await api.myGroups();
  const g = groups.find(x => x.id === groupId) || groups[0];
  if (!g) { location.hash = '#/all'; return; }
  const [rows, pbs] = await Promise.all([api.groupRankings(g.id), pbBoardHtml(g.id, user.id)]);
  const all = measures(), m = all.find(x => x.id === measureId) || all[0];
  const withVal = rows.map(r => ({ r, v: m.get(r) })), has = withVal.filter(x => x.v != null && (x.v !== 0 || m.zero));
  has.sort((a, b) => m.asc ? a.v - b.v : b.v - a.v);
  const without = withVal.filter(x => !has.includes(x));
  const top = Math.max(...has.map(x => Math.abs(x.v)), 1);
  const el = render(`
    <header class="page-head"><div><h2>${t('Rankings', '排名')}</h2><p class="muted">${esc(g.name)}${groups.length > 1 ? ` · <a href="#/all">${t('switch group', '轉 group')}</a>` : ''}</p></div></header>
    <div class="chips scroll" role="tablist" aria-label="${t('Measure', '項目')}">${all.map(x => `<button role="tab" aria-selected="${x.id === m.id}" data-m="${x.id}" class="${x.id === m.id ? 'on' : ''}">${esc(x.label)}</button>`).join('')}</div>
    <section class="card">
      <div class="card-head"><h3>${esc(m.label)}</h3></div>
      <p class="muted small">${esc(m.note)}</p>
      ${has.length ? `<ol class="rank">${has.map((x, i) => `<li class="${x.r.user_id === user.id ? 'me' : ''}">
          <span class="pos">${MEDAL[i] || i + 1}</span>
          <div class="who"><a href="#/p/${x.r.user_id}">${esc(x.r.display_name)}</a><span class="bar"><i style="width:${Math.round(Math.abs(x.v) / top * 100)}%"></i></span></div>
          <b>${esc(m.fmt(x.v))}</b></li>`).join('')}</ol>`
        : `<p class="muted">${t('Nobody on this one yet.', '暫時未有人。')}</p>`}
      ${without.length ? `<p class="muted small">${t('Not on this list yet', '未上榜')}: ${without.map(x => esc(x.r.display_name)).join(', ')}</p>` : ''}
    </section>
    <section class="card"><h3>${t('Personal bests', '個人最佳')}</h3>${pbs}</section>`);
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { location.hash = `#/r/${g.id}/${b.dataset.m}`; });
  el.querySelector('.chips .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
