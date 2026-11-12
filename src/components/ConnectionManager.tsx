import React, { useState, useEffect } from 'react';
import { ConnectionMode } from '../types/automotive';
import { Cable, Wifi, Bluetooth, CheckCircle2, AlertTriangle, RefreshCw, Cpu, Activity, ShieldCheck, Smartphone, Tablet, Car, Key, Radio, Sparkles, ExternalLink, Play } from 'lucide-react';

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
  const [baudRate, setBaudRate] = useState<string>('500000'); // 500k CAN
  const [protocol, setProtocol] = useState<string>('ISO 14229 UDS over CAN');
  const [connecting, setConnecting] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    'Interface AutoPro initialisée.',
    'Pilotes matériels USB-OTG / BLE / WiFi Direct prêts.',
    'En attente d\'établissement de liaison avec la tablette automobile...',
  ]);
  const [packetCount, setPacketCount] = useState(14820);
  const [pingMs, setPingMs] = useState(4);

  // Periodic packets simulation when connected
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setPacketCount((prev) => prev + Math.floor(Math.random() * 15) + 5);
      setPingMs(connectionMode === 'cable' ? 2 + Math.floor(Math.random() * 3) : connectionMode === 'wifi' ? 6 + Math.floor(Math.random() * 5) : 18 + Math.floor(Math.random() * 10));
    }, 1500);
    return () => clearInterval(interval);
  }, [isConnected, connectionMode]);

  const handleToggleConnect = () => {
    if (isConnected) {
      setIsConnected(false);
      setLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Liaison déconnectée par l'opérateur.`,
        ...prev.slice(0, 8),
      ]);
      return;
    }

    setConnecting(true);
    setLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Recherche de la tablette automobile via canal ${connectionMode.toUpperCase()}...`,
      ...prev,
    ]);

    setTimeout(() => {
      setLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Négociation handshake protocole ${protocol} (Baudrate: ${baudRate} bps)...`,
        ...prev,
      ]);
    }, 700);

    setTimeout(() => {
      setConnecting(false);
      setIsConnected(true);
      setLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] SUCCÈS : Liaison établie avec Head-Unit Android Automotive (ID: 0x9AF2).`,
        `[${new Date().toLocaleTimeString()}] Passerelle CAN/OBD active. Tension mesurée : ${batteryVoltage.toFixed(1)}V.`,
        ...prev.slice(0, 8),
      ]);
    }, 1400);
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
                  <option value="500000">500 000 bps (Standard High-Speed)</option>
                  <option value="250000">250 000 bps (Medium-Speed)</option>
                  <option value="1000000">1 000 000 bps (CAN-FD Fast)</option>
                  <option value="10400">10 400 bps (K-Line)</option>
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

            <div className="bg-slate-950 rounded-lg p-3 font-mono text-[11px] text-slate-300 h-36 overflow-y-auto space-y-1 border border-slate-800">
              {logs.map((log, idx) => (
                <div key={idx} className="leading-tight">
                  <span className="text-slate-500 mr-2">&gt;</span>
                  <span className={log.includes('SUCCÈS') ? 'text-emerald-400 font-semibold' : log.includes('Avertissement') ? 'text-amber-400' : 'text-slate-300'}>
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Statut Socket :</span>
            <span className="flex items-center gap-1.5 font-medium text-slate-200">
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Connecté (Canal Crypté AES-256)</span>
                </>
              ) : (
                <span className="text-slate-500">Hors ligne</span>
              )}
            </span>
          </div>
        </div>
      </div>

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
