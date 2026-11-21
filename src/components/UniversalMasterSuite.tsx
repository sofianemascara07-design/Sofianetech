import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  FileCode2,
  Gauge,
  Truck,
  Coins,
  BatteryCharging,
  Laptop,
  ShieldCheck,
} from 'lucide-react';
import { UNIVERSAL_PROFILES, UniversalControlUnitProfile } from '../data/universalMasterDatabase';
import { LocalAgentStatus } from '../types/automotive';
import {
  getOrCreateAgentHmacSecret,
  getOrCreateAgentPairToken,
  probeLocalPcAgent,
} from '../utils/localPcAgent';
import { apiFetch } from '../utils/apiBridge';
import { AutoTunerFlexWorkflow } from './universal/AutoTunerFlexWorkflow';
import { SwiftecBinEditor } from './universal/SwiftecBinEditor';
import { EcmTitaniumMapViewer } from './universal/EcmTitaniumMapViewer';
import { CopilotJ1939Diagnostic } from './universal/CopilotJ1939Diagnostic';
import {
  CreditLedgerItem,
  CreditPackItem,
  PcmFlashCreditsModule,
} from './universal/PcmFlashCreditsModule';

type SuiteModuleTab = 'autotuner' | 'swiftec' | 'ecm_maps' | 'copilot_j1939' | 'pcm_credits';

interface UniversalMasterSuiteProps {
  batteryVoltage: number;
}

export const UniversalMasterSuite: React.FC<UniversalMasterSuiteProps> = ({
  batteryVoltage,
}) => {
  const [activeModule, setActiveModule] = useState<SuiteModuleTab>('autotuner');
  const [selectedProfile, setSelectedProfile] = useState<UniversalControlUnitProfile>(
    UNIVERSAL_PROFILES[0]
  );

  const [pairToken] = useState<string>(() => getOrCreateAgentPairToken());
  const [hmacSecret] = useState<string>(() => getOrCreateAgentHmacSecret());
  const [agentStatus, setAgentStatus] = useState<LocalAgentStatus | null>(null);

  const [balanceTokens, setBalanceTokens] = useState<number>(28);
  const [activePacks, setActivePacks] = useState<string[]>(['pack_cn_asia', 'pack_fr_sgw']);
  const [packsCatalog, setPacksCatalog] = useState<CreditPackItem[]>([]);
  const [ledger, setLedger] = useState<CreditLedgerItem[]>([]);

  const loadCredits = useCallback(async () => {
    try {
      const res = await apiFetch('/api/credits/status');
      if (res.ok) {
        const data = await res.json();
        setBalanceTokens(Number(data.balanceTokens ?? 28));
        if (Array.isArray(data.activePacks)) setActivePacks(data.activePacks);
        if (Array.isArray(data.packsCatalog)) setPacksCatalog(data.packsCatalog);
        if (Array.isArray(data.ledger)) setLedger(data.ledger);
      }
    } catch {
      // Keep local fallback
    }
  }, []);

  useEffect(() => {
    void loadCredits();
    const probe = async () => {
      const st = await probeLocalPcAgent(pairToken);
      setAgentStatus(st);
    };
    void probe();
    const timer = setInterval(() => void probe(), 4000);
    return () => clearInterval(timer);
  }, [pairToken, loadCredits]);

  const effectiveVoltage = agentStatus?.connected ? agentStatus.batteryVoltage : batteryVoltage;
  const isVoltageSafe = effectiveVoltage >= 13.0 && effectiveVoltage <= 15.5;

  const MODULES: Array<{ id: SuiteModuleTab; label: string; icon: React.ReactNode }> = [
    { id: 'autotuner', label: '1. Flash AutoTuner / FLEX (4 Étapes)', icon: <Layers className="w-4 h-4" /> },
    { id: 'swiftec', label: '2. Éditeur 1-Clic Swiftec (.bin)', icon: <FileCode2 className="w-4 h-4" /> },
    { id: 'ecm_maps', label: '3. Cartographie ECM Titanium Lite', icon: <Gauge className="w-4 h-4" /> },
    { id: 'copilot_j1939', label: '4. Diag J1939 & Copilot FR/Darija', icon: <Truck className="w-4 h-4" /> },
    { id: 'pcm_credits', label: '5. Packs PCMFlash & Tokens', icon: <Coins className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 rounded-3xl bg-[#0B1120] border border-slate-800/90 p-4 sm:p-6 shadow-2xl">
      {/* Dark Automotive Cockpit Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              AutoPro Master Suite · UDS / DoIP / J2534 / SAE J1939
            </span>
            <span className="px-2.5 py-0.5 rounded bg-[#111827] border border-slate-700 text-slate-300 font-mono text-[10px]">
              Cible : {selectedProfile.brand} · {selectedProfile.ecuModel}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            Plateforme Universelle Flash, Édition Binaire &amp; Diagnostic Multi-Pôles
          </h2>
          <p className="text-xs text-slate-400">
            Allemand Premium (SFD2/DoIP) · Français Premium (SGW/EAT8) · Asiatique &amp; Chinois (DCT7/CVT) · Poids Lourds SAE J1939.
          </p>
        </div>

        {/* Live Telemetry Pills */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${
              agentStatus?.connected
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                : 'bg-[#111827] border-slate-700 text-slate-400'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>{agentStatus?.connected ? 'Agent 127.0.0.1:38450 OK' : 'Agent PC Hors Ligne'}</span>
          </div>

          <div
            className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 tabular-nums ${
              isVoltageSafe
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/85 border-rose-500 text-rose-200'
            }`}
          >
            <BatteryCharging className="w-4 h-4" />
            <span>{effectiveVoltage.toFixed(2)}V</span>
          </div>

          <button
            type="button"
            onClick={() => setActiveModule('pcm_credits')}
            className="px-3 py-2 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs font-mono font-extrabold flex items-center gap-1.5 cursor-pointer tabular-nums hover:border-amber-400"
          >
            <Coins className="w-4 h-4" />
            <span>{balanceTokens} Tokens</span>
          </button>
        </div>
      </div>

      {/* 5-Module Navigation Switcher */}
      <div className="flex flex-wrap gap-2">
        {MODULES.map((mod) => {
          const isActive = activeModule === mod.id;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => setActiveModule(mod.id)}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/15'
                  : 'bg-[#111827] text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
              }`}
            >
              {mod.icon}
              <span>{mod.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Module Viewport */}
      {activeModule === 'autotuner' && (
        <AutoTunerFlexWorkflow
          agentStatus={agentStatus}
          pairToken={pairToken}
          hmacSecret={hmacSecret}
          fallbackVoltage={batteryVoltage}
          selectedProfile={selectedProfile}
          onSelectProfile={setSelectedProfile}
          onCreditsUpdated={() => void loadCredits()}
        />
      )}

      {activeModule === 'swiftec' && (
        <SwiftecBinEditor
          ecuHint={selectedProfile.ecuModel}
          onCreditsUpdated={() => void loadCredits()}
        />
      )}

      {activeModule === 'ecm_maps' && (
        <EcmTitaniumMapViewer ecuLabel={`${selectedProfile.brand} · ${selectedProfile.ecuModel}`} />
      )}

      {activeModule === 'copilot_j1939' && (
        <CopilotJ1939Diagnostic selectedProfile={selectedProfile} />
      )}

      {activeModule === 'pcm_credits' && (
        <PcmFlashCreditsModule
          balanceTokens={balanceTokens}
          activePacks={activePacks}
          packsCatalog={packsCatalog}
          ledger={ledger}
          onCreditsUpdated={() => void loadCredits()}
        />
      )}
    </div>
  );
};
