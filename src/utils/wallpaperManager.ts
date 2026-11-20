export type WallpaperKind = 'solid' | 'builtin' | 'custom';

export interface WallpaperPreset {
  id: string;
  label: string;
  category: 'AMOLED' | 'Carbone' | 'Cockpit' | 'Diagnostic' | 'Atelier' | 'Galerie';
  kind: WallpaperKind;
  src: string;
  thumbSrc: string;
  solidColor?: string;
  sizeHint?: string;
}

export interface ActiveWallpaperConfig {
  id: string;
  label: string;
  kind: WallpaperKind;
  src: string; // URL locale (/wallpapers/*.webp) ou DataURL WebP/JPEG compressée
  solidColor?: string;
  overlayOpacity: number; // 0.45 -> 0.92 pour garantir le contraste texte
  updatedAt: string;
}

export interface CustomSavedWallpaper {
  id: string;
  label: string;
  dataUrl: string;
  width: number;
  height: number;
  sizeKb: number;
  format: 'webp' | 'jpeg';
  createdAt: string;
}

export const WALLPAPER_STORAGE_KEY = 'autopro_tablet_wallpaper_v1';
export const WALLPAPER_CACHE_NAME = 'autopro-wallpapers-v1';

const IDB_NAME = 'autopro_wallpapers_db';
const IDB_STORE = 'custom_wallpapers';
const IDB_VERSION = 1;
const MAX_CUSTOM_WALLPAPERS = 6;

/**
 * Catalogue intégré ultra-léger (.webp < 50 Ko) pour tablettes Android & autoradios.
 */
export const BUILTIN_WALLPAPERS: WallpaperPreset[] = [
  {
    id: 'amoled-pure',
    label: 'AMOLED Noir Absolu',
    category: 'AMOLED',
    kind: 'solid',
    src: '',
    thumbSrc: '',
    solidColor: '#04070e',
    sizeHint: '0 Ko · Éco RAM',
  },
  {
    id: 'amoled-cockpit',
    label: 'Cockpit AMOLED Cyan',
    category: 'Cockpit',
    kind: 'builtin',
    src: '/wallpapers/amoled-cockpit.webp',
    thumbSrc: '/wallpapers/amoled-cockpit-thumb.webp',
    sizeHint: '12 Ko · WebP',
  },
  {
    id: 'carbon-3k',
    label: 'Carbone 3K Mat',
    category: 'Carbone',
    kind: 'builtin',
    src: '/wallpapers/carbon-3k.webp',
    thumbSrc: '/wallpapers/carbon-3k-thumb.webp',
    sizeHint: '48 Ko · WebP',
  },
  {
    id: 'ecu-telemetry',
    label: 'Télémétrie ECU',
    category: 'Diagnostic',
    kind: 'builtin',
    src: '/wallpapers/ecu-telemetry.webp',
    thumbSrc: '/wallpapers/ecu-telemetry-thumb.webp',
    sizeHint: '19 Ko · WebP',
  },
  {
    id: 'diagnostic-bay',
    label: 'Baie Diagnostic Studio',
    category: 'Atelier',
    kind: 'builtin',
    src: '/wallpapers/diagnostic-bay.webp',
    thumbSrc: '/wallpapers/diagnostic-bay-thumb.webp',
    sizeHint: '30 Ko · WebP',
  },
  {
    id: 'titanium-brake',
    label: 'Titane & Frein Céramique',
    category: 'Atelier',
    kind: 'builtin',
    src: '/wallpapers/titanium-brake.webp',
    thumbSrc: '/wallpapers/titanium-brake-thumb.webp',
    sizeHint: '27 Ko · WebP',
  },
];

export const DEFAULT_WALLPAPER_CONFIG: ActiveWallpaperConfig = {
  id: 'amoled-cockpit',
  label: 'Cockpit AMOLED Cyan',
  kind: 'builtin',
  src: '/wallpapers/amoled-cockpit.webp',
  overlayOpacity: 0.72,
  updatedAt: new Date().toISOString(),
};

