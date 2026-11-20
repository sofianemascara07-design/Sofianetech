import {
  CoolrayAlgeriaIssueEntry,
  CoolrayCalibrationOption,
  CoolrayCentralUnitModelId,
  CoolrayCentralUnitOption,
  CoolrayEngineProfile,
  CoolrayObdPidSnapshot,
  CoolrayOemModuleCompat,
  CoolrayOilSpecId,
  CoolraySafetyChecklist,
  CoolrayVariantId,
  CoolrayVehicleFollowUpRecord,
  LspiRiskSeverity,
} from '../types/automotive';

export const COOLRAY_ENGINE_PROFILES: CoolrayEngineProfile[] = [
  {
    id: 'coolray_phase1_3cyl',
    label: 'Coolray Phase 1 (2020–2023)',
    yearRange: '2020–2023',
    engineCode: '1.5T 3 Cylindres (G-Power / JLH-3G15TD)',
    cylinders: '3 cylindres Turbo Injection Directe',
    powerHp: '177 ch',
    torqueNm: '255 Nm',
    transmission: 'Boîte 7DCT (Double Embrayage Humide)',
    ecuModel: 'Bosch MG1CS080',
    ecuHardwareFamily: 'MG1CS080',
    compatibleHardwareFamilies: ['MG1CS080'],
    isTurboDirectInjection: true,
    lspiPriorityLevel: 'ELEVE_TURBO_GDI',
    calibrationNote:
      'Architecture 3 cylindres Bosch MG1CS080 incompatible bit-à-bit avec les fichiers 4 cylindres MG1US008. Surveillance stricte bougies Iridium + huile API SP 0W-20.',
    supportedCalibrations: ['custom_anti_lspi_patch', 'tcu_7dct_anti_lug'],
  },
  {
    id: 'coolray_dz_export_4cyl',
    label: 'Coolray Restylé Officiel Export / DZ (2024–2026)',
    yearRange: '2024–2026',
    engineCode: '1.5T 4 Cylindres (NordThor BHE15-EFZ)',
    cylinders: '4 cylindres Turbo Injection Directe 350 bar',
    powerHp: '172–174 ch',
    torqueNm: '290 Nm',
    transmission: 'Boîte 7DCT (Double Embrayage)',
    ecuModel: 'Bosch MG1US008 / MG1UA008',
    ecuHardwareFamily: 'MG1US008',
    compatibleHardwareFamilies: ['MG1US008', 'MG1UA008'],
    isTurboDirectInjection: true,
    lspiPriorityLevel: 'ELEVE_TURBO_GDI',
    calibrationNote:
      'Cartographie Export / Algérie (172–174 ch) déjà calibrée pour indice d’octane standard, mais vulnérable au LSPI si vidanges espacées (> 7 500 km) ou huile 5W-40 / API SN.',
    supportedCalibrations: ['custom_anti_lspi_patch', 'tcu_7dct_anti_lug'],
  },
  {
    id: 'coolray_cn_battle_181',
    label: 'Coolray Import Chine / Battle / Binyue L (2025–2026)',
    yearRange: '2025–2026',
    engineCode: '1.5T 4 Cylindres (BHE15-EFZ Chine VI)',
    cylinders: '4 cylindres Turbo Haute Compression GDI',
    powerHp: '181 ch',
    torqueNm: '290 Nm',
    transmission: 'Boîte 7DCT (Double Embrayage)',
    ecuModel: 'Bosch MG1US008',
    ecuHardwareFamily: 'MG1US008',
    compatibleHardwareFamilies: ['MG1US008'],
    isTurboDirectInjection: true,
    lspiPriorityLevel: 'PRIORITAIRE_CHINE_VI',
    calibrationNote:
      'PRIORITÉ ANTI-LSPI : Calibration Chine VI 181 ch prévue pour carburant à haut indice d’octane (RON 95/98 pur) avec avance allumage agressive à bas régime. Fort risque de cliquetis / casse piston (Cyl. 2 & 3) sur carburant local sans downgrade ou patch Anti-LSPI.',
    supportedCalibrations: ['downgrade_cn_to_dz', 'custom_anti_lspi_patch', 'tcu_7dct_anti_lug'],
  },
  {
    id: 'coolray_lite_dvvt_atmo',
    label: 'Coolray Lite / Super Atmosphérique (2025–2026)',
    yearRange: '2025–2026',
    engineCode: '1.5L DVVT Atmosphérique (Sans Turbo)',
    cylinders: '4 cylindres Atmosphérique Injection Multipoint/DVVT',
    powerHp: '126–127 ch',
    torqueNm: '152 Nm',
    transmission: 'Boîte CVT',
    ecuModel: 'Bosch ME17 / Atmo Standard',
    ecuHardwareFamily: 'BOSCH_ATMO_ME17',
    compatibleHardwareFamilies: ['BOSCH_ATMO_ME17'],
    isTurboDirectInjection: false,
    lspiPriorityLevel: 'EXCLU_ATMO_STANDARD',
    calibrationNote:
      'Moteur atmosphérique sans suralimentation turbo : EXCLU des alertes critiques LSPI Turbo GDI. Conserver un entretien standard (vidange 7 500–10 000 km, bougies et filtre à air propres).',
    supportedCalibrations: [],
  },
];

