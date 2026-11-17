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
  sizeMb: number;
  description: string;
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

export interface LicenseSession {
  key: string;
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
  lastUsedAt?: string | null;
  notes?: string;
}

export interface SecuritySettings {
  demoLinksEnabled: boolean;
  defaultDemoMinutes: number;
  revokedAllDemosBefore?: string | null;
  blockedDemoKeys: string[];
  adminPasscodeUpdatedAt?: string;
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
  actionType: 'activation' | 'scan_started' | 'flash_executed' | 'dtc_cleared' | 'keyless_toggle' | 'camera_view' | 'app_installed' | 'heartbeat';
  actionDetails: string;
  timestamp: string;
  vehicleName?: string;
  locationCity?: string;
  ipAddress?: string;
  durationMinutes?: number;
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

