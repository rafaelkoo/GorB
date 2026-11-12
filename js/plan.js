// Workout days: named sessions you pick from (Arms, Shoulders, Chest…), each with exercises, sets and rep range.
// A day can have usual weekdays (optional). The Log page suggests today's: the one set for this weekday,
// otherwise the next one after the day you trained last (a rotation).
// Stored as { v: 2, days: [{ id, name, on: ['Mon'], items: [{ id, sets, reps, lo? }] }] }.
// Old FitTrack-style plans ({ Mon: [...], Tue: [...] }) turn into one day per weekday.
import * as api from './supa.js';
import { EX, CATS, WD, DEFAULT_PLAN } from './exercises.js';
import { t } from './i18n.js';
import { exName, picker } from './tracker.js';
import { esc, render, showError, toast } from './ui.js';
import { openExercise } from './exsheet.js';
import { popAfter } from './motion.js';
import { schemeOf, schemeFor, schemeChanges, applyScheme, schemeName, restLabel } from './scheme.js';

const DAY_EN = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const DAY_ZH = { Mon: '星期一', Tue: '星期二', Wed: '星期三', Thu: '星期四', Fri: '星期五', Sat: '星期六', Sun: '星期日' };
const SHORT_ZH = { Mon: '一', Tue: '二', Wed: '三', Thu: '四', Fri: '五', Sat: '六', Sun: '日' };
const CAT_ZH = { chest: '胸', back: '背', legs: '腿', shoulders: '肩', arms: '手臂', core: '核心', other: '其他' };
export const dayLong = d => t(DAY_EN[d], DAY_ZH[d]);
export const dayShort = d => t(d, SHORT_ZH[d]);
export const repRange = e => (e.lo && e.lo < e.reps ? `${e.lo}–${e.reps}` : `${e.reps}`);
const MAX_DAYS = 14;

const cleanItem = e => {
  const reps = Math.min(50, Math.max(1, parseInt(e.reps) || 10));
  // lo = bottom of the rep range (FitTrack's range [lo, hi]); missing → a single number
  const lo = Math.min(reps, Math.max(1, parseInt(e.lo ?? (Array.isArray(e.range) ? e.range[0] : reps)) || reps));
  return { id: e.id, sets: Math.min(10, Math.max(1, parseInt(e.sets) || 3)), reps, ...(lo < reps ? { lo } : {}) };
};
const cleanItems = list => (Array.isArray(list) ? list : []).filter(e => e && EX[e.id]).map(cleanItem);
const newId = days => { let i = days.length + 1; while (days.some(d => d.id === 'd' + i)) i++; return 'd' + i; };

// always returns { v: 2, days: [...] }
export function cleanPlan(p) {
  const days = [];
  if (p && Array.isArray(p.days)) {
    for (const d of p.days.slice(0, MAX_DAYS)) {
      if (!d) continue;
      const id = typeof d.id === 'string' && /^[\w-]{1,20}$/.test(d.id) && !days.some(x => x.id === d.id) ? d.id : newId(days);
      days.push({ id, name: String(d.name || '').trim().slice(0, 30), on: WD.filter(w => (d.on || []).includes(w)), items: cleanItems(d.items) });
    }
  } else if (p) {
    for (const w of WD) { const items = cleanItems(p[w]); if (items.length) days.push({ id: newId(days), name: '', on: [w], items }); }
  }
  // a weekday belongs to one day at most
  const taken = new Set();
  for (const d of days) d.on = d.on.filter(w => !taken.has(w) && taken.add(w));
  return { v: 2, days };
}

