// Battles: your moves (Me page), the Gym Tower, the battle screen, and friendly matches.
// The server (migrations 030–032) works out every hit; this only shows it.
import * as api from './supa.js';
import { t } from './i18n.js';
import { esc, render, toast, showError } from './ui.js';
import { drawBattle, drawBoss, BOSSES, cleanAvatar, BW, BH } from './pixel.js';

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
const usesOf = m => (m.effect === 'heal' ? 2 : /^buff/.test(m.effect || '') ? 3 : null);
const monsterName = s => {
  const b = BOSSES[(s.monster ?? 0) % BOSSES.length], n = t(b.en, b.zh);
  return s.raid ? t(`Boss: ${n}`, `魔王：${n}`) : s.elite ? t(`Elite ${n}`, `精英${n}`) : n;
};
const fighterName = s => (s.monster != null ? monsterName(s) : s.name || '?');
export const towerReward = n => ({ xp: 20 + 4 * n + (n % 5 === 0 ? 30 : 0), coins: 5 + n + (n % 5 === 0 ? 15 : 0) });

// ---------------- what a move needs (for the locked ones) ----------------
function needText(m, basis) {
  const b = basis || {};
  switch (m.req_kind) {
    case 'lift': { const [en, zh] = CAT[m.req_cat] || [m.req_cat, m.req_cat]; const now = b.lifts?.[m.req_cat] || 0;
      return [t(`Best ${en} lift ${m.req_val} kg (you: ${now} kg)`, `${zh}最好做到 ${m.req_val} kg（你而家 ${now} kg）`), now / m.req_val]; }
    case 'maxlift': return [t(`Any lift ${m.req_val} kg (you: ${b.max || 0} kg)`, `任何動作做到 ${m.req_val} kg（你而家 ${b.max || 0} kg）`), (b.max || 0) / m.req_val];
    case 'sets': return [t(`${m.req_val} sets in 60 days (you: ${b.sets || 0})`, `60 日內做 ${m.req_val} 組（你而家 ${b.sets || 0} 組）`), (b.sets || 0) / m.req_val];
    case 'cardio': return [t(`${m.req_val} min cardio in 60 days (you: ${b.cardio || 0})`, `60 日內 cardio ${m.req_val} 分鐘（你而家 ${b.cardio || 0}）`), (b.cardio || 0) / m.req_val];
    case 'climb': return [t(`Top a V${m.req_val} (you: ${b.grade >= 0 ? `V${b.grade}` : 'none yet'})`, `爬到 V${m.req_val}（你而家 ${b.grade >= 0 ? `V${b.grade}` : '未有'}）`), b.grade >= 0 ? (b.grade + 1) / (m.req_val + 1) : 0];
    default: return ['', 1];
  }
}
const moveTag = m => {
  const ty = MOVE_TYPES[m.type] || MOVE_TYPES.normal;
  const pw = m.power > 0 ? `${t('Power', '威力')} ${m.power}` : '';
  return `<span class="mv-type" style="--c:${ty.col}">${t(ty.en, ty.zh)}</span>${pw ? `<span class="muted small">${pw}</span>` : ''}`;
};

// ---------------- Me page: moves card ----------------
export function movesCardHtml() {
  return `<section class="card moves-card" id="movesCard"><div class="card-head"><h3>${t('Moves', '招式')}</h3>
    <a class="link" href="#/tower">🗼 ${t('Gym Tower', 'Gym 塔')} ›</a></div><div id="mvBody"><p class="muted small">${t('Loading…', '載入緊…')}</p></div></section>`;
}

