// Exercise page, like FitTrack's exercise sheet: How to (3D demo, phases, cues, common mistakes),
// Progress (trend + PR + e1RM), History (every session), Add to plan.
// The 3D viewer, body model and Three.js load only when the How to tab opens.
import * as api from './supa.js';
import { EX as FT, bodyParts, muscleZh, equipZh } from './ftdata.js';
import { MOVES } from './moves.js';
import { EXERCISES, CATS, EX as LIB, CUSTOM_CARDIO } from './exercises.js';
import { addCustomSheet, renameCustom, deleteCustom, requestSheet } from './custom.js';
import { t, getLang, fmtDay } from './i18n.js';
import { exName, kg, spark, bySession, prOf } from './tracker.js';
import { cleanPlan, dayName } from './plan.js';
import { esc, showError, toast, render } from './ui.js';

const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30));   // Epley, as FitTrack
let viewer = null, box = null;
const dispose = () => { if (viewer) { viewer.dispose(); viewer = null; } };

export function closeExercise() {
  dispose();
  if (box) { box.remove(); box = null; document.body.style.overflow = ''; }
}

export async function openExercise(user, id, tab = 'how', who = user.id) {
  // your own exercises have no 3D demo: the sheet opens on Progress
  const own = LIB[id]?.custom ? LIB[id] : null;
  const ex = FT[id] || (own && { en: own.en, zh: own.zh, equip: 'Other', muscles: [], move: null }); if (!ex) return;
  if (own && tab === 'how') tab = 'prog';
  closeExercise();
  box = document.createElement('div');
  box.className = 'sheet exsheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', exName(id));
  document.body.append(box); document.body.style.overflow = 'hidden';
  const esc_ = e => { if (e.key === 'Escape') { closeExercise(); document.removeEventListener('keydown', esc_); } };
  document.addEventListener('keydown', esc_);

  const mine = who === user.id;
  const [rows, plan] = await Promise.all([api.liftHistory(who), mine ? api.getPlan(user.id) : null]);
  const sessions = (bySession(rows)[id] || []);
  let planObj = cleanPlan(plan || {});

  function draw() {
    dispose();
    const tabs = [...(own ? [] : [['how', t('How to', '教學')]]), ['prog', t('Progress', '進度')], ['hist', t('History', '記錄')]];
    box.innerHTML = `<div class="sheet-in tall">
      <div class="ex-head"><div><h3>${esc(exName(id))}</h3><span class="muted small">${own ? esc(own.mine ? t('Added by you · no 3D demo', '你加嘅 · 冇 3D 示範') : t('Added by your group · no 3D demo', 'Group 加嘅 · 冇 3D 示範')) : `${esc(getLang() === 'zh' ? ex.en : ex.zh)} · ${esc(t(ex.equip, equipZh(ex.equip)))}`}</span></div>
        <button class="ghost x" id="close" aria-label="${t('Close', '關閉')}">✕</button></div>
      <div class="seg wide" role="tablist">${tabs.map(([v, l]) => `<button role="tab" data-tab="${v}" aria-selected="${v === tab}" class="${v === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="body">${tab === 'how' ? howHtml() : tab === 'prog' ? progHtml() : histHtml()}</div>
    </div>`;
    box.querySelector('#close').onclick = closeExercise;
    box.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    if (tab === 'how') mount();
    box.querySelectorAll('[data-plan]').forEach(b => b.onclick = async () => {
      const day = planObj.days.find(x => x.id === b.dataset.plan); if (!day) return;
      const list = day.items, at = list.findIndex(e => e.id === id), nm = dayName(day);
      if (at >= 0) list.splice(at, 1); else list.push({ id, sets: 3, reps: 10 });
      try { await api.savePlan(user.id, planObj); b.classList.toggle('on', at < 0); b.setAttribute('aria-pressed', at < 0); toast(at < 0 ? t(`Added to ${nm}`, `已加入${nm}`) : t(`Removed from ${nm}`, `已由${nm}移除`)); }
      catch (err) { showError(err); }
    });
  }

  function howHtml() {
    const mv = MOVES[ex.move] || {}, ph = mv.phases || [];
    const prim = ex.muscles.slice(0, 1).map(m => t(m, muscleZh(m))), sec = ex.muscles.slice(1).map(m => t(m, muscleZh(m)));
    return `<div class="stage"><div class="cv" id="cv"></div><p class="cv-load" id="cvLoad">${t('Loading 3D model…', '載入 3D 模型…')}</p>
        <div class="stage-top"><span class="pill on" id="phName">${esc(ph[0] ? t(ph[0].en, ph[0].zh) : '')}</span><span class="pill">${t('Drag to rotate', '拖動旋轉')}</span></div>
        <div class="stage-bad" id="badTag" hidden><span class="pill bad">${t('Red = wrong form', '紅色 = 錯誤動作')}</span></div></div>
      <div class="ctrls"><button class="icon-btn" id="play" aria-label="${t('Pause', '暫停')}">❚❚</button>
        <div class="phases" id="phBar" style="grid-template-columns:repeat(${Math.max(1, ph.length)},1fr)">${ph.map((p, i) => `<div class="${i ? '' : 'on'}"><i></i><span>${esc(t(p.en, p.zh))}</span></div>`).join('')}</div></div>
      <div class="row-between">
        <div class="seg" role="group" aria-label="${t('View', '角度')}">${[['side', t('Side', '側面')], ['front', t('Front', '正面')], ['q', '3/4']].map(([v, l]) => `<button data-view="${v}" class="${(mv.cam?.view || 'q') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="${t('Speed', '速度')}"><button data-speed="0.5">0.5×</button><button data-speed="1" class="on">1×</button></div></div>
      <label class="switch"><input type="checkbox" id="slow" checked><span>${t('Slow down at key moments', '重點位置自動慢鏡')}</span></label>
      <div class="cue" aria-live="polite"><b id="cueN">1</b><p id="cueT"><strong>${esc(ph[0] ? t(ph[0].en, ph[0].zh) : '')}</strong> ${esc(ph[0] ? t(ph[0].cen, ph[0].czh) : '')}</p></div>
      ${ex.approx ? `<p class="muted small">${t('The demo shows a representative movement.', '示範用咗代表性嘅動作。')}</p>` : ''}
      <section class="card"><h3>${t('Key points', '要點')}</h3><p>${esc(t(ex.dEn, ex.dZh))}</p>
        <p class="muted small">${t('Primary', '主要')}: ${esc(prim.join(', '))}${sec.length ? ` · ${t('Secondary', '次要')}: ${esc(sec.join(', '))}` : ''}</p></section>
      ${mv.mistakes ? `<section class="card"><h3>${t('Common mistakes', '常見錯誤')}</h3><p class="muted small">${t('Tap “Show me” and a red figure plays the wrong way over the right one.', '撳「睇錯誤」，紅色公仔會重疊示範錯誤做法。')}</p>
        <ul class="mistakes">${mv.mistakes.map((m, i) => `<li><span>${esc(t(m.en, m.zh))}</span><button class="ghost small-btn" data-mistake="${i}" hidden>${t('Show me', '睇錯誤')}</button></li>`).join('')}</ul></section>` : ''}
      ${mine ? planHtml() : ''}`;
  }
  function planHtml() {
    return `<section class="card"><h3>${t('Add to plan', '加入計劃')}</h3>
      ${planObj.days.length ? `<div class="chips wrap">${planObj.days.map(d => { const on = d.items.some(e => e.id === id); return `<button data-plan="${d.id}" aria-pressed="${on}" class="${on ? 'on' : ''}">${esc(dayName(d))}</button>`; }).join('')}</div>`
        : `<p class="muted small">${t('Make a workout day first.', '要先整一個訓練日。')} <a class="link" href="#/plan">${t('Workout days', '訓練日')} ›</a></p>`}</section>`;
  }
  function progHtml() {
    if (!sessions.length) return `<section class="card empty"><p class="muted">${t('Save a workout with this exercise to see your trend here.', '儲存一次有呢個動作嘅訓練，就會見到走勢。')}</p></section>${mine ? planHtml() : ''}`;
    const pr = prOf(sessions);
    const best1 = Math.max(...sessions.flatMap(s => s.sets.filter(x => x.reps >= 1).map(x => e1rm(x.kg, x.reps))));
    const heavy = sessions.map(s => Math.max(0, ...s.sets.filter(x => x.reps >= 1).map(x => x.kg)));
    const vol = sessions.map(s => s.sets.reduce((a, x) => a + x.kg * x.reps, 0));
    return `<section class="card"><div class="stats">
        <div><span class="muted">PR</span><b>${kg(pr.kg)}</b><span class="muted small">${pr.date ? esc(fmtDay(pr.date)) : ''}</span></div>
        <div><span class="muted">${t('Est. 1RM', '估算 1RM')}</span><b>${kg(Math.round(best1 * 10) / 10)}</b><span class="muted small">Epley</span></div>
        <div><span class="muted">${t('Sessions', '次數')}</span><b>${sessions.length}</b></div></div></section>
      <section class="card"><h3>${t('Heaviest set', '最重一組')}</h3>${spark(heavy, t('Heaviest set per session', '每次最重一組')) || `<p class="muted small">${t('One session so far.', '暫時得一次。')}</p>`}</section>
      <section class="card"><h3>${t('Session volume', '每次總容量')}</h3>${spark(vol, t('kg × reps per session', '每次 kg × 次數')) || `<p class="muted small">${t('One session so far.', '暫時得一次。')}</p>`}
        <p class="muted small">${t(`Last: ${Math.round(vol.at(-1)).toLocaleString()} kg`, `上次：${Math.round(vol.at(-1)).toLocaleString()} kg`)}</p></section>
      ${mine ? planHtml() : ''}`;
  }
  function histHtml() {
    if (!sessions.length) return `<section class="card empty"><p class="muted">${t('Nothing logged yet.', '仲未有記錄。')}</p></section>`;
    let run = 0;
    const withPr = sessions.map(s => { const h = Math.max(0, ...s.sets.filter(x => x.reps >= 1).map(x => x.kg)); const isPr = h > run && run > 0; run = Math.max(run, h); return { ...s, isPr }; });
    return withPr.reverse().map(s => `<section class="card"><div class="card-head"><h3>${esc(fmtDay(s.date))}</h3>${s.isPr ? '<span class="pill gold">🏆 PR</span>' : ''}</div>
      <ol class="hist">${s.sets.map(x => `<li><span>${+x.kg} kg × ${x.reps}</span><span class="muted small">1RM ${Math.round(e1rm(x.kg, x.reps))}</span></li>`).join('')}</ol>
      <p class="muted small">${t('Volume', '總容量')} ${Math.round(s.sets.reduce((a, x) => a + x.kg * x.reps, 0)).toLocaleString()} kg</p></section>`).join('');
  }

  async function mount() {
    const el = box.querySelector('#cv'); if (!el) return;
    try {
      const { createViewer } = await import('./viewer3d.js');
      if (!box || !box.contains(el)) return;
      const v = await createViewer(el, { accent: '#e0342f' });
      if (!box || !box.contains(el)) { v.dispose(); return; }
      viewer = v; box.querySelector('#cvLoad')?.remove();
      v.onPhase((i, p) => {
        const n = box?.querySelector('#phName'); if (!n) return;
        n.textContent = t(p.en, p.zh);
        box.querySelector('#cueN').textContent = i + 1;
        box.querySelector('#cueT').innerHTML = `<strong>${esc(t(p.en, p.zh))}</strong> ${esc(t(p.cen, p.czh))}`;
        box.querySelectorAll('#phBar > div').forEach((d, j) => d.classList.toggle('on', j <= i));
      });
      v.setMove(ex.move, bodyParts(ex));
      // show "Show me" only for mistakes that have a red-figure demo
      for (const m of v.mistakes()) if (m.demo) box.querySelector(`[data-mistake="${m.i}"]`)?.removeAttribute('hidden');
      box.querySelector('#play').onclick = e => { const playing = v.toggle(); e.currentTarget.textContent = playing ? '❚❚' : '▶'; e.currentTarget.setAttribute('aria-label', playing ? t('Pause', '暫停') : t('Play', '播放')); };
      box.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { v.setView(b.dataset.view); box.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x === b)); });
      box.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => { v.setSpeed(+b.dataset.speed); box.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b)); });
      box.querySelector('#slow').onchange = e => v.setSlowmo(e.target.checked);
      let shown = -1;
      box.querySelectorAll('[data-mistake]').forEach(b => b.onclick = () => {
        const i = +b.dataset.mistake, on = shown !== i && v.setMistake(i);
        if (!on) v.setMistake(-1);
        shown = on ? i : -1;
        box.querySelectorAll('[data-mistake]').forEach(x => { const me = +x.dataset.mistake === shown; x.classList.toggle('on', me); x.textContent = me ? t('Stop', '停止') : t('Show me', '睇錯誤'); });
        box.querySelector('#badTag').hidden = shown < 0;
      });
    } catch (err) {
      console.error(err);
      const l = box?.querySelector('#cvLoad'); if (l) l.textContent = t('This phone can’t show 3D (WebGL needed).', '呢部手機顯示唔到 3D（需要 WebGL）。');
    }
  }

  draw();
}

