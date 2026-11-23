import React, { useState } from 'react';
import { X, ShieldCheck, LogOut } from 'lucide-react';
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
  const [showConfirmDeactivate, setShowConfirmDeactivate] = useState(false);

  if (!isOpen) return null;

  const handleConfirmDeactivate = () => {
    onDeactivate();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Session Active</h2>
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

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Titulaire / Atelier :
            </span>
            <span className="text-sm font-bold text-white block">
              {license.clientName}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">Référence Masquée :</span>
              <span className="font-mono text-cyan-400 font-semibold truncate block">
                {license.maskedKey || '****'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">Validité :</span>
              <span className="text-emerald-400 font-semibold block">
                {license.expiresAt}
              </span>
            </div>
          </div>

          {license.tier === 'demo' ? (
            <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-500/50 space-y-1">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-[11px]">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Pass Démo Limité (1 Seul Appareil)</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Cet accès temporaire expirera automatiquement à la fin du compte à rebours. Contactez le support pour passer en licence Abonné.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-600/50 space-y-1">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {license.isAdmin
                    ? 'Session Administrateur Authentifiée'
                    : 'Abonnement Validé'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {license.isAdmin
                  ? 'Accès administrateur actif pour la gestion des abonnés, des coffres et de la sécurité.'
                  : 'Votre licence abonné est active et protégée pour cette session.'}
              </p>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          {!showConfirmDeactivate ? (
            <button
              onClick={() => setShowConfirmDeactivate(true)}
              className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion / Verrouiller</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-300 font-semibold">Confirmer ?</span>
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
