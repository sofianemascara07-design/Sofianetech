export type ConnectionMode = 'cable' | 'wifi' | 'bluetooth';

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  engine: string;
  fuelType: 'Diesel' | 'Essence' | 'Hybride' | 'Électrique';
  ecuType: string;
  protocol: 'UDS (ISO 14229)' | 'CAN 2.0B (500k)' | 'K-Line (ISO 9141)' | 'DoIP (ISO 13400)';
  originalHp: number;
  originalTorque: number;
  marketSegment?: 'Chinois DZ' | 'Européen (Made in China)' | 'Fiat Algérie' | 'Populaire DZ' | 'Européen' | 'Utilitaire';
}

export interface DtcCode {
  code: string;
  system: string;
  descriptionFr: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'Actif' | 'Fugitif' | 'Permanent';
  freezeFrame?: {
    rpm: number;
    speed: number;
    coolantTemp: number;
    fuelPressure: number;
  };
}

export interface FlashStage {
  id: string;
  name: string;
  badge: string;
  description: string;
  hpGain: number;
  torqueGain: number;
  boostDeltaBar: number;
  category: 'performance' | 'eco' | 'custom' | 'delete';
  recommendedFor: string;
}

export interface TabletApp {
  id: string;
  name: string;
  category:
    | 'CarPlay & Google'
    | 'TV, Coran & Radio DZ'
    | 'Multi-Écran & HDMI'
    | 'Réseaux Sociaux'
    | 'Diagnostic'
    | 'Navigation'
    | 'Multimédia'
    | 'Personnalisation'
    | 'Utilitaire';
  version: string;
  installedVersion?: string;
  hasUpdate?: boolean;
  sizeMb: number;
  description: string;
  releaseNotes?: string[];
  headUnitCompatibility?: string;
  packageName: string;
  installed: boolean;
  icon: string;
  minAndroidVersion: string;
  badge?: string;
}

export interface TranslationItem {
  key: string;
  original: string;
  translated: string;
  context: string;
}

export interface SmartechDzPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  targetPackage: string;
  status: 'installed' | 'ready' | 'syncing' | 'error';
  sizeKb: number;
}

export interface SmartechDzConfig {
  isDetected: boolean;
  packageName: string;
  appVersion: string;
  devicePath: string;
  vciSerial: string;
  ipcPort: number;
  lastSyncTimestamp?: string;
  tokenStatus: 'Validé' | 'En attente' | 'Non détecté';
}

export type LicenseTier = 'admin' | 'master' | 'reprog' | 'standard' | 'tablette_chinois' | 'demo';

export type VaultPaidTier = 'master' | 'reprog' | 'standard' | 'tablette_chinois';

export type VaultFileCategory = 'APK Android' | 'Firmware / .BIN' | 'Pack Atelier';

export interface VaultPackageRecord {
  id: string;
  title: string;
  fileName: string;
  storedFileName: string;
  extension: '.apk' | '.bin' | '.zip' | '.eep' | '.hex';
  category: VaultFileCategory;
  version: string;
  sizeBytes: number;
  sha256: string;
  allowedTiers: VaultPaidTier[];
  isActive: boolean;
  downloadCount: number;
  notes?: string;
  uploadedAt: string;
  updatedAt: string;
}

export type PublicVaultPackage = Omit<VaultPackageRecord, 'storedFileName'>;

export type ConnectionPresenceStatus = 'online' | 'unstable' | 'offline' | 'never_connected';

export interface LicenseSession {
  key: string;
  subscriberId?: string;
  phone?: string;
  createdAt?: string;
  clientName: string;
  hwid: string;
  tier: LicenseTier;
  tierLabel: string;
  activatedAt: string;
  expiresAt: string;
  demoExpiresAt?: string | null;
  isValid: boolean;
  isAdmin?: boolean;
  signature: string;
  allowedModules: string[];
}

