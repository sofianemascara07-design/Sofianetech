import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Thermometer,
  Gauge,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Wrench,
  Upload,
  FileCode2,
  Sparkles,
  Terminal,
  Play,
  Square,
  Cable,
  ShieldCheck,
  Sliders,
  Laptop,
} from 'lucide-react';
import { LocalPcAgentPanel } from './LocalPcAgentPanel';
import {
  getOrCreateAgentPairToken,
  submitWriteRequestToLocalAgent,
} from '../utils/localPcAgent';
import {
  Vehicle,
  TransmissionType,
  TransmissionTransportMode,
  TransmissionSimScenario,
  TransmissionLiveData,
  TransmissionDtc,
  UdsCanFrameLog,
  TransmissionAiDiagnosticResult,
} from '../types/automotive';
import {
  TRANSMISSION_PROFILES,
  TCU_CAN_TX_ID,
  TCU_CAN_RX_ID,
  TCU_UDS_ROUTINES,
  TCU_UDS_DIDS,
  generateSimulatedLiveData,
  getSimulatedScenarioDtcs,
  executeTcuUdsCommand,
} from '../utils/tcuUdsBridge';
import { obdHardwareBridge } from '../utils/obdHardwareBridge';
import { apiFetch } from '../utils/apiBridge';

interface TransmissionTcuSuiteProps {
  selectedVehicle: Vehicle;
  isConnected: boolean;
  onOpenConnectModal: () => void;
}

const SYMPTOM_PRESETS = [
  'À-coups à chaud 2e-3e et passage brutal en R',
  'Patinage à l’accélération et surchauffe ATF > 110°C',
  'Boîte bloquée en mode dégradé (3e fixe) + perte pression',
  'Coupure affichage rapport PRND et perte communication TCU',
];

