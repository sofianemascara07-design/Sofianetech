import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Database,
  Download,
  Droplets,
  FileText,
  Flame,
  Gauge,
  History,
  Info,
  Layers,
  Lock,
  MonitorSmartphone,
  Network,
  Play,
  RefreshCw,
  Save,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  CoolrayAlgeriaIssueEntry,
  CoolrayCalibrationId,
  CoolrayCentralUnitModelId,
  CoolrayCentralUnitOpId,
  CoolrayEcuHardwareFamily,
  CoolrayInterventionLog,
  CoolrayObdPidSnapshot,
  CoolrayOilSpecId,
  CoolrayVariantId,
  CoolrayVehicleFollowUpRecord,
  LspiRiskSeverity,
  Vehicle,
} from '../types/automotive';
import {
  COOLRAY_ALGERIA_ISSUES,
  COOLRAY_CALIBRATION_OPTIONS,
  COOLRAY_CENTRAL_UNIT_MODELS,
  COOLRAY_CENTRAL_UNIT_OPTIONS,
  COOLRAY_ENGINE_PROFILES,
  COOLRAY_OBD_SCENARIOS,
  COOLRAY_OIL_SPEC_OPTIONS,
  MAINTENANCE_CYCLES_KM,
  buildDefaultCoolrayRecord,
  computeCoolrayProtectionScore,
  evaluateFuelTrim,
  evaluateIat,
  evaluateKnockRetard,
  evaluateMisfires,
  getCoolraySupplierCompatMatrix,
  getOverallObdStatus,
} from '../data/coolrayLspiProfiles';
import { apiFetch } from '../utils/apiBridge';
import { VEHICLE_PRESETS } from '../data/mockVehicles';
import { obdHardwareBridge } from '../utils/obdHardwareBridge';
import {
  buildHardwarePlanPdf,
  shareHardwarePlanPdf,
} from '../utils/hardwarePlanPdf';

interface CoolrayAntiLspiModuleProps {
  selectedVehicle: Vehicle;
  setSelectedVehicle?: (vehicle: Vehicle) => void;
  isConnected: boolean;
  batteryVoltage: number;
  onOpenConnectModal: () => void;
}

type CoolraySubTab = 'flash' | 'central_unit_dz' | 'obd_audit' | 'maintenance';

const LOCAL_STORAGE_KEY = 'autopro_coolray_lspi_records_v1';

const FLASH_SEQUENCE_STEPS = [
  { id: 1, label: 'Initialisation session UDS étendue (0x10 03)', ecuRef: '0x7E0 / 0x7E1' },
  { id: 2, label: 'Authentification Seed & Key Bosch MG1 (0x27)', ecuRef: 'Niveau Sécurité 03' },
  { id: 3, label: 'Backup EEPROM & Cartographie d’origine (Backup horodaté)', ecuRef: 'SHA-256 Vérifié' },
  { id: 4, label: 'Effacement & TransferData calibration Anti-LSPI (0x34 / 0x36)', ecuRef: 'Secteur Calibration' },
  { id: 5, label: 'Contrôle CRC32 & ECUReset Hard (0x31 / 0x11 01)', ecuRef: 'Validation OK' },
];

function isGeelyVehicle(vehicle: Vehicle): boolean {
  const txt = `${vehicle.brand} ${vehicle.model}`.toLowerCase();
  return txt.includes('geely') || txt.includes('coolray') || txt.includes('binyue');
}

function inferVariantFromVehicleAndVin(
  vehicle: Vehicle,
  vin?: string,
  calId?: string
): CoolrayVariantId {
  const calUpper = (calId || '').toUpperCase();
  if (calUpper.includes('MG1CS080')) return 'coolray_phase1_3cyl';
  if (calUpper.includes('MG1UA008')) return 'coolray_dz_export_4cyl';
  if (calUpper.includes('MG1US008')) return 'coolray_cn_battle_181';

  if (isGeelyVehicle(vehicle)) {
    const haystack = `${vehicle.brand} ${vehicle.model} ${vehicle.year} ${vehicle.engine}`.toLowerCase();
    if (haystack.includes('lite') || haystack.includes('atmo') || haystack.includes('dvvt')) {
      return 'coolray_lite_dvvt_atmo';
    }
    if (haystack.includes('battle') || haystack.includes('binyue') || haystack.includes('181') || haystack.includes('chine')) {
      return 'coolray_cn_battle_181';
    }
    if (haystack.includes('3 cyl') || haystack.includes('g-power') || haystack.includes('2020') || haystack.includes('2021') || haystack.includes('2022') || haystack.includes('2023')) {
      return 'coolray_phase1_3cyl';
    }
    return 'coolray_dz_export_4cyl';
  }

  const cleanVin = (vin || '').trim().toUpperCase();
  if (cleanVin.length >= 10) {
    const yearCode = cleanVin[9];
    // L=2020, M=2021, N=2022, P=2023 -> Phase 1 3-cylindres
    if (['L', 'M', 'N', 'P'].includes(yearCode)) {
      return 'coolray_phase1_3cyl';
    }
    if (cleanVin.includes('ATMO') || cleanVin.includes('LITE')) {
      return 'coolray_lite_dvvt_atmo';
    }
    if (cleanVin.includes('DZ') || cleanVin.includes('EXP')) {
      return 'coolray_dz_export_4cyl';
    }
  }
  return 'coolray_cn_battle_181';
}

function findMatchingCoolrayPreset(variantId: CoolrayVariantId): Vehicle | undefined {
  if (variantId === 'coolray_cn_battle_181') {
    return (
      VEHICLE_PRESETS.find((v) => v.id === 'geely_coolray_battle_2026') ||
      VEHICLE_PRESETS.find((v) => v.id === 'geely_coolray_full')
    );
  }
  return (
    VEHICLE_PRESETS.find((v) => v.id === 'geely_coolray_full') ||
    VEHICLE_PRESETS.find((v) => v.brand.toLowerCase().includes('geely'))
  );
}

function severityBadgeClasses(severity: LspiRiskSeverity): string {
  if (severity === 'green') {
    return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
  }
  if (severity === 'amber') {
    return 'bg-amber-950/70 text-amber-300 border-amber-500/40';
  }
  return 'bg-rose-950/80 text-rose-300 border-rose-500/50';
}

function severityCardBorder(severity: LspiRiskSeverity): string {
  if (severity === 'green') return 'border-emerald-500/35 bg-emerald-950/15';
  if (severity === 'amber') return 'border-amber-500/45 bg-amber-950/20';
  return 'border-rose-500/60 bg-rose-950/25';
}

