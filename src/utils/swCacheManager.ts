export const APP_BUILD_VERSION = '2026.11.20-WALLPAPER-1';

export interface CacheHealthState {
  buildVersion: string;
  remoteVersion: string | null;
  updateDetected: boolean;
  swSupported: boolean;
  swActive: boolean;
  cacheCount: number;
  lastCheckedAt: string;
}

/**
 * Enregistre le Service Worker avec politique updateViaCache: 'none'
 * et active automatiquement la nouvelle version dès disponible.
 */
export function registerAutoUpdateServiceWorker(
  onUpdateDetected?: (remoteVer: string) => void
): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  let controllerRefreshing = false;

  const onControllerChange = () => {
    if (controllerRefreshing) return;
    controllerRefreshing = true;
    // Recharge propre sans paramètres obsolètes si un nouveau SW prend le contrôle
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  navigator.serviceWorker
    .register(`/sw.js?v=${encodeURIComponent(APP_BUILD_VERSION)}`, {
      updateViaCache: 'none',
    })
    .then((reg) => {
      reg.update().catch(() => undefined);
      // Mise en cache des fonds d'écran WebP en tâche de fond après rendu initial
      const scheduleWallpaperPrecache = () => {
        const target = navigator.serviceWorker.controller || reg.active;
        if (target) {
          target.postMessage({ type: 'PRECACHE_WALLPAPERS' });
        }
      };
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
          scheduleWallpaperPrecache,
          { timeout: 4000 }
        );
      } else {
        setTimeout(scheduleWallpaperPrecache, 2500);
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            onUpdateDetected?.('Nouvelle mise à jour SW prête');
          }
        });
      });
    })
    .catch(() => {
      // Ignore en environnement dev HTTP sans HTTPS
    });

  // Vérification distante périodique de /version.json (anti-écran figé)
  const checkTimer = setInterval(() => {
    void checkRemoteVersionUpdate().then((res) => {
      if (res.updateDetected && res.remoteVersion) {
        onUpdateDetected?.(res.remoteVersion);
      }
    });
  }, 5 * 60 * 1000);

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    clearInterval(checkTimer);
  };
}

export async function checkRemoteVersionUpdate(): Promise<CacheHealthState> {
  const swSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  let swActive = false;
  let cacheCount = 0;

  try {
    if (swSupported) {
      const regs = await navigator.serviceWorker.getRegistrations();
      swActive = regs.some((r) => Boolean(r.active));
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await window.caches.keys();
      cacheCount = keys.length;
    }
  } catch {
    // Ignore storage inspection error
  }

  let remoteVersion: string | null = null;
  let updateDetected = false;

  try {
    const res = await fetch(`/version.json?cb=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.version === 'string') {
        remoteVersion = data.version;
        updateDetected = remoteVersion !== APP_BUILD_VERSION;
      }
    }
  } catch {
    // Mode hors ligne atelier : aucune erreur bloquante
  }

  return {
    buildVersion: APP_BUILD_VERSION,
    remoteVersion,
    updateDetected,
    swSupported,
    swActive,
    cacheCount,
    lastCheckedAt: new Date().toLocaleTimeString('fr-FR'),
  };
}

export async function forcePurgeCachesAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // Continue purge
  }

  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
  } catch {
    // Continue reload
  }

  const sep = window.location.pathname || '/';
  window.location.replace(`${sep}?cb=${Date.now()}`);
}
