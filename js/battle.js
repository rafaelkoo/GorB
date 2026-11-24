// Battles: your moves (Me page), the Gym Tower, the battle screen, and friendly matches.
// The server (migrations 030–032) works out every hit; this only shows it.
import * as api from './supa.js';
import { t } from './i18n.js';
import { esc, render, toast, showError } from './ui.js';
import { drawBattle, drawBoss, BOSSES, cleanAvatar, BW, BH } from './pixel.js';
import { advNav, wireAdvNav, ivGrade, itemIcon } from './pets.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, reduced() ? Math.min(ms, 150) : ms));

export const MOVE_TYPES = {
  strength: { en: 'Strength', zh: '力量', col: '#e2563b' },
  endurance: { en: 'Endurance', zh: '耐力', col: '#2e9fd6' },
  climbing: { en: 'Climbing', zh: '攀石', col: '#45b45a' },
  normal: { en: 'Normal', zh: '普通', col: '#8a8f98' }
};
const CAT = { chest: ['chest', '胸'], back: ['back', '背'], legs: ['legs', '腳'], shoulders: ['shoulders', '膊頭'], arms: ['arms', '手臂'] };
const moveName = m => t(m.en, m.zh);
const usesOf = m => (m.uses ?? (/^heal/.test(m.effect || '') ? 2 : /^buff/.test(m.effect || '') ? 3 : null));
const monsterName = s => {
  const b = BOSSES[(s.monster ?? 0) % BOSSES.length], n = t(b.en, b.zh);
  return s.raid ? t(`Boss: ${n}`, `魔王：${n}`) : s.boss_floor ? `Boss ${n}` : s.elite ? t(`Elite ${n}`, `精英${n}`) : n;
};
const speciesNm = (i, evo) => { const b = BOSSES[i % BOSSES.length], n = evo && b.evo ? b.evo : b; return t(n.en, n.zh); };
const fighterName = s => (s.pet ? (s.name || speciesNm(s.species, s.evolved)) : s.monster != null ? monsterName(s) : s.name || '?');
export const towerReward = n => ({ xp: 20 + 4 * n + (n % 5 === 0 ? 30 : 0), coins: 5 + n + (n % 5 === 0 ? 15 : 0) });
// replaying a floor you've cleared: 30% of its first-clear reward, every win
export const replayReward = n => { const r = towerReward(n); return { xp: Math.round(r.xp * 0.3), coins: Math.max(1, Math.round(r.coins * 0.3)) }; };
const towerMonster = f => (f % 5 === 0 ? 12 + ((f / 5 - 1) % 6) : [0, 2, 9, 1, 6, 4, 7, 3, 10, 8, 5, 11][(f - Math.floor(f / 5) - 1) % 12]);

// ---------------- what a move needs (for the locked ones) ----------------
function needText(m, basis, learned, byId) {
  const b = basis || {};
  switch (m.req_kind) {
    case 'fusion': { const parts = m.req_moves || [], have = parts.filter(id => learned.has(id));
      return [parts.map(id => `${learned.has(id) ? '✓' : '✗'} ${moveName(byId[id] || { en: id, zh: id })}`).join(' + '), have.length / Math.max(1, parts.length)]; }
    case 'climbs': return [t(`Top ${m.req_val} climbs in 60 days (you: ${b.climbs || 0}; 4 bouldering minutes count as 1)`, `60 日內爬完 ${m.req_val} 條線（你而家 ${b.climbs || 0} 條；抱石每 4 分鐘當 1 條）`), (b.climbs || 0) / m.req_val];
    case 'lift': { const [en, zh] = CAT[m.req_cat] || [m.req_cat, m.req_cat]; const now = b.lifts?.[m.req_cat] || 0;
      return [t(`Best ${en} lift ${m.req_val} kg (you: ${now} kg)`, `${zh}最好做到 ${m.req_val} kg（你而家 ${now} kg）`), now / m.req_val]; }
    case 'maxlift': return [t(`Any lift ${m.req_val} kg (you: ${b.max || 0} kg)`, `任何動作做到 ${m.req_val} kg（你而家 ${b.max || 0} kg）`), (b.max || 0) / m.req_val];
    case 'sets': return [t(`${m.req_val} sets in 60 days (you: ${b.sets || 0})`, `60 日內做 ${m.req_val} 組（你而家 ${b.sets || 0} 組）`), (b.sets || 0) / m.req_val];
    case 'cardio': return [t(`${m.req_val} min cardio in 60 days (you: ${b.cardio || 0})`, `60 日內 cardio ${m.req_val} 分鐘（你而家 ${b.cardio || 0}）`), (b.cardio || 0) / m.req_val];
    case 'climb': return [t(`Top a V${m.req_val} (you: ${b.grade >= 0 ? `V${b.grade}` : 'none yet'})`, `爬到 V${m.req_val}（你而家 ${b.grade >= 0 ? `V${b.grade}` : '未有'}）`), b.grade >= 0 ? (b.grade + 1) / (m.req_val + 1) : 0];
    default: return ['', 1];
  }
}
const typesOf = m => (m.types?.length ? m.types : [m.type]);
const moveCol = m => (MOVE_TYPES[typesOf(m)[0]] || MOVE_TYPES.normal).col;
const moveTag = m => {
  const pw = m.power > 0 ? `${t('Power', '威力')} ${m.power}` : '';
  const n = usesOf(m);
  return `${typesOf(m).map(x => { const ty = MOVE_TYPES[x] || MOVE_TYPES.normal; return `<span class="mv-type" style="--c:${ty.col}">${t(ty.en, ty.zh)}</span>`; }).join('')}${pw ? `<span class="muted small">${pw}</span>` : ''}${m.uses ? `<span class="muted small">${t(`${n}× per fight`, `每場 ${n} 次`)}</span>` : ''}`;
};
// one short line on what a move does, for the battle buttons
const STAT = { atk: ['attack', '攻擊'], spd: ['speed', '速度'], tec: ['technique', '技巧'] };
const pct = v => Math.round(v * 100);
export function shortDesc(m) {
  const v = +m.val || +m.effect_val || 0;
  const fx = {
    multi: t('hits 2–3 times', '連打 2–3 下'), crit: t('often critical', '好易會心'), recoil: t(`you take ${pct(v)}% back`, `自己反傷 ${pct(v)}%`),
    flinch: t(`${pct(v)}% they lose a turn`, `${pct(v)}% 令對手出唔到招`), lock: t(`weakens + locks them ${v} turn${v === 1 ? '' : 's'}`, `降對手攻擊、鎖 ${v} 回合`),
    ramp: t('stronger each use', '越用越痛'), heal: t(`heal ${pct(v)}%`, `回血 ${pct(v)}%`), heal_buff: t(`heal ${pct(v)}%, attack & defence up`, `回血 ${pct(v)}%，攻防都 ↑`),
    buff_atk: t('attack up', '攻擊 ↑'), buff_def: t('defence up', '防禦 ↑'), buff_both: t('attack & defence up', '攻擊同防禦 ↑'), nocounter: t('never resisted', '永遠唔會被剋')
  }[m.effect];
  if (!(m.power > 0)) return fx || '';
  const st = (m.stats?.length ? m.stats : [m.stat]).filter(s => STAT[s]).map(s => t(...STAT[s]));
  const uses = st.length > 1 ? t(`uses ${st.join('/')}`, `靠${st.join('/')}`) : st.length ? t(`uses ${st[0]}`, `靠${st[0]}`) : '';
  return [uses, fx].filter(Boolean).join(' · ');
}
const typeLine = m => typesOf(m).map(x => { const ty = MOVE_TYPES[x] || MOVE_TYPES.normal; return t(ty.en, ty.zh); }).join(' + ');

