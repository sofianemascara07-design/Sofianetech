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
} from 'lucide-react';
import {
  LocalAgentStatus,
  LocalAgentWritePolicy,
} from '../types/automotive';
import {
  LOCAL_PC_AGENT_URL,
  getOrCreateAgentPairToken,
  regenerateAgentPairToken,
  downloadSelfExtractingWindowsInstallerBat,
  downloadStandaloneAgentMjs,
  probeLocalPcAgent,
  setLocalAgentPolicy,
  submitWriteRequestToLocalAgent,
  approveLocalWriteRequest,
  rejectLocalWriteRequest,
} from '../utils/localPcAgent';

interface LocalPcAgentPanelProps {
  batteryVoltage?: number;
  compact?: boolean;
  onAgentConnectionChange?: (connected: boolean) => void;
}

export const LocalPcAgentPanel: React.FC<LocalPcAgentPanelProps> = ({
  batteryVoltage = 13.8,
  compact = false,
  onAgentConnectionChange,
}) => {
  const [pairToken, setPairToken] = useState<string>(() => getOrCreateAgentPairToken());
  const [writePolicy, setWritePolicy] = useState<LocalAgentWritePolicy>('AUTO_ON_REQUEST');
  const [agentStatus, setAgentStatus] = useState<LocalAgentStatus | null>(null);
  const [probing, setProbing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

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
    }, 3000);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  const handleCopy = (id: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handlePolicyChange = async (nextPolicy: LocalAgentWritePolicy) => {
    setWritePolicy(nextPolicy);
    if (agentStatus?.connected) {
      const ok = await setLocalAgentPolicy(pairToken, nextPolicy, batteryVoltage);
      if (ok) {
        setFeedback({
          type: 'ok',
          text:
            nextPolicy === 'AUTO_ON_REQUEST'
              ? 'Mode "Exécution Automatique sur Demande" activé sur l’Agent PC (avec sécurité tension >= 12.2V).'
              : 'Mode "Demander Validation à Chaque Écriture" activé sur l’Agent PC.',
        });
        await refreshStatus(true);
      }
    }
  };

  const handleDownloadWindowsInstaller = () => {
    const filename = downloadSelfExtractingWindowsInstallerBat(pairToken, writePolicy);
    setFeedback({
      type: 'ok',
      text: `Installateur "${filename}" téléchargé. Double-cliquez dessus sur le PC du client pour installer et lancer l’Agent J2534.`,
    });
  };

  const handleDownloadStandaloneMjs = () => {
    const filename = downloadStandaloneAgentMjs(pairToken, writePolicy);
    setFeedback({
      type: 'ok',
      text: `Script "${filename}" téléchargé (Windows / Linux / macOS).`,
    });
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
        batteryVoltage,
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
        text: 'Agent PC non détecté sur 127.0.0.1:38450. Lancez INSTALL-AUTOPRO-AGENT.bat sur le poste client.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleApprove = async (id: string) => {
    setBusyActionId(id);
    try {
      const res = await approveLocalWriteRequest(pairToken, id);
      setFeedback({
        type: res.ok ? 'ok' : 'err',
        text: res.message,
      });
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

  const launchCommand = `AUTOPRO_PAIR_TOKEN=${pairToken} AUTOPRO_WRITE_POLICY=${writePolicy} node autopro-pc-agent.mjs`;
  const pendingCount = agentStatus?.pendingRequests?.length || 0;

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border ${
        agentStatus?.connected ? 'border-emerald-500/50' : 'border-cyan-500/35'
      } ${compact ? 'p-4' : 'p-6'} space-y-4`}
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5" />
              Agent Micro Client PC · J2534 &amp; Écriture Auto
            </span>
            <span
              className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-bold border ${
                agentStatus?.connected
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400'
              }`}
            >
              {agentStatus?.connected
                ? `CONNECTÉ · ${agentStatus.hostname} (${agentStatus.osPlatform})`
                : 'EN ATTENTE SUR 127.0.0.1:38450'}
            </span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-extrabold animate-pulse">
                {pendingCount} DEMANDE(S) EN ATTENTE
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white">
            Pont PC Client 1-Clic : Détection Drivers J2534 / COM &amp; Exécution d’Écriture sur Demande
          </h3>
          <p className="text-xs text-slate-400">
            Installez ce léger agent sur le micro-ordinateur du client pour accéder aux interfaces Windows J2534 PassThru (Tactrix OpenPort 2.0, Scanmatik 2 Pro) et exécuter flash/codage automatiquement dès validation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void refreshStatus(false)}
            disabled={probing}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
            <span>Détecter Agent</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadWindowsInstaller}
            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Installateur PC 1-Clic (.bat)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadStandaloneMjs}
            className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Agent .mjs</span>
          </button>
        </div>
      </div>

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

      {/* Config Row: Pairing Token + Auto-Write Policy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
              Jeton d’Appairage Sécurisé PC Client
            </span>
            <button
              type="button"
              onClick={() => setPairToken(regenerateAgentPairToken())}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
            >
              Régénérer
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono font-bold text-cyan-300">
              {pairToken}
            </code>
            <button
              type="button"
              onClick={() => handleCopy('token', pairToken)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'token' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'token' ? 'Copié' : 'Copier'}</span>
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <code className="text-[10px] font-mono text-slate-400 truncate">{launchCommand}</code>
            <button
              type="button"
              onClick={() => handleCopy('cmd', launchCommand)}
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
              Politique d’Écriture / Flash Automatique
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Garde-fou &ge; 12.2V ({batteryVoltage.toFixed(1)}V)
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
                Exécute dès réception de la requête (si tension OK)
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
              Interfaces Matérielles Détectées
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {agentStatus ? `${agentStatus.drivers.length} interface(s)` : 'Hors ligne'}
            </span>
          </div>

          {!agentStatus ? (
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <p>
                1. Cliquez sur <strong className="text-cyan-300">« Installateur PC 1-Clic (.bat) »</strong> et lancez-le sur le PC du client.
              </p>
              <p>
                2. L’agent scanne le registre Windows (<code className="text-slate-300">PassThruSupport.04.04</code>) et ouvre <code className="text-slate-300">{LOCAL_PC_AGENT_URL}</code> automatiquement.
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
              File des Demandes d’Écriture &amp; Flash ({agentStatus?.executedCount || 0} exécutées)
            </span>
            <button
              type="button"
              disabled={!agentStatus?.connected || busyActionId === 'test_write'}
              onClick={() => void handleTestWriteRequest()}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-[11px] font-bold cursor-pointer disabled:opacity-40"
            >
              Tester Demande Écriture
            </button>
          </div>

          {!agentStatus || agentStatus.recentRequests.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-center text-[11px] text-slate-400">
              {agentStatus?.connected
                ? 'Aucune écriture en attente. Lancez un Flash TCU, Reset Adaptations ou « Tester Demande Écriture ».'
                : 'Connectez l’Agent PC pour visualiser, approuver ou exécuter automatiquement les demandes d’écriture.'}
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
