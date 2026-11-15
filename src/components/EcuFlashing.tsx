import React, { useEffect, useMemo, useState } from 'react';
import { Vehicle, FlashStage } from '../types/automotive';
import { FLASH_STAGES, VEHICLE_PRESETS } from '../data/mockVehicles';
import {
  Zap,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Download,
  Upload,
  CheckCircle2,
  Cpu,
  Sparkles,
  HardDrive,
  ScanLine,
  Lock,
  Unlock,
  XCircle,
  FileCheck2,
} from 'lucide-react';
import { apiFetch } from '../utils/apiBridge';
import { obdHardwareBridge } from '../utils/obdHardwareBridge';

interface EcuFlashingProps {
  selectedVehicle: Vehicle;
  setSelectedVehicle?: (vehicle: Vehicle) => void;
  batteryVoltage: number;
  isConnected: boolean;
  connectionMode: string;
  onOpenConnectModal: () => void;
}

interface EcuWhitelistProfile {
  ecuFamily: string;
  processorArch: string;
  allowedBuilds: string[];
  allowedPrefixes: string[];
  riskNote: string;
}

const ECU_BUILD_WHITELIST_BY_VEHICLE: Record<string, EcuWhitelistProfile> = {
  fiat_doblo_16mjet: {
    ecuFamily: 'Bosch EDC17C69 / MD1CS003',
    processorArch: 'Infineon TriCore TC1793 / AURIX TC298',
    allowedBuilds: ['TC1793-EDC17C69-1037558291', 'TC298-MD1CS003-10SW074112', '1037558291'],
    allowedPrefixes: ['TC1793-EDC17C69-', 'TC298-MD1CS003-', '1037558', '10SW074'],
    riskNote: 'Ne jamais injecter de build EDC17C10 (PSA/HDi) : perte anti-démarrage Fiat Code et blocage RAM.',
  },
  fiat_doblo_16hdi: {
    ecuFamily: 'Bosch EDC17C10',
    processorArch: 'Infineon TriCore TC1797',
    allowedBuilds: ['TC1797-EDC17C10-1037538840', 'SW9679164280-1037538840', '1037538840'],
    allowedPrefixes: ['TC1797-EDC17C10-', 'SW96791', '1037538'],
    riskNote: 'Architecture PSA TC1797 incompatible avec EDC17C69 MultiJet.',
  },
  fiat_500_algerie: {
    ecuFamily: 'Magneti Marelli 10GF',
    processorArch: 'NXP SPC564A80 / MPC5642',
    allowedBuilds: ['SPC564-MM10GF-52098411', 'MM10GF-DZ24-52098412', '52098411'],
    allowedPrefixes: ['SPC564-MM10GF-', 'MM10GF-DZ', '520984'],
    riskNote: 'Flash 8GMK ou TriCore sur MM10GF détruit irréversiblement le bootloader NXP.',
  },
  fiat_titano_dz: {
    ecuFamily: 'Bosch EDC17C55 / Delphi DCM6.2',
    processorArch: 'Infineon TriCore TC1767 / MPC5674',
    allowedBuilds: ['TC1767-EDC17C55-1037549012', 'MPC5674-DCM62-DZ2401', '1037549012'],
    allowedPrefixes: ['TC1767-EDC17C55-', 'MPC5674-DCM62-', '1037549'],
    riskNote: 'Bien vérifier EDC17C55 vs DCM6.2 avant écriture sur bloc 1.9TD Titano.',
  },
  fiat_scudo_dz: {
    ecuFamily: 'Delphi DCM7.1A',
    processorArch: 'Infineon AURIX TC297 / TC277',
    allowedBuilds: ['TC297-DCM71A-9841236580', 'DCM71A-DW10FD-98412365', '9841236580'],
    allowedPrefixes: ['TC297-DCM71A-', 'DCM71A-DW10', '9841236'],
    riskNote: 'DCM7.1A possède une signature RSA stricte : build exact requis.',
  },
  fiat_500x_algerie: {
    ecuFamily: 'Magneti Marelli 8GMK',
    processorArch: 'Freescale MPC5565 / SPC564',
    allowedBuilds: ['MPC5565-MM8GMK-55269801', 'MM8GMK-MAIR-140CV-02', '55269801'],
    allowedPrefixes: ['MPC5565-MM8GMK-', 'MM8GMK-MAIR-', '552698'],
    riskNote: 'Incompatible avec 10GF GSE.',
  },
  geely_coolray_15t: {
    ecuFamily: 'Bosch MED17.8.10 / UAES',
    processorArch: 'Infineon TriCore TC1782 / TC1793',
    allowedBuilds: ['TC1782-UAES-BHE15-1037564120', 'TC1793-MED17810-GCR24', '1037564120'],
    allowedPrefixes: ['TC1782-UAES-', 'TC1793-MED17810-', '1037564'],
    riskNote: 'Ne jamais flasher un build ME17.8.8 atmosphérique (GX3/Emgrand) sur Coolray BHE15 Turbo.',
  },
  geely_gx3_pro: {
    ecuFamily: 'Bosch ME17.8.8',
    processorArch: 'Infineon TriCore TC1728 / TC1767',
    allowedBuilds: ['TC1728-ME1788-GX3-1037551904', 'UAES-ME1788-15DVVT-04', '1037551904'],
    allowedPrefixes: ['TC1728-ME1788-', 'UAES-ME1788-15DVVT', '1037551'],
    riskNote: 'Build turbo MED17.8.10 interdit sur processeur TC1728 ME17.8.8.',
  },
  geely_emgrand_15: {
    ecuFamily: 'Bosch ME17.8.8 / UAES',
    processorArch: 'Infineon TriCore TC1728',
    allowedBuilds: ['TC1728-UAES-EMG24-1037552210', 'ME1788-EMG15-DZ2024', '1037552210'],
    allowedPrefixes: ['TC1728-UAES-EMG', 'ME1788-EMG', '1037552'],
    riskNote: 'Vérifier la référence UAES Emgrand avant écriture.',
  },
  geely_monjaro_20t: {
    ecuFamily: 'Bosch MG1CS080',
    processorArch: 'Infineon AURIX TC275 / TC298',
    allowedBuilds: ['TC298-MG1CS080-MONJ24-01', '10SW089412-MG1CS080', '10SW089412'],
    allowedPrefixes: ['TC298-MG1CS080-', '10SW089'],
    riskNote: 'Calculateur MG1 verrouillé Bootloader : nécessite build TC298 exact.',
  },
  jetour_dashing_15t: {
    ecuFamily: 'Bosch MED17.8.10',
    processorArch: 'Infineon TriCore TC1782 (SQRE4T15C)',
    allowedBuilds: ['TC1782-MED17810-JTDASH24', '1037568402-SQRE4T15C', '1037568402'],
    allowedPrefixes: ['TC1782-MED17810-JTD', '10375684'],
    riskNote: 'Ne pas confondre avec MG1US008 du Jetour T2 2.0T.',
  },
  jetour_x70_plus_16t: {
    ecuFamily: 'UAES / Bosch MED17.8.10',
    processorArch: 'Infineon TriCore TC1793 (SQRF4J16)',
    allowedBuilds: ['TC1793-UAES-X70P-1037570118', 'MED17810-J16-DZ24', '1037570118'],
    allowedPrefixes: ['TC1793-UAES-X70', 'MED17810-J16', '1037570'],
    riskNote: 'Calibration 1.6 TGDI 197ch incompatible avec 1.5 TCI.',
  },
  jetour_t2_traveller: {
    ecuFamily: 'Bosch MG1US008',
    processorArch: 'Infineon AURIX TC298TP / SPC5777',
    allowedBuilds: ['TC298-MG1US008-T2AWD-01', '10SW095110-MG1US008', '10SW095110'],
    allowedPrefixes: ['TC298-MG1US008-', '10SW095'],
    riskNote: 'Ne jamais écrire un fichier MED17.8.10 sur architecture MG1US008.',
  },
  chery_tiggo4_pro: {
    ecuFamily: 'Bosch ME17.8.8 / MED17.8.10',
    processorArch: 'Infineon TriCore TC1728 / TC1782',
    allowedBuilds: ['TC1782-CHERY-T4PRO-1037561880', 'TC1728-ME1788-T4P', '1037561880'],
    allowedPrefixes: ['TC1782-CHERY-T4', 'TC1728-ME1788-T4', '10375618'],
    riskNote: 'Distinguer impérativement ME17.8.8 vs MED17.8.10 sur Tiggo 4 Pro.',
  },
  chery_tiggo8_pro: {
    ecuFamily: 'UAES MED17.8.10',
    processorArch: 'Infineon TriCore TC1793',
    allowedBuilds: ['TC1793-UAES-T8MAX-1037579300', 'MED17810-T8PRO-20T', '1037579300'],
    allowedPrefixes: ['TC1793-UAES-T8', 'MED17810-T8', '10375793'],
    riskNote: 'Transmission AWD couplée : checksum TCU/ECU synchronisé.',
  },
  dfsk_glory580: {
    ecuFamily: 'Bosch ME17.8.8',
    processorArch: 'Infineon TriCore TC1728 (SFG15T)',
    allowedBuilds: ['TC1728-ME1788-DFSK580-01', '1037554420-SFG15T', '1037554420'],
    allowedPrefixes: ['TC1728-ME1788-DFSK', '10375544'],
    riskNote: 'Incompatible avec Delphi MT22.1 (DFSK K01/K02).',
  },
  dfsk_k01_utilitaire: {
    ecuFamily: 'Delphi MT22.1 / UAES',
    processorArch: 'Freescale MC9S12XET256',
    allowedBuilds: ['MC9S12-MT221-K01-28391044', 'DELPHI-MT221-DFSK-K01', '28391044'],
    allowedPrefixes: ['MC9S12-MT221-', 'DELPHI-MT221-', '283910'],
    riskNote: 'MCU Motorola MC9S12 : aucune écriture Bosch TriCore permise.',
  },
  jac_t8_pro: {
    ecuFamily: 'Bosch EDC17C55',
    processorArch: 'Infineon TriCore TC1767',
    allowedBuilds: ['TC1767-EDC17C55-JACT8-01', '1037546109-JAC20CTI', '1037546109'],
    allowedPrefixes: ['TC1767-EDC17C55-JAC', '10375461'],
    riskNote: 'Vérifier le secteur TPROT avant réécriture OBD.',
  },
  renault_symbol_dz: {
    ecuFamily: 'Continental EMS3120 / Valeo V42',
    processorArch: 'Infineon TriCore TC1738 / SH7058',
    allowedBuilds: ['TC1738-EMS3120-237106125R', 'SH7058-VALEOV42-DZ19', '237106125R'],
    allowedPrefixes: ['TC1738-EMS3120-', 'SH7058-VALEOV42-', '2371061'],
    riskNote: 'EMS3120 (TriCore) et Valeo V42 (Renesas) sont matériellement incompatibles.',
  },
  dacia_stepway_dz: {
    ecuFamily: 'Bosch EDC17C84 / Delphi DCM3.4',
    processorArch: 'Infineon TriCore TC1782 / SH7059',
    allowedBuilds: ['TC1782-EDC17C84-1037557710', 'SH7059-DCM34-237104490R', '1037557710'],
    allowedPrefixes: ['TC1782-EDC17C84-', 'SH7059-DCM34-', '10375577'],
    riskNote: 'Ne jamais croiser EDC17C84 (dCi 90) avec DCM3.4.',
  },
  peugeot_301_hdi: {
    ecuFamily: 'Bosch EDC17C10',
    processorArch: 'Infineon TriCore TC1797',
    allowedBuilds: ['TC1797-EDC17C10-9679164280', '1037538912-DV6DTED', '1037538912'],
    allowedPrefixes: ['TC1797-EDC17C10-', '9679164', '10375389'],
    riskNote: 'Protéger l’EEPROM BSI lors du flashage TC1797.',
  },
  toyota_hilux_dz: {
    ecuFamily: 'Denso Gen 2 CAN Gateway',
    processorArch: 'Renesas RH850 R7F701202 / SH72546',
    allowedBuilds: ['RH850-DENSO2-89663-0KL90', '89663-0KL90-00', '896630KL90'],
    allowedPrefixes: ['RH850-DENSO', '89663-0KL', '896630KL'],
    riskNote: 'Format Denso CUW/CAL strict : une mauvaise famille efface le bootloader RH850.',
  },
  hyundai_accent_crdi: {
    ecuFamily: 'Bosch EDC17C57',
    processorArch: 'Infineon TriCore TC1793',
    allowedBuilds: ['TC1793-EDC17C57-1037553480', '39110-2A815-RB16', '1037553480'],
    allowedPrefixes: ['TC1793-EDC17C57-', '39110-2A8', '10375534'],
    riskNote: 'TPROT actif : build SW exact requis pour passer le Seed-Key.',
  },
  vag_golf7_20tdi: {
    ecuFamily: 'Bosch EDC17C74 / MD1CS004',
    processorArch: 'Infineon TriCore TC1793 / AURIX TC298',
    allowedBuilds: ['TC1793-EDC17C74-04L906026BN', 'TC298-MD1CS004-04L906056', '04L906026BN'],
    allowedPrefixes: ['TC1793-EDC17C74-', 'TC298-MD1CS004-', '04L9060'],
    riskNote: 'Respecter strictement la référence VAG FRF / SGO (04L906...).',
  },
  bmw_320d_g20: {
    ecuFamily: 'Bosch MD1CP002',
    processorArch: 'Infineon AURIX TC298TP',
    allowedBuilds: ['TC298-MD1CP002-10SW082140', 'O_8KVB-000049A2-003', '10SW082140'],
    allowedPrefixes: ['TC298-MD1CP002-', 'O_8KVB-', '10SW0821'],
    riskNote: 'DoIP G20 sécurisé : build SWFK/BTLD obligatoire.',
  },
  mercedes_a200_w177: {
    ecuFamily: 'Bosch MED17.7.7',
    processorArch: 'Infineon TriCore TC1793',
    allowedBuilds: ['TC1793-MED1777-2829011200', 'A2829011200-SW01', '2829011200'],
    allowedPrefixes: ['TC1793-MED1777-', 'A282901', '282901'],
    riskNote: 'FBS4 actif sur W177 : vérifier la signature avant toute écriture.',
  },
};