export const COOLRAY_CALIBRATION_OPTIONS: CoolrayCalibrationOption[] = [
  {
    id: 'downgrade_cn_to_dz',
    title: '1. Downgrade Sécurisé Chine (181 ch) → Export DZ (174 ch)',
    targetController: 'ECU Moteur (0x7E0 -> 0x7E8)',
    badge: 'RECOMMANDÉ IMPORT CHINE / BATTLE',
    summary:
      'Remplace la cartographie Chine VI 181 ch (haut octane) par la calibration internationale Export/Algérie 174 ch adaptée aux carburants locaux, tout en conservant 290 Nm disponibles en montée en régime.',
    technicalAdjustments: [
      'Adoption des tables d’avance à l’allumage Export DZ (marge anti-cliquetis +3.2° sur SP91/95 variable).',
      'Conservation de la signature VIN / Immo / Anti-démarrage PEPS d’origine.',
      'Réétalonnage seuil de détection Knock Sensor pour carburant à teneur variable.',
    ],
    recommendedForVariants: ['coolray_cn_battle_181'],
    allowedHardwareFamilies: ['MG1US008'],
    flashBinaryTag: 'BHE15_MG1US008_EXPORT_DZ_174HP_SAFE',
  },
  {
    id: 'custom_anti_lspi_patch',
    title: '2. Patch Custom Anti-LSPI (Carburant Local & Protection Pistons)',
    targetController: 'ECU Moteur (0x7E0 -> 0x7E8)',
    badge: 'PROTECTION CYLINDRES 2 & 3',
    summary:
      'Cartographie préventive sur mesure réduisant drastiquement le pic de pression cylindre dans la zone critique d’auto-inflammation LSPI à bas régime et forte charge.',
    technicalAdjustments: [
      'Retard de l’avance à l’allumage (Ignition Timing Retard) de -2.5° à -4.0° entre 1 500 et 2 800 tr/min sous charge > 70%.',
      'Lissage et écrêtage progressif du couple et de la pression Turbo (Boost) sous 2 200 tr/min (protection jupes/segments pistons Cyl. 2 & 3).',
      'Enrichissement léger du mélange (AFR cible ~11.8–12.1 à pleine charge) pour abaisser la température en chambre de combustion.',
    ],
    recommendedForVariants: [
      'coolray_phase1_3cyl',
      'coolray_dz_export_4cyl',
      'coolray_cn_battle_181',
    ],
    allowedHardwareFamilies: ['MG1CS080', 'MG1US008', 'MG1UA008'],
    flashBinaryTag: 'COOLRAY_PATCH_ANTI_LSPI_LOCAL_FUEL_V3',
  },
  {
    id: 'tcu_7dct_anti_lug',
    title: '3. Optimisation TCU Boîte 7DCT (Anti Sous-Régime)',
    targetController: 'TCU Boîte 7DCT (0x7E1 -> 0x7E9)',
    badge: 'LOIS DE PASSAGE 7DCT',
    summary:
      'Recalibre les points de rétrogradage et de maintien de rapport pour éviter de forcer en 6e ou 7e sous 2 000 tr/min en côte ou lors des reprises.',
    technicalAdjustments: [
      'Rétrogradage anticipé dès 45% de pédale d’accélérateur entre 1 450 et 2 050 tr/min.',
      'Réduction du patinage thermique embrayage en rampage urbain chaud.',
      'Suppression du sous-régime prolongé en mode Normal/Confort en montée.',
    ],
    recommendedForVariants: [
      'coolray_phase1_3cyl',
      'coolray_dz_export_4cyl',
      'coolray_cn_battle_181',
    ],
    allowedHardwareFamilies: ['MG1CS080', 'MG1US008', 'MG1UA008'],
    flashBinaryTag: 'TCU_7DCT_COOLRAY_ANTI_LUG_SPORT',
  },
];

export interface CoolrayOilSpecOption {
  id: CoolrayOilSpecId;
  label: string;
  compliant: boolean;
  severity: LspiRiskSeverity;
  alertText: string;
}

export const COOLRAY_OIL_SPEC_OPTIONS: CoolrayOilSpecOption[] = [
  {
    id: '0W20_API_SP_GF6',
    label: '0W-20 Certifiée API SP / ILSAC GF-6 (Recommandée Constructeur)',
    compliant: true,
    severity: 'green',
    alertText:
      'Conforme : Formulation à faible teneur en calcium (remplacé par magnésium) qui neutralise l’auto-allumage des gouttelettes d’huile (LSPI).',
  },
  {
    id: '5W30_API_SP',
    label: '5W-30 API SP / ILSAC GF-6A (Tolérée climat très chaud si API SP)',
    compliant: true,
    severity: 'amber',
    alertText:
      'Vigilance : Viscosité plus épaisse à froid que le 0W-20 préconisé sur BHE15/G-Power. Acceptable uniquement avec homologation API SP stricte et vidange à 6 000–7 500 km.',
  },
  {
    id: '5W40_API_SN',
    label: '5W-40 Norme API SN / ACEA A3/B4 (NON CONFORME)',
    compliant: false,
    severity: 'red',
    alertText:
      'ALERTE CRITIQUE ROUGE ANTI-LSPI : L’huile 5W-40 API SN contient un taux élevé de détergents au calcium qui déclenchent le pré-allumage destructeur (LSPI) et ralentissent le déphaseur VVT. Vidanger immédiatement vers 0W-20 API SP / ILSAC GF-6 !',
  },
  {
    id: '10W40_API_SL_SN',
    label: '10W-40 Semi-Synthétique API SL/SN (DANGER CASSE MOTEUR)',
    compliant: false,
    severity: 'red',
    alertText:
      'ALERTE CRITIQUE ROUGE : Huile totalement proscrite sur Geely Coolray Turbo GDI ! Risque majeur de cokéfaction palier turbo, casse segments Cyl. 2/3 par LSPI et colmatage tamis VVT.',
  },
];

