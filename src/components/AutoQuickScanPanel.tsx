import React, { useEffect, useRef, useState } from 'react';
import {
  DtcCode,
  QuickScanEcuId,
  QuickScanEcuResult,
  QuickScanReport,
  Vehicle,
} from '../types/automotive';
import { INITIAL_DTC_CODES } from '../data/mockVehicles';
import { obdHardwareBridge, ObdHardwareStatus } from '../utils/obdHardwareBridge';
import { apiFetch } from '../utils/apiBridge';
import {
  Network,
  Cpu,
  Disc,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Activity,
  ChevronRight,
  Clock,
} from 'lucide-react';

interface AutoQuickScanPanelProps {
  selectedVehicle: Vehicle;
  hwStatus: ObdHardwareStatus;
  batteryVoltage: number;
  cachedQuickScan?: QuickScanReport | null;
  onQuickScanComplete: (report: QuickScanReport, mergedDtcs: DtcCode[]) => void;
  onSelectDtc: (dtc: DtcCode) => void;
}

const DEFAULT_ECU_SKELETONS: QuickScanEcuResult[] = [
  {
    ecuId: 'gateway',
    name: 'Passerelle Réseau (Gateway / BSI)',
    shortName: 'Gateway / BSI',
    canAddress: '0x716',
    rxAddress: '0x71E',
    protocol: 'ISO 15765-4 CAN',
    status: 'pending',
    dtcs: [],
    latencyMs: 0,
  },
  {
    ecuId: 'engine',
    name: 'Calculateur Moteur (ECM / PCM)',
    shortName: 'Moteur (ECM)',
    canAddress: '0x7E0',
    rxAddress: '0x7E8',
    protocol: 'OBD-II / UDS CAN',
    status: 'pending',
    dtcs: [],
    latencyMs: 0,
  },
  {
    ecuId: 'abs',
    name: 'Système de Freinage (ABS / ESP)',
    shortName: 'ABS / ESP',
    canAddress: '0x760',
    rxAddress: '0x768',
    protocol: 'UDS (ISO 14229)',
    status: 'pending',
    dtcs: [],
    latencyMs: 0,
  },
  {
    ecuId: 'airbag',
    name: 'Sécurité Passive (Airbag / SRS)',
    shortName: 'Airbag / SRS',
    canAddress: '0x715',
    rxAddress: '0x71D',
    protocol: 'UDS (ISO 14229)',
    status: 'pending',
    dtcs: [],
    latencyMs: 0,
  },
];

const ECU_ICONS: Record<QuickScanEcuId, React.ComponentType<{ className?: string }>> = {
  gateway: Network,
  engine: Cpu,
  abs: Disc,
  airbag: ShieldAlert,
};

function buildDemoEcuScenarios(vehicle: Vehicle): Record<QuickScanEcuId, { dtcs: DtcCode[]; latencyMs: number }> {
  const isChinese = vehicle.marketSegment === 'Chinois DZ';
  const engineDtcs: DtcCode[] = [
    INITIAL_DTC_CODES[0],
    ...(vehicle.fuelType === 'Diesel' ? [INITIAL_DTC_CODES[1]] : []),
  ];

  const gatewayDtcs: DtcCode[] = isChinese
    ? [
        {
          code: 'U0155',
          system: 'Gateway / BSI',
          descriptionFr: 'Perte ponctuelle de trame avec combiné d’instruments (IPC) après veille prolongée',
          severity: 'medium',
          status: 'Fugitif',
        },
      ]
    : [];

  const absDtcs: DtcCode[] = [
    {
      code: 'C0035',
      system: 'ABS / ESP',
      descriptionFr: 'Capteur vitesse de roue avant gauche — signal intermittent (poussière/cible)',
      severity: 'high',
      status: 'Fugitif',
    },
  ];

  const airbagDtcs: DtcCode[] =
    vehicle.year <= 2019
      ? [
          {
            code: 'B0020',
            system: 'Airbag / SRS',
            descriptionFr: 'Connecteur prétensionneur / airbag latéral sous siège conducteur (impédance haute)',
            severity: 'high',
            status: 'Actif',
          },
        ]
      : [];

  return {
    gateway: { dtcs: gatewayDtcs, latencyMs: 68 },
    engine: { dtcs: engineDtcs, latencyMs: 112 },
    abs: { dtcs: absDtcs, latencyMs: 94 },
    airbag: { dtcs: airbagDtcs, latencyMs: 85 },
  };
}

