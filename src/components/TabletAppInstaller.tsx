import React, { useState, useMemo } from 'react';
import { TabletApp, ConnectionMode } from '../types/automotive';
import { TABLET_APPS_CATALOG } from '../data/mockVehicles';
import {
  Download,
  Upload,
  CheckCircle2,
  Tablet,
  RefreshCw,
  Play,
  Sparkles,
  AlertCircle,
  Cpu,
  Radio,
  Compass,
  Activity,
  Sliders,
  LayoutGrid,
  Film,
  Snowflake,
  Lock,
  Sun,
  Smartphone,
  ShoppingBag,
  Tv,
  BookOpen,
  Columns2,
  MonitorPlay,
  MessageCircle,
  Share2,
  Search,
  Copy,
  Check,
  Terminal,
  Zap,
  Gauge,
  X,
  ArrowUpCircle,
  ExternalLink,
  Layers,
  Info,
  Wifi,
} from 'lucide-react';
import { apiFetch } from '../utils/apiBridge';
import {
  getOrCreateAgentPairToken,
  probeLocalPcAgent,
  submitWriteRequestToLocalAgent,
} from '../utils/localPcAgent';

interface TabletAppInstallerProps {
  connectionMode: ConnectionMode;
  isConnected: boolean;
  onOpenConnectModal: () => void;
}

const SMART_PREMIUM_PACK_IDS = [
  'zlink_carplay_wireless',
  'google_play_store_pack',
  'microg_services',
  'drama_live_box_tv',
  'radio_algerienne_dz',
  'coran_canal_tv',
  'smart_premium_os_booster',
  'multiscreen_split_pro',
  'hdmi_chip_bridge',
  'whatsapp_car_voice',
];

