/* SafeRoute service worker — app-shell caching for offline/PWA support. */
const CACHE = 'saferoute-v2';
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