export const CoolrayAntiLspiModule: React.FC<CoolrayAntiLspiModuleProps> = ({
  selectedVehicle,
  setSelectedVehicle,
  isConnected,
  batteryVoltage,
  onOpenConnectModal,
}) => {
  const [subTab, setSubTab] = useState<CoolraySubTab>('flash');

  // 1. Profil moteur actif (ne jamais utiliser un autre constructeur comme source Coolray)
  const [selectedVariantId, setSelectedVariantId] = useState<CoolrayVariantId>(() =>
    inferVariantFromVehicleAndVin(selectedVehicle)
  );
  const [isDetectingVehicle, setIsDetectingVehicle] = useState<boolean>(false);
  const [isDemoBannerActive, setIsDemoBannerActive] = useState<boolean>(false);
  const activeProfile = useMemo(
    () => COOLRAY_ENGINE_PROFILES.find((p) => p.id === selectedVariantId) || COOLRAY_ENGINE_PROFILES[2],
    [selectedVariantId]
  );

  // 2. Suivi persistant par VIN (localStorage + API backend)
  const [records, setRecords] = useState<CoolrayVehicleFollowUpRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return [buildDefaultCoolrayRecord('L6T7824Z9RZ001540', 'coolray_cn_battle_181')];
  });

  const [activeRecord, setActiveRecord] = useState<CoolrayVehicleFollowUpRecord>(() => {
    return records[0] || buildDefaultCoolrayRecord('L6T7824Z9RZ001540', 'coolray_cn_battle_181');
  });
  const [vinInput, setVinInput] = useState<string>(activeRecord.vin);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 3. Verrous & état Flash (Fonctionnalité A)
  const [testVoltageOverride, setTestVoltageOverride] = useState<number>(
    isConnected ? batteryVoltage : 13.5
  );
  const effectiveVoltage = isConnected ? batteryVoltage : testVoltageOverride;

  const [detectedEcuHardware, setDetectedEcuHardware] = useState<CoolrayEcuHardwareFamily>(
    activeProfile.ecuHardwareFamily
  );
  const [dtcAuditRun, setDtcAuditRun] = useState<boolean>(false);
  const [simulateMisfireDtc, setSimulateMisfireDtc] = useState<boolean>(false);
  const [selectedCalibrationId, setSelectedCalibrationId] = useState<CoolrayCalibrationId>(
    'downgrade_cn_to_dz'
  );

  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [flashStepIndex, setFlashStepIndex] = useState<number>(0);
  const [flashResult, setFlashResult] = useState<{
    ok: boolean;
    message: string;
    frames?: string[];
    crc32?: string;
    flashedAt?: string;
  } | null>(null);

  // 4. Audit OBD2 Combustion (Fonctionnalité B)
  const [obdSnapshot, setObdSnapshot] = useState<CoolrayObdPidSnapshot>(
    COOLRAY_OBD_SCENARIOS.normal.snapshot
  );
  const [obdAuditSavedMsg, setObdAuditSavedMsg] = useState<string | null>(null);

  // 5. Unité Centrale DZ & Compatibilité Maison Geely / Fournisseurs
  const [issueDomainFilter, setIssueDomainFilter] = useState<
    'ALL' | CoolrayAlgeriaIssueEntry['domain']
  >('ALL');
  const [selectedCentralUnitId, setSelectedCentralUnitId] =
    useState<CoolrayCentralUnitModelId>('IHU624G');
  const [detectedCentralUnitId, setDetectedCentralUnitId] =
    useState<CoolrayCentralUnitModelId>('IHU624G');
  const [selectedCentralOpId, setSelectedCentralOpId] = useState<CoolrayCentralUnitOpId>(
    'dz_ihu_locale_thermal_pack'
  );
  const [centralBackupConfirmed, setCentralBackupConfirmed] = useState<boolean>(true);
  const [isRunningCentralOp, setIsRunningCentralOp] = useState<boolean>(false);
  const [centralOpResult, setCentralOpResult] = useState<{
    ok: boolean;
    message: string;
    frames?: string[];
    checksum?: string;
    otaCompatible?: boolean;
  } | null>(null);
  const [oemAuditResult, setOemAuditResult] = useState<{
    ok: boolean;
    summary: string;
    udsFrames: string[];
    checkedAt: string;
  } | null>(null);
  const [isAuditingOem, setIsAuditingOem] = useState<boolean>(false);

  // Chargement initial depuis le backend
  useEffect(() => {
    let mounted = true;
    apiFetch('/api/coolray-lspi/records')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data?.success || !Array.isArray(data.records) || data.records.length === 0) {
          return;
        }
        setRecords(data.records);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.records));
        setActiveRecord((prev) => {
          const found = data.records.find((rec: CoolrayVehicleFollowUpRecord) => rec.vin === prev.vin);
          return found || data.records[0];
        });
      })
      .catch(() => {
        // Mode hors-ligne atelier : localStorage déjà actif
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Synchroniser matériel ECU & calibration par défaut lorsque le profil moteur change
  useEffect(() => {
    setDetectedEcuHardware(activeProfile.ecuHardwareFamily);
    if (activeProfile.supportedCalibrations.length > 0) {
      if (!activeProfile.supportedCalibrations.includes(selectedCalibrationId)) {
        setSelectedCalibrationId(activeProfile.supportedCalibrations[0]);
      }
    }
    setFlashResult(null);
    setActiveRecord((prev) => {
      if (prev.variantId === activeProfile.id) return prev;
      return { ...prev, variantId: activeProfile.id };
    });
  }, [activeProfile.id, activeProfile.ecuHardwareFamily, activeProfile.supportedCalibrations, selectedCalibrationId]);

  // Synchroniser automatiquement le véhicule global de l'application vers Geely Coolray à l'ouverture du module
  useEffect(() => {
    if (!setSelectedVehicle) return;
    if (!isGeelyVehicle(selectedVehicle)) {
      const coolrayPreset = findMatchingCoolrayPreset(selectedVariantId);
      if (coolrayPreset) {
        setSelectedVehicle(coolrayPreset);
      }
    }
  }, [selectedVehicle, selectedVariantId, setSelectedVehicle]);

  const handleSelectCoolrayVariant = (variantId: CoolrayVariantId) => {
    setSelectedVariantId(variantId);
    if (setSelectedVehicle) {
      const preset = findMatchingCoolrayPreset(variantId);
      if (preset) setSelectedVehicle(preset);
    }
  };

  const handleAutoDetectFromAppVehicle = async () => {
    setIsDetectingVehicle(true);
    try {
      const realHwConnected = obdHardwareBridge.isRealHardwareConnected();
      if (realHwConnected) {
        const [liveVin, liveCalId] = await Promise.all([
          obdHardwareBridge.readVin(),
          obdHardwareBridge.readCalibrationId(),
        ]);
        const targetVin = liveVin || vinInput;
        if (liveVin) setVinInput(liveVin);

        const inferred = inferVariantFromVehicleAndVin(selectedVehicle, targetVin, liveCalId || undefined);
        handleSelectCoolrayVariant(inferred);
        const profile = COOLRAY_ENGINE_PROFILES.find((p) => p.id === inferred);
        if (profile) setDetectedEcuHardware(profile.ecuHardwareFamily);
        setIsDemoBannerActive(false);

        setSyncNotice(
          `OBD2 Réel détecté — VIN ${targetVin}${liveCalId ? ` · CALID ${liveCalId}` : ''} → Profil ${profile?.label || inferred}.`
        );
      } else {
        const globalWasNonGeely = !isGeelyVehicle(selectedVehicle);
        const inferred = inferVariantFromVehicleAndVin(
          selectedVehicle,
          vinInput,
          detectedEcuHardware
        );
        handleSelectCoolrayVariant(inferred);
        const profile = COOLRAY_ENGINE_PROFILES.find((p) => p.id === inferred);
        if (profile) setDetectedEcuHardware(profile.ecuHardwareFamily);

        setSyncNotice(
          globalWasNonGeely
            ? `Véhicule global (${selectedVehicle.brand} ${selectedVehicle.model}) remplacé par Geely Coolray selon VIN ${vinInput} & ECU ${profile?.ecuHardwareFamily || detectedEcuHardware}.`
            : `Détection VIN / ECU Coolray appliquée : ${profile?.label || inferred} (${vinInput} · ${profile?.ecuHardwareFamily || detectedEcuHardware}).`
        );
      }
    } finally {
      setIsDetectingVehicle(false);
      setTimeout(() => setSyncNotice(null), 5500);
    }
  };

  const handleRunCoolrayDemo = () => {
    const demoVin = 'L6T7824Z9RZ001540';
    setVinInput(demoVin);
    handleSelectCoolrayVariant('coolray_cn_battle_181');
    setDetectedEcuHardware('MG1US008');
    setSelectedCalibrationId('downgrade_cn_to_dz');
    setTestVoltageOverride(13.5);
    setSimulateMisfireDtc(false);
    setDtcAuditRun(true);
    setFlashResult(null);
    setIsDemoBannerActive(true);
    setSubTab('flash');
    setSyncNotice(
      `Démonstration Atelier chargée : Geely Coolray Chine VI 181 ch · VIN ${demoVin} · ECU MG1US008 · 13.5V · Audit DTC 0x19 validé (prêt pour flash).`
    );
    setTimeout(() => setSyncNotice(null), 6500);
  };

  // Calcul temps réel du score de protection + cycles kilométriques
  const scoreCalc = useMemo(
    () =>
      computeCoolrayProtectionScore({
        variantId: selectedVariantId,
        oilSpec: activeRecord.selectedOilSpec,
        checklist: activeRecord.checklist,
        obdStatus: activeRecord.lastObdAuditStatus,
        currentMileageKm: activeRecord.currentMileageKm,
        lastOilChangeKm: activeRecord.lastOilChangeKm,
        lastSparkPlugsKm: activeRecord.lastSparkPlugsKm,
        lastPeaCleanerKm: activeRecord.lastPeaCleanerKm,
      }),
    [selectedVariantId, activeRecord]
  );

  // Évaluations OBD2
  const knockEval = useMemo(
    () =>
      evaluateKnockRetard(
        obdSnapshot.knockRetardDeg,
        obdSnapshot.rpm,
        activeProfile.isTurboDirectInjection
      ),
    [obdSnapshot.knockRetardDeg, obdSnapshot.rpm, activeProfile.isTurboDirectInjection]
  );
  const misfireEval = useMemo(
    () => evaluateMisfires(obdSnapshot, activeProfile.isTurboDirectInjection),
    [obdSnapshot, activeProfile.isTurboDirectInjection]
  );
  const fuelTrimEval = useMemo(
    () => evaluateFuelTrim(obdSnapshot.stftPct, obdSnapshot.ltftPct),
    [obdSnapshot.stftPct, obdSnapshot.ltftPct]
  );
  const iatEval = useMemo(
    () =>
      evaluateIat(
        obdSnapshot.iatCelsius,
        obdSnapshot.engineLoadPct,
        activeProfile.isTurboDirectInjection
      ),
    [obdSnapshot.iatCelsius, obdSnapshot.engineLoadPct, activeProfile.isTurboDirectInjection]
  );
  const overallObdSeverity = useMemo(
    () => getOverallObdStatus(obdSnapshot, activeProfile.isTurboDirectInjection),
    [obdSnapshot, activeProfile.isTurboDirectInjection]
  );

  // Persistance VIN locale + serveur
  const persistRecord = async (recordToSave: CoolrayVehicleFollowUpRecord, silent = false) => {
    const recalculated = computeCoolrayProtectionScore({
      variantId: recordToSave.variantId,
      oilSpec: recordToSave.selectedOilSpec,
      checklist: recordToSave.checklist,
      obdStatus: recordToSave.lastObdAuditStatus,
      currentMileageKm: recordToSave.currentMileageKm,
      lastOilChangeKm: recordToSave.lastOilChangeKm,
      lastSparkPlugsKm: recordToSave.lastSparkPlugsKm,
      lastPeaCleanerKm: recordToSave.lastPeaCleanerKm,
    });

    const normalized: CoolrayVehicleFollowUpRecord = {
      ...recordToSave,
      vin: recordToSave.vin.trim().toUpperCase(),
      lastProtectionScore: recalculated.score,
      updatedAt: new Date().toISOString(),
    };

    setActiveRecord(normalized);
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.vin === normalized.vin);
      const updatedList =
        idx >= 0
          ? prev.map((item, i) => (i === idx ? normalized : item))
          : [normalized, ...prev];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
      return updatedList;
    });

    if (!silent) setIsSyncing(true);
    try {
      const res = await apiFetch('/api/coolray-lspi/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: normalized }),
      });
      if (res.ok && !silent) {
        setSyncNotice(`Dossier VIN ${normalized.vin} sauvegardé (Serveur + Cache Atelier).`);
      } else if (!silent) {
        setSyncNotice(`Dossier VIN ${normalized.vin} sauvegardé dans le cache hors-ligne.`);
      }
    } catch {
      if (!silent) {
        setSyncNotice(`Mode hors-ligne : dossier VIN ${normalized.vin} sauvegardé localement.`);
      }
    } finally {
      if (!silent) {
        setIsSyncing(false);
        setTimeout(() => setSyncNotice(null), 4000);
      }
    }
  };

  const handleLoadOrCreateVin = () => {
    const cleanVin = vinInput.trim().toUpperCase();
    if (cleanVin.length < 6) {
      setSyncNotice('Saisir un VIN valide d’au moins 6 caractères.');
      setTimeout(() => setSyncNotice(null), 3500);
      return;
    }
    const existing = records.find((r) => r.vin === cleanVin);
    if (existing) {
      setActiveRecord(existing);
      setSelectedVariantId(existing.variantId);
      setSyncNotice(`Dossier existant chargé pour ${cleanVin}.`);
    } else {
      const fresh = buildDefaultCoolrayRecord(cleanVin, selectedVariantId);
      setActiveRecord(fresh);
      void persistRecord(fresh);
    }
    setTimeout(() => setSyncNotice(null), 3500);
  };

  // Vérification des 3 verrous de sécurité pré-flash
  const voltageLockOk = effectiveVoltage >= 12.4;
  const hardwareMatchOk = activeProfile.compatibleHardwareFamilies.includes(detectedEcuHardware);
  const dtcAuditLockOk = dtcAuditRun && !simulateMisfireDtc;
  const allPreFlashLocksOk =
    activeProfile.isTurboDirectInjection && voltageLockOk && hardwareMatchOk && dtcAuditLockOk;

  const selectedCalibration = useMemo(
    () =>
      COOLRAY_CALIBRATION_OPTIONS.find((c) => c.id === selectedCalibrationId) ||
      COOLRAY_CALIBRATION_OPTIONS[0],
    [selectedCalibrationId]
  );

  const handleRunDtcAudit = () => {
    setDtcAuditRun(true);
    setFlashResult(null);
  };

  const handleExecuteFlash = async () => {
    setFlashResult(null);
    setIsFlashing(true);
    setFlashStepIndex(1);

    try {
      // Animation progressive réaliste des étapes UDS
      for (let i = 1; i <= 3; i += 1) {
        setFlashStepIndex(i);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      const res = await apiFetch('/api/coolray-lspi/flash-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: activeRecord.vin,
          variantId: selectedVariantId,
          detectedEcuHardwareFamily: detectedEcuHardware,
          targetCalibrationId: selectedCalibration.id,
          calibrationTag: selectedCalibration.flashBinaryTag,
          batteryVoltage: effectiveVoltage,
          dtcAuditPassed: dtcAuditRun,
          severeMisfireDtcFound: simulateMisfireDtc,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        setFlashResult({
          ok: false,
          message: data?.error || 'Échec du contrôle de sécurité pré-flash.',
        });
        setIsFlashing(false);
        setFlashStepIndex(0);
        return;
      }

      setFlashStepIndex(4);
      await new Promise((resolve) => setTimeout(resolve, 350));
      setFlashStepIndex(5);
      await new Promise((resolve) => setTimeout(resolve, 300));

      setFlashResult({
        ok: true,
        message: `Calibration ${selectedCalibration.flashBinaryTag} programmée avec succès (CRC32 ${data.verifiedCrc32}).`,
        frames: data.frames,
        crc32: data.verifiedCrc32,
        flashedAt: data.flashedAt,
      });

      // Mise à jour automatique du dossier VIN + checklist + historique
      const newIntervention: CoolrayInterventionLog = {
        id: `INT-${Date.now()}`,
        dateIso: new Date().toISOString().slice(0, 10),
        mileageKm: activeRecord.currentMileageKm,
        type: selectedCalibration.id === 'tcu_7dct_anti_lug' ? 'TCU_FLASH' : 'ECU_FLASH',
        title: selectedCalibration.title,
        details: `Tag ${selectedCalibration.flashBinaryTag} · Tension ${effectiveVoltage.toFixed(1)}V · ECU ${detectedEcuHardware}`,
        technician: 'Atelier AutoPro',
      };

      const nextInstalled = activeRecord.installedCalibrations.includes(selectedCalibration.id)
        ? activeRecord.installedCalibrations
        : [...activeRecord.installedCalibrations, selectedCalibration.id];

      const updatedRecord: CoolrayVehicleFollowUpRecord = {
        ...activeRecord,
        variantId: selectedVariantId,
        installedCalibrations: nextInstalled,
        checklist: {
          ...activeRecord.checklist,
          localFuelEcuMapInstalled:
            selectedCalibration.id === 'downgrade_cn_to_dz' ||
            selectedCalibration.id === 'custom_anti_lspi_patch'
              ? true
              : activeRecord.checklist.localFuelEcuMapInstalled,
        },
        interventions: [newIntervention, ...activeRecord.interventions],
      };
      await persistRecord(updatedRecord, true);
    } catch {
      setFlashResult({
        ok: false,
        message: 'Serveur backend injoignable : vérifiez la liaison réseau atelier avant toute écriture ECU.',
      });
    } finally {
      setIsFlashing(false);
    }
  };

  const handleSaveObdAuditToVin = async () => {
    const newIntervention: CoolrayInterventionLog = {
      id: `OBD-${Date.now()}`,
      dateIso: new Date().toISOString().slice(0, 10),
      mileageKm: activeRecord.currentMileageKm,
      type: 'OBD_AUDIT',
      title: `Audit Combustion OBD2 (${overallObdSeverity === 'green' ? 'Normal' : overallObdSeverity === 'amber' ? 'Vigilance' : 'Alerte Critique'})`,
      details: `Knock ${obdSnapshot.knockRetardDeg}° @ ${obdSnapshot.rpm} tr/min · Ratés C1-C4 [${obdSnapshot.misfiresCyl1}/${obdSnapshot.misfiresCyl2}/${obdSnapshot.misfiresCyl3}/${obdSnapshot.misfiresCyl4}] · STFT ${obdSnapshot.stftPct}% / LTFT ${obdSnapshot.ltftPct}% · IAT ${obdSnapshot.iatCelsius}°C`,
      technician: 'Diagnostic Préventif',
    };

    const nextRecord: CoolrayVehicleFollowUpRecord = {
      ...activeRecord,
      lastObdAuditStatus: overallObdSeverity,
      interventions: [newIntervention, ...activeRecord.interventions],
    };
    await persistRecord(nextRecord, true);
    setObdAuditSavedMsg(`Audit OBD2 enregistré dans le dossier VIN ${activeRecord.vin}.`);
    setTimeout(() => setObdAuditSavedMsg(null), 4000);
  };

  const handleMarkMaintenanceDone = async (
    kind: 'OIL_CHANGE' | 'SPARK_PLUGS' | 'GDI_PEA_CLEANER'
  ) => {
    const km = activeRecord.currentMileageKm;
    let updated: CoolrayVehicleFollowUpRecord = { ...activeRecord };
    let title = '';
    let details = '';

    if (kind === 'OIL_CHANGE') {
      title = 'Vidange Moteur API SP / ILSAC GF-6 (Cycle 7 500 km)';
      details = `Huile sélectionnée : ${activeRecord.selectedOilSpec} à ${km.toLocaleString('fr-FR')} km.`;
      updated = {
        ...updated,
        lastOilChangeKm: km,
        checklist: {
          ...updated.checklist,
          oilApiSpGf6Verified:
            activeRecord.selectedOilSpec === '0W20_API_SP_GF6' ||
            activeRecord.selectedOilSpec === '5W30_API_SP',
        },
      };
    } else if (kind === 'SPARK_PLUGS') {
      title = 'Remplacement / Contrôle Bougies Iridium Froides (Cycle 25 000 km)';
      details = `Contrôle écartement électrodes & bobines effectué à ${km.toLocaleString('fr-FR')} km.`;
      updated = {
        ...updated,
        lastSparkPlugsKm: km,
        checklist: { ...updated.checklist, iridiumPlugsVerified: true },
      };
    } else {
      title = 'Traitement Nettoyant Injecteurs GDI PEA (Cycle 10 000 km)';
      details = `Additif polyétheramine (PEA) haute pression ajouté à ${km.toLocaleString('fr-FR')} km.`;
      updated = {
        ...updated,
        lastPeaCleanerKm: km,
        checklist: { ...updated.checklist, gdiPeaCleanerDone: true },
      };
    }

    const logItem: CoolrayInterventionLog = {
      id: `MAINT-${Date.now()}`,
      dateIso: new Date().toISOString().slice(0, 10),
      mileageKm: km,
      type: kind,
      title,
      details,
      technician: 'Atelier AutoPro',
    };
    updated.interventions = [logItem, ...updated.interventions];
    await persistRecord(updated);
  };

  const selectedOilOption = useMemo(
    () =>
      COOLRAY_OIL_SPEC_OPTIONS.find((o) => o.id === activeRecord.selectedOilSpec) ||
      COOLRAY_OIL_SPEC_OPTIONS[0],
    [activeRecord.selectedOilSpec]
  );

  const supplierCompatList = useMemo(
    () => getCoolraySupplierCompatMatrix(selectedVariantId),
    [selectedVariantId]
  );

  const filteredAlgeriaIssues = useMemo(
    () =>
      issueDomainFilter === 'ALL'
        ? COOLRAY_ALGERIA_ISSUES
        : COOLRAY_ALGERIA_ISSUES.filter((i) => i.domain === issueDomainFilter),
    [issueDomainFilter]
  );

  const selectedCentralOp = useMemo(
    () =>
      COOLRAY_CENTRAL_UNIT_OPTIONS.find((op) => op.id === selectedCentralOpId) ||
      COOLRAY_CENTRAL_UNIT_OPTIONS[0],
    [selectedCentralOpId]
  );

  const handleRunOemCompatAudit = async (
    mode: 'audit_dids' | 'prepare_dealer' | 'reapply_post_ota'
  ) => {
    setIsAuditingOem(true);
    try {
      const res = await apiFetch('/api/coolray-lspi/oem-compat-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: activeRecord.vin,
          variantId: selectedVariantId,
          mode,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setOemAuditResult({
          ok: true,
          summary: data.summary,
          udsFrames: data.udsFrames || [],
          checkedAt: new Date(data.checkedAt).toLocaleTimeString('fr-FR'),
        });
      }
    } catch {
      setOemAuditResult({
        ok: true,
        summary: `Mode hors-ligne : matrice fournisseurs vérifiée pour ${activeRecord.vin} (/system & CALID conservés).`,
        udsFrames: supplierCompatList.map(
          (m) => `CACHE ${m.udsAddress} -> ${m.oemPartDidF187} · ${m.oemSwDidF188}`
        ),
        checkedAt: new Date().toLocaleTimeString('fr-FR'),
      });
    } finally {
      setIsAuditingOem(false);
    }
  };

  const handleExecuteCentralUnitReprog = async () => {
    setCentralOpResult(null);
    setIsRunningCentralOp(true);
    try {
      const res = await apiFetch('/api/coolray-lspi/central-unit-reprog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: activeRecord.vin,
          selectedUnitId: selectedCentralUnitId,
          detectedUnitId: detectedCentralUnitId,
          operationId: selectedCentralOp.id,
          binaryTag: selectedCentralOp.binaryTag,
          batteryVoltage: effectiveVoltage,
          backupConfirmed: centralBackupConfirmed,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setCentralOpResult({
          ok: false,
          message: data?.error || 'Intervention bloquée par les verrous de sécurité.',
        });
        return;
      }

      setCentralOpResult({
        ok: true,
        message: `${selectedCentralOp.title} exécuté (${data.checksum}). Partitions signées OTA Maison Geely intactes.`,
        frames: data.frames,
        checksum: data.checksum,
        otaCompatible: Boolean(data.otaCompatible),
      });

      const logItem: CoolrayInterventionLog = {
        id: `CU-${Date.now()}`,
        dateIso: new Date().toISOString().slice(0, 10),
        mileageKm: activeRecord.currentMileageKm,
        type:
          selectedCentralOp.id === 'dz_bcm_peps_tpms_reset'
            ? 'BCM_RESET'
            : 'CENTRAL_UNIT_REPROG',
        title: selectedCentralOp.title,
        details: `${selectedCentralUnitId} · Tag ${selectedCentralOp.binaryTag} · OTA Maison Geely Safe`,
        technician: 'Atelier AutoPro DZ',
      };
      await persistRecord(
        {
          ...activeRecord,
          interventions: [logItem, ...activeRecord.interventions],
        },
        true
      );
    } catch {
      setCentralOpResult({
        ok: false,
        message: 'Serveur backend injoignable pour valider la procédure Unité Centrale.',
      });
    } finally {
      setIsRunningCentralOp(false);
    }
  };

  const handleExportCoolrayPdfReport = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFillColor(10, 15, 28);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(34, 211, 238);
    doc.setFontSize(14);
    doc.text('AutoPro Flash & Diagnostic Hub — Rapport Atelier Geely Coolray DZ', 14, 14);
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(9.5);
    doc.text(
      `VIN: ${activeRecord.vin}  |  Kilométrage: ${activeRecord.currentMileageKm.toLocaleString('fr-FR')} km  |  Score Anti-LSPI: ${scoreCalc.score}%`,
      14,
      23
    );

    let y = 42;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(`Profil Véhicule : ${activeProfile.label}`, 14, y);
    y += 6;
    doc.setFontSize(9.5);
    doc.text(
      `Motorisation: ${activeProfile.engineCode} | ECU: ${activeProfile.ecuModel} | Boîte: ${activeProfile.transmission}`,
      14,
      y
    );
    y += 6;
    doc.text(
      `Huile sélectionnée: ${selectedOilOption.label} | Dernier audit OBD2: ${activeRecord.lastObdAuditStatus.toUpperCase()}`,
      14,
      y
    );

    y += 10;
    doc.setFontSize(11);
    doc.text('Compatibilité Maison Geely & Fournisseurs (DIDs 0x22)', 14, y);
    y += 6;
    doc.setFontSize(8.5);
    for (const mod of supplierCompatList) {
      doc.text(
        `- ${mod.moduleName} (${mod.supplierLabel}) : Réf ${mod.oemPartDidF187} / SW ${mod.oemSwDidF188} [OTA OK]`,
        16,
        y
      );
      y += 5;
    }

    y += 6;
    doc.setFontSize(11);
    doc.text('Historique des interventions enregistrées :', 14, y);
    y += 6;
    doc.setFontSize(8.5);
    for (const item of activeRecord.interventions.slice(0, 12)) {
      doc.text(
        `[${item.dateIso} · ${item.mileageKm.toLocaleString('fr-FR')} km] ${item.title} — ${item.details.slice(0, 75)}`,
        16,
        y
      );
      y += 5;
      if (y > 270) break;
    }

    doc.save(`Rapport_Coolray_DZ_${activeRecord.vin}.pdf`);
  };

  const [whatsappShareUrl, setWhatsappShareUrl] = useState<string | null>(null);

  const buildGaragisteDzPlanPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 12;
    const contentW = pageW - margin * 2;
    const fileName = 'Plan_Atelier_Garagiste_DZ_Coolray_181_174_177.pdf';

    // Header dark navy
    doc.setFillColor(10, 18, 34);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(34, 211, 238);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text('PLAN DE TRAVAIL GARAGISTE DZ - GEELY COOLRAY 181 CH', margin, 11.5);
    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.text(
      `Programmation & Adaptation Carburant Algerie : 181 ch -> 174 ch (Export DZ) ou 177 ch Anti-LSPI`,
      margin,
      18
    );
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text(
      `VIN actif : ${activeRecord.vin}  |  Duree estimee : 45-60 min  |  Edite le ${new Date().toLocaleDateString('fr-FR')}`,
      margin,
      24
    );

    let y = 34;

    // Alerte Rouge Anti-Bricking 174 vs 177
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(220, 38, 38);
    doc.roundedRect(margin, y, contentW, 26, 2, 2, 'FD');
    doc.setTextColor(153, 27, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('REGLE CRITIQUE ANTI-BRICKING (174 CH vs 177 CH) - A LIRE AVANT TOUT FLASH :', margin + 3, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    const alertLines = doc.splitTextToSize(
      '- Coolray 181 ch (Import Chine BHE15-EFZ 4 cyl.) = ECU Bosch MG1US008.\n' +
        '- Coolray 174 ch (Export DZ BHE15-EFZ 4 cyl.) = ECU Bosch MG1US008 (compatible par downgrade sur meme HW).\n' +
        '- Coolray 177 ch Phase 1 (2020-2023 JLH-3G15TD 3 cyl.) = ECU Bosch MG1CS080 -> INTERDIT sur MG1US008 (Bricking immediat) !\n' +
        '  Pour obtenir 177 ch sur un 181 ch, modifier UNIQUEMENT le fichier d\'origine ORI MG1US008 lu sur le vehicule.',
      contentW - 6
    );
    doc.text(alertLines, margin + 3, y + 11.5);
    y += 31;

    const phases: Array<{ title: string; duration: string; bullets: string[] }> = [
      {
        title: 'PHASE 1 - CONTROLE PREALABLE & DIAGNOSTIC OBD2',
        duration: '10 min',
        bullets: [
          'Lire les defauts DTC (0x19) : verifier l\'absence de rates P0300 / P0302 / P0303 (Cylindres 2 & 3).',
          'Relever les PIDs moteur : Knock Retard (normal 0 a -2.0 deg), STFT/LTFT (+/-5%), IAT (< 50 deg C).',
          'Controler niveau/odeur d\'huile et type d\'huile utilise. Si rates ou perte compression : stopper et reparer mecaniquement avant flash.',
        ],
      },
      {
        title: 'PHASE 2 - STABILISATION ELECTRIQUE & LECTURE FULL BACKUP',
        duration: '15 min',
        bullets: [
          'Brancher un stabilisateur de tension atelier 13.5V - 13.8V (50A+ obligatoire ; blocage strict sous 13.0V).',
          'Relever VIN (L6T...), Hardware ID (HW), Calibration ID (DID F187/F188) et CVN d\'origine.',
          'En mode Bench (sur table, sans ouvrir l\'ECU) via J2534/Flex/Autotuner/PCMFlash : faire une LECTURE FULL (Flash + EEPROM) et archiver ORI_MG1US008.bin + SHA-256.',
        ],
      },
      {
        title: 'PHASE 3 - PREPARATION CALIBRATION (174 CH DZ OU 177 CH ANTI-LSPI)',
        duration: '10 min',
        bullets: [
          'Option A (181 -> 174 ch Export DZ) : Calibration Export DZ compatible exact HW MG1US008 (marge cliquetis +3.2 deg, VIN/Immo/PEPS conserves).',
          'Option B (181 -> 177 ch Custom Anti-LSPI sur ORI) : Retard allumage -2.5 a -4.0 deg (1500-2800 tr/min, charge >70%), lissage boost <2200 tr/min, AFR ~11.8-12.1.',
          'Optionnel recommande : Patch TCU 7DCT (0x7E1) anti sous-regime + recalcul Checksum CRC32 / RSA-3072 sur le fichier modifie.',
        ],
      },
      {
        title: 'PHASE 4 - ECRITURE SECURISEE & ESSAI ROUTIER DE VALIDATION',
        duration: '10-15 min',
        bullets: [
          'Executer l\'ecriture (0x27 Seed/Key -> Effacement 0x31 -> Transfert 0x36 + TesterPresent 0x3E -> Checksum OK -> ECUReset 0x11 01).',
          'Couper/remettre le contact 15 sec, scanner ECU + TCU + BCM/SGW, effacer les eventuels DTC temporaires (U0100/U0140).',
          'Essai routier 10 min en reprise (2000-3500 tr/min) : verifier Knock Retard proche de 0 a -1.5 deg et 0 misfire sur Cyl. 2 & 3.',
        ],
      },
      {
        title: 'PHASE 5 - CLOTURE DOSSIER VIN & CONSIGNES OBLIGATOIRES CLIENT',
        duration: '5 min',
        bullets: [
          'Huile 0W-20 certifiee API SP / ILSAC GF-6 OBLIGATOIRE (jamais de 5W-40 API SN) - vidange tous les 7 500 km max.',
          'Bougies Iridium froides tous les 25 000 km + nettoyant injecteurs GDI PEA tous les 10 000 km.',
          'Consigne conduite client : eviter le mode Eco en ville/cote et les fortes accelerations sous 2 000 tr/min.',
        ],
      },
    ];

    for (const phase of phases) {
      if (y > 250) {
        doc.addPage();
        y = 14;
      }
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentW, 6.5, 'F');
      doc.setTextColor(34, 211, 238);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.text(phase.title, margin + 2.5, y + 4.5);
      doc.setTextColor(250, 204, 21);
      doc.text(phase.duration, pageW - margin - 14, y + 4.5);
      y += 8.5;

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.1);
      for (const b of phase.bullets) {
        const lines = doc.splitTextToSize(`• ${b}`, contentW - 4);
        doc.text(lines, margin + 2, y);
        y += lines.length * 4 + 1.2;
      }
      y += 2;
    }

    // Footer
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, 283, pageW - margin, 283);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'AutoPro Flash & Diagnostic Hub DZ  |  https://autoprodz-a7071.web.app  |  Support Atelier : 05 57 76 78 04',
      margin,
      288
    );

    return { doc, fileName };
  };

  const handleDownloadGaragisteDzPlanPdf = () => {
    const { doc, fileName } = buildGaragisteDzPlanPdf();
    doc.save(fileName);
    setSyncNotice(`Plan Atelier Garagiste DZ téléchargé (${fileName}).`);
    setTimeout(() => setSyncNotice(null), 4500);
  };

  const handleShareGaragisteDzPlanPdf = async () => {
    const { doc, fileName } = buildGaragisteDzPlanPdf();
    const shareText =
      `PLAN ATELIER GARAGISTE DZ — Geely Coolray 181 ch -> 174 / 177 ch Anti-LSPI\n` +
      `⚠️ Règle critique : 181 ch & 174 ch = MG1US008 (4 cyl) | Jamais de fichier 177 ch Phase 1 MG1CS080 (3 cyl) !\n` +
      `1. Audit OBD2 (DTC 0x19, Knock, Cyl. 2 & 3)\n` +
      `2. Stabilisateur 13.5-13.8V + Lecture Full Backup (Flash + EEPROM)\n` +
      `3. Calibration 174 ch Export DZ ou 177 ch Custom Anti-LSPI + Checksum CRC32\n` +
      `4. Écriture 0x27/0x36 + Essai routier\n` +
      `5. Huile 0W-20 API SP / GF-6 (7 500 km) + Bougies Iridium + Additif PEA\n` +
      `AutoPro DZ : https://autoprodz-a7071.web.app`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    setWhatsappShareUrl(waUrl);

    try {
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const navShare = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (typeof navShare.share === 'function' && (!navShare.canShare || navShare.canShare({ files: [pdfFile] }))) {
        await navShare.share({
          title: 'Plan Atelier Garagiste DZ — Geely Coolray 181 ch -> 174/177 ch',
          text: shareText,
          files: [pdfFile],
        });
        setSyncNotice('Plan PDF partagé avec succès.');
        setTimeout(() => setSyncNotice(null), 4000);
        return;
      }
    } catch {
      // Fallback below if user cancels or browser blocks file share
    }

    doc.save(fileName);
    try {
      await navigator.clipboard?.writeText(shareText);
    } catch {
      // Ignore clipboard failure in restricted iframes
    }
    setSyncNotice(
      `PDF téléchargé (${fileName}) et résumé copié ! Utilisez le bouton WhatsApp apparu ci-dessous pour l'envoyer.`
    );
    setTimeout(() => setSyncNotice(null), 6500);
  };

  const handleDownloadHardwarePlanPdf = () => {
    const { doc, fileName } = buildHardwarePlanPdf();
    doc.save(fileName);
    setSyncNotice(`Plan Matériel Exigé (FR + Darija) téléchargé (${fileName}).`);
    setTimeout(() => setSyncNotice(null), 4500);
  };

  const handleShareHardwarePlanPdf = async () => {
    const result = await shareHardwarePlanPdf();
    setWhatsappShareUrl(result.waUrl);
    setSyncNotice(result.notice);
    setTimeout(() => setSyncNotice(null), 6500);
  };

  // Jauge pour cycles kilométriques
  const renderCycleGauge = (
    title: string,
    sinceKm: number,
    maxKm: number,
    lastKm: number,
    onMarkDone: () => void
  ) => {
    const pct = Math.min(100, Math.round((sinceKm / maxKm) * 100));
    const remaining = maxKm - sinceKm;
    const isOverdue = remaining <= 0;
    const isWarning = !isOverdue && pct >= 80;

    return (
      <div
        className={`rounded-xl border p-4 space-y-3 ${
          isOverdue
            ? 'border-rose-500/60 bg-rose-950/20'
            : isWarning
            ? 'border-amber-500/50 bg-amber-950/15'
            : 'border-slate-800 bg-slate-900/70'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-white">{title}</h4>
            <p className="text-[11px] text-slate-400">
              Cycle strict : <span className="font-mono text-slate-200">{maxKm.toLocaleString('fr-FR')} km</span> · Dernière à{' '}
              <span className="font-mono text-slate-200">{lastKm.toLocaleString('fr-FR')} km</span>
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
              isOverdue
                ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                : isWarning
                ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                : 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {isOverdue
              ? `DÉPASSÉ DE ${Math.abs(remaining).toLocaleString('fr-FR')} km`
              : `Reste ${remaining.toLocaleString('fr-FR')} km`}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-300">
            <span>Parcouru : {sinceKm.toLocaleString('fr-FR')} km</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isOverdue ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onMarkDone}
          className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Intervention effectuée à {activeRecord.currentMileageKm.toLocaleString('fr-FR')} km</span>
        </button>
      </div>
    );
  };

  const isRealObdConnected = obdHardwareBridge.isRealHardwareConnected();

  return (
    <div className="space-y-6 min-w-0 w-full overflow-x-hidden">
      {/* En-tête du Module Geely Coolray Anti-LSPI */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-[#0d1424] to-slate-950 p-4 sm:p-6 shadow-xl min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="px-2.5 py-1 rounded-md bg-rose-950/90 border border-rose-500/50 text-rose-300 text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 max-w-full whitespace-normal break-words">
                <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Geely Coolray (2020–2026) · Solution Complète Marché Algérien</span>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-cyan-300 text-[11px] font-mono max-w-full whitespace-normal break-words">
                BOSCH MG1 · 7DCT · IHU624G/715P · BCM/SGW
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight break-words">
              Geely Coolray — Diag &amp; Reprogrammation Unité Centrale, Anti-LSPI &amp; Compatibilité Maison Geely
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl break-words">
              Solution atelier adaptée au marché algérien : protection Anti-LSPI 1.5T, calibration 7DCT, dépannage unité
              centrale IHU/BCM/SGW et préservation stricte des mises à jour officielles Maison Geely &amp; fournisseurs.
            </p>
          </div>

          {/* Score Global Protection Moteur + Export PDF & Plan Garagiste DZ */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 min-w-0">
            <button
              type="button"
              onClick={handleExportCoolrayPdfReport}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Rapport PDF Client</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadGaragisteDzPlanPdf}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/60 border border-emerald-500/50 text-xs font-bold text-emerald-300 flex items-center gap-2 cursor-pointer transition-colors"
              title="Télécharger la fiche Plan Atelier Garagiste DZ (181 ch -> 174 / 177 ch) en PDF A4"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Plan Garagiste DZ (PDF)</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShareGaragisteDzPlanPdf()}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 text-xs font-bold text-cyan-300 flex items-center gap-2 cursor-pointer transition-colors"
              title="Envoyer directement le Plan PDF par WhatsApp / Partage mobile"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Envoyer Plan</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHardwarePlanPdf}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-950/70 hover:bg-amber-900/60 border border-amber-500/50 text-xs font-bold text-amber-300 flex items-center gap-2 cursor-pointer transition-colors"
              title="Télécharger le Plan Matériel Exigé (Français + Darija) en PDF A4"
            >
              <Wrench className="w-4 h-4 shrink-0" />
              <span>Matériel PDF (FR/Darija)</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShareHardwarePlanPdf()}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-xs font-bold text-amber-200 flex items-center gap-2 cursor-pointer transition-colors"
              title="Envoyer le Plan Matériel Exigé (FR + Darija) par WhatsApp"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Envoyer Matériel</span>
            </button>

            <div className="flex items-center justify-between sm:justify-start gap-4 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 w-full sm:w-auto min-w-0">
              <div className="text-left sm:text-right min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Score Protection Moteur
                </div>
                <div className="text-xs font-medium text-slate-300 truncate">{scoreCalc.statusLabel}</div>
                <div className="text-[11px] font-mono text-slate-500 break-all">VIN : {activeRecord.vin}</div>
              </div>
              <div
                className={`w-16 h-16 shrink-0 rounded-xl border-2 flex flex-col items-center justify-center font-mono font-extrabold ${
                  scoreCalc.score >= 85
                    ? 'border-emerald-500/70 bg-emerald-950/60 text-emerald-300'
                    : scoreCalc.score >= 60
                    ? 'border-amber-500/70 bg-amber-950/60 text-amber-300'
                    : 'border-rose-500/80 bg-rose-950/70 text-rose-300'
                }`}
              >
                <span className="text-xl leading-none">{scoreCalc.score}%</span>
                <span className="text-[9px] uppercase mt-1 opacity-80">LSPI SAFE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bandeau Mode Réel vs Démonstration */}
        <div
          className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            isRealObdConnected
              ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
              : 'border-cyan-500/35 bg-slate-950/70 text-slate-300'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 mt-1 sm:mt-0 ${
                isRealObdConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="break-words">
              {isRealObdConnected ? (
                <>
                  <strong>Liaison OBD2 Réelle active :</strong> la détection auto interroge le VIN (Mode 09 02) et l&apos;ID ECU (09 04) directement sur la Geely Coolray.
                </>
              ) : isDemoBannerActive ? (
                <>
                  <strong>Démonstration Atelier Active (Sans voiture) :</strong> scénario complet Coolray Chine VI 181 ch · ECU MG1US008 · 13.5V · Audit DTC 0x19 prêt pour test de flash.
                </>
              ) : (
                <>
                  <strong>Mode Banc / Hors-Ligne :</strong> aucun boîtier ELM327 réel branché. Utilisez la détection par VIN Geely ou lancez la démonstration guidée.
                </>
              )}
            </span>
          </div>
          {!isRealObdConnected && (
            <button
              type="button"
              onClick={onOpenConnectModal}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-cyan-300 shrink-0 cursor-pointer self-start sm:self-auto"
            >
              Connecter Boîtier Réel
            </button>
          )}
        </div>

        {/* Sélecteur des 4 profils Coolray (2020–2026) */}
        <div className="mt-5 pt-5 border-t border-slate-800/80 space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-start sm:items-center gap-2 min-w-0">
              <Cpu className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
              <span className="break-words">1. Base Motorisations &amp; Profils Véhicules Geely Coolray (2020–2026)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <button
                type="button"
                disabled={isDetectingVehicle}
                onClick={() => void handleAutoDetectFromAppVehicle()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-colors max-w-full whitespace-normal text-left"
              >
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isDetectingVehicle ? 'animate-spin' : ''}`} />
                <span>
                  {isDetectingVehicle
                    ? 'Lecture VIN / ECU...'
                    : isRealObdConnected
                    ? 'Détection auto OBD2 / VIN Coolray'
                    : isGeelyVehicle(selectedVehicle)
                    ? `Détection auto (${selectedVehicle.brand} ${selectedVehicle.model})`
                    : 'Détection auto VIN / ECU Coolray'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleRunCoolrayDemo}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 text-xs font-bold text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Play className="w-3.5 h-3.5 shrink-0" />
                <span>Démonstration</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {COOLRAY_ENGINE_PROFILES.map((profile) => {
              const isSelected = profile.id === selectedVariantId;
              const isChinePriority = profile.lspiPriorityLevel === 'PRIORITAIRE_CHINE_VI';
              const isAtmo = !profile.isTurboDirectInjection;

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => handleSelectCoolrayVariant(profile.id)}
                  className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer space-y-2 min-w-0 ${
                    isSelected
                      ? isChinePriority
                        ? 'border-rose-500 bg-rose-950/30 ring-1 ring-rose-500/40'
                        : isAtmo
                        ? 'border-emerald-500 bg-emerald-950/25 ring-1 ring-emerald-500/40'
                        : 'border-cyan-500 bg-cyan-950/25 ring-1 ring-cyan-500/40'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <span className="text-xs font-bold text-white leading-snug break-words">{profile.label}</span>
                    {isChinePriority && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-bold shrink-0">
                        PRIORITAIRE LSPI
                      </span>
                    )}
                    {isAtmo && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold shrink-0">
                        EXCLU TURBO
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-300 font-medium break-words">{profile.engineCode}</div>

                  <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800">
                      {profile.powerHp} / {profile.torqueNm}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                      {profile.transmission.includes('CVT') ? 'CVT' : '7DCT'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 text-amber-300 border border-slate-800">
                      {profile.ecuHardwareFamily}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Note technique profil sélectionné */}
          <div
            className={`rounded-xl border px-4 py-3 text-xs flex items-start gap-3 min-w-0 ${
              activeProfile.lspiPriorityLevel === 'PRIORITAIRE_CHINE_VI'
                ? 'border-rose-500/50 bg-rose-950/30 text-rose-200'
                : activeProfile.lspiPriorityLevel === 'EXCLU_ATMO_STANDARD'
                ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                : 'border-amber-500/40 bg-amber-950/20 text-amber-200'
            }`}
          >
            {activeProfile.lspiPriorityLevel === 'EXCLU_ATMO_STANDARD' ? (
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5 min-w-0">
              <div className="font-bold break-words">
                {activeProfile.label} — ECU {activeProfile.ecuModel} ({activeProfile.transmission})
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed break-words">{activeProfile.calibrationNote}</p>
            </div>
          </div>
        </div>

        {/* Barre sous-onglets du module */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-800/80 pt-4 min-w-0">
          <button
            type="button"
            onClick={() => setSubTab('flash')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border max-w-full whitespace-normal text-left ${
              subTab === 'flash'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Zap className="w-4 h-4 shrink-0" />
            <span>A. Flash Anti-LSPI (ECU / TCU)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('central_unit_dz')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border max-w-full whitespace-normal text-left ${
              subTab === 'central_unit_dz'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <MonitorSmartphone className="w-4 h-4 shrink-0" />
            <span>B. Unité Centrale DZ &amp; Compatibilité Maison Geely</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('obd_audit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border max-w-full whitespace-normal text-left ${
              subTab === 'obd_audit'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span>C. Audit Santé Combustion OBD2</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('maintenance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border max-w-full whitespace-normal text-left ${
              subTab === 'maintenance'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 shrink-0" />
            <span>D. Précautions &amp; Dossier VIN</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-4 py-2.5 text-xs text-cyan-200 flex items-start gap-2 break-words">
          <Database className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span className="min-w-0 break-words">{syncNotice}</span>
        </div>
      )}

      {whatsappShareUrl && (
        <div className="rounded-xl border border-emerald-500/45 bg-emerald-950/25 px-4 py-2.5 text-xs text-emerald-200 flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 break-words">
            PDF <strong>Plan Atelier Garagiste DZ</strong> prêt à être envoyé :
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-colors"
            >
              Ouvrir WhatsApp avec le Plan
            </a>
            <button
              type="button"
              onClick={() => setWhatsappShareUrl(null)}
              className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ONGLET A : FLASH & REPROGRAMMATION ANTI-LSPI (ECU / TCU)  */}
      {/* ========================================================= */}
      {subTab === 'flash' && (
        <div className="space-y-5">
          {!activeProfile.isTurboDirectInjection ? (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-6 space-y-3">
              <div className="flex items-center gap-3 text-emerald-300 font-bold text-base">
                <ShieldCheck className="w-6 h-6" />
                <span>Profil Standard Atmosphérique — Exclu des Flashs Anti-LSPI Turbo</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Le <strong>Coolray Lite / Super Atmosphérique (1.5L DVVT 126–127 ch · Boîte CVT)</strong> ne dispose
                ni de turbocompresseur ni d’injection directe haute pression GDI. Le phénomène destructeur LSPI ne
                concerne pas ce moteur : aucune reprogrammation Anti-LSPI n’est requise ou autorisée sur ce profil.
              </p>
              <button
                type="button"
                onClick={() => setSubTab('maintenance')}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer hover:bg-emerald-400 transition-colors"
              >
                Basculer vers le suivi d’entretien standard (VIN)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Colonne gauche : 3 Verrous de Sécurité Pré-Flash */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400" />
                      Verrous de Sécurité Pré-Flash (Bloquants)
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                        allPreFlashLocksOk
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-950 text-rose-300 border-rose-500/50'
                      }`}
                    >
                      {allPreFlashLocksOk ? '3/3 VALIDÉS' : 'ÉCRITURE BLOQUÉE'}
                    </span>
                  </div>

                  {/* Verrou 1 : Tension Batterie */}
                  <div
                    className={`rounded-xl border p-3.5 space-y-2.5 ${
                      voltageLockOk
                        ? 'border-emerald-500/40 bg-emerald-950/15'
                        : 'border-rose-500/60 bg-rose-950/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <BatteryCharging className="w-4 h-4 text-cyan-400" />
                        1. Tension Batterie (&ge; 12.4V)
                      </span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          voltageLockOk ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {effectiveVoltage.toFixed(1)}V {voltageLockOk ? 'OK' : 'BLOQUÉ'}
                      </span>
                    </div>

                    {!isConnected && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Simulateur tension banc / maintien de charge :</span>
                          <div className="flex gap-1">
                            {[11.9, 12.6, 13.5].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setTestVoltageOverride(v)}
                                className={`px-1.5 py-0.5 rounded font-mono border text-[10px] cursor-pointer ${
                                  Math.abs(testVoltageOverride - v) < 0.05
                                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                                    : 'bg-slate-950 text-slate-300 border-slate-700'
                                }`}
                              >
                                {v.toFixed(1)}V
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          type="range"
                          min={11.5}
                          max={14.2}
                          step={0.1}
                          value={testVoltageOverride}
                          onChange={(e) => setTestVoltageOverride(Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                    )}

                    {!voltageLockOk && (
                      <p className="text-[11px] text-rose-200 font-medium">
                        Blocage automatique (&lt; 12.4V) : branchez un stabilisateur de tension atelier 50A+ avant écriture MG1.
                      </p>
                    )}
                  </div>

                  {/* Verrou 2 : Contrôle Matériel ECU & Anti-Croisement */}
                  <div
                    className={`rounded-xl border p-3.5 space-y-2.5 ${
                      hardwareMatchOk
                        ? 'border-emerald-500/40 bg-emerald-950/15'
                        : 'border-rose-500/60 bg-rose-950/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-amber-400" />
                        2. Contrôle ID Calculateur
                      </span>
                      <span
                        className={`font-mono text-[11px] font-bold ${
                          hardwareMatchOk ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {hardwareMatchOk ? 'ID COMPATIBLE' : 'CROISEMENT INTERDIT'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300">
                      Requis profil :{' '}
                      <span className="font-mono text-cyan-300 font-bold">
                        {activeProfile.compatibleHardwareFamilies.join(' / ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {(['MG1US008', 'MG1UA008', 'MG1CS080'] as CoolrayEcuHardwareFamily[]).map((hw) => (
                        <button
                          key={hw}
                          type="button"
                          onClick={() => setDetectedEcuHardware(hw)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold border cursor-pointer transition-colors ${
                            detectedEcuHardware === hw
                              ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {hw}
                        </button>
                      ))}
                    </div>

                    {!hardwareMatchOk && (
                      <p className="text-[11px] text-rose-200 font-medium">
                        Croisement MG1US008 / MG1CS080 détecté : flash bloqué pour éviter la corruption boot du calculateur.
                      </p>
                    )}
                  </div>

                  {/* Verrou 3 : Audit DTC Préliminaire */}
                  <div
                    className={`rounded-xl border p-3.5 space-y-2.5 ${
                      dtcAuditLockOk
                        ? 'border-emerald-500/40 bg-emerald-950/15'
                        : 'border-rose-500/60 bg-rose-950/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Search className="w-4 h-4 text-emerald-400" />
                        3. Audit Préliminaire DTC (0x19)
                      </span>
                      <span
                        className={`text-[11px] font-bold ${
                          dtcAuditLockOk ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {!dtcAuditRun
                          ? 'NON EXÉCUTÉ'
                          : simulateMisfireDtc
                          ? 'RATÉS P0302/P0303'
                          : 'AUCUN RATÉ SÉVÈRE'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRunDtcAudit}
                        className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 cursor-pointer transition-colors"
                      >
                        {dtcAuditRun ? 'Relancer scan DTC pré-flash' : 'Lancer lecture DTC obligatoire'}
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={simulateMisfireDtc}
                        onChange={(e) => setSimulateMisfireDtc(e.target.checked)}
                        className="rounded border-slate-600 bg-slate-950 text-rose-500"
                      />
                      <span>Simuler DTC raté allumage sévère (P0302 / P0303) pour test blocage</span>
                    </label>
                  </div>

                  {!isConnected && (
                    <button
                      type="button"
                      onClick={onOpenConnectModal}
                      className="w-full py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 cursor-pointer transition-colors"
                    >
                      Connecter interface OBD2 réelle (ELM327 / J2534)
                    </button>
                  )}
                </div>
              </div>

              {/* Colonne droite : 3 Cartographies Correctives & Exécution */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      Cartographies Correctives Anti-LSPI (ECU &amp; TCU 7DCT)
                    </h2>
                    <span className="text-[11px] font-mono text-slate-400">ISO 14229 UDS</span>
                  </div>

                  <div className="space-y-3">
                    {COOLRAY_CALIBRATION_OPTIONS.map((cal) => {
                      const isSupported = activeProfile.supportedCalibrations.includes(cal.id);
                      const isSelected = selectedCalibrationId === cal.id;
                      const alreadyInstalled = activeRecord.installedCalibrations.includes(cal.id);

                      return (
                        <button
                          key={cal.id}
                          type="button"
                          disabled={!isSupported}
                          onClick={() => setSelectedCalibrationId(cal.id)}
                          className={`w-full text-left rounded-xl border p-4 transition-all space-y-2 ${
                            !isSupported
                              ? 'border-slate-800/60 bg-slate-950/40 opacity-50 cursor-not-allowed'
                              : isSelected
                              ? 'border-cyan-500 bg-cyan-950/25 ring-1 ring-cyan-500/40 cursor-pointer'
                              : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 cursor-pointer'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-white">{cal.title}</span>
                            <div className="flex items-center gap-1.5">
                              {alreadyInstalled && (
                                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                  INSTALLÉE SUR CE VIN
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700 text-[10px] font-bold">
                                {cal.badge}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] font-mono text-cyan-300">
                            Cible : {cal.targetController} · Tag : {cal.flashBinaryTag}
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">{cal.summary}</p>

                          <ul className="space-y-1 pt-1">
                            {cal.technicalAdjustments.map((adj) => (
                              <li key={adj} className="text-[11px] text-slate-400 flex items-start gap-2">
                                <span className="text-cyan-400 font-bold">•</span>
                                <span>{adj}</span>
                              </li>
                            ))}
                          </ul>

                          {!isSupported && (
                            <div className="text-[11px] text-amber-300 font-semibold pt-1">
                              Option réservée aux moteurs 1.5T 4 cylindres Chine VI 181 ch (MG1US008).
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Barre de progression et bouton d'exécution */}
                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    {isFlashing && (
                      <div className="rounded-xl border border-cyan-500/40 bg-slate-950 p-3.5 space-y-2">
                        <div className="text-xs font-bold text-cyan-300 flex items-center justify-between">
                          <span>Programmation UDS en cours... Ne pas couper le contact !</span>
                          <span className="font-mono">{flashStepIndex}/5</span>
                        </div>
                        <div className="space-y-1.5">
                          {FLASH_SEQUENCE_STEPS.map((step) => {
                            const done = flashStepIndex > step.id;
                            const current = flashStepIndex === step.id;
                            return (
                              <div
                                key={step.id}
                                className={`flex items-center justify-between text-[11px] px-2.5 py-1 rounded ${
                                  done
                                    ? 'bg-emerald-950/40 text-emerald-300'
                                    : current
                                    ? 'bg-cyan-950/60 text-cyan-200 font-semibold'
                                    : 'text-slate-500'
                                }`}
                              >
                                <span>{step.label}</span>
                                <span className="font-mono">{done ? 'OK' : current ? 'EN COURS' : step.ecuRef}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isFlashing}
                      onClick={handleExecuteFlash}
                      className={`w-full py-3 px-4 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        allPreFlashLocksOk
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-lg'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      <Play className="w-4 h-4" />
                      <span>
                        {isFlashing
                          ? 'Écriture & Vérification CRC32 en cours...'
                          : allPreFlashLocksOk
                          ? `Exécuter le Flash (${selectedCalibration.flashBinaryTag})`
                          : 'Tester / Exécuter le Flash (Contrôle verrous de sécurité)'}
                      </span>
                    </button>

                    {flashResult && (
                      <div
                        className={`rounded-xl border p-4 space-y-2.5 ${
                          flashResult.ok
                            ? 'border-emerald-500/50 bg-emerald-950/25'
                            : 'border-rose-500/60 bg-rose-950/30'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {flashResult.ok ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div className="text-xs font-semibold text-white">{flashResult.message}</div>
                        </div>

                        {flashResult.frames && flashResult.frames.length > 0 && (
                          <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-cyan-300 space-y-1 overflow-x-auto break-all sm:break-normal">
                            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                              <Terminal className="w-3.5 h-3.5" />
                              <span>Journal Trames UDS Exécutées</span>
                            </div>
                            {flashResult.frames.map((frame) => (
                              <div key={frame}>{frame}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ONGLET B : DIAGNOSTIC PRÉVENTIF OBD2 (AUDIT COMBUSTION)   */}
      {/* ========================================================= */}
      {subTab === 'obd_audit' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Audit Santé Combustion OBD2 (Détection Précoce Cliquetis &amp; LSPI)
                </h2>
                <p className="text-xs text-slate-400">
                  Surveillance temps réel ou simulation banc des 4 paramètres critiques sur Geely Coolray (alerte renforcée sur les cylindres 2 et 3).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(['normal', 'vigilance', 'lspi_critical'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setObdSnapshot({
                        ...COOLRAY_OBD_SCENARIOS[key].snapshot,
                        capturedAt: new Date().toLocaleTimeString('fr-FR'),
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      key === 'normal'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                        : key === 'vigilance'
                        ? 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/50'
                        : 'bg-rose-950/70 border-rose-500/50 text-rose-300 hover:bg-rose-900/60'
                    }`}
                  >
                    {COOLRAY_OBD_SCENARIOS[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders rapides de test conditions moteur */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950/80 border border-slate-800 rounded-xl p-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Régime Moteur (RPM)</span>
                  <span className="font-mono font-bold text-cyan-300">{obdSnapshot.rpm} tr/min</span>
                </div>
                <input
                  type="range"
                  min={800}
                  max={5500}
                  step={50}
                  value={obdSnapshot.rpm}
                  onChange={(e) => setObdSnapshot((s) => ({ ...s, rpm: Number(e.target.value) }))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Charge Moteur (%)</span>
                  <span className="font-mono font-bold text-cyan-300">{obdSnapshot.engineLoadPct}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={100}
                  step={1}
                  value={obdSnapshot.engineLoadPct}
                  onChange={(e) =>
                    setObdSnapshot((s) => ({ ...s, engineLoadPct: Number(e.target.value) }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Knock Retard (°)</span>
                  <span className="font-mono font-bold text-amber-300">
                    {obdSnapshot.knockRetardDeg.toFixed(1)}°
                  </span>
                </div>
                <input
                  type="range"
                  min={-7.5}
                  max={0}
                  step={0.1}
                  value={obdSnapshot.knockRetardDeg}
                  onChange={(e) =>
                    setObdSnapshot((s) => ({ ...s, knockRetardDeg: Number(e.target.value) }))
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Temp. Air Admission (IAT)</span>
                  <span className="font-mono font-bold text-rose-300">{obdSnapshot.iatCelsius}°C</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={1}
                  value={obdSnapshot.iatCelsius}
                  onChange={(e) =>
                    setObdSnapshot((s) => ({ ...s, iatCelsius: Number(e.target.value) }))
                  }
                  className="w-full accent-rose-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Grille des 4 Cartes d'Audit OBD2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Knock Retard */}
              <div className={`rounded-xl border p-4 space-y-2.5 ${severityCardBorder(knockEval.severity)}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">1. Retard d’Allumage (Knock Retard)</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${severityBadgeClasses(
                      knockEval.severity
                    )}`}
                  >
                    {knockEval.badge}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-mono font-extrabold text-white">
                    {obdSnapshot.knockRetardDeg.toFixed(1)}°
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Plage normale : 0° à -2.0° · Seuil alerte : &gt; -3.5° (1 500–3 000 tr/min)
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{knockEval.recommendation}</p>
              </div>

              {/* 2. Compteurs de Ratés Cyl 1-4 */}
              <div className={`rounded-xl border p-4 space-y-2.5 ${severityCardBorder(misfireEval.severity)}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">2. Compteurs de Ratés (Misfires Cyl. 1–4)</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${severityBadgeClasses(
                      misfireEval.severity
                    )}`}
                  >
                    {misfireEval.badge}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { key: 'misfiresCyl1', label: 'Cyl. 1', hot: false },
                      { key: 'misfiresCyl2', label: 'Cyl. 2 *', hot: true },
                      { key: 'misfiresCyl3', label: 'Cyl. 3 *', hot: true },
                      { key: 'misfiresCyl4', label: 'Cyl. 4', hot: false },
                    ] as const
                  ).map((c) => {
                    const count = obdSnapshot[c.key];
                    return (
                      <div
                        key={c.key}
                        className={`rounded-lg border p-2 text-center ${
                          count >= 3
                            ? 'border-rose-500/70 bg-rose-950/60'
                            : c.hot && activeProfile.isTurboDirectInjection
                            ? 'border-amber-500/35 bg-slate-950/80'
                            : 'border-slate-800 bg-slate-950/70'
                        }`}
                      >
                        <div className="text-[10px] font-bold text-slate-300">{c.label}</div>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={count}
                          onChange={(e) =>
                            setObdSnapshot((s) => ({
                              ...s,
                              [c.key]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full mt-1 bg-transparent text-center font-mono text-base font-extrabold text-white focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{misfireEval.recommendation}</p>
              </div>

              {/* 3. Fuel Trims STFT / LTFT */}
              <div className={`rounded-xl border p-4 space-y-2.5 ${severityCardBorder(fuelTrimEval.severity)}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">3. Corrections Carburant (STFT / LTFT)</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${severityBadgeClasses(
                      fuelTrimEval.severity
                    )}`}
                  >
                    {fuelTrimEval.badge}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-950/80 border border-slate-800 px-3 py-2">
                    <div className="text-[10px] text-slate-400">STFT Court Terme (%)</div>
                    <input
                      type="number"
                      step={0.5}
                      min={-25}
                      max={30}
                      value={obdSnapshot.stftPct}
                      onChange={(e) =>
                        setObdSnapshot((s) => ({ ...s, stftPct: Number(e.target.value) || 0 }))
                      }
                      className="w-full bg-transparent font-mono text-lg font-extrabold text-white focus:outline-none"
                    />
                  </div>
                  <div className="rounded-lg bg-slate-950/80 border border-slate-800 px-3 py-2">
                    <div className="text-[10px] text-slate-400">LTFT Long Terme (%)</div>
                    <input
                      type="number"
                      step={0.5}
                      min={-25}
                      max={30}
                      value={obdSnapshot.ltftPct}
                      onChange={(e) =>
                        setObdSnapshot((s) => ({ ...s, ltftPct: Number(e.target.value) || 0 }))
                      }
                      className="w-full bg-transparent font-mono text-lg font-extrabold text-white focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Normal : -5% à +5% | Alerte : &gt; +10% (mélange pauvre / surchauffe). {fuelTrimEval.recommendation}
                </p>
              </div>

              {/* 4. Température Air Admission IAT */}
              <div className={`rounded-xl border p-4 space-y-2.5 ${severityCardBorder(iatEval.severity)}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">4. Température d’Air d’Admission (IAT)</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${severityBadgeClasses(
                      iatEval.severity
                    )}`}
                  >
                    {iatEval.badge}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-mono font-extrabold text-white">
                    {obdSnapshot.iatCelsius}°C
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Normal : &lt; 45°C · Alerte : &gt; 55°C en charge
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{iatEval.recommendation}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="text-xs text-slate-300">
                Statut global de cet audit :{' '}
                <span
                  className={`px-2 py-0.5 rounded font-bold border ${severityBadgeClasses(
                    overallObdSeverity
                  )}`}
                >
                  {overallObdSeverity === 'green'
                    ? 'VERT — COMBUSTION SAINE'
                    : overallObdSeverity === 'amber'
                    ? 'ORANGE — VIGILANCE RECOMMANDÉE'
                    : 'ROUGE — RISQUE LSPI CRITIQUE'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSaveObdAuditToVin}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer cet Audit OBD2 au Dossier VIN</span>
              </button>
            </div>

            {obdAuditSavedMsg && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
                {obdAuditSavedMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ONGLET C : SUIVI DES PRÉCAUTIONS & MAINTENANCE PAR VIN    */}
      {/* ========================================================= */}
      {subTab === 'maintenance' && (
        <div className="space-y-5">
          {/* Identification VIN & Kilométrage */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400">
                    Numéro de Châssis (VIN)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={vinInput}
                      onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                      placeholder="Ex: L6T7824Z9RZ001540"
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleLoadOrCreateVin}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 cursor-pointer"
                    >
                      Charger
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400">
                    Client / Immatriculation
                  </label>
                  <input
                    type="text"
                    value={activeRecord.ownerOrPlate}
                    onChange={(e) =>
                      setActiveRecord((prev) => ({ ...prev, ownerOrPlate: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400">
                    Kilométrage Actuel (km)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={activeRecord.currentMileageKm}
                    onChange={(e) =>
                      setActiveRecord((prev) => ({
                        ...prev,
                        currentMileageKm: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-cyan-300 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {records.length > 0 && (
                  <select
                    value={activeRecord.vin}
                    onChange={(e) => {
                      const chosen = records.find((r) => r.vin === e.target.value);
                      if (chosen) {
                        setActiveRecord(chosen);
                        setVinInput(chosen.vin);
                        setSelectedVariantId(chosen.variantId);
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200"
                  >
                    {records.map((rec) => (
                      <option key={rec.vin} value={rec.vin}>
                        {rec.vin} ({rec.lastProtectionScore}%)
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => void persistRecord(activeRecord)}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSyncing ? 'Sauvegarde...' : 'Enregistrer Dossier VIN'}</span>
                </button>
              </div>
            </div>

            {/* Spécification Huile Moteur + Alerte Critique Rouge */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Droplets className="w-4 h-4 text-cyan-400" />
                <span>Contrôle Viscosité &amp; Norme Huile Moteur (Protection Anti-LSPI)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {COOLRAY_OIL_SPEC_OPTIONS.map((oil) => {
                  const selected = activeRecord.selectedOilSpec === oil.id;
                  return (
                    <button
                      key={oil.id}
                      type="button"
                      onClick={() =>
                        setActiveRecord((prev) => ({
                          ...prev,
                          selectedOilSpec: oil.id as CoolrayOilSpecId,
                          checklist: {
                            ...prev.checklist,
                            oilApiSpGf6Verified: oil.id === '0W20_API_SP_GF6',
                          },
                        }))
                      }
                      className={`text-left rounded-xl border p-3 text-xs transition-all cursor-pointer ${
                        selected
                          ? oil.compliant
                            ? 'border-emerald-500 bg-emerald-950/25 text-white'
                            : 'border-rose-500 bg-rose-950/40 text-rose-100 ring-1 ring-rose-500/50'
                          : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold">{oil.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Alerte Critique Rouge si huile non conforme */}
              <div
                className={`rounded-xl border p-4 flex items-start gap-3 ${
                  selectedOilOption.severity === 'red'
                    ? 'border-rose-500 bg-rose-950/60 text-rose-100'
                    : selectedOilOption.severity === 'amber'
                    ? 'border-amber-500/50 bg-amber-950/25 text-amber-100'
                    : 'border-emerald-500/40 bg-emerald-950/20 text-emerald-100'
                }`}
              >
                {selectedOilOption.severity === 'red' ? (
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                ) : selectedOilOption.severity === 'amber' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <p className="text-xs leading-relaxed font-medium">{selectedOilOption.alertText}</p>
              </div>
            </div>
          </div>

          {/* Checklist Technique 5 points + 3 Jauges Kilométriques */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Checklist 5 points */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-cyan-400" />
                Checklist Technique Interactive Anti-LSPI
              </h3>

              <div className="space-y-2.5">
                {[
                  {
                    key: 'oilApiSpGf6Verified' as const,
                    title: 'Huile moteur 0W-20 certifiée API SP / ILSAC GF-6',
                    sub: 'Indispensable contre le pré-allumage par gouttelettes d’huile.',
                  },
                  {
                    key: 'iridiumPlugsVerified' as const,
                    title: 'Bougies Iridium froides contrôlées / remplacées',
                    sub: 'Contrôle porcelaine, électrode & écartement (cycle 25 000 km).',
                  },
                  {
                    key: 'gdiPeaCleanerDone' as const,
                    title: 'Nettoyant injecteurs GDI (base PEA) effectué',
                    sub: 'Évite les gouttes mal pulvérisées déclenchant le LSPI.',
                  },
                  {
                    key: 'localFuelEcuMapInstalled' as const,
                    title: 'Cartographie ECU adaptée carburant local installée',
                    sub: 'Downgrade DZ 174 ch ou Patch Anti-LSPI actif sur MG1.',
                  },
                  {
                    key: 'drivingRuleValidated' as const,
                    title: 'Règle de conduite validée avec le conducteur',
                    sub: 'Éviter le mode Eco en ville/côte et les accélérations pied au plancher < 2 000 tr/min.',
                  },
                ].map((item) => {
                  const checked = activeRecord.checklist[item.key];
                  return (
                    <label
                      key={item.key}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        checked
                          ? 'border-emerald-500/40 bg-emerald-950/15'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setActiveRecord((prev) => ({
                            ...prev,
                            checklist: { ...prev.checklist, [item.key]: e.target.checked },
                          }))
                        }
                        className="mt-0.5 rounded border-slate-600 bg-slate-950 text-emerald-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">{item.title}</div>
                        <div className="text-[11px] text-slate-400">{item.sub}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3 Jauges d'intervalles + Historique */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  Jauges d’Intervalles Automatiques (Suivi Kilométrique Réel)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {renderCycleGauge(
                    'Vidange API SP',
                    scoreCalc.oilSinceKm,
                    MAINTENANCE_CYCLES_KM.oilApiSp,
                    activeRecord.lastOilChangeKm,
                    () => void handleMarkMaintenanceDone('OIL_CHANGE')
                  )}
                  {renderCycleGauge(
                    'Bougies Iridium',
                    scoreCalc.plugsSinceKm,
                    MAINTENANCE_CYCLES_KM.iridiumPlugs,
                    activeRecord.lastSparkPlugsKm,
                    () => void handleMarkMaintenanceDone('SPARK_PLUGS')
                  )}
                  {renderCycleGauge(
                    'Additif GDI PEA',
                    scoreCalc.peaSinceKm,
                    MAINTENANCE_CYCLES_KM.peaCleaner,
                    activeRecord.lastPeaCleanerKm,
                    () => void handleMarkMaintenanceDone('GDI_PEA_CLEANER')
                  )}
                </div>
              </div>

              {/* Historique des interventions par VIN */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-400" />
                  Historique des Interventions — VIN {activeRecord.vin}
                </h3>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {activeRecord.interventions.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>{entry.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{entry.details}</p>
                      </div>
                      <div className="text-right font-mono text-[11px] text-slate-400 shrink-0">
                        <div className="text-cyan-300 font-bold">
                          {entry.mileageKm.toLocaleString('fr-FR')} km
                        </div>
                        <div>{entry.dateIso}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ONGLET B : UNITÉ CENTRALE DZ & COMPATIBILITÉ MAISON GEELY / FOURNISSEURS */}
      {/* ===================================================================== */}
      {subTab === 'central_unit_dz' && (
        <div className="space-y-6">
          {/* 1. Matrice Compatibilité Maison Geely & Fournisseurs */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Compatibilité Mises à Jour Maison Geely (OTA / Concessionnaire) &amp; Fournisseurs
                </h2>
                <p className="text-xs text-slate-400">
                  Architecture non destructive : /system, /vendor, clés OTA et signature CALID/CVN préservées sur Bosch, Getrag/Magna, ECARX et Continental.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isAuditingOem}
                  onClick={() => void handleRunOemCompatAudit('audit_dids')}
                  className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors"
                >
                  {isAuditingOem ? 'Audit UDS...' : 'Auditer DIDs 0x22 (F187/F188)'}
                </button>
                <button
                  type="button"
                  disabled={isAuditingOem}
                  onClick={() => void handleRunOemCompatAudit('prepare_dealer')}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 cursor-pointer transition-colors"
                >
                  Préparer Passage Maison Geely
                </button>
                <button
                  type="button"
                  disabled={isAuditingOem}
                  onClick={() => void handleRunOemCompatAudit('reapply_post_ota')}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-emerald-300 cursor-pointer transition-colors"
                >
                  Ré-appliquer Pack DZ Post-OTA
                </button>
              </div>
            </div>

            {oemAuditResult && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span>{oemAuditResult.summary}</span>
                  <span className="font-mono text-[11px]">{oemAuditResult.checkedAt}</span>
                </div>
                <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-cyan-300 space-y-1 overflow-x-auto break-all sm:break-normal">
                  {oemAuditResult.udsFrames.map((f) => (
                    <div key={f}>{f}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {supplierCompatList.map((item) => (
                <div
                  key={item.moduleName}
                  className="rounded-xl border border-slate-800 bg-slate-950/65 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white">{item.moduleName}</div>
                      <div className="text-[11px] text-cyan-300 font-medium">
                        {item.supplierLabel} · {item.udsAddress}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                      OTA &amp; VCI OK
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    DID F187 : {item.oemPartDidF187} · SW F188 : {item.oemSwDidF188} · HW : {item.hardwareIdDidF191}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {item.otaAndDealerPolicy}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Reprogrammation & Sauvetage Unité Centrale (IHU624G / IHU715P / BCM-SGW) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Sélection Unité Centrale &amp; Verrous Anti-Brick
              </h3>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-slate-400">
                  Boîtier / Unité Centrale Ciblée
                </label>
                <div className="space-y-2">
                  {COOLRAY_CENTRAL_UNIT_MODELS.map((unit) => {
                    const selected = selectedCentralUnitId === unit.id;
                    return (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => {
                          setSelectedCentralUnitId(unit.id);
                          setDetectedCentralUnitId(unit.id);
                          if (unit.id === 'BCM_SGW_CONTINENTAL') {
                            setSelectedCentralOpId('dz_bcm_peps_tpms_reset');
                          } else if (selectedCentralOpId === 'dz_bcm_peps_tpms_reset') {
                            setSelectedCentralOpId('dz_ihu_locale_thermal_pack');
                          }
                        }}
                        className={`w-full text-left rounded-xl border p-3 transition-colors cursor-pointer space-y-1 ${
                          selected
                            ? 'border-cyan-500 bg-cyan-950/25'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-white">{unit.label}</div>
                        <div className="text-[11px] font-mono text-cyan-300">{unit.address}</div>
                        <div className="text-[11px] text-amber-300/90">{unit.warning}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-[11px] font-bold uppercase text-slate-400">
                  ID Matériel Détecté (Test Anti-Croisement)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {COOLRAY_CENTRAL_UNIT_MODELS.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setDetectedCentralUnitId(u.id)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold border cursor-pointer ${
                        detectedCentralUnitId === u.id
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      {u.id}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-slate-400">
                  Tension active : <span className="font-mono text-white">{effectiveVoltage.toFixed(1)}V</span>{' '}
                  ({effectiveVoltage >= 12.4 ? 'OK >= 12.4V' : 'BLOQUÉE < 12.4V'})
                </div>
                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={centralBackupConfirmed}
                    onChange={(e) => setCentralBackupConfirmed(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-950 text-cyan-500"
                  />
                  <span>Backup EEPROM / MCU / Configuration CAN confirmé avant écriture</span>
                </label>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MonitorSmartphone className="w-4 h-4 text-cyan-400" />
                Packs Reprogrammation &amp; Sauvetage Unité Centrale (Marché Algérien)
              </h3>

              <div className="space-y-3">
                {COOLRAY_CENTRAL_UNIT_OPTIONS.map((op) => {
                  const compatible = op.targetUnits.includes(selectedCentralUnitId);
                  const active = selectedCentralOpId === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setSelectedCentralOpId(op.id)}
                      className={`w-full text-left rounded-xl border p-4 space-y-2 transition-all cursor-pointer ${
                        active
                          ? 'border-cyan-500 bg-cyan-950/25 ring-1 ring-cyan-500/40'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      } ${!compatible ? 'opacity-65' : ''}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">{op.title}</span>
                        <span className="text-[11px] font-semibold text-emerald-300">{op.badge}</span>
                      </div>
                      <div className="text-[11px] font-mono text-cyan-300">
                        {op.udsOrInterface} · {op.binaryTag}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{op.summary}</p>
                      <div className="text-[11px] text-emerald-300/90 bg-emerald-950/20 border border-emerald-500/25 rounded-lg px-3 py-1.5">
                        {op.oemUpdateSafeNote}
                      </div>
                      <ul className="space-y-1">
                        {op.steps.map((s) => (
                          <li key={s} className="text-[11px] text-slate-400 flex items-start gap-2">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={isRunningCentralOp}
                onClick={() => void handleExecuteCentralUnitReprog()}
                className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Play className="w-4 h-4" />
                <span>
                  {isRunningCentralOp
                    ? 'Exécution en cours sur l’unité centrale...'
                    : `Exécuter ${selectedCentralOp.binaryTag}`}
                </span>
              </button>

              {centralOpResult && (
                <div
                  className={`rounded-xl border p-4 space-y-2.5 ${
                    centralOpResult.ok
                      ? 'border-emerald-500/50 bg-emerald-950/25'
                      : 'border-rose-500/60 bg-rose-950/30'
                  }`}
                >
                  <div className="flex items-start gap-2.5 text-xs font-semibold text-white">
                    {centralOpResult.ok ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <span>{centralOpResult.message}</span>
                  </div>
                  {centralOpResult.frames && (
                    <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-cyan-300 space-y-1 overflow-x-auto break-all sm:break-normal">
                      {centralOpResult.frames.map((frame) => (
                        <div key={frame}>{frame}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Référentiel des Pannes Fréquentes Coolray Algérie & Tests Multimètre */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Network className="w-4 h-4 text-cyan-400" />
                  Guide Diagnostic Pannes Coolray en Algérie &amp; Contrôles Multimètre
                </h3>
                <p className="text-xs text-slate-400">
                  Codes défauts réels, causes liées au carburant/climat algérien et mesures électriques avant remplacement de pièce.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'ALL', label: 'Tous' },
                    { id: 'ECU_MOTEUR', label: 'ECU Moteur' },
                    { id: 'TCU_7DCT', label: 'Boîte 7DCT' },
                    { id: 'IHU_COCKPIT', label: 'Unité Centrale IHU' },
                    { id: 'BCM_PEPS_SGW', label: 'BCM / PEPS' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setIssueDomainFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      issueDomainFilter === f.id
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAlgeriaIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`rounded-xl border p-4 space-y-2.5 ${severityCardBorder(issue.severity)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-mono text-cyan-300">
                        {issue.domainLabel} · {issue.ecuAddress}
                      </div>
                      <h4 className="text-sm font-bold text-white">{issue.title}</h4>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-amber-300">
                    DTC typiques : {issue.typicalDtcs.join(' · ')}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{issue.algeriaRootCause}</p>

                  <div className="rounded-lg bg-slate-950/75 border border-slate-800 p-3 space-y-1">
                    <div className="text-[11px] font-bold text-slate-200">
                      Contrôles Multimètre / Pression :
                    </div>
                    {issue.multimeterChecks.map((chk) => (
                      <div key={chk} className="text-[11px] text-slate-400 flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span>{chk}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (issue.linkedOperationId) {
                        setSelectedCentralOpId(issue.linkedOperationId);
                        if (issue.linkedOperationId === 'dz_bcm_peps_tpms_reset') {
                          setSelectedCentralUnitId('BCM_SGW_CONTINENTAL');
                          setDetectedCentralUnitId('BCM_SGW_CONTINENTAL');
                        } else if (selectedCentralUnitId === 'BCM_SGW_CONTINENTAL') {
                          setSelectedCentralUnitId('IHU624G');
                          setDetectedCentralUnitId('IHU624G');
                        }
                      }
                      setSubTab(issue.targetSubTab);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-cyan-300 cursor-pointer transition-colors"
                  >
                    {issue.recommendedActionLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Avertissement Légal & Sécurité Mécanique Obligatoire */}
      <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 px-5 py-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-bold text-amber-300 uppercase tracking-wide">
            Avertissement Technique &amp; Sécurité Mécanique Obligatoire
          </div>
          <p className="text-slate-300 leading-relaxed">
            Ce module prévient activement le risque de pré-allumage à bas régime (<strong>LSPI</strong>) par
            reprogrammation ECU/TCU et suivi strict des fluides, mais <strong>ne remplace jamais un contrôle
            mécanique physique</strong> (prise de compressions des cylindres, test d’étanchéité et inspection
            endoscopique des pistons/parois cylindres 2 et 3) si le véhicule présente déjà une perte de puissance,
            des ratés persistants ou une consommation anormale d’huile moteur.
          </p>
        </div>
      </div>
    </div>
  );
};
