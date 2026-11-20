import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  ThumbsUp,
  Flag,
  CheckCircle2,
  Cpu,
  Zap,
  ShieldCheck,
  WifiOff,
  RefreshCw,
  X,
  Trash2,
  MapPin,
  UserCheck,
} from 'lucide-react';
import {
  EcuPinoutEntry,
  EcuPinRow,
  FuseSlotRow,
  PinoutModuleType,
} from '../types/automotive';
import { apiFetch } from '../utils/apiBridge';
import {
  getOrCreateTechnicianVoterId,
  loadPinoutsCache,
  savePinoutsCache,
} from '../utils/workshopOfflineCache';

const BRANDS: Array<'Tous' | EcuPinoutEntry['brand']> = [
  'Tous',
  'Chery',
  'Geely',
  'MG',
  'BYD',
  'DFSK',
  'Changan',
];

const MODULE_TYPES: Array<'TOUS' | PinoutModuleType> = [
  'TOUS',
  'ECU',
  'BCM',
  'ABS',
  'FUSEBOX',
];

export const PinoutCrowdsourcingModule: React.FC = () => {
  const initialCache = useMemo(() => loadPinoutsCache(), []);
  const [pinouts, setPinouts] = useState<EcuPinoutEntry[]>(initialCache.entries);
  const [selectedId, setSelectedId] = useState<string>(initialCache.entries[0]?.id || '');
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(initialCache.updatedAt);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [brandFilter, setBrandFilter] = useState<'Tous' | EcuPinoutEntry['brand']>('Tous');
  const [moduleFilter, setModuleFilter] = useState<'TOUS' | PinoutModuleType>('TOUS');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  // Upload form state
  const [formBrand, setFormBrand] = useState<EcuPinoutEntry['brand']>('Chery');
  const [formModel, setFormModel] = useState('');
  const [formYearRange, setFormYearRange] = useState('2022–2026');
  const [formEngine, setFormEngine] = useState('1.5T / Essence');
  const [formModuleType, setFormModuleType] = useState<PinoutModuleType>('ECU');
  const [formSupplier, setFormSupplier] = useState('Bosch / UAES MED17.8.10');
  const [formTitle, setFormTitle] = useState('');
  const [formContributor, setFormContributor] = useState('');
  const [formWilaya, setFormWilaya] = useState('16 - Alger');
  const [formPins, setFormPins] = useState<EcuPinRow[]>([
    {
      connector: 'Connecteur A',
      pinNumber: 'Pin 01',
      wireColor: 'Rouge',
      signalName: '+12V Après Contact (+15 APC)',
      expectedTestValue: '12.5V+ contact ON',
      notes: '',
    },
  ]);
  const [formFuses, setFormFuses] = useState<FuseSlotRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const voterId = useMemo(() => getOrCreateTechnicianVoterId(), []);

  const fetchPinouts = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/pinouts');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data?.success && Array.isArray(data.pinouts)) {
        setPinouts(data.pinouts);
        const ts = savePinoutsCache(data.pinouts);
        setCacheTimestamp(ts);
        setIsOfflineMode(false);
        if (!selectedId && data.pinouts.length > 0) {
          setSelectedId(data.pinouts[0].id);
        }
      }
    } catch {
      setIsOfflineMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchPinouts();
  }, []);

  const filteredPinouts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pinouts
      .filter((entry) => {
        if (brandFilter !== 'Tous' && entry.brand !== brandFilter) return false;
        if (moduleFilter !== 'TOUS' && entry.moduleType !== moduleFilter) return false;
        if (verifiedOnly && (entry.verifiedVotes < 3 || entry.reportFlags >= 3)) return false;
        if (!q) return true;
        return (
          entry.title.toLowerCase().includes(q) ||
          entry.model.toLowerCase().includes(q) ||
          entry.ecuSupplier.toLowerCase().includes(q) ||
          entry.brand.toLowerCase().includes(q) ||
          entry.pins.some(
            (p) =>
              p.signalName.toLowerCase().includes(q) ||
              p.pinNumber.toLowerCase().includes(q) ||
              p.wireColor.toLowerCase().includes(q)
          ) ||
          (entry.fuses || []).some(
            (f) =>
              f.slotCode.toLowerCase().includes(q) ||
              f.circuit.toLowerCase().includes(q)
          )
        );
      })
      .sort((a, b) => b.verifiedVotes - a.verifiedVotes);
  }, [pinouts, brandFilter, moduleFilter, verifiedOnly, searchQuery]);

  const selectedEntry = useMemo(() => {
    return (
      filteredPinouts.find((p) => p.id === selectedId) ||
      filteredPinouts[0] ||
      pinouts.find((p) => p.id === selectedId) ||
      pinouts[0] ||
      null
    );
  }, [filteredPinouts, pinouts, selectedId]);

  const handleVote = async (entry: EcuPinoutEntry, action: 'verify' | 'flag') => {
    const voteToken = `${action}:${voterId}`;
    if (entry.votedByIds?.includes(voteToken)) {
      setFeedbackMsg({
        type: 'warn',
        text: 'Vous avez déjà enregistré votre vote pour cette fiche.',
      });
      return;
    }

    // Optimistic local update for workshop responsiveness
    const optimisticList = pinouts.map((item) => {
      if (item.id !== entry.id) return item;
      return {
        ...item,
        verifiedVotes: action === 'verify' ? item.verifiedVotes + 1 : item.verifiedVotes,
        reportFlags: action === 'flag' ? item.reportFlags + 1 : item.reportFlags,
        votedByIds: [...(item.votedByIds || []), voteToken],
      };
    });
    setPinouts(optimisticList);
    setCacheTimestamp(savePinoutsCache(optimisticList));

    try {
      const res = await apiFetch(`/api/pinouts/${encodeURIComponent(entry.id)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId, action }),
      });
      const data = await res.json();
      if (data?.success && data.pinout) {
        const synced = pinouts.map((item) => (item.id === entry.id ? data.pinout : item));
        setPinouts(synced);
        setCacheTimestamp(savePinoutsCache(synced));
        setFeedbackMsg({
          type: data.alreadyVoted ? 'warn' : 'ok',
          text: data.alreadyVoted
            ? 'Vote déjà comptabilisé sur le serveur.'
            : action === 'verify'
            ? 'Brochage confirmé "Vérifié sur véhicule". Merci pour le réseau DZ !'
            : 'Signalement d’erreur enregistré pour relecture.',
        });
      }
    } catch {
      setIsOfflineMode(true);
      setFeedbackMsg({
        type: 'ok',
        text: 'Vote sauvegardé dans le cache local atelier (hors-ligne).',
      });
    }
  };

  const handleSubmitNewPinout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formModel.trim() || !formTitle.trim()) {
      setFeedbackMsg({ type: 'warn', text: 'Renseignez au minimum le modèle et le titre.' });
      return;
    }
    const validPins = formPins.filter((p) => p.pinNumber.trim() && p.signalName.trim());
    const validFuses = formFuses.filter((f) => f.slotCode.trim() && f.circuit.trim());
    if (validPins.length === 0 && validFuses.length === 0) {
      setFeedbackMsg({ type: 'warn', text: 'Ajoutez au moins une broche ou un fusible.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        brand: formBrand,
        model: formModel.trim(),
        yearRange: formYearRange.trim() || '2021–2026',
        engineOrVersion: formEngine.trim() || 'Standard',
        moduleType: formModuleType,
        ecuSupplier: formSupplier.trim() || 'Non spécifié',
        title: formTitle.trim(),
        contributorName: formContributor.trim() || 'Électricien Atelier DZ',
        contributorWilaya: formWilaya.trim() || 'Algérie',
        pins: validPins,
        fuses: validFuses.length > 0 ? validFuses : undefined,
      };

      const res = await apiFetch('/api/pinouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data?.success && data.pinout) {
        const nextList = [data.pinout as EcuPinoutEntry, ...pinouts];
        setPinouts(nextList);
        setCacheTimestamp(savePinoutsCache(nextList));
        setSelectedId(data.pinout.id);
        setIsUploadOpen(false);
        setFeedbackMsg({ type: 'ok', text: 'Brochage publié et mis en cache atelier !' });
      } else {
        throw new Error(data?.error || 'Erreur serveur');
      }
    } catch {
      // Offline fallback save to local cache
      const now = new Date().toISOString();
      const offlineEntry: EcuPinoutEntry = {
        id: `PIN-LOCAL-${Date.now().toString(36).toUpperCase()}`,
        brand: formBrand,
        model: formModel.trim(),
        yearRange: formYearRange.trim() || '2021–2026',
        engineOrVersion: formEngine.trim() || 'Standard',
        moduleType: formModuleType,
        ecuSupplier: formSupplier.trim() || 'Non spécifié',
        title: formTitle.trim(),
        contributorName: formContributor.trim() || 'Électricien Atelier DZ',
        contributorWilaya: formWilaya.trim() || 'Algérie',
        verifiedVotes: 1,
        reportFlags: 0,
        votedByIds: [`verify:${voterId}`],
        pins: validPins,
        fuses: validFuses.length > 0 ? validFuses : undefined,
        createdAt: now,
        updatedAt: now,
      };
      const nextList = [offlineEntry, ...pinouts];
      setPinouts(nextList);
      setCacheTimestamp(savePinoutsCache(nextList));
      setSelectedId(offlineEntry.id);
      setIsUploadOpen(false);
      setIsOfflineMode(true);
      setFeedbackMsg({
        type: 'ok',
        text: 'Serveur hors-ligne : schéma enregistré immédiatement dans le cache local.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher Pin, Couleur fil, MED17, CAN, Fusible F09..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                Marque : {b}
              </option>
            ))}
          </select>

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            {MODULE_TYPES.map((m) => (
              <option key={m} value={m}>
                Module : {m}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setVerifiedOnly((v) => !v)}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              verifiedOnly
                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Vérifiés (&ge;3 votes)
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void fetchPinouts()}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            title="Synchroniser avec le serveur"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            Sync
          </button>

          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Publier un Brochage
          </button>
        </div>
      </div>

      {/* Offline / Feedback strip */}
      {(isOfflineMode || feedbackMsg) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          {isOfflineMode && (
            <div className="px-3 py-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Mode Cache Hors-Ligne Atelier actif ({pinouts.length} schémas disponibles localement
                {cacheTimestamp ? ` · Sync: ${new Date(cacheTimestamp).toLocaleTimeString('fr-FR')}` : ''})
              </span>
            </div>
          )}
          {feedbackMsg && (
            <div
              className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-3 ${
                feedbackMsg.type === 'ok'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
              }`}
            >
              <span>{feedbackMsg.text}</span>
              <button
                type="button"
                onClick={() => setFeedbackMsg(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left List */}
        <div className="lg:col-span-4 space-y-2 max-h-[680px] overflow-y-auto pr-1">
          {filteredPinouts.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
              Aucun schéma trouvé pour ce filtre.
            </div>
          ) : (
            filteredPinouts.map((entry) => {
              const isSelected = selectedEntry?.id === entry.id;
              const isVerified = entry.verifiedVotes >= 3;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-400 shadow-sm'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold text-[10px]">
                        {entry.brand}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-700/50 text-blue-300 font-mono text-[10px]">
                        {entry.moduleType}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                        isVerified
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      {entry.verifiedVotes}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white line-clamp-2">{entry.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    {entry.model} · {entry.ecuSupplier}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {entry.contributorWilaya}
                    </span>
                    <span>
                      {entry.pins.length} pins
                      {entry.fuses?.length ? ` · ${entry.fuses.length} fusibles` : ''}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail Panel */}
        <div className="lg:col-span-8">
          {selectedEntry ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5">
              {/* Entry Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold text-xs">
                      {selectedEntry.brand} · {selectedEntry.yearRange}
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-xs">
                      {selectedEntry.moduleType}
                    </span>
                    {selectedEntry.verifiedVotes >= 3 && (
                      <span className="px-2.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Vérifié sur véhicule ({selectedEntry.verifiedVotes})
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {selectedEntry.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    <strong className="text-slate-200">{selectedEntry.model}</strong> ·{' '}
                    {selectedEntry.engineOrVersion} · Calculateur :{' '}
                    <span className="text-cyan-300 font-mono">{selectedEntry.ecuSupplier}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    Partagé par {selectedEntry.contributorName} ({selectedEntry.contributorWilaya})
                  </p>
                </div>

                {/* Validation Voting Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleVote(selectedEntry, 'verify')}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Vérifié sur véhicule ({selectedEntry.verifiedVotes})
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleVote(selectedEntry, 'flag')}
                    className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-600/60 text-slate-300 hover:text-rose-300 text-xs flex items-center gap-1 cursor-pointer"
                    title="Signaler une broche erronée"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    {selectedEntry.reportFlags > 0 && <span>{selectedEntry.reportFlags}</span>}
                  </button>
                </div>
              </div>

              {/* Pinout Table */}
              {selectedEntry.pins.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" />
                    Tableau des Broches &amp; Valeurs Multimètre
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5 border-b border-slate-800">Connecteur</th>
                          <th className="p-2.5 border-b border-slate-800">Broche</th>
                          <th className="p-2.5 border-b border-slate-800">Fil</th>
                          <th className="p-2.5 border-b border-slate-800">Signal / Fonction</th>
                          <th className="p-2.5 border-b border-slate-800">Test Multimètre</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {selectedEntry.pins.map((pin, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                              {pin.connector}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-cyan-300 whitespace-nowrap">
                              {pin.pinNumber}
                            </td>
                            <td className="p-2.5 text-amber-300 font-medium whitespace-nowrap">
                              {pin.wireColor}
                            </td>
                            <td className="p-2.5 text-white font-medium">
                              <div>{pin.signalName}</div>
                              {pin.notes && (
                                <div className="text-[11px] text-amber-300/90 mt-0.5">
                                  Note terrain : {pin.notes}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 font-mono text-emerald-300 text-[11px]">
                              {pin.expectedTestValue}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Fusebox Table if present */}
              {selectedEntry.fuses && selectedEntry.fuses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    Affectation Boîte à Fusibles &amp; Relais
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedEntry.fuses.map((fuse, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-xs">
                              {fuse.slotCode}
                            </span>
                            <span className="font-mono font-bold text-white text-xs">
                              {fuse.amps}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{fuse.circuit}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px] shrink-0">
                          {fuse.powerType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Upload Pinout Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Partager un Brochage ECU / BCM / Boîte à Fusibles
                </h3>
                <p className="text-xs text-slate-400">
                  Validation communautaire par votes des électriciens auto en Algérie
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewPinout} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Marque *</label>
                  <select
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    {['Chery', 'Geely', 'MG', 'BYD', 'DFSK', 'Changan', 'Autre'].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Module *</label>
                  <select
                    value={formModuleType}
                    onChange={(e) => setFormModuleType(e.target.value as PinoutModuleType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="ECU">ECU Moteur / Boîte</option>
                    <option value="BCM">BCM / Gateway / IHU</option>
                    <option value="ABS">ABS / ESP</option>
                    <option value="FUSEBOX">Boîte à Fusibles</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Années</label>
                  <input
                    type="text"
                    value={formYearRange}
                    onChange={(e) => setFormYearRange(e.target.value)}
                    placeholder="Ex: 2022–2026"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Modèle Véhicule *</label>
                  <input
                    type="text"
                    required
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="Ex: Chery Tiggo 4 Pro / Coolray Battle"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Équipementier / Référence Calculateur
                  </label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="Ex: Bosch MED17.8.10 / Delphi MT62.1"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">Titre du Schéma *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: Pinout Alim + CAN Bus Calculateur Moteur"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Motorisation</label>
                  <input
                    type="text"
                    value={formEngine}
                    onChange={(e) => setFormEngine(e.target.value)}
                    placeholder="Ex: 1.5TD"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Votre Nom / Garage</label>
                  <input
                    type="text"
                    value={formContributor}
                    onChange={(e) => setFormContributor(e.target.value)}
                    placeholder="Ex: Électro Auto Karim"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Wilaya</label>
                  <input
                    type="text"
                    value={formWilaya}
                    onChange={(e) => setFormWilaya(e.target.value)}
                    placeholder="Ex: 31 - Oran"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              {/* Dynamic Pins */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400">Broches (Pins) relevées</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormPins((prev) => [
                        ...prev,
                        {
                          connector: 'Connecteur A',
                          pinNumber: '',
                          wireColor: '',
                          signalName: '',
                          expectedTestValue: '',
                        },
                      ])
                    }
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs cursor-pointer"
                  >
                    + Ajouter Broche
                  </button>
                </div>

                {formPins.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={row.connector}
                      onChange={(e) =>
                        setFormPins((p) =>
                          p.map((r, i) => (i === idx ? { ...r, connector: e.target.value } : r))
                        )
                      }
                      placeholder="Prise"
                      className="col-span-2 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={row.pinNumber}
                      onChange={(e) =>
                        setFormPins((p) =>
                          p.map((r, i) => (i === idx ? { ...r, pinNumber: e.target.value } : r))
                        )
                      }
                      placeholder="Pin *"
                      className="col-span-2 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                    <input
                      type="text"
                      value={row.wireColor}
                      onChange={(e) =>
                        setFormPins((p) =>
                          p.map((r, i) => (i === idx ? { ...r, wireColor: e.target.value } : r))
                        )
                      }
                      placeholder="Couleur fil"
                      className="col-span-2 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={row.signalName}
                      onChange={(e) =>
                        setFormPins((p) =>
                          p.map((r, i) => (i === idx ? { ...r, signalName: e.target.value } : r))
                        )
                      }
                      placeholder="Signal (ex: CAN-H) *"
                      className="col-span-3 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={row.expectedTestValue}
                      onChange={(e) =>
                        setFormPins((p) =>
                          p.map((r, i) =>
                            i === idx ? { ...r, expectedTestValue: e.target.value } : r
                          )
                        )
                      }
                      placeholder="Mesure (V / Ω)"
                      className="col-span-2 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setFormPins((p) => p.filter((_, i) => i !== idx))}
                      className="col-span-1 p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer flex justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Optional Fuse rows */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">
                    Fusibles associés (optionnel)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormFuses((prev) => [
                        ...prev,
                        { slotCode: '', amps: '15A', circuit: '', powerType: 'APC (+15)' },
                      ])
                    }
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs cursor-pointer"
                  >
                    + Ajouter Fusible
                  </button>
                </div>

                {formFuses.map((f, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={f.slotCode}
                      onChange={(e) =>
                        setFormFuses((p) =>
                          p.map((r, i) => (i === idx ? { ...r, slotCode: e.target.value } : r))
                        )
                      }
                      placeholder="Code (F12)"
                      className="col-span-2 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                    <input
                      type="text"
                      value={f.amps}
                      onChange={(e) =>
                        setFormFuses((p) =>
                          p.map((r, i) => (i === idx ? { ...r, amps: e.target.value } : r))
                        )
                      }
                      placeholder="15A"
                      className="col-span-2 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={f.circuit}
                      onChange={(e) =>
                        setFormFuses((p) =>
                          p.map((r, i) => (i === idx ? { ...r, circuit: e.target.value } : r))
                        )
                      }
                      placeholder="Circuit protégé"
                      className="col-span-5 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                    <select
                      value={f.powerType}
                      onChange={(e) =>
                        setFormFuses((p) =>
                          p.map((r, i) =>
                            i === idx ? { ...r, powerType: e.target.value as any } : r
                          )
                        )
                      }
                      className="col-span-2 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="APC (+15)">APC (+15)</option>
                      <option value="BAT (+30)">BAT (+30)</option>
                      <option value="ACCESSOIRE">ACC</option>
                      <option value="MASSE">MASSE</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setFormFuses((p) => p.filter((_, i) => i !== idx))}
                      className="col-span-1 p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer flex justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Publier dans la base atelier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