export async function mountMoves(el, user) {
  const card = el.querySelector('#movesCard'); if (!card) return;
  let all, mine;
  try { [all, mine] = await Promise.all([api.allMoves(), api.characterMoves(user.id)]); } catch { card.hidden = true; return; }
  if (!mine || !all?.length) { card.hidden = true; return; }
  const draw = () => {
    const learned = new Set(mine.learned || []), eq = mine.equipped || [];
    const byId = Object.fromEntries(all.map(m => [m.id, m]));
    const locked = all.filter(m => !learned.has(m.id)).map(m => ({ m, need: needText(m, mine.basis) })).sort((a, b) => b.need[1] - a.need[1]);
    card.querySelector('#mvBody').innerHTML = `
      <p class="muted small">${t('Moves come from your real training (last 60 days). Lift heavier, do more cardio or climb harder to learn new ones. Stop going and you forget them.',
        '招式嚟自你真實嘅訓練（最近 60 日）。舉重啲、多啲 cardio、爬難啲，就學到新招。唔去就會唔記得。')}</p>
      <h4 class="q-h">${t('Equipped (tap another move below to swap it in)', '帶住出戰（撳下面其他招式就會換入去）')}</h4>
      <div class="mv-slots">${[0, 1, 2, 3].map(i => { const m = byId[eq[i]];
        return m ? `<div class="mv-slot" style="--c:${(MOVE_TYPES[m.type] || MOVE_TYPES.normal).col}"><b>${esc(moveName(m))}</b>${moveTag(m)}</div>` : `<div class="mv-slot empty">—</div>`; }).join('')}</div>
      ${mine.grit ? `<p class="small grit">💪 <b>${t('Grit', '毅力')}</b> · ${t('12+ gym days in 60: once per fight you survive a knockout on 1 HP.', '60 日內去咗 12 日以上：每場可以撐住一次唔被打低（剩 1 HP）。')}</p>`
        : `<p class="muted small">💪 ${t(`Grit: go 12 days in 60 (you: ${mine.basis?.days || 0}) to survive one knockout per fight.`, `毅力：60 日內去夠 12 日（你而家 ${mine.basis?.days || 0} 日），每場可以撐住一次唔被打低。`)}</p>`}
      <h4 class="q-h">${t(`Learned (${learned.size})`, `學咗（${learned.size}）`)}</h4>
      <ul class="mv-list">${all.filter(m => learned.has(m.id)).map(m => `<li><button type="button" class="mv-pick ${eq.includes(m.id) ? 'on' : ''}" data-mv="${m.id}" aria-pressed="${eq.includes(m.id)}">
        <span class="mv-top"><b>${esc(moveName(m))}</b>${moveTag(m)}</span><span class="muted small">${esc(t(m.desc_en, m.desc_zh))}</span></button></li>`).join('')}</ul>
      ${locked.length ? `<h4 class="q-h">${t('Still to learn', '未學到')}</h4>
      <ul class="mv-list">${locked.map(({ m, need }) => `<li class="mv-locked"><span class="mv-top"><b>🔒 ${esc(moveName(m))}</b>${moveTag(m)}</span>
        <span class="small">${esc(need[0])}</span><span class="q-bar" aria-hidden="true"><i style="width:${Math.round(Math.min(1, need[1]) * 100)}%"></i></span></li>`).join('')}</ul>` : ''}`;
    card.querySelectorAll('[data-mv]').forEach(b => b.onclick = async () => {
      const id = b.dataset.mv; let next = [...eq];
      if (next.includes(id)) return;   // you always carry 4 (the server tops up with your strongest)
      if (next.length >= 4) next.shift();
      next.push(id);
      b.disabled = true;
      try { mine = await api.setMoves(next); draw(); } catch (err) { b.disabled = false; showError(err); }
    });
  };
  draw();
}

