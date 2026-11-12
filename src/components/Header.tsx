import React from 'react';
import { ConnectionMode, LicenseSession } from '../types/automotive';
import { ShieldCheck, Key, Mic } from 'lucide-react';

interface HeaderProps {
  activeTab: 'diagnostic' | 'history' | 'flash' | 'connection' | 'apps' | 'translator' | 'smartech' | 'packaging' | 'chinese_flasher' | 'comfort' | 'keyless';
  onSelectTab: (tab: 'diagnostic' | 'history' | 'flash' | 'connection' | 'apps' | 'translator' | 'smartech' | 'packaging' | 'chinese_flasher' | 'comfort' | 'keyless') => void;
  isConnected: boolean;
  connectionMode: ConnectionMode;
  onOpenConnectModal: () => void;
  licenseSession?: LicenseSession | null;
  onOpenLicenseModal?: () => void;
  matrixName?: string;
  onOpenVoiceModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  isConnected,
  connectionMode,
  onOpenConnectModal,
  licenseSession,
  onOpenLicenseModal,
  matrixName = 'Jarvis',
  onOpenVoiceModal,
}) => {
  const getModeLabel = (mode: ConnectionMode) => {
    switch (mode) {
      case 'cable':
        return 'Câble USB-C';
      case 'wifi':
        return 'WiFi Direct';
      case 'bluetooth':
        return 'Bluetooth 5.0';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-slate-950 text-sm shadow-sm">
            AP
          </div>
          <button
            onClick={() => onSelectTab('diagnostic')}
            className="text-lg font-bold tracking-tight text-white hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 text-left cursor-pointer"
          >
            AutoPro Diagnostic &amp; Flash
          </button>
        </div>

        {/* Zone 2: clean navigation links */}
        <nav className="hidden xl:flex items-center gap-4 text-sm font-medium text-slate-300">
          <button
            onClick={() => onSelectTab('diagnostic')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer ${
              activeTab === 'diagnostic'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Diagnostic &amp; DTC
          </button>
          <button
            onClick={() => onSelectTab('history')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Historique SaaS</span>
          </button>
          <button
            onClick={() => onSelectTab('flash')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer ${
              activeTab === 'flash'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Flash &amp; Reprog
          </button>
          <button
            onClick={() => onSelectTab('comfort')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'comfort'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Habitacle &amp; Clim</span>
          </button>
          <button
            onClick={() => onSelectTab('keyless')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'keyless'
                ? 'text-amber-400 border-amber-400 font-semibold'
                : 'border-transparent hover:text-amber-300 text-amber-400/90'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Clé 3m &amp; Antivol</span>
          </button>
          <button
            onClick={() => onSelectTab('chinese_flasher')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'chinese_flasher'
                ? 'text-rose-400 border-rose-400 font-semibold'
                : 'border-transparent hover:text-rose-300 text-rose-400/90'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Flash Écran Chinois</span>
          </button>
          <button
            onClick={() => onSelectTab('smartech')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'smartech'
                ? 'text-emerald-400 border-emerald-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Smartech DZ</span>
          </button>
          <button
            onClick={() => onSelectTab('connection')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer ${
              activeTab === 'connection'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Liaison
          </button>
          <button
            onClick={() => onSelectTab('apps')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer ${
              activeTab === 'apps'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Apps
          </button>
          <button
            onClick={() => onSelectTab('translator')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer ${
              activeTab === 'translator'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-white'
            }`}
          >
            Traducteur
          </button>
          <button
            onClick={() => onSelectTab('packaging')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-1 border-b-2 cursor-pointer text-amber-400 ${
              activeTab === 'packaging'
                ? 'border-amber-400 font-semibold text-amber-300'
                : 'border-transparent hover:text-amber-300 text-amber-400/90'
            }`}
          >
            Démo Pro
          </button>
        </nav>

        {/* Zone 3: 1 primary action + voice assistant + license badge */}
        <div className="flex items-center gap-2.5 shrink-0">
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
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-400 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              title="Cliquer pour afficher les détails de la licence active"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden md:inline font-mono text-[11px] max-w-[130px] truncate">
                {licenseSession.clientName || 'Licence Pro'}
              </span>
            </button>
          )}

          <button
            onClick={onOpenConnectModal}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
              isConnected
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900/60'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-slate-900'
              }`}
            />
            <span>
              {isConnected
                ? `Liaison Active (${getModeLabel(connectionMode)})`
                : 'Connecter Tablette'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile nav sub-bar */}
      <div className="flex lg:hidden overflow-x-auto gap-4 pt-3 mt-2 border-t border-slate-800/80 text-xs text-slate-300">
        <button
          onClick={() => onSelectTab('diagnostic')}
          className={`whitespace-nowrap py-1 ${activeTab === 'diagnostic' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Diagnostic
        </button>
        <button
          onClick={() => onSelectTab('history')}
          className={`whitespace-nowrap py-1 font-semibold ${activeTab === 'history' ? 'text-cyan-400 font-bold' : 'text-cyan-400/80'}`}
        >
          Historique
        </button>
        <button
          onClick={() => onSelectTab('flash')}
          className={`whitespace-nowrap py-1 ${activeTab === 'flash' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Flash ECU
        </button>
        <button
          onClick={() => onSelectTab('smartech')}
          className={`whitespace-nowrap py-1 font-semibold ${activeTab === 'smartech' ? 'text-emerald-400' : 'text-emerald-400/80'}`}
        >
          Smartech DZ
        </button>
        <button
          onClick={() => onSelectTab('chinese_flasher')}
          className={`whitespace-nowrap py-1 font-semibold ${activeTab === 'chinese_flasher' ? 'text-rose-400' : 'text-rose-400/80'}`}
        >
          Flash CN (Maps/YouTube)
        </button>
        <button
          onClick={() => onSelectTab('comfort')}
          className={`whitespace-nowrap py-1 font-semibold ${activeTab === 'comfort' ? 'text-cyan-400 font-bold' : 'text-cyan-400/80'}`}
        >
          Habitacle &amp; Climatisation
        </button>
        <button
          onClick={() => onSelectTab('keyless')}
          className={`whitespace-nowrap py-1 font-semibold ${activeTab === 'keyless' ? 'text-amber-400 font-bold' : 'text-amber-400/80'}`}
        >
          Clé 3m &amp; Antivol
        </button>
        <button
          onClick={() => onSelectTab('connection')}
          className={`whitespace-nowrap py-1 ${activeTab === 'connection' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Liaison Directe
        </button>
        <button
          onClick={() => onSelectTab('apps')}
          className={`whitespace-nowrap py-1 ${activeTab === 'apps' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Installateur
        </button>
        <button
          onClick={() => onSelectTab('translator')}
          className={`whitespace-nowrap py-1 ${activeTab === 'translator' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Traducteur
        </button>
        <button
          onClick={() => onSelectTab('packaging')}
          className={`whitespace-nowrap py-1 font-semibold ${activeTab === 'packaging' ? 'text-amber-300 font-bold' : 'text-amber-400/80'}`}
        >
          Partager Démo Pro
        </button>
      </div>
    </header>
  );
};
