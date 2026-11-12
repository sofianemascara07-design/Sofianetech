import React from 'react';
import { ConnectionMode } from '../types/automotive';
import { Cable, Wifi, Bluetooth, CheckCircle2, X, RefreshCw } from 'lucide-react';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionMode: ConnectionMode;
  setConnectionMode: (mode: ConnectionMode) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  batteryVoltage: number;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  connectionMode,
  setConnectionMode,
  isConnected,
  setIsConnected,
  batteryVoltage,
}) => {
  if (!isOpen) return null;

  const handleToggle = () => {
    setIsConnected(!isConnected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Gestionnaire de Liaison Mobile ↔ Tablette</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Sélectionnez le mode de transmission physique ou sans fil reliant votre smartphone à la tablette automobile et à la prise OBD2 :
        </p>

        <div className="space-y-3">
          <div
            onClick={() => setConnectionMode('cable')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              connectionMode === 'cable'
                ? 'bg-slate-950 border-cyan-500 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-950/80 text-cyan-400 flex items-center justify-center">
                <Cable className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Câble USB-C / OTG Direct</span>
                <span className="text-[11px] text-slate-400">Recommandé pour Reprogrammation ECU &amp; Flash</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded">
              480 Mbps
            </span>
          </div>

          <div
            onClick={() => setConnectionMode('wifi')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              connectionMode === 'wifi'
                ? 'bg-slate-950 border-cyan-500 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-950/80 text-blue-400 flex items-center justify-center">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">WiFi Direct / Point d'Accès</span>
                <span className="text-[11px] text-slate-400">Idéal pour Sideload Apps &amp; Streaming Télémétrie</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-blue-400 bg-slate-900 px-2 py-0.5 rounded">
              Port 35000
            </span>
          </div>

          <div
            onClick={() => setConnectionMode('bluetooth')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              connectionMode === 'bluetooth'
                ? 'bg-slate-950 border-cyan-500 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-950/80 text-indigo-400 flex items-center justify-center">
                <Bluetooth className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Bluetooth 5.0 Low Energy (BLE)</span>
                <span className="text-[11px] text-slate-400">Scan rapide des codes défauts (DTC)</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-indigo-400 bg-slate-900 px-2 py-0.5 rounded">
              ELM327 / OBD
            </span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800">
          <span className="text-slate-400">Tension d'Alimentation :</span>
          <span className="font-mono font-bold text-emerald-400 tabular-nums">
            {batteryVoltage.toFixed(1)} V (Sécurisé)
          </span>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => {
              handleToggle();
              onClose();
            }}
            className={`w-full py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              isConnected
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            {isConnected ? 'Déconnecter la Liaison' : 'Activer la Liaison Immédiate'}
          </button>
        </div>
      </div>
    </div>
  );
};
