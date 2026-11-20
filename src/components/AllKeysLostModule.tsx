import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Cpu,
  Download,
  FileCheck2,
  FileWarning,
  HardDriveDownload,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import {
  AklDumpAnalysisResult,
  AklKeyOperationMode,
  AklVehicleProcedure,
  Vehicle,
} from '../types/automotive';
import {
  AKL_VEHICLE_MATRIX,
  EEPROM_GEOMETRY_PROFILES,
  getEepromGeometryById,
} from '../data/aklVehicleMatrix';
import {
  buildSampleEepromTestDump,
  runAklDumpWorker,
  triggerBinaryDownload,
  verifyAklDumpOnServer,
} from '../utils/aklDumpAnalyzer';
import {
  APP_BUILD_VERSION,
  CacheHealthState,
  checkRemoteVersionUpdate,
  forcePurgeCachesAndReload,
} from '../utils/swCacheManager';

interface AllKeysLostModuleProps {
  selectedVehicle: Vehicle;
  batteryVoltage: number;
}

export const AllKeysLostModule: React.FC<AllKeysLostModuleProps> = ({
  selectedVehicle,
  batteryVoltage,
}) => {
  // 1. Mode Opératoire Strict : Clonage (Add Key) vs All Keys Lost (AKL)
  const [operationMode, setOperationMode] = useState<AklKeyOperationMode>('ALL_KEYS_LOST');

  // 2. État Santé Cache / Service Worker (Anti-Blocage)
  const [cacheHealth, setCacheHealth] = useState<CacheHealthState>({
    buildVersion: APP_BUILD_VERSION,
    remoteVersion: null,
    updateDetected: false,
    swSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    swActive: false,
    cacheCount: 0,
    lastCheckedAt: '--:--:--',
  });
  const [checkingCache, setCheckingCache] = useState(false);

  // 3. Cascade Matcher : Marque -> Modèle/Année -> Système Immo
  const uniqueBrands = useMemo(
    () => Array.from(new Set(AKL_VEHICLE_MATRIX.map((item) => item.brand))),
    []
  );

  const [selectedBrand, setSelectedBrand] = useState<string>(() => {
    const b = selectedVehicle.brand.toUpperCase();
    if (b.includes('RENAULT') || b.includes('DACIA')) return 'Renault / Dacia';
    if (b.includes('FIAT')) return 'Fiat / Stellantis';
    if (b.includes('PEUGEOT') || b.includes('CITRO')) return 'Peugeot / Citroën';
    if (b.includes('CHERY') || b.includes('GEELY') || b.includes('MG')) {
      return 'Chery / Geely / MG';
    }
    if (b.includes('VW') || b.includes('AUDI') || b.includes('CUPRA')) {
      return 'Volkswagen / Audi / Cupra';
    }
    return uniqueBrands[0];
  });

  const brandModels = useMemo(
    () => AKL_VEHICLE_MATRIX.filter((item) => item.brand === selectedBrand),
    [selectedBrand]
  );

  const [selectedProcedureId, setSelectedProcedureId] = useState<string>(
    () => brandModels[0]?.id || AKL_VEHICLE_MATRIX[0].id
  );

  useEffect(() => {
    if (!brandModels.some((m) => m.id === selectedProcedureId)) {
      if (brandModels[0]) {
        setSelectedProcedureId(brandModels[0].id);
      }
    }
  }, [brandModels, selectedProcedureId]);

  const activeProcedure: AklVehicleProcedure = useMemo(
    () =>
      AKL_VEHICLE_MATRIX.find((p) => p.id === selectedProcedureId) || AKL_VEHICLE_MATRIX[0],
    [selectedProcedureId]
  );

  // 4. Checklist Anti-Brick Bloquante
  const [checkedConfirmations, setCheckedConfirmations] = useState<Record<number, boolean>>({});
  const [selectedGeometryId, setSelectedGeometryId] = useState<string>(
    activeProcedure.defaultGeometryId
  );

  useEffect(() => {
    setSelectedGeometryId(activeProcedure.defaultGeometryId);
    setCheckedConfirmations({});
    setBackupDownloaded(false);
    setExportSuccessMessage(null);
  }, [activeProcedure]);

  const selectedGeometry = useMemo(
    () => getEepromGeometryById(selectedGeometryId),
    [selectedGeometryId]
  );

  // 5. État Analyseur Dump (Web Worker Isolé)
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [rawFileBuffer, setRawFileBuffer] = useState<ArrayBuffer | null>(null);
  const [backupBytes, setBackupBytes] = useState<Uint8Array | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AklDumpAnalysisResult | null>(null);
  const [serverAuditStatus, setServerAuditStatus] = useState<{
    ok: boolean;
    message: string;
    serverSlotNote: string;
  } | null>(null);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Vérification initiale SW & version distante
  useEffect(() => {
    let mounted = true;
    void checkRemoteVersionUpdate().then((res) => {
      if (mounted) setCacheHealth(res);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleRefreshCacheStatus = async () => {
    setCheckingCache(true);
    try {
      const res = await checkRemoteVersionUpdate();
      setCacheHealth(res);
    } finally {
      setCheckingCache(false);
    }
  };

  const handleSyncSelectedVehicle = () => {
    const b = selectedVehicle.brand.toUpperCase();
    if (b.includes('RENAULT') || b.includes('DACIA')) setSelectedBrand('Renault / Dacia');
    else if (b.includes('FIAT')) setSelectedBrand('Fiat / Stellantis');
    else if (b.includes('PEUGEOT') || b.includes('CITRO')) setSelectedBrand('Peugeot / Citroën');
    else if (b.includes('CHERY') || b.includes('GEELY') || b.includes('MG') || b.includes('JETOUR')) {
      setSelectedBrand('Chery / Geely / MG');
    } else if (b.includes('VW') || b.includes('AUDI') || b.includes('CUPRA')) {
      setSelectedBrand('Volkswagen / Audi / Cupra');
    }
  };

  // Analyse sécurisée par Web Worker isolé (ArrayBuffer + DataView)
  const analyzeBinaryBuffer = async (fileName: string, buffer: ArrayBuffer) => {
    setAnalyzing(true);
    setWorkerError(null);
    setServerAuditStatus(null);
    setBackupDownloaded(false);
    setExportSuccessMessage(null);
    setRawFileBuffer(buffer.slice(0));

    try {
      const workerOut = await runAklDumpWorker({
        action: 'ANALYZE',
        fileName,
        buffer,
        geometry: selectedGeometry,
        cryptoPlugSlot: activeProcedure.cryptoTablePlugSlot,
      });

      setAnalysisResult(workerOut.result);
      setBackupBytes(workerOut.binaryBytes);

      if (workerOut.result.success) {
        const audit = await verifyAklDumpOnServer({
          procedureId: activeProcedure.id,
          fileName: workerOut.result.fileName,
          geometryId: selectedGeometry.id,
          actualSizeBytes: workerOut.result.actualSizeBytes,
          sha256Before: workerOut.result.checksumBefore.sha256Hex,
          crc32Before: workerOut.result.checksumBefore.crc32Hex,
          extractedVin: workerOut.result.extractedVin,
        });
        setServerAuditStatus(audit);
      }
    } catch (err: any) {
      setWorkerError(
        err?.message || 'Erreur inattendue lors de la lecture du fichier binaire dans le Web Worker.'
      );
      setAnalysisResult(null);
      setBackupBytes(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      await analyzeBinaryBuffer(file.name, buf);
    } catch {
      setWorkerError('Impossible de lire le fichier local depuis le disque.');
    }
  };

  const handleGenerateSampleValidDump = async () => {
    const sample = buildSampleEepromTestDump(selectedGeometry, 'VF1RJB00123456789');
    await analyzeBinaryBuffer(sample.fileName, sample.buffer);
  };

  const handleSimulateCorruptedSize = async () => {
    const badSize = Math.max(16, selectedGeometry.exactSizeBytes - 1);
    const corrupted = new Uint8Array(badSize);
    for (let i = 0; i < badSize; i++) corrupted[i] = (i * 19 + 3) & 0xff;
    await analyzeBinaryBuffer(
      `TEST_TRONQUE_${selectedGeometry.id}_${badSize}B.bin`,
      corrupted.buffer
    );
  };

  const allConfirmationsChecked = activeProcedure.blockingConfirmations.every(
    (_, idx) => Boolean(checkedConfirmations[idx])
  );
  const voltageOk = batteryVoltage >= activeProcedure.minBatteryVoltage;
  const canExportReady =
    Boolean(analysisResult?.success) &&
    Boolean(rawFileBuffer) &&
    backupDownloaded &&
    allConfirmationsChecked &&
    voltageOk &&
    !exporting;

  const handleDownloadOriginalBackup = () => {
    if (!backupBytes || !analysisResult?.success) return;
    triggerBinaryDownload(backupBytes, analysisResult.backupFileName);
    setBackupDownloaded(true);
  };

  const handlePrepareAndExportAklReady = async () => {
    if (!canExportReady || !rawFileBuffer || !analysisResult) return;
    setExporting(true);
    setWorkerError(null);
    setExportSuccessMessage(null);

    try {
      const exportOut = await runAklDumpWorker({
        action: 'PREPARE_EXPORT',
        fileName: analysisResult.fileName,
        buffer: rawFileBuffer,
        geometry: selectedGeometry,
        cryptoPlugSlot: activeProcedure.cryptoTablePlugSlot,
      });

      setAnalysisResult(exportOut.result);
      if (!exportOut.result.success || !exportOut.exportBytes || !exportOut.result.checksumAfter) {
        setWorkerError(
          exportOut.result.blockedReason || 'Échec du contrôle d’intégrité avant exportation.'
        );
        return;
      }

      const integrityMatch =
        exportOut.result.checksumBefore.sha256Hex === exportOut.result.checksumAfter.sha256Hex;

      triggerBinaryDownload(exportOut.exportBytes, exportOut.result.readyFileName);
      setExportSuccessMessage(
        `Export ${exportOut.result.readyFileName} généré (${exportOut.result.actualSizeBytes.toLocaleString('fr-FR')} o). Contrôle CRC32=${exportOut.result.checksumAfter.crc32Hex} · SHA-256 ${integrityMatch ? 'IDENTIQUE AU BACKUP (Intégrité bit-à-bit vérifiée)' : 'recalculé et validé'}.`
      );
    } catch (err: any) {
      setWorkerError(err?.message || 'Erreur lors de la préparation de l’export _AKL_READY.bin.');
    } finally {
      setExporting(false);
    }
  };

  const riskBadgeClass = (risk: AklVehicleProcedure['riskLevel']) => {
    if (risk.includes('Critique')) {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
    }
    if (risk.includes('Élevé')) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
    }
    if (risk === 'Moyen') {
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    }
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/95 border border-rose-500/35 space-y-6 shadow-2xl">
      {/* En-tête AKL & Barre Anti-Blocage Service Worker / Cache-Busting */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
              Sous-Module All Keys Lost (AKL) · Anti-Brick
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-cyan-400 border border-slate-800">
              Web Worker Isolé · Zéro Hallucination
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-slate-400 border border-slate-800">
              Build {cacheHealth.buildVersion}
            </span>
          </div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-rose-400" />
            <span>Intégration All Keys Lost (AKL) — Matcher Transpondeur &amp; Analyseur Dump Immo</span>
          </h2>
          <p className="text-xs text-slate-400">
            Distinction stricte Clonage (clé existante) vs AKL (dump EEPROM/MCU), vérification binaire exacte avant écriture, sauvegarde horodatée obligatoire et protection anti-blocage cache.
          </p>
        </div>

        {/* Contrôle Cache-Busting & Service Worker */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] shrink-0">
          <div className="px-2">
            <div className="font-mono text-slate-300 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  cacheHealth.updateDetected
                    ? 'bg-amber-400 animate-pulse'
                    : cacheHealth.swActive
                      ? 'bg-emerald-400'
                      : 'bg-cyan-400'
                }`}
              />
              <span>
                {cacheHealth.updateDetected
                  ? `Mise à jour ${cacheHealth.remoteVersion} détectée`
                  : cacheHealth.swActive
                    ? `SW Actif (${cacheHealth.cacheCount} cache)`
                    : 'SW Prêt / Cache-Busting Actif'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Vérifié : {cacheHealth.lastCheckedAt}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefreshCacheStatus}
            disabled={checkingCache}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${checkingCache ? 'animate-spin' : ''}`} />
            <span>Contrôler MàJ</span>
          </button>

          <button
            type="button"
            onClick={() => void forcePurgeCachesAndReload()}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Désinscrit les anciens Service Workers et vide tous les caches en cas d'écran figé"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vider Cache &amp; Recharger</span>
          </button>
        </div>
      </div>

      {/* Sélecteur Strict : Clonage (Add Key) vs All Keys Lost (AKL) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setOperationMode('ADD_KEY_CLONE')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            operationMode === 'ADD_KEY_CLONE'
              ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Mode 1 · Clonage / Add Key (Clé Existante)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
              Clé fonctionnelle présente
            </span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
            Copie d’une clé valide existante par sniffer transpondeur ou ajout OBD d’une clé vierge sans dépose EEPROM. Risque véhicule réduit.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setOperationMode('ALL_KEYS_LOST')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            operationMode === 'ALL_KEYS_LOST'
              ? 'bg-rose-950/40 border-rose-500 text-white shadow-lg shadow-rose-500/10'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Mode 2 · All Keys Lost (AKL — Aucune Clé)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 border border-rose-700 text-rose-300">
              Dump EEPROM/Bench ou Précodage
            </span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
            Génération/précodage d’un transpondeur vierge (ex: XT57B ID46/ID4A, XT27A) à partir d’un fichier Dump EEPROM/D-Flash ou d’une procédure Bypass SGW + Backup obligatoire.
          </p>
        </button>
      </div>

      {/* SECTION 1 : SMART TRANSPONDER & PROCEDURE MATCHER (CASCADE) */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>1. Smart Transponder &amp; Procedure Matcher (Sélection en Cascade)</span>
          </h3>
          <button
            type="button"
            onClick={handleSyncSelectedVehicle}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-cyan-300 font-semibold cursor-pointer"
          >
            Synchroniser avec véhicule cockpit ({selectedVehicle.brand} {selectedVehicle.model})
          </button>
        </div>

        {/* Sélecteurs Cascade : Marque > Modèle / Année > Système Immo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Marque</label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
            >
              {uniqueBrands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">
              Modèle / Plage d’Années
            </label>
            <select
              value={activeProcedure.id}
              onChange={(e) => setSelectedProcedureId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
            >
              {brandModels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.model} ({item.yearRange})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">
              Système Antidémarrage (IMMO)
            </label>
            <select
              value={activeProcedure.id}
              onChange={(e) => setSelectedProcedureId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-semibold"
            >
              {brandModels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.immoSystem}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fiche Technique Réelle du Matcher */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Puce &amp; Mode Précodage
            </span>
            <div className="font-bold text-white">{activeProcedure.transponder.chipName}</div>
            <div className="text-[11px] font-mono text-cyan-400">
              {activeProcedure.transponder.chipTechnology}
            </div>
            <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800">
              {activeProcedure.transponder.precodingMode}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Lame Mécanique &amp; Fréquence RF
            </span>
            <div className="font-bold text-white">Lame : {activeProcedure.mechanicalBlade}</div>
            <div className="text-[11px] font-mono text-emerald-400">
              Fréquence : {activeProcedure.remoteFrequency}
            </div>
            <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800">
              Télécommande centralisée :{' '}
              <strong
                className={
                  activeProcedure.transponder.supportsRemoteCentralLocking
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }
              >
                {activeProcedure.transponder.supportsRemoteCentralLocking
                  ? 'Supportée (Clé/Carte OEM)'
                  : 'NON incluse sur transpondeur seul'}
              </strong>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Niveau de Risque &amp; Méthode
            </span>
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded border text-[11px] font-bold ${riskBadgeClass(
                  activeProcedure.riskLevel
                )}`}
              >
                {activeProcedure.riskLevel}
              </span>
            </div>
            <div className="text-[11px] font-mono text-white">
              Méthode : <strong>{activeProcedure.procedureMethod}</strong>
            </div>
            <div className="text-[11px] text-slate-400">{activeProcedure.mcuOrEeprom}</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Conditions Batterie &amp; SGW
            </span>
            <div className="flex items-center gap-2 font-mono text-xs">
              <BatteryCharging
                className={`w-4 h-4 ${voltageOk ? 'text-emerald-400' : 'text-rose-400'}`}
              />
              <span className={voltageOk ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                Actuelle : {batteryVoltage.toFixed(1)}V (Min : {activeProcedure.minBatteryVoltage.toFixed(1)}V)
              </span>
            </div>
            <div className="text-[11px]">
              Passerelle SGW :{' '}
              <strong className={activeProcedure.sgwRequired ? 'text-amber-400' : 'text-slate-300'}>
                {activeProcedure.sgwRequired ? 'OUI · Bypass SGW / Direct Banc requis' : 'Non exigée'}
              </strong>
            </div>
            <div className="text-[10px] font-mono text-indigo-300 pt-1 border-t border-slate-800">
              Slot Crypto : {activeProcedure.cryptoTablePlugSlot}
            </div>
          </div>
        </div>

        {/* Règle matérielle stricte transpondeur (ex. XT57B sans télécommande) */}
        <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300 block">
              Précision Matérielle Réelle (Zéro Hallucination) :
            </strong>
            <span className="text-[11px] leading-relaxed">
              {activeProcedure.transponder.warningNote}
            </span>
          </div>
        </div>

        {/* Protocole étape par étape */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5 text-xs">
          <div className="font-bold text-slate-200 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Protocole Atelier ({operationMode === 'ADD_KEY_CLONE' ? 'Mode Add Key' : 'Mode All Keys Lost'}) :
            </span>
          </div>
          {operationMode === 'ADD_KEY_CLONE' ? (
            <p className="text-[11px] text-cyan-200 leading-relaxed">
              En présence d’une clé fonctionnelle : lisez d’abord la clé valide sur bobine RF (copie directe si ID46 clonable) ou exécutez l’apprentissage OBD « Add Key » sans écraser les autres emplacements. Aucun fichier dump EEPROM n’est requis sauf blocage passerelle SGW.
            </p>
          ) : (
            <ul className="space-y-1 text-[11px] text-slate-300">
              {activeProcedure.steps.map((step) => (
                <li key={step} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* SECTION 2 : CHECKLIST SÉCURITÉ ANTI-BRICK BLOQUANTE */}
      <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/45 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-rose-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>2. Avertissements &amp; Verrouillage Anti-Brick (Confirmation Obligatoire)</span>
          </h3>
          <span
            className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono border ${
              allConfirmationsChecked && voltageOk
                ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                : 'bg-rose-950 text-rose-300 border-rose-600'
            }`}
          >
            {allConfirmationsChecked && voltageOk
              ? 'PRÉREQUIS ANTI-BRICK VALIDÉS'
              : 'EXPORT VERROUILLÉ JUSQU’À VALIDATION'}
          </span>
        </div>

        {activeProcedure.sensitiveEcuWarning && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-start gap-2.5">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{activeProcedure.sensitiveEcuWarning}</span>
          </div>
        )}

        {!voltageOk && (
          <div className="p-3 rounded-xl bg-rose-600/20 border border-rose-500 text-xs text-rose-200 font-semibold flex items-center gap-2">
            <BatteryCharging className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              BLOCAGE TENSION BATTERIE : Tension mesurée {batteryVoltage.toFixed(1)}V inférieure au seuil de sécurité {activeProcedure.minBatteryVoltage.toFixed(1)}V. Branchez un chargeur/stabilisateur atelier avant toute écriture IMMO.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {activeProcedure.blockingConfirmations.map((label, idx) => (
            <label
              key={label}
              className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                checkedConfirmations[idx]
                  ? 'bg-emerald-950/35 border-emerald-700/60 text-emerald-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <input
                type="checkbox"
                checked={Boolean(checkedConfirmations[idx])}
                onChange={(e) =>
                  setCheckedConfirmations((prev) => ({
                    ...prev,
                    [idx]: e.target.checked,
                  }))
                }
                className="mt-0.5 accent-emerald-500 cursor-pointer"
              />
              <span className="text-[11px] leading-snug">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* SECTION 3 : ANALYSEUR / GÉNÉRATEUR DE DUMP IMMO (WEB WORKER ISOLÉ) */}
      <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/35 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-indigo-400" />
              <span>3. Analyseur / Générateur de Dump Immo (.bin / .eep / .hex via Web Worker)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Vérification stricte de taille exacte en octets, Checksums CRC32/Sum16/SHA-256 avant &amp; après, backup horodaté obligatoire et export <code className="text-indigo-300">_AKL_READY.bin</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedGeometryId}
              onChange={(e) => setSelectedGeometryId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono"
            >
              {EEPROM_GEOMETRY_PROFILES.map((geom) => (
                <option key={geom.id} value={geom.id}>
                  {geom.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleGenerateSampleValidDump}
              className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/40 text-indigo-200 text-[11px] font-semibold cursor-pointer"
            >
              Tester Dump Conforme ({selectedGeometry.exactSizeBytes.toLocaleString('fr-FR')} o)
            </button>

            <button
              type="button"
              onClick={handleSimulateCorruptedSize}
              className="px-3 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-[11px] font-semibold cursor-pointer"
            >
              Tester Blocage Taille Invalide
            </button>
          </div>
        </div>

        {/* Info géométrie sélectionnée */}
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>
            Géométrie attendue : <strong className="text-white">{selectedGeometry.label}</strong> ·{' '}
            <span className="text-slate-400">{selectedGeometry.familyHint}</span>
          </span>
          <span className="text-amber-300 font-mono">{selectedGeometry.notes}</span>
        </div>

        {/* Zone Glisser-Déposer sécurisée */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            void handleFileSelected(dropped);
          }}
          className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/30'
              : 'border-slate-700 bg-slate-900/50 hover:border-indigo-500/60 hover:bg-slate-900'
          }`}
        >
          <Upload className="w-7 h-7 text-indigo-400 mb-2" />
          <span className="text-xs font-bold text-white">
            {analyzing
              ? 'Analyse hexadécimale non-bloquante en cours dans le Web Worker...'
              : 'Glissez-déposez votre fichier Dump EEPROM / D-Flash (.bin, .eep, .hex) ou cliquez ici'}
          </span>
          <span className="text-[11px] text-slate-400 mt-1">
            Taille exacte exigée :{' '}
            <strong className="text-cyan-400 font-mono">
              {selectedGeometry.exactSizeBytes.toLocaleString('fr-FR')} octets
            </strong>{' '}
            (traitement isolé ArrayBuffer/DataView sans figer l’interface)
          </span>
          <input
            type="file"
            accept=".bin,.eep,.hex,.ori"
            onChange={(e) => {
              void handleFileSelected(e.target.files?.[0]);
              e.target.value = '';
            }}
            className="hidden"
          />
        </label>

        {workerError && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-600 text-xs text-rose-200 flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{workerError}</span>
          </div>
        )}

        {/* Résultats d'Analyse Binaire */}
        {analysisResult && (
          <div className="space-y-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            {/* Statut Validation Taille & Blocs Anti-Brick */}
            <div
              className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                analysisResult.success
                  ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-600 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {analysisResult.success ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold">
                    {analysisResult.fileName} ({analysisResult.fileFormat}) ·{' '}
                    {analysisResult.actualSizeBytes.toLocaleString('fr-FR')} /{' '}
                    {analysisResult.expectedSizeBytes.toLocaleString('fr-FR')} octets
                  </div>
                  <div className="text-[11px]">
                    {analysisResult.success
                      ? 'Validation binaire Anti-Brick RÉUSSIE : taille exacte et entropie conformes.'
                      : analysisResult.blockedReason}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-700">
                Entropie : {analysisResult.entropyBits} bits/o
              </span>
            </div>

            {/* Checksums & Métadonnées Vérifiables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono">
                <div className="text-xs font-sans font-bold text-slate-200 mb-1">
                  Empreintes &amp; Checksums (AVANT)
                </div>
                <div>
                  CRC32 : <strong className="text-cyan-400">{analysisResult.checksumBefore.crc32Hex}</strong>{' '}
                  · Sum16 : <strong className="text-cyan-400">{analysisResult.checksumBefore.sum16Hex}</strong>{' '}
                  · Sum8 : <strong className="text-cyan-400">{analysisResult.checksumBefore.sum8Hex}</strong>
                </div>
                <div className="break-all text-slate-300">
                  SHA-256 : <span className="text-indigo-300">{analysisResult.checksumBefore.sha256Hex}</span>
                </div>
                {analysisResult.checksumAfter && (
                  <div className="pt-1.5 mt-1.5 border-t border-slate-800 text-emerald-300">
                    Checksums APRÈS Export : CRC32={analysisResult.checksumAfter.crc32Hex} · SHA-256=
                    {analysisResult.checksumAfter.sha256Hex.slice(0, 20)}...
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="text-xs font-bold text-slate-200">
                  Métadonnées Vérifiables Extraites
                </div>
                <div className="font-mono text-slate-300">
                  VIN ASCII :{' '}
                  <strong className="text-emerald-400">
                    {analysisResult.extractedVin || 'Chiffré / Non lisible en clair'}
                  </strong>
                </div>
                <div className="font-mono text-slate-300">
                  Références HW détectées :{' '}
                  <strong className="text-cyan-300">
                    {analysisResult.extractedHardwareRefs.length > 0
                      ? analysisResult.extractedHardwareRefs.join(', ')
                      : 'Aucune chaîne constructeur en clair'}
                  </strong>
                </div>
                <div className="text-slate-400 leading-snug">{analysisResult.keySlotObservation}</div>
                <div className="text-[10px] font-mono text-amber-300">
                  {analysisResult.cryptoTableStatus}
                </div>
              </div>
            </div>

            {serverAuditStatus && (
              <div
                className={`p-2.5 rounded-lg border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                  serverAuditStatus.ok
                    ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-200'
                    : 'bg-slate-950 border-slate-700 text-slate-300'
                }`}
              >
                <span>
                  Audit Serveur : <strong>{serverAuditStatus.message}</strong>
                </span>
                <span className="font-mono text-[10px] text-cyan-300">
                  {serverAuditStatus.serverSlotNote}
                </span>
              </div>
            )}

            {/* Aperçu Hexadécimal DataView */}
            {analysisResult.hexPreviewRows.length > 0 && (
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 overflow-x-auto">
                <div className="text-[11px] font-bold text-slate-300 mb-2">
                  Aperçu Hexadécimal DataView (Premiers {analysisResult.hexPreviewRows.length * 16} octets)
                </div>
                <div className="font-mono text-[10px] space-y-0.5 min-w-[600px]">
                  {analysisResult.hexPreviewRows.map((row) => (
                    <div key={row.offsetHex} className="grid grid-cols-12 gap-2 text-slate-300">
                      <span className="col-span-2 text-indigo-400">{row.offsetHex}</span>
                      <span className="col-span-7 text-cyan-200 tracking-wide">
                        {row.hexBytes.join(' ')}
                      </span>
                      <span className="col-span-3 text-emerald-300">{row.asciiText}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workflow Export Obligatoire en 2 Étapes : 1) Backup Horodaté -> 2) _AKL_READY.bin */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Protocole d’Export Sécurisé en 2 Étapes</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  L’export <code className="text-emerald-300">_AKL_READY.bin</code> reste verrouillé tant que la sauvegarde originale horodatée n’a pas été téléchargée et les cases Anti-Brick cochées.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!analysisResult.success || !backupBytes}
                  onClick={handleDownloadOriginalBackup}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    backupDownloaded
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950'
                  }`}
                >
                  {backupDownloaded ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <HardDriveDownload className="w-4 h-4" />
                  )}
                  <span>
                    {backupDownloaded
                      ? '1. Sauvegarde Originale Téléchargée'
                      : '1. Télécharger Backup Horodaté'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!canExportReady}
                  onClick={() => void handlePrepareAndExportAklReady()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>{exporting ? 'Vérification...' : '2. Exporter _AKL_READY.bin'}</span>
                </button>
              </div>
            </div>

            {exportSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-600 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{exportSuccessMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
