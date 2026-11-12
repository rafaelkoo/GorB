// Gym tracker screens: log today's workout, and a person's progress.
import * as api from './supa.js';
import { EXERCISES, EX, CATS, BIG_FOUR } from './exercises.js';
import { t, getLang, fmtDay, fmtLongToday } from './i18n.js';
import { cleanPlan, dayName, suggestDay, findItem } from './plan.js';
import { openExercise } from './exsheet.js';
import { nextLoad } from './coach.js';
import { startRest } from './timer.js';
import { points, coverage, levelCardHtml, coverageHtml, habitList } from './score.js';
import { cardioHtml, wireCardio } from './cardio.js';
import { schemeOf } from './scheme.js';
import { reviewDue } from './review.js';
import { addCustomSheet, requestSheet } from './custom.js';
import { btnLoading, btnDone, btnReset, popAfter } from './motion.js';

const $app = () => document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const kg = n => `${+(+n).toFixed(2)} kg`;
// exercise name in the chosen language, the other one underneath
export const exName = id => (getLang() === 'zh' ? EX[id]?.zh : EX[id]?.en) || id;
const exSub = id => (getLang() === 'zh' ? EX[id]?.en : EX[id]?.zh) || '';
const CAT_ZH = { chest: '胸', back: '背', legs: '腿', shoulders: '肩', arms: '手臂', core: '核心', other: '其他' };
const catName = k => t(CATS[k], CAT_ZH[k]);
const EQ_ZH = { Barbell: '槓鈴', Dumbbell: '啞鈴', Machine: '器械', Cable: '滑輪', Bodyweight: '自身體重', Other: '其他' };
const equipName = e => t(e, EQ_ZH[e] || e);

function showError(err) {
  const box = document.querySelector('.error') || $app().insertAdjacentElement('afterbegin', document.createElement('p'));
  box.className = 'error'; box.hidden = false; box.textContent = err?.message || String(err);
}
function note(text) {
  const box = document.createElement('p'); box.className = 'ok'; box.textContent = text;
  $app().insertAdjacentElement('afterbegin', box);
}

// ---------- history helpers ----------
// sessions[exerciseId] = [{date, sets:[{kg, reps}]}] oldest first
export function bySession(rows) {
  const out = {};
  for (const r of rows) {
    const list = out[r.exercise_id] || (out[r.exercise_id] = []);
    let s = list[list.length - 1];
    if (!s || s.date !== r.performed_on) list.push(s = { date: r.performed_on, sets: [] });
    s.sets.push({ kg: +r.weight_kg, reps: r.reps });
  }
  return out;
}
const bestKg = sets => Math.max(0, ...sets.filter(s => s.reps >= 1).map(s => s.kg));
export const prOf = sessions => sessions.reduce((b, s) => { const k = bestKg(s.sets); return k > b.kg ? { kg: k, date: s.date } : b; }, { kg: 0, date: null });
function setsText(sets) {
  // "3 × 5 @ 100 kg" when every set matches, else "100×5, 105×3"
  const same = sets.every(s => s.kg === sets[0].kg && s.reps === sets[0].reps);
  return same ? `${sets.length} × ${sets[0].reps} @ ${kg(sets[0].kg)}` : sets.map(s => `${+s.kg}×${s.reps}`).join(', ');
}

// ---------- log today's workout ----------
const draftKey = uid => `gob_draft_${uid}_${api.ukToday()}`;
const loadDraft = uid => { try { return JSON.parse(localStorage.getItem(draftKey(uid))); } catch { return null; } };
const saveDraft = (uid, d) => { try { localStorage.setItem(draftKey(uid), JSON.stringify(d)); } catch { /* storage blocked */ } };
const dropDraft = uid => { try { localStorage.removeItem(draftKey(uid)); } catch { /* ignore */ } };

