import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lock,
  Unlock,
  Upload,
  Download,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  PauseCircle,
  PlayCircle,
  FileArchive,
  Smartphone,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Send,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';
import {
  LicenseSession,
  SubscriberVaultPackage,
  VaultFileCategory,
  VaultPaidTier,
} from '../types/automotive';
import { apiFetch, apiUrl } from '../utils/apiBridge';
import { getAuthToken } from '../utils/authSession';
import { VaultSecurityLookup } from './VaultSecurityLookup';

interface VaultDownloadsPanelProps {
  licenseSession: LicenseSession;
  onOpenLicenseModal?: () => void;
}

const PAID_TIER_OPTIONS: { id: VaultPaidTier; label: string; short: string }[] = [
  { id: 'master', label: 'Pack Master DZ', short: 'Master' },
  { id: 'tablette_chinois', label: 'Tablette Chinois', short: 'Tablette CN' },
  { id: 'reprog', label: 'Reprog Pro', short: 'Reprog' },
  { id: 'standard', label: 'Diagnostic Std', short: 'Diag Std' },
];

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Ko';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export const VaultDownloadsPanel: React.FC<VaultDownloadsPanelProps> = ({
  licenseSession,
  onOpenLicenseModal,
}) => {
  const isAdmin = Boolean(licenseSession.isAdmin);
  const isDemo = licenseSession.tier === 'demo';

  const [items, setItems] = useState<SubscriberVaultPackage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'Tous' | VaultFileCategory>('Tous');

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  // Admin Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadVersion, setUploadVersion] = useState<string>('v1.0');
  const [uploadCategory, setUploadCategory] = useState<VaultFileCategory>('APK Android');
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [allowedTiers, setAllowedTiers] = useState<VaultPaidTier[]>([
    'master',
    'tablette_chinois',
    'reprog',
    'standard',
  ]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgressPct, setUploadProgressPct] = useState<number>(0);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const endpoint = isAdmin ? '/api/admin/vault/items' : '/api/vault/items';
      const res = await apiFetch(endpoint);
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Impossible de charger le Coffre Téléchargements.');
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur réseau lors du chargement du Coffre.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setErrorMsg(null);
    setStatusMsg(null);

    const lower = file.name.toLowerCase();
    const baseTitle = file.name.replace(/\.(apk|bin|zip|eep|hex)$/i, '');
    setUploadTitle(baseTitle);
    if (lower.endsWith('.apk')) {
      setUploadCategory('APK Android');
    } else if (lower.endsWith('.bin') || lower.endsWith('.eep') || lower.endsWith('.hex')) {
      setUploadCategory('Firmware / .BIN');
    } else {
      setUploadCategory('Pack Atelier');
    }
  };

  const handleSelectVerifiedFileForUpload = (
    file: File,
    sha256: string,
    releaseTag?: string
  ) => {
    setSelectedFile(file);
    const lower = file.name.toLowerCase();
    const baseTitle = file.name.replace(/\.(apk|bin|zip|eep|hex)$/i, '');
    setUploadTitle(baseTitle);
    if (lower.endsWith('.apk')) {
      setUploadCategory('APK Android');
    } else if (lower.endsWith('.bin') || lower.endsWith('.eep') || lower.endsWith('.hex')) {
      setUploadCategory('Firmware / .BIN');
    } else {
      setUploadCategory('Pack Atelier');
    }
    if (releaseTag) {
      setUploadVersion(releaseTag);
    }
    setUploadNotes(`Vérifié SHA-256 : ${sha256.slice(0, 16)}...`);
    setStatusMsg(
      `Fichier "${file.name}" chargé dans le formulaire d’import ci-dessus avec son empreinte SHA-256 vérifiée.`
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleAllowedTier = (tier: VaultPaidTier) => {
    setAllowedTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    );
  };

  const handleAdminUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!isAdmin || !token) {
      setErrorMsg('Session Administrateur requise pour importer un fichier.');
      return;
    }
    if (!selectedFile) {
      setErrorMsg('Choisissez d’abord un fichier (.apk, .bin, .zip, .eep ou .hex).');
      return;
    }
    if (allowedTiers.length === 0) {
      setErrorMsg('Sélectionnez au moins une formule payante autorisée à télécharger ce fichier.');
      return;
    }

    setUploading(true);
    setUploadProgressPct(0);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const targetUrl = apiUrl('/api/admin/vault/upload');
      const resultItem = await new Promise<SubscriberVaultPackage>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', targetUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('X-Vault-File-Name', encodeURIComponent(selectedFile.name));
        xhr.setRequestHeader('X-Vault-Title', encodeURIComponent(uploadTitle.trim() || selectedFile.name));
        xhr.setRequestHeader('X-Vault-Version', encodeURIComponent(uploadVersion.trim() || 'v1.0'));
        xhr.setRequestHeader('X-Vault-Category', encodeURIComponent(uploadCategory));
        xhr.setRequestHeader('X-Vault-Tiers', encodeURIComponent(allowedTiers.join(',')));
        xhr.setRequestHeader('X-Vault-Notes', encodeURIComponent(uploadNotes.trim()));

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && evt.total > 0) {
            setUploadProgressPct(Math.round((evt.loaded / evt.total) * 100));
          }
        };

        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText || '{}');
            if (xhr.status >= 200 && xhr.status < 300 && parsed.success && parsed.item) {
              resolve(parsed.item);
            } else {
              reject(new Error(parsed.error || `Échec upload (HTTP ${xhr.status})`));
            }
          } catch {
            reject(new Error(`Réponse serveur invalide (HTTP ${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('Erreur réseau pendant l’envoi du fichier.'));
        xhr.send(selectedFile);
      });

      setItems((prev) => [resultItem, ...prev]);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadNotes('');
      setUploadProgressPct(100);
      setStatusMsg(
        `"${resultItem.fileName}" ajouté au Coffre Payant (SHA-256 vérifié). Les comptes Démo restent strictement bloqués.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible d’importer le fichier.');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleItemActive = async (item: SubscriberVaultPackage) => {
    if (!isAdmin) return;
    setBusyItemId(item.id);
    setErrorMsg(null);
    try {
      const nextActive = !(item.isActive ?? true);
      const res = await apiFetch(`/api/admin/vault/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Mise à jour impossible.');
      }
      setItems((prev) => prev.map((it) => (it.id === item.id ? data.item : it)));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la mise à jour.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDeleteItem = async (item: SubscriberVaultPackage) => {
    if (!isAdmin) return;
    setBusyItemId(item.id);
    setErrorMsg(null);
    try {
      const res = await apiFetch(`/api/admin/vault/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Suppression impossible.');
      }
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      setStatusMsg(`Fichier "${item.fileName}" supprimé du Coffre.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la suppression.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDownload = async (item: SubscriberVaultPackage) => {
    setErrorMsg(null);
    setStatusMsg(null);

    if (isDemo && !isAdmin) {
      setErrorMsg(
        'Téléchargement bloqué : un abonnement payant actif est obligatoire. Les comptes Démo ne peuvent pas télécharger. Contactez Sofiane au 05 57 76 78 04.'
      );
      return;
    }

    setDownloadingId(item.id);
    try {
      const res = await apiFetch(`/api/vault/download/${encodeURIComponent(item.id)}`, {
        method: 'POST',
        timeoutMs: 90_000,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData?.message ||
            errData?.error ||
            'Accès refusé : abonnement payant requis pour télécharger ce fichier.'
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      if (isAdmin) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, downloadCount: (it.downloadCount ?? 0) + 1 } : it
          )
        );
      }

      setStatusMsg(
        item.extension === '.apk'
          ? `"${item.fileName}" téléchargé sur votre appareil ! Ouvrez vos Téléchargements (ou ZArchiver) pour installer l'APK ou le copier sur clé USB FAT32.`
          : `"${item.fileName}" téléchargé avec succès (intégrité SHA-256 vérifiée).`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Téléchargement impossible.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyHash = (id: string, sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 1800);
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const catOk = categoryFilter === 'Tous' || item.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const qOk =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.fileName.toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [items, categoryFilter, searchQuery]);

  const paidUnlockWhatsAppUrl = `https://wa.me/213557767804?text=${encodeURIComponent(
    `Salam Sofiane, je suis sur AutoPro (compte ${licenseSession.clientName || 'Démo'}). Je souhaite payer et activer un abonnement payant pour débloquer les téléchargements APK / .BIN du Coffre.`
  )}`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              <span>Coffre Téléchargements Abonnés Payants</span>
            </span>
            {isAdmin ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                Mode Admin · Dépôt &amp; Contrôle
              </span>
            ) : isDemo ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50">
                Compte Démo · Téléchargements Verrouillés
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <Unlock className="w-3 h-3" />
                <span>Abonné Payant ({licenseSession.tier.toUpperCase()})</span>
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Coffre APK Android, Firmwares &amp; Fichiers .BIN
          </h1>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            Espace sécurisé contrôlé par licence serveur : seuls les{' '}
            <strong className="text-emerald-300">abonnés ayant payé une licence active</strong> peuvent
            télécharger les fichiers (ex : <code className="text-cyan-300">AA-Bridge.apk</code>, packs autoradio,
            dumps <code className="text-cyan-300">.bin</code>). Les Pass Démo gratuits sont bloqués côté serveur.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchItems()}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 self-start lg:self-center cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Paywall Banner for Demo Accounts */}
      {isDemo && !isAdmin && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/75 via-slate-900 to-amber-950/60 border-2 border-rose-500/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg shadow-rose-950/30">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-rose-300 font-extrabold text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <span>Accès Payant Requis pour Télécharger</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed max-w-2xl">
              Vous utilisez actuellement un <strong>Pass Démo gratuit</strong>. Pour télécharger les applications APK
              (comme <strong>AA-Bridge.apk</strong>) et les fichiers <strong>.BIN</strong>, vous devez activer un
              abonnement payant (Pack Tablette Chinois, Diagnostic, Reprog ou Master DZ).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={paidUnlockWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg"
            >
              <Send className="w-4 h-4" />
              <span>Payer / Commander sur WhatsApp</span>
            </a>
            {onOpenLicenseModal && (
              <button
                type="button"
                onClick={onOpenLicenseModal}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Entrer ma Clé Payée</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-200 text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* ADMIN UPLOAD PANEL */}
      {isAdmin && (
        <form
          onSubmit={handleAdminUpload}
          className="p-5 rounded-2xl bg-slate-900/95 border border-amber-500/40 space-y-4 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Déposer un fichier dans le Coffre Abonnés (APK / .BIN / .ZIP)</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Importez par exemple <code className="text-cyan-300">AA-Bridge.apk</code> depuis votre téléphone : seuls
                les abonnés payants cochés ci-dessous pourront le télécharger.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/40 text-[10px] font-bold text-rose-300 shrink-0">
              Comptes Démo : Bloqués d&apos;office
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                1. Choisir le fichier (.apk, .bin, .zip, .eep, .hex — max 100 Mo)
              </label>
              <label className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950 border border-dashed border-cyan-500/50 hover:border-cyan-400 text-xs text-slate-200 flex items-center justify-between gap-2 cursor-pointer">
                <span className="truncate font-mono">
                  {selectedFile
                    ? `${selectedFile.name} (${formatFileSize(selectedFile.size)})`
                    : 'Toucher pour choisir AA-Bridge.apk ou .bin...'}
                </span>
                <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
                <input
                  type="file"
                  accept=".apk,.bin,.zip,.eep,.hex"
                  onChange={handleFilePick}
                  className="hidden"
                />
              </label>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                2. Nom affiché aux abonnés
              </label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Ex: AA-Bridge Android Auto"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:border-cyan-400 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Version</label>
              <input
                type="text"
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
                placeholder="v1.0"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-cyan-300 font-mono focus:border-cyan-400 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Catégorie</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as VaultFileCategory)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:border-cyan-400 outline-none"
              >
                <option value="APK Android">APK Android</option>
                <option value="Firmware / .BIN">Firmware / .BIN</option>
                <option value="Pack Atelier">Pack Atelier</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-6 space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-300">
                3. Abonnés payants autorisés à télécharger :
              </label>
              <div className="flex flex-wrap gap-2">
                {PAID_TIER_OPTIONS.map((t) => {
                  const active = allowedTiers.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleAllowedTier(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Note d&apos;installation (optionnel)
              </label>
              <input
                type="text"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Ex: Testé sur autoradio Android 10-13"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-cyan-400 outline-none"
              />
            </div>

            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{uploadProgressPct}%</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Publier</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {uploading && (
            <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-200"
                style={{ width: `${uploadProgressPct}%` }}
              />
            </div>
          )}
        </form>
      )}

      {/* Search + Category Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['Tous', 'APK Android', 'Firmware / .BIN', 'Pack Atelier'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                categoryFilter === cat
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher AA-Bridge, .bin..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:border-cyan-500 outline-none"
          />
        </div>
      </div>

      {/* Vault File Cards */}
      {loading ? (
        <div className="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Chargement du Coffre Téléchargements...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 text-center space-y-2">
          <FileArchive className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-bold text-slate-200">
            Aucun fichier disponible dans le Coffre pour le moment.
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isAdmin
              ? 'Utilisez le formulaire ci-dessus pour déposer votre fichier AA-Bridge.apk ou un pack .bin.'
              : 'L’administrateur n’a pas encore publié de fichier APK ou .BIN dans cette catégorie.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const itemActive = item.isActive ?? true;
            const tierAllowed =
              isAdmin ||
              (item.isEligible !== undefined
                ? Boolean(item.isEligible)
                : !isDemo && Boolean(item.allowedTiers?.includes(licenseSession.tier as VaultPaidTier)));
            const isDownloading = downloadingId === item.id;
            const isBusy = busyItemId === item.id;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl bg-slate-900/90 border flex flex-col justify-between gap-4 ${
                  !itemActive
                    ? 'border-slate-800 opacity-75'
                    : isDemo || !tierAllowed
                    ? 'border-rose-500/35'
                    : 'border-slate-700/80 hover:border-cyan-500/50'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                        {item.extension === '.apk' ? (
                          <Smartphone className="w-5 h-5 text-cyan-400" />
                        ) : item.extension === '.zip' ? (
                          <FileArchive className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Cpu className="w-5 h-5 text-emerald-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-extrabold text-white truncate">
                            {item.title}
                          </h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                            {item.version}
                          </span>
                          {!itemActive && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                              EN PAUSE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                          {item.fileName} · {formatFileSize(item.sizeBytes)}
                        </p>
                      </div>
                    </div>

                    {isAdmin && typeof item.downloadCount === 'number' && (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300 shrink-0">
                        {item.downloadCount} téléch.
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800/80">
                      {item.notes}
                    </p>
                  )}

                  {isAdmin && Array.isArray(item.allowedTiers) && item.allowedTiers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="text-slate-400 font-semibold">Formules autorisées :</span>
                      {item.allowedTiers.map((t) => {
                        const info = PAID_TIER_OPTIONS.find((x) => x.id === t);
                        return (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/40 text-emerald-300 font-bold"
                          >
                            {info?.short || t}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {isAdmin && item.sha256 && (
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                      <span className="truncate flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>SHA-256 : {item.sha256.slice(0, 20)}...</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyHash(item.id, item.sha256!)}
                        className="text-cyan-300 hover:text-cyan-200 flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedHashId === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Hash</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  {isDemo && !isAdmin ? (
                    <a
                      href={paidUnlockWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-3 rounded-xl bg-rose-950/70 hover:bg-rose-900/70 border border-rose-500/50 text-rose-200 text-xs font-extrabold flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                      <span>Payer / Activer Abonnement pour Télécharger</span>
                    </a>
                  ) : !tierAllowed ? (
                    <div className="flex-1 py-2.5 px-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Réservé à une formule supérieure</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isDownloading || (!itemActive && !isAdmin)}
                      onClick={() => void handleDownload(item)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/15"
                    >
                      {isDownloading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Téléchargement...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Télécharger ({item.extension.toUpperCase()})</span>
                        </>
                      )}
                    </button>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggleItemActive(item)}
                        className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
                        title={itemActive ? 'Mettre en pause' : 'Réactiver'}
                      >
                        {itemActive ? (
                          <PauseCircle className="w-4 h-4 text-amber-400" />
                        ) : (
                          <PlayCircle className="w-4 h-4 text-emerald-400" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDeleteItem(item)}
                        className="p-2 rounded-xl bg-slate-950 hover:bg-rose-950 border border-slate-700 hover:border-rose-600 text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="Supprimer du Coffre"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recherche Ressources Sécurisées (Admin uniquement) */}
      {isAdmin && (
        <VaultSecurityLookup
          vaultItems={items}
          isAdmin={isAdmin}
          onSelectVerifiedFileForUpload={handleSelectVerifiedFileForUpload}
          onVaultItemImported={(newItem, repoName) => {
            setItems((prev) => [newItem, ...prev]);
            setStatusMsg(
              `"${newItem.fileName}" importé automatiquement depuis ${repoName} dans votre Coffre Payant (SHA-256 vérifié).`
            );
          }}
        />
      )}
    </div>
  );
};
