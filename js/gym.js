// "In the gym today": everyone in the group as their pixel avatar. Checked in today → at the
// equipment for what they did most (a squat rack for squats, the wall for climbing…). Not yet →
// dozing on the rest bench. Plus the avatar editor for the Me page.
import * as api from './supa.js';
import { t, getLang } from './i18n.js';
import { esc, showError } from './ui.js';
import { EX, CATS } from './exercises.js';
import { cardioName } from './cardio.js';
import { drawGym, drawPortrait, stationFor, cleanAvatar, W, H, SKINS, HAIR_COLORS, TOPS, SHORTS, HAIRS, BUILDS } from './pixel.js';
import { btnLoading, btnDone, btnReset } from './motion.js';

const exLabel = id => (getLang() === 'zh' ? EX[id]?.zh : EX[id]?.en) || '';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let stopAnim = null;
export function stopGym() { stopAnim?.(); stopAnim = null; }

const CAT_ZH = { chest: '胸', back: '背', legs: '腿', shoulders: '肩', arms: '手臂', core: '核心', other: '其他' };
const catLabel = k => t(CATS[k] || 'Other', CAT_ZH[k] || '其他');
// what you're mainly training today: the body part with the most sets (ticked or saved), and in it the
// exercise you ticked last (or the one with the most sets). That decides your station.
export function mainFocus(setsByEx = {}, lastEx = null) {
  const byCat = {};
  for (const [id, n] of Object.entries(setsByEx)) { const c = EX[id]?.cat || 'other'; byCat[c] = (byCat[c] || 0) + n; }
  const cats = Object.keys(byCat);
  if (!cats.length) return null;
  const cat = cats.sort((a, b) => byCat[b] - byCat[a])[0];
  const inCat = Object.keys(setsByEx).filter(id => (EX[id]?.cat || 'other') === cat);
  const ex = lastEx && inCat.includes(lastEx) ? lastEx : inCat.sort((a, b) => setsByEx[b] - setsByEx[a])[0];
  return { cat, ex, sets: Object.values(setsByEx).reduce((a, n) => a + n, 0) };
}
// rows from group_gym_today → people for the scene
function people(rows, user) {
  return rows.map(r => {
    const f = mainFocus(r.sets_by_ex || (r.exercise_id ? { [r.exercise_id]: r.sets || 1 } : {}), r.last_ex);
    return {
      id: r.user_id, name: r.display_name || '?', me: r.user_id === user.id,
      avatar: cleanAvatar(r.avatar, r.user_id),
      // ticking sets counts as being at the gym, even before the photo check-in
      inGym: !!r.checked_in || !!f, station: stationFor(f?.ex, r.cardio),
      what: f ? `${catLabel(f.cat)} · ${exLabel(f.ex)}` : r.cardio ? cardioName(r.cardio) : '', sets: f?.sets || 0
    };
  });
}
const caption = p => !p.inGym
  ? t(`${p.name} hasn’t been today. Resting on the bench 💤`, `${p.name} 今日未去，喺長櫈度休息緊 💤`)
  : p.what ? t(`${p.name} · ${p.what}${p.sets ? ` · ${p.sets} sets today` : ''}`, `${p.name} · ${p.what}${p.sets ? ` · 今日 ${p.sets} 組` : ''}`)
  : t(`${p.name} checked in today 💪`, `${p.name} 今日打咗卡 💪`);

export function gymCardHtml() {
  return `<section class="card gym-card" id="gymCard">
    <div class="card-head"><h3>${t('In the gym today', '今日喺 gym')}</h3><a class="link" href="#/me">${t('My character', '我嘅角色')} ›</a></div>
    <div class="gym-wrap"><canvas id="gymCanvas" role="img" aria-label="${t('Loading the gym…', '載入緊 gym…')}"></canvas></div>
    <p class="muted small gym-cap" id="gymCap" aria-live="polite">${t('Tap someone to see what they did.', '撳一個人睇佢做咗乜。')}</p></section>`;
}

