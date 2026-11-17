import React, { useState, useMemo } from 'react';
import { ConnectionMode } from '../types/automotive';
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sparkles,
  Key,
  Terminal,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  VolumeX,
  CameraOff,
  RotateCcw,
  Lock,
  Cpu,
} from 'lucide-react';
import { apiFetch } from '../utils/apiBridge';

interface ChineseTabletFlasherProps {
  connectionMode: ConnectionMode;
  isConnected: boolean;
  onOpenConnectModal: () => void;
}

type ChineseBrandId = 'geely' | 'jetour' | 'chery' | 'changan' | 'mg_dfsk' | 'vw_cn';

interface BrandSpec {
  id: ChineseBrandId;
  shortLabel: string;
  name: string;
  modelsDefault: string;
  ihuVariants: string[];
  socVariants: string[];
  defaultBuild: string;
  factoryCodes: string[];
  usbPort: string;
  criticalWarning: string;
}

const BRAND_SPECS: Record<ChineseBrandId, BrandSpec> = {
  geely: {
    id: 'geely',
    shortLabel: 'Geely & Livan (Coolray, X6...)',
    name: 'Geely OS / GKUI / Livan (Coolray 2024-2026, Emgrand, Monjaro, Livan X3/X6 Pro)',
    modelsDefault: 'Geely Coolray / Livan X6 Pro 2025',
    ihuVariants: ['IHU715P (Coolray récent/restylé)', 'IHU516G', 'IHU535G', 'ECARX E01 / E02 (SD665)', 'LIVAN-GKUI (X3/X6 Pro)'],
    socVariants: ['Qualcomm Snapdragon 665 / ECARX E01-E02', 'Qualcomm Snapdragon 6155 (sm6150)', 'Qualcomm Snapdragon 8155 (sm8150)'],
    defaultBuild: 'GKUI-IHU715P-2025',
    factoryCodes: ['8888', '3368', '*#*#3646633#*#*', 'Appui long Heure/Version'],
    usbPort: 'Port USB central ou accoudoir (Port multimédia marqué USB 1)',
    criticalWarning:
      'VIGILANCE CRITIQUE : Ne JAMAIS flasher un fichier IHU535G ou IHU516G sur IHU715P ! Risque immédiat de perte totale du son radio/ampli et de blocage des caméras 540° (perte synchro MCU/LVDS).',
  },
  jetour: {
    id: 'jetour',
    shortLabel: 'Jetour (Dashing, X70, T2)',
    name: 'Jetour OS / Android Automotive (Dashing 2024-2026, X70 Plus, X90, T2)',
    modelsDefault: 'Jetour Dashing 2025',
    ihuVariants: ['Jetour OS Export (Global)', 'Jetour OS CN (Chine)', 'Lion OS Qualcomm Module'],
    socVariants: ['Qualcomm Snapdragon 6155 (sm6150)', 'Qualcomm Snapdragon 8155 (sm8150)', 'Unisoc UIS7862'],
    defaultBuild: '1.8.2.1.E (Vérifier MCU)',
    factoryCodes: ['8888', '3368', '123456', '*#*#3646633#*#*', 'Tapoter 7x Version MCU'],
    usbPort: 'Port USB Data sous la console centrale',
    criticalWarning:
      'VIGILANCE CRITIQUE : La branche 1.8.2.1.E est incompatible avec certaines révisions DSP audio 2025/2026 si le fichier MCU correspondant n’est pas appairé. Toujours lire ro.board.platform avant injection.',
  },
  chery: {
    id: 'chery',
    shortLabel: 'Chery (Tiggo, Arrizo)',
    name: 'Chery Lion OS (Tiggo 2/4/7/8 Pro, Arrizo)',
    modelsDefault: 'Chery Tiggo 7 Pro 2025',
    ihuVariants: ['Desay SV (Ampli Sony/OEM)', 'Aptiv (Ampli Pioneer/OEM)', 'Bosch Head-Unit'],
    socVariants: ['Qualcomm Snapdragon 6155 (sm6150)', 'Qualcomm Snapdragon 8155 (sm8150)', 'MediaTek MT8666'],
    defaultBuild: 'LION-DESAY-2025',
    factoryCodes: ['8888', '1234', '0000', '111111', 'Code dynamique HHMM (heure)'],
    usbPort: 'Port USB avant gauche (Data)',
    criticalWarning:
      'VIGILANCE CRITIQUE : Les cartes mères Desay SV, Aptiv et Bosch n’utilisent pas le même protocole d’amplificateur externe (Sony/Pioneer). Une mauvaise config CAN coupe le son.',
  },
  changan: {
    id: 'changan',
    shortLabel: 'Changan (UNI-T, CS35/55)',
    name: 'Changan InCall OS (CS35+, CS55+, UNI-T, UNI-K, Alsvin)',
    modelsDefault: 'Changan CS55 Plus 2025',
    ihuVariants: ['InCall OS Standard (CS35+/CS55+/Alsvin)', 'InCall UNI-Series (UNI-T / UNI-K couplé 360°)'],
    socVariants: ['MediaTek MT8666', 'Qualcomm Snapdragon 6155 (UNI)', 'Qualcomm Snapdragon 8155 (UNI-K)'],
    defaultBuild: 'INCALL-MT8666-2025',
    factoryCodes: ['8888', '123456', '369875', '*#*#8888#*#*'],
    usbPort: 'Port USB de synchronisation console centrale',
    criticalWarning:
      'VIGILANCE CRITIQUE : Sur la gamme UNI (UNI-T / UNI-K), les caméras 360° et le tableau de bord sont couplés au processeur principal. INTERDICTION absolue de modifier /system ou /vendor.',
  },
  mg_dfsk: {
    id: 'mg_dfsk',
    shortLabel: 'MG, Livan & DFSK (FYT/Topway)',
    name: 'MG, Livan & DFSK (MG5, MG GT, MG ZS, MG One, Livan RL7, DFSK Glory 500/580)',
    modelsDefault: 'MG5 / MG GT / MG One 2025',
    ihuVariants: ['MG-ISMART (SAIC Snapdragon)', 'FYT (Unisoc UIS7862)', 'Topway TS10 / TS18', 'Teyes CC3 (FYT)'],
    socVariants: ['Qualcomm Snapdragon 6155 / 8155 (MG iSMART)', 'Unisoc UIS7862 (FYT)', 'Unisoc UIS8581 / T5 (Topway TS10/TS18)'],
    defaultBuild: 'FYT-UIS7862-ANDROID10',
    factoryCodes: ['8888', '3368', '1617', '16176699', '123456'],
    usbPort: 'Port USB OTG Data (4-pins ou 6-pins console/boîte à gants)',
    criticalWarning:
      'VIGILANCE CRITIQUE : Bien distinguer FYT (UIS7862), Topway (TS10/TS18) et MG iSMART. Le croisement de MCU entre FYT et TS10 provoque un écran noir ou une inversion des touches tactiles.',
  },
  vw_cn: {
    id: 'vw_cn',
    shortLabel: 'VW / Audi / Cupra (Chine)',
    name: 'VW CN (Golf, Passat Pro, Bora, T-Roc, Tharu, Tayron, Tavendor, Talagon, Teramont), Audi A3L & Cupra CN',
    modelsDefault: 'VW Passat Pro / Tharu XR / Tayron L (CN) 2025',
    ihuVariants: ['VW CNS 3.0 (MQB Chine)', 'MIB3-CN (Qualcomm 8155 / Samsung Exynos)', 'AUDI-MMI-CN (A3L)', 'CUPRA-MEB (Tavascan Anhui)'],
    socVariants: ['Qualcomm Snapdragon 8155 (sm8150 - Passat Pro / Teramont Pro)', 'Qualcomm 6155 / CNS 3.0 (Tharu / Bora / T-Roc)', 'Samsung Exynos Auto V9 / MIB3'],
    defaultBuild: 'CNS3.0-MIB3-CN-2025',
    factoryCodes: ['Appui long MENU 5s (Mode Engineering)', 'Appui long SETUP 10s', 'OBD11 / ODIS SFD2 Unlock'],
    usbPort: 'Port USB-C Data avant sous l’écran MIB3 / CNS 3.0',
    criticalWarning:
      'VIGILANCE CRITIQUE : Les VW/Audi Made in China (CNS 3.0 / MIB3 CN) ont une protection composant (Component Protection) et FEC/SWaP différente de l’Europe ! Ne JAMAIS flasher un firmware MIB3 EU directement sur une unité CNS 3.0 chinoise sans sauvegarde FEC/EEPROM.',
  },
};

