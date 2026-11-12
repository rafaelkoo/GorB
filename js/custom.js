// Add, rename or delete your own exercises (wall climbing, a machine only your gym has…).
// 'weight' = logged as sets (kg × reps), shows in progress and rankings.
// 'minutes' = logged in the cardio card on the Log page.
// Everyone in your groups can see and use what you add; there's no 3D demo for these.
import * as api from './supa.js';
import { CATS, registerCustom, newCustomId } from './exercises.js';
import { t } from './i18n.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CAT_ZH = { chest: '胸', back: '背', legs: '腿', shoulders: '肩', arms: '手臂', core: '核心', other: '其他' };

// reload everyone's exercises into the lists the app reads
export async function refreshCustom(userId) {
  registerCustom(await api.customExercises(), userId);
  window.dispatchEvent(new Event('customchange'));
}

// sheet to add one; resolves with { id, kind } or null if closed
export function addCustomSheet(user, { kind = 'weight', name = '' } = {}) {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'sheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t('Add your own exercise', '加自己嘅動作'));
    let cat = 'other';
    const close = v => { box.remove(); resolve(v); };
    function draw() {
      const nm = box.querySelector('#cname')?.value ?? name;
      box.innerHTML = `<form class="sheet-in custom-add">
        <div class="ex-head"><h3>${t('Add your own exercise', '加自己嘅動作')}</h3><button type="button" class="ghost x" id="cclose" aria-label="${t('Close', '關閉')}">✕</button></div>
        <label class="field">${t('Name', '名')}<input id="cname" maxlength="40" required value="${esc(nm)}" placeholder="${t('e.g. Wall climbing', '例如：攀石')}" autocomplete="off"></label>
        <fieldset class="kind"><legend>${t('How do you log it?', '點樣記錄？')}</legend>
          <label class="${kind === 'weight' ? 'on' : ''}"><input type="radio" name="kind" value="weight" ${kind === 'weight' ? 'checked' : ''}>
            <b>${t('Sets of weight × reps', '組數：重量 × 次數')}</b><small>${t('Like a lift. Shows in progress and rankings.', '同舉重一樣，會計入進度同排名。')}</small></label>
          <label class="${kind === 'timed' ? 'on' : ''}"><input type="radio" name="kind" value="timed" ${kind === 'timed' ? 'checked' : ''}>
            <b>${t('Sets of weight × seconds', '組數：重量 × 秒數')}</b><small>${t('Holds, like holding a weight for 30 s. Has a stopwatch on the Log page.', '撐住嘅動作，例如揸住重量 30 秒。記錄頁有計時器。')}</small></label>
          <label class="${kind === 'minutes' ? 'on' : ''}"><input type="radio" name="kind" value="minutes" ${kind === 'minutes' ? 'checked' : ''}>
            <b>${t('Minutes', '分鐘')}</b><small>${t('Like climbing or swimming. Logged with cardio, only you see it.', '例如攀石、游水。同有氧一齊記，得你自己睇到。')}</small></label>
        </fieldset>
        ${kind !== 'minutes' ? `<div><p class="muted small">${t('Body part', '部位')}</p><div class="chips">${Object.keys(CATS).map(k => `<button type="button" data-cat="${k}" aria-pressed="${cat === k}" class="${cat === k ? 'on' : ''}">${esc(t(CATS[k], CAT_ZH[k]))}</button>`).join('')}</div></div>` : ''}
        <p class="muted small">${t('Everyone in your groups can use it too. No 3D demo for your own exercises.', 'Group 入面嘅人都用得到。自己加嘅動作冇 3D 示範。')}</p>
        <p class="error" id="cerr" hidden></p>
        <button type="submit" id="csave">${t('Add exercise', '加動作')}</button>
      </form>`;
      box.querySelector('#cclose').onclick = () => close(null);
      box.querySelectorAll('input[name=kind]').forEach(r => r.onchange = () => { kind = r.value; draw(); });
      box.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; draw(); });
      box.querySelector('form').onsubmit = async e => {
        e.preventDefault();
        const n = box.querySelector('#cname').value.trim().replace(/\s+/g, ' ');
        if (!n) return;
        const btn = box.querySelector('#csave'); btn.disabled = true;
        try {
          const row = await api.addCustomExercise({ id: newCustomId(), name: n, kind, cat: kind !== 'minutes' ? cat : 'other' });
          await refreshCustom(user.id);
          close({ id: row.id, kind });
        } catch (err) { const p = box.querySelector('#cerr'); p.hidden = false; p.textContent = err?.message || String(err); btn.disabled = false; }
      };
    }
    draw();
    box.addEventListener('click', e => { if (e.target === box) close(null); });
    document.body.append(box);
    box.querySelector('#cname').focus();
  });
}

// rename / delete controls for one of your own (used in the library)
export async function renameCustom(user, id, name) { await api.renameCustomExercise(id, name); await refreshCustom(user.id); }
export async function setCustomCat(user, id, cat) { await api.setCustomExerciseCat(id, cat); await refreshCustom(user.id); }
export async function setCustomKind(user, id, kind) { await api.setCustomExerciseKind(id, kind); await refreshCustom(user.id); }
export async function deleteCustom(user, id) { await api.deleteCustomExercise(id); await refreshCustom(user.id); }

// ask for an exercise to be added to the library with a 3D demo; resolves true when sent
export function requestSheet({ name = '' } = {}) {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'sheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t('Request an exercise', '請求加動作'));
    const close = v => { box.remove(); resolve(v); };
    box.innerHTML = `<form class="sheet-in custom-add">
      <div class="ex-head"><h3>${t('Request an exercise', '請求加動作')}</h3><button type="button" class="ghost x" id="rclose" aria-label="${t('Close', '關閉')}">✕</button></div>
      <p class="muted small">${t('Ask for an exercise to be added to the library with a 3D demo. You can see whether it’s been added in the library.', '請求將一個動作加入動作庫，連 3D 示範。加咗未，喺動作庫睇得到。')}</p>
      <label class="field">${t('Exercise', '動作')}<input id="rname" maxlength="60" required value="${esc(name)}" placeholder="${t('e.g. Hip abduction machine', '例如：髖外展機')}" autocomplete="off"></label>
      <label class="field">${t('Anything else? (optional)', '補充（可以唔填）')}<textarea id="rnote" maxlength="300" rows="3" placeholder="${t('A video link, or what it works', '影片連結，或者練邊度')}"></textarea></label>
      <p class="error" id="rerr" hidden></p>
      <button type="submit" id="rsend">${t('Send request', '送出請求')}</button>
    </form>`;
    box.querySelector('#rclose').onclick = () => close(false);
    box.addEventListener('click', e => { if (e.target === box) close(false); });
    box.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const n = box.querySelector('#rname').value.trim().replace(/\s+/g, ' '); if (!n) return;
      const btn = box.querySelector('#rsend'); btn.disabled = true;
      try { await api.requestExercise(n, box.querySelector('#rnote').value.trim()); close(true); }
      catch (err) { const p = box.querySelector('#rerr'); p.hidden = false; p.textContent = err?.message || String(err); btn.disabled = false; }
    };
    document.body.append(box);
    box.querySelector('#rname').focus();
  });
}