// ---------------- Gym Tower ----------------
export async function towerScreen() {
  const el = render(`<header class="page-head"><div><h2>🗼 ${t('Gym Tower', 'Gym 塔')}</h2></div><a class="link" href="#/me">‹ ${t('Me', '我')}</a></header>
    <div id="twBody"><p class="muted">${t('Loading…', '載入緊…')}</p></div>`);
  let tw;
  try { tw = await api.myTower(); } catch (err) { showError(err); return; }
  const n = tw.next, rw = towerReward(n), mi = tw.monster, mb = BOSSES[mi % BOSSES.length];
  const floors = [];
  for (let f = n + 2; f >= Math.max(1, n - 3); f--) floors.push(f);
  el.querySelector('#twBody').innerHTML = `
    <section class="card tw-card">
      <div class="tw-tickets"><b>🎟️ ${tw.tickets}</b><span class="muted small">/ 9 · ${t('Your first check-in each day gives 3', '每日第一次打卡有 3 張')}</span></div>
      <ol class="tw-floors">${floors.map(f => f > n ? `<li class="tw-f up"><span>${t(`Floor ${f}`, `第 ${f} 層`)}</span><span class="muted">？</span></li>`
        : f === n ? `<li class="tw-f next ${tw.elite ? 'elite' : ''}"><canvas id="twMon" width="96" height="80" role="img" aria-label="${esc(t(mb.en, mb.zh))}"></canvas>
            <div><b>${t(`Floor ${f}`, `第 ${f} 層`)}${tw.elite ? ` · ${t('Elite', '精英')}` : ''}</b><span>${esc(t(mb.en, mb.zh))}</span>
            <span class="muted small">${t(`First clear: +${rw.xp} XP +${rw.coins} 💧`, `第一次過：+${rw.xp} 經驗 +${rw.coins} 💧`)}</span></div></li>`
        : `<li class="tw-f done"><span>${t(`Floor ${f}`, `第 ${f} 層`)}</span><span>✓</span></li>`).join('')}</ol>
      <button type="button" id="twGo" ${!tw.open && tw.tickets < 1 ? 'disabled' : ''}>${tw.open ? t('Back to your fight', '返去繼續打') : t(`Fight floor ${n} · 1 🎟️`, `挑戰第 ${n} 層 · 1 🎟️`)}</button>
      ${!tw.open && tw.tickets < 1 ? `<p class="muted small">${t('No tickets left. Check in at the gym to get 3 more.', '冇券喇。去 gym 打卡就有多 3 張。')}</p>` : ''}
    </section>
    ${tw.best?.length ? `<section class="card"><div class="card-head"><h3>${t('Highest floors', '最高層數')}</h3></div>
      <ol class="tw-best">${tw.best.slice(0, 10).map(b => `<li><span>${esc(b.name)}</span><b>${b.floor}</b></li>`).join('')}</ol></section>` : ''}
    <details class="card cc-how"><summary>${t('How it works', '點樣玩')}</summary><ul>
      <li>${t('Each floor has a bad-habit monster. Every 5th floor is a tougher elite.', '每層有一隻壞習慣怪物，每 5 層有隻精英，特別難打。')}</li>
      <li>${t('Your stats and moves come from your real training, so the way up is going to the gym.', '你嘅能力同招式嚟自真實訓練，想爬高就要去 gym。')}</li>
      <li>${t('A fight costs 1 ticket. Win or lose, it’s used.', '每場用 1 張券，贏定輸都會用咗。')}</li>
      <li>${t('Strength beats Climbing, Climbing beats Endurance, Endurance beats Strength.', '力量剋攀石，攀石剋耐力，耐力剋力量。')}</li></ul></details>`;
  const cv = el.querySelector('#twMon');
  if (cv) { let f = 0; drawBoss(cv, mi, 0); const tick = setInterval(() => { if (!document.body.contains(cv)) return clearInterval(tick); if (!reduced()) { f ^= 1; drawBoss(cv, mi, f); } }, 600); }
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
  return L;
}