export interface SubscriberRecord {
  id: string;
  clientName: string;
  phone?: string;
  licenseKey: string;
  boundHwid: string | null;
  tier: LicenseTier;
  status: 'active' | 'suspended' | 'revoked';
  maxDemoMinutes?: number | null;
  demoExpiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  lastUsedAt?: string | null;
  lastHeartbeatAt?: string | null;
  notes?: string;
  lastLatencyMs?: number | null;
  lastStabilityScore?: number | null;
  lastConnectionMode?: string | null;
  lastReconnectCount?: number | null;
  lastIp?: string | null;
  wakeLockActive?: boolean;
  connectionStatus?: ConnectionPresenceStatus;
}

export interface RevokedSubscriptionTombstone {
  id: string;
  licenseKey: string;
  revokedAt: string;
  reason?: string;
}

export interface SecuritySettings {
  demoLinksEnabled: boolean;
  defaultDemoMinutes: number;
  revokedAllDemosBefore?: string | null;
  blockedDemoKeys: string[];
  adminPasscodeUpdatedAt?: string;
  revokedRecords?: RevokedSubscriptionTombstone[];
}

export interface ComfortState {
  doors: {
    driverLocked: boolean;
    passengerLocked: boolean;
    rearLeftLocked: boolean;
    rearRightLocked: boolean;
    trunkLocked: boolean;
    trunkOpen: boolean;
    childLockActive: boolean;
    autoLockSpeed: boolean;
  };
  windows: {
    frontLeft: number; // 0 (closed) to 100 (open)
    frontRight: number;
    rearLeft: number;
    rearRight: number;
    lockRearWindows: boolean;
  };
  sunroof: {
    position: number; // 0 (closed), 15 (tilt/aération), 100 (open)
    mode: 'closed' | 'tilt' | 'open';
    shadePosition: number; // 0 (closed), 100 (open)
    rainSensorAutoClose: boolean;
  };
  climate: {
    power: boolean;
    tempDriver: number;
    tempPassenger: number;
    fanSpeed: number; // 0 to 7
    airflow: 'face' | 'feet' | 'windshield' | 'face_feet' | 'windshield_feet';
    ac: boolean;
    acMax: boolean;
    auto: boolean;
    sync: boolean;
    recirculation: boolean;
    defrostFront: boolean;
    defrostRear: boolean;
    seatHeatDriver: number; // 0 to 3
    seatHeatPassenger: number; // 0 to 3
  };
}

export interface DigitalKey {
  ownerName: string;
  ownerPhone: string;
  vehicleVin: string;
  deviceModel: string;
  keyId: string;
  pairedAt: string;
  status: 'active' | 'revoked' | 'standby';
  proximityThresholdMeters: number; // default 3.0
  autoLockEnabled: boolean;
  autoUnlockEnabled: boolean;
  emergencyPin: string; // 6-digit code e.g. "884926"
  isEngineBlocked: boolean; // Anti-theft kill switch
  alarmActive: boolean;
  lastKnownGpsLocation?: {
    lat: number;
    lng: number;
    address: string;
    timestamp: string;
  };
}
export interface ScanDtcItem {
  code: string;
  system: string;
  descriptionFr: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'Actif' | 'Fugitif' | 'Permanent' | 'Résolu';
  repairRecommendation: string;
  estimatedCostDZD?: number;
  laborHours?: number;
  partReference?: string;
  rootCause?: string;
}

export interface DiagnosticScanSession {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vin: string;
  year: number;
  engine: string;
  mileageKm: number;
  clientName: string;
  technicianName: string;
  timestamp: string;
  durationSeconds: number;
  protocolUsed: string;
  batteryVoltage: number;
  overallHealthScore: number; // 0 to 100
  status: 'passed' | 'warning' | 'critical' | 'resolved';
  dtcCodes: ScanDtcItem[];
  technicianNotes?: string;
  repairedAt?: string;
  repairCompleted?: boolean;
}

export interface DatabaseStats {
  engine: string;
  status: 'OPTIMAL' | 'DEGRADED';
  totalScans: number;
  totalVehicles: number;
  totalClients: number;
  totalDtcTracked: number;
  avgQueryLatencyMs: number;
  cacheHitRate: number;
  storageSizeBytes: number;
  lastOptimizedAt: string;
  indexedKeys: number;
  walEnabled: boolean;
}

