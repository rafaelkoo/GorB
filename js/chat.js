// Group chat, WhatsApp style: live messages, day separators, your messages on the right,
// renames shown as a grey line, unread counts. Swipe a message right (or long-press → Reply) to
// reply to it; long-press to react with an emoji (one per person, like WhatsApp). Pushes come from the notify-chat Edge Function;
// the service worker skips them while you're looking at this chat.
import * as api from './supa.js';
import { t, getLang } from './i18n.js';
import { esc, render, showError, openPhoto } from './ui.js';
import { ICON } from './icons.js';
import { pickEmoji } from './emoji.js';

let stop = null, poll = null, onVis = null;
// leave the chat: stop live updates (called on every route change)
export function closeChat() {
  document.querySelector('.msg-menu-wrap')?.remove();
  if (stop) { stop(); stop = null; }
  clearInterval(poll); poll = null;
  if (onVis) { document.removeEventListener('visibilitychange', onVis); onVis = null; }
  navigator.serviceWorker?.removeEventListener?.('message', onSwMessage);
}
let swHandler = null;
function onSwMessage(e) { swHandler?.(e); }

const loc = () => (getLang() === 'zh' ? 'zh-HK' : 'en-GB');
const ukDay = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(iso));
const timeOf = iso => new Date(iso).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
function dayLabel(iso) {
  const d = ukDay(iso), today = ukDay(new Date().toISOString()), yest = ukDay(new Date(Date.now() - 864e5).toISOString());
  if (d === today) return t('Today', '今日');
  if (d === yest) return t('Yesterday', '尋日');
  return new Date(iso).toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short', year: d.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' });
}