// ---------------- Me page: moves card ----------------
export function movesCardHtml() {
  return `<section class="card moves-card" id="movesCard"><div class="card-head"><h3>${t('Moves', '招式')}</h3>
    </div><nav class="adv-quick" aria-label="${t('Adventure', '冒險')}"><a href="#/tower">🗼 ${t('Tower', '塔')}</a><a href="#/pets">🐾 ${t('Pets', '寵物')}</a><a href="#/lair">👑 Boss</a><a href="#/shop">🏪 ${t('Shop', '商店')}</a></nav><div id="mvBody"><p class="muted small">${t('Loading…', '載入緊…')}</p></div></section>`;
}

export async function mountMoves(el, user) {
  const card = el.querySelector('#movesCard'); if (!card) return;
  let all, mine;
  try { [all, mine] = await Promise.all([api.allMoves(), api.characterMoves(user.id)]); } catch { card.hidden = true; return; }
  if (!mine || !all?.length) { card.hidden = true; return; }
  let slot = null;   // the equipped slot you picked to replace
  const draw = () => {
    const learned = new Set(mine.learned || []), eq = mine.equipped || [], bought = new Set(mine.bought || []);
    const byId = Object.fromEntries(all.map(m => [m.id, m]));
    const shopMoves = all.filter(m => m.req_kind === 'shop');
    const locked = all.filter(m => !learned.has(m.id) && m.req_kind !== 'fusion' && m.req_kind !== 'shop').map(m => ({ m, need: needText(m, mine.basis, learned, byId) })).sort((a, b) => b.need[1] - a.need[1]);
    const fusions = all.filter(m => m.req_kind === 'fusion');
    card.querySelector('#mvBody').innerHTML = `
      <p class="muted small">${t('Moves come from your real training (last 60 days). Lift heavier, do more cardio or climb harder to learn new ones. Stop going and you forget them.',
        '招式嚟自你真實嘅訓練（最近 60 日）。舉重啲、多啲 cardio、爬難啲，就學到新招。唔去就會唔記得。')}</p>
      <h4 class="q-h">${t('Equipped: tap one, then the move to swap in', '帶住出戰：撳一格，再揀要換入去嘅招')}</h4>
      <div class="mv-slots">${[0, 1, 2, 3].map(i => { const m = byId[eq[i]];
        return m ? `<button type="button" data-slot="${i}" aria-pressed="${slot === i}" class="mv-slot ${m.req_kind === 'fusion' ? 'fusion' : ''} ${m.req_kind === 'shop' ? 'shop' : ''} ${slot === i ? 'picked' : ''}" style="--c:${moveCol(m)}"><b>${m.req_kind === 'fusion' ? '✦ ' : m.req_kind === 'shop' ? '🏪 ' : ''}${esc(moveName(m))}</b><span class="mv-top">${moveTag(m)}</span></button>` : `<div class="mv-slot empty">—</div>`; }).join('')}</div>
      ${slot != null ? `<p class="small mv-hint">${t('Now tap a move below to put in this slot', '而家撳下面一招，就會換入呢格')}</p>` : ''}
      ${mine.grit ? `<p class="small grit">💪 <b>${t('Grit', '毅力')}</b> · ${t('12+ gym days in 60: once per fight you survive a knockout on 1 HP.', '60 日內去咗 12 日以上：每場可以撐住一次唔被打低（剩 1 HP）。')}</p>`
        : `<p class="muted small">💪 ${t(`Grit: go 12 days in 60 (you: ${mine.basis?.days || 0}) to survive one knockout per fight.`, `毅力：60 日內去夠 12 日（你而家 ${mine.basis?.days || 0} 日），每場可以撐住一次唔被打低。`)}</p>`}
      <h4 class="q-h">${t(`Learned (${learned.size})`, `學咗（${learned.size}）`)}</h4>
      <ul class="mv-list">${all.filter(m => learned.has(m.id)).map(m => `<li><button type="button" class="mv-pick ${eq.includes(m.id) ? 'on' : ''} ${m.req_kind === 'fusion' ? 'fusion' : ''}" data-mv="${m.id}" aria-pressed="${eq.includes(m.id)}">
        <span class="mv-top"><b>${m.req_kind === 'fusion' ? '✦ ' : ''}${esc(moveName(m))}</b>${moveTag(m)}</span><span class="muted small">${esc(t(m.desc_en, m.desc_zh))}</span></button></li>`).join('')}</ul>
      ${shopMoves.length ? `<h4 class="q-h">🏪 ${t('Shop moves: bought with coins, 1 at a time in your 4', '商店招式：用金幣買，4 招入面最多帶 1 招')}</h4>
      <ul class="mv-list">${shopMoves.map(m => bought.has(m.id)
        ? `<li><button type="button" class="mv-pick shop ${eq.includes(m.id) ? 'on' : ''}" data-mv="${m.id}" aria-pressed="${eq.includes(m.id)}"><span class="mv-top"><b>🏪 ${esc(moveName(m))}</b>${moveTag(m)}</span><span class="muted small">${esc(t(m.desc_en, m.desc_zh))}</span></button></li>`
        : `<li class="mv-locked"><span class="mv-top"><b>🔒 ${esc(moveName(m))}</b>${moveTag(m)}</span><span class="small">💧 ${m.price} · <a class="link" href="#/shop">${t('Buy in the shop', '去商店買')}</a></span></li>`).join('')}</ul>` : ''}
      ${fusions.some(m => !learned.has(m.id)) ? `<h4 class="q-h">✦ ${t('Fusion moves: learn both parts to unlock', '合體技：學齊材料招式就會解鎖')}</h4>
      <ul class="mv-list">${fusions.filter(m => !learned.has(m.id)).map(m => { const need = needText(m, mine.basis, learned, byId);
        return `<li class="mv-locked fusion"><span class="mv-top"><b>🔒 ✦ ${esc(moveName(m))}</b>${moveTag(m)}</span>
        <span class="small">${esc(need[0])}</span><span class="muted small">${esc(t(m.desc_en, m.desc_zh))}</span></li>`; }).join('')}</ul>` : ''}
      ${locked.length ? `<h4 class="q-h">${t('Still to learn', '未學到')}</h4>
      <ul class="mv-list">${locked.map(({ m, need }) => `<li class="mv-locked"><span class="mv-top"><b>🔒 ${esc(moveName(m))}</b>${moveTag(m)}</span>
        <span class="small">${esc(need[0])}</span><span class="q-bar" aria-hidden="true"><i style="width:${Math.round(Math.min(1, need[1]) * 100)}%"></i></span></li>`).join('')}</ul>` : ''}`;
    const save = async next => {
      const changed = next.findIndex((x, i) => x !== eq[i]);
      try {
        mine = await api.setMoves(next); slot = null; draw();
        card.querySelector(`[data-slot="${changed}"]`)?.classList.add('mv-new');
        card.querySelector(`[data-mv="${next[changed]}"]`)?.classList.add('mv-new');
        toast(t('Moves updated', '招式已經換好'));
      } catch (err) { showError(err); }
    };
    // tap a slot first to choose which one to replace
    card.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { const i = +b.dataset.slot; slot = slot === i ? null : i; draw(); });
    card.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => {
      const id = b.dataset.mv;
      if (eq.includes(id)) return;
      // only one shop move at a time: a new one takes the old one's place
      const oldShop = byId[id]?.req_kind === 'shop' ? eq.findIndex(x => byId[x]?.req_kind === 'shop') : -1;
      if (oldShop >= 0) { const next = [...eq]; next[oldShop] = id; return save(next); }
      if (eq.length < 4) return save([...eq, id]);
      if (slot != null) { const next = [...eq]; next[slot] = id; return save(next); }
      // otherwise ask which one it replaces
      const box = document.createElement('div'); box.className = 'sheet';
      box.innerHTML = `<div class="sheet-in" role="dialog" aria-label="${t('Swap out which move?', '換走邊一招？')}">
        <h3>${t(`Swap ${esc(moveName(byId[id]))} in for…`, `${esc(moveName(byId[id]))} 換走邊一招？`)}</h3>
        <div class="mv-slots">${eq.map((x, i) => { const m = byId[x]; return `<button type="button" class="mv-slot mv-swap" data-swap="${i}" style="--c:${moveCol(m)}"><b>${esc(moveName(m))}</b><span class="mv-top">${moveTag(m)}</span></button>`; }).join('')}</div>
        <button type="button" class="ghost" data-close>${t('Cancel', '取消')}</button></div>`;
      const close = () => box.remove();
      box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) close(); });
      box.querySelectorAll('[data-swap]').forEach(s => s.onclick = () => { const next = [...eq]; next[+s.dataset.swap] = id; close(); save(next); });
      document.body.append(box);
    });
  };
  draw();
}