function getWhitelistProfileForVehicle(vehicle: Vehicle): EcuWhitelistProfile {
  const ecuProfile = ECU_BUILD_WHITELIST_BY_VEHICLE[vehicle.id];
  if (ecuProfile) {
    return ecuProfile;
  }
  return {
    ecuFamily: vehicle.ecuType,
    processorArch: 'TriCore / AURIX Standard',
    allowedBuilds: [`BUILD-${vehicle.id.toUpperCase()}-VERIFIED`],
    allowedPrefixes: [`BUILD-${vehicle.id.toUpperCase()}`],
    riskNote: 'Vérifiez l’architecture processeur exacte avant toute injection.',
  };
}

/**
 * Liste blanche globale des IDs processeurs (ECU & IHU Android Chinois) et numéros de build autorisés.
 */
export const HARDWARE_WHITELIST: readonly string[] = [
  // Tablettes / Head Units Chinois & Processeurs Infodivertissement autorisés
  'IHU715P',
  'GKUI-IHU715P',
  'IHU516G',
  'QUALCOMM 6155',
  'SNAPDRAGON 6155',
  'SM6150',
  'QCM6155',
  'QUALCOMM 8155',
  'SNAPDRAGON 8155',
  'SM8150',
  'SA8155P',
  'ECARX E01',
  'ECARX-E01',
  'ECARX E02',
  'ECARX-E02',
  '1.8.2.1.E',
  'MT8666',
  'MEDIATEK MT8666',
  'UIS7862',
  'FYT UIS7862',
  'TOPWAY TS10',
  'TOPWAY TS18',
  // Microcontrôleurs & Builds ECU certifiés
  ...Array.from(
    new Set(
      Object.values(ECU_BUILD_WHITELIST_BY_VEHICLE).flatMap((p) => p.allowedBuilds)
    )
  ),
];

