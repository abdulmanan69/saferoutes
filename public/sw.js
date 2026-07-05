/* SafeRoute service worker — app-shell caching + Web Push for offline/PWA support. */
const CACHE = 'saferoute-v3';

/* Web Push: fires even when the app is closed (Android/desktop; iOS 16.4+ installed PWA). */
self.addEventListener('push', (e) => {
    let data = {};
    try { data = e.data.json(); } catch { data = { title: 'SafeRoute', body: e.data?.text() || '' }; }
    e.waitUntil(self.registration.showNotification(data.title || 'SafeRoute', {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'saferoute',
        data: { url: data.url || '/rides' }
    }));
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const url = e.notification.data?.url || '/rides';
    e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        for (const c of list) {
            if ('focus' in c) { c.navigate(url); return c.focus(); }
        }
        return clients.openWindow(url);
    }));
});
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('message', (e) => {
    if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const { request } = e;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    // Never cache API traffic (Supabase, weather, routing, photos) — always live.
    if (url.origin !== location.origin) return;

    // Cache-first for same-origin static assets; network fallback updates cache.
    e.respondWith(
        caches.match(request).then(
            (hit) =>
                hit ||
                fetch(request)
                    .then((res) => {
                        if (res.ok && (request.destination !== '' || url.pathname === '/')) {
                            const clone = res.clone();
                            caches.open(CACHE).then((c) => c.put(request, clone));
                        }
                        return res;
                    })
                    // Offline navigation → serve the cached app shell.
                    .catch(() => (request.mode === 'navigate' ? caches.match('/') : undefined))
        )
    );
});
