// Screens: sign in, groups, group page, check-in camera. Each renders into #app.
import { btnLoading, btnDone, btnReset, pop } from './motion.js';
import * as api from './supa.js';
import { openCamera, stopCamera, grabFrame, encodeCanvas, cameraCount } from './camera.js';
import { storyEditor } from './story.js';
import { pickEmoji } from './emoji.js';
import { gymCardHtml, todayStripHtml, wireTodayStrip, mountGym } from './gym.js';
import { openTodayChest } from './rewards.js';
import { bossCardHtml, mountBoss } from './boss.js';
import { matchesCardHtml, mountMatches } from './battle.js';
import { FEED_PAGE } from './config.js';
import { pushSupported, pushState, enablePush } from './push.js';
import { t, setLang, langSwitchHtml, fmtDateTime, monthName, getLang } from './i18n.js';
import { ICON, tally } from './icons.js';
import { EX, isClimb, vGrade } from './exercises.js';

const $app = () => document.getElementById('app');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function render(html) { $app().innerHTML = html; window.scrollTo(0, 0); return $app(); }
export function busy(btn, on, label) { btn.disabled = on; if (label) btn.textContent = label; }
export function showError(err) {
  const box = document.querySelector('.error') || $app().insertAdjacentElement('afterbegin', document.createElement('p'));
  box.className = 'error'; box.hidden = false; box.setAttribute('role', 'alert');
  box.textContent = err?.message || String(err);
}
// a short message floating above the tabs, wherever you've scrolled to
export function toast(text) {
  document.querySelector('.toast')?.remove();
  const box = document.createElement('p'); box.className = 'toast'; box.setAttribute('role', 'status'); box.textContent = text;
  document.body.appendChild(box);
  setTimeout(() => box.classList.add('out'), 3600); setTimeout(() => box.remove(), 4000);
  setTimeout(() => box.remove(), 6000);
}
export function wireLangSwitch(el, onChange) {
  el.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { setLang(b.dataset.lang); onChange(b.dataset.lang); });
}

// ---------- setup / auth ----------
export function notConfigured() {
  render(`<section class="card"><h2>Almost there</h2>
    <p>Open <code>js/config.js</code> and paste your Supabase URL and anon key. See the README.</p></section>`);
}

export function signIn(onDone) {
  const el = render(`
    <section class="welcome">
      <div class="lang-row">${langSwitchHtml()}</div>
      <h2>${t('Check in. Track it. Don’t be the bitch.', '打卡、記錄、唔好做包尾嗰個。')}</h2>
      <p class="muted">${t('Snap a photo at the gym, your mates get pinged, the month table does the rest.', '去到 gym 影張相，朋友即刻收到通知，月尾排行榜話晒你知。')}</p>
    </section>
    <section class="card">
      <button id="google" class="google" type="button">
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
        ${t('Continue with Google', '用 Google 登入')}</button>
      <p class="or"><span>${t('or use email', '或者用 email')}</span></p>
      <form id="auth">
        <input id="email" type="email" required autocomplete="email" placeholder="you@email.com" aria-label="Email">
        <input id="pw" type="password" required minlength="6" autocomplete="current-password" placeholder="${t('Password (6+ characters)', '密碼（最少 6 個字）')}" aria-label="${t('Password', '密碼')}">
        <button id="login" value="login">${t('Log in', '登入')}</button>
        <button id="register" value="register" class="ghost">${t('New here? Make an account', '第一次用？開個 account')}</button>
      </form>
      <p class="muted small">${t('Forgot your password? Ask the group admin to reset it.', '唔記得密碼？搵 group 管理員幫你重設。')}</p>
    </section>`);
  wireLangSwitch(el, () => signIn(onDone));
  el.querySelector('#google').onclick = async e => {
    busy(e.currentTarget, true);
    try { await api.googleLogIn(); }   // the browser now leaves for Google
    catch (err) { showError(err); busy(e.currentTarget, false); }
  };
  el.querySelector('#auth').onsubmit = async e => {
    e.preventDefault();
    const b = e.submitter, isNew = b.value === 'register', label = b.textContent;
    const email = el.querySelector('#email').value.trim(), pw = el.querySelector('#pw').value;
    busy(b, true, isNew ? t('Making account…', '開緊 account…') : t('Logging in…', '登入緊…'));
    try { await (isNew ? api.register(email, pw) : api.logIn(email, pw)); onDone(); }
    catch (err) {
      const msg = /invalid login/i.test(err.message)
        ? t('Wrong email or password. New? Use "Make an account".', 'Email 或者密碼唔啱。第一次用就撳「開個 account」。')
        : err.message;
      showError({ message: msg }); busy(b, false, label);
    }
  };
}

