import { VinEcuCandidate, VinEcuDecodeResult } from '../types/automotive';

interface WmiEntry {
  manufacturer: string;
  brand: 'Chery' | 'Geely' | 'MG' | 'BYD' | 'DFSK' | 'Changan' | 'Haval';
  defaultModelRange: string;
  getCandidates: (vds: string, year: number | null) => {
    modelRange: string;
    seriesSwitchWarning: string | null;
    candidates: VinEcuCandidate[];
  };
}

const VIN_YEAR_MAP: Record<string, number> = {
  J: 2018,
  K: 2019,
  L: 2020,
  M: 2021,
  N: 2022,
  P: 2023,
  R: 2024,
  S: 2025,
  T: 2026,
  V: 2027,
};

const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

function validateVinCheckDigit(vin: string): boolean | null {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const val = VIN_TRANSLITERATION[vin[i]];
    if (val === undefined) return null;
    sum += val * VIN_WEIGHTS[i];
  }
  const rem = sum % 11;
  const expected = rem === 10 ? 'X' : String(rem);
  return vin[8] === expected;
}

const CHINESE_WMI_REGISTRY: Record<string, WmiEntry> = {
  LVV: {
    manufacturer: 'Chery Automobile Co., Ltd. (Wuhu, Chine)',
    brand: 'Chery',
    defaultModelRange: 'Tiggo 4 / Tiggo 7 Pro / Tiggo 8 Pro / Arrizo',
    getCandidates: (vds, year) => {
      const is16T = vds.includes('DB') || vds.includes('21') || vds.includes('T2');
      const isOlder = year !== null && year <= 2020;

      if (isOlder) {
        return {
          modelRange: 'Chery Tiggo 2 / Tiggo 3 / Tiggo 4 / Arrizo 5 (2018–2020)',
          seriesSwitchWarning:
            'Série mixte Chine 2018–2020 : Chery a monté en parallèle Bosch ME17.8.8 (2 connecteurs) et Delphi MT62.1 / Magneti Marelli selon lot.',
          candidates: [
            {
              system: 'Moteur (ECM)',
              supplier: 'Bosch / UAES',
              ecuModel: 'ME17.8.8 (TriCore TC1728)',
              confidence: 'Moyenne (Série mixte CN)',
              protocol: 'UDS (ISO 14229) · CAN 500k',
              visualCheckTip: 'Boîtier aluminium nervuré avec étiquette "UAES / BOSCH" sous boîte à air.',
            },
            {
              system: 'Boîte (TCU)',
              supplier: 'Wanliyang / Punch',
              ecuModel: 'CVT18 / CVT25 TCU',
              confidence: 'Élevée',
              protocol: 'UDS CAN 500k',
              visualCheckTip: 'Connecteur rond ou rectangulaire sur carter supérieur boîte CVT.',
            },
          ],
        };
      }

      if (is16T) {
        return {
          modelRange: 'Chery Tiggo 8 Pro / Tiggo 7 Pro Max / Arrizo 8 (1.6 TGDI)',
          seriesSwitchWarning: null,
          candidates: [
            {
              system: 'Moteur (ECM)',
              supplier: 'Bosch',
              ecuModel: 'MG1US008 (AURIX TC275 / TC298)',
              confidence: 'Élevée',
              protocol: 'UDS + CAN-FD',
              visualCheckTip: 'Connecteur double haute densité sans soudure externe · Étiquette Bosch MG1US008.',
            },
            {
              system: 'Boîte (TCU)',
              supplier: 'Getrag / Magna',
              ecuModel: '7DCT300 Dual-Clutch TCU',
              confidence: 'Élevée',
              protocol: 'UDS CAN 500k',
              visualCheckTip: 'Calculateur mécatronique intégré sur face avant boîte 7DCT.',
            },
            {
              system: 'Freinage (ABS/ESP)',
              supplier: 'Bosch',
              ecuModel: 'ESP 9.3 (38 pins)',
              confidence: 'Élevée',
              protocol: 'UDS CAN',
              visualCheckTip: 'Bloc hydraulique gris estampillé BOSCH ESP 9.3 côté tablier droit.',
            },
          ],
        };
      }

      return {
        modelRange: 'Chery Tiggo 7 Pro / Tiggo 4 Pro / Omoda (1.5T SQRE4T15C)',
        seriesSwitchWarning:
          'Attention lots 2023–2026 : certaines séries CKD/export passent de MED17.8.10 (TC1782) à UAES UP6/MG1. Lire DID F187 en OBD2 avant flash.',
        candidates: [
          {
            system: 'Moteur (ECM)',
            supplier: 'Bosch / UAES',
            ecuModel: 'MED17.8.10 (Infineon TC1782)',
            confidence: 'Élevée',
            protocol: 'UDS (ISO 14229)',
            visualCheckTip: '2 connecteurs (94 + 60 broches) côté batterie · Marquage UAES / MED17.8.10.',
          },
          {
            system: 'Boîte (TCU)',
            supplier: 'Wanliyang (WLY)',
            ecuModel: 'CVT25 Gen-2 TCU (Continental/UAES)',
            confidence: 'Élevée',
            protocol: 'UDS CAN 500k',
            visualCheckTip: 'Rechercher prise 16 broches sur le dessus de boîte CVT25.',
          },
          {
            system: 'Habitacle (BCM)',
            supplier: 'Desay SV / Continental CN',
            ecuModel: 'BCM-Gateway Chery Lion OS',
            confidence: 'Élevée',
            protocol: 'UDS CAN-FD',
            visualCheckTip: 'Sous planche de bord côté conducteur au-dessus des pédales.',
          },
        ],
      };
    },
  },
  L6T: {
    manufacturer: 'Zhejiang Geely Holding Group (Chine)',
    brand: 'Geely',
    defaultModelRange: 'Geely Coolray / Cityray / Starray / Emgrand',
    getCandidates: (vds, year) => {
      const isCoolrayBattleOrNew = (year !== null && year >= 2024) || vds.includes('78') || vds.includes('5C');
      const isStarrayOrCityray = vds.includes('79') || vds.includes('8A') || vds.includes('6B');

      if (isStarrayOrCityray) {
        return {
          modelRange: 'Geely Cityray (Boyue L) / Starray / Monjaro (2024–2026)',
          seriesSwitchWarning:
            'Plateforme CMA/BMA Flyme Auto : distinguer 1.5TD (MED17.8.10) du 2.0TD Drive-E (Bosch MG1CS080) et ne JAMAIS croiser IHU Flyme Auto avec IHU624G/715P.',
          candidates: [
            {
              system: 'Moteur (ECM)',
              supplier: 'Bosch / UAES',
              ecuModel: 'MG1CS080 (2.0TD) ou MED17.8.10 (1.5TD)',
              confidence: 'Moyenne (Série mixte CN)',
              protocol: 'UDS / DoIP Ethernet',
              visualCheckTip: '2.0TD = Bosch MG1CS080 (TC298) ; 1.5TD = MED17.8.10.',
            },
            {
              system: 'Habitacle (BCM)',
              supplier: 'ECARX / SiEngine SE1000',
              ecuModel: 'Flyme Auto 2.5.0 Domain Cockpit',
              confidence: 'Élevée',
              protocol: 'DoIP + CAN-FD + eDP',
              visualCheckTip: 'Écran portrait/paysage sous Flyme OS.',
            },
          ],
        };
      }

      return {
        modelRange: isCoolrayBattleOrNew
          ? 'Geely Coolray Restylé / Battle Edition 2026 (1.5TD BHE15)'
          : 'Geely Coolray SX11 / GX3 / Emgrand (2020–2023)',
        seriesSwitchWarning:
          'Coolray DZ : 3 variantes IHU circulent (IHU624G, IHU715P, IHU535G). Toujours vérifier l’étiquette derrière l’écran ou via `getprop` (HARD_STOP croisement).',
        candidates: [
          {
            system: 'Moteur (ECM)',
            supplier: 'Bosch / UAES (ou Continental VD56 sur lots 2025+)',
            ecuModel: 'MED17.8.10 / BHE15-EFZ (TriCore TC1782/TC1793)',
            confidence: 'Élevée',
            protocol: 'UDS (ISO 14229) · CAN-FD',
            visualCheckTip: 'Étiquette UAES 103758xxxx près du filtre à air. Vérifier si Continental VD56 sur 4-cylindres BHE15 récent.',
          },
          {
            system: 'Boîte (TCU)',
            supplier: 'Ningbo Geely / Magna',
            ecuModel: '7DCT330 (Double Embrayage Humide)',
            confidence: 'Élevée',
            protocol: 'UDS CAN 500k',
            visualCheckTip: 'Mécatronique 7DCT sous bac batterie.',
          },
          {
            system: 'Freinage (ABS/ESP)',
            supplier: 'Bosch',
            ecuModel: 'ESP 9.3 Geely BMA',
            confidence: 'Élevée',
            protocol: 'UDS CAN',
            visualCheckTip: 'Bloc hydraulique Bosch 9.3 derrière cloche amortisseur.',
          },
        ],
      };
    },
  },
  LB3: {
    manufacturer: 'Geely Automobile (Usine Ningbo / Chengdu, Chine)',
    brand: 'Geely',
    defaultModelRange: 'Geely Coolray / Emgrand / Okavango',
    getCandidates: (vds, year) => CHINESE_WMI_REGISTRY.L6T.getCandidates(vds, year),
  },
  LSJ: {
    manufacturer: 'SAIC Motor Passenger Vehicle (MG / Roewe, Chine)',
    brand: 'MG',
    defaultModelRange: 'MG5 / MG GT / MG ZS / MG One / MG4',
    getCandidates: (vds, year) => {
      const isTurboOrOne = vds.includes('A') || vds.includes('B') || (year !== null && year >= 2023);
      return {
        modelRange: isTurboOrOne ? 'MG GT / MG One / MG5 Turbo (SAIC)' : 'MG5 / MG ZS 1.5L Atmosphérique',
        seriesSwitchWarning:
          'SAIC change fréquemment entre Bosch ME17.8.8 (atmo) et Continental / Bosch MG1UA008 sur les séries 1.5T MegaTech 2023–2026.',
        candidates: [
          {
            system: 'Moteur (ECM)',
            supplier: isTurboOrOne ? 'Bosch / Continental' : 'Bosch / UAES',
            ecuModel: isTurboOrOne ? 'MG1UA008 / MED17.8.10 (1.5T)' : 'ME17.8.8 / EMS3155 (1.5 NSE)',
            confidence: 'Moyenne (Série mixte CN)',
            protocol: 'UDS CAN 500k',
            visualCheckTip: 'Contrôler étiquette boîtier aluminium côté tablier gauche (ME17 vs MG1).',
          },
          {
            system: 'Boîte (TCU)',
            supplier: 'SAIC / Punch / Getrag',
            ecuModel: isTurboOrOne ? '7DCT280 Double Embrayage' : 'CVT180 / iCVT SAIC',
            confidence: 'Élevée',
            protocol: 'UDS CAN',
            visualCheckTip: '7DCT = 2 connecteurs mécatronique · CVT = faisceau supérieur.',
          },
          {
            system: 'Habitacle (BCM)',
            supplier: 'SAIC / United Automotive',
            ecuModel: 'BCM + Gateway iSMART',
            confidence: 'Élevée',
            protocol: 'UDS + DoIP (MG4/One)',
            visualCheckTip: 'Au-dessus de la boîte à fusibles habitacle gauche.',
          },
        ],
      };
    },
  },
  LZW: {
    manufacturer: 'SAIC-GM-Wuling / MG Export (Chine)',
    brand: 'MG',
    defaultModelRange: 'MG / Wuling / Chevrolet Captiva CN',
    getCandidates: (vds, year) => CHINESE_WMI_REGISTRY.LSJ.getCandidates(vds, year),
  },
  LGX: {
    manufacturer: 'BYD Auto Co., Ltd. (Xi’an / Shenzhen, Chine)',
    brand: 'BYD',
    defaultModelRange: 'BYD Song Plus DM-i / Atto 3 / Dolphin / Seal',
    getCandidates: (vds, year) => {
      const isEv = vds.includes('E') || vds.includes('4') || vds.includes('3');
      return {
        modelRange: isEv
          ? `BYD Atto 3 / Dolphin / Seal EV (${year || '2024–2026'})`
          : `BYD Song Plus / Qin Plus DM-i Hybride (${year || '2024–2026'})`,
        seriesSwitchWarning:
          'BYD DiLink 4.0/5.0 utilise un bus CAN-FD 2Mbps sécurisé par Gateway CGW : un adaptateur CAN classique sans support CAN-FD ne communiquera qu’avec le moteur thermique (sur DM-i).',
        candidates: [
          {
            system: 'Moteur (ECM)',
            supplier: 'BYD Electronics / Bosch (DM-i)',
            ecuModel: isEv ? 'BYD VCU + SiC Inverter MCU (e-Platform 3.0)' : 'BYD EHS DM-i VCU + ECM BYD472QA',
            confidence: 'Élevée',
            protocol: 'CAN-FD (2Mbps) + DoIP',
            visualCheckTip: 'Module contrôleur domaine central intégré sous capot avant ou sous console.',
          },
          {
            system: 'Freinage (ABS/ESP)',
            supplier: 'Bosch',
            ecuModel: 'Bosch IPB (Integrated Power Brake) / ESP9.3',
            confidence: 'Élevée',
            protocol: 'CAN-FD',
            visualCheckTip: 'Bloc Bosch IPB sans mastervac classique (freinage régénératif EV/DM-i).',
          },
          {
            system: 'Habitacle (BCM)',
            supplier: 'BYD DiLink',
            ecuModel: 'CGW + Écran Rotatif Qualcomm 8155',
            confidence: 'Élevée',
            protocol: 'DoIP Ethernet',
            visualCheckTip: 'Passerelle derrière boîte à gants.',
          },
        ],
      };
    },
  },
  LC0: {
    manufacturer: 'BYD Auto Industry Co., Ltd. (EV / Bus / Utilitaires)',
    brand: 'BYD',
    defaultModelRange: 'BYD Dolphin / Yuan Plus / e6',
    getCandidates: (vds, year) => CHINESE_WMI_REGISTRY.LGX.getCandidates(vds, year),
  },
  LVZ: {
    manufacturer: 'Dongfeng Sokon (DFSK / Seres / Fengon, Chine)',
    brand: 'DFSK',
    defaultModelRange: 'DFSK Glory 580 / Glory 500 / K01S / C31 / E5',
    getCandidates: (vds) => {
      const isUtility = vds.includes('K') || vds.includes('C') || vds.includes('D');
      if (isUtility) {
        return {
          modelRange: 'DFSK K01S / K02S / C31 / C35 Utilitaire',
          seriesSwitchWarning:
            'Sur utilitaires DFSK 1.2L/1.5L, Delphi MT22.1 et UAES M7.8 ont été montés selon l’année d’importation en Algérie.',
          candidates: [
            {
              system: 'Moteur (ECM)',
              supplier: 'Delphi / UAES',
              ecuModel: 'Delphi MT22.1 ou Bosch/UAES M7.8',
              confidence: 'Moyenne (Série mixte CN)',
              protocol: 'K-Line (ISO 9141) / CAN',
              visualCheckTip: 'MT22.1 = 2 connecteurs noirs parallèles · UAES M7.8 = 1 gros connecteur 81 pins.',
            },
          ],
        };
      }
      return {
        modelRange: 'DFSK Glory 580 / Fengon 500 / ix5 (SFG15T)',
        seriesSwitchWarning:
          'DFSK Glory 580 utilise soit Delphi MT62.1 (majoritaire DZ), soit Bosch MED17.8.10 sur séries 1.5T récentes.',
        candidates: [
          {
            system: 'Moteur (ECM)',
            supplier: 'Delphi (ou Bosch UAES)',
            ecuModel: 'Delphi MT62.1 / MT80 (2 connecteurs J1/J2)',
            confidence: 'Élevée',
            protocol: 'UDS CAN 500k',
            visualCheckTip: 'Boîtier Delphi étiquette blanche J1 (Noir) + J2 (Gris) derrière batterie.',
          },
          {
            system: 'Boîte (TCU)',
            supplier: 'Punch Powertrain',
            ecuModel: 'VT2 / VT3 CVT TCU',
            confidence: 'Élevée',
            protocol: 'UDS CAN',
            visualCheckTip: 'Calculateur TCU fixé sur tablier ou carter boîte CVT.',
          },
        ],
      };
    },
  },
  LSC: {
    manufacturer: 'Changan / DFSK Commercial Vehicles (Chine)',
    brand: 'DFSK',
    defaultModelRange: 'DFSK / Changan Star Utilitaire',
    getCandidates: (vds, year) => CHINESE_WMI_REGISTRY.LVZ.getCandidates(vds, year),
  },
};