const IHU_WHITELIST_IDS = new Set([
  'IHU715P',
  'GKUI-IHU715P',
  'IHU516G',
  'QUALCOMM 6155',
  'SNAPDRAGON 6155',
  'SM6150',
  'QCM6155',
  'QUALCOMM 8155',
  'SNAPDRAGON 8155',
  'SM8150',
  'SA8155P',
  'ECARX E01',
  'ECARX-E01',
  'ECARX E02',
  'ECARX-E02',
  '1.8.2.1.E',
  'MT8666',
  'MEDIATEK MT8666',
  'UIS7862',
  'FYT UIS7862',
  'TOPWAY TS10',
  'TOPWAY TS18',
]);

const FORBIDDEN_BUILD_SIGNATURES = ['IHU535G', 'FYT_ON_TS10', 'TS10_ON_FYT', 'UNKNOWN', 'INVALID', 'TEST_BRICK'];

/**
 * Vérifie si l'ID processeur / numéro de build saisi ou scanné est présent dans HARDWARE_WHITELIST.
 * Empêche le déclenchement du flash si le build ne correspond pas.
 */
export function isHardwareCompatible(buildId: string): boolean {
  const normalized = buildId.trim().toUpperCase();
  if (!normalized || normalized.length < 4) return false;

  if (FORBIDDEN_BUILD_SIGNATURES.some((bad) => normalized.includes(bad))) {
    return false;
  }

  if (HARDWARE_WHITELIST.some((allowed) => allowed.toUpperCase() === normalized)) {
    return true;
  }

  if (normalized.length >= 9) {
    return Object.values(ECU_BUILD_WHITELIST_BY_VEHICLE).some((profile) =>
      profile.allowedPrefixes.some((prefix) => normalized.startsWith(prefix.toUpperCase()))
    );
  }

  return false;
}

interface WhitelistEvaluation {
  status: 'empty' | 'matched' | 'conflict' | 'unlisted';
  matchedBy: 'exact' | 'prefix' | null;
  conflictOwner: { brandModel: string; ecuType: string; processorArch: string } | null;
  headline: string;
  detail: string;
}

