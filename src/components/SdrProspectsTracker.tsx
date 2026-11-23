import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
  CheckCircle2,
  Clock,
  RefreshCw,
  HardDrive,
  FileSpreadsheet,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { SdrProspect, SdrProspectSpecialty, SdrProspectStatus } from '../types/automotive';
import { apiFetch } from '../utils/apiBridge';
import { formatCacheTimestampFr, loadSdrCache, saveSdrCache } from '../utils/diagnosticCache';

interface SdrProspectsTrackerProps {
  sharedAppUrl: string;
}

const WILAYAS_DZ = [
  '01 - Adrar',
  '02 - Chlef',
  '03 - Laghouat',
  '04 - Oum El Bouaghi',
  '05 - Batna',
  '06 - Béjaïa',
  '07 - Biskra',
  '08 - Béchar',
  '09 - Blida',
  '10 - Bouira',
  '11 - Tamanrasset',
  '12 - Tébessa',
  '13 - Tlemcen',
  '14 - Tiaret',
  '15 - Tizi Ouzou',
  '16 - Alger',
  '17 - Djelfa',
  '18 - Jijel',
  '19 - Sétif',
  '20 - Saïda',
  '21 - Skikda',
  '22 - Sidi Bel Abbès',
  '23 - Annaba',
  '24 - Guelma',
  '25 - Constantine',
  '26 - Médéa',
  '27 - Mostaganem',
  '28 - M\'Sila',
  '29 - Mascara',
  '30 - Ouargla',
  '31 - Oran',
  '32 - El Bayadh',
  '33 - Illizi',
  '34 - Bordj Bou Arréridj',
  '35 - Boumerdès',
  '36 - El Tarf',
  '37 - Tindouf',
  '38 - Tissemsilt',
  '39 - El Oued',
  '40 - Khenchela',
  '41 - Souk Ahras',
  '42 - Tipaza',
  '43 - Mila',
  '44 - Aïn Defla',
  '45 - Naâma',
  '46 - Aïn Témouchent',
  '47 - Ghardaïa',
  '48 - Relizane',
  '49 - Timimoun',
  '50 - Bordj Badji Mokhtar',
  '51 - Ouled Djellal',
  '52 - Béni Abbès',
  '53 - In Salah',
  '54 - In Guezzam',
  '55 - Touggourt',
  '56 - Djanet',
  '57 - El M\'Ghair',
  '58 - El Meniaa',
];