export async function logScreen(user) {
  const today = api.ukToday(), weekday = api.ukWeekday();
  const weekStart = api.ukWeekStart();
  const [rows, savedPlan, body, ticks, wlog, clogs] = await Promise.all([api.liftHistory(user.id), api.getPlan(user.id), api.bodyProfile(user.id), api.habitTicks(user.id, api.ukToday()), api.weights(user.id), api.cardioLogs(user.id, weekStart)]);
  const cst = { logs: clogs, pick: null, mins: 30, target: schemeOf(body?.goal_id)?.cardio || null, today, weekStart };
  const habitsDone = new Set(ticks.map(x => x.habit)), habits = habitList(wlog.at(-1) ? +wlog.at(-1).weight_kg : null, schemeOf(body?.goal_id)?.steps);
  const restSec = body?.rest_sec || 90;
  const history = bySession(rows);
  const fullPlan = cleanPlan(savedPlan || {});
  const past = id => (history[id] || []).filter(s => s.date < today);
  const lastDate = rows.filter(r => r.performed_on < today).map(r => r.performed_on).sort().at(-1);
  const lastIds = [...new Set(rows.filter(r => r.performed_on === lastDate).map(r => r.exercise_id))];
  const suggested = suggestDay(fullPlan, weekday, lastIds);
  // the plan's rep range [lo, hi] for an exercise (the chosen day first, then any day)
  const planRange = id => { const e = (pickedDay()?.items || []).find(x => x.id === id) || findItem(fullPlan, id); return e ? [e.lo || e.reps, e.reps] : [10, 10]; };
  const coach = id => nextLoad(id, history[id], today, ...planRange(id));
  // plan gives sets; the coach's next load gives kg × reps; otherwise last time's weights
  const itemsFor = day => (day?.items || []).map(e => {
    const c = coach(e.id), last = past(e.id).at(-1)?.sets || [];
    return { id: e.id, sets: Array.from({ length: e.sets }, (_, j) => c ? { kg: c.kg, reps: c.reps } : { kg: (last[j] || last.at(-1))?.kg ?? null, reps: e.lo || e.reps }) };
  });
  // start from: unsaved draft → what was already saved today → the suggested day → empty
  let draft = loadDraft(user.id);
  if (!draft) {
    const items = Object.entries(history)
      .filter(([, list]) => list.at(-1)?.date === today)
      .map(([id, list]) => ({ id, sets: list.at(-1).sets.map(s => ({ kg: s.kg, reps: s.reps })) }));
    if (items.length) draft = { items, saved: true, dayId: null };
    else draft = { saved: false, dayId: suggested?.id || null, items: itemsFor(suggested) };
  }
  function pickedDay() { return fullPlan.days.find(d => d.id === draft?.dayId) || null; }
  const keep = () => saveDraft(user.id, draft);
  let pickMsg = '';

  function draw() {
    const nSets = draft.items.reduce((n, it) => n + it.sets.length, 0);
    $app().innerHTML = `
      <header class="page-head"><div><h2>${t('Today’s workout', '今日訓練')}</h2>
        <p class="muted">${esc(fmtLongToday())}${draft.saved ? ` · ${t('saved, edit and save again', '已儲存，可以改完再儲')}` : ''}</p></div>
        <div class="head-links"><a class="link" href="#/plan">${t('Days', '訓練日')} ›</a><a class="link" href="#/lib">${t('Library', '動作庫')} ›</a><a class="link" href="#/review">${t('Week', '一週')} ›</a></div></header>
      ${reviewDue(user.id) ? `<a class="card review-due" href="#/review"><b>${t('Your weekly review is ready', '你嘅每週回顧準備好')}</b><span class="muted small">${t('See how the week went and what to lift next week', '睇吓呢個星期點，同下星期練幾重')} ›</span></a>` : ''}
      ${fullPlan.days.some(d => d.items.length) ? `<section class="pickday" aria-label="${t('Which workout today', '今日練邊樣')}">
        <div class="chips scroll">${fullPlan.days.filter(d => d.items.length).map(d => `<button data-pick="${d.id}" aria-pressed="${draft.dayId === d.id}" class="${draft.dayId === d.id ? 'on' : ''}">${esc(dayName(d))}${d === suggested ? ' <span class="sugg">★</span>' : ''}</button>`).join('')}
          <button data-pick="" aria-pressed="${!draft.dayId}" class="${draft.dayId ? '' : 'on'}">${t('Free workout', '自由訓練')}</button></div>
        ${pickMsg ? `<p class="muted small">${esc(pickMsg)}</p>` : suggested && !draft.saved ? `<p class="muted small">★ ${esc(suggested.on.includes(weekday) ? t('Set for today', '今日嘅計劃') : t('Next in your rotation', '輪到呢個'))}</p>` : ''}
      </section>` : ''}
      <section class="card habits"><div class="card-head"><h3>${t('Today’s habits', '今日習慣')}</h3><span class="muted small">${habitsDone.size}/${habits.length} · +5 ${t('each', '分一個')}</span></div>
        <div class="habit-grid">${habits.map(h => `<button class="habit ${habitsDone.has(h.id) ? 'on' : ''}" data-habit="${h.id}" aria-pressed="${habitsDone.has(h.id)}"><span class="hcheck">✓</span>${esc(h.label)}</button>`).join('')}</div></section>
      ${draft.items.length ? `<p class="muted small">${t(`${draft.items.length} exercise${draft.items.length === 1 ? '' : 's'} · ${nSets} set${nSets === 1 ? '' : 's'} · kept on this phone until you save`, `${draft.items.length} 個動作 · ${nSets} 組 · 未儲存之前會暫存喺呢部手機`)}</p>` : ''}
      ${draft.items.map((it, i) => {
        const last = past(it.id).at(-1);
        return `<section class="card ex" data-i="${i}">
          <div class="ex-head"><button class="ex-name" data-open="${it.id}"><h3>${esc(exName(it.id))}</h3><span class="muted">${esc(exSub(it.id))} · ${t('how to', '教學')} ›</span></button>
            <button class="ghost x" data-act="drop" aria-label="${t('Remove', '移除')} ${esc(exName(it.id))}">✕</button></div>
          <p class="muted last">${last ? `${t('Last time', '上次')} (${esc(fmtDay(last.date))}): ${esc(setsText(last.sets))}` : t('First time logging this', '第一次記錄呢個動作')}</p>
          ${(() => { const c = coach(it.id); return c ? `<div class="coach ${c.kind}"><p><b>${t('Next', '下次')}: ${c.kg ? kg(c.kg) + ' × ' : ''}${c.reps}</b> ${esc(t(c.en, c.zh))}</p>
            <button class="ghost small-btn" data-act="usecoach">${t('Use', '套用')}</button></div>` : ''; })()}
          <div class="sets">
            <div class="set head"><span>${t('Set', '組')}</span><span>kg</span><span>${t('Reps', '次數')}</span><span>${t('Done', '完成')}</span><span></span></div>
            ${it.sets.map((s, j) => `<div class="set ${s.done ? 'done' : ''}" data-j="${j}"><span>${j + 1}</span>
              <input inputmode="decimal" aria-label="${t(`Set ${j + 1} kg`, `第 ${j + 1} 組 kg`)}" value="${s.kg ?? ''}" data-f="kg">
              <input inputmode="numeric" aria-label="${t(`Set ${j + 1} reps`, `第 ${j + 1} 組次數`)}" value="${s.reps ?? ''}" data-f="reps">
              <button class="tick ${s.done ? 'on' : ''}" data-act="tick" aria-pressed="${!!s.done}" aria-label="${t(`Set ${j + 1} done, start rest`, `第 ${j + 1} 組完成，開始休息`)}">✓</button>
              <button class="ghost x" data-act="unset" aria-label="${t(`Remove set ${j + 1}`, `移除第 ${j + 1} 組`)}">✕</button></div>`).join('')}
          </div>
          <button class="ghost" data-act="addset">+ ${t('Set', '加一組')}</button>
        </section>`;
      }).join('')}
      ${draft.items.length ? '' : `<section class="card empty"><p>${t('Nothing logged today yet.', '今日仲未記錄。')}</p><p class="muted">${t('Add your first exercise. Last time’s numbers fill in for you.', '加第一個動作，上次嘅數字會自動填好。')}</p></section>`}
      <button id="addex" class="big ghost">+ ${t('Add exercise', '加動作')}</button>
      ${draft.items.length ? `<button id="save" class="big">${t('Save workout', '儲存訓練')}</button>` : ''}
      ${cardioHtml(cst)}`;
    wireCardio($app(), cst, user, draw);
    $app().querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      const id = b.dataset.pick || null; if (id === draft.dayId) return;
      const ticked = draft.items.some(it => it.sets.some(x => x.done));
      // keep what's been done; swap only the untouched exercises for the new day's
      const keepItems = draft.items.filter(it => it.sets.some(x => x.done) || draft.saved);
      const day = fullPlan.days.find(d => d.id === id) || null;
      const add = itemsFor(day).filter(n => !keepItems.some(k => k.id === n.id));
      draft = { ...draft, dayId: id, items: [...keepItems, ...add] };
      pickMsg = ticked || draft.saved ? t('Kept what you’ve done and added the rest.', '做咗嘅會保留，再加埋其餘動作。') : '';
      keep(); draw(); popAfter(`[data-pick="${id || ''}"]`);
    });

    $app().querySelectorAll('.ex').forEach(card => {
      const it = draft.items[+card.dataset.i];
      card.querySelectorAll('input').forEach(inp => inp.oninput = () => {
        const s = it.sets[+inp.closest('.set').dataset.j];
        s[inp.dataset.f] = inp.value === '' ? null : Number(inp.value.replace(',', '.'));
        keep();
      });
      card.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
        const act = b.dataset.act;
        if (act === 'drop') draft.items.splice(+card.dataset.i, 1);
        if (act === 'addset') { const l = it.sets.at(-1) || {}; it.sets.push({ kg: l.kg ?? null, reps: l.reps ?? null }); }
        if (act === 'unset') it.sets.splice(+b.closest('.set').dataset.j, 1);
        if (act === 'tick') { const j = +b.closest('.set').dataset.j, x = it.sets[j]; x.done = !x.done; if (x.done) { startRest(restSec); popAfter(`.ex[data-i="${card.dataset.i}"] .set[data-j="${j}"] .tick`, 1.2); } }
        if (act === 'usecoach') { const c = coach(it.id); if (c) it.sets.forEach(x => { x.kg = c.kg; x.reps = c.reps; }); }
        keep(); draw();
      });
    });
    $app().querySelectorAll('[data-open]').forEach(b => b.onclick = () => openExercise(user, b.dataset.open, 'how'));
    $app().querySelectorAll('[data-habit]').forEach(b => b.onclick = async () => {
      const id = b.dataset.habit, on = !habitsDone.has(id);
      on ? habitsDone.add(id) : habitsDone.delete(id); draw(); popAfter(`[data-habit="${id}"] .hcheck`, 1.3);
      try { await api.setHabit(user.id, id, on); } catch (err) { on ? habitsDone.delete(id) : habitsDone.add(id); draw(); showError(err); }
    });
    $app().querySelector('#addex').onclick = () => picker(id => {
      const last = past(id).at(-1);
      draft.items.push({ id, sets: last ? last.sets.map(s => ({ kg: s.kg, reps: s.reps })) : [{ kg: null, reps: null }] });
      keep(); draw();
    });
    $app().querySelector('#save')?.addEventListener('click', save);
  }

  async function save(e) {
    const btn = e.currentTarget, rows = [];
    for (const it of draft.items) {
      let n = 0;
      for (const s of it.sets) {
        if (!(s.reps >= 1) && !(s.kg > 0)) continue;              // skip empty rows
        if (!(s.kg >= 0) || !(Number.isInteger(s.reps) && s.reps >= 0)) return showError({ message: t(`Check the numbers for ${exName(it.id)}.`, `檢查吓「${exName(it.id)}」嘅數字。`) });
        rows.push({ exercise_id: it.id, set_no: ++n, weight_kg: s.kg, reps: s.reps });
      }
    }
    btnLoading(btn);
    try {
      await api.saveWorkout(user.id, rows);
      dropDraft(user.id);
      await btnDone(btn, t('Saved', '已儲存'));
      const prs = [...new Set(rows.map(r => r.exercise_id))]
        .map(id => ({ id, now: Math.max(...rows.filter(r => r.exercise_id === id && r.reps >= 1).map(r => r.weight_kg), 0), before: prOf(past(id)).kg }))
        .filter(p => p.before > 0 && p.now > p.before);
      location.hash = '#/p/me';
      setTimeout(() => note(prs.length
        ? t(`Saved. New PR: ${prs.map(p => `${exName(p.id)} ${kg(p.now)}`).join(', ')} 🏆`, `已儲存。破咗 PR：${prs.map(p => `${exName(p.id)} ${kg(p.now)}`).join('、')} 🏆`)
        : t('Workout saved.', '訓練已儲存。')), 300);
    } catch (err) { showError(err); btnReset(btn); }
  }

  draw();
}