// most common body part in a list of exercises, as in FitTrack
export function dayFocus(list) {
  const c = {};
  for (const e of list || []) { const cat = EX[e.id]?.cat; if (cat) c[cat] = (c[cat] || 0) + 1; }
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null;
}
export const focusName = f => (f ? t(`${CATS[f]} day`, `${CAT_ZH[f]}日`) : t('Rest day', '休息日'));
// the name you gave it, otherwise its main body part
export const dayName = d => (d ? d.name || (d.items.length ? focusName(dayFocus(d.items)) : t('New day', '新嘅一日')) : t('Free workout', '自由訓練'));
export const allItems = plan => plan.days.flatMap(d => d.items);
export const findItem = (plan, id) => allItems(plan).find(e => e.id === id);

// today's suggestion: the day set for this weekday, otherwise the one after the day trained last.
// lastIds = exercise ids of the last saved workout before today (matched to the day it overlaps most)
export function suggestDay(plan, weekday, lastIds = []) {
  const days = plan.days.filter(d => d.items.length);
  if (!days.length) return null;
  const set = days.find(d => d.on.includes(weekday));
  if (set) return set;
  const last = new Set(lastIds);
  let best = -1, bestN = 0;
  days.forEach((d, i) => { const n = d.items.filter(e => last.has(e.id)).length; if (n > bestN) { bestN = n; best = i; } });
  return best < 0 ? days[0] : days[(best + 1) % days.length];
}
// how many training days a week the plan means: weekdays set, otherwise one per day
export const plannedPerWeek = plan => { const set = new Set(plan.days.flatMap(d => d.on)).size; return set || plan.days.filter(d => d.items.length).length; };

