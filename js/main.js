// Boot + hash router.
// Routes: #/all  #/g/<groupId>  #/checkin/<groupId>  #/join/<inviteCode>
import { configured, sb, currentUser, getProfile, signOut } from './supa.js';
import * as ui from './ui.js';
import { disablePush } from './push.js';
import { logScreen, progressScreen } from './tracker.js';

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

const PENDING_JOIN = 'gob_pending_join';

async function route() {
  ui.releaseCamera();
  if (!configured) return ui.notConfigured();

  const hash = location.hash || '#/';
  const [, page, arg] = hash.split('/');

  // remember an invite link opened before signing in
  if (page === 'join' && arg) localStorage.setItem(PENDING_JOIN, arg);

  const user = await currentUser();
  document.getElementById('signout').hidden = !user;
  document.getElementById('tabs').hidden = !user;
  if (!user) return ui.signIn(route);

  const profile = await getProfile(user.id);
  if (!profile.display_name) return ui.pickName(user, route);

  const pending = localStorage.getItem(PENDING_JOIN);
  if (pending) { localStorage.removeItem(PENDING_JOIN); return ui.joinByLink(pending); }

  markTab(page);
  if (page === 'g' && arg) { lastGroup(arg); return ui.group(user, arg); }
  if (page === 'log') return logScreen(user);
  if (page === 'p' && arg) return progressScreen(user, arg);
  if (page === 'checkin' && arg) return ui.checkin(user, arg);
  return ui.home(user);
}

// bottom tabs: Group (last group opened) · Log · Progress
function lastGroup(id) { try { localStorage.setItem('gob_last_group', id); } catch {} }
function markTab(page) {
  let g = null; try { g = localStorage.getItem('gob_last_group'); } catch {}
  document.getElementById('tab-group').href = g ? `#/g/${g}` : '#/all';
  const on = page === 'log' ? 'tab-log' : page === 'p' ? 'tab-me' : 'tab-group';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.id === on));
}

const safeRoute = () => route().catch(ui.showError);
window.addEventListener('hashchange', safeRoute);
document.getElementById('signout').onclick = async () => { try { await disablePush(); } catch { /* still sign out */ } await signOut(); location.hash = '#/'; safeRoute(); };
if (sb) sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') safeRoute(); });
safeRoute();
