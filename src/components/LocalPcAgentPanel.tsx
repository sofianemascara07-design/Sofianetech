import React, { useState, useEffect, useCallback } from 'react';
import {
  Laptop,
  Download,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Zap,
  Copy,
  Check,
  Terminal,
  Cpu,
  AlertTriangle,
  KeyRound,
  Play,
  BatteryCharging,
  FileCode2,
  Lock,
  CloudCog,
  HardDrive,
  Activity,
} from 'lucide-react';
import {
  LocalAgentStatus,
  LocalAgentWritePolicy,
} from '../types/automotive';
import {
  LOCAL_PC_AGENT_URL,
  getOrCreateAgentPairToken,
  regenerateAgentPairToken,
  getOrCreateAgentHmacSecret,
  regenerateAgentHmacSecret,
  downloadPairedInstallAgentBat,
  downloadAgentServerPy,
  downloadStandaloneAgentMjs,
  probeLocalPcAgent,
  setLocalAgentPolicy,
  submitWriteRequestToLocalAgent,
  approveLocalWriteRequest,
  rejectLocalWriteRequest,
  computeBinaryIntegrity,
  computeHmacSha256Hex,
  executeJ2534WriteEcu,
  testCloudSeedKey,
} from '../utils/localPcAgent';

interface LocalPcAgentPanelProps {
  batteryVoltage?: number;
  compact?: boolean;
  onAgentConnectionChange?: (connected: boolean) => void;
}

interface SelectedBinMeta {
  name: string;
  rawBytes: Uint8Array;
  sizeBytes: number;
  crc32Hex: string;
  sha256Hex: string;
  hmacHex: string;
}

const ECU_TARGET_PRESETS = [
  { id: 'BOSCH_MG1US008', label: 'Bosch MG1US008 (Coolray 1.5T 4-Cyl)', txId: '0x7E0', level: '11' as const },
  { id: 'BOSCH_MG1CS080', label: 'Bosch MG1CS080 (Coolray Ph1 / Monjaro)', txId: '0x7E0', level: '11' as const },
  { id: 'BOSCH_MED17.8.10', label: 'Bosch MED17.8.10 (Geely / Jetour / Chery)', txId: '0x7E0', level: '01' as const },
  { id: 'GETRAG_7DCT_TCU', label: 'Getrag / Magna 7DCT TCU (Boîte Vitesses)', txId: '0x7E1', level: '01' as const },
  { id: 'DELPHI_DCM7.1A', label: 'Delphi DCM7.1A (Fiat Scudo / PSA)', txId: '0x7E0', level: '11' as const },
];

