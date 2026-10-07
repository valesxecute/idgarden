// Service worker: offline shell + runtime cache. Registered only on deployed builds (main.js).
// VERSION and PRECACHE are filled in at deploy by scripts/stamp-version.mjs, so every deploy
// gets a fresh cache and the old one is dropped on activate.
const VERSION = 'dev';
const PRECACHE = [];
const CACHE = 'garden-' + VERSION;

self.addEventListener('install', (e) => {
  // one missing file must not block the install
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('garden-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// reminders from garden-remind: { title, body, url }
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data?.json() ?? {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'Idea Garden', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'garden-reminder', data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const w = wins[0];
    return w ? w.navigate(url).then((n) => (n || w).focus()) : self.clients.openWindow(url);
  }));
});

const put = (req, res) => { if (res.ok || res.type === 'opaque') caches.open(CACHE).then((c) => c.put(req, res)); return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.pathname.endsWith('/version.json')) return; // always live

  // pages: network first (fresh deploys), cached shell offline. Query (share/capture params) ignored for the cache key
  if (req.mode === 'navigate') {
    const shell = new URL('./', self.registration.scope).href;
    e.respondWith(fetch(req).then((res) => put(shell, res.clone()) && res).catch(() => caches.match(shell)));
    return;
  }
  // versioned files never change: cache first
  if (url.origin === location.origin && url.searchParams.has('v')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res.clone()) && res)));
    return;
  }
  // everything else (feed, icons, fonts, supabase-js): cached copy now, refresh in the background
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => put(req, res.clone()) && res).catch(() => hit);
    return hit || net;
  }));
});
