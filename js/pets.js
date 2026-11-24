// Pets, the shop and the Boss Lair.
// Pets fight with YOUR stats (so training still decides everything), shaped by their species and their IVs.
import * as api from './supa.js';
import { t } from './i18n.js';
import { esc, render, toast, showError, slideChips } from './ui.js';
import { drawBoss, BOSSES, drawPortrait, cleanAvatar } from './pixel.js';
import { MOVE_TYPES } from './battle.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const STATS = [['hp', 'HP', 'HP'], ['atk', 'Attack', '攻擊'], ['def', 'Defence', '防禦'], ['spd', 'Speed', '速度'], ['tec', 'Technique', '技巧']];
export const speciesName = (i, evo = false) => { const b = BOSSES[i % BOSSES.length], n = evo && b.evo ? b.evo : b; return t(n.en, n.zh); };
export const petName = p => p.nickname || speciesName(p.species, p.evolved);
const typeChip = ty => { const m = MOVE_TYPES[ty] || MOVE_TYPES.normal; return `<span class="pt-type" style="--c:${m.col}">${t(m.en, m.zh)}</span>`; };
// how good the IVs are overall (each stat is -20%..+20%)
export function ivGrade(iv) {
  const avg = STATS.reduce((s, [k]) => s + (+iv?.[k] || 0), 0) / STATS.length;
  return avg >= 0.12 ? 'S' : avg >= 0.05 ? 'A' : avg >= -0.05 ? 'B' : avg >= -0.12 ? 'C' : 'D';
}
const FOOD = { protein_bar: { icon: '🍫', en: 'Protein Bar', zh: '蛋白棒' }, steak: { icon: '🥩', en: 'Steak', zh: '牛扒' } };
const pct = v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const ICON = { potion: '🧃', food: { protein_bar: '🍫', steak: '🥩' } };
export const itemIcon = it => (it.kind === 'ball' ? '' : it.kind === 'food' ? (ICON.food[it.id] || '🍖') : it.kind === 'shield' ? '🛡️' : ICON.potion);
// a move scroll: same type as the pet or Normal (Normal pets learn anything); no fusion or monster-only moves
const TEACHABLE = ['always', 'lift', 'maxlift', 'sets', 'cardio', 'climb', 'climbs'];
export const scrollPrice = m => 60 + Math.round(1.5 * (m.power || 0));

// little animated sprites: every canvas with data-sp gets its species drawn
function wireSprites(root) {
  const cvs = [...root.querySelectorAll('canvas[data-sp]')];
  const st = cv => (cv.dataset.ko ? 'ko' : 'idle'), ev = cv => cv.dataset.evo === '1';
  cvs.forEach(cv => drawBoss(cv, +cv.dataset.sp, 0, st(cv), ev(cv)));
  if (reduced() || !cvs.length) return;
  let f = 0;
  const tick = setInterval(() => {
    if (!document.body.contains(cvs[0])) return clearInterval(tick);
    f ^= 1; cvs.forEach(cv => drawBoss(cv, +cv.dataset.sp, f, st(cv), ev(cv)));
  }, 600);
}
const sprite = (sp, size = 64, label = '', evo = false, dark = false) => `<canvas data-sp="${sp}" ${evo ? 'data-evo="1"' : ''} ${dark ? 'class="dex-shadow"' : ''} width="${size}" height="${Math.round(size * 40 / 48)}" role="img" aria-label="${esc(label || speciesName(sp))}"></canvas>`;

// the strip of links shared by the tower, pets, shop and lair
export function advNav(on) {
  const L = [['tower', '🗼', 'Tower', '塔'], ['pets', '🐾', 'Pets', '寵物'], ['dex', '📖', 'Dex', '圖鑑'], ['lair', '👑', 'Boss Lair', 'Boss 巢穴'], ['shop', '🏪', 'Shop', '商店']];
  return `<nav class="adv-nav grp-switch" aria-label="${t('Adventure', '冒險')}">${L.map(([k, i, en, zh]) => `<a href="#/${k}" class="${k === on ? 'on' : ''}" ${k === on ? 'aria-current="page"' : ''}>${i} ${t(en, zh)}</a>`).join('')}</nav>`;
}
export function wireAdvNav(el) { slideChips(el.querySelector('.adv-nav'), 'gob_chip_adv'); }

function sheet(html, label) {
  const box = document.createElement('div'); box.className = 'sheet';
  box.innerHTML = `<div class="sheet-in" role="dialog" aria-label="${esc(label)}">${html}</div>`;
  const close = () => box.remove();
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) close(); });
  document.body.append(box);
  return { box, close };
}