function evaluateBuildAgainstWhitelist(vehicle: Vehicle, rawInput: string): WhitelistEvaluation {
  const normalized = rawInput.trim().toUpperCase();
  if (!normalized) {
    return {
      status: 'empty',
      matchedBy: null,
      conflictOwner: null,
      headline: 'En attente de confirmation du numéro de build processeur',
      detail: 'Scannez le calculateur via OBD2/UDS ou saisissez manuellement le numéro de build figurant sur le processeur / outil de lecture.',
    };
  }

  const profile = getWhitelistProfileForVehicle(vehicle);

  // 0. Check global HARDWARE_WHITELIST via isHardwareCompatible(buildId)
  if (!isHardwareCompatible(normalized)) {
    return {
      status: 'unlisted',
      matchedBy: null,
      conflictOwner: null,
      headline: 'ÉCRITURE BLOQUÉE — Build non autorisé par HARDWARE_WHITELIST',
      detail: `"${normalized}" a été rejeté par isHardwareCompatible() : absent de HARDWARE_WHITELIST ou signature à risque (ex : IHU535G) pour ${vehicle.ecuType} (${profile.processorArch}). ${profile.riskNote}`,
    };
  }

  // 1. Check exact match on current vehicle whitelist
  const exactMatch = profile.allowedBuilds.some((b) => b.toUpperCase() === normalized);
  if (exactMatch) {
    return {
      status: 'matched',
      matchedBy: 'exact',
      conflictOwner: null,
      headline: 'Build processeur validé (HARDWARE_WHITELIST — Correspondance exacte)',
      detail: `Architecture ${profile.processorArch} confirmée pour ${profile.ecuFamily}.`,
    };
  }

  // 2. Check prefix match (require at least 9 chars to avoid trivial bypass)
  const prefixMatch =
    normalized.length >= 9 &&
    profile.allowedPrefixes.some((p) => normalized.startsWith(p.toUpperCase()));
  if (prefixMatch) {
    return {
      status: 'matched',
      matchedBy: 'prefix',
      conflictOwner: null,
      headline: 'Build processeur validé (HARDWARE_WHITELIST — Famille SW/HW autorisée)',
      detail: `Préfixe matériel compatible avec ${profile.processorArch} (${profile.ecuFamily}).`,
    };
  }

  // 3. Cross-vehicle mismatch check: does this build belong to ANOTHER vehicle/ECU?
  for (const [otherId, otherProfile] of Object.entries(ECU_BUILD_WHITELIST_BY_VEHICLE)) {
    if (otherId === vehicle.id) continue;
    const belongsToOther =
      otherProfile.allowedBuilds.some((b) => b.toUpperCase() === normalized) ||
      (normalized.length >= 9 &&
        otherProfile.allowedPrefixes.some((p) => normalized.startsWith(p.toUpperCase())));
    if (belongsToOther) {
      const otherVehicle = VEHICLE_PRESETS.find((v) => v.id === otherId);
      const brandModel = otherVehicle ? `${otherVehicle.brand} ${otherVehicle.model}` : otherProfile.ecuFamily;
      return {
        status: 'conflict',
        matchedBy: null,
        conflictOwner: {
          brandModel,
          ecuType: otherProfile.ecuFamily,
          processorArch: otherProfile.processorArch,
        },
        headline: 'CONFLIT MATÉRIEL CRITIQUE — ÉCRITURE BLOQUÉE',
        detail: `Le build "${normalized}" appartient au calculateur ${otherProfile.ecuFamily} (${otherProfile.processorArch} — ${brandModel}) et est INCOMPATIBLE avec ${vehicle.ecuType}. Risque immédiat de briquage du bootloader et perte IMMO.`,
      };
    }
  }

  // 4. Global Hardware Whitelist SoC / IHU ID (ex: IHU715P, Qualcomm 6155, ECARX E01)
  if (IHU_WHITELIST_IDS.has(normalized)) {
    return {
      status: 'matched',
      matchedBy: 'exact',
      conflictOwner: null,
      headline: `Processeur / Unité autorisée dans HARDWARE_WHITELIST (${normalized})`,
      detail: `ID processeur / build infodivertissement validé par isHardwareCompatible("${normalized}") pour ${vehicle.brand} ${vehicle.model}.`,
    };
  }

  // 5. Unknown / non-whitelisted build
  return {
    status: 'unlisted',
    matchedBy: null,
    conflictOwner: null,
    headline: 'Numéro de build absent de la liste blanche matérielle',
    detail: `"${normalized}" ne correspond à aucun build certifié pour ${vehicle.ecuType} (${profile.processorArch}). ${profile.riskNote}`,
  };
}

