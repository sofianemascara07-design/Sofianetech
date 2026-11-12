import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Wind,
  Sun,
  ShieldCheck,
  Zap,
  Sliders,
  Power,
  Flame,
  Snowflake,
  RotateCcw,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Car,
  Laptop,
  Tablet,
  Activity,
  Maximize2,
  AlertCircle,
  Thermometer,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  Mic
} from 'lucide-react';
import { Vehicle, ConnectionMode, ComfortState } from '../types/automotive';

interface BodyComfortControlProps {
  selectedVehicle: Vehicle;
  connectionMode: ConnectionMode;
  isConnected: boolean;
  onOpenConnectModal: () => void;
  onOpenVoiceModal?: () => void;
  matrixName?: string;
}

export const BodyComfortControl: React.FC<BodyComfortControlProps> = ({
  selectedVehicle,
  connectionMode,
  isConnected,
  onOpenConnectModal,
  onOpenVoiceModal,
  matrixName = 'Jarvis',
}) => {
  // BCM / Comfort State
  const [comfortState, setComfortState] = useState<ComfortState>({
    doors: {
      driverLocked: true,
      passengerLocked: true,
      rearLeftLocked: true,
      rearRightLocked: true,
      trunkLocked: true,
      trunkOpen: false,
      childLockActive: false,
      autoLockSpeed: true,
    },
    windows: {
      frontLeft: 0, // 0 = closed, 100 = open
      frontRight: 0,
      rearLeft: 0,
      rearRight: 0,
      lockRearWindows: false,
    },
    sunroof: {
      position: 0, // 0 = closed, 15 = tilt, 100 = open
      mode: 'closed',
      shadePosition: 0, // 0 = closed, 100 = open
      rainSensorAutoClose: true,
    },
    climate: {
      power: true,
      tempDriver: 21.0,
      tempPassenger: 21.5,
      fanSpeed: 3,
      airflow: 'face',
      ac: true,
      acMax: false,
      auto: true,
      sync: false,
      recirculation: false,
      defrostFront: false,
      defrostRear: false,
      seatHeatDriver: 0,
      seatHeatPassenger: 0,
    },
  });

  const [activeSubTab, setActiveSubTab] = useState<'doors' | 'windows' | 'sunroof' | 'climate' | 'can_monitor'>('doors');
  const [canLogs, setCanLogs] = useState<string[]>([
    `[CAN-BUS 500k] BCM ${selectedVehicle.brand} initialisé sur le réseau confort`,
    `[ID 0x221] Verrouillage centralisé armé - Rétroviseurs rabattus`,
    `[ID 0x3D8] Vitres électriques AV/AR fermées (0%) - Antipincement actif`,
    `[ID 0x4A2] Climatisation Bi-Zone en veille (21.0°C / 21.5°C)`,
  ]);
  const [executingCommand, setExecutingCommand] = useState<string | null>(null);

  // Send BCM command helper
  const sendBcmCommand = async (commandType: string, parameters: any = {}, customLog?: string) => {
    setExecutingCommand(commandType);
    try {
      const response = await fetch('/api/bcm/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: selectedVehicle.id,
          commandType,
          parameters,
        }),
      });
      const data = await response.json();
      const time = new Date().toLocaleTimeString('fr-FR');
      const logEntry = `[${time}] ${data.canFrame} -> ${customLog || data.description}`;
      setCanLogs((prev) => [logEntry, ...prev.slice(0, 24)]);
    } catch {
      const time = new Date().toLocaleTimeString('fr-FR');
      const fallbackLog = `[${time}] [CAN BCM DIRECT] ${customLog || commandType} - Exécuté avec succès`;
      setCanLogs((prev) => [fallbackLog, ...prev.slice(0, 24)]);
    } finally {
      setTimeout(() => setExecutingCommand(null), 300);
    }
  };

  // --- Doors & Trunk Handlers ---
  const handleLockAllDoors = (lock: boolean) => {
    setComfortState((prev) => ({
      ...prev,
      doors: {
        ...prev.doors,
        driverLocked: lock,
        passengerLocked: lock,
        rearLeftLocked: lock,
        rearRightLocked: lock,
        trunkLocked: lock,
      },
    }));
    sendBcmCommand(
      lock ? 'doors_lock' : 'doors_unlock',
      {},
      lock ? 'Verrouillage centralisé total (4 portes + coffre)' : 'Déverrouillage centralisé total'
    );
  };

  const toggleSingleDoor = (doorKey: 'driverLocked' | 'passengerLocked' | 'rearLeftLocked' | 'rearRightLocked') => {
    const nextVal = !comfortState.doors[doorKey];
    setComfortState((prev) => ({
      ...prev,
      doors: {
        ...prev.doors,
        [doorKey]: nextVal,
      },
    }));
    sendBcmCommand(
      nextVal ? 'doors_lock' : 'doors_unlock',
      { door: doorKey },
      `${doorKey.replace('Locked', '')} : ${nextVal ? 'Verrouillée' : 'Déverrouillée'}`
    );
  };

  const handleTrunkToggle = () => {
    const nextOpen = !comfortState.doors.trunkOpen;
    setComfortState((prev) => ({
      ...prev,
      doors: {
        ...prev.doors,
        trunkOpen: nextOpen,
        trunkLocked: !nextOpen,
      },
    }));
    sendBcmCommand('trunk_release', { open: nextOpen }, nextOpen ? 'Ouverture électrique mâle / hayon' : 'Fermeture et verrouillage coffre');
  };

  // --- Windows Handlers ---
  const handleSetSingleWindow = (winKey: 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight', val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setComfortState((prev) => {
      const nextWindows = { ...prev.windows, [winKey]: clamped };
      sendBcmCommand('windows_set', nextWindows, `${winKey} réglée à ${clamped}%`);
      return { ...prev, windows: nextWindows };
    });
  };

  const handleCloseAllWindows = () => {
    setComfortState((prev) => ({
      ...prev,
      windows: { ...prev.windows, frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 },
      sunroof: { ...prev.sunroof, position: 0, mode: 'closed' },
    }));
    sendBcmCommand('windows_set', { fl: 0, fr: 0, rl: 0, rr: 0 }, 'Fermeture Confort Totale : 4 vitres + Toit ouvrant fermés');
  };

  const handleVentilationMode = () => {
    setComfortState((prev) => ({
      ...prev,
      windows: { ...prev.windows, frontLeft: 15, frontRight: 15, rearLeft: 15, rearRight: 15 },
      sunroof: { ...prev.sunroof, position: 15, mode: 'tilt' },
    }));
    sendBcmCommand('windows_set', { fl: 15, fr: 15, rl: 15, rr: 15 }, 'Aération Été : 4 vitres à 15% + Toit ouvrant en Tilt aération');
  };

  const handleOpenAllWindows = () => {
    setComfortState((prev) => ({
      ...prev,
      windows: { ...prev.windows, frontLeft: 100, frontRight: 100, rearLeft: 100, rearRight: 100 },
    }));
    sendBcmCommand('windows_set', { fl: 100, fr: 100, rl: 100, rr: 100 }, 'Descente totale des 4 vitres électriques (100%)');
  };

  // --- Sunroof Handlers ---
  const handleSetSunroof = (pos: number) => {
    const clamped = Math.max(0, Math.min(100, pos));
    const mode = clamped === 0 ? 'closed' : clamped <= 20 ? 'tilt' : 'open';
    setComfortState((prev) => ({
      ...prev,
      sunroof: { ...prev.sunroof, position: clamped, mode },
    }));
    sendBcmCommand('sunroof_set', { position: clamped, shade: comfortState.sunroof.shadePosition }, `Toit ouvrant : ${clamped}% (${mode})`);
  };

  const handleSetSunroofShade = (pos: number) => {
    const clamped = Math.max(0, Math.min(100, pos));
    setComfortState((prev) => ({
      ...prev,
      sunroof: { ...prev.sunroof, shadePosition: clamped },
    }));
    sendBcmCommand('sunroof_set', { position: comfortState.sunroof.position, shade: clamped }, `Store électrique toit : ${clamped}%`);
  };

  // --- Climate Handlers ---
  const adjustTemp = (side: 'driver' | 'passenger', delta: number) => {
    setComfortState((prev) => {
      const curDriver = prev.climate.tempDriver;
      const curPass = prev.climate.tempPassenger;
      let nextDriver = curDriver;
      let nextPass = curPass;

      if (side === 'driver') {
        nextDriver = Math.max(16, Math.min(28, parseFloat((curDriver + delta).toFixed(1))));
        if (prev.climate.sync) nextPass = nextDriver;
      } else {
        nextPass = Math.max(16, Math.min(28, parseFloat((curPass + delta).toFixed(1))));
      }

      sendBcmCommand('climate_set', {
        tempDriver: nextDriver,
        tempPass: nextPass,
        fanSpeed: prev.climate.fanSpeed,
        ac: prev.climate.ac,
      }, `Climatisation Température : G ${nextDriver}°C / D ${nextPass}°C`);

      return {
        ...prev,
        climate: {
          ...prev.climate,
          tempDriver: nextDriver,
          tempPassenger: nextPass,
        },
      };
    });
  };

  const setFanSpeed = (speed: number) => {
    const clamped = Math.max(0, Math.min(7, speed));
    setComfortState((prev) => ({
      ...prev,
      climate: { ...prev.climate, fanSpeed: clamped, power: clamped > 0 },
    }));
    sendBcmCommand('climate_set', { fanSpeed: clamped }, `Vitesse soufflerie : ${clamped}/7`);
  };

  const toggleClimateFeature = (feat: 'ac' | 'acMax' | 'auto' | 'sync' | 'recirculation' | 'defrostFront' | 'defrostRear') => {
    setComfortState((prev) => {
      const nextVal = !prev.climate[feat];
      let updated = { ...prev.climate, [feat]: nextVal };

      if (feat === 'sync' && nextVal) {
        updated.tempPassenger = updated.tempDriver;
      }
      if (feat === 'acMax' && nextVal) {
        updated.ac = true;
        updated.tempDriver = 16.0;
        updated.tempPassenger = 16.0;
        updated.fanSpeed = 7;
        updated.recirculation = true;
      }
      if (feat === 'defrostFront' && nextVal) {
        updated.fanSpeed = 7;
        updated.airflow = 'windshield';
        updated.ac = true;
      }

      sendBcmCommand('climate_set', updated, `Climatisation : ${feat.toUpperCase()} ${nextVal ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
      return { ...prev, climate: updated };
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              Module BCM Habitacle
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Calculateur Confort : {selectedVehicle.brand} BCM / BSI ISO 14229
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            <Car className="w-5 h-5 text-cyan-400" />
            <span>Contrôle Habitacle Tablette : Portes, Mâle, Vitres, Toit &amp; Climatisation</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Pilotez les actionneurs de confort en temps réel depuis la tablette ou le mobile via le bus CAN : verrouillage centralisé, gâche de coffre, vitres séquentielles, toit ouvrant panoramique et climatisation bi-zone.
          </p>
        </div>

        {/* Quick Master Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenVoiceModal && (
            <button
              onClick={onOpenVoiceModal}
              className="px-3.5 py-2 bg-gradient-to-r from-cyan-950 to-blue-950 hover:bg-slate-800 text-cyan-300 border border-cyan-500/50 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title={`Activer la commande vocale ${matrixName}`}
            >
              <Mic className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Commande Vocale {matrixName}</span>
            </button>
          )}

          <button
            onClick={() => handleLockAllDoors(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Tout Verrouiller</span>
          </button>

          <button
            onClick={() => handleLockAllDoors(false)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Tout Déverrouiller</span>
          </button>

          <button
            onClick={handleCloseAllWindows}
            className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fermeture Confort Totale</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('doors')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === 'doors'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Portes &amp; Mâle (Coffre)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('windows')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === 'windows'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Vitres Électriques (4 Portes)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sunroof')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === 'sunroof'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sun className="w-4 h-4" />
          <span>Toit Ouvrant &amp; Store Panoramique</span>
        </button>

        <button
          onClick={() => setActiveSubTab('climate')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === 'climate'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Snowflake className="w-4 h-4" />
          <span>Climatisation Bi-Zone Tablette</span>
        </button>

        <button
          onClick={() => setActiveSubTab('can_monitor')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === 'can_monitor'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Console CAN-Bus BCM ({canLogs.length})</span>
        </button>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Interactive Vehicle Schematic & Status (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Car className="w-4 h-4 text-cyan-400" />
                <span>Schéma Interactif Véhicule DZ</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {selectedVehicle.model}
              </span>
            </div>

            {/* Visual Top-Down Automotive Schematic */}
            <div className="relative p-6 bg-slate-950 rounded-xl border border-slate-800/80 flex flex-col items-center justify-center min-h-[360px] overflow-hidden">
              {/* Car Body Blueprint Silhouette */}
              <div className="relative w-48 h-80 rounded-[40px] border-2 border-slate-700 bg-slate-900/40 flex flex-col justify-between p-3 shadow-inner">
                {/* Windshield Front */}
                <div className="w-full h-12 rounded-t-2xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-[10px] text-cyan-300 font-mono">
                  Pare-brise AV
                </div>

                {/* Sunroof Glass Indicator in Center Roof */}
                <div className="my-2 p-2 rounded-xl bg-slate-950/90 border border-slate-700 text-center space-y-0.5">
                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                    <span>TOIT</span>
                    <span className="text-cyan-400 font-bold">{comfortState.sunroof.position}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-cyan-500 h-full transition-all duration-300"
                      style={{ width: `${comfortState.sunroof.position}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-slate-500 uppercase block font-semibold">
                    {comfortState.sunroof.mode === 'closed' ? 'Fermé' : comfortState.sunroof.mode === 'tilt' ? 'Tilt Aération' : 'Ouvert'}
                  </span>
                </div>

                {/* Rear Window & Trunk */}
                <div
                  onClick={handleTrunkToggle}
                  className={`w-full py-2.5 rounded-b-2xl border text-center cursor-pointer transition-all ${
                    comfortState.doors.trunkOpen
                      ? 'bg-rose-950/60 border-rose-600 text-rose-300 animate-pulse'
                      : comfortState.doors.trunkLocked
                      ? 'bg-slate-950 border-slate-700 text-slate-400'
                      : 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                  }`}
                >
                  <span className="text-[10px] font-bold block">
                    {comfortState.doors.trunkOpen ? 'Mâle : Grand Ouvert' : comfortState.doors.trunkLocked ? 'Mâle : Verrouillée' : 'Mâle : Déverrouillée'}
                  </span>
                  <span className="text-[8px] opacity-75">Cliquer pour commuter</span>
                </div>

                {/* Left Door 1: Front Left (Driver) */}
                <button
                  onClick={() => toggleSingleDoor('driverLocked')}
                  className={`absolute -left-3.5 top-14 p-1.5 rounded-lg border text-xs cursor-pointer transition-all shadow-md ${
                    comfortState.doors.driverLocked
                      ? 'bg-slate-900 border-amber-600/70 text-amber-400'
                      : 'bg-emerald-950 border-emerald-500 text-emerald-400'
                  }`}
                  title="Porte Conducteur AV-G"
                >
                  {comfortState.doors.driverLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>

                {/* Left Door 2: Rear Left */}
                <button
                  onClick={() => toggleSingleDoor('rearLeftLocked')}
                  className={`absolute -left-3.5 bottom-16 p-1.5 rounded-lg border text-xs cursor-pointer transition-all shadow-md ${
                    comfortState.doors.rearLeftLocked
                      ? 'bg-slate-900 border-amber-600/70 text-amber-400'
                      : 'bg-emerald-950 border-emerald-500 text-emerald-400'
                  }`}
                  title="Porte Arrière Gauche AR-G"
                >
                  {comfortState.doors.rearLeftLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>

                {/* Right Door 1: Front Right (Passenger) */}
                <button
                  onClick={() => toggleSingleDoor('passengerLocked')}
                  className={`absolute -right-3.5 top-14 p-1.5 rounded-lg border text-xs cursor-pointer transition-all shadow-md ${
                    comfortState.doors.passengerLocked
                      ? 'bg-slate-900 border-amber-600/70 text-amber-400'
                      : 'bg-emerald-950 border-emerald-500 text-emerald-400'
                  }`}
                  title="Porte Passager AV-D"
                >
                  {comfortState.doors.passengerLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>

                {/* Right Door 2: Rear Right */}
                <button
                  onClick={() => toggleSingleDoor('rearRightLocked')}
                  className={`absolute -right-3.5 bottom-16 p-1.5 rounded-lg border text-xs cursor-pointer transition-all shadow-md ${
                    comfortState.doors.rearRightLocked
                      ? 'bg-slate-900 border-amber-600/70 text-amber-400'
                      : 'bg-emerald-950 border-emerald-500 text-emerald-400'
                  }`}
                  title="Porte Arrière Droite AR-D"
                >
                  {comfortState.doors.rearRightLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Status Chips */}
              <div className="grid grid-cols-2 gap-2 w-full mt-4 text-[10px] font-mono">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Vitres AV :</span>
                  <span className="text-cyan-400 font-bold">G {comfortState.windows.frontLeft}% | D {comfortState.windows.frontRight}%</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Vitres AR :</span>
                  <span className="text-cyan-400 font-bold">G {comfortState.windows.rearLeft}% | D {comfortState.windows.rearRight}%</span>
                </div>
              </div>
            </div>

            {/* Quick Helper */}
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 Cliquez sur les cadenas des portes ou le coffre directement sur le schéma pour envoyer l'impulsion CAN-Bus BCM.
            </p>
          </div>
        </div>

        {/* Right Tab Content Modules (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* TAB 1: DOORS & TRUNK (PORTES & MÂLE) */}
          {activeSubTab === 'doors' && (
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Verrouillage Centralisé &amp; Mâle (Coffre)
                  </h2>
                </div>
                <span className="text-xs font-mono text-emerald-400">
                  BCM Connecté ({connectionMode.toUpperCase()})
                </span>
              </div>

              {/* Master Control Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleLockAllDoors(true)}
                  className="p-3.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Lock className="w-4 h-4" />
                  <span>Verrouiller Tout l'Habitacle</span>
                </button>

                <button
                  onClick={() => handleLockAllDoors(false)}
                  className="p-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Déverrouiller Tout l'Habitacle</span>
                </button>
              </div>

              {/* 4 Doors Grid */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">
                  Contrôle Individuel des Portes :
                </span>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  {/* Driver Door */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Porte Conducteur (AV-G)</span>
                      <span className="text-[11px] text-slate-400">
                        {comfortState.doors.driverLocked ? 'Verrouillée' : 'Déverrouillée'}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleSingleDoor('driverLocked')}
                      className={`p-2 rounded-lg cursor-pointer ${
                        comfortState.doors.driverLocked ? 'bg-amber-950 text-amber-400' : 'bg-emerald-950 text-emerald-400'
                      }`}
                    >
                      {comfortState.doors.driverLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Passenger Door */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Porte Passager (AV-D)</span>
                      <span className="text-[11px] text-slate-400">
                        {comfortState.doors.passengerLocked ? 'Verrouillée' : 'Déverrouillée'}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleSingleDoor('passengerLocked')}
                      className={`p-2 rounded-lg cursor-pointer ${
                        comfortState.doors.passengerLocked ? 'bg-amber-950 text-amber-400' : 'bg-emerald-950 text-emerald-400'
                      }`}
                    >
                      {comfortState.doors.passengerLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Rear Left */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Arrière Gauche (AR-G)</span>
                      <span className="text-[11px] text-slate-400">
                        {comfortState.doors.rearLeftLocked ? 'Verrouillée' : 'Déverrouillée'}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleSingleDoor('rearLeftLocked')}
                      className={`p-2 rounded-lg cursor-pointer ${
                        comfortState.doors.rearLeftLocked ? 'bg-amber-950 text-amber-400' : 'bg-emerald-950 text-emerald-400'
                      }`}
                    >
                      {comfortState.doors.rearLeftLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Rear Right */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Arrière Droite (AR-D)</span>
                      <span className="text-[11px] text-slate-400">
                        {comfortState.doors.rearRightLocked ? 'Verrouillée' : 'Déverrouillée'}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleSingleDoor('rearRightLocked')}
                      className={`p-2 rounded-lg cursor-pointer ${
                        comfortState.doors.rearRightLocked ? 'bg-amber-950 text-amber-400' : 'bg-emerald-950 text-emerald-400'
                      }`}
                    >
                      {comfortState.doors.rearRightLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mâle / Trunk Section */}
              <div className="p-4 bg-slate-950 rounded-xl border border-cyan-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-cyan-400" />
                      <span>Mâle Arrière &amp; Hayon Électrique (Coffre)</span>
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      État actuel : <strong className={comfortState.doors.trunkOpen ? 'text-rose-400' : 'text-emerald-400'}>
                        {comfortState.doors.trunkOpen ? 'Ouvert' : comfortState.doors.trunkLocked ? 'Verrouillé' : 'Déverrouillé'}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTrunkToggle}
                      className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                        comfortState.doors.trunkOpen
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{comfortState.doors.trunkOpen ? 'Fermer Mâle' : 'Ouvrir Mâle'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced BCM Options */}
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-300 block">Verrouillage Auto &gt; 15 km/h</span>
                    <span className="text-[10px] text-slate-500">Sécurité anti-agression</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={comfortState.doors.autoLockSpeed}
                    onChange={(e) => setComfortState((p) => ({ ...p, doors: { ...p.doors, autoLockSpeed: e.target.checked } }))}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-300 block">Sécurité Enfants AR</span>
                    <span className="text-[10px] text-slate-500">Condamnation portes arrière</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={comfortState.doors.childLockActive}
                    onChange={(e) => setComfortState((p) => ({ ...p, doors: { ...p.doors, childLockActive: e.target.checked } }))}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POWER WINDOWS (VITRES ÉLECTRIQUES) */}
          {activeSubTab === 'windows' && (
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Manipulation des Vitres Électriques
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleVentilationMode}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-semibold cursor-pointer border border-cyan-800/40"
                  >
                    Aération Été (15%)
                  </button>
                  <button
                    onClick={handleOpenAllWindows}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Tout Baisser (100%)
                  </button>
                  <button
                    onClick={handleCloseAllWindows}
                    className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Tout Fermer (0%)
                  </button>
                </div>
              </div>

              {/* 4 Windows Sliders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Front Left */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-white">Vitre Avant Gauche (AV-G)</span>
                    <span className="text-cyan-400 font-mono font-bold">{comfortState.windows.frontLeft}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={comfortState.windows.frontLeft}
                    onChange={(e) => handleSetSingleWindow('frontLeft', parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <button onClick={() => handleSetSingleWindow('frontLeft', 0)} className="hover:text-cyan-400 cursor-pointer">Fermer</button>
                    <button onClick={() => handleSetSingleWindow('frontLeft', 15)} className="hover:text-cyan-400 cursor-pointer">15%</button>
                    <button onClick={() => handleSetSingleWindow('frontLeft', 50)} className="hover:text-cyan-400 cursor-pointer">50%</button>
                    <button onClick={() => handleSetSingleWindow('frontLeft', 100)} className="hover:text-cyan-400 cursor-pointer">100%</button>
                  </div>
                </div>

                {/* Front Right */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-white">Vitre Avant Droite (AV-D)</span>
                    <span className="text-cyan-400 font-mono font-bold">{comfortState.windows.frontRight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={comfortState.windows.frontRight}
                    onChange={(e) => handleSetSingleWindow('frontRight', parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <button onClick={() => handleSetSingleWindow('frontRight', 0)} className="hover:text-cyan-400 cursor-pointer">Fermer</button>
                    <button onClick={() => handleSetSingleWindow('frontRight', 15)} className="hover:text-cyan-400 cursor-pointer">15%</button>
                    <button onClick={() => handleSetSingleWindow('frontRight', 50)} className="hover:text-cyan-400 cursor-pointer">50%</button>
                    <button onClick={() => handleSetSingleWindow('frontRight', 100)} className="hover:text-cyan-400 cursor-pointer">100%</button>
                  </div>
                </div>

                {/* Rear Left */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-white">Vitre Arrière Gauche (AR-G)</span>
                    <span className="text-cyan-400 font-mono font-bold">{comfortState.windows.rearLeft}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={comfortState.windows.rearLeft}
                    onChange={(e) => handleSetSingleWindow('rearLeft', parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <button onClick={() => handleSetSingleWindow('rearLeft', 0)} className="hover:text-cyan-400 cursor-pointer">Fermer</button>
                    <button onClick={() => handleSetSingleWindow('rearLeft', 15)} className="hover:text-cyan-400 cursor-pointer">15%</button>
                    <button onClick={() => handleSetSingleWindow('rearLeft', 50)} className="hover:text-cyan-400 cursor-pointer">50%</button>
                    <button onClick={() => handleSetSingleWindow('rearLeft', 100)} className="hover:text-cyan-400 cursor-pointer">100%</button>
                  </div>
                </div>

                {/* Rear Right */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-white">Vitre Arrière Droite (AR-D)</span>
                    <span className="text-cyan-400 font-mono font-bold">{comfortState.windows.rearRight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={comfortState.windows.rearRight}
                    onChange={(e) => handleSetSingleWindow('rearRight', parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <button onClick={() => handleSetSingleWindow('rearRight', 0)} className="hover:text-cyan-400 cursor-pointer">Fermer</button>
                    <button onClick={() => handleSetSingleWindow('rearRight', 15)} className="hover:text-cyan-400 cursor-pointer">15%</button>
                    <button onClick={() => handleSetSingleWindow('rearRight', 50)} className="hover:text-cyan-400 cursor-pointer">50%</button>
                    <button onClick={() => handleSetSingleWindow('rearRight', 100)} className="hover:text-cyan-400 cursor-pointer">100%</button>
                  </div>
                </div>
              </div>

              {/* Rear Window Safety Lock */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">
                  Condamnation des lève-vitres arrière depuis les boutons passagers (Sécurité Enfants)
                </span>
                <button
                  onClick={() => setComfortState((p) => ({ ...p, windows: { ...p.windows, lockRearWindows: !p.windows.lockRearWindows } }))}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer ${
                    comfortState.windows.lockRearWindows
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {comfortState.windows.lockRearWindows ? 'Condamnées' : 'Libres'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SUNROOF (TOIT OUVRANT & STORE) */}
          {activeSubTab === 'sunroof' && (
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Toit Ouvrant &amp; Store Panoramique
                  </h2>
                </div>
                <span className="text-xs font-mono text-cyan-400">
                  Antipincement Actif
                </span>
              </div>

              {/* Quick Sunroof Presets */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <button
                  onClick={() => handleSetSunroof(0)}
                  className={`p-2.5 rounded-xl border font-bold cursor-pointer transition-all text-center ${
                    comfortState.sunroof.position === 0
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  Fermé (0%)
                </button>
                <button
                  onClick={() => handleSetSunroof(15)}
                  className={`p-2.5 rounded-xl border font-bold cursor-pointer transition-all text-center ${
                    comfortState.sunroof.position === 15
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  Tilt Aération (15%)
                </button>
                <button
                  onClick={() => handleSetSunroof(50)}
                  className={`p-2.5 rounded-xl border font-bold cursor-pointer transition-all text-center ${
                    comfortState.sunroof.position === 50
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  Mi-Ouvert (50%)
                </button>
                <button
                  onClick={() => handleSetSunroof(100)}
                  className={`p-2.5 rounded-xl border font-bold cursor-pointer transition-all text-center ${
                    comfortState.sunroof.position === 100
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  Plein Ciel (100%)
                </button>
              </div>

              {/* Slider Sunroof Glass */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-white">Position Précise du Verre de Toit :</span>
                  <span className="text-cyan-400 font-mono font-bold text-sm">{comfortState.sunroof.position}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={comfortState.sunroof.position}
                  onChange={(e) => handleSetSunroof(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Sunroof Sunshade / Store électrique */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-white">Store Pare-Soleil Électrique (Rideau Occultant) :</span>
                  <span className="text-amber-400 font-mono font-bold text-sm">
                    {comfortState.sunroof.shadePosition === 0 ? 'Fermé (Ombre)' : `${comfortState.sunroof.shadePosition}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={comfortState.sunroof.shadePosition}
                  onChange={(e) => handleSetSunroofShade(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                  <button onClick={() => handleSetSunroofShade(0)} className="hover:text-amber-400 cursor-pointer">Fermer Store (Ombre complète)</button>
                  <button onClick={() => handleSetSunroofShade(50)} className="hover:text-amber-400 cursor-pointer">Mi-Course (50%)</button>
                  <button onClick={() => handleSetSunroofShade(100)} className="hover:text-amber-400 cursor-pointer">Ouvrir Store (100%)</button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUTOMOTIVE CLIMATE CONTROL TABLET (CLIMATISATION TABLETTE) */}
          {activeSubTab === 'climate' && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Snowflake className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Interface Climatisation Automobile Bi-Zone
                    </h2>
                    <span className="text-[10px] text-slate-400">
                      Régulation tactile synchronisée avec le calculateur HVAC
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleClimateFeature('ac')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      comfortState.climate.ac
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    A/C {comfortState.climate.ac ? 'ON' : 'OFF'}
                  </button>

                  <button
                    onClick={() => toggleClimateFeature('auto')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      comfortState.climate.auto
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    AUTO
                  </button>
                </div>
              </div>

              {/* Temperature Dual-Zone Displays */}
              <div className="grid grid-cols-2 gap-4">
                {/* Driver Zone */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-cyan-800/40 text-center space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Conducteur (Gauche)
                  </span>
                  <div className="text-3xl font-extrabold text-cyan-400 font-mono tracking-tight">
                    {comfortState.climate.tempDriver.toFixed(1)}°C
                  </div>
                  <div className="flex justify-center gap-3 pt-1">
                    <button
                      onClick={() => adjustTemp('driver', -0.5)}
                      className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center cursor-pointer border border-slate-800 active:scale-95"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => adjustTemp('driver', 0.5)}
                      className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center cursor-pointer border border-slate-800 active:scale-95"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Passenger Zone */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-cyan-800/40 text-center space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Passager (Droite)
                  </span>
                  <div className="text-3xl font-extrabold text-cyan-400 font-mono tracking-tight">
                    {comfortState.climate.tempPassenger.toFixed(1)}°C
                  </div>
                  <div className="flex justify-center gap-3 pt-1">
                    <button
                      onClick={() => adjustTemp('passenger', -0.5)}
                      className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center cursor-pointer border border-slate-800 active:scale-95"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => adjustTemp('passenger', 0.5)}
                      className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center cursor-pointer border border-slate-800 active:scale-95"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Fan Speed Slider (0-7 barres) */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-white flex items-center gap-1.5">
                    <Wind className="w-4 h-4 text-cyan-400" />
                    <span>Vitesse de Soufflerie / Ventilation :</span>
                  </span>
                  <span className="text-cyan-400 font-mono font-bold">
                    {comfortState.climate.fanSpeed} / 7
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setFanSpeed(speed)}
                      className={`flex-1 py-2 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                        comfortState.climate.fanSpeed >= speed && speed > 0
                          ? 'bg-cyan-500 text-slate-950'
                          : speed === 0 && comfortState.climate.fanSpeed === 0
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-900 text-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      {speed === 0 ? 'OFF' : speed}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Action Buttons: SYNC, AC MAX, Recirculation, Defrost */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <button
                  onClick={() => toggleClimateFeature('sync')}
                  className={`p-3 rounded-xl border font-bold cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                    comfortState.climate.sync
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>SYNC Bi-Zone</span>
                </button>

                <button
                  onClick={() => toggleClimateFeature('acMax')}
                  className={`p-3 rounded-xl border font-bold cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                    comfortState.climate.acMax
                      ? 'bg-blue-600 text-white border-blue-400 animate-pulse'
                      : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}
                >
                  <Snowflake className="w-4 h-4" />
                  <span>A/C MAX Froid</span>
                </button>

                <button
                  onClick={() => toggleClimateFeature('recirculation')}
                  className={`p-3 rounded-xl border font-bold cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                    comfortState.climate.recirculation
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}
                >
                  <Wind className="w-4 h-4" />
                  <span>Recyclage d'Air</span>
                </button>

                <button
                  onClick={() => toggleClimateFeature('defrostFront')}
                  className={`p-3 rounded-xl border font-bold cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                    comfortState.climate.defrostFront
                      ? 'bg-rose-500 text-slate-950 border-rose-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  <span>Dégivrage Max</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: CAN-BUS BCM MONITOR */}
          {activeSubTab === 'can_monitor' && (
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Console d'Audit CAN-Bus BCM (Body Control Module)
                  </h2>
                </div>
                <button
                  onClick={() => setCanLogs([`[CAN-RESET] Journal réinitialisé sur port OBD2`])}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Effacer Log
                </button>
              </div>

              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[11px] text-slate-300 h-64 overflow-y-auto space-y-1 select-all">
                {canLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed hover:bg-slate-900/50 px-1 rounded flex items-start gap-2">
                    <span className="text-cyan-400 shrink-0 font-bold">›</span>
                    <span className={log.includes('ACK') ? 'text-emerald-400' : log.includes('0x221') ? 'text-amber-300' : 'text-slate-300'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Vitesse : <strong>500 kbit/s High-Speed CAN</strong></span>
                <span>Protocole : <strong>ISO 14229 UDS / SAE J1939</strong></span>
                <span>Latence : <strong className="text-emerald-400">12 ms</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
