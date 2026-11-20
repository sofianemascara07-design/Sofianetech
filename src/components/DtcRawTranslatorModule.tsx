import React, { useState, useMemo } from 'react';
import {
  Languages,
  Sparkles,
  Wrench,
  Gauge,
  AlertTriangle,
  WifiOff,
  History,
  CheckCircle2,
} from 'lucide-react';
import { DtcRawTranslateResult } from '../types/automotive';
import { apiFetch } from '../utils/apiBridge';
import {
  loadDtcTranslationsCache,
  saveDtcTranslationToCache,
} from '../utils/workshopOfflineCache';

const QUICK_RAW_PRESETS = [
  {
    label: 'Chery 12V Chute Tension (P0562 / Launch)',
    raw: 'P0562 System Voltage Low / 系统电压过低',
    scanner: 'Launch X431',
    brand: 'Chery Tiggo 7 Pro',
  },
  {
    label: 'Geely Coolray Bus CAN (U0100)',
    raw: 'U0100 Lost Communication With ECM/PCM A — 与发动机控制模块失去通讯',
    scanner: 'Autel MaxiSYS',
    brand: 'Geely Coolray 1.5TD',
  },
  {
    label: 'Chery/MG Mélange Pauvre Turbo (P0171)',
    raw: 'P0171 Fuel Trim System Lean Bank 1 (长期燃油修正过稀)',
    scanner: 'Launch X431',
    brand: 'MG GT 1.5T',
  },
  {
    label: 'BYD Batterie Aux / Interlock (P0A0D)',
    raw: 'P0A0D High Voltage System Interlock Circuit High (高压互锁回路故障)',
    scanner: 'Autel Ultra',
    brand: 'BYD Song Plus DM-i',
  },
];

function buildLocalOfflineFallback(
  rawInput: string,
  scannerSource: string
): DtcRawTranslateResult {
  const codeMatch = rawInput.toUpperCase().match(/\b([PBCU][0-9A-F]{4})\b/);
  const detectedCode = codeMatch ? codeMatch[1] : null;
  const lower = rawInput.toLowerCase();

  if (detectedCode === 'P0562' || lower.includes('voltage') || lower.includes('电压')) {
    return {
      rawInput,
      detectedCode: detectedCode || 'P0562',
      scannerSource,
      cleanFrenchTitle: 'Sous-tension alimentation calculateur / Chute batterie 12V',
      affectedSystem: 'Circuit de charge, Batterie 12V & Alimentation ECM/BCM',
      urgency: 'Élevée',
      knownCausesDz: [
        'Batterie 12V affaiblie (< 12.1V à froid) — Cause n°1 sur véhicules chinois modernes',
        'Cosses batterie sulfatées ou tresse de masse moteur-châssis desserrée',
        'Alternateur / Convertisseur DC-DC (sur BYD hybride/EV) sous 13.5V en charge',
      ],
      multimeterTests: [
        {
          point: 'Bornes (+) et (-) batterie 12V',
          expectedValue: '12.5V–12.8V (moteur coupé) · 13.8V–14.4V (tournant)',
          condition: 'Multimètre DC V',
        },
        {
          point: 'Chute de tension masse batterie → bloc moteur',
          expectedValue: '< 0.15 V',
          condition: 'Phares allumés + climatisation',
        },
      ],
      repairSteps: [
        'Charger ou remplacer la batterie 12V puis effacer tous les défauts fantômes U0xxx.',
        'Serrer la masse châssis sous boîte à air avant de remplacer un calculateur.',
      ],
      cachedOffline: true,
      translatedAt: new Date().toISOString(),
    };
  }

  return {
    rawInput,
    detectedCode,
    scannerSource,
    cleanFrenchTitle: detectedCode
      ? `Analyse hors-ligne code ${detectedCode} — Libellé brut valise traduit`
      : 'Analyse hors-ligne — Contrôle faisceau & alimentations calculateur',
    affectedSystem: detectedCode?.startsWith('U')
      ? 'Réseau Multiplexé CAN / Gateway'
      : 'Gestion Moteur / Capteurs',
    urgency: 'Modérée',
    knownCausesDz: [
      'Connecteur calculateur oxydé ou mal verrouillé suite à lavage moteur',
      'Faux contact sur alimentation +15 APC ou chute tension batterie 12V',
      'Résistance de terminaison CAN 60 Ω anormale (si code U0xxx)',
    ],
    multimeterTests: [
      {
        point: 'Alimentation calculateur (+30 / +15 APC)',
        expectedValue: '≥ 12.4 V sous charge',
        condition: 'Contact ON',
      },
      {
        point: 'Bus CAN High / CAN Low (Pin 6 & 14 OBD2)',
        expectedValue: '60 Ω (batterie débranchée) · 2.6V / 2.4V (contact ON)',
        condition: 'Ohmmètre puis Voltmètre DC',
      },
    ],
    repairSteps: [
      'Vérifier tension batterie (12.5V min) avant toute interprétation.',
      'Rebrancher internet / serveur AutoPro pour obtenir l’expertise IA détaillée complète.',
    ],
    cachedOffline: true,
    translatedAt: new Date().toISOString(),
  };
}

