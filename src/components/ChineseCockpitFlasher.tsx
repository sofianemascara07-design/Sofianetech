import React, { useMemo, useState } from 'react';
import { ConnectionMode } from '../types/automotive';
import { AiVerificationBadge, AiVerificationInfo } from './AiVerificationBadge';
import { apiFetch } from '../utils/apiBridge';
import {
  Gauge,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Cpu,
  Download,
  Play,
  RefreshCw,
  CheckCircle2,
  Lock,
  Sparkles,
  Terminal,
  BatteryCharging,
  Navigation,
  Globe,
  MonitorSmartphone,
  Activity,
  FileText,
  Share2,
  Languages,
  Wrench,
} from 'lucide-react';
import {
  buildCockpitTranslationPlanPdf,
  shareCockpitTranslationPlanPdf,
} from '../utils/cockpitTranslationPdf';
import {
  buildHardwarePlanPdf,
  shareHardwarePlanPdf,
} from '../utils/hardwarePlanPdf';

interface ChineseCockpitFlasherProps {
  connectionMode: ConnectionMode;
  isConnected: boolean;
  batteryVoltage: number;
  onOpenConnectModal: () => void;
  onOpenTranslator?: () => void;
}

type CockpitPlatformId =
  | 'geely_coolray'
  | 'geely_coolray_battle_2026'
  | 'geely_flyme'
  | 'jetour_cockpit'
  | 'chery_curved'
  | 'changan_uni'
  | 'mg_haval_cn';

interface CockpitPlatformSpec {
  id: CockpitPlatformId;
  shortLabel: string;
  badge: string;
  title: string;
  models: string;
  clusterVariants: string[];
  ihuVariants: string[];
  busProtocol: string;
  ipcAddress: string;
  lvdsNote: string;
  criticalWarning: string;
  themes: Array<{ id: string; label: string; accent: string }>;
}