export function pickName(user, onDone) {
  const el = render(`<section class="card"><h2>${t('What do your mates call you?', '朋友點叫你？')}</h2>
    <form><input id="name" required maxlength="40" placeholder="${t('e.g. Ryan', '例如 Ryan')}" aria-label="${t('Name', '名')}"><button>${t('Save', '儲存')}</button></form></section>`);
  el.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    try { await api.setName(user.id, el.querySelector('#name').value.trim()); onDone(); } catch (err) { showError(err); }
  };
}

// ---------- groups ----------
export async function home(user) {
  const groups = await api.myGroups();
  if (groups.length === 1 && !location.hash.includes('all')) { location.hash = `#/g/${groups[0].id}`; return; }
  const el = render(`
    <header class="page-head"><h2>${t('Your groups', '你嘅 group')}</h2></header>
    <section class="card">
      ${groups.length ? `<ul class="list">${groups.map(g => `<li><a href="#/g/${g.id}">${esc(g.name)}<span aria-hidden="true">›</span></a></li>`).join('')}</ul>`
                      : `<p class="muted">${t('No groups yet. Make one or join with a code.', '仲未有 group。開一個，或者用邀請碼加入。')}</p>`}
    </section>
    <section class="card"><h3>${t('Make a group', '開 group')}</h3>
      <form id="mk"><input id="gname" required maxlength="60" placeholder="${t('Group name', 'Group 名')}" aria-label="${t('Group name', 'Group 名')}"><button>${t('Create', '建立')}</button></form></section>
    <section class="card"><h3>${t('Join a group', '加入 group')}</h3>
      <form id="jn"><input id="gcode" required maxlength="8" placeholder="${t('Invite code', '邀請碼')}" aria-label="${t('Invite code', '邀請碼')}" autocapitalize="characters"><button>${t('Join', '加入')}</button></form></section>`);
  el.querySelector('#mk').onsubmit = async e => {
    e.preventDefault();
    try { const g = await api.createGroup(el.querySelector('#gname').value); location.hash = `#/g/${g.id}`; } catch (err) { showError(err); }
  };
  el.querySelector('#jn').onsubmit = async e => {
    e.preventDefault();
    try { const g = await api.joinGroup(el.querySelector('#gcode').value); window.dispatchEvent(new Event('customchange')); location.hash = `#/g/${g.id}`; } catch (err) { showError(err); }
  };
}

// Month table with a bar per person. Ties at the bottom are all marked (tie rule not decided yet).
// last week (Mon–Sun) in this group: days against each person's target, and new PBs
function weekHtml(rv, user) {
  const ms = rv?.members || [];
  if (ms.length < 2) return '';
  const nm = id => (getLang() === 'zh' ? EX[id]?.zh : EX[id]?.en) || t('an exercise', '一個動作');
  const amt = (id, v) => (isClimb(id) ? vGrade(v) : `${+v} kg`);
  const day = s => new Date(`${s}T12:00:00`).toLocaleDateString(getLang() === 'zh' ? 'zh-HK' : 'en-GB', { day: 'numeric', month: 'short' });
  const top = Math.max(0, ...ms.map(m => m.days));
  const hit = ms.filter(m => m.target && m.days >= m.target).length, withTarget = ms.filter(m => m.target).length;
  return `<details class="week"><summary><b>${t('Last week', '上星期回顧')}</b> <span class="muted small">${esc(day(rv.week_start))} – ${esc(day(rv.week_end))}</span></summary>
    ${withTarget ? `<p class="muted small">${t(`${hit} of ${withTarget} hit their days target`, `${withTarget} 個人入面 ${hit} 個達標`)}</p>` : ''}
    <ol class="week-list">${ms.map(m => {
      const goal = m.target || 0, met = goal && m.days >= goal;
      const dots = Array.from({ length: Math.max(goal, m.days, 1) }, (_, i) => `<i class="${i < m.days ? 'on' : ''} ${i >= goal && goal ? 'extra' : ''}"></i>`).join('');
      return `<li class="${m.user_id === user.id ? 'me' : ''}">
        <div class="wk-row"><a href="#/p/${m.user_id}"><b>${esc(m.name)}</b></a>${m.days === top && top > 0 ? ' 🏆' : ''}${met ? ' 🎯' : ''}${m.days === 0 ? ' 😴' : ''}
          <span class="wk-days"><span class="dots" aria-hidden="true">${dots}</span>${goal ? t(`${m.days}/${goal} days`, `${m.days}/${goal} 日`) : t(`${m.days} day${m.days === 1 ? '' : 's'}`, `${m.days} 日`)}</span></div>
        ${m.prs.length ? `<p class="wk-pb">💪 ${m.prs.slice(0, 3).map(p => `${esc(nm(p.exercise_id))} ${esc(amt(p.exercise_id, p.kg))} <span class="muted">(${isClimb(p.exercise_id) ? t(`was ${vGrade(p.was)}`, `之前 ${vGrade(p.was)}`) : `+${+(p.kg - p.was).toFixed(2)}`})</span>`).join(', ')}${m.prs.length > 3 ? t(` +${m.prs.length - 3} more`, ` 仲有 ${m.prs.length - 3} 個`) : ''}</p>` : ''}
      </li>`;
    }).join('')}</ol></details>`;
}