export const COOLRAY_OBD_SCENARIOS: Record<
  'normal' | 'vigilance' | 'lspi_critical',
  { label: string; snapshot: CoolrayObdPidSnapshot }
> = {
  normal: {
    label: 'Santé Optimale (Normal)',
    snapshot: {
      rpm: 2350,
      engineLoadPct: 48,
      knockRetardDeg: -0.8,
      misfiresCyl1: 0,
      misfiresCyl2: 0,
      misfiresCyl3: 0,
      misfiresCyl4: 0,
      stftPct: 1.4,
      ltftPct: -1.8,
      iatCelsius: 38,
      boostBar: 0.62,
      capturedAt: new Date().toLocaleTimeString('fr-FR'),
    },
  },
  vigilance: {
    label: 'Vigilance Carburant / IAT Chaud',
    snapshot: {
      rpm: 2150,
      engineLoadPct: 74,
      knockRetardDeg: -3.1,
      misfiresCyl1: 0,
      misfiresCyl2: 1,
      misfiresCyl3: 1,
      misfiresCyl4: 0,
      stftPct: 6.8,
      ltftPct: 7.4,
      iatCelsius: 51,
      boostBar: 1.05,
      capturedAt: new Date().toLocaleTimeString('fr-FR'),
    },
  },
  lspi_critical: {
    label: 'Alerte LSPI Critique (Cyl. 2 & 3)',
    snapshot: {
      rpm: 1850,
      engineLoadPct: 86,
      knockRetardDeg: -4.6,
      misfiresCyl1: 0,
      misfiresCyl2: 5,
      misfiresCyl3: 4,
      misfiresCyl4: 1,
      stftPct: 11.4,
      ltftPct: 12.2,
      iatCelsius: 61,
      boostBar: 1.24,
      capturedAt: new Date().toLocaleTimeString('fr-FR'),
    },
  },
};

export interface PidEvaluation {
  severity: LspiRiskSeverity;
  badge: string;
  recommendation: string;
}

export function evaluateKnockRetard(
  knockRetardDeg: number,
  rpm: number,
  isTurbo: boolean
): PidEvaluation {
  if (!isTurbo) {
    return {
      severity: Math.abs(knockRetardDeg) > 4.0 ? 'amber' : 'green',
      badge: Math.abs(knockRetardDeg) > 4.0 ? 'Vigilance' : 'Normal (Atmo)',
      recommendation:
        'Moteur 1.5L DVVT atmosphérique (exclu LSPI Turbo). Contrôle qualité essence si cliquetis persistant.',
    };
  }
  const absKnock = Math.abs(knockRetardDeg);
  if (absKnock > 3.5 && rpm >= 1500 && rpm <= 3000) {
    return {
      severity: 'red',
      badge: 'Risque LSPI Élevé',
      recommendation:
        'Retard > -3.5° entre 1 500 et 3 000 tr/min → Recommander contrôle carburant + Flash Anti-LSPI immédiat.',
    };
  }
  if (absKnock > 2.0) {
    return {
      severity: 'amber',
      badge: 'Vigilance',
      recommendation:
        'Correction d’avance modérée (-2.0° à -3.5°). Vérifier indice d’octane et éviter les reprises bas régime.',
    };
  }
  return {
    severity: 'green',
    badge: 'Normal',
    recommendation: 'Combustion propre (0° à -2.0°). Aucune correction de cliquetis critique.',
  };
}

export function evaluateMisfires(
  snap: CoolrayObdPidSnapshot,
  isTurbo: boolean
): PidEvaluation & { worstCylinders: string[] } {
  const counts = [
    { cyl: 'Cyl. 1', val: snap.misfiresCyl1, criticalSpot: false },
    { cyl: 'Cyl. 2', val: snap.misfiresCyl2, criticalSpot: true },
    { cyl: 'Cyl. 3', val: snap.misfiresCyl3, criticalSpot: true },
    { cyl: 'Cyl. 4', val: snap.misfiresCyl4, criticalSpot: false },
  ];
  const maxVal = Math.max(...counts.map((c) => c.val));
  const alertCyls = counts.filter((c) => c.val >= 3).map((c) => c.cyl);
  const centerAlert = counts.some((c) => c.criticalSpot && c.val >= 3);

  if (maxVal >= 3) {
    return {
      severity: 'red',
      badge: centerAlert && isTurbo ? 'ALERTE RENFORCÉE CYL. 2/3' : 'Ratés Critiques (>= 3)',
      recommendation:
        '≥ 3 ratés sur un même cylindre' +
        (centerAlert && isTurbo ? ' (zone critique LSPI Cyl. 2 & 3)' : '') +
        ' → Recommander contrôle bougies Iridium et prise de compression immédiate.',
      worstCylinders: alertCyls,
    };
  }
  if (maxVal > 0) {
    return {
      severity: 'amber',
      badge: 'Vigilance (1–2 ratés)',
      recommendation: 'Micro-ratés isolés détectés. Surveiller écartement bougies et bobines.',
      worstCylinders: counts.filter((c) => c.val > 0).map((c) => c.cyl),
    };
  }
  return {
    severity: 'green',
    badge: 'Normal (0 raté)',
    recommendation: 'Aucun raté d’allumage détecté sur les cylindres.',
    worstCylinders: [],
  };
}

