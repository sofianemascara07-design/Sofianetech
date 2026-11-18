import React from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

export interface AiVerificationInfo {
  verified: boolean;
  provider: 'gemini-4-hydrogen' | 'groq-deterministic' | 'offline-verified-rules';
  guardrailsApplied: string[];
  blockedHallucinations: string[];
  confidenceLevel: 'STRICT_VERIFIED' | 'WARNING_FILTERED';
  checkedAt?: string;
}

interface AiVerificationBadgeProps {
  verification?: AiVerificationInfo | null;
}

export const AiVerificationBadge: React.FC<AiVerificationBadgeProps> = ({ verification }) => {
  if (!verification) return null;

  const isFiltered = verification.blockedHallucinations && verification.blockedHallucinations.length > 0;
  const providerLabel =
    verification.provider === 'gemini-4-hydrogen'
      ? 'Gemini 4 Déterministe'
      : verification.provider === 'groq-deterministic'
      ? 'Groq Déterministe (Temp 0)'
      : 'Règles Atelier Certifiées (Hors-Ligne)';

  return (
    <div
      className={`mt-3 p-3 rounded-xl border text-[11px] space-y-1.5 ${
        isFiltered
          ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
          : 'bg-emerald-950/30 border-emerald-600/40 text-emerald-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold flex items-center gap-1.5">
          {isFiltered ? (
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span>
            {isFiltered
              ? `Pare-feu Anti-Hallucination : ${verification.blockedHallucinations.length} élément(s) non certifié(s) bloqué(s)`
              : 'Contrôle Anti-Hallucination Codes & Mises à jour : Validé'}
          </span>
        </span>
        <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 font-mono text-[10px] text-slate-300">
          {providerLabel}
        </span>
      </div>

      {isFiltered ? (
        <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-amber-300">
          {verification.blockedHallucinations.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {verification.guardrailsApplied.map((rule, idx) => (
            <span
              key={idx}
              className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/40 text-[10px] text-emerald-300"
            >
              ✓ {rule}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
