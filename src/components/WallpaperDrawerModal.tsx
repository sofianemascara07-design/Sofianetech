import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  HardDriveDownload,
  ImagePlus,
  Loader2,
  Moon,
  Trash2,
  Wallpaper,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';
import {
  ActiveWallpaperConfig,
  BUILTIN_WALLPAPERS,
  CustomSavedWallpaper,
  WallpaperPreset,
  compressTabletImage,
  deleteCustomWallpaperFromDb,
  getCustomWallpapersFromDb,
  inspectWallpaperCacheStatus,
  precacheDefaultWallpapersNow,
  preloadWallpaperImage,
  saveCustomWallpaperToDb,
} from '../utils/wallpaperManager';

interface WallpaperDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWallpaper: ActiveWallpaperConfig;
  onApplyWallpaper: (config: ActiveWallpaperConfig) => void;
}

export const WallpaperDrawerModal: React.FC<WallpaperDrawerModalProps> = ({
  isOpen,
  onClose,
  activeWallpaper,
  onApplyWallpaper,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [customWallpapers, setCustomWallpapers] = useState<CustomSavedWallpaper[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<{
    cachedCount: number;
    totalAssets: number;
    allCached: boolean;
  }>({ cachedCount: 0, totalAssets: 10, allCached: false });
  const [isCachingOffline, setIsCachingOffline] = useState<boolean>(false);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    void getCustomWallpapersFromDb().then((items) => {
      if (mounted) setCustomWallpapers(items);
    });
    void inspectWallpaperCacheStatus().then((status) => {
      if (mounted) setCacheStatus(status);
    });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = async (preset: WallpaperPreset) => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (preset.kind === 'solid') {
      onApplyWallpaper({
        id: preset.id,
        label: preset.label,
        kind: 'solid',
        src: '',
        solidColor: preset.solidColor || '#04070e',
        overlayOpacity: activeWallpaper.overlayOpacity,
        updatedAt: new Date().toISOString(),
      });
      setStatusMessage('Mode AMOLED Noir Absolu activé (économie RAM & batterie).');
      return;
    }

    setLoadingId(preset.id);
    try {
      await preloadWallpaperImage(preset.src);
      onApplyWallpaper({
        id: preset.id,
        label: preset.label,
        kind: 'builtin',
        src: preset.src,
        overlayOpacity: activeWallpaper.overlayOpacity,
        updatedAt: new Date().toISOString(),
      });
      setStatusMessage(`Fond « ${preset.label} » appliqué sans latence.`);
      // Rafraîchit discrètement l'état du cache après chargement
      void inspectWallpaperCacheStatus().then(setCacheStatus);
    } catch {
      setErrorMessage(
        `Impossible de précharger ${preset.label} hors ligne. Activez le cache PWA ou vérifiez la connexion.`
      );
    } finally {
      setLoadingId(null);
    }
  };

  const handleSelectCustom = async (item: CustomSavedWallpaper) => {
    setErrorMessage(null);
    setLoadingId(item.id);
    try {
      await preloadWallpaperImage(item.dataUrl);
      onApplyWallpaper({
        id: item.id,
        label: item.label,
        kind: 'custom',
        src: item.dataUrl,
        overlayOpacity: activeWallpaper.overlayOpacity,
        updatedAt: new Date().toISOString(),
      });
      setStatusMessage(
        `Fond personnalisé « ${item.label} » (${item.width}×${item.height} · ${item.sizeKb} Ko) appliqué.`
      );
    } catch {
      setErrorMessage('Erreur de chargement de cette image locale.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleImportFromTablet = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    setStatusMessage(null);
    setIsCompressing(true);

    try {
      const compressed = await compressTabletImage(file, 1280, 0.8);
      await preloadWallpaperImage(compressed.dataUrl);
      const updatedList = await saveCustomWallpaperToDb(compressed);
      setCustomWallpapers(updatedList);

      onApplyWallpaper({
        id: compressed.id,
        label: compressed.label,
        kind: 'custom',
        src: compressed.dataUrl,
        overlayOpacity: activeWallpaper.overlayOpacity,
        updatedAt: new Date().toISOString(),
      });

      setStatusMessage(
        `Image compressée (${compressed.width}×${compressed.height} ${compressed.format.toUpperCase()} · ${compressed.sizeKb} Ko) et enregistrée hors ligne.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Échec lors de la compression de l’image.'
      );
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDeleteCustom = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await deleteCustomWallpaperFromDb(id);
    setCustomWallpapers(updated);
    if (activeWallpaper.id === id) {
      const fallback = BUILTIN_WALLPAPERS[1];
      onApplyWallpaper({
        id: fallback.id,
        label: fallback.label,
        kind: 'builtin',
        src: fallback.src,
        overlayOpacity: activeWallpaper.overlayOpacity,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handlePrecacheAll = async () => {
    setIsCachingOffline(true);
    setErrorMessage(null);
    try {
      await precacheDefaultWallpapersNow();
      const status = await inspectWallpaperCacheStatus();
      setCacheStatus(status);
      setStatusMessage(
        `${status.cachedCount}/${status.totalAssets} ressources WebP disponibles hors ligne dans le cache PWA.`
      );
    } catch {
      setErrorMessage('Mise en cache impossible sans accès réseau.');
    } finally {
      setIsCachingOffline(false);
    }
  };

  const dimPct = Math.round(activeWallpaper.overlayOpacity * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallpaper-drawer-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] sm:h-full bg-slate-950 border-t sm:border-t-0 sm:border-l border-slate-800 rounded-t-3xl sm:rounded-none flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poignée mobile discrète */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-slate-700" />
        </div>

        {/* En-tête ergonomique tactile */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
          <div className="min-w-0">
            <h2
              id="wallpaper-drawer-title"
              className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate"
            >
              <Wallpaper className="w-5 h-5 text-cyan-400 shrink-0" />
              <span>Fonds d’Écran Tablette Android</span>
            </h2>
            <p className="text-xs text-slate-400 truncate">
              Actif : {activeWallpaper.label} · Mode hors ligne PWA
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les réglages de fond d'écran"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Messages d'état */}
          {statusMessage && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-200">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-950/35 px-4 py-3 text-xs text-rose-200">
              {errorMessage}
            </div>
          )}

          {/* 01. Carrousel horizontal tactile (chargement différé lazy) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">
                01. Galerie Automobile Légère (.webp)
              </h3>
              <span className="text-xs text-slate-400 tabular-nums">
                {BUILTIN_WALLPAPERS.length} thèmes
              </span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth">
              {BUILTIN_WALLPAPERS.map((preset) => {
                const isActive = activeWallpaper.id === preset.id;
                const isLoading = loadingId === preset.id;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => void handleSelectPreset(preset)}
                    className={`snap-start shrink-0 w-44 rounded-2xl border text-left overflow-hidden cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                      isActive
                        ? 'border-cyan-400 bg-slate-900 ring-1 ring-cyan-400/50'
                        : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                    }`}
                  >
                    <div className="relative h-24 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
                      {preset.kind === 'solid' ? (
                        <div className="w-full h-full bg-[#04070e] flex flex-col items-center justify-center gap-1.5">
                          <Moon className="w-6 h-6 text-slate-400" />
                          <span className="text-[11px] font-medium text-slate-400">
                            Noir Pur AMOLED
                          </span>
                        </div>
                      ) : (
                        <img
                          src={preset.thumbSrc}
                          alt={preset.label}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}

                      {isLoading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                        </div>
                      )}

                      {isActive && !isLoading && (
                        <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow">
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-0.5">
                      <div className="text-xs font-semibold text-white truncate">
                        {preset.label}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {preset.category} · {preset.sizeHint}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 02. Importation depuis la galerie locale de la tablette Android */}
          <section className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">
                02. Importer depuis la Galerie Tablette
              </h3>
              <p className="text-xs text-slate-400">
                Compression automatique via Canvas (max 1280 px · WebP/JPEG 0.8) pour préserver la RAM.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImportFromTablet}
              className="hidden"
            />

            <button
              type="button"
              disabled={isCompressing}
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 font-bold text-sm flex items-center justify-center gap-2.5 cursor-pointer transition-all disabled:opacity-60"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Compression Canvas en cours...</span>
                </>
              ) : (
                <>
                  <ImagePlus className="w-5 h-5" />
                  <span>Choisir une photo sur la tablette</span>
                </>
              )}
            </button>

            {/* Fonds personnalisés sauvegardés dans IndexedDB */}
            {customWallpapers.length > 0 && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {customWallpapers.map((item) => {
                  const isActive = activeWallpaper.id === item.id;
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void handleSelectCustom(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void handleSelectCustom(item);
                        }
                      }}
                      className={`rounded-2xl border overflow-hidden cursor-pointer transition-colors ${
                        isActive
                          ? 'border-cyan-400 bg-slate-900 ring-1 ring-cyan-400/40'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                      }`}
                    >
                      <div className="relative h-20 bg-slate-950">
                        <img
                          src={item.dataUrl}
                          alt={item.label}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`Supprimer ${item.label}`}
                          onClick={(e) => void handleDeleteCustom(item.id, e)}
                          className="absolute top-1.5 right-1.5 min-h-[36px] min-w-[36px] rounded-xl bg-black/75 hover:bg-rose-600 text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="p-2.5">
                        <div className="text-xs font-semibold text-white truncate">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          {item.width}×{item.height} · {item.sizeKb} Ko
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 03. Réglage contraste & Cache hors-ligne PWA */}
          <section className="space-y-4 pt-2 border-t border-slate-800/80">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">
                  03. Assombrissement pour lisibilité atelier
                </span>
                <span className="font-mono text-cyan-300 tabular-nums">{dimPct}%</span>
              </div>
              <input
                type="range"
                min={45}
                max={92}
                step={1}
                value={dimPct}
                onChange={(e) =>
                  onApplyWallpaper({
                    ...activeWallpaper,
                    overlayOpacity: Number(e.target.value) / 100,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full h-3 accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Cache PWA Hors-Ligne (Service Worker)
                  </div>
                  <div className="text-[11px] text-slate-400 tabular-nums">
                    {cacheStatus.cachedCount} / {cacheStatus.totalAssets} fichiers .webp prêts hors ligne
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    cacheStatus.allCached ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {cacheStatus.allCached ? 'Complet' : 'Partiel'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isCachingOffline}
                  onClick={() => void handlePrecacheAll()}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {isCachingOffline ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <HardDriveDownload className="w-4 h-4" />
                  )}
                  <span>Tout cacher hors ligne</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleSelectPreset(BUILTIN_WALLPAPERS[0])}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Moon className="w-4 h-4 text-slate-400" />
                  <span>Noir AMOLED (0 Ko)</span>
                </button>
              </div>

              {isInstallable && !isInstalled && (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Installer l’application sur la tablette (PWA)</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
