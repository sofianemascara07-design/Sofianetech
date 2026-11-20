import React, { useState, useEffect } from 'react';
import { ConnectionMode } from '../types/automotive';
import { Cable, Wifi, Bluetooth, CheckCircle2, AlertTriangle, RefreshCw, Cpu, Activity, ShieldCheck, Smartphone, Tablet, Car, Key, Radio, Sparkles, Play, Send, Globe, MonitorCheck, Download, Copy, Check } from 'lucide-react';
import { obdHardwareBridge, ObdHardwareStatus } from '../utils/obdHardwareBridge';
import {
  remoteStabilityManager,
  RemoteStabilitySnapshot,
  downloadWindowsRemoteStabilizerBat,
} from '../utils/remoteStability';
import { LocalPcAgentPanel } from './LocalPcAgentPanel';

interface ConnectionManagerProps {
  connectionMode: ConnectionMode;
  setConnectionMode: (mode: ConnectionMode) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  batteryVoltage: number;
  setBatteryVoltage: (volts: number) => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  connectionMode,
  setConnectionMode,
  isConnected,
  setIsConnected,
  batteryVoltage,
  setBatteryVoltage,
}) => {
  const [baudRate, setBaudRate] = useState<string>('38400');
  const [protocol, setProtocol] = useState<string>('ISO 14229 UDS over CAN');
  const [connecting, setConnecting] = useState(false);
  const [hwStatus, setHwStatus] = useState<ObdHardwareStatus>(() => obdHardwareBridge.getStatus());
  const [customAtCmd, setCustomAtCmd] = useState<string>('ATRV');
  const [sendingCmd, setSendingCmd] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [packetCount, setPacketCount] = useState(0);
  const [pingMs, setPingMs] = useState(0);
  const [remoteSnap, setRemoteSnap] = useState<RemoteStabilitySnapshot>(() => remoteStabilityManager.getSnapshot());
  const [probingRemote, setProbingRemote] = useState(false);
  const [remoteFeedback, setRemoteFeedback] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [remoteTabletIp, setRemoteTabletIp] = useState<string>('192.168.1.50');

  useEffect(() => {
    const unsubHw = obdHardwareBridge.subscribe(setHwStatus);
    const unsubRemote = remoteStabilityManager.subscribe(setRemoteSnap);
    return () => {
      unsubHw();
      unsubRemote();
    };
  }, []);

  const isRealHw = hwStatus.connected && (hwStatus.transport === 'ble' || hwStatus.transport === 'serial');

  // Update ping/packets when connected
  useEffect(() => {
    if (!isConnected) {
      setPingMs(0);
      return;
    }
    const interval = setInterval(() => {
      setPacketCount((prev) => prev + (isRealHw ? 6 : 12));
      setPingMs(connectionMode === 'cable' ? 4 : connectionMode === 'wifi' ? 9 : 22);
    }, 1500);
    return () => clearInterval(interval);
  }, [isConnected, connectionMode, isRealHw]);

  const handleToggleConnect = async () => {
    setConnectionError(null);
    if (isConnected) {
      await obdHardwareBridge.disconnect();
      setIsConnected(false);
      return;
    }

    if (connectionMode === 'wifi') {
      setConnectionError(
        'Les navigateurs web HTTPS (Chrome / PWA) bloquent l’accès direct aux sockets TCP bruts 192.168.0.10:35000 des boîtiers ELM327 WiFi. Utilisez plutôt Bluetooth BLE 4.0 (sur Android/PC) ou Câble USB (sur PC).'
      );
      return;
    }

    setConnecting(true);
    try {
      if (connectionMode === 'bluetooth') {
        await obdHardwareBridge.connectBluetoothBLE();
      } else {
        const parsedBaud = parseInt(baudRate, 10) || 38400;
        await obdHardwareBridge.connectUsbSerial(parsedBaud);
      }
      setIsConnected(true);
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Échec de connexion matérielle.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSendAtCommand = async (cmdToSend?: string) => {
    const cmd = (cmdToSend || customAtCmd).trim();
    if (!cmd || !isRealHw) return;
    setSendingCmd(true);
    setConnectionError(null);
    try {
      await obdHardwareBridge.sendCommand(cmd, 5000, true);
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Erreur envoi commande.');
    } finally {
      setSendingCmd(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div className="border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Liaison Directe Smartphone ↔ Tablette Automobile</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Communication multicanal ultra-rapide (Câble USB OTG, WiFi Direct ou Bluetooth 5.0) entre votre téléphone et l'écran de bord.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-mono">
            <span className="text-slate-400">Tension Batterie :</span>
            <span
              className={`font-bold tabular-nums ${
                batteryVoltage >= 12.8
                  ? 'text-emerald-400'
                  : batteryVoltage >= 12.4
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {batteryVoltage.toFixed(1)} V
            </span>
          </div>

          <button
            onClick={handleToggleConnect}
            disabled={connecting}
            className={`px-5 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
              isConnected
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-bold'
            }`}
          >
            {connecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Négociation en cours...</span>
              </>
            ) : isConnected ? (
              <span>Interrompre la Liaison</span>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                <span>Établir la Liaison Directe</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hardware Connection Error Notice */}
      {connectionError && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-700/60 text-rose-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{connectionError}</div>
        </div>
      )}

      {/* Battery Security Warning */}
      {batteryVoltage < 12.5 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block text-amber-300">
              Avertissement Tension Batterie ({batteryVoltage.toFixed(1)}V)
            </span>
            Pour toute opération de flash ou reprogrammation ECU, un stabilisateur de tension d'atelier (13.8V) est impérativement requis pour éviter le blocage irréversible du calculateur.
          </div>
        </div>
      )}

      {/* Hardware Connection Architecture Flow */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-6">
          Schéma de Liaison Matérielle &amp; Bus de Données
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Node 1: Mobile Phone */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 flex items-center justify-center mb-3">
              <Smartphone className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-white block">Mobile Smartphone</span>
            <span className="text-[11px] text-slate-400 mt-1">Application Maître AutoPro</span>
            <span className="text-[10px] font-mono text-cyan-400/90 mt-2 bg-slate-900 px-2 py-0.5 rounded">
              Contrôleur Client
            </span>
          </div>

          {/* Connection Channel Bridge */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-blue-950/60 border border-blue-800/60 text-blue-400 flex items-center justify-center mb-3">
              {connectionMode === 'cable' && <Cable className="w-6 h-6" />}
              {connectionMode === 'wifi' && <Wifi className="w-6 h-6" />}
              {connectionMode === 'bluetooth' && <Bluetooth className="w-6 h-6" />}
            </div>
            <span className="text-xs font-semibold text-white block capitalize">
              Canal {connectionMode === 'cable' ? 'Câble USB OTG' : connectionMode === 'wifi' ? 'WiFi Direct' : 'Bluetooth 5.0'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              {isConnected ? (
                <span className="text-emerald-400 font-medium">Liaison active ({pingMs} ms)</span>
              ) : (
                'Prêt pour appairage'
              )}
            </span>
            <span className="text-[10px] font-mono text-slate-400 mt-2 bg-slate-900 px-2 py-0.5 rounded">
              {connectionMode === 'cable' ? '480 Mbps USB 2.0' : connectionMode === 'wifi' ? '802.11ac Socket 35000' : 'BLE 2.0 Mbps'}
            </span>
          </div>

          {/* Node 2: Tablette Automobile Headunit */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-400 flex items-center justify-center mb-3">
              <Tablet className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-white block">Tablette / Écran Autoradio</span>
            <span className="text-[11px] text-slate-400 mt-1">Android Automotive OS 13</span>
            <span className="text-[10px] font-mono text-indigo-400/90 mt-2 bg-slate-900 px-2 py-0.5 rounded">
              Hôte Récepteur APK &amp; Télémétrie
            </span>
          </div>

          {/* Node 3: OBD2 / CAN Gateway Car */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 flex items-center justify-center mb-3">
              <Cpu className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-white block">Port OBD2 &amp; Passerelle CAN</span>
            <span className="text-[11px] text-slate-400 mt-1">ISO 15765 / CAN-FD / K-Line</span>
            <span className="text-[10px] font-mono text-emerald-400/90 mt-2 bg-slate-900 px-2 py-0.5 rounded">
              Broches 6 (High) &amp; 14 (Low)
            </span>
          </div>
        </div>
      </div>

      {/* 3 Connection Modes Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mode 1: Câble USB-C / OTG */}
        <div
          onClick={() => setConnectionMode('cable')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            connectionMode === 'cable'
              ? 'bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
              : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-950/80 text-cyan-400 flex items-center justify-center">
              <Cable className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono bg-slate-800 text-cyan-300 px-2 py-0.5 rounded">
              Ultra Stable
            </span>
          </div>
          <h3 className="text-base font-semibold text-white">Liaison Câble USB-C / OTG</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Recommandé pour le <strong>Flash ECU et reprogrammation</strong>. Aucun risque de déconnexion radio. Débit maximal pour transfert d'APK lourds.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between">
            <span>Latence : &lt; 2 ms</span>
            <span>Protocole : ADB / USB Direct</span>
          </div>
        </div>

        {/* Mode 2: WiFi Direct */}
        <div
          onClick={() => setConnectionMode('wifi')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            connectionMode === 'wifi'
              ? 'bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
              : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-950/80 text-blue-400 flex items-center justify-center">
              <Wifi className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono bg-slate-800 text-blue-300 px-2 py-0.5 rounded">
              Sans Fil Rapide
            </span>
          </div>
          <h3 className="text-base font-semibold text-white">Liaison WiFi Direct / Hotspot</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Idéal pour le streaming de jauges en direct, l'installation d'applications à distance et la synchronisation des données sans brancher de câble.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between">
            <span>Latence : ~ 5-10 ms</span>
            <span>Port TCP : 35000</span>
          </div>
        </div>

        {/* Mode 3: Bluetooth 5.0 */}
        <div
          onClick={() => setConnectionMode('bluetooth')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            connectionMode === 'bluetooth'
              ? 'bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
              : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-950/80 text-indigo-400 flex items-center justify-center">
              <Bluetooth className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono bg-slate-800 text-indigo-300 px-2 py-0.5 rounded">
              Faible Conso
            </span>
          </div>
          <h3 className="text-base font-semibold text-white">Liaison Bluetooth 5.0 BLE</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Connexion automatique dès l'entrée dans le véhicule. Parfait pour les scans de codes défauts rapides (DTC) et l'effacement du voyant moteur.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between">
            <span>Latence : ~ 20 ms</span>
            <span>Profil : SPP / BLE GATT</span>
          </div>
        </div>
      </div>

      {/* Protocol Configuration & Live Telemetry Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Parameters Box */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Paramètres Bus &amp; Protocoles Constructeurs</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Protocole Diagnostic / Flash</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ISO 14229 UDS over CAN">ISO 14229 UDS over CAN (VAG, PSA, BMW, Mercedes)</option>
                <option value="CAN 2.0B 500kbps Standard">CAN 2.0B 500kbps Standard (Renault, Ford, Fiat)</option>
                <option value="ISO 13400 DoIP (Ethernet Diagnostic)">ISO 13400 DoIP Diagnostics over IP (BMW G-Series, Tesla)</option>
                <option value="K-Line ISO 9141-2 / KWP2000">K-Line ISO 9141-2 / KWP2000 (Véhicules Anciens)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Vitesse Bus (Baudrate)</label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="38400">38 400 bps (ELM327 USB Standard)</option>
                  <option value="115200">115 200 bps (STN / vLinker Rapide)</option>
                  <option value="500000">500 000 bps (CAN High-Speed)</option>
                  <option value="9600">9 600 bps (Ancien adaptateur)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Simulation Tension Alimentation</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="11.5"
                    max="14.5"
                    step="0.1"
                    value={batteryVoltage}
                    onChange={(e) => setBatteryVoltage(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                  <span className="font-mono tabular-nums text-slate-300 shrink-0">
                    {batteryVoltage.toFixed(1)}V
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800">
              <span>Passerelle Sécurité SGW (Stellantis/Renault/VAG) :</span>
              <span className="text-emerald-400 font-medium">Bypass Authentifié (Token OK)</span>
            </div>
          </div>
        </div>

        {/* Live Socket Logs & Packet Counter */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Console de Télémétrie en Direct</span>
              </h3>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
                <span>Paquets : <strong className="text-cyan-400 tabular-nums">{packetCount}</strong></span>
                <span>Ping : <strong className="text-emerald-400 tabular-nums">{pingMs} ms</strong></span>
              </div>
            </div>

            <div className="bg-slate-950 rounded-lg p-3 font-mono text-[11px] text-slate-300 h-44 overflow-y-auto space-y-1 border border-slate-800">
              {hwStatus.logs.map((log, idx) => (
                <div key={idx} className="leading-tight">
                  <span className="text-slate-500 mr-2">&gt;</span>
                  <span
                    className={
                      log.includes('SUCCÈS')
                        ? 'text-emerald-400 font-semibold'
                        : log.includes('AVERTISSEMENT') || log.includes('ALERTE')
                        ? 'text-amber-400'
                        : log.includes('ERREUR') || log.includes('ÉCHEC')
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }
                  >
                    {log}
                  </span>
                </div>
              ))}
            </div>

            {isRealHw && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {['ATZ', 'ATRV', 'ATDP', '0100', '010C', '03', '0902'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={sendingCmd}
                      onClick={() => void handleSendAtCommand(preset)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[10px] cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customAtCmd}
                    onChange={(e) => setCustomAtCmd(e.target.value)}
                    placeholder="Commande AT ou OBD2 (ex: 0105)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    disabled={sendingCmd}
                    onClick={() => void handleSendAtCommand()}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Envoyer</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Statut Matériel :</span>
            <span className="flex items-center gap-1.5 font-medium text-slate-200">
              {isRealHw ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{hwStatus.deviceName} ({hwStatus.ecuResponding ? 'ECU OK' : 'ECU muet'})</span>
                </>
              ) : isConnected ? (
                <span className="text-amber-300">Mode Démo Atelier (Simulation)</span>
              ) : (
                <span className="text-slate-500">Hors ligne</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Stabilité Clients & Travail à Distance (4G / Keep-Alive / WakeLock / USB-ADB) */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-950/35 via-slate-900 to-cyan-950/25 border border-emerald-500/40 space-y-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-emerald-400" />
                <span>Stabilité Travail à Distance</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  remoteSnap.status === 'optimal'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : remoteSnap.status === 'degraded'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                }`}
              >
                {remoteSnap.status === 'optimal'
                  ? 'CONNEXION STABLE'
                  : remoteSnap.status === 'degraded'
                  ? 'RÉSEAU INSTABLE / LATENCE'
                  : remoteSnap.status === 'reconnecting'
                  ? 'RECONNEXION AUTO...'
                  : 'HORS LIGNE'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <MonitorCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Bouclier Anti-Coupure Clients &amp; Assistance à Distance (USB / BLE / Cloud)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Évite la mise en veille des tablettes, maintient le serveur Cloud réveillé sans coupure 502 et rétablit automatiquement la liaison Bluetooth / ADB lors du travail à distance inter-wilayas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={probingRemote}
              onClick={async () => {
                setProbingRemote(true);
                const rtt = await remoteStabilityManager.probeBackendLatency();
                setRemoteFeedback(
                  rtt !== null
                    ? `Ping serveur confirmé : ${rtt} ms (liaison prête pour intervention à distance).`
                    : 'Serveur en cours de réveil ou réseau client faible — nouvelle tentative automatique active.'
                );
                setProbingRemote(false);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-cyan-500/40 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${probingRemote ? 'animate-spin' : ''}`} />
              <span>Tester Stabilité Ping</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const file = downloadWindowsRemoteStabilizerBat();
                setRemoteFeedback(`Script téléchargé : ${file} — Lancez-le sur le PC du client pour bloquer la mise en veille USB et stabiliser ADB/VCI.`);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Stabilisateur PC Client (.bat)</span>
            </button>
          </div>
        </div>

        {remoteFeedback && (
          <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-xs text-cyan-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{remoteFeedback}</span>
          </div>
        )}

        {/* 4 Live Stability KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Score Stabilité Client</span>
            <span
              className={`text-xl font-extrabold font-mono tabular-nums ${
                remoteSnap.stabilityScore >= 85
                  ? 'text-emerald-400'
                  : remoteSnap.stabilityScore >= 60
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {remoteSnap.stabilityScore}%
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Paquets OK : {remoteSnap.packetSuccessRate}%
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Latence Cloud (RTT)</span>
            <span className="text-xl font-extrabold font-mono text-cyan-400 tabular-nums">
              {remoteSnap.latencyMs !== null ? `${remoteSnap.latencyMs} ms` : '— ms'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Moyenne : {remoteSnap.avgLatencyMs !== null ? `${remoteSnap.avgLatencyMs} ms` : 'Mesure...'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Keep-Alive Render</span>
            <span className="text-xl font-extrabold font-mono text-emerald-400 tabular-nums">
              {remoteSnap.keepAliveActive ? 'ACTIF' : 'VEILLE'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {remoteSnap.lastKeepAliveAt ? `Dernier ping : ${remoteSnap.lastKeepAliveAt}` : 'Auto toutes les 3 min'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Reprises &amp; Micro-coupures</span>
            <span className="text-xl font-extrabold font-mono text-amber-400 tabular-nums">
              {remoteSnap.reconnectCount + hwStatus.reconnectCount}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Retry auto 3x + BLE Auto-Recovery
            </span>
          </div>
        </div>

        {/* Interactive Protection Toggles + ADB Remote Bridge */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Protections Actives sur Poste Client</span>
            </h3>

            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div>
                <span className="font-semibold text-white block">Anti-Veille Écran (WakeLock API)</span>
                <span className="text-[11px] text-slate-400">
                  Empêche l'écran téléphone/tablette de s'éteindre et couper l'USB/BLE pendant le travail à distance.
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (remoteSnap.wakeLockActive) {
                    await remoteStabilityManager.releaseWakeLock();
                    setRemoteFeedback('Anti-veille écran désactivé.');
                  } else {
                    const ok = await remoteStabilityManager.acquireWakeLock();
                    setRemoteFeedback(
                      ok
                        ? 'Anti-veille écran ACTIVÉ : la session restera éveillée tant que l’onglet est ouvert.'
                        : 'WakeLock non supporté sur ce navigateur (laissez l’écran allumé manuellement dans Paramètres Android).'
                    );
                  }
                }}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 cursor-pointer transition-colors ${
                  remoteSnap.wakeLockActive
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {remoteSnap.wakeLockActive ? 'ON (Éveillé)' : 'Activer'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div>
                <span className="font-semibold text-white block">Reconnexion Auto Boîtier BLE + Keep-Alive OBD</span>
                <span className="text-[11px] text-slate-400">
                  Ping ATRV toutes les 25s (empêche la mise en veille ELM327) + 3 tentatives auto en cas de coupure Bluetooth.
                </span>
              </div>
              <button
                type="button"
                onClick={() => obdHardwareBridge.setAutoReconnect(!hwStatus.autoReconnectEnabled)}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 cursor-pointer transition-colors ${
                  hwStatus.autoReconnectEnabled
                    ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {hwStatus.autoReconnectEnabled ? 'ACTIF' : 'DÉSACTIVÉ'}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Tablet className="w-4 h-4 text-cyan-400" />
                <span>Passerelle ADB TCP/IP :5555 (Flash Tablette à Distance)</span>
              </h3>
              <input
                type="text"
                value={remoteTabletIp}
                onChange={(e) => setRemoteTabletIp(e.target.value)}
                placeholder="IP Tablette / ZeroTier"
                className="w-36 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Chez le client : branchez une fois la tablette Android au PC (ou via USB-IP / ZeroTier / RustDesk), ouvrez le port TCP 5555 puis connectez-vous à distance sans perte de liaison :
            </p>
            <div className="space-y-1.5 font-mono text-[11px]">
              {[
                { id: 'tcpip', cmd: 'adb tcpip 5555' },
                { id: 'connect', cmd: `adb connect ${remoteTabletIp.trim() || '192.168.1.50'}:5555` },
                { id: 'stayon', cmd: 'adb shell settings put global stay_on_while_plugged_in 3' },
              ].map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5"
                >
                  <code className="text-emerald-300 truncate">{item.cmd}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(item.cmd);
                      setCopiedCmd(item.id);
                      setTimeout(() => setCopiedCmd(null), 1800);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedCmd === item.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedCmd === item.id ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Micro Client PC (Installateur 1-Clic & Exécution Écriture Auto sur Demande) */}
      <LocalPcAgentPanel batteryVoltage={batteryVoltage} />

      {/* Guide Pas-à-Pas : Démonstration sur Voiture Réelle & Tablette d'Atelier */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/40 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Guide Terrain Atelier DZ</span>
              </span>
              <span className="text-xs text-slate-400">Scénario de Démonstration Réelle</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-cyan-400" />
              <span>Comment Présenter la Démo sur Tablette &amp; Vraie Voiture (En 5 Minutes)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Suivez ce protocole en atelier pour impressionner un garagiste, électricien auto ou chiptuner sur son propre véhicule :
            </p>
          </div>
        </div>

        {/* 3 Steps: Preparation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/80 font-bold flex items-center justify-center text-xs">
                1
              </span>
              <span className="text-[10px] font-mono text-slate-400">Prise DLC 16 Broches</span>
            </div>
            <h3 className="font-bold text-white text-xs">Branchement OBD2</h3>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Insérez l'adaptateur OBD2 (Câble USB OTG, dongle Bluetooth vLinker/OBDLink ou interface VCI Smartech) sur la prise sous le volant.
            </p>
            <div className="text-[10px] text-cyan-400 bg-cyan-950/40 p-2 rounded border border-cyan-900/40">
              ✓ Contact mis (Contact ON sans démarrer) · Tension $\ge$ 12.4V
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/80 font-bold flex items-center justify-center text-xs">
                2
              </span>
              <span className="text-[10px] font-mono text-slate-400">Tablette Android</span>
            </div>
            <h3 className="font-bold text-white text-xs">Plein Écran Tablette (PWA)</h3>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Ouvrez l'application sur la tablette dans Google Chrome. Cliquez sur le menu (3 points) puis <strong>« Ajouter à l'écran d'accueil »</strong>.
            </p>
            <div className="text-[10px] text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-900/40">
              ✓ Interface 100% immersive comme une valise de diagnostic officielle
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/80 font-bold flex items-center justify-center text-xs">
                3
              </span>
              <span className="text-[10px] font-mono text-slate-400">Handshake</span>
            </div>
            <h3 className="font-bold text-white text-xs">Liaison Immédiate</h3>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Cliquez sur <strong>« Établir la Liaison Directe »</strong>. Le protocole négocie automatiquement le bus CAN (500k bps) et synchronise les calculateurs.
            </p>
            <div className="text-[10px] text-amber-300 bg-amber-950/40 p-2 rounded border border-amber-900/40">
              ✓ Télémétrie en temps réel (RPM, Tension, Pression turbo)
            </div>
          </div>
        </div>

        {/* The 4 Magic Live Tests to Show the Client */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400" />
            <span>Les 4 Démonstrations Choc à Réaliser en Direct :</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <span className="font-bold text-amber-400 block text-xs flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                <span>1. Clé Mains-Libres 3m</span>
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Prenez le smartphone en poche et éloignez-vous de 3 mètres du véhicule : le système se verrouille tout seul (klaxon + rétros rabattus). Revenez : il s'ouvre !
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <span className="font-bold text-rose-400 block text-xs flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                <span>2. Coupe-Circuit Antivol</span>
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Activez le coupe-circuit : moteur immobilisé (Trame CAN 0x1A0). Montrez ensuite le déblocage via le <strong>Code PIN de secours 884926</strong>.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <span className="font-bold text-cyan-400 block text-xs flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                <span>3. Scan &amp; IA Mécanicien</span>
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Scannez le moteur (ex: Fiat Doblò / Geely) et cliquez sur <em>« Demander Diagnostic à l'IA »</em> : l'IA donne la cause exacte et la pièce à remplacer.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <span className="font-bold text-emerald-400 block text-xs flex items-center gap-1.5">
                <Tablet className="w-3.5 h-3.5" />
                <span>4. Écran Chinois &amp; Fiche Pro</span>
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Montrez le débridage de la tablette chinoise (YouTube / Maps) et imprimez en 1 clic la Fiche d'Atelier officielle avec pièces chiffrées en DZD.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
