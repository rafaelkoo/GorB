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
const pct = v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

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
export async function shopScreen() {
  const el = render(`<header class="page-head"><div><h2>🏪 ${t('Shop', '商店')}</h2></div><a class="link" href="#/me">‹ ${t('Me', '我')}</a></header>
    ${advNav('shop')}<div id="shBody"><p class="muted">${t('Loading…', '載入緊…')}</p></div>`);
  wireAdvNav(el);
  let items, mine;
  try { [items, mine] = await Promise.all([api.shopItems(), api.myBag()]); } catch (err) { showError(err); return; }
  const draw = () => {
    el.querySelector('#shBody').innerHTML = `
      <section class="card sh-wallet"><b>💧 ${mine.coins}</b><span class="muted small">${t('Coins come from going to the gym: chests, quests, the tower.', '金幣嚟自去 gym：寶箱、任務、塔。')}</span></section>
      <section class="card"><ul class="sh-list">${items.map(it => {
        const have = mine.items?.[it.id] || 0;
        return `<li class="sh-item"><span class="sh-ic ${it.kind}" data-b="${it.id}" aria-hidden="true">${it.kind === 'ball' ? '' : '🧃'}</span>
          <div class="sh-txt"><b>${esc(t(it.en, it.zh))}</b><span class="muted small">${esc(t(it.desc_en, it.desc_zh))}</span><span class="small">${t(`You have ${have}`, `你有 ${have} 個`)}</span></div>
          <div class="sh-buy"><button type="button" data-buy="${it.id}" data-q="1" ${mine.coins < it.price ? 'disabled' : ''}>💧 ${it.price}</button>
          <button type="button" class="ghost small-btn" data-buy="${it.id}" data-q="5" ${mine.coins < it.price * 5 ? 'disabled' : ''}>×5 · ${it.price * 5}</button></div></li>`;
      }).join('')}</ul></section>
      <p class="muted small sh-note">${t('Balls catch monsters in the tower and the Boss Lair. Drinks heal whoever is fighting (2 per fight).', '球用嚟喺塔同 Boss 巢穴捉怪。飲品幫上緊場嗰個回血（每場最多 2 件）。')}</p>`;
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
      <b>${esc(petName(p))}</b><span class="pt-meta">${typeChip(p.type)}<span class="pt-grade g-${ivGrade(p.iv)}" title="${t('IV grade', 'IV 評級')}">${ivGrade(p.iv)}</span></span></button>`;
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
        <li>${t('A pet’s stats come from yours, shaped by its species: a Kettlebell Pup is all attack, a Treadmill Turtle is all HP and defence. Train and they get stronger too.', '寵物嘅能力由你嘅能力計，再按品種調整：鐵鈴狗全攻擊，跑步機龜就高 HP 同防禦。你練勁，佢哋都會勁。')}</li>
        <li>${t('Each one has its own IVs: −20% to +20% on every stat. Catch the same species again to find a better one (S is the best).', '每隻都有自己嘅 IV：每項能力 −20% 至 +20%。再捉同一品種可以搵更好嘅（S 最好）。')}</li>
        <li>${t('The lower a monster’s HP, the easier to catch. Boss species only at 30% HP or less.', '怪物血越少越易捉。Boss 品種要打到 30% 或以下先捉得。')}</li>
        <li>${t('A bigger team makes the monsters tougher too, so it helps but doesn’t walk through everything.', '隊伍越大，怪物都會越強，所以有幫助，但唔會一路無敵。')}</li></ul></details>`;
    wireSprites(el);
    el.querySelectorAll('[data-pet]').forEach(b => b.onclick = () => petSheet(pets.find(p => p.id === b.dataset.pet)));
  }
  function petSheet(p) {
    const inTeam = p.slot != null, full = teamIds().length >= 5, s = p.snap || {};
    const { box, close } = sheet(`
      <div class="pt-head">${sprite(p.species, 96, petName(p))}<div><h3>${esc(petName(p))}</h3>
        <span class="pt-meta">${typeChip(p.type)}${p.boss ? `<span class="pt-boss">👑 ${t('Boss', 'Boss')}</span>` : ''}<span class="pt-grade g-${ivGrade(p.iv)}">${ivGrade(p.iv)}</span></span>
        ${p.nickname ? `<span class="muted small">${esc(speciesName(p.species))}</span>` : ''}</div></div>
      <table class="pt-stats"><tbody>${STATS.map(([k, en, zh]) => { const v = +p.iv?.[k] || 0;
        return `<tr><th>${t(en, zh)}</th><td>${s[k] ?? '–'}</td><td class="pt-iv ${v >= 0.1 ? 'hi' : v <= -0.1 ? 'lo' : ''}">IV ${pct(v)}</td></tr>`; }).join('')}</tbody></table>
      <p class="muted small">${t('Moves', '招式')}: ${(s.moves || []).map(m => esc(t(m.en, m.zh))).join(' · ')}</p>
      <div class="pt-acts">
        ${inTeam ? `<button type="button" class="ghost" data-act="out">${t('Take out of team', '退出隊伍')}</button>`
          : `<button type="button" data-act="in" ${full ? 'disabled' : ''}>${full ? t('Team is full (5 pets)', '隊伍滿咗（5 隻）') : t('Add to team', '加入隊伍')}</button>`}
        <button type="button" class="ghost" data-act="test">${t('Test fight (free)', '試打（免費）')}</button>
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
    <section class="card"><div class="lr-grid">${st.bosses.map(b => `<button type="button" class="lr-boss" data-sp="${b.idx}">
        ${sprite(b.idx, 96)}<b>${esc(speciesName(b.idx))}</b><span class="pt-meta">${typeChip(b.type)}${b.caught ? `<span class="small">✓ ${b.caught}</span>` : ''}</span></button>`).join('')}</div></section>
    <details class="card cc-how"><summary>${t('How it works', '點樣玩')}</summary><ul>
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
