import React, { useState } from 'react';
import { TabletApp, ConnectionMode } from '../types/automotive';
import { TABLET_APPS_CATALOG } from '../data/mockVehicles';
import { Download, Upload, CheckCircle2, Tablet, RefreshCw, Play, Sparkles, AlertCircle, HardDrive, Cpu, Radio, Compass, Activity, Sliders, LayoutGrid, Film, Snowflake, Wind, Lock, Unlock, Sun } from 'lucide-react';

interface TabletAppInstallerProps {
  connectionMode: ConnectionMode;
  isConnected: boolean;
  onOpenConnectModal: () => void;
}

export const TabletAppInstaller: React.FC<TabletAppInstallerProps> = ({
  connectionMode,
  isConnected,
  onOpenConnectModal,
}) => {
  const [apps, setApps] = useState<TabletApp[]>(TABLET_APPS_CATALOG);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [activeTabletScreenApp, setActiveTabletScreenApp] = useState<string>('launcher');
  const [activeCategory, setActiveCategory] = useState<string>('Tous');

  // Custom APK upload state
  const [uploadedApkName, setUploadedApkName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);

  const categories = ['Tous', 'Diagnostic', 'Navigation', 'Multimédia', 'Personnalisation'];

  const filteredApps = activeCategory === 'Tous'
    ? apps
    : apps.filter((a) => a.category === activeCategory);

  const getIcon = (iconName: string) => {
    switch (iconName) {
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

  // Handle app installation via active connection link
  const handleInstallApp = (app: TabletApp) => {
    if (!isConnected) {
      alert('Veuillez d\'abord activer la liaison avec la tablette (Câble, WiFi ou Bluetooth).');
      return;
    }

    setInstallingId(app.id);
    setInstallProgress(0);
    setInstallLogs([`[0.0s] Initialisation du transfert du paquet ${app.packageName}...`]);

    const steps = [
      { p: 25, log: `[Canal ${connectionMode.toUpperCase()}] Envoi du fichier APK (${app.sizeMb} Mo)...` },
      { p: 55, log: 'Vérification signature package et permissions Android Automotive OS...' },
      { p: 85, log: `Exécution commande hôte : pm install -r ${app.packageName}...` },
      { p: 100, log: `Succès : ${app.name} installé et configuré sur l'écran tactile.` },
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < steps.length) {
        setInstallProgress(steps[current].p);
        setInstallLogs((prev) => [...prev, steps[current].log]);
        current++;
      } else {
        clearInterval(interval);
        setApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, installed: true } : a))
        );
        setInstallingId(null);
        setActiveTabletScreenApp(app.id);
      }
    }, 600);
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
        name: file.name.replace('.apk', ''),
        category: 'Utilitaire',
        version: '1.0.0 (Custom Build)',
        sizeMb: parseFloat((file.size / (1024 * 1024) || 28.4).toFixed(1)),
        description: 'Application personnalisée injectée via le pont direct mobile.',
        packageName: `com.custom.${file.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
        installed: false,
        icon: 'Tablet',
        minAndroidVersion: 'Android 8.0+',
      };
      setApps((prev) => [newCustomApp, ...prev]);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Tablet className="w-5 h-5 text-indigo-400" />
            <span>Installateur &amp; Gestionnaire d'Applications Tablette Automobile</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Déployez des applications Android Automotive, outils OBD2, GPS et multimédia directement sur l'écran tactile de bord toutes marques via liaison Câble, WiFi ou Bluetooth.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm">
            <Upload className="w-4 h-4" />
            <span>Installer son propre fichier APK</span>
            <input
              type="file"
              accept=".apk,.zip"
              onChange={handleCustomApkUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {uploadProgress && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-700/60 rounded-lg text-indigo-300 text-xs flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Analyse du paquet APK "{uploadedApkName}" et préparation au sideload...</span>
        </div>
      )}

      {/* Main Layout: Left Apps Catalog / Right Car Screen Emulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Apps Catalog Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-slate-800 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Apps List */}
          <div className="space-y-3">
            {filteredApps.map((app) => {
              const isBusy = installingId === app.id;
              return (
                <div
                  key={app.id}
                  className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                      {getIcon(app.icon)}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{app.name}</h3>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                          v{app.version}
                        </span>
                        {app.installed && (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                            Installé
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {app.description}
                      </p>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 pt-0.5">
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
                        onClick={() => setActiveTabletScreenApp(app.id)}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                      >
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ouvrir sur Tablette</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleInstallApp(app)}
                        disabled={isBusy || !isConnected}
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
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-32 overflow-y-auto space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                Journal de Déploiement ADB / Sideload :
              </span>
              {installLogs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: In-Car Tablet Screen Simulator (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Tablet className="w-4 h-4 text-cyan-400" />
              <span>Aperçu Écran Tablette Automobile (10.25")</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 rounded">
              Liaison : {isConnected ? connectionMode.toUpperCase() : 'Déconnecté'}
            </span>
          </div>

          {/* Realistic Automotive Head-Unit Bezel */}
          <div className="p-3 bg-slate-950 rounded-2xl border-4 border-slate-800 shadow-2xl relative">
            {/* Screen Glass Area */}
            <div className="aspect-[16/10] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between p-3.5 relative">
              {/* Tablet Top Status Bar */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-white font-bold">14:32</span>
                  <span>·</span>
                  <span>22°C Ext.</span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[9px]">
                  <span className="text-cyan-400">CAN 500k</span>
                  <span>·</span>
                  <span className="text-emerald-400">13.8V</span>
                  <span>·</span>
                  <span className="text-white">AutoPro OS</span>
                </div>
              </div>

              {/* Tablet Screen Content depends on activeTabletScreenApp */}
              <div className="my-auto py-2">
                {activeTabletScreenApp === 'launcher' && (
                  <div className="space-y-3 text-center">
                    <span className="text-xs font-medium text-slate-300 block">
                      Tableau de Bord Multimédia
                    </span>
                    <div className="grid grid-cols-4 gap-2 px-1">
                      {apps.filter((a) => a.installed).map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setActiveTabletScreenApp(a.id)}
                          className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500 transition-all flex flex-col items-center gap-1 cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center">
                            {getIcon(a.icon)}
                          </div>
                          <span className="text-[9px] text-slate-200 truncate w-full">
                            {a.name.split(' ')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTabletScreenApp === 'torque_pro' && (
                  <div className="space-y-2 text-center p-2 bg-slate-950/90 rounded-lg border border-cyan-800/40">
                    <span className="text-[11px] font-bold text-cyan-400 block font-mono">
                      Torque Pro - Jauges Télémétrie Véhicule
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono py-1">
                      <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-400 block">RPM</span>
                        <span className="text-xs font-bold text-white">2450</span>
                      </div>
                      <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-400 block">Turbo</span>
                        <span className="text-xs font-bold text-cyan-400">1.42 bar</span>
                      </div>
                      <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-400 block">Eau</span>
                        <span className="text-xs font-bold text-emerald-400">89 °C</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTabletScreenApp('launcher')}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Retour Accueil
                    </button>
                  </div>
                )}

                {activeTabletScreenApp === 'waze_auto' && (
                  <div className="space-y-2 text-center p-3 bg-slate-950/90 rounded-lg border border-emerald-800/40">
                    <span className="text-[11px] font-bold text-emerald-400 block">
                      Waze Automotive - Navigation GPS
                    </span>
                    <p className="text-[10px] text-slate-300">
                      Destination : Garage &amp; Banc de Puissance (12 km - 14 min)
                    </p>
                    <div className="text-[9px] font-mono text-cyan-300 bg-slate-900 p-1.5 rounded">
                      Trafic fluide · 0 alerte radar
                    </div>
                    <button
                      onClick={() => setActiveTabletScreenApp('launcher')}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer block mx-auto"
                    >
                      Retour Accueil
                    </button>
                  </div>
                )}

                {activeTabletScreenApp === 'spotify_car' && (
                  <div className="space-y-2 text-center p-3 bg-slate-950/90 rounded-lg border border-green-800/40">
                    <span className="text-[11px] font-bold text-green-400 block">
                      Spotify Automotive HD
                    </span>
                    <p className="text-[10px] text-white font-medium">
                      Synthwave Drive Mix · Electro Pulse
                    </p>
                    <div className="flex justify-center gap-3 text-xs text-slate-300">
                      <span>⏮</span>
                      <span>▶ 02:45 / 04:12</span>
                      <span>⏭</span>
                    </div>
                    <button
                      onClick={() => setActiveTabletScreenApp('launcher')}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer block mx-auto"
                    >
                      Retour Accueil
                    </button>
                  </div>
                )}

                {activeTabletScreenApp === 'smartech_dz_diagauto' && (
                  <div className="space-y-2 text-center p-2.5 bg-slate-950/90 rounded-lg border border-emerald-600/50">
                    <div className="flex items-center justify-between text-[10px] font-mono border-b border-slate-800 pb-1">
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Smartech DZ DiagAuto Pro v5.2
                      </span>
                      <span className="text-slate-400">VCI DZ-8849 OK</span>
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Module AutoPro Lié : <strong className="text-cyan-400">Flash &amp; Traducteur Actifs</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono text-left bg-slate-900 p-1.5 rounded border border-slate-800">
                      <div>Calculateurs : <span className="text-emerald-400 font-bold">12 Reconnus</span></div>
                      <div>DTC Moteur : <span className="text-amber-400 font-bold">1 Défaut</span></div>
                      <div>Reprog : <span className="text-cyan-400 font-bold">Stage 1 DZ</span></div>
                      <div>Langue : <span className="text-white font-bold">Arabe / FR</span></div>
                    </div>
                    <button
                      onClick={() => setActiveTabletScreenApp('launcher')}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer block mx-auto pt-0.5"
                    >
                      Retour Accueil
                    </button>
                  </div>
                )}

                {activeTabletScreenApp === 'climate_control' && (
                  <div className="space-y-2 text-center p-2.5 bg-slate-950/90 rounded-lg border border-cyan-800/40">
                    <div className="flex items-center justify-between text-[10px] font-mono border-b border-slate-800 pb-1">
                      <span className="font-bold text-cyan-400 flex items-center gap-1">
                        <Snowflake className="w-3 h-3 text-cyan-400" />
                        Climatisation &amp; Habitacle Bi-Zone
                      </span>
                      <span className="text-emerald-400 font-bold">BCM 500k OK</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center font-mono py-1">
                      <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-400 block">Gauche</span>
                        <span className="text-sm font-bold text-cyan-400">21.0°C</span>
                      </div>
                      <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-400 block">Droite</span>
                        <span className="text-sm font-bold text-cyan-400">21.5°C</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700/60 text-cyan-300 font-bold">A/C ON</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-300 font-bold">AUTO</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">Soufflerie 3/7</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[9px] text-slate-300 pt-1">
                      <div className="p-1 bg-slate-900 rounded border border-slate-800 flex items-center justify-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-amber-400" />
                        <span>Portes : Fermées</span>
                      </div>
                      <div className="p-1 bg-slate-900 rounded border border-slate-800 flex items-center justify-center gap-1">
                        <Sun className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Toit : Verre 0%</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTabletScreenApp('launcher')}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer block mx-auto pt-0.5"
                    >
                      Retour Accueil
                    </button>
                  </div>
                )}

                {activeTabletScreenApp !== 'launcher' &&
                  activeTabletScreenApp !== 'torque_pro' &&
                  activeTabletScreenApp !== 'waze_auto' &&
                  activeTabletScreenApp !== 'spotify_car' &&
                  activeTabletScreenApp !== 'climate_control' &&
                  activeTabletScreenApp !== 'smartech_dz_diagauto' && (
                    <div className="text-center p-3 bg-slate-950/90 rounded-lg border border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-white block">
                        Application Active
                      </span>
                      <p className="text-[10px] text-slate-300">
                        {apps.find((a) => a.id === activeTabletScreenApp)?.name}
                      </p>
                      <button
                        onClick={() => setActiveTabletScreenApp('launcher')}
                        className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        Retour Accueil
                      </button>
                    </div>
                  )}
              </div>

              {/* Tablet Bottom Dock Bar */}
              <div className="flex items-center justify-center gap-4 pt-2 border-t border-slate-800/80 text-xs">
                <button
                  onClick={() => setActiveTabletScreenApp('launcher')}
                  className="text-slate-300 hover:text-cyan-400 p-1 cursor-pointer"
                  title="Accueil"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTabletScreenApp('climate_control')}
                  className="text-slate-300 hover:text-cyan-400 p-1 cursor-pointer"
                  title="Climatisation &amp; Habitacle"
                >
                  <Snowflake className="w-4 h-4 text-cyan-400" />
                </button>
                <button
                  onClick={() => setActiveTabletScreenApp('torque_pro')}
                  className="text-slate-300 hover:text-cyan-400 p-1 cursor-pointer"
                  title="Jauges OBD"
                >
                  <Activity className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTabletScreenApp('waze_auto')}
                  className="text-slate-300 hover:text-cyan-400 p-1 cursor-pointer"
                  title="Navigation"
                >
                  <Compass className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTabletScreenApp('spotify_car')}
                  className="text-slate-300 hover:text-cyan-400 p-1 cursor-pointer"
                  title="Musique"
                >
                  <Radio className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg text-xs text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-200 block mb-0.5">
              Résolution et Compatibilité :
            </span>
            Compatible avec tous les autoradios Android 1 DIN / 2 DIN (Joying, Dasaita, Teyes, Xtrons, Hizpo, PX5/PX6, Qualcomm Snapdragon Automotive) et écrans d'origine équipés de CarPlay/Android Auto sans fil.
          </div>
        </div>
      </div>
    </div>
  );
};