export function evaluateFuelTrim(stftPct: number, ltftPct: number): PidEvaluation {
  const maxPos = Math.max(stftPct, ltftPct);
  const maxAbs = Math.max(Math.abs(stftPct), Math.abs(ltftPct));

  if (maxPos > 10) {
    return {
      severity: 'red',
      badge: 'Mélange Pauvre (> +10%)',
      recommendation:
        'Correction positive > +10% (mélange pauvre / surchauffe chambre) → Recommander nettoyage injecteurs haute pression GDI (PEA / banc ultrasons).',
    };
  }
  if (maxAbs > 5) {
    return {
      severity: 'amber',
      badge: 'Vigilance (±5% à ±10%)',
      recommendation:
        'Dérive richesse modérée. Vérifier étanchéité suralimentation, filtre à air et débit pompe HP.',
    };
  }
  return {
    severity: 'green',
    badge: 'Normal (-5% à +5%)',
    recommendation: 'Dosage air/carburant nominal dans la plage -5% à +5%.',
  };
}

export function evaluateIat(iatCelsius: number, loadPct: number, isTurbo: boolean): PidEvaluation {
  if (iatCelsius > 55) {
    return {
      severity: 'red',
      badge: isTurbo ? 'Surchauffe Admission (> 55°C)' : 'Air Chaud (> 55°C)',
      recommendation:
        loadPct > 55
          ? 'IAT > 55°C en charge → Déconseiller formellement les fortes accélérations à bas régime (risque auto-allumage).'
          : 'IAT > 55°C : vérifier refroidissement échangeur / pompe intercooler eau-air et éviter les reprises bas régime.',
    };
  }
  if (iatCelsius >= 45) {
    return {
      severity: 'amber',
      badge: 'Vigilance (45–55°C)',
      recommendation: 'Température d’admission tiède. Laisser refroidir avant pleine charge.',
    };
  }
  return {
    severity: 'green',
    badge: 'Normal (< 45°C)',
    recommendation: 'Température d’air admission optimale (< 45°C).',
  };
}

export function getOverallObdStatus(
  snap: CoolrayObdPidSnapshot,
  isTurbo: boolean
): LspiRiskSeverity {
  const sevList: LspiRiskSeverity[] = [
    evaluateKnockRetard(snap.knockRetardDeg, snap.rpm, isTurbo).severity,
    evaluateMisfires(snap, isTurbo).severity,
    evaluateFuelTrim(snap.stftPct, snap.ltftPct).severity,
    evaluateIat(snap.iatCelsius, snap.engineLoadPct, isTurbo).severity,
  ];
  if (sevList.includes('red')) return 'red';
  if (sevList.includes('amber')) return 'amber';
  return 'green';
}

export const MAINTENANCE_CYCLES_KM = {
  oilApiSp: 7500,
  iridiumPlugs: 25000,
  peaCleaner: 10000,
} as const;

export function computeCoolrayProtectionScore(params: {
  variantId: CoolrayVariantId;
  oilSpec: CoolrayOilSpecId;
  checklist: CoolraySafetyChecklist;
  obdStatus: LspiRiskSeverity;
  currentMileageKm: number;
  lastOilChangeKm: number;
  lastSparkPlugsKm: number;
  lastPeaCleanerKm: number;
}): {
  score: number;
  oilSinceKm: number;
  plugsSinceKm: number;
  peaSinceKm: number;
  statusLabel: string;
} {
  const {
    variantId,
    oilSpec,
    checklist,
    obdStatus,
    currentMileageKm,
    lastOilChangeKm,
    lastSparkPlugsKm,
    lastPeaCleanerKm,
  } = params;

  const oilSinceKm = Math.max(0, currentMileageKm - lastOilChangeKm);
  const plugsSinceKm = Math.max(0, currentMileageKm - lastSparkPlugsKm);
  const peaSinceKm = Math.max(0, currentMileageKm - lastPeaCleanerKm);

  const isAtmo = variantId === 'coolray_lite_dvvt_atmo';
  let score = 0;

  // 1. Checklist (35 pts)
  const checkItems = [
    checklist.oilApiSpGf6Verified,
    checklist.iridiumPlugsVerified,
    checklist.gdiPeaCleanerDone,
    checklist.localFuelEcuMapInstalled || isAtmo,
    checklist.drivingRuleValidated || isAtmo,
  ];
  const checkedCount = checkItems.filter(Boolean).length;
  score += Math.round((checkedCount / 5) * 35);

  // 2. Conformité Huile (25 pts)
  const oilOption = COOLRAY_OIL_SPEC_OPTIONS.find((o) => o.id === oilSpec);
  if (oilOption?.id === '0W20_API_SP_GF6') score += 25;
  else if (oilOption?.compliant) score += 15;
  else score += 0; // Huile non conforme = pénalité sévère

  // 3. Respect des cycles kilométriques (25 pts)
  const oilRatio = oilSinceKm / MAINTENANCE_CYCLES_KM.oilApiSp;
  const plugsRatio = plugsSinceKm / MAINTENANCE_CYCLES_KM.iridiumPlugs;
  const peaRatio = peaSinceKm / MAINTENANCE_CYCLES_KM.peaCleaner;

  score += oilRatio <= 1 ? 11 : oilRatio <= 1.15 ? 5 : 0;
  score += plugsRatio <= 1 ? 8 : plugsRatio <= 1.15 ? 4 : 0;
  score += peaRatio <= 1 ? 6 : peaRatio <= 1.2 ? 3 : 0;

  // 4. Dernier audit OBD2 combustion (15 pts)
  if (obdStatus === 'green') score += 15;
  else if (obdStatus === 'amber') score += 7;
  else score += 0;

  // Plafonnement sécurité si huile non conforme sur moteur Turbo
  if (!isAtmo && oilOption && !oilOption.compliant) {
    score = Math.min(score, 45);
  }

  const bounded = Math.max(0, Math.min(100, score));
  const statusLabel =
    bounded >= 85
      ? 'Protection Optimale'
      : bounded >= 60
        ? 'Vigilance Atelier Requise'
        : 'Risque Critique — Intervention Urgente';

  return {
    score: bounded,
    oilSinceKm,
    plugsSinceKm,
    peaSinceKm,
    statusLabel,
  };
}

