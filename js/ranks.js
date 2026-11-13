// Group rankings. Gym days, weekly target and weight change, then one ranking per exercise:
// each person's heaviest set (at least 1 rep). Nothing is added together, and only exercises
// someone in the group has logged appear, with only the people who logged them.
import * as api from './supa.js';
import { t, monthName, fmtDay } from './i18n.js';
import { EX, vGrade } from './exercises.js';
import { exName } from './tracker.js';
import { esc, render } from './ui.js';

const MEDAL = ['🥇', '🥈', '🥉'];
const CAT_ZH = { chest: '胸', back: '背', legs: '腿', shoulders: '肩', arms: '手臂', core: '核心', other: '其他' };
const CAT_EN = { chest: 'Chest', back: 'Back', legs: 'Legs', shoulders: 'Shoulders', arms: 'Arms', core: 'Core', other: 'Other' };

function general() {
  const m = monthName();
  return [
    { id: 'days', zero: true, label: t('Gym days', '去 gym 日數'), note: t(`Check-in days in ${m}`, `${m}打卡日數`), get: r => r.days_month,
      suf: v => t(v === 1 ? ' day' : ' days', ' 日'), fmt: v => t(`${v} day${v === 1 ? '' : 's'}`, `${v} 日`) },
    { id: 'target', label: t('Weekly target', '每週目標'), note: t('Days each week they aim for', '每星期想去幾多日'), get: r => r.days_target, fmt: v => t(`${v}/week`, `每星期 ${v} 日`) },
    { id: 'weight', zero: true, label: t('Weight change', '體重變化'), note: t('Since first weigh-in. Only people who share body details, most lost first.', '由第一次記錄計起。只計有分享身體資料嘅人，減得最多排先。'),
      get: r => r.weight_change_kg == null ? null : +r.weight_change_kg, fmt: v => `${v > 0 ? '+' : ''}${+v.toFixed(1)} kg`, asc: true }
  ];
}

const kgTxt = v => `${+(+v).toFixed(2)} kg`;
const setsTxt = n => t(`${n} set${n === 1 ? '' : 's'}`, `${n} 組`);