export interface ClientActivityRecord {
  id: string;
  clientName: string;
  hwid: string;
  actionType: 'activation' | 'scan_started' | 'flash_executed' | 'dtc_cleared' | 'keyless_toggle' | 'camera_view' | 'app_installed' | 'vault_download' | 'heartbeat';
  actionDetails: string;
  timestamp: string;
  vehicleName?: string;
  locationCity?: string;
  ipAddress?: string;
  durationMinutes?: number;
  latencyMs?: number;
  stabilityScore?: number;
  reconnectCount?: number;
  wakeLockActive?: boolean;
}

export interface VehicleCameraSystem {
  activeCamera: 'rear' | 'front' | 'left' | 'right' | '360' | 'dashcam';
  isReverseEngaged: boolean;
  guidelinesActive: boolean;
  steeringAngleDeg: number;
  nightVisionActive: boolean;
  recording: boolean;
  cameraResolution: '1080p AHD' | '720p HD' | 'CVBS';
  brightness: number;
  contrast: number;
  distanceToObstacleMeters?: number;
}

export type SdrProspectStatus =
  | 'a_visiter'
  | 'visite_fait'
  | 'demo_envoyee'
  | 'a_relancer'
  | 'abonne'
  | 'refus';

export type SdrProspectSpecialty =
  | 'electricien_auto'
  | 'multimedia_ecrans'
  | 'mecanicien_diag'
  | 'chiptuner_immo'
  | 'concession_multi';

export interface SdrProspect {
  id: string;
  garageName: string;
  contactName?: string;
  phone: string;
  wilaya: string;
  commune?: string;
  specialty: SdrProspectSpecialty;
  status: SdrProspectStatus;
  interestedPack?: 'master' | 'reprog' | 'tablette_chinois' | 'standard';
  estimatedValueDzd: number;
  nextFollowUpDate?: string;
  notes?: string;
  lastContactAt: string;
  createdAt: string;
}

export type QuickScanEcuId = 'gateway' | 'engine' | 'abs' | 'airbag';

export type QuickScanEcuStatus = 'pending' | 'scanning' | 'ok' | 'faults' | 'no_response';

export interface QuickScanEcuResult {
  ecuId: QuickScanEcuId;
  name: string;
  shortName: string;
  canAddress: string;
  rxAddress: string;
  protocol: string;
  status: QuickScanEcuStatus;
  dtcs: DtcCode[];
  latencyMs: number;
  rawInfo?: string;
}

export interface QuickScanReport {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vin: string | null;
  transport: string;
  batteryVoltage: number;
  scannedAt: string;
  durationMs: number;
  healthScore: number;
  totalDtcs: number;
  ecus: QuickScanEcuResult[];
  summaryText?: string;
}

// =========================================================
// MODULE 1: CÂBLAGE & PINOUTS (CROWDSOURCING ATELIER DZ)
// =========================================================
export type PinoutModuleType = 'ECU' | 'BCM' | 'ABS' | 'FUSEBOX';

export interface EcuPinRow {
  connector: string; // Ex: "C1 (Noir 60 broches)", "Pin A12"
  pinNumber: string;
  wireColor: string;
  signalName: string;
  expectedTestValue: string; // Ex: "+12V après contact (APC) | 0V contact coupé"
  notes?: string;
}

export interface FuseSlotRow {
  slotCode: string; // Ex: "F08", "R2"
  amps: string;     // Ex: "15A", "30A", "Relais 40A"
  circuit: string;  // Ex: "Calculateur Moteur ECM + Bobines"
  powerType: 'BAT (+30)' | 'APC (+15)' | 'ACCESSOIRE' | 'MASSE';
}

export interface EcuPinoutEntry {
  id: string;
  brand: 'Chery' | 'Geely' | 'MG' | 'BYD' | 'DFSK' | 'Changan' | 'Autre';
  model: string;
  yearRange: string;
  engineOrVersion: string;
  moduleType: PinoutModuleType;
  ecuSupplier: string; // Ex: "Bosch / UAES MED17.8.10", "Delphi MT62.1", "SAIC BCM"
  title: string;
  contributorName: string;
  contributorWilaya: string;
  verifiedVotes: number;
  reportFlags: number;
  votedByIds?: string[];
  pins: EcuPinRow[];
  fuses?: FuseSlotRow[];
  createdAt: string;
  updatedAt: string;
}

