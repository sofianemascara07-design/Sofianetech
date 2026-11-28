import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  Power,
  PowerOff,
  Lock,
  Unlock,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Send,
  Search,
  KeyRound,
  Clock,
  RefreshCw,
  AlertTriangle,
  Sliders,
  FileText,
  FileSpreadsheet,
  Wifi,
  WifiOff,
  Radio,
  Activity,
} from 'lucide-react';
import { ConnectionPresenceStatus, LicenseTier, SecuritySettings, SubscriberRecord } from '../types/automotive';
import { apiFetch } from '../utils/apiBridge';
import { getAuthToken, setAuthToken } from '../utils/authSession';
import { downloadCommercialPacksPdf, downloadCommercialPacksExcel } from '../utils/commercialCatalogExport';

interface DeletedTombstone {
  id: string;
  licenseKey: string;
  deletedAt: string;
}

function formatDurationFr(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return remM > 0 ? `${h}h ${remM}min` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}j ${h % 24}h`;
}

function getPresenceDetails(sub: SubscriberRecord, nowMs: number): {
  status: ConnectionPresenceStatus;
  label: string;
  detail: string;
  badgeClass: string;
  dotClass: string;
} {
  const ref = sub.lastHeartbeatAt || sub.lastUsedAt;
  if (!ref) {
    return {
      status: 'never_connected',
      label: 'EN ATTENTE 1ère CONNEXION',
      detail: 'Clé active · Le client ne s’est pas encore connecté',
      badgeClass: 'bg-slate-800/90 text-slate-300 border-slate-700',
      dotClass: 'bg-slate-400',
    };
  }
  const refMs = new Date(ref).getTime();
  if (!Number.isFinite(refMs)) {
    return {
      status: 'never_connected',
      label: 'EN ATTENTE 1ère CONNEXION',
      detail: 'Signal inconnu',
      badgeClass: 'bg-slate-800/90 text-slate-300 border-slate-700',
      dotClass: 'bg-slate-400',
    };
  }
  const ageSec = Math.max(0, Math.floor((nowMs - refMs) / 1000));
  if (ageSec <= 45 && (sub.lastStabilityScore === null || sub.lastStabilityScore === undefined || sub.lastStabilityScore >= 65)) {
    return {
      status: 'online',
      label: 'CONNECTÉ EN DIRECT',
      detail: `Signal reçu il y a ${formatDurationFr(ageSec)}`,
      badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60',
      dotClass: 'bg-emerald-400 animate-ping',
    };
  }
  if (ageSec <= 120) {
    return {
      status: 'unstable',
      label: 'CONNEXION INSTABLE / VEILLE',
      detail: `Dernier signal il y a ${formatDurationFr(ageSec)} (micro-coupure)`,
      badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-500/60',
      dotClass: 'bg-amber-400 animate-pulse',
    };
  }
  return {
    status: 'offline',
    label: 'CONNEXION PERDUE',
    detail: `Hors-ligne depuis ${formatDurationFr(ageSec)} (dernier signal : ${new Date(refMs).toLocaleString('fr-FR')})`,
    badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-500/60',
    dotClass: 'bg-rose-500',
  };
}

interface AdminSubscribersPanelProps {
  onAdminSessionInvalid?: (reason: string) => void;
  onOpenVault?: () => void;
}

export const AdminSubscribersPanel: React.FC<AdminSubscribersPanelProps> = ({
  onAdminSessionInvalid,
  onOpenVault,
}) => {
  const [subscribers, setSubscribers] = useState<SubscriberRecord[]>([]);
  const deletedTombstonesRef = useRef<DeletedTombstone[]>([]);
  const [security, setSecurity] = useState<SecuritySettings>({
    demoLinksEnabled: false,
    defaultDemoMinutes: 10,
    blockedDemoKeys: [],
  });
  const [loading, setLoading] = useState(true);
  const [isMirrorOffline, setIsMirrorOffline] = useState(false);
  const [liveAutoRefresh, setLiveAutoRefresh] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'lost' | 'active' | 'suspended' | 'revoked'>('all');

  // Add Subscriber / Limited Demo Form
  const [newClientName, setNewClientName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newTier, setNewTier] = useState<LicenseTier>('master');
  const [newDemoMinutes, setNewDemoMinutes] = useState<number>(10);
  const [newBoundHwid, setNewBoundHwid] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [lastCreatedSub, setLastCreatedSub] = useState<SubscriberRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Admin Passcode change
  const [newAdminPasscode, setNewAdminPasscode] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadOverview = useCallback(async (silent = false) => {
    if (!getAuthToken()) {
      onAdminSessionInvalid?.('Jeton de session Administrateur absent.');
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch('/api/admin/subscribers/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscribers: [],
          deletedTombstones: deletedTombstonesRef.current,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        onAdminSessionInvalid?.('Session Administrateur expirée ou refusée.');
        return;
      }

      const data = await res.json();
      if (res.ok && data.success) {
        const syncedList: SubscriberRecord[] = data.subscribers || [];
        setSubscribers(syncedList);
        if (data.securitySettings) {
          setSecurity(data.securitySettings);
        }
        setIsMirrorOffline(false);
        setLastSyncAt(new Date().toLocaleTimeString('fr-FR'));
      } else {
        throw new Error('SYNC_FAILED');
      }
    } catch {
      setIsMirrorOffline(true);
      if (!silent) {
        showMsg('error', 'Serveur temporairement indisponible — Nouvelle tentative automatique à la reconnexion.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onAdminSessionInvalid]);

  useEffect(() => {
    void loadOverview(false);
  }, [loadOverview]);

  // Real-time 15s polling for live client connection / lost-connection detection
  useEffect(() => {
    if (!liveAutoRefresh) return;
    const poll = setInterval(() => {
      void loadOverview(true);
    }, 15_000);
    return () => clearInterval(poll);
  }, [liveAutoRefresh, loadOverview]);

  // 1-second local tick so elapsed connection durations refresh smoothly
  useEffect(() => {
    const ticker = setInterval(() => {
      setNowTickMs(Date.now());
    }, 5000);
    return () => clearInterval(ticker);
  }, []);

  const handleCopyKey = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevokeAllDemosNow = async () => {
    setSavingSecurity(true);
    try {
      const res = await apiFetch('/api/admin/security/revoke-demos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.settings) setSecurity(data.settings);
        showMsg('success', data.message || 'Toutes les démonstrations partagées ont été coupées et verrouillées.');
        await loadOverview();
      } else {
        showMsg('error', data.error || 'Échec du verrouillage des démonstrations.');
      }
    } catch {
      showMsg('error', 'Erreur réseau lors du verrouillage global.');
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleToggleDemoLinks = async () => {
    setSavingSecurity(true);
    try {
      const nextValue = !security.demoLinksEnabled;
      const res = await apiFetch('/api/admin/security', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          demoLinksEnabled: nextValue,
          defaultDemoMinutes: security.defaultDemoMinutes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSecurity(data.securitySettings);
        showMsg(
          'success',
          nextValue
            ? `Pass Démo Limité (${security.defaultDemoMinutes} min) autorisé pour les clés démo créées manuellement.`
            : 'Tous les Pass Démo gratuits sont maintenant VERROUILLÉS.'
        );
      } else {
        showMsg('error', data.error || 'Erreur lors de la mise à jour sécurité.');
      }
    } catch {
      showMsg('error', 'Erreur serveur.');
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleUpdateSecurityRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdminPasscode.trim() && newAdminPasscode.trim().length < 6) {
      showMsg('error', 'Le nouveau mot de passe Admin doit contenir au moins 6 caractères.');
      return;
    }
    setSavingSecurity(true);
    try {
      const payload: Record<string, unknown> = {
        defaultDemoMinutes: Number(security.defaultDemoMinutes) || 10,
      };
      if (newAdminPasscode.trim()) {
        payload.newAdminPasscode = newAdminPasscode.trim();
      }
      const res = await apiFetch('/api/admin/security', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSecurity(data.securitySettings);
        if (typeof data.token === 'string' && data.token) {
          setAuthToken(data.token);
        }
        setNewAdminPasscode('');
        showMsg('success', 'Paramètres de sécurité & code Admin mis à jour.');
      } else {
        showMsg('error', data.error || 'Mise à jour refusée.');
      }
    } catch {
      showMsg('error', 'Erreur réseau.');
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      showMsg('error', 'Veuillez saisir le nom du client ou du garage.');
      return;
    }
    setActionBusyId('create');
    try {
      const res = await apiFetch('/api/admin/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName: newClientName.trim(),
          phone: newPhone.trim(),
          tier: newTier,
          maxDemoMinutes: newTier === 'demo' ? Number(newDemoMinutes) || 10 : null,
          boundHwid: newBoundHwid.trim() || null,
          notes: newNotes.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.subscriber) {
        setSubscribers(prev => [data.subscriber, ...prev]);
        setLastCreatedSub(data.subscriber);
        setNewClientName('');
        setNewPhone('');
        setNewBoundHwid('');
        setNewNotes('');
        showMsg(
          'success',
          newTier === 'demo'
            ? `Pass Démo Limité (${data.subscriber.maxDemoMinutes} min) créé pour ${data.subscriber.clientName} !`
            : `Abonné ${data.subscriber.clientName} ajouté et sécurisé (permanent jusqu'à désactivation) !`
        );
      } else {
        showMsg('error', data.error || 'Impossible d\'ajouter cet abonné.');
      }
    } catch {
      showMsg('error', 'Erreur réseau lors de la création.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleToggleStatus = async (sub: SubscriberRecord) => {
    const nextStatus: 'active' | 'suspended' = sub.status === 'active' ? 'suspended' : 'active';
    setActionBusyId(sub.id);
    try {
      const res = await apiFetch(`/api/admin/subscribers/${sub.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
          notes:
            nextStatus === 'suspended'
              ? `${sub.notes ? sub.notes + ' · ' : ''}Désactivé par Admin (${new Date().toLocaleDateString('fr-FR')})`
              : sub.notes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.subscriber) {
        setSubscribers(prev => prev.map(item => (item.id === sub.id ? data.subscriber : item)));
        showMsg(
          'success',
          nextStatus === 'suspended'
            ? `Client "${sub.clientName}" DÉSACTIVÉ & BLOQUÉ immédiatement.`
            : `Client "${sub.clientName}" RÉACTIVÉ avec succès.`
        );
      } else {
        showMsg('error', data.error || 'Impossible de modifier le statut.');
      }
    } catch {
      showMsg('error', 'Erreur réseau.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleResetHwid = async (sub: SubscriberRecord) => {
    setActionBusyId(sub.id);
    try {
      const res = await apiFetch(`/api/admin/subscribers/${sub.id}/reset-hwid`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success && data.subscriber) {
        setSubscribers(prev => prev.map(item => (item.id === sub.id ? data.subscriber : item)));
        showMsg('success', `Empreinte HWID réinitialisée pour ${sub.clientName}.`);
      } else {
        showMsg('error', data.error || 'Erreur reset HWID.');
      }
    } catch {
      showMsg('error', 'Erreur réseau.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeleteSubscriber = async (sub: SubscriberRecord) => {
    setActionBusyId(sub.id);
    try {
      const res = await apiFetch(`/api/admin/subscribers/${sub.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        deletedTombstonesRef.current = [
          { id: sub.id, licenseKey: sub.licenseKey.toUpperCase(), deletedAt: new Date().toISOString() },
          ...deletedTombstonesRef.current.filter(
            (d) => d.id !== sub.id && d.licenseKey !== sub.licenseKey.toUpperCase()
          ),
        ].slice(0, 300);
        setSubscribers(prev => prev.filter(item => item.id !== sub.id));
        showMsg('success', `Abonné "${sub.clientName}" supprimé définitivement.`);
      } else {
        showMsg('error', data.error || 'Suppression refusée.');
      }
    } catch {
      showMsg('error', 'Erreur réseau.');
    } finally {
      setActionBusyId(null);
    }
  };

  const buildWhatsAppLink = (sub: SubscriberRecord) => {
    const cleanPhone = (sub.phone || '').replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0')
      ? `213${cleanPhone.slice(1)}`
      : cleanPhone.startsWith('213')
      ? cleanPhone
      : cleanPhone;

    const text = encodeURIComponent(
      sub.tier === 'demo'
        ? `Salam ${sub.clientName},\nVoici votre Pass Démo LIMITÉ (${sub.maxDemoMinutes || 10} minutes) AutoPro DZ :\n🔑 Clé : ${sub.licenseKey}\n🌐 Lien : https://autoprodz-a7071.web.app\n⚠️ Pass valable uniquement ${sub.maxDemoMinutes || 10} minutes sur 1 seul appareil.`
        : `Salam ${sub.clientName},\nVoici votre Licence Abonné Officielle AutoPro Diagnostic & Flash DZ :\n🔑 Clé : ${sub.licenseKey}\n📦 Formule : ${sub.tier.toUpperCase()}\n🌐 Lien : https://autoprodz-a7071.web.app`
    );

    return intlPhone
      ? `https://api.whatsapp.com/send?phone=${intlPhone}&text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
  };

  const filteredSubscribers = subscribers.filter(sub => {
    const presence = getPresenceDetails(sub, nowTickMs);
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'online'
        ? presence.status === 'online' || presence.status === 'unstable'
        : statusFilter === 'lost'
        ? presence.status === 'offline'
        : sub.status === statusFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      sub.clientName.toLowerCase().includes(q) ||
      sub.licenseKey.toLowerCase().includes(q) ||
      (sub.phone || '').toLowerCase().includes(q) ||
      (sub.boundHwid || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const activeCount = subscribers.filter(s => s.status === 'active').length;
  const blockedCount = subscribers.filter(s => s.status === 'suspended' || s.status === 'revoked').length;
  const onlineNowCount = subscribers.filter(s => {
    if (s.status !== 'active') return false;
    const p = getPresenceDetails(s, nowTickMs).status;
    return p === 'online' || p === 'unstable';
  }).length;
  const lostConnCount = subscribers.filter(s => {
    if (s.status !== 'active') return false;
    return getPresenceDetails(s, nowTickMs).status === 'offline';
  }).length;

  return (
    <div className="space-y-6">
      {/* Admin Master Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-rose-950/40 border border-amber-500/40 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Console Administration &amp; Abonnés
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                  security.demoLinksEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                {security.demoLinksEnabled
                  ? `Pass Démo Limité Autorisé (${security.defaultDemoMinutes} min)`
                  : 'Démos Publiques Verrouillées (Mode Strict)'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
                  isMirrorOffline
                    ? 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>
                  {isMirrorOffline
                    ? 'Serveur hors-ligne'
                    : `Sync Direct${lastSyncAt ? ` · ${lastSyncAt}` : ''}`}
                </span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
              <span>Contrôle Abonnés, Présence Directe &amp; Sécurité</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Gérez les abonnés enregistrés, leur présence en direct et le verrouillage des démonstrations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenVault && (
              <button
                type="button"
                onClick={onOpenVault}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Lock className="w-4 h-4" />
                <span>Coffre APK &amp; .BIN</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setLiveAutoRefresh(prev => !prev)}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
                liveAutoRefresh
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
              title="Actualisation automatique toutes les 15 secondes pour voir qui se connecte ou perd la connexion"
            >
              <Activity className={`w-3.5 h-3.5 ${liveAutoRefresh ? 'animate-pulse text-emerald-400' : ''}`} />
              <span>Direct 15s : {liveAutoRefresh ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const file = downloadCommercialPacksPdf();
                showMsg('success', `PDF téléchargé : ${file}`);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Grille 3 Packs (PDF)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const file = downloadCommercialPacksExcel();
                showMsg('success', `Fichier Excel téléchargé : ${file}`);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Tableau Excel</span>
            </button>

            <button
              type="button"
              onClick={() => void loadOverview(false)}
              disabled={loading}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Synchroniser</span>
            </button>

            <button
              type="button"
              onClick={handleRevokeAllDemosNow}
              disabled={savingSecurity}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 flex items-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Couper Démos</span>
            </button>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Enregistrés</span>
            <span className="text-xl font-extrabold text-white font-mono">{subscribers.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-700/50">
            <span className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>En Ligne Maintenant</span>
            </span>
            <span className="text-xl font-extrabold text-emerald-400 font-mono">{onlineNowCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-700/50">
            <span className="text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1">
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span>Connexion Perdue</span>
            </span>
            <span className="text-xl font-extrabold text-amber-400 font-mono">{lostConnCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-cyan-800/40">
            <span className="text-[10px] uppercase font-bold text-cyan-400 block">Actifs Permanents</span>
            <span className="text-xl font-extrabold text-cyan-400 font-mono">{activeCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-rose-800/40">
            <span className="text-[10px] uppercase font-bold text-rose-400 block">Désactivés / Révoqués</span>
            <span className="text-xl font-extrabold text-rose-400 font-mono">{blockedCount}</span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <ShieldCheck className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Grid: Add Subscriber / Pass + Global Security Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Add Subscriber / Limited Demo Pass */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-cyan-400" />
              <span>Ajouter un Abonné ou Créer un Pass Démo Limité</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">Liste Blanche Serveur</span>
          </div>

          <form onSubmit={handleAddSubscriber} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nom Client / Garage *</label>
              <input
                type="text"
                placeholder="Ex: Garage Oran Auto Elec"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Téléphone / WhatsApp</label>
              <input
                type="text"
                placeholder="Ex: 0557XXXXXX"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Type d'Accès / Formule</label>
              <select
                value={newTier}
                onChange={(e) => setNewTier(e.target.value as LicenseTier)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="master">Pass MASTER DZ (Tous Modules + Coffre APK Complet)</option>
                <option value="tablette_chinois">Pass Apps Tiers · Prix Symbolique (Coffre APK &amp; Packs)</option>
                <option value="standard">Pass Standard (Coffre APK + Outils Open-Source)</option>
                <option value="reprog">Pass REPROG PRO (Coffre APK + Outils Open-Source)</option>
                <option value="demo">Pass Démo LIMITÉ (Sans Téléchargements Coffre)</option>
              </select>
            </div>

            {newTier === 'demo' ? (
              <div>
                <label className="block text-amber-300 font-semibold mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Durée du Pass Démo Limité (minutes)</span>
                </label>
                <select
                  value={newDemoMinutes}
                  onChange={(e) => setNewDemoMinutes(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value={5}>5 minutes (Test Express)</option>
                  <option value={10}>10 minutes (Recommandé)</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">HWID Machine (Optionnel)</label>
                <input
                  type="text"
                  placeholder="Laisser vide = lié au 1er PC ouvert"
                  value={newBoundHwid}
                  onChange={(e) => setNewBoundHwid(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">Notes / Wilaya / Remarques</label>
              <input
                type="text"
                placeholder="Ex: Payé BaridiMob 45 000 DA · Mascara"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="sm:col-span-2 pt-1">
              <button
                type="submit"
                disabled={actionBusyId === 'create'}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {actionBusyId === 'create'
                    ? 'Création en cours...'
                    : newTier === 'demo'
                    ? `Générer Pass Démo Limité (${newDemoMinutes} min)`
                    : 'Ajouter cet Abonné & Générer sa Clé'}
                </span>
              </button>
            </div>
          </form>

          {lastCreatedSub && (
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300">
                  Clé prête pour {lastCreatedSub.clientName} :
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyKey(`new-${lastCreatedSub.id}`, lastCreatedSub.licenseKey)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-cyan-300 border border-slate-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === `new-${lastCreatedSub.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === `new-${lastCreatedSub.id}` ? 'Copié' : 'Copier'}</span>
                  </button>
                  <a
                    href={buildWhatsAppLink(lastCreatedSub)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
              <div className="font-mono font-bold text-sm text-white bg-slate-950 p-2 rounded-lg border border-slate-800 select-all">
                {lastCreatedSub.licenseKey}
              </div>
            </div>
          )}
        </div>

        {/* Right: Global Demo Lock & Admin Passcode */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Verrouillage Démos &amp; Code Admin</span>
            </h2>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-white block">Autoriser les Pass Démo Limités</span>
                <span className="text-[11px] text-slate-400">
                  Si désactivé, aucune clé démo ne peut ouvrir l'application.
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleDemoLinks}
                disabled={savingSecurity}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  security.demoLinksEnabled
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    : 'bg-rose-600 text-white hover:bg-rose-500'
                }`}
              >
                {security.demoLinksEnabled ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{security.demoLinksEnabled ? 'Démo Ouverte' : 'Verrouillée'}</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleUpdateSecurityRules} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Durée par défaut des Pass Démo (minutes)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={security.defaultDemoMinutes}
                onChange={(e) =>
                  setSecurity(prev => ({ ...prev, defaultDemoMinutes: Number(e.target.value) || 10 }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Changer le Mot de Passe Admin (Optionnel)</span>
              </label>
              <input
                type="password"
                placeholder="Nouveau code secret Admin (min. 6 car.)"
                value={newAdminPasscode}
                onChange={(e) => setNewAdminPasscode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingSecurity}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl cursor-pointer"
            >
              Enregistrer les Règles de Sécurité
            </button>
          </form>
        </div>
      </div>

      {/* Subscriber Whitelist & Anti-Manipulation Table */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Liste des Abonnés &amp; Contrôle Anti-Manipulation ({filteredSubscribers.length})</span>
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher nom, clé, tél, HWID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              {(['all', 'online', 'lost', 'active', 'suspended', 'revoked'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    statusFilter === st ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'all'
                    ? 'Tous'
                    : st === 'online'
                    ? `En ligne (${onlineNowCount})`
                    : st === 'lost'
                    ? `Perte connexion (${lostConnCount})`
                    : st === 'active'
                    ? 'Actifs'
                    : st === 'suspended'
                    ? 'Désactivés'
                    : 'Révoqués'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredSubscribers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800">
              Aucun abonné trouvé pour ce filtre.
            </div>
          ) : (
            filteredSubscribers.map(sub => {
              const isBlocked = sub.status !== 'active';
              const presence = getPresenceDetails(sub, nowTickMs);
              return (
                <div
                  key={sub.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isBlocked
                      ? 'bg-rose-950/20 border-rose-800/50'
                      : presence.status === 'online'
                      ? 'bg-slate-950/90 border-emerald-700/50 hover:border-emerald-600'
                      : presence.status === 'offline'
                      ? 'bg-slate-950/80 border-amber-700/40 hover:border-amber-600/60'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-white">{sub.clientName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          sub.tier === 'master'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : sub.tier === 'reprog'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : sub.tier === 'demo'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {sub.tier === 'demo' ? `DÉMO ${sub.maxDemoMinutes || 10} MIN` : sub.tier.toUpperCase()}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          sub.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {sub.status === 'active'
                          ? sub.tier === 'demo'
                            ? 'ACTIF'
                            : 'ACTIF PERMANENT'
                          : sub.status === 'suspended'
                          ? 'DÉSACTIVÉ'
                          : 'RÉVOQUÉ'}
                      </span>

                      {/* Real-time Connection Presence Pill */}
                      {!isBlocked && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border flex items-center gap-1.5 ${presence.badgeClass}`}
                        >
                          <span className={`w-2 h-2 rounded-full inline-block ${presence.dotClass}`} />
                          <span>{presence.label}</span>
                        </span>
                      )}

                      {sub.phone && (
                        <span className="text-[11px] font-mono text-slate-400">{sub.phone}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px]">
                      <span className="font-mono font-bold text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 select-all">
                        {sub.licenseKey}
                      </span>
                      <span className="text-slate-400 font-mono">
                        HWID : <strong className="text-slate-200">{sub.boundHwid || 'Non lié (Libre 1er appareil)'}</strong>
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          presence.status === 'online'
                            ? 'text-emerald-300'
                            : presence.status === 'unstable'
                            ? 'text-amber-300'
                            : presence.status === 'offline'
                            ? 'text-rose-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {presence.detail}
                      </span>
                      {typeof sub.lastStabilityScore === 'number' && (
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-bold border ${
                            sub.lastStabilityScore >= 85
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                              : sub.lastStabilityScore >= 60
                              ? 'bg-amber-950/60 text-amber-300 border-amber-700/50'
                              : 'bg-rose-950/60 text-rose-300 border-rose-700/50'
                          }`}
                        >
                          Stabilité {sub.lastStabilityScore}%
                          {typeof sub.lastLatencyMs === 'number' ? ` · ${sub.lastLatencyMs}ms` : ''}
                          {sub.lastConnectionMode ? ` · ${sub.lastConnectionMode.toUpperCase()}` : ''}
                          {sub.wakeLockActive ? ' · Éveillé' : ''}
                          {typeof sub.lastReconnectCount === 'number' && sub.lastReconnectCount > 0
                            ? ` · ${sub.lastReconnectCount} reconnexion(s)`
                            : ''}
                        </span>
                      )}
                    </div>

                    {sub.notes && (
                      <p className="text-[11px] text-slate-400">{sub.notes}</p>
                    )}
                  </div>

                  {/* Quick Control Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyKey(sub.id, sub.licenseKey)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold border border-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === sub.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === sub.id ? 'Copié' : 'Clé'}</span>
                    </button>

                    <a
                      href={buildWhatsAppLink(sub)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-[11px] font-semibold border border-emerald-700/50 flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      disabled={actionBusyId === sub.id}
                      onClick={() => handleToggleStatus(sub)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        sub.status === 'active'
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {sub.status === 'active' ? (
                        <>
                          <PowerOff className="w-3.5 h-3.5" />
                          <span>Désactiver (Bloquer)</span>
                        </>
                      ) : (
                        <>
                          <Power className="w-3.5 h-3.5" />
                          <span>Réactiver</span>
                        </>
                      )}
                    </button>

                    {sub.boundHwid && (
                      <button
                        type="button"
                        disabled={actionBusyId === sub.id}
                        onClick={() => handleResetHwid(sub)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-semibold border border-slate-700 flex items-center gap-1 cursor-pointer"
                        title="Libérer la clé pour un autre PC / Tablette"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset HWID</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={actionBusyId === sub.id}
                      onClick={() => handleDeleteSubscriber(sub)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 cursor-pointer"
                      title="Supprimer cet abonné"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
