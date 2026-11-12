// Points, levels, weekly muscle coverage and daily habits (FitTrack's game layer).
// Points are worked out from what's actually logged, so they can't drift or be edited:
//   set done 5 · workout saved 15 · PR broken 25 · habit 5 (FitTrack's values) · check-in 10 (Gym or Bitch)
import { EX, CATS, WD } from './exercises.js';
import { t } from './i18n.js';

export const PTS = { set: 5, workout: 15, pr: 25, habit: 5, checkin: 10 };
export const LEVEL_XP = 500;
// FitTrack's weekly targets were points (5 per set): chest 75 = 15 sets
export const WEEK_SETS = { chest: 15, back: 15, legs: 15, shoulders: 10, arms: 10, core: 5 };

// rows = lift_history rows; returns per-day points and totals
export function points(rows, habits, checkinDays, weekStart) {
  const day = {}; const add = (d, n) => { day[d] = (day[d] || 0) + n; };
  const best = {}, seenWorkout = new Set();
  // walk sessions in date order so a PR only counts when it beats an earlier best
  const byDayEx = {};
  for (const r of rows) {
    if (r.reps >= 1) add(r.performed_on, PTS.set);
    if (!seenWorkout.has(r.performed_on)) { seenWorkout.add(r.performed_on); add(r.performed_on, PTS.workout); }
    const k = r.performed_on + '|' + r.exercise_id;
    if (r.reps >= 1) byDayEx[k] = Math.max(byDayEx[k] || 0, +r.weight_kg);
  }
  let prs = 0;
  for (const k of Object.keys(byDayEx).sort()) {
    const [d, id] = k.split('|'), top = byDayEx[k];
    if (best[id] != null && top > best[id]) { add(d, PTS.pr); prs++; }
    best[id] = Math.max(best[id] ?? 0, top);
  }
  for (const h of habits) add(h.day, PTS.habit);
  for (const d of new Set(checkinDays)) add(d, PTS.checkin);
  const total = Object.values(day).reduce((a, b) => a + b, 0);
  const week = Object.entries(day).filter(([d]) => d >= weekStart).reduce((a, [, v]) => a + v, 0);
  return { day, total, week, prs, level: Math.floor(total / LEVEL_XP) + 1, xp: total % LEVEL_XP };
}

// sets per body part since weekStart
export function coverage(rows, weekStart) {
  const c = {};
  for (const r of rows) if (r.performed_on >= weekStart && r.reps >= 1) { const cat = EX[r.exercise_id]?.cat; if (cat) c[cat] = (c[cat] || 0) + 1; }
  return c;
}

const CAT_ZH = { chest: '胸', back: '背', legs: '腿', shoulders: '肩', arms: '手臂', core: '核心', other: '其他' };
const DAY_ZH = { Mon: '一', Tue: '二', Wed: '三', Thu: '四', Fri: '五', Sat: '六', Sun: '日' };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function levelCardHtml(p, weekStart) {
  const days = WD.map((d, i) => ({ d, v: p.day[addDays(weekStart, i)] || 0 }));
  const top = Math.max(1, ...days.map(x => x.v));
  return `<section class="card level">
    <div class="card-head"><h3>${t(`Level ${p.level}`, `第 ${p.level} 級`)}</h3><span class="muted small"><span data-count="${p.total}" data-suffix="${t(' points', ' 分')}">${t(`${p.total.toLocaleString()} points`, `${p.total.toLocaleString()} 分`)}</span></span></div>
    <span class="bar xp"><i style="width:${Math.round(p.xp / LEVEL_XP * 100)}%"></i></span>
    <p class="muted small">${t(`${LEVEL_XP - p.xp} to level ${p.level + 1} · ${p.week} this week`, `仲差 ${LEVEL_XP - p.xp} 分升第 ${p.level + 1} 級 · 今個星期 ${p.week} 分`)}</p>
    <div class="dbars" role="img" aria-label="${t('Points per day this week', '今個星期每日分數')}">${days.map(x => `<div><i style="height:${Math.round(x.v / top * 100)}%"></i><b>${x.v || ''}</b><span>${t(x.d.slice(0, 1), DAY_ZH[x.d])}</span></div>`).join('')}</div>
    <p class="muted small">${t('Set 5 · workout 15 · PR 25 · habit 5 · check-in 10', '每組 5 · 訓練 15 · PR 25 · 習慣 5 · 打卡 10')}</p>
  </section>`;
}

export function coverageHtml(cov) {
  return `<section class="card"><div class="card-head"><h3>${t('Muscle groups this week', '本週肌群')}</h3><span class="muted small">${t('sets / target', '組數 / 目標')}</span></div>
    <div class="cov">${Object.keys(CATS).filter(k => WEEK_SETS[k]).map(k => { const v = cov[k] || 0, goal = WEEK_SETS[k]; return `<div class="cov-row"><span>${t(CATS[k], CAT_ZH[k])}</span>
      <span class="bar ${v >= goal ? 'hit' : ''}" role="img" aria-label="${t(CATS[k], CAT_ZH[k])} ${v}/${goal}"><i style="width:${Math.min(100, Math.round(v / goal * 100))}%"></i></span><b>${v}/${goal}</b></div>`; }).join('')}</div></section>`;
}

// FitTrack's daily habits; amounts follow body weight
export function habitList(weightKg, steps = 8000) {
  const w = weightKg || 75;
  return [
    { id: 'water', label: t(`Drink ${(w * 0.033).toFixed(1)} L water`, `飲水 ${(w * 0.033).toFixed(1)}L`) },
    { id: 'protein', label: t(`Hit ${Math.round(w * 1.8)} g protein`, `蛋白質 ${Math.round(w * 1.8)}g`) },
    { id: 'sleep', label: t('In bed by 10:30pm (7–9 h)', '10:30 前上床（7–9 小時）') },
    { id: 'steps', label: t(`Walk ${steps.toLocaleString('en-GB')} steps`, `行 ${steps.toLocaleString('en-GB')} 步`) }
  ];
}
