import React, { useEffect, useState } from 'react';
import { ConnectionMode } from '../types/automotive';
import { Cable, Bluetooth, CheckCircle2, X, RefreshCw, AlertTriangle, Play, Unplug } from 'lucide-react';
import { obdHardwareBridge, ObdHardwareStatus } from '../utils/obdHardwareBridge';

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
  setConnectionMode,
  batteryVoltage,
}) => {
  const [hwStatus, setHwStatus] = useState<ObdHardwareStatus>(() => obdHardwareBridge.getStatus());
  const [busyMode, setBusyMode] = useState<'ble' | 'serial' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState<number>(38400);

  useEffect(() => {
    return obdHardwareBridge.subscribe(setHwStatus);
  }, []);

  if (!isOpen) return null;

  const handleConnectBle = async () => {
    setErrorMsg(null);
    setBusyMode('ble');
    setConnectionMode('bluetooth');
    try {
      await obdHardwareBridge.connectBluetoothBLE();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Échec de connexion Bluetooth BLE.');
    } finally {
      setBusyMode(null);
    }
  };

  const handleConnectUsb = async () => {
    setErrorMsg(null);
    setBusyMode('serial');
    setConnectionMode('cable');
    try {
      await obdHardwareBridge.connectUsbSerial(baudRate);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Échec de connexion USB WebSerial.');
    } finally {
      setBusyMode(null);
    }
  };

  const handleEnableDemo = () => {
    setErrorMsg(null);
    obdHardwareBridge.activateDemoMode();
    onClose();
  };

  const handleDisconnect = async () => {
    setErrorMsg(null);
    await obdHardwareBridge.disconnect();
  };

  const isRealHw = hwStatus.connected && (hwStatus.transport === 'ble' || hwStatus.transport === 'serial');
  const isDemo = hwStatus.connected && hwStatus.transport === 'demo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            Connexion Véhicule Réel (OBD2 ELM327)
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Live Status */}
        {isRealHw && (
          <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-700/60 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Matériel connecté : {hwStatus.deviceName}
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-900/70 text-emerald-200">
                {hwStatus.transport.toUpperCase()}
              </span>
            </div>
            <div className="text-slate-300 font-mono text-[11px] space-y-0.5">
              <div>Adaptateur : {hwStatus.adapterVersion || 'Détecté'}</div>
              <div>Protocole : {hwStatus.protocolName || 'Auto'}</div>
              <div>
                Calculateur voiture :{' '}
                {hwStatus.ecuResponding ? (
                  <span className="text-emerald-400 font-bold">EN LIGNE (Réponse OK)</span>
                ) : (
                  <span className="text-amber-400 font-bold">Pas de réponse ECU (Contact OFF ?)</span>
                )}
              </div>
              {hwStatus.vin && <div>VIN : {hwStatus.vin}</div>}
            </div>
          </div>
        )}

        {isDemo && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/50 text-xs text-amber-200 flex items-center justify-between gap-2">
            <span>Mode Démo Atelier actif (valeurs simulées sans voiture).</span>
            <button
              onClick={handleDisconnect}
              className="text-[11px] font-bold text-rose-300 hover:underline cursor-pointer shrink-0"
            >
              Quitter Démo
            </button>
          </div>
        )}

        {(errorMsg || hwStatus.lastError) && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg || hwStatus.lastError}</span>
          </div>
        )}

        {/* Option 1: Real Bluetooth BLE (Android Chrome + PC Chrome) */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={busyMode !== null}
            onClick={handleConnectBle}
            className="w-full p-4 rounded-xl border border-indigo-500/50 bg-slate-950 hover:border-indigo-400 hover:bg-indigo-950/20 transition-all text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center shrink-0">
                {busyMode === 'ble' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Bluetooth className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  1. Bluetooth Low Energy (BLE 4.0 / 5.0) — Android &amp; PC
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Pour boîtiers BLE (Vgate iCar Pro BLE, vLinker BLE, Viecar BLE).
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/70 px-2 py-1 rounded shrink-0">
              {obdHardwareBridge.isWebBluetoothSupported() ? 'Prêt' : 'Indispo'}
            </span>
          </button>

          {/* Option 2: Real USB Web Serial (PC Chrome / Edge) */}
          <div className="p-4 rounded-xl border border-cyan-500/40 bg-slate-950 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center shrink-0">
                  {busyMode === 'serial' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Cable className="w-5 h-5" />}
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    2. Câble USB ELM327 (Web Serial) — PC Windows / Linux
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Câble USB FTDI / CH340 / OBDLink EX sur Chrome ou Edge PC.
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/70 px-2 py-1 rounded shrink-0">
                {obdHardwareBridge.isWebSerialSupported() ? 'Prêt PC' : 'PC requis'}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200"
              >
                <option value={38400}>38400 bps (ELM327 Standard)</option>
                <option value={115200}>115200 bps (STN / vLinker)</option>
                <option value={9600}>9600 bps (Anciens ELM)</option>
              </select>
              <button
                type="button"
                disabled={busyMode !== null}
                onClick={handleConnectUsb}
                className="flex-1 py-1.5 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {busyMode === 'serial' ? 'Ouverture port USB...' : 'Sélectionner Port USB'}
              </button>
            </div>
          </div>

          {/* Compatibility Reality Note */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-slate-200 block mb-0.5">Important compatibilité navigateur :</strong>
            • Sur <strong>téléphone Android</strong> (Chrome), utilisez un adaptateur <strong>Bluetooth BLE 4.0+</strong> (les anciens ELM327 bleus Bluetooth 2.0 SPP ne sont pas visibles par Chrome Web).<br />
            • Mettez le <strong>contact véhicule sur ON</strong> avant de scanner les calculateurs.
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">Tension OBD mesurée :</span>
          <span className="font-mono font-bold text-emerald-400 tabular-nums">
            {(hwStatus.batteryVoltage ?? batteryVoltage).toFixed(1)} V
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          {hwStatus.connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full py-2.5 text-xs font-bold rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unplug className="w-4 h-4" />
              <span>Déconnecter la Liaison</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnableDemo}
              className="w-full py-2.5 text-xs font-semibold rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Activer Mode Démo Atelier (Sans Voiture)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