export async function ranksScreen(user, groupId, measureId = 'days') {
  const groups = await api.myGroups();
  const g = groups.find(x => x.id === groupId) || groups[0];
  if (!g) { location.hash = '#/all'; return; }
  const [rows, exRows] = await Promise.all([api.groupRankings(g.id), api.groupExerciseRanks(g.id)]);

  // exercises someone here has a record for, most people first, then by name
  const byEx = {};
  for (const r of exRows) if (EX[r.exercise_id]) (byEx[r.exercise_id] ||= []).push(r);
  const exIds = Object.keys(byEx).sort((a, b) => byEx[b].length - byEx[a].length || exName(a).localeCompare(exName(b)));
  const gen = general();
  const isEx = !!byEx[measureId];
  const m = isEx ? null : gen.find(x => x.id === measureId) || gen[0];
  const chip = (id, label, on) => `<button role="tab" aria-selected="${on}" data-m="${id}" class="${on ? 'on' : ''}">${esc(label)}</button>`;

  let body;
  if (isEx && EX[measureId].climb) {
    // climbing: hardest V grade topped, then most climbs topped
    const list = byEx[measureId].map(r => ({ r, g: +r.best_kg })).sort((a, b) => b.g - a.g || b.r.sets_total - a.r.sets_total);
    const top = Math.max(...list.map(x => x.g + 1), 1);
    body = `<div class="card-head"><h3>${esc(exName(measureId))}</h3><span class="muted small">${t('Other', '其他')}</span></div>
      <p class="muted small">${t('Hardest grade topped, then most climbs topped', '頂過最難嘅級數，然後頂得最多條')}</p>
      <ol class="rank">${list.map((x, i) => `<li class="${x.r.user_id === user.id ? 'me' : ''}">
          <span class="pos">${MEDAL[i] || i + 1}</span>
          <div class="who"><a href="#/p/${x.r.user_id}">${esc(x.r.display_name)}</a>
            <span class="muted small">${esc(t(`${x.r.sets_total} topped`, `頂咗 ${x.r.sets_total} 條`))} · ${t('last', '上次')} ${esc(fmtDay(x.r.last_on))}</span>
            <span class="bar"><i style="width:${Math.round((x.g + 1) / top * 100)}%"></i></span></div>
          <b>${vGrade(x.g)}</b></li>`).join('')}</ol>`;
  } else if (isEx) {
    const list = byEx[measureId].map(r => ({ r, kg: +r.best_kg, reps: r.best_reps || 0 }))
      .sort((a, b) => b.kg - a.kg || b.reps - a.reps);
    const bw = list.every(x => x.kg === 0), top = Math.max(...list.map(x => (bw ? x.reps : x.kg)), 1);
    const cat = EX[measureId].cat, timedEx = !!EX[measureId].timed, unit = timedEx ? 's' : '';
    body = `<div class="card-head"><h3>${esc(exName(measureId))}</h3><span class="muted small">${esc(t(CAT_EN[cat], CAT_ZH[cat]))}</span></div>
      <p class="muted small">${timedEx ? (bw ? t('Longest hold', '撐得最耐') : t('Heaviest hold, then longest', '最重，然後撐得最耐')) : bw ? t('Most reps in one set', '一組做最多次') : t('Heaviest set, at least 1 rep', '最少 1 下嘅最重一組')}</p>
      <ol class="rank">${list.map((x, i) => `<li class="${x.r.user_id === user.id ? 'me' : ''}">
          <span class="pos">${MEDAL[i] || i + 1}</span>
          <div class="who"><a href="#/p/${x.r.user_id}">${esc(x.r.display_name)}</a>
            <span class="muted small">${esc(setsTxt(x.r.sets_total))} · ${t('last', '上次')} ${esc(fmtDay(x.r.last_on))}</span>
            <span class="bar"><i style="width:${Math.round((bw ? x.reps : x.kg) / top * 100)}%"></i></span></div>
          <b>${bw ? `<span data-count="${x.reps}"${timedEx ? ' data-suffix="s"' : ''}>${x.reps}${unit}</span>${timedEx ? '' : ` ${t('reps', '次')}`}` : `<span data-count="${x.kg}" data-suffix=" kg">${kgTxt(x.kg)}</span><small class="reps">× ${x.reps}${unit}</small>`}</b></li>`).join('')}</ol>`;
  } else {
    const withVal = rows.map(r => ({ r, v: m.get(r) })), has = withVal.filter(x => x.v != null && (x.v !== 0 || m.zero));
    has.sort((a, b) => (m.asc ? a.v - b.v : b.v - a.v));
    const without = withVal.filter(x => !has.includes(x));
    const top = Math.max(...has.map(x => Math.abs(x.v)), 1);
    body = `<div class="card-head"><h3>${esc(m.label)}</h3></div>
      <p class="muted small">${esc(m.note)}</p>
      ${has.length ? `<ol class="rank">${has.map((x, i) => `<li class="${x.r.user_id === user.id ? 'me' : ''}">
          <span class="pos">${MEDAL[i] || i + 1}</span>
          <div class="who"><a href="#/p/${x.r.user_id}">${esc(x.r.display_name)}</a><span class="bar"><i style="width:${Math.round(Math.abs(x.v) / top * 100)}%"></i></span></div>
          <b>${m.suf ? `<span data-count="${Math.round(x.v)}" data-suffix="${esc(m.suf(x.v))}">${esc(m.fmt(x.v))}</span>` : esc(m.fmt(x.v))}</b></li>`).join('')}</ol>`
        : `<p class="muted">${t('Nobody on this one yet.', '暫時未有人。')}</p>`}
      ${without.length ? `<p class="muted small">${t('Not on this list yet', '未上榜')}: ${without.map(x => esc(x.r.display_name)).join(', ')}</p>` : ''}`;
  }

  const el = render(`
    <header class="page-head"><div><h2>${t('Rankings', '排名')}</h2><p class="muted">${esc(g.name)}${groups.length > 1 ? ` · <a href="#/all">${t('switch group', '轉 group')}</a>` : ''}</p></div></header>
    <div class="chips scroll" role="tablist" aria-label="${t('Ranking', '排名項目')}">${gen.map(x => chip(x.id, x.label, !isEx && x.id === m.id)).join('')}</div>
    ${exIds.length ? `<div class="rank-ex"><p class="muted small">${t('Exercises', '動作')}</p>
      <div class="chips scroll" role="tablist" aria-label="${t('Exercises', '動作')}">${exIds.map(id => chip(id, exName(id), id === measureId)).join('')}</div></div>`
      : `<p class="muted small">${t('Exercise rankings show up once someone logs a workout.', '有人記錄訓練之後，就會有每個動作嘅排名。')}</p>`}
    <section class="card">${body}</section>`);
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { location.hash = `#/r/${g.id}/${b.dataset.m}`; });
  el.querySelectorAll('.chips .on').forEach(c => c.scrollIntoView({ inline: 'center', block: 'nearest' }));
}