// Library: every exercise, search + body part, tap for the exercise page
const CAT_ZH = { chest: '胸', back: '背', legs: '腿', shoulders: '肩', arms: '手臂', core: '核心', other: '其他' };
export async function libraryScreen(user) {
  let cat = '', q = '', reqs = [];
  const STATUS = { open: t('Waiting', '等緊'), added: t('Added', '已加入'), declined: t('Not adding', '唔加') };
  const loadReqs = async () => { try { reqs = await api.myRequests(); } catch { reqs = []; } };
  await loadReqs();
  const draw = () => {
    const list = EXERCISES.filter(([id, en, zh, c]) => (!cat || c === cat) && (!q || `${en} ${zh}`.toLowerCase().includes(q)));
    const el = render(`
      <header class="page-head"><div><h2>${t('Exercise library', '動作庫')}</h2><p class="muted">${t(`${EXERCISES.filter(([id]) => !LIB[id]?.custom).length} exercises with 3D demos`, `${EXERCISES.filter(([id]) => !LIB[id]?.custom).length} 個動作，全部有 3D 示範`)}</p></div>
        <a class="link" href="#/log">${t('Today', '今日')} ›</a></header>
      <section class="card own-ex"><div class="card-head"><h3>${t('Your own exercises', '自己加嘅動作')}</h3></div>
        ${mineList().length ? `<ul class="own-list">${mineList().map(x => `<li data-own="${x.id}">
            <input value="${esc(x.en)}" maxlength="40" aria-label="${t('Name', '名')}"><span class="muted small">${x.kind === 'minutes' ? t('minutes', '分鐘') : t('weight × reps', '重量 × 次數')}</span>
            <button class="ghost x" data-del="${x.id}" aria-label="${t('Delete', '刪除')} ${esc(x.en)}">✕</button></li>`).join('')}</ul>
          <p class="muted small">${t('Renaming changes it for your whole group. Deleting hides its past records too.', '改名會連 group 入面嘅人一齊改。刪除之後，以前嘅記錄都會睇唔到。')}</p>`
          : `<p class="muted">${t('Add things the library doesn’t have, like wall climbing or a machine only your gym has.', '加動作庫冇嘅嘢，例如攀石，或者你 gym 獨有嘅機。')}</p>`}
        <button id="addown">+ ${t('Add your own exercise', '加自己嘅動作')}</button>
        <div class="req"><div class="card-head"><h4>${t('Requests', '請求')}</h4><button class="link-btn" id="askex">${t('Request an exercise', '請求加動作')}</button></div>
          ${reqs.length ? `<ul class="own-list">${reqs.map(r => `<li><b>${esc(r.name)}</b><span class="tag st-${r.status}">${esc(STATUS[r.status])}</span>
            ${r.status === 'open' ? `<button class="ghost x" data-wd="${r.id}" aria-label="${t('Withdraw', '撤回')} ${esc(r.name)}">✕</button>` : ''}</li>`).join('')}</ul>`
            : `<p class="muted small">${t('Want it in the library with a 3D demo? Ask for it here.', '想佢喺動作庫有 3D 示範？喺度請求。')}</p>`}</div></section>
      <input id="q" placeholder="${t('Search, e.g. bench', '搜尋，例如 臥推')}" value="${esc(q)}" autocomplete="off" aria-label="${t('Search', '搜尋')}">
      <div class="chips scroll"><button data-c="" class="${cat ? '' : 'on'}">${t('All', '全部')}</button>${Object.keys(CATS).map(k => `<button data-c="${k}" class="${cat === k ? 'on' : ''}">${esc(t(CATS[k], CAT_ZH[k]))}</button>`).join('')}</div>
      <ul class="pick">${list.map(([id, , , c, equip]) => `<li><button data-id="${id}"><b>${esc(exName(id))}</b> <span class="muted">${esc(t(CATS[c], CAT_ZH[c]))} · ${LIB[id]?.custom ? esc(LIB[id].mine ? t('added by you', '你加嘅') : t('added by your group', 'Group 加嘅')) : esc(t(equip, equipZh(equip)))}</span></button></li>`).join('') || `<li class="muted">${t('No match', '搵唔到')}</li>`}</ul>
`);
    const qi = el.querySelector('#q');
    qi.oninput = () => { q = qi.value.trim().toLowerCase(); const pos = qi.selectionStart; draw(); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => openExercise(user, b.dataset.id, 'how'));
    el.querySelector('#askex').onclick = async () => { if (await requestSheet({ name: q })) { await loadReqs(); draw(); toast(t('Request sent.', '請求已送出。')); } };
    el.querySelectorAll('[data-wd]').forEach(b => b.onclick = async () => { try { await api.withdrawRequest(b.dataset.wd); await loadReqs(); draw(); } catch (err) { showError(err); } });
    el.querySelector('#addown').onclick = async () => { const made = await addCustomSheet(user, { name: q }); if (made) { draw(); toast(made.kind === 'weight' ? t('Added. It’s in the exercise list now.', '加咗，而家喺動作清單入面。') : t('Added. Log it in the Cardio card on the Log page.', '加咗。喺「記錄」頁嘅有氧卡記錄。')); } };
    el.querySelectorAll('[data-own] input').forEach(inp => inp.onchange = async () => {
      const id = inp.closest('[data-own]').dataset.own, name = inp.value.trim().replace(/\s+/g, ' ');
      if (!name) { draw(); return; }
      try { await renameCustom(user, id, name); toast(t('Renamed.', '改咗名。')); draw(); } catch (err) { showError(err); }
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = t('Delete?', '刪除？'); b.classList.add('danger-text'); return; }
      try { await deleteCustom(user, b.dataset.del); toast(t('Deleted.', '刪除咗。')); draw(); } catch (err) { showError(err); }
    });
  };
  // your own, both kinds
  const mineList = () => [...EXERCISES.filter(([id]) => LIB[id]?.custom && LIB[id].mine).map(([id]) => ({ ...LIB[id], kind: 'weight' })),
    ...CUSTOM_CARDIO.filter(c => c.mine).map(c => ({ ...c, kind: 'minutes' }))];
  draw();
}