export async function chatScreen(user, groupId) {
  const groups = await api.myGroups();
  const g = groups.find(x => x.id === groupId);
  if (!g) { location.hash = '#/all'; return; }
  try { localStorage.setItem('gob_last_group', JSON.stringify(g.id)); } catch { /* private mode */ }

  const [mem, first] = await Promise.all([api.members(g.id), api.chatPage(g.id)]);
  const ids = mem.map(m => m.user_id);
  const names = Object.fromEntries((await api.profilesOf(ids)).map(p => [p.id, p.display_name]));
  const nameOf = uid => (uid === user.id ? t('You', '你') : names[uid] || t('Someone', '有人'));
  let msgs = first, more = first.length === 50, pending = [];
  const REACTS = ['👍', '❤️', '😂', '😮', '🔥', '💪', '🙏'];
  const rx = {};                 // message id → [{ user_id, emoji }]
  const refs = {};               // older messages that replies point at: id → message, null while loading, false if gone
  let replyTo = null;            // the message the composer is replying to
  const findMsg = id => msgs.find(m => m.id === id) || refs[id] || null;
  const snip = (s, n = 90) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  async function loadRefs() {
    const need = [...new Set(msgs.map(m => m.reply_to).filter(id => id && !msgs.some(m => m.id === id) && !(id in refs)))];
    if (!need.length) return;
    need.forEach(id => { refs[id] = null; });
    try { const rows = await api.chatByIds(need); need.forEach(id => { refs[id] = rows.find(r => r.id === id) || false; }); draw(); }
    catch { need.forEach(id => { delete refs[id]; }); }
  }
  // reactions for the messages on screen (the newest `limit`, or all); redraws only if something changed
  async function loadRx(limit = 0) {
    const ids = msgs.filter(m => m.kind === 'text').map(m => m.id);
    const want = limit ? ids.slice(-limit) : ids;
    try {
      const got = await api.chatReactions(want);
      let changed = false;
      for (const id of want) {
        const a = JSON.stringify(rx[id] || []), b = JSON.stringify(got[id] || []);
        if (a !== b) { changed = true; if (got[id]) rx[id] = got[id]; else delete rx[id]; }
      }
      if (changed) draw();
    } catch { /* shown without reactions */ }
  }
  const replyHtml = m => {
    if (!m.reply_to) return '';
    const o = findMsg(m.reply_to);
    if (o === false) return '';
    if (!o) return `<span class="rq loading"><small>${t('Message…', '訊息…')}</small></span>`;
    return `<button type="button" class="rq ${o.user_id === user.id ? 'mine' : ''}" data-goto="${esc(o.id)}" aria-label="${esc(t(`Replying to ${nameOf(o.user_id)}: ${snip(o.body, 60)}`, `回覆 ${nameOf(o.user_id)}：${snip(o.body, 60)}`))}"><b>${esc(nameOf(o.user_id))}</b><small>${o.checkin_id ? '📷 ' : ''}${esc(snip(o.body))}</small></button>`;
  };
  const rxHtml = m => {
    const l = rx[m.id]; if (!l?.length) return '';
    const es = [...new Set(l.map(x => x.emoji))], mine = l.some(x => x.user_id === user.id);
    const who = l.map(x => `${nameOf(x.user_id)} ${x.emoji}`).join(', ');
    return `<button type="button" class="msg-rx ${mine ? 'mine' : ''}" data-rx="${esc(m.id)}" aria-label="${esc(t(`Reactions: ${who}`, `回應：${who}`))}">${es.slice(0, 3).join('')}${l.length > 1 ? `<b>${l.length}</b>` : ''}</button>`;
  };
  // photos that messages reply to, fetched as needed: id → card (or null while loading)
  const cards = {};
  async function loadCards() {
    const need = [...new Set(msgs.map(m => m.checkin_id).filter(id => id && !(id in cards)))];
    if (!need.length) return;
    need.forEach(id => { cards[id] = null; });
    try { Object.assign(cards, await api.checkinCards(need)); draw(); } catch { /* shown without the photo */ }
  }
  const quoteHtml = m => {
    if (!m.checkin_id) return '';
    const c = cards[m.checkin_id];
    if (c === null || c === undefined) return `<span class="quote loading"><span class="quote-gone">${ICON.camera(16)}</span><small>${t('Photo…', '相…')}</small></span>`;
    const who = c.user_id === user.id ? t('Your check-in', '你嘅打卡') : t(`${c.name || ''}'s check-in`, `${c.name || ''} 嘅打卡`);
    return c.gone
      ? `<span class="quote"><span class="quote-gone">${ICON.camera(16)}</span><span><b>${esc(who)}</b><small>${t('Photo removed after a week', '相片一星期後已刪除')}</small></span></span>`
      : `<button type="button" class="quote" data-photo="${esc(c.photo_path)}" aria-label="${t('Open the photo', '睇張相')}"><img src="${esc(c.thumb)}" alt=""><span><b>${esc(who)}</b><small>${esc(dayLabel(c.created_at))} ${esc(timeOf(c.created_at))}</small></span></button>`;
  };

  const el = render(`
    <header class="chat-head">
      <a class="ghost x" href="#/g/${g.id}" aria-label="${t('Back to the group', '返去 group')}">‹</a>
      <div class="chat-title"><h2 id="gname">${esc(g.name)}</h2><span class="muted small">${t(`${ids.length} people`, `${ids.length} 個人`)}</span></div>
      <button class="ghost" id="rename">${t('Rename', '改名')}</button>
    </header>
    <form id="renameForm" class="row chat-rename" hidden>
      <input id="newName" maxlength="60" required value="${esc(g.name)}" aria-label="${t('Group name', 'Group 名')}">
      <button type="submit">${t('Save', '儲存')}</button>
    </form>
    <section class="chat" aria-live="polite" aria-label="${t('Messages', '訊息')}"><div id="older"></div><div id="list"></div></section>
    <form class="composer" id="send">
      <div class="reply-bar" id="replyBar" hidden></div>
      <textarea id="text" rows="1" maxlength="1000" placeholder="${t('Message', '訊息')}" aria-label="${t('Message', '訊息')}"></textarea>
      <button type="submit" id="sendBtn" aria-label="${t('Send', '傳送')}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></button>
    </form>`);
  const list = el.querySelector('#list'), older = el.querySelector('#older');

  function lineHtml(m, prev) {
    let out = '';
    if (!prev || ukDay(prev.created_at) !== ukDay(m.created_at)) out += `<p class="chat-day"><span>${esc(dayLabel(m.created_at))}</span></p>`;
    if (m.kind === 'rename') {
      return out + `<p class="chat-sys">${esc(t(`${nameOf(m.user_id)} renamed the group to “${m.body}”`, `${nameOf(m.user_id)} 將 group 改名做「${m.body}」`))}</p>`;
    }
    const mine = m.user_id === user.id;
    const grouped = prev && prev.kind === 'text' && prev.user_id === m.user_id && ukDay(prev.created_at) === ukDay(m.created_at)
      && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60 * 1000;
    const real = !m.pending && !m.failed;
    return out + `<div class="msg ${mine ? 'me' : ''} ${grouped ? 'cont' : ''} ${m.pending ? 'pending' : ''} ${m.failed ? 'failed' : ''} ${rx[m.id]?.length ? 'has-rx' : ''}" data-id="${esc(m.id)}"${real ? ` tabindex="0" aria-label="${esc(`${nameOf(m.user_id)}: ${snip(m.body, 120)}`)}" aria-haspopup="menu"` : ''}>
      <span class="swipe-hint" aria-hidden="true">↩</span>
      ${!mine && !grouped ? `<b class="msg-who">${esc(nameOf(m.user_id))}</b>` : ''}
      ${replyHtml(m)}${quoteHtml(m)}<p>${esc(m.body)}</p><span class="msg-time">${m.failed ? t('Not sent · tap to retry', '傳送失敗 · 撳一下再試') : m.pending ? t('Sending…', '傳送緊…') : esc(timeOf(m.created_at))}</span>${rxHtml(m)}</div>`;
  }
  function draw(stick) {
    const near = stick || window.innerHeight + window.scrollY > document.body.scrollHeight - 160;
    const all = [...msgs, ...pending];
    list.innerHTML = all.length ? all.map((m, i) => lineHtml(m, all[i - 1])).join('')
      : `<p class="chat-empty muted">${t('No messages yet. Say something to get them moving.', '仲未有訊息。講句嘢催佢哋郁吓。')}</p>`;
    older.innerHTML = more ? `<button class="ghost small-btn" id="loadOlder">${t('Earlier messages', '之前嘅訊息')}</button>` : '';
    older.querySelector('#loadOlder')?.addEventListener('click', loadOlder);
    list.querySelectorAll('.msg.failed').forEach(b => b.onclick = () => retry(b.dataset.id));
    list.querySelectorAll('[data-photo]').forEach(b => b.onclick = () => openPhoto(b.dataset.photo));
    list.querySelectorAll('[data-goto]').forEach(b => b.onclick = e => { e.stopPropagation(); goTo(b.dataset.goto); });
    list.querySelectorAll('[data-rx]').forEach(b => b.onclick = e => { e.stopPropagation(); const m = findMsg(b.dataset.rx); if (m) openMenu(m, b.closest('.msg')); });
    loadCards(); loadRefs();
    if (near) requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
  }
  // mark everything here as read, then let the tab bar drop its red dot
  function markRead() { api.markChatRead(user.id, g.id).then(() => window.dispatchEvent(new Event('chatread'))).catch(() => {}); }
  async function loadOlder() {
    const h = document.body.scrollHeight;
    try {
      const page = await api.chatPage(g.id, msgs[0]?.created_at);
      more = page.length === 50; msgs = [...page, ...msgs]; draw();
      window.scrollTo(0, document.body.scrollHeight - h + window.scrollY);
      loadRx();
    } catch (err) { showError(err); }
  }
  // add rows from the server (live, poll or our own send), no duplicates, in time order
  function addRows(rows) {
    let changed = false;
    for (const r of rows) if (!msgs.some(m => m.id === r.id)) { msgs.push(r); changed = true; }
    if (!changed) return;
    msgs.sort((a, b) => a.created_at.localeCompare(b.created_at));
    draw();
    if (document.visibilityState === 'visible') markRead();
  }
  async function catchUp() {
    const last = msgs.at(-1)?.created_at;
    try { addRows(last ? await api.chatSince(g.id, last) : await api.chatPage(g.id)); } catch { /* try again next time */ }
    loadRx(100);
  }

  // jump to the message a reply quotes, and flash it
  function goTo(id) {
    const b = list.querySelector(`.msg[data-id="${CSS.escape(id)}"]`);
    if (!b) return;
    b.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
  }

  // ----- reply -----
  const bar = el.querySelector('#replyBar');
  function setReply(m) {
    replyTo = m;
    if (!m) { bar.hidden = true; bar.innerHTML = ''; return; }
    bar.hidden = false;
    bar.innerHTML = `<div class="rq ${m.user_id === user.id ? 'mine' : ''}"><b>${esc(nameOf(m.user_id))}</b><small>${m.checkin_id ? '📷 ' : ''}${esc(snip(m.body))}</small></div>
      <button type="button" class="ghost x" id="noReply" aria-label="${t('Cancel reply', '取消回覆')}">✕</button>`;
    bar.querySelector('#noReply').onclick = () => { setReply(null); ta.focus(); };
    ta.focus();
  }

  // ----- long-press menu: emojis, reply, copy -----
  let menu = null;
  function closeMenu() { if (!menu) return; const back = menu.dataset.back; menu.remove(); menu = null; list.querySelector('.msg.picked')?.classList.remove('picked'); if (back) list.querySelector(`.msg[data-id="${CSS.escape(back)}"]`)?.focus(); }
  function openMenu(m, bubble) {
    if (menu || m.kind !== 'text') return;
    navigator.vibrate?.(15);
    const mine = (rx[m.id] || []).find(x => x.user_id === user.id)?.emoji;
    const who = (rx[m.id] || []);
    bubble?.classList.add('picked');
    menu = document.createElement('div');
    menu.className = 'msg-menu-wrap'; menu.dataset.back = m.id;
    menu.innerHTML = `<div class="msg-menu" role="menu" aria-label="${t('Message options', '訊息選項')}">
        <div class="mm-emoji">${(mine && !REACTS.includes(mine) ? [mine, ...REACTS.slice(0, -1)] : REACTS).map(e => `<button role="menuitem" data-e="${e}" class="${e === mine ? 'on' : ''}" aria-label="${e === mine ? t(`Remove ${e}`, `取消 ${e}`) : t(`React ${e}`, `回應 ${e}`)}">${e}</button>`).join('')}<button role="menuitem" class="mm-more" data-more aria-label="${t('Any other emoji', '其他 emoji')}">+</button></div>
        ${who.length ? `<ul class="mm-who">${who.map(x => `<li><span>${esc(nameOf(x.user_id))}</span><span>${x.emoji}</span></li>`).join('')}</ul>` : ''}
        <div class="mm-acts"><button role="menuitem" data-act="reply">↩ ${t('Reply', '回覆')}</button><button role="menuitem" data-act="copy">${t('Copy', '複製')}</button></div>
      </div>`;
    document.body.appendChild(menu);
    // place it above the bubble (or below if there's no room)
    const box = menu.querySelector('.msg-menu'), r = bubble?.getBoundingClientRect();
    if (r) {
      const h = box.offsetHeight, top = r.top - h - 8 > 70 ? r.top - h - 8 : Math.min(r.bottom + 8, innerHeight - h - 80);
      box.style.top = `${Math.max(70, top)}px`;
      box.style[m.user_id === user.id ? 'right' : 'left'] = `${Math.max(8, m.user_id === user.id ? innerWidth - r.right : r.left)}px`;
    }
    menu.onclick = e => { if (e.target === menu) closeMenu(); };
    menu.onkeydown = e => {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        const bs = [...menu.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
        e.preventDefault(); bs[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus();
      }
    };
    menu.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { closeMenu(); react(m, b.dataset.e); });
    menu.querySelector('[data-more]').onclick = async () => { closeMenu(); const e = await pickEmoji(mine); if (e) react(m, e); };
    menu.querySelector('[data-act="reply"]').onclick = () => { closeMenu(); setReply(m); };
    menu.querySelector('[data-act="copy"]').onclick = async () => { closeMenu(); try { await navigator.clipboard.writeText(m.body); } catch { /* not allowed */ } };
    menu.querySelector(mine ? 'button.on' : '[data-e]').focus({ preventScroll: true });
  }
  async function react(m, e) {
    const before = rx[m.id] || [], cur = before.find(x => x.user_id === user.id)?.emoji;
    const rest = before.filter(x => x.user_id !== user.id);
    rx[m.id] = e === cur ? rest : [...rest, { user_id: user.id, emoji: e }];
    if (!rx[m.id].length) delete rx[m.id];
    draw();
    try { await api.setChatReaction(user.id, m.id, e, cur); }
    catch (err) { if (before.length) rx[m.id] = before; else delete rx[m.id]; draw(); showError(err); }
  }

  // gestures on a message: hold to open the menu, swipe right to reply
  let press = null;
  const pressed = e => {
    const b = e.target.closest('.msg[tabindex]');
    return b && !e.target.closest('.rq, .quote, .msg-rx') ? b : null;
  };
  list.addEventListener('pointerdown', e => {
    const b = pressed(e); if (!b || e.button > 0) return;
    const m = findMsg(b.dataset.id); if (!m) return;
    press = { b, m, x: e.clientX, y: e.clientY, dx: 0, swipe: false, timer: setTimeout(() => { if (press && !press.swipe) { openMenu(m, b); press = null; } }, 450) };
  });
  list.addEventListener('pointermove', e => {
    if (!press) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.swipe && (Math.abs(dy) > 12 || dx < -12)) { clearTimeout(press.timer); press = null; return; }
    if (dx > 12 && Math.abs(dx) > Math.abs(dy)) { press.swipe = true; clearTimeout(press.timer); }
    if (press.swipe) {
      press.dx = Math.min(Math.max(dx, 0), 90);
      press.b.style.transform = `translateX(${press.dx}px)`; press.b.classList.toggle('swiping', press.dx >= 60);
    }
  });
  const endPress = () => {
    if (!press) return;
    clearTimeout(press.timer);
    const { b, m, dx, swipe } = press; press = null;
    if (swipe) {
      b.style.transition = 'transform .18s ease'; b.style.transform = ''; b.classList.remove('swiping');
      setTimeout(() => { b.style.transition = ''; }, 200);
      if (dx >= 60) { navigator.vibrate?.(10); setReply(m); }
    }
  };
  list.addEventListener('pointerup', endPress);
  list.addEventListener('pointercancel', endPress);
  list.addEventListener('contextmenu', e => { const b = pressed(e); if (!b) return; e.preventDefault(); if (press) { clearTimeout(press.timer); press = null; } const m = findMsg(b.dataset.id); if (m) openMenu(m, b); });
  list.addEventListener('keydown', e => {
    const b = e.target.closest?.('.msg[tabindex]'); if (!b || e.target !== b) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ContextMenu') { e.preventDefault(); const m = findMsg(b.dataset.id); if (m) openMenu(m, b); }
  });

  async function sendBody(body, tmpId, reply) {
    try {
      const row = await api.sendChat(user.id, g.id, body, null, reply);
      pending = pending.filter(p => p.id !== tmpId);
      addRows([row]); draw(true);
    } catch (err) {
      pending = pending.map(p => (p.id === tmpId ? { ...p, failed: true, pending: false } : p)); draw();
    }
  }
  function retry(id) {
    const p = pending.find(x => x.id === id); if (!p) return;
    p.failed = false; p.pending = true; draw(); sendBody(p.body, id, p.reply_to);
  }
  const ta = el.querySelector('#text');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
  ta.oninput = grow;
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) { e.preventDefault(); el.querySelector('#send').requestSubmit(); } };
  el.querySelector('#send').onsubmit = e => {
    e.preventDefault();
    const body = ta.value.trim(); if (!body) return;
    const tmp = { id: 'tmp-' + Date.now(), user_id: user.id, kind: 'text', body, created_at: new Date().toISOString(), pending: true, reply_to: replyTo?.id || null };
    pending.push(tmp); ta.value = ''; grow(); setReply(null); ta.focus(); draw(true);
    sendBody(body, tmp.id, tmp.reply_to);
  };

  // rename: anyone in the group; shows up as a grey line for everyone
  const rf = el.querySelector('#renameForm');
  el.querySelector('#rename').onclick = () => { rf.hidden = !rf.hidden; if (!rf.hidden) rf.querySelector('input').select(); };
  rf.onsubmit = async e => {
    e.preventDefault();
    const name = rf.querySelector('input').value.trim(); if (!name || name === g.name) { rf.hidden = true; return; }
    const b = rf.querySelector('button'); b.disabled = true;
    try { const n = await api.renameGroup(g.id, name); g.name = n; el.querySelector('#gname').textContent = n; rf.hidden = true; await catchUp(); }
    catch (err) { showError(err); } finally { b.disabled = false; }
  };

  draw(true);
  markRead();
  loadRx();
  // clear this chat's notifications now that it's open
  navigator.serviceWorker?.ready?.then(r => r.getNotifications({ tag: `chat-${g.id}` })).then(ns => ns?.forEach(n => n.close())).catch(() => {});

  closeChat();
  stop = api.chatLive(g.id, row => {
    addRows([row]);
    if (row.kind === 'rename') { g.name = row.body; const h = el.querySelector('#gname'); if (h) h.textContent = row.body; }
  }, null, p => {
    const r = p.new; if (!r?.message_id || r.user_id === user.id) return;
    rx[r.message_id] = [...(rx[r.message_id] || []).filter(x => x.user_id !== r.user_id), { user_id: r.user_id, emoji: r.emoji }];
    draw();
  });
  // a safety net in case live updates drop (phone asleep, network change)
  poll = setInterval(() => { if (document.visibilityState === 'visible') catchUp(); }, 15000);
  swHandler = e => { if (e.data?.type === 'chat' && e.data.chat === g.id) catchUp(); };
  navigator.serviceWorker?.addEventListener?.('message', onSwMessage);
  onVis = () => { if (document.visibilityState === 'visible') { catchUp(); markRead(); } };
  document.addEventListener('visibilitychange', onVis);
}