// ---------------- Gym Tower ----------------
export async function towerScreen() {
  const el = render(`<header class="page-head"><div><h2>🗼 ${t('Gym Tower', 'Gym 塔')}</h2></div><a class="link" href="#/me">‹ ${t('Me', '我')}</a></header>
    ${advNav('tower')}<div id="twBody"><p class="muted">${t('Loading…', '載入緊…')}</p></div>`);
  wireAdvNav(el);
  let tw;
  try { tw = await api.myTower(); } catch (err) { showError(err); return; }
  const n = tw.next, rw = towerReward(n), mi = tw.monster, mb = BOSSES[mi % BOSSES.length];
  const floors = [];
  for (let f = n + 2; f >= Math.max(1, n - 3); f--) floors.push(f);
  el.querySelector('#twBody').innerHTML = `
    <section class="card tw-card">
      <div class="tw-tickets"><b>🎟️ ${tw.tickets}</b><span class="muted small">/ 9 · ${t('3 free every day, +3 for your first check-in', '每日免費 3 張，第一次打卡再多 3 張')}</span></div>
      <ol class="tw-floors">${floors.map(f => f > n ? `<li class="tw-f up"><span>${t(`Floor ${f}`, `第 ${f} 層`)}</span><span class="muted">？</span></li>`
        : f === n ? `<li class="tw-f next ${tw.elite ? 'elite' : ''}"><canvas id="twMon" width="96" height="80" role="img" aria-label="${esc(t(mb.en, mb.zh))}"></canvas>
            <div><b>${t(`Floor ${f}`, `第 ${f} 層`)}${tw.boss ? ' · 👑 Boss' : tw.elite ? ` · ${t('Elite', '精英')}` : ''}</b><span>${esc(t(mb.en, mb.zh))}</span>
            <span class="muted small">${t(`First clear: +${rw.xp} XP +${rw.coins} 💧`, `第一次過：+${rw.xp} 經驗 +${rw.coins} 💧`)}</span></div></li>`
        : `<li class="tw-f done"><span>${t(`Floor ${f}`, `第 ${f} 層`)}</span><span>✓</span></li>`).join('')}</ol>
      <button type="button" id="twGo" ${!tw.open && tw.tickets < 1 ? 'disabled' : ''}>${tw.open ? t('Back to your fight', '返去繼續打') : t(`Fight floor ${n} · 1 🎟️`, `挑戰第 ${n} 層 · 1 🎟️`)}</button>
      ${!tw.open && tw.tickets < 1 ? `<p class="muted small">${t('No tickets left. You get 3 free tomorrow, or 3 more when you check in at the gym.', '冇券喇。聽日有 3 張免費，或者去 gym 打卡即刻多 3 張。')}</p>` : ''}
    </section>
    ${tw.cleared > 0 ? `<section class="card tw-replay"><div class="card-head"><h3>🔁 ${t('Replay a floor', '重打舊層')}</h3></div>
      <p class="muted small">${t('Stuck? Replay any floor you’ve cleared for 30% of its reward each win, and catch what lives there. 1 🎟️ a fight.', '卡住咗？任何過咗嘅層都可以重打，每次贏有該層獎勵嘅 30%，仲可以捉嗰層嘅怪。每場 1 🎟️。')}</p>
      <div class="tw-rp"><select id="twRpFloor" aria-label="${t('Floor', '層數')}">${Array.from({ length: tw.cleared }, (_, i) => tw.cleared - i).map(f => { const r = replayReward(f), m = BOSSES[towerMonster(f)];
        return `<option value="${f}">${t(`Floor ${f}`, `第 ${f} 層`)} · ${esc(t(m.en, m.zh))}${f % 5 === 0 ? ' 👑' : ''} · +${r.xp} ${t('XP', '經驗')} +${r.coins} 💧</option>`; }).join('')}</select>
      <button type="button" class="ghost" id="twRpGo" ${tw.open || tw.tickets < 1 ? 'disabled' : ''}>${t('Replay · 1 🎟️', '重打 · 1 🎟️')}</button></div></section>` : ''}
    ${tw.best?.length ? `<section class="card"><div class="card-head"><h3>${t('Highest floors', '最高層數')}</h3></div>
      <ol class="tw-best">${tw.best.slice(0, 10).map(b => `<li><span>${esc(b.name)}</span><b>${b.floor}</b></li>`).join('')}</ol></section>` : ''}
    <details class="card cc-how"><summary>${t('How it works', '點樣玩')}</summary><ul>
      <li>${t('Each floor has one of your excuses not to train. Every 5th floor is a boss; beat it and you can fight it again (and catch it) in the Boss Lair.', '每層都係一個你唔去 gym 嘅藉口。每 5 層有隻 Boss；打贏咗就可以喺 Boss 巢穴再挑戰（同捉佢）。')}</li>
      <li>${t('Your stats and moves come from your real training, so the way up is going to the gym.', '你嘅能力同招式嚟自真實訓練，想爬高就要去 gym。')}</li>
      <li>${t('A fight costs 1 ticket. Win or lose, it’s used. You get 3 free every day and 3 more for your first check-in (up to 9).', '每場用 1 張券，贏定輸都會用咗。每日免費 3 張，第一次打卡再多 3 張（最多 9 張）。')}</li>
      <li>${t('Bring your pet team, use drinks, and throw a ball when a monster is low to catch it.', '可以帶寵物隊伍、用飲品，怪物殘血時掟球就捉得到佢。')}</li>
      <li>${t('Strength beats Climbing, Climbing beats Endurance, Endurance beats Strength.', '力量剋攀石，攀石剋耐力，耐力剋力量。')}</li></ul></details>`;
  const cv = el.querySelector('#twMon');
  if (cv) { let f = 0; drawBoss(cv, mi, 0); const tick = setInterval(() => { if (!document.body.contains(cv)) return clearInterval(tick); if (!reduced()) { f ^= 1; drawBoss(cv, mi, f); } }, 600); }
  el.querySelector('#twRpGo')?.addEventListener('click', async e => {
    e.target.disabled = true;
    try { const id = await api.towerFight(+el.querySelector('#twRpFloor').value); location.hash = `#/battle/${id}`; } catch (err) { e.target.disabled = false; showError(err); }
  });
  el.querySelector('#twGo').onclick = async e => {
    e.target.disabled = true;
    try { const id = await api.towerFight(); location.hash = `#/battle/${id}`; } catch (err) { e.target.disabled = false; showError(err); }
  };
}

