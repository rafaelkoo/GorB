// "In the gym today": everyone in the group as their pixel avatar. Checked in today → at the
// equipment for what they did most (a squat rack for squats, the wall for climbing…). Not yet →
// dozing on the rest bench. Plus the avatar editor for the Me page.
import * as api from './supa.js';
import { t, getLang } from './i18n.js';
import { esc, showError } from './ui.js';
import { EX, CATS } from './exercises.js';
import { cardioName } from './cardio.js';
import { drawGym, drawPortrait, stationFor, cleanAvatar, W, H, SKINS, SKIN_ORDER, HAIR_COLORS, TOPS, SHORTS, SHOES, GEAR, HAIRS, BUILDS, TOP_STYLES, BOTTOMS, HATS, FACES, LOCKED, ITEM_DAYS } from './pixel.js';
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
function people(rows, user, dogs = []) {
  return rows.map(r => {
    const dog = dogs.find(d => d.user_id === r.user_id && !d.redeemed);
    const f = mainFocus(r.sets_by_ex || (r.exercise_id ? { [r.exercise_id]: r.sets || 1 } : {}), r.last_ex);
    return {
      id: r.user_id, name: r.display_name || '?', me: r.user_id === user.id,
      avatar: cleanAvatar(r.avatar, r.user_id),
      // ticking sets counts as being at the gym, even before the photo check-in
      inGym: !!r.checked_in || !!f, station: stationFor(f?.ex, r.cardio),
      what: f ? `${catLabel(f.cat)} · ${exLabel(f.ex)}` : r.cardio ? cardioName(r.cardio) : '', sets: f?.sets || 0,
      dog: !!dog, dogWeek: dog?.best_week || 0
    };
  });
}
const dogLine = p => (p.dog ? ` 🐶 ${t(`Last month’s bitch, so they’re a dog. 3 gym days in one week turns them back (best week so far: ${p.dogWeek}/3).`, `上個月包尾，所以變咗狗。一個星期去夠 3 日就變返人（今個月最好嘅一個星期：${p.dogWeek}/3）。`)}` : '');
const caption = p => dogLine(p) ? `${p.name} ·${dogLine(p)}` : !p.inGym
  ? t(`${p.name} hasn’t been today. Resting on the bench 💤`, `${p.name} 今日未去，喺長櫈度休息緊 💤`)
  : p.what ? t(`${p.name} · ${p.what}${p.sets ? ` · ${p.sets} sets today` : ''}`, `${p.name} · ${p.what}${p.sets ? ` · 今日 ${p.sets} 組` : ''}`)
  : t(`${p.name} checked in today 💪`, `${p.name} 今日打咗卡 💪`);

// the hero card's "today" line: who's been (and what they're on), and a summon for who hasn't
export function todayStripHtml(rows, user) {
  const ps = people(rows || [], user);
  if (ps.length < 2) return '';
  const inn = ps.filter(p => p.inGym), out = ps.filter(p => !p.inGym && !p.me);
  return `<div class="today-strip">
    <span class="muted small">${t(`Today · ${inn.length} of ${ps.length} been`, `今日 · ${ps.length} 個人入面 ${inn.length} 個去咗`)}</span>
    <div class="today-row">${inn.map(p => `<span class="today-chip" title="${esc(p.name)}"><span class="face in">${esc(p.name.slice(0, 1).toUpperCase())}</span>${esc(p.me ? t('You', '你') : p.what ? p.what.split(' · ')[0] : p.name)}</span>`).join('')}
      ${out.length ? `<button type="button" class="summon-chip" data-summon="${out[0].id}" data-name="${esc(out[0].name)}">${t(`Summon ${esc(out[0].name)}`, `召喚 ${esc(out[0].name)}`)}</button>` : ''}</div></div>`;
}
export function wireTodayStrip(el, groupId) {
  const b = el.querySelector('[data-summon]'); if (!b) return;
  b.onclick = async () => {
    b.disabled = true; const name = b.dataset.name;
    try {
      const r = await api.summon(b.dataset.summon, groupId);
      b.textContent = r === 'sent' ? t(`Summoned! Both get 15 💧 if ${name} comes in 24 h`, `召喚咗！${name} 24 個鐘內嚟，你哋都有 15 💧`)
        : r === 'already_sent' ? t('Already summoned today', '今日已經召喚過') : r === 'already_in' ? t(`${name} is already here`, `${name} 已經嚟咗`) : t('Couldn’t summon', '召喚唔到');
    } catch (err) { b.disabled = false; showError(err); }
  };
}

