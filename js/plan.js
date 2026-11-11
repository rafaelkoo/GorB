// Weekly plan (FitTrack's "Plan" tab): which day does which exercises, sets and reps.
import * as api from './supa.js';
import { EX, CATS, WD, DEFAULT_PLAN } from './exercises.js';
import { t } from './i18n.js';
import { exName, picker } from './tracker.js';
import { esc, render, showError, toast } from './ui.js';
import { openExercise } from './exsheet.js';
import { schemeOf, schemeFor, schemeChanges, applyScheme, schemeName, restLabel } from './scheme.js';
export const repRange = e => (e.lo && e.lo < e.reps ? `${e.lo}–${e.reps}` : `${e.reps}`);

const DAY_EN = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const DAY_ZH = { Mon: '星期一', Tue: '星期二', Wed: '星期三', Thu: '星期四', Fri: '星期五', Sat: '星期六', Sun: '星期日' };
const SHORT_ZH = { Mon: '一', Tue: '二', Wed: '三', Thu: '四', Fri: '五', Sat: '六', Sun: '日' };
const CAT_ZH = { chest: '胸', back: '背', legs: '腿', shoulders: '肩', arms: '手臂', core: '核心' };
export const dayLong = d => t(DAY_EN[d], DAY_ZH[d]);
const dayShort = d => t(d, SHORT_ZH[d]);

// keep only known exercises, sensible numbers, all seven days present
export function cleanPlan(p) {
  const out = {};
  for (const d of WD) out[d] = (Array.isArray(p?.[d]) ? p[d] : [])
    .filter(e => e && EX[e.id])
    .map(e => {
      const reps = Math.min(50, Math.max(1, parseInt(e.reps) || 10));
      // lo = bottom of the rep range (FitTrack's range [lo, hi]); missing → a single number
      const lo = Math.min(reps, Math.max(1, parseInt(e.lo ?? (Array.isArray(e.range) ? e.range[0] : reps)) || reps));
      return { id: e.id, sets: Math.min(10, Math.max(1, parseInt(e.sets) || 3)), reps, ...(lo < reps ? { lo } : {}) };
    });
  return out;
}

// most common body part that day, as in FitTrack
export function dayFocus(list) {
  const c = {};
  for (const e of list || []) { const cat = EX[e.id]?.cat; if (cat) c[cat] = (c[cat] || 0) + 1; }
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null;
}
export const focusName = f => (f ? t(`${CATS[f]} day`, `${CAT_ZH[f]}日`) : t('Rest day', '休息日'));