// ---------------- the battle screen ----------------
let stopLive = null;
export function closeBattle() { stopLive?.(); stopLive = null; }

function eventLines(ev, snap, me) {
  const nm = side => esc(fighterName(snap[side]));
  const other = s => (s === 'a' ? 'b' : 'a');
  if (ev.t === 'start') return [t(`${nm(ev.first)} goes first!`, `${nm(ev.first)} 先出招！`)];
  if (ev.t === 'flee') return [t('You walked away.', '你走咗。')];
  if (ev.t === 'switch') { const n = esc(fighterName(snap.party?.[ev.to] || snap.a)); return [t(`Go, ${n}!`, `上啦，${n}！`)]; }
  if (ev.t === 'item') return [t(`You used a drink: +${ev.heal} HP.`, `你用咗飲品：+${ev.heal} HP。`)];
  if (ev.t === 'catch') return ev.ok ? [t('You threw a ball…', '你掟咗個球…'), t(`Caught ${nm('b')}! 🎉`, `捉到 ${nm('b')}！🎉`)]
    : [t('You threw a ball…', '你掟咗個球…'), t('Oh no! It broke free.', '哎呀！佢走甩咗。')];
  if (ev.t === 'timeout') return [t(`${nm(ev.who)} took too long. The win goes to the other side.`, `${nm(ev.who)} 太耐冇出招，對手贏。`)];
  const mv = (snap[ev.who].moves || []).find(m => m.id === ev.move) || { en: ev.move, zh: ev.move };
  const L = [t(`${nm(ev.who)} used ${esc(moveName(mv))}!`, `${nm(ev.who)} 用咗 ${esc(moveName(mv))}！`)];
  if (ev.dmg?.length > 1) L.push(t(`Hit ${ev.dmg.length} times!`, `打中 ${ev.dmg.length} 下！`));
  if (ev.crit) L.push(t('A critical hit!', '會心一擊！'));
  if (ev.eff > 1) L.push(t('It’s super effective!', '效果拔群！'));
  if (ev.eff && ev.eff < 1) L.push(t('It’s not very effective…', '效果麻麻…'));
  if (ev.recoil) L.push(t(`${nm(ev.who)} is hurt by the strain (${ev.recoil}).`, `${nm(ev.who)} 用力過度，自己損咗 ${ev.recoil}。`));
  if (ev.heal != null) L.push(t(`${nm(ev.who)} got back ${ev.heal} HP.`, `${nm(ev.who)} 回復咗 ${ev.heal} HP。`));
  if (ev.buff) L.push(ev.buff === 'atk' ? t(`${nm(ev.who)}’s attack rose!`, `${nm(ev.who)} 攻擊提升！`) : ev.buff === 'def' ? t(`${nm(ev.who)}’s defence rose!`, `${nm(ev.who)} 防禦提升！`) : t(`${nm(ev.who)}’s attack and defence rose!`, `${nm(ev.who)} 攻擊同防禦都提升！`));
  if (ev.fail === 'locked') L.push(t('But it’s locked down and can’t boost!', '但係被鎖住，加強唔到！'));
  if (ev.lock) L.push(t(`${nm(other(ev.who))} is locked down!`, `${nm(other(ev.who))} 被鎖住！`));
  if (ev.flinch) L.push(t(`${nm(other(ev.who))} flinched!`, `${nm(other(ev.who))} 嚇親，出唔到招！`));
  if (ev.grit) L.push(t(`${nm(ev.grit)} hung on with Grit!`, `${nm(ev.grit)} 靠毅力撐住咗！`));
  if (ev.ko) L.push(t(`${nm(ev.ko)} is down!`, `${nm(ev.ko)} 倒下！`));
  if (ev.next != null) L.push(t(`Go, ${esc(fighterName(snap.party[ev.next]))}!`, `上啦，${esc(fighterName(snap.party[ev.next]))}！`));
  return L;
}

