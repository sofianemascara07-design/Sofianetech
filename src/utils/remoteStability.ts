import { apiFetch, apiUrl } from './apiBridge';

export type RemoteConnectionHealthStatus = 'optimal' | 'degraded' | 'reconnecting' | 'offline';

export interface RemoteStabilitySnapshot {
  status: RemoteConnectionHealthStatus;
  navigatorOnline: boolean;
  latencyMs: number | null;
  avgLatencyMs: number | null;
  packetSuccessRate: number; // 0..100
  stabilityScore: number; // 0..100
  keepAliveActive: boolean;
  keepAliveCount: number;
  lastKeepAliveAt: string | null;
  wakeLockSupported: boolean;
  wakeLockActive: boolean;
  reconnectCount: number;
  lastError: string | null;
}

class RemoteStabilityManager {
  private snapshot: RemoteStabilitySnapshot = {
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'optimal',
    navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    latencyMs: null,
    avgLatencyMs: null,
    packetSuccessRate: 100,
    stabilityScore: 100,
    keepAliveActive: false,
    keepAliveCount: 0,
    lastKeepAliveAt: null,
    wakeLockSupported: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
    wakeLockActive: false,
    reconnectCount: 0,
    lastError: null,
  };

  private listeners = new Set<(snap: RemoteStabilitySnapshot) => void>();
  private latencySamples: number[] = [];
  private requestOutcomes: boolean[] = [];
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private wakeLockSentinel: { release: () => Promise<void>; addEventListener?: (t: string, fn: () => void) => void } | null = null;
  private wantWakeLock = false;
  private browserListenersBound = false;

  constructor() {
    this.bindBrowserListeners();
  }

  private bindBrowserListeners() {
    if (this.browserListenersBound || typeof window === 'undefined') return;
    this.browserListenersBound = true;

    window.addEventListener('online', () => {
      this.snapshot.navigatorOnline = true;
      this.snapshot.lastError = null;
      this.snapshot.reconnectCount += 1;
      this.recomputeScore();
      void this.probeBackendLatency();
    });

    window.addEventListener('offline', () => {
      this.snapshot.navigatorOnline = false;
      this.snapshot.status = 'offline';
      this.snapshot.lastError = 'Connexion Internet client interrompue (4G/WiFi hors ligne).';
      this.recomputeScore();
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (this.wantWakeLock && !this.wakeLockSentinel) {
            void this.acquireWakeLock();
          }
          if (this.snapshot.keepAliveActive) {
            void this.probeBackendLatency();
          }
        }
      });
    }
  }

  public subscribe(listener: (snap: RemoteStabilitySnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): RemoteStabilitySnapshot {
    return { ...this.snapshot };
  }

  private emit() {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private recomputeScore() {
    const navOk = typeof navigator === 'undefined' ? true : navigator.onLine;
    this.snapshot.navigatorOnline = navOk;

    if (!navOk) {
      this.snapshot.status = 'offline';
      this.snapshot.stabilityScore = 0;
      this.emit();
      return;
    }

    const totalOutcomes = this.requestOutcomes.length;
    const successCount = this.requestOutcomes.filter(Boolean).length;
    const successRate = totalOutcomes > 0 ? Math.round((successCount / totalOutcomes) * 100) : 100;
    this.snapshot.packetSuccessRate = successRate;

    const avgLat =
      this.latencySamples.length > 0
        ? Math.round(this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length)
        : null;
    this.snapshot.avgLatencyMs = avgLat;

    let score = successRate;
    if (avgLat !== null) {
      if (avgLat > 2500) score = Math.min(score, 62);
      else if (avgLat > 1200) score = Math.min(score, 80);
      else if (avgLat > 600) score = Math.min(score, 92);
    }

    this.snapshot.stabilityScore = Math.max(0, Math.min(100, score));

    if (successRate < 60) {
      this.snapshot.status = 'reconnecting';
    } else if (score < 85 || (avgLat !== null && avgLat > 1200)) {
      this.snapshot.status = 'degraded';
    } else {
      this.snapshot.status = 'optimal';
    }

    this.emit();
  }

  public recordRequestOutcome(ok: boolean, latencyMs?: number) {
    this.requestOutcomes.push(ok);
    if (this.requestOutcomes.length > 12) this.requestOutcomes.shift();

    if (typeof latencyMs === 'number' && Number.isFinite(latencyMs)) {
      this.snapshot.latencyMs = Math.round(latencyMs);
      this.latencySamples.push(Math.round(latencyMs));
      if (this.latencySamples.length > 8) this.latencySamples.shift();
    }

    if (!ok) {
      this.snapshot.reconnectCount += 1;
    }

    this.recomputeScore();
  }

  public async probeBackendLatency(): Promise<number | null> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.recordRequestOutcome(false);
      return null;
    }
    const start = performance.now();
    try {
      const res = await apiFetch('/api/health', { cache: 'no-store' });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        this.snapshot.lastKeepAliveAt = new Date().toLocaleTimeString('fr-FR');
        this.snapshot.keepAliveCount += 1;
        this.snapshot.lastError = null;
        this.recordRequestOutcome(true, elapsed);
        return elapsed;
      }
      this.snapshot.lastError = `Serveur distant HTTP ${res.status}`;
      this.recordRequestOutcome(false, elapsed);
      return null;
    } catch (err) {
      this.snapshot.lastError =
        err instanceof Error ? err.message : 'Micro-coupure détectée vers le serveur distant.';
      this.recordRequestOutcome(false);
      return null;
    }
  }

  public startKeepAlive(intervalMs = 180_000) {
    if (this.keepAliveInterval) return;
    this.snapshot.keepAliveActive = true;
    this.emit();
    void this.probeBackendLatency();
    this.keepAliveInterval = setInterval(() => {
      void this.probeBackendLatency();
    }, intervalMs);
  }

  public stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    this.snapshot.keepAliveActive = false;
    this.emit();
  }

  public async acquireWakeLock(): Promise<boolean> {
    this.wantWakeLock = true;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      this.snapshot.wakeLockSupported = false;
      this.snapshot.wakeLockActive = false;
      this.emit();
      return false;
    }
    this.snapshot.wakeLockSupported = true;
    try {
      const navWithWake = navigator as unknown as {
        wakeLock: {
          request: (type: 'screen') => Promise<{
            release: () => Promise<void>;
            addEventListener?: (t: string, fn: () => void) => void;
          }>;
        };
      };
      const sentinel = await navWithWake.wakeLock.request('screen');
      this.wakeLockSentinel = sentinel;
      this.snapshot.wakeLockActive = true;
      this.snapshot.lastError = null;
      sentinel.addEventListener?.('release', () => {
        this.wakeLockSentinel = null;
        this.snapshot.wakeLockActive = false;
        this.emit();
      });
      this.emit();
      return true;
    } catch {
      this.snapshot.wakeLockActive = false;
      this.emit();
      return false;
    }
  }

  public async releaseWakeLock(): Promise<void> {
    this.wantWakeLock = false;
    try {
      if (this.wakeLockSentinel) {
        await this.wakeLockSentinel.release();
      }
    } catch {
      // Ignore release errors
    } finally {
      this.wakeLockSentinel = null;
      this.snapshot.wakeLockActive = false;
      this.emit();
    }
  }
}

