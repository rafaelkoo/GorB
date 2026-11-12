// Cardio log (FitTrack's cardio exercises): pick a kind, set minutes, add. Private.
// Weekly minutes are compared with the training guide's cardio target for your goal.
import * as api from './supa.js';
import { t } from './i18n.js';
import { esc, showError } from './ui.js';
import { popAfter } from './motion.js';
import { CUSTOM_CARDIO } from './exercises.js';
import { addCustomSheet } from './custom.js';

// ids match FitTrack's so the import lines up
export const CARDIO = [
  { id: 'cardio30', en: 'Incline walk', zh: '斜坡行' },
  { id: 'treadmill', en: 'Treadmill run', zh: '跑步機' },
  { id: 'bike', en: 'Bike', zh: '健身單車' },
  { id: 'rowing', en: 'Rower', zh: '划船機' },
  { id: 'stair_climber', en: 'Stair climber', zh: '踏步機' },
  { id: 'jump_rope', en: 'Jump rope', zh: '跳繩' },
  { id: 'hiit', en: 'HIIT', zh: '高強度間歇' },
  { id: 'battle_ropes', en: 'Battle ropes', zh: '戰繩' },
  { id: 'sled_push', en: 'Sled push', zh: '推雪橇' },
  { id: 'box_jump', en: 'Box jump', zh: '跳箱' }
];
// built-in kinds plus the minute-based exercises you and your groupmates added
export const cardioList = () => [...CARDIO, ...CUSTOM_CARDIO];
export const cardioName = id => { const c = cardioList().find(x => x.id === id); return c ? t(c.en, c.zh) : t('Removed exercise', '已刪除嘅動作'); };
export const weekMinutes = (logs, from, to) => logs.filter(c => c.performed_on >= from && c.performed_on <= to).reduce((n, c) => n + c.minutes, 0);

// st = { logs (this week, from the API), pick, mins, target (min/week or null), today, weekStart }
export function cardioHtml(st) {
  const todays = st.logs.filter(c => c.performed_on === st.today), week = weekMinutes(st.logs, st.weekStart, st.today);
  const pct = st.target ? Math.min(100, Math.round(week / st.target * 100)) : 0;
  return `<section class="card cardio"><div class="card-head"><h3>${t('Cardio', '有氧')}</h3>
      <span class="muted small">${t(`${week} min this week`, `今個星期 ${week} 分鐘`)}${st.target ? ` / ${st.target}` : ''}</span></div>
    ${st.target ? `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${t('Cardio this week', '今個星期有氧')}"><i style="width:${pct}%"></i></div>` : ''}
    ${todays.length ? `<ul class="cardio-list">${todays.map(c => `<li><b>${esc(cardioName(c.kind))}</b><span>${c.minutes} ${t('min', '分鐘')}</span>
        <button class="ghost x" data-cdel="${c.kind}" aria-label="${t('Remove', '移除')} ${esc(cardioName(c.kind))}">✕</button></li>`).join('')}</ul>` : ''}
    <div class="chips scroll" role="group" aria-label="${t('Kind of cardio', '有氧種類')}">${cardioList().map(c => `<button data-ckind="${c.id}" class="${st.pick === c.id ? 'on' : ''}" aria-pressed="${st.pick === c.id}">${esc(cardioName(c.id))}</button>`).join('')}<button data-cown class="add-own">+ ${t('Your own', '自己加')}</button></div>
    <div class="cardio-add"><div class="stepper" aria-label="${t('Minutes', '分鐘')}"><button class="ghost" data-cmin="-5" aria-label="${t('Minus 5 minutes', '減 5 分鐘')}">−</button>
      <span><b>${st.mins}</b><small>${t('min', '分鐘')}</small></span><button class="ghost" data-cmin="5" aria-label="${t('Plus 5 minutes', '加 5 分鐘')}">+</button></div>
      <button id="cadd" ${st.pick ? '' : 'disabled'}>${todays.some(c => c.kind === st.pick) ? t('Update', '更新') : t('Add cardio', '加有氧')}</button></div>
  </section>`;
}

export function wireCardio(root, st, user, redraw) {
  root.querySelectorAll('[data-ckind]').forEach(b => b.onclick = () => {
    st.pick = st.pick === b.dataset.ckind ? null : b.dataset.ckind;
    const had = st.logs.find(c => c.performed_on === st.today && c.kind === st.pick); if (had) st.mins = had.minutes;
    redraw(); popAfter(`[data-ckind="${b.dataset.ckind}"]`);
  });
  root.querySelector('[data-cown]')?.addEventListener('click', async () => {
    const made = await addCustomSheet(user, { kind: 'minutes' });
    if (!made) return;
    if (made.kind === 'minutes') st.pick = made.id;
    redraw();
  });
  root.querySelectorAll('[data-cmin]').forEach(b => b.onclick = () => { st.mins = Math.min(600, Math.max(5, st.mins + +b.dataset.cmin)); redraw(); });
  root.querySelector('#cadd')?.addEventListener('click', async () => {
    const kind = st.pick, minutes = st.mins;
    try {
      await api.setCardio(user.id, kind, minutes);
      st.logs = st.logs.filter(c => !(c.performed_on === st.today && c.kind === kind)).concat({ performed_on: st.today, kind, minutes });
      st.pick = null; redraw();
    } catch (err) { showError(err); }
  });
  root.querySelectorAll('[data-cdel]').forEach(b => b.onclick = async () => {
    const kind = b.dataset.cdel;
    try { await api.dropCardio(user.id, kind); st.logs = st.logs.filter(c => !(c.performed_on === st.today && c.kind === kind)); redraw(); } catch (err) { showError(err); }
  });
}
