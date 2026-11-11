// Weekly review (FitTrack's weeklyReview): the last 7 days against your plan and goal,
// a score out of 100, and what to lift next week. Worked out from what's logged; nothing extra is stored.
// Score = training days vs plan (60) + lifts on track (25, or 12 when nothing to judge) + weighed in (15), as in FitTrack.
import * as api from './supa.js';
import { EX, WD, CATS } from './exercises.js';
import { t, fmtDay } from './i18n.js';
import { esc, render } from './ui.js';
import { bySession, exName, kg } from './tracker.js';
import { cleanPlan, allItems, plannedPerWeek } from './plan.js';
import { coachSessions, nextLoad, targetStatus } from './coach.js';
import { coverage } from './score.js';
import { schemeOf, schemeName } from './scheme.js';
import { weekMinutes } from './cardio.js';
import { tally } from './icons.js';

const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekStartOf = iso => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const CAT_ZH = { chest: '胸', back: '背', legs: '腿', shoulders: '肩', arms: '手臂', core: '核心' };

// shown on Sunday and Monday until opened; Sunday's and Monday's banner are the same review week
const reviewKey = () => weekStartOf(addDays(api.ukToday(), -1));
const seenKey = uid => `gob_review_${uid}`;
export function reviewDue(uid) {
  if (!['Sun', 'Mon'].includes(api.ukWeekday())) return false;
  try { return localStorage.getItem(seenKey(uid)) !== reviewKey(); } catch { return false; }
}

// pure: everything the screen shows. d = { rows, plan, body, weights, targets, cardio, daysPerWeek }
export function weeklyReview(d, today) {
  const from = addDays(today, -6);
  const hist = bySession(d.rows), plan = d.plan ? cleanPlan(d.plan) : null;
  const liftDays = new Set(d.rows.filter(r => r.performed_on >= from && r.performed_on <= today && r.reps >= 1).map(r => r.performed_on));
  const cardioDays = new Set(d.cardio.filter(c => c.performed_on >= from && c.performed_on <= today).map(c => c.performed_on));
  const done = new Set([...liftDays, ...cardioDays]).size;
  const planned = d.daysPerWeek || (plan && plan.days.length ? plannedPerWeek(plan) : 0);

  // lifts trained this week: against a target if there is one, otherwise est. 1RM vs the last session before this week
  const tg = Object.fromEntries(d.targets.map(x => [x.exercise_id, x]));
  const ids = Object.keys(hist).filter(id => EX[id] && hist[id].some(s => s.date >= from && s.date <= today));
  const lifts = ids.map(id => {
    const ses = coachSessions(hist[id]), now = ses.filter(s => s.date >= from), old = ses.filter(s => s.date < from);
    if (!now.length) return null;
    const best = Math.max(...now.map(s => s.e1));
    if (tg[id]) {
      const st = targetStatus(tg[id], hist[id], today);
      return { id, kind: 'target', st, ok: ['done', 'ontrack', 'improving'].includes(st.state), base: st.state === 'nodata' };
    }
    if (!old.length) return { id, kind: 'lift', base: true, best };
    const prev = old.at(-1).e1, change = (best - prev) / prev;
    return { id, kind: 'lift', best, prev, change, ok: change >= -0.01, close: change < -0.01 && change >= -0.05 };
  }).filter(Boolean);
  const prs = ids.filter(id => {
    const ses = coachSessions(hist[id]), old = ses.filter(s => s.date < from), now = ses.filter(s => s.date >= from);
    return old.length && now.length && Math.max(...now.map(s => s.e1)) > Math.max(...old.map(s => s.e1));
  });

  const wIn = d.weights.filter(w => w.logged_on >= from && w.logged_on <= today), weighed = wIn.length > 0;
  const before = d.weights.filter(w => w.logged_on < from).at(-1);
  const wChange = weighed && before ? Math.round((+wIn.at(-1).weight_kg - +before.weight_kg) * 10) / 10 : null;

  const sc = schemeOf(d.body?.goal_id);
  const cardioMin = weekMinutes(d.cardio, from, today);
  const sets = coverage(d.rows.filter(r => r.performed_on <= today), from);

  // next week: what to lift on each planned exercise (rep range from the plan)
  const next = plan ? [...new Map(allItems(plan).map(e => [e.id, e])).values()]
    .map(e => ({ id: e.id, s: nextLoad(e.id, hist[e.id], today, e.lo || e.reps, e.reps) })).filter(x => x.s && x.s.kg).slice(0, 8) : [];

  const judged = lifts.filter(l => !l.base);
  const score = Math.round((planned ? Math.min(1, done / planned) : 1) * 60 + (judged.length ? judged.filter(l => l.ok).length / judged.length * 25 : 12) + (weighed ? 15 : 0));
  return { from, to: today, done, planned, lifts, judged, prs, weighed, wChange, sc, cardioMin, sets, next, score };
}

