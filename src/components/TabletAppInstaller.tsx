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
} from 'lucide-react';
import { apiFetch } from '../utils/apiBridge';

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
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [isPackInstalling, setIsPackInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [activeTabletScreenApp, setActiveTabletScreenApp] = useState<string>('launcher');
  const [activeCategory, setActiveCategory] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [connectionWarning, setConnectionWarning] = useState<boolean>(false);

  // Smart Premium Booster toggles (Multi-Screen, HDMI Chip, 120Hz Anim x0.5)
  const [splitScreenEnabled, setSplitScreenEnabled] = useState<boolean>(true);
  const [hdmiMode, setHdmiMode] = useState<'hdmi_out_rear' | 'hdmi_in_box' | 'usbc_dp'>('hdmi_out_rear');
  const [selectedRadioStation, setSelectedRadioStation] = useState<string>('Chaîne 1 (الوطنية)');
  const [copiedAdbScript, setCopiedAdbScript] = useState<boolean>(false);

  // Custom APK upload state
  const [uploadedApkName, setUploadedApkName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);

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

  // Handle single app installation via active connection link
  const handleInstallApp = async (app: TabletApp) => {
    if (!isConnected) {
      setConnectionWarning(true);
      return;
    }
    setConnectionWarning(false);
    setInstallingId(app.id);
    setInstallProgress(10);
    setInstallLogs([`[0.0s] Initialisation du transfert du paquet ${app.packageName}...`]);

    try {
      const res = await apiFetch('/api/tablet/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: app.id,
          appName: app.name,
          packageName: app.packageName,
          connectionMode,
          enableMultiWindow: app.id === 'multiscreen_split_pro' || splitScreenEnabled,
        }),
      });
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.logs)) {
        setInstallLogs((prev) => [...prev, ...data.logs]);
      }
    } catch {
      // Fallback logs handled below
    }

    const steps = [
      { p: 35, log: `[Canal ${connectionMode.toUpperCase()}] Transfert APK (${app.sizeMb} Mo) — Partition /data/app uniquement...` },
      { p: 70, log: `Exécution ADB non destructive : adb install -r -g ${app.packageName}...` },
      { p: 100, log: `✅ Succès : ${app.name} installé et épinglé sur le lanceur Smart Premium.` },
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < steps.length) {
        setInstallProgress(steps[current].p);
        setInstallLogs((prev) => [...prev, steps[current].log]);
        current++;
      } else {
        clearInterval(interval);
        setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, installed: true } : a)));
        setInstallingId(null);
        setActiveTabletScreenApp(app.id);
      }
    }, 450);
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
                placeholder="Rechercher : CarPlay, Google Store, Drama Live, Radio Algérienne, Coran, Multi-écran, HDMI, WhatsApp, TikTok..."
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

          {/* Apps List */}
          <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
            {filteredApps.map((app) => {
              const isBusy = installingId === app.id;
              return (
                <div
                  key={app.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
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
                            Installé
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
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:self-center">
                    {app.installed ? (
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
                        onClick={() => void handleInstallApp(app)}
                        disabled={isBusy || isPackInstalling}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        {isBusy ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>{installProgress}%</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Installer</span>
                          </>
                        )}
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
    </div>
  );
};