export function mountGym(el, rows, user) {
  stopGym();
  const card = el.querySelector('#gymCard'); if (!card) return;
  if (!rows) { card.hidden = true; return; }
  const ps = people(rows, user);
  const cv = card.querySelector('#gymCanvas'), cap = card.querySelector('#gymCap'), wrap = card.querySelector('.gym-wrap');
  const inGym = ps.filter(p => p.inGym), resting = ps.filter(p => !p.inGym);
  cv.setAttribute('aria-label', t(
    `In the gym: ${inGym.map(p => `${p.name}${p.what ? ` (${p.what})` : ''}`).join(', ') || 'nobody yet'}. Resting: ${resting.map(p => p.name).join(', ') || 'nobody'}.`,
    `喺 gym：${inGym.map(p => `${p.name}${p.what ? `（${p.what}）` : ''}`).join('、') || '暫時冇人'}。休息緊：${resting.map(p => p.name).join('、') || '冇人'}。`));
  let scale = 3, boxes = [], raf = 0, last = 0, alive = true;
  const cards = {};
  const size = () => {
    const w = wrap.clientWidth || 340;
    scale = Math.max(2, Math.ceil(w * (window.devicePixelRatio || 1) / W));
    cv.width = W * scale; cv.height = H * scale;
  };
  const paint = now => { boxes = drawGym(cv, ps, now, scale, t('REST', '休息區')); };
  size(); paint(0);
  // animate only while it's on screen
  let visible = true;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !raf) loop(performance.now()); }) : null;
  io?.observe(cv);
  const loop = now => {
    raf = 0;
    if (!alive || !document.body.contains(cv)) { stopGym(); return; }
    if (now - last > 120) { last = now; paint(now); }
    if (visible && !reduced()) raf = requestAnimationFrame(loop);
  };
  if (!reduced()) raf = requestAnimationFrame(loop);
  const onResize = () => { size(); paint(performance.now()); };
  addEventListener('resize', onResize);
  stopAnim = () => { alive = false; cancelAnimationFrame(raf); io?.disconnect(); removeEventListener('resize', onResize); };
  // tap a person to see what they did
  cv.onclick = e => {
    const r = cv.getBoundingClientRect(), k = cv.width / r.width;
    const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
    const hit = boxes.filter(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1).pop();
    cap.textContent = hit ? caption(hit.p) : t('Tap someone to see what they did.', '撳一個人睇佢做咗乜。');
    if (hit) {
      const p = hit.p, show = c => { if (c && cap.dataset.who === p.id) cap.textContent = `${caption(p)} · Lv ${c.level} ${typeLabel(c.type)}`; };
      cap.dataset.who = p.id;
      if (cards[p.id]) show(cards[p.id]);
      else api.characterCard(p.id).then(c => { cards[p.id] = c; show(c); }).catch(() => {});
    }
  };
}

