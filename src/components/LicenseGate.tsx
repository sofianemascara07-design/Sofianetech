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
  UserCog,
  Server,
} from 'lucide-react';
import { LicenseSession } from '../types/automotive';
import {
  apiFetch,
  getBackendBaseUrl,
  isStaticFirebaseWithoutBackend,
  setBackendBaseUrl,
} from '../utils/apiBridge';

interface LicenseGateProps {
  onLicenseActivated: (session: LicenseSession) => void;
  blockReason?: string | null;
}

export const LicenseGate: React.FC<LicenseGateProps> = ({
  onLicenseActivated,
  blockReason,
}) => {
  const [authMode, setAuthMode] = useState<'client' | 'admin'>('client');
  const [clientName, setClientName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [hwid, setHwid] = useState('');
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [demoLinksEnabled, setDemoLinksEnabled] = useState<boolean>(false);
  const [defaultDemoMinutes, setDefaultDemoMinutes] = useState<number>(10);

  // Render Backend Config helper (especially for Firebase Hosting autoprodz-a7071.web.app)
  const [renderUrlInput, setRenderUrlInput] = useState<string>(() => getBackendBaseUrl());
  const [showRenderConfig, setShowRenderConfig] = useState<boolean>(() => isStaticFirebaseWithoutBackend());
  const [renderStatusMsg, setRenderStatusMsg] = useState<string | null>(null);
  const [testingRender, setTestingRender] = useState<boolean>(false);

  const fetchLicenseStatus = () => {
    apiFetch('/api/license/status')
      .then(async res => {
        const text = await res.text();
        if (text.trim().startsWith('<')) return null;
        return JSON.parse(text);
      })
      .then(data => {
        if (!data) return;
        if (typeof data?.demoLinksEnabled === 'boolean') {
          setDemoLinksEnabled(data.demoLinksEnabled);
        }
        if (typeof data?.defaultDemoMinutes === 'number') {
          setDefaultDemoMinutes(data.defaultDemoMinutes);
        }
      })
      .catch(() => {
        setDemoLinksEnabled(false);
      });
  };

  // Auto-detect or generate persistent machine HWID
  useEffect(() => {
    let savedHwid = localStorage.getItem('autopro_machine_hwid');
    if (!savedHwid) {
      const randHex1 = Math.random().toString(16).substring(2, 6).toUpperCase();
      const randHex2 = Math.random().toString(16).substring(2, 6).toUpperCase();
      savedHwid = `HWID-DZ-9882-${randHex1}-${randHex2}-PC`;
      localStorage.setItem('autopro_machine_hwid', savedHwid);
    }
    setHwid(savedHwid);
    fetchLicenseStatus();
  }, []);

  const handleCopyHwid = () => {
    if (!hwid) return;
    navigator.clipboard.writeText(hwid);
    setCopiedHwid(true);
    setTimeout(() => setCopiedHwid(false), 2000);
  };

  const handleSaveAndTestRender = async () => {
    const clean = setBackendBaseUrl(renderUrlInput);
    setRenderUrlInput(clean);
    setTestingRender(true);
    setRenderStatusMsg(null);
    try {
      const res = await apiFetch('/api/health');
      const text = await res.text();
      if (text.trim().startsWith('<')) {
        setRenderStatusMsg('❌ Cette URL renvoie une page HTML au lieu de l\'API Node/Render.');
        return;
      }
      const data = JSON.parse(text);
      if (data?.status === 'ok') {
        setRenderStatusMsg(`✅ Connecté à Render (${data.version || 'OK'})`);
        setErrorMessage(null);
        fetchLicenseStatus();
      } else {
        setRenderStatusMsg('⚠️ Serveur joignable mais réponse inattendue.');
      }
    } catch {
      setRenderStatusMsg('❌ Impossible de joindre ce serveur Render (vérifiez l\'URL https://...onrender.com).');
    } finally {
      setTestingRender(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (authMode === 'admin') {
      if (!adminPasscode.trim()) {
        setErrorMessage('Veuillez saisir votre mot de passe Administrateur.');
        return;
      }
    } else if (!licenseKey.trim()) {
      setErrorMessage('Veuillez saisir votre clé d\'abonné ou Pass Démo Limité.');
      return;
    }

    setIsVerifying(true);

    try {
      const response = await apiFetch('/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          authMode === 'admin'
            ? {
                mode: 'admin',
                adminPasscode: adminPasscode.trim(),
                hwid,
              }
            : {
                mode: 'client',
                key: licenseKey.trim(),
                clientName: clientName.trim() || 'Client AutoPro DZ',
                hwid,
              }
        ),
      });

      const rawText = await response.text();
      if (rawText.trim().startsWith('<')) {
        setShowRenderConfig(true);
        setErrorMessage(
          'Firebase Hosting n\'est pas encore relié à votre backend Render (réponse HTML reçue). Renseignez votre URL Render ci-dessous ou redéployez avec VITE_API_URL.'
        );
        return;
      }

      const data = JSON.parse(rawText);

      if (response.ok && data.valid && data.license) {
        if (authMode === 'admin' && data.license.isAdmin) {
          sessionStorage.setItem('autopro_admin_passcode', adminPasscode.trim());
          setSuccessMessage('Accès Administrateur ouvert ! Chargement de la console...');
        } else {
          sessionStorage.removeItem('autopro_admin_passcode');
          setSuccessMessage(data.message || 'Licence authentifiée avec succès !');
        }
        localStorage.setItem('autopro_license_session', JSON.stringify(data.license));
        setTimeout(() => {
          onLicenseActivated(data.license);
        }, 700);
      } else {
        setErrorMessage(data.message || 'Accès refusé. Clé invalide, suspendue ou démonstration verrouillée.');
      }
    } catch {
      setErrorMessage(
        'Connexion au serveur Render/API impossible. Vérifiez votre connexion internet ou l\'URL Render.'
      );
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
        {/* Brand & Security Guard Banner */}
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
            Les liens de démonstration gratuits ouverts sans limite ont été désactivés. Seuls les abonnés validés ou détenteurs d'un Pass Démo Limité autorisé peuvent accéder à la plateforme.
          </p>
        </div>

        {/* Live Lock Status Banner */}
        <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <Clock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              {demoLinksEnabled
                ? `Pass Démo Limité actif (${defaultDemoMinutes} min max par clé)`
                : 'Démonstrations publiques verrouillées · Clé Abonné requise'}
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 shrink-0">
            v3.0 Lock
          </span>
        </div>

        {/* Admin Kill-Switch / Expiration Alert */}
        {blockReason && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs text-rose-200 flex items-start gap-2.5 shadow-lg">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-rose-300 uppercase text-[11px]">Accès Interrompu / Verrouillé</strong>
              <span>{blockReason}</span>
            </div>
          </div>
        )}

        {/* Activation Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl space-y-5">
          {/* Mode Switcher: Client / Pass Limité vs Admin Sofiane */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAuthMode('client');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                authMode === 'client'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Accès Client / Pass Limité</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('admin');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                authMode === 'admin'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCog className="w-3.5 h-3.5" />
              <span>Accès Admin (Sofiane)</span>
            </button>
          </div>

          {authMode === 'client' ? (
            <>
              {/* Machine HWID Auto-Detection Box */}
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
                  Verrouillage matériel activé : chaque clé ou Pass Démo Limité est lié à 1 seul appareil.
                </p>
              </div>

              <form onSubmit={handleActivate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nom de l'Atelier / Client :
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
                    Clé d'Abonné ou Pass Démo Limité :
                  </label>
                  <input
                    type="text"
                    placeholder="Saisissez la clé fournie par Sofiane"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-cyan-400 font-mono font-bold tracking-wider placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors uppercase"
                  />
                </div>

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
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Vérification Serveur en cours...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Valider ma Clé Abonné / Pass Démo</span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 leading-relaxed">
                <strong>Espace Administrateur Principal :</strong> Accès complet ouvert à tous les modules, gestion de la liste des abonnés, création de Pass Démo limités et désactivation instantanée des clients manipulateurs.
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                  Code Secret Administrateur :
                </label>
                <input
                  type="password"
                  placeholder="Entrez votre code secret Admin"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  autoComplete="current-password"
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono tracking-wider placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

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
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authentification Admin...</span>
                  </>
                ) : (
                  <>
                    <UserCog className="w-4 h-4" />
                    <span>Ouvrir la Console Admin &amp; Abonnés</span>
                  </>
                )}
              </button>

              {/* Render Backend Link Helper for Firebase Hosting */}
              <div className="pt-2 border-t border-slate-800/70">
                <button
                  type="button"
                  onClick={() => setShowRenderConfig(prev => !prev)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-semibold cursor-pointer"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>
                    {showRenderConfig ? 'Masquer la liaison Render' : 'Configurer l\'URL Backend Render (Firebase Hosting)'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Render Backend URL Configuration Box (visible when needed or toggled in Admin) */}
          {showRenderConfig && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" />
                  <span>Liaison Serveur Backend Render</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Firebase → Render</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Si vous utilisez <strong>autoprodz-a7071.web.app</strong> sans <code className="text-cyan-300">VITE_API_URL</code>, collez ici l'URL de votre service Render :
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://votre-backend.onrender.com"
                  value={renderUrlInput}
                  onChange={(e) => setRenderUrlInput(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleSaveAndTestRender}
                  disabled={testingRender}
                  className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {testingRender ? 'Test...' : 'Lier'}
                </button>
              </div>
              {renderStatusMsg && (
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-200">
                  {renderStatusMsg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contact & Support Box for Acquiring a License */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>Demander un Abonnement ou un Pass Démo Limité</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Contactez directement Sofiane Mascara pour recevoir votre Pass Démo chronométré ou votre clé Abonné permanente liée à votre HWID.
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
      </div>
    </div>
  );
};
