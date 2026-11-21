import React, { useState } from 'react';
import {
  Coins,
  PackageCheck,
  PlusCircle,
  Download,
  FileCode2,
  CheckCircle2,
  Server,
} from 'lucide-react';
import { apiFetch } from '../../utils/apiBridge';
import cloudBackendFastapiRaw from '../../agent/cloud_backend_fastapi.py?raw';
import {
  downloadAgentServerPy,
  downloadPairedInstallAgentBat,
  getOrCreateAgentHmacSecret,
  getOrCreateAgentPairToken,
} from '../../utils/localPcAgent';

export interface CreditPackItem {
  id: string;
  name: string;
  description: string;
  includedTokens: number;
  priceDzd: string;
}

export interface CreditLedgerItem {
  id: string;
  timestamp: string;
  operation: string;
  deltaTokens: number;
  balanceAfter: number;
}

interface PcmFlashCreditsModuleProps {
  balanceTokens: number;
  activePacks: string[];
  packsCatalog: CreditPackItem[];
  ledger: CreditLedgerItem[];
  onCreditsUpdated: () => void;
}

export const PcmFlashCreditsModule: React.FC<PcmFlashCreditsModuleProps> = ({
  balanceTokens,
  activePacks,
  packsCatalog,
  ledger,
  onCreditsUpdated,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const handleActivatePack = async (packId: string) => {
    setBusyId(packId);
    try {
      const res = await apiFetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBanner(`Module activé ! Nouveau solde : ${data.balanceTokens} Tokens.`);
        onCreditsUpdated();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleTopUp = async (amount: number) => {
    setBusyId(`topup_${amount}`);
    try {
      const res = await apiFetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraTokens: amount }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBanner(`Recharge +${amount} Tokens validée (Solde : ${data.balanceTokens}).`);
        onCreditsUpdated();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadCloudFastApi = () => {
    const blob = new Blob([cloudBackendFastapiRaw], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cloud_backend_fastapi.py';
    a.click();
    URL.revokeObjectURL(url);
    setBanner('Code Backend Cloud FastAPI (cloud_backend_fastapi.py) téléchargé.');
  };

  const handleDownloadBat = () => {
    const fn = downloadPairedInstallAgentBat(getOrCreateAgentPairToken(), getOrCreateAgentHmacSecret());
    setBanner(`Installateur PC "${fn}" (UAC + netsh pare-feu 38450 + agent_server.py auto-extrait) téléchargé.`);
  };

  return (
    <div className="space-y-5">
      {/* Solde Crédits + Recharges + Livrables Backend / Agent */}
      <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Coins className="w-4 h-4" />
            Système Modulaire « PCMFlash Style » &amp; Crédits Tokens
          </div>
          <div className="text-2xl font-extrabold text-white tabular-nums">
            {balanceTokens} <span className="text-sm font-semibold text-cyan-400">Tokens Disponibles</span>
          </div>
          <p className="text-xs text-slate-400">
            1 Token par patch standard / écriture simple · 2 Tokens pour multi-solutions (DPF+EGR+SCR) · 3 Tokens Poids Lourds J1939.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busyId === 'topup_10'}
            onClick={() => void handleTopUp(10)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+10 Tokens Atelier</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCloudFastApi}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0B1120] hover:border-cyan-400 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Server className="w-4 h-4" />
            <span>Backend FastAPI (.py)</span>
          </button>

          <button
            type="button"
            onClick={() => void downloadAgentServerPy()}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0B1120] hover:border-emerald-400 border border-slate-700 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="w-4 h-4" />
            <span>agent_server.py</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadBat}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>install_agent.bat</span>
          </button>
        </div>
      </div>

      {banner && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {/* Catalogue 4 Packs PCMFlash */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {packsCatalog.map((pack) => {
          const isUnlocked = activePacks.includes(pack.id);
          return (
            <div
              key={pack.id}
              className={`p-5 rounded-2xl border space-y-3 ${
                isUnlocked
                  ? 'bg-emerald-950/20 border-emerald-500/50'
                  : 'bg-[#111827] border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-white">{pack.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{pack.description}</p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded font-mono text-[10px] font-extrabold shrink-0 ${
                    isUnlocked
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-amber-300'
                  }`}
                >
                  {isUnlocked ? 'ACTIF' : pack.priceDzd}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-cyan-300 font-mono font-bold">
                  +{pack.includedTokens} Tokens inclus
                </span>
                <button
                  type="button"
                  disabled={busyId === pack.id}
                  onClick={() => void handleActivatePack(pack.id)}
                  className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer ${
                    isUnlocked
                      ? 'bg-[#0B1120] hover:border-emerald-400 border border-emerald-500/40 text-emerald-300'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>{isUnlocked ? 'Recharger ce Pack' : 'Activer Licence Pack'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Historique des Transactions Crédits */}
      <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-2.5">
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
          Journal des Opérations &amp; Crédits Tokens
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
          {ledger.map((row) => (
            <div
              key={row.id}
              className="px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <span className="font-semibold text-white block truncate">{row.operation}</span>
                <span className="text-[10px] font-mono text-slate-500">
                  {new Date(row.timestamp).toLocaleString('fr-FR')}
                </span>
              </div>
              <div className="text-right font-mono shrink-0 tabular-nums">
                <span className={row.deltaTokens >= 0 ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                  {row.deltaTokens >= 0 ? `+${row.deltaTokens}` : row.deltaTokens} T
                </span>
                <span className="block text-[10px] text-slate-400">Solde : {row.balanceAfter}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