export function buildDefaultCoolrayRecord(
  vin = 'L6T7824Z9RZ001540',
  variantId: CoolrayVariantId = 'coolray_cn_battle_181'
): CoolrayVehicleFollowUpRecord {
  const nowIso = new Date().toISOString();
  const checklist: CoolraySafetyChecklist = {
    oilApiSpGf6Verified: false,
    iridiumPlugsVerified: true,
    gdiPeaCleanerDone: false,
    localFuelEcuMapInstalled: variantId !== 'coolray_cn_battle_181',
    drivingRuleValidated: true,
  };
  const oilSpec: CoolrayOilSpecId = '0W20_API_SP_GF6';
  const calc = computeCoolrayProtectionScore({
    variantId,
    oilSpec,
    checklist,
    obdStatus: 'green',
    currentMileageKm: 18400,
    lastOilChangeKm: 12000,
    lastSparkPlugsKm: 0,
    lastPeaCleanerKm: 10000,
  });

  return {
    vin: vin.toUpperCase(),
    variantId,
    ownerOrPlate: 'Coolray Atelier DZ',
    currentMileageKm: 18400,
    lastOilChangeKm: 12000,
    lastSparkPlugsKm: 0,
    lastPeaCleanerKm: 10000,
    selectedOilSpec: oilSpec,
    checklist,
    lastObdAuditStatus: 'green',
    lastProtectionScore: calc.score,
    installedCalibrations:
      variantId === 'coolray_dz_export_4cyl' ? ['downgrade_cn_to_dz'] : [],
    interventions: [
      {
        id: 'INT-INIT-1',
        dateIso: nowIso.slice(0, 10),
        mileageKm: 12000,
        type: 'OIL_CHANGE',
        title: 'Vidange 0W-20 API SP / ILSAC GF-6',
        details: 'Filtre huile OEM + contrôle tamis VVT effectués.',
        technician: 'Atelier AutoPro',
      },
    ],
    updatedAt: nowIso,
  };
}

export const COOLRAY_CENTRAL_UNIT_MODELS: Array<{
  id: CoolrayCentralUnitModelId;
  label: string;
  address: string;
  warning: string;
}> = [
  {
    id: 'IHU624G',
    label: 'Unité Centrale IHU624G (Coolray 2020–2026 / Battle)',
    address: '0x770 (RX 0x778) · Port USB Data Console / ADB',
    warning: 'Ne jamais injecter un firmware IHU715P ou Flyme Auto sur carte IHU624G.',
  },
  {
    id: 'IHU715P',
    label: 'Unité Centrale IHU715P (Coolray Full Option / 540°)',
    address: '0x770 (RX 0x778) + Lien LVDS 540°',
    warning: 'Caméras 540° et DSP audio couplés : conserver /system d’origine intact.',
  },
  {
    id: 'IHU535G_ECARX',
    label: 'Unité Centrale IHU535G / ECARX E02 (GKUI Gen 2 / Phase 1)',
    address: '0x770 (RX 0x778) · Snapdragon 665 / MTK',
    warning: 'Vérifier la révision MCU avant toute mise à jour de l’interface compteur IPC.',
  },
  {
    id: 'BCM_SGW_CONTINENTAL',
    label: 'Unité Centrale Carrosserie BCM / Passerelle SGW & PEPS',
    address: '0x740 (RX 0x748) BCM · 0x714 IPC · Bus CAN-FD',
    warning: 'Batterie stabilisée >= 12.4V impérative avant réapprentissage PEPS / TPMS / SAS.',
  },
];