function computeHealthScore(ecus: QuickScanEcuResult[]): number {
  const allDtcs = ecus.flatMap((e) => e.dtcs);
  if (allDtcs.length === 0) return 100;
  let penalty = 0;
  for (const d of allDtcs) {
    if (d.severity === 'critical') penalty += 22;
    else if (d.severity === 'high') penalty += 14;
    else if (d.severity === 'medium') penalty += 8;
    else penalty += 4;
  }
  return Math.max(15, 100 - penalty);
}

export const AutoQuickScanPanel: React.FC<AutoQuickScanPanelProps> = ({
  selectedVehicle,
  hwStatus,
  batteryVoltage,
  cachedQuickScan,
  onQuickScanComplete,
  onSelectDtc,
}) => {
  const [autoTriggerOnConnect, setAutoTriggerOnConnect] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('autopro_auto_quickscan');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [isScanning, setIsScanning] = useState(false);
  const [ecuStates, setEcuStates] = useState<QuickScanEcuResult[]>(
    cachedQuickScan?.ecus || DEFAULT_ECU_SKELETONS
  );
  const [report, setReport] = useState<QuickScanReport | null>(cachedQuickScan || null);

  const prevConnectedRef = useRef<boolean>(false);
  const scanLockRef = useRef<boolean>(false);

  // Sync from offline cache when disconnected
  useEffect(() => {
    if (!hwStatus.connected && cachedQuickScan) {
      setReport(cachedQuickScan);
      setEcuStates(cachedQuickScan.ecus);
    }
  }, [hwStatus.connected, cachedQuickScan]);

  const toggleAutoTrigger = () => {
    setAutoTriggerOnConnect((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('autopro_auto_quickscan', String(next));
      } catch {
        // Ignore storage
      }
      return next;
    });
  };

  const runQuickScan = async () => {
    if (!hwStatus.connected || scanLockRef.current) return;
    scanLockRef.current = true;
    setIsScanning(true);
    const scanStart = performance.now();

    const initialSkeletons: QuickScanEcuResult[] = DEFAULT_ECU_SKELETONS.map((e) => ({
      ...e,
      protocol: hwStatus.protocolName || e.protocol,
      status: 'pending',
      dtcs: [],
      latencyMs: 0,
    }));
    setEcuStates(initialSkeletons);

    let finalEcus: QuickScanEcuResult[] = [];

    try {
      if (hwStatus.transport === 'ble' || hwStatus.transport === 'serial') {
        finalEcus = await obdHardwareBridge.quickScanAllEcus((partial) => {
          setEcuStates((prev) =>
            prev.map((item) => (item.ecuId === partial.ecuId ? partial : item))
          );
        });
      } else {
        // Mode Démo Atelier : interrogation séquentielle réaliste des 4 calculateurs
        const demoMap = buildDemoEcuScenarios(selectedVehicle);
        const built: QuickScanEcuResult[] = [];
        for (const base of initialSkeletons) {
          setEcuStates((prev) =>
            prev.map((item) =>
              item.ecuId === base.ecuId ? { ...item, status: 'scanning' } : item
            )
          );
          await new Promise((r) => setTimeout(r, 340));
          const scenario = demoMap[base.ecuId];
          const doneEcu: QuickScanEcuResult = {
            ...base,
            status: scenario.dtcs.length > 0 ? 'faults' : 'ok',
            dtcs: scenario.dtcs,
            latencyMs: scenario.latencyMs,
          };
          built.push(doneEcu);
          setEcuStates((prev) =>
            prev.map((item) => (item.ecuId === base.ecuId ? doneEcu : item))
          );
        }
        finalEcus = built;
      }

      const mergedMap = new Map<string, DtcCode>();
      for (const ecu of finalEcus) {
        for (const d of ecu.dtcs) {
          if (!mergedMap.has(d.code)) {
            mergedMap.set(d.code, d);
          }
        }
      }
      const mergedDtcs = Array.from(mergedMap.values());
      const durationMs = Math.max(250, Math.round(performance.now() - scanStart));
      const healthScore = computeHealthScore(finalEcus);

      let summaryText = '';
      try {
        const res = await apiFetch('/api/diagnose/quick-scan-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicleName: `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.year})`,
            vin: hwStatus.vin,
            protocol: hwStatus.protocolName || selectedVehicle.protocol,
            batteryVoltage,
            ecuResults: finalEcus,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          summaryText = data.summaryText || '';
        }
      } catch {
        // Fallback summary below
      }

      if (!summaryText) {
        summaryText =
          mergedDtcs.length === 0
            ? `Scan Rapide terminé : 0 défaut relevé sur Gateway, Moteur, ABS et Airbag (${selectedVehicle.brand} ${selectedVehicle.model}).`
            : `Synthèse : ${mergedDtcs.length} code(s) défaut(s) détecté(s) sur les calculateurs interrogés. Cliquez sur un code ci-dessous pour afficher sa trame figée et l’analyse IA.`;
      }

      const nextReport: QuickScanReport = {
        id: `QS-${Date.now().toString(36).toUpperCase()}`,
        vehicleId: selectedVehicle.id,
        vehicleName: `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.year})`,
        vin: hwStatus.vin,
        transport: hwStatus.transport,
        batteryVoltage,
        scannedAt: new Date().toISOString(),
        durationMs,
        healthScore,
        totalDtcs: mergedDtcs.length,
        ecus: finalEcus,
        summaryText,
      };

      setReport(nextReport);
      onQuickScanComplete(nextReport, mergedDtcs);
    } finally {
      scanLockRef.current = false;
      setIsScanning(false);
    }
  };

  // Déclenchement automatique dès la connexion du véhicule
  useEffect(() => {
    const justConnected = hwStatus.connected && !prevConnectedRef.current;
    prevConnectedRef.current = hwStatus.connected;

    if (justConnected && autoTriggerOnConnect) {
      void runQuickScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hwStatus.connected, autoTriggerOnConnect]);

  const allDtcs = ecuStates.flatMap((e) => e.dtcs.map((d) => ({ ...d, ecuShort: e.shortName })));
  const severityCounts = {
    critical: allDtcs.filter((d) => d.severity === 'critical').length,
    high: allDtcs.filter((d) => d.severity === 'high').length,
    medium: allDtcs.filter((d) => d.severity === 'medium').length,
    low: allDtcs.filter((d) => d.severity === 'low').length,
  };
  const completedCount = ecuStates.filter(
    (e) => e.status === 'ok' || e.status === 'faults' || e.status === 'no_response'
  ).length;
  const healthScore = report?.healthScore ?? computeHealthScore(ecuStates);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900 to-cyan-950/20 border border-cyan-500/40 space-y-4">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>SCAN RAPIDE AUTOMATIQUE</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Topologie 4 Calculateurs : Gateway · Moteur · ABS · Airbag
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white">
            Interrogation Multi-Calculateurs &amp; Synthèse Visuelle des Défauts
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoTriggerOnConnect}
              onChange={toggleAutoTrigger}
              className="accent-cyan-500"
            />
            <span>Auto à la connexion</span>
          </label>

          <button
            type="button"
            disabled={!hwStatus.connected || isScanning}
            onClick={() => void runQuickScan()}
            className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>
              {isScanning
                ? `Interrogation (${completedCount}/4)...`
                : 'Relancer Scan Rapide (4 ECU)'}
            </span>
          </button>
        </div>
      </div>

      {/* 4-ECU Topology Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ecuStates.map((ecu) => {
          const Icon = ECU_ICONS[ecu.ecuId];
          const isFault = ecu.status === 'faults';
          const isOk = ecu.status === 'ok';
          const isScanningEcu = ecu.status === 'scanning';
          const isNoResp = ecu.status === 'no_response';

          const cardClass = isScanningEcu
            ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400/50'
            : isFault
            ? 'border-rose-500/70 bg-rose-950/20'
            : isOk
            ? 'border-emerald-600/60 bg-emerald-950/20'
            : isNoResp
            ? 'border-amber-600/50 bg-amber-950/20'
            : 'border-slate-800 bg-slate-950/60';

          return (
            <div
              key={ecu.ecuId}
              className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${cardClass}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                      isFault
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : isOk
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : isScanningEcu
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block leading-tight">
                      {ecu.shortName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 block">
                      CAN {ecu.canAddress}
                    </span>
                  </div>
                </div>

                {ecu.latencyMs > 0 && (
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {ecu.latencyMs}ms
                  </span>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between text-[11px]">
                {isScanningEcu && (
                  <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Interrogation...
                  </span>
                )}
                {isOk && (
                  <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Nominal · 0 défaut
                  </span>
                )}
                {isFault && (
                  <span className="text-rose-300 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    {ecu.dtcs.length} défaut(s) trouvé(s)
                  </span>
                )}
                {isNoResp && (
                  <span className="text-amber-300 font-semibold">
                    Passerelle non joignable
                  </span>
                )}
                {ecu.status === 'pending' && (
                  <span className="text-slate-500">En attente de connexion</span>
                )}
              </div>

              {/* DTC Pills for this ECU */}
              {ecu.dtcs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
                  {ecu.dtcs.map((dtc) => (
                    <button
                      key={`${ecu.ecuId}-${dtc.code}`}
                      type="button"
                      onClick={() => onSelectDtc(dtc)}
                      className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-rose-500/50 text-[10px] font-mono font-bold text-rose-300 flex items-center gap-1 cursor-pointer"
                      title={dtc.descriptionFr}
                    >
                      <span>{dtc.code}</span>
                      <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Visual Fault Synthesis Section */}
      {(report || completedCount > 0) && (
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Health Score Box */}
            <div className="lg:col-span-4 flex items-center gap-3.5">
              <div
                className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 ${
                  healthScore >= 85
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                    : healthScore >= 60
                    ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                    : 'border-rose-500 bg-rose-950/40 text-rose-300'
                }`}
              >
                <span className="text-lg font-black font-mono leading-none">{healthScore}%</span>
                <span className="text-[9px] uppercase tracking-wider mt-0.5">Santé</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Synthèse Visuelle Défauts ({allDtcs.length} DTC)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                  <span className="text-rose-400">Critiques: {severityCounts.critical}</span>
                  <span className="text-amber-400">Élevés: {severityCounts.high}</span>
                  <span className="text-cyan-400">Moyens: {severityCounts.medium}</span>
                </div>
              </div>
            </div>

            {/* Visual Distribution Bar */}
            <div className="lg:col-span-8 space-y-2">
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                {allDtcs.length === 0 ? (
                  <div className="h-full bg-emerald-500 w-full transition-all duration-500" />
                ) : (
                  <>
                    {severityCounts.critical > 0 && (
                      <div
                        className="h-full bg-rose-500 transition-all duration-500"
                        style={{ width: `${(severityCounts.critical / allDtcs.length) * 100}%` }}
                        title={`Critiques: ${severityCounts.critical}`}
                      />
                    )}
                    {severityCounts.high > 0 && (
                      <div
                        className="h-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${(severityCounts.high / allDtcs.length) * 100}%` }}
                        title={`Élevés: ${severityCounts.high}`}
                      />
                    )}
                    {severityCounts.medium > 0 && (
                      <div
                        className="h-full bg-cyan-500 transition-all duration-500"
                        style={{ width: `${(severityCounts.medium / allDtcs.length) * 100}%` }}
                        title={`Moyens: ${severityCounts.medium}`}
                      />
                    )}
                    {severityCounts.low > 0 && (
                      <div
                        className="h-full bg-slate-500 transition-all duration-500"
                        style={{ width: `${(severityCounts.low / allDtcs.length) * 100}%` }}
                        title={`Faibles: ${severityCounts.low}`}
                      />
                    )}
                  </>
                )}
              </div>

              {report?.summaryText && (
                <p className="text-[11px] text-slate-300 leading-relaxed">{report.summaryText}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