/**
 * Lecture synchrone au démarrage pour afficher le fond immédiatement sans flash blanc.
 */
export function loadActiveWallpaperSync(): ActiveWallpaperConfig {
  if (typeof window === 'undefined') return DEFAULT_WALLPAPER_CONFIG;
  try {
    const raw = window.localStorage.getItem(WALLPAPER_STORAGE_KEY);
    if (!raw) return DEFAULT_WALLPAPER_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ActiveWallpaperConfig>;
    if (!parsed || !parsed.id || !parsed.kind) return DEFAULT_WALLPAPER_CONFIG;
    return {
      id: parsed.id,
      label: parsed.label || 'Fond personnalisé',
      kind: parsed.kind,
      src: parsed.src || '',
      solidColor: parsed.solidColor || '#04070e',
      overlayOpacity:
        typeof parsed.overlayOpacity === 'number'
          ? Math.min(0.92, Math.max(0.4, parsed.overlayOpacity))
          : 0.72,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return DEFAULT_WALLPAPER_CONFIG;
  }
}

export function saveActiveWallpaperSync(config: ActiveWallpaperConfig): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    // Si quota localStorage dépassé sur une très vieille tablette, sauvegarder sans DataURL lourde
    try {
      const lightweight = { ...config, src: config.kind === 'custom' ? '' : config.src };
      window.localStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify(lightweight));
    } catch {
      // Ignore
    }
    return false;
  }
}

/**
 * Précharge une image en mémoire avec `new Image()` et `decode()` avant de l'appliquer
 * au DOM pour garantir zéro flash blanc sur tablette Android lente.
 */
export function preloadWallpaperImage(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => resolve())
          .catch(() => resolve());
      } else {
        resolve();
      }
    };
    img.onerror = () => reject(new Error(`Impossible de charger le fond d'écran (${src})`));
    img.src = src;
  });
}

/**
 * Compresse côté client toute image importée depuis la galerie Android via <canvas> HTML5
 * (largeur max 1280 px, qualité WebP/JPEG 0.8) afin d'économiser RAM et stockage.
 */
export async function compressTabletImage(
  file: File,
  maxWidth = 1280,
  quality = 0.8
): Promise<CustomSavedWallpaper> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).');
  }

  let bitmap: ImageBitmap | null = null;
  let fallbackImg: HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  try {
    let sourceWidth = 0;
    let sourceHeight = 0;

    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file);
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
    } else {
      objectUrl = URL.createObjectURL(file);
      fallbackImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Lecture image impossible sur cet appareil.'));
        img.src = objectUrl!;
      });
      sourceWidth = fallbackImg.naturalWidth || fallbackImg.width;
      sourceHeight = fallbackImg.naturalHeight || fallbackImg.height;
    }

    if (!sourceWidth || !sourceHeight) {
      throw new Error('Dimensions image invalides.');
    }

    // Calcul des dimensions cibles (max 1280px de large, et max 1280px en portrait)
    let targetWidth = sourceWidth;
    let targetHeight = sourceHeight;

    if (targetWidth > maxWidth) {
      const ratio = maxWidth / targetWidth;
      targetWidth = maxWidth;
      targetHeight = Math.round(targetHeight * ratio);
    }
    if (targetHeight > maxWidth) {
      const ratio = maxWidth / targetHeight;
      targetHeight = maxWidth;
      targetWidth = Math.round(targetWidth * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, targetWidth);
    canvas.height = Math.max(1, targetHeight);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Contexte graphique Canvas indisponible.');
    }

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (bitmap) {
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    } else if (fallbackImg) {
      ctx.drawImage(fallbackImg, 0, 0, canvas.width, canvas.height);
    }

    // Priorité WebP (plus léger sur Android Chrome), repli automatique JPEG 0.8
    let dataUrl = canvas.toDataURL('image/webp', quality);
    let format: 'webp' | 'jpeg' = 'webp';
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      format = 'jpeg';
    }

    // Libération explicite mémoire tampon GPU/RAM sur tablettes Android modestes
    canvas.width = 0;
    canvas.height = 0;

    const sizeBytes = Math.round((dataUrl.length * 3) / 4);
    const sizeKb = Math.max(1, Math.round(sizeBytes / 1024));
    const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 28) || 'Galerie Tablette';

    return {
      id: `custom-${Date.now()}`,
      label: cleanName,
      dataUrl,
      width: targetWidth,
      height: targetHeight,
      sizeKb,
      format,
      createdAt: new Date().toISOString(),
    };
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