function boardHtml(board, user) {
  board = [...board].sort((a, b) => b.days - a.days || String(a.display_name).localeCompare(b.display_name));
  const low = board.length > 1 ? Math.min(...board.map(r => r.days)) : null;
  const allTied = low !== null && board.every(r => r.days === low);
  return `<ol class="board">${board.map((r, i) => {
    const bitch = low !== null && !allTied && r.days === low;
    return `<li class="${r.user_id === user.id ? 'me' : ''}${bitch ? ' bitch' : ''}">
      <span class="pos">${i + 1}</span>
      <div class="who"><span class="name"><a href="#/p/${r.user_id}">${esc(r.display_name || '?')}</a>${bitch ? `<em class="tag">${t('Bitch so far', '暫時包尾')}</em>` : ''}</span>
        ${tally(r.days, t(`${r.days} days`, `${r.days} 日`))}</div>
      <b>${r.days}</b></li>`;
  }).join('')}</ol>`;
}

// Instagram-style emoji reactions under a photo
export const REACTIONS = ['🔥', '💪', '👏', '😂', '😮', '❤️'];
function reactsHtml(r, user) {
  const list = r.reactions || [], mine = list.find(x => x.user_id === user.id)?.emoji;
  const groups = [...new Set(list.map(x => x.emoji))].map(e => ({ e, who: list.filter(x => x.emoji === e) }));
  return `${groups.map(g => {
      const names = g.who.map(x => (x.user_id === user.id ? t('You', '你') : x.name)).join(', ');
      return `<button class="react-chip ${g.e === mine ? 'on' : ''}" data-react="${r.id}" data-e="${esc(g.e)}" aria-pressed="${g.e === mine}" title="${esc(names)}" aria-label="${esc(g.e)} ${g.who.length}: ${esc(names)}">${esc(g.e)}<b>${g.who.length}</b></button>`;
    }).join('')}
    <button class="react-add" data-reactadd="${r.id}" aria-expanded="false" aria-label="${t('React with an emoji', '用 emoji 回應')}">${ICON.smile(18)}<span>+</span></button>
    <div class="react-pick" hidden role="group" aria-label="${t('Pick an emoji', '揀個 emoji')}">${(mine && !REACTIONS.includes(mine) ? [mine, ...REACTIONS] : REACTIONS).map(e => `<button data-react="${r.id}" data-e="${e}" class="${e === mine ? 'on' : ''}" aria-pressed="${e === mine}">${e}</button>`).join('')}<button class="react-more" data-reactmore="${r.id}" aria-label="${t('Any other emoji', '其他 emoji')}">+</button></div>
    ${list.length ? `<p class="react-who muted small">${esc(list.slice(-3).reverse().map(x => x.user_id === user.id ? t('You', '你') : x.name).join(', '))}${list.length > 3 ? t(` and ${list.length - 3} more`, ` 同另外 ${list.length - 3} 個人`) : ''}</p>` : ''}`;
}

