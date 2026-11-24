import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  Key,
  Copy,
  Check,
  Laptop,
  AlertCircle,
  RefreshCw,
  Send,
  HelpCircle,
  Phone,
  Clock,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { LicenseSession } from '../types/automotive';
import { apiFetch } from '../utils/apiBridge';
import { setAuthToken } from '../utils/authSession';

interface LicenseGateProps {
  onLicenseActivated: (session: LicenseSession) => void;
  blockReason?: string | null;
}

export const LicenseGate: React.FC<LicenseGateProps> = ({
  onLicenseActivated,
  blockReason,
}) => {
  const [authTab, setAuthTab] = useState<'subscriber' | 'admin'>('subscriber');
  const [clientName, setClientName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminPasscodeConfirm, setAdminPasscodeConfirm] = useState('');
  const [adminSetupRequired, setAdminSetupRequired] = useState<boolean>(false);
  const [hwid, setHwid] = useState('');
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [demoLinksEnabled, setDemoLinksEnabled] = useState<boolean>(false);
  const [defaultDemoMinutes, setDefaultDemoMinutes] = useState<number>(10);
  const [serverStatus, setServerStatus] = useState<'waking' | 'online' | 'offline'>('waking');
  const [showAdminPass, setShowAdminPass] = useState(false);

  const runServerStatusCheck = React.useCallback(async (attempt = 1, cancelledRef?: { current: boolean }) => {
    try {
      const res = await apiFetch('/api/license/status');
      const text = await res.text();
      if (text.trim().startsWith('<')) throw new Error('HTML response');
      const data = JSON.parse(text);
      if (cancelledRef?.current) return;
      setServerStatus('online');
      if (typeof data?.demoLinksEnabled === 'boolean') {
        setDemoLinksEnabled(data.demoLinksEnabled);
      }
      if (typeof data?.defaultDemoMinutes === 'number') {
        setDefaultDemoMinutes(data.defaultDemoMinutes);
      }
      if (typeof data?.adminSetupRequired === 'boolean') {
        setAdminSetupRequired(data.adminSetupRequired);
      }
    } catch {
      if (cancelledRef?.current) return;
      if (attempt < 5) {
        setServerStatus('waking');
        setTimeout(() => void runServerStatusCheck(attempt + 1, cancelledRef), 4500);
      } else {
        setServerStatus('offline');
        setDemoLinksEnabled(false);
      }
    }
  }, []);

  useEffect(() => {
    let savedHwid = localStorage.getItem('autopro_machine_hwid');
    if (!savedHwid) {
      const randHex1 = Math.random().toString(16).substring(2, 6).toUpperCase();
      const randHex2 = Math.random().toString(16).substring(2, 6).toUpperCase();
      savedHwid = `HWID-DZ-9882-${randHex1}-${randHex2}-PC`;
      localStorage.setItem('autopro_machine_hwid', savedHwid);
    }
    setHwid(savedHwid);

    const cancelledRef = { current: false };
    void runServerStatusCheck(1, cancelledRef);
    const offlinePoll = setInterval(() => {
      if (!cancelledRef.current) {
        setServerStatus((curr) => {
          if (curr === 'offline') {
            void runServerStatusCheck(5, cancelledRef);
          }
          return curr;
        });
      }
    }, 10_000);
    return () => {
      cancelledRef.current = true;
      clearInterval(offlinePoll);
    };
  }, [runServerStatusCheck]);

  const handleCopyHwid = () => {
    if (!hwid) return;
    navigator.clipboard.writeText(hwid);
    setCopiedHwid(true);
    setTimeout(() => setCopiedHwid(false), 2000);
  };

  const handleSwitchTab = (tab: 'subscriber' | 'admin') => {
    setAuthTab(tab);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (authTab === 'admin') {
      const pass = adminPasscode.trim();
      if (adminSetupRequired) {
        if (pass.length < 6) {
          setErrorMessage('Le mot de passe Administrateur doit contenir au moins 6 caractères.');
          return;
        }
        if (pass !== adminPasscodeConfirm.trim()) {
          setErrorMessage('Les deux mots de passe ne correspondent pas.');
          return;
        }
        setIsVerifying(true);
        try {
          const response = await apiFetch('/api/admin/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode: pass, hwid }),
          });
          const rawText = await response.text();
          if (rawText.trim().startsWith('<')) {
            setErrorMessage('Serveur d\'authentification indisponible. Réessayez dans quelques secondes.');
            return;
          }
          const data = JSON.parse(rawText);
          setServerStatus('online');
          if (response.ok && data.valid && data.license) {
            if (typeof data.token === 'string' && data.token) {
              setAuthToken(data.token);
            }
            setAdminSetupRequired(false);
            setAdminPasscode('');
            setAdminPasscodeConfirm('');
            setSuccessMessage(data.message || 'Mot de passe Administrateur configuré. Ouverture...');
            setTimeout(() => onLicenseActivated(data.license), 450);
          } else {
            setErrorMessage(data.message || 'Impossible de configurer l\'accès Administrateur.');
          }
        } catch {
          setErrorMessage('Connexion au serveur impossible. Vérifiez votre connexion internet.');
        } finally {
          setIsVerifying(false);
        }
        return;
      }

      if (!pass) {
        setErrorMessage('Veuillez saisir le mot de passe Administrateur.');
        return;
      }

      setIsVerifying(true);
      try {
        const response = await apiFetch('/api/license/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'admin',
            adminPasscode: pass,
            key: pass,
            hwid,
          }),
        });
        const rawText = await response.text();
        if (rawText.trim().startsWith('<')) {
          setErrorMessage('Serveur d\'authentification indisponible.');
          return;
        }
        const data = JSON.parse(rawText);
        setServerStatus('online');
        if (data?.adminSetupRequired) {
          setAdminSetupRequired(true);
          setErrorMessage(data.message || 'Configuration initiale requise : définissez votre mot de passe Administrateur.');
          return;
        }
        if (response.ok && data.valid && data.license) {
          if (typeof data.token === 'string' && data.token) {
            setAuthToken(data.token);
          }
          setAdminPasscode('');
          setSuccessMessage(data.message || 'Accès Administrateur ouvert ! Chargement de la console...');
          setTimeout(() => onLicenseActivated(data.license), 450);
        } else {
          setErrorMessage(data.message || 'Mot de passe Administrateur incorrect.');
        }
      } catch (err) {
        const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
        setErrorMessage(
          `Connexion au serveur d'authentification impossible${detail}. Vérifiez votre connexion ou réveillez le serveur.`
        );
      } finally {
        setIsVerifying(false);
      }
      return;
    }

    const enteredKey = licenseKey.trim();
    if (!enteredKey) {
      setErrorMessage('Veuillez saisir votre clé d\'abonné ou Pass Démo Limité.');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await apiFetch('/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: enteredKey,
          clientName: clientName.trim() || 'Client AutoPro DZ',
          hwid,
        }),
      });

      const rawText = await response.text();
      if (rawText.trim().startsWith('<')) {
        setErrorMessage('Connexion au serveur de licences requise. Réessayez dans quelques secondes.');
        return;
      }

      const data = JSON.parse(rawText);
      setServerStatus('online');
      if (response.ok && data.valid && data.license) {
        if (typeof data.token === 'string' && data.token) {
          setAuthToken(data.token);
        }
        setLicenseKey('');
        setSuccessMessage(data.message || 'Licence authentifiée avec succès !');
        setTimeout(() => {
          onLicenseActivated(data.license);
        }, 500);
      } else {
        setErrorMessage(data.message || 'Clé invalide, suspendue ou démonstration verrouillée.');
      }
    } catch {
      setErrorMessage('Connexion au serveur de licences impossible. Vérifiez votre connexion internet.');
    } finally {
      setIsVerifying(false);
    }
  };

  const whatsappNumber = '213557767804';
  const whatsappDisplay = '05 57 76 78 04';
  const whatsappMessage = encodeURIComponent(
    `Salam alikoum Sofiane,\nJe souhaite obtenir ma clé Abonné ou un Pass Démo Limité AutoPro Diagnostic & Flash.\nMon nom / garage : ${clientName || 'Atelier Auto'}\nMon identifiant machine (HWID) : ${hwid}`
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-4 sm:p-6 selection:bg-cyan-500 selection:text-slate-950">
      <div className="max-w-xl w-full space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20 mb-1">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex flex-wrap items-center justify-center gap-2">
            <span>AutoPro Suite Automobile</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
              Accès Verrouillé · Liste Blanche
            </span>
          </h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Seuls les abonnés validés ou détenteurs d&apos;un Pass Démo autorisé peuvent accéder à la plateforme.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <Clock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              {demoLinksEnabled
                ? `Pass Démo Limité actif (${defaultDemoMinutes} min max par clé)`
                : 'Démonstrations publiques verrouillées · Clé Abonné requise'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                serverStatus === 'online'
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                  : serverStatus === 'waking'
                  ? 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                  : 'bg-rose-950/70 text-rose-300 border-rose-700/60'
              }`}
            >
              {serverStatus === 'online'
                ? 'Serveur En Ligne'
                : serverStatus === 'waking'
                ? 'Réveil serveur...'
                : 'Hors Ligne'}
            </span>
            {serverStatus === 'offline' && (
              <button
                type="button"
                onClick={() => {
                  setServerStatus('waking');
                  void runServerStatusCheck(1);
                }}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Réveiller</span>
              </button>
            )}
          </div>
        </div>

        {blockReason && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs text-rose-200 flex items-start gap-2.5 shadow-lg">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-rose-300 uppercase text-[11px]">Accès Interrompu / Verrouillé</strong>
              <span>{blockReason}</span>
            </div>
          </div>
        )}

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 flex-wrap">
            <div className="flex items-center gap-2">
              {authTab === 'admin' ? (
                <KeyRound className="w-4 h-4 text-amber-400" />
              ) : (
                <Key className="w-4 h-4 text-cyan-400" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {authTab === 'admin'
                  ? adminSetupRequired
                    ? 'Configuration Initiale Administrateur'
                    : 'Accès Administrateur'
                  : 'Activation Clé Abonné ou Pass Démo'}
              </span>
            </div>

            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => handleSwitchTab('subscriber')}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  authTab === 'subscriber'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Abonné
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('admin')}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  authTab === 'admin'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Administration
              </button>
            </div>
          </div>

          {authTab === 'subscriber' && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-slate-500" />
                  Identifiant Unique Machine (HWID) :
                </span>
                <button
                  type="button"
                  onClick={handleCopyHwid}
                  className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copiedHwid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedHwid ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
              <div className="font-mono text-xs font-bold text-slate-300 select-all tracking-wider">
                {hwid || 'Génération de l\'empreinte machine...'}
              </div>
              <p className="text-[10px] text-slate-500">
                Verrouillage matériel activé : chaque clé est liée à 1 seul appareil.
              </p>
            </div>
          )}

          <form onSubmit={handleActivate} className="space-y-4">
            {authTab === 'subscriber' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nom de l&apos;Atelier / Client :
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Garage Auto Tech"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Clé d&apos;Activation :
                  </label>
                  <input
                    type="password"
                    placeholder="Saisissez votre clé d'accès"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-cyan-400 font-mono font-bold tracking-wider placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors uppercase"
                  />
                </div>
              </>
            ) : (
              <>
                {adminSetupRequired && (
                  <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl text-[11px] text-amber-200 leading-relaxed">
                    Après la mise à jour de sécurité, les anciens mots de passe intégrés au code ont été désactivés. Saisissez et confirmez votre propre mot de passe Administrateur ci-dessous (min. 6 caractères) pour enregistrer votre accès sécurisé.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {adminSetupRequired
                      ? 'Nouveau Mot de Passe Administrateur (min. 6 car.) :'
                      : 'Mot de Passe Administrateur :'}
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPass ? 'text' : 'password'}
                      placeholder="Saisissez votre mot de passe secret"
                      value={adminPasscode}
                      onChange={(e) => setAdminPasscode(e.target.value)}
                      autoComplete="current-password"
                      spellCheck={false}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-amber-300 font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPass((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300 cursor-pointer"
                      aria-label="Afficher ou masquer le mot de passe"
                    >
                      {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {adminSetupRequired && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Confirmer le Mot de Passe Administrateur :
                    </label>
                    <input
                      type={showAdminPass ? 'text' : 'password'}
                      placeholder="Retapez le même mot de passe"
                      value={adminPasscodeConfirm}
                      onChange={(e) => setAdminPasscodeConfirm(e.target.value)}
                      autoComplete="new-password"
                      spellCheck={false}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-amber-300 font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                )}
              </>
            )}

            {errorMessage && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className={`w-full py-3 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                authTab === 'admin'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/10'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/10'
              }`}
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Vérification en cours...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {authTab === 'admin'
                      ? adminSetupRequired
                        ? 'Enregistrer et Ouvrir Admin'
                        : 'Connexion Administrateur'
                      : 'Valider et Déverrouiller'}
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {authTab === 'subscriber' && (
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>Demander un Abonnement ou un Pass Démo Limité</span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Contactez directement Sofiane Mascara pour recevoir votre Pass Démo chronométré ou votre clé Abonné liée à votre HWID.
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-emerald-800/40 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Contact WhatsApp &amp; Appel :</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {whatsappDisplay} <span className="text-[11px] text-slate-400">(+213 557 76 78 04)</span>
                  </span>
                </div>
              </div>

              <a
                href="tel:+213557767804"
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                Appeler
              </a>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
              <a
                href={`https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Send className="w-4 h-4" />
                <span>Envoyer mon HWID sur WhatsApp (05 57 76 78 04)</span>
              </a>

              <a
                href="mailto:sofianemascara07@gmail.com?subject=Demande%20de%20Clé%20Licence%20AutoPro%20DZ"
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <span>Email</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