const verdict = s => s >= 85 ? t('Strong week', '好紮實嘅一星期') : s >= 65 ? t('Solid week', '唔錯嘅一星期') : s >= 40 ? t('Patchy week', '有啲甩漏') : t('Off week', '呢個星期走咗盞');

export async function reviewScreen(user) {
  const today = api.ukToday();
  const [rows, plan, body, weights, targets, cardio, profile] = await Promise.all([api.liftHistory(user.id), api.getPlan(user.id), api.bodyProfile(user.id),
    api.weights(user.id), api.liftTargets(user.id), api.cardioLogs(user.id, addDays(today, -6)), api.getProfile(user.id)]);
  const rv = weeklyReview({ rows, plan, body, weights, targets, cardio, daysPerWeek: profile.days_per_week }, today);
  try { localStorage.setItem(seenKey(user.id), reviewKey()); } catch { /* private mode */ }

  const tone = rv.score >= 65 ? 'rv-ok' : rv.score >= 40 ? 'rv-mid' : 'rv-low';
  const liftLine = l => {
    if (l.kind === 'target') {
      const lbl = { done: t('target reached', '目標達成'), ontrack: t('on pace', '跟得上進度'), improving: t('improving', '進步緊'), behind: t('behind pace', '落後進度'), flat: t('flat', '停滯'), late: t('past the date', '過咗期限'), nopace: t('need more sessions', '要多幾次記錄'), nodata: t('no data', '未有記錄') }[l.st.state];
      return `<li class="${l.ok ? 'rv-ok' : l.base ? '' : 'rv-bad'}"><b>${esc(exName(l.id))}</b><span>${t('Target', '目標')} ${l.st.pct}% · ${lbl}</span></li>`;
    }
    if (l.base) return `<li><b>${esc(exName(l.id))}</b><span>${t('First week, now the baseline', '第一個星期，當做起點')}</span></li>`;
    const pct = Math.round(l.change * 1000) / 10;
    return `<li class="${l.ok ? 'rv-ok' : l.close ? 'rv-mid' : 'rv-bad'}"><b>${esc(exName(l.id))}</b><span>${t('est. 1RM', '估算 1RM')} ${kg(Math.round(l.best * 10) / 10)} (${pct > 0 ? '+' : ''}${pct}%)</span></li>`;
  };
  const under = rv.sc ? Object.keys(CATS).filter(k => (rv.sets[k] || 0) < rv.sc.sets[0] && (rv.sets[k] || 0) > 0) : [];

  render(`
    <header class="page-head"><div><h2>${t('Weekly review', '每週回顧')}</h2>
      <p class="muted">${esc(fmtDay(rv.from))} – ${esc(fmtDay(rv.to))}</p></div>
      <a class="link" href="#/log">${t('Today', '今日')} ›</a></header>
    <section class="card review-score ${tone}">
      <div class="score-num"><b>${rv.score}</b><span>/100</span></div>
      <div><h3>${verdict(rv.score)}</h3><p class="muted small">${t('Training days 60 · lifts on track 25 · weighed in 15', '訓練日數 60 · 舉重進度 25 · 有磅重 15')}</p></div>
    </section>
    <section class="card">
      <div class="card-head"><h3>${t('Training days', '訓練日數')}</h3><span class="muted small">${rv.planned ? `${rv.done}/${rv.planned}` : rv.done}</span></div>
      ${tally(rv.done, t(`${rv.done} days`, `${rv.done} 日`))}
      <p class="muted small">${!rv.planned ? t('Set a weekly plan or a days-a-week target to be scored on this.', '設定每週計劃或者每星期目標日數，呢項先會計分。')
        : rv.done >= rv.planned ? t('Every planned day done.', '計劃嘅日子全部做晒。') : t(`${rv.planned - rv.done} planned day${rv.planned - rv.done === 1 ? '' : 's'} missed.`, `漏咗 ${rv.planned - rv.done} 日。`)}</p>
    </section>
    <section class="card">
      <div class="card-head"><h3>${t('Lifts', '舉重')}</h3><span class="muted small">${rv.judged.length ? `${rv.judged.filter(l => l.ok).length}/${rv.judged.length} ${t('on track', '跟得上')}` : ''}</span></div>
      ${rv.lifts.length ? `<ul class="review-list">${rv.lifts.map(liftLine).join('')}</ul>` : `<p class="muted">${t('No lifts logged in the last 7 days.', '過去 7 日冇舉重記錄。')}</p>`}
      ${rv.prs.length ? `<p class="pr-line">🏆 ${t(`New best on ${rv.prs.map(exName).join(', ')}`, `${rv.prs.map(exName).join('、')} 破咗紀錄`)}</p>` : ''}
    </section>
    <section class="card">
      <div class="card-head"><h3>${t('Body and cardio', '身體同有氧')}</h3></div>
      <ul class="review-list">
        <li class="${rv.weighed ? 'rv-ok' : 'rv-bad'}"><b>${t('Weigh-in', '磅重')}</b><span>${rv.weighed ? (rv.wChange != null ? t(`${rv.wChange > 0 ? '+' : ''}${rv.wChange} kg on the week before`, `比上星期 ${rv.wChange > 0 ? '+' : ''}${rv.wChange} kg`) : t('Logged', '有記錄')) : t('Not this week. Weigh in on the Me page.', '今個星期未磅。喺「我」頁記錄。')}</span></li>
        <li class="${rv.sc ? (rv.cardioMin >= rv.sc.cardio ? 'rv-ok' : 'rv-mid') : ''}"><b>${t('Cardio', '有氧')}</b><span>${rv.cardioMin} ${t('min', '分鐘')}${rv.sc ? ` / ${rv.sc.cardio} · ${esc(schemeName(rv.sc))}` : ''}</span></li>
      </ul>
      ${under.length ? `<p class="muted small">${t(`Under ${rv.sc.sets[0]} hard sets this week: ${under.map(k => CATS[k]).join(', ')}.`, `今個星期少過 ${rv.sc.sets[0]} 組：${under.map(k => CAT_ZH[k]).join('、')}。`)}</p>` : ''}
    </section>
    <section class="card">
      <div class="card-head"><h3>${t('Next week', '下星期')}</h3></div>
      ${rv.next.length ? `<ul class="review-list next">${rv.next.map(x => `<li class="rv-${x.s.kind}"><b>${esc(exName(x.id))}</b><span>${kg(x.s.kg)} × ${x.s.reps}</span></li>`).join('')}</ul>
        <p class="muted small">${t('These fill in on the Log page on the day.', '到嗰日喺「記錄」頁會自動填好。')}</p>`
        : `<p class="muted">${plan ? t('Log a few sessions of your planned lifts and next week’s weights show here.', '記錄多幾次計劃入面嘅動作，呢度就會出下星期嘅重量。') : t('Make a weekly plan to get next week’s weights.', '整個每週計劃，就會有下星期嘅重量建議。')}</p>
          <a class="link" href="#/plan">${t('Plan', '計劃')} ›</a>`}
    </section>`);
}
