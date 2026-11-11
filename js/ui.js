// Screens. Each one renders into #app and wires its own buttons.
import * as api from './supa.js';
import { openCamera, stopCamera, snap } from './camera.js';
import { FEED_PAGE } from './config.js';
import { pbBoardHtml } from './tracker.js';
import { pushSupported, pushState, enablePush, disablePush, testNotification } from './push.js';

const $app = () => document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = iso => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const monthName = () => new Date().toLocaleString('en-GB', { month: 'long' });

function render(html) { $app().innerHTML = html; return $app(); }
function busy(btn, on, label) { btn.disabled = on; if (label) btn.textContent = label; }
export function showError(err) {
  const box = document.querySelector('.error') || $app().insertAdjacentElement('afterbegin', document.createElement('p'));
  box.className = 'error'; box.hidden = false; box.textContent = err?.message || String(err);
}

// ---------- setup / auth ----------
export function notConfigured() {
  render(`<section class="card"><h2>Almost there</h2>
    <p>Open <code>js/config.js</code> and paste your Supabase URL and anon key. See the README.</p></section>`);
}

export function signIn(onDone) {
  const el = render(`<section class="card"><h2>Sign in</h2>
    <button id="google" class="google" type="button">
      <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
      Continue with Google</button>
    <p class="or"><span>or use email</span></p>
    <form id="auth">
      <input id="email" type="email" required autocomplete="email" placeholder="you@email.com">
      <input id="pw" type="password" required minlength="6" autocomplete="current-password" placeholder="Password (6+ characters)">
      <button id="login" value="login">Log in</button>
      <button id="register" value="register" class="ghost">New here? Make an account</button>
    </form>
    <p class="muted">Forgot your password? Ask the group admin to reset it.</p></section>`);
  el.querySelector('#google').onclick = async e => {
    busy(e.currentTarget, true);
    try { await api.googleLogIn(); }   // the browser now leaves for Google
    catch (err) { showError(err); busy(e.currentTarget, false); }
  };
  el.querySelector('#auth').onsubmit = async e => {
    e.preventDefault();
    const b = e.submitter, isNew = b.value === 'register', label = b.textContent;
    const email = el.querySelector('#email').value.trim(), pw = el.querySelector('#pw').value;
    busy(b, true, isNew ? 'Making account…' : 'Logging in…');
    try { await (isNew ? api.register(email, pw) : api.logIn(email, pw)); onDone(); }
    catch (err) {
      const msg = /invalid login/i.test(err.message) ? 'Wrong email or password. New? Use "Make an account".' : err.message;
      showError({ message: msg }); busy(b, false, label);
    }
  };
}

export function pickName(user, onDone) {
  const el = render(`<section class="card"><h2>What do your mates call you?</h2>
    <form><input id="name" required maxlength="40" placeholder="e.g. Ryan"><button>Save</button></form></section>`);
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
    <section class="card"><h2>Your groups</h2>
      ${groups.length ? `<ul class="list">${groups.map(g => `<li><a href="#/g/${g.id}">${esc(g.name)}</a></li>`).join('')}</ul>`
                      : '<p class="muted">No groups yet. Make one or join with a code.</p>'}
    </section>
    <section class="card"><h3>Make a group</h3>
      <form id="mk"><input id="gname" required maxlength="60" placeholder="Group name"><button>Create</button></form></section>
    <section class="card"><h3>Join a group</h3>
      <form id="jn"><input id="gcode" required maxlength="8" placeholder="Invite code" autocapitalize="characters"><button>Join</button></form></section>`);
  el.querySelector('#mk').onsubmit = async e => {
    e.preventDefault();
    try { const g = await api.createGroup(el.querySelector('#gname').value); location.hash = `#/g/${g.id}`; } catch (err) { showError(err); }
  };
  el.querySelector('#jn').onsubmit = async e => {
    e.preventDefault();
    try { const g = await api.joinGroup(el.querySelector('#gcode').value); location.hash = `#/g/${g.id}`; } catch (err) { showError(err); }
  };
}