// Bottom sheet to pick an exercise: search + body part filter. Also used by the Me page.
export function picker(onPick, only) {
  const box = document.createElement('div');
  box.className = 'sheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', t('Add exercise', '加動作'));
  let cat = '', q = '';
  const pool = only ? EXERCISES.filter(([id]) => only.includes(id)) : EXERCISES;
  const list = () => pool.filter(([id, en, zh, c]) => (!cat || c === cat) && (!q || `${en} ${zh}`.toLowerCase().includes(q)));
  function draw() {
    box.innerHTML = `<div class="sheet-in">
      <div class="ex-head"><h3>${t('Pick an exercise', '揀動作')}</h3><button class="ghost x" id="close" aria-label="${t('Close', '關閉')}">✕</button></div>
      <input id="q" placeholder="${t('Search, e.g. bench', '搜尋，例如 臥推')}" value="${esc(q)}" autocomplete="off" aria-label="${t('Search', '搜尋')}">
      <div class="chips"><button data-c="" class="${cat ? '' : 'on'}">${t('All', '全部')}</button>${Object.keys(CATS).map(k => `<button data-c="${k}" class="${cat === k ? 'on' : ''}">${esc(catName(k))}</button>`).join('')}</div>
      <ul class="pick">${list().map(([id, , , , equip]) => `<li><button data-id="${id}"><b>${esc(exName(id))}</b> <span class="muted">${EX[id].custom ? esc(EX[id].mine ? t('Added by you', '你加嘅') : t('Added by your group', 'Group 加嘅')) : `${esc(exSub(id))} · ${esc(equipName(equip))}`}</span></button></li>`).join('') || `<li class="muted">${t('No match', '搵唔到')}</li>`}
        <li><button class="add-own" id="addown">+ ${q ? t(`Add “${esc(q)}” as your own exercise`, `將「${esc(q)}」加做自己嘅動作`) : t('Add your own exercise', '加自己嘅動作')}</button></li>
        <li><button class="add-own quiet" id="askex">${t('Request it with a 3D demo', '請求加入動作庫（連 3D 示範）')}</button></li></ul>
    </div>`;
    box.querySelector('#close').onclick = () => box.remove();
    const qi = box.querySelector('#q');
    qi.oninput = () => { q = qi.value.trim().toLowerCase(); const pos = qi.selectionStart; draw(); const n = box.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
    box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { box.remove(); onPick(b.dataset.id); });
    box.querySelector('#askex').onclick = async () => {
      box.hidden = true;
      const sent = await requestSheet({ name: box.querySelector('#q').value.trim() });
      box.hidden = false;
      if (sent) { box.remove(); note(t('Request sent. Check the library to see when it’s added.', '請求已送出。加咗之後喺動作庫睇得到。')); }
    };
    box.querySelector('#addown').onclick = async () => {
      const user = await api.currentUser(); if (!user) return;
      const raw = box.querySelector('#q').value.trim();
      box.hidden = true;
      const made = await addCustomSheet(user, { name: raw });
      if (!made) { box.hidden = false; return; }
      box.remove();
      if (made.kind === 'weight') onPick(made.id);
      else { window.dispatchEvent(new HashChangeEvent('hashchange')); setTimeout(() => note(t('Added. Log it in the Cardio card below.', '加咗。喺下面嘅有氧卡記錄。')), 400); }
    };
  }
  draw();
  document.body.append(box);
  box.querySelector('#q').focus();
}