// ---------------- the shop ----------------
export async function shopScreen(user) {
  const el = render(`<header class="page-head"><div><h2>🏪 ${t('Shop', '商店')}</h2></div><a class="link" href="#/me">‹ ${t('Me', '我')}</a></header>
    ${advNav('shop')}<div id="shBody"><p class="muted">${t('Loading…', '載入緊…')}</p></div>`);
  wireAdvNav(el);
  let items, mine, moves = [], cm = null;
  try { [items, mine, moves, cm] = await Promise.all([api.shopItems(), api.myBag(), api.allMoves().catch(() => []), api.characterMoves(user.id).catch(() => null)]); } catch (err) { showError(err); return; }
  moves = moves.filter(m => m.req_kind === 'shop');
  const owned = new Set(cm?.bought || []);
  const draw = () => {
    el.querySelector('#shBody').innerHTML = `
      <section class="card sh-wallet"><b>💧 ${mine.coins}</b><span class="muted small">${t('Coins come from going to the gym: chests, quests, the tower.', '金幣嚟自去 gym：寶箱、任務、塔。')}</span></section>
      <section class="card"><ul class="sh-list">${items.map(it => {
        const have = mine.items?.[it.id] || 0;
        return `<li class="sh-item"><span class="sh-ic ${it.kind}" data-b="${it.id}" aria-hidden="true">${itemIcon(it)}</span>
          <div class="sh-txt"><b>${esc(t(it.en, it.zh))}</b><span class="muted small">${esc(t(it.desc_en, it.desc_zh))}</span><span class="small">${t(`You have ${have}`, `你有 ${have} 個`)}</span></div>
          <div class="sh-buy"><button type="button" data-buy="${it.id}" data-q="1" ${mine.coins < it.price ? 'disabled' : ''}>💧 ${it.price}</button>
          <button type="button" class="ghost small-btn" data-buy="${it.id}" data-q="5" ${mine.coins < it.price * 5 ? 'disabled' : ''}>×5 · ${it.price * 5}</button></div></li>`;
      }).join('')}</ul></section>
      ${moves.length ? `<section class="card"><div class="card-head"><h3>🏪 ${t('Moves', '招式')}</h3></div>
        <p class="muted small">${t('Yours for good. Kept apart from the moves training teaches: you can take only one of these into a fight, alongside 3 trained ones.', '買咗就係你嘅。同訓練學返嚟嘅招分開：每場只可以帶 1 招商店招式，另外 3 招要係訓練學返嚟。')}</p>
        <ul class="sh-list">${moves.map(m => { const ty = MOVE_TYPES[m.type] || MOVE_TYPES.normal;
          return `<li class="sh-item sh-move" style="--c:${ty.col}"><span class="sh-ic" aria-hidden="true">📜</span>
            <div class="sh-txt"><b>${esc(t(m.en, m.zh))}</b><span class="small">${typeChip(m.type)}${m.power ? ` ${t('Power', '威力')} ${m.power}` : ''}</span><span class="muted small">${esc(t(m.desc_en, m.desc_zh))}</span></div>
            <div class="sh-buy">${owned.has(m.id) ? `<span class="small">✓ ${t('Yours', '已擁有')}</span>` : `<button type="button" data-move="${m.id}" ${mine.coins < m.price ? 'disabled' : ''}>💧 ${m.price}</button>`}</div></li>`; }).join('')}</ul></section>` : ''}
      <p class="muted small sh-note">${t('Balls catch monsters in the tower and the Boss Lair. Drinks heal whoever is fighting (2 per fight). Food levels up a pet: open it in Pets to feed it. Move scrolls are in Pets too.', '球用嚟喺塔同 Boss 巢穴捉怪。飲品幫上緊場嗰個回血（每場最多 2 件）。食物幫寵物升級：喺寵物頁撳隻寵物去餵。招式卷軸都喺寵物頁。')}</p>`;
    el.querySelectorAll('[data-move]').forEach(b => b.onclick = async () => {
      const m = moves.find(x => x.id === b.dataset.move);
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = t(`Sure? 💧 ${m.price}`, `確定？💧 ${m.price}`); return; }
      b.disabled = true;
      try { const r = await api.buyMove(m.id); mine.coins = r.coins; owned.add(m.id); toast(t(`${m.en} is yours. Equip it on the Me page.`, `${m.zh} 係你嘅喇。去「我」頁帶住佢出戰。`)); draw(); }
      catch (err) { b.disabled = false; showError(err); }
    });
    el.querySelectorAll('[data-buy]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await api.shopBuy(b.dataset.buy, +b.dataset.q);
        mine.coins = r.coins; mine.items = { ...mine.items, [b.dataset.buy]: r.qty };
        const it = items.find(x => x.id === b.dataset.buy);
        toast(t(`Bought ${b.dataset.q} × ${it.en}`, `買咗 ${b.dataset.q} 個${it.zh}`));
        draw();
      } catch (err) { b.disabled = false; showError(err); }
    });
  };
  draw();
}