function postHtml(r, user) {
  const name = esc(r.profiles?.display_name);
  return `<article class="post">
    ${r.gone ? `<div class="photo gone" role="img" aria-label="${t('Photo removed after a week', '相片一星期後已刪除')}">${ICON.camera(22)}<span>${t('Photo removed after a week', '相片一星期後已刪除')}</span></div>`
      : `<button class="photo" data-path="${esc(r.photo_path)}" aria-label="${t('Open photo by', '睇大圖：')} ${name}">
      <img src="${esc(r.thumb)}" alt="${t('Check-in photo by', '打卡相：')} ${name}" loading="lazy"></button>`}
    <div class="post-meta"><b>${name}</b> <span class="muted">${esc(fmtDateTime(r.created_at))}</span>
      ${r.note ? `<p>${esc(r.note)}</p>` : ''}
      <div class="reacts" data-reacts="${r.id}">${reactsHtml(r, user)}</div>
      <div class="post-acts"><button class="ghost reply-btn" data-reply="${r.id}">${ICON.chat(16)} ${t('Reply', '回覆')}</button>
      ${r.user_id === user.id ? `<button class="ghost cap-edit" data-cap="${r.id}">${t('Edit caption', '改 caption')}</button><button class="ghost del" data-id="${r.id}">${t('Delete', '刪除')}</button>` : ''}</div></div>
  </article>`;
}

// reply to a check-in photo: the message goes into the group chat with the photo attached as a quote
export function replySheet(user, groupId, r) {
  const box = document.createElement('div');
  box.className = 'sheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', t('Reply to this photo', '回覆呢張相'));
  const name = esc(r.profiles?.display_name || r.name || '');
  box.innerHTML = `<form class="sheet-in reply-sheet">
    <div class="ex-head"><h3>${t('Reply in the group chat', '喺 group 傾偈度回覆')}</h3><button type="button" class="ghost x" id="rclose" aria-label="${t('Close', '關閉')}">✕</button></div>
    <div class="quote">${r.thumb && !r.gone ? `<img src="${esc(r.thumb)}" alt="">` : `<span class="quote-gone">${ICON.camera(18)}</span>`}
      <span><b>${t(`${name}'s check-in`, `${name} 嘅打卡`)}</b><small class="muted">${esc(fmtDateTime(r.created_at))}</small>${r.note ? `<small>${esc(r.note)}</small>` : ''}</span></div>
    <textarea id="rtext" rows="2" maxlength="1000" required placeholder="${t('Say something about it', '講吓呢張相')}" aria-label="${t('Reply', '回覆')}"></textarea>
    <button type="submit" id="rsend">${t('Send to chat', '傳去傾偈')}</button>
  </form>`;
  const close = () => box.remove();
  box.querySelector('#rclose').onclick = close;
  box.addEventListener('click', e => { if (e.target === box) close(); });
  box.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const body = box.querySelector('#rtext').value.trim(); if (!body) return;
    const b = box.querySelector('#rsend'); btnLoading(b);
    try { await api.sendChat(user.id, groupId, body, r.id); await btnDone(b, t('Sent', '傳咗')); close(); location.hash = `#/c/${groupId}`; }
    catch (err) { showError(err); btnReset(b); }
  };
  document.body.append(box);
  box.querySelector('#rtext').focus();
}

export async function openPhoto(path, onReply) {
  const box = document.createElement('div');
  box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', t('Photo', '相'));
  box.innerHTML = `<p class="muted">${t('Loading photo…', '載入緊…')}</p>`;
  const close = () => box.remove();
  box.onclick = close;
  document.addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc_); } });
  document.body.append(box);
  try {
    const url = await api.fullPhoto(path);
    box.innerHTML = `<img src="${esc(url)}" alt="${t('Check-in photo, full size', '打卡相（原圖）')}">${onReply ? `<button class="lb-reply">${ICON.chat(18)} ${t('Reply', '回覆')}</button>` : ''}`;
    box.querySelector('.lb-reply')?.addEventListener('click', e => { e.stopPropagation(); close(); onReply(); });
  }
  catch (err) { box.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
}

const ASK_KEY = 'gob_ask_push';

