// "Me" page: weekly target, lift targets, body details + goal, daily numbers, settings.
// Body details are private unless "Show to my groups" is on (the database enforces this).
import * as api from './supa.js';
import { BIG_FOUR } from './exercises.js';
import { t, getLang, setLang, langSwitchHtml, fmtDay } from './i18n.js';
import { exName, kg, picker, spark, bySession, prOf } from './tracker.js';
import { pushSupported, pushState, enablePush, disablePush, testNotification } from './push.js';
import { esc, render, busy, showError, toast, wireLangSwitch } from './ui.js';
import { importFitTrack } from './importer.js';
import { pop, popAfter } from './motion.js';
import { targetStatus, targetAdvice, bodyAdvice, e1rm } from './coach.js';

// FitTrack goals (same ids)
export const GOALS = [
  { id: 'lose_weight', en: 'Lose weight', zh: '減重瘦身' },
  { id: 'build_muscle', en: 'Build muscle', zh: '增肌健體' },
  { id: 'recomp', en: 'Body recomp', zh: '增肌減脂' },
  { id: 'strength', en: 'Strength & power', zh: '增強力量' },
  { id: 'endurance', en: 'Cardio & endurance', zh: '心肺耐力' },
  { id: 'wellness', en: 'General wellness', zh: '健康保持' }
];
// calories vs maintenance and protein per kg body weight for each goal.
// lose_weight and build_muscle are FitTrack's numbers; the others are rough middle values.
const PLAN = {
  lose_weight: { kcal: -550, protein: 1.8 }, build_muscle: { kcal: 400, protein: 2.0 }, recomp: { kcal: -250, protein: 2.0 },
  strength: { kcal: 200, protein: 1.8 }, endurance: { kcal: 0, protein: 1.4 }, wellness: { kcal: 0, protein: 1.2 }
};
const bmi = (w, h) => +(w / ((h / 100) ** 2)).toFixed(1);
// same bands as FitTrack
const bmiLabel = b => b < 18.5 ? t('Underweight', '過輕') : b < 23 ? t('Healthy', '正常') : b < 27.5 ? t('Overweight', '過重') : t('Obese', '肥胖');
// Mifflin–St Jeor × 1.55 (moderately active), as in FitTrack; FitTrack had no sex field and used the male constant
const tdee = (w, h, a, sex) => Math.round((10 * w + 6.25 * h - 5 * a + (sex === 'female' ? -161 : 5)) * 1.55);

const num = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));

// bottom sheet for a lift target: kg × reps, optional deadline; resolves null when cancelled
function askTarget(title, hint, value) {
  return new Promise(done => {
    const box = document.createElement('div');
    box.className = 'sheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', title);
    box.innerHTML = `<form class="sheet-in"><div class="ex-head"><h3>${esc(title)}</h3><button type="button" class="ghost x" id="close" aria-label="${t('Close', '關閉')}">✕</button></div>
      <p class="muted">${esc(hint)}</p>
      <div class="grid2"><label class="field">kg<input id="kg" inputmode="decimal" value="${value.kg ?? ''}" required></label>
        <label class="field">${t('Reps', '次數')}<input id="reps" inputmode="numeric" value="${value.reps ?? 1}" required></label>
        <label class="field full">${t('By (optional)', '期限（可以唔填）')}<input id="by" type="date" value="${value.by ?? ''}"></label></div>
      <p class="muted small">${t('Progress is measured with est. 1RM, so 100 kg × 5 counts lighter sets with more reps too.', '進度用估算 1RM 計，所以 100 kg × 5 都會計埋輕啲但多次嘅組。')}</p>
      <button>${t('Save target', '儲存目標')}</button></form>`;
    const end = v => { box.remove(); done(v); };
    box.querySelector('#close').onclick = () => end(null);
    box.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const kg = num(box.querySelector('#kg').value), reps = parseInt(box.querySelector('#reps').value);
      if (!(kg > 0) || !(reps >= 1 && reps <= 30)) return;
      end({ kg, reps, by: box.querySelector('#by').value || null });
    };
    document.body.append(box);
    box.querySelector('#kg').select();
  });
}

