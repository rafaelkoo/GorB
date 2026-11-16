// Rest timer between sets (FitTrack's): a bar above the tabs that survives page changes.
// Starts when a set is ticked done; vibrates at zero; +30s and Skip.
// Drag it (anywhere but its buttons) to move it out of the way; it stays there next time.
// Double-tap the grip to put it back above the tabs. The grip also moves it with the arrow keys.
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

// where you dragged it: { x, y } in px from the top-left, or null for the normal spot
const POS_KEY = 'gob_timer_pos';
let pos = null; try { pos = JSON.parse(localStorage.getItem(POS_KEY)); } catch { /* none */ }
const savePos = () => { try { pos ? localStorage.setItem(POS_KEY, JSON.stringify(pos)) : localStorage.removeItem(POS_KEY); } catch { /* private mode */ } };
// keep the whole bar on screen (also after rotating the phone)
function place(el) {
  el.classList.toggle('moved', !!pos);
  if (!pos) { el.style.left = el.style.top = ''; return; }
  const w = el.offsetWidth || 300, h = el.offsetHeight || 80;
  pos.x = Math.min(Math.max(4, pos.x), Math.max(4, innerWidth - w - 4));
  pos.y = Math.min(Math.max(4, pos.y), Math.max(4, innerHeight - h - 4));
  el.style.left = `${pos.x}px`; el.style.top = `${pos.y}px`;
}
addEventListener('resize', () => { const el = document.getElementById('timer'); if (el && !el.hidden) place(el); });

let shape = '';   // rebuild only when the buttons change, so a drag isn't cut off every second
function draw() {
  const el = slot();
  const hidden = !handle || !!document.querySelector('.cam');
  el.hidden = hidden;
  if (hidden) { el.innerHTML = ''; shape = ''; return; }
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
  el.className = `${finished ? 'go' : ''} ${pos ? 'moved' : ''}`.trim();
  const now = finished ? 'go' : 'run';
  if (shape !== now || !el.querySelector('.tm')) {
    shape = now;
    el.innerHTML = `<div class="tm" role="timer" aria-live="off">
      <button class="tm-grip" id="tm-grip" aria-label="${t('Move the timer: drag, or use the arrow keys. Double-tap to put it back.', '移動計時器：拖動，或者用方向鍵。撳兩下放返原位。')}"><svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true"><g fill="currentColor"><circle cx="4" cy="4" r="1.7"/><circle cx="10" cy="4" r="1.7"/><circle cx="4" cy="10" r="1.7"/><circle cx="10" cy="10" r="1.7"/><circle cx="4" cy="16" r="1.7"/><circle cx="10" cy="16" r="1.7"/></g></svg></button>
      <div class="tm-text"><span></span><b></b></div>
      <span class="tm-bar"><i></i></span>
      ${finished ? '' : `<button class="ghost small-btn" id="tm-add">+30s</button>`}
      <button class="small-btn" id="tm-stop">${finished ? t('OK', '好') : t('Skip', '略過')}</button></div>`;
    el.querySelector('#tm-add')?.addEventListener('click', () => { left += 30; max = Math.max(max, left); draw(); });
    el.querySelector('#tm-stop').onclick = stopRest;
    wireDrag(el);
  }
  el.querySelector('.tm-text span').textContent = finished ? t('Next set!', '開始下一組！') : t('Rest', '休息');
  el.querySelector('.tm-text b').textContent = `${mm}:${ss}`;
  el.querySelector('.tm-bar i').style.width = `${max ? left / max * 100 : 0}%`;
  place(el);
}

function wireDrag(el) {
  const tm = el.querySelector('.tm'), grip = el.querySelector('#tm-grip');
  let drag = null, lastTap = 0;
  tm.addEventListener('pointerdown', e => {
    if (e.button > 0 || (e.target.closest('button') && !e.target.closest('#tm-grip'))) return;
    const r = el.getBoundingClientRect();
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false, grip: !!e.target.closest('#tm-grip') };
    tm.setPointerCapture(e.pointerId);
  });
  tm.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    if (!drag.moved) {   // first real move: lift it off the tab bar at the spot it's at now
      drag.moved = true; el.classList.add('dragging');
      const r = el.getBoundingClientRect(); pos = { x: r.left, y: r.top }; el.classList.add('moved');
    }
    e.preventDefault();
    pos = { x: e.clientX - drag.dx, y: e.clientY - drag.dy }; place(el);
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, grip: onGrip } = drag; drag = null; el.classList.remove('dragging');
    if (moved) { savePos(); return; }
    // double-tap the grip: back to the normal spot
    if (onGrip) { const n = Date.now(); if (n - lastTap < 350) { pos = null; savePos(); place(el); } lastTap = n; }
  };
  tm.addEventListener('pointerup', end);
  tm.addEventListener('pointercancel', end);
  grip.addEventListener('keydown', e => {
    const step = e.shiftKey ? 60 : 20, d = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
    if (e.key === 'Escape' || e.key === 'Home') { e.preventDefault(); pos = null; savePos(); place(el); return; }
    if (!d) return;
    e.preventDefault();
    if (!pos) { const r = el.getBoundingClientRect(); pos = { x: r.left, y: r.top }; }
    pos = { x: pos.x + d[0], y: pos.y + d[1] }; place(el); savePos();
  });
}
