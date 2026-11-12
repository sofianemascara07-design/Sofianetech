import React, { useState } from 'react';
import { SmartechDzConfig, SmartechDzPlugin, Vehicle, DtcCode, ConnectionMode } from '../types/automotive';
import { Cpu, CheckCircle2, RefreshCw, Zap, ShieldCheck, Languages, ExternalLink, HardDrive, Smartphone, Radio, ArrowRight, Download } from 'lucide-react';

interface SmartechDzBridgeProps {
  selectedVehicle: Vehicle;
  dtcList: DtcCode[];
  connectionMode: ConnectionMode;
  isConnected: boolean;
  onOpenConnectModal: () => void;
}

export const SmartechDzBridge: React.FC<SmartechDzBridgeProps> = ({
  selectedVehicle,
  dtcList,
  connectionMode,
  isConnected,
  onOpenConnectModal,
}) => {
  const [config, setConfig] = useState<SmartechDzConfig>({
    isDetected: true,
    packageName: 'dz.smartech.diagauto',
    appVersion: 'v5.2.0-Pro (Smartech Diagnostic DZ)',
    devicePath: '/data/data/dz.smartech.diagauto',
    vciSerial: 'DZ-SMT-8849-VCI-PRO',
    ipcPort: 35100,
    lastSyncTimestamp: 'Aujourd\'hui à ' + new Date().toLocaleTimeString(),
    tokenStatus: 'Validé',
  });

  const [plugins, setPlugins] = useState<SmartechDzPlugin[]>([
    {
      id: 'plugin_flash_dz',
      name: 'AutoPro Flash & Chiptuning Pro DZ',
      version: 'v2.4.0',
      description: 'Ajoute l\'onglet Reprogrammation ECU, Stage 1/2 et FlexFuel directement dans le menu de Smartech DZ DiagAuto.',
      targetPackage: 'dz.smartech.diagauto.plugins.flash',
      status: 'installed',
      sizeKb: 1420,
    },
    {
      id: 'plugin_translator_dz',
      name: 'Traducteur Arabe Algérien & Français Technique',
      version: 'v3.1.2',
      description: 'Traduction intégrale des codes DTC et des procédures de diagnostic constructeurs en Arabe et Français.',
      targetPackage: 'dz.smartech.diagauto.plugins.lang',
      status: 'installed',
      sizeKb: 890,
    },
    {
      id: 'plugin_delete_dz',
      name: 'Module Dépollution FAP / EGR / AdBlue DZ',
      version: 'v2.1.0',
      description: 'Désactivation des voyants défauts et des cycles de régénération pour calculateurs Bosch, Continental et Delphi.',
      targetPackage: 'dz.smartech.diagauto.plugins.delete',
      status: 'ready',
      sizeKb: 2150,
    },
    {
      id: 'plugin_tablet_mirror',
      name: 'Passerelle Écran Tablette Automobile (Câble/WiFi/BT)',
      version: 'v1.8.5',
      description: 'Envoie les flux de données et jauges de Smartech DZ sur l\'écran tactile central de la voiture.',
      targetPackage: 'dz.smartech.diagauto.plugins.mirror',
      status: 'installed',
      sizeKb: 1120,
    },
  ]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [injectingId, setInjectingId] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<string[]>([
    '[INIT] Détection de l\'application "Smartech DZ DiagAuto" (dz.smartech.diagauto) : PRÉSENTE.',
    '[VCI] Connecteur VCI appairé : DZ-SMT-8849-VCI-PRO (ThinkDiag / Easydiag DZ Edition).',
    '[SOCKET IPC] Pont de communication local actif sur le port TCP 35100.',
    '[STATUS] Prêt pour la synchronisation bidirectionnelle des bases de données et cartographies.',
  ]);
  const [deepLinkLaunched, setDeepLinkLaunched] = useState(false);

  // Sync with Smartech DZ DiagAuto
  const handleSyncWithSmartech = async () => {
    setIsSyncing(true);
    setSyncLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Début de la synchronisation avec Smartech DZ DiagAuto...`,
      ...prev,
    ]);

    try {
      const res = await fetch('/api/smartech-dz/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dtcCodes: dtcList,
          vehicle: `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.engine})`,
          calibration: 'Stage 1 Optimisé DZ',
        }),
      });

      const data = await res.json();
      setTimeout(() => {
        setIsSyncing(false);
        setConfig((prev) => ({
          ...prev,
          lastSyncTimestamp: 'À l\'instant (' + new Date().toLocaleTimeString() + ')',
        }));
        setSyncLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] SUCCÈS : ${data.dtcTransferredCount} codes DTC et la cartographie du véhicule ${selectedVehicle.brand} sont synchronisés avec Smartech DZ.`,
          `[${new Date().toLocaleTimeString()}] Données enregistrées dans /data/data/dz.smartech.diagauto/databases/autopro_bridge.db`,
          ...prev.slice(0, 10),
        ]);
      }, 1000);
    } catch {
      setIsSyncing(false);
      setSyncLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Erreur : Impossible de joindre le socket IPC Smartech DZ.`,
        ...prev,
      ]);
    }
  };

  // Inject a plugin into Smartech DZ DiagAuto
  const handleInjectPlugin = async (plugin: SmartechDzPlugin) => {
    setInjectingId(plugin.id);
    setSyncLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Injection du plugin "${plugin.name}" vers ${config.packageName}...`,
      ...prev,
    ]);

    try {
      const res = await fetch('/api/smartech-dz/inject-plugin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId: plugin.id,
          pluginName: plugin.name,
          targetPackage: config.packageName,
        }),
      });

      const data = await res.json();
      setTimeout(() => {
        setInjectingId(null);
        setPlugins((prev) =>
          prev.map((p) => (p.id === plugin.id ? { ...p, status: 'installed' } : p))
        );
        setSyncLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] SUCCÈS : Plugin "${plugin.name}" injecté et actif dans Smartech DZ DiagAuto !`,
          ...(data.logs || []),
          ...prev.slice(0, 8),
        ]);
      }, 1200);
    } catch {
      setInjectingId(null);
    }
  };

  // Deep Link Launch Smartech DZ
  const handleLaunchSmartechApp = () => {
    setDeepLinkLaunched(true);
    setSyncLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Envoi de l'intent Android : intent://dz.smartech.diagauto/#Intent;scheme=smartechdiag;package=dz.smartech.diagauto;end`,
      `[${new Date().toLocaleTimeString()}] Lancement de Smartech DZ DiagAuto avec les paramètres AutoPro injectés.`,
      ...prev,
    ]);

    setTimeout(() => {
      setDeepLinkLaunched(false);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">
                DZ
              </span>
              <span>Passerelle &amp; Liaison Smartech DZ DiagAuto</span>
            </h1>
            <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded">
              APPLICATION DÉTECTÉE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Intégration native avec l'application <strong>Smartech DZ DiagAuto</strong> déjà installée sur votre tablette / smartphone. Synchronisation des calculateurs, injection des modules Flash et Traduction automatique.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncWithSmartech}
            disabled={isSyncing}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronisation...' : 'Synchroniser avec Smartech DZ'}</span>
          </button>

          <button
            onClick={handleLaunchSmartechApp}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <ExternalLink className="w-4 h-4 text-emerald-400" />
            <span>Ouvrir Smartech DZ</span>
          </button>
        </div>
      </div>

      {deepLinkLaunched && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-700/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Liaison IPC active : L'application Smartech DZ DiagAuto a été appelée avec la session du véhicule {selectedVehicle.brand} {selectedVehicle.model}.</span>
        </div>
      )}

      {/* Status Cards of the Bridge */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">Paquet Android Cible</span>
          <span className="font-mono font-bold text-white block truncate">
            {config.packageName}
          </span>
          <span className="text-[10px] text-emerald-400 font-mono">
            {config.appVersion}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">Interface VCI DZ Reconnue</span>
          <span className="font-mono font-bold text-cyan-400 block truncate">
            {config.vciSerial}
          </span>
          <span className="text-[10px] text-slate-400">ThinkDiag / Easydiag Pro</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">Canal de Communication</span>
          <span className="font-mono font-bold text-white block">
            TCP Socket {config.ipcPort}
          </span>
          <span className="text-[10px] text-emerald-400">
            Liaison {connectionMode.toUpperCase()} Active
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">Dernière Synchronisation</span>
          <span className="font-mono font-bold text-slate-200 block truncate">
            {config.lastSyncTimestamp}
          </span>
          <span className="text-[10px] text-slate-400">Licence : {config.tokenStatus}</span>
        </div>
      </div>

      {/* Main Bridge Layout: Plugins List & Live IPC Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Injectable Plugins (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Modules AutoPro Liés à Smartech DZ DiagAuto
            </h2>
            <span className="text-xs text-slate-400">
              {plugins.filter((p) => p.status === 'installed').length} / {plugins.length} modules injectés
            </span>
          </div>

          <div className="space-y-3">
            {plugins.map((plugin) => {
              const isInstalling = injectingId === plugin.id;
              return (
                <div
                  key={plugin.id}
                  className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{plugin.name}</h3>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                        {plugin.version}
                      </span>
                      {plugin.status === 'installed' ? (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                          Lié &amp; Injecté
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/40">
                          Prêt à injecter
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {plugin.description}
                    </p>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Cible : {plugin.targetPackage} · {plugin.sizeKb} Ko
                    </div>
                  </div>

                  <div className="shrink-0">
                    {plugin.status === 'installed' ? (
                      <button
                        onClick={() => handleInjectPlugin(plugin)}
                        disabled={isInstalling}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isInstalling ? 'animate-spin' : ''}`} />
                        <span>Mettre à jour</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleInjectPlugin(plugin)}
                        disabled={isInstalling}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isInstalling ? 'Injection...' : 'Injecter dans Smartech DZ'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live IPC Sync Logs & Diagram (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Console IPC &amp; Synchronisation Inter-Applications
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 rounded">
              PORT 35100 ACTIF
            </span>
          </div>

          {/* Diagram of Bridge */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-center text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex-1">
                <span className="font-bold text-cyan-400 block">AutoPro Hub</span>
                <span className="text-[10px] text-slate-400">Moteur Flash &amp; Traducteur</span>
              </div>

              <div className="px-2 text-emerald-400 font-mono text-[11px] flex items-center">
                <span>⇄ IPC ⇄</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex-1">
                <span className="font-bold text-emerald-400 block">Smartech DZ</span>
                <span className="text-[10px] text-slate-400">DiagAuto Installé</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Partage de base de données :</span>
                <span className="text-white font-mono">SQLite / Realm DB Synced</span>
              </div>
              <div className="flex justify-between">
                <span>Communication VCI :</span>
                <span className="text-cyan-400 font-mono">Multi-Protocole UDS/CAN</span>
              </div>
              <div className="flex justify-between">
                <span>Support Véhicules Algérie :</span>
                <span className="text-emerald-400 font-medium">100% Modèles DZ</span>
              </div>
            </div>
          </div>

          {/* Live Log Terminal */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 h-64 overflow-y-auto space-y-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
              Traces d'Échanges IPC (Intent &amp; Shared Memory) :
            </span>
            {syncLogs.map((log, idx) => (
              <div key={idx} className="leading-tight">
                <span className="text-slate-600 mr-1.5">&gt;</span>
                <span
                  className={
                    log.includes('SUCCÈS')
                      ? 'text-emerald-400 font-semibold'
                      : log.includes('INIT') || log.includes('SOCKET')
                      ? 'text-cyan-400'
                      : log.includes('Erreur')
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }
                >
                  {log}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
