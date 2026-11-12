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

// item: { text, color, box, size (screen px), x, y (screen px, centre) }
function paint(g, it, k) {
  // k = how many photo pixels one screen pixel is; positions are already in photo pixels
  const size = it.size * k, lines = it.lines, lh = size * LINE;
  g.font = `${WEIGHT} ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const top = it.py - (lines.length * lh) / 2;
  lines.forEach((ln, i) => {
    const cy = top + lh * i + lh / 2;
    if (it.box && ln) {
      const w = g.measureText(ln).width + size * PAD_X * 2, h = lh + size * PAD_Y * 2, r = size * RADIUS;
      g.fillStyle = it.color; g.beginPath(); g.roundRect(it.px - w / 2, cy - h / 2, w, h, r); g.fill();
      g.fillStyle = darkText(it.color) ? '#111111' : '#ffffff'; g.shadowColor = 'transparent';
    } else {
      g.fillStyle = it.color; g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = size * .12; g.shadowOffsetY = size * .03;
    }
    g.fillText(ln, it.px, cy);
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
  });
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
    it.el.setAttribute('aria-label', it.text);
  }

  // --- editing sheet (dimmed photo, big centred text, colours, box, size) ---
  function edit(it) {
    if (cam.querySelector('.story-edit')) return;   // one editor at a time
    const fresh = !it;
    it = it || { text: '', color: '#ffffff', box: false, size: Math.round(Math.min(W(), 480) * .09), x: W() / 2, y: H() * .42 };
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

  // --- drag to move, tap to edit, drop on the bin to delete ---
  function hook(it) {
    let start = null, moved = false;
    it.el.addEventListener('pointerdown', e => {
      e.preventDefault(); it.el.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY, ox: it.x, oy: it.y }; moved = false;
    });
    it.el.addEventListener('pointermove', e => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) { moved = true; bin.hidden = false; onEditing?.(true); }
      it.x = Math.max(0, Math.min(W(), start.ox + dx)); it.y = Math.max(0, Math.min(H(), start.oy + dy));
      it.el.style.left = it.x + 'px'; it.el.style.top = it.y + 'px';
      const b = bin.getBoundingClientRect(), over = e.clientX > b.left - 20 && e.clientX < b.right + 20 && e.clientY > b.top - 20;
      bin.classList.toggle('hot', over); it.el.classList.toggle('dying', over);
    });
    const end = e => {
      if (!start) return;
      const wasMove = moved; start = null;
      if (!wasMove) { edit(it); return; }
      const dropped = bin.classList.contains('hot');
      bin.hidden = true; bin.classList.remove('hot'); onEditing?.(false);
      if (dropped) remove(it);
    };
    it.el.addEventListener('pointerup', end);
    it.el.addEventListener('pointercancel', end);
  }

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
