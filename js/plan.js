// Weekly plan (FitTrack's "Plan" tab): which day does which exercises, sets and reps.
import * as api from './supa.js';
import { EX, CATS, WD, DEFAULT_PLAN } from './exercises.js';
import { t } from './i18n.js';
import { exName, picker } from './tracker.js';
import { esc, render, showError, toast } from './ui.js';
import { openExercise } from './exsheet.js';

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
    .map(e => ({ id: e.id, sets: Math.min(10, Math.max(1, parseInt(e.sets) || 3)), reps: Math.min(50, Math.max(1, parseInt(e.reps) || 10)) }));
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
  const profile = await api.getProfile(user.id);

  let saving = null;
  const save = () => { clearTimeout(saving); saving = setTimeout(() => api.savePlan(user.id, plan).catch(showError), 400); };
  const redraw = () => draw();

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
            <div class="stepper st-reps" aria-label="${t('Reps', '次數')}"><button class="ghost" data-act="reps" data-v="-1" aria-label="${t('One less rep', '減一次')}">−</button><span><b>${e.reps}</b><small>${t('reps', '次')}</small></span><button class="ghost" data-act="reps" data-v="1" aria-label="${t('One more rep', '加一次')}">+</button></div>
            <div class="pl-move"><button class="ghost x" data-act="up" aria-label="${t('Move up', '上移')}" ${i ? '' : 'disabled'}>↑</button><button class="ghost x" data-act="down" aria-label="${t('Move down', '下移')}" ${i < list.length - 1 ? '' : 'disabled'}>↓</button><button class="ghost x" data-act="del" aria-label="${t('Remove', '移除')}">✕</button></div>
          </li>`).join('')}</ol>`
          : `<p class="muted">${t('Rest day. Add exercises to train this day.', '休息日。加動作就變訓練日。')}</p>`}
        <button id="add" class="ghost">+ ${t('Add exercise', '加動作')}</button>
      </section>
      <section class="card">
        <label class="switch"><input type="checkbox" id="share" ${profile.share_plan ? 'checked' : ''}>
          <span>${t('Show my plan to my groups', '俾 group 睇我嘅計劃')}<small class="muted">${t('Off: only you see it.', '關：得你自己睇到。')}</small></span></label>
      </section>`);

    el.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { day = b.dataset.day; history.replaceState(null, '', `#/plan/${day}`); redraw(); });
    el.querySelector('#usedefault')?.addEventListener('click', () => { plan = cleanPlan(DEFAULT_PLAN); save(); toast(t('FitTrack plan added. Change anything you like.', '已加入 FitTrack 計劃，想改就改。')); redraw(); });
    el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openExercise(user, b.dataset.open, 'how'));
    el.querySelector('#add').onclick = () => picker(id => { plan[day].push({ id, sets: 3, reps: 10 }); save(); redraw(); });
    el.querySelectorAll('.plan-list li').forEach(li => {
      const i = +li.dataset.i;
      li.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
        const list = plan[day], e = list[i], a = b.dataset.act;
        if (a === 'sets') e.sets = Math.min(10, Math.max(1, e.sets + +b.dataset.v));
        if (a === 'reps') e.reps = Math.min(50, Math.max(1, e.reps + +b.dataset.v));
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