// ---------------- your pets: the team and the box ----------------
export async function petsScreen(user) {
  const el = render(`<header class="page-head"><div><h2>🐾 ${t('Pets', '寵物')}</h2></div><a class="link" href="#/me">‹ ${t('Me', '我')}</a></header>
    ${advNav('pets')}<div id="ptBody"><p class="muted">${t('Loading…', '載入緊…')}</p></div>`);
  wireAdvNav(el);
  let pets, prof = null, mv = {};
  const load = async () => {
    pets = await api.myPets();
    const ids = [...new Set(pets.flatMap(x => [x.sig_move, x.ultimate]).filter(id => id && !mv[id]))];
    if (ids.length) (await api.movesByIds(ids).catch(() => [])).forEach(m => { mv[m.id] = m; });
  };
  const mvName = id => (mv[id] ? t(mv[id].en, mv[id].zh) : id);
  const mvLine = id => { const m = mv[id]; return m ? `${esc(t(m.en, m.zh))}${m.power ? ` · ${t('Power', '威力')} ${m.power}` : ''}` : esc(id); };
  try { [, prof] = await Promise.all([load(), user ? api.getProfile(user.id).catch(() => null) : null]); } catch (err) { showError(err); return; }
  const myAv = user ? cleanAvatar(prof?.avatar, user.id) : null;
  const teamIds = () => pets.filter(p => p.slot != null).sort((a, b) => a.slot - b.slot).map(p => p.id);
  // where you stand in the line (0 = first); you're always in it
  let mePos = Math.min(prof?.team_me_pos ?? 0, teamIds().length);
  const saveTeam = async (ids, pos = mePos) => {
    try { pos = Math.max(0, Math.min(pos, ids.length)); await api.setTeam(ids, pos); mePos = pos; await load(); draw(); } catch (err) { showError(err); }
  };
  // the line as shown: pet ids with 'me' slotted in
  const order = () => { const ids = teamIds(), o = [...ids]; o.splice(Math.min(mePos, ids.length), 0, 'me'); return o; };
  const saveOrder = o => saveTeam(o.filter(x => x !== 'me'), o.indexOf('me'));
  const moveIn = (key, dir) => {   // keyboard: arrow keys on a focused card
    const o = order(), i = o.indexOf(key), j = i + dir; if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]]; saveOrder(o);
  };
  // hold a card, drag it, drop it where it should go
  function wireDrag(grid) {
    const slots = () => [...grid.querySelectorAll('.pt-slot[data-key]')];
    let hold = null, drag = null, swallowClick = false;
    const cancelHold = () => { clearTimeout(hold?.timer); hold = null; };
    grid.addEventListener('pointerdown', e => {
      const slot = e.target.closest('.pt-slot[data-key]'); if (!slot || slots().length < 2 || e.button > 0) return;
      cancelHold();
      hold = { slot, x: e.clientX, y: e.clientY, id: e.pointerId, timer: setTimeout(() => start(e), e.pointerType === 'mouse' ? 150 : 280) };
    });
    function start(e) {
      const slot = hold.slot, r = slot.getBoundingClientRect();
      drag = { slot, dx: hold.x - r.left, dy: hold.y - r.top, w: r.width, h: r.height, from: slots().indexOf(slot) };
      const ph = document.createElement('div'); ph.className = 'pt-slot pt-ph'; ph.style.height = r.height + 'px';
      slot.after(ph); drag.ph = ph;
      Object.assign(slot.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', zIndex: 50, pointerEvents: 'none' });
      slot.classList.add('lifted'); navigator.vibrate?.(15);
      try { grid.setPointerCapture(hold.id); } catch {}
      hold = null;
    }
    grid.addEventListener('pointermove', e => {
      if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 8) cancelHold();   // that was a scroll
      if (!drag) return;
      drag.slot.style.left = e.clientX - drag.dx + 'px'; drag.slot.style.top = e.clientY - drag.dy + 'px';
      // the closest card to the finger takes the placeholder's spot
      const others = [...grid.querySelectorAll('.pt-slot[data-key]:not(.lifted), .pt-ph')];
      let best = null, bd = Infinity;
      for (const o of others) { const r = o.getBoundingClientRect(), d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)); if (d < bd) { bd = d; best = o; } }
      if (best && best !== drag.ph) {
        const list = [...grid.children], a = list.indexOf(drag.ph), c = list.indexOf(best);
        if (c > a) best.after(drag.ph); else best.before(drag.ph);
      }
    });
    // stop the page scrolling under the finger while dragging
    grid.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
    const end = () => {
      cancelHold(); if (!drag) return;
      const { slot, ph } = drag; drag = null;
      slot.removeAttribute('style'); slot.classList.remove('lifted'); ph.replaceWith(slot);
      swallowClick = true; setTimeout(() => { swallowClick = false; }, 50);
      const now = slots().map(s => s.dataset.key);
      if (now.join() !== order().join()) saveOrder(now);
    };
    grid.addEventListener('pointerup', end); grid.addEventListener('pointercancel', end);
    grid.addEventListener('click', e => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true);
    grid.addEventListener('contextmenu', e => { if (e.target.closest('.pt-slot[data-key]')) e.preventDefault(); });
    grid.addEventListener('keydown', e => {
      const slot = e.target.closest('.pt-slot[data-key]'); if (!slot || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault(); moveIn(slot.dataset.key, e.key === 'ArrowLeft' ? -1 : 1);
    });
  }

  const card = p => `<button type="button" class="pt-card ${p.evolved ? 'evo' : ''} ${p.legend ? 'legend' : ''}" data-pet="${p.id}">${sprite(p.species, 64, petName(p), p.evolved)}
      <b>${esc(petName(p))}</b><span class="pt-lv">Lv ${p.level || 1}</span><span class="pt-meta">${typeChip(p.type)}<span class="pt-grade g-${ivGrade(p.iv)}" title="${t('IV grade', 'IV 評級')}">${ivGrade(p.iv)}</span></span></button>`;
  function draw() {
    const team = teamIds().map(id => pets.find(p => p.id === id));
    const box = pets.filter(p => p.slot == null);
    const asks = pets.filter(x => x.evo_prompt);
    el.querySelector('#ptBody').innerHTML = `
      ${asks.map(x => `<section class="card evo-ask" data-ask="${x.id}">${sprite(x.species, 64, petName(x))}<div>
        <b>✨ ${t(`${esc(petName(x))} can evolve!`, `${esc(petName(x))} 可以進化！`)}</b>
        <span class="small">${t(`Evolve into ${speciesName(x.species, true)}: +25% to every stat and its own move, ${mvName(x.sig_move)}.`, `進化做${speciesName(x.species, true)}：全部能力 +25%，仲有專屬招式「${mvName(x.sig_move)}」。`)}</span>
        <span class="small muted">${t(`Or keep its form: at level 20 it learns ${mvName(x.ultimate)}, the strongest move there is.`, `或者保持原形：到 20 級會學識最強嘅招式「${mvName(x.ultimate)}」。`)}</span>
        <div class="evo-btns"><button type="button" data-evo="go">✨ ${t('Evolve', '進化')}</button><button type="button" class="ghost" data-evo="later">${t('Not now', '遲啲先')}</button><button type="button" class="ghost" data-evo="keep">${t('Keep its form', '保持原形')}</button></div></div></section>`).join('')}
      <section class="card"><div class="card-head"><h3>${t('Your team', '你嘅隊伍')}</h3><span class="muted small">${team.length + 1} / 6</span></div>
        <p class="muted small">${order().length > 1 ? t('Hold a card and drag it to change the order. The first one starts the fight.', '撳住張卡拖去排次序。排第一嗰個先出場。') : t('Add pets from your box below. You’re always in the team.', '喺下面寵物箱加寵物入隊。你一定喺隊入面。')}</p>
        <div class="pt-team">${order().map((k, i) => {
          const num = `<span class="pt-num" aria-hidden="true">${i + 1}</span>`;
          if (k === 'me') return `<div class="pt-slot" data-key="me" tabindex="0" aria-label="${esc(t(`${prof?.display_name || 'You'}, number ${i + 1}. Arrow keys move.`, `${prof?.display_name || '你'}，第 ${i + 1}。方向鍵可以移動。`))}"><div class="pt-card me">${num}${myAv ? `<canvas id="ptMe" width="64" height="68" role="img" aria-label="${t('Your character', '你嘅角色')}"></canvas>` : `<span class="pt-you" aria-hidden="true">🙋</span>`}<b>${esc(prof?.display_name || t('You', '你'))}</b><span class="pt-meta muted small">${t('You', '你')}</span></div></div>`;
          return `<div class="pt-slot" data-key="${k}">${card(pets.find(p => p.id === k)).replace('<button type="button" class="pt-card', `<button type="button" aria-keyshortcuts="ArrowLeft ArrowRight" class="pt-card`).replace('">', `">${num}`)}</div>`;
        }).join('')}${team.length < 5 ? `<a class="pt-slot pt-add" href="#ptBox"><span aria-hidden="true">＋</span><span class="small">${t(`Add from box (${5 - team.length} free)`, `由寵物箱加（仲有 ${5 - team.length} 個位）`)}</span></a>` : ''}</div></section>
      <section class="card" id="ptBox"><div class="card-head"><h3>${t('Box', '寵物箱')}</h3><span class="muted small">${pets.length}</span></div>
        ${box.length ? `<div class="pt-box">${box.map(card).join('')}</div>`
          : `<p class="muted small">${pets.length ? t('Everyone is in your team.', '全部都喺隊入面。') : t('No pets yet. Knock a monster low in the tower, then throw a ball (buy them in the shop).', '仲未有寵物。喺塔將怪打到殘血，再掟個球（喺商店買）。')}</p>
          ${pets.length ? '' : `<a class="button" href="#/shop">🏪 ${t('Go to the shop', '去商店')}</a>`}`}</section>
      <details class="card cc-how"><summary>${t('How pets work', '寵物點運作')}</summary><ul>
        <li>${t('A pet’s stats come from yours, shaped by its species: a Takeaway Goblin is all attack, a Duvet Burrito is all HP and defence. Train and they get stronger too.', '寵物嘅能力由你嘅能力計，再按品種調整：外賣哥布林全攻擊，被竇卷就高 HP 同防禦。你練勁，佢哋都會勁。')}</li>
        <li>${t('Each one has its own IVs: −20% to +20% on every stat. Catch the same species again to find a better one (S is the best).', '每隻都有自己嘅 IV：每項能力 −20% 至 +20%。再捉同一品種可以搵更好嘅（S 最好）。')}</li>
        <li>${t('Throw a ball any time on your turn. The lower its HP, the better the chance; bosses are harder to catch.', '你嘅回合隨時都可以掟球。佢血越少越易捉；Boss 比較難捉。')}</li>
        <li>${t('Pets level up (to 20, +2% stats a level) from fights they’re in: +20 XP for a win, +5 for a loss. Food from the shop speeds it up.', '寵物喺有份打嘅戰鬥升級（最高 20 級，每級能力 +2%）：贏 +20 經驗，輸 +5。商店嘅食物可以加快。')}</li>
        <li>${t('Evolution is your choice. At level 10, after 20 of your gym days in your team, a pet can evolve: +25% to every stat, a new look and its own move. Or keep its form: at level 20 it learns its type’s strongest move. Until you decide, it asks again each level.', '進唔進化由你揀。寵物 10 級、喺隊入面陪你去咗 20 日 gym 之後就可以進化：全部能力 +25%、新樣、專屬招式。或者保持原形：到 20 級會學識該屬性最強嘅招式。未決定之前，佢每升一級都會問你。')}</li>
        <li>${t('Releasing a pet gives coins back: more for a higher level and better IVs (5–58).', '放生寵物有金幣：等級越高、IV 越好就越多（5–58）。')}</li>
        <li>${t('Your first catch of each boss species is 1.5× easier.', '每種 Boss 第一次捉，捉中率 ×1.5。')}</li>
        <li>${t('A move scroll teaches a pet one extra move (its type or Normal). Teaching another replaces it.', '招式卷軸可以教寵物多一招（同屬性或者普通）。再教就會換走。')}</li>
        <li>${t('A bigger team makes the monsters tougher too, so it helps but doesn’t walk through everything.', '隊伍越大，怪物都會越強，所以有幫助，但唔會一路無敵。')}</li></ul></details>`;
    wireSprites(el);
    const me = el.querySelector('#ptMe');
    if (me) { let f = 0; drawPortrait(me, myAv, 'stand', 0); const tk = setInterval(() => { if (!document.body.contains(me)) return clearInterval(tk); if (!reduced()) { f ^= 1; drawPortrait(me, myAv, 'stand', f); } }, 560); }
    el.querySelectorAll('[data-pet]').forEach(b => b.onclick = () => petSheet(pets.find(p => p.id === b.dataset.pet)));
    wireDrag(el.querySelector('.pt-team'));
    el.querySelector('.pt-add')?.addEventListener('click', e => { e.preventDefault(); el.querySelector('#ptBox').scrollIntoView({ behavior: 'smooth' }); });
    el.querySelectorAll('[data-ask]').forEach(sec => sec.querySelectorAll('[data-evo]').forEach(b => b.onclick = async () => {
      const x = pets.find(q => q.id === sec.dataset.ask); sec.querySelectorAll('button').forEach(y => y.disabled = true);
      try {
        if (b.dataset.evo === 'go') { await api.evolvePet(x.id); navigator.vibrate?.([40, 60, 40, 60, 80]); toast(t(`${speciesName(x.species)} evolved into ${speciesName(x.species, true)}! ✨`, `${speciesName(x.species)}進化咗做${speciesName(x.species, true)}！✨`)); }
        else { await api.petEvoChoice(x.id, b.dataset.evo); toast(b.dataset.evo === 'keep' ? t(`${petName(x)} keeps its form. Level 20 brings ${mvName(x.ultimate)}.`, `${petName(x)} 保持原形。20 級會學識「${mvName(x.ultimate)}」。`) : t('Asking again at its next level.', '佢下次升級會再問你。')); }
        await load(); draw();
      } catch (err) { sec.querySelectorAll('button').forEach(y => y.disabled = false); showError(err); }
    }));
  }
  let bag = null, moves = null;
  async function petSheet(p) {
    try { [bag, moves] = await Promise.all([bag || api.myBag(), moves || api.allMoves()]); } catch (err) { showError(err); return; }
    const foods = Object.entries(bag.items || {}).filter(([k, q]) => q > 0 && FOOD[k]);
    const lv = p.level || 1, maxed = lv >= 20, span = maxed ? 1 : (p.xp_to ?? 50) - (p.xp_from ?? 0), into = maxed ? 1 : (p.xp ?? 0) - (p.xp_from ?? 0);
    const inTeam = p.slot != null, full = teamIds().length >= 5, s = p.snap || {};
    const { box, close } = sheet(`
      <div class="pt-head">${sprite(p.species, 96, petName(p), p.evolved)}<div><h3>${esc(petName(p))}</h3>
        <span class="pt-meta">${typeChip(p.type)}${p.boss ? `<span class="pt-boss">👑 ${t('Boss', 'Boss')}</span>` : ''}<span class="pt-grade g-${ivGrade(p.iv)}">${ivGrade(p.iv)}</span></span>
        ${p.nickname || p.evolved ? `<span class="muted small">${esc(p.evolved ? t(`Evolved from ${speciesName(p.species)}`, `由${speciesName(p.species)}進化`) : speciesName(p.species))}</span>` : ''}</div></div>
      ${p.legend ? `<div class="pt-evo legend"><b>👑 ${t('Legendary: caught from a group boss', '傳說級：由 group 魔王度捉返嚟')}</b>
        <span class="small">${t('Legends don’t evolve.', '傳說級唔會進化。')} ${lv >= 20 ? `✓ ${t(`Learned the strongest move: ${mvLine(p.ultimate)}`, `已學識最強招式「${mvLine(p.ultimate)}」`)}` : t(`At level 20 (now ${lv}) it learns the strongest move: ${mvLine(p.ultimate)}`, `到 20 級（而家 ${lv}）會學識最強招式「${mvLine(p.ultimate)}」`)}</span></div>`
      : p.evolved ? `<p class="pt-evo done">✨ ${t(`Evolved: +25% to every stat, and its own move: ${mvLine(p.sig_move)}`, `已進化：全部能力 +25%，專屬招式「${mvLine(p.sig_move)}」`)}</p>` : `<div class="pt-evo">
        <b>✨ ${t(`Path 1 · Evolve into ${speciesName(p.species, true)}`, `路線一 · 進化做${speciesName(p.species, true)}`)}</b>
        <span class="small">${t(`+25% to every stat and its own move: ${mvLine(p.sig_move)}`, `全部能力 +25%，專屬招式「${mvLine(p.sig_move)}」`)}</span>
        <span class="small">${lv >= 10 ? '✓' : '○'} ${t(`Level 10 (now ${lv})`, `10 級（而家 ${lv}）`)}　${(p.gym_days || 0) >= 20 ? '✓' : '○'} ${t(`20 gym days in your team (${p.gym_days || 0})`, `喺隊入面陪你去 20 日 gym（${p.gym_days || 0}）`)}</span>
        <b>🌟 ${t('Path 2 · Keep its form', '路線二 · 保持原形')}</b>
        <span class="small">${lv >= 20 ? `✓ ${t(`Learned the strongest move: ${mvLine(p.ultimate)}`, `已學識最強招式「${mvLine(p.ultimate)}」`)}` : t(`At level 20 (now ${lv}) it learns the strongest move: ${mvLine(p.ultimate)}`, `到 20 級（而家 ${lv}）會學識最強招式「${mvLine(p.ultimate)}」`)}</span>
        ${p.evo_ready ? `<button type="button" data-act="evolve">✨ ${t('Evolve!', '進化！')}${lv >= 20 ? ` ${t(`(it forgets ${mvName(p.ultimate)})`, `（會唔記得「${mvName(p.ultimate)}」）`)}` : ''}</button>` : ''}
        ${p.keep_form ? `<span class="small muted">${t('You chose to keep its form, so it won’t ask.', '你揀咗保持原形，所以唔會再問。')} <button type="button" class="link" data-act="unkeep">${t('Let it ask again', '再問我')}</button></span>` : ''}</div>`}
      <div class="pt-xp"><b>Lv ${lv}</b><span class="bt-hp"><i style="width:${Math.round(into / span * 100)}%"></i></span>
        <span class="muted small">${!maxed ? `${p.xp ?? 0} / ${p.xp_to ?? 50} XP` : t('Max level', '最高級')}</span></div>
      ${!maxed ? `<div class="pt-feed">${foods.length ? foods.map(([k, q]) => `<button type="button" class="ghost small-btn" data-feed="${k}">${FOOD[k].icon} ${t(`Feed ${FOOD[k].en}`, `餵${FOOD[k].zh}`)} ×${q}</button>`).join('')
        : `<span class="muted small">${t('No food. Protein Bars and Steak are in the shop.', '冇食物。商店有蛋白棒同牛扒。')}</span>`}</div>` : ''}
      <table class="pt-stats"><tbody>${STATS.map(([k, en, zh]) => { const v = +p.iv?.[k] || 0;
        return `<tr><th>${t(en, zh)}</th><td>${s[k] ?? '–'}</td><td class="pt-iv ${v >= 0.1 ? 'hi' : v <= -0.1 ? 'lo' : ''}">IV ${pct(v)}</td></tr>`; }).join('')}</tbody></table>
      <p class="muted small">${t('Moves', '招式')}: ${(s.moves || []).map(m => m.id === p.extra_move ? `<b>📜 ${esc(t(m.en, m.zh))}</b>` : esc(t(m.en, m.zh))).join(' · ')}</p>
      <div class="pt-acts">
        ${inTeam ? `<button type="button" class="ghost" data-act="out">${t('Take out of team', '退出隊伍')}</button>`
          : `<button type="button" data-act="in" ${full ? 'disabled' : ''}>${full ? t('Team is full (5 pets)', '隊伍滿咗（5 隻）') : t('Add to team', '加入隊伍')}</button>`}
        <button type="button" class="ghost" data-act="test">${t('Test fight (free)', '試打（免費）')}</button>
        <button type="button" class="ghost" data-act="teach">📜 ${p.extra_move ? t('Change scroll move', '換卷軸招式') : t('Teach a move', '教招式')}</button>
        <button type="button" class="ghost" data-act="name">${t('Rename', '改名')}</button>
        <button type="button" class="ghost danger" data-act="free">${t(`Release · +${p.release ?? 5} 💧`, `放生 · +${p.release ?? 5} 💧`)}</button>
      </div>
      <button type="button" class="ghost" data-close>${t('Close', '關閉')}</button>`, petName(p));
    wireSprites(box);
    box.querySelector('[data-act="in"]')?.addEventListener('click', () => { close(); saveTeam([...teamIds(), p.id]); });
    box.querySelector('[data-act="out"]')?.addEventListener('click', () => {
      close(); const o = order().filter(x => x !== p.id); saveTeam(o.filter(x => x !== 'me'), o.indexOf('me'));
    });
    box.querySelector('[data-act="test"]').onclick = async e => {
      e.target.disabled = true;
      try { const id = await api.petTest(p.id); close(); location.hash = `#/battle/${id}`; } catch (err) { e.target.disabled = false; showError(err); }
    };
    box.querySelectorAll('[data-feed]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await api.petFeed(p.id, b.dataset.feed); bag.items[b.dataset.feed]--;
        toast(r.level > lv ? t(`Level up! Lv ${r.level} 🎉`, `升級！Lv ${r.level} 🎉`) : t('Yum!', '好味！'));
        close(); await load(); draw(); petSheet(pets.find(x => x.id === p.id));
      } catch (err) { b.disabled = false; showError(err); }
    });
    box.querySelector('[data-act="teach"]').onclick = () => { close(); teachSheet(p); };
    box.querySelector('[data-act="unkeep"]')?.addEventListener('click', async () => { try { await api.petEvoChoice(p.id, 'unkeep'); close(); await load(); draw(); } catch (err) { showError(err); } });
    box.querySelector('[data-act="evolve"]')?.addEventListener('click', async e => {
      e.target.disabled = true;
      try { await api.evolvePet(p.id); close(); navigator.vibrate?.([40, 60, 40, 60, 80]); toast(t(`${speciesName(p.species)} evolved into ${speciesName(p.species, true)}! ✨`, `${speciesName(p.species)}進化咗做${speciesName(p.species, true)}！✨`)); await load(); draw(); petSheet(pets.find(x => x.id === p.id)); }
      catch (err) { e.target.disabled = false; showError(err); }
    });
    box.querySelector('[data-act="name"]').onclick = async () => {
      const n = prompt(t('Name (up to 20 letters, empty for the species name)', '名（最多 20 個字，留空就用品種名）'), p.nickname || '');
      if (n == null) return;
      try { await api.petUpdate(p.id, n); close(); await load(); draw(); } catch (err) { showError(err); }
    };
    const fr = box.querySelector('[data-act="free"]');
    fr.onclick = async () => {
      if (!fr.dataset.sure) { fr.dataset.sure = '1'; fr.textContent = t(`Sure? It’s gone for good (+${p.release ?? 5} 💧)`, `確定？放咗就冇㗎喇（+${p.release ?? 5} 💧）`); return; }
      try { const r = await api.petUpdate(p.id, null, true); close(); await load(); draw(); toast(t(`Released: +${r?.coins ?? 0} 💧`, `放生咗：+${r?.coins ?? 0} 💧`)); } catch (err) { showError(err); }
    };
  }
  function teachSheet(p) {
    const known = new Set((p.snap?.moves || []).map(m => m.id).filter(id => id !== p.extra_move));
    const list = moves.filter(m => TEACHABLE.includes(m.req_kind) && !known.has(m.id) && m.id !== p.extra_move && (p.type === 'normal' || m.type === p.type || m.type === 'normal'))
      .sort((a, b) => scrollPrice(a) - scrollPrice(b));
    const { box, close } = sheet(`<h3>📜 ${t(`Teach ${esc(petName(p))} a move`, `教 ${esc(petName(p))} 一招`)}</h3>
      <p class="muted small">${t(`You have 💧 ${bag.coins}.`, `你有 💧 ${bag.coins}。`)} ${p.extra_move ? t('This replaces its current scroll move.', '會換走而家嘅卷軸招式。') : ''}</p>
      <div class="bag-list">${list.map(m => { const c = (MOVE_TYPES[m.type] || MOVE_TYPES.normal).col, pr = scrollPrice(m);
        return `<button type="button" class="bag-it" data-teach="${m.id}" style="--c:${c}" ${bag.coins < pr ? 'disabled' : ''}><b>${esc(t(m.en, m.zh))} · 💧 ${pr}</b>
          <span class="muted small">${t((MOVE_TYPES[m.type] || MOVE_TYPES.normal).en, (MOVE_TYPES[m.type] || MOVE_TYPES.normal).zh)}${m.power ? ` · ${t('Power', '威力')} ${m.power}` : ''} · ${esc(t(m.desc_en || '', m.desc_zh || ''))}</span></button>`; }).join('')
        || `<p class="muted">${t('Nothing new it can learn.', '冇新招可以學。')}</p>`}</div>
      <button type="button" class="ghost" data-close>${t('Cancel', '取消')}</button>`, t('Teach a move', '教招式'));
    box.querySelectorAll('[data-teach]').forEach(b => b.onclick = async () => {
      const m = moves.find(x => x.id === b.dataset.teach);
      if (!b.dataset.sure) { box.querySelectorAll('[data-teach]').forEach(x => { delete x.dataset.sure; x.classList.remove('sure'); }); b.dataset.sure = '1'; b.classList.add('sure'); b.querySelector('b').textContent = t(`Tap again: pay 💧 ${scrollPrice(m)}`, `再撳一次：付 💧 ${scrollPrice(m)}`); return; }
      b.disabled = true;
      try { const r = await api.petTeach(p.id, m.id); bag.coins = r.coins; close(); toast(t(`${petName(p)} learned ${m.en}!`, `${petName(p)} 學識咗${m.zh}！`)); await load(); draw(); }
      catch (err) { b.disabled = false; showError(err); }
    });
  }
  draw();
}