export const TransmissionTcuSuite: React.FC<TransmissionTcuSuiteProps> = ({
  selectedVehicle,
  isConnected,
  onOpenConnectModal,
}) => {
  const [transmissionType, setTransmissionType] = useState<TransmissionType>('DSG_DCT');
  const [transportMode, setTransportMode] = useState<TransmissionTransportMode>('SIMULATION');
  const [simScenario, setSimScenario] = useState<TransmissionSimScenario>('optimal_hot');
  const [isStreamingLive, setIsStreamingLive] = useState<boolean>(true);
  const [tick, setTick] = useState<number>(0);

  const [liveData, setLiveData] = useState<TransmissionLiveData>(() =>
    generateSimulatedLiveData('DSG_DCT', 'optimal_hot', 0)
  );
  const [dtcs, setDtcs] = useState<TransmissionDtc[]>(() =>
    getSimulatedScenarioDtcs('DSG_DCT', 'optimal_hot')
  );
  const [udsLogs, setUdsLogs] = useState<UdsCanFrameLog[]>([]);
  const [statusBanner, setStatusBanner] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busyRoutine, setBusyRoutine] = useState<string | null>(null);
  const [activeActuatorId, setActiveActuatorId] = useState<string | null>(null);

  // Flash TCU (.bin / .frf) state
  const [flashFile, setFlashFile] = useState<{
    name: string;
    sizeKb: number;
    ext: string;
    sha256Short: string;
    headerHex: string;
  } | null>(null);
  const [flashProgress, setFlashProgress] = useState<number | null>(null);

  // AI Assistant state
  const [symptomInput, setSymptomInput] = useState<string>(SYMPTOM_PRESETS[0]);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<TransmissionAiDiagnosticResult | null>(null);

  // Client PC Agent state
  const [showAgentPanel, setShowAgentPanel] = useState<boolean>(false);
  const [agentConnected, setAgentConnected] = useState<boolean>(false);

  const profile = useMemo(() => TRANSMISSION_PROFILES[transmissionType], [transmissionType]);

  // Synchroniser automatiquement avec l'adaptateur matériel s'il est connecté en BLE/Serial réel
  useEffect(() => {
    if (obdHardwareBridge.isRealHardwareConnected()) {
      setTransportMode('ELM327_BRIDGE');
    }
  }, [isConnected]);

  // Boucle de rafraîchissement Live Data (1 Hz)
  useEffect(() => {
    if (!isStreamingLive) return;
    const timer = setInterval(() => {
      setTick((t) => {
        const next = t + 1;
        setLiveData(generateSimulatedLiveData(transmissionType, simScenario, next));
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isStreamingLive, transmissionType, simScenario]);

  // Recalculer instantanément lors du changement de type de boîte ou scénario
  useEffect(() => {
    setLiveData(generateSimulatedLiveData(transmissionType, simScenario, tick));
    if (transportMode === 'SIMULATION') {
      setDtcs(getSimulatedScenarioDtcs(transmissionType, simScenario));
    }
  }, [transmissionType, simScenario]);

  const appendUdsExchangeLogs = (tx: UdsCanFrameLog, rx: UdsCanFrameLog) => {
    setUdsLogs((prev) => [rx, tx, ...prev].slice(0, 30));
  };

  // Zone optimale niveau de vidange ATF : 58°C - 68°C
  const atfStatus = useMemo(() => {
    const t = liveData.atfTempC;
    if (t >= 58 && t <= 68) {
      return {
        label: 'ZONE OPTIMALE VIDANGE / NIVEAU (58°C – 68°C)',
        color: 'text-emerald-300',
        badge: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300',
        barColor: 'bg-emerald-500',
      };
    }
    if (t < 58) {
      return {
        label: 'HUILE FROIDE (< 58°C) — Attendre montée en température',
        color: 'text-cyan-300',
        badge: 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300',
        barColor: 'bg-cyan-500',
      };
    }
    if (t <= 98) {
      return {
        label: 'FONCTIONNEMENT CHAUD NORMAL (> 68°C)',
        color: 'text-amber-300',
        badge: 'bg-amber-950/80 border-amber-500/40 text-amber-300',
        barColor: 'bg-amber-500',
      };
    }
    return {
      label: 'SURCHAUFFE ATF CRITIQUE (> 98°C) — Risque patinage / joint',
      color: 'text-rose-300',
      badge: 'bg-rose-950/80 border-rose-500/60 text-rose-300 animate-pulse',
      barColor: 'bg-rose-500',
    };
  }, [liveData.atfTempC]);

  const handleReadDtcs = async () => {
    setBusyRoutine('read_dtc');
    try {
      // Étape 1 : Ouvrir Session Étendue UDS 0x10 03
      const sess = await executeTcuUdsCommand({
        transport: transportMode,
        transmissionType,
        scenario: simScenario,
        serviceHex: '10',
        payloadHex: '03',
        label: 'DiagnosticSessionControl (Session Étendue TCU)',
      });
      appendUdsExchangeLogs(sess.txLog, sess.rxLog);

      // Étape 2 : Lecture DTC 0x19 02 09
      const dtcRes = await executeTcuUdsCommand({
        transport: transportMode,
        transmissionType,
        scenario: simScenario,
        serviceHex: '19',
        payloadHex: '02 09',
        label: 'ReadDTCInformation (0x19 02 09)',
      });
      appendUdsExchangeLogs(dtcRes.txLog, dtcRes.rxLog);
      if (dtcRes.parsedDtcs) {
        setDtcs(dtcRes.parsedDtcs);
      }
      setStatusBanner({ type: dtcRes.ok ? 'ok' : 'warn', text: dtcRes.message });
    } catch (err: any) {
      setStatusBanner({ type: 'err', text: err?.message || 'Erreur lecture DTC 0x7E1.' });
    } finally {
      setBusyRoutine(null);
    }
  };

  const handleClearDtcs = async () => {
    setBusyRoutine('clear_dtc');
    try {
      const res = await executeTcuUdsCommand({
        transport: transportMode,
        transmissionType,
        scenario: simScenario,
        serviceHex: '14',
        payloadHex: 'FF FF FF',
        label: 'ClearDiagnosticInformation (TCU 0x7E1)',
      });
      appendUdsExchangeLogs(res.txLog, res.rxLog);
      if (res.ok) {
        setDtcs([]);
        if (transportMode === 'SIMULATION') {
          setSimScenario('optimal_hot');
        }
      }
      setStatusBanner({ type: res.ok ? 'ok' : 'warn', text: res.message });
    } catch (err: any) {
      setStatusBanner({ type: 'err', text: err?.message || 'Erreur effacement DTC TCU.' });
    } finally {
      setBusyRoutine(null);
    }
  };

  const handlePollLiveDid = async () => {
    setBusyRoutine('read_did');
    try {
      const res = await executeTcuUdsCommand({
        transport: transportMode,
        transmissionType,
        scenario: simScenario,
        serviceHex: '22',
        payloadHex: `${TCU_UDS_DIDS.ATF_TEMPERATURE.slice(0, 2)} ${TCU_UDS_DIDS.ATF_TEMPERATURE.slice(2)}`,
        label: 'ReadDataByIdentifier (ATF & Pression F411/F422)',
      });
      appendUdsExchangeLogs(res.txLog, res.rxLog);
      setLiveData(generateSimulatedLiveData(transmissionType, simScenario, tick + 1));
      setStatusBanner({ type: 'ok', text: res.message });
    } finally {
      setBusyRoutine(null);
    }
  };

  const handleRunSpecialRoutine = async (
    routineKey: 'reset_adapt' | 'kiss_point' | 'purge_actuators',
    routineHexId: string,
    title: string
  ) => {
    setBusyRoutine(routineKey);
    try {
      const sess = await executeTcuUdsCommand({
        transport: transportMode,
        transmissionType,
        scenario: simScenario,
        serviceHex: '10',
        payloadHex: '03',
        label: 'Passage Session Étendue (0x10 03) pré-routine',
      });
      appendUdsExchangeLogs(sess.txLog, sess.rxLog);

      const spacedId = `${routineHexId.slice(0, 2)} ${routineHexId.slice(2)}`;
      const res = await executeTcuUdsCommand({
        transport: transportMode,
        transmissionType,
        scenario: simScenario,
        serviceHex: '31',
        payloadHex: `01 ${spacedId}`,
        label: `RoutineControl : ${title}`,
      });
      appendUdsExchangeLogs(res.txLog, res.rxLog);

      if (routineKey === 'purge_actuators') {
        for (const sol of ['N88', 'N89', 'N90', 'N93']) {
          setActiveActuatorId(sol);
          await new Promise((r) => setTimeout(r, 280));
        }
        setActiveActuatorId(null);
      }

      setStatusBanner({
        type: res.ok ? 'ok' : 'warn',
        text: `${title} : ${res.message}`,
      });
    } catch (err: any) {
      setStatusBanner({ type: 'err', text: err?.message || `Échec routine ${title}.` });
    } finally {
      setBusyRoutine(null);
      setActiveActuatorId(null);
    }
  };

  const handleFlashFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (ext !== 'bin' && ext !== 'frf' && ext !== 'sgo') {
      setStatusBanner({
        type: 'warn',
        text: 'Format non reconnu : utilisez un fichier binaire TCU .bin, .frf ou .sgo.',
      });
      return;
    }

    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf.slice(0, 12));
    const headerHex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    let sha256Short = 'CRC-LOCAL';
    try {
      if (window.crypto?.subtle) {
        const digest = await window.crypto.subtle.digest('SHA-256', buf);
        const hashArr = Array.from(new Uint8Array(digest));
        sha256Short = hashArr
          .slice(0, 6)
          .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
          .join('');
      }
    } catch {
      // Fallback hash badge
    }

    setFlashFile({
      name: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      ext: `.${ext}`,
      sha256Short,
      headerHex,
    });
    setFlashProgress(null);
    setStatusBanner({
      type: 'ok',
      text: `Fichier TCU "${file.name}" (${Math.round(file.size / 1024)} Ko) vérifié et prêt pour écriture sécurisée.`,
    });
  };

  const handleStartTcuFlash = async () => {
    if (!flashFile) return;
    if (liveData.tcuVoltage < 12.2) {
      setStatusBanner({
        type: 'err',
        text: `HARD_STOP Tension faible (${liveData.tcuVoltage}V < 12.2V). Branchez un stabilisateur batterie avant tout flash TCU.`,
      });
      return;
    }

    setBusyRoutine('flash_tcu');
    setFlashProgress(10);
    try {
      if (transportMode === 'LOCAL_PC_AGENT') {
        const writeReq = await submitWriteRequestToLocalAgent(getOrCreateAgentPairToken(), {
          targetModule: `TCU ${TCU_CAN_TX_ID} (${profile.shortLabel})`,
          operationType: 'FLASH_TCU',
          title: `Flash Binaire TCU : ${flashFile.name}`,
          txId: TCU_CAN_TX_ID,
          serviceHex: '34',
          payloadHex: `00 44 ${flashFile.headerHex.slice(0, 11)}`,
          fileName: flashFile.name,
          sha256Short: flashFile.sha256Short,
          batteryVoltage: liveData.tcuVoltage,
        });
        if (writeReq.request?.status === 'PENDING_APPROVAL') {
          setShowAgentPanel(true);
          setFlashProgress(25);
          setStatusBanner({
            type: 'warn',
            text: 'Demande de Flash transmise à l’Agent PC (en attente). Cliquez sur « Approuver & Exécuter Auto » ci-dessous ou activez le mode Exécution Auto.',
          });
          return;
        }
        setFlashProgress(100);
        setStatusBanner({
          type: writeReq.ok ? 'ok' : 'err',
          text: writeReq.message,
        });
        return;
      }

      // 0x10 02 Programming Session
      const progSess = await executeTcuUdsCommand({
        transport: transportMode,
        transmissionType,
        scenario: simScenario,
        serviceHex: '10',
        payloadHex: '02',
        label: 'Ouverture Bootloader TCU (0x10 02)',
      });
      appendUdsExchangeLogs(progSess.txLog, progSess.rxLog);
      setFlashProgress(35);

      // 0x31 01 FF 00 Pre-Flash Memory Check
      const eraseRes = await executeTcuUdsCommand({
        transport: transportMode,
        transmissionType,
        scenario: simScenario,
        serviceHex: '31',
        payloadHex: '01 FF 00',
        label: `Préparation Flash (${flashFile.name})`,
      });
      appendUdsExchangeLogs(eraseRes.txLog, eraseRes.rxLog);
      setFlashProgress(70);

      await new Promise((r) => setTimeout(r, 450));
      setFlashProgress(100);
      setStatusBanner({
        type: 'ok',
        text: `Séquence Flash TCU UDS terminée pour "${flashFile.name}" (SHA: ${flashFile.sha256Short}). Effectuez une calibration Kiss Point après coupure contact.`,
      });
    } catch (err: any) {
      setStatusBanner({ type: 'err', text: err?.message || 'Erreur pendant la séquence flash TCU.' });
      setFlashProgress(null);
    } finally {
      setBusyRoutine(null);
    }
  };

  const handleRunAiDiagnosis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsAiAnalyzing(true);
    try {
      const res = await apiFetch('/api/transmission/ai-diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transmissionType,
          vehicleLabel: `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.year})`,
          symptom: symptomInput,
          dtcs: dtcs.map((d) => ({ code: d.code, descriptionFr: d.descriptionFr })),
          liveData,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success && data.diagnosis) {
        setAiResult(data.diagnosis);
      } else {
        setStatusBanner({
          type: 'warn',
          text: data?.error || 'Impossible de contacter l’assistant IA transmission.',
        });
      }
    } catch {
      setStatusBanner({
        type: 'err',
        text: 'Erreur réseau lors de l’analyse IA transmission.',
      });
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const maxBar = profile.nominalPressureRangeBar[1] * 1.15;
  const targetPct = Math.min(100, Math.round((liveData.targetPressureBar / maxBar) * 100));
  const actualPct = Math.min(100, Math.round((liveData.actualPressureBar / maxBar) * 100));
  const pressureDelta = parseFloat((liveData.actualPressureBar - liveData.targetPressureBar).toFixed(1));

  return (
    <div className="space-y-6">
      {/* Top Bar: Suite Identity + Transmission Selector + Transport & Scenario */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <Sliders className="w-4 h-4" />
              <span>Transmission &amp; TCU Diagnostic Suite · ISO 14229 UDS</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-cyan-500/40 font-mono text-[10px] text-cyan-300">
                CAN TX {TCU_CAN_TX_ID} ↔ RX {TCU_CAN_RX_ID}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white">
              {profile.label} — {selectedVehicle.brand} {selectedVehicle.model}
            </h2>
            <p className="text-xs text-slate-400">{profile.examples}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Transport Bridge Selector */}
            <select
              value={transportMode}
              onChange={(e) => {
                const mode = e.target.value as TransmissionTransportMode;
                setTransportMode(mode);
                if (mode === 'LOCAL_PC_AGENT') setShowAgentPanel(true);
              }}
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="SIMULATION">Simulation Atelier Intégrée (Sans Véhicule)</option>
              <option value="LOCAL_PC_AGENT">
                Agent Micro Client PC (J2534 &amp; Écriture Auto{agentConnected ? ' · CONNECTÉ' : ''})
              </option>
              <option value="ELM327_BRIDGE">
                Pont Web BLE / Serial (ELM327 / OBDLink{obdHardwareBridge.isRealHardwareConnected() ? ' · CONNECTÉ' : ''})
              </option>
              <option value="J2534_PASSTHRU">API REST Passthru J2534 (0x7E1/0x7E9)</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAgentPanel((v) => !v)}
              className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                agentConnected
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                  : showAgentPanel
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-cyan-400'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Agent PC {agentConnected ? '(En ligne)' : '1-Clic'}</span>
            </button>

            {transportMode === 'ELM327_BRIDGE' && !obdHardwareBridge.isRealHardwareConnected() && (
              <button
                type="button"
                onClick={onOpenConnectModal}
                className="px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 text-xs font-bold cursor-pointer"
              >
                Connecter ELM327
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsStreamingLive((v) => !v)}
              className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                isStreamingLive
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {isStreamingLive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isStreamingLive ? 'Flux Live Actif' : 'Flux en Pause'}
            </button>
          </div>
        </div>

        {/* Transmission Architecture Selector Pills */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {(Object.keys(TRANSMISSION_PROFILES) as TransmissionType[]).map((key) => {
            const p = TRANSMISSION_PROFILES[key];
            const active = transmissionType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTransmissionType(key)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="text-xs font-bold">{p.shortLabel}</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{p.label}</div>
              </button>
            );
          })}
        </div>

        {/* Simulation Scenario Bar (for immediate zero-vehicle testing) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-semibold mr-1">Scénario Simulation :</span>
            {[
              { id: 'optimal_hot', label: 'Optimal Vidange (63°C)' },
              { id: 'slip_overheat', label: 'Patinage + Surchauffe (>110°C)' },
              { id: 'mechatronic_pressure_drop', label: 'Chute Pression Mécatronique' },
              { id: 'solenoid_u0101_limp', label: 'Défaut N90 + U0101 Dégradé' },
            ].map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSimScenario(sc.id as TransmissionSimScenario)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                  simScenario === sc.id
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handlePollLiveDid()}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-[11px] font-mono cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${busyRoutine === 'read_did' ? 'animate-spin' : ''}`} />
            UDS 0x22 F411
          </button>
        </div>
      </div>

      {showAgentPanel && (
        <LocalPcAgentPanel
          batteryVoltage={liveData.tcuVoltage}
          compact
          onAgentConnectionChange={setAgentConnected}
        />
      )}

      {statusBanner && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            statusBanner.type === 'ok'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
              : statusBanner.type === 'warn'
              ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
          }`}
        >
          <span>{statusBanner.text}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-slate-400 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. LIVE DATA DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card A: ATF Temperature + 58-68°C Optimal Zone */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-cyan-400" />
              Température Huile ATF
            </span>
            <span className="font-mono text-[10px] text-slate-500">DID 0xF411</span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className={`text-3xl font-mono font-extrabold ${atfStatus.color}`}>
              {liveData.atfTempC}°C
            </span>
            <span className="text-xs font-mono text-slate-400">
              Tension TCU : <strong className="text-white">{liveData.tcuVoltage}V</strong>
            </span>
          </div>

          {/* Temp scale bar with marked 58-68°C optimal band */}
          <div className="relative h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            {/* Optimal 58-68C window on a 0..130C scale (~44% to 52%) */}
            <div
              className="absolute top-0 bottom-0 bg-emerald-500/35 border-x border-emerald-400"
              style={{ left: '44.6%', width: '7.7%' }}
              title="Zone optimale vidange 58°C - 68°C"
            />
            <div
              className={`h-full transition-all duration-300 ${atfStatus.barColor}`}
              style={{ width: `${Math.min(100, Math.round((liveData.atfTempC / 130) * 100))}%` }}
            />
          </div>

          <div className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${atfStatus.badge}`}>
            {atfStatus.label}
          </div>
        </div>

        {/* Card B: Hydraulic Pressure Consigne vs Réelle */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Pression Hydraulique (Bar)
            </span>
            <span
              className={`font-mono text-[11px] font-bold ${
                Math.abs(pressureDelta) > 2.5 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              Δ {pressureDelta >= 0 ? `+${pressureDelta}` : pressureDelta} bar
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Consigne TCU</span>
                <span className="font-mono font-bold text-cyan-300">
                  {liveData.targetPressureBar} bar
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-950 overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${targetPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Pression Réelle Mesurée</span>
                <span
                  className={`font-mono font-bold ${
                    Math.abs(pressureDelta) > 2.5 ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  {liveData.actualPressureBar} bar
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-950 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    Math.abs(pressureDelta) > 2.5 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${actualPct}%` }}
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Plage nominale {profile.shortLabel} : {profile.nominalPressureRangeBar[0]} –{' '}
            {profile.nominalPressureRangeBar[1]} bar
          </p>
        </div>

        {/* Card C: Rapport Engagé, Arbres & Glissement */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              Rapport Engagé &amp; Glissement
            </span>
            <span className="font-mono text-[10px] text-slate-500">{liveData.timestamp}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="px-4 py-2 rounded-xl bg-slate-950 border border-cyan-500/40 text-center">
              <span className="text-[10px] text-slate-400 block">Rapport</span>
              <span className="text-xl font-mono font-extrabold text-cyan-300">
                {liveData.currentGear}
              </span>
            </div>

            <div className="flex-1 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Arbre Primaire :</span>
                <span className="font-mono text-white">{liveData.inputShaftRpm} tr/min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Arbre Sortie :</span>
                <span className="font-mono text-white">{liveData.outputShaftRpm} tr/min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Glissement :</span>
                <span
                  className={`font-mono font-bold ${
                    liveData.slipRpm > 90 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {liveData.slipRpm} tr/min
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 truncate">
            État : <span className="text-cyan-300 font-semibold">{liveData.clutchState}</span>
          </div>
        </div>
      </div>

      {/* Solenoid Currents Table (mA) N88-N93 */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            Courant des Électrovannes (mA) — Pilotage Mécatronique N88 à N93
          </h3>
          <span className="font-mono text-[10px] text-slate-400">DID 0xF440</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {liveData.solenoids.map((sol) => {
            const isTesting = activeActuatorId === sol.id;
            return (
              <div
                key={sol.id}
                className={`p-3 rounded-xl border transition-all ${
                  isTesting
                    ? 'bg-cyan-950/60 border-cyan-400 ring-1 ring-cyan-400'
                    : sol.status === 'Ouvert/C-C'
                    ? 'bg-rose-950/40 border-rose-500/50'
                    : sol.status === 'Dérive'
                    ? 'bg-amber-950/30 border-amber-500/40'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono font-bold text-xs text-white">{sol.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isTesting
                        ? 'bg-cyan-500 text-slate-950'
                        : sol.status === 'OK'
                        ? 'bg-emerald-950 text-emerald-300'
                        : sol.status === 'Dérive'
                        ? 'bg-amber-950 text-amber-300'
                        : 'bg-rose-950 text-rose-300'
                    }`}
                  >
                    {isTesting ? 'IMPULSION ACTIVE' : sol.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mb-2">{sol.label}</div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Cible : {sol.targetMa} mA</span>
                  <span className="text-cyan-300 font-bold">Réel : {sol.actualMa} mA</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${
                      sol.status === 'Ouvert/C-C'
                        ? 'bg-rose-500'
                        : sol.status === 'Dérive'
                        ? 'bg-amber-400'
                        : 'bg-cyan-400'
                    }`}
                    style={{ width: `${sol.dutyCyclePct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. DTC CONSOLE + SPECIAL FUNCTIONS & FLASH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Console DTC Spécifique Transmission */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Console DTC Transmission (TCU 0x7E1)
              </h3>
              <p className="text-[11px] text-slate-400">
                Plages couvertes : P0700–P0999 · P1700–P1899 · P2700–P2795 · U0101
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busyRoutine !== null}
                onClick={() => void handleReadDtcs()}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {busyRoutine === 'read_dtc' ? 'Lecture UDS...' : 'Lire DTC (0x19)'}
              </button>
              <button
                type="button"
                disabled={busyRoutine !== null}
                onClick={() => void handleClearDtcs()}
                className="px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/70 border border-rose-500/50 text-rose-200 font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Effacer (0x14)
              </button>
            </div>
          </div>

          {dtcs.length === 0 ? (
            <div className="p-6 rounded-xl bg-emerald-950/30 border border-emerald-600/30 text-center space-y-1">
              <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
              <div className="text-xs font-bold text-emerald-300">
                0 défaut transmission détecté (TCU 0x7E9 sain)
              </div>
              <p className="text-[11px] text-slate-400">
                Changez le scénario de simulation ci-dessus pour tester P0730, P17BF, P2789 ou U0101.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {dtcs.map((d, idx) => (
                <div
                  key={`${d.code}-${idx}`}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 font-mono font-bold text-xs">
                        {d.code}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {d.rangeCategory}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.status === 'Actif'
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-amber-950 text-amber-300'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200">{d.descriptionFr}</p>
                  {d.rawHexFrame && (
                    <div className="text-[10px] font-mono text-slate-500">
                      Trame CAN 0x7E9 : {d.rawHexFrame}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Fonctions Spéciales & Gestionnaire Flash TCU (.bin / .frf) */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-cyan-400" />
            Fonctions Spéciales UDS (0x31) &amp; Flash TCU
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              disabled={busyRoutine !== null}
              onClick={() =>
                void handleRunSpecialRoutine(
                  'reset_adapt',
                  TCU_UDS_ROUTINES.RESET_ADAPTATIONS,
                  'Reset Auto-Adaptations TCU'
                )
              }
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-left space-y-1 cursor-pointer disabled:opacity-50"
            >
              <div className="text-xs font-bold text-cyan-300">Reset Adaptations</div>
              <div className="text-[10px] text-slate-400">
                UDS 0x31 01 02 01 · Efface mémoires de pression
              </div>
            </button>

            <button
              type="button"
              disabled={busyRoutine !== null}
              onClick={() =>
                void handleRunSpecialRoutine(
                  'kiss_point',
                  TCU_UDS_ROUTINES.CLUTCH_KISS_POINT_CALIB,
                  'Calibration Kiss Point'
                )
              }
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-left space-y-1 cursor-pointer disabled:opacity-50"
            >
              <div className="text-xs font-bold text-amber-300">Calibration Kiss Point</div>
              <div className="text-[10px] text-slate-400">
                UDS 0x31 01 02 02 · Point de léchage K1/K2
              </div>
            </button>

            <button
              type="button"
              disabled={busyRoutine !== null}
              onClick={() =>
                void handleRunSpecialRoutine(
                  'purge_actuators',
                  TCU_UDS_ROUTINES.HYDRAULIC_PURGE_ACTUATOR_TEST,
                  'Purge & Test N88-N93'
                )
              }
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-emerald-400 text-left space-y-1 cursor-pointer disabled:opacity-50"
            >
              <div className="text-xs font-bold text-emerald-300">Purge / Test Actionneurs</div>
              <div className="text-[10px] text-slate-400">
                UDS 0x31 01 02 03 · Cycle électrovannes N88-N93
              </div>
            </button>
          </div>

          {/* Flash TCU Manager */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4 text-cyan-400" />
                Gestionnaire Flash / Clonage TCU (.bin / .frf / .sgo)
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Min 12.2V requis ({liveData.tcuVoltage}V)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <label className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-dashed border-slate-600 hover:border-cyan-400 text-xs text-slate-300 flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {flashFile
                    ? `${flashFile.name} (${flashFile.sizeKb} Ko · SHA ${flashFile.sha256Short})`
                    : 'Sélectionner fichier TCU (.bin ou .frf)...'}
                </span>
                <input
                  type="file"
                  accept=".bin,.frf,.sgo"
                  onChange={(e) => void handleFlashFileSelect(e)}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                disabled={!flashFile || busyRoutine !== null}
                onClick={() => void handleStartTcuFlash()}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-40 shrink-0"
              >
                Lancer Flash TCU
              </button>
            </div>

            {flashFile && (
              <div className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1.5 rounded">
                En-tête binaire : {flashFile.headerHex} · Checksum SHA-256 : {flashFile.sha256Short}
              </div>
            )}

            {flashProgress !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-cyan-300">
                  <span>Programmation Bootloader 0x7E1</span>
                  <span>{flashProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-300"
                    style={{ width: `${flashProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. ASSISTANT IA DE DIAGNOSTIC RÉPARATION */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Assistant IA Diagnostic &amp; Réparation Transmission
            </h3>
            <p className="text-xs text-slate-400">
              Analyse croisée : Codes DTC TCU + Température ATF / Pression / Électrovannes + Symptôme décrit
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono text-cyan-300 self-start">
            {dtcs.length} DTC · {liveData.atfTempC}°C · {liveData.actualPressureBar} bar
          </span>
        </div>

        <form onSubmit={handleRunAiDiagnosis} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={symptomInput}
              onChange={(e) => setSymptomInput(e.target.value)}
              placeholder='Ex: "à-coups à chaud 2e-3e", "patinage", "boîte bloquée en mode dégradé"...'
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={isAiAnalyzing}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              {isAiAnalyzing ? 'Analyse TCU en cours...' : 'Diagnostiquer avec IA'}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SYMPTOM_PRESETS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSymptomInput(s)}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-[11px] text-slate-300 cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </form>

        {aiResult && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            {/* Point 1: Cause Probable */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase text-amber-400">
                  1. Cause Probable
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-[10px]">
                  {aiResult.probableCause.category}
                </span>
              </div>
              <p className="text-xs font-bold text-white">{aiResult.probableCause.summary}</p>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {aiResult.probableCause.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Point 2: Tests Multimètre / Oscilloscope */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <span className="text-[11px] font-bold uppercase text-cyan-400 block">
                2. Tests de Contrôle (Multimètre / Oscillo)
              </span>
              <div className="space-y-2">
                {aiResult.controlTests.map((t, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-cyan-300">{t.tool}</span>
                    </div>
                    <div className="text-slate-200 font-medium">{t.point}</div>
                    <div className="font-mono text-[11px] text-emerald-300 mt-1">
                      Attendu : {t.expectedValue}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Point 3: Procédure de Réparation */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-emerald-400">
                  3. Procédure de Réparation
                </span>
                {aiResult.aiVerification && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {aiResult.aiVerification.confidenceLevel === 'STRICT_VERIFIED' ? 'Vérifié' : 'Filtré'}
                  </span>
                )}
              </div>
              <ol className="space-y-2 text-xs text-slate-200">
                {aiResult.repairProcedure.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono font-bold text-[10px] shrink-0">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Bus CAN UDS Trace Monitor (0x7E1 <-> 0x7E9) */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-cyan-400" />
            Journal Trames CAN ISO 14229 UDS ({TCU_CAN_TX_ID} / {TCU_CAN_RX_ID})
          </span>
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
            <Cable className="w-3 h-3" />
            Transport : {transportMode}
          </span>
        </div>

        {udsLogs.length === 0 ? (
          <p className="text-xs font-mono text-slate-500">
            En attente d’une commande UDS (cliquez sur « Lire DTC (0x19) », « UDS 0x22 » ou une Fonction Spéciale)...
          </p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px]">
            {udsLogs.map((log) => (
              <div
                key={log.id}
                className={`flex flex-wrap items-center gap-2 px-2 py-1 rounded ${
                  log.isNegativeResponse
                    ? 'bg-rose-950/40 text-rose-300'
                    : log.direction === 'TX -> 0x7E1'
                    ? 'text-cyan-300 bg-slate-900/60'
                    : 'text-emerald-300 bg-slate-900/30'
                }`}
              >
                <span className="text-slate-500">[{log.timestamp}]</span>
                <span className="font-bold">{log.direction}</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-white">{log.rawHex}</span>
                <span className="text-slate-400 truncate">— {log.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