export const COOLRAY_ALGERIA_ISSUES: CoolrayAlgeriaIssueEntry[] = [
  {
    id: 'dz-issue-lspi',
    domain: 'ECU_MOTEUR',
    domainLabel: 'ECU Moteur 1.5T',
    severity: 'red',
    title: 'Cliquetis LSPI, perte de compression & ratés Cyl. 2–3',
    ecuAddress: '0x7E0 -> 0x7E8 (Bosch MG1US008 / MG1CS080)',
    typicalDtcs: ['P0300', 'P0302', 'P0303', 'P0325', 'P0171'],
    algeriaRootCause:
      'Carburant local à indice d’octane variable combiné à la cartographie Chine VI 181 ch agressive, ou utilisation d’huile 5W-40 API SN au lieu de 0W-20 API SP.',
    multimeterChecks: [
      'Bobines crayons 1.5T : primaire 0.7–1.2 Ω, alimentation +12V APC stable (> 12.2V contact mis).',
      'Capteur cliquetis (Knock Sensor) : résistance > 1 MΩ (piezo), signal AC propre sans faux contact faisceau.',
      'Compression à chaud attendue : 10.5 à 12.5 bar équilibrée (< 1 bar d’écart entre cylindres).',
    ],
    recommendedActionLabel: 'Ouvrir Flash Anti-LSPI ECU',
    targetSubTab: 'flash',
  },
  {
    id: 'dz-issue-7dct',
    domain: 'TCU_7DCT',
    domainLabel: 'Boîte 7DCT',
    severity: 'red',
    title: 'À-coups à chaud, patinage & mode dégradé en embouteillage',
    ecuAddress: '0x7E1 -> 0x7E9 (TCU 7DCT Double Embrayage)',
    typicalDtcs: ['P0700', 'P0811', 'P17D4', 'P2787', 'U0101'],
    algeriaRootCause:
      'Rampage prolongé dans les bouchons estivaux (> 40°C) + lois de passage d’origine maintenant la 6e/7e sous 1 800 tr/min (surchauffe huile ATF et fourchettes).',
    multimeterChecks: [
      'Alimentation TCU borne 30/15 : 12.5V–14.2V moteur tournant, masse châssis < 0.1 Ω.',
      'Bus CAN Boîte (broches 6 & 14 OBD) : CAN-H ~2.6–2.9V, CAN-L ~2.1–2.4V, résistance totale 60 Ω.',
      'Température huile ATF vidange / niveau exact : 58°C à 68°C.',
    ],
    recommendedActionLabel: 'Flash Loi Anti Sous-Régime 7DCT',
    targetSubTab: 'flash',
  },
  {
    id: 'dz-issue-ihu-locale',
    domain: 'IHU_COCKPIT',
    domainLabel: 'Unité Centrale IHU',
    severity: 'amber',
    title: 'Écran central bloqué Chinois/Anglais sans Maps ni CarPlay (Import Battle)',
    ecuAddress: '0x770 -> 0x778 (IHU624G / IHU715P)',
    typicalDtcs: ['B1A01', 'U0199', 'U1003'],
    algeriaRootCause:
      'Unités centrales Chine VI livrées avec blocage régional Baidu/AutoNavi empêchant Google Maps, Waze, CarPlay et traduction FR/AR.',
    multimeterChecks: [
      'Port USB 1 Data console centrale : 5.0V ± 0.25V stables sur broches VBUS/GND.',
      'Fusible IHU habitacle : 15A continu, aucune chute sous 11.8V au lancement du SoC.',
    ],
    recommendedActionLabel: 'Appliquer Pack Langue & DZ Non Destructif',
    targetSubTab: 'central_unit_dz',
    linkedOperationId: 'dz_ihu_locale_thermal_pack',
  },
  {
    id: 'dz-issue-ihu-bootloop',
    domain: 'IHU_COCKPIT',
    domainLabel: 'Unité Centrale IHU',
    severity: 'red',
    title: 'Bootloop, écran noir, perte caméra 360°/540° ou coupure son DSP',
    ecuAddress: '0x770 (IHU) + 0x714 (IPC Compteur LVDS)',
    typicalDtcs: ['B1402', 'U0235', 'U1120'],
    algeriaRootCause:
      'Surchauffe SoC estivale (> 45°C habitacle), batterie 12V faible pendant OTA ou flash croisé entre IHU624G, IHU715P et IHU535G.',
    multimeterChecks: [
      'Câble coaxial HSD/LVDS compteur ↔ IHU : continuité masse blindage OK, aucun pincement derrière écran.',
      'Ligne Wake-Up CAN / ACC Unité Centrale : +12V propre sans micro-coupure au démarrage.',
    ],
    recommendedActionLabel: 'Lancer Sauvetage Bootloop / Caméras 540°',
    targetSubTab: 'central_unit_dz',
    linkedOperationId: 'dz_ihu_bootloop_rescue',
  },
  {
    id: 'dz-issue-bcm-can',
    domain: 'BCM_PEPS_SGW',
    domainLabel: 'BCM / PEPS / SGW',
    severity: 'amber',
    title: 'Défauts réseau U0100/U0140, blocage clé PEPS & faux défauts TPMS',
    ecuAddress: '0x740 -> 0x748 (BCM / SGW Continental)',
    typicalDtcs: ['U0100', 'U0140', 'U0155', 'C0077', 'B10A2'],
    algeriaRootCause:
      'Chute de tension batterie 12V EFB/AGM d’origine (< 11.5V au démarreur) désynchronisant la passerelle SGW, le module clé mains-libres PEPS et l’angle volant SAS.',
    multimeterChecks: [
      'Batterie 12V au repos : 12.6V min ; au coup de démarreur : ne doit pas chuter sous 10.4V.',
      'Alternateur en charge (phares + clim ON) : 13.8V à 14.4V aux bornes batterie.',
      'Tresse de masse moteur-châssis : chute de tension < 0.15V sous charge démarreur.',
    ],
    recommendedActionLabel: 'Réinitialiser BCM / PEPS / TPMS',
    targetSubTab: 'central_unit_dz',
    linkedOperationId: 'dz_bcm_peps_tpms_reset',
  },
  {
    id: 'dz-issue-gdi-fuel',
    domain: 'ECU_MOTEUR',
    domainLabel: 'ECU Moteur 1.5T',
    severity: 'amber',
    title: 'Encrassement injecteurs GDI 350 bar & dérive LTFT > +10%',
    ecuAddress: '0x7E0 (PIDs 0x06 / 0x07 STFT & LTFT)',
    typicalDtcs: ['P0171', 'P0087', 'P2177'],
    algeriaRootCause:
      'Teneur élevée en soufre/gommes dans certains carburants locaux colmatant les buses haute pression GDI et appauvrissant la chambre (échauffement piston).',
    multimeterChecks: [
      'Capteur haute pression rampe GDI : ~0.5V contact mis, 1.4–3.8V selon régime (40 à 350 bar).',
      'Pompe basse pression réservoir : débit stable 3.8–4.5 bar, consommation 4.5–6.5A.',
    ],
    recommendedActionLabel: 'Ouvrir Audit OBD2 Fuel Trims',
    targetSubTab: 'obd_audit',
  },
];