// ---------- progress ----------
export function spark(values, label) {
  const pts = values.filter(k => k > 0);
  if (pts.length < 2) return '';
  const W = 300, H = 64, lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const xy = pts.map((k, i) => [8 + i * (W - 16) / (pts.length - 1), H - 8 - (k - lo) / span * (H - 16)]);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    <polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"/>`).join('')}</svg>`;
}

export async function progressScreen(user, who) {
  const uid = who === 'me' ? user.id : who;
  const mineP = uid === user.id, weekStart = api.ukWeekStart();
  const [profile, rows, habitRows, ciDays] = await Promise.all([api.getProfile(uid), api.liftHistory(uid),
    mineP ? api.habitTicks(uid, '2000-01-01') : [], mineP ? api.checkinDates(uid) : []]);
  const sessions = bySession(rows);
  const order = Object.keys(sessions).sort((a, b) => sessions[b].at(-1).date.localeCompare(sessions[a].at(-1).date));
  const mine = uid === user.id;
  const total = BIG_FOUR.reduce((s, id) => s + prOf(sessions[id] || []).kg, 0);
  const days = new Set(rows.map(r => r.performed_on)).size;
  $app().innerHTML = `
    <header class="page-head"><div><h2>${mine ? t('Your progress', '你嘅進度') : t(`${esc(profile.display_name)}’s progress`, `${esc(profile.display_name)} 嘅進度`)}</h2>
      <p class="muted">${t(`${days} workout${days === 1 ? '' : 's'} logged`, `記錄咗 ${days} 次訓練`)}</p></div>
      ${mine ? `<a class="link" href="#/me">${t('Me', '我')} ›</a>` : ''}</header>
    ${mine ? `<a class="big" href="#/log">${t('Log today’s workout', '記錄今日訓練')}</a>` : ''}
    ${mine ? levelCardHtml(points(rows, habitRows, ciDays, weekStart), weekStart) : ''}
    ${coverageHtml(coverage(rows, weekStart))}
    <section class="card"><h3>${t('Personal bests', '個人最佳')}</h3>
      <div class="pbs">${BIG_FOUR.map(id => { const p = prOf(sessions[id] || []); return `<div><span class="muted">${esc(exName(id))}</span><b>${p.kg ? kg(p.kg) : '—'}</b></div>`; }).join('')}
        <div class="total"><span class="muted">${t('Total', '總和')}</span><b>${total ? kg(total) : '—'}</b></div></div></section>
    ${order.length ? order.map(id => {
      const list = sessions[id], pr = prOf(list), last = list.at(-1);
      const series = list.map(s => bestKg(s.sets));
      return `<section class="card"><div class="ex-head"><button class="ex-name" data-open="${id}"><h3>${esc(exName(id))}</h3><span class="muted">${esc(exSub(id))} · ${t('details', '詳情')} ›</span></button>
          <div class="pr"><span class="muted">PR</span><b>${pr.kg ? kg(pr.kg) : '—'}</b></div></div>
        ${spark(series, t(`Best set per session, ${kg(series[0])} to ${kg(series.at(-1))}`, `每次最重一組，由 ${kg(series[0])} 到 ${kg(series.at(-1))}`))}
        <p class="muted">${t('Last', '上次')} (${esc(fmtDay(last.date))}): ${esc(setsText(last.sets))} · ${t(`${list.length} session${list.length === 1 ? '' : 's'}`, `${list.length} 次`)}</p></section>`;
    }).join('') : `<section class="card empty"><p class="muted">${mine ? t('Nothing logged yet. Log your first workout.', '仲未有記錄，記低你第一次訓練啦。') : t('Nothing logged yet.', '仲未有記錄。')}</p></section>`}`;
  $app().querySelectorAll('[data-open]').forEach(b => b.onclick = () => openExercise(user, b.dataset.open, 'prog', uid));
}