// ============================================================================
// STOCKAGE PERSISTANT HORS-LIGNE INDEXEDDB (Évite saturation localStorage)
// ============================================================================

function openWallpaperDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non supporté'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erreur ouverture IndexedDB'));
  });
}

export async function getCustomWallpapersFromDb(): Promise<CustomSavedWallpaper[]> {
  try {
    const db = await openWallpaperDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? (req.result as CustomSavedWallpaper[]) : [];
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveCustomWallpaperToDb(item: CustomSavedWallpaper): Promise<CustomSavedWallpaper[]> {
  try {
    const existing = await getCustomWallpapersFromDb();
    const db = await openWallpaperDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(item);

      // Conserver uniquement les N derniers fonds importés pour limiter la RAM/stockage
      const merged = [item, ...existing.filter((e) => e.id !== item.id)];
      if (merged.length > MAX_CUSTOM_WALLPAPERS) {
        for (const oldItem of merged.slice(MAX_CUSTOM_WALLPAPERS)) {
          store.delete(oldItem.id);
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Repli silencieux : l'image reste utilisable via l'état actif
  }
  return getCustomWallpapersFromDb();
}

export async function deleteCustomWallpaperFromDb(id: string): Promise<CustomSavedWallpaper[]> {
  try {
    const db = await openWallpaperDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
  return getCustomWallpapersFromDb();
}

export async function getCustomWallpaperById(id: string): Promise<CustomSavedWallpaper | null> {
  const all = await getCustomWallpapersFromDb();
  return all.find((w) => w.id === id) || null;
}

/**
 * Vérifie combien de fichiers /wallpapers/*.webp sont déjà disponibles hors ligne dans le Cache PWA.
 */
export async function inspectWallpaperCacheStatus(): Promise<{
  cachedCount: number;
  totalAssets: number;
  allCached: boolean;
}> {
  const urls = BUILTIN_WALLPAPERS.filter((w) => w.kind === 'builtin').flatMap((w) => [
    w.src,
    w.thumbSrc,
  ]);
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { cachedCount: 0, totalAssets: urls.length, allCached: false };
  }
  try {
    const cache = await window.caches.open(WALLPAPER_CACHE_NAME);
    const checks = await Promise.all(urls.map((u) => cache.match(u)));
    const cachedCount = checks.filter(Boolean).length;
    return {
      cachedCount,
      totalAssets: urls.length,
      allCached: cachedCount >= urls.length,
    };
  } catch {
    return { cachedCount: 0, totalAssets: urls.length, allCached: false };
  }
}

/**
 * Met en cache les fonds d'écran intégrés sans bloquer le thread principal.
 */
export async function precacheDefaultWallpapersNow(): Promise<number> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE_WALLPAPERS' });
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(WALLPAPER_CACHE_NAME);
      const urls = BUILTIN_WALLPAPERS.filter((w) => w.kind === 'builtin').flatMap((w) => [
        w.src,
        w.thumbSrc,
      ]);
      await Promise.allSettled(
        urls.map(async (u) => {
          const hit = await cache.match(u);
          if (!hit) {
            const res = await fetch(u);
            if (res.ok) await cache.put(u, res);
          }
        })
      );
    } catch {
      // Silencieux si hors ligne
    }
  }
  const status = await inspectWallpaperCacheStatus();
  return status.cachedCount;
}