export async function battleScreen(user, id) {
  closeBattle();
  let bt = await api.getBattle(id);
  if (!bt) { render(`<p class="muted">${t('That battle isn’t here.', '搵唔到呢場對戰。')}</p>`); return; }
  const me = bt.a === user.id ? 'a' : 'b', th = me === 'a' ? 'b' : 'a';
  if (bt.status === 'pending') { location.hash = bt.group_id ? `#/g/${bt.group_id}` : '#/me'; return; }
  const snap = bt.snap;
  const back = bt.kind === 'tower' ? '#/tower' : bt.kind === 'lair' ? '#/lair' : bt.kind === 'test' ? '#/pets' : bt.group_id ? `#/g/${bt.group_id}` : '#/me';
  const el = render(`
    <section class="bt-screen">
      <div class="bt-stage">
        <canvas id="btCv" width="${BW * 2}" height="${BH * 2}" role="img" aria-label="${t('Battle', '對戰')}"></canvas>
        <div class="bt-hud them"><div class="bt-nm"><b>${esc(fighterName(snap[th]))}</b><span>Lv ${snap[th].level}</span></div><div class="bt-hp"><i id="hpThem"></i></div></div>
        <div class="bt-hud me"><div class="bt-nm"><b id="nmMe">${esc(fighterName(snap[me]))}</b><span>Lv ${snap[me].level}</span></div><div class="bt-hp"><i id="hpMe"></i></div><span class="bt-num" id="hpNum"></span>
          ${snap.party ? `<span class="bt-party" id="btParty" aria-label="${t('Your team', '你嘅隊伍')}"></span>` : ''}
          ${bt.kind === 'raid' ? `<span class="bt-left" id="btLeft"></span>` : ''}</div>
      </div>
      <div class="bt-box" id="btMsg" aria-live="polite"></div>
      <div class="bt-moves" id="btMoves"></div>
      <div class="bt-foot" id="btFoot"></div>
    </section>`);
  const cv = el.querySelector('#btCv'), msg = el.querySelector('#btMsg');
  const view = side => {
    const s = snap[side];
    return s.pet ? { monster: s.species, evolved: !!s.evolved } : s.monster != null ? { monster: s.monster, big: !!(s.elite || s.raid || s.boss_pet) } : { avatar: cleanAvatar(s.avatar, s.id) };
  };
  const hp = { ...bt.state.hp }, max = { ...bt.state.max };
  // your team (tower and lair): HP of everyone, and who's out
  let party = (bt.state.party || []).map(x => ({ ...x })), active = bt.state.active || 0;
  const bringIn = to => {
    if (!party.length) return;
    if (party[active]) party[active].hp = Math.max(0, hp.a);
    active = to; snap.a = snap.party[to]; hp.a = party[to].hp; max.a = party[to].max;
    const n = el.querySelector('#nmMe'); if (n) n.textContent = fighterName(snap.a);
  };
  // the group boss: an attack is 8 of your team's moves (switching and the ball don't count)
  let movesUsed = bt.state.moves || 0;
  const leftTxt = () => { const l = el.querySelector('#btLeft'); if (l) { const n = Math.max(0, 8 - movesUsed); l.textContent = t(`${n} move${n === 1 ? '' : 's'} left in this attack`, `今次攻擊仲有 ${n} 招`); l.classList.toggle('low', n <= 2); } };
  const dots = () => { leftTxt(); const d = document.body.contains(cv) && el.querySelector('#btParty'); if (!d) return;
    d.innerHTML = party.map((x, i) => `<i class="${(i === active ? hp.a : x.hp) <= 0 ? 'out' : ''} ${i === active ? 'on' : ''}"></i>`).join(''); };
  let frame = 0, fx = null, busyAnim = false, shownLog = bt.log.length, wasReady = false;
  const fainted = side => hp[side] <= 0;
  const paint = () => drawBattle(cv, { ...view(me), fainted: fainted(me) }, { ...view(th), fainted: fainted(th) }, frame, fx);
  const bars = () => {
    if (!document.body.contains(cv)) return;   // left the page mid-animation
    for (const [side, elId] of [[th, 'hpThem'], [me, 'hpMe']]) {
      const p = Math.max(0, hp[side]) / max[side], bar = el.querySelector(`#${elId}`);
      bar.style.width = `${Math.round(p * 100)}%`; bar.className = p > 0.5 ? '' : p > 0.2 ? 'mid' : 'low';
    }
    el.querySelector('#hpNum').textContent = `${Math.max(0, hp[me])} / ${max[me]}`;
    dots();
  };
  const idle = setInterval(() => { if (!document.body.contains(cv)) { clearInterval(idle); return; } if (!fx && !reduced()) { frame ^= 1; paint(); } }, 600);
  paint(); bars();

  // a ball: thrown, wobbles three times, then caught or broken out
  async function throwBall(ev) {
    const col = { great_ball: '#3c5bd9', ultra_ball: '#e8b923' }[ev.item] || '#e23b3b';
    if (reduced()) { fx = { ball: 1, col, caught: ev.ok }; paint(); await sleep(400); fx = null; return; }
    const run = (ms, f) => new Promise(res => { const t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / ms); fx = f(k); paint(); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
    await run(500, k => ({ ball: k, col }));
    await run(ev.ok ? 1500 : 900, k => ({ ball: 1, col, wobble: k * (ev.ok ? 3 : 2) }));
    if (ev.ok) { fx = { ball: 1, col, caught: true }; paint(); navigator.vibrate?.([30, 60, 30]); await sleep(600); }
    else fx = null;
  }
  async function animate(ev) {
    const attacker = ev.who === me ? 'me' : 'them';
    const hits = ev.dmg?.length ? (ev.who === me ? 'them' : 'me') : null;
    const dur = reduced() ? 0 : 650, t0 = performance.now();
    if (dur) await new Promise(res => { const step = now => { const k = Math.min(1, (now - t0) / dur); fx = { attacker, move: ev.move, t: k, hit: hits, heal: ev.heal != null }; paint(); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
    fx = null;
  }
  async function play(evs) {
    busyAnim = true; drawMoves();
    for (const ev of evs) {
      const lines = eventLines(ev, snap, me);
      if (ev.t === 'move') {
        msg.textContent = lines[0];
        await animate(ev);
        const target = ev.who === 'a' ? 'b' : 'a';
        if (ev.dmg?.length) hp[target] -= ev.dmg.reduce((x, y) => x + y, 0);
        if (ev.recoil) hp[ev.who] -= ev.recoil;
        if (ev.heal != null) hp[ev.who] = Math.min(max[ev.who], hp[ev.who] + ev.heal);
        if (ev.grit) hp[ev.grit] = 1;
        if (ev.ko) hp[ev.ko] = 0;
        if (ev.dmg?.length && ev.who !== me) navigator.vibrate?.(40);
        bars(); paint();
        await sleep(500);
        for (const l of lines.slice(1)) { msg.textContent = l; await sleep(750); }
        if (ev.next != null) { bringIn(ev.next); bars(); paint(); }
      } else if (ev.t === 'catch') {
        msg.textContent = lines[0];
        await throwBall(ev);
        msg.textContent = lines[1]; await sleep(800);
        if (ev.ok) hp.b = Math.max(1, hp.b);
      } else if (ev.t === 'item') {
        hp.a = Math.min(max.a, hp.a + (ev.heal || 0)); fx = { heal: true, attacker: 'me', t: 0.6 }; bars(); paint();
        msg.textContent = lines[0]; await sleep(700); fx = null; paint();
      } else if (ev.t === 'switch') {
        bringIn(ev.to); bars(); paint();
        msg.textContent = lines[0]; await sleep(700);
      } else { msg.textContent = lines[0]; await sleep(600); }
    }
    busyAnim = false;
  }
  async function sync() {
    const fresh = await api.getBattle(id); if (!fresh) return;
    const extra = fresh.log.slice(shownLog);
    shownLog = fresh.log.length; bt = fresh; movesUsed = fresh.state.moves || 0;
    if (extra.length) await play(extra);
    Object.assign(hp, fresh.state.hp); Object.assign(max, fresh.state.max);
    if (fresh.state.party) { party = fresh.state.party.map(x => ({ ...x })); active = fresh.state.active || 0; snap.a = fresh.snap.a; el.querySelector('#nmMe').textContent = fighterName(snap.a); }
    bars(); paint();
    drawMoves(); foot();
  }
  function drawMoves() {
    const box = el.querySelector('#btMoves');
    if (bt.status !== 'active') { box.innerHTML = ''; return; }
    const myTurn = bt.turn === user.id;
    if (!myTurn && !busyAnim) { msg.textContent = t(`Waiting for ${fighterName(snap[th])}…`, `等緊 ${fighterName(snap[th])} 出招…`); }
    else if (myTurn && !busyAnim) msg.textContent = t('What will you do?', '你想點？');
    const used = bt.state.used?.[me] || {};
    box.innerHTML = (snap[me].moves || []).map(m => {
      const cap = usesOf(m), left = cap == null ? null : cap - (used[m.id] || 0);
      const fu = (m.types?.length || 0) > 1;
      return `<button type="button" class="bt-mv ${fu ? 'fusion' : ''}" data-mv="${m.id}" style="--c:${moveCol(m)}" ${!myTurn || busyAnim || left === 0 ? 'disabled' : ''}>
        <b>${fu ? '✦ ' : ''}${esc(moveName(m))}</b><span>${typeLine(m)}${m.power > 0 ? ` · ${t('Power', '威力')} ${m.power}` : ''}${left != null ? ` · ${left}/${cap}` : ''}</span>
        <small class="bt-desc">${esc(shortDesc(m))}</small></button>`;
    }).join('') + (bt.kind === 'tower' || bt.kind === 'lair' || bt.kind === 'raid' ? `<div class="bt-acts">
        ${bt.kind !== 'raid' || !bt.state.threw ? `<button type="button" class="ghost" id="btBag" ${!myTurn || busyAnim ? 'disabled' : ''}>🎒 ${t('Bag', '背包')}</button>` : ''}
        ${party.length > 1 ? `<button type="button" class="ghost" id="btTeam" ${!myTurn || busyAnim ? 'disabled' : ''}>🔁 ${t('Team', '隊伍')}</button>` : ''}</div>` : '');
    box.querySelector('#btBag')?.addEventListener('click', bagSheet);
    box.querySelector('#btTeam')?.addEventListener('click', teamSheet);
    // pop the buttons in when it becomes your turn (not on every redraw)
    const ready = myTurn && !busyAnim;
    if (ready && !wasReady) { box.classList.remove('ready'); void box.offsetWidth; box.classList.add('ready'); }
    if (!ready) box.classList.remove('ready');
    wasReady = ready;
    box.querySelectorAll('[data-mv]').forEach(b => b.onclick = async () => {
      b.classList.add('chosen');
      box.querySelectorAll('button').forEach(x => x.disabled = true);
      await sleep(260);
      try { const evs = await api.battleMove(id, b.dataset.mv); shownLog += evs.length; await play(evs); }
      catch (err) { showError(err); }
      await sync();
    });
  }
  // after an item or switch: play what the server sent back
  async function act(call) {
    box().querySelectorAll('button').forEach(x => x.disabled = true);
    try { const evs = await call(); shownLog += evs.length; await play(evs); } catch (err) { showError(err); }
    await sync();
  }
  const box = () => el.querySelector('#btMoves');
  function sheetOf(html, label) {
    const s = document.createElement('div'); s.className = 'sheet';
    s.innerHTML = `<div class="sheet-in" role="dialog" aria-label="${esc(label)}">${html}<button type="button" class="ghost" data-close>${t('Cancel', '取消')}</button></div>`;
    s.addEventListener('click', e => { if (e.target === s || e.target.closest('[data-close]')) s.remove(); });
    document.body.append(s); return s;
  }
  async function bagSheet() {
    let mine, shop;
    let gfrac = 1;
    try {
      let gb;
      [mine, shop, gb] = await Promise.all([api.myBag(), api.shopItems(), bt.kind === 'raid' && bt.group_id ? api.groupBoss(bt.group_id).catch(() => null) : null]);
      if (gb?.hp) gfrac = Math.max(0, gb.hp - gb.dmg) / gb.hp;
    } catch (err) { showError(err); return; }
    const usedDrinks = bt.state.items || 0, frac = Math.max(0, hp.b) / max.b;
    const raid = bt.kind === 'raid';
    const list = shop.filter(it => it.kind === 'ball' || (!raid && it.kind === 'potion'));
    const row = it => {
      const n = mine.items?.[it.id] || 0;
      const no = !n ? t('None left', '冇喇') : it.kind === 'potion' ? (usedDrinks >= 2 ? t('2 drinks used this fight', '今場用咗 2 件') : hp.a >= max.a ? t('Full HP', '血滿') : '')
        : raid ? (gfrac > 0.25 ? t(`Not yet: your group has to wear it down to 25% first (${Math.round(gfrac * 100)}% left this week).`, `未得：要 group 一齊打到佢剩 25% 先（今個星期仲有 ${Math.round(gfrac * 100)}%）。`)
          : t(`A legend: about ${(1 * it.val).toFixed(1)}–${(3 * it.val).toFixed(1)}% (${Math.round(gfrac * 100)}% left this week). One ball per attack.`, `傳說級：大約 ${(1 * it.val).toFixed(1)}–${(3 * it.val).toFixed(1)}%（今個星期仲有 ${Math.round(gfrac * 100)}%）。每次攻擊只可以掟一個。`))
        : t(`Their HP is ${Math.round(frac * 100)}%: the lower, the better the chance`, `佢仲有 ${Math.round(frac * 100)}% 血：越少越易捉`);
      const blocked = !n || (it.kind === 'potion' && no) || (raid && gfrac > 0.25);
      return `<div class="bag-row"><button type="button" class="bag-it" data-it="${it.id}" ${blocked ? 'disabled' : ''}><span class="sh-ic ${it.kind}" data-b="${it.id}" aria-hidden="true">${itemIcon(it)}</span>
          <b>${esc(t(it.en, it.zh))} ×${n}</b><span class="muted small">${esc(no || t(it.desc_en, it.desc_zh))}</span></button>
        <button type="button" class="ghost bag-buy" data-buy="${it.id}" ${mine.coins < it.price ? 'disabled' : ''} aria-label="${esc(t(`Buy 1 ${it.en} for ${it.price} coins`, `用 ${it.price} 金幣買 1 個${it.zh}`))}">＋💧${it.price}</button></div>`;
    };
    const s = sheetOf(`<div class="bag-head"><h3>🎒 ${t('Bag', '背包')}</h3><span class="muted">💧 <b id="bagCoins">${mine.coins}</b></span></div>
      <div class="bag-list" id="bagList">${list.map(row).join('')}</div>
      <p class="muted small">${t('Using an item uses your turn. Buying here doesn’t.', '用嘢會用咗你呢一回合；喺度買嘢就唔會。')}</p>`, t('Bag', '背包'));
    const wire = () => {
      s.querySelectorAll('[data-it]').forEach(x => x.onclick = () => { s.remove(); act(() => api.battleItem(id, x.dataset.it)); });
      s.querySelectorAll('[data-buy]').forEach(x => x.onclick = async () => {
        x.disabled = true;
        try {
          const r = await api.shopBuy(x.dataset.buy, 1); mine.coins = r.coins; mine.items = { ...mine.items, [x.dataset.buy]: r.qty };
          s.querySelector('#bagCoins').textContent = mine.coins; s.querySelector('#bagList').innerHTML = list.map(row).join(''); wire();
        } catch (err) { x.disabled = false; showError(err); }
      });
    };
    wire();
  }
  function teamSheet() {
    const s = sheetOf(`<h3>🔁 ${t('Switch to…', '換邊個上？')}</h3><div class="bag-list">${party.map((x, i) => {
      const h = i === active ? hp.a : x.hp, f = snap.party[i];
      return `<button type="button" class="bag-it" data-to="${i}" ${i === active || h <= 0 ? 'disabled' : ''}><b>${esc(fighterName(f))}</b>
        <span class="bt-hp mini"><i style="width:${Math.round(Math.max(0, h) / x.max * 100)}%" class="${h / x.max > 0.5 ? '' : h / x.max > 0.2 ? 'mid' : 'low'}"></i></span>
        <span class="muted small">${i === active ? t('Fighting now', '上緊場') : h <= 0 ? t('Out', '倒咗') : `${h} / ${x.max} HP`}</span></button>`; }).join('')}</div>
      <p class="muted small">${t('Switching uses your turn.', '換人會用咗你呢一回合。')}</p>`, t('Team', '隊伍'));
    s.querySelectorAll('[data-to]').forEach(b => b.onclick = () => { s.remove(); act(() => api.battleSwitch(id, +b.dataset.to)); });
  }
  function foot() {
    const f = el.querySelector('#btFoot');
    if (bt.status === 'active') {
      if (bt.kind === 'pvp') {
        const late = bt.turn !== user.id && Date.now() - new Date(bt.last_move_at) > 48 * 3600e3;
        f.innerHTML = `<a class="link" href="${back}">‹ ${t('Back', '返去')}</a>${late ? `<button type="button" class="ghost" id="btClaim">${t('They’ve gone quiet: take the win', '對方 48 小時冇出招：攞勝利')}</button>` : ''}`;
        f.querySelector('#btClaim')?.addEventListener('click', async () => { try { await api.claimTimeout(id); await sync(); } catch (err) { showError(err); } });
      } else {
        f.innerHTML = `<button type="button" class="ghost" id="btFlee">${t('Walk away', '走人')}</button>`;
        const b = f.querySelector('#btFlee');
        b.onclick = async () => {
          if (!b.dataset.sure && bt.kind !== 'test') { b.dataset.sure = '1'; b.textContent = bt.kind === 'raid' ? t('Sure? Your damage so far still counts', '確定？已打嘅傷害照計') : bt.kind === 'lair' ? t('Sure? This try is used', '確定？今次機會會用咗') : t('Sure? The ticket is used', '確定？張券會用咗'); return; }
          try { await api.battleFlee(id); await sync(); } catch (err) { showError(err); }
        };
      }
      return;
    }
    // finished
    const won = bt.winner_side === me;
    let head, body = '', btns = `<a class="button ghost" href="${back}">${t('Back', '返去')}</a>`;
    const caught = bt.state.caught ? (bt.log || []).find(e => e.t === 'catch' && e.ok) : null;
    if (caught) {
      head = t(`Caught ${fighterName(snap.b)}! 🎉`, `捉到 ${fighterName(snap.b)}！🎉`);
      body = t(`IV grade ${ivGrade(caught.iv)}. It’s in your box.`, `IV 評級 ${ivGrade(caught.iv)}。已經放咗入寵物箱。`)
        + (bt.kind === 'tower' ? ' ' + t(`Floor ${bt.floor} counts as cleared.`, `第 ${bt.floor} 層當過咗。`) : '')
        + (bt.kind === 'raid' ? ' ' + t(`A legend! Your attack still counts for ${bt.state.counts ?? 0} damage.`, `傳說級！你今次攻擊照計 ${bt.state.counts ?? 0} 點傷害。`) : '');
      if (bt.kind === 'raid') head = '👑 ' + head;
      btns += `<a class="button" href="#/pets">🐾 ${t('See your pets', '睇寵物')}</a>`;
    } else if (bt.kind === 'lair') {
      head = won ? t('Boss beaten!', '打贏 Boss！') : t('The boss won this time', '今次 Boss 贏');
      body = won ? t('It got away, but you earned +15 💧 +20 XP. Catch it next time: the lower its HP, the better a ball works.', '佢走咗，但你攞到 +15 💧 +20 經驗。下次佢血越少，掟球就越易捉到。') : t('Train, bring a team, try again.', '練勁啲、帶埋隊伍，再嚟。');
      btns += `<a class="button" href="#/lair">👑 ${t('Boss Lair', 'Boss 巢穴')}</a>`;

    } else if (bt.kind === 'test') {
      head = won ? t('Test fight won', '試打贏咗') : t('Test fight over', '試打完');
      body = t('Just a test: no rewards, nothing used.', '純粹試打：冇獎勵，乜都冇用到。');
      btns += snap.a.pet ? `<button type="button" id="btRetest">${t('Again', '再試')}</button>` : '';
    } else if (bt.kind === 'tower' && bt.state.replay) {
      const r = replayReward(bt.floor);
      head = won ? t(`Floor ${bt.floor} again: won! 🎉`, `重打第 ${bt.floor} 層：贏咗！🎉`) : t(`Floor ${bt.floor}: not this time`, `第 ${bt.floor} 層：今次輸咗`);
      body = won ? t(`+${r.xp} XP +${r.coins} 💧`, `+${r.xp} 經驗 +${r.coins} 💧`) : t('Train, get stronger, come back.', '去 gym 練勁啲再嚟。');
      btns += `<button type="button" id="btReplay" data-f="${bt.floor}">${t('Again · 1 🎟️', '再打 · 1 🎟️')}</button>`;
    } else if (bt.kind === 'tower') {
      const r = towerReward(bt.floor);
      head = won ? t(`Floor ${bt.floor} cleared! 🎉`, `第 ${bt.floor} 層過咗！🎉`) : t(`Floor ${bt.floor}: not this time`, `第 ${bt.floor} 層：今次輸咗`);
      if (won && snap.b.boss_floor) btns += `<a class="button ghost" href="#/lair">👑 ${t('Now in the Boss Lair', '已經喺 Boss 巢穴開放')}</a>`;
      body = won ? t(`+${r.xp} XP +${r.coins} 💧`, `+${r.xp} 經驗 +${r.coins} 💧`) : t('Train, get stronger, come back.', '去 gym 練勁啲再嚟。');
      btns += `<button type="button" id="btNext">${won ? t('Next floor · 1 🎟️', '下一層 · 1 🎟️') : t('Try again · 1 🎟️', '再試 · 1 🎟️')}</button>`;
    } else if (bt.kind === 'raid') {
      const used8 = (bt.state.moves || 0) >= 8, out = (bt.state.party || []).every(x => x.hp <= 0) || bt.state.hp?.a <= 0 && !(bt.state.party || []).some(x => x.hp > 0);
      head = bt.state.caught ? head : used8 ? t('8 moves used: attack done!', '用晒 8 招：今次攻擊完成！') : out ? t('Your team is down: attack done!', '成隊倒晒：今次攻擊完成！') : t('Attack done!', '攻擊完成！');
      const tb = bt.state.pets ? t(` (your ${bt.state.pets} pet${bt.state.pets > 1 ? 's' : ''} +${bt.state.pets * 10}%)`, `（${bt.state.pets} 隻寵物 +${bt.state.pets * 10}%）`) : '';
      const rc = bt.state.coins ?? (5 + Math.floor((bt.state.counts ?? 0) / 20));
      body = t(`It counts for ${bt.state.counts ?? 0} damage on the group boss${tb}${bt.state.mult > 1 ? ` (underdog ×${bt.state.mult})` : ''}. +10 XP +${rc} 💧`, `你為 group 打咗魔王 ${bt.state.counts ?? 0} 點傷害${tb}${bt.state.mult > 1 ? `（以弱勝強 ×${bt.state.mult}）` : ''}。+10 經驗 +${rc} 💧`);
    } else {
      head = won ? t('You won! 🏆', '你贏咗！🏆') : t('You lost', '你輸咗');
      body = t('Friendly match: just for fun.', '友誼賽：純粹玩。');
    }
    if (bt.state.pet_xp) body += ' ' + t(`Your pets +${bt.state.pet_xp} XP.`, `你啲寵物 +${bt.state.pet_xp} 經驗。`);
    const ready = bt.state.evo_ready || [];
    if (ready.length) { body += ' ' + ready.map(x => t(`✨ ${x.name || speciesNm(x.species)} reached level ${x.level} and can evolve!`, `✨ ${x.name || speciesNm(x.species)} 升到 ${x.level} 級，可以進化！`)).join(' '); btns += `<a class="button" href="#/pets">✨ ${t('Decide in Pets', '去寵物頁決定')}</a>`; }
    el.querySelector('#btMoves').innerHTML = '';
    msg.textContent = head;
    f.innerHTML = `<div class="bt-result ${won ? 'won' : ''}"><b>${head}</b><span>${body}</span><div class="bt-btns">${btns}</div></div>`;
    f.querySelector('#btReplay')?.addEventListener('click', async e => {
      e.target.disabled = true;
      try { const nid = await api.towerFight(+e.target.dataset.f); location.hash = `#/battle/${nid}`; } catch (err) { e.target.disabled = false; showError(err); }
    });
    f.querySelector('#btRetest')?.addEventListener('click', async e => {
      e.target.disabled = true;
      try { const nid = await api.petTest(snap.a.pet); location.hash = `#/battle/${nid}`; } catch (err) { e.target.disabled = false; showError(err); }
    });
    f.querySelector('#btNext')?.addEventListener('click', async e => {
      e.target.disabled = true;
      try { const nid = await api.towerFight(); location.hash = `#/battle/${nid}`; } catch (err) { e.target.disabled = false; showError(err); }
    });
    if (won && bt.kind === 'tower') { navigator.vibrate?.([30, 60, 30]); }
  }

  // replay what's already happened if you just arrived (e.g. the monster went first)
  if (bt.status === 'active' && bt.log.length && bt.log.length <= 3) {
    const before = { ...bt.state.hp };
    hp.a = max.a; hp.b = max.b; bars(); paint();
    await play(bt.log); Object.assign(hp, before); bars(); paint();
  } else if (bt.status === 'done') { msg.textContent = ''; }
  drawMoves(); foot();

  if (bt.kind === 'pvp' && bt.status === 'active') {
    stopLive = api.battleLive(id, row => { if (row.log?.length > shownLog || row.status !== bt.status) sync(); });
    const poll = setInterval(() => { if (!document.body.contains(cv)) return clearInterval(poll); if (bt.status === 'active' && bt.turn !== user.id && !busyAnim) sync().catch(() => {}); }, 10000);
  }
}

// ---------------- friendly matches (group page) ----------------
export function matchesCardHtml() {
  return `<section class="card matches-card" id="matchesCard" hidden><div class="card-head"><h3>⚔️ ${t('Friendly matches', '友誼賽')}</h3>
    <button type="button" class="small-btn" id="mtNew">${t('Challenge', '約人打')}</button></div><div id="mtBody"></div>
    <p class="muted small mt-note">${t('Just for fun: no XP, no coins. Take turns whenever you’re free.', '純粹玩：冇經驗、冇金幣。得閒先出招就得。')}</p></section>`;
}

export async function mountMatches(el, user, groupId, members) {
  const card = el.querySelector('#matchesCard'); if (!card) return;
  const others = (members || []).filter(m => m.user_id !== user.id);
  if (!others.length) return;
  let rows;
  try { rows = await api.groupMatches(groupId); } catch { return; }
  card.hidden = false;
  const name = uid => esc((members.find(m => m.user_id === uid) || {}).display_name || '?');
  const mine = rows.filter(r => r.a === user.id || r.b === user.id);
  const open = mine.filter(r => r.status === 'pending' || r.status === 'active');
  const recent = mine.filter(r => r.status === 'done').slice(0, 3);
  const body = card.querySelector('#mtBody');
  // nothing going on: just a slim row with the challenge button
  card.classList.toggle('slim', !open.length && !recent.length);
  body.innerHTML = `${open.length || recent.length ? `<ul class="mt-list">
    ${open.map(r => {
      const opp = r.a === user.id ? r.b : r.a;
      if (r.status === 'pending' && r.b === user.id) return `<li><span>${t(`${name(r.a)} challenged you`, `${name(r.a)} 向你挑戰`)}</span><span class="mt-btns"><button type="button" class="small-btn" data-acc="${r.id}">${t('Accept', '接受')}</button><button type="button" class="small-btn ghost" data-dec="${r.id}">${t('No', '唔玩')}</button></span></li>`;
      if (r.status === 'pending') return `<li><span>${t(`Waiting for ${name(opp)}`, `等緊 ${name(opp)} 回覆`)}</span><button type="button" class="small-btn ghost" data-dec="${r.id}">${t('Cancel', '取消')}</button></li>`;
      return `<li><a href="#/battle/${r.id}">${t(`vs ${name(opp)}`, `對 ${name(opp)}`)}</a><span class="${r.turn === user.id ? 'mt-go' : 'muted small'}">${r.turn === user.id ? t('Your move', '輪到你') : t('Their move', '等對手')}</span></li>`;
    }).join('')}
    ${recent.map(r => `<li class="muted"><a href="#/battle/${r.id}">${t(`vs ${name(r.a === user.id ? r.b : r.a)}`, `對 ${name(r.a === user.id ? r.b : r.a)}`)}</a><span class="small">${r.winner === user.id ? t('Won', '贏') : t('Lost', '輸')}</span></li>`).join('')}
  </ul>` : ''}`;
  body.querySelectorAll('[data-acc]').forEach(b => b.onclick = async () => {
    b.disabled = true; try { await api.respondBattle(b.dataset.acc, true); location.hash = `#/battle/${b.dataset.acc}`; } catch (err) { b.disabled = false; showError(err); }
  });
  body.querySelectorAll('[data-dec]').forEach(b => b.onclick = async () => {
    b.disabled = true; try { await api.respondBattle(b.dataset.dec, false); b.closest('li').remove(); } catch (err) { b.disabled = false; showError(err); }
  });
  card.querySelector('#mtNew').onclick = () => {
    const box = document.createElement('div'); box.className = 'sheet'; box.innerHTML = `<div class="sheet-in" role="dialog" aria-label="${t('Challenge', '約人打')}">
      <h3>${t('Who do you want to fight?', '想同邊個打？')}</h3>
      <ul class="list">${others.map(m => `<li><button type="button" class="ghost mt-who" data-who="${m.user_id}">${esc(m.display_name || '?')}</button></li>`).join('')}</ul>
      <button type="button" class="ghost" data-close>${t('Cancel', '取消')}</button></div>`;
    const close = () => box.remove();
    box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) close(); });
    box.querySelectorAll('[data-who]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await api.challenge(b.dataset.who, groupId); close(); toast(t('Challenge sent ⚔️', '已經發出挑戰 ⚔️')); mountMatches(el, user, groupId, members); }
      catch (err) { b.disabled = false; showError(err); }
    });
    document.body.append(box);
  };
}
