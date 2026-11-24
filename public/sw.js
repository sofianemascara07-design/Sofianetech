/* AutoPro Flash & Diagnostic Hub — Service Worker Anti-Blocage, PWA & Cache Fonds d'Écran */
const CACHE_VERSION = 'autopro-v2026-11-24-wake-v3';
const WALLPAPER_CACHE = 'autopro-wallpapers-v1';

const DEFAULT_WALLPAPER_ASSETS = [
  '/wallpapers/amoled-cockpit.webp',
  '/wallpapers/amoled-cockpit-thumb.webp',
  '/wallpapers/carbon-3k.webp',
  '/wallpapers/carbon-3k-thumb.webp',
  '/wallpapers/ecu-telemetry.webp',
  '/wallpapers/ecu-telemetry-thumb.webp',
  '/wallpapers/diagnostic-bay.webp',
  '/wallpapers/diagnostic-bay-thumb.webp',
  '/wallpapers/titanium-brake.webp',
  '/wallpapers/titanium-brake-thumb.webp',
];

async function precacheDefaultWallpapers() {
  try {
    const cache = await caches.open(WALLPAPER_CACHE);
    await Promise.allSettled(
      DEFAULT_WALLPAPER_ASSETS.map(async (assetUrl) => {
        const alreadyCached = await cache.match(assetUrl);
        if (alreadyCached) return;
        const res = await fetch(assetUrl, { cache: 'default' });
        if (res && res.ok) {
          await cache.put(assetUrl, res);
        }
      })
    );
  } catch {
    // Silencieux en mode hors ligne initial
  }
}

self.addEventListener('install', (event) => {
  // Activation immédiate sans bloquer le chargement initial de l'application
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION && key !== WALLPAPER_CACHE)
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
  } else if (data.type === 'PRECACHE_WALLPAPERS') {
    // Mise en cache asynchrone déclenchée après chargement initial (idle)
    event.waitUntil(precacheDefaultWallpapers());
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

  // 2. Fonds d'écran WebP (/wallpapers/*) -> CacheFirst ultra-rapide hors-ligne
  if (url.pathname.startsWith('/wallpapers/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(WALLPAPER_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const netRes = await fetch(req);
          if (netRes && netRes.ok) {
            cache.put(req, netRes.clone());
          }
          return netRes;
        } catch {
          return hit || Response.error();
        }
      })()
    );
    return;
  }

  // 3. Documents HTML / Navigations SPA -> NetworkOnly / NetworkFirst no-store
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

  // 4. Assets hashés (/assets/*.js, *.css) -> CacheFirst sécurisé
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
