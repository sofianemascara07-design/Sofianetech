import React, { useState, useMemo } from 'react';
import {
  Truck,
  Sparkles,
  Activity,
  Trash2,
  Play,
  AlertCircle,
  CheckCircle2,
  Languages,
} from 'lucide-react';
import {
  decodeJ1939CanFrame,
  J1939_SAMPLE_FRAMES,
  UniversalControlUnitProfile,
} from '../../data/universalMasterDatabase';
import { apiFetch } from '../../utils/apiBridge';

interface CopilotJ1939DiagnosticProps {
  selectedProfile: UniversalControlUnitProfile;
}

const SAMPLE_ACTUATORS = [
  { id: 'egr_valve', label: 'Vanne EGR (0x31 01)', result: 'Cycle ouverture 0% → 95% validé (réponse 18 ms).' },
  { id: 'rail_prv', label: 'Régulateur Pression Rail', result: 'Consigne 350 bar / Réelle 348 bar — stable.' },
  { id: 'turbo_vgt', label: 'Actuateur Turbo VGT / Wastegate', result: 'Butée haute/basse calibrée OK (0% – 100%).' },
  { id: 'scr_pump', label: 'Pompe Dosage AdBlue / SCR', result: 'Montée en pression 5.0 bar OK — sans fuite.' },
];