export async function planScreen(user, dayId) {
  const saved = await api.getPlan(user.id);
  const plan = cleanPlan(saved || {});
  if (saved && !Array.isArray(saved.days)) api.savePlan(user.id, plan).catch(() => {});   // convert the old weekday plan once
  let cur = plan.days.find(d => d.id === dayId) || plan.days[0] || null;
  const [profile, body] = await Promise.all([api.getProfile(user.id), api.bodyProfile(user.id)]);
  const sc = schemeOf(body?.goal_id);

  let saving = null;
  const save = () => { clearTimeout(saving); saving = setTimeout(() => api.savePlan(user.id, plan).catch(showError), 400); };
  const go = d => { cur = d; history.replaceState(null, '', d ? `#/plan/${d.id}` : '#/plan'); draw(); };

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
        ${row(t('Steps', '步數'), t(`${sc.steps.toLocaleString('en-GB')} a day`, `每日 ${sc.steps.toLocaleString('en-GB')}`))}
      </ul>
      <p class="muted small">${t('Work in the rep range: when every set reaches the top, the coach adds weight and you start again at the bottom.', '喺次數範圍入面練：每組都做到最高次數，教練就會加重，再由最低次數開始。')}</p>
      ${n ? `<button id="applyguide">${t(`Apply to my plan (${n} exercise${n === 1 ? '' : 's'})`, `套用到我嘅計劃（${n} 個動作）`)}</button>`
        : allItems(plan).length ? `<p class="muted small">✓ ${t('Your plan already follows this guide.', '你嘅計劃已經跟緊呢個指引。')}</p>` : ''}
    </section>`;
  }

  function dayHtml(d) {
    const list = d.items;
    return `<section class="card">
      <label class="field">${t('Name', '名')}<input id="dname" maxlength="30" value="${esc(d.name)}" placeholder="${esc(list.length ? focusName(dayFocus(list)) : t('e.g. Arms', '例如：手臂'))}"></label>
      ${list.length ? `<ol class="plan-list">${list.map((e, i) => `<li data-i="${i}">
          <button class="pl-name ex-name" data-open="${e.id}"><b>${esc(exName(e.id))}</b><span class="muted small">${esc(t(CATS[EX[e.id].cat], CAT_ZH[EX[e.id].cat]))} · ${t('how to', '教學')} ›</span></button>
          <div class="stepper st-sets" aria-label="${t('Sets', '組數')}"><button class="ghost" data-act="sets" data-v="-1" aria-label="${t('One less set', '減一組')}">−</button><span><b>${e.sets}</b><small>${t('sets', '組')}</small></span><button class="ghost" data-act="sets" data-v="1" aria-label="${t('One more set', '加一組')}">+</button></div>
          <div class="stepper st-reps" aria-label="${t('Reps', '次數')}"><button class="ghost" data-act="reps" data-v="-1" aria-label="${t('One less rep', '減一次')}">−</button><span><b>${repRange(e)}</b><small>${EX[e.id]?.timed ? t('sec', '秒') : t('reps', '次')}</small></span><button class="ghost" data-act="reps" data-v="1" aria-label="${t('One more rep', '加一次')}">+</button></div>
          <div class="pl-move"><button class="ghost x" data-act="up" aria-label="${t('Move up', '上移')}" ${i ? '' : 'disabled'}>↑</button><button class="ghost x" data-act="down" aria-label="${t('Move down', '下移')}" ${i < list.length - 1 ? '' : 'disabled'}>↓</button><button class="ghost x" data-act="del" aria-label="${t('Remove', '移除')}">✕</button></div>
        </li>`).join('')}</ol>`
        : `<p class="muted">${t('No exercises yet.', '仲未有動作。')}</p>`}
      <button id="add" class="ghost">+ ${t('Add exercise', '加動作')}</button>
      <div class="usual"><p class="muted small">${t('Usually on (optional). Leave empty and the Log page goes round your days in order.', '平時邊日練（可以唔揀）。唔揀嘅話，「記錄」頁會跟次序輪住嚟。')}</p>
        <div class="days7 mini" role="group" aria-label="${t('Usual weekdays', '平時邊日')}">${WD.map(w => { const on = d.on.includes(w), other = !on && plan.days.find(x => x !== d && x.on.includes(w));
          return `<button data-wd="${w}" aria-pressed="${on}" class="${on ? 'on' : ''}" title="${other ? esc(t(`Now on ${dayName(other)}`, `而家係${dayName(other)}`)) : ''}"><b>${dayShort(w)}</b>${other ? '<small>•</small>' : ''}</button>`; }).join('')}</div></div>
      <button id="deld" class="ghost danger-text">${t('Delete this day', '刪除呢一日')}</button>
    </section>`;
  }

  function draw() {
    const n = plannedPerWeek(plan);
    const el = render(`
      <header class="page-head"><div><h2>${t('Workout days', '訓練日')}</h2>
        <p class="muted">${plan.days.length ? t(`${plan.days.length} day${plan.days.length === 1 ? '' : 's'} · about ${n} a week`, `${plan.days.length} 種訓練日 · 大約每星期 ${n} 日`) : t('Make the days you pick from, like Arms or Legs.', '整你會揀嘅訓練日，例如手臂日、腿日。')}</p></div>
        <a class="link" href="#/log">${t('Today', '今日')} ›</a></header>
      ${!plan.days.length ? `<section class="card"><p>${t('No days yet. Start from FitTrack’s default split, or make your own.', '仲未有訓練日。可以用 FitTrack 預設嘅分組，或者自己整。')}</p>
        <button id="usedefault">${t('Use FitTrack default plan', '用 FitTrack 預設計劃')}</button></section>` : ''}
      <div class="daytabs" role="tablist" aria-label="${t('Workout days', '訓練日')}">${plan.days.map(d => `<button role="tab" data-day="${d.id}" aria-selected="${d === cur}" class="${d === cur ? 'on' : ''}">
          <b>${esc(dayName(d))}</b><small>${d.on.length ? d.on.map(dayShort).join(' ') : t(`${d.items.length} exercises`, `${d.items.length} 個動作`)}</small></button>`).join('')}
        ${plan.days.length < MAX_DAYS ? `<button id="newday" class="ghost">+ ${t('New day', '新增')}</button>` : ''}</div>
      ${cur ? dayHtml(cur) : ''}
      ${guideHtml()}
      <section class="card">
        <label class="switch"><input type="checkbox" id="share" ${profile.share_plan ? 'checked' : ''}>
          <span>${t('Show my plan to my groups', '俾 group 睇我嘅計劃')}<small class="muted">${t('Off: only you see it.', '關：得你自己睇到。')}</small></span></label>
      </section>`);

    el.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { go(plan.days.find(d => d.id === b.dataset.day)); popAfter(`[data-day="${b.dataset.day}"]`, 1.05); });
    el.querySelector('#newday')?.addEventListener('click', () => { const d = { id: newId(plan.days), name: '', on: [], items: [] }; plan.days.push(d); save(); go(d); el.ownerDocument.getElementById('dname')?.focus(); });
    el.querySelector('#usedefault')?.addEventListener('click', () => {
      plan.days = cleanPlan(DEFAULT_PLAN).days; save(); go(plan.days[0]);
      toast(t('FitTrack days added. Rename or change anything.', '已加入 FitTrack 訓練日，想改名或者改內容都得。'));
    });
    el.querySelector('#applyguide')?.addEventListener('click', async () => {
      applyScheme(plan, sc); save();
      try { await api.saveBodyProfile(user.id, { rest_sec: sc.rest }); } catch (err) { showError(err); }
      draw(); toast(t('Plan and rest timer set for your goal.', '計劃同休息時間已經跟你嘅目標調好。'));
    });
    el.querySelector('#share').onchange = async e => {
      try { await api.updateProfile(user.id, { share_plan: e.target.checked }); profile.share_plan = e.target.checked; } catch (err) { showError(err); }
    };
    if (!cur) return;

    const name = el.querySelector('#dname');
    name.oninput = () => { cur.name = name.value.trim().slice(0, 30); save(); const tab = el.querySelector(`[data-day="${cur.id}"] b`); if (tab) tab.textContent = dayName(cur); };
    el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openExercise(user, b.dataset.open, 'how'));
    el.querySelector('#add').onclick = () => picker(id => {
      const [sets, lo, hi] = EX[id]?.timed ? [3, 30, 30] : sc ? schemeFor(sc, id) : [3, 10, 10];
      cur.items.push({ id, sets, reps: hi, ...(lo < hi ? { lo } : {}) }); save(); draw();
    });
    el.querySelectorAll('.plan-list li').forEach(li => {
      const i = +li.dataset.i;
      li.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
        const list = cur.items, e = list[i], a = b.dataset.act;
        if (a === 'sets') e.sets = Math.min(10, Math.max(1, e.sets + +b.dataset.v));
        if (a === 'reps') { e.reps = Math.min(50, Math.max(1, e.reps + +b.dataset.v)); if (e.lo) { e.lo = Math.min(e.lo + +b.dataset.v, e.reps); if (e.lo < 1 || e.lo >= e.reps) delete e.lo; } }
        if (a === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
        if (a === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
        if (a === 'del') list.splice(i, 1);
        save(); draw();
      });
    });
    el.querySelectorAll('[data-wd]').forEach(b => b.onclick = () => {
      const w = b.dataset.wd;
      if (cur.on.includes(w)) cur.on = cur.on.filter(x => x !== w);
      else { plan.days.forEach(d => { d.on = d.on.filter(x => x !== w); }); cur.on = WD.filter(x => x === w || cur.on.includes(x)); }
      save(); draw(); popAfter(`[data-wd="${w}"]`);
    });
    el.querySelector('#deld').onclick = () => {
      if (cur.items.length && !el.querySelector('#deld').dataset.sure) {
        const b = el.querySelector('#deld'); b.dataset.sure = '1'; b.textContent = t('Tap again to delete', '再撳一次就刪除'); return;
      }
      const i = plan.days.indexOf(cur); plan.days.splice(i, 1); save();
      go(plan.days[Math.min(i, plan.days.length - 1)] || null);
    };
  }
  draw();
}
