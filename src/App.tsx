import React, { useState, useEffect, useCallback } from 'react';
import { ConnectionMode, Vehicle, LicenseSession } from './types/automotive';
import { VEHICLE_PRESETS } from './data/mockVehicles';
import { Header, NavTab } from './components/Header';
import { ConnectionManager } from './components/ConnectionManager';
import { DiagnosticScanner } from './components/DiagnosticScanner';
import { DiagnosticHistory } from './components/DiagnosticHistory';
import { EcuFlashing } from './components/EcuFlashing';
import { TabletAppInstaller } from './components/TabletAppInstaller';
import { AppTranslator } from './components/AppTranslator';
import { SmartechDzBridge } from './components/SmartechDzBridge';
import { CommercialPackaging } from './components/CommercialPackaging';
import { ChineseAutoDeployer } from './components/ChineseAutoDeployer';
import { BodyComfortControl } from './components/BodyComfortControl';
import { KeylessProximitySecurity } from './components/KeylessProximitySecurity';
import { CameraIntegration } from './components/CameraIntegration';
import { ChinaWorkshopToolsHub } from './components/ChinaWorkshopToolsHub';
import { TransmissionTcuSuite } from './components/TransmissionTcuSuite';
import { UniversalMasterSuite } from './components/UniversalMasterSuite';
import { AtelierCopilot } from './components/AtelierCopilot';
import { VaultDownloadsPanel } from './components/VaultDownloadsPanel';
import { AdminSubscribersPanel } from './components/AdminSubscribersPanel';
import { ConnectModal } from './components/ConnectModal';
import { LicenseGate } from './components/LicenseGate';
import { LicenseModal } from './components/LicenseModal';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { WallpaperBackdrop } from './components/WallpaperBackdrop';
import { WallpaperDrawerModal } from './components/WallpaperDrawerModal';
import { INITIAL_DTC_CODES } from './data/mockVehicles';
import { ShieldCheck, Cpu } from 'lucide-react';
import { apiFetch } from './utils/apiBridge';
import { clearAuthToken, purgeLegacySensitiveStorage } from './utils/authSession';
import { obdHardwareBridge, ObdHardwareStatus } from './utils/obdHardwareBridge';
import { remoteStabilityManager } from './utils/remoteStability';
import {
  ActiveWallpaperConfig,
  getCustomWallpaperById,
  loadActiveWallpaperSync,
  saveActiveWallpaperSync,
} from './utils/wallpaperManager';

const OPEN_SOURCE_ALLOWED_MODULES: NavTab[] = [
  'diagnostic',
  'history',
  'cameras',
  'workshop_cn',
  'transmission',
  'universal_master',
  'copilot',
  'flash',
  'comfort',
  'keyless',
  'aa_cp_deployer',
  'smartech',
  'connection',
  'apps',
  'vault',
  'translator',
];

function createOpenSourceSession(): LicenseSession {
  const savedHwid =
    typeof window !== 'undefined'
      ? localStorage.getItem('autopro_machine_hwid') || 'OPEN-SOURCE-LOCAL'
      : 'OPEN-SOURCE-LOCAL';
  return {
    maskedKey: 'OPEN-SOURCE',
    clientName: 'Accès Open-Source Libre',
    hwid: savedHwid,
    tier: 'open_source',
    tierLabel: 'Open-Source Libre · Outils Gratuits',
    activatedAt: new Date().toISOString(),
    expiresAt: 'Illimité (Open-Source)',
    demoExpiresAt: null,
    isValid: true,
    isAdmin: false,
    allowedModules: OPEN_SOURCE_ALLOWED_MODULES,
  };
}

