// Pets, the shop and the Boss Lair.
// Pets fight with YOUR stats (so training still decides everything), shaped by their species and their IVs.
import * as api from './supa.js';
import { t } from './i18n.js';
import { esc, render, toast, showError, slideChips } from './ui.js';
import { drawBoss, BOSSES } from './pixel.js';
import { MOVE_TYPES } from './battle.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const STATS = [['hp', 'HP', 'HP'], ['atk', 'Attack', '攻擊'], ['def', 'Defence', '防禦'], ['spd', 'Speed', '速度'], ['tec', 'Technique', '技巧']];
export const speciesName = i => { const b = BOSSES[i % BOSSES.length]; return t(b.en, b.zh); };
export const petName = p => p.nickname || speciesName(p.species);
const typeChip = ty => { const m = MOVE_TYPES[ty] || MOVE_TYPES.normal; return `<span class="pt-type" style="--c:${m.col}">${t(m.en, m.zh)}</span>`; };
// how good the IVs are overall (each stat is -20%..+20%)
export function ivGrade(iv) {
  const avg = STATS.reduce((s, [k]) => s + (+iv?.[k] || 0), 0) / STATS.length;
  return avg >= 0.12 ? 'S' : avg >= 0.05 ? 'A' : avg >= -0.05 ? 'B' : avg >= -0.12 ? 'C' : 'D';
}
const FOOD = { protein_bar: { icon: '🍫', en: 'Protein Bar', zh: '蛋白棒' }, steak: { icon: '🥩', en: 'Steak', zh: '牛扒' } };
const pct = v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const ICON = { potion: '🧃', food: { protein_bar: '🍫', steak: '🥩' } };
export const itemIcon = it => (it.kind === 'ball' ? '' : it.kind === 'food' ? (ICON.food[it.id] || '🍖') : ICON.potion);
// a move scroll: same type as the pet or Normal (Normal pets learn anything); no fusion or monster-only moves
const TEACHABLE = ['always', 'lift', 'maxlift', 'sets', 'cardio', 'climb', 'climbs'];
export const scrollPrice = m => 60 + Math.round(1.5 * (m.power || 0));

// little animated sprites: every canvas with data-sp gets its species drawn
function wireSprites(root) {
  const cvs = [...root.querySelectorAll('canvas[data-sp]')];
  cvs.forEach(cv => drawBoss(cv, +cv.dataset.sp, 0, cv.dataset.ko ? 'ko' : 'idle'));
  if (reduced() || !cvs.length) return;
  let f = 0;
  const tick = setInterval(() => {
    if (!document.body.contains(cvs[0])) return clearInterval(tick);
    f ^= 1; cvs.forEach(cv => drawBoss(cv, +cv.dataset.sp, f, cv.dataset.ko ? 'ko' : 'idle'));
  }, 600);
}
const sprite = (sp, size = 64, label = '') => `<canvas data-sp="${sp}" width="${size}" height="${Math.round(size * 40 / 48)}" role="img" aria-label="${esc(label || speciesName(sp))}"></canvas>`;