// ---------------- someone's team, on their progress page (yours too) ----------------
export async function mountTeamCard(card, uid, mine) {
  let tm, pos = 0;
  try { [tm, pos] = await Promise.all([api.userTeam(uid), api.userTeamOrder(uid).catch(() => 0)]); } catch { return; }
  if (!tm) return;
  card.hidden = false;
  const grade = v => ivGrade({ hp: v, atk: v, def: v, spd: v, tec: v });
  const stats = s => `<table class="pt-stats"><tbody>${STATS.map(([k, en, zh]) => `<tr><th>${t(en, zh)}</th><td>${s?.[k] ?? '–'}</td></tr>`).join('')}</tbody></table>`;
  card.innerHTML = `<div class="card-head"><h3>🐾 ${mine ? t('Your team', '你嘅隊伍') : t(`${esc(tm.name)}’s team`, `${esc(tm.name)} 嘅隊伍`)}</h3>${mine ? `<a class="link" href="#/pets">${t('Manage', '管理')} ›</a>` : ''}</div>
    <p class="muted small">${[t(`Tower floor ${tm.tower || 0}`, `塔第 ${tm.tower || 0} 層`), t(`${tm.pets_total} pet${tm.pets_total === 1 ? '' : 's'}`, `${tm.pets_total} 隻寵物`), t(`dex ${tm.dex}/18`, `圖鑑 ${tm.dex}/18`), tm.evolved_total ? `✨ ${tm.evolved_total}` : ''].filter(Boolean).join(' · ')}</p>
    <div class="ut-lead"><canvas id="utAv" width="64" height="68" role="img" aria-label="${esc(tm.name)}"></canvas><div>
      <b>${esc(tm.name)} · Lv ${tm.level}</b>${typeChip(tm.type === 'rookie' ? 'normal' : tm.type)}
      <span class="ut-moves">${(tm.moves || []).map(m => `<span class="ut-mv" style="--c:${(MOVE_TYPES[m.type] || MOVE_TYPES.normal).col}">${esc(t(m.en, m.zh))}</span>`).join('')}</span></div></div>
    ${tm.team.length ? `<p class="small ut-order">${t('Order', '出場次序')}: ${(() => { const n = tm.team.map(p => esc(petName(p))); n.splice(Math.min(pos || 0, n.length), 0, `<b>${esc(tm.name)}</b>`); return n.join(' → '); })()}</p>
      <div class="pt-team ut-team">${tm.team.map((p, i) => `<button type="button" class="pt-card ${p.evolved ? 'evo' : ''}" data-ut="${i}">${sprite(p.species, 64, petName(p), p.evolved)}
        <b>${esc(petName(p))}</b><span class="pt-lv">Lv ${p.level}</span><span class="pt-meta">${typeChip(p.type)}<span class="pt-grade g-${grade(p.iv_avg)}">${grade(p.iv_avg)}</span></span></button>`).join('')}</div>`
      : `<p class="muted small">${mine ? t('No pets in your team yet.', '你隊入面仲未有寵物。') : t('No pets in their team yet.', '佢隊入面仲未有寵物。')}</p>`}`;
  const av = card.querySelector('#utAv');
  if (av) { const a = cleanAvatar(tm.avatar, uid); drawPortrait(av, a, 'stand', 0); let f = 0; const tk = setInterval(() => { if (!document.body.contains(av)) return clearInterval(tk); if (!reduced()) { f ^= 1; drawPortrait(av, a, 'stand', f); } }, 560); }
  wireSprites(card);
  card.querySelectorAll('[data-ut]').forEach(b => b.onclick = () => {
    const p = tm.team[+b.dataset.ut], s = p.snap || {};
    const { box } = sheet(`<div class="pt-head">${sprite(p.species, 96, petName(p), p.evolved)}<div><h3>${esc(petName(p))}</h3>
        <span class="pt-meta">${typeChip(p.type)}${p.boss ? '<span class="pt-boss">👑 Boss</span>' : ''}<span class="pt-grade g-${grade(p.iv_avg)}">${grade(p.iv_avg)}</span></span>
        <span class="muted small">Lv ${p.level}${p.evolved ? ` · ✨ ${t(`evolved from ${speciesName(p.species)}`, `由${speciesName(p.species)}進化`)}` : ''}${p.nickname ? ` · ${esc(speciesName(p.species, p.evolved))}` : ''}</span></div></div>
      ${stats(s)}
      <p class="muted small">${t('Moves', '招式')}: ${(s.moves || []).map(m => esc(t(m.en, m.zh))).join(' · ')}</p>
      <button type="button" class="ghost" data-close>${t('Close', '關閉')}</button>`, petName(p));
    wireSprites(box);
  });
}

