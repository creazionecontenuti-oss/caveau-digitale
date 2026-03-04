// Caveau Digitale — Service Worker (auto-update v5)
const CACHE_VERSION = 'piggy-v9161-readme-license';
const CORE_ASSETS = [
  '/', '/index.html', '/app.min.js', '/thirdweb-sdk.js', '/manifest.json',
  '/tailwind.min.css',
  '/lib/framework7-bundle.min.css',
  '/lib/framework7-bundle.min.js',
  '/lib/framework7-icons.min.css',
  '/lib/fonts/Framework7Icons-Regular.woff2',
  '/lib/ethers.umd.min.js',
  '/logo-grande.webp',
  '/icona-app-quadrata.webp',
  '/icon-192.webp',
  '/piggy-tab-icon.webp',
  '/i18n.js',
  '/i18n-langs.js'
];

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
  if (e.origin && e.origin !== self.location.origin) return;
  if (e.data?.type === 'GET_VERSION') {
    e.source.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
  }
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isCDN = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'cdnjs.cloudflare.com';
  if (url.origin !== self.location.origin && !isCDN) return;

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