// =========================================================
// MODULE 2: CALIBRATION ADAS (CIBLES PDF 1:1 & COTES)
// =========================================================
export type AdasTargetPattern =
  | 'dual_circle_checker'
  | 'mg_lane_checker'
  | 'byd_radar_corner'
  | 'avm_360_mat';

export interface AdasModelSpec {
  id: string;
  brand: 'Chery' | 'Geely' | 'MG' | 'BYD' | 'DFSK';
  model: string;
  years: string;
  systemName: string;
  pattern: AdasTargetPattern;
  targetName: string;
  distanceFromFrontAxleMm: number;
  cameraOrTargetHeightMm: number;
  lateralOffsetMm: number;
  targetWidthMm: number;
  targetHeightMm: number;
  checkerSquareMm?: number;
  circleDiameterMm?: number;
  circleSpacingMm?: number;
  obdProcedure: string;
  calibrationNotes: string;
}

// =========================================================
// MODULE 3: DÉCODEUR VIN CALCULATEUR CHINE
// =========================================================
export interface VinEcuCandidate {
  system: 'Moteur (ECM)' | 'Boîte (TCU)' | 'Freinage (ABS/ESP)' | 'Habitacle (BCM)';
  supplier: string;
  ecuModel: string;
  confidence: 'Élevée' | 'Moyenne (Série mixte CN)';
  protocol: string;
  visualCheckTip: string;
}

export interface VinEcuDecodeResult {
  vin: string;
  isValidFormat: boolean;
  checkDigitValid: boolean | null;
  wmi: string;
  manufacturer: string;
  brand: string;
  estimatedModelRange: string;
  modelYear: number | null;
  plantCode: string;
  vdsCode: string;
  seriesSwitchWarning: string | null;
  candidates: VinEcuCandidate[];
}

// =========================================================
// MODULE 4: TRADUCTEUR & DÉPANNEUR DTC BRUT IA
// =========================================================
export interface DtcRawMultimeterTest {
  point: string;
  expectedValue: string;
  condition: string;
}

export interface DtcRawTranslateResult {
  rawInput: string;
  detectedCode: string | null;
  scannerSource: string;
  cleanFrenchTitle: string;
  affectedSystem: string;
  urgency: 'Critique' | 'Élevée' | 'Modérée' | 'Faible';
  knownCausesDz: string[];
  multimeterTests: DtcRawMultimeterTest[];
  repairSteps: string[];
  cachedOffline?: boolean;
  translatedAt: string;
}

// =========================================================
// MODULE 5: TRANSMISSION & TCU DIAGNOSTIC SUITE (UDS 0x7E1/0x7E9)
// =========================================================
export type TransmissionType = 'BVA' | 'DSG_DCT' | 'CVT' | 'ROBOTISEE';

export type TransmissionTransportMode =
  | 'SIMULATION'
  | 'ELM327_BRIDGE'
  | 'J2534_PASSTHRU'
  | 'LOCAL_PC_AGENT';

export type LocalAgentWritePolicy = 'ASK_EACH_WRITE' | 'AUTO_ON_REQUEST';

export interface LocalAgentDriverInfo {
  name: string;
  vendor?: string;
  dllPath?: string;
  kind: 'J2534_DLL' | 'COM_PORT' | 'SIMULATED_VCI';
}

export interface LocalAgentWriteRequest {
  id: string;
  createdAt: string;
  targetModule: string;
  operationType: 'FLASH_TCU' | 'ROUTINE_UDS' | 'CLEAR_DTC' | 'EEPROM_WRITE';
  title: string;
  txId: string;
  serviceHex: string;
  payloadHex: string;
  fileName?: string;
  sha256Short?: string;
  batteryVoltage: number;
  status: 'PENDING_APPROVAL' | 'EXECUTED' | 'REJECTED' | 'FAILED';
  resultMessage?: string;
  rxHex?: string;
  executedAt?: string;
}