// Bottom of the month table. Ties at the bottom are all marked (tie rule not decided yet).
function boardHtml(board, user) {
  const low = board.length > 1 ? Math.min(...board.map(r => r.days)) : null;
  const allTied = low !== null && board.every(r => r.days === low);
  return `<ol class="board">${board.map(r => {
    const bitch = low !== null && !allTied && r.days === low;
    return `<li class="${r.user_id === user.id ? 'me' : ''}${bitch ? ' bitch' : ''}">
      <span><a href="#/p/${r.user_id}">${esc(r.display_name || '?')}</a>${bitch ? ' <em class="tag">Bitch so far</em>' : ''}</span><b>${r.days}</b></li>`;
  }).join('')}</ol>`;
}

function postHtml(r, user) {
  return `<article class="post">
    <button class="photo" data-path="${esc(r.photo_path)}" aria-label="Open photo by ${esc(r.profiles?.display_name)}">
      <img src="${esc(r.thumb)}" alt="Check-in photo by ${esc(r.profiles?.display_name)}" loading="lazy"></button>
    <div><b>${esc(r.profiles?.display_name)}</b> <span class="muted">${esc(when(r.created_at))}</span>
      ${r.note ? `<p>${esc(r.note)}</p>` : ''}
      ${r.user_id === user.id ? `<button class="ghost del" data-id="${r.id}">Delete</button>` : ''}</div>
  </article>`;
}

async function openPhoto(path) {
  const box = document.createElement('div');
  box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Photo');
  box.innerHTML = '<p class="muted">Loading photo…</p>';
  const close = () => box.remove();
  box.onclick = close;
  document.addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc_); } });
  document.body.append(box);
  try { const url = await api.fullPhoto(path); box.innerHTML = `<img src="${esc(url)}" alt="Check-in photo, full size">`; }
  catch (err) { box.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
}

export async function group(user, groupId, limit = FEED_PAGE) {
  const groups = await api.myGroups();
  const g = groups.find(x => x.id === groupId);
  if (!g) { location.hash = '#/all'; return; }
  const [board, feed, pbs] = await Promise.all([api.leaderboard(groupId), api.groupFeed(groupId, limit + 1), pbBoardHtml(groupId, user.id)]);
  const more = feed.length > limit; if (more) feed.pop();
  const inviteLink = `${location.origin}${location.pathname}#/join/${g.invite_code}`;
  const el = render(`
    <nav class="crumbs"><a href="#/all">All groups</a></nav>
    <section class="hero">
      <h2>${esc(g.name)}</h2>
      <a class="big" href="#/checkin/${g.id}">📸 I'm at the gym</a>
    </section>
    ${pushSupported() ? `<section class="card notif" id="notif">
      <h3>Notifications</h3><p id="nstate" class="muted">Checking…</p>
      <div class="row"><button id="non" hidden>Turn on</button><button id="ntest" class="ghost" hidden>Send test</button><button id="noff" class="ghost" hidden>Turn off</button></div>
    </section>` : ''}
    <section class="card"><h3>${esc(monthName())} — days at the gym</h3>${boardHtml(board, user)}</section>
    <section class="card"><h3>Personal bests</h3>${pbs}</section>
    <section class="card"><h3>Latest</h3>
      ${feed.length ? feed.map(r => postHtml(r, user)).join('') : '<p class="muted">Nobody has checked in yet. Be first.</p>'}
      ${more ? '<button id="more" class="ghost">Show more</button>' : ''}
    </section>
    <section class="card"><h3>Invite mates</h3>
      <p>Code: <b class="code">${esc(g.invite_code)}</b></p>
      <button id="share">Share invite link</button>
      <button id="leave" class="ghost">Leave group</button>
    </section>`);
  if (pushSupported()) wireNotifications(el, user);
  el.querySelector('#share').onclick = async () => {
    const text = `Join "${g.name}" on Gym or Bitch: ${inviteLink}`;
    try { if (navigator.share) await navigator.share({ title: 'Gym or Bitch', text }); else { await navigator.clipboard.writeText(text); showError({ message: 'Invite link copied' }); } }
    catch { /* share sheet closed */ }
  };
  el.querySelector('#leave').onclick = async () => {
    if (!confirm(`Leave ${g.name}?`)) return;
    try { await api.leaveGroup(g.id, user.id); location.hash = '#/all'; } catch (err) { showError(err); }
  };
  el.querySelector('#more')?.addEventListener('click', e => { busy(e.currentTarget, true, 'Loading…'); group(user, groupId, limit + FEED_PAGE).catch(showError); });
  el.querySelectorAll('.photo').forEach(b => b.onclick = () => openPhoto(b.dataset.path));
  el.querySelectorAll('.del').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this check-in and its photo?')) return;
    try { await api.deleteCheckin(feed.find(r => r.id === b.dataset.id)); group(user, groupId, limit); } catch (err) { showError(err); }
  });
}