// ---------------- the dex ----------------
const TOWER_FLOORS = (() => { const m = {}; for (let f = 1; f <= 30; f++) { const i = f % 5 === 0 ? 12 + ((f / 5 - 1) % 6) : [0, 2, 9, 1, 6, 4, 7, 3, 10, 8, 5, 11][(f - Math.floor(f / 5) - 1) % 12]; (m[i] ||= []).push(f); } return m; })();
export async function dexScreen() {
  const el = render(`<header class="page-head"><div><h2>📖 ${t('Dex', '圖鑑')}</h2></div><a class="link" href="#/me">‹ ${t('Me', '我')}</a></header>
    ${advNav('dex')}<div id="dxBody"><p class="muted">${t('Loading…', '載入緊…')}</p></div>`);
  wireAdvNav(el);
  let dx;
  const load = async () => { dx = await api.myDex(); };
  try { await load(); } catch (err) { showError(err); return; }
  const SET = { normal: ['Every tower monster', '全部塔怪物'], boss: ['Every boss', '全部 Boss'], evo: ['6 different evolutions', '6 種唔同嘅進化'] };
  const draw = () => {
    const sp = dx.species || [];
    const tile = s => {
      const where = (TOWER_FLOORS[s.idx] || []).slice(0, 3).join(', ');
      if (!s.caught) return `<div class="dx-tile unknown">${sprite(s.idx, 64, t('Not caught yet', '未捉到'), false, true)}<b>？？？</b>
        <span class="muted small">${s.boss ? t(`Boss · floor ${where}`, `Boss · 第 ${where} 層`) : t(`Tower floor ${where}…`, `塔第 ${where} 層…`)}</span></div>`;
      const grade = s.best_iv != null ? ivGrade({ hp: s.best_iv, atk: s.best_iv, def: s.best_iv, spd: s.best_iv, tec: s.best_iv }) : null;
      return `<div class="dx-tile ${s.evolved ? 'evo' : ''}">${sprite(s.idx, 64, speciesName(s.idx, s.evolved), s.evolved)}<b>${esc(speciesName(s.idx, s.evolved))}</b>
        <span class="pt-meta">${typeChip(s.type)}${grade ? `<span class="pt-grade g-${grade}" title="${t('Best IV', '最好 IV')}">${grade}</span>` : ''}</span>
        <span class="muted small">${s.have ? t(`You have ${s.have}`, `你有 ${s.have} 隻`) : t('Caught before', '捉過')}${s.evolved ? ' · ✨' : ''}</span></div>`;
    };
    const setRow = x => { const done = x.have >= x.need;
      return `<li class="dx-set"><div><b>${t(...SET[x.id])}</b><span class="q-bar" aria-hidden="true"><i style="width:${Math.round(Math.min(1, x.have / x.need) * 100)}%"></i></span>
        <span class="muted small">${x.have} / ${x.need} · +${x.coins} 💧 +${x.xp} ${t('XP', '經驗')}</span></div>
        ${x.claimed ? `<span class="sm-done">✓ ${t('Claimed', '已領')}</span>` : `<button type="button" class="small-btn" data-set="${x.id}" ${done ? '' : 'disabled'}>${t('Claim', '領取')}</button>`}</li>`; };
    el.querySelector('#dxBody').innerHTML = `
      <section class="card"><div class="card-head"><h3>${t('Collections', '收集獎勵')}</h3><span class="muted small">${sp.filter(x => x.caught).length} / ${sp.length}</span></div>
        <ul class="dx-sets">${(dx.sets || []).map(setRow).join('')}</ul>
        <p class="muted small">${t('Anything you’ve ever caught counts, even if you released it.', '捉過就計，放生咗都計。')}</p></section>
      <section class="card"><div class="card-head"><h3>🗼 ${t('Tower monsters', '塔怪物')}</h3></div><div class="dx-grid">${sp.filter(x => !x.boss).map(tile).join('')}</div></section>
      <section class="card"><div class="card-head"><h3>👑 ${t('Bosses', 'Boss')}</h3></div><div class="dx-grid">${sp.filter(x => x.boss).map(tile).join('')}</div></section>
      <section class="card"><div class="card-head"><h3>🌟 ${t('Legends', '傳說')}</h3><span class="muted small">${(dx.legend || []).filter(x => x.caught).length} / ${(dx.legend || []).length}</span></div>
        <p class="muted small">${t('The weekly group bosses. Once your group has worn one down to 25% HP: one ball per attack, and the odds are tiny.', '每週 group 魔王。group 打到佢剩 25% 血之後：每次攻擊可以掟一個球，機會極低。')}</p>
        <div class="dx-grid">${(dx.legend || []).map(s => s.caught
          ? `<div class="dx-tile legend">${sprite(s.idx, 64, speciesName(s.idx))}<b>${esc(speciesName(s.idx))}</b><span class="pt-meta">${typeChip(s.type)}</span><span class="muted small">${s.have ? t(`You have ${s.have}`, `你有 ${s.have} 隻`) : t('Caught before', '捉過')}</span></div>`
          : `<div class="dx-tile unknown">${sprite(s.idx, 64, t('Not caught yet', '未捉到'), false, true)}<b>？？？</b><span class="muted small">${t('Group boss', 'Group 魔王')}</span></div>`).join('')}</div></section>`;
    wireSprites(el);
    el.querySelectorAll('[data-set]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { const r = await api.claimDex(b.dataset.set); navigator.vibrate?.([30, 60, 30]); toast(t(`Collection done! +${r.coins} 💧 +${r.xp} XP`, `收集完成！+${r.coins} 💧 +${r.xp} 經驗`)); await load(); draw(); }
      catch (err) { b.disabled = false; showError(err); }
    });
  };
  draw();
}