export interface LocalAgentFlashProgress {
  active: boolean;
  stage: string;
  percent: number;
  testerPresentActive: boolean;
  backupPath?: string;
  seedKeyStatus?: string;
  recoveryAvailable?: boolean;
  lastError?: string | null;
}

export interface LocalAgentStatus {
  connected: boolean;
  version: string;
  agentEngine?: 'PYTHON_FASTAPI_J2534' | 'NODE_BRIDGE';
  hardwareMode?: 'J2534_REAL' | 'NO_HARDWARE_BENCH';
  hostname: string;
  osPlatform: string;
  nodeVersion: string;
  agentUrl: string;
  writePolicy: LocalAgentWritePolicy;
  batteryVoltage: number;
  voltageStatus?: 'OK' | 'VOLTAGE_LOW' | 'VOLTAGE_HIGH';
  vbattSource?: string;
  drivers: LocalAgentDriverInfo[];
  pendingRequests: LocalAgentWriteRequest[];
  recentRequests: LocalAgentWriteRequest[];
  executedCount: number;
  lastPingAt: string;
  flashProgress?: LocalAgentFlashProgress;
}

// =========================================================
// MODULE 6: IMMO CLONAGE & ALL KEYS LOST (AKL) SÉCURISÉ
// =========================================================
export type AklKeyOperationMode = 'ADD_KEY_CLONE' | 'ALL_KEYS_LOST';

export type AklRiskLevel = 'Faible' | 'Moyen' | 'Élevé (SGW)' | 'Critique (Anti-Brick)';

export type AklProcedureMethod =
  | 'OBD'
  | 'OBD + Bypass SGW'
  | 'EEPROM Banc'
  | 'Bench MCU (D-Flash/P-Flash)';

export interface EepromGeometryProfile {
  id: string;
  label: string;
  category: 'EEPROM' | 'MCU_DFLASH' | 'FLASH_TRICORE';
  exactSizeBytes: number;
  familyHint: string;
  notes: string;
}

export interface AklTransponderSpec {
  chipName: string;
  chipTechnology: string;
  transponderOnly: boolean;
  supportsRemoteCentralLocking: boolean;
  warningNote: string;
  precodingMode: string;
}

export interface AklVehicleProcedure {
  id: string;
  brand: string;
  model: string;
  yearRange: string;
  immoSystem: string;
  mcuOrEeprom: string;
  defaultGeometryId: string;
  transponder: AklTransponderSpec;
  mechanicalBlade: string;
  remoteFrequency: string;
  riskLevel: AklRiskLevel;
  sgwRequired: boolean;
  minBatteryVoltage: number;
  sensitiveEcuWarning: string | null;
  blockingConfirmations: string[];
  procedureMethod: AklProcedureMethod;
  steps: string[];
  cryptoTablePlugSlot: string;
}

export interface AklHexPreviewRow {
  offsetHex: string;
  hexBytes: string[];
  asciiText: string;
}

export interface AklDumpChecksums {
  crc32Hex: string;
  sum16Hex: string;
  sum8Hex: string;
  sha256Hex: string;
}

export interface AklDumpAnalysisResult {
  success: boolean;
  blockedReason: string | null;
  fileName: string;
  fileFormat: 'BIN' | 'EEP' | 'HEX';
  geometryId: string;
  geometryLabel: string;
  expectedSizeBytes: number;
  actualSizeBytes: number;
  sizeMatchesGeometry: boolean;
  checksumBefore: AklDumpChecksums;
  checksumAfter: AklDumpChecksums | null;
  entropyBits: number;
  extractedVin: string | null;
  extractedHardwareRefs: string[];
  keySlotObservation: string;
  cryptoTableStatus: string;
  hexPreviewRows: AklHexPreviewRow[];
  backupFileName: string;
  readyFileName: string;
  analyzedAt: string;
}

export type TransmissionSimScenario =
  | 'optimal_hot'
  | 'slip_overheat'
  | 'mechatronic_pressure_drop'
  | 'solenoid_u0101_limp';

