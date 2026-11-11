// Micro-interactions (from the component wall): staggered card entrance on each new screen,
// numbers that count up, a springy pop on whatever you just tapped, and buttons that go
// spinner → tick. Screens re-draw with innerHTML, so motion is triggered on purpose here,
// never by CSS transitions alone. Everything is skipped when the phone asks for less motion.
export const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
const OUT = 'cubic-bezier(.16,1,.3,1)';
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let entering = false;
// call at the start of every route: the next thing drawn into #app animates in
export function markRoute() { entering = true; }

export function initMotion(app) {
  new MutationObserver(() => {
    if (!entering) return;
    entering = false;
    if (calm()) return;
    app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter');
    clearTimeout(app._enterT); app._enterT = setTimeout(() => app.classList.remove('enter'), 1100);
    countUp(app);
  }).observe(app, { childList: true });
}

// <b data-count="35">35</b> → counts 0 → 35 (keeps any text after the number in data-suffix)
export function countUp(root) {
  if (calm()) return;
  root.querySelectorAll('[data-count]').forEach((el, i) => {
    const to = +el.dataset.count; if (!Number.isFinite(to) || to === 0) return;
    const dec = (String(el.dataset.count).split('.')[1] || '').length, suf = el.dataset.suffix || '';
    const fmt = v => v.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
    const dur = 700 + Math.min(500, Math.log10(Math.abs(to) + 1) * 180), t0 = performance.now() + i * 40;
    el.textContent = fmt(0);
    const step = now => {
      const p = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(to * e);
      if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(to);
    };
    requestAnimationFrame(step);
  });
}

// springy press-and-release on one element
export function pop(el, big = 1.12) {
  if (!el || calm() || !el.animate) return;
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)', offset: .25 }, { transform: `scale(${big})`, offset: .6 }, { transform: 'scale(1)' }],
    { duration: 480, easing: 'ease-out' });
}
// after a redraw: pop the element that now matches the selector
export function popAfter(sel, big) { requestAnimationFrame(() => pop(document.querySelector(sel), big)); }

// slide a sheet up from the bottom
export function sheetIn(el) {
  if (!el || calm() || !el.animate) return;
  el.animate([{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: OUT });
}

// button states: loading (spinner) → done (tick + label) → back
export function btnLoading(btn) {
  if (!btn) return;
  btn._label = btn._label ?? btn.innerHTML;
  btn.disabled = true; btn.classList.add('is-loading'); btn.classList.remove('is-done');
  btn.innerHTML = `<span class="spin" aria-hidden="true"></span><span class="sr">${btn.textContent}</span>`;
}
export function btnDone(btn, label) {
  if (!btn) return Promise.resolve();
  btn.classList.remove('is-loading'); btn.classList.add('is-done');
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg><span>${label}</span>`;
  return new Promise(r => setTimeout(r, calm() ? 0 : 650));
}
export function btnReset(btn) {
  if (!btn || btn._label == null) return;
  btn.classList.remove('is-loading', 'is-done'); btn.disabled = false; btn.innerHTML = btn._label; btn._label = null;
}
