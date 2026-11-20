import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Search,
  AlertTriangle,
  CheckCircle2,
  Eye,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { decodeChineseVinEcu } from '../utils/vinEcuDecoder';

const SAMPLE_VINS: Array<{ label: string; vin: string }> = [
  { label: 'Chery Tiggo 7 Pro (1.5T)', vin: 'LVVDB21B7PD123456' },
  { label: 'Geely Coolray Battle 2026', vin: 'L6T7824S6TD004512' },
  { label: 'MG GT / MG5 Turbo (SAIC)', vin: 'LSJA24U62RS098711' },
  { label: 'BYD Song Plus DM-i', vin: 'LGXCE4CB8R0012398' },
  { label: 'DFSK Glory 580 (1.5T)', vin: 'LVZKR2B94MD032145' },
];

export const VinEcuDecoderModule: React.FC = () => {
  const [vinInput, setVinInput] = useState<string>(SAMPLE_VINS[0].vin);

  const decoded = useMemo(() => decodeChineseVinEcu(vinInput), [vinInput]);

  return (
    <div className="space-y-5">
      {/* VIN Input Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Décodeur VIN → Équipementier Calculateur (Bosch / Delphi / UAES / Continental / BYD)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identifie les changements fréquents de séries CKD/Chine pour éviter les erreurs de protocole et de flash
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-emerald-950/70 border border-emerald-600/40 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 self-start">
            <WifiOff className="w-3.5 h-3.5" />
            Moteur 100% Hors-Ligne
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              maxLength={17}
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value.toUpperCase())}
              placeholder="Saisir le VIN à 17 caractères (ex: LVV..., L6T..., LSJ..., LGX..., LVZ...)"
              className="w-full pl-10 pr-20 py-3 rounded-xl bg-slate-950 border border-cyan-500/40 font-mono text-sm tracking-widest text-white uppercase focus:outline-none focus:border-cyan-400"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
              {decoded.vin.length}/17
            </span>
          </div>
        </div>

        {/* Quick VIN Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500">Tests rapides DZ :</span>
          {SAMPLE_VINS.map((s) => (
            <button
              key={s.vin}
              type="button"
              onClick={() => setVinInput(s.vin)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                decoded.vin === s.vin
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Decoded Metadata Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400 block">Format 17 Car.</span>
          <span
            className={`text-xs font-bold flex items-center gap-1 mt-1 ${
              decoded.isValidFormat ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {decoded.isValidFormat ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Valide ISO 3779
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" /> Incomplet ({decoded.vin.length}/17)
              </>
            )}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400 block">Code WMI / Constructeur</span>
          <span className="text-xs font-bold text-white block mt-1">
            <span className="font-mono text-cyan-300">{decoded.wmi}</span> · {decoded.brand}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400 block">Année Modèle (Pos. 10)</span>
          <span className="text-xs font-mono font-bold text-amber-300 block mt-1">
            {decoded.modelYear || 'Non décodée'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400 block">VDS / Usine (Pos. 4-8 / 11)</span>
          <span className="text-xs font-mono font-bold text-slate-200 block mt-1">
            {decoded.vdsCode} · Usine {decoded.plantCode}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400 block">Check-Digit (Pos. 9)</span>
          <span
            className={`text-xs font-bold block mt-1 ${
              decoded.checkDigitValid === true
                ? 'text-emerald-400'
                : decoded.checkDigitValid === false
                ? 'text-amber-300'
                : 'text-slate-400'
            }`}
          >
            {decoded.checkDigitValid === true
              ? 'Clé 9 Valide'
              : decoded.checkDigitValid === false
              ? 'Variante Export CN'
              : '—'}
          </span>
        </div>
      </div>

      {/* Manufacturer & Series Warning */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] uppercase text-slate-400">Constructeur &amp; Gamme Estimée</span>
            <h4 className="text-base font-bold text-white">{decoded.estimatedModelRange}</h4>
            <p className="text-xs text-slate-400">{decoded.manufacturer}</p>
          </div>
          <span className="px-3 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-mono text-xs self-start">
            WMI {decoded.wmi}
          </span>
        </div>

        {decoded.seriesSwitchWarning && (
          <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/50 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 block mb-0.5">
                Alerte Changement de Série Équipementier (Chine) :
              </strong>
              <span>{decoded.seriesSwitchWarning}</span>
            </div>
          </div>
        )}
      </div>

      {/* Candidate ECU / TCU / ABS / BCM Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {decoded.candidates.map((cand, i) => (
          <div
            key={i}
            className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-bold text-xs">
                  {cand.system}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                    cand.confidence === 'Élevée'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40'
                      : 'bg-amber-950/80 text-amber-300 border border-amber-600/40'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  {cand.confidence}
                </span>
              </div>

              <div>
                <div className="text-xs text-slate-400">Équipementier Probable</div>
                <div className="text-base font-extrabold text-white">{cand.supplier}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200">
                {cand.ecuModel}
              </div>

              <div className="text-[11px] text-slate-400">
                Protocole : <span className="text-slate-200 font-mono">{cand.protocol}</span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-800 text-xs text-slate-300 flex items-start gap-2">
              <Eye className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{cand.visualCheckTip}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