export async function group(user, groupId, limit = FEED_PAGE) {
  const groups = await api.myGroups();
  const g = groups.find(x => x.id === groupId);
  if (!g) { location.hash = '#/all'; return; }
  const [board, feed, doneToday, unread, week, gymRows, boss, dogs] = await Promise.all([
    api.leaderboard(groupId), api.groupFeed(groupId, limit + 1), api.checkedInToday(user.id), api.chatUnread().catch(() => ({})),
    api.weekReview(groupId).catch(() => null), api.gymToday(groupId).catch(() => null), api.groupBoss(groupId).catch(() => null),
    api.groupDogs(groupId).catch(() => [])
  ]);
  const nUnread = unread[groupId] || 0;
  const more = feed.length > limit; if (more) feed.pop();
  const mine = board.find(r => r.user_id === user.id);
  const myRank = mine ? 1 + board.filter(r => r.days > mine.days).length : null;
  let asked = false; try { asked = sessionStorage.getItem(ASK_KEY) === '1'; } catch {}
  const inviteLink = `${location.origin}${location.pathname}#/join/${g.invite_code}`;
  const el = render(`
    <header class="page-head">
      <div><h2>${esc(g.name)}</h2><p class="muted">${t(`${board.length} member${board.length === 1 ? '' : 's'}`, `${board.length} 個人`)}</p></div>
      <div class="head-btns"><a class="icon-btn chat-btn" href="#/c/${g.id}" aria-label="${nUnread ? t(`Chat, ${nUnread} unread`, `傾偈，${nUnread} 個未讀`) : t('Chat', '傾偈')}">${ICON.chat(20)}${nUnread ? `<span class="badge">${nUnread > 99 ? '99+' : nUnread}</span>` : ''}</a>
      <a class="icon-btn" href="#/gs/${g.id}" aria-label="${t('Group settings', 'Group 設定')}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path></svg></a></div>
    </header>
    <nav class="grp-switch" aria-label="${t('Your groups', '你嘅 group')}">${groups.length > 1 ? groups.map(x => `<a href="#/g/${x.id}" class="${x.id === g.id ? 'on' : ''}" ${x.id === g.id ? 'aria-current="page"' : ''}>${esc(x.name)}${unread[x.id] && x.id !== g.id ? ' <i class="dot" aria-label="' + t('new messages', '有新訊息') + '"></i>' : ''}</a>`).join('') : ''}<a href="#/all" class="grp-add" aria-label="${t('All groups, join or make one', '全部 group、加入或者開新 group')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>${groups.length > 1 ? '' : `<span>${t('Group', 'Group')}</span>`}</a></nav>
    <section class="hero-card ${doneToday ? 'done' : ''}">
      <div class="hero-top">
        <div class="hero-text">
          <p class="status">${doneToday ? `${ICON.check(16)} ${t('You checked in today', '你今日打咗卡')}` : t('Not checked in today', '今日仲未打卡')}</p>
          <p class="big-num"><span data-count="${mine?.days ?? 0}">${mine?.days ?? 0}</span><small>${t(`day${(mine?.days ?? 0) === 1 ? '' : 's'} in ${monthName()}`, `日 · ${monthName()}`)}${myRank ? t(` · #${myRank}`, ` · 排第 ${myRank}`) : ''}</small></p>
        </div>
        <a class="cta" href="#/checkin/${g.id}">${ICON.camera(22)}<span>${doneToday ? t('Again', '再打卡') : t('I’m at the gym', '我喺 gym')}</span></a>
      </div>
      ${todayStripHtml(gymRows, user)}
    </section>
    ${pushSupported() && asked ? '<section class="card notif ask" id="notif" hidden></section>' : ''}
    ${gymCardHtml()}
    ${bossCardHtml(boss)}
    ${matchesCardHtml()}
    <section class="card"><div class="card-head"><h3>${esc(monthName())} · ${t('days at the gym', '去 gym 日數')}</h3>
      <span class="links"><a class="link" href="#/h/${g.id}">${t('History', '歷史')} ›</a><a class="link" href="#/r/${g.id}">${t('All rankings', '全部排名')} ›</a></span></div>${boardHtml(board, user)}
      <p class="muted small reset-note">${t('Restarts on the 1st of every month', '每個月 1 號重新計')}</p>
      ${weekHtml(week, user)}</section>
    <section class="feed-sec"><div class="card-head"><h3>${t('Latest', '最新')}</h3><span class="muted small">${t('Photos stay for 7 days', '相片保留 7 日')}</span></div>
      ${feed.length ? feed.map(r => postHtml(r, user)).join('') : `<p class="muted">${t('Nobody has checked in yet. Be first.', '仲未有人打卡，做第一個啦。')}</p>`}
      ${more ? `<button id="more" class="ghost">${t('Show more', '睇多啲')}</button>` : ''}
    </section>
`);

  mountGym(el, gymRows, user, groupId, dogs);
  wireTodayStrip(el, groupId);
  mountBoss(el, boss, groupId);
  mountMatches(el, user, groupId, board);
  // right after a check-in, offer notifications once
  if (pushSupported() && asked) {
    pushState().then(st => {
      const card = el.querySelector('#notif'); if (!card || st !== 'off') return;
      card.hidden = false;
      card.innerHTML = `<div class="card-head"><h3>${ICON.bell(18)} ${t('Nice one 💪', '好嘢 💪')}</h3></div>
        <p class="muted">${t('Want a ping when your mates check in too?', '想唔想朋友打卡時都通知你？')}</p>
        <div class="row"><button id="non">${t('Turn on notifications', '開通知')}</button><button id="nlater" class="ghost">${t('Not now', '遲啲先')}</button></div>`;
      const done = () => { try { sessionStorage.removeItem(ASK_KEY); } catch {} card.remove(); };
      card.querySelector('#non').onclick = async e => { busy(e.currentTarget, true); try { await enablePush(user.id); toast(t('Notifications on.', '通知已開。')); done(); } catch (err) { showError(err); busy(e.currentTarget, false); } };
      card.querySelector('#nlater').onclick = done;
    }).catch(() => {});
  }
  const share = async () => {
    const text = t(`Join "${g.name}" on Gym or Bitch: ${inviteLink}`, `嚟 Gym or Bitch 加入「${g.name}」：${inviteLink}`);
    try { if (navigator.share) await navigator.share({ title: 'Gym or Bitch', text }); else { await navigator.clipboard.writeText(text); toast(t('Invite link copied', '已複製邀請 link')); } }
    catch { /* share sheet closed */ }
  };
  el.querySelector('#share')?.addEventListener('click', share);
  el.querySelector('#share2')?.addEventListener('click', share);
  el.querySelector('#leave')?.addEventListener('click', async () => {
    if (!confirm(t(`Leave ${g.name}?`, `確定退出「${g.name}」？`))) return;
    try { await api.leaveGroup(g.id, user.id); location.hash = '#/all'; } catch (err) { showError(err); }
  });
  el.querySelector('#rename')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = el.querySelector('#gnewname').value.trim(), btn = e.currentTarget.querySelector('button');
    if (!name || name === g.name) return;
    busy(btn, true);
    try { await api.renameGroup(g.id, name); await group(user, groupId, limit); toast(t('Group renamed.', 'Group 已改名。')); }
    catch (err) { showError(err); busy(btn, false); }
  });
  el.querySelector('#more')?.addEventListener('click', e => { busy(e.currentTarget, true, t('Loading…', '載入緊…')); group(user, groupId, limit + FEED_PAGE).catch(showError); });
  const byId = Object.fromEntries(feed.map(r => [r.id, r]));
  el.querySelectorAll('[data-reply]').forEach(b => b.onclick = () => replySheet(user, groupId, byId[b.dataset.reply]));
  el.querySelectorAll('button.photo').forEach(b => b.onclick = () => { const r = feed.find(x => x.photo_path === b.dataset.path); openPhoto(b.dataset.path, r ? () => replySheet(user, groupId, r) : null); });
  // reactions: change right away on screen, then save; put it back if saving fails
  const wireReacts = box => {
    const r = byId[box.dataset.reacts];
    box.querySelector('[data-reactadd]').onclick = e => {
      const pick = box.querySelector('.react-pick'), open = pick.hidden;
      el.querySelectorAll('.react-pick').forEach(p => { p.hidden = true; p.previousElementSibling?.setAttribute('aria-expanded', 'false'); });
      pick.hidden = !open; e.currentTarget.setAttribute('aria-expanded', String(open));
      if (open) pick.querySelector('button')?.focus();
    };
    const doReact = async e => {
      const before = r.reactions || [], cur = before.find(x => x.user_id === user.id)?.emoji;
      const rest = before.filter(x => x.user_id !== user.id);
      r.reactions = e === cur ? rest : [...rest, { user_id: user.id, emoji: e, name: '' }];
      box.innerHTML = reactsHtml(r, user); wireReacts(box);
      if (e !== cur) pop(box.querySelector(`.react-chip.on`));
      try { await api.setReaction(user.id, r.id, e, cur); }
      catch (err) { r.reactions = before; box.innerHTML = reactsHtml(r, user); wireReacts(box); showError(err); }
    };
    box.querySelectorAll('[data-react]').forEach(b => b.onclick = () => doReact(b.dataset.e));
    box.querySelector('[data-reactmore]').onclick = async () => {
      const e = await pickEmoji((r.reactions || []).find(x => x.user_id === user.id)?.emoji);
      if (e) doReact(e);
    };
  };
  el.querySelectorAll('[data-reacts]').forEach(wireReacts);
  el.querySelectorAll('.cap-edit').forEach(b => b.onclick = () => {
    const r = feed.find(x => x.id === b.dataset.cap); if (!r) return;
    const box = document.createElement('div'); box.className = 'sheet';
    box.innerHTML = `<form class="sheet-in" role="dialog" aria-label="${t('Edit caption', '改 caption')}">
      <h3>${t('Edit caption', '改 caption')}</h3>
      <input id="capIn" maxlength="140" value="${esc(r.note || '')}" placeholder="${t('Caption (optional)', 'Caption（可以唔填）')}" aria-label="${t('Caption', 'Caption')}">
      <p class="muted small">${groups.length > 1 ? t(`Only changes what ${g.name} sees. Your other groups keep theirs.`, `只會改 ${g.name} 睇到嘅 caption，其他 group 唔受影響。`) : ''}</p>
      <div class="row"><button type="button" class="ghost" data-close>${t('Cancel', '取消')}</button><button>${t('Save', '儲存')}</button></div></form>`;
    const close = () => box.remove();
    box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) close(); });
    box.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      try { await api.setCaption(r.id, groupId, box.querySelector('#capIn').value.trim()); close(); group(user, groupId, limit); } catch (err) { showError(err); }
    };
    document.body.append(box); box.querySelector('#capIn').focus();
  });
  el.querySelectorAll('.del').forEach(b => b.onclick = async () => {
    if (!confirm(t('Delete this check-in and its photo?', '刪除呢次打卡同張相？'))) return;
    try { await api.deleteCheckin(feed.find(r => r.id === b.dataset.id)); group(user, groupId, limit); } catch (err) { showError(err); }
  });
}

export async function joinByLink(code) {
  try { const g = await api.joinGroup(code); window.dispatchEvent(new Event('customchange')); location.hash = `#/g/${g.id}`; }
  catch (err) { location.hash = '#/all'; setTimeout(() => showError(err), 50); }
}

// ---------- check-in ----------
let liveStream = null;
export function releaseCamera() { stopCamera(liveStream); liveStream = null; }

export async function checkin(user, groupId) {
  // Full-screen camera. Controls float over the picture so nothing needs scrolling.
  const el = render(`
    <section class="cam" aria-label="${t('Check in', '打卡')}">
      <video id="v" playsinline muted></video>
      <img id="shot" alt="${t('Your photo', '你張相')}" hidden>
      <div class="cam-top">
        <a class="cam-close" href="#/g/${groupId}" aria-label="${t('Cancel', '取消')}">✕</a>
        <p class="error" role="alert" hidden></p>
      </div>
      <div class="cam-bottom" id="live">
        <span></span>
        <button id="snap" class="shutter" aria-label="${t('Take photo', '影相')}"></button>
        <button id="flip" class="cam-flip" type="button" hidden aria-label="${t('Switch camera', '轉鏡頭')}">${ICON.flip(26)}</button>
      </div>
      <form id="post" class="cam-bottom" hidden>
        <input id="note" maxlength="140" placeholder="${t('Message to your group (optional)', '同 group 講句嘢（可以唔填）')}" enterkeyhint="send" aria-label="${t('Message to your group', '同 group 講句嘢')}">
        <div id="capEach" class="cap-each" hidden></div>
        <button type="button" id="capToggle" class="cap-toggle" hidden>${t('Different caption for each group', '每個 group 寫唔同 caption')}</button>
        <div class="row">
          <button type="button" id="retake" class="ghost">${t('Retake', '重影')}</button>
          <button id="send">${t('Post check-in', '打卡')}</button>
        </div>
      </form>
    </section>`);
  const v = el.querySelector('#v'), shot = el.querySelector('#shot');
  const live = el.querySelector('#live'), post = el.querySelector('#post');
  // in more than one group: the same photo goes to all of them, but each can get its own caption
  let perGroup = false;
  api.myGroups().then(gs => {
    if (gs.length < 2 || gone()) return;
    gs.sort((a, b) => (a.id === groupId ? -1 : b.id === groupId ? 1 : 0));
    const tg = el.querySelector('#capToggle'), each = el.querySelector('#capEach'), main = el.querySelector('#note');
    tg.hidden = false;
    each.innerHTML = gs.map(g => `<label class="cap-row"><span>${esc(g.name)}</span><input data-cap="${g.id}" maxlength="140" placeholder="${t('Caption (optional)', 'Caption（可以唔填）')}"></label>`).join('')
      + '<p class="cap-warn" id="capWarn" hidden></p>';
    // people in more than one of these groups see every caption meant for those groups
    Promise.all(gs.map(g => api.leaderboard(g.id).catch(() => []))).then(lists => {
      const seen = {};
      lists.forEach(l => l.forEach(r => { if (r.user_id !== user.id) (seen[r.user_id] ||= { n: r.display_name, c: 0 }).c++; }));
      const both = Object.values(seen).filter(x => x.c > 1).map(x => x.n);
      const w = each.querySelector('#capWarn');
      if (w && both.length) { w.hidden = false; w.textContent = t(`${both.join(', ')} ${both.length === 1 ? 'is' : 'are'} in more than one of these groups and will see each caption.`, `${both.join('、')} 喺多過一個 group，會見到每句 caption。`); }
    });
    tg.onclick = () => {
      perGroup = !perGroup;
      if (perGroup) each.querySelectorAll('[data-cap]').forEach(i => { if (!i.value) i.value = main.value; });
      else main.value = each.querySelector(`[data-cap="${groupId}"]`)?.value || main.value;
      each.hidden = !perGroup; main.hidden = perGroup;
      tg.textContent = perGroup ? t('Same caption for every group', '所有 group 用同一個 caption') : t('Different caption for each group', '每個 group 寫唔同 caption');
      tg.setAttribute('aria-pressed', perGroup);
    };
  }).catch(() => {});
  let photo = null;
  // the camera can take a while (permission prompt); if you've left the screen by then, switch it off and stop
  const gone = () => !document.body.contains(v);
  // back camera by default; the front (selfie) camera is remembered once you flip to it
  let facing = 'environment'; try { facing = localStorage.getItem('gob_cam') === 'user' ? 'user' : 'environment'; } catch {}
  const start = async () => {
    stopCamera(liveStream); liveStream = null;
    const stream = await openCamera(v, facing);
    if (gone()) { stopCamera(stream); return false; }
    liveStream = stream;
    // which way it really faces (a laptop webcam says user or nothing)
    const real = stream.getVideoTracks()[0]?.getSettings?.().facingMode;
    el.querySelector('.cam').classList.toggle('selfie', (real || facing) === 'user');
    return true;
  };
  try { if (!(await start())) return; }
  catch (err) { if (gone()) return; showError(err.name === 'NotAllowedError' ? { message: t('Camera blocked. Allow camera for this site in Chrome settings.', '相機被封鎖咗。去 Chrome 設定俾呢個網站用相機。') } : err); return; }

  if (gone()) return;
  const flip = el.querySelector('#flip');
  if (await cameraCount() > 1 && !gone()) flip.hidden = false;
  flip.onclick = async () => {
    facing = facing === 'user' ? 'environment' : 'user';
    try { localStorage.setItem('gob_cam', facing); } catch {}
    flip.disabled = true; flip.classList.add('spin');
    try { await start(); } catch (err) { showError(err); }
    flip.disabled = false; setTimeout(() => flip.classList.remove('spin'), 400);
  };
  // after the shot: Instagram-Stories-style text on the photo (story.js); it's drawn into the photo on Post
  let frame = null, story = null;
  const cam = el.querySelector('.cam');
  const editing = on => cam.classList.toggle('editing', on);
  el.querySelector('#snap').onclick = async () => {
    try {
      frame = grabFrame(v, el.querySelector('.cam').classList.contains('selfie'));
      shot.src = frame.toDataURL('image/jpeg', .9);
      shot.hidden = false; v.hidden = true; live.hidden = true; post.hidden = false;
      story = storyEditor(cam, frame, shot, { onEditing: editing });
    } catch (err) { showError(err); }
  };
  el.querySelector('#retake').onclick = () => {
    story?.destroy(); story = null; frame = null;
    shot.hidden = true; v.hidden = false; live.hidden = false; post.hidden = true;
  };
  post.onsubmit = async e => {
    e.preventDefault(); if (!frame) return;
    const b = el.querySelector('#send'); btnLoading(b);
    try {
      const photo = await encodeCanvas(story ? await story.bake() : frame);
      const caps = perGroup ? Object.fromEntries([...el.querySelectorAll('[data-cap]')].map(i => [i.dataset.cap, i.value.trim()])) : {};
      await api.postCheckin(user.id, photo, perGroup ? '' : el.querySelector('#note').value.trim(), caps);
      await btnDone(b, t('Posted', '打咗卡')); story?.destroy(); releaseCamera(); try { sessionStorage.setItem(ASK_KEY, '1'); } catch {} location.hash = `#/g/${groupId}`;
      setTimeout(openTodayChest, 600);
    }
    catch (err) { showError(err); btnReset(b); }
  };
}