// ---------------- the Boss Lair ----------------
export async function lairScreen() {
  const el = render(`<header class="page-head"><div><h2>👑 ${t('Boss Lair', 'Boss 巢穴')}</h2></div><a class="link" href="#/me">‹ ${t('Me', '我')}</a></header>
    ${advNav('lair')}<div id="lrBody"><p class="muted">${t('Loading…', '載入緊…')}</p></div>`);
  wireAdvNav(el);
  let st;
  try { st = await api.lairStatus(); } catch (err) { showError(err); return; }
  el.querySelector('#lrBody').innerHTML = `
    ${st.open ? `<section class="card lr-open"><b>${t('You’re in a boss fight.', '你打緊 Boss。')}</b><a class="button" href="#/battle/${st.open}">${t('Back to your fight', '返去繼續打')}</a></section>` : ''}
    <section class="card lr-wallet"><span>${st.free ? `✨ <b>${t('1 free try today', '今日有 1 次免費')}</b>` : `<span class="muted">${t('Free try used today', '今日免費機會用咗')}</span>`}</span>
      <span>🎟️ ${st.tickets}</span><span>💧 ${st.coins}</span></section>
    <section class="card"><div class="lr-grid">${st.bosses.map(b => b.unlocked === false
        ? `<div class="lr-boss locked">${sprite(b.idx, 96)}<b>🔒 ${esc(speciesName(b.idx))}</b><span class="muted small">${t(`Beat it on tower floor ${b.floor}`, `喺塔第 ${b.floor} 層打贏佢先`)}</span></div>`
        : `<button type="button" class="lr-boss" data-sp="${b.idx}">
        ${sprite(b.idx, 96)}<b>${esc(speciesName(b.idx))}</b><span class="pt-meta">${typeChip(b.type)}${b.caught ? `<span class="small">✓ ${b.caught}</span>` : ''}</span></button>`).join('')}</div></section>
    <details class="card cc-how"><summary>${t('How it works', '點樣玩')}</summary><ul>
      <li>${t('Every 5th tower floor is a boss. Beat it there and it opens here, so you can come back to catch it.', '塔每 5 層有一隻 Boss。喺塔打贏咗，佢就會喺度開放，你可以返嚟捉佢。')}</li>
      <li>${t('Each boss is matched to your stats. Throw a ball whenever you like: the lower its HP, the better the chance.', '每隻 Boss 都按你嘅能力配對。隨時都可以掟球：佢血越少就越易捉。')}</li>
      <li>${t('Boss species are hard to catch: bring better balls, or keep coming back.', 'Boss 品種好難捉：帶好啲嘅球，或者不斷返嚟再試。')}</li>
      <li>${t('One free try a day. After that it’s 1 🎟️ or 40 💧 a try.', '每日一次免費。之後每次 1 🎟️ 或者 40 💧。')}</li>
      <li>${t('Beat it without catching: +15 💧 +20 XP.', '打贏但冇捉到：+15 💧 +20 經驗。')}</li></ul></details>`;
  wireSprites(el);
  el.querySelectorAll('.lr-boss').forEach(b => b.onclick = () => {
    if (st.open) { location.hash = `#/battle/${st.open}`; return; }
    const sp = +b.dataset.sp;
    const { box, close } = sheet(`<div class="pt-head">${sprite(sp, 96)}<div><h3>${esc(speciesName(sp))}</h3><span class="muted small">${t('How do you want to pay?', '用咩入場？')}</span></div></div>
      <div class="lr-pay">
        <button type="button" data-pay="free" ${st.free ? '' : 'disabled'}>✨ ${t('Free try', '免費')}</button>
        <button type="button" class="ghost" data-pay="ticket" ${st.tickets > 0 ? '' : 'disabled'}>🎟️ 1 ${t('ticket', '張券')}</button>
        <button type="button" class="ghost" data-pay="coins" ${st.coins >= st.price ? '' : 'disabled'}>💧 ${st.price}</button></div>
      <button type="button" class="ghost" data-close>${t('Cancel', '取消')}</button>`, speciesName(sp));
    wireSprites(box);
    box.querySelectorAll('[data-pay]').forEach(x => x.onclick = async () => {
      box.querySelectorAll('[data-pay]').forEach(y => y.disabled = true);
      try { const id = await api.lairFight(sp, x.dataset.pay); close(); location.hash = `#/battle/${id}`; } catch (err) { close(); showError(err); }
    });
  });
}