export const COOLRAY_CENTRAL_UNIT_OPTIONS: CoolrayCentralUnitOption[] = [
  {
    id: 'dz_ihu_locale_thermal_pack',
    title: '1. Pack Localisation Algérie (FR/AR) & Stabilité Thermique SoC',
    targetUnits: ['IHU624G', 'IHU715P', 'IHU535G_ECARX'],
    udsOrInterface: 'ADB / USB Data + Overlay Non Destructif (0x770)',
    badge: 'COMPATIBLE OTA MAISON GEELY',
    oemUpdateSafeNote:
      'Zéro écriture sur /system ou /vendor : les mises à jour officielles OTA Maison Geely et USB concessionnaire s’installent sans blocage ni erreur de signature.',
    summary:
      'Active le français et l’arabe, débloque Waze/Maps/YouTube/CarPlay sans modifier /system ni casser les caméras 360°/540°, et applique un profil ventilateur/throttling été DZ.',
    steps: [
      'Sauvegarde automatique configuration CAN véhicule (clim, radars, ampli DSP).',
      'Injection overlay langue FR/AR (/data/local) + services GPS compatibles Algérie.',
      'Réglage seuil refroidissement SoC IHU (-6°C anticipation ventilateur interne).',
    ],
    binaryTag: 'COOLRAY_DZ_IHU_LOCALE_THERMAL_V4',
  },
  {
    id: 'dz_ihu_camera_lvds_realign',
    title: '2. Réalignement Bus LVDS Dual-Display & Caméras 360°/540°',
    targetUnits: ['IHU624G', 'IHU715P', 'IHU535G_ECARX'],
    udsOrInterface: 'UDS 0x770 (IHU) + 0x714 (IPC Compteur)',
    badge: 'STANDARD OEM GEELY / ECARX',
    oemUpdateSafeNote:
      'Utilise exclusivement les routines UDS 0x31 officielles ECARX / Geely pour recalibrer l’AVM 540° sans altérer le firmware constructeur.',
    summary:
      'Résout l’écran noir en marche arrière, le décalage de lignes dynamiques de braquage et la coupure de projection compteur LVDS après débranchement batterie ou mise à jour.',
    steps: [
      'Lecture DID F187/F191 carte mère IHU & vérification absence de croisement IHU624G / IHU715P.',
      'Routine UDS 0x31 ré-appairage canaux vidéo AVM 360°/540° & guidage angle volant.',
      'Resynchronisation flux LVDS entre Unité Centrale et Combiné Numérique IPC.',
    ],
    binaryTag: 'COOLRAY_DZ_LVDS_AVM540_SYNC',
  },
  {
    id: 'dz_bcm_peps_tpms_reset',
    title: '3. Réinitialisation Unité Centrale BCM / Passerelle SGW, PEPS & TPMS',
    targetUnits: ['BCM_SGW_CONTINENTAL'],
    udsOrInterface: 'UDS 0x740 -> 0x748 (BCM / SGW Continental CAN-FD)',
    badge: 'ROUTINES OEM CONTINENTAL',
    oemUpdateSafeNote:
      'Procédure conforme aux spécifications Continental Automotive / Geely G-Diag (aucun contournement permanent de la passerelle SGW).',
    summary:
      'Nettoie les défauts fantômes U0100/U0140 suite à batterie faible, recalibre le capteur d’angle volant (SAS) et réveille les valves TPMS 433 MHz.',
    steps: [
      'Contrôle tension stabilisée >= 12.4V et effacement ciblé DTC bus CAN-FD (0x14).',
      'Routine 0x31 point zéro angle volant SAS + synchronisation antenne PEPS.',
      'Réapprentissage rapide capteurs pression pneus TPMS 4 roues (433 MHz).',
    ],
    binaryTag: 'COOLRAY_DZ_BCM_SGW_PEPS_RESET',
  },
  {
    id: 'dz_ihu_bootloop_rescue',
    title: '4. Sauvetage Unité Centrale Bootloop / Son Coupé (Recovery OEM)',
    targetUnits: ['IHU624G', 'IHU715P', 'IHU535G_ECARX'],
    udsOrInterface: 'Mode Recovery USB Data + Restauration Partition Cache',
    badge: 'PRÉSERVE OTA & EEPROM',
    oemUpdateSafeNote:
      'Restaure la table DSP et vide uniquement le cache corrompu sans écraser l’EEPROM VIN/odomètre, rendant l’unité de nouveau apte aux mises à jour Maison Geely.',
    summary:
      'Sort l’unité centrale du redémarrage en boucle après une mise à jour OTA interrompue et restaure la communication amplificateur DSP / commandes climatisation.',
    steps: [
      'Vidage sécurisé /cache & Dalvik corrompus sans toucher /vendor ni partitions signées.',
      'Restauration profil audio CAN-DSP & table boutons volant/climatisation Coolray.',
      'Validation DIDs OEM et vérification redémarrage propre (< 18 secondes).',
    ],
    binaryTag: 'COOLRAY_DZ_IHU_BOOTLOOP_RESCUE',
  },
];

