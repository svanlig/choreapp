/* ============================================================
   Mom Bucks — Service Worker
   Cache-first strategy for the app shell.
   ============================================================ */

var CACHE_NAME = 'mom-bucks-shell-v2';

/* Files that make up the app shell.
   Paths are relative so the SW works whether the app is hosted at
   the repo root or in a GitHub Pages project subpath. */
var APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

/* Pre-cache the app shell on install. */
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(APP_SHELL);
        }).then(function () {
            /* Activate this SW immediately on first install */
            return self.skipWaiting();
        })
    );
});

/* Clean up old caches on activation. */
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.map(function (key) {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                    return null;
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

/* Cache-first for same-origin GET requests.
   Falls back to the network, then to the cache. */
self.addEventListener('fetch', function (event) {
    var req = event.request;

    /* Only handle GET requests */
    if (req.method !== 'GET') return;

    /* Only handle same-origin requests */
    var url;
    try {
        url = new URL(req.url);
    } catch (e) {
        return;
    }
    if (url.origin !== self.location.origin) return;

    /* Never intercept the service worker or manifest fetch
       (browsers fetch these with special semantics) */
    if (url.pathname.endsWith('/service-worker.js')) return;

    event.respondWith(
        caches.match(req).then(function (cached) {
            if (cached) {
                return cached;
            }
            return fetch(req).then(function (response) {
                /* Only cache successful, same-origin, basic responses */
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                var copy = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(req, copy);
                });
                return response;
            }).catch(function () {
                /* Network failed and nothing cached — return a cached index
                   for navigation requests so the app shell still loads. */
                if (req.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return Response.error();
            });
        })
    );
});
