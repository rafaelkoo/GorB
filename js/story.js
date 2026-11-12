// Instagram-Stories-style text on the check-in photo: tap Aa, type, pick a colour and size,
// switch a box behind the text, drag it anywhere, tap it to edit, drag it onto the bin to delete.
// On Post the text is drawn into the photo itself, so the feed shows it exactly as placed.
// Line breaks are worked out once with the canvas and used for both the screen and the photo,
// so what you see is what gets posted.
import { t } from './i18n.js';

const COLORS = ['#ffffff', '#111111', '#e0342f', '#f2c230', '#35a565', '#4d8df0'];
const FONT = `'Barlow Condensed', 'Arial Narrow', 'Noto Sans HK', 'PingFang HK', system-ui, sans-serif`;
const WEIGHT = 800, LINE = 1.18, PAD_X = .32, PAD_Y = .08, RADIUS = .22, MAX_W = .82, MAX_TEXTS = 6;
const darkText = hex => ['#ffffff', '#f2c230'].includes(hex);   // light box → dark letters
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = document.createElement('canvas').getContext('2d');

// split into lines that fit maxW at this size (wraps on spaces, or anywhere for CJK)
function wrap(text, size, maxW) {
  ctx.font = `${WEIGHT} ${size}px ${FONT}`;
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const token of para.match(/[　-鿿＀-￯]|\S+|\s+/g) || ['']) {
      const next = line + token;
      if (line && ctx.measureText(next.trimEnd()).width > maxW) { out.push(line.trimEnd()); line = token.trimStart(); }
      else line = next;
      // a single word longer than the line: break it by letters
      while (ctx.measureText(line).width > maxW && line.length > 1) {
        let i = line.length - 1; while (i > 1 && ctx.measureText(line.slice(0, i)).width > maxW) i--;
        out.push(line.slice(0, i)); line = line.slice(i);
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

// item: { text, color, box, size (screen px, sets the line breaks), k (pinch scale), rot (radians), x, y (screen px, centre) }
// unit = photo pixels per screen pixel; px, py = the centre in photo pixels
function paint(g, it, unit) {
  const size = it.size, lines = it.lines, lh = size * LINE;
  g.save();
  g.translate(it.px, it.py); g.rotate(it.rot || 0); g.scale(unit * (it.k || 1), unit * (it.k || 1));
  g.font = `${WEIGHT} ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const top = -(lines.length * lh) / 2;
  lines.forEach((ln, i) => {
    const cy = top + lh * i + lh / 2;
    if (it.box && ln) {
      const w = g.measureText(ln).width + size * PAD_X * 2, h = lh + size * PAD_Y * 2, r = size * RADIUS;
      g.fillStyle = it.color; g.beginPath(); g.roundRect(-w / 2, cy - h / 2, w, h, r); g.fill();
      g.fillStyle = darkText(it.color) ? '#111111' : '#ffffff';
    } else {
      g.fillStyle = it.color; g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = size * .12 * unit * (it.k || 1); g.shadowOffsetY = size * .03 * unit * (it.k || 1);
    }
    g.fillText(ln, 0, cy);
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
  });
  g.restore();
}

export function storyEditor(cam, frame, img, { onEditing } = {}) {
  const items = [];
  const layer = document.createElement('div'); layer.className = 'story-layer';
  const bin = document.createElement('div'); bin.className = 'story-bin'; bin.hidden = true;
  bin.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"></path></svg>`;
  const tools = document.createElement('div'); tools.className = 'story-tools';
  tools.innerHTML = `<button type="button" class="story-aa" aria-label="${t('Add text', '加文字')}">Aa</button>`;
  cam.append(layer, bin, tools);
  const W = () => cam.clientWidth, H = () => cam.clientHeight;

  function place(it) {
    it.lines = wrap(it.text, it.size, W() * MAX_W);
    const box = it.box;
    it.el.innerHTML = it.lines.map(l => `<span style="${box ? `background:${it.color};color:${darkText(it.color) ? '#111' : '#fff'}` : `color:${it.color}`}">${esc(l) || '&nbsp;'}</span>`).join('<br>');
    it.el.className = `story-text${box ? ' boxed' : ''}`;
    it.el.style.cssText = `left:${it.x}px;top:${it.y}px;font-size:${it.size}px`;
    pose(it);
    it.el.setAttribute('aria-label', it.text);
  }

  const pose = it => { it.el.style.setProperty('--k', it.k || 1); it.el.style.setProperty('--r', `${it.rot || 0}rad`); };

  // --- editing sheet (dimmed photo, big centred text, colours, box, size) ---
  function edit(it) {
    if (cam.querySelector('.story-edit')) return;   // one editor at a time
    const fresh = !it;
    it = it || { text: '', color: '#ffffff', box: false, size: Math.round(Math.min(W(), 480) * .09), k: 1, rot: 0, x: W() / 2, y: H() * .42 };
    if (it.el) it.el.hidden = true;
    onEditing?.(true);
    const ov = document.createElement('div'); ov.className = 'story-edit';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', t('Text on photo', '相上面嘅文字'));
    ov.innerHTML = `
      <div class="se-top"><button type="button" class="se-box" aria-pressed="${it.box}" aria-label="${t('Box behind text', '文字底色')}"><b>A</b></button>
        <button type="button" class="se-done">${t('Done', '完成')}</button></div>
      <textarea class="se-input" rows="1" maxlength="120" placeholder="${t('Type something', '打啲字')}" aria-label="${t('Text', '文字')}"></textarea>
      <label class="se-size"><span class="sr">${t('Text size', '字體大小')}</span><input type="range" min="18" max="96" step="1" value="${it.size}"></label>
      <div class="se-colors" role="group" aria-label="${t('Colour', '顏色')}">${COLORS.map(c => `<button type="button" data-c="${c}" style="--sw:${c}" aria-label="${c}" aria-pressed="${c === it.color}"></button>`).join('')}</div>`;
    cam.append(ov);
    const ta = ov.querySelector('.se-input'), range = ov.querySelector('.se-size input'), boxBtn = ov.querySelector('.se-box');
    ta.value = it.text;
    const look = () => {
      ta.style.fontSize = `${it.size}px`;
      ta.style.color = it.box ? (darkText(it.color) ? '#111' : '#fff') : it.color;
      ta.style.background = it.box ? it.color : 'transparent';
      ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
      boxBtn.setAttribute('aria-pressed', it.box);
      ov.querySelectorAll('[data-c]').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === it.color));
    };
    ta.oninput = look;
    range.oninput = () => { it.size = +range.value; look(); };
    boxBtn.onclick = () => { it.box = !it.box; look(); ta.focus(); };
    ov.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { it.color = b.dataset.c; look(); ta.focus(); });
    const done = () => {
      it.text = ta.value.replace(/\s+$/, '').slice(0, 120);
      ov.remove(); onEditing?.(false);
      if (!it.text.trim()) { if (!fresh) remove(it); return; }
      if (fresh) { it.el = document.createElement('div'); layer.append(it.el); items.push(it); hook(it); }
      it.el.hidden = false; place(it);
    };
    ov.querySelector('.se-done').onclick = done;
    ov.addEventListener('click', e => { if (e.target === ov) done(); });
    look(); ta.focus();
  }

  function remove(it) { it.el?.remove(); items.splice(items.indexOf(it), 1); }

  // --- one finger: drag (drop on the bin to delete), tap to edit.
  //     two fingers: pinch to resize, twist to rotate. The second finger can be anywhere on the photo. ---
  const pts = new Map();          // pointerId → {x, y}
  let g = null;                   // the gesture in progress
  const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  const rect = () => cam.getBoundingClientRect();
  function startPinch() {
    const m = two();
    g.pinch = { d0: m.d || 1, a0: m.a, k0: g.it.k || 1, r0: g.it.rot || 0, mx0: m.mx, my0: m.my, x0: g.it.x, y0: g.it.y };
    g.moved = true; bin.hidden = true; onEditing?.(true);
  }
  function hook(it) {
    it.el.addEventListener('pointerdown', e => {
      if (g) return;          // already holding another text
      e.preventDefault(); e.stopPropagation();
      layer.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      g = { it, start: { x: e.clientX, y: e.clientY, ox: it.x, oy: it.y }, moved: false, pinch: null };
      layer.append(it.el);    // bring to front
    });
  }
  layer.addEventListener('pointerdown', e => {
    if (!g || pts.has(e.pointerId)) return;
    e.preventDefault(); layer.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) startPinch();
  });
  layer.addEventListener('pointermove', e => {
    if (!g || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const it = g.it;
    if (g.pinch && pts.size >= 2) {
      const m = two(), p = g.pinch;
      it.k = Math.max(.35, Math.min(5, p.k0 * m.d / p.d0));
      it.rot = p.r0 + (m.a - p.a0);
      // snap to straight when within ~4°
      const turns = it.rot / (Math.PI / 2), near = Math.round(turns);
      if (Math.abs(turns - near) * 90 < 4) it.rot = near * Math.PI / 2;
      it.x = Math.max(0, Math.min(W(), p.x0 + m.mx - p.mx0)); it.y = Math.max(0, Math.min(H(), p.y0 + m.my - p.my0));
      it.el.style.left = it.x + 'px'; it.el.style.top = it.y + 'px'; pose(it);
      return;
    }
    if (g.pinch) return;      // one finger left after a pinch: hold still until it lifts
    const dx = e.clientX - g.start.x, dy = e.clientY - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    if (!g.moved) { g.moved = true; bin.hidden = false; onEditing?.(true); }
    it.x = Math.max(0, Math.min(W(), g.start.ox + dx)); it.y = Math.max(0, Math.min(H(), g.start.oy + dy));
    it.el.style.left = it.x + 'px'; it.el.style.top = it.y + 'px';
    const b = bin.getBoundingClientRect(), over = e.clientX > b.left - 20 && e.clientX < b.right + 20 && e.clientY > b.top - 20;
    bin.classList.toggle('hot', over); it.el.classList.toggle('dying', over);
  });
  const lift = e => {
    if (!g || !pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size) return;     // a finger is still down
    const { it, moved } = g, dropped = bin.classList.contains('hot');
    g = null; bin.hidden = true; bin.classList.remove('hot'); it.el.classList.remove('dying');
    if (!moved) { edit(it); return; }
    onEditing?.(false);
    if (dropped) remove(it);
  };
  layer.addEventListener('pointerup', lift);
  layer.addEventListener('pointercancel', lift);
  // the down event lands on the text, the rest of the gesture on the layer
  layer.style.touchAction = 'none';

  tools.querySelector('.story-aa').onclick = () => { if (items.length < MAX_TEXTS) edit(); };

  return {
    count: () => items.length,
    // draw the photo plus every text into a canvas the size of the photo
    async bake() {
      try { await document.fonts.load(`${WEIGHT} 40px 'Barlow Condensed'`); } catch { /* falls back to the next font */ }
      const c = document.createElement('canvas'); c.width = frame.width; c.height = frame.height;
      const g = c.getContext('2d'); g.drawImage(frame, 0, 0);
      // the preview is object-fit: cover, so map screen points into the photo the same way
      const s = Math.max(W() / frame.width, H() / frame.height);
      const offX = (W() - frame.width * s) / 2, offY = (H() - frame.height * s) / 2;
      for (const it of items) paint(g, { ...it, px: (it.x - offX) / s, py: (it.y - offY) / s }, 1 / s);
      return c;
    },
    destroy() { layer.remove(); bin.remove(); tools.remove(); cam.querySelector('.story-edit')?.remove(); onEditing?.(false); }
  };
}
