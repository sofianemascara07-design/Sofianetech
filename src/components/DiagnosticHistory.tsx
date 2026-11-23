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
  Sparkles,
  Users,
  HardDrive,
  MapPin,
  Globe,
  FileDown,
  Key,
  WifiOff
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { DiagnosticScanSession, DatabaseStats, Vehicle, ScanDtcItem, ClientActivityRecord } from '../types/automotive';
import { VEHICLE_PRESETS } from '../data/mockVehicles';
import { apiFetch } from '../utils/apiBridge';
import { formatCacheTimestampFr, loadHistoryCache, saveHistoryCache } from '../utils/diagnosticCache';

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
  const [activities, setActivities] = useState<ClientActivityRecord[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'scans' | 'activity'>('scans');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [isBackingUp, setIsBackingUp] = useState(false);

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

  // Offline Cache state
  const [isCacheMode, setIsCacheMode] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);

  // Action status message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchScansAndStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [scansRes, statsRes, actRes] = await Promise.all([
        apiFetch('/api/history'),
        apiFetch('/api/db/stats'),
        apiFetch('/api/clients/activity'),
      ]);

      if (!scansRes.ok || !statsRes.ok) {
        throw new Error('Erreur lors du chargement des données SaaS');
      }

      const scansData = await scansRes.json();
      const statsData = await statsRes.json();
      const actData = actRes.ok ? await actRes.json() : { activities: [] };

      const nextScans = scansData.scans || [];
      const nextStats = statsData.stats || null;
      const nextActs = actData.activities || [];

      setScans(nextScans);
      setDbStats(nextStats);
      setActivities(nextActs);
      setIsCacheMode(false);
      const saved = saveHistoryCache({
        scans: nextScans,
        stats: nextStats,
        activities: nextActs,
      });
      setCacheUpdatedAt(saved.updatedAt);
    } catch (err: any) {
      const cached = loadHistoryCache();
      if (cached && ((cached.scans && cached.scans.length > 0) || (cached.activities && cached.activities.length > 0))) {
        setScans(cached.scans || []);
        setDbStats(cached.stats || null);
        setActivities(cached.activities || []);
        setIsCacheMode(true);
        setCacheUpdatedAt(cached.updatedAt);
        setError(null);
      } else {
        setError(err.message || 'Impossible de se connecter à la base de données SaaS');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = loadHistoryCache();
    if (cached && ((cached.scans && cached.scans.length > 0) || (cached.activities && cached.activities.length > 0))) {
      setScans(cached.scans || []);
      setDbStats(cached.stats || null);
      setActivities(cached.activities || []);
      setCacheUpdatedAt(cached.updatedAt);
      setLoading(false);
    }
    fetchScansAndStats();

    const handleOnline = () => {
      fetchScansAndStats();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOptimizeDb = async () => {
    setIsOptimizing(true);
    setOptimizeMessage(null);
    try {
      const res = await apiFetch('/api/db/optimize', { method: 'POST' });
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
      const res = await apiFetch(`/api/history/${scanId}/resolve`, {
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
      const res = await apiFetch(`/api/history/${scanId}`, { method: 'DELETE' });
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
      const res = await apiFetch('/api/history/seed', { method: 'POST' });
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
      const res = await apiFetch('/api/history', {
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

  const handleDownloadFullBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await apiFetch('/api/db/backup');
      if (!res.ok) throw new Error('Erreur sauvegarde');
      const data = await res.json();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `autopro-sauvegarde-integrale-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Sauvegarde intégrale SaaS (Scans + Activités Clients) téléchargée !');
    } catch {
      showToast('Erreur lors de la sauvegarde intégrale.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleGeneratePdfReport = (scan: DiagnosticScanSession) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 16;

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 34, 'F');
      doc.setTextColor(34, 211, 238);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('AUTOPRO DIAGNOSTIC & FLASH HUB — ALGERIE', 14, 15);

      doc.setTextColor(226, 232, 240);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Rapport Officiel de Diagnostic Electronique Automobile (ISO 14229 UDS / SAE J2534)', 14, 22);
      doc.text(`Ref. Session : ${scan.id}   |   Date : ${new Date(scan.timestamp).toLocaleString('fr-FR')}`, 14, 28);

      y = 44;

      // Vehicle & Client Info Card
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, y, pageWidth - 28, 36, 2, 2, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS VEHICULE & ATELIER', 18, y + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(`Vehicule : ${scan.vehicleName} (${scan.year})`, 18, y + 14);
      doc.text(`Motorisation : ${scan.engine}`, 18, y + 20);
      doc.text(`Numero VIN : ${scan.vin}`, 18, y + 26);
      doc.text(`Kilometrage : ${scan.mileageKm.toLocaleString('fr-FR')} km`, 18, y + 32);

      const col2X = 112;
      doc.text(`Client : ${scan.clientName}`, col2X, y + 14);
      doc.text(`Technicien : ${scan.technicianName}`, col2X, y + 20);
      doc.text(`Protocole : ${scan.protocolUsed}`, col2X, y + 26);
      doc.text(`Batterie : ${scan.batteryVoltage} V  |  Score Sante : ${scan.overallHealthScore}/100`, col2X, y + 32);

      y += 44;

      // Status Summary
      const statusLabel =
        scan.status === 'passed'
          ? 'SAIN — AUCUN DEFAUT ACTIF'
          : scan.status === 'resolved'
          ? 'REPARE / RESOLU EN ATELIER'
          : scan.status === 'warning'
          ? 'AVERTISSEMENT — CONTROLE RECOMMANDE'
          : 'DEFAUT CRITIQUE DETECTE';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(scan.status === 'critical' ? 185 : 15, scan.status === 'passed' || scan.status === 'resolved' ? 118 : 23, 42);
      doc.text(`ETAT GLOBAL : ${statusLabel} (${scan.dtcCodes.length} code(s) DTC)`, 14, y);
      y += 8;

      // DTC List
      if (scan.dtcCodes.length === 0) {
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(134, 239, 172);
        doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, 'FD');
        doc.setTextColor(21, 128, 61);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Aucun code defaut (DTC) detecte. Tous les calculateurs repondent normalement.', 18, y + 10);
        y += 24;
      } else {
        scan.dtcCodes.forEach((dtc, idx) => {
          if (y > 245) {
            doc.addPage();
            y = 20;
          }

          const descLines = doc.splitTextToSize(`Description : ${dtc.descriptionFr}`, pageWidth - 36);
          const recLines = doc.splitTextToSize(`Preconisation : ${dtc.repairRecommendation}`, pageWidth - 36);
          const rootLines = dtc.rootCause ? doc.splitTextToSize(`Cause racine : ${dtc.rootCause}`, pageWidth - 36) : [];
          const boxHeight = 16 + descLines.length * 4.5 + recLines.length * 4.5 + rootLines.length * 4.5 + (dtc.estimatedCostDZD || dtc.partReference ? 7 : 0);

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(14, y, pageWidth - 28, boxHeight, 2, 2, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.setTextColor(185, 28, 28);
          doc.text(`${idx + 1}. ${dtc.code} — ${dtc.system} [${dtc.status}]`, 18, y + 7);

          let lineY = y + 13;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(30, 41, 59);
          doc.text(descLines, 18, lineY);
          lineY += descLines.length * 4.5;

          if (rootLines.length > 0) {
            doc.setTextColor(180, 83, 9);
            doc.text(rootLines, 18, lineY);
            lineY += rootLines.length * 4.5;
          }

          doc.setTextColor(21, 128, 61);
          doc.setFont('helvetica', 'bold');
          doc.text(recLines, 18, lineY);
          lineY += recLines.length * 4.5;

          if (dtc.estimatedCostDZD || dtc.partReference) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            const metaParts: string[] = [];
            if (dtc.partReference) metaParts.push(`Ref. OEM : ${dtc.partReference}`);
            if (dtc.estimatedCostDZD) metaParts.push(`Cout estime : ${dtc.estimatedCostDZD.toLocaleString('fr-FR')} DZD`);
            if (dtc.laborHours) metaParts.push(`Main-d'oeuvre : ${dtc.laborHours}h`);
            doc.text(metaParts.join('   |   '), 18, lineY + 1);
          }

          y += boxHeight + 5;
        });
      }

      // Technician Notes
      if (scan.technicianNotes) {
        if (y > 255) {
          doc.addPage();
          y = 20;
        }
        const notesLines = doc.splitTextToSize(`Observations Atelier : ${scan.technicianNotes}`, pageWidth - 36);
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(14, y, pageWidth - 28, 10 + notesLines.length * 4.5, 2, 2, 'F');
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(notesLines, 18, y + 7);
      }

      // Footer
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 280, pageWidth - 14, 280);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('AutoPro Diagnostic & Flash Hub DZ · WhatsApp Support & Licences : +213 05 57 76 78 04', 14, 286);
      doc.text('Document genere automatiquement — Certifie ISO 14229 UDS', pageWidth - 14, 286, { align: 'right' });

      doc.save(`Rapport_AutoPro_${scan.id}.pdf`);
      showToast(`Rapport PDF professionnel généré : Rapport_AutoPro_${scan.id}.pdf`);
    } catch {
      showToast('Erreur lors de la génération du fichier PDF.');
    }
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

  // Filtered client activities
  const filteredActivities = activities.filter(act => {
    if (activityFilter !== 'all' && act.actionType !== activityFilter) return false;
    if (activitySearch.trim()) {
      const q = activitySearch.toLowerCase();
      const matchClient = act.clientName.toLowerCase().includes(q);
      const matchHwid = act.hwid.toLowerCase().includes(q);
      const matchDetails = act.actionDetails.toLowerCase().includes(q);
      const matchCity = (act.locationCity || '').toLowerCase().includes(q);
      const matchVehicle = (act.vehicleName || '').toLowerCase().includes(q);
      if (!matchClient && !matchHwid && !matchDetails && !matchCity && !matchVehicle) return false;
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
              onClick={handleDownloadFullBackup}
              disabled={isBackingUp}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 hover:text-white flex items-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
              title="Télécharger une sauvegarde complète permanente (Scans + Activités Clients + Base SaaS)"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isBackingUp ? 'Sauvegarde...' : 'Sauvegarde Intégrale'}</span>
            </button>

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
              title="Exporter les scans en JSON"
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

        {isCacheMode && (
          <div className="mt-3 p-3 rounded-xl bg-amber-950/50 border border-amber-500/60 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Mode Cache Hors-Ligne :</strong> Connexion serveur temporairement perdue. Affichage des dernières données de diagnostic consultées (synchronisées {formatCacheTimestampFr(cacheUpdatedAt)}).
              </span>
            </div>
            <button
              type="button"
              onClick={fetchScansAndStats}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer Sync</span>
            </button>
          </div>
        )}

        {error && !isCacheMode && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/50 border border-rose-700/60 text-xs text-rose-200 flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchScansAndStats}
              className="px-3 py-1 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-200 font-bold cursor-pointer"
            >
              Réessayer
            </button>
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

      {/* Sub-Tabs Switcher: Diagnostics vs Activité Clients & Licences */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 gap-1">
          <button
            onClick={() => setActiveSubTab('scans')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'scans'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historique Scans &amp; Santé ({scans.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('activity')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'activity'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Activité Clients &amp; Licences ({activities.length})</span>
          </button>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-700/50 text-[11px] font-semibold text-emerald-300 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Durée Illimitée · Sauvegarde Persistante SaaS Active</span>
        </div>
      </div>

      {activeSubTab === 'activity' ? (
        <div className="space-y-4">
          {/* Activity Filter Bar */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un client, HWID, wilaya (Oran, Alger, Mascara...), véhicule..."
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">Toutes les Actions ({activities.length})</option>
                <option value="activation">Activations Licence</option>
                <option value="scan_started">Scans Diagnostic</option>
                <option value="flash_executed">Flash ECU / Reprog</option>
                <option value="camera_view">Caméras &amp; ADAS</option>
                <option value="keyless_toggle">Clé 3m &amp; Antivol</option>
                <option value="heartbeat">Connexions Tablette</option>
              </select>

              <button
                onClick={fetchScansAndStats}
                className="px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-emerald-300 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Actualiser</span>
              </button>
            </div>
          </div>

          {/* Client Activity List */}
          <div className="space-y-2.5">
            {filteredActivities.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
                Aucune activité client trouvée pour ces filtres.
              </div>
            ) : (
              filteredActivities.map((act) => {
                const actionColor =
                  act.actionType === 'activation'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600/60'
                    : act.actionType === 'flash_executed'
                    ? 'bg-rose-950 text-rose-300 border-rose-600/60'
                    : act.actionType === 'camera_view'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-600/60'
                    : act.actionType === 'keyless_toggle'
                    ? 'bg-amber-950 text-amber-300 border-amber-600/60'
                    : 'bg-slate-800 text-slate-200 border-slate-600';

                const actionLabel: Record<ClientActivityRecord['actionType'], string> = {
                  activation: 'Activation Clé',
                  scan_started: 'Scan Diagnostic',
                  flash_executed: 'Flash ECU',
                  dtc_cleared: 'Effacement DTC',
                  keyless_toggle: 'Clé 3m / Antivol',
                  camera_view: 'Caméras & ADAS',
                  app_installed: 'App Tablette',
                  vault_download: 'Coffre Payant',
                  heartbeat: 'Session Active',
                };

                return (
                  <div
                    key={act.id}
                    className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${actionColor}`}>
                          {actionLabel[act.actionType] || act.actionType}
                        </span>
                        <span className="font-bold text-white text-sm">{act.clientName}</span>
                        {act.vehicleName && (
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 font-semibold text-[11px]">
                            {act.vehicleName}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300">{act.actionDetails}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span className="font-mono text-slate-300">HWID: {act.hwid}</span>
                        {act.locationCity && (
                          <span className="flex items-center gap-1 text-emerald-300">
                            <MapPin className="w-3 h-3" />
                            {act.locationCity}
                          </span>
                        )}
                        {act.ipAddress && (
                          <span className="flex items-center gap-1 font-mono">
                            <Globe className="w-3 h-3" />
                            {act.ipAddress}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <div className="font-mono text-xs text-cyan-300 font-semibold">
                        {new Date(act.timestamp).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        ·{' '}
                        {new Date(act.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {act.durationMinutes !== undefined && (
                        <div className="text-[10px] text-slate-400">
                          Durée session : {act.durationMinutes} min
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <>

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
                      onClick={() => handleGeneratePdfReport(scan)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                      title="Générer et télécharger un rapport PDF professionnel complet"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Générer rapport</span>
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
      </>
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
