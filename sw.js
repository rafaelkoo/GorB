// Service worker: offline app shell + push notifications.
// Bump VERSION whenever app files change so phones pick up the new copy.
const VERSION = 'gob-v0.19.0';
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/main.js', 'js/config.js', 'js/supa.js', 'js/camera.js', 'js/ui.js', 'js/push.js', 'js/tracker.js', 'js/exercises.js', 'js/i18n.js', 'js/icons.js', 'js/me.js', 'js/ranks.js', 'js/plan.js', 'js/importer.js', 'js/exsheet.js', 'js/coach.js', 'js/timer.js', 'js/score.js', 'js/scheme.js', 'js/cardio.js', 'js/review.js', 'js/motion.js',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only the app's own files are cached. Supabase calls and photos always go to the network.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});

// Phase 2: the server sends {title, body, url}.
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Gym or Bitch', {
    body: data.body || 'Someone is at the gym. Are you?',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: data.url || './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(e.notification.data.url, self.location.href).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope)) { c.navigate(target); return c.focus(); }
    return clients.openWindow(target);
  }));
});