export function decodeChineseVinEcu(rawVin: string): VinEcuDecodeResult {
  const vin = rawVin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const hasForbiddenChars = /[IOQ]/.test(vin);
  const isValidFormat = vin.length === 17 && !hasForbiddenChars;
  const wmi = vin.slice(0, 3);
  const vdsCode = vin.slice(3, 8);
  const yearChar = vin[9] || '';
  const plantCode = vin[10] || '—';
  const modelYear = VIN_YEAR_MAP[yearChar] ?? null;
  const checkDigitValid = isValidFormat ? validateVinCheckDigit(vin) : null;

  const entry = CHINESE_WMI_REGISTRY[wmi];
  if (!entry) {
    return {
      vin,
      isValidFormat,
      checkDigitValid,
      wmi: wmi || '---',
      manufacturer: 'Constructeur non répertorié dans base Chine DZ (vérifier WMI)',
      brand: 'Inconnu / Hors base CN',
      estimatedModelRange: 'Lecture directe OBD2 DID F187 / Étiquette ECU recommandée',
      modelYear,
      plantCode,
      vdsCode: vdsCode || '-----',
      seriesSwitchWarning:
        'WMI absent du référentiel Chery (LVV), Geely (L6T/LB3), MG (LSJ/LZW), BYD (LGX/LC0) ou DFSK (LVZ/LSC).',
      candidates: [
        {
          system: 'Moteur (ECM)',
          supplier: 'UAES / Bosch / Delphi (à confirmer)',
          ecuModel: 'Interroger OBD2 Mode 09 PID 04 ou UDS DID F187/F197',
          confidence: 'Moyenne (Série mixte CN)',
          protocol: 'UDS (ISO 14229)',
          visualCheckTip: 'Vérifier l’étiquette physique sur le boîtier calculateur sous le capot.',
        },
      ],
    };
  }

  const decoded = entry.getCandidates(vdsCode, modelYear);
  return {
    vin,
    isValidFormat,
    checkDigitValid,
    wmi,
    manufacturer: entry.manufacturer,
    brand: entry.brand,
    estimatedModelRange: decoded.modelRange,
    modelYear,
    plantCode,
    vdsCode,
    seriesSwitchWarning: decoded.seriesSwitchWarning,
    candidates: decoded.candidates,
  };
}