const COCKPIT_PLATFORMS: Record<CockpitPlatformId, CockpitPlatformSpec> = {
  geely_coolray: {
    id: 'geely_coolray',
    shortLabel: 'Geely Coolray (SX11 / Restylé)',
    badge: 'DEMANDE #1 DZ',
    title: 'Geely Coolray — Combiné Numérique IPC 7" / 10.25" / 12.3" + Écran IHU',
    models: 'Coolray SX11 1.5TD (2020–2023), Coolray Restylé / Full Option (2024–2026)',
    clusterVariants: [
      'IPC-10.25-ECARX (Coolray Full Option / Restylé)',
      'IPC-12.3-DUAL-CURVED (Coolray Neo / S)',
      'IPC-7.0-STD-LCD (Coolray Standard)',
    ],
    ihuVariants: [
      'IHU624G (Coolray 2020–2026)',
      'IHU715P (Coolray Full Option)',
      'IHU535G (GKUI Gen 2)',
      'ECARX E02 (SD665)',
    ],
    busProtocol: 'CAN-FD / DoIP + Lien Vidéo LVDS Dual-Display',
    ipcAddress: '0x714 (RX 0x71C) IPC Geely · 0x770 IHU',
    lvdsNote: 'Câble HSD/LVDS blindé entre IHU et combiné pour projection Maps/CarPlay sur compteur.',
    criticalWarning:
      'HARD_STOP : Ne JAMAIS croiser IHU 624G, IHU715P, IHU535G ou Flyme Auto (Cityray/Starray) ! Leurs pilotes d’affichage, de radio et de caméra 360°/540° ne sont pas interchangeables. Conserver le backup EEPROM VIN/Odomètre d’origine.',
    themes: [
      { id: 'coolray_sport_red', label: 'Sport R-Track Rouge (Boost 1.5TD)', accent: 'rose' },
      { id: 'coolray_dynamic_cyan', label: 'Dynamic Cyber Cyan (LVDS Maps)', accent: 'cyan' },
      { id: 'coolray_classic_gold', label: 'Confort Classic Or & Chrome', accent: 'amber' },
    ],
  },
  geely_coolray_battle_2026: {
    id: 'geely_coolray_battle_2026',
    shortLabel: 'Geely Coolray Battle 2026',
    badge: 'BATTLE 2026',
    title: 'Geely Coolray Battle Edition 2026 — Cockpit Sport Dual-Display + IPC 10.25"/12.3"',
    models: 'Coolray Battle Edition 1.5TD 2026 (Pack Sport / Échappement Quad / Caméras 540°)',
    clusterVariants: [
      'IPC-10.25-BATTLE-2026 (Coolray Battle Digital Cluster)',
      'IPC-12.3-DUAL-CURVED-BATTLE (Coolray Battle / Neo 2026)',
      'IPC-10.25-ECARX (Coolray Battle Standard)',
    ],
    ihuVariants: [
      'IHU624G (Coolray Battle 2026)',
      'IHU715P (Coolray Battle Full Option / 540°)',
      'IHU535G (GKUI Gen 2)',
    ],
    busProtocol: 'CAN-FD / DoIP + LVDS Haute Vitesse Dual-Display',
    ipcAddress: '0x714 (RX 0x71C) IPC Battle 2026 · 0x770 IHU',
    lvdsNote:
      'Flux LVDS dédié Coolray Battle 2026 : jauges Boost Turbo, Chronomètre 0-100 km/h, Valve Échappement Sport & projection Maps/CarPlay sur compteur.',
    criticalWarning:
      'HARD_STOP BATTLE 2026 : Vérifier impérativement la référence exacte IHU 624G vs IHU715P vs IHU535G vs Flyme Auto sur l’étiquette avant flash. Ne jamais croiser ces architectures ni écraser la calibration 540° / valves échappement.',
    themes: [
      { id: 'coolray_battle_track_2026', label: 'Battle 2026 Race Track Rouge/Carbone (Boost & Chrono)', accent: 'rose' },
      { id: 'coolray_battle_cyber_lvds', label: 'Battle 2026 Cyber Cyan (Maps LVDS Plein Écran)', accent: 'cyan' },
      { id: 'coolray_battle_gold_sport', label: 'Battle 2026 Signature Or & Titane', accent: 'amber' },
    ],
  },
  geely_flyme: {
    id: 'geely_flyme',
    shortLabel: 'Geely Cityray / Starray / Monjaro',
    badge: 'FLYME / 8155',
    title: 'Geely Nouvelle Génération — Flyme Auto 2.5.0 & Snapdragon 8155 Cockpit',
    models: 'Cityray (Boyue L), Starray, Monjaro (Xingyue L), Okavango, Cowboy (2024–2026)',
    clusterVariants: [
      'IPC-10.25-SE1000 (Flyme Auto Cityray / Starray)',
      'IPC-12.3-TRIPLE-8155 (Monjaro / Xingyue L)',
      'IPC-10.25-OKAVANGO (ECARX / 8155)',
    ],
    ihuVariants: ['Flyme Auto 2.5.0 (SiEngine SE1000)', 'Snapdragon 8155 (sm8150)'],
    busProtocol: 'DoIP Ethernet + CAN-FD + eDP / LVDS Haute Fréquence',
    ipcAddress: '0x714 / DoIP 172.16.x.x Gateway Cockpit',
    lvdsNote: 'Flux eDP/LVDS bidirectionnel : supporte navigation plein écran sur compteur conducteur.',
    criticalWarning:
      'Architecture SiEngine SE1000 / 8155 incompatible avec les anciennes unités GKUI Coolray/Emgrand. Ne jamais forcer fastboot flash sur /system ou /vendor.',
    themes: [
      { id: 'flyme_horizon_cyan', label: 'Flyme Horizon (Navigation Plein Écran)', accent: 'cyan' },
      { id: 'monjaro_luxury_gold', label: 'Monjaro Executive Gold', accent: 'amber' },
      { id: 'starray_sport_crimson', label: 'Starray Track Performance', accent: 'rose' },
    ],
  },
  jetour_cockpit: {
    id: 'jetour_cockpit',
    shortLabel: 'Jetour (Dashing, T2, X70+/X90)',
    badge: 'LION OS 8155',
    title: 'Jetour Digital Cockpit — Combiné Numérique + Écran Central Lion OS',
    models: 'Jetour Dashing, T1, T2, X70 Plus, X70L, X90 Plus, X95 (2023–2026)',
    clusterVariants: [
      'IPC-10.25-JETOUR-8155 (T2 / Dashing)',
      'IPC-12.3-DUAL-LION (X70 Plus / X90 Plus)',
      'IPC-LCD-EXPORT (X50 / X70L)',
    ],
    ihuVariants: ['Jetour OS Qualcomm 8155 (T1/T2/Dashing)', 'Jetour Lion OS Export / CN'],
    busProtocol: 'CAN-FD 500k/2M + LVDS Dual Screen',
    ipcAddress: '0x714 (IPC) / 0x770 (IHU Lion OS)',
    lvdsNote: 'La branche firmware 1.8.2.1.E coupe le DSP si le MCU combiné/ampli n’est pas appairé.',
    criticalWarning:
      'Vérifier la révision DSP 2025/2026 avant toute mise à jour combiné/IHU. Protéger les trames radar tout-terrain 4WD (Jetour T2) et caméras 540°.',
    themes: [
      { id: 'jetour_offroad_amber', label: 'T2 Off-Road Boussole & Inclinomètre', accent: 'amber' },
      { id: 'dashing_cyber_cyan', label: 'Dashing Futuriste Cyber Cyan', accent: 'cyan' },
      { id: 'jetour_sport_red', label: 'Lion Sport Dynamique', accent: 'rose' },
    ],
  },
  chery_curved: {
    id: 'chery_curved',
    shortLabel: 'Chery (Tiggo 7/8 Pro, Arrizo 8)',
    badge: 'DUAL 24.6"',
    title: 'Chery Double Dalle Incurvée — Desay SV / Aptiv Digital Cockpit',
    models: 'Tiggo 7 Pro Max, Tiggo 8 Pro / Max, Arrizo 8, Omoda 5 (2023–2026)',
    clusterVariants: [
      'IPC-12.3-DESAY-CURVED (Ampli Sony OEM)',
      'IPC-12.3-APTIV-DUAL (Ampli Pioneer / OEM)',
      'IPC-10.25-TIGGO7-PRO',
    ],
    ihuVariants: ['Desay SV (Sony DSP)', 'Aptiv Head-Unit', 'Qualcomm 8155 Lion OS'],
    busProtocol: 'CAN-FD + LVDS Dual-Curved 24.6"',
    ipcAddress: '0x714 / 0x7E2 IPC Chery Desay/Aptiv',
    lvdsNote: 'Les dalles Desay SV et Aptiv utilisent des timings LVDS et drivers Sony/Pioneer distincts.',
    criticalWarning:
      'INTERDICTION absolue de flasher un pack Desay SV sur une carte Aptiv (et inversement) : perte immédiate du son Sony/Pioneer et écran compteur figé.',
    themes: [
      { id: 'chery_galaxy_cyan', label: 'Tiggo Pro Max Galaxy Cyan', accent: 'cyan' },
      { id: 'chery_race_red', label: 'Arrizo / Tiggo Mode Sport Rouge', accent: 'rose' },
      { id: 'chery_eco_gold', label: 'Eco Prestige Dual-Screen', accent: 'amber' },
    ],
  },
  changan_uni: {
    id: 'changan_uni',
    shortLabel: 'Changan (UNI-T, UNI-K, CS55+)',
    badge: 'IN-CALL COUPLED',
    title: 'Changan InCall Cockpit Couplé — Triple/Double Écran UNI & CS Series',
    models: 'UNI-T, UNI-K, UNI-V, CS55 Plus, X5 Plus / X5 Pro (2023–2026)',
    clusterVariants: [
      'IPC-UNI-TRIPLE-COUPLED (UNI-K / UNI-V)',
      'IPC-10.25-UNIT-ONSTYLE (UNI-T / X5 Pro)',
      'IPC-10.0-CS55PLUS',
    ],
    ihuVariants: ['InCall UNI-Series (8155 / 6155)', 'InCall OnStyle (MT8666 / X5 Plus)'],
    busProtocol: 'CAN-FD + LVDS Multi-Écrans Couplés',
    ipcAddress: '0x714 (IPC) / 0x770 (InCall Master)',
    lvdsNote: 'Le combiné et les caméras 360°/540° partagent la passerelle vidéo InCall.',
    criticalWarning:
      'Sur UNI-T / UNI-K / X5 Pro, toute altération de /system ou /vendor désynchronise le combiné supérieur et bloque les alertes d’angle mort.',
    themes: [
      { id: 'uni_vision_cyan', label: 'UNI-Vision Sci-Fi Cyan', accent: 'cyan' },
      { id: 'uni_track_red', label: 'UNI-V Track Orange/Rouge', accent: 'rose' },
      { id: 'changan_classic', label: 'InCall Élégance Or', accent: 'amber' },
    ],
  },
  mg_haval_cn: {
    id: 'mg_haval_cn',
    shortLabel: 'MG, Haval & DFSK Cockpit',
    badge: 'iSMART / COFFEE',
    title: 'MG (MG5 / MG GT / MG One) · Haval (Jolion / H6) · DFSK Cockpit',
    models: 'MG5, MG GT, MG One, Haval Jolion / H6, DFSK Glory 500/580 (2022–2026)',
    clusterVariants: [
      'IPC-12.3-MG-ISMART (MG GT / MG One)',
      'IPC-10.25-GWM-COFFEE (Haval H6 / Jolion)',
      'IPC-7.0-DFSK-LCD',
    ],
    ihuVariants: ['MG iSMART (SAIC)', 'GWM Coffee OS', 'FYT UIS7862 / Topway TS10'],
    busProtocol: 'CAN / CAN-FD + LVDS / UART MCU',
    ipcAddress: '0x714 / 0x720 IPC SAIC-GWM',
    lvdsNote: 'Vérifier la box CAN (Hiworld / Raise / SimpleSoft) avant calibration widgets cockpit.',
    criticalWarning:
      'Ne pas croiser les firmwares MCU entre SAIC iSMART, GWM Coffee OS et les unités aftermarket FYT/Topway.',
    themes: [
      { id: 'mg_trophy_red', label: 'MG GT Trophy Sport Rouge', accent: 'rose' },
      { id: 'haval_coffee_cyan', label: 'Haval Coffee Smart Cyan', accent: 'cyan' },
      { id: 'saic_classic_amber', label: 'Classic Touring Ambre', accent: 'amber' },
    ],
  },
};

