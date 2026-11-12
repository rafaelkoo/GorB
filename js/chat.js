// Group chat, WhatsApp style: live messages, day separators, your messages on the right,
// renames shown as a grey line, unread counts. Pushes come from the notify-chat Edge Function;
// the service worker skips them while you're looking at this chat.
import * as api from './supa.js';
import { t, getLang } from './i18n.js';
import { esc, render, showError } from './ui.js';

let stop = null, poll = null, onVis = null;
// leave the chat: stop live updates (called on every route change)
export function closeChat() {
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
    return out + `<div class="msg ${mine ? 'me' : ''} ${grouped ? 'cont' : ''} ${m.pending ? 'pending' : ''} ${m.failed ? 'failed' : ''}" data-id="${esc(m.id)}">
      ${!mine && !grouped ? `<b class="msg-who">${esc(nameOf(m.user_id))}</b>` : ''}
      <p>${esc(m.body)}</p><span class="msg-time">${m.failed ? t('Not sent · tap to retry', '傳送失敗 · 撳一下再試') : m.pending ? t('Sending…', '傳送緊…') : esc(timeOf(m.created_at))}</span></div>`;
  }
  function draw(stick) {
    const near = stick || window.innerHeight + window.scrollY > document.body.scrollHeight - 160;
    const all = [...msgs, ...pending];
    list.innerHTML = all.length ? all.map((m, i) => lineHtml(m, all[i - 1])).join('')
      : `<p class="chat-empty muted">${t('No messages yet. Say something to get them moving.', '仲未有訊息。講句嘢催佢哋郁吓。')}</p>`;
    older.innerHTML = more ? `<button class="ghost small-btn" id="loadOlder">${t('Earlier messages', '之前嘅訊息')}</button>` : '';
    older.querySelector('#loadOlder')?.addEventListener('click', loadOlder);
    list.querySelectorAll('.msg.failed').forEach(b => b.onclick = () => retry(b.dataset.id));
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
  }

  async function sendBody(body, tmpId) {
    try {
      const row = await api.sendChat(user.id, g.id, body);
      pending = pending.filter(p => p.id !== tmpId);
      addRows([row]); draw(true);
    } catch (err) {
      pending = pending.map(p => (p.id === tmpId ? { ...p, failed: true, pending: false } : p)); draw();
    }
  }
  function retry(id) {
    const p = pending.find(x => x.id === id); if (!p) return;
    p.failed = false; p.pending = true; draw(); sendBody(p.body, id);
  }
  const ta = el.querySelector('#text');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
  ta.oninput = grow;
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) { e.preventDefault(); el.querySelector('#send').requestSubmit(); } };
  el.querySelector('#send').onsubmit = e => {
    e.preventDefault();
    const body = ta.value.trim(); if (!body) return;
    const tmp = { id: 'tmp-' + Date.now(), user_id: user.id, kind: 'text', body, created_at: new Date().toISOString(), pending: true };
    pending.push(tmp); ta.value = ''; grow(); ta.focus(); draw(true);
    sendBody(body, tmp.id);
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
  // clear this chat's notifications now that it's open
  navigator.serviceWorker?.ready?.then(r => r.getNotifications({ tag: `chat-${g.id}` })).then(ns => ns?.forEach(n => n.close())).catch(() => {});

  closeChat();
  stop = api.chatLive(g.id, row => {
    addRows([row]);
    if (row.kind === 'rename') { g.name = row.body; const h = el.querySelector('#gname'); if (h) h.textContent = row.body; }
  });
  // a safety net in case live updates drop (phone asleep, network change)
  poll = setInterval(() => { if (document.visibilityState === 'visible') catchUp(); }, 15000);
  swHandler = e => { if (e.data?.type === 'chat' && e.data.chat === g.id) catchUp(); };
  navigator.serviceWorker?.addEventListener?.('message', onSwMessage);
  onVis = () => { if (document.visibilityState === 'visible') { catchUp(); markRead(); } };
  document.addEventListener('visibilitychange', onVis);
}
