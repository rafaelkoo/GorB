// Rest timer between sets (FitTrack's): a bar above the tabs that survives page changes.
// Starts when a set is ticked done; vibrates at zero; +30s and Skip.
import { t } from './i18n.js';

let left = 0, max = 0, handle = null, finished = false;
const slot = () => document.getElementById('timer') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'timer' }));

export function startRest(sec) {
  clearInterval(handle);
  left = max = Math.max(5, Math.round(sec)); finished = false;
  handle = setInterval(tick, 1000);
  draw();
}
export function stopRest() { clearInterval(handle); handle = null; finished = false; left = 0; draw(); }
export const resting = () => !!handle;

function tick() {
  if (left > 0) left--;
  if (left === 0 && !finished) {
    finished = true;
    try { navigator.vibrate && navigator.vibrate([180, 80, 180]); } catch { /* no vibration */ }
    setTimeout(() => { if (finished) stopRest(); }, 4000);
  }
  draw();
}

function draw() {
  const el = slot();
  const hidden = !handle || !!document.querySelector('.cam');
  el.hidden = hidden;
  if (hidden) { el.innerHTML = ''; return; }
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
  el.className = finished ? 'go' : '';
  el.innerHTML = `<div class="tm" role="timer" aria-live="off">
    <div class="tm-text"><span>${finished ? t('Next set!', '開始下一組！') : t('Rest', '休息')}</span><b>${mm}:${ss}</b></div>
    <span class="tm-bar"><i style="width:${max ? left / max * 100 : 0}%"></i></span>
    ${finished ? '' : `<button class="ghost small-btn" id="tm-add">+30s</button>`}
    <button class="small-btn" id="tm-stop">${finished ? t('OK', '好') : t('Skip', '略過')}</button></div>`;
  el.querySelector('#tm-add')?.addEventListener('click', () => { left += 30; max = Math.max(max, left); draw(); });
  el.querySelector('#tm-stop').onclick = stopRest;
}