const ASK_KEY = 'gob_ask_push';
async function wireNotifications(el, user) {
  const card = el.querySelector('#notif'), text = el.querySelector('#nstate');
  const on = el.querySelector('#non'), off = el.querySelector('#noff'), test = el.querySelector('#ntest');
  const show = async () => {
    const st = await pushState();
    let asked = false; try { asked = sessionStorage.getItem(ASK_KEY) === '1'; } catch {}
    card.classList.toggle('ask', st === 'off' && asked);
    text.textContent = {
      on: 'On. You get a ping the first time each mate checks in each day.',
      off: asked ? 'Nice one. Want a ping when your mates check in too?' : 'Off. Turn on to get a ping when a mate checks in.',
      blocked: 'Blocked in Chrome. ⋮ → Settings → Site settings → Notifications → allow this site.'
    }[st];
    on.hidden = st !== 'off'; off.hidden = test.hidden = st !== 'on';
  };
  on.onclick = async () => { busy(on, true); try { await enablePush(user.id); try { sessionStorage.removeItem(ASK_KEY); } catch {} } catch (err) { showError(err); } busy(on, false); show(); };
  off.onclick = async () => { busy(off, true); try { await disablePush(); } catch (err) { showError(err); } busy(off, false); show(); };
  test.onclick = () => testNotification().catch(showError);
  show().catch(showError);
}

export async function joinByLink(code) {
  try { const g = await api.joinGroup(code); location.hash = `#/g/${g.id}`; }
  catch (err) { location.hash = '#/all'; setTimeout(() => showError(err), 50); }
}

// ---------- check-in ----------
let liveStream = null;
export function releaseCamera() { stopCamera(liveStream); liveStream = null; }

export async function checkin(user, groupId) {
  // Full-screen camera. Controls float over the picture so nothing needs scrolling.
  const el = render(`
    <section class="cam" aria-label="Check in">
      <video id="v" playsinline muted></video>
      <img id="shot" alt="Your photo" hidden>
      <div class="cam-top">
        <a class="cam-close" href="#/g/${groupId}" aria-label="Cancel">✕</a>
        <p class="error" role="alert" hidden></p>
      </div>
      <div class="cam-bottom" id="live">
        <button id="snap" class="shutter" aria-label="Take photo"></button>
      </div>
      <form id="post" class="cam-bottom" hidden>
        <input id="note" maxlength="140" placeholder="Message to your group (optional)" enterkeyhint="send">
        <div class="row">
          <button type="button" id="retake" class="ghost">Retake</button>
          <button id="send">Post check-in</button>
        </div>
      </form>
    </section>`);
  const v = el.querySelector('#v'), shot = el.querySelector('#shot');
  const live = el.querySelector('#live'), post = el.querySelector('#post');
  let photo = null;
  try { liveStream = await openCamera(v); }
  catch (err) { showError(err.name === 'NotAllowedError' ? { message: 'Camera blocked. Allow camera for this site in Chrome settings.' } : err); return; }

  el.querySelector('#snap').onclick = async () => {
    try {
      photo = await snap(v);
      shot.src = URL.createObjectURL(photo.full);
      shot.hidden = false; v.hidden = true; live.hidden = true; post.hidden = false;
    } catch (err) { showError(err); }
  };
  el.querySelector('#retake').onclick = () => {
    photo = null; shot.hidden = true; v.hidden = false; live.hidden = false; post.hidden = true;
  };
  post.onsubmit = async e => {
    e.preventDefault(); if (!photo) return;
    const b = el.querySelector('#send'); busy(b, true, 'Posting…');
    try { await api.postCheckin(user.id, photo, el.querySelector('#note').value.trim()); releaseCamera(); try { sessionStorage.setItem(ASK_KEY, '1'); } catch {} location.hash = `#/g/${groupId}`; }
    catch (err) { showError(err); busy(b, false, 'Post check-in'); }
  };
}