export interface SolenoidCurrentReading {
  id: string; // Ex: "N88", "N89", "N90", "N91", "N92", "N93"
  label: string;
  targetMa: number;
  actualMa: number;
  dutyCyclePct: number;
  status: 'OK' | 'Dérive' | 'Ouvert/C-C';
}

export interface TransmissionLiveData {
  transmissionType: TransmissionType;
  ecuName: string;
  atfTempC: number;
  targetPressureBar: number;
  actualPressureBar: number;
  currentGear: string;
  clutchState: string;
  inputShaftRpm: number;
  outputShaftRpm: number;
  slipRpm: number;
  tcuVoltage: number;
  solenoids: SolenoidCurrentReading[];
  timestamp: string;
}

export interface TransmissionDtc {
  code: string;
  rangeCategory: 'P0700-P0999' | 'P1700-P1899' | 'P2700-P2795' | 'U0101 / CAN';
  descriptionFr: string;
  severity: 'critical' | 'high' | 'medium';
  status: 'Actif' | 'Fugitif' | 'Mémorisé';
  rawHexFrame?: string;
}

export interface UdsCanFrameLog {
  id: string;
  timestamp: string;
  direction: 'TX -> 0x7E1' | 'RX <- 0x7E9';
  serviceHex: string;
  rawHex: string;
  label: string;
  transport: TransmissionTransportMode;
  isNegativeResponse?: boolean;
}

export interface TransmissionAiDiagnosticResult {
  probableCause: {
    category: 'Électrique/Capteur' | 'Hydraulique/Mécatronique' | 'Mécanique';
    summary: string;
    details: string[];
  };
  controlTests: Array<{
    tool: 'Multimètre' | 'Oscilloscope' | 'Manomètre / UDS';
    point: string;
    expectedValue: string;
  }>;
  repairProcedure: string[];
  aiVerification?: {
    verified: boolean;
    provider: string;
    guardrailsApplied: string[];
    blockedHallucinations: string[];
    confidenceLevel: 'STRICT_VERIFIED' | 'WARNING_FILTERED';
    checkedAt: string;
  };
  generatedAt: string;
}

// =========================================================
// MODULE 7: GEELY COOLRAY — PROTECTION ANTI-LSPI & FLASH ECU/TCU
// =========================================================
export type CoolrayVariantId =
  | 'coolray_phase1_3cyl'
  | 'coolray_dz_export_4cyl'
  | 'coolray_cn_battle_181'
  | 'coolray_lite_dvvt_atmo';

export type CoolrayCalibrationId =
  | 'downgrade_cn_to_dz'
  | 'custom_anti_lspi_patch'
  | 'tcu_7dct_anti_lug';

export type CoolrayEcuHardwareFamily = 'MG1CS080' | 'MG1US008' | 'MG1UA008' | 'BOSCH_ATMO_ME17';

export type CoolrayOilSpecId =
  | '0W20_API_SP_GF6'
  | '5W30_API_SP'
  | '5W40_API_SN'
  | '10W40_API_SL_SN';

export type LspiRiskSeverity = 'green' | 'amber' | 'red';

export interface CoolrayEngineProfile {
  id: CoolrayVariantId;
  label: string;
  yearRange: string;
  engineCode: string;
  cylinders: string;
  powerHp: string;
  torqueNm: string;
  transmission: string;
  ecuModel: string;
  ecuHardwareFamily: CoolrayEcuHardwareFamily;
  compatibleHardwareFamilies: CoolrayEcuHardwareFamily[];
  isTurboDirectInjection: boolean;
  lspiPriorityLevel: 'PRIORITAIRE_CHINE_VI' | 'ELEVE_TURBO_GDI' | 'EXCLU_ATMO_STANDARD';
  calibrationNote: string;
  supportedCalibrations: CoolrayCalibrationId[];
}