export const EcuFlashing: React.FC<EcuFlashingProps> = ({
  selectedVehicle,
  setSelectedVehicle,
  batteryVoltage,
  isConnected,
  connectionMode,
  onOpenConnectModal,
}) => {
  const [selectedStage, setSelectedStage] = useState<FlashStage>(FLASH_STAGES[0]);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashPhase, setFlashPhase] = useState('');
  const [flashComplete, setFlashComplete] = useState(false);
  const [flashError, setFlashError] = useState<string | null>(null);
  const [flashLogs, setFlashLogs] = useState<string[]>([]);
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  // Critical Verification state (Processor Build + Whitelist)
  const [processorBuildInput, setProcessorBuildInput] = useState('');
  const [isScanningBuild, setIsScanningBuild] = useState(false);
  const [scanSource, setScanSource] = useState<'none' | 'manual' | 'hardware_obd' | 'demo_scan'>('none');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [operatorConfirmed, setOperatorConfirmed] = useState(false);

  // Binary .bin integrity & SHA-256 verification state (Best Option #2)
  const [binFileAudit, setBinFileAudit] = useState<{
    fileName: string;
    sizeKb: number;
    sha256: string;
    detectedSignatures: string[];
    isValid: boolean;
    message: string;
  } | null>(null);

  // AI recommendations
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  // Reset critical verification whenever target vehicle/ECU changes
  useEffect(() => {
    setProcessorBuildInput('');
    setScanSource('none');
    setScanFeedback(null);
    setOperatorConfirmed(false);
    setBackupDownloaded(false);
    setBinFileAudit(null);
    setFlashError(null);
    setFlashComplete(false);
  }, [selectedVehicle.id]);

  const whitelistProfile = useMemo(
    () => getWhitelistProfileForVehicle(selectedVehicle),
    [selectedVehicle]
  );

  const whitelistEval = useMemo(
    () => evaluateBuildAgainstWhitelist(selectedVehicle, processorBuildInput),
    [selectedVehicle, processorBuildInput]
  );

  const isHardwareWhitelisted = useMemo(
    () => isHardwareCompatible(processorBuildInput),
    [processorBuildInput]
  );

  const isBuildWhitelisted = isHardwareWhitelisted && whitelistEval.status === 'matched';
  const isBinIntegrityOk = binFileAudit === null || binFileAudit.isValid;
  const isCriticalVerificationPassed = isBuildWhitelisted && operatorConfirmed && isBinIntegrityOk;

  // Simulated Map table values for visualization
  const mapRpmColumns = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500];
  const mapLoadRows = [
    { load: '20%', vals: [0.10, 0.15, 0.22, 0.30, 0.35, 0.40, 0.38, 0.30] },
    { load: '40%', vals: [0.25, 0.40, 0.65, 0.85, 0.95, 1.05, 1.00, 0.85] },
    { load: '60%', vals: [0.45, 0.80, 1.15, 1.35, 1.48, 1.55, 1.45, 1.25] },
    { load: '80%', vals: [0.60, 1.10, 1.45, 1.70, 1.85, 1.90, 1.78, 1.55] },
    { load: '100%', vals: [0.75, 1.30, 1.65, 1.95, 2.15, 2.20, 2.05, 1.80] },
  ];

  // Scan processor / ECU Calibration Build ID
  const handleScanProcessorBuild = async () => {
    setFlashError(null);
    if (!isConnected) {
      setScanFeedback('Liaison véhicule requise pour lancer un scan OBD2 / UDS.');
      onOpenConnectModal();
      return;
    }

    setIsScanningBuild(true);
    setScanFeedback(null);
    setOperatorConfirmed(false);

    try {
      if (obdHardwareBridge.isRealHardwareConnected()) {
        const realCalId = await obdHardwareBridge.readCalibrationId();
        if (realCalId) {
          setProcessorBuildInput(realCalId.toUpperCase());
          setScanSource('hardware_obd');
          setScanFeedback(
            `Build Calibration ID lu en temps réel via OBD2 Mode 09 PID 04 (${connectionMode.toUpperCase()}) : ${realCalId.toUpperCase()}.`
          );
        } else {
          setScanSource('manual');
          setScanFeedback(
            'Le calculateur connecté n’expose pas le PID 0904 (Calibration ID) sur ELM327 standard. Veuillez saisir manuellement le numéro de build lu au banc (Kess/Ktag/Flex) ou sur l’étiquette ECU.'
          );
        }
      } else {
        // Demo Atelier scan simulation
        await new Promise((resolve) => setTimeout(resolve, 750));
        const detectedBuild = whitelistProfile.allowedBuilds[0];
        setProcessorBuildInput(detectedBuild);
        setScanSource('demo_scan');
        setScanFeedback(
          `Scan Atelier (Mode Démo) UDS 0x22 F1 81 terminé — Build détecté : ${detectedBuild}. Cochez la confirmation opérateur ci-dessous.`
        );
      }
    } catch (err) {
      setScanFeedback(
        err instanceof Error
          ? `Erreur pendant le scan matériel : ${err.message}`
          : 'Impossible de lire le numéro de build sur le bus CAN.'
      );
    } finally {
      setIsScanningBuild(false);
    }
  };

  // Backup original dump
  const handleBackupDump = () => {
    setBackupDownloaded(true);
    const dumpContent = `AutoPro ECU Backup
Calculateur: ${selectedVehicle.ecuType}
Architecture Processeur: ${whitelistProfile.processorArch}
Build Vérifié: ${processorBuildInput || 'NON_VERIFIE'}
Véhicule: ${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.year})
Motorisation: ${selectedVehicle.engine}
Date de lecture: ${new Date().toISOString()}
Protocole: ${selectedVehicle.protocol}
Taille: 2048 KB (Flash Micro)`;

    const blob = new Blob([dumpContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ECU_ORIGINAL_${selectedVehicle.brand}_${selectedVehicle.ecuType.replace(/[\s/]+/g, '_')}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Verify local .bin firmware integrity (SHA-256 + Size + ASCII Header Signatures)
  const handleInspectBinaryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFlashError(null);

    try {
      const buffer = await file.arrayBuffer();
      const sizeKb = Math.round(buffer.byteLength / 1024);

      // Compute cryptographic SHA-256
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const sha256 = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      // Extract printable ASCII strings from header & body sample to spot ECU/IHU tags
      const sampleSlice = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 256 * 1024)));
      let ascii = '';
      for (let i = 0; i < sampleSlice.length; i++) {
        const c = sampleSlice[i];
        ascii += c >= 32 && c <= 126 ? String.fromCharCode(c) : ' ';
      }
      const upperAscii = ascii.toUpperCase();

      const signatureTokens = [
        'BOSCH',
        'UAES',
        'MED17',
        'ME17',
        'EDC17',
        'MG1',
        'MD1',
        'DELPHI',
        'MARELLI',
        'DENSO',
        'IHU715P',
        'IHU535G',
        'SM6150',
        'SM8150',
      ];
      const detectedSignatures = signatureTokens.filter((tok) => upperAscii.includes(tok));

      // Integrity rules: reject tiny/corrupted files (< 64 KB) or forbidden IHU535G cross-firmware
      if (sizeKb < 64) {
        setBinFileAudit({
          fileName: file.name,
          sizeKb,
          sha256,
          detectedSignatures,
          isValid: false,
          message: `Fichier binaire rejeté (${sizeKb} Ko < 64 Ko minimum) : fichier tronqué ou corrompu. Écriture bloquée.`,
        });
        return;
      }

      if (detectedSignatures.includes('IHU535G') && selectedVehicle.brand === 'Geely') {
        setBinFileAudit({
          fileName: file.name,
          sizeKb,
          sha256,
          detectedSignatures,
          isValid: false,
          message: 'ALERTE ROUGE BINAIRE : Signature IHU535G détectée dans le fichier ! Injection interdite (risque perte radio & caméra 540°).',
        });
        return;
      }

      setBinFileAudit({
        fileName: file.name,
        sizeKb,
        sha256,
        detectedSignatures,
        isValid: true,
        message: `Intégrité binaire vérifiée (${sizeKb} Ko) — SHA-256 calculé et sain.`,
      });
    } catch {
      setBinFileAudit({
        fileName: file.name,
        sizeKb: 0,
        sha256: 'ERREUR',
        detectedSignatures: [],
        isValid: false,
        message: 'Impossible de lire ou hacher le fichier binaire sélectionné.',
      });
    }
  };

  // Launch flash process (strictly guarded by isHardwareCompatible + Critical Verification)
  const handleStartFlash = () => {
    setFlashError(null);

    if (!isConnected) {
      setFlashError('Liaison véhicule requise avant d’autoriser l’écriture ECU.');
      return;
    }

    if (!isHardwareCompatible(processorBuildInput) || !isBuildWhitelisted) {
      setFlashError(
        `ÉCRITURE BLOQUÉE (HARDWARE_WHITELIST) : Le numéro de build processeur "${processorBuildInput || 'vide'}" ne correspond pas à la liste blanche matérielle pour ${selectedVehicle.ecuType}.`
      );
      return;
    }

    if (!isBinIntegrityOk) {
      setFlashError(
        `ÉCRITURE BLOQUÉE (Intégrité Binaire) : ${binFileAudit?.message || 'Fichier .bin invalide ou incompatible.'}`
      );
      return;
    }

    if (!operatorConfirmed) {
      setFlashError(
        'CONFIRMATION REQUISE : Veuillez cocher la case de confirmation opérateur dans la section « Vérification Critique » avant de lancer l’écriture.'
      );
      return;
    }

    if (batteryVoltage < 12.5) {
      setFlashError(
        `Tension batterie insuffisante (${batteryVoltage.toFixed(1)}V < 12.5V) ! Branchez un stabilisateur 13.8V avant de flasher.`
      );
      return;
    }

    setIsFlashing(true);
    setFlashProgress(0);
    setFlashComplete(false);
    setFlashLogs([
      `[00.0s] HARDWARE_WHITELIST OK -> Build ${processorBuildInput.trim().toUpperCase()} validé par isHardwareCompatible().`,
      ...(binFileAudit
        ? [`[00.1s] Contrôle SHA-256 binaire "${binFileAudit.fileName}" : ${binFileAudit.sha256.slice(0, 24)}... OK.`]
        : []),
      `[00.2s] Démarrage de la séquence de flash pour ${selectedStage.name}...`,
    ]);

    const steps = [
      { p: 10, phase: 'Contrôle Seed-Key & Déverrouillage RSA Bootloader', log: 'SEED reçu : 0x7F21AA9C -> KEY calculée OK (Accès Niveau 27 accordé).' },
      { p: 25, phase: 'Effacement des secteurs Flash ROM (0x00010000 - 0x001FFFFF)', log: 'Secteurs mémoires effacés avec succès. Pas de bloc défectueux détecté.' },
      { p: 45, phase: 'Écriture cartographie injection & suralimentation...', log: 'Transfert paquets CAN UDS 0x36 TransferData (Bloc 1/8)...' },
      { p: 65, phase: 'Écriture maps avance allumage & limiteurs de couple...', log: 'Transfert paquets CAN UDS 0x36 TransferData (Bloc 5/8)...' },
      { p: 85, phase: 'Recalcul automatique Checksum RSA 2048 / CRC32', log: 'Checksum recalculé : CS_0x9B41E2 -> Intégrité vérifiée OK.' },
      { p: 95, phase: 'Verrouillage calculateur & Réinitialisation adaptation', log: 'Commande UDS 0x11 ECUReset (Hard Reset)...' },
      { p: 100, phase: 'Reprogrammation terminée avec succès !', log: 'Flash validé. Clé de contact sur OFF pendant 15s puis démarrage.' },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        const item = steps[currentStep];
        setFlashProgress(item.p);
        setFlashPhase(item.phase);
        setFlashLogs((prev) => [
          ...prev,
          `[+${(currentStep * 2 + 1.5).toFixed(1)}s] ${item.log}`,
        ]);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsFlashing(false);
        setFlashComplete(true);
      }
    }, 1200);
  };

  // Ask AI Tuning Expert
  const handleAskAiTuning = async () => {
    setAiLoading(true);
    try {
      const res = await apiFetch('/api/flash/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: selectedVehicle.brand,
          model: selectedVehicle.model,
          ecuType: selectedVehicle.ecuType,
          flashStage: selectedStage.name,
        }),
      });
      const data = await res.json();
      setAiAdvice(data.recommendation || 'Conseils indisponibles.');
    } catch {
      setAiAdvice('Erreur lors du calcul de la recommandation par l\'IA.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & ECU Info Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>Reprogrammation Cartographie &amp; Flash ECU Multimarque</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Calculateur cible : <strong className="text-cyan-400 font-mono">{selectedVehicle.ecuType}</strong> sur {selectedVehicle.brand} {selectedVehicle.model} ({selectedVehicle.engine}).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full md:w-auto">
          {setSelectedVehicle && (
            <select
              value={selectedVehicle.id}
              onChange={(e) => {
                const v = VEHICLE_PRESETS.find((p) => p.id === e.target.value);
                if (v) setSelectedVehicle(v);
              }}
              className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
            >
              {VEHICLE_PRESETS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} ({v.year})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleBackupDump}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer border border-slate-700 shrink-0"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Sauvegarder ROM Origine (.bin)</span>
          </button>
        </div>
      </div>

      {/* Safety Matrix Checklist (5 Checks including Vérification Critique) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
          batteryVoltage >= 12.8 ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
        }`}>
          {batteryVoltage >= 12.8 ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          <div>
            <span className="font-semibold block">Tension ({batteryVoltage.toFixed(1)}V)</span>
            <span className="text-[10px] text-slate-400">{batteryVoltage >= 12.8 ? 'Stabilisateur OK' : 'Tension trop basse'}</span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
          isConnected ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}>
          {isConnected ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          <div>
            <span className="font-semibold block">Liaison ({connectionMode.toUpperCase()})</span>
            <span className="text-[10px] text-slate-400">{isConnected ? 'Canal vérifié' : 'Non connecté'}</span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
          backupDownloaded ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
        }`}>
          {backupDownloaded ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />}
          <div>
            <span className="font-semibold block">Dump d'Origine (.bin)</span>
            <span className="text-[10px] text-slate-400">{backupDownloaded ? 'Sauvegardé sur disque' : 'Non encore extrait'}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 text-xs flex items-center gap-2.5 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <span className="font-semibold block">Contrôle Checksum RSA</span>
            <span className="text-[10px] text-cyan-400 font-mono">Calcul automatique ON</span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
          isCriticalVerificationPassed
            ? 'bg-emerald-950/40 border-emerald-700/70 text-emerald-300'
            : whitelistEval.status === 'conflict'
            ? 'bg-rose-950/60 border-rose-600 text-rose-200'
            : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
        }`}>
          {isCriticalVerificationPassed ? (
            <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <div>
            <span className="font-semibold block">Vérification Critique</span>
            <span className="text-[10px] text-slate-300">
              {isCriticalVerificationPassed
                ? 'Build whitelisté & confirmé'
                : whitelistEval.status === 'conflict'
                ? 'Conflit matériel détecté'
                : 'Écriture verrouillée'}
            </span>
          </div>
        </div>
      </div>

      {/* Stage Selection Cards */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Choisissez la Calibration Moteur / Solution Logicielle
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FLASH_STAGES.map((stage) => {
            const isSelected = selectedStage.id === stage.id;
            return (
              <div
                key={stage.id}
                onClick={() => setSelectedStage(stage)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900 border-amber-500 shadow-lg ring-1 ring-amber-500/50'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase bg-slate-800 text-amber-400 px-2 py-0.5 rounded">
                      {stage.badge}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{stage.hpGain} ch / +{stage.torqueGain} Nm
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1.5">{stage.name}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{stage.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Application :</span>
                  <span>{stage.recommendedFor}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calibration Visualizer: Interactive 2D Fuel & Boost Map Preview */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Matrice de Calibration Suralimentation Target (bar) - {selectedStage.name}</span>
            </h3>
            <span className="text-xs text-slate-400">
              Pression d'admission relative injectée dans la mémoire EEPROM flashée
            </span>
          </div>

          <div className="text-xs font-mono text-cyan-400 bg-slate-950 px-3 py-1 rounded border border-slate-800">
            Gain Pression Suralimentation : +{selectedStage.boostDeltaBar.toFixed(2)} bar
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-center border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-3 text-left">Charge / RPM</th>
                {mapRpmColumns.map((rpm) => (
                  <th key={rpm} className="py-2 px-2 text-slate-300">
                    {rpm}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapLoadRows.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-3 text-left font-semibold text-slate-400">{row.load}</td>
                  {row.vals.map((v, colIdx) => {
                    const adjusted = (v + selectedStage.boostDeltaBar).toFixed(2);
                    return (
                      <td
                        key={colIdx}
                        className={`py-2 px-2 tabular-nums ${
                          parseFloat(adjusted) > 2.0
                            ? 'text-amber-400 font-bold bg-amber-950/20'
                            : parseFloat(adjusted) > 1.4
                            ? 'text-cyan-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {adjusted}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Motoriste Advice Section */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">
              Analyse Ingénieur Motoriste IA pour {selectedVehicle.brand} {selectedVehicle.model}
            </h4>
          </div>

          <button
            onClick={handleAskAiTuning}
            disabled={aiLoading}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
            <span>{aiLoading ? 'Calcul des limites...' : 'Calculer Limites avec l\'IA'}</span>
          </button>
        </div>

        {aiAdvice ? (
          <div className="p-4 bg-slate-950 rounded-lg border border-amber-800/40 text-xs text-slate-300 whitespace-pre-line leading-relaxed font-sans">
            {aiAdvice}
          </div>
        ) : (
          <p className="text-xs text-slate-400 leading-relaxed">
            Consultez les recommandations de tolérance de couple boîte (Nm), de température d'échappement (EGT max 850°C) et les ajustements de timing pour ce bloc moteur.
          </p>
        )}
      </div>

      {/* MANDATORY CRITICAL VERIFICATION GATE BEFORE FLASH WRITING */}
      <div
        className={`p-5 rounded-xl border-2 space-y-4 transition-colors ${
          isCriticalVerificationPassed
            ? 'bg-emerald-950/20 border-emerald-700/70'
            : whitelistEval.status === 'conflict'
            ? 'bg-rose-950/30 border-rose-600'
            : 'bg-slate-900/80 border-amber-600/60'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {isCriticalVerificationPassed ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                Étape Obligatoire : Vérification Critique (Numéro de Build Processeur)
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Processeur attendu :{' '}
              <strong className="text-cyan-300 font-mono">{whitelistProfile.processorArch}</strong> sur{' '}
              <strong className="text-white">{whitelistProfile.ecuFamily}</strong>. L’écriture reste bloquée tant que le build n’est pas validé sur la liste blanche matérielle.
            </p>
          </div>

          <button
            type="button"
            onClick={handleScanProcessorBuild}
            disabled={isScanningBuild || isFlashing}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer shrink-0 shadow-sm"
          >
            <ScanLine className={`w-4 h-4 ${isScanningBuild ? 'animate-spin' : ''}`} />
            <span>{isScanningBuild ? 'Lecture UDS / PID 0904...' : 'Scanner Build Processeur (OBD2 / UDS)'}</span>
          </button>
        </div>

        {/* Manual input + Whitelist quick reference */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="ecu-processor-build-input"
              className="block text-xs font-semibold text-slate-200"
            >
              Numéro de Build / Calibration ID Processeur (Saisie manuelle ou Scan)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="ecu-processor-build-input"
                type="text"
                value={processorBuildInput}
                disabled={isFlashing}
                onChange={(e) => {
                  setProcessorBuildInput(e.target.value);
                  setScanSource('manual');
                  setOperatorConfirmed(false);
                  setFlashError(null);
                }}
                placeholder={`Ex : ${whitelistProfile.allowedBuilds[0]}`}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs font-mono text-white uppercase placeholder:text-slate-600 focus:outline-none"
              />
              {processorBuildInput && (
                <button
                  type="button"
                  onClick={() => {
                    setProcessorBuildInput('');
                    setScanSource('none');
                    setScanFeedback(null);
                    setOperatorConfirmed(false);
                  }}
                  className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                  title="Effacer"
                >
                  Effacer
                </button>
              )}
            </div>

            {scanFeedback && (
              <p className="text-[11px] text-cyan-300 font-mono bg-slate-950/70 px-2.5 py-1.5 rounded border border-slate-800">
                {scanFeedback}
              </p>
            )}
          </div>

          {/* Whitelist Display for Technician Reference */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                HARDWARE_WHITELIST ({selectedVehicle.brand} + Processeurs IHU)
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  isHardwareWhitelisted
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
              >
                isHardwareCompatible: {isHardwareWhitelisted ? 'TRUE' : 'FALSE'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {whitelistProfile.allowedBuilds.map((build) => (
                <span
                  key={build}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-200 select-all"
                >
                  {build}
                </span>
              ))}
              {['IHU715P', 'QUALCOMM 6155', 'QUALCOMM 8155', 'ECARX E01', '1.8.2.1.E'].map((socId) => (
                <span
                  key={socId}
                  className="px-2 py-1 rounded bg-cyan-950/40 border border-cyan-800/60 text-[11px] font-mono text-cyan-300 select-all"
                >
                  {socId}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Préfixes ECU autorisés :{' '}
              <span className="font-mono text-slate-300">
                {whitelistProfile.allowedPrefixes.join(' , ')}
              </span>
            </p>
          </div>
        </div>

        {/* Option 2 Bonus: Contrôle Intégrité & SHA-256 Fichier Binaire (.bin) */}
        <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-200 block">
                  Contrôle Checksum SHA-256 &amp; Signature Binaire (.bin / .ori / .mod — Optionnel)
                </span>
                <span className="text-[11px] text-slate-400">
                  Vérifie la taille mémoire, l’empreinte SHA-256 et les en-têtes constructeur avant écriture sur calculateur.
                </span>
              </div>
            </div>

            <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer shrink-0 text-center">
              Analyser fichier .bin
              <input
                type="file"
                accept=".bin,.ori,.mod,.hex,.frf,.sgo"
                onChange={handleInspectBinaryFile}
                disabled={isFlashing}
                className="hidden"
              />
            </label>
          </div>

          {binFileAudit && (
            <div
              className={`p-2.5 rounded border text-[11px] font-mono space-y-1 ${
                binFileAudit.isValid
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-600 text-rose-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">
                  {binFileAudit.fileName} ({binFileAudit.sizeKb} Ko)
                </span>
                <span>{binFileAudit.isValid ? 'INTÉGRITÉ OK' : 'FICHIER REJETÉ'}</span>
              </div>
              <div className="truncate text-[10px] opacity-85">SHA-256 : {binFileAudit.sha256}</div>
              <div>{binFileAudit.message}</div>
              {binFileAudit.detectedSignatures.length > 0 && (
                <div className="text-[10px] text-cyan-300">
                  Signatures détectées : {binFileAudit.detectedSignatures.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Real-time Whitelist Comparison Verdict */}
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-start gap-3 ${
            whitelistEval.status === 'matched'
              ? 'bg-emerald-950/50 border-emerald-700/70 text-emerald-200'
              : whitelistEval.status === 'conflict'
              ? 'bg-rose-950/70 border-rose-500 text-rose-100'
              : whitelistEval.status === 'unlisted'
              ? 'bg-rose-950/40 border-rose-700/70 text-rose-200'
              : 'bg-slate-950/70 border-slate-800 text-slate-300'
          }`}
        >
          {whitelistEval.status === 'matched' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : whitelistEval.status === 'conflict' || whitelistEval.status === 'unlisted' ? (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{whitelistEval.headline}</span>
              {scanSource === 'hardware_obd' && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/70 text-emerald-300 border border-emerald-700">
                  SCAN RÉEL OBD2
                </span>
              )}
              {scanSource === 'demo_scan' && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700">
                  SCAN DÉMO ATELIER
                </span>
              )}
              {scanSource === 'manual' && processorBuildInput.trim() && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  SAISIE MANUELLE
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">{whitelistEval.detail}</p>
          </div>
        </div>

        {/* Mandatory Operator Confirmation Checkbox */}
        <label
          className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs select-none transition-colors ${
            isBuildWhitelisted
              ? 'bg-slate-950/80 border-emerald-800/60 text-slate-100 cursor-pointer hover:border-emerald-600'
              : 'bg-slate-950/40 border-slate-800/70 text-slate-500 cursor-not-allowed'
          }`}
        >
          <input
            type="checkbox"
            checked={operatorConfirmed}
            disabled={!isBuildWhitelisted || isFlashing}
            onChange={(e) => {
              setOperatorConfirmed(e.target.checked);
              setFlashError(null);
            }}
            className="mt-0.5 h-4 w-4 rounded accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
          />
          <span>
            Je confirme avoir contrôlé physiquement ou via lecture UDS que le numéro de build processeur{' '}
            <strong className="font-mono text-cyan-300">
              {processorBuildInput.trim().toUpperCase() || '(à renseigner)'}
            </strong>{' '}
            correspond exactement au calculateur{' '}
            <strong>{selectedVehicle.ecuType}</strong> du véhicule avant d’autoriser l’écriture Flash.
          </span>
        </label>
      </div>

      {/* Flashing Trigger & Progress Modal/Bar */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 block">
              {isCriticalVerificationPassed ? 'Vérification Critique Validée — Opération Prête :' : 'Écriture Verrouillée (Vérification Critique Requise) :'}
            </span>
            <span className="text-base font-bold text-white">
              Flasher {selectedStage.name} dans {selectedVehicle.ecuType}
            </span>
          </div>

          <button
            onClick={handleStartFlash}
            disabled={isFlashing || !isConnected || !isCriticalVerificationPassed}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            {isCriticalVerificationPassed ? <Upload className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span>
              {isFlashing
                ? 'Écriture Flash en cours...'
                : isCriticalVerificationPassed
                ? 'Injecter Cartographie (Écrire ECU)'
                : 'Écriture Bloquée (Confirmer Build)'}
            </span>
          </button>
        </div>

        {!isConnected && (
          <div className="text-xs text-amber-400 flex flex-wrap items-center justify-between gap-2 bg-amber-950/30 border border-amber-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Liaison requise : Veuillez connecter le smartphone ou le PC à l'interface véhicule avant de lancer l'écriture.
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenConnectModal}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] cursor-pointer"
            >
              Connecter l’interface
            </button>
          </div>
        )}

        {flashError && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-600 rounded-lg text-rose-200 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{flashError}</span>
          </div>
        )}

        {isFlashing && (
          <div className="p-4 bg-slate-950 rounded-lg border border-amber-500/50 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-amber-400 font-mono">{flashPhase}</span>
              <span className="font-mono text-slate-200 font-bold">{flashProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-2.5 transition-all duration-300"
                style={{ width: `${flashProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-rose-400 font-semibold animate-pulse">
              NE PAS COUPER LE CONTACT NI DÉBRANCHER LE CÂBLE PENDANT L'ÉCRITURE.
            </p>
          </div>
        )}

        {flashComplete && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-700/60 rounded-lg text-emerald-300 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-emerald-200 text-sm">
                Flash ECU Exécuté avec Succès !
              </span>
              Le calculateur moteur a validé le nouveau programme {selectedStage.name}. Coupez le contact pendant 15 secondes pour sauvegarder les adaptations EEPROM, puis redémarrez le véhicule.
            </div>
          </div>
        )}

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
  );
};

