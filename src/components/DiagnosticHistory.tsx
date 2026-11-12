import React, { useState, useEffect } from 'react';
import {
  History,
  Database,
  Activity,
  Calendar,
  Clock,
  Car,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  Filter,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  Zap,
  TrendingUp,
  Cpu,
  FileText,
  DollarSign,
  User,
  ShieldCheck,
  Sliders,
  ChevronDown,
  ChevronUp,
  Printer,
  Sparkles
} from 'lucide-react';
import { DiagnosticScanSession, DatabaseStats, Vehicle, ScanDtcItem } from '../types/automotive';
import { VEHICLE_PRESETS } from '../data/mockVehicles';

interface DiagnosticHistoryProps {
  selectedVehicle?: Vehicle;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  onOpenConnectModal?: () => void;
}

export const DiagnosticHistory: React.FC<DiagnosticHistoryProps> = ({
  selectedVehicle,
  onSelectVehicle,
}) => {
  const [scans, setScans] = useState<DiagnosticScanSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeMessage, setOptimizeMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);

  // Modal for new scan recording
  const [isNewScanModalOpen, setIsNewScanModalOpen] = useState(false);
  const [newScanForm, setNewScanForm] = useState({
    vehicleId: selectedVehicle?.id || VEHICLE_PRESETS[0].id,
    vin: selectedVehicle ? `${selectedVehicle.brand.substring(0, 3).toUpperCase()}-DZ26-${Math.floor(1000 + Math.random() * 9000)}` : 'VF3-DZ26-MASCARA-7788',
    mileageKm: 35000,
    clientName: 'Atelier Mascara Auto',
    technicianName: 'Sofiane M. (Master Tech DZ)',
    dtcCode: 'P0299',
    dtcSystem: 'Calculateur Moteur (ECM)',
    dtcDesc: 'Pression de suralimentation trop faible',
    severity: 'high' as 'low' | 'medium' | 'high' | 'critical',
    recommendation: 'Contrôler la durite d\'intercooler et l\'étanchéité du circuit turbo.',
    estimatedCostDZD: 15000,
    technicianNotes: 'Contrôle périodique atelier.',
  });

  // Action status message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchScansAndStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [scansRes, statsRes] = await Promise.all([
        fetch('/api/history'),
        fetch('/api/db/stats'),
      ]);

      if (!scansRes.ok || !statsRes.ok) {
        throw new Error('Erreur lors du chargement des données SaaS');
      }

      const scansData = await scansRes.json();
      const statsData = await statsRes.json();

      setScans(scansData.scans || []);
      setDbStats(statsData.stats || null);
    } catch (err: any) {
      setError(err.message || 'Impossible de se connecter à la base de données SaaS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScansAndStats();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOptimizeDb = async () => {
    setIsOptimizing(true);
    setOptimizeMessage(null);
    try {
      const res = await fetch('/api/db/optimize', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDbStats(data.stats);
        setOptimizeMessage(`Base optimisée en ${data.result.latencyBenchmarkMs} ms ! Index reconstruits (${data.result.reindexedCount} sessions).`);
        setTimeout(() => setOptimizeMessage(null), 5000);
      }
    } catch {
      setOptimizeMessage('Erreur lors de l\'optimisation de la base.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleResolveScan = async (scanId: string) => {
    try {
      const res = await fetch(`/api/history/${scanId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Réparation validée après essai routier et réinitialisation calculatoire.' }),
      });
      const data = await res.json();
      if (data.success) {
        setScans(prev => prev.map(s => (s.id === scanId ? data.scan : s)));
        showToast(`Session ${scanId} marquée comme RÉSOLUE avec succès !`);
        fetchScansAndStats();
      }
    } catch {
      showToast('Erreur lors de la mise à jour de la session.');
    }
  };

  const handleDeleteScan = async (scanId: string) => {
    if (!window.confirm(`Confirmer la suppression de la session ${scanId} de la base de données ?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/history/${scanId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setScans(prev => prev.filter(s => s.id !== scanId));
        showToast('Session supprimée avec succès.');
        fetchScansAndStats();
      }
    } catch {
      showToast('Erreur lors de la suppression.');
    }
  };

  const handleResetToSeed = async () => {
    if (!window.confirm('Recharger l\'historique d\'atelier complet avec les cas d\'Algérie (Geely, Jetour, Fiat Doblo, Chery) ?')) {
      return;
    }
    try {
      const res = await fetch('/api/history/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setScans(data.scans);
        showToast('Historique d\'atelier réinitialisé avec succès !');
        fetchScansAndStats();
      }
    } catch {
      showToast('Erreur lors de la réinitialisation.');
    }
  };

  const handleCreateNewScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetVeh = VEHICLE_PRESETS.find(v => v.id === newScanForm.vehicleId) || VEHICLE_PRESETS[0];

    const newSession: Partial<DiagnosticScanSession> = {
      vehicleId: targetVeh.id,
      vehicleName: `${targetVeh.brand} ${targetVeh.model}`,
      vin: newScanForm.vin,
      year: targetVeh.year,
      engine: targetVeh.engine,
      mileageKm: Number(newScanForm.mileageKm),
      clientName: newScanForm.clientName,
      technicianName: newScanForm.technicianName,
      durationSeconds: 120,
      protocolUsed: targetVeh.protocol,
      batteryVoltage: 13.9,
      overallHealthScore: newScanForm.severity === 'critical' ? 52 : newScanForm.severity === 'high' ? 68 : 85,
      status: newScanForm.severity === 'critical' ? 'critical' : 'warning',
      dtcCodes: [
        {
          code: newScanForm.dtcCode.toUpperCase(),
          system: newScanForm.dtcSystem,
          descriptionFr: newScanForm.dtcDesc,
          severity: newScanForm.severity,
          status: 'Actif',
          repairRecommendation: newScanForm.recommendation,
          estimatedCostDZD: Number(newScanForm.estimatedCostDZD),
          laborHours: 1.5,
        },
      ],
      technicianNotes: newScanForm.technicianNotes,
      repairCompleted: false,
    };

    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSession),
      });
      const data = await res.json();
      if (data.success) {
        setScans(prev => [data.scan, ...prev]);
        setIsNewScanModalOpen(false);
        showToast('Nouvelle session de scan enregistrée dans la base SaaS !');
        fetchScansAndStats();
      }
    } catch {
      showToast('Erreur lors de l\'enregistrement.');
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(scans, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `autopro-diagnostic-history-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Exportation JSON téléchargée avec succès.');
  };

  const handlePrintReport = (scan: DiagnosticScanSession) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Fiche d'Atelier AutoPro - ${scan.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 20px; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; }
            .header-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 13px; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
            .dtc-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
            .dtc-code { font-weight: bold; font-size: 15px; color: #b91c1c; }
            .recom { background: #f0fdf4; border-left: 3px solid #16a34a; padding: 8px; margin-top: 8px; font-size: 13px; }
            .footer { margin-top: 30px; font-size: 11px; text-align: center; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <h1>RAPPORT DE DIAGNOSTIC AUTOMOBILE - AUTOPRO DZ</h1>
          <div class="header-info">
            <div>
              <strong>Véhicule :</strong> ${scan.vehicleName} (${scan.year})<br/>
              <strong>Moteur :</strong> ${scan.engine}<br/>
              <strong>Numéro VIN :</strong> ${scan.vin}<br/>
              <strong>Kilométrage :</strong> ${scan.mileageKm.toLocaleString()} km
            </div>
            <div>
              <strong>Réf. Session :</strong> ${scan.id}<br/>
              <strong>Date & Heure :</strong> ${new Date(scan.timestamp).toLocaleString('fr-FR')}<br/>
              <strong>Client :</strong> ${scan.clientName}<br/>
              <strong>Technicien :</strong> ${scan.technicianName}
            </div>
          </div>
          <h3>Codes Défauts Détectés (DTC) &amp; Préconisations de Réparation :</h3>
          ${scan.dtcCodes.length === 0 ? '<p>Aucun code défaut. Tous les systèmes sont en ordre.</p>' : scan.dtcCodes.map(d => `
            <div class="dtc-box">
              <span class="dtc-code">${d.code}</span> - <em>${d.system}</em><br/>
              <p><strong>Description :</strong> ${d.descriptionFr}</p>
              <div class="recom">
                <strong>Solution Technique Préconisée :</strong><br/>
                ${d.repairRecommendation}<br/>
                ${d.partReference ? `<strong>Réf. Pièce OEM :</strong> ${d.partReference}<br/>` : ''}
                ${d.estimatedCostDZD ? `<strong>Estimation Coût :</strong> ${d.estimatedCostDZD.toLocaleString()} DZD` : ''}
              </div>
            </div>
          `).join('')}
          <div class="footer">
            AutoPro Diagnostic &amp; Flash Hub - Algérie · Système certifié UDS ISO 14229 / SAE J2534
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Filtered scans
  const filteredScans = scans.filter(scan => {
    if (statusFilter !== 'all' && scan.status !== statusFilter) return false;
    if (vehicleFilter !== 'all' && scan.vehicleId !== vehicleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchVehicle = scan.vehicleName.toLowerCase().includes(q) || scan.vin.toLowerCase().includes(q);
      const matchClient = scan.clientName?.toLowerCase().includes(q);
      const matchDtc = scan.dtcCodes.some(d => d.code.toLowerCase().includes(q) || d.descriptionFr.toLowerCase().includes(q));
      if (!matchVehicle && !matchClient && !matchDtc) return false;
    }
    return true;
  });

  // Calculate Health Trends & Analytics
  const avgHealthScore = scans.length > 0
    ? Math.round(scans.reduce((acc, s) => acc + s.overallHealthScore, 0) / scans.length)
    : 100;
  const resolvedCount = scans.filter(s => s.status === 'resolved' || s.status === 'passed').length;
  const resolutionRate = scans.length > 0 ? Math.round((resolvedCount / scans.length) * 100) : 100;
  const criticalCount = scans.filter(s => s.status === 'critical').length;
  const totalDtcCount = scans.reduce((acc, s) => acc + s.dtcCodes.length, 0);

  const getStatusBadge = (status: DiagnosticScanSession['status']) => {
    switch (status) {
      case 'passed':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sain (0 DTC)</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-950/80 border border-cyan-600/60 text-cyan-300 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-cyan-400" />
            <span>Réparé / Résolu</span>
          </span>
        );
      case 'warning':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/80 border border-amber-600/60 text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Avertissement</span>
          </span>
        );
      case 'critical':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-950/80 border border-rose-600/60 text-rose-300 flex items-center gap-1.5 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Défaut Critique</span>
          </span>
        );
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30';
    if (score >= 65) return 'text-amber-400 border-amber-500/40 bg-amber-950/30';
    return 'text-rose-400 border-rose-500/40 bg-rose-950/30';
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900 border border-cyan-500/60 text-white shadow-2xl flex items-center gap-3 animate-fade-in text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner: SaaS Database Engine & High-Performance Analytics */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950 text-cyan-400 border border-cyan-800/80 flex items-center gap-1.5">
                <Database className="w-3 h-3 text-cyan-400" />
                <span>Base de Données SaaS Haute Performance</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-emerald-400" />
                <span>Latence {dbStats?.avgQueryLatencyMs || 0.35} ms</span>
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              <span>Historique Diagnostic &amp; Suivi Santé du Véhicule</span>
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Stockage persistant et indexé en mémoire des sessions de scan multimarque (Geely, Jetour, Fiat Doblo, Chery, etc.) avec traçabilité des codes DTC, causes racines et préconisations de réparation chiffrées en DZD.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleOptimizeDb}
              disabled={isOptimizing}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 hover:text-white flex items-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
              title="Reconstruire les index et compacter le stockage"
            >
              <Zap className={`w-3.5 h-3.5 text-cyan-400 ${isOptimizing ? 'animate-spin' : ''}`} />
              <span>{isOptimizing ? 'Optimisation...' : 'Optimiser Base'}</span>
            </button>

            <button
              onClick={() => setIsNewScanModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-2 cursor-pointer transition-colors shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enregistrer Scan Manuel</span>
            </button>

            <button
              onClick={handleExportJson}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
              title="Exporter l'historique en JSON"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={handleResetToSeed}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 cursor-pointer transition-colors"
              title="Réinitialiser avec les véhicules tests d'Algérie"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {optimizeMessage && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{optimizeMessage}</span>
          </div>
        )}

        {/* Metric Strips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sessions Enregistrées</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">
              {scans.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {dbStats?.totalVehicles || 0} véhicules uniques
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Score Santé Flotte</span>
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {avgHealthScore} / 100
            </div>
            <div className="text-[10px] text-emerald-500/80 mt-0.5">
              État moyen des véhicules
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Taux de Résolution</span>
            </div>
            <div className="text-xl font-bold text-cyan-300 mt-1">
              {resolutionRate}%
            </div>
            <div className="text-[10px] text-cyan-500/80 mt-0.5">
              {resolvedCount} pannes résolues
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>DTCs Actifs / Critiques</span>
            </div>
            <div className="text-xl font-bold text-rose-400 mt-1">
              {criticalCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Sur {totalDtcCount} codes historiques
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par modèle, VIN, code DTC (ex: P0299, P2002) ou client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Tous les Statuts ({scans.length})</option>
            <option value="critical">Défauts Critiques</option>
            <option value="warning">Avertissements</option>
            <option value="resolved">Résolus / Réparés</option>
            <option value="passed">Véhicules Sans Faute</option>
          </select>

          {/* Vehicle Filter */}
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-cyan-500 max-w-[180px] truncate"
          >
            <option value="all">Tous Véhicules</option>
            {VEHICLE_PRESETS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main List of Scan Sessions */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">Interrogation de la base de données SaaS en cours...</p>
        </div>
      ) : filteredScans.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <History className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">Aucune session trouvée</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Aucun enregistrement ne correspond aux critères de filtre. Vous pouvez enregistrer un nouveau scan manuellement ou réinitialiser avec les cas d'atelier d'Algérie.
          </p>
          <button
            onClick={handleResetToSeed}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recharger les Véhicules Algérie (Geely, Jetour, Fiat Doblo)</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredScans.map((scan) => {
            const isExpanded = expandedScanId === scan.id;
            return (
              <div
                key={scan.id}
                className="rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 transition-all shadow-md overflow-hidden"
              >
                {/* Header Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Health score circle */}
                    <div
                      className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center shrink-0 ${getHealthColor(
                        scan.overallHealthScore
                      )}`}
                    >
                      <span className="text-xs font-black leading-none">{scan.overallHealthScore}%</span>
                      <span className="text-[9px] uppercase tracking-tighter opacity-80 mt-0.5">Santé</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-white">{scan.vehicleName}</span>
                        <span className="text-xs text-slate-400">({scan.year})</span>
                        {getStatusBadge(scan.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="font-mono text-[11px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                          VIN: {scan.vin}
                        </span>
                        <span>·</span>
                        <span>{scan.mileageKm.toLocaleString()} km</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {new Date(scan.timestamp).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          {scan.clientName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Expand Toggle */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    {scan.status !== 'resolved' && scan.status !== 'passed' && (
                      <button
                        onClick={() => handleResolveScan(scan.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Marquer toutes les réparations comme terminées"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Marquer Réparé</span>
                      </button>
                    )}

                    <button
                      onClick={() => handlePrintReport(scan)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
                      title="Imprimer / Télécharger la fiche atelier"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteScan(scan.id)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                      title="Supprimer la session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setExpandedScanId(isExpanded ? null : scan.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>{isExpanded ? 'Masquer Détails' : `Défauts (${scan.dtcCodes.length})`}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 bg-slate-950/40 space-y-4 text-xs">
                    {/* Technical Meta Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Protocole OBD :</span>
                        <span className="font-semibold text-white">{scan.protocolUsed}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Tension Batterie :</span>
                        <span className="font-semibold text-emerald-400">{scan.batteryVoltage} V</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Durée Scan :</span>
                        <span className="font-semibold text-white">{scan.durationSeconds} secondes</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Technicien Responsable :</span>
                        <span className="font-semibold text-cyan-300">{scan.technicianName}</span>
                      </div>
                    </div>

                    {/* DTC Codes & Repair Recommendations */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Codes Défauts &amp; Recommandations Techniques de Réparation :</span>
                      </h4>

                      {scan.dtcCodes.length === 0 ? (
                        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Aucun code d'erreur actif. Diagnostic vierge, le véhicule est 100% opérationnel.</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {scan.dtcCodes.map((dtc, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <span className="px-2.5 py-0.5 rounded-md font-mono font-bold text-xs bg-rose-950 text-rose-300 border border-rose-800">
                                    {dtc.code}
                                  </span>
                                  <span className="font-semibold text-white">{dtc.system}</span>
                                </div>
                                <span className="text-[11px] font-semibold text-slate-400">
                                  Statut : <span className="text-white">{dtc.status}</span>
                                </span>
                              </div>

                              <p className="text-xs text-slate-300 font-medium">
                                {dtc.descriptionFr}
                              </p>

                              {dtc.rootCause && (
                                <div className="text-[11px] text-amber-300/90 bg-amber-950/30 p-2 rounded-lg border border-amber-900/40">
                                  <strong>Cause Racine Identifiée :</strong> {dtc.rootCause}
                                </div>
                              )}

                              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/50 space-y-1.5">
                                <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Préconisation de Réparation &amp; Pièces :</span>
                                </div>
                                <p className="text-xs text-slate-200 leading-relaxed">
                                  {dtc.repairRecommendation}
                                </p>
                                <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-400">
                                  {dtc.partReference && (
                                    <span className="font-mono text-cyan-300">
                                      OEM Ref: {dtc.partReference}
                                    </span>
                                  )}
                                  {dtc.estimatedCostDZD && (
                                    <span className="text-emerald-400 font-bold">
                                      Estimation : {dtc.estimatedCostDZD.toLocaleString()} DZD
                                    </span>
                                  )}
                                  {dtc.laborHours && (
                                    <span>Main-d'œuvre : {dtc.laborHours} h</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Technician Notes */}
                    {scan.technicianNotes && (
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
                        <strong className="text-slate-400 block mb-0.5">Observations Atelier :</strong>
                        {scan.technicianNotes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Enregistrer un Scan Manuel */}
      {isNewScanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Enregistrer un Scan dans la Base SaaS</span>
              </h3>
              <button
                onClick={() => setIsNewScanModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewScan} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Véhicule :</label>
                <select
                  value={newScanForm.vehicleId}
                  onChange={(e) => {
                    const veh = VEHICLE_PRESETS.find(v => v.id === e.target.value);
                    setNewScanForm({
                      ...newScanForm,
                      vehicleId: e.target.value,
                      vin: veh ? `${veh.brand.substring(0, 3).toUpperCase()}-DZ26-${Math.floor(1000 + Math.random() * 9000)}` : newScanForm.vin,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                >
                  {VEHICLE_PRESETS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.engine})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Numéro VIN :</label>
                  <input
                    type="text"
                    value={newScanForm.vin}
                    onChange={(e) => setNewScanForm({ ...newScanForm, vin: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kilométrage (km) :</label>
                  <input
                    type="number"
                    value={newScanForm.mileageKm}
                    onChange={(e) => setNewScanForm({ ...newScanForm, mileageKm: Number(e.target.value) })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Client Atelier :</label>
                  <input
                    type="text"
                    value={newScanForm.clientName}
                    onChange={(e) => setNewScanForm({ ...newScanForm, clientName: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Technicien :</label>
                  <input
                    type="text"
                    value={newScanForm.technicianName}
                    onChange={(e) => setNewScanForm({ ...newScanForm, technicianName: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-bold text-white block">Détails du Défaut DTC :</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-0.5 text-[11px]">Code :</label>
                    <input
                      type="text"
                      value={newScanForm.dtcCode}
                      onChange={(e) => setNewScanForm({ ...newScanForm, dtcCode: e.target.value })}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-slate-400 block mb-0.5 text-[11px]">Système :</label>
                    <input
                      type="text"
                      value={newScanForm.dtcSystem}
                      onChange={(e) => setNewScanForm({ ...newScanForm, dtcSystem: e.target.value })}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-0.5 text-[11px]">Description :</label>
                  <input
                    type="text"
                    value={newScanForm.dtcDesc}
                    onChange={(e) => setNewScanForm({ ...newScanForm, dtcDesc: e.target.value })}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-0.5 text-[11px]">Recommandation de Réparation :</label>
                  <textarea
                    rows={2}
                    value={newScanForm.recommendation}
                    onChange={(e) => setNewScanForm({ ...newScanForm, recommendation: e.target.value })}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-0.5 text-[11px]">Gravité :</label>
                    <select
                      value={newScanForm.severity}
                      onChange={(e) => setNewScanForm({ ...newScanForm, severity: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                    >
                      <option value="low">Faible</option>
                      <option value="medium">Moyenne</option>
                      <option value="high">Élevée</option>
                      <option value="critical">Critique</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5 text-[11px]">Coût Estimé (DZD) :</label>
                    <input
                      type="number"
                      value={newScanForm.estimatedCostDZD}
                      onChange={(e) => setNewScanForm({ ...newScanForm, estimatedCostDZD: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewScanModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                >
                  Enregistrer dans la Base
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