export default function App() {
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [licenseSession, setLicenseSession] = useState<LicenseSession>(() => createOpenSourceSession());
  const [authGateModalTab, setAuthGateModalTab] = useState<'subscriber' | 'admin' | null>(null);

  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [matrixName] = useState<string>(() => {
    return localStorage.getItem('autopro_matrix_name') || 'Jarvis';
  });
  const [activeTab, setActiveTab] = useState<NavTab>('diagnostic');
  const [atelierMode, setAtelierMode] = useState<boolean>(() => {
    return localStorage.getItem('autopro_atelier_mode') === 'true';
  });
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle>(VEHICLE_PRESETS[0]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('bluetooth');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [batteryVoltage, setBatteryVoltage] = useState<number>(12.6);
  const [hardwareStatus, setHardwareStatus] = useState<ObdHardwareStatus>(() => obdHardwareBridge.getStatus());
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [isWallpaperDrawerOpen, setIsWallpaperDrawerOpen] = useState<boolean>(false);
  const [activeWallpaper, setActiveWallpaper] = useState<ActiveWallpaperConfig>(() =>
    loadActiveWallpaperSync()
  );
  const [dtcCodes] = useState(INITIAL_DTC_CODES);
  const [demoRemainingText, setDemoRemainingText] = useState<string | null>(null);

  useEffect(() => {
    if (activeWallpaper.kind === 'custom' && !activeWallpaper.src) {
      void getCustomWallpaperById(activeWallpaper.id).then((item) => {
        if (item?.dataUrl) {
          setActiveWallpaper((prev) => ({ ...prev, src: item.dataUrl }));
        }
      });
    }
  }, [activeWallpaper.id, activeWallpaper.kind, activeWallpaper.src]);

  const handleApplyWallpaper = useCallback((next: ActiveWallpaperConfig) => {
    setActiveWallpaper(next);
    saveActiveWallpaperSync(next);
  }, []);

  useEffect(() => {
    return obdHardwareBridge.subscribe((status) => {
      setHardwareStatus(status);
      setIsConnected(status.connected);
      if (status.transport === 'ble') setConnectionMode('bluetooth');
      if (status.transport === 'serial') setConnectionMode('cable');
      if (typeof status.batteryVoltage === 'number') {
        setBatteryVoltage(status.batteryVoltage);
      }
    });
  }, []);

  const lockSession = useCallback((reason?: string) => {
    void apiFetch('/api/license/logout', { method: 'POST' }).catch(() => {
      // Ignore logout network failures on lock
    });
    clearAuthToken();
    purgeLegacySensitiveStorage();
    setDemoRemainingText(null);
    setLicenseSession(createOpenSourceSession());
    if (reason) {
      setBlockReason(reason);
      setAuthGateModalTab('subscriber');
    }
  }, []);

  const toggleAtelierMode = () => {
    setAtelierMode(prev => {
      const next = !prev;
      localStorage.setItem('autopro_atelier_mode', String(next));
      return next;
    });
  };

  // Enforce module restrictions whenever licenseSession changes
  useEffect(() => {
    if (!licenseSession?.isValid) return;
    if (licenseSession.isAdmin) return;
    const allowed = licenseSession.allowedModules || [];
    const isPermitted =
      activeTab === 'vault' ||
      allowed.includes(activeTab) ||
      (activeTab === 'workshop_cn' &&
        (allowed.includes('diagnostic') || allowed.includes('cameras'))) ||
      (activeTab === 'transmission' &&
        (allowed.includes('diagnostic') || allowed.includes('flash'))) ||
      (activeTab === 'universal_master' &&
        (allowed.includes('universal_master') || allowed.includes('diagnostic') || allowed.includes('flash'))) ||
      (activeTab === 'copilot' &&
        (allowed.includes('copilot') ||
          allowed.includes('diagnostic') ||
          allowed.includes('flash'))) ||
      (activeTab === 'aa_cp_deployer' &&
        (allowed.includes('aa_cp_deployer') ||
          allowed.includes('apps')));
    if (allowed.length > 0 && !isPermitted) {
      setActiveTab((allowed[0] as NavTab) || 'diagnostic');
    }
  }, [licenseSession, activeTab]);

  // Remote backend keep-alive (prevents Render hibernation mid-session) & 15s presence + Kill-Switch heartbeat
  useEffect(() => {
    if (!licenseSession?.isValid || licenseSession.tier === 'open_source') {
      remoteStabilityManager.stopKeepAlive();
      return;
    }

    remoteStabilityManager.startKeepAlive(180_000);

    const verifySession = async () => {
      const startMs = performance.now();
      const snap = remoteStabilityManager.getSnapshot();
      try {
        const res = await apiFetch('/api/license/check-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latencyMs: snap.latencyMs ?? undefined,
            stabilityScore: snap.stabilityScore,
            connectionMode,
            wakeLockActive: snap.wakeLockActive,
            reconnectCount: snap.reconnectCount,
          }),
        });
        const elapsed = Math.round(performance.now() - startMs);
        remoteStabilityManager.recordRequestOutcome(res.ok || res.status === 403 || res.status === 401, elapsed);
        const raw = await res.text();
        if (raw.trim().startsWith('<')) return;
        const data = JSON.parse(raw);
        const isDemo = licenseSession.tier === 'demo';
        const shouldLock =
          res.status === 401 ||
          data?.explicitlyRevoked === true ||
          ((isDemo || res.status === 403) && (data?.blocked || data?.valid === false));
        if (shouldLock) {
          lockSession(data?.reason || 'Votre accès a été désactivé par l\'administrateur.');
        }
      } catch {
        // Record blip without kicking out active session on transient 4G drop or Render wakeup
        remoteStabilityManager.recordRequestOutcome(false);
      }
    };

    const handleReconnectCheck = () => {
      void verifySession();
    };
    const handleVisibilityCheck = () => {
      if (document.visibilityState === 'visible') {
        void verifySession();
      }
    };

    void verifySession();
    const timer = setInterval(verifySession, 15000);
    window.addEventListener('online', handleReconnectCheck);
    document.addEventListener('visibilitychange', handleVisibilityCheck);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleReconnectCheck);
      document.removeEventListener('visibilitychange', handleVisibilityCheck);
      remoteStabilityManager.stopKeepAlive();
    };
  }, [licenseSession, lockSession, connectionMode]);

  // Limited Demo Pass live countdown + automatic lock at 00:00
  useEffect(() => {
    if (!licenseSession?.isValid || licenseSession.tier !== 'demo' || !licenseSession.demoExpiresAt) {
      setDemoRemainingText(null);
      return;
    }

    const expiryMs = new Date(licenseSession.demoExpiresAt).getTime();
    const tick = () => {
      const diff = expiryMs - Date.now();
      if (diff <= 0) {
        lockSession('Durée du Pass Démo Limité écoulée. Demandez une licence Abonné à Sofiane (05 57 76 78 04).');
        return;
      }
      const totalSec = Math.ceil(diff / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      setDemoRemainingText(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [licenseSession, lockSession]);

  // Log client activity heartbeat with stability metrics (authenticated Pass/Admin sessions)
  useEffect(() => {
    if (licenseSession?.isValid && licenseSession.tier !== 'open_source') {
      const snap = remoteStabilityManager.getSnapshot();
      apiFetch('/api/clients/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'heartbeat',
          actionDetails: `Ouverture session AutoPro (${licenseSession.tierLabel}) — Liaison ${connectionMode.toUpperCase()}`,
          vehicleName: `${selectedVehicle.brand} ${selectedVehicle.model}`,
          locationCity: 'Algérie (Tablette Atelier)',
          latencyMs: snap.latencyMs ?? undefined,
          stabilityScore: snap.stabilityScore,
          reconnectCount: snap.reconnectCount,
          wakeLockActive: snap.wakeLockActive,
        }),
      }).catch(() => {
        // Silent telemetry ignore
      });
    }
  }, [licenseSession?.subscriberId, licenseSession?.activatedAt]);

  const handleDeactivateLicense = () => {
    lockSession();
  };

  const handleLicenseActivated = (session: LicenseSession) => {
    setBlockReason(null);
    setLicenseSession(session);
    setAuthGateModalTab(null);
    if (session.isAdmin) {
      setActiveTab('admin');
    }
  };

  const isAdmin = Boolean(licenseSession.isAdmin);
  const canRenderTab = (tab: NavTab) => {
    if (isAdmin) return true;
    if (tab === 'admin' || tab === 'packaging') return false;
    if (tab === 'vault') return true;
    const allowed = licenseSession.allowedModules;
    if (!allowed) return true;
    if (tab === 'workshop_cn') {
      return allowed.includes('workshop_cn') || allowed.includes('diagnostic') || allowed.includes('cameras');
    }
    if (tab === 'transmission') {
      return allowed.includes('transmission') || allowed.includes('diagnostic') || allowed.includes('flash');
    }
    if (tab === 'universal_master') {
      return (
        allowed.includes('universal_master') ||
        allowed.includes('diagnostic') ||
        allowed.includes('flash')
      );
    }
    if (tab === 'copilot') {
      return (
        allowed.includes('copilot') ||
        allowed.includes('diagnostic') ||
        allowed.includes('flash')
      );
    }
    if (tab === 'aa_cp_deployer') {
      return (
        allowed.includes('aa_cp_deployer') ||
        allowed.includes('apps')
      );
    }
    return allowed.includes(tab);
  };

  return (
    <div className={`relative min-h-screen w-full max-w-full overflow-x-hidden text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950 ${atelierMode ? 'atelier-mode bg-[#070b14]' : 'bg-transparent'}`}>
      <WallpaperBackdrop wallpaper={activeWallpaper} atelierMode={atelierMode} />

      <div className="relative z-10 flex flex-col min-h-screen min-w-0 w-full">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isConnected={isConnected}
        connectionMode={connectionMode}
        hardwareTransport={hardwareStatus.transport}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        licenseSession={licenseSession}
        onOpenLicenseModal={() => {
          if (licenseSession.tier === 'open_source') {
            setAuthGateModalTab('subscriber');
          } else {
            setIsLicenseModalOpen(true);
          }
        }}
        matrixName={matrixName}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        atelierMode={atelierMode}
        onToggleAtelierMode={toggleAtelierMode}
        onOpenWallpaperDrawer={() => setIsWallpaperDrawerOpen(true)}
        isAdmin={isAdmin}
        demoRemainingText={demoRemainingText}
      />

      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto px-3 sm:px-6 py-5 sm:py-8">
        {activeTab === 'admin' && isAdmin && (
          <AdminSubscribersPanel
            onAdminSessionInvalid={lockSession}
            onOpenVault={() => setActiveTab('vault')}
          />
        )}

        {activeTab === 'diagnostic' && canRenderTab('diagnostic') && (
          <DiagnosticScanner
            selectedVehicle={selectedVehicle}
            setSelectedVehicle={setSelectedVehicle}
            batteryVoltage={batteryVoltage}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onSelectTab={setActiveTab}
          />
        )}

        {activeTab === 'history' && canRenderTab('history') && (
          <DiagnosticHistory
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'flash' && canRenderTab('flash') && (
          <EcuFlashing
            selectedVehicle={selectedVehicle}
            setSelectedVehicle={setSelectedVehicle}
            batteryVoltage={batteryVoltage}
            isConnected={isConnected}
            connectionMode={connectionMode}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'connection' && canRenderTab('connection') && (
          <ConnectionManager
            connectionMode={connectionMode}
            setConnectionMode={setConnectionMode}
            isConnected={isConnected}
            setIsConnected={setIsConnected}
            batteryVoltage={batteryVoltage}
            setBatteryVoltage={setBatteryVoltage}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'apps' && canRenderTab('apps') && (
          <TabletAppInstaller
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onOpenVault={() => setActiveTab('vault')}
          />
        )}

        {activeTab === 'vault' && canRenderTab('vault') && (
          <VaultDownloadsPanel
            licenseSession={licenseSession}
            onOpenLicenseModal={() => setAuthGateModalTab('subscriber')}
          />
        )}

        {activeTab === 'translator' && canRenderTab('translator') && (
          <AppTranslator
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'smartech' && canRenderTab('smartech') && (
          <SmartechDzBridge
            selectedVehicle={selectedVehicle}
            dtcList={dtcCodes}
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'packaging' && isAdmin && (
          <CommercialPackaging
            appUrl="https://autoprodz-a7071.web.app"
            onSelectTab={setActiveTab}
            onSelectVehicle={setSelectedVehicle}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'aa_cp_deployer' && canRenderTab('aa_cp_deployer') && (
          <ChineseAutoDeployer />
        )}

        {activeTab === 'comfort' && canRenderTab('comfort') && (
          <BodyComfortControl
            selectedVehicle={selectedVehicle}
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
            matrixName={matrixName}
          />
        )}

        {activeTab === 'keyless' && canRenderTab('keyless') && (
          <KeylessProximitySecurity
            selectedVehicle={selectedVehicle}
            connectionMode={connectionMode}
            isConnected={isConnected}
            batteryVoltage={batteryVoltage}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onSelectTab={setActiveTab}
          />
        )}

        {activeTab === 'cameras' && canRenderTab('cameras') && (
          <CameraIntegration
            selectedVehicle={selectedVehicle}
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onSelectTab={setActiveTab}
            clientName={licenseSession.clientName}
          />
        )}

        {activeTab === 'workshop_cn' && canRenderTab('workshop_cn') && (
          <ChinaWorkshopToolsHub selectedVehicle={selectedVehicle} />
        )}

        {activeTab === 'transmission' && canRenderTab('transmission') && (
          <TransmissionTcuSuite
            selectedVehicle={selectedVehicle}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'universal_master' && canRenderTab('universal_master') && (
          <UniversalMasterSuite batteryVoltage={batteryVoltage} isAdmin={isAdmin} />
        )}

        {activeTab === 'copilot' && canRenderTab('copilot') && (
          <AtelierCopilot isAdmin={isAdmin} />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-5 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-400">AutoPro Suite Automobile</span>
            <span>·</span>
            <span>Normes ISO 14229 UDS / SAE J2534 Passthru / ISO 13400 DoIP</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Protection Calculateur Sécurisée
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Multimarque Européen, Asiatique &amp; Américain
            </span>
          </div>
        </div>
      </footer>

      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        connectionMode={connectionMode}
        setConnectionMode={setConnectionMode}
        isConnected={isConnected}
        setIsConnected={setIsConnected}
        batteryVoltage={batteryVoltage}
      />

      {licenseSession && (
        <LicenseModal
          isOpen={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
          license={licenseSession}
          onDeactivate={handleDeactivateLicense}
        />
      )}

      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        selectedVehicle={selectedVehicle}
        onSelectTab={setActiveTab}
      />

      <WallpaperDrawerModal
        isOpen={isWallpaperDrawerOpen}
        onClose={() => setIsWallpaperDrawerOpen(false)}
        activeWallpaper={activeWallpaper}
        onApplyWallpaper={handleApplyWallpaper}
      />

      {authGateModalTab !== null && (
        <LicenseGate
          onLicenseActivated={handleLicenseActivated}
          blockReason={blockReason}
          initialTab={authGateModalTab}
          onClose={() => {
            setBlockReason(null);
            setAuthGateModalTab(null);
          }}
        />
      )}
      </div>
    </div>
  );
}