// PB board for the group page: rows = members, columns = the four lifts + total
export async function pbBoardHtml(groupId, userId) {
  const rows = await api.groupLifts(groupId);
  if (!rows.length) return `<p class="muted">${t('No lifts logged yet. Log a workout to get on the board.', '仲未有人記錄。記一次訓練就上榜。')}</p>`;
  const people = {};
  for (const r of rows) (people[r.user_id] ||= { name: r.display_name, kg: {} }).kg[r.exercise_id] = +r.best_kg;
  const list = Object.entries(people).map(([id, p]) => ({ id, ...p, total: BIG_FOUR.reduce((s, e) => s + (p.kg[e] || 0), 0) }))
    .sort((a, b) => b.total - a.total);
  const short = { bench_press: t('Bench', '臥推'), deadlift: t('Dead', '硬舉'), squat: t('Squat', '深蹲'), ohp: t('OHP', '推舉') };
  return `<div class="tablewrap"><table class="pb"><thead><tr><th>${t('Name', '名')}</th>${BIG_FOUR.map(e => `<th>${short[e]}</th>`).join('')}<th>${t('Total', '總和')}</th></tr></thead>
    <tbody>${list.map(p => `<tr class="${p.id === userId ? 'me' : ''}"><td><a href="#/p/${p.id}">${esc(p.name)}</a></td>
      ${BIG_FOUR.map(e => `<td>${p.kg[e] ? +p.kg[e] : '—'}</td>`).join('')}<td><b>${+p.total.toFixed(2)}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="muted small">${t('kg, heaviest set with at least 1 rep. Tap a name to see their progress.', '單位 kg，最少 1 下嘅最重一組。撳個名睇佢嘅進度。')}</p>`;
}
