import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Key,
  Copy,
  Check,
  Laptop,
  Calendar,
  LogOut,
  FileText,
  Cpu,
  Layers
} from 'lucide-react';
import { LicenseSession } from '../types/automotive';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  license: LicenseSession;
  onDeactivate: () => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  license,
  onDeactivate,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [showConfirmDeactivate, setShowConfirmDeactivate] = useState(false);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(license.key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleConfirmDeactivate = () => {
    onDeactivate();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Certificat de Licence Active</h2>
              <span className="text-[11px] text-emerald-400 font-semibold block">
                {license.tierLabel}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* License Details Cards */}
        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Titulaire de la Licence / Atelier :
            </span>
            <span className="text-sm font-bold text-white block">
              {license.clientName}
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Clé d'Activation Cryptographique :
              </span>
              <button
                onClick={handleCopyKey}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? 'Copié' : 'Copier'}</span>
              </button>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-400 block select-all bg-slate-900 p-1.5 rounded border border-slate-800">
              {license.key}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">Identifiant Machine (HWID) :</span>
              <span className="font-mono text-slate-300 font-semibold truncate block">
                {license.hwid}
              </span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">Validité &amp; Mises à jour :</span>
              <span className="text-emerald-400 font-semibold block">
                {license.expiresAt}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Modules et Protocoles Débloqués sur cette Machine :</span>
            </span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {license.allowedModules.map((mod) => (
                <span
                  key={mod}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-300 border border-slate-800"
                >
                  ✓ {mod.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Deactivation / Sign out Zone */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          {!showConfirmDeactivate ? (
            <button
              onClick={() => setShowConfirmDeactivate(true)}
              className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Désactiver / Changer de Clé sur ce Micro</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-300 font-semibold">Confirmer le verrouillage ?</span>
              <button
                onClick={handleConfirmDeactivate}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded cursor-pointer"
              >
                Oui, Déconnecter
              </button>
              <button
                onClick={() => setShowConfirmDeactivate(false)}
                className="px-2 py-1 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Annuler
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