export interface CoolrayCalibrationOption {
  id: CoolrayCalibrationId;
  title: string;
  targetController: 'ECU Moteur (0x7E0 -> 0x7E8)' | 'TCU Boîte 7DCT (0x7E1 -> 0x7E9)';
  badge: string;
  summary: string;
  technicalAdjustments: string[];
  recommendedForVariants: CoolrayVariantId[];
  allowedHardwareFamilies: CoolrayEcuHardwareFamily[];
  flashBinaryTag: string;
}

export interface CoolrayObdPidSnapshot {
  rpm: number;
  engineLoadPct: number;
  knockRetardDeg: number; // Valeurs négatives ex: -1.5°, -4.2°
  misfiresCyl1: number;
  misfiresCyl2: number;
  misfiresCyl3: number;
  misfiresCyl4: number;
  stftPct: number;
  ltftPct: number;
  iatCelsius: number;
  boostBar: number;
  capturedAt: string;
}

export interface CoolraySafetyChecklist {
  oilApiSpGf6Verified: boolean;
  iridiumPlugsVerified: boolean;
  gdiPeaCleanerDone: boolean;
  localFuelEcuMapInstalled: boolean;
  drivingRuleValidated: boolean;
}

export interface CoolrayInterventionLog {
  id: string;
  dateIso: string;
  mileageKm: number;
  type:
    | 'OIL_CHANGE'
    | 'SPARK_PLUGS'
    | 'GDI_PEA_CLEANER'
    | 'ECU_FLASH'
    | 'TCU_FLASH'
    | 'OBD_AUDIT'
    | 'CENTRAL_UNIT_REPROG'
    | 'BCM_RESET';
  title: string;
  details: string;
  technician?: string;
}

export interface CoolrayVehicleFollowUpRecord {
  vin: string;
  variantId: CoolrayVariantId;
  ownerOrPlate: string;
  currentMileageKm: number;
  lastOilChangeKm: number;
  lastSparkPlugsKm: number;
  lastPeaCleanerKm: number;
  selectedOilSpec: CoolrayOilSpecId;
  checklist: CoolraySafetyChecklist;
  lastObdAuditStatus: LspiRiskSeverity;
  lastProtectionScore: number;
  installedCalibrations: CoolrayCalibrationId[];
  interventions: CoolrayInterventionLog[];
  updatedAt: string;
}

export type CoolrayCentralUnitModelId =
  | 'IHU624G'
  | 'IHU715P'
  | 'IHU535G_ECARX'
  | 'BCM_SGW_CONTINENTAL';

export type CoolrayCentralUnitOpId =
  | 'dz_ihu_locale_thermal_pack'
  | 'dz_ihu_camera_lvds_realign'
  | 'dz_bcm_peps_tpms_reset'
  | 'dz_ihu_bootloop_rescue';

export interface CoolrayAlgeriaIssueEntry {
  id: string;
  domain: 'ECU_MOTEUR' | 'TCU_7DCT' | 'IHU_COCKPIT' | 'BCM_PEPS_SGW';
  domainLabel: string;
  severity: LspiRiskSeverity;
  title: string;
  ecuAddress: string;
  typicalDtcs: string[];
  algeriaRootCause: string;
  multimeterChecks: string[];
  recommendedActionLabel: string;
  targetSubTab: 'flash' | 'obd_audit' | 'maintenance' | 'central_unit_dz';
  linkedOperationId?: CoolrayCentralUnitOpId;
}

export interface CoolrayCentralUnitOption {
  id: CoolrayCentralUnitOpId;
  title: string;
  targetUnits: CoolrayCentralUnitModelId[];
  udsOrInterface: string;
  badge: string;
  oemUpdateSafeNote: string;
  summary: string;
  steps: string[];
  binaryTag: string;
}

export type CoolraySupplierId = 'BOSCH' | 'GETRAG_MAGNA' | 'ECARX_GEELY' | 'CONTINENTAL';

export interface CoolrayOemModuleCompat {
  moduleName: string;
  supplierId: CoolraySupplierId;
  supplierLabel: string;
  udsAddress: string;
  oemPartDidF187: string;
  oemSwDidF188: string;
  hardwareIdDidF191: string;
  otaAndDealerPolicy: string;
  preservesSignedPartitions: boolean;
  supportsOfficialRestore: boolean;
}