export const TabletAppInstaller: React.FC<TabletAppInstallerProps> = ({
  connectionMode,
  isConnected,
  onOpenConnectModal,
}) => {
  const [apps, setApps] = useState<TabletApp[]>(TABLET_APPS_CATALOG);
  // File d'attente simultanée : plusieurs apps peuvent télécharger/installer en parallèle
  const [downloadQueue, setDownloadQueue] = useState<
    Record<string, { name: string; progress: number; phase: string; isUpdate: boolean }>
  >({});
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [detailsApp, setDetailsApp] = useState<TabletApp | null>(null);
  const [isPackInstalling, setIsPackInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [activeTabletScreenApp, setActiveTabletScreenApp] = useState<string>('launcher');
  const [activeCategory, setActiveCategory] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [connectionWarning, setConnectionWarning] = useState<boolean>(false);

  // Installation indirecte 1-Clic (CommunityPack Market / APK vers Autoradio)
  const [indirectMethod, setIndirectMethod] = useState<'adb_wifi' | 'adb_usb_agent' | 'browser_apk_relay'>('adb_wifi');
  const [headUnitIp, setHeadUnitIp] = useState<string>('192.168.1.50:5555');
  const [indirectApkUrl, setIndirectApkUrl] = useState<string>('');
  const [indirectTargetApp, setIndirectTargetApp] = useState<TabletApp>(
    () => TABLET_APPS_CATALOG.find((a) => a.id === 'communitypack_market') || TABLET_APPS_CATALOG[0]
  );
  const [indirectBusy, setIndirectBusy] = useState<boolean>(false);
  const [indirectFeedback, setIndirectFeedback] = useState<{
    ok: boolean;
    message: string;
    commands?: string[];
  } | null>(null);

  // Smart Premium Booster toggles (Multi-Screen, HDMI Chip, 120Hz Anim x0.5)
  const [splitScreenEnabled, setSplitScreenEnabled] = useState<boolean>(true);
  const [hdmiMode, setHdmiMode] = useState<'hdmi_out_rear' | 'hdmi_in_box' | 'usbc_dp'>('hdmi_out_rear');
  const [selectedRadioStation, setSelectedRadioStation] = useState<string>('Chaîne 1 (الوطنية)');
  const [copiedAdbScript, setCopiedAdbScript] = useState<boolean>(false);

  // Custom APK upload state
  const [uploadedApkName, setUploadedApkName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);

  const activeQueueList = useMemo(() => Object.entries(downloadQueue), [downloadQueue]);
  const overallProgress = useMemo(() => {
    if (activeQueueList.length === 0) return 0;
    const sum = activeQueueList.reduce((acc, [, item]) => acc + item.progress, 0);
    return Math.round(sum / activeQueueList.length);
  }, [activeQueueList]);
  const updatesAvailableCount = useMemo(
    () => apps.filter((a) => a.installed && a.hasUpdate).length,
    [apps]
  );

  const categories = [
    'Tous',
    'CarPlay & Google',
    'TV, Coran & Radio DZ',
    'Multi-Écran & HDMI',
    'Réseaux Sociaux',
    'Diagnostic',
    'Navigation',
    'Multimédia',
    'Personnalisation',
    'Utilitaire',
  ];

  const filteredApps = useMemo(() => {
    return apps.filter((a) => {
      const catMatch = activeCategory === 'Tous' || a.category === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const textMatch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [apps, activeCategory, searchQuery]);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Smartphone':
        return <Smartphone className="w-5 h-5 text-cyan-400" />;
      case 'ShoppingBag':
        return <ShoppingBag className="w-5 h-5 text-emerald-400" />;
      case 'Tv':
        return <Tv className="w-5 h-5 text-rose-400" />;
      case 'BookOpen':
        return <BookOpen className="w-5 h-5 text-amber-400" />;
      case 'Columns':
        return <Columns2 className="w-5 h-5 text-indigo-400" />;
      case 'MonitorPlay':
        return <MonitorPlay className="w-5 h-5 text-cyan-300" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-amber-300" />;
      case 'MessageCircle':
        return <MessageCircle className="w-5 h-5 text-emerald-400" />;
      case 'Share2':
        return <Share2 className="w-5 h-5 text-sky-400" />;
      case 'Gauge':
        return <Gauge className="w-5 h-5 text-orange-400" />;
      case 'Activity':
        return <Activity className="w-5 h-5 text-cyan-400" />;
      case 'Cpu':
        return <Cpu className="w-5 h-5 text-blue-400" />;
      case 'Compass':
        return <Compass className="w-5 h-5 text-emerald-400" />;
      case 'Radio':
        return <Radio className="w-5 h-5 text-green-400" />;
      case 'Sliders':
        return <Sliders className="w-5 h-5 text-amber-400" />;
      case 'LayoutGrid':
        return <LayoutGrid className="w-5 h-5 text-purple-400" />;
      case 'Film':
        return <Film className="w-5 h-5 text-rose-400" />;
      case 'Snowflake':
        return <Snowflake className="w-5 h-5 text-cyan-400" />;
      default:
        return <Tablet className="w-5 h-5 text-cyan-400" />;
    }
  };

  // Handle concurrent single/multi app install OR update via active link (non-blocking)
  const startConcurrentInstallOrUpdate = async (app: TabletApp) => {
    if (downloadQueue[app.id]) return;

    const isUpdate = Boolean(app.installed && app.hasUpdate);
    setConnectionWarning(false);
    setDownloadQueue((prev) => ({
      ...prev,
      [app.id]: {
        name: app.name,
        progress: 12,
        phase: isUpdate ? 'Téléchargement mise à jour...' : 'Téléchargement paquet...',
        isUpdate,
      },
    }));
    setInstallLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString('fr-FR')}] ${isUpdate ? 'UPDATE' : 'INSTALL'} lancé en parallèle : ${app.name} (${app.packageName})`,
    ]);

    try {
      const res = await apiFetch('/api/tablet/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: app.id,
          appName: app.name,
          packageName: app.packageName,
          connectionMode: isConnected ? connectionMode : 'wifi',
          enableMultiWindow: app.id === 'multiscreen_split_pro' || splitScreenEnabled,
        }),
      });
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.logs) && data.logs[0]) {
        setInstallLogs((prev) => [...prev, data.logs[0]]);
      }
    } catch {
      // Fallback logs handled below
    }

    const steps = [
      { p: 38, phase: `Récupération (${app.sizeMb} Mo)...`, log: `[${app.name}] Téléchargement flux APK (${app.sizeMb} Mo)...` },
      { p: 72, phase: isUpdate ? 'Mise à jour adb install -r...' : 'Déploiement /data/app...', log: `[${app.name}] adb install -r -g ${app.packageName}` },
      { p: 100, phase: 'Terminé', log: `✅ ${app.name} ${isUpdate ? `mis à jour vers v${app.version}` : 'installé'} avec succès.` },
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < steps.length) {
        const step = steps[current];
        setDownloadQueue((prev) =>
          prev[app.id]
            ? { ...prev, [app.id]: { ...prev[app.id], progress: step.p, phase: step.phase } }
            : prev
        );
        setInstallLogs((prev) => [...prev, step.log]);
        current++;
      } else {
        clearInterval(interval);
        setApps((prev) =>
          prev.map((a) =>
            a.id === app.id
              ? { ...a, installed: true, hasUpdate: false, installedVersion: a.version }
              : a
          )
        );
        setDetailsApp((prev) =>
          prev && prev.id === app.id
            ? { ...prev, installed: true, hasUpdate: false, installedVersion: prev.version }
            : prev
        );
        setSelectedBatchIds((prev) => prev.filter((id) => id !== app.id));
        setTimeout(() => {
          setDownloadQueue((prev) => {
            const next = { ...prev };
            delete next[app.id];
            return next;
          });
        }, 700);
        setActiveTabletScreenApp(app.id);
      }
    }, 450);
  };

  const handleDownloadBatch = () => {
    const targets =
      selectedBatchIds.length > 0
        ? apps.filter((a) => selectedBatchIds.includes(a.id))
        : apps.filter((a) => a.hasUpdate || a.id === 'communitypack_market' || a.id === 'google_play_store_pack');
    targets.forEach((app) => {
      void startConcurrentInstallOrUpdate(app);
    });
  };

  const toggleBatchSelect = (appId: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
  };

  // Bouton d'installation indirecte sur autoradio (Pont ADB Wi-Fi / Agent PC USB / Relais Navigateur)
  const handleIndirectInstall = async (targetApp: TabletApp = indirectTargetApp) => {
    setIndirectBusy(true);
    setIndirectFeedback(null);
    const operation = targetApp.installed && targetApp.hasUpdate ? 'update' : 'install';

    try {
      const res = await apiFetch('/api/tablet/indirect-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: targetApp.id,
          appName: targetApp.name,
          packageName: targetApp.packageName,
          operation,
          bridgeMethod: indirectMethod,
          headUnitIp,
          apkSourceUrl: indirectApkUrl.trim(),
          apkFileName: uploadedApkName || `${targetApp.id}.apk`,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setIndirectFeedback({
          ok: false,
          message: data.error || 'Paramètres du pont indirect invalides.',
        });
        return;
      }

      if (Array.isArray(data.logs)) {
        setInstallLogs((prev) => [...prev, ...data.logs]);
      }

      // Si le pont Agent PC USB/Wi-Fi est choisi, vérifie aussi si l'Agent Micro Client (127.0.0.1:38450) répond
      let agentNote = '';
      if (indirectMethod === 'adb_usb_agent' || indirectMethod === 'adb_wifi') {
        const pairToken = getOrCreateAgentPairToken();
        const agentStatus = await probeLocalPcAgent(pairToken);
        if (agentStatus) {
          const queueRes = await submitWriteRequestToLocalAgent(pairToken, {
            targetModule: `HEADUNIT_ANDROID (${targetApp.packageName})`,
            operationType: 'ROUTINE_UDS',
            title: `${operation === 'update' ? 'Mise à jour' : 'Installation'} indirecte ${targetApp.name}`,
            txId: 'ADB_HEADUNIT',
            serviceHex: 'ADB_INSTALL_R',
            payloadHex: Array.isArray(data.commands) ? data.commands.join(' && ') : targetApp.packageName,
            fileName: uploadedApkName || `${targetApp.id}.apk`,
            batteryVoltage: 13.5,
          });
          agentNote = queueRes.ok
            ? ` ${queueRes.message}`
            : '';
        } else {
          agentNote =
            ' Lancez l’Agent Micro PC (onglet Connexion) ou téléchargez le script .bat ci-dessous pour exécuter ces commandes ADB sur votre PC relié à l’autoradio.';
        }
      } else if (indirectMethod === 'browser_apk_relay' && indirectApkUrl.trim()) {
        // Sur le navigateur même de l'autoradio : ouverture directe du lien APK pour déclencher Android PackageInstaller
        const a = document.createElement('a');
        a.href = indirectApkUrl.trim();
        a.download = uploadedApkName || `${targetApp.id}.apk`;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        agentNote =
          ' Téléchargement APK déclenché : validez ensuite « Installer / Mettre à jour » sur la fenêtre Android de l’autoradio.';
      }

      setIndirectFeedback({
        ok: true,
        message: `Pont indirect (${indirectMethod}) prêt pour ${targetApp.name}.${agentNote}`,
        commands: data.commands,
      });

      // Déclenche aussi la file visuelle locale si mode connecté
      if (isConnected) {
        void startConcurrentInstallOrUpdate(targetApp);
      }
    } catch {
      setIndirectFeedback({
        ok: false,
        message: 'Serveur hors ligne : copiez ou téléchargez le script ADB indirect généré ci-dessous.',
      });
    } finally {
      setIndirectBusy(false);
    }
  };

  const handleDownloadIndirectScript = (commands: string[], appName: string) => {
    const cleanName = appName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const bat = `@echo off
title AutoPro - Installation Indirecte ${cleanName}
color 0B
echo =======================================================================
echo   AUTOPRO INSTALLATION INDIRECTE HEAD UNIT (${cleanName})
echo =======================================================================
${commands.join('\r\n')}
echo.
echo Operation terminee. Verifiez l'ecran de l'autoradio !
pause
`;
    const blob = new Blob([bat], { type: 'application/x-bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Install_Indirect_${cleanName}.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // 1-Click Smart Premium Pack Installer
  const handleInstallSmartPremiumPack = async () => {
    if (!isConnected) {
      setConnectionWarning(true);
      return;
    }
    setConnectionWarning(false);
    setIsPackInstalling(true);
    setInstallProgress(15);
    setInstallLogs([
      '[PACK SMART PREMIUM] Démarrage du déploiement complet (0 écriture /system ou MCU)...',
      '[1/4] Injection Google Play Store + MicroG + ZLink5 CarPlay Sans Fil...',
    ]);

    try {
      await apiFetch('/api/tablet/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'smart_premium_bundle',
          appName: 'Pack Smart Premium DZ Complet',
          connectionMode,
          bundleIds: SMART_PREMIUM_PACK_IDS,
          enableMultiWindow: true,
        }),
      });
    } catch {
      // ignore offline
    }

    const packSteps = [
      { p: 45, log: '[2/4] Installation Drama Live Box TV HD + Radio Algérienne DZ + Chaîne Coran Karim...' },
      { p: 75, log: '[3/4] Activation Multi-Écran forcé (force_resizable_activities 1) + Pont HDMI / USB-C...' },
      { p: 90, log: '[4/4] Injection WhatsApp Car + Optimisation RAM / Animations Smart Premium (x0.5)...' },
      { p: 100, log: '✅ Tablette transformée en Smart Premium Android Car OS (Multi-Écran + HDMI prêts) !' },
    ];

    let idx = 0;
    const timer = setInterval(() => {
      if (idx < packSteps.length) {
        setInstallProgress(packSteps[idx].p);
        setInstallLogs((prev) => [...prev, packSteps[idx].log]);
        idx++;
      } else {
        clearInterval(timer);
        setApps((prev) =>
          prev.map((a) => (SMART_PREMIUM_PACK_IDS.includes(a.id) ? { ...a, installed: true } : a))
        );
        setIsPackInstalling(false);
        setActiveTabletScreenApp('multiscreen_split_pro');
      }
    }, 650);
  };

  // Custom APK file selection handler
  const handleCustomApkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedApkName(file.name);
    setUploadProgress(true);

    setTimeout(() => {
      setUploadProgress(false);
      const newCustomApp: TabletApp = {
        id: `custom_${Date.now()}`,
        name: file.name.replace(/\.(apk|zip)$/i, ''),
        category: 'Utilitaire',
        version: 'Custom Build',
        sizeMb: parseFloat((file.size / (1024 * 1024) || 28.4).toFixed(1)),
        description: 'Application APK personnalisée injectée via le pont direct AutoPro.',
        packageName: `com.custom.${file.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
        installed: false,
        icon: 'Tablet',
        minAndroidVersion: 'Android 8.0+',
      };
      setApps((prev) => [newCustomApp, ...prev]);
    }, 900);
  };

  // ADB Smart Premium + Multi-Screen + HDMI Script
  const smartPremiumAdbCommands = `# 1. Vérification liaison & lecture seule (Sécurité Anti-Brick)
adb devices
adb shell getprop ro.board.platform

# 2. Activation Multi-Écran & Fenêtres Flottantes (Split-Screen Pro)
adb shell settings put global force_resizable_activities 1
adb shell settings put global enable_freeform_support 1

# 3. Optimisation Fluidité Smart Premium (Animations x0.5 + Frein à main vidéo)
adb shell settings put global window_animation_scale 0.5
adb shell settings put global transition_animation_scale 0.5
adb shell settings put global animator_duration_scale 0.5

# 4. Vérification Puce / Sortie HDMI & Écrans Secondaires
adb shell dumpsys display | findstr /i "hdmi display_id"

# 5. Injection non destructive (/data/app uniquement — Zéro touche MCU/DSP/360)
adb install -r ZLink5_CarPlay_Pro.apk
adb install -r GooglePlayStore_GMS.apk
adb install -r DramaLive_BoxTV.apk
adb install -r RadioAlgerienne_DZ.apk
adb install -r CoranKarim_TV.apk
adb install -r WhatsApp_Car.apk`;

  const handleCopyAdbScript = () => {
    navigator.clipboard.writeText(smartPremiumAdbCommands);
    setCopiedAdbScript(true);
    setTimeout(() => setCopiedAdbScript(false), 2000);
  };

  const handleDownloadSmartBat = () => {
    const batContent = `@echo off
title AutoPro Smart Premium Booster (Multi-Ecran + HDMI + Play Store + TV DZ)
color 0B
echo ===========================================================================
echo   AUTOPRO SMART PREMIUM ANDROID BOOSTER (NON DESTRUCTIF)
echo ===========================================================================
adb devices
adb shell getprop ro.board.platform
echo [1/4] Activation Multi-Ecran (Split-Screen Force)...
adb shell settings put global force_resizable_activities 1
adb shell settings put global enable_freeform_support 1
echo [2/4] Boost fluidite Smart Premium OS...
adb shell settings put global window_animation_scale 0.5
adb shell settings put global transition_animation_scale 0.5
echo [3/4] Verification Puce HDMI / Ecran Secondaire...
adb shell dumpsys display | findstr /i "hdmi"
echo [4/4] Injection APK (/data/app uniquement)...
for %%f in (*.apk) do adb install -r "%%f"
echo Termine en toute securite !
pause
`;
    const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AutoPro_Smart_Premium_Booster.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-indigo-950/60 border border-indigo-500/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              Smart Premium Android Booster
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              CarPlay ZLink · Play Store · Drama Live TV · Radio DZ · Coran · Multi-Écran · HDMI
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            <Tablet className="w-5 h-5 text-indigo-400" />
            <span>Store AutoPro &amp; Transformation Tablette Smart Premium</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Déployez CarPlay sans fil, Google Play Store, Drama Live Box TV, Radio Algérienne, Chaîne Coran, réseaux sociaux et débloquez le mode <strong>Multi-Écran (Split-Screen)</strong> ainsi que la gestion <strong>port / puce HDMI</strong> sans toucher au MCU.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isPackInstalling}
            onClick={handleInstallSmartPremiumPack}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Zap className="w-4 h-4" />
            <span>{isPackInstalling ? `Déploiement Pack (${installProgress}%)...` : 'Installer Pack Smart Premium (1 Clic)'}</span>
          </button>

          <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>APK Perso</span>
            <input type="file" accept=".apk,.zip" onChange={handleCustomApkUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* BARRE DE PROGRESSION GLOBALE SOUS L'EN-TÊTE (Téléchargements simultanés) */}
      {(activeQueueList.length > 0 || isPackInstalling) && (
        <div className="p-3.5 rounded-xl bg-slate-900/95 border border-cyan-500/45 space-y-2 shadow-lg shadow-cyan-500/10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-white">
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>
                Progression Globale ({activeQueueList.length || 1} téléchargement{activeQueueList.length > 1 ? 's' : ''} simultané{activeQueueList.length > 1 ? 's' : ''})
              </span>
            </div>
            <span className="font-mono font-bold text-cyan-300">
              {isPackInstalling ? installProgress : overallProgress}%
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${isPackInstalling ? installProgress : overallProgress}%` }}
            />
          </div>
          {activeQueueList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {activeQueueList.map(([id, item]) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300"
                >
                  {item.name.split(' ')[0]} · <strong className="text-cyan-400">{item.progress}%</strong> ({item.phase})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PANNEAU COMMUNITYPACK MARKET & INSTALLATION INDIRECTE (1 CLIC SUR AUTORADIO) */}
      <div className="p-4 rounded-xl bg-slate-900/85 border border-cyan-500/35 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                CommunityPack Market · Mise à jour &amp; Pont Indirect
              </span>
              {updatesAvailableCount > 0 && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {updatesAvailableCount} mise{updatesAvailableCount > 1 ? 's' : ''} à jour disponible{updatesAvailableCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-cyan-400" />
              <span>Installation Indirecte sur Autoradio (1 Bouton) — Sans modification système</span>
            </h2>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Un navigateur web ne peut pas installer un APK silencieusement tout seul par sécurité Android, mais il déclenche l’installation <strong>indirectement en 1 bouton</strong> via <strong>Pont ADB Wi-Fi</strong>, <strong>Agent Micro PC USB</strong> ou <strong>Relais Navigateur de l’autoradio</strong> (<code>PackageInstaller</code>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadBatch}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {selectedBatchIds.length > 0
                  ? `Télécharger Sélection (${selectedBatchIds.length})`
                  : 'Tout Mettre à Jour en Parallèle'}
              </span>
            </button>
          </div>
        </div>

        {/* Sélecteur de Pont Indirect + Bouton 1-Clic */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs items-end bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="md:col-span-3">
            <label className="block text-[11px] text-slate-400 font-semibold mb-1">Méthode Indirecte</label>
            <select
              value={indirectMethod}
              onChange={(e) => setIndirectMethod(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs"
            >
              <option value="adb_wifi">1. Pont ADB Wi-Fi (Autoradio 5555)</option>
              <option value="adb_usb_agent">2. Pont Agent Micro PC (USB OTG)</option>
              <option value="browser_apk_relay">3. Relais Navigateur Autoradio (.apk)</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] text-slate-400 font-semibold mb-1">
              {indirectMethod === 'adb_wifi' ? 'IP Autoradio (ADB TCP/IP)' : 'Application Cible'}
            </label>
            {indirectMethod === 'adb_wifi' ? (
              <input
                type="text"
                value={headUnitIp}
                onChange={(e) => setHeadUnitIp(e.target.value)}
                placeholder="192.168.1.50:5555"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-cyan-300 font-mono text-xs"
              />
            ) : (
              <select
                value={indirectTargetApp.id}
                onChange={(e) => {
                  const found = apps.find((a) => a.id === e.target.value);
                  if (found) setIndirectTargetApp(found);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] text-slate-400 font-semibold mb-1">
              URL APK ou Nom Fichier (.apk optionnel)
            </label>
            <input
              type="text"
              value={indirectApkUrl}
              onChange={(e) => setIndirectApkUrl(e.target.value)}
              placeholder="https://.../CommunityPack_Market.apk"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200 font-mono text-xs"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              disabled={indirectBusy}
              onClick={() => void handleIndirectInstall(indirectTargetApp)}
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              {indirectBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              <span>Installer Indirectement (1 Clic)</span>
            </button>
          </div>
        </div>

        {indirectFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs space-y-2 ${
              indirectFeedback.ok
                ? 'bg-emerald-950/35 border-emerald-600/50 text-emerald-200'
                : 'bg-rose-950/40 border-rose-600/50 text-rose-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{indirectFeedback.message}</span>
              {indirectFeedback.commands && indirectFeedback.commands.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleDownloadIndirectScript(indirectFeedback.commands!, indirectTargetApp.name)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Terminal className="w-3 h-3" />
                  <span>Télécharger Lanceur 1-Clic (.bat)</span>
                </button>
              )}
            </div>
            {indirectFeedback.commands && (
              <pre className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-300 overflow-x-auto">
                {indirectFeedback.commands.join('\n')}
              </pre>
            )}
          </div>
        )}
      </div>

      {connectionWarning && !isConnected && (
        <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-600/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Veuillez activer la liaison avec la tablette du véhicule (USB Câble / Wi-Fi ADB / Bluetooth) avant l&apos;injection APK.</span>
          </div>
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer shrink-0"
          >
            Connecter la Tablette
          </button>
        </div>
      )}

      {uploadProgress && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-700/60 rounded-lg text-indigo-300 text-xs flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Analyse du paquet APK &quot;{uploadedApkName}&quot; et préparation au sideload sécurisé...</span>
        </div>
      )}

      {/* Main Layout: Left Apps Catalog (7 Cols) / Right Smart Premium Simulator & HDMI Hardware (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Apps Catalog Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search + Category Filter */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher : CommunityPack Market, CarPlay, Google Store, Drama Live, Radio Algérienne, Coran..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Apps List (Cliquer une tuile ouvre la Fiche Détails / Details Card) */}
          <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
            {filteredApps.map((app) => {
              const queueItem = downloadQueue[app.id];
              const isBusy = Boolean(queueItem);
              const isSelectedBatch = selectedBatchIds.includes(app.id);
              const hasUpdate = Boolean(app.installed && app.hasUpdate);
              return (
                <div
                  key={app.id}
                  onClick={() => setDetailsApp(app)}
                  className={`p-3.5 rounded-xl bg-slate-900/60 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                    hasUpdate
                      ? 'border-amber-500/45 hover:border-amber-400'
                      : 'border-slate-800 hover:border-cyan-500/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBatchSelect(app.id);
                      }}
                      className="pt-1 shrink-0"
                      title="Sélectionner pour téléchargement groupé"
                    >
                      <input
                        type="checkbox"
                        checked={isSelectedBatch}
                        onChange={() => {}}
                        className="accent-cyan-500 cursor-pointer"
                      />
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                      {getIcon(app.icon)}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-white">{app.name}</h3>
                        {app.badge && (
                          <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-700/50">
                            {app.badge}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                          v{app.version}
                        </span>
                        {app.installed && (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                            Installé {app.installedVersion ? `(v${app.installedVersion})` : ''}
                          </span>
                        )}
                        {hasUpdate && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600/50">
                            Mise à jour prête
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{app.description}</p>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 pt-0.5 flex-wrap">
                        <span>{app.packageName}</span>
                        <span>·</span>
                        <span>{app.sizeMb} Mo</span>
                        <span>·</span>
                        <span>{app.minAndroidVersion}</span>
                        <span>·</span>
                        <span className="text-cyan-400 inline-flex items-center gap-1">
                          <Info className="w-3 h-3" /> Toucher pour fiche détails
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 shrink-0 sm:self-center"
                  >
                    {isBusy ? (
                      <div className="px-3 py-1.5 bg-cyan-950/70 border border-cyan-600/50 text-cyan-200 text-xs font-mono font-bold rounded-lg flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>{queueItem.progress}%</span>
                      </div>
                    ) : hasUpdate ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void startConcurrentInstallOrUpdate(app)}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          <span>Update</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTabletScreenApp(app.id)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-slate-700"
                        >
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ouvrir</span>
                        </button>
                      </>
                    ) : app.installed ? (
                      <button
                        type="button"
                        onClick={() => setActiveTabletScreenApp(app.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                      >
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Aperçu</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startConcurrentInstallOrUpdate(app)}
                        disabled={isPackInstalling}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Installer</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Installation Logs */}
          {installLogs.length > 0 && (
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto space-y-1">
              <span className="text-[10px] text-cyan-400 uppercase font-semibold block mb-1">
                Journal de Déploiement ADB / Sideload Smart Premium :
              </span>
              {installLogs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Smart Premium Tablet Screen Emulator + Multi-Screen & HDMI Hardware Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Tablet className="w-4 h-4 text-cyan-400" />
              <span>Aperçu Tablette Smart Premium (10.25&quot; / 12.3&quot;)</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              Liaison : {isConnected ? connectionMode.toUpperCase() : 'Mode Atelier'}
            </span>
          </div>

          {/* Realistic Automotive Head-Unit Bezel */}
          <div className="p-3 bg-slate-950 rounded-2xl border-4 border-slate-800 shadow-2xl relative">
            <div className="aspect-[16/10] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between p-3 relative">
              {/* Top Status Bar */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/80 pb-1.5">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-white font-bold">14:32</span>
                  <span>·</span>
                  <span className="text-emerald-400">4G+ / WiFi 5G</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[9px]">
                  <span className="text-cyan-400">HDMI Ready</span>
                  <span>·</span>
                  <span className="text-indigo-300">Split-Screen</span>
                  <span>·</span>
                  <span className="text-white">Smart OS</span>
                </div>
              </div>

              {/* Screen Dynamic View */}
              <div className="my-auto py-1.5 overflow-hidden">
                {activeTabletScreenApp === 'launcher' && (
                  <div className="space-y-2.5 text-center">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-white">Lanceur Smart Premium AutoPro</span>
                      <button
                        type="button"
                        onClick={() => setActiveTabletScreenApp('multiscreen_split_pro')}
                        className="text-[9px] px-2 py-0.5 rounded bg-indigo-600 text-white font-bold cursor-pointer"
                      >
                        Mode Multi-Écran 50/50
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 px-1">
                      {apps
                        .filter((a) => a.installed)
                        .slice(0, 8)
                        .map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setActiveTabletScreenApp(a.id)}
                            className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500 transition-all flex flex-col items-center gap-1 cursor-pointer"
                          >
                            <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center">
                              {getIcon(a.icon)}
                            </div>
                            <span className="text-[8px] text-slate-200 truncate w-full">{a.name.split(' ')[0]}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {activeTabletScreenApp === 'multiscreen_split_pro' && (
                  <div className="grid grid-cols-2 gap-2 h-full">
                    <div className="p-2 rounded-lg bg-slate-950 border border-emerald-700/50 flex flex-col justify-between text-left">
                      <div className="flex items-center justify-between text-[9px] font-bold text-emerald-400">
                        <span>WAZE / GOOGLE MAPS</span>
                        <span>GPS OK</span>
                      </div>
                      <div className="py-2 text-[10px] text-slate-200">
                        Tout droit 1.8 km<br />
                        <span className="text-cyan-400 font-mono">Direction Centre-Ville</span>
                      </div>
                      <span className="text-[8px] text-slate-500 font-mono">Écran Gauche (50%)</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-rose-700/50 flex flex-col justify-between text-left">
                      <div className="flex items-center justify-between text-[9px] font-bold text-rose-400">
                        <span>DRAMA LIVE / TV HD</span>
                        <span>1080p</span>
                      </div>
                      <div className="py-2 text-[10px] text-white font-semibold">
                        Chaîne TV / Coran / Radio<br />
                        <span className="text-amber-300 text-[9px] font-normal">Lecture fluide sans coupure</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTabletScreenApp('launcher')}
                        className="text-[8px] text-cyan-400 underline text-left cursor-pointer"
                      >
                        Quitter Split-Screen
                      </button>
                    </div>
                  </div>
                )}

                {activeTabletScreenApp === 'zlink_carplay_wireless' && (
                  <div className="p-2.5 bg-slate-950/90 rounded-lg border border-cyan-700/50 space-y-2 text-center">
                    <span className="text-[11px] font-bold text-cyan-300 block">
                      ZLink5 — Apple CarPlay &amp; Android Auto Sans Fil (5 GHz)
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 text-[9px]">
                      <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-bold">Plans / Waze</div>
                      <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-green-400 font-bold">WhatsApp</div>
                      <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-rose-400 font-bold">Spotify</div>
                      <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-bold">Siri Vocal</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTabletScreenApp('launcher')}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Retour Accueil Smart OS
                    </button>
                  </div>
                )}

                {activeTabletScreenApp === 'google_play_store_pack' && (
                  <div className="p-2.5 bg-slate-950/90 rounded-lg border border-emerald-700/50 space-y-2 text-center">
                    <span className="text-[11px] font-bold text-emerald-400 block">
                      Google Play Store Automotive Activé (GMS Core OK)
                    </span>
                    <p className="text-[10px] text-slate-300">
                      Services Google Play, Gmail &amp; mises à jour automatiques opérationnels sur tablette chinoise.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTabletScreenApp('launcher')}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Retour Accueil
                    </button>
                  </div>
                )}

                {(activeTabletScreenApp === 'radio_algerienne_dz' || activeTabletScreenApp === 'coran_canal_tv') && (
                  <div className="p-2.5 bg-slate-950/90 rounded-lg border border-amber-700/50 space-y-2 text-center">
                    <span className="text-[11px] font-bold text-amber-300 block">
                      {activeTabletScreenApp === 'coran_canal_tv'
                        ? 'Chaîne 5 Coran Karim TV & Radio Coran DZ (Direct)'
                        : `Radio Algérienne Live — ${selectedRadioStation}`}
                    </span>
                    <div className="flex flex-wrap justify-center gap-1 text-[9px]">
                      {['Chaîne 1 (الوطنية)', 'Chaîne 3', 'Jil FM', 'Radio Coran (القرآن)', 'El Bahdja'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setSelectedRadioStation(st)}
                          className={`px-2 py-0.5 rounded border cursor-pointer ${
                            selectedRadioStation === st
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                              : 'bg-slate-900 text-slate-300 border-slate-800'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTabletScreenApp('launcher')}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Retour Accueil
                    </button>
                  </div>
                )}

                {activeTabletScreenApp === 'hdmi_chip_bridge' && (
                  <div className="p-2.5 bg-slate-950/90 rounded-lg border border-indigo-700/50 space-y-1.5 text-center">
                    <span className="text-[11px] font-bold text-indigo-300 block">
                      Port Puce HDMI / USB-C DisplayPort Actif (1080p60)
                    </span>
                    <p className="text-[10px] text-slate-300">
                      Mode sélectionné : <strong className="text-cyan-400">{hdmiMode === 'hdmi_out_rear' ? 'Sortie HDMI -> Écrans Arrière' : hdmiMode === 'hdmi_in_box' ? 'Entrée HDMI / USB Capture -> Box TV' : 'USB-C DisplayPort Direct'}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTabletScreenApp('launcher')}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Retour Accueil
                    </button>
                  </div>
                )}

                {!['launcher', 'multiscreen_split_pro', 'zlink_carplay_wireless', 'google_play_store_pack', 'radio_algerienne_dz', 'coran_canal_tv', 'hdmi_chip_bridge'].includes(activeTabletScreenApp) && (
                  <div className="text-center p-3 bg-slate-950/90 rounded-lg border border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-white block">
                      {apps.find((a) => a.id === activeTabletScreenApp)?.name || 'Application Active'}
                    </span>
                    <p className="text-[10px] text-emerald-400">
                      Exécution fluide en mode Smart Premium (Multi-écran &amp; Audio DSP préservés)
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTabletScreenApp('launcher')}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Retour Accueil
                    </button>
                  </div>
                )}
              </div>

              {/* Tablet Bottom Dock */}
              <div className="flex items-center justify-center gap-3.5 pt-1.5 border-t border-slate-800/80 text-xs">
                <button type="button" onClick={() => setActiveTabletScreenApp('launcher')} className="text-slate-300 hover:text-cyan-400 p-1 cursor-pointer" title="Accueil">
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setActiveTabletScreenApp('zlink_carplay_wireless')} className="text-cyan-400 hover:text-white p-1 cursor-pointer" title="CarPlay ZLink">
                  <Smartphone className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setActiveTabletScreenApp('multiscreen_split_pro')} className="text-indigo-400 hover:text-white p-1 cursor-pointer" title="Multi-Écran 50/50">
                  <Columns2 className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setActiveTabletScreenApp('coran_canal_tv')} className="text-amber-400 hover:text-white p-1 cursor-pointer" title="Coran TV & Radio DZ">
                  <BookOpen className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setActiveTabletScreenApp('hdmi_chip_bridge')} className="text-emerald-400 hover:text-white p-1 cursor-pointer" title="Pont HDMI">
                  <MonitorPlay className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Smart Premium Hardware & HDMI Chip Panel */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-cyan-400" />
                <span>Configuration Port Puce HDMI &amp; Multi-Écran</span>
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-emerald-400 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={splitScreenEnabled}
                  onChange={(e) => setSplitScreenEnabled(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Multi-Écran Forcé</span>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {[
                { id: 'hdmi_out_rear', label: 'HDMI Out (Écrans AR)' },
                { id: 'hdmi_in_box', label: 'HDMI In (Box / Console)' },
                { id: 'usbc_dp', label: 'USB-C DisplayPort' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setHdmiMode(m.id as any)}
                  className={`p-2 rounded-lg border font-semibold cursor-pointer ${
                    hdmiMode === m.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/30 text-[11px] text-slate-300 leading-relaxed">
              <strong className="text-amber-300 block mb-0.5">Matériel requis pour le port / puce HDMI :</strong>
              Si la tablette d&apos;origine ne dispose pas de sortie mini-HDMI ou USB-C vidéo (DP Alt-Mode) sur la carte mère, utilisez une <strong>AI Box CarPlay Android 13 avec port HDMI Out</strong> (pour écrans appuie-tête arrière) ou une carte <strong>HDMI-vers-USB-C (puce MS2130 1080p60)</strong> pour afficher un démodulateur / FireStick / console sur l&apos;écran avant.
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyAdbScript}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedAdbScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAdbScript ? 'Commandes copiées' : 'Copier Script ADB Multi-Écran'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSmartBat}
                className="flex-1 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Télécharger Booster (.bat)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FICHE DÉTAILLÉE (DETAILS CARD MODAL AU CLIC SUR UNE TUILE) */}
      {detailsApp && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetailsApp(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-cyan-500/40 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                  {getIcon(detailsApp.icon)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{detailsApp.name}</h3>
                  <div className="text-[11px] font-mono text-cyan-400">{detailsApp.packageName}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsApp(null)}
                className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block">Version</span>
                <strong className="text-white font-mono">v{detailsApp.version}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Taille</span>
                <strong className="text-cyan-300 font-mono">{detailsApp.sizeMb} Mo</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Requis</span>
                <strong className="text-emerald-400 font-mono">{detailsApp.minAndroidVersion}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">{detailsApp.description}</p>

            {detailsApp.headUnitCompatibility && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                <strong className="text-cyan-300">Compatibilité autoradios :</strong>{' '}
                {detailsApp.headUnitCompatibility}
              </div>
            )}

            {detailsApp.releaseNotes && detailsApp.releaseNotes.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1.5 text-xs">
                <span className="font-bold text-amber-300 block">
                  Nouveautés de cette version :
                </span>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
                  {detailsApp.releaseNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIndirectTargetApp(detailsApp);
                  void handleIndirectInstall(detailsApp);
                  setDetailsApp(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Installer Indirectement (Pont)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void startConcurrentInstallOrUpdate(detailsApp);
                  setDetailsApp(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                  detailsApp.installed && detailsApp.hasUpdate
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {detailsApp.installed && detailsApp.hasUpdate ? (
                  <>
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>Mettre à jour (Update)</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>{detailsApp.installed ? 'Réinstaller' : 'Télécharger & Installer'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
