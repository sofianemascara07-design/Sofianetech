import React from 'react';
import { ConnectionMode, LicenseSession } from '../types/automotive';
import { ShieldCheck, Mic, Sun, Camera, ShieldAlert, Clock, Wrench, Flame, Wallpaper } from 'lucide-react';

export type NavTab =
  | 'diagnostic'
  | 'history'
  | 'flash'
  | 'connection'
  | 'apps'
  | 'translator'
  | 'smartech'
  | 'packaging'
  | 'chinese_flasher'
  | 'comfort'
  | 'keyless'
  | 'cameras'
  | 'workshop_cn'
  | 'transmission'
  | 'coolray_lspi'
  | 'admin';

interface HeaderProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isConnected: boolean;
  connectionMode: ConnectionMode;
  hardwareTransport?: 'none' | 'ble' | 'serial' | 'demo';
  onOpenConnectModal: () => void;
  licenseSession?: LicenseSession | null;
  onOpenLicenseModal?: () => void;
  matrixName?: string;
  onOpenVoiceModal?: () => void;
  atelierMode?: boolean;
  onToggleAtelierMode?: () => void;
  onOpenWallpaperDrawer?: () => void;
  isAdmin?: boolean;
  demoRemainingText?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  isConnected,
  connectionMode,
  hardwareTransport = 'none',
  onOpenConnectModal,
  licenseSession,
  onOpenLicenseModal,
  matrixName = 'Jarvis',
  onOpenVoiceModal,
  atelierMode = false,
  onToggleAtelierMode,
  onOpenWallpaperDrawer,
  isAdmin = false,
  demoRemainingText,
}) => {
  const getModeLabel = (mode: ConnectionMode) => {
    if (hardwareTransport === 'ble') return 'ELM327 BLE Réel';
    if (hardwareTransport === 'serial') return 'ELM327 USB Réel';
    if (hardwareTransport === 'demo') return 'Démo Atelier';
    switch (mode) {
      case 'cable':
        return 'Câble USB-C';
      case 'wifi':
        return 'WiFi Direct';
      case 'bluetooth':
        return 'Bluetooth BLE';
    }
  };

  const canAccess = (tab: NavTab) => {
    if (isAdmin) return true;
    if (tab === 'admin') return false;
    const mods = licenseSession?.allowedModules;
    if (!mods || mods.length === 0) {
      return tab !== 'packaging';
    }
    if (tab === 'workshop_cn') {
      return mods.includes('workshop_cn') || mods.includes('diagnostic') || mods.includes('cameras');
    }
    if (tab === 'transmission') {
      return mods.includes('transmission') || mods.includes('diagnostic') || mods.includes('flash');
    }
    if (tab === 'coolray_lspi') {
      return (
        mods.includes('coolray_lspi') ||
        mods.includes('diagnostic') ||
        mods.includes('flash') ||
        mods.includes('workshop_cn')
      );
    }
    return mods.includes(tab);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto space-y-2.5">
        {/* Row 1: Wordmark + Primary Action Controls */}
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-slate-950 text-sm shadow-sm">
              AP
            </div>
            <button
              onClick={() => onSelectTab(isAdmin ? 'admin' : 'diagnostic')}
              className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 text-left cursor-pointer"
            >
              AutoPro Diagnostic &amp; Flash
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {demoRemainingText && (
              <div className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-300 flex items-center gap-1.5 animate-pulse">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <span>Démo : {demoRemainingText}</span>
              </div>
            )}

            {onToggleAtelierMode && (
              <button
                onClick={onToggleAtelierMode}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm ${
                  atelierMode
                    ? 'bg-yellow-400 text-black border-yellow-300 hover:bg-yellow-300'
                    : 'bg-slate-900 border-amber-500/40 hover:border-amber-400 text-amber-300'
                }`}
                title="Activer/Désactiver le Mode Atelier fort contraste (plein soleil & garage sombre)"
              >
                <Sun className={`w-3.5 h-3.5 ${atelierMode ? 'text-black' : 'text-amber-400'}`} />
                <span className="text-[11px]">
                  {atelierMode ? 'Atelier ON' : 'Mode Atelier'}
                </span>
              </button>
            )}

            {onOpenWallpaperDrawer && (
              <button
                type="button"
                onClick={onOpenWallpaperDrawer}
                className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-200 hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                title="Changer le fond d'écran tablette Android (WebP / Galerie)"
              >
                <Wallpaper className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline text-[11px]">Fond d&apos;écran</span>
              </button>
            )}

            {onOpenVoiceModal && (
              <button
                onClick={onOpenVoiceModal}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                title={`Ouvrir la Commande Vocale IA (${matrixName})`}
              >
                <Mic className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span className="hidden sm:inline font-mono text-[11px] font-bold">
                  {matrixName}
                </span>
              </button>
            )}

            {licenseSession && (
              <button
                onClick={onOpenLicenseModal}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm ${
                  isAdmin
                    ? 'border-amber-500/60 hover:border-amber-400 text-amber-300'
                    : 'border-emerald-500/40 hover:border-emerald-400 text-emerald-400'
                }`}
                title="Cliquer pour afficher les détails de la session active"
              >
                {isAdmin ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="hidden md:inline font-mono text-[11px] max-w-[140px] truncate">
                  {isAdmin ? 'ADMIN SOFIANE' : licenseSession.clientName || 'Abonné Pro'}
                </span>
              </button>
            )}

            <button
              onClick={onOpenConnectModal}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                isConnected && (hardwareTransport === 'ble' || hardwareTransport === 'serial')
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/70 hover:bg-emerald-900/60'
                  : isConnected && hardwareTransport === 'demo'
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-600/60 hover:bg-amber-900/60'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected && (hardwareTransport === 'ble' || hardwareTransport === 'serial')
                    ? 'bg-emerald-400 animate-pulse'
                    : isConnected && hardwareTransport === 'demo'
                    ? 'bg-amber-400'
                    : 'bg-slate-900'
                }`}
              />
              <span>
                {isConnected
                  ? getModeLabel(connectionMode)
                  : 'Connecter Voiture (OBD2)'}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Unified Responsive Navigation */}
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-slate-800/80 text-xs sm:text-[13px] font-medium text-slate-300">
          {isAdmin && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'text-amber-300 border-amber-400 font-extrabold'
                  : 'border-transparent hover:text-amber-300 text-amber-400'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin &amp; Abonnés</span>
            </button>
          )}

          {canAccess('diagnostic') && (
            <button
              onClick={() => onSelectTab('diagnostic')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer ${
                activeTab === 'diagnostic'
                  ? 'text-cyan-400 border-cyan-400 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Diagnostic &amp; DTC
            </button>
          )}

          {canAccess('history') && (
            <button
              onClick={() => onSelectTab('history')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'text-cyan-400 border-cyan-400 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Historique SaaS</span>
            </button>
          )}

          {canAccess('cameras') && (
            <button
              onClick={() => onSelectTab('cameras')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'cameras'
                  ? 'text-cyan-300 border-cyan-400 font-bold'
                  : 'border-transparent hover:text-cyan-300 text-cyan-400'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>Caméras &amp; ADAS</span>
            </button>
          )}

          {canAccess('workshop_cn') && (
            <button
              onClick={() => onSelectTab('workshop_cn')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'workshop_cn'
                  ? 'text-cyan-300 border-cyan-400 font-bold'
                  : 'border-transparent hover:text-cyan-300 text-cyan-400/90'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              <span>Atelier CN (Pinouts · ADAS · VIN)</span>
            </button>
          )}

          {canAccess('transmission') && (
            <button
              onClick={() => onSelectTab('transmission')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'transmission'
                  ? 'text-cyan-300 border-cyan-400 font-bold'
                  : 'border-transparent hover:text-cyan-300 text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Boîte &amp; TCU UDS</span>
            </button>
          )}

          {canAccess('coolray_lspi') && (
            <button
              onClick={() => onSelectTab('coolray_lspi')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'coolray_lspi'
                  ? 'text-rose-300 border-rose-400 font-bold'
                  : 'border-transparent hover:text-rose-300 text-rose-400/90'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Coolray Anti-LSPI</span>
            </button>
          )}

          {canAccess('flash') && (
            <button
              onClick={() => onSelectTab('flash')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer ${
                activeTab === 'flash'
                  ? 'text-cyan-400 border-cyan-400 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Flash &amp; Reprog
            </button>
          )}

          {canAccess('comfort') && (
            <button
              onClick={() => onSelectTab('comfort')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'comfort'
                  ? 'text-cyan-400 border-cyan-400 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Habitacle &amp; Clim</span>
            </button>
          )}

          {canAccess('keyless') && (
            <button
              onClick={() => onSelectTab('keyless')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'keyless'
                  ? 'text-amber-400 border-amber-400 font-semibold'
                  : 'border-transparent hover:text-amber-300 text-amber-400/90'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Clé 3m &amp; Antivol</span>
            </button>
          )}

          {canAccess('chinese_flasher') && (
            <button
              onClick={() => onSelectTab('chinese_flasher')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'chinese_flasher'
                  ? 'text-rose-400 border-rose-400 font-semibold'
                  : 'border-transparent hover:text-rose-300 text-rose-400/90'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Flash Cockpit &amp; Écrans CN</span>
            </button>
          )}

          {canAccess('smartech') && (
            <button
              onClick={() => onSelectTab('smartech')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'smartech'
                  ? 'text-emerald-400 border-emerald-400 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Smartech DZ</span>
            </button>
          )}

          {canAccess('connection') && (
            <button
              onClick={() => onSelectTab('connection')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer ${
                activeTab === 'connection'
                  ? 'text-cyan-400 border-cyan-400 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Liaison
            </button>
          )}

          {canAccess('apps') && (
            <button
              onClick={() => onSelectTab('apps')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer ${
                activeTab === 'apps'
                  ? 'text-cyan-400 border-cyan-400 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Apps
            </button>
          )}

          {canAccess('translator') && (
            <button
              onClick={() => onSelectTab('translator')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer ${
                activeTab === 'translator'
                  ? 'text-cyan-400 border-cyan-400 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Traducteur
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => onSelectTab('packaging')}
              className={`whitespace-nowrap transition-colors pb-1 border-b-2 cursor-pointer text-amber-400 ${
                activeTab === 'packaging'
                  ? 'border-amber-400 font-semibold text-amber-300'
                  : 'border-transparent hover:text-amber-300 text-amber-400/90'
              }`}
            >
              Outils Business
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
