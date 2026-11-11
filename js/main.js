// Boot + hash router.
// Routes: #/all  #/g/<group>  #/checkin/<group>  #/join/<code>  #/log  #/p/<user|me>  #/r/<group>[/<measure>]  #/me
import { configured, sb, currentUser, getProfile, updateProfile } from './supa.js';
import * as ui from './ui.js';
import { logScreen, progressScreen } from './tracker.js';
import { meScreen } from './me.js';
import { ranksScreen } from './ranks.js';
import { t, getLang, setLang, hasChosenLang } from './i18n.js';
import { ICON } from './icons.js';

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

const PENDING_JOIN = 'gob_pending_join';
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

// bottom tabs: Group (last group opened) · Log · Ranks · Me
function drawTabs(page) {
  const g = store.get('gob_last_group');
  const on = { g: 'group', all: 'group', log: 'log', r: 'ranks', me: 'me', p: 'me' }[page] || 'group';
  const tab = (id, href, label) => `<a href="${href}" class="${on === id ? 'on' : ''}" ${on === id ? 'aria-current="page"' : ''}>${ICON[id](22)}<span>${label}</span></a>`;
  document.getElementById('tabs').innerHTML =
    tab('group', g ? `#/g/${g}` : '#/all', t('Group', 'Group')) +
    tab('log', '#/log', t('Log', '記錄')) +
    tab('ranks', g ? `#/r/${g}` : '#/all', t('Ranks', '排名')) +
    tab('me', '#/me', t('Me', '我'));
}

let synced = false;
async function route() {
  ui.releaseCamera();
  if (!configured) return ui.notConfigured();

  const [, page, arg, arg2] = (location.hash || '#/').split('/');
  // remember an invite link opened before signing in
  if (page === 'join' && arg) store.set(PENDING_JOIN, arg);

  const user = await currentUser();
  const tabs = document.getElementById('tabs');
  tabs.hidden = !user || page === 'checkin';
  if (!user) return ui.signIn(route);

  const profile = await getProfile(user.id);
  // one language across phones: a choice made on this phone wins, otherwise use the saved one
  if (!synced) {
    synced = true;
    if (!hasChosenLang() && profile.lang && profile.lang !== getLang()) setLang(profile.lang);
    else if (profile.lang !== getLang()) updateProfile(user.id, { lang: getLang() }).catch(() => {});
  }
  if (!profile.display_name) return ui.pickName(user, route);

  const pending = store.get(PENDING_JOIN);
  if (pending) { localStorage.removeItem(PENDING_JOIN); return ui.joinByLink(pending); }

  drawTabs(page);
  if (page === 'g' && arg) { store.set('gob_last_group', arg); return ui.group(user, arg); }
  if (page === 'checkin' && arg) return ui.checkin(user, arg);
  if (page === 'log') return logScreen(user);
  if (page === 'p' && arg) return progressScreen(user, arg);
  if (page === 'r' && arg) return ranksScreen(user, arg, arg2);
  if (page === 'me') return meScreen(user);
  return ui.home(user);
}

const safeRoute = () => route().catch(ui.showError);
window.addEventListener('hashchange', safeRoute);
window.addEventListener('langchange', safeRoute);
if (sb) sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') safeRoute(); });
safeRoute();
