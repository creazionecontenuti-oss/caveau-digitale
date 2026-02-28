// Caveau Digitale — Service Worker (auto-update v5)
const CACHE_VERSION = 'caveau-v5-20260228b';
const CORE_ASSETS = ['/', '/index.html', '/app.js', '/manifest.json'];

self.addEventListener('install', e => {
  // Force immediate activation — don't wait for old tabs to close
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        // Force-reload all open tabs so they get the new HTML + JS
        clients.forEach(c => {
          c.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
          c.navigate(c.url);
        });
      })
  );
});

// Respond to version check from page
self.addEventListener('message', e => {
  if (e.data?.type === 'GET_VERSION') {
    e.source.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
  }
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // ALWAYS network-first for HTML — never serve stale HTML
  if (e.request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // ALWAYS network-first for sw.js itself — browser does this anyway but be explicit
  if (url.pathname === '/sw.js') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Stale-while-revalidate for JS, CSS, images
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