export const LocalPcAgentPanel: React.FC<LocalPcAgentPanelProps> = ({
  batteryVoltage = 13.8,
  compact = false,
  onAgentConnectionChange,
}) => {
  const [pairToken, setPairToken] = useState<string>(() => getOrCreateAgentPairToken());
  const [hmacSecret, setHmacSecret] = useState<string>(() => getOrCreateAgentHmacSecret());
  const [writePolicy, setWritePolicy] = useState<LocalAgentWritePolicy>('AUTO_ON_REQUEST');
  const [agentStatus, setAgentStatus] = useState<LocalAgentStatus | null>(null);
  const [probing, setProbing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  // Flash J2534 Anti-Bricking state
  const [selectedEcuIdx, setSelectedEcuIdx] = useState<number>(0);
  const [vinInput, setVinInput] = useState<string>('L6T7944Z5RZ001842');
  const [selectedBin, setSelectedBin] = useState<SelectedBinMeta | null>(null);
  const [isWritingEcu, setIsWritingEcu] = useState<boolean>(false);
  const [flashResult, setFlashResult] = useState<{
    ok: boolean;
    status: string;
    message: string;
    backupPath?: string;
    crc32?: string;
  } | null>(null);
  const [cloudSeedTest, setCloudSeedTest] = useState<string | null>(null);

  const refreshStatus = useCallback(
    async (silent = false) => {
      if (!silent) setProbing(true);
      try {
        const st = await probeLocalPcAgent(pairToken);
        setAgentStatus(st);
        if (st) {
          setWritePolicy(st.writePolicy);
        }
        onAgentConnectionChange?.(Boolean(st?.connected));
      } finally {
        if (!silent) setProbing(false);
      }
    },
    [pairToken, onAgentConnectionChange]
  );

  useEffect(() => {
    void refreshStatus(true);
    const timer = setInterval(() => {
      void refreshStatus(true);
    }, isWritingEcu ? 800 : 3000);
    return () => clearInterval(timer);
  }, [refreshStatus, isWritingEcu]);

  const effectiveVoltage = agentStatus?.connected ? agentStatus.batteryVoltage : batteryVoltage;
  const isVoltageLow =
    effectiveVoltage < 13.0 ||
    agentStatus?.voltageStatus === 'VOLTAGE_LOW' ||
    flashResult?.status === 'VOLTAGE_LOW';
  const isVoltageHigh = effectiveVoltage > 15.5 || agentStatus?.voltageStatus === 'VOLTAGE_HIGH';
  const isVoltageSafe = !isVoltageLow && !isVoltageHigh;

  const currentEcuPreset = ECU_TARGET_PRESETS[selectedEcuIdx] || ECU_TARGET_PRESETS[0];

  const handleCopy = (id: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handlePolicyChange = async (nextPolicy: LocalAgentWritePolicy) => {
    setWritePolicy(nextPolicy);
    if (agentStatus?.connected) {
      const ok = await setLocalAgentPolicy(pairToken, nextPolicy, effectiveVoltage);
      if (ok) {
        setFeedback({
          type: 'ok',
          text:
            nextPolicy === 'AUTO_ON_REQUEST'
              ? 'Mode "Exécution Automatique sur Demande" activé sur l’Agent PC (garde-fou >= 13.0V actif).'
              : 'Mode "Demander Validation à Chaque Écriture" activé sur l’Agent PC.',
        });
        await refreshStatus(true);
      }
    }
  };

  const handleDownloadPythonInstallBat = () => {
    const filename = downloadPairedInstallAgentBat(pairToken, hmacSecret);
    setFeedback({
      type: 'ok',
      text: `Installateur "${filename}" téléchargé (UAC Admin + Pare-feu netsh port 38450 + FastAPI J2534 pré-appairés).`,
    });
  };

  const handleDownloadAgentPy = async () => {
    const filename = await downloadAgentServerPy();
    setFeedback({
      type: 'ok',
      text: `Serveur Python FastAPI J2534 "${filename}" téléchargé. Placez-le dans le même dossier que install_agent.bat.`,
    });
  };

  const handleDownloadStandaloneMjs = () => {
    const filename = downloadStandaloneAgentMjs(pairToken, writePolicy);
    setFeedback({
      type: 'ok',
      text: `Passerelle Node.js "${filename}" téléchargée (mode compatibilité légère).`,
    });
  };

  const handleSelectBinFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFlashResult(null);
    const buffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(buffer);
    const integrity = await computeBinaryIntegrity(rawBytes);
    const hmacHex = await computeHmacSha256Hex(hmacSecret, rawBytes);
    setSelectedBin({
      name: file.name,
      rawBytes,
      sizeBytes: integrity.sizeBytes,
      crc32Hex: integrity.crc32Hex,
      sha256Hex: integrity.sha256Hex,
      hmacHex,
    });
    setFeedback({
      type: 'ok',
      text: `Fichier "${file.name}" vérifié (${(integrity.sizeBytes / 1024).toFixed(1)} Ko · CRC32 ${integrity.crc32Hex}) et signé HMAC-SHA256.`,
    });
  };

  const handleLaunchEcuFlash = async () => {
    if (!selectedBin || !agentStatus?.connected || !isVoltageSafe) return;
    setIsWritingEcu(true);
    setFlashResult(null);
    try {
      const res = await executeJ2534WriteEcu({
        token: pairToken,
        hmacSecret,
        ecuModel: currentEcuPreset.id,
        txIdHex: currentEcuPreset.txId,
        vin: vinInput,
        securityLevel: currentEcuPreset.level,
        filename: selectedBin.name,
        rawBytes: selectedBin.rawBytes,
        dryRun: true,
      });
      setFlashResult(res);
      setFeedback({
        type: res.ok ? 'ok' : 'err',
        text: res.message,
      });
      await refreshStatus(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur communication Agent PC 127.0.0.1:38450.';
      setFlashResult({ ok: false, status: 'AGENT_ERROR', message: msg });
      setFeedback({ type: 'err', text: msg });
    } finally {
      setIsWritingEcu(false);
    }
  };

  const handleTestCloudSeedKey = async () => {
    setBusyActionId('seed_test');
    try {
      const res = await testCloudSeedKey({
        seedHex: '4A9F12C0',
        ecuModel: currentEcuPreset.id,
        securityLevel: currentEcuPreset.level,
        vin: vinInput,
      });
      if (res.success && res.keyHex) {
        setCloudSeedTest(
          `Seed 4A9F12C0 → Cloud Key ${res.keyHex} (${res.udsSendKeyFrameHex}) · ${res.ecuFamily}`
        );
      } else {
        setCloudSeedTest(res.error || 'Échec calcul Cloud Seed/Key.');
      }
    } finally {
      setBusyActionId(null);
    }
  };

  const handleTestWriteRequest = async () => {
    setBusyActionId('test_write');
    try {
      const res = await submitWriteRequestToLocalAgent(pairToken, {
        targetModule: 'TCU 0x7E1 (Test Atelier)',
        operationType: 'ROUTINE_UDS',
        title: 'Test Demande Écriture : Reset Auto-Adaptations TCU (0x31 01 02 01)',
        txId: '0x7E1',
        serviceHex: '31',
        payloadHex: '01 02 01',
        batteryVoltage: effectiveVoltage,
      });
      setFeedback({
        type: res.ok ? 'ok' : 'warn',
        text: res.autoExecuted
          ? `Exécuté automatiquement par l’Agent PC : ${res.message}`
          : res.message,
      });
      await refreshStatus(true);
    } catch {
      setFeedback({
        type: 'err',
        text: 'Agent PC non détecté sur 127.0.0.1:38450. Lancez install_agent.bat sur le poste client.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleApprove = async (id: string) => {
    setBusyActionId(id);
    try {
      const res = await approveLocalWriteRequest(pairToken, id);
      setFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
      await refreshStatus(true);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    setBusyActionId(id);
    try {
      await rejectLocalWriteRequest(pairToken, id);
      setFeedback({ type: 'warn', text: 'Demande d’écriture annulée.' });
      await refreshStatus(true);
    } finally {
      setBusyActionId(null);
    }
  };

  const launchCommand = `set AUTOPRO_TOKEN=${pairToken} && set AUTOPRO_HMAC_SECRET=${hmacSecret.slice(0, 12)}... && python agent_server.py`;
  const pendingCount = agentStatus?.pendingRequests?.length || 0;
  const isFlashDisabled =
    !agentStatus?.connected || !isVoltageSafe || !selectedBin || isWritingEcu;

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border ${
        isVoltageLow
          ? 'border-rose-500/70'
          : agentStatus?.connected
          ? 'border-emerald-500/50'
          : 'border-cyan-500/35'
      } ${compact ? 'p-4' : 'p-6'} space-y-4`}
    >
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5" />
              Agent PC J2534 Python FastAPI · 127.0.0.1:38450
            </span>

            <span
              className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-bold border ${
                agentStatus?.connected
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400'
              }`}
            >
              {agentStatus?.connected
                ? `CONNECTÉ · ${agentStatus.agentEngine === 'PYTHON_FASTAPI_J2534' ? 'FastAPI ctypes J2534' : 'Bridge'} · ${agentStatus.hostname}`
                : 'HORS LIGNE · 127.0.0.1:38450'}
            </span>

            {/* Badge Tension Batterie en temps réel (PassThruIoctl READ_VBATT) */}
            <span
              className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-extrabold border flex items-center gap-1 tabular-nums ${
                isVoltageSafe
                  ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
                  : 'bg-rose-950/90 border-rose-500 text-rose-200 animate-pulse'
              }`}
            >
              <BatteryCharging className="w-3.5 h-3.5" />
              <span>
                {effectiveVoltage.toFixed(2)}V · {isVoltageSafe ? 'STABILISÉ (≥13.0V)' : 'VOLTAGE_LOW / BLOQUÉ'}
              </span>
            </span>

            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-extrabold animate-pulse">
                {pendingCount} DEMANDE(S) EN ATTENTE
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-white">
            Pont Sécurisé PC ↔ J2534 (Scanmatik 2 Pro / Tactrix OpenPort 2.0) &amp; Cloud Seed/Key 0x27
          </h3>
          <p className="text-xs text-slate-400">
            Isolation stricte localhost + pare-feu Windows port 38450, signature HMAC-SHA256 sur chaque <code className="text-cyan-300">.bin</code>, calcul Seed/Key déporté Cloud, Auto-Backup <code className="text-cyan-300">C:\AutoPro_Backups\</code> et <code className="text-cyan-300">TesterPresent 0x3E 0x80</code> / 2s.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void refreshStatus(false)}
            disabled={probing}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
            <span>Détecter Agent</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPythonInstallBat}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>install_agent.bat (UAC + Pare-feu)</span>
          </button>

          <button
            type="button"
            onClick={() => void handleDownloadAgentPy()}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>agent_server.py</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadStandaloneMjs}
            className="min-h-[40px] px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            title="Version légère Node.js alternative"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>.mjs</span>
          </button>
        </div>
      </div>

      {/* ALERTE OBLIGATOIRE TENSION < 13.0V / > 15.5V */}
      {!isVoltageSafe && (
        <div className="p-3.5 rounded-xl bg-rose-950/85 border-2 border-rose-500 text-rose-100 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-extrabold text-sm text-white">
              ⚠️ Tension insuffisante (&lt; 13.0V). Branchez un stabilisateur de tension / chargeur maintien de charge avant de flasher.
            </div>
            <div className="text-rose-200/90 tabular-nums">
              Lecture <code className="font-mono">PassThruIoctl(READ_VBATT)</code> : <strong>{effectiveVoltage.toFixed(2)}V</strong> (plage autorisée : 13.00V – 15.50V). Le bouton « Lancer l’Écriture » est verrouillé automatiquement pour prévenir tout bricking ECU.
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : feedback.type === 'warn'
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* FLASH ECU ANTI-BRICKING & HMAC-SHA256 + CLOUD SEED/KEY 0x27 */}
      <div className="p-4 rounded-xl bg-slate-950/90 border border-cyan-500/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-white">
              Console Flash J2534 Anti-Bricking (HMAC-SHA256 + CRC32 + Cloud 0x27)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busyActionId === 'seed_test'}
              onClick={() => void handleTestCloudSeedKey()}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <CloudCog className="w-3.5 h-3.5" />
              <span>Tester Cloud Seed/Key 0x27</span>
            </button>
          </div>
        </div>

        {cloudSeedTest && (
          <div className="px-3 py-2 rounded-lg bg-cyan-950/50 border border-cyan-500/40 text-[11px] font-mono text-cyan-200">
            {cloudSeedTest}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400">Calculateur Cible (UDS)</span>
            <select
              value={selectedEcuIdx}
              onChange={(e) => setSelectedEcuIdx(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold"
            >
              {ECU_TARGET_PRESETS.map((preset, idx) => (
                <option key={preset.id} value={idx}>
                  {preset.label} ({preset.txId})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400">VIN Véhicule</span>
            <input
              type="text"
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value.toUpperCase())}
              maxLength={20}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
              placeholder="VIN 17 caractères"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400">Fichier Binaire (.bin)</span>
            <input
              type="file"
              accept=".bin,.hex,.frf"
              onChange={(e) => void handleSelectBinFile(e)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:bg-cyan-500 file:text-slate-950 file:font-bold cursor-pointer"
            />
          </label>
        </div>

        {selectedBin && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono">
            <div>
              <span className="text-slate-500 block">Fichier</span>
              <span className="text-white font-bold truncate block">{selectedBin.name}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Taille / CRC32</span>
              <span className="text-emerald-300 font-bold tabular-nums">
                {(selectedBin.sizeBytes / 1024).toFixed(1)} Ko · {selectedBin.crc32Hex}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">SHA-256</span>
              <span className="text-cyan-300 truncate block">{selectedBin.sha256Hex.slice(0, 18)}…</span>
            </div>
            <div>
              <span className="text-slate-500 block">Signature HMAC-SHA256</span>
              <span className="text-amber-300 truncate block">{selectedBin.hmacHex.slice(0, 18)}…</span>
            </div>
          </div>
        )}

        {/* Barre de progression & Verrou dynamique Lancer l'Écriture */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                {agentStatus?.flashProgress?.active
                  ? `${agentStatus.flashProgress.stage} (${agentStatus.flashProgress.percent}%)`
                  : flashResult
                  ? `${flashResult.status} : ${flashResult.message}`
                  : 'Prêt : Auto-Backup C:\\AutoPro_Backups\\ + TesterPresent 0x3E 0x80'}
              </span>
              {agentStatus?.flashProgress?.testerPresentActive && (
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-mono text-[10px]">
                  0x3E 0x80 ACTIF
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  flashResult && !flashResult.ok
                    ? 'bg-rose-500'
                    : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                }`}
                style={{
                  width: `${
                    agentStatus?.flashProgress?.active
                      ? agentStatus.flashProgress.percent
                      : flashResult?.ok
                      ? 100
                      : 0
                  }%`,
                }}
              />
            </div>
            {(flashResult?.backupPath || agentStatus?.flashProgress?.backupPath) && (
              <div className="text-[10px] font-mono text-emerald-300 flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                <span>
                  Backup créé : {flashResult?.backupPath || agentStatus?.flashProgress?.backupPath}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isFlashDisabled}
            onClick={() => void handleLaunchEcuFlash()}
            className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shrink-0 ${
              isFlashDisabled
                ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-lg shadow-emerald-500/20'
            }`}
          >
            {isFlashDisabled ? <Lock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>
              {isWritingEcu
                ? 'Écriture en cours...'
                : isVoltageLow
                ? 'Verrouillé (< 13.0V)'
                : "Lancer l'Écriture"}
            </span>
          </button>
        </div>
      </div>

      {/* Config Row: Pairing Token + HMAC Secret + Auto-Write Policy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
              Jeton X-AutoPro-Token &amp; Clé HMAC-SHA256
            </span>
            <button
              type="button"
              onClick={() => {
                setPairToken(regenerateAgentPairToken());
                setHmacSecret(regenerateAgentHmacSecret());
              }}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
            >
              Régénérer Paire
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono font-bold text-cyan-300 truncate">
              {pairToken}
            </code>
            <button
              type="button"
              onClick={() => handleCopy('token', pairToken)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'token' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'token' ? 'OK' : 'Token'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy('hmac', hmacSecret)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'hmac' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'hmac' ? 'OK' : 'HMAC'}</span>
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <code className="text-[10px] font-mono text-slate-400 truncate">{launchCommand}</code>
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  'cmd',
                  `set AUTOPRO_TOKEN=${pairToken}&& set AUTOPRO_HMAC_SECRET=${hmacSecret}&& python agent_server.py`
                )
              }
              className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 shrink-0 cursor-pointer"
            >
              {copiedKey === 'cmd' ? 'OK' : 'Copier CLI'}
            </button>
          </div>
        </div>

        {/* Politique d'Exécution d'Écriture */}
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Politique d’Écriture / Routines UDS
            </span>
            <span className="text-[10px] font-mono text-slate-400 tabular-nums">
              Garde-fou &ge; 13.0V ({effectiveVoltage.toFixed(1)}V)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handlePolicyChange('AUTO_ON_REQUEST')}
              className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                writePolicy === 'AUTO_ON_REQUEST'
                  ? 'bg-emerald-950/60 border-emerald-400 text-emerald-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              <div className="font-bold flex items-center gap-1 text-[11px]">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Exécution Auto sur Demande
              </div>
              <div className="text-[10px] opacity-80 mt-0.5">
                Exécute dès validation HMAC &amp; tension &ge; 13.0V
              </div>
            </button>

            <button
              type="button"
              onClick={() => void handlePolicyChange('ASK_EACH_WRITE')}
              className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                writePolicy === 'ASK_EACH_WRITE'
                  ? 'bg-amber-950/60 border-amber-400 text-amber-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              <div className="font-bold flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Demander Confirmation
              </div>
              <div className="text-[10px] opacity-80 mt-0.5">
                Met en file d’attente jusqu’à votre clic Approuver
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Live Drivers + Write Request Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
        {/* Detected J2534 & COM Hardware */}
        <div className="lg:col-span-5 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Drivers J2534 Détectés (Registre Windows)
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {agentStatus ? `${agentStatus.drivers.length} interface(s)` : 'Hors ligne'}
            </span>
          </div>

          {!agentStatus ? (
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <p>
                1. Téléchargez <strong className="text-cyan-300">install_agent.bat</strong> et <strong className="text-emerald-300">agent_server.py</strong> dans un même dossier puis lancez <code className="text-slate-200">install_agent.bat</code>.
              </p>
              <p>
                2. L’installateur élève les droits UAC, bloque le port <code className="text-slate-300">38450</code> sur le réseau public via <code className="text-slate-300">netsh advfirewall</code> et scanne <code className="text-slate-300">PassThruSupport.04.04</code>.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {agentStatus.drivers.map((drv, i) => (
                <div
                  key={`${drv.name}-${i}`}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{drv.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {drv.vendor} {drv.dllPath ? `· ${drv.dllPath}` : ''}
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                      drv.kind === 'J2534_DLL'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                        : drv.kind === 'COM_PORT'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {drv.kind}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Write Queue & Auto-Execution Console */}
        <div className="lg:col-span-7 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Play className="w-4 h-4 text-emerald-400" />
              File des Demandes d’Écriture &amp; Routines ({agentStatus?.executedCount || 0} exécutées)
            </span>
            <button
              type="button"
              disabled={!agentStatus?.connected || busyActionId === 'test_write'}
              onClick={() => void handleTestWriteRequest()}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-[11px] font-bold cursor-pointer disabled:opacity-40"
            >
              Tester Routine 0x31
            </button>
          </div>

          {!agentStatus || agentStatus.recentRequests.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-center text-[11px] text-slate-400">
              {agentStatus?.connected
                ? 'Aucune requête en attente. Chargez un .bin ci-dessus ou testez une routine UDS.'
                : `Connectez l’Agent PC sur ${LOCAL_PC_AGENT_URL} pour superviser les écritures et télémesures J2534.`}
            </div>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {agentStatus.recentRequests.map((reqItem) => (
                <div
                  key={reqItem.id}
                  className={`p-2.5 rounded-lg border space-y-1.5 ${
                    reqItem.status === 'PENDING_APPROVAL'
                      ? 'bg-amber-950/35 border-amber-500/60'
                      : reqItem.status === 'EXECUTED'
                      ? 'bg-emerald-950/25 border-emerald-500/40'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-white text-[11px]">{reqItem.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold ${
                        reqItem.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-500 text-slate-950'
                          : reqItem.status === 'EXECUTED'
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-rose-950 text-rose-300'
                      }`}
                    >
                      {reqItem.status}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400">
                    {reqItem.txId} → {reqItem.serviceHex} {reqItem.payloadHex}
                    {reqItem.rxHex ? ` · RX: ${reqItem.rxHex}` : ''} · {reqItem.batteryVoltage}V
                  </div>

                  {reqItem.resultMessage && (
                    <div className="text-[11px] text-emerald-300">{reqItem.resultMessage}</div>
                  )}

                  {reqItem.status === 'PENDING_APPROVAL' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busyActionId === reqItem.id}
                        onClick={() => void handleApprove(reqItem.id)}
                        className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approuver &amp; Exécuter Auto
                      </button>
                      <button
                        type="button"
                        disabled={busyActionId === reqItem.id}
                        onClick={() => void handleReject(reqItem.id)}
                        className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Refuser
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