export const remoteStabilityManager = new RemoteStabilityManager();

export function downloadWindowsRemoteStabilizerBat(): string {
  const lines = [
    '@echo off',
    'title AutoPro DZ - Stabilisateur Travail a Distance & Anti-Coupure USB/ADB',
    'color 0B',
    'echo ========================================================================',
    'echo   AUTOPRO DZ - STABILISATEUR POSTE CLIENT POUR TRAVAIL A DISTANCE',
    'echo ========================================================================',
    'echo.',
    'echo [1/4] Activation du mode Haute Performance (empeche mise en veille PC)...',
    'powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c >nul 2>&1',
    'powercfg /change standby-timeout-ac 0 >nul 2>&1',
    'powercfg /change hibernate-timeout-ac 0 >nul 2>&1',
    'echo [OK] Veille secteur desactivee pendant la session.',
    'echo.',
    'echo [2/4] Desactivation de la suspension selective USB (evite coupure VCI/Tablette)...',
    'powercfg /SETACVALUEINDEX SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 >nul 2>&1',
    'powercfg /SETDCVALUEINDEX SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 >nul 2>&1',
    'powercfg /setactive SCHEME_CURRENT >nul 2>&1',
    'echo [OK] Ports USB maintenus alimentes en continu.',
    'echo.',
    'echo [3/4] Verification passerelle ADB Wi-Fi pour tablette distante...',
    'where adb >nul 2>&1',
    'if %errorlevel%==0 (',
    '  adb start-server',
    '  adb devices',
    ') else (',
    '  echo [INFO] ADB non trouve dans le PATH (uniquement requis si tablette Android directe).',
    ')',
    'echo.',
    'echo [4/4] Boucle Keep-Alive vers Serveur AutoPro DZ (CTRL+C pour arreter)...',
    ':loop',
    `curl -s -o nul -w "Ping Serveur AutoPro DZ : HTTP %%{http_code} | Latence: %%{time_total}s\\n" ${(() => {
      const p = apiUrl('/api/health');
      if (p.startsWith('http')) return p;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return `${origin}${p}`;
    })()}`,
    'timeout /t 45 /nobreak >nul',
    'goto loop',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'application/x-msdos-program;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const fileName = 'AutoPro_Stabilisateur_Distance_Client.bat';
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return fileName;
}