export function gymCardHtml() {
  return `<section class="card gym-card" id="gymCard">
    <div class="card-head"><h3>${t('In the gym today', '今日喺 gym')}</h3><a class="link" href="#/me">${t('My character', '我嘅角色')} ›</a></div>
    <div class="gym-wrap"><canvas id="gymCanvas" role="img" aria-label="${t('Loading the gym…', '載入緊 gym…')}"></canvas></div>
    <p class="muted small gym-cap" id="gymCap" aria-live="polite">${t('Tap someone to see what they did.', '撳一個人睇佢做咗乜。')}</p>
    <button type="button" class="ghost summon-btn" id="summonBtn" hidden></button></section>`;
}

export function mountGym(el, rows, user, groupId, dogs = []) {
  stopGym();
  const card = el.querySelector('#gymCard'); if (!card) return;
  if (!rows) { card.hidden = true; return; }
  const ps = people(rows, user, dogs || []);
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
    // someone resting who isn't you: offer to summon them
    const sb = card.querySelector('#summonBtn');
    if (hit && !hit.p.inGym && !hit.p.me) {
      const p = hit.p; sb.hidden = false; sb.disabled = false;
      sb.textContent = t(`📣 Summon ${p.name} to the gym`, `📣 召喚 ${p.name} 去 gym`);
      sb.onclick = async () => {
        sb.disabled = true;
        try {
          const r = await api.summon(p.id, groupId);
          sb.textContent = r === 'sent' ? t(`📣 Summoned! If ${p.name} comes within 24 h, you both get 15 💧`, `📣 召喚咗！${p.name} 24 個鐘內嚟，你哋兩個都有 15 💧`)
            : r === 'already_sent' ? t(`You already summoned ${p.name} today`, `你今日已經召喚過 ${p.name}`)
            : r === 'already_in' ? t(`${p.name} is already here today`, `${p.name} 今日已經嚟咗`) : t('Couldn’t summon', '召喚唔到');
        } catch (err) { sb.disabled = false; showError(err); }
      };
    } else sb.hidden = true;
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
  ['hp', 'HP', '體力', 290, 'Gym days', '去 gym 嘅日數'],
  ['atk', 'Attack', '攻擊', 250, 'Your 3 best lifts as a one-rep max', '最重嘅 3 個動作（換算一下最大重量）'],
  ['def', 'Defence', '防禦', 250, 'Sets done', '做咗幾多組'],
  ['spd', 'Speed', '速度', 200, 'Cardio minutes', 'cardio 分鐘'],
  ['tec', 'Technique', '技巧', 150, 'Different exercises, your hardest climb and bouldering minutes', '做過幾多種動作、抱石最難嘅級數同抱石分鐘']
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
      <dd><span class="bar"><i style="width:${Math.min(100, Math.round((s[k] || 0) / max * 100))}%"></i></span><b>${s[k] ?? 0}</b><small class="st-next" data-next="${k}"></small></dd></div>`).join('')}</dl>
    <p class="muted small cc-week" id="ccWeek">${t('This week’s stats. They update every Monday.', '今個星期嘅能力，每個星期一更新。')}</p>
    <details class="cc-how"><summary>${t('How it works', '點樣計')}</summary>
      <ul>${STATS.map(([, en, zh, , hen, hzh]) => `<li><b>${t(en, zh)}</b>: ${t(hen, hzh)}</li>`).join('')}
        <li>${t('Stats update every Monday from your training up to Sunday, and stay the same all week (tower, raids, matches).', '能力每個星期一更新，用截至星期日嘅訓練計，成個星期都唔變（塔、魔王、友誼賽一樣）。')}</li>
        <li>${t('The last 30 days count fully, then older training fades out by 90 days, so nothing drops off suddenly.', '最近 30 日全計，再舊嘅慢慢淡出，到 90 日就唔計，唔會突然跌一截。')}</li>
        <li>${t('A stat drops at most 10% a week, so a bad week costs little. It rises by up to half the way to where your training says, so one big session doesn’t make you shoot up.', '每星期最多跌 10%，一個星期冇去都唔會跌好多。升就每星期最多升一半距離，一堂練得勁唔會即刻變好強。')}</li>
        <li>${t('Type: what you trained most (weights, cardio or climbing).', '屬性：你最近練得最多嗰類（重量、cardio 定攀石）。')}</li>
        <li>${t('Level never goes down. XP: gym days, sets, cardio, climbs and new PBs. In battles each level adds 2% to every stat.', '等級唔會跌。經驗嚟自去 gym 日數、組數、cardio、攀石同破 PB。對戰時每級所有能力加 2%。')}</li>
        <li>${t('Sweat coins: 10 per gym day. You’ll bet them in battles.', '汗水幣：每日去 gym 10 個，之後對戰可以用嚟落注。')}</li></ul></details>
  </section>`;
}
export function mountCharacterCard(el, av, userId) {
  const cv = el.querySelector('#ccPortrait'); if (!cv) return;
  // next Monday's stats, from what you've done so far
  if (userId) api.characterNext(userId).then(n => {
    if (!n?.stats) return;
    const card = el.querySelector('#charCard'); let any = false;
    card.querySelectorAll('[data-next]').forEach(x => {
      const k = x.dataset.next, now = +(card.querySelector(`[data-next="${k}"]`).previousElementSibling?.textContent || 0), d = Math.round((n.stats[k] ?? now) - now);
      if (d) { any = true; x.textContent = d > 0 ? `+${d}` : `${d}`; x.className = `st-next ${d > 0 ? 'up' : 'down'}`; x.title = t('Next Monday', '下個星期一'); }
    });
    if (any) card.querySelector('#ccWeek').textContent = t('This week’s stats. The small numbers are what next Monday brings from your training so far.', '今個星期嘅能力。細字係按你到今日為止嘅訓練，下個星期一會點變。');
  }).catch(() => {});
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

export async function mountAvatarEditor(el, user, profile) {
  const card = el.querySelector('#avatarCard'); if (!card) return;
  const owned = new Set(await api.myItems().catch(() => []));
  const lockOf = (key, v) => { const item = LOCKED[key]?.[v]; return item && !owned.has(item) ? item : null; };
  let av = cleanAvatar(profile.avatar, user.id), saved = JSON.stringify(av), pose = 'stand', f = 0, tab = 'body';
  const cv = card.querySelector('#avPreview'), opts = card.querySelector('#avOpts'), save = card.querySelector('#avSave');
  const lockTip = item => t(`Season pass reward: go ${ITEM_DAYS[item]} days in a month`, `賽季獎勵：一個月去夠 ${ITEM_DAYS[item]} 日`);
  const swatches = (key, list, label, order = list.map((_, i) => i)) => `<fieldset class="av-row"><legend>${label}</legend><div class="sw">${order.map(i => {
    const lk = lockOf(key, i);
    return `<button type="button" data-k="${key}" data-v="${i}" class="swatch ${av[key] === i ? 'on' : ''} ${lk ? 'locked' : ''}" style="--c:${list[i]}" aria-pressed="${av[key] === i}" ${lk ? `disabled title="${esc(lockTip(lk))}"` : ''} aria-label="${label} ${order.indexOf(i) + 1}${lk ? ` · ${esc(lockTip(lk))}` : ''}">${lk ? '🔒' : ''}</button>`;
  }).join('')}</div></fieldset>`;
  const N = {
    hair: { short: ['Short', '短髮'], spiky: ['Spiky', '刺蝟頭'], long: ['Long', '長髮'], bun: ['Bun', '丸子頭'], buzz: ['Buzz', '陸軍裝'], curly: ['Curly', '曲髮'], mohawk: ['Mohawk', '莫希干'], bald: ['Bald', '光頭'],
      afro: ['Afro', '爆炸頭'], ponytail: ['Ponytail', '馬尾'], sidepart: ['Side part', '側分'], braids: ['Braids', '辮'], undercut: ['Undercut', '鏟青'], pigtails: ['Pigtails', '孖辮'] },
    build: { slim: ['Slim', '瘦'], normal: ['Normal', '標準'], big: ['Big', '大隻'] },
    topStyle: { tee: ['T-shirt', 'T 恤'], tank: ['Tank', '背心'], stringer: ['Stringer', '健身背心'], longsleeve: ['Long sleeve', '長袖'], hoodie: ['Hoodie', '連帽衛衣'], jersey: ['Jersey', '球衣'], shirtless: ['No top', '赤膊'] },
    bottom: { shorts: ['Shorts', '短褲'], joggers: ['Joggers', '運動長褲'], leggings: ['Leggings', '緊身褲'] },
    hat: { none: ['None', '冇'], headband: ['Headband', '頭帶'], cap: ['Cap', '帽'], capback: ['Cap (backwards)', '倒戴帽'], beanie: ['Beanie', '冷帽'], bandana: ['Bandana', '頭巾'], crown: ['Crown', '皇冠'] },
    face: { none: ['None', '冇'], stubble: ['Stubble', '鬚根'], beard: ['Beard', '鬍鬚'], moustache: ['Moustache', '八字鬚'], glasses: ['Glasses', '眼鏡'], shades: ['Shades', '太陽眼鏡'] }
  };
  const chips = (key, list, label) => `<fieldset class="av-row"><legend>${label}</legend><div class="chips">${list.map(v => {
    const lk = lockOf(key, v);
    return `<button type="button" data-k="${key}" data-s="${v}" class="chip ${av[key] === v ? 'on' : ''} ${lk ? 'locked' : ''}" aria-pressed="${av[key] === v}" ${lk ? `disabled title="${esc(lockTip(lk))}"` : ''}>${lk ? '🔒 ' : ''}${esc(t(...N[key][v]))}</button>`;
  }).join('')}</div>${list.some(v => lockOf(key, v)) ? `<p class="muted small">${t('🔒 = season pass reward', '🔒 = 賽季獎勵')}</p>` : ''}</fieldset>`;
  const TABS = [['body', t('Body', '身體')], ['hair', t('Hair', '頭髮')], ['clothes', t('Clothes', '衫褲')], ['gear', t('Hats', '帽')]];
  const panel = () => ({
    body: swatches('skin', SKINS, t('Skin', '膚色'), SKIN_ORDER) + chips('build', BUILDS, t('Build', '身形')),
    hair: chips('hair', HAIRS, t('Hair', '髮型')) + swatches('hairColor', HAIR_COLORS, t('Hair colour', '髮色')) + chips('face', FACES, t('Face', '面部')),
    clothes: chips('topStyle', TOP_STYLES, t('Top', '上衣')) + (av.topStyle === 'shirtless' ? '' : swatches('top', TOPS, t('Top colour', '上衣顏色')))
      + chips('bottom', BOTTOMS, t('Bottoms', '褲')) + swatches('shorts', SHORTS, t('Bottoms colour', '褲顏色')) + swatches('shoes', SHOES, t('Shoes', '鞋')),
    gear: chips('hat', HATS, t('Hat', '帽')) + (av.hat === 'none' ? '' : swatches('hatColor', GEAR, t('Hat colour', '帽顏色')))
  })[tab];
  const draw = (focusSel) => {
    drawPortrait(cv, av, pose, f);
    opts.innerHTML = `<div class="seg av-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div role="tabpanel" class="av-panel">${panel()}</div>`;
    opts.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(`[data-tab="${tab}"]`); });
    opts.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      av = { ...av, [b.dataset.k]: b.dataset.s ?? +b.dataset.v };
      save.disabled = JSON.stringify(av) === saved;
      draw(`[data-k="${b.dataset.k}"][${b.dataset.s ? `data-s="${b.dataset.s}"` : `data-v="${b.dataset.v}"`}]`);
    });
    if (focusSel) opts.querySelector(focusSel)?.focus({ preventScroll: true });
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
