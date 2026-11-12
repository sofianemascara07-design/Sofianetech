import React, { useState, useEffect } from 'react';
import { Vehicle, DtcCode } from '../types/automotive';
import { VEHICLE_PRESETS, INITIAL_DTC_CODES } from '../data/mockVehicles';
import { AlertCircle, CheckCircle2, RotateCcw, Wrench, Sparkles, Activity, ShieldAlert, Cpu, Database, History, Save } from 'lucide-react';

interface DiagnosticScannerProps {
  selectedVehicle: Vehicle;
  setSelectedVehicle: (vehicle: Vehicle) => void;
  batteryVoltage: number;
  isConnected: boolean;
  onOpenConnectModal: () => void;
  onSelectTab?: (tab: any) => void;
}

export const DiagnosticScanner: React.FC<DiagnosticScannerProps> = ({
  selectedVehicle,
  setSelectedVehicle,
  batteryVoltage,
  isConnected,
  onOpenConnectModal,
  onSelectTab,
}) => {
  const [dtcList, setDtcList] = useState<DtcCode[]>(INITIAL_DTC_CODES);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedSystem, setScannedSystem] = useState('');
  const [selectedDtc, setSelectedDtc] = useState<DtcCode | null>(INITIAL_DTC_CODES[0]);
  const [clearingDtc, setClearingDtc] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Live telemetry oscillating values
  const [liveRpm, setLiveRpm] = useState(820);
  const [liveBoost, setLiveBoost] = useState(0.05);
  const [liveCoolant, setLiveCoolant] = useState(88);
  const [liveRailBar, setLiveRailBar] = useState(320);
  const [liveMaf, setLiveMaf] = useState(12.4);

  // AI Mechanic state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Market Category Filter for Algeria
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const marketCategories = ['Tous', 'Fiat Algérie', 'Chinois DZ', 'Populaire DZ', 'Utilitaire', 'Européen'];

  const filteredVehicles = selectedCategory === 'Tous'
    ? VEHICLE_PRESETS
    : VEHICLE_PRESETS.filter((v) => v.marketSegment === selectedCategory);

  // Live telemetry oscillation
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setLiveRpm(800 + Math.floor(Math.sin(Date.now() / 1000) * 40));
      setLiveBoost(parseFloat((0.02 + Math.abs(Math.sin(Date.now() / 1500) * 0.15)).toFixed(2)));
      setLiveCoolant(88 + Math.floor(Math.sin(Date.now() / 4000) * 2));
      setLiveRailBar(310 + Math.floor(Math.sin(Date.now() / 800) * 25));
      setLiveMaf(parseFloat((12.2 + Math.random() * 0.8).toFixed(1)));
    }, 1200);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Run full system scan
  const handleStartScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setClearedNotice(false);

    const systems = [
      'Calculateur Moteur (ECM/ECU)',
      'Boîte de Vitesses Robotisée (TCU)',
      'Système de Freinage Antiblocage (ABS/ESP)',
      'Module d\'Airbags et Prétensionneurs (SRS)',
      'Boîtier de Servitude Intelligent (BSI / Gateway)',
      'Unité Centrale Habitacle (UCH / BCM)',
      'Écran Tablette & Infotainment Multimédia',
    ];

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setScannedSystem(systems[Math.min(step, systems.length - 1)]);
      setScanProgress((step / systems.length) * 100);

      if (step >= systems.length) {
        clearInterval(interval);
        setIsScanning(false);
        // Refresh codes
        setDtcList(INITIAL_DTC_CODES);
      }
    }, 400);
  };

  // Clear DTC
  const handleClearDtc = () => {
    setClearingDtc(true);
    setTimeout(() => {
      setDtcList([]);
      setSelectedDtc(null);
      setClearingDtc(false);
      setClearedNotice(true);
    }, 1200);
  };

  // Ask AI Mechanic
  const handleAskAiMechanic = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/diagnose/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: selectedVehicle.brand,
          model: selectedVehicle.model,
          year: selectedVehicle.year,
          engine: selectedVehicle.engine,
          dtcCodes: dtcList.map((d) => `${d.code} (${d.descriptionFr})`),
          symptoms: 'Voyant diagnostic moteur allumé au tableau de bord, légers à-coups lors des accélérations.',
        }),
      });

      const data = await res.json();
      setAiReport(data.analysis || 'Analyse indisponible.');
    } catch {
      setAiReport('Erreur de communication avec le serveur IA.');
    } finally {
      setAiLoading(false);
    }
  };

  // Save current scan to SaaS database
  const handleSaveToSaaS = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const payload = {
        vehicleId: selectedVehicle.id,
        vehicleName: `${selectedVehicle.brand} ${selectedVehicle.model}`,
        vin: `${selectedVehicle.brand.substring(0, 3).toUpperCase()}-DZ26-${Math.floor(1000 + Math.random() * 9000)}`,
        year: selectedVehicle.year,
        engine: selectedVehicle.engine,
        mileageKm: 32000,
        clientName: 'Atelier Mascara Auto Pro',
        technicianName: 'Sofiane M. (Master Tech DZ)',
        durationSeconds: 110,
        protocolUsed: selectedVehicle.protocol,
        batteryVoltage: batteryVoltage,
        overallHealthScore: dtcList.length === 0 ? 100 : dtcList.some(d => d.severity === 'critical') ? 52 : 70,
        status: dtcList.length === 0 ? 'passed' : dtcList.some(d => d.severity === 'critical') ? 'critical' : 'warning',
        dtcCodes: dtcList.map(d => ({
          code: d.code,
          system: d.system,
          descriptionFr: d.descriptionFr,
          severity: d.severity,
          status: d.status,
          repairRecommendation: d.descriptionFr.includes('suralimentation')
            ? 'Contrôler la durite d\'intercooler et l\'étanchéité du circuit turbo.'
            : 'Contrôler les faisceaux et composants associés selon manuel technique atelier.',
          estimatedCostDZD: 12000,
          laborHours: 1.0,
        })),
        technicianNotes: 'Session diagnostique instantanée enregistrée via AutoPro Diagnostic Scanner.',
        repairCompleted: false,
      };

      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(`Session archivée avec succès dans la base SaaS (${data.scan.id}) !`);
        setTimeout(() => setSaveSuccessMsg(null), 5000);
      }
    } catch {
      setSaveSuccessMsg('Erreur lors de la sauvegarde dans la base SaaS.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Vehicle Selection Strip */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-800/60 text-cyan-400 flex items-center justify-center font-bold">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Véhicule Actif :</span>
              <span className="text-sm font-bold text-white">
                {selectedVehicle.brand} {selectedVehicle.model} ({selectedVehicle.year})
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{selectedVehicle.engine}</span>
              <span>·</span>
              <span className="text-cyan-400 font-mono">{selectedVehicle.ecuType}</span>
              <span>·</span>
              <span>{selectedVehicle.protocol}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          {/* Segment Filter for Algerian fleet */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto text-xs">
            {marketCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedVehicle.id}
              onChange={(e) => {
                const v = VEHICLE_PRESETS.find((p) => p.id === e.target.value);
                if (v) setSelectedVehicle(v);
              }}
              className="w-full sm:w-72 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
            >
              {filteredVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} ({v.year}) - {v.originalHp} ch
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Control Banner: Scan & Clear */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={handleStartScan}
            disabled={isScanning}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scan en cours...' : 'Lancer Scan Diagnostic Complet'}</span>
          </button>

          <button
            onClick={handleClearDtc}
            disabled={clearingDtc || dtcList.length === 0}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer border border-slate-700"
          >
            <Wrench className="w-4 h-4 text-rose-400" />
            <span>{clearingDtc ? 'Effacement...' : 'Effacer Tous les Défauts (DTC)'}</span>
          </button>

          <button
            onClick={handleSaveToSaaS}
            disabled={isSaving}
            className="px-3.5 py-2 bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-600/60 text-cyan-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            title="Archiver ce scan dans la base de données SaaS pour le suivi santé"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isSaving ? 'Archivage...' : 'Archiver dans Base SaaS'}</span>
          </button>

          {onSelectTab && (
            <button
              onClick={() => onSelectTab('history')}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Consulter l'Historique</span>
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Codes DTC Détectés :</span>
          <span className={`font-mono font-bold text-sm ${dtcList.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {dtcList.length}
          </span>
        </div>
      </div>

      {/* Notice after saving to SaaS */}
      {saveSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          {onSelectTab && (
            <button
              onClick={() => onSelectTab('history')}
              className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer"
            >
              Voir la session →
            </button>
          )}
        </div>
      )}

      {/* Progress Bar during scan */}
      {isScanning && (
        <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/40 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-cyan-400 font-mono">Interrogation : {scannedSystem}</span>
            <span className="font-mono text-slate-300">{Math.round(scanProgress)}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-cyan-500 h-2 transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Notice after clearing */}
      {clearedNotice && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Tous les codes défauts ont été effacés avec succès. La mémoire EEPROM du calculateur a été réinitialisée.</span>
        </div>
      )}

      {/* Main Diagnostic Workspace: DTC Table & Freeze Frame + Live HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: DTC Codes List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Codes Défauts Mémoire Calculateur (OBD-II / UDS)</span>
              </h3>
              <span className="text-xs text-slate-400">Cliquez pour voir la trame figée</span>
            </div>

            {dtcList.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-medium text-white">Aucun code défaut mémorisé</p>
                <p className="text-xs text-slate-400">
                  Tous les calculateurs moteur, boîte, freinage et multimédia répondent avec statut nominal (0 défaut).
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {dtcList.map((dtc) => {
                  const isSelected = selectedDtc?.code === dtc.code;
                  return (
                    <div
                      key={dtc.code}
                      onClick={() => setSelectedDtc(dtc)}
                      className={`p-4 transition-colors cursor-pointer flex items-start justify-between gap-4 ${
                        isSelected ? 'bg-cyan-950/30 border-l-2 border-cyan-400' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {dtc.code}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {dtc.system}
                          </span>
                          <span className="text-[11px] text-slate-500">·</span>
                          <span className={`text-[11px] font-mono ${dtc.status === 'Actif' ? 'text-rose-400' : 'text-amber-400'}`}>
                            {dtc.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {dtc.descriptionFr}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded shrink-0 ${
                          dtc.severity === 'critical'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            : dtc.severity === 'high'
                            ? 'bg-orange-950 text-orange-300 border border-orange-800/60'
                            : dtc.severity === 'medium'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {dtc.severity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Freeze Frame & Technical Details of Selected DTC */}
          {selectedDtc && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Trame Figée Enregistrée (Freeze Frame Snapshot) - Code {selectedDtc.code}
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Régime Moteur</span>
                  <span className="text-sm font-mono font-bold text-white tabular-nums">
                    {selectedDtc.freezeFrame?.rpm || 2150} tr/min
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Vitesse Véhicule</span>
                  <span className="text-sm font-mono font-bold text-white tabular-nums">
                    {selectedDtc.freezeFrame?.speed || 85} km/h
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Température Eau</span>
                  <span className="text-sm font-mono font-bold text-white tabular-nums">
                    {selectedDtc.freezeFrame?.coolantTemp || 90} °C
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Pression Rail</span>
                  <span className="text-sm font-mono font-bold text-white tabular-nums">
                    {selectedDtc.freezeFrame?.fuelPressure || 1350} bar
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* AI Mechanic Analysis Section */}
          <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-semibold text-white">
                  Assistant Diagnostic IA &amp; Recherche de Panne
                </h4>
              </div>

              <button
                onClick={handleAskAiMechanic}
                disabled={aiLoading}
                className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                <span>{aiLoading ? 'Analyse en cours...' : 'Analyser avec l\'IA'}</span>
              </button>
            </div>

            {aiReport ? (
              <div className="p-4 bg-slate-950 rounded-lg border border-cyan-800/40 text-xs text-slate-300 whitespace-pre-line leading-relaxed font-sans">
                {aiReport}
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Interrogez notre modèle d'ingénierie mécanique pour obtenir les tests au multimètre/oscilloscope, les pannes fréquentes documentées sur le bloc {selectedVehicle.engine} et la méthodologie de réparation.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Live Sensor Telemetry HUD */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Télémétrie Moteur en Direct</span>
              </h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${isConnected ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                {isConnected ? 'CAN STREAM 50Hz' : 'HORS LIGNE'}
              </span>
            </div>

            {!isConnected && (
              <div className="mb-4 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400 text-center">
                <span>Liaison tablette/OBD inactive.</span>
                <button
                  onClick={onOpenConnectModal}
                  className="block mx-auto mt-2 text-cyan-400 hover:underline font-semibold cursor-pointer"
                >
                  Activer la liaison Câble / WiFi / BT
                </button>
              </div>
            )}

            <div className="space-y-4">
              {/* Gauge 1: RPM */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-400">Régime Moteur</span>
                  <span className="font-mono font-bold text-white tabular-nums text-sm">
                    {isConnected ? liveRpm : 0} <span className="text-slate-500 text-xs">tr/min</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-cyan-500 h-1.5 transition-all duration-300"
                    style={{ width: `${Math.min(100, ((isConnected ? liveRpm : 0) / 6000) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Gauge 2: Turbo Boost */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-400">Pression Turbo Relative</span>
                  <span className="font-mono font-bold text-white tabular-nums text-sm">
                    {isConnected ? liveBoost.toFixed(2) : '0.00'} <span className="text-slate-500 text-xs">bar</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-1.5 transition-all duration-300"
                    style={{ width: `${Math.min(100, ((isConnected ? liveBoost : 0) / 2.5) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Gauge 3: Rail Pressure */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-400">Pression Rampe d'Injection</span>
                  <span className="font-mono font-bold text-white tabular-nums text-sm">
                    {isConnected ? liveRailBar : 0} <span className="text-slate-500 text-xs">bar</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-1.5 transition-all duration-300"
                    style={{ width: `${Math.min(100, ((isConnected ? liveRailBar : 0) / 2000) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Gauge 4: Coolant Temp */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-400">Température Liquide de Refroidissement</span>
                  <span className="font-mono font-bold text-white tabular-nums text-sm">
                    {isConnected ? liveCoolant : 0} <span className="text-slate-500 text-xs">°C</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 transition-all duration-300 ${
                      liveCoolant > 105 ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, ((isConnected ? liveCoolant : 0) / 130) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Gauge 5: Air Mass MAF */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-400">Débitmètre d'Air (MAF)</span>
                  <span className="font-mono font-bold text-white tabular-nums text-sm">
                    {isConnected ? liveMaf : '0.0'} <span className="text-slate-500 text-xs">g/s</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-500 h-1.5 transition-all duration-300"
                    style={{ width: `${Math.min(100, ((isConnected ? liveMaf : 0) / 120) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Gauge 6: Battery Voltage */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-400">Tension de Bord Alternateur</span>
                  <span className="font-mono font-bold text-white tabular-nums text-sm">
                    {batteryVoltage.toFixed(1)} <span className="text-slate-500 text-xs">V</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 transition-all duration-300 ${
                      batteryVoltage >= 12.8 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, (batteryVoltage / 15) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
