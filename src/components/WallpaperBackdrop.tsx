import React, { useEffect, useRef, useState } from 'react';
import { ActiveWallpaperConfig, preloadWallpaperImage } from '../utils/wallpaperManager';

interface WallpaperBackdropProps {
  wallpaper: ActiveWallpaperConfig;
  atelierMode?: boolean;
}

/**
 * Calque de fond d'écran optimisé GPU (Zéro flash blanc, transition CSS opacity uniquement)
 * conçu pour préserver la RAM et le CPU des tablettes Android et autoradios chinois.
 */
export const WallpaperBackdrop: React.FC<WallpaperBackdropProps> = ({
  wallpaper,
  atelierMode = false,
}) => {
  const [displayedSrc, setDisplayedSrc] = useState<string>(() =>
    wallpaper.kind === 'solid' ? '' : wallpaper.src
  );
  const [isVisible, setIsVisible] = useState<boolean>(() =>
    wallpaper.kind !== 'solid' && Boolean(wallpaper.src)
  );
  const pendingSrcRef = useRef<string>(wallpaper.src);

  useEffect(() => {
    if (atelierMode || wallpaper.kind === 'solid' || !wallpaper.src) {
      pendingSrcRef.current = '';
      setIsVisible(false);
      return;
    }

    const nextSrc = wallpaper.src;
    pendingSrcRef.current = nextSrc;

    if (nextSrc === displayedSrc) {
      setIsVisible(true);
      return;
    }

    let cancelled = false;
    // Préchargement en mémoire avec `new Image()` avant d'appliquer au DOM (zéro flash blanc)
    preloadWallpaperImage(nextSrc)
      .then(() => {
        if (cancelled || pendingSrcRef.current !== nextSrc) return;
        setDisplayedSrc(nextSrc);
        requestAnimationFrame(() => {
          if (!cancelled) setIsVisible(true);
        });
      })
      .catch(() => {
        // En cas d'échec de lecture réseau, conserver le fond sombre sans casser l'UI
        if (!cancelled && !displayedSrc) {
          setIsVisible(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [wallpaper.src, wallpaper.kind, atelierMode, displayedSrc]);

  if (atelierMode) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none overflow-hidden"
      style={{
        zIndex: 0,
        backgroundColor: wallpaper.solidColor || '#070b14',
        transform: 'translateZ(0)',
      }}
    >
      {displayedSrc && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url("${displayedSrc}")`,
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'opacity',
            transform: 'translateZ(0)',
          }}
        />
      )}

      {/* Voile d'assombrissement calibré pour préserver une lisibilité atelier optimale */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(7, 11, 20, ${wallpaper.overlayOpacity}) 0%, rgba(7, 11, 20, ${Math.min(
            0.95,
            wallpaper.overlayOpacity + 0.08
          )}) 100%)`,
          transition: 'opacity 200ms ease-out',
        }}
      />
    </div>
  );
};