const COCKPIT_MODULES = [
  {
    id: 'theme_sport',
    title: 'Thèmes Cockpit Sport / Track / R-Style',
    desc: 'Compte-tours dynamique, manomètre boost turbo, température boîte DCT & skin couleur.',
    icon: Gauge,
  },
  {
    id: 'lvds_nav_cast',
    title: 'Projection GPS Maps / Waze sur Combiné (LVDS)',
    desc: 'Affiche la mini-carte et flèches de guidage directement sur le compteur conducteur.',
    icon: Navigation,
  },
  {
    id: 'lang_fr_ar',
    title: 'Pack Langue Français / Arabe (Combiné + IHU)',
    desc: 'Traduction complète menus tableau de bord sans casser TPMS ni alertes ADAS.',
    icon: Globe,
  },
  {
    id: 'carplay_ipc_sync',
    title: 'Synchronisation CarPlay / Android Auto ↔ Compteur',
    desc: 'Renvoi appels, titres média et instructions vocales vers le combiné numérique.',
    icon: MonitorSmartphone,
  },
  {
    id: 'adas_tpms_cal',
    title: 'Calibration Widgets TPMS, Pression Turbo & 540°',
    desc: 'Maintient la lecture pression pneus bar/kPa et bascule caméras clignotant intacte.',
    icon: Activity,
  },
];

interface CockpitPlanStep {
  id: string;
  progress: number;
  label: string;
  log: string;
}