// ---------- character card (Pokémon-style; stats come from character_card on the server) ----------
export const TYPES = {
  strength: { en: 'Strength', zh: '力量型', icon: '🏋️', col: '#e2563b' },
  endurance: { en: 'Endurance', zh: '耐力型', icon: '🏃', col: '#2e9fd6' },
  climbing: { en: 'Climbing', zh: '攀石型', icon: '🧗', col: '#45b45a' },
  balanced: { en: 'Balanced', zh: '均衡型', icon: '⚖️', col: '#8c5bd6' },
  rookie: { en: 'Rookie', zh: '新手', icon: '🌱', col: '#8a8f98' }
};
export const typeLabel = ty => { const x = TYPES[ty] || TYPES.rookie; return `${x.icon} ${t(x.en, x.zh)}`; };
const STATS = [
  ['hp', 'HP', '體力', 290, 'Gym days in the last 60 days', '最近 60 日去 gym 嘅日數'],
  ['atk', 'Attack', '攻擊', 250, 'Your 3 best lifts as a one-rep max, last 60 days', '最近 60 日最重嘅 3 個動作（換算一下最大重量）'],
  ['def', 'Defence', '防禦', 250, 'Sets done in the last 60 days', '最近 60 日做咗幾多組'],
  ['spd', 'Speed', '速度', 200, 'Cardio minutes in the last 60 days', '最近 60 日 cardio 分鐘'],
  ['tec', 'Technique', '技巧', 150, 'Different exercises, and your hardest climb', '做過幾多種動作，同攀石最難嘅級數']
];
export function characterCardHtml(card, name, av) {
  if (!card) return '';
  const ty = TYPES[card.type] || TYPES.rookie, s = card.stats || {};
  const pct = Math.round(card.xp_in_level / card.xp_for_next * 100);
  return `<section class="card char-card" id="charCard" style="--type:${ty.col}">
    <div class="cc-top">
      <canvas id="ccPortrait" width="128" height="136" role="img" aria-label="${t('Your character', '你嘅角色')}"></canvas>
      <div class="cc-id"><h3>${esc(name)}</h3>
        <div class="cc-lv"><b>Lv ${card.level}</b><span class="type-badge">${ty.icon} ${t(ty.en, ty.zh)}</span></div>
        <div class="xp" role="progressbar" aria-valuemin="0" aria-valuemax="${card.xp_for_next}" aria-valuenow="${card.xp_in_level}" aria-label="${t('XP to the next level', '升下一級嘅經驗')}"><i style="width:${pct}%"></i></div>
        <p class="muted small">${t(`${card.xp_in_level} / ${card.xp_for_next} XP to Lv ${card.level + 1}`, `${card.xp_in_level} / ${card.xp_for_next} 經驗升 Lv ${card.level + 1}`)}</p>
        <p class="coins">💧 <b>${card.coins}</b> ${t('sweat coins', '汗水幣')}</p></div></div>
    <dl class="cc-stats">${STATS.map(([k, en, zh, max, hen, hzh]) => `<div class="st"><dt title="${esc(t(hen, hzh))}">${t(en, zh)}</dt>
      <dd><span class="bar"><i style="width:${Math.min(100, Math.round((s[k] || 0) / max * 100))}%"></i></span><b>${s[k] ?? 0}</b></dd></div>`).join('')}</dl>
    <details class="cc-how"><summary>${t('How it works', '點樣計')}</summary>
      <ul>${STATS.map(([, en, zh, , hen, hzh]) => `<li><b>${t(en, zh)}</b>: ${t(hen, hzh)}</li>`).join('')}
        <li>${t('Stats only count the last 60 days, so they drop if you stop going.', '能力只計最近 60 日，停咗唔去就會跌。')}</li>
        <li>${t('Type: what you trained most (weights, cardio or climbing).', '屬性：你最近練得最多嗰類（重量、cardio 定攀石）。')}</li>
        <li>${t('Level never goes down. XP: gym days, sets, cardio, climbs and new PBs. In battles each level adds 2% to every stat.', '等級唔會跌。經驗嚟自去 gym 日數、組數、cardio、攀石同破 PB。對戰時每級所有能力加 2%。')}</li>
        <li>${t('Sweat coins: 10 per gym day. You’ll bet them in battles.', '汗水幣：每日去 gym 10 個，之後對戰可以用嚟落注。')}</li></ul></details>
  </section>`;
}
export function mountCharacterCard(el, av) {
  const cv = el.querySelector('#ccPortrait'); if (!cv) return;
  let f = 0; drawPortrait(cv, av, 'stand', 0);
  const tick = setInterval(() => { if (!document.body.contains(cv)) return clearInterval(tick); if (!reduced()) { f ^= 1; drawPortrait(cv, av, 'stand', f); } }, 520);
}

