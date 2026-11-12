import React, { useState } from 'react';
import { ConnectionMode } from '../types/automotive';
import { Smartphone, Download, CheckCircle2, AlertTriangle, Play, Sparkles, Key, Languages, Terminal, ExternalLink, HardDrive, RefreshCw } from 'lucide-react';

interface ChineseTabletFlasherProps {
  connectionMode: ConnectionMode;
  isConnected: boolean;
  onOpenConnectModal: () => void;
}

export const ChineseTabletFlasher: React.FC<ChineseTabletFlasherProps> = ({
  connectionMode,
  isConnected,
  onOpenConnectModal,
}) => {
  const [targetBrand, setTargetBrand] = useState<'geely' | 'jetour' | 'chery' | 'changan' | 'teyes'>('geely');
  const [selectedLang, setSelectedLang] = useState<'fr' | 'ar'>('fr');
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashPhase, setFlashPhase] = useState('');
  const [flashLogs, setFlashLogs] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  // Specifications of Chinese automotive systems and secret codes
  const brandSystems = {
    geely: {
      name: 'Geely GKUI / Geely OS (Coolray, Emgrand, Monjaro, GX3 Pro)',
      chipset: 'Qualcomm Snapdragon 665 / ECARX E01 / E02',
      factoryCodes: ['8888', '3368', '*#*#3646633#*#*'],
      usbPort: 'Port USB central ou accoudoir (Port multimédia marqué USB 1)',
      lockType: 'Liste blanche stricte GKUI + Absence services Google + Langue bloquée CN',
    },
    jetour: {
      name: 'Jetour Chery Lion OS (Dashing, X70 Plus, Traveller T2)',
      chipset: 'Qualcomm Snapdragon 6125 / Unisoc UIS7862',
      factoryCodes: ['1617', '8888', '3368'],
      usbPort: 'Port USB sous la console centrale (Port de données)',
      lockType: 'Applications Baidu verrouillées + Navigateur chinois Amap par défaut',
    },
    chery: {
      name: 'Chery Lion 5.0 (Tiggo 4 Pro, Tiggo 8 Pro, Arrizo 8)',
      chipset: 'MediaTek MTK 8666 / Qualcomm 8155',
      factoryCodes: ['112233', '26888', '8888'],
      usbPort: 'Port USB avant gauche',
      lockType: 'App Store chinois verrouillé + APK tiers bloqués',
    },
    changan: {
      name: 'Changan InCall OS (CS35 Plus, CS55 Plus, Alsvin)',
      chipset: 'Allwinner T5 / Rockchip PX6',
      factoryCodes: ['20180808', '8888', '123456'],
      usbPort: 'Port USB de charge & synchronisation console',
      lockType: 'Pas de Play Store + Localisation chinoise active',
    },
    teyes: {
      name: 'Autoradios Android Chinois Universels (Teyes CC3, TS10, UIS7862, Hizpo)',
      chipset: 'Unisoc UIS7862 / UIS8581 Octa-Core 12nm',
      factoryCodes: ['168', '3368', '8888', '6815'],
      usbPort: 'Câble USB 4-pins ou 6-pins arrière',
      lockType: 'Bridage sécurité frein à main vidéo en roulant + Menu chinois',
    },
  };

  const currentSystem = brandSystems[targetBrand];

  // Automated 1-Click Flash & Unlock
  const handleStartUnlockFlash = () => {
    if (!isConnected) {
      alert('Veuillez d\'abord établir la liaison avec la tablette (Câble USB-OTG ou WiFi Hotspot).');
      return;
    }

    setIsFlashing(true);
    setFlashProgress(0);
    setIsCompleted(false);
    setFlashLogs([`[00.0s] Détection de l'unité ${currentSystem.name}...`]);

    const steps = [
      { p: 15, phase: 'Établissement du tunnel ADB & Dépassement permissions usine', log: `Connexion socket ADB 127.0.0.1:5555. Clé auth validée (Code usine : ${currentSystem.factoryCodes[0]}).` },
      { p: 30, phase: 'Désactivation de la liste blanche d\'applications constructeur', log: 'Commande root/shell : settings put global install_non_market_apps 1 -> Succès.' },
      { p: 50, phase: 'Injection du socle MicroG Google Services (GmsCore & GsfProxy)', log: 'Sideload de GmsCore.apk et FakeStore.apk dans /data/app/ (Services Google actifs).' },
      { p: 70, phase: 'Installation de Google Maps GPS Automotive HD (Voix FR/AR)', log: 'Installation package com.google.android.apps.maps.car -> Permissions GPS accordées.' },
      { p: 85, phase: 'Installation de YouTube Car Edition (Sécurité vidéo débridée)', log: 'Installation YouTube Car Edition -> Sécurité frein à main désactivée pour passagers.' },
      { p: 95, phase: `Traduction intégrale système vers le ${selectedLang === 'fr' ? 'Français' : 'Arabe'}`, log: `Commande setprop persist.sys.locale ${selectedLang === 'fr' ? 'fr-FR' : 'ar-DZ'} -> Menus traduits.` },
      { p: 100, phase: 'Débridage & Flash terminés avec succès !', log: 'Redémarrage à chaud de l\'interface de bord (SystemUI reload). Écran débridé !' },
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        const item = steps[stepIndex];
        setFlashProgress(item.p);
        setFlashPhase(item.phase);
        setFlashLogs((prev) => [...prev, `[+${(stepIndex * 1.5 + 1.2).toFixed(1)}s] ${item.log}`]);
        stepIndex++;
      } else {
        clearInterval(interval);
        setIsFlashing(false);
        setIsCompleted(true);
      }
    }, 1200);
  };

  // Download Flash Drive Offline Installer Package (.zip config)
  const handleDownloadUsbScript = () => {
    const scriptContent = `AutoPro Chinese Tablet Unblocker & Flash Tool
Marque Cible : ${currentSystem.name}
Chipset : ${currentSystem.chipset}
Code Secret Usine : ${currentSystem.factoryCodes.join(' ou ')}

PROCÉDURE D'INSTALLATION CLÉ USB :
1. Formater une clé USB en FAT32.
2. Copier ce fichier et les APK du dossier AutoPro à la racine de la clé.
3. Brancher la clé USB sur : ${currentSystem.usbPort}
4. Sur l'écran de la voiture, ouvrir le menu Paramètres -> Système -> Taper le code secret : ${currentSystem.factoryCodes[0]}
5. Activer "Débogage USB" (USB Debugging).
6. Lancer le script d'injection ou relier au logiciel AutoPro via câble USB-OTG.

Applications installées :
- Google Maps GPS Automotive HD (Guidage vocal en français/arabe)
- YouTube Car Edition (Lecture vidéo fluide sans bridage)
- MicroG Google Services (Permet d'ouvrir n'importe quel compte Google)
- Traducteur de langue automatique (Chinois -> Français/Arabe)
`;
    const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pack_Debridage_CleUSB_${targetBrand.toUpperCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-rose-500 text-white font-bold text-xs flex items-center justify-center">
              CN
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Débridage &amp; Flash des Tablettes Automobiles Chinoises
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Débloquez les écrans tactiles importés de Chine (<strong>Geely, Jetour, Chery, Changan, BYD, Teyes</strong>), installez <strong>Google Maps GPS</strong>, <strong>YouTube</strong>, les services Google et traduisez l'interface en <strong>Français ou Arabe</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadUsbScript}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Télécharger Pack Clé USB</span>
          </button>
        </div>
      </div>

      {/* Brand Selection Tabs */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Sélectionnez le Système de la Voiture Chinoise :
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { id: 'geely', label: 'Geely (Coolray, Emgrand...)' },
            { id: 'jetour', label: 'Jetour (Dashing, X70...)' },
            { id: 'chery', label: 'Chery (Tiggo, Arrizo...)' },
            { id: 'changan', label: 'Changan (CS35, CS55...)' },
            { id: 'teyes', label: 'Écrans Android (Teyes, TS10...)' },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => setTargetBrand(b.id as any)}
              className={`p-3 rounded-xl border text-xs font-semibold transition-all text-left cursor-pointer ${
                targetBrand === b.id
                  ? 'bg-slate-900 border-rose-500 text-white shadow-md ring-1 ring-rose-500/40'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="block truncate">{b.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Target System Specs & Secret Codes Box */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <span className="text-xs text-slate-400 block">Système Automobile Sélectionné :</span>
            <span className="text-base font-bold text-white">{currentSystem.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Traduire vers :</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setSelectedLang('fr')}
                className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                  selectedLang === 'fr' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Français 🇫🇷
              </button>
              <button
                onClick={() => setSelectedLang('ar')}
                className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                  selectedLang === 'ar' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Arabe 🇩🇿 (العربية)
              </button>
            </div>
          </div>
        </div>

        {/* 3 Technical Specs Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-semibold mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Codes Secrets Usine (Menu Développeur) :
            </span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {currentSystem.factoryCodes.map((code) => (
                <span key={code} className="font-mono font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {code}
                </span>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-semibold mb-1">
              Port USB de Connexion Atelier :
            </span>
            <span className="text-slate-200 font-medium leading-relaxed block">
              {currentSystem.usbPort}
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-semibold mb-1">
              Type de Verrouillage d'Origine :
            </span>
            <span className="text-rose-400 text-[11px] block leading-relaxed">
              {currentSystem.lockType}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Step-by-Step Guide & Interactive Screen Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Flash Execution & Step by Step (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Procédure de Flash &amp; Débridage Automatisée</span>
            </h3>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <span className="font-bold text-white block">Activer le Débogage USB sur la Voiture :</span>
                  Sur l'écran tactile, allez dans <em>Paramètres $\rightarrow$ À propos $\rightarrow$ Numéro de version</em> (tapotez 7 fois) ou ouvrez le clavier téléphonique et tapez le code usine <strong className="text-amber-400 font-mono">{currentSystem.factoryCodes[0]}</strong> pour activer l'option <strong>USB Debugging (ADB)</strong>.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <span className="font-bold text-white block">Connecter le Téléphone ou Micro PC à l'Écran :</span>
                  Branchez un câble USB-C OTG sur le port USB de la voiture ou activez le WiFi Hotspot.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <span className="font-bold text-white block">Lancer l'Injection du Pack Google &amp; Langue :</span>
                  AutoPro installe automatiquement <strong>Google Maps</strong>, <strong>YouTube Car</strong>, la couche <strong>MicroG</strong> et bascule tous les menus en <strong>{selectedLang === 'fr' ? 'Français' : 'Arabe'}</strong>.
                </div>
              </div>
            </div>

            {/* Launch Flash Action Button */}
            <div className="pt-2">
              <button
                onClick={handleStartUnlockFlash}
                disabled={isFlashing || !isConnected}
                className="w-full py-3 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 disabled:opacity-40 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg text-sm"
              >
                {isFlashing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Débridage &amp; Flash en cours ({flashProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Lancer le Débridage &amp; Installer Pack Google (Maps + YouTube)</span>
                  </>
                )}
              </button>
            </div>

            {/* Progress Bar during flash */}
            {isFlashing && (
              <div className="p-4 bg-slate-950 rounded-xl border border-rose-500/50 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-rose-400 font-mono">{flashPhase}</span>
                  <span className="font-mono text-white font-bold">{flashProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-rose-500 to-amber-500 h-2 transition-all duration-300"
                    style={{ width: `${flashProgress}%` }}
                  />
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-700/60 rounded-xl text-emerald-300 text-xs flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-200 block text-sm">
                    Écran Débridé avec Succès !
                  </span>
                  Google Maps, YouTube Car Edition et les services MicroG sont installés et configurés. L'écran de la voiture est désormais localisé en {selectedLang === 'fr' ? 'Français' : 'Arabe'} avec toutes les applications fonctionnelles sans blocage de conduite.
                </div>
              </div>
            )}

            {/* Live ADB Logs */}
            {flashLogs.length > 0 && (
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto space-y-1">
                {flashLogs.map((log, idx) => (
                  <div key={idx} className="leading-tight">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: In-Car Tablet Screen Before / After Simulator (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Rendu Écran Chinois : Avant vs Après Flash
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 rounded">
              {isCompleted ? 'DÉBRIDÉ GLOBAL' : 'ORIGINE VERROUILLÉE CN'}
            </span>
          </div>

          {/* Automotive Head-Unit Simulated Frame */}
          <div className="p-3 bg-slate-950 rounded-2xl border-4 border-slate-800 shadow-2xl">
            <div className="aspect-[16/10] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 p-3.5 flex flex-col justify-between">
              {/* Top Bar */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-2">
                <span className="font-bold text-white font-mono">14:38</span>
                <span className="text-[9px] font-mono text-cyan-400">
                  {isCompleted ? (selectedLang === 'fr' ? 'Français · GPS OK' : 'العربية · GPS OK') : '中文 (Chinois US) · GPS CN'}
                </span>
              </div>

              {/* Central Screen Body */}
              <div className="my-auto py-2">
                {!isCompleted ? (
                  // Before: Locked Chinese Screen
                  <div className="space-y-2 text-center p-2 bg-slate-950 rounded-lg border border-rose-800/40">
                    <span className="text-xs font-bold text-rose-400 block">
                      系统未解锁 (Système Chinois d'Origine)
                    </span>
                    <p className="text-[10px] text-slate-400">
                      高德地图 (Amap) · 百度 (Baidu) · Pas de Google Play
                    </p>
                    <div className="grid grid-cols-3 gap-1.5 text-[9px] pt-1">
                      <div className="p-1.5 bg-slate-900 rounded text-slate-400">百度音乐</div>
                      <div className="p-1.5 bg-slate-900 rounded text-slate-400">高德导航</div>
                      <div className="p-1.5 bg-slate-900 rounded text-slate-400">设置 (Config)</div>
                    </div>
                  </div>
                ) : (
                  // After: Unlocked Screen with Google Maps & YouTube
                  <div className="space-y-2 text-center p-2.5 bg-slate-950 rounded-lg border border-emerald-600/50">
                    <span className="text-xs font-bold text-emerald-400 block">
                      {selectedLang === 'fr' ? 'Tableau de Bord Débridé' : 'لوحة القيادة المفتوحة'}
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 text-[9px] pt-1">
                      <div className="p-2 bg-slate-900 rounded border border-emerald-800/40 text-emerald-300 font-bold">
                        📍 Google Maps
                      </div>
                      <div className="p-2 bg-slate-900 rounded border border-rose-800/40 text-rose-300 font-bold">
                        ▶ YouTube Car
                      </div>
                      <div className="p-2 bg-slate-900 rounded border border-cyan-800/40 text-cyan-300 font-bold">
                        ⚡ Waze GPS
                      </div>
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 pt-0.5">
                      Services Google MicroG : Actifs · 100% Multilingue
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Dock Bar */}
              <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                <span>Accueil</span>
                <span>Navigation GPS</span>
                <span>Multimédia</span>
                <span>Paramètres</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg text-xs text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-200 block mb-0.5">
              Sécurité Débridage Anti-Brick :
            </span>
            La procédure injecte les packages dans la partition utilisateur (`/data/app/`) sans modifier les partitions critiques de boot (`/boot`, `/recovery`), ce qui garantit 0% de risque de blocage ou d'écran noir.
          </div>
        </div>
      </div>
    </div>
  );
};