const STATUS_META: Record<SdrProspectStatus, { label: string; badgeClass: string }> = {
  a_visiter: { label: 'À visiter', badgeClass: 'bg-slate-800 text-slate-300 border-slate-700' },
  visite_fait: { label: 'Visite faite', badgeClass: 'bg-blue-950/80 text-blue-300 border-blue-700/60' },
  demo_envoyee: { label: 'Pass Démo envoyé', badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-600/60' },
  a_relancer: { label: 'À relancer', badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-600/60' },
  abonne: { label: 'Abonné Converti', badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60' },
  refus: { label: 'Pas intéressé', badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-700/60' },
};

const SPECIALTY_LABELS: Record<SdrProspectSpecialty, string> = {
  electricien_auto: 'Électricien Auto',
  multimedia_ecrans: 'Poseur Écrans Android / Car Audio',
  mecanicien_diag: 'Mécanicien & Diagnostic',
  chiptuner_immo: 'Chiptuner / Clés IMMO',
  concession_multi: 'Centre Multi-Services Auto',
};

const SEED_FALLBACK_PROSPECTS: SdrProspect[] = [
  {
    id: 'SDR-DZ-001',
    garageName: 'Électro-Auto El Amir',
    contactName: 'Karim B.',
    phone: '0551448820',
    wilaya: '29 - Mascara',
    commune: 'Zone Industrielle Mascara',
    specialty: 'multimedia_ecrans',
    status: 'demo_envoyee',
    interestedPack: 'tablette_chinois',
    estimatedValueDzd: 35000,
    nextFollowUpDate: '2026-11-21',
    notes: 'Pose beaucoup d’écrans Geely Coolray / Jetour. Intéressé par la traduction FR/AR et pare-feu anti-brick.',
    lastContactAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

export const SdrProspectsTracker: React.FC<SdrProspectsTrackerProps> = ({ sharedAppUrl }) => {
  const [prospects, setProspects] = useState<SdrProspect[]>(() => loadSdrCache()?.prospects || []);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(() => loadSdrCache()?.updatedAt || null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');

  // Quick Door-to-Door Add Form
  const [garageName, setGarageName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [wilaya, setWilaya] = useState('29 - Mascara');
  const [commune, setCommune] = useState('');
  const [specialty, setSpecialty] = useState<SdrProspectSpecialty>('electricien_auto');
  const [status, setStatus] = useState<SdrProspectStatus>('visite_fait');
  const [interestedPack, setInterestedPack] = useState<'master' | 'reprog' | 'tablette_chinois' | 'standard'>('master');
  const [estimatedValueDzd, setEstimatedValueDzd] = useState<number>(45000);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getAdminHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
  });

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/sdr/prospects', {
        headers: getAdminHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.prospects)) {
        setProspects(data.prospects);
        const saved = saveSdrCache(data.prospects);
        setCacheTimestamp(saved.updatedAt);
        setIsOfflineMode(false);
        return;
      }
      throw new Error('INVALID_PAYLOAD');
    } catch {
      const cached = loadSdrCache();
      if (cached && cached.prospects.length > 0) {
        setProspects(cached.prospects);
        setCacheTimestamp(cached.updatedAt);
      } else {
        setProspects(SEED_FALLBACK_PROSPECTS);
        const saved = saveSdrCache(SEED_FALLBACK_PROSPECTS);
        setCacheTimestamp(saved.updatedAt);
      }
      setIsOfflineMode(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleAddProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!garageName.trim() || !phone.trim()) {
      flashNotice('Veuillez saisir le nom du garage et son numéro WhatsApp.');
      return;
    }
    setIsSubmitting(true);

    const payload = {
      garageName: garageName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      wilaya,
      commune: commune.trim(),
      specialty,
      status,
      interestedPack,
      estimatedValueDzd: Number(estimatedValueDzd) || 45000,
      nextFollowUpDate,
      notes: notes.trim(),
    };

    try {
      const res = await apiFetch('/api/sdr/prospects', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('SERVER_ERR');
      const data = await res.json();
      if (data.success && data.prospect) {
        const nextList = [data.prospect, ...prospects];
        setProspects(nextList);
        const saved = saveSdrCache(nextList);
        setCacheTimestamp(saved.updatedAt);
        setIsOfflineMode(false);
        flashNotice(`Prospect "${data.prospect.garageName}" ajouté au suivi SDR !`);
      }
    } catch {
      const now = new Date().toISOString();
      const localRecord: SdrProspect = {
        ...payload,
        id: `SDR-LOC-${Date.now().toString(36).toUpperCase()}`,
        lastContactAt: now,
        createdAt: now,
      };
      const nextList = [localRecord, ...prospects];
      setProspects(nextList);
      const saved = saveSdrCache(nextList);
      setCacheTimestamp(saved.updatedAt);
      setIsOfflineMode(true);
      flashNotice(`Prospect "${localRecord.garageName}" enregistré en cache local hors-ligne.`);
    } finally {
      setGarageName('');
      setContactName('');
      setPhone('');
      setCommune('');
      setNotes('');
      setNextFollowUpDate('');
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (prospect: SdrProspect, nextStatus: SdrProspectStatus) => {
    const optimistic = prospects.map((p) =>
      p.id === prospect.id ? { ...p, status: nextStatus, lastContactAt: new Date().toISOString() } : p
    );
    setProspects(optimistic);
    const saved = saveSdrCache(optimistic);
    setCacheTimestamp(saved.updatedAt);

    try {
      const res = await apiFetch(`/api/sdr/prospects/${prospect.id}`, {
        method: 'PATCH',
        headers: getAdminHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('ERR');
      flashNotice(`Statut mis à jour pour ${prospect.garageName} → ${STATUS_META[nextStatus].label}`);
    } catch {
      setIsOfflineMode(true);
      flashNotice(`Statut enregistré localement (${STATUS_META[nextStatus].label}).`);
    }
  };

  const handleDeleteProspect = async (prospect: SdrProspect) => {
    const nextList = prospects.filter((p) => p.id !== prospect.id);
    setProspects(nextList);
    saveSdrCache(nextList);

    try {
      await apiFetch(`/api/sdr/prospects/${prospect.id}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });
      flashNotice(`Prospect "${prospect.garageName}" supprimé.`);
    } catch {
      setIsOfflineMode(true);
    }
  };

  const handleWhatsAppFollowUp = (p: SdrProspect) => {
    const digits = p.phone.replace(/\D/g, '');
    const intlPhone = digits.startsWith('0') ? `213${digits.slice(1)}` : digits;
    const greeting = p.contactName ? `${p.contactName} (${p.garageName})` : p.garageName;
    const text = encodeURIComponent(
      `Salam alikoum ${greeting},\n` +
        `Suite à notre passage dans votre atelier (${p.wilaya}), voici l'accès AutoPro Diagnostic & Flash DZ :\n` +
        `👉 ${sharedAppUrl}\n\n` +
        `✅ Compatible Fiat Doblò Oran, Geely, Jetour, Chery, Golf 8 / Kia Chine (Traduction FR/AR + Pare-feu Anti-Brick).\n` +
        `Dites-moi dès que vous avez un véhicule en atelier pour activer votre Pass Démo !`
    );
    const url = intlPhone ? `https://api.whatsapp.com/send?phone=${intlPhone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Garage', 'Contact', 'Téléphone', 'Wilaya', 'Commune', 'Spécialité', 'Statut', 'Pack', 'Valeur_DZD', 'Relance', 'Notes'];
    const rows = prospects.map((p) => [
      p.id,
      p.garageName,
      p.contactName || '',
      p.phone,
      p.wilaya,
      p.commune || '',
      SPECIALTY_LABELS[p.specialty],
      STATUS_META[p.status].label,
      p.interestedPack || 'master',
      String(p.estimatedValueDzd),
      p.nextFollowUpDate || '',
      (p.notes || '').replace(/"/g, '""'),
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.map((c) => `"${c}"`).join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AutoPro_Suivi_SDR_DZ_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (specialtyFilter !== 'all' && p.specialty !== specialtyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit =
          p.garageName.toLowerCase().includes(q) ||
          (p.contactName || '').toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q) ||
          p.wilaya.toLowerCase().includes(q) ||
          (p.commune || '').toLowerCase().includes(q) ||
          (p.notes || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [prospects, statusFilter, specialtyFilter, searchQuery]);

  // Pipeline KPIs
  const totalCount = prospects.length;
  const followUpCount = prospects.filter((p) => p.status === 'a_relancer' || p.status === 'demo_envoyee').length;
  const convertedList = prospects.filter((p) => p.status === 'abonne');
  const convertedCount = convertedList.length;
  const conversionRate = totalCount > 0 ? Math.round((convertedCount / totalCount) * 100) : 0;
  const convertedRevenue = convertedList.reduce((acc, p) => acc + (p.estimatedValueDzd || 0), 0);
  const pipelinePotential = prospects
    .filter((p) => p.status !== 'abonne' && p.status !== 'refus')
    .reduce((acc, p) => acc + (p.estimatedValueDzd || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-cyan-950/50 border border-indigo-500/40 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              CRM Porte-à-Porte · 58 Wilayas Algérie
            </span>
            {isOfflineMode ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-600/50 flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                <span>Cache Terrain Hors-Ligne ({formatCacheTimestampFr(cacheTimestamp)})</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-600/50">
                Synchronisé Serveur
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <span>Suivi SDR Prospects &amp; Tournées Ateliers Algérie</span>
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Enregistrez chaque garage, électricien auto ou poseur d’écrans visité sur le terrain, suivez les Pass Démo envoyés et relancez en 1 clic sur WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchProspects}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/50 text-xs text-cyan-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-slate-400 block text-[11px]">Ateliers Visités / Suivis</span>
          <span className="text-2xl font-black text-white mt-1 block">{totalCount}</span>
          <span className="text-[10px] text-slate-500">Base prospection active</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-slate-400 block text-[11px]">À Relancer / Démos Actives</span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">{followUpCount}</span>
          <span className="text-[10px] text-amber-400/80">Priorité de relance J+2</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-slate-400 block text-[11px]">Abonnés Convertis</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-400">{convertedCount}</span>
            <span className="text-xs font-mono text-emerald-300">({conversionRate}%)</span>
          </div>
          <span className="text-[10px] text-emerald-400/80">{convertedRevenue.toLocaleString('fr-DZ')} DZD encaissés</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-slate-400 block text-[11px] flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>Pipeline Potentiel</span>
          </span>
          <span className="text-xl font-black font-mono text-cyan-400 mt-1 block">
            {pipelinePotential.toLocaleString('fr-DZ')} DZD
          </span>
          <span className="text-[10px] text-slate-500">En cours de négociation</span>
        </div>
      </div>

      {/* Add Prospect Quick Field Form + List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Quick Add Form (4 cols) */}
        <form
          onSubmit={handleAddProspect}
          className="lg:col-span-4 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs h-fit"
        >
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-400" />
            <span>Ajouter un Garage Visité</span>
          </h3>

          <div>
            <label className="block text-slate-400 mb-1">Nom de l’Atelier / Garage *</label>
            <input
              type="text"
              required
              placeholder="Ex: Électro-Auto El Bahia"
              value={garageName}
              onChange={(e) => setGarageName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">Responsable</label>
              <input
                type="text"
                placeholder="Prénom / Gérant"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Téléphone / WhatsApp *</label>
              <input
                type="tel"
                required
                placeholder="05 50 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">Wilaya</label>
              <select
                value={wilaya}
                onChange={(e) => setWilaya(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                {WILAYAS_DZ.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Commune / Quartier</label>
              <input
                type="text"
                placeholder="Ex: Zone Industrielle"
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Spécialité du Prospect</label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value as SdrProspectSpecialty)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              {Object.entries(SPECIALTY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">Statut Terrain</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SdrProspectStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                {Object.entries(STATUS_META).map(([k, meta]) => (
                  <option key={k} value={k}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Pack Ciblé</label>
              <select
                value={interestedPack}
                onChange={(e) => setInterestedPack(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="master">Master DZ</option>
                <option value="tablette_chinois">Tablette Chinoise</option>
                <option value="reprog">Reprog Pro</option>
                <option value="standard">Diagnostic Std</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">Valeur Estimée (DZD)</label>
              <input
                type="number"
                step="1000"
                min="0"
                value={estimatedValueDzd}
                onChange={(e) => setEstimatedValueDzd(Number(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Date Relance</label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Notes terrain (véhicules, objections...)</label>
            <textarea
              rows={2}
              placeholder="Ex: Reçoit des Geely / Fiat Doblò. Demande démo jeudi matin."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer le Prospect'}</span>
          </button>
        </form>

        {/* Right: Prospects Pipeline List (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filter Bar */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher garage, téléphone, wilaya, note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tous Statuts ({prospects.length})</option>
              {Object.entries(STATUS_META).map(([k, meta]) => (
                <option key={k} value={k}>
                  {meta.label}
                </option>
              ))}
            </select>

            <select
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Toutes Spécialités</option>
              {Object.entries(SPECIALTY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Cards */}
          {filteredProspects.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
              Aucun prospect trouvé pour ces critères. Ajoutez votre prochain atelier visité à gauche !
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProspects.map((p) => {
                const meta = STATUS_META[p.status] || STATUS_META.visite_fait;
                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 hover:border-slate-700 space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-white">{p.garageName}</span>
                          {p.contactName && (
                            <span className="text-slate-400">({p.contactName})</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 text-cyan-300 font-mono">
                            <Phone className="w-3 h-3" />
                            {p.phone}
                          </span>
                          <span className="flex items-center gap-1 text-slate-300">
                            <MapPin className="w-3 h-3 text-indigo-400" />
                            {p.wilaya}
                            {p.commune ? ` · ${p.commune}` : ''}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                            {SPECIALTY_LABELS[p.specialty]}
                          </span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <div className="font-mono font-bold text-emerald-400 text-sm">
                          {(p.estimatedValueDzd || 0).toLocaleString('fr-DZ')} DZD
                        </div>
                        {p.nextFollowUpDate && (
                          <div className="text-[10px] text-amber-300 flex items-center sm:justify-end gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>Relance : {p.nextFollowUpDate}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {p.notes && (
                      <p className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-slate-300 text-[11px] leading-relaxed">
                        {p.notes}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <label className="text-[10px] text-slate-500">Étape :</label>
                        <select
                          value={p.status}
                          onChange={(e) => handleStatusChange(p, e.target.value as SdrProspectStatus)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          {Object.entries(STATUS_META).map(([k, m]) => (
                            <option key={k} value={k}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleWhatsAppFollowUp(p)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Send className="w-3 h-3" />
                          <span>Relance WhatsApp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProspect(p)}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 cursor-pointer"
                          title="Supprimer ce prospect"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