// ---------- avatar editor (Me page) ----------
export function avatarCardHtml() {
  return `<section class="card avatar-card" id="avatarCard">
    <div class="card-head"><h3>${t('My character', '我嘅角色')}</h3><span class="muted small">${t('Shows in the group gym', '會喺 group 嘅 gym 出現')}</span></div>
    <div class="av-edit"><div class="av-stage"><canvas id="avPreview" width="192" height="204" role="img" aria-label="${t('Your character', '你嘅角色')}"></canvas>
      <div class="seg av-pose" role="group" aria-label="${t('Preview pose', '預覽動作')}">
        <button type="button" data-pose="stand" class="on">${t('Stand', '企')}</button><button type="button" data-pose="squat">${t('Squat', '深蹲')}</button><button type="button" data-pose="sit">${t('Rest', '休息')}</button></div></div>
      <div class="av-opts" id="avOpts"></div></div>
    <button id="avSave" class="big" disabled>${t('Save character', '儲存角色')}</button></section>`;
}

export function mountAvatarEditor(el, user, profile) {
  const card = el.querySelector('#avatarCard'); if (!card) return;
  let av = cleanAvatar(profile.avatar, user.id), saved = JSON.stringify(av), pose = 'stand', f = 0;
  const cv = card.querySelector('#avPreview'), opts = card.querySelector('#avOpts'), save = card.querySelector('#avSave');
  const swatches = (key, list, label) => `<fieldset class="av-row"><legend>${label}</legend><div class="sw">${list.map((col, i) =>
    `<button type="button" data-k="${key}" data-v="${i}" class="swatch ${av[key] === i ? 'on' : ''}" style="--c:${col}" aria-pressed="${av[key] === i}" aria-label="${label} ${i + 1}"></button>`).join('')}</div></fieldset>`;
  const names = { short: t('Short', '短髮'), spiky: t('Spiky', '刺蝟頭'), long: t('Long', '長髮'), bun: t('Bun', '丸子頭'), buzz: t('Buzz', '陸軍裝'), curly: t('Curly', '曲髮'), mohawk: t('Mohawk', '莫希干'), bald: t('Bald', '光頭') };
  const builds = { slim: t('Slim', '瘦'), normal: t('Normal', '標準'), big: t('Big', '大隻') };
  const chips = (key, list, nm, label) => `<fieldset class="av-row"><legend>${label}</legend><div class="chips">${list.map(v =>
    `<button type="button" data-k="${key}" data-s="${v}" class="chip ${av[key] === v ? 'on' : ''}" aria-pressed="${av[key] === v}">${esc(nm[v])}</button>`).join('')}</div></fieldset>`;
  const draw = () => {
    drawPortrait(cv, av, pose, f);
    opts.innerHTML = swatches('skin', SKINS, t('Skin', '膚色')) + chips('hair', HAIRS, names, t('Hair', '髮型')) + swatches('hairColor', HAIR_COLORS, t('Hair colour', '髮色'))
      + swatches('top', TOPS, t('Top', '上衣')) + swatches('shorts', SHORTS, t('Shorts', '短褲')) + chips('build', BUILDS, builds, t('Build', '身形'));
    opts.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      av = { ...av, [b.dataset.k]: b.dataset.s ?? +b.dataset.v };
      draw(); save.disabled = JSON.stringify(av) === saved;
      opts.querySelector(`[data-k="${b.dataset.k}"][${b.dataset.s ? `data-s="${b.dataset.s}"` : `data-v="${b.dataset.v}"`}]`)?.focus();
    });
  };
  draw();
  card.querySelectorAll('[data-pose]').forEach(b => b.onclick = () => {
    pose = b.dataset.pose; card.querySelectorAll('[data-pose]').forEach(x => x.classList.toggle('on', x === b)); drawPortrait(cv, av, pose, f);
  });
  // a gentle two-frame idle in the preview
  const tick = setInterval(() => { if (!document.body.contains(cv)) return clearInterval(tick); if (reduced()) return; f ^= 1; drawPortrait(cv, av, pose, f); }, 500);
  save.onclick = async () => {
    btnLoading(save);
    try { await api.updateProfile(user.id, { avatar: av }); saved = JSON.stringify(av); profile.avatar = av; btnDone(save, t('Saved', '已儲存')); setTimeout(() => { btnReset(save); save.disabled = true; }, 1400); }
    catch (err) { btnReset(save); showError(err); }
  };
}