export const CopilotJ1939Diagnostic: React.FC<CopilotJ1939DiagnosticProps> = ({
  selectedProfile,
}) => {
  const [canIdHex, setCanIdHex] = useState<string>(J1939_SAMPLE_FRAMES[0].canIdHex);
  const [dataHex, setDataHex] = useState<string>(J1939_SAMPLE_FRAMES[0].dataHex);
  const [dtcInput, setDtcInput] = useState<string>('P20EE, P0087, U0101');
  const [question, setQuestion] = useState<string>('Explique la cause probable et la procédure de test atelier.');
  const [actuatorFeedback, setActuatorFeedback] = useState<string | null>(null);
  const [dtcClearedMsg, setDtcClearedMsg] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<{
    frenchDiagnosis: string;
    darijaDiagnosis: string;
    steps: string[];
  } | null>(null);

  const decodedFrame = useMemo(
    () => decodeJ1939CanFrame(canIdHex, dataHex),
    [canIdHex, dataHex]
  );

  const handleAskCopilot = async () => {
    setAiLoading(true);
    try {
      const parsedCodes = dtcInput
        .toUpperCase()
        .split(/[\s,;]+/)
        .filter(Boolean);
      const res = await apiFetch('/api/copilot/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleLabel: `${selectedProfile.brand} ${selectedProfile.models.split(',')[0]}`,
          ecuModel: selectedProfile.ecuModel,
          protocol: selectedProfile.protocol,
          codes: parsedCodes,
          j1939Summary: `${decodedFrame.pgnName} | SPN ${decodedFrame.spn} / FMI ${decodedFrame.fmi} (${decodedFrame.liveValueSummary})`,
          question,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiResponse({
          frenchDiagnosis: data.frenchDiagnosis,
          darijaDiagnosis: data.darijaDiagnosis,
          steps: data.steps || [],
        });
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Décodeur Temps Réel SAE J1939 (PGN / SPN / FMI) */}
      <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-400" />
              Diagnostic Multimarque &amp; Décodeur Temps Réel SAE J1939 (PGN / SPN / FMI)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Analyse des trames 29-bit CAN 250 kbps (EDC17CV41, Cummins CM2350, Volvo TRW EMS2) et codes OBD2 / UDS.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {J1939_SAMPLE_FRAMES.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setCanIdHex(sample.canIdHex);
                  setDataHex(sample.dataHex);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#0B1120] hover:border-amber-400 border border-slate-700 text-[11px] font-semibold text-amber-200 cursor-pointer"
              >
                {sample.label.split('—')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <label className="space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold">CAN ID 29-bit (Hex)</span>
            <input
              type="text"
              value={canIdHex}
              onChange={(e) => setCanIdHex(e.target.value.toUpperCase())}
              maxLength={8}
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 font-mono text-cyan-300"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold">Payload 8 Octets (Hex)</span>
            <input
              type="text"
              value={dataHex}
              onChange={(e) => setDataHex(e.target.value.toUpperCase())}
              maxLength={16}
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 font-mono text-emerald-300"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#0B1120] border border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 text-[10px] uppercase block">PGN / Source</span>
            <span className="font-mono font-bold text-cyan-300">{decodedFrame.pgnDec} ({decodedFrame.pgnHex})</span>
            <span className="block text-[11px] text-slate-400">{decodedFrame.sourceAddress}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] uppercase block">SPN Suspect Parameter</span>
            <span className="font-mono font-bold text-white">SPN {decodedFrame.spn}</span>
            <span className="block text-[11px] text-slate-300">{decodedFrame.spnLabel}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] uppercase block">FMI Failure Mode</span>
            <span className="font-mono font-bold text-amber-300">FMI {decodedFrame.fmi}</span>
            <span className="block text-[11px] text-slate-300">{decodedFrame.fmiMeaning}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] uppercase block">Interprétation</span>
            <span
              className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                decodedFrame.severity === 'CRITIQUE'
                  ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                  : decodedFrame.severity === 'ALERTE'
                  ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {decodedFrame.severity}
            </span>
            <span className="block text-[11px] text-emerald-300 mt-1">{decodedFrame.liveValueSummary}</span>
          </div>
        </div>
      </div>

      {/* Live Data + Tests Actionneurs + Copilote IA FR & Darija */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Tests d'Actionneurs & Effacement DTC */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              Tests d&apos;Actionneurs UDS (0x31 / 0x2F)
            </span>
            <button
              type="button"
              onClick={() => setDtcClearedMsg('Service UDS 0x14 FF FF FF exécuté : mémoires DTC effacées.')}
              className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Effacer DTC (0x14)</span>
            </button>
          </div>

          <div className="space-y-2">
            {SAMPLE_ACTUATORS.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => setActuatorFeedback(`${act.label} : ${act.result}`)}
                className="w-full p-2.5 rounded-xl bg-[#0B1120] hover:border-cyan-400 border border-slate-800 text-left flex items-center justify-between text-xs cursor-pointer"
              >
                <span className="font-semibold text-white">{act.label}</span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-bold flex items-center gap-1 text-[10px]">
                  <Play className="w-3 h-3" /> Tester
                </span>
              </button>
            ))}
          </div>

          {actuatorFeedback && (
            <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-[11px] text-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{actuatorFeedback}</span>
            </div>
          )}
          {dtcClearedMsg && (
            <div className="p-2.5 rounded-lg bg-cyan-950/50 border border-cyan-500/40 text-[11px] text-cyan-200">
              {dtcClearedMsg}
            </div>
          )}
        </div>

        {/* AutoPro Copilot IA (Français + Darija Technique) */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-[#111827] border border-cyan-500/35 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              AutoPro Copilot IA — Diagnostic Français &amp; Darija Technique
            </span>
            <Languages className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <input
              type="text"
              value={dtcInput}
              onChange={(e) => setDtcInput(e.target.value)}
              placeholder="Codes DTC (ex: P20EE, P0087)"
              className="px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 font-mono text-amber-300"
            />
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Symptôme ou question technicien"
              className="px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-white"
            />
          </div>

          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void handleAskCopilot()}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
            <span>{aiLoading ? 'Analyse IA en cours...' : 'Analyser DTC & Trame J1939 (FR + Darija)'}</span>
          </button>

          {aiResponse ? (
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#0B1120] border border-slate-800 space-y-1">
                <div className="font-bold text-cyan-300">Diagnostic Technique (Français)</div>
                <p className="text-slate-200 whitespace-pre-line leading-relaxed">{aiResponse.frenchDiagnosis}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-1">
                <div className="font-bold text-emerald-300">Explication Atelier (Darija Technique)</div>
                <p className="text-emerald-100 whitespace-pre-line leading-relaxed">{aiResponse.darijaDiagnosis}</p>
              </div>
              {aiResponse.steps.length > 0 && (
                <div className="p-3 rounded-xl bg-[#0B1120] border border-slate-800">
                  <div className="font-bold text-amber-300 mb-1">Plan d&apos;action pas à pas :</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                    {aiResponse.steps.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Cliquez sur « Analyser DTC &amp; Trame J1939 » pour générer le guide Français + Darija adapté au calculateur actif.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
