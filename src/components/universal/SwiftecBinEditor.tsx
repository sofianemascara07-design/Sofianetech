import React, { useState } from 'react';
import {
  FileCode2,
  Upload,
  CheckCircle2,
  Download,
  Sparkles,
  Plus,
  X,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '../../utils/apiBridge';
import { computeBinaryIntegrity } from '../../utils/localPcAgent';

interface SwiftecBinEditorProps {
  ecuHint: string;
  onCreditsUpdated?: () => void;
}

const ONE_CLICK_SWITCHES = [
  { id: 'DPF_OFF', label: 'DPF / FAP OFF', desc: 'Désactivation régénération & capteur ΔP' },
  { id: 'EGR_OFF', label: 'EGR OFF', desc: 'Fermeture hystérésis vanne EGR + bypass défaut' },
  { id: 'ADBLUE_OFF', label: 'AdBlue / SCR OFF', desc: 'Suppression pompe SCR, capteur NOx & compteur bridage' },
  { id: 'OPF_OFF', label: 'OPF / GPF OFF', desc: 'Filtre à particules essence (GPF) désactivé' },
  { id: 'IMMO_OFF', label: 'IMMO OFF', desc: 'Désactivation antidémarrage (usage banc/compétition)' },
  { id: 'VMAX_OFF', label: 'VMAX OFF', desc: 'Suppression limiteur vitesse maximale' },
  { id: 'START_STOP_OFF', label: 'Start & Stop OFF', desc: 'Inversion mémoire bouton Start & Stop' },
  { id: 'LSPI_PROTECT', label: 'Patch Anti-LSPI DZ', desc: 'Enrichissement pleine charge & limitation avance bas régime' },
];

export const SwiftecBinEditor: React.FC<SwiftecBinEditorProps> = ({
  ecuHint,
  onCreditsUpdated,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [rawBytes, setRawBytes] = useState<Uint8Array | null>(null);
  const [fileInfo, setFileInfo] = useState<{ sizeBytes: number; crc32Hex: string; sha256Hex: string } | null>(null);

  const [selectedSwitches, setSelectedSwitches] = useState<string[]>(['DPF_OFF', 'EGR_OFF']);
  const [dtcInput, setDtcInput] = useState<string>('P20EE, P0401, U010E');
  const [dtcList, setDtcList] = useState<string[]>(['P20EE', 'P0401', 'U010E']);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [patchedResult, setPatchedResult] = useState<{
    filename: string;
    originalCrc32: string;
    checksumCrc32: string;
    sha256: string;
    detectedHw: string[];
    patchedBase64: string;
    tokensSpent: number;
  } | null>(null);

  const ingestFile = async (file: File) => {
    setErrorMsg(null);
    setPatchedResult(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const integrity = await computeBinaryIntegrity(bytes);
    setFileName(file.name);
    setRawBytes(bytes);
    setFileInfo(integrity);
  };

  const loadSampleBin = async () => {
    const sample = new Uint8Array(8192);
    const header = `BOSCH_MD1CS004_SW_10SW074112_${ecuHint.replace(/\s+/g, '_')}_CALIBRATION_FILE`;
    new TextEncoder().encode(header).forEach((b, i) => {
      sample[i] = b;
    });
    const integrity = await computeBinaryIntegrity(sample);
    setFileName(`ORI_${ecuHint.replace(/[^A-Za-z0-9._-]/g, '_')}.bin`);
    setRawBytes(sample);
    setFileInfo(integrity);
    setPatchedResult(null);
    setErrorMsg(null);
  };

  const toggleSwitch = (id: string) => {
    setSelectedSwitches((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addDtcCodes = () => {
    const tokens = dtcInput
      .toUpperCase()
      .split(/[\s,;]+/)
      .map((s) => s.replace(/[^A-Z0-9]/g, ''))
      .filter((s) => /^[PBCU][0-9A-F]{4}$/.test(s));
    if (tokens.length > 0) {
      setDtcList((prev) => Array.from(new Set([...prev, ...tokens])));
      setDtcInput('');
    }
  };

  const uint8ToBase64 = (bytes: Uint8Array) => {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  const handleGenerateModifiedBin = async () => {
    if (!rawBytes || !fileName) {
      setErrorMsg('Déposez un fichier .bin / .ori ou chargez un exemple atelier ci-dessus.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/binary/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileName,
          binaryBase64: uint8ToBase64(rawBytes),
          switches: selectedSwitches,
          dtcOffList: dtcList,
          stagePreset: selectedSwitches.includes('VMAX_OFF') ? 'MOD_VMAX' : 'MOD_SOLUTIONS',
          consumeCredits: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Échec du traitement binaire.');
        return;
      }
      setPatchedResult(data);
      onCreditsUpdated?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau lors du patch binaire.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPatched = () => {
    if (!patchedResult) return;
    const raw = atob(patchedResult.patchedBase64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    const blob = new Blob([out], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = patchedResult.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void ingestFile(f);
        }}
        className={`p-6 rounded-2xl border-2 border-dashed transition-all ${
          dragOver
            ? 'bg-cyan-950/40 border-cyan-400'
            : 'bg-[#111827] border-slate-700 hover:border-cyan-500/50'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
              <FileCode2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Éditeur Automatique « Swiftec / DaVinci Style » (.bin / .ori)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Glissez-déposez un dump ECU/TCU pour reconnaissance Hardware/Software et génération 1-clic avec recalcul Checksum CRC32.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadSampleBin()}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
            >
              Charger Exemple .ori
            </button>

            <label className="min-h-[40px] px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Importer .bin / .ori</span>
              <input
                type="file"
                accept=".bin,.ori,.hex,.frf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void ingestFile(f);
                }}
              />
            </label>
          </div>
        </div>

        {fileInfo && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#0B1120] border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-slate-500 block">Fichier Source</span>
              <span className="text-white font-bold">{fileName} ({(fileInfo.sizeBytes / 1024).toFixed(1)} Ko)</span>
            </div>
            <div>
              <span className="text-slate-500 block">CRC32 Original</span>
              <span className="text-emerald-300 font-bold">{fileInfo.crc32Hex}</span>
            </div>
            <div>
              <span className="text-slate-500 block">SHA-256</span>
              <span className="text-cyan-300 truncate block">{fileInfo.sha256Hex.slice(0, 24)}…</span>
            </div>
          </div>
        )}
      </div>

      {/* Commutateurs 1-Clic + Table DTC OFF */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 p-5 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
            Commutateurs Intelligents 1-Clic (Solutions ECU)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ONE_CLICK_SWITCHES.map((sw) => {
              const active = selectedSwitches.includes(sw.id);
              return (
                <button
                  key={sw.id}
                  type="button"
                  onClick={() => toggleSwitch(sw.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                    active
                      ? 'bg-emerald-950/50 border-emerald-400 text-white'
                      : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="text-xs font-extrabold text-white">{sw.label}</div>
                    <div className="text-[11px] opacity-80 mt-0.5">{sw.desc}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                      active ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {active ? 'ON' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Saisie multiple DTC OFF */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
            DTC OFF Multiple (Pxxxx / Uxxxx)
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={dtcInput}
              onChange={(e) => setDtcInput(e.target.value)}
              placeholder="Ex : P20EE, P0420, U010E"
              className="flex-1 px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 font-mono text-xs text-white"
            />
            <button
              type="button"
              onClick={addDtcCodes}
              className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 min-h-[72px] p-2.5 rounded-xl bg-[#0B1120] border border-slate-800 content-start">
            {dtcList.length === 0 ? (
              <span className="text-[11px] text-slate-500">Aucun code DTC dans la liste OFF.</span>
            ) : (
              dtcList.map((code) => (
                <span
                  key={code}
                  className="px-2 py-1 rounded bg-rose-950/70 border border-rose-500/40 text-rose-200 font-mono text-[11px] font-bold flex items-center gap-1"
                >
                  {code}
                  <button
                    type="button"
                    onClick={() => setDtcList((prev) => prev.filter((c) => c !== code))}
                    className="hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          <button
            type="button"
            disabled={!rawBytes || isProcessing}
            onClick={() => void handleGenerateModifiedBin()}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isProcessing ? 'Traitement Binaire + Checksum...' : 'Générer Fichier Modifié + Checksum'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {patchedResult && (
        <div className="p-4 rounded-2xl bg-emerald-950/35 border border-emerald-500/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2 font-extrabold text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Fichier Modifié Prêt : {patchedResult.filename}</span>
            </div>
            <div className="font-mono text-[11px] text-slate-300">
              Hardware détecté : <strong className="text-cyan-300">{patchedResult.detectedHw.join(', ')}</strong> · CRC32 :{' '}
              <span className="text-slate-400">{patchedResult.originalCrc32}</span> →{' '}
              <strong className="text-emerald-300">{patchedResult.checksumCrc32}</strong> ({patchedResult.tokensSpent} Token débité)
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadPatched}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Télécharger .bin + Checksum OK</span>
          </button>
        </div>
      )}
    </div>
  );
};