export async function planScreen(user, day) {
  let plan = await api.getPlan(user.id);
  const isNew = !plan;
  plan = cleanPlan(plan || {});
  day = WD.includes(day) ? day : api.ukWeekday();
  const [profile, body] = await Promise.all([api.getProfile(user.id), api.bodyProfile(user.id)]);
  const sc = schemeOf(body?.goal_id);

  let saving = null;
  const save = () => { clearTimeout(saving); saving = setTimeout(() => api.savePlan(user.id, plan).catch(showError), 400); };
  const redraw = () => draw();

  // FitTrack's training guide for the goal picked on the Me page
  function guideHtml() {
    if (!sc) return `<section class="card guide"><div class="card-head"><h3>${t('Training guide', '訓練指引')}</h3></div>
      <p class="muted">${t('Pick a goal on the Me page and this shows the sets, reps, rest and cardio that suit it.', '喺「我」頁揀個目標，呢度就會講你知啱嗰個目標嘅組數、次數、休息同有氧。')}</p>
      <a class="link" href="#/me">${t('Pick a goal', '揀目標')} ›</a></section>`;
    const n = schemeChanges(plan, sc), row = (k, v) => `<li><span class="muted">${k}</span><b>${v}</b></li>`;
    return `<section class="card guide"><div class="card-head"><h3>${t('Training guide', '訓練指引')}</h3><span class="tag">${esc(schemeName(sc))}</span></div>
      <ul class="guide-list">
        ${row(t('Big lifts', '複合動作'), `${sc.c[0]} × ${sc.c[1]}–${sc.c[2]}`)}
        ${row(t('Smaller lifts', '孤立動作'), `${sc.i[0]} × ${sc.i[1]}–${sc.i[2]}`)}
        ${row(t('Rest between sets', '組間休息'), restLabel(sc.rest))}
        ${row(t('Hard sets per muscle', '每個肌群每星期'), t(`${sc.sets[0]}–${sc.sets[1]} a week`, `${sc.sets[0]}–${sc.sets[1]} 組`))}
        ${row(t('Cardio', '有氧'), t(`${sc.cardio} min a week`, `每星期 ${sc.cardio} 分鐘`))}
        ${row(t('Steps', '步數'), t(`${sc.steps.toLocaleString()} a day`, `每日 ${sc.steps.toLocaleString()}`))}
      </ul>
      <p class="muted small">${t('Work in the rep range: when every set reaches the top, the coach adds weight and you start again at the bottom.', '喺次數範圍入面練：每組都做到最高次數，教練就會加重，再由最低次數開始。')}</p>
      ${n ? `<button id="applyguide">${t(`Apply to my plan (${n} exercise${n === 1 ? '' : 's'})`, `套用到我嘅計劃（${n} 個動作）`)}</button>`
        : WD.some(d => plan[d].length) ? `<p class="muted small">✓ ${t('Your plan already follows this guide.', '你嘅計劃已經跟緊呢個指引。')}</p>` : ''}
    </section>`;
  }

  function draw() {
    const list = plan[day], trainDays = WD.filter(d => plan[d].length).length;
    const el = render(`
      <header class="page-head"><div><h2>${t('Weekly plan', '每週計劃')}</h2>
        <p class="muted">${t(`${trainDays} training day${trainDays === 1 ? '' : 's'} a week`, `每星期練 ${trainDays} 日`)}</p></div>
        <a class="link" href="#/log">${t('Today', '今日')} ›</a></header>
      ${isNew && !WD.some(d => plan[d].length) ? `<section class="card"><p>${t('No plan yet. Start from FitTrack’s default split, or build your own day by day.', '仲未有計劃。可以用 FitTrack 預設嘅分組，或者自己逐日加。')}</p>
        <button id="usedefault">${t('Use FitTrack default plan', '用 FitTrack 預設計劃')}</button></section>` : ''}
      <div class="days7" role="tablist" aria-label="${t('Pick a day', '揀日子')}">${WD.map(d => `<button role="tab" data-day="${d}" aria-selected="${d === day}" class="${d === day ? 'on' : ''} ${plan[d].length ? 'has' : ''}">
        <b>${dayShort(d)}</b><small>${plan[d].length ? esc(t(CATS[dayFocus(plan[d])] || '', CAT_ZH[dayFocus(plan[d])] || '')) : t('Rest', '休息')}</small></button>`).join('')}</div>
      <section class="card">
        <div class="card-head"><h3>${dayLong(day)} · ${esc(focusName(dayFocus(list)))}</h3></div>
        ${list.length ? `<ol class="plan-list">${list.map((e, i) => `<li data-i="${i}">
            <button class="pl-name ex-name" data-open="${e.id}"><b>${esc(exName(e.id))}</b><span class="muted small">${esc(t(CATS[EX[e.id].cat], CAT_ZH[EX[e.id].cat]))} · ${t('how to', '教學')} ›</span></button>
            <div class="stepper st-sets" aria-label="${t('Sets', '組數')}"><button class="ghost" data-act="sets" data-v="-1" aria-label="${t('One less set', '減一組')}">−</button><span><b>${e.sets}</b><small>${t('sets', '組')}</small></span><button class="ghost" data-act="sets" data-v="1" aria-label="${t('One more set', '加一組')}">+</button></div>
            <div class="stepper st-reps" aria-label="${t('Reps', '次數')}"><button class="ghost" data-act="reps" data-v="-1" aria-label="${t('One less rep', '減一次')}">−</button><span><b>${repRange(e)}</b><small>${t('reps', '次')}</small></span><button class="ghost" data-act="reps" data-v="1" aria-label="${t('One more rep', '加一次')}">+</button></div>
            <div class="pl-move"><button class="ghost x" data-act="up" aria-label="${t('Move up', '上移')}" ${i ? '' : 'disabled'}>↑</button><button class="ghost x" data-act="down" aria-label="${t('Move down', '下移')}" ${i < list.length - 1 ? '' : 'disabled'}>↓</button><button class="ghost x" data-act="del" aria-label="${t('Remove', '移除')}">✕</button></div>
          </li>`).join('')}</ol>`
          : `<p class="muted">${t('Rest day. Add exercises to train this day.', '休息日。加動作就變訓練日。')}</p>`}
        <button id="add" class="ghost">+ ${t('Add exercise', '加動作')}</button>
      </section>
      ${guideHtml()}
      <section class="card">
        <label class="switch"><input type="checkbox" id="share" ${profile.share_plan ? 'checked' : ''}>
          <span>${t('Show my plan to my groups', '俾 group 睇我嘅計劃')}<small class="muted">${t('Off: only you see it.', '關：得你自己睇到。')}</small></span></label>
      </section>`);

    el.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { day = b.dataset.day; history.replaceState(null, '', `#/plan/${day}`); redraw(); });
    el.querySelector('#usedefault')?.addEventListener('click', () => { plan = cleanPlan(DEFAULT_PLAN); save(); toast(t('FitTrack plan added. Change anything you like.', '已加入 FitTrack 計劃，想改就改。')); redraw(); });
    el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openExercise(user, b.dataset.open, 'how'));
    el.querySelector('#add').onclick = () => picker(id => {
      const [sets, lo, hi] = sc ? schemeFor(sc, id) : [3, 10, 10];
      plan[day].push({ id, sets, reps: hi, ...(lo < hi ? { lo } : {}) }); save(); redraw();
    });
    el.querySelector('#applyguide')?.addEventListener('click', async () => {
      applyScheme(plan, sc); save();
      try { await api.saveBodyProfile(user.id, { rest_sec: sc.rest }); body.rest_sec = sc.rest; } catch (err) { showError(err); }
      redraw(); toast(t('Plan and rest timer set for your goal.', '計劃同休息時間已經跟你嘅目標調好。'));
    });
    el.querySelectorAll('.plan-list li').forEach(li => {
      const i = +li.dataset.i;
      li.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
        const list = plan[day], e = list[i], a = b.dataset.act;
        if (a === 'sets') e.sets = Math.min(10, Math.max(1, e.sets + +b.dataset.v));
        if (a === 'reps') { e.reps = Math.min(50, Math.max(1, e.reps + +b.dataset.v)); if (e.lo) { e.lo = Math.min(e.lo + +b.dataset.v, e.reps); if (e.lo < 1 || e.lo >= e.reps) delete e.lo; } }
        if (a === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
        if (a === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
        if (a === 'del') list.splice(i, 1);
        save(); redraw();
      });
    });
    el.querySelector('#share').onchange = async e => {
      try { await api.updateProfile(user.id, { share_plan: e.target.checked }); profile.share_plan = e.target.checked; } catch (err) { showError(err); }
    };
  }
  draw();
}
