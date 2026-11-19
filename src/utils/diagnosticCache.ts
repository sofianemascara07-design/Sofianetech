import {
  ClientActivityRecord,
  DatabaseStats,
  DiagnosticScanSession,
  DtcCode,
  QuickScanReport,
  SdrProspect,
  Vehicle,
} from '../types/automotive';
import type { AiVerificationInfo } from '../components/AiVerificationBadge';

const SCANNER_CACHE_KEY = 'autopro_diag_scanner_cache_v1';
const HISTORY_CACHE_KEY = 'autopro_diag_history_cache_v1';
const SDR_CACHE_KEY = 'autopro_sdr_prospects_cache_v1';

export interface ScannerTelemetrySnapshot {
  rpm: number;
  boost: number;
  coolant: number;
  railBar: number;
  maf: number;
  batteryVoltage: number;
}

export interface ScannerCacheSnapshot {
  vehicleId: string;
  vehicleLabel: string;
  vehicleObj?: Vehicle;
  dtcList: DtcCode[];
  selectedDtcCode: string | null;
  telemetry: ScannerTelemetrySnapshot;
  aiReport: string | null;
  aiVerification: AiVerificationInfo | null;
  quickScanReport?: QuickScanReport | null;
  updatedAt: string;
}

export interface HistoryCacheSnapshot {
  scans: DiagnosticScanSession[];
  stats: DatabaseStats | null;
  activities: ClientActivityRecord[];
  updatedAt: string;
}

export interface SdrCacheSnapshot {
  prospects: SdrProspect[];
  updatedAt: string;
}

function safeReadJson<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWriteJson<T>(key: string, value: T): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveScannerCache(snapshot: Omit<ScannerCacheSnapshot, 'updatedAt'>): ScannerCacheSnapshot {
  const full: ScannerCacheSnapshot = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };
  safeWriteJson(SCANNER_CACHE_KEY, full);
  return full;
}

export function loadScannerCache(): ScannerCacheSnapshot | null {
  return safeReadJson<ScannerCacheSnapshot>(SCANNER_CACHE_KEY);
}

export function clearScannerCache(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(SCANNER_CACHE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function saveHistoryCache(snapshot: Omit<HistoryCacheSnapshot, 'updatedAt'>): HistoryCacheSnapshot {
  const full: HistoryCacheSnapshot = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };
  safeWriteJson(HISTORY_CACHE_KEY, full);
  return full;
}

export function loadHistoryCache(): HistoryCacheSnapshot | null {
  return safeReadJson<HistoryCacheSnapshot>(HISTORY_CACHE_KEY);
}

export function prependScanToHistoryCache(scan: DiagnosticScanSession): void {
  const existing = loadHistoryCache();
  const prevScans = existing?.scans || [];
  const nextScans = [scan, ...prevScans.filter((s) => s.id !== scan.id)].slice(0, 100);
  saveHistoryCache({
    scans: nextScans,
    stats: existing?.stats || null,
    activities: existing?.activities || [],
  });
}

export function saveSdrCache(prospects: SdrProspect[]): SdrCacheSnapshot {
  const full: SdrCacheSnapshot = {
    prospects,
    updatedAt: new Date().toISOString(),
  };
  safeWriteJson(SDR_CACHE_KEY, full);
  return full;
}

export function loadSdrCache(): SdrCacheSnapshot | null {
  return safeReadJson<SdrCacheSnapshot>(SDR_CACHE_KEY);
}

export function formatCacheTimestampFr(iso?: string | null): string {
  if (!iso) return 'Inconnu';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'Inconnu';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "à l'instant";
  if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