export function getCoolraySupplierCompatMatrix(
  variantId: CoolrayVariantId
): CoolrayOemModuleCompat[] {
  const isPhase1 = variantId === 'coolray_phase1_3cyl';
  const isAtmo = variantId === 'coolray_lite_dvvt_atmo';
  const isBattle = variantId === 'coolray_cn_battle_181';

  return [
    {
      moduleName: 'Unité Centrale Moteur (ECU)',
      supplierId: 'BOSCH',
      supplierLabel: 'Bosch Automotive',
      udsAddress: '0x7E0 -> 0x7E8',
      oemPartDidF187: isPhase1
        ? '6600048821 (MG1CS080)'
        : isAtmo
        ? '6608011240 (ME17 Atmo)'
        : '6608294105 (MG1US008)',
      oemSwDidF188: isBattle
        ? 'GEE-BHE15-CN6-181-V2.4'
        : isPhase1
        ? 'GEE-3G15TD-EXP-V3.1'
        : isAtmo
        ? 'GEE-15DVVT-STD-V1.8'
        : 'GEE-BHE15-DZ-174-V3.0',
      hardwareIdDidF191: isPhase1 ? 'MG1CS080-HW04' : isAtmo ? 'ME17.8.8-HW02' : 'MG1US008-HW07',
      otaAndDealerPolicy:
        'Sauvegarde CALID / CVN / EEPROM complète avant écriture. Compatible retour stock Maison Geely (VCI G-Diag) ou mise à jour bulletin technique Bosch officielle.',
      preservesSignedPartitions: true,
      supportsOfficialRestore: true,
    },
    {
      moduleName: isAtmo ? 'Calculateur Boîte CVT' : 'Calculateur Boîte 7DCT (TCU)',
      supplierId: 'GETRAG_MAGNA',
      supplierLabel: isAtmo ? 'Punch / Wanliyang CVT' : 'Magna / Getrag Powertrain',
      udsAddress: '0x7E1 -> 0x7E9',
      oemPartDidF187: isAtmo ? '3000188420 (CVT)' : '3000271904 (7DCT300)',
      oemSwDidF188: isAtmo ? 'CVT-15L-DZ-V1.2' : '7DCT-SH725-DZ-V4.2',
      hardwareIdDidF191: isAtmo ? 'CVT-GEN2-HW01' : '7DCT-MG-HW05',
      otaAndDealerPolicy:
        'Routines d’adaptation (Point de léchage / purge) 100% conformes aux protocoles Getrag. N’empêche aucune mise à jour TCU officielle concessionnaire.',
      preservesSignedPartitions: true,
      supportsOfficialRestore: true,
    },
    {
      moduleName: 'Unité Centrale Cockpit / Multimédia (IHU)',
      supplierId: 'ECARX_GEELY',
      supplierLabel: 'ECARX / Geely Digital Cockpit',
      udsAddress: '0x770 -> 0x778',
      oemPartDidF187: isBattle
        ? '8892410715 (IHU715P / 624G)'
        : isPhase1
        ? '8891030535 (IHU535G / ECARX)'
        : '8892410624 (IHU624G DZ)',
      oemSwDidF188: isBattle
        ? 'GKUI-CN-2026-R12'
        : isPhase1
        ? 'GKUI-ECARX-EXP-R08'
        : 'GKUI-EXPORT-DZ-R14',
      hardwareIdDidF191: isBattle ? 'SM6155-IHU715P' : isPhase1 ? 'SD665-E02' : 'SM6155-IHU624G',
      otaAndDealerPolicy:
        'Overlay utilisateur non destructif uniquement : /system, /vendor et clés de signature OTA Maison Geely restent 100% intacts. Les futures OTA passent sans bootloop.',
      preservesSignedPartitions: true,
      supportsOfficialRestore: true,
    },
    {
      moduleName: 'Unité Centrale Carrosserie & Passerelle (BCM / SGW)',
      supplierId: 'CONTINENTAL',
      supplierLabel: 'Continental Automotive',
      udsAddress: '0x740 -> 0x748',
      oemPartDidF187: '8889402110 (BCM/SGW)',
      oemSwDidF188: 'CONTI-SGW-CANFD-V2.9',
      hardwareIdDidF191: 'SGW-RH850-HW03',
      otaAndDealerPolicy:
        'Utilise uniquement les services UDS normalisés (0x14 / 0x31 SAS & TPMS). Sécurité passerelle SGW d’origine respectée.',
      preservesSignedPartitions: true,
      supportsOfficialRestore: true,
    },
  ];
}