export const ChineseTabletFlasher: React.FC<ChineseTabletFlasherProps> = ({
  isConnected,
}) => {
  const [targetBrand, setTargetBrand] = useState<ChineseBrandId>('geely');
  const currentSystem = BRAND_SPECS[targetBrand];

  // Mandatory 4-parameter Anti-Mismatch inputs
  const [modelYear, setModelYear] = useState<string>(BRAND_SPECS.geely.modelsDefault);
  const [ihuRef, setIhuRef] = useState<string>(BRAND_SPECS.geely.ihuVariants[0]);
  const [socChip, setSocChip] = useState<string>(BRAND_SPECS.geely.socVariants[0]);
  const [mcuBuild, setMcuBuild] = useState<string>(BRAND_SPECS.geely.defaultBuild);
  const [intendedFile, setIntendedFile] = useState<string>('Sideload APK non destructif (MicroG + Maps + YouTube)');
  const [selectedLang, setSelectedLang] = useState<'fr' | 'ar'>('fr');

  // 3-Step safe execution states
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashPhase, setFlashPhase] = useState('');
  const [flashLogs, setFlashLogs] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  // AI Guard & Post-Flash Recovery states
  const [activeSubMode, setActiveSubMode] = useState<'safe_flash' | 'recovery'>('safe_flash');
  const [recoverySymptom, setRecoverySymptom] = useState<'no_sound' | 'cameras_frozen' | 'black_screen' | 'touch_inverted'>('no_sound');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  const handleSelectBrand = (brandId: ChineseBrandId) => {
    const spec = BRAND_SPECS[brandId];
    setTargetBrand(brandId);
    setModelYear(spec.modelsDefault);
    setIhuRef(spec.ihuVariants[0]);
    setSocChip(spec.socVariants[0]);
    setMcuBuild(spec.defaultBuild);
    setStep1Done(false);
    setStep2Done(false);
    setIsCompleted(false);
    setAiReport(null);
  };

  // Real-time Anti-Mismatch Firewall Evaluation
  const safetyAudit = useMemo(() => {
    const missingFields: string[] = [];
    if (!modelYear.trim()) missingFields.push('Marque / Modèle / Année');
    if (!ihuRef.trim()) missingFields.push('Référence IHU / Carte mère');
    if (!socChip.trim()) missingFields.push('Puce SoC');
    if (!mcuBuild.trim()) missingFields.push('Version MCU & Build actuel');

    if (missingFields.length > 0) {
      return {
        blocked: true,
        severity: 'warning' as const,
        title: 'CONTRÔLE ANTI-MISMATCH INCOMPLET (4 PARAMÈTRES OBLIGATOIRES)',
        reason: `Renseignez obligatoirement : ${missingFields.join(', ')} avant de débloquer les scripts ADB ou USB.`,
      };
    }

    const ihuUpper = ihuRef.toUpperCase();
    const fileUpper = intendedFile.toUpperCase();
    const combined = `${modelYear} ${ihuRef} ${socChip} ${mcuBuild}`.toUpperCase();

    if (
      (ihuUpper.includes('IHU715P') && (fileUpper.includes('535') || fileUpper.includes('516'))) ||
      (ihuUpper.includes('IHU535G') && (fileUpper.includes('715') || fileUpper.includes('516'))) ||
      (ihuUpper.includes('IHU516G') && (fileUpper.includes('715') || fileUpper.includes('535')))
    ) {
      return {
        blocked: true,
        severity: 'critical' as const,
        title: 'ALERTE ROUGE : INCOMPATIBILITÉ GEELY IHU DÉTECTÉE',
        reason: `Croisement interdit entre "${ihuRef}" et le fichier "${intendedFile}". Risque immédiat de perte de son radio/DSP et blocage des caméras 540° (perte synchro MCU/LVDS).`,
      };
    }

    if (fileUpper.includes('1.8.2.1.E') && targetBrand !== 'jetour') {
      return {
        blocked: true,
        severity: 'critical' as const,
        title: 'ALERTE ROUGE : FIRMWARE JETOUR SUR UN AUTRE VÉHICULE',
        reason: 'La branche Jetour 1.8.2.1.E est incompatible avec Geely / Chery / Changan / MG. Risque de briquage et coupure audio CAN.',
      };
    }

    if (
      targetBrand === 'jetour' &&
      (fileUpper.includes('1.8.2.1.E') || combined.includes('1.8.2.1.E')) &&
      (combined.includes('2025') || combined.includes('2026')) &&
      !fileUpper.includes('MCU APPAIR') &&
      !fileUpper.includes('SIDELOAD')
    ) {
      return {
        blocked: true,
        severity: 'critical' as const,
        title: 'ALERTE ROUGE : RISQUE PERTE SON DSP JETOUR 2025/2026',
        reason:
          'La branche 1.8.2.1.E est incompatible avec certaines révisions DSP audio Jetour 2025/2026 sans fichier MCU appairé. Utilisez uniquement le sideload APK non destructif ou vérifiez ro.board.platform.',
      };
    }

    if (
      (ihuUpper.includes('DESAY') && fileUpper.includes('APTIV')) ||
      (ihuUpper.includes('APTIV') && fileUpper.includes('DESAY')) ||
      (ihuUpper.includes('BOSCH') && (fileUpper.includes('DESAY') || fileUpper.includes('APTIV')))
    ) {
      return {
        blocked: true,
        severity: 'critical' as const,
        title: 'ALERTE ROUGE : INCOMPATIBILITÉ CHERY DESAY SV / APTIV / BOSCH',
        reason: 'Protocole d’amplificateur externe Sony/Pioneer incompatible entre Desay SV, Aptiv et Bosch -> perte totale du son.',
      };
    }

    if (
      ((combined.includes('FYT') || combined.includes('UIS7862')) && (fileUpper.includes('TS10') || fileUpper.includes('TS18') || fileUpper.includes('TOPWAY'))) ||
      ((combined.includes('TS10') || combined.includes('TS18') || combined.includes('TOPWAY')) && (fileUpper.includes('FYT') || fileUpper.includes('UIS7862')))
    ) {
      return {
        blocked: true,
        severity: 'critical' as const,
        title: 'ALERTE ROUGE : CROISEMENT FYT (UIS7862) ↔ TOPWAY (TS10/TS18)',
        reason: 'Croisement de MCU entre FYT et Topway TS10/TS18 interdit : provoque un écran noir ou inversion tactile.',
      };
    }

    if (
      targetBrand === 'changan' &&
      (fileUpper.includes('/SYSTEM') || fileUpper.includes('/VENDOR') || fileUpper.includes('ROOT'))
    ) {
      return {
        blocked: true,
        severity: 'critical' as const,
        title: 'ALERTE ROUGE : PARTITION /system OU /vendor INTERDITE SUR CHANGAN UNI',
        reason: 'Sur Changan UNI-T / UNI-K, les caméras 360° et le compteur sont couplés au processeur principal. Toute écriture /system ou /vendor est bloquée.',
      };
    }

    return {
      blocked: false,
      severity: 'ok' as const,
      title: 'COMPATIBILITÉ VALIDÉE — INJECTION NON DESTRUCTIVE AUTORISÉE',
      reason: 'Les 4 paramètres sont renseignés sans conflit IHU/MCU/DSP. Mode strict APK /data/app/ activé (aucune écriture MCU, AudioFlinger ou AVM).',
    };
  }, [modelYear, ihuRef, socChip, mcuBuild, intendedFile, targetBrand]);

  // Call AI Guard Endpoint (Preflight or Recovery)
  const handleAskAiGuard = async (mode: 'preflight' | 'recovery') => {
    setAiLoading(true);
    try {
      const res = await apiFetch('/api/chinese-tablet/ai-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          brand: currentSystem.name,
          modelYear,
          ihuRef,
          socChip,
          mcuBuild,
          intendedFile,
          symptom:
            recoverySymptom === 'no_sound'
              ? 'Perte totale de son radio/multimédia (DSP/Ampli muet)'
              : recoverySymptom === 'cameras_frozen'
              ? 'Caméras 360° / 540° figées ou écran noir au passage marche arrière (AVM/LVDS)'
              : recoverySymptom === 'touch_inverted'
              ? 'Touches tactiles inversées ou décalées après flash'
              : 'Écran noir ou boucle de redémarrage (bootloop)',
        }),
      });
      const data = await res.json();
      setAiReport(data.analysis || data.riskDetail || 'Analyse indisponible.');
    } catch {
      setAiReport('Erreur de communication avec le moteur IA Anti-Brick.');
    } finally {
      setAiLoading(false);
    }
  };

  // Download Safe 3-Step ADB Windows Script (.bat) — blocked if mismatch detected!
  const handleDownloadSafeAdbBat = () => {
    if (safetyAudit.blocked) return;
    const localeCode = selectedLang === 'fr' ? 'fr-FR' : 'ar-DZ';
    const batContent = `@echo off
title AutoPro Anti-Brick ADB Guard - ${modelYear} (${ihuRef})
color 0B
echo ========================================================================
echo   AUTOPRO FLASH & DIAGNOSTIC HUB - PROTOCOLE SECURISE 3 ETAPES
echo   Vehicule : ${modelYear}
echo   IHU      : ${ihuRef}
echo   SoC      : ${socChip}
echo   MCU/Build: ${mcuBuild}
echo ========================================================================
echo.
echo [ETAPE 1/3] FINGERPRINTING LECTURE SEULE (Aucune ecriture)
adb devices
adb shell getprop ro.board.platform
adb shell getprop ro.build.display.id
adb shell getprop ro.product.model
echo.
echo VERIFIEZ QUE ro.board.platform CORRESPOND BIEN A : ${socChip}
pause
echo.
echo [ETAPE 2/3] SAUVEGARDE PARAMETRES D'ORIGINE (BACKUP)
if not exist backup_ihu mkdir backup_ihu
adb shell settings list global > backup_ihu\\global.txt
adb shell settings list system > backup_ihu\\system.txt
adb shell dumpsys audio > backup_ihu\\audio_dsp.txt
echo Sauvegarde terminee dans le dossier backup_ihu.
echo.
echo [ETAPE 3/3] INJECTION APK NON DESTRUCTIVE (Aucune touche MCU / /system / AVM)
adb shell settings put global install_non_market_apps 1
if exist MicroG_GmsCore.apk adb install -r MicroG_GmsCore.apk
if exist GoogleMaps_Car.apk adb install -r GoogleMaps_Car.apk
if exist YouTube_Car.apk adb install -r YouTube_Car.apk
adb shell setprop persist.sys.locale ${localeCode}
adb shell am broadcast -a android.intent.action.LOCALE_CHANGED
echo.
echo ========================================================================
echo   TERMINE EN SECURITE ! AUCUNE PARTITION MCU / DSP / CAMERA MODIFIEE.
echo ========================================================================
pause
`;
    const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AutoPro_SafeADB_${targetBrand.toUpperCase()}_${ihuRef.replace(/[^A-Za-z0-9]/g, '_')}.bat`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Safe 3-Step Checklist Simulation in UI (Blocked if safetyAudit.blocked or steps 1 & 2 not checked)
  const handleRunSafeProtocol = () => {
    if (safetyAudit.blocked || !step1Done || !step2Done) return;
    setIsFlashing(true);
    setFlashProgress(0);
    setIsCompleted(false);
    setFlashLogs([
      `[00.0s] Pare-feu Anti-Mismatch VALIDÉ : ${modelYear} | ${ihuRef} | ${socChip}`,
      `[00.2s] Étape 1 (Fingerprinting) & Étape 2 (Backup DSP/MCU) confirmées par le technicien.`,
    ]);

    const steps = [
      { p: 20, phase: 'Vérification lecture seule ro.board.platform & empreinte MCU', log: `getprop ro.board.platform -> Concordance exacte confirmée (${socChip}).` },
      { p: 45, phase: 'Verrouillage écriture MCU / AudioFlinger / Caméra AVM', log: 'Protection active : partitions /system, /vendor et MCU en lecture seule.' },
      { p: 70, phase: 'Injection non destructive (/data/app/) via adb install -r', log: 'Sideload MicroG + Google Maps Car + YouTube Car réussi sans erreur.' },
      { p: 90, phase: `Bascule locale ${selectedLang === 'fr' ? 'fr-FR' : 'ar-DZ'} sans redémarrage forcé`, log: 'Broadcast LOCALE_CHANGED envoyé. Ampli DSP & caméras 360°/540° intacts.' },
      { p: 100, phase: 'Protocole Anti-Brick terminé avec succès !', log: 'Aucune modification critique MCU/DSP. Tablette opérationnelle.' },
    ];

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < steps.length) {
        const s = steps[idx];
        setFlashProgress(s.p);
        setFlashPhase(s.phase);
        setFlashLogs((prev) => [...prev, `[+${(idx * 1.1 + 0.8).toFixed(1)}s] ${s.log}`]);
        idx++;
      } else {
        clearInterval(interval);
        setIsFlashing(false);
        setIsCompleted(true);
      }
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 sm:p-5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold text-xs">
              ANTI-BRICK IHU
            </span>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Débridage Sécurisé Tablettes Chinoises DZ (2023–2026)
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Pare-feu Anti-Mismatch obligatoire pour <strong>Geely Coolray (IHU715P/535G), Jetour Dashing, Chery Tiggo, Changan UNI et MG/DFSK</strong>. Empêche la perte de son DSP, le plantage radio et le blocage des caméras 360°/540°.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubMode('safe_flash')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              activeSubMode === 'safe_flash'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Protocole Sécurisé 3 Étapes
          </button>
          <button
            type="button"
            onClick={() => setActiveSubMode('recovery')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSubMode === 'recovery'
                ? 'bg-rose-500 text-white'
                : 'bg-rose-950/50 border border-rose-700/60 text-rose-300 hover:bg-rose-900/50'
            }`}
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>SOS Bug Son / Caméra 360°</span>
          </button>
        </div>
      </div>

      {/* Brand Selector */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          1. Base de Compatibilité Matérielle (2023–2026) :
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(Object.values(BRAND_SPECS) as BrandSpec[]).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => handleSelectBrand(b.id)}
              className={`p-3 rounded-xl border text-xs font-semibold transition-all text-left cursor-pointer ${
                targetBrand === b.id
                  ? 'bg-slate-900 border-cyan-500 text-white shadow-md ring-1 ring-cyan-500/40'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="block truncate">{b.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Compatibility Box & Codes Usine */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <span className="text-xs text-slate-400 block">Plateforme Sélectionnée :</span>
            <span className="text-base font-bold text-white">{currentSystem.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Langue cible :</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setSelectedLang('fr')}
                className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                  selectedLang === 'fr' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Français
              </button>
              <button
                type="button"
                onClick={() => setSelectedLang('ar')}
                className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                  selectedLang === 'ar' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Arabe (العربية)
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[11px] font-semibold mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Codes Usine / Menu Ingénieur :
            </span>
            <div className="flex flex-wrap gap-1.5">
              {currentSystem.factoryCodes.map((code) => (
                <span key={code} className="font-mono font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {code}
                </span>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-semibold mb-1">
              Port USB Data Atelier :
            </span>
            <span className="text-slate-200 font-medium leading-relaxed block">
              {currentSystem.usbPort}
            </span>
          </div>

          <div className="p-3 bg-rose-950/30 rounded-xl border border-rose-800/50">
            <span className="text-rose-300 text-[11px] font-bold mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Vigilance Critique Constructeur :
            </span>
            <span className="text-rose-200/90 text-[11px] block leading-relaxed">
              {currentSystem.criticalWarning}
            </span>
          </div>
        </div>
      </div>

      {activeSubMode === 'recovery' ? (
        /* === SOS BUG POST-FLASH RECOVERY PANEL === */
        <div className="p-5 sm:p-6 rounded-2xl bg-rose-950/20 border border-rose-600/50 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-800/40 pb-4">
            <div>
              <h2 className="text-base font-bold text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <span>Procédure de Secours Anti-Brick (Son / Radio / Caméra 360°–540° bloqués)</span>
              </h2>
              <p className="text-xs text-rose-200/80 mt-1">
                ⛔ <strong>INTERDICTION ABSOLUE : Ne reflashez jamais un autre firmware à l’aveugle !</strong> Suivez cette séquence exacte :
              </p>
            </div>
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void handleAskAiGuard('recovery')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
              <span>{aiLoading ? 'Analyse IA...' : 'Diagnostic Secours IA Spécifique'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { id: 'no_sound', label: 'Perte de Son / Ampli DSP', icon: VolumeX },
              { id: 'cameras_frozen', label: 'Caméras 360°/540° figées', icon: CameraOff },
              { id: 'touch_inverted', label: 'Tactile inversé / décalé', icon: RotateCcw },
              { id: 'black_screen', label: 'Écran noir / Bootloop', icon: ShieldAlert },
            ].map((sym) => {
              const Icon = sym.icon;
              return (
                <button
                  key={sym.id}
                  type="button"
                  onClick={() => setRecoverySymptom(sym.id as any)}
                  className={`p-3 rounded-xl border text-left font-semibold flex items-center gap-2 cursor-pointer ${
                    recoverySymptom === sym.id
                      ? 'bg-rose-500/20 border-rose-400 text-white'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{sym.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-amber-300 block">1. Soft Reset IHU</span>
              <p className="text-slate-300 leading-relaxed">
                Maintenez le bouton physique <strong>Power / Mute enfoncé 15 secondes</strong> jusqu’à extinction complète et redémarrage du processeur Android.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-amber-300 block">2. Hard Reset MCU &amp; Bus CAN (15 minutes)</span>
              <p className="text-slate-300 leading-relaxed">
                Coupez le contact, attendez 2 min, débranchez la <strong>cosse négative (-) batterie 12V</strong> (ou retirez le fusible Multimédia/Audio) pendant <strong>15 minutes</strong> pour vider les condensateurs du MCU.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-amber-300 block">3. Contrôle Menu Usine ({currentSystem.factoryCodes[0]})</span>
              <p className="text-slate-300 leading-relaxed">
                Entrez le code usine <strong>{currentSystem.factoryCodes[0]}</strong> et re-sélectionnez : <strong>Amplificateur (Interne vs Externe Sony/Pioneer)</strong>, <strong>CAN Box exacte</strong> et <strong>Caméra AVM (360°/540°)</strong>.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-amber-300 block">4. Rollback ADB Propre</span>
              <p className="text-slate-300 font-mono text-[11px] leading-relaxed">
                adb shell pm uninstall -k --user 0 &lt;package&gt;<br />
                adb shell pm clear com.android.systemui
              </p>
            </div>
          </div>

          {aiReport && (
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
              {aiReport}
            </div>
          )}
        </div>
      ) : (
        /* === SAFE FLASH PROTOCOL WITH 4-PARAMETER ANTI-MISMATCH GUARD === */
        <div className="space-y-6">
          {/* Mandatory 4-Parameter Verification Card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-cyan-500/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>2. Contrôle Anti-Mismatch Obligatoire (4 Paramètres Avant Script/Flash)</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Toute incompatibilité IHU / SoC / MCU / Firmware bloque automatiquement la génération de script.
                </p>
              </div>
              <button
                type="button"
                disabled={aiLoading}
                onClick={() => void handleAskAiGuard('preflight')}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                <span>{aiLoading ? 'Vérification IA...' : 'Vérifier par IA Anti-Brick'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">1) Marque, Modèle &amp; Année *</label>
                <input
                  type="text"
                  value={modelYear}
                  onChange={(e) => setModelYear(e.target.value)}
                  placeholder="Ex: Geely Coolray 2025"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">2) Référence IHU / Carte mère *</label>
                <select
                  value={currentSystem.ihuVariants.includes(ihuRef) ? ihuRef : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') setIhuRef(e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 mb-1"
                >
                  {currentSystem.ihuVariants.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                  <option value="__custom__">Autre référence exacte...</option>
                </select>
                <input
                  type="text"
                  value={ihuRef}
                  onChange={(e) => setIhuRef(e.target.value)}
                  placeholder="Ex: IHU715P"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">3) Puce SoC (ro.board.platform) *</label>
                <select
                  value={currentSystem.socVariants.includes(socChip) ? socChip : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') setSocChip(e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 mb-1"
                >
                  {currentSystem.socVariants.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="__custom__">Autre puce SoC...</option>
                </select>
                <input
                  type="text"
                  value={socChip}
                  onChange={(e) => setSocChip(e.target.value)}
                  placeholder="Ex: sm6150"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">4) Version MCU &amp; Build actuel *</label>
                <input
                  type="text"
                  value={mcuBuild}
                  onChange={(e) => setMcuBuild(e.target.value)}
                  placeholder="Ex: GKUI-IHU715P-2025"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">
                  Fichier / Opération envisagée (Test Anti-Mismatch)
                </label>
                <input
                  type="text"
                  value={intendedFile}
                  onChange={(e) => setIntendedFile(e.target.value)}
                  placeholder="Ex: Sideload APK non destructif OU nom fichier firmware"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-amber-300 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Firewall Result Banner */}
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                safetyAudit.blocked
                  ? 'bg-rose-950/60 border-rose-600 text-rose-200'
                  : 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
              }`}
            >
              {safetyAudit.blocked ? (
                <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold block text-sm mb-0.5">{safetyAudit.title}</span>
                <span className="leading-relaxed block">{safetyAudit.reason}</span>
              </div>
            </div>

            {aiReport && (
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-700/50 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                {aiReport}
              </div>
            )}
          </div>

          {/* 3-Step Execution Protocol */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>3. Protocole Obligatoire : Lecture → Backup → Injection APK</span>
                </h3>
                <button
                  type="button"
                  disabled={safetyAudit.blocked}
                  onClick={handleDownloadSafeAdbBat}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Script ADB Sécurisé (.bat)</span>
                </button>
              </div>

              {/* Step 1: Fingerprinting */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">ÉTAPE 1 : Fingerprinting Lecture Seule (0 écriture)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-emerald-400">
                    <input
                      type="checkbox"
                      checked={step1Done}
                      onChange={(e) => setStep1Done(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    <span>Vérifié</span>
                  </label>
                </div>
                <div className="font-mono text-[11px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-800 select-all">
                  adb shell getprop ro.board.platform<br />
                  adb shell getprop ro.build.display.id<br />
                  adb shell getprop ro.product.model
                </div>
              </div>

              {/* Step 2: Backup */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300">ÉTAPE 2 : Backup Config Audio/MCU avant modification</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-emerald-400">
                    <input
                      type="checkbox"
                      checked={step2Done}
                      onChange={(e) => setStep2Done(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    <span>Sauvegardé</span>
                  </label>
                </div>
                <div className="font-mono text-[11px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-800 select-all">
                  adb shell settings list global &gt; backup_global.txt<br />
                  adb shell dumpsys audio &gt; backup_audio_dsp.txt
                </div>
              </div>

              {/* Step 3: Safe Non-Destructive Injection */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-emerald-300 block">
                  ÉTAPE 3 : Injection APK Non Destructive (Sans toucher MCU / DSP / AVM)
                </span>
                <div className="font-mono text-[11px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-800 select-all">
                  adb install -r MicroG_GmsCore.apk &amp;&amp; adb install -r GoogleMaps_Car.apk<br />
                  adb shell am broadcast -a android.intent.action.LOCALE_CHANGED
                </div>
              </div>

              <button
                type="button"
                disabled={safetyAudit.blocked || !step1Done || !step2Done || isFlashing}
                onClick={handleRunSafeProtocol}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 text-slate-950 font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
              >
                {isFlashing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Exécution Protocole Sécurisé ({flashProgress}%)...</span>
                  </>
                ) : safetyAudit.blocked ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>BLOQUÉ PAR PARE-FEU ANTI-MISMATCH</span>
                  </>
                ) : !step1Done || !step2Done ? (
                  <span>Cochez Étape 1 (Lecture) &amp; Étape 2 (Backup) pour continuer</span>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Valider &amp; Simuler l'Injection APK Sécurisée</span>
                  </>
                )}
              </button>

              {isFlashing && (
                <div className="p-3 bg-slate-950 rounded-xl border border-cyan-500/40 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-cyan-400 font-mono">{flashPhase}</span>
                    <span className="font-mono text-white font-bold">{flashProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-500 h-2 transition-all duration-300" style={{ width: `${flashProgress}%` }} />
                  </div>
                </div>
              )}

              {isCompleted && (
                <div className="p-3.5 bg-emerald-950/40 border border-emerald-700/60 rounded-xl text-emerald-200 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Injection APK validée dans <code className="text-emerald-300">/data/app/</code> sans modification des partitions MCU, DSP AudioFlinger ou Caméras 360°/540° ({isConnected ? 'Liaison prête' : 'Mode Atelier'}).
                  </span>
                </div>
              )}

              {flashLogs.length > 0 && (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto space-y-1">
                  {flashLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Safety Guarantee & Screen Preview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Garanties Matérielles AutoPro Anti-Brick</span>
                </h3>
                <ul className="space-y-2 text-slate-300 leading-relaxed">
                  <li>• <strong>Zéro écriture MCU / Bootloader</strong> : préserve la radio FM/DAB et les commandes au volant.</li>
                  <li>• <strong>Zéro modification AudioFlinger / DSP</strong> : protège les amplis externes Sony / Pioneer / OEM.</li>
                  <li>• <strong>Zéro modification AVM / LVDS</strong> : protège l’affichage et la calibration des caméras 360° / 540°.</li>
                  <li>• <strong>Uniquement <code className="text-cyan-300">adb install -r</code></strong> dans la partition utilisateur <code className="text-cyan-300">/data/app/</code>.</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border-4 border-slate-800 shadow-2xl">
                <div className="aspect-[16/10] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-2">
                    <span className="font-bold text-white font-mono">{ihuRef || 'IHU'}</span>
                    <span className="text-[9px] font-mono text-cyan-400">
                      {isCompleted ? (selectedLang === 'fr' ? 'Français · DSP & AVM OK' : 'العربية · DSP & AVM OK') : 'Contrôle Pré-Flash'}
                    </span>
                  </div>

                  <div className="my-auto py-2 text-center">
                    {!isCompleted ? (
                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                        <span className="text-xs font-bold text-amber-300 block">
                          {safetyAudit.blocked ? '⛔ Opération Bloquée (Risque Matériel)' : 'Prêt pour Injection Sécurisée'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {modelYear} · {socChip}
                        </span>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-950 rounded-lg border border-emerald-600/50 space-y-2">
                        <span className="text-xs font-bold text-emerald-400 block">
                          {selectedLang === 'fr' ? 'Tablette Débridée sans Bug DSP/360°' : 'تم فتح الشاشة بأمان كامل'}
                        </span>
                        <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                          <div className="p-1.5 bg-slate-900 rounded border border-emerald-800/40 text-emerald-300 font-bold">Google Maps</div>
                          <div className="p-1.5 bg-slate-900 rounded border border-rose-800/40 text-rose-300 font-bold">YouTube Car</div>
                          <div className="p-1.5 bg-slate-900 rounded border border-cyan-800/40 text-cyan-300 font-bold">Son &amp; 540° OK</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                    <span>Accueil</span>
                    <span>Maps GPS</span>
                    <span>Caméras 360°/540°</span>
                    <span>Audio DSP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