export const DtcRawTranslatorModule: React.FC = () => {
  const [rawText, setRawText] = useState<string>(QUICK_RAW_PRESETS[0].raw);
  const [scannerSource, setScannerSource] = useState<string>('Launch X431');
  const [vehicleBrand, setVehicleBrand] = useState<string>('Chery Tiggo 7 Pro');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const initialHistory = useMemo(() => loadDtcTranslationsCache(), []);
  const [history, setHistory] = useState<DtcRawTranslateResult[]>(initialHistory);
  const [result, setResult] = useState<DtcRawTranslateResult | null>(
    initialHistory[0] || null
  );

  const handleTranslate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = rawText.trim();
    if (!cleaned) return;

    // 1. Check offline local cache first for exact match if offline or instant recall
    const norm = cleaned.toUpperCase();
    const cachedHit = history.find((h) => h.rawInput.trim().toUpperCase() === norm);

    setIsLoading(true);
    try {
      const res = await apiFetch('/api/dtc/translate-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawInput: cleaned,
          scannerSource,
          brand: vehicleBrand,
        }),
      });
      const data = await res.json();
      const payloadResult = data?.translation || data?.result;
      if (res.ok && data?.success && payloadResult) {
        const item: DtcRawTranslateResult = {
          ...payloadResult,
          cachedOffline: false,
        };
        setResult(item);
        const updated = saveDtcTranslationToCache(item);
        setHistory(updated);
        return;
      }
      throw new Error(data?.error || 'Erreur API');
    } catch {
      if (cachedHit) {
        setResult({ ...cachedHit, cachedOffline: true });
      } else {
        const offline = buildLocalOfflineFallback(cleaned, scannerSource);
        setResult(offline);
        const updated = saveDtcTranslationToCache(offline);
        setHistory(updated);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Input Panel */}
      <form
        onSubmit={handleTranslate}
        className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Languages className="w-4 h-4 text-cyan-400" />
              Traducteur &amp; Dépanneur DTC Brut IA (Chinois / Anglais Valise → Français Atelier)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Collez un code défaut brut Launch / Autel pour obtenir la traduction technique exacte, les pannes connues DZ et les mesures multimètre
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] text-slate-300 flex items-center gap-1.5 self-start">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            {history.length} traductions en cache local
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Valise Source</label>
            <select
              value={scannerSource}
              onChange={(e) => setScannerSource(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
            >
              <option value="Launch X431">Launch X431 / ThinkDiag</option>
              <option value="Autel MaxiSYS">Autel MaxiSYS / MK808</option>
              <option value="Topdon / Diagzone">Topdon / Diagzone</option>
              <option value="Autre Valise OBD2">Autre Valise Chine</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Véhicule</label>
            <input
              type="text"
              value={vehicleBrand}
              onChange={(e) => setVehicleBrand(e.target.value)}
              placeholder="Ex: Chery Tiggo 7 Pro, Geely Coolray, MG GT..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Texte Brut ou Code Défaut (Chinois / Anglais mal traduit) *
          </label>
          <textarea
            rows={3}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Collez ici le libellé exact affiché par la valise (ex: P0562 System Voltage Low / 系统电压过低)..."
            className="w-full p-3 rounded-xl bg-slate-950 border border-cyan-500/40 text-sm text-white font-mono focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_RAW_PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setRawText(p.raw);
                  setScannerSource(p.scanner);
                  setVehicleBrand(p.brand);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-[11px] text-slate-300 cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading || !rawText.trim()}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            {isLoading ? 'Analyse technique en cours...' : 'Traduire & Diagnostiquer'}
          </button>
        </div>
      </form>

      {/* Output Panel */}
      {result && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {result.detectedCode && (
                  <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-mono font-bold text-xs">
                    {result.detectedCode}
                  </span>
                )}
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    result.urgency === 'Critique'
                      ? 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
                      : result.urgency === 'Élevée'
                      ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300'
                      : 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                  }`}
                >
                  Urgence : {result.urgency}
                </span>
                {result.cachedOffline && (
                  <span className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-600/40 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> Cache Local Hors-Ligne
                  </span>
                )}
              </div>
              <h4 className="text-base sm:text-lg font-extrabold text-white">
                {result.cleanFrenchTitle}
              </h4>
              <p className="text-xs text-slate-400">
                Système concerné : <strong className="text-slate-200">{result.affectedSystem}</strong> · Source : {result.scannerSource}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Known causes in Algeria */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Pannes Connues Terrain (Parc Algérie)
              </h5>
              <ul className="space-y-2 text-xs text-slate-200">
                {result.knownCausesDz.map((cause, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{cause}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Repair Steps */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Wrench className="w-4 h-4" />
                Procédure d’Intervention Rapide
              </h5>
              <ol className="space-y-2 text-xs text-slate-200">
                {result.repairSteps.map((step, i) => (
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

          {/* Multimeter Table */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Gauge className="w-4 h-4" />
              Valeurs de Test au Multimètre (Avant Remplacement Pièce)
            </h5>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3 border-b border-slate-800">Point de Mesure</th>
                    <th className="p-3 border-b border-slate-800">Valeur Attendue (V / Ω)</th>
                    <th className="p-3 border-b border-slate-800">Condition de Test</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {result.multimeterTests.map((t, i) => (
                    <tr key={i} className="bg-slate-950/40">
                      <td className="p-3 font-semibold text-white">{t.point}</td>
                      <td className="p-3 font-mono font-bold text-emerald-300">{t.expectedValue}</td>
                      <td className="p-3 text-slate-300">{t.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Offline Cache History */}
          {history.length > 1 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Historique Hors-Ligne (Dernières consultations atelier) :
              </div>
              <div className="flex flex-wrap gap-2">
                {history.slice(0, 6).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setResult(item)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-[11px] text-slate-300 cursor-pointer"
                  >
                    <span className="font-mono text-cyan-300 mr-1">
                      {item.detectedCode || 'DTC'}
                    </span>
                    {item.cleanFrenchTitle.slice(0, 40)}
                    {item.cleanFrenchTitle.length > 40 ? '…' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