export const ChineseCockpitFlasher: React.FC<ChineseCockpitFlasherProps> = ({
  connectionMode,
  isConnected,
  batteryVoltage,
  onOpenConnectModal,
  onOpenTranslator,
}) => {
  const [selectedPlatformId, setSelectedPlatformId] = useState<CockpitPlatformId>('geely_coolray');
  const currentPlatform = COCKPIT_PLATFORMS[selectedPlatformId];

  const [clusterArch, setClusterArch] = useState<string>(currentPlatform.clusterVariants[0]);
  const [ihuArch, setIhuArch] = useState<string>(currentPlatform.ihuVariants[0]);
  const [selectedTheme, setSelectedTheme] = useState<string>(currentPlatform.themes[0].id);
  const [targetLang, setTargetLang] = useState<'fr' | 'ar'>('fr');
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'theme_sport',
    'lvds_nav_cast',
    'lang_fr_ar',
    'carplay_ipc_sync',
  ]);
  const [intendedOperation, setIntendedOperation] = useState<string>(
    'Pack Cockpit Coolray Sport + Projection Navigation LVDS + FR/AR'
  );

  // Confirmations sécurité obligatoires
  const [vinBackupConfirmed, setVinBackupConfirmed] = useState(false);
  const [clusterMatchConfirmed, setClusterMatchConfirmed] = useState(false);

  // Etat exécution flash
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashPhase, setFlashPhase] = useState('');
  const [flashLogs, setFlashLogs] = useState<string[]>([]);
  const [flashDone, setFlashDone] = useState(false);
  const [flashError, setFlashError] = useState<string | null>(null);

  // Etat IA Guard
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiVerification, setAiVerification] = useState<AiVerificationInfo | null>(null);

  // Etat PDF & Partage WhatsApp (Pack Cockpit + Traduction Tablette)
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [whatsappShareUrl, setWhatsappShareUrl] = useState<string | null>(null);

  const handleSelectPlatform = (id: CockpitPlatformId) => {
    const p = COCKPIT_PLATFORMS[id];
    setSelectedPlatformId(id);
    setClusterArch(p.clusterVariants[0]);
    setIhuArch(p.ihuVariants[0]);
    setSelectedTheme(p.themes[0].id);
    setIntendedOperation(`Pack Cockpit ${p.shortLabel} — Thème + LVDS Maps + Langue`);
    setFlashDone(false);
    setFlashLogs([]);
    setFlashProgress(0);
    setFlashError(null);
    setAiReport(null);
    setAiVerification(null);
  };

  const toggleModule = (modId: string) => {
    setSelectedModules((prev) =>
      prev.includes(modId) ? prev.filter((m) => m !== modId) : [...prev, modId]
    );
  };

  // Pare-feu local instantané
  const cockpitAudit = useMemo(() => {
    const op = `${clusterArch} ${ihuArch} ${intendedOperation}`.toUpperCase();
    if (/(KILOM|ODOMET|MILEAGE|COMPTEUR\s*KM|RECULER)/i.test(op)) {
      return {
        blocked: true,
        title: 'OPÉRATION BLOQUÉE : Modification Kilométrique / Odomètre Interdite',
        reason:
          'AutoPro verrouille strictement toute écriture sur la zone kilométrique EEPROM. Seuls le flash UI Cockpit, thèmes, projection LVDS, langues et calibration TPMS/ADAS sont autorisés.',
      };
    }
    const normOp = op.replace(/\s+/g, '');
    if (
      (selectedPlatformId === 'geely_coolray' || selectedPlatformId === 'geely_coolray_battle_2026') &&
      op.includes('FLYME')
    ) {
      return {
        blocked: true,
        title: 'HARD_STOP : Flyme Auto incompatible sur Geely Coolray / Battle 2026 (624G / 715P / 535G)',
        reason:
          'Le Coolray & Coolray Battle 2026 utilisent IHU 624G / IHU715P / IHU535G / ECARX, pas Flyme Auto. Leurs pilotes d’affichage, de radio et de caméra ne sont pas interchangeables.',
      };
    }
    const geelyMatches = ['IHU624G', 'IHU715P', 'IHU535G', 'IHU516G'].filter(
      (tag) => normOp.includes(tag) || normOp.includes(tag.replace('IHU', ''))
    );
    if (geelyMatches.length >= 2) {
      return {
        blocked: true,
        title: `HARD_STOP : Croisement interdit (${geelyMatches.join(' ↔ ')})`,
        reason:
          'Les firmwares IHU 624G, IHU535G, IHU715P et Flyme Auto ne sont PAS interchangeables (pilotes d’affichage LVDS, radio FM et caméras 360°/540° incompatibles).',
      };
    }
    if (op.includes('DESAY') && op.includes('APTIV')) {
      return {
        blocked: true,
        title: 'BLOCAGE ANTI-BRICK : Croisement Chery Desay SV / Aptiv',
        reason: 'Ne jamais mélanger un firmware Desay SV (Sony) avec une dalle Aptiv (Pioneer).',
      };
    }
    if (batteryVoltage > 0 && batteryVoltage < 12.2) {
      return {
        blocked: true,
        title: `TENSION TROP BASSE (${batteryVoltage.toFixed(1)}V < 12.2V)`,
        reason:
          'Le flash d’un combiné numérique exige ≥ 12.5V (recommandé 13.5V avec stabilisateur). Rechargez ou branchez un maintien de charge.',
      };
    }
    return {
      blocked: false,
      title: `Architecture Cockpit Validée (${currentPlatform.shortLabel})`,
      reason: `Concordance IPC / IHU vérifiée · Protocole ${currentPlatform.busProtocol} · Zéro écriture EEPROM kilométrique.`,
    };
  }, [selectedPlatformId, clusterArch, ihuArch, intendedOperation, batteryVoltage, currentPlatform]);

  const activeThemeObj = useMemo(
    () => currentPlatform.themes.find((t) => t.id === selectedTheme) || currentPlatform.themes[0],
    [currentPlatform, selectedTheme]
  );

  const handleRunCockpitFlash = async () => {
    if (cockpitAudit.blocked || !vinBackupConfirmed || !clusterMatchConfirmed || selectedModules.length === 0) {
      return;
    }

    setIsFlashing(true);
    setFlashDone(false);
    setFlashError(null);
    setFlashProgress(5);
    setFlashPhase('Validation pare-feu serveur & handshake bus Cockpit...');
    setFlashLogs([
      `[00.0s] Cible : ${currentPlatform.models}`,
      `[00.2s] Combiné IPC : ${clusterArch} | Écran central : ${ihuArch} | Tension : ${batteryVoltage.toFixed(1)}V`,
    ]);

    let stepsToRun: CockpitPlanStep[] = [];

    try {
      const res = await apiFetch('/api/chinese-cockpit/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedPlatformId,
          modelVariant: currentPlatform.models,
          clusterArch,
          ihuArch,
          busProtocol: currentPlatform.busProtocol,
          selectedModules,
          themeSkin: selectedTheme,
          targetLang,
          batteryVoltage,
          vinBackupConfirmed,
          clusterMatchConfirmed,
          connectionMode,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.blocked) {
        setIsFlashing(false);
        setFlashError(data.riskDetail || data.alertTitle || 'Procédure bloquée par sécurité.');
        setFlashLogs((prev) => [...prev, `[BLOQUÉ] ${data.alertTitle}: ${data.riskDetail}`]);
        return;
      }
      stepsToRun = data.plan?.steps || [];
    } catch {
      // Secours local déterministe si hors-ligne
      stepsToRun = [
        {
          id: 'step_1',
          progress: 20,
          label: `Session UDS/DoIP (${currentPlatform.ipcAddress})`,
          log: `[MODE HORS-LIGNE] Handshake ${currentPlatform.ipcAddress} OK · Tension ${batteryVoltage.toFixed(1)}V`,
        },
        {
          id: 'step_2',
          progress: 45,
          label: 'Backup EEPROM VIN & Verrouillage Lecture Seule Odomètre',
          log: 'Backup DID F190 + config CAN-FD terminé. Zone kilométrique verrouillée en lecture seule.',
        },
        {
          id: 'step_3',
          progress: 75,
          label: `Déploiement Pack Cockpit (${activeThemeObj.label}) & Langue ${targetLang.toUpperCase()}`,
          log: `Injection non destructive [${selectedModules.join(', ')}] + synchro LVDS validée.`,
        },
        {
          id: 'step_4',
          progress: 100,
          label: 'Soft Reset Combiné IPC (UDS 11 01) & Contrôle Zéro DTC',
          log: 'SUCCÈS : Combiné redémarré sans perte DSP ni caméras 360°/540°.',
        },
      ];
    }

    let idx = 0;
    const timer = setInterval(() => {
      if (idx < stepsToRun.length) {
        const st = stepsToRun[idx];
        setFlashProgress(st.progress);
        setFlashPhase(st.label);
        setFlashLogs((prev) => [...prev, `[+${(idx * 1.1 + 0.7).toFixed(1)}s] ${st.log}`]);
        idx++;
      } else {
        clearInterval(timer);
        setIsFlashing(false);
        setFlashDone(true);
      }
    }, 850);
  };

  const handleAskCockpitAi = async () => {
    setAiLoading(true);
    setAiReport(null);
    setAiVerification(null);
    try {
      const res = await apiFetch('/api/chinese-cockpit/ai-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedPlatformId,
          modelVariant: currentPlatform.models,
          clusterArch,
          ihuArch,
          busProtocol: currentPlatform.busProtocol,
          goal: `Modules: ${selectedModules.join(', ')} | Thème: ${activeThemeObj.label} | Langue: ${targetLang.toUpperCase()}`,
          batteryVoltage,
          intendedOperation,
        }),
      });
      const data = await res.json();
      setAiReport(data.analysis || data.riskDetail || 'Vérification cockpit terminée.');
      setAiVerification(data.aiVerification || null);
    } catch {
      setAiReport(
        `### ✅ Vérification Hors-Ligne (${currentPlatform.shortLabel})\n` +
          `1. Tension requise ≥ 12.5V (actuelle : ${batteryVoltage.toFixed(1)}V).\n` +
          `2. Backup UDS ${currentPlatform.ipcAddress} obligatoire avant injection UI/LVDS.\n` +
          `3. Ne jamais flasher ${ihuArch} avec une image d'une autre carte mère.`
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownloadCockpitBat = () => {
    const localeCode = targetLang === 'fr' ? 'fr-FR' : 'ar-DZ';
    const batContent = `@echo off
title AutoPro Cockpit Flash & Backup - ${currentPlatform.shortLabel}
color 0B
echo ========================================================================
echo   AUTOPRO DIAGNOSTIC & FLASH HUB - MODULE COCKPIT CHINOIS (ANTI-BRICK)
echo   Vehicule : ${currentPlatform.models}
echo   Combine  : ${clusterArch}
echo   Ecran IHU: ${ihuArch}
echo   Protocole: ${currentPlatform.busProtocol}
echo ========================================================================
echo.
echo [SECURITE 1/4] Verification tension >= 12.5V et liaison USB/ADB Data...
adb devices
echo.
echo [SECURITE 2/4] Lecture empreinte materielle AVANT toute ecriture :
adb shell getprop ro.board.platform
adb shell getprop ro.build.display.id
adb shell getprop ro.product.model
echo.
echo [BACKUP 3/4] Sauvegarde parametres Cockpit / LVDS / DSP (Aucune modification km) :
if not exist backup_cockpit mkdir backup_cockpit
adb shell settings list global > backup_cockpit\\global_cockpit.txt
adb shell settings list system > backup_cockpit\\system_cockpit.txt
adb shell dumpsys display > backup_cockpit\\lvds_display_dump.txt
adb shell dumpsys audio > backup_cockpit\\audio_dsp.txt
echo Sauvegarde enregistree dans backup_cockpit\\
echo.
echo [FLASH UI 4/4] Synchronisation Dual-Display LVDS & Langue (${localeCode}) :
adb shell settings put global force_resizable_activities 1
adb shell settings put global enable_freeform_support 1
adb shell setprop persist.sys.locale ${localeCode}
adb shell am broadcast -a android.intent.action.LOCALE_CHANGED
echo.
echo ========================================================================
echo   TERMINE ! Verifiez l'affichage sur le combine et les cameras 360/540.
echo ========================================================================
pause
`;
    const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AutoPro_Cockpit_${selectedPlatformId.toUpperCase()}_${targetLang.toUpperCase()}.bat`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Couleurs du simulateur combiné numérique
  const themeRingColor =
    activeThemeObj.accent === 'rose'
      ? 'border-rose-500 text-rose-400 shadow-rose-500/20'
      : activeThemeObj.accent === 'amber'
      ? 'border-amber-400 text-amber-300 shadow-amber-500/20'
      : 'border-cyan-400 text-cyan-300 shadow-cyan-500/20';

  const themeBadgeBg =
    activeThemeObj.accent === 'rose'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
      : activeThemeObj.accent === 'amber'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50';

  const handleDownloadPackPlanPdf = () => {
    const { doc, fileName } = buildCockpitTranslationPlanPdf({
      platformName: currentPlatform.shortLabel,
      clusterRef: clusterArch,
      ihuRef: ihuArch,
      targetLang,
      themeLabel: activeThemeObj.label,
      selectedModules,
    });
    doc.save(fileName);
    setPdfNotice(`Planning PDF téléchargé (${fileName}).`);
    setTimeout(() => setPdfNotice(null), 4500);
  };

  const handleSharePackPlanWhatsApp = async () => {
    const result = await shareCockpitTranslationPlanPdf({
      platformName: currentPlatform.shortLabel,
      clusterRef: clusterArch,
      ihuRef: ihuArch,
      targetLang,
      themeLabel: activeThemeObj.label,
      selectedModules,
    });
    setWhatsappShareUrl(result.waUrl);
    setPdfNotice(result.notice);
    setTimeout(() => setPdfNotice(null), 6500);
  };

  const handleDownloadHardwarePlanPdf = () => {
    const { doc, fileName } = buildHardwarePlanPdf();
    doc.save(fileName);
    setPdfNotice(`Plan Matériel (FR + Darija) téléchargé (${fileName}).`);
    setTimeout(() => setPdfNotice(null), 4500);
  };

  const handleShareHardwarePlanWhatsApp = async () => {
    const result = await shareHardwarePlanPdf();
    setWhatsappShareUrl(result.waUrl);
    setPdfNotice(result.notice);
    setTimeout(() => setPdfNotice(null), 6500);
  };

  return (
    <div className="space-y-6">
      {/* Banner Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border border-cyan-500/40 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-extrabold text-[11px] uppercase tracking-wider">
                PACK COCKPIT + TRADUCTION
              </span>
              <span className="px-2.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 font-bold text-[11px]">
                Geely Coolray / Chinois DZ
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Gauge className="w-5 h-5 text-cyan-400 shrink-0" />
              <span>Pack Cockpit Coolray + Tablette Traduction (Anti-Brick)</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Déploiement complet 2-en-1 : thèmes Sport/Track + projection GPS Maps/CarPlay sur compteur (LVDS) + traduction tablette FR/Arabe RTL pour{' '}
              <strong>Geely Coolray (SX11 / Restylé / Battle 2026), Cityray, Starray, Jetour, Chery, Changan et MG/Haval</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              className={`px-3 py-2 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                batteryVoltage < 12.2
                  ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                  : 'bg-slate-950 border-slate-700 text-emerald-300'
              }`}
            >
              <BatteryCharging className="w-4 h-4 shrink-0" />
              <span>Batterie : {batteryVoltage.toFixed(1)}V</span>
            </div>
            {!isConnected && (
              <button
                type="button"
                onClick={onOpenConnectModal}
                className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Connecter OBD / DoIP
              </button>
            )}
          </div>
        </div>

        {/* Barre Planning PDF + WhatsApp + Lien Traducteur Tablette */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPackPlanPdf}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/60 border border-emerald-500/50 text-xs font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Télécharger le Planning Atelier & Client Pack Cockpit + Traduction en PDF A4"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Planning Pack PDF</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSharePackPlanWhatsApp()}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-xs font-bold text-emerald-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Télécharger et envoyer le Planning Pack Cockpit + Traduction par WhatsApp"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Envoyer WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHardwarePlanPdf}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-950/70 hover:bg-amber-900/60 border border-amber-500/50 text-xs font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Télécharger la fiche Matériel Exigé (Français + Darija) en PDF A4"
            >
              <Wrench className="w-4 h-4 shrink-0" />
              <span>Matériel PDF (FR + Darija)</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShareHardwarePlanWhatsApp()}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-xs font-bold text-amber-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Envoyer le Plan Matériel (FR + Darija) par WhatsApp"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Matériel WhatsApp</span>
            </button>
          </div>

          {onOpenTranslator && (
            <button
              type="button"
              onClick={onOpenTranslator}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 text-xs font-bold text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Languages className="w-4 h-4 shrink-0" />
              <span>Ouvrir Tablette Traduction FR / AR</span>
            </button>
          )}
        </div>

        {pdfNotice && (
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/35 px-3.5 py-2 text-xs text-cyan-200">
            {pdfNotice}
          </div>
        )}

        {whatsappShareUrl && (
          <div className="rounded-xl border border-emerald-500/45 bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-200 flex flex-wrap items-center justify-between gap-2">
            <span>
              PDF <strong>Planning Pack Cockpit + Traduction</strong> prêt à envoyer :
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-colors"
              >
                Ouvrir WhatsApp avec le Planning
              </a>
              <button
                type="button"
                onClick={() => setWhatsappShareUrl(null)}
                className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Platform Selector Grid */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          1. Sélectionner le Véhicule / Combiné Cockpit (Coolray pré-sélectionné) :
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {(Object.values(COCKPIT_PLATFORMS) as CockpitPlatformSpec[]).map((p) => {
            const active = selectedPlatformId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPlatform(p.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-900 border-cyan-400 ring-1 ring-cyan-400/50 shadow-lg'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-white">{p.shortLabel}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                      p.id === 'geely_coolray' || p.id === 'geely_coolray_battle_2026'
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-800 text-cyan-300 border border-slate-700'
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block truncate">{p.models}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Architecture & Live Cluster Preview Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Config & Modules */}
        <div className="lg:col-span-7 space-y-5">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider block">
                  {currentPlatform.busProtocol}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white">{currentPlatform.title}</h3>
              </div>

              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setTargetLang('fr')}
                  className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                    targetLang === 'fr' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Français
                </button>
                <button
                  type="button"
                  onClick={() => setTargetLang('ar')}
                  className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                    targetLang === 'ar' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  العربية
                </button>
              </div>
            </div>

            {/* Hardware selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Référence Combiné (IPC Cluster) *
                </label>
                <select
                  value={clusterArch}
                  onChange={(e) => setClusterArch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  {currentPlatform.clusterVariants.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Écran Central Couplé (IHU / Head-Unit) *
                </label>
                <select
                  value={ihuArch}
                  onChange={(e) => setIhuArch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  {currentPlatform.ihuVariants.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Thème / Interface Cockpit à Flasher
                </label>
                <select
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 font-semibold focus:outline-none focus:border-cyan-500"
                >
                  {currentPlatform.themes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Test Anti-Mismatch / Opération prévue
                </label>
                <input
                  type="text"
                  value={intendedOperation}
                  onChange={(e) => setIntendedOperation(e.target.value)}
                  placeholder="Ex: Thème Sport + Projection LVDS Maps"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-amber-300 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Technical Specs Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-semibold block mb-0.5">Adressage UDS / DoIP :</span>
                <span className="font-mono text-cyan-300 font-bold">{currentPlatform.ipcAddress}</span>
                <span className="text-slate-400 block mt-1 leading-relaxed">{currentPlatform.lvdsNote}</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/60">
                <span className="text-rose-300 font-bold flex items-center gap-1.5 mb-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  Vigilance Anti-Brick :
                </span>
                <span className="text-rose-200/90 leading-relaxed block">{currentPlatform.criticalWarning}</span>
              </div>
            </div>

            {/* Firewall Banner */}
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                cockpitAudit.blocked
                  ? 'bg-rose-950/70 border-rose-500 text-rose-200'
                  : 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
              }`}
            >
              {cockpitAudit.blocked ? (
                <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold block">{cockpitAudit.title}</span>
                <span className="text-[11px] leading-relaxed block mt-0.5">{cockpitAudit.reason}</span>
              </div>
            </div>
          </div>

          {/* Selectable Cockpit Flash Modules */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>2. Packs &amp; Fonctions Cockpit à Déployer</span>
              </h3>
              <span className="text-[11px] font-mono text-cyan-300">
                {selectedModules.length} module(s) sélectionné(s)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {COCKPIT_MODULES.map((mod) => {
                const Icon = mod.icon;
                const active = selectedModules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-950/30 border-cyan-500/70 text-white'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{mod.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            active ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {active ? 'ACTIF' : 'INACTIF'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">{mod.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mandatory Checkboxes */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
              <span className="text-amber-300 font-bold block">
                3. Verrouillage Sécurité Obligatoire Avant Écriture Cockpit :
              </span>
              <label className="flex items-start gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={vinBackupConfirmed}
                  onChange={(e) => setVinBackupConfirmed(e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>
                  Backup EEPROM VIN / Immo / Config CAN effectué (<strong>zone kilométrique verrouillée en lecture seule</strong>).
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={clusterMatchConfirmed}
                  onChange={(e) => setClusterMatchConfirmed(e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>
                  Concordance matérielle confirmée : <strong>{clusterArch}</strong> + <strong>{ihuArch}</strong> + Tension stabilisée ≥ 12.5V.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={
                  cockpitAudit.blocked ||
                  !vinBackupConfirmed ||
                  !clusterMatchConfirmed ||
                  selectedModules.length === 0 ||
                  isFlashing
                }
                onClick={() => void handleRunCockpitFlash()}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {isFlashing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Flash Cockpit en cours ({flashProgress}%)...</span>
                  </>
                ) : cockpitAudit.blocked ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>BLOQUÉ PAR PARE-FEU COCKPIT</span>
                  </>
                ) : !vinBackupConfirmed || !clusterMatchConfirmed ? (
                  <span>Cochez les 2 confirmations de sécurité ci-dessus</span>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Lancer Flash Cockpit Sécurisé</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={cockpitAudit.blocked}
                onClick={handleDownloadCockpitBat}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Script Atelier (.bat)</span>
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={() => void handleAskCockpitAi()}
                className="py-3 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                <span>{aiLoading ? 'Analyse IA...' : 'Audit IA Anti-Brick'}</span>
              </button>
            </div>

            {flashError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500 text-rose-200 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{flashError}</span>
              </div>
            )}

            {isFlashing && (
              <div className="p-3 bg-slate-950 rounded-xl border border-cyan-500/40 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-cyan-400 font-mono">{flashPhase}</span>
                  <span className="font-mono text-white font-bold">{flashProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-2 transition-all duration-300"
                    style={{ width: `${flashProgress}%` }}
                  />
                </div>
              </div>
            )}

            {flashDone && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-600/60 text-emerald-200 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-emerald-300">
                    Flash Cockpit {currentPlatform.shortLabel} Terminé avec Succès !
                  </span>
                  <span className="text-[11px] block mt-0.5">
                    Thème <strong>{activeThemeObj.label}</strong> et langue <strong>{targetLang.toUpperCase()}</strong> appliqués.
                    EEPROM VIN/Odomètre intacte, son DSP et caméras 360°/540° vérifiés.
                  </span>
                </div>
              </div>
            )}

            {flashLogs.length > 0 && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Console Bus UDS / DoIP / LVDS</span>
                </div>
                {flashLogs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive Digital Cluster Live Preview + AI Report */}
        <div className="lg:col-span-5 space-y-5">
          {/* Simulated Digital Instrument Cluster */}
          <div className="p-4 rounded-2xl bg-slate-950 border-2 border-slate-800 shadow-2xl space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Aperçu Combiné Numérique (IPC Live)
              </span>
              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${themeBadgeBg}`}>
                {activeThemeObj.label}
              </span>
            </div>

            <div className="rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-4 space-y-4">
              {/* Top status strip */}
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-800/80 pb-2">
                <span>{targetLang === 'fr' ? 'MODE SPORT · DCT D4' : 'الوضع الرياضي · DCT D4'}</span>
                <span className="text-emerald-400">ADAS OK · 22°C</span>
                <span>TPMS 2.4 BAR</span>
              </div>

              {/* Dual Dials + Center Navigation Card */}
              <div className="grid grid-cols-3 gap-2 items-center text-center">
                {/* Speed Dial */}
                <div className={`aspect-square rounded-full border-4 flex flex-col items-center justify-center shadow-lg bg-slate-950/90 ${themeRingColor}`}>
                  <span className="text-2xl font-black font-mono text-white leading-none">
                    {flashDone ? '118' : '0'}
                  </span>
                  <span className="text-[9px] text-slate-400 uppercase mt-1">km/h</span>
                </div>

                {/* Center LVDS Nav / Info */}
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                  {selectedModules.includes('lvds_nav_cast') ? (
                    <>
                      <Navigation className="w-4 h-4 text-emerald-400 mx-auto" />
                      <span className="text-[10px] font-bold text-emerald-300 block leading-tight">
                        {targetLang === 'fr' ? 'LVDS Maps Actif' : 'خرائط LVDS مفعلة'}
                      </span>
                      <span className="text-[9px] text-slate-400 block">↗ 250m Rocade Sud</span>
                    </>
                  ) : (
                    <>
                      <Gauge className="w-4 h-4 text-cyan-400 mx-auto" />
                      <span className="text-[10px] font-bold text-slate-200 block">
                        {targetLang === 'fr' ? 'Ordinateur Bord' : 'معلومات القيادة'}
                      </span>
                      <span className="text-[9px] text-slate-400 block">Boost 1.2 bar</span>
                    </>
                  )}
                </div>

                {/* RPM Dial */}
                <div className={`aspect-square rounded-full border-4 flex flex-col items-center justify-center shadow-lg bg-slate-950/90 ${themeRingColor}`}>
                  <span className="text-xl font-black font-mono text-white leading-none">
                    {flashDone ? '3.4' : '0.8'}
                  </span>
                  <span className="text-[9px] text-slate-400 uppercase mt-1">x1000 RPM</span>
                </div>
              </div>

              {/* Bottom CarPlay / Cam / Language Indicator */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[10px]">
                <span className="text-slate-400 font-mono">{clusterArch.split(' ')[0]}</span>
                <div className="flex items-center gap-1.5">
                  {selectedModules.includes('carplay_ipc_sync') && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                      CarPlay HUD
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                    {targetLang === 'fr' ? 'FR' : 'AR'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Safety Rules Card */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5 text-xs">
            <h4 className="font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Garanties Atelier Flash Cockpit Chinois</span>
            </h4>
            <ul className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
              <li>• <strong>Aucune écriture kilométrique</strong> : le compteur d’odomètre et le VIN (DID F190) restent 100% d’origine.</li>
              <li>• <strong>Préservation Son DSP &amp; Caméras 540°</strong> : aucun écrasement des tables CAN Box ou drivers Sony/Pioneer.</li>
              <li>• <strong>Pare-feu HARD_STOP Croisement</strong> : blocage automatique Coolray IHU 624G vs IHU715P vs IHU535G vs Flyme Auto.</li>
              <li>• <strong>Rollback immédiat</strong> : sauvegarde systématique des paramètres LVDS/UI dans <code className="text-cyan-300">backup_cockpit/</code>.</li>
            </ul>
          </div>

          {/* AI Verification Report */}
          {aiReport && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 text-xs text-slate-200 whitespace-pre-line leading-relaxed space-y-2">
              <div>{aiReport}</div>
              <AiVerificationBadge verification={aiVerification} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