export async function battleScreen(user, id) {
  closeBattle();
  let bt = await api.getBattle(id);
  if (!bt) { render(`<p class="muted">${t('That battle isn’t here.', '搵唔到呢場對戰。')}</p>`); return; }
  const me = bt.a === user.id ? 'a' : 'b', th = me === 'a' ? 'b' : 'a';
  if (bt.status === 'pending') { location.hash = bt.group_id ? `#/g/${bt.group_id}` : '#/me'; return; }
  const snap = bt.snap;
  const back = bt.kind === 'tower' ? '#/tower' : bt.group_id ? `#/g/${bt.group_id}` : '#/me';
  const el = render(`
    <section class="bt-screen">
      <div class="bt-stage">
        <canvas id="btCv" width="${BW * 2}" height="${BH * 2}" role="img" aria-label="${t('Battle', '對戰')}"></canvas>
        <div class="bt-hud them"><div class="bt-nm"><b>${esc(fighterName(snap[th]))}</b><span>Lv ${snap[th].level}</span></div><div class="bt-hp"><i id="hpThem"></i></div></div>
        <div class="bt-hud me"><div class="bt-nm"><b>${esc(fighterName(snap[me]))}</b><span>Lv ${snap[me].level}</span></div><div class="bt-hp"><i id="hpMe"></i></div><span class="bt-num" id="hpNum"></span></div>
      </div>
      <div class="bt-box" id="btMsg" aria-live="polite"></div>
      <div class="bt-moves" id="btMoves"></div>
      <div class="bt-foot" id="btFoot"></div>
    </section>`);
  const cv = el.querySelector('#btCv'), msg = el.querySelector('#btMsg');
  const view = side => {
    const s = snap[side];
    return s.monster != null ? { monster: s.monster, big: !!(s.elite || s.raid) } : { avatar: cleanAvatar(s.avatar, s.id) };
  };
  const hp = { ...bt.state.hp }, max = bt.state.max;
  let frame = 0, fx = null, busyAnim = false, shownLog = bt.log.length;
  const fainted = side => hp[side] <= 0;
  const paint = () => drawBattle(cv, { ...view(me), fainted: fainted(me) }, { ...view(th), fainted: fainted(th) }, frame, fx);
  const bars = () => {
    for (const [side, elId] of [[th, 'hpThem'], [me, 'hpMe']]) {
      const p = Math.max(0, hp[side]) / max[side], bar = el.querySelector(`#${elId}`);
      bar.style.width = `${Math.round(p * 100)}%`; bar.className = p > 0.5 ? '' : p > 0.2 ? 'mid' : 'low';
    }
    el.querySelector('#hpNum').textContent = `${Math.max(0, hp[me])} / ${max[me]}`;
  };
  const idle = setInterval(() => { if (!document.body.contains(cv)) { clearInterval(idle); return; } if (!fx && !reduced()) { frame ^= 1; paint(); } }, 600);
  paint(); bars();

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
      } else { msg.textContent = lines[0]; await sleep(600); }
    }
    busyAnim = false;
  }
  async function sync() {
    const fresh = await api.getBattle(id); if (!fresh) return;
    const extra = fresh.log.slice(shownLog);
    shownLog = fresh.log.length; bt = fresh;
    if (extra.length) await play(extra);
    Object.assign(hp, fresh.state.hp); bars(); paint();
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
      const ty = MOVE_TYPES[m.type] || MOVE_TYPES.normal;
      return `<button type="button" class="bt-mv" data-mv="${m.id}" style="--c:${ty.col}" ${!myTurn || busyAnim || left === 0 ? 'disabled' : ''}>
        <b>${esc(moveName(m))}</b><span>${t(ty.en, ty.zh)}${m.power > 0 ? ` · ${m.power}` : ''}${left != null ? ` · ${left}/${cap}` : ''}</span></button>`;
    }).join('');
    box.querySelectorAll('[data-mv]').forEach(b => b.onclick = async () => {
      box.querySelectorAll('button').forEach(x => x.disabled = true);
      try { const evs = await api.battleMove(id, b.dataset.mv); shownLog += evs.length; await play(evs); }
      catch (err) { showError(err); }
      await sync();
    });
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
          if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = bt.kind === 'raid' ? t('Sure? Your damage so far still counts', '確定？已打嘅傷害照計') : t('Sure? The ticket is used', '確定？張券會用咗'); return; }
          try { await api.battleFlee(id); await sync(); } catch (err) { showError(err); }
        };
      }
      return;
    }
    // finished
    const won = bt.winner_side === me;
    let head, body = '', btns = `<a class="button ghost" href="${back}">${t('Back', '返去')}</a>`;
    if (bt.kind === 'tower') {
      const r = towerReward(bt.floor);
      head = won ? t(`Floor ${bt.floor} cleared! 🎉`, `第 ${bt.floor} 層過咗！🎉`) : t(`Floor ${bt.floor}: not this time`, `第 ${bt.floor} 層：今次輸咗`);
      body = won ? t(`+${r.xp} XP +${r.coins} 💧`, `+${r.xp} 經驗 +${r.coins} 💧`) : t('Train, get stronger, come back.', '去 gym 練勁啲再嚟。');
      btns += `<button type="button" id="btNext">${won ? t('Next floor · 1 🎟️', '下一層 · 1 🎟️') : t('Try again · 1 🎟️', '再試 · 1 🎟️')}</button>`;
    } else if (bt.kind === 'raid') {
      head = t('Attack done!', '攻擊完成！');
      body = t(`It counts for ${bt.state.counts ?? 0} damage on the group boss${bt.state.mult > 1 ? ` (underdog ×${bt.state.mult})` : ''}. +10 XP`, `你為 group 打咗魔王 ${bt.state.counts ?? 0} 點傷害${bt.state.mult > 1 ? `（以弱勝強 ×${bt.state.mult}）` : ''}。+10 經驗`);
    } else {
      head = won ? t('You won! 🏆', '你贏咗！🏆') : t('You lost', '你輸咗');
      body = t('Friendly match: just for fun.', '友誼賽：純粹玩。');
    }
    el.querySelector('#btMoves').innerHTML = '';
    msg.textContent = head;
    f.innerHTML = `<div class="bt-result ${won ? 'won' : ''}"><b>${head}</b><span>${body}</span><div class="bt-btns">${btns}</div></div>`;
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
    <p class="muted small">${t('Just for fun: no XP, no coins. Take turns whenever you’re free.', '純粹玩：冇經驗、冇金幣。得閒先出招就得。')}</p></section>`;
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