export async function meScreen(user) {
  const [profile, body, weights, targets, history, weekDays] = await Promise.all([
    api.getProfile(user.id), api.bodyProfile(user.id), api.weights(user.id), api.liftTargets(user.id),
    api.liftHistory(user.id), api.daysThisWeek(user.id)
  ]);
  const b = body || {};
  const sessions = bySession(history);
  const latest = weights.at(-1)?.weight_kg != null ? +weights.at(-1).weight_kg : null;
  const first = weights[0]?.weight_kg != null ? +weights[0].weight_kg : null;
  const goalW = b.goal_weight_kg != null ? +b.goal_weight_kg : null;
  const target = profile.days_per_week;
  const canCalc = latest && b.height_cm && b.age;
  const plan = PLAN[b.goal_id];
  const maint = canCalc ? tdee(latest, +b.height_cm, b.age, b.sex) : null;

  const el = render(`
    <header class="page-head me-head">
      <div class="avatar" aria-hidden="true">${esc((profile.display_name || '?').slice(0, 1).toUpperCase())}</div>
      <div><h2>${esc(profile.display_name)}</h2><p class="muted">${esc(user.email || '')}</p></div>
      <a class="link" href="#/p/me">${t('My progress', '我嘅進度')} ›</a>
    </header>

    <section class="card">
      <div class="card-head"><h3>${t('Gym days this week', '今個星期去 gym')}</h3></div>
      <div class="week">
        <p class="big-num">${weekDays}<small> / ${target || '–'} ${t('days', '日')}</small></p>
        <div class="dots" aria-label="${t(`${weekDays} of ${target || 0} days`, `${target || 0} 日入面去咗 ${weekDays} 日`)}">${Array.from({ length: target || 0 }, (_, i) => `<i class="${i < weekDays ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <label class="field">${t('My target', '我嘅目標')}
        <select id="days"><option value="">${t('No target', '冇目標')}</option>${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${n === target ? 'selected' : ''}>${t(`${n} day${n === 1 ? '' : 's'} a week`, `每星期 ${n} 日`)}</option>`).join('')}</select></label>
      <p class="muted small">${t('Your groups can see this target.', 'Group 入面嘅人睇到呢個目標。')}</p>
    </section>

    <section class="card">
      <div class="card-head"><h3>${t('Lift targets', '舉重目標')}</h3><button id="addtarget" class="ghost small-btn">+ ${t('Add', '加')}</button></div>
      ${targets.length ? `<ul class="targets">${targets.map(tg => {
        const st = targetStatus(tg, sessions[tg.exercise_id], api.ukToday()), adv = targetAdvice(tg.exercise_id, st);
        const label = { done: t('Reached', '達標'), ontrack: t('On track', '進度良好'), behind: t('Behind', '落後'), late: t('Past date', '過咗期限'), improving: t('Improving', '進步緊'), flat: t('Stalled', '停滯') }[st.state];
        return `<li><div class="t-row"><b>${esc(exName(tg.exercise_id))}</b><span>${kg(tg.target_kg)} × ${tg.target_reps || 1}${tg.by_date ? ` · ${esc(fmtDay(tg.by_date))}` : ''}</span>
          <button class="ghost x" data-drop="${esc(tg.exercise_id)}" aria-label="${t('Remove target', '刪除目標')}">✕</button></div>
          <span class="bar ${st.state === 'done' ? 'hit' : st.state === 'behind' || st.state === 'late' ? 'warn' : ''}"><i style="width:${st.pct}%"></i></span>
          <span class="muted small">${st.pct}%${label ? ` · <b class="state ${st.state}">${label}</b>` : ''}${st.cur ? ` · ${t('best est. 1RM', '最佳估算 1RM')} ${kg(Math.round(st.cur * 10) / 10)} / ${kg(Math.round(st.goal * 10) / 10)}` : ''}</span>
          ${adv ? `<span class="small">${esc(t(adv.en, adv.zh))}</span>` : ''}</li>`;
      }).join('')}</ul>` : `<p class="muted">${t('Set a weight to aim for, e.g. bench 100 kg.', '定個目標重量，例如臥推 100 kg。')}</p>`}
      <label class="switch"><input type="checkbox" id="sharetargets" ${profile.share_targets ? 'checked' : ''}>
        <span>${t('Show my lift targets to my groups', '俾 group 睇我嘅舉重目標')}<small class="muted">${t('Off: only you see them.', '關：得你自己睇到。')}</small></span></label>
    </section>

    <a class="card linkcard" href="#/plan"><div><h3>${t('Workout days', '訓練日')}</h3><p class="muted small">${t('Your days to pick from, like Arms or Legs. The Log page fills in the one you pick.', '你會揀嘅訓練日，例如手臂日、腿日。喺「記錄」頁揀咗就會自動填好。')}</p></div><span aria-hidden="true">›</span></a>

    <section class="card">
      <div class="card-head"><h3>${t('Body weight', '體重')}</h3><span class="pill ${b.share_body ? 'on' : ''}">${b.share_body ? t('Shown to groups', 'Group 睇到') : t('Private', '私人')}</span></div>
      <div class="stats">
        <div><span class="muted">${t('Now', '而家')}</span><b>${latest ? kg(latest) : '—'}</b></div>
        <div><span class="muted">${t('Goal', '目標')}</span><b>${goalW ? kg(goalW) : '—'}</b></div>
        <div><span class="muted">${t('Change', '變化')}</span><b>${latest && first && weights.length > 1 ? `${latest - first > 0 ? '+' : ''}${+(latest - first).toFixed(1)} kg` : '—'}</b></div>
      </div>
      ${spark(weights.map(w => +w.weight_kg), t('Body weight over time', '體重走勢'))}
      ${latest && goalW ? `<p class="muted small">${Math.abs(latest - goalW) < 0.05 ? t('At your goal weight 🎯', '到咗目標體重 🎯') : t(`${+Math.abs(latest - goalW).toFixed(1)} kg to go`, `仲差 ${+Math.abs(latest - goalW).toFixed(1)} kg`)}${weights.length ? ` · ${t('last logged', '上次記錄')} ${esc(fmtDay(weights.at(-1).logged_on))}` : ''}</p>` : ''}
      ${(() => { const a = bodyAdvice(weights, goalW, b.goal_date, maint, api.ukToday()); return a ? `<p class="advice ${a.state}">${esc(t(a.en, a.zh))}</p>` : ''; })()}
      <form id="wlog" class="inline"><input id="w" inputmode="decimal" placeholder="${t('Today’s weight (kg)', '今日體重（kg）')}" aria-label="${t('Today’s weight in kg', '今日體重 kg')}"><button>${t('Log', '記錄')}</button></form>
    </section>

    <section class="card">
      <div class="card-head"><h3>${t('My goal', '我嘅目標')}</h3></div>
      <div class="chips wrap" id="goals">${GOALS.map(g => `<button data-goal="${g.id}" class="${b.goal_id === g.id ? 'on' : ''}">${esc(t(g.en, g.zh))}</button>`).join('')}</div>
      ${canCalc ? `<div class="stats four">
          <div><span class="muted">BMI</span><b>${bmi(latest, +b.height_cm)}</b><span class="muted small">${bmiLabel(bmi(latest, +b.height_cm))}</span></div>
          <div><span class="muted">${t('Calories', '卡路里')}</span><b>${plan ? maint + plan.kcal : maint}</b><span class="muted small">kcal / ${t('day', '日')}</span></div>
          <div><span class="muted">${t('Protein', '蛋白質')}</span><b>${Math.round(latest * (plan ? plan.protein : 1.6))} g</b><span class="muted small">/ ${t('day', '日')}</span></div>
          <div><span class="muted">${t('Water', '飲水')}</span><b>${(latest * 0.033).toFixed(1)} L</b><span class="muted small">/ ${t('day', '日')}</span></div>
        </div>
        <p class="muted small">${t(`Rough guide from your details (maintenance about ${maint} kcal${plan ? `, ${plan.kcal >= 0 ? '+' : ''}${plan.kcal} for your goal` : ''}). Not medical advice.`, `根據你嘅資料大概估計（維持體重大約 ${maint} kcal${plan ? `，目標調整 ${plan.kcal >= 0 ? '+' : ''}${plan.kcal}` : ''}）。唔係醫療建議。`)}</p>`
      : `<p class="muted">${t('Fill in your height, age and today’s weight to see BMI, calories, protein and water for your goal.', '填埋身高、年齡同今日體重，就會計到 BMI、卡路里、蛋白質同飲水量。')}</p>`}
    </section>

    <section class="card">
      <div class="card-head"><h3>${t('My details', '我嘅資料')}</h3></div>
      <form id="details" class="grid2">
        <label class="field">${t('Height (cm)', '身高（cm）')}<input name="height_cm" inputmode="decimal" value="${b.height_cm ?? ''}"></label>
        <label class="field">${t('Age', '年齡')}<input name="age" inputmode="numeric" value="${b.age ?? ''}"></label>
        <label class="field">${t('Sex (for calories)', '性別（計卡路里用）')}<select name="sex"><option value="">${t('Not set', '未填')}</option>
          <option value="male" ${b.sex === 'male' ? 'selected' : ''}>${t('Male', '男')}</option><option value="female" ${b.sex === 'female' ? 'selected' : ''}>${t('Female', '女')}</option></select></label>
        <label class="field">${t('Goal weight (kg)', '目標體重（kg）')}<input name="goal_weight_kg" inputmode="decimal" value="${b.goal_weight_kg ?? ''}"></label>
        <label class="field">${t('Goal date (optional)', '目標日期（可以唔填）')}<input name="goal_date" type="date" value="${b.goal_date ?? ''}"></label>
        <label class="switch full"><input type="checkbox" name="share_body" ${b.share_body ? 'checked' : ''}>
          <span>${t('Show my body details to my groups', '俾 group 睇我嘅身體資料')}<small class="muted">${t('Off: only you see height, age, weight and goal. On: groupmates see them and you join the weight change ranking.', '關：得你自己睇到身高、年齡、體重同目標。開：group 入面嘅人睇到，你亦會加入體重變化排名。')}</small></span></label>
        <button class="full">${t('Save details', '儲存資料')}</button>
      </form>
    </section>

    <section class="card">
      <div class="card-head"><h3>${t('Bring over FitTrack', '搬 FitTrack 資料過嚟')}</h3></div>
      <p class="muted small">${t('In FitTrack: Me → Export. Then pick that fittrack-backup file here. Workouts, body weight, details, goal, plan and targets come across; days you already logged here are kept as they are.', '喺 FitTrack：我 → 匯出。然後喺呢度揀嗰個 fittrack-backup 檔。訓練記錄、體重、資料、目標、計劃同舉重目標都會搬過嚟；呢度已經有記錄嘅日子會保持唔變。')}</p>
      <label class="file-btn"><input type="file" id="ftfile" accept="application/json,.json">${t('Choose FitTrack backup', '揀 FitTrack 備份檔')}</label>
      <p id="ftstate" class="muted small" hidden></p>
    </section>

    <section class="card">
      <div class="card-head"><h3>${t('Settings', '設定')}</h3></div>
      <div class="setting"><span>${t('Language', '語言')}</span>${langSwitchHtml()}</div>
      <div class="setting col"><span>${t('Rest between sets', '組間休息')}</span>
        <div class="chips wrap">${[30, 60, 90, 120, 180].map(sec => `<button data-rest="${sec}" class="${(b.rest_sec || 90) === sec ? 'on' : ''}">${sec < 60 ? sec + t('s', ' 秒') : sec / 60 + t(' min', ' 分鐘')}</button>`).join('')}</div></div>
      <div class="setting"><span>${t('Name', '名')}</span><form id="rename" class="inline"><input id="nm" maxlength="40" value="${esc(profile.display_name)}" aria-label="${t('Name', '名')}"><button class="ghost">${t('Save', '儲存')}</button></form></div>
      ${pushSupported() ? `<div class="setting col"><span>${t('Notifications', '通知')}</span><p id="nstate" class="muted small">…</p>
        <div class="row"><button id="non" hidden>${t('Turn on', '開')}</button><button id="ntest" class="ghost" hidden>${t('Send test', '測試')}</button><button id="noff" class="ghost" hidden>${t('Turn off', '關')}</button></div></div>` : ''}
      <button id="signout" class="ghost danger">${t('Sign out', '登出')}</button>
    </section>`);

  const again = () => meScreen(user).catch(showError);

  el.querySelector('#days').onchange = async e => {
    try { await api.updateProfile(user.id, { days_per_week: e.target.value ? +e.target.value : null }); again(); } catch (err) { showError(err); }
  };
  el.querySelector('#addtarget').onclick = () => picker(async id => {
    const pr = prOf(sessions[id] || []).kg;
    const v = await askTarget(t(`Target for ${exName(id)}`, `${exName(id)} 目標`),
      pr ? t(`Your PR is ${kg(pr)}`, `你嘅 PR 係 ${kg(pr)}`) : t('No lifts logged yet', '仲未有記錄'),
      { kg: pr ? Math.ceil((pr * 1.1) / 2.5) * 2.5 : '', reps: 1 });
    if (!v) return;
    const best = Math.max(0, ...(sessions[id] || []).flatMap(x => x.sets.filter(y => y.reps >= 1).map(y => e1rm(y.kg, y.reps))));
    try { await api.upsertTargets([{ user_id: user.id, exercise_id: id, target_kg: v.kg, target_reps: v.reps, by_date: v.by, set_on: api.ukToday(), base_e1rm: best ? Math.round(best * 100) / 100 : null }]); again(); }
    catch (err) { showError(err); }
  }, null);
  el.querySelectorAll('[data-drop]').forEach(btn => btn.onclick = async () => {
    try { await api.dropLiftTarget(user.id, btn.dataset.drop); again(); } catch (err) { showError(err); }
  });
  el.querySelector('#wlog').onsubmit = async e => {
    e.preventDefault();
    const v = num(el.querySelector('#w').value);
    if (!(v >= 30 && v <= 300)) return showError({ message: t('Enter a weight between 30 and 300 kg.', '輸入 30 至 300 kg 之間嘅體重。') });
    try { await api.logWeight(user.id, v); await again(); toast(t('Weight logged.', '體重已記錄。')); } catch (err) { showError(err); }
  };
  el.querySelectorAll('[data-goal]').forEach(btn => btn.onclick = async () => {
    try { await api.saveBodyProfile(user.id, { goal_id: btn.dataset.goal === b.goal_id ? null : btn.dataset.goal }); await again(); popAfter(`[data-goal="${btn.dataset.goal}"]`); } catch (err) { showError(err); }
  });
  el.querySelector('#details').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const fields = { height_cm: num(f.get('height_cm')), age: num(f.get('age')), sex: f.get('sex') || null,
      goal_weight_kg: num(f.get('goal_weight_kg')), goal_date: f.get('goal_date') || null, share_body: f.get('share_body') === 'on' };
    if (fields.height_cm != null && !(fields.height_cm >= 100 && fields.height_cm <= 250)) return showError({ message: t('Height must be 100–250 cm.', '身高要喺 100 至 250 cm 之間。') });
    if (fields.age != null && !(Number.isInteger(fields.age) && fields.age >= 12 && fields.age <= 100)) return showError({ message: t('Age must be a whole number, 12–100.', '年齡要係 12 至 100 嘅整數。') });
    if (fields.goal_weight_kg != null && !(fields.goal_weight_kg >= 30 && fields.goal_weight_kg <= 300)) return showError({ message: t('Goal weight must be 30–300 kg.', '目標體重要喺 30 至 300 kg 之間。') });
    try { await api.saveBodyProfile(user.id, fields); await again(); toast(t('Details saved.', '資料已儲存。')); } catch (err) { showError(err); }
  };
  wireLangSwitch(el, async lang => {
    try { await api.updateProfile(user.id, { lang }); } catch { /* the app still switches */ }
    window.dispatchEvent(new Event('langchange'));
  });
  el.querySelector('#rename').onsubmit = async e => {
    e.preventDefault();
    const v = el.querySelector('#nm').value.trim(); if (!v) return;
    try { await api.setName(user.id, v); await again(); toast(t('Name saved.', '名已儲存。')); } catch (err) { showError(err); }
  };
  el.querySelectorAll('[data-rest]').forEach(btn => btn.onclick = async () => {
    try { await api.saveBodyProfile(user.id, { rest_sec: +btn.dataset.rest }); el.querySelectorAll('[data-rest]').forEach(x => x.classList.toggle('on', x === btn)); pop(btn); } catch (err) { showError(err); }
  });
  el.querySelector('#sharetargets').onchange = async e => {
    try { await api.updateProfile(user.id, { share_targets: e.target.checked }); } catch (err) { showError(err); }
  };
  el.querySelector('#ftfile').onchange = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    const state = el.querySelector('#ftstate'); state.hidden = false;
    e.target.disabled = true;
    try {
      const r = await importFitTrack(user, await file.text(), msg => { state.textContent = msg; });
      await again();
      const n = (k, w) => `${k} ${w}${k === 1 ? '' : 's'}`;
      toast(t(`Imported ${n(r.workouts, 'workout')} (${n(r.sets, 'set')}), ${n(r.weights, 'weigh-in')}${r.targets ? `, ${n(r.targets, 'target')}` : ''}${r.cardio ? `, ${n(r.cardio, 'cardio session')}` : ''}${r.plan ? ', your plan' : ''}${r.details ? ', your details' : ''}.${r.skippedDays ? ` ${n(r.skippedDays, 'day')} already here kept as they were.` : ''}`,
        `已匯入 ${r.workouts} 次訓練（${r.sets} 組）、${r.weights} 次體重${r.targets ? `、${r.targets} 個目標` : ''}${r.cardio ? `、${r.cardio} 次有氧` : ''}${r.plan ? '、你嘅計劃' : ''}${r.details ? '、你嘅資料' : ''}。${r.skippedDays ? `呢度已有嘅 ${r.skippedDays} 日保持唔變。` : ''}`));
    } catch (err) { state.hidden = true; e.target.disabled = false; showError(err); }
  };
  el.querySelector('#signout').onclick = async () => {
    try { await disablePush(); } catch { /* still sign out */ }
    await api.signOut(); location.hash = '#/'; location.reload();
  };

  if (pushSupported()) {
    const text = el.querySelector('#nstate'), on = el.querySelector('#non'), off = el.querySelector('#noff'), test = el.querySelector('#ntest');
    const show = async () => {
      const st = await pushState();
      text.textContent = {
        on: t('On. You get a ping the first time each mate checks in each day.', '已開。每個朋友每日第一次打卡會通知你。'),
        off: t('Off. Turn on to get a ping when a mate checks in.', '已關。開咗就會喺朋友打卡時通知你。'),
        blocked: t('Blocked in the browser. ⋮ → Settings → Site settings → Notifications → allow this site.', '瀏覽器封鎖咗。⋮ → 設定 → 網站設定 → 通知 → 允許呢個網站。')
      }[st];
      on.hidden = st !== 'off'; off.hidden = test.hidden = st !== 'on';
    };
    on.onclick = async () => { busy(on, true); try { await enablePush(user.id); } catch (err) { showError(err); } busy(on, false); show(); };
    off.onclick = async () => { busy(off, true); try { await disablePush(); } catch (err) { showError(err); } busy(off, false); show(); };
    test.onclick = () => testNotification().catch(showError);
    show().catch(showError);
  }
}

export { getLang, setLang, BIG_FOUR };