// the strip of links shared by the tower, pets, shop and lair
export function advNav(on) {
  const L = [['tower', '🗼', 'Tower', '塔'], ['pets', '🐾', 'Pets', '寵物'], ['lair', '👑', 'Boss Lair', 'Boss 巢穴'], ['shop', '🏪', 'Shop', '商店']];
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
export async function petsScreen() {
  const el = render(`<header class="page-head"><div><h2>🐾 ${t('Pets', '寵物')}</h2></div><a class="link" href="#/me">‹ ${t('Me', '我')}</a></header>
    ${advNav('pets')}<div id="ptBody"><p class="muted">${t('Loading…', '載入緊…')}</p></div>`);
  wireAdvNav(el);
  let pets;
  const load = async () => { pets = await api.myPets(); };
  try { await load(); } catch (err) { showError(err); return; }
  const teamIds = () => pets.filter(p => p.slot != null).sort((a, b) => a.slot - b.slot).map(p => p.id);
  const saveTeam = async ids => { try { await api.setTeam(ids); await load(); draw(); } catch (err) { showError(err); } };

  const card = p => `<button type="button" class="pt-card" data-pet="${p.id}">${sprite(p.species, 64, petName(p))}
      <b>${esc(petName(p))}</b><span class="pt-lv">Lv ${p.level || 1}</span><span class="pt-meta">${typeChip(p.type)}<span class="pt-grade g-${ivGrade(p.iv)}" title="${t('IV grade', 'IV 評級')}">${ivGrade(p.iv)}</span></span></button>`;
  function draw() {
    const team = teamIds().map(id => pets.find(p => p.id === id));
    const box = pets.filter(p => p.slot == null);
    el.querySelector('#ptBody').innerHTML = `
      <section class="card"><div class="card-head"><h3>${t('Your team', '你嘅隊伍')}</h3><span class="muted small">${team.length + 1} / 6</span></div>
        <p class="muted small">${t('You fight first; your pets come in when you switch or go down. Tower and Boss Lair only.', '你先出場；換人或者你倒低咗，寵物就會上。只限塔同 Boss 巢穴。')}</p>
        <div class="pt-team"><div class="pt-card me"><span class="pt-you" aria-hidden="true">🙋</span><b>${t('You', '你')}</b><span class="pt-meta muted small">${t('Leader', '隊長')}</span></div>
          ${team.map(card).join('')}${Array.from({ length: 5 - team.length }, () => `<div class="pt-card empty" aria-hidden="true">＋</div>`).join('')}</div></section>
      <section class="card"><div class="card-head"><h3>${t('Box', '寵物箱')}</h3><span class="muted small">${pets.length}</span></div>
        ${box.length ? `<div class="pt-box">${box.map(card).join('')}</div>`
          : `<p class="muted small">${pets.length ? t('Everyone is in your team.', '全部都喺隊入面。') : t('No pets yet. Knock a monster low in the tower, then throw a ball (buy them in the shop).', '仲未有寵物。喺塔將怪打到殘血，再掟個球（喺商店買）。')}</p>
          ${pets.length ? '' : `<a class="button" href="#/shop">🏪 ${t('Go to the shop', '去商店')}</a>`}`}</section>
      <details class="card cc-how"><summary>${t('How pets work', '寵物點運作')}</summary><ul>
        <li>${t('A pet’s stats come from yours, shaped by its species: a Takeaway Goblin is all attack, a Duvet Burrito is all HP and defence. Train and they get stronger too.', '寵物嘅能力由你嘅能力計，再按品種調整：外賣哥布林全攻擊，被竇卷就高 HP 同防禦。你練勁，佢哋都會勁。')}</li>
        <li>${t('Each one has its own IVs: −20% to +20% on every stat. Catch the same species again to find a better one (S is the best).', '每隻都有自己嘅 IV：每項能力 −20% 至 +20%。再捉同一品種可以搵更好嘅（S 最好）。')}</li>
        <li>${t('The lower a monster’s HP, the easier to catch. Boss species only at 30% HP or less.', '怪物血越少越易捉。Boss 品種要打到 30% 或以下先捉得。')}</li>
        <li>${t('Pets level up (to 10, +2% stats a level) from fights they’re in: +20 XP for a win, +5 for a loss. Food from the shop speeds it up.', '寵物喺有份打嘅戰鬥升級（最高 10 級，每級能力 +2%）：贏 +20 經驗，輸 +5。商店嘅食物可以加快。')}</li>
        <li>${t('A move scroll teaches a pet one extra move (its type or Normal). Teaching another replaces it.', '招式卷軸可以教寵物多一招（同屬性或者普通）。再教就會換走。')}</li>
        <li>${t('A bigger team makes the monsters tougher too, so it helps but doesn’t walk through everything.', '隊伍越大，怪物都會越強，所以有幫助，但唔會一路無敵。')}</li></ul></details>`;
    wireSprites(el);
    el.querySelectorAll('[data-pet]').forEach(b => b.onclick = () => petSheet(pets.find(p => p.id === b.dataset.pet)));
  }
  let bag = null, moves = null;
  async function petSheet(p) {
    try { [bag, moves] = await Promise.all([bag || api.myBag(), moves || api.allMoves()]); } catch (err) { showError(err); return; }
    const foods = Object.entries(bag.items || {}).filter(([k, q]) => q > 0 && FOOD[k]);
    const lv = p.level || 1, maxed = lv >= 10, span = maxed ? 1 : (p.xp_to ?? 50) - (p.xp_from ?? 0), into = maxed ? 1 : (p.xp ?? 0) - (p.xp_from ?? 0);
    const inTeam = p.slot != null, full = teamIds().length >= 5, s = p.snap || {};
    const { box, close } = sheet(`
      <div class="pt-head">${sprite(p.species, 96, petName(p))}<div><h3>${esc(petName(p))}</h3>
        <span class="pt-meta">${typeChip(p.type)}${p.boss ? `<span class="pt-boss">👑 ${t('Boss', 'Boss')}</span>` : ''}<span class="pt-grade g-${ivGrade(p.iv)}">${ivGrade(p.iv)}</span></span>
        ${p.nickname ? `<span class="muted small">${esc(speciesName(p.species))}</span>` : ''}</div></div>
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
        <button type="button" class="ghost danger" data-act="free">${t('Release', '放生')}</button>
      </div>
      <button type="button" class="ghost" data-close>${t('Close', '關閉')}</button>`, petName(p));
    wireSprites(box);
    box.querySelector('[data-act="in"]')?.addEventListener('click', () => { close(); saveTeam([...teamIds(), p.id]); });
    box.querySelector('[data-act="out"]')?.addEventListener('click', () => { close(); saveTeam(teamIds().filter(x => x !== p.id)); });
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
    box.querySelector('[data-act="name"]').onclick = async () => {
      const n = prompt(t('Name (up to 20 letters, empty for the species name)', '名（最多 20 個字，留空就用品種名）'), p.nickname || '');
      if (n == null) return;
      try { await api.petUpdate(p.id, n); close(); await load(); draw(); } catch (err) { showError(err); }
    };
    const fr = box.querySelector('[data-act="free"]');
    fr.onclick = async () => {
      if (!fr.dataset.sure) { fr.dataset.sure = '1'; fr.textContent = t('Sure? It’s gone for good', '確定？放咗就冇㗎喇'); return; }
      try { await api.petUpdate(p.id, null, true); close(); await load(); draw(); toast(t('Released', '放生咗')); } catch (err) { showError(err); }
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
      <li>${t('Each boss is matched to your stats. Get it to 30% HP or less, then throw a ball.', '每隻 Boss 都按你嘅能力配對。打到佢 30% 或以下，就可以掟球。')}</li>
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
