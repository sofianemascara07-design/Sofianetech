/* AutoPro Flash & Diagnostic Hub — Service Worker Anti-Blocage & Cache-Busting */
const CACHE_VERSION = 'autopro-v2026-11-20-akl1';

self.addEventListener('install', (event) => {
  // Activation immédiate sans bloquer l'utilisateur sur une ancienne version
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((oldKey) => caches.delete(oldKey))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'PURGE_ALL_CACHES') {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      })()
    );
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1. JAMAIS cacher /api/*, /version.json ou les requêtes de boucle locale
  if (url.pathname.startsWith('/api/') || url.pathname === '/version.json') {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // 2. Documents HTML / Navigations SPA -> NetworkOnly / NetworkFirst no-store
  // Empêche l'écran figé sur un ancien index.html pointant vers des chunks JS supprimés
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(async () => {
        const cached = await caches.match('/index.html');
        return cached || Response.error();
      })
    );
    return;
  }

  // 3. Assets hashés (/assets/*.js, *.css) -> CacheFirst sécurisé
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const hit = await cache.match(req);
        if (hit) return hit;
        const netRes = await fetch(req);
        if (netRes && netRes.ok) {
          cache.put(req, netRes.clone());
        }
        return netRes;
      })()
    );
  }
});
