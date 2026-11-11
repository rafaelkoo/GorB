// Boot + hash router.
// Routes: #/all  #/g/<groupId>  #/checkin/<groupId>  #/join/<inviteCode>
import { configured, sb, currentUser, getProfile, signOut } from './supa.js';
import * as ui from './ui.js';

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
  if (!user) return ui.signIn(route);

  const profile = await getProfile(user.id);
  if (!profile.display_name) return ui.pickName(user, route);

  const pending = localStorage.getItem(PENDING_JOIN);
  if (pending) { localStorage.removeItem(PENDING_JOIN); return ui.joinByLink(pending); }

  if (page === 'g' && arg) return ui.group(user, arg);
  if (page === 'checkin' && arg) return ui.checkin(user, arg);
  return ui.home(user);
}

const safeRoute = () => route().catch(ui.showError);
window.addEventListener('hashchange', safeRoute);
document.getElementById('signout').onclick = async () => { await signOut(); location.hash = '#/'; safeRoute(); };
if (sb) sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') safeRoute(); });
safeRoute();
