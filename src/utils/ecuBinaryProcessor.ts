export type EcuVendor = 'Bosch' | 'Delphi' | 'Continental / Siemens' | 'Continental / UAES';

export interface EcuDetectionResult {
  valid: boolean;
  blockedReason: string | null;
  fileName: string;
  sizeBytes: number;
  sizeLabel: string;
  vendor: EcuVendor | null;
  family: string | null;
  softwareNumber: string | null;
  architecture: string | null;
  sha256: string;
  crc32Original: string;
  entropyBits: number;
  asciiMatches: string[];
  vehicleCategory: 'Chinois' | 'VAG' | 'Générique' | null;
}

export interface BinaryModificationEntry {
  addressHex: string;
  dtcCode: string;
  zone: string;
  oldHex: string;
  newHex: string;
  detail: string;
}

export interface LambdaDtcOffOptions {
  lambdaRearOff: boolean;
  catEfficiencyOff: boolean;
  manualDtcInput: string;
  allowAllMatches?: boolean;
}

export interface LambdaDtcOffResult {
  success: boolean;
  blockedReason: string | null;
  blockedUpstreamCodes: string[];
  originalSizeBytes: number;
  modifiedSizeBytes: number;
  sizeVerifiedExact: boolean;
  checksumStatus: string;
  crc32Before: string;
  crc32After: string;
  sha256Before: string;
  sha256After: string;
  outputFileName: string;
  modifications: BinaryModificationEntry[];
  modifiedBytes: Uint8Array | null;
  reportText: string;
}

interface EcuPatternRule {
  vendor: EcuVendor;
  family: string;
  vehicleCategory: 'Chinois' | 'VAG';
  architecture: string;
  keywords: string[];
  defaultSwPrefix: string;
}

const ECU_PATTERN_RULES: EcuPatternRule[] = [
  // VAG Bosch MED17 / MG1
  {
    vendor: 'Bosch',
    family: 'MED17.5.25',
    vehicleCategory: 'VAG',
    architecture: 'Infineon TriCore TC1782',
    keywords: ['MED17.5.25', 'MED17525', '04E906', '04E907'],
    defaultSwPrefix: '04E906027',
  },
  {
    vendor: 'Bosch',
    family: 'MED17.5.5',
    vehicleCategory: 'VAG',
    architecture: 'Infineon TriCore TC1766 / TC1767',
    keywords: ['MED17.5.5', 'MED1755', '03C906', '03C907'],
    defaultSwPrefix: '03C906016',
  },
  {
    vendor: 'Bosch',
    family: 'MED17.1.27',
    vehicleCategory: 'VAG',
    architecture: 'Infineon TriCore TC1793',
    keywords: ['MED17.1.27', 'MED17127', '04C906', '8V0906'],
    defaultSwPrefix: '04C906025',
  },
  {
    vendor: 'Bosch',
    family: 'MG1CS001',
    vehicleCategory: 'VAG',
    architecture: 'Infineon AURIX TC298',
    keywords: ['MG1CS001', '06K907', '06L907', '8W0907'],
    defaultSwPrefix: '06L907425',
  },
  {
    vendor: 'Bosch',
    family: 'MG1CS011',
    vehicleCategory: 'VAG',
    architecture: 'Infineon AURIX TC275 / TC298',
    keywords: ['MG1CS011', 'MG1CS111', '05E906', '05E907', '06N906'],
    defaultSwPrefix: '05E906018',
  },
  // VAG Continental / Siemens
  {
    vendor: 'Continental / Siemens',
    family: 'Simos 18.1',
    vehicleCategory: 'VAG',
    architecture: 'Infineon TriCore TC1791 / TC1793',
    keywords: ['SIMOS18', 'SIMOS 18', 'SC800', '5G0906', '06K906071'],
    defaultSwPrefix: '06K906071',
  },
  {
    vendor: 'Continental / Siemens',
    family: 'Simos 12',
    vehicleCategory: 'VAG',
    architecture: 'Infineon TriCore TC1797',
    keywords: ['SIMOS12', 'SIMOS 12', 'SC400', '06K906070'],
    defaultSwPrefix: '06K906070',
  },
  {
    vendor: 'Continental / Siemens',
    family: 'PCR2.1',
    vehicleCategory: 'VAG',
    architecture: 'Infineon TriCore TC1796',
    keywords: ['PCR2.1', 'PCR21', '03L906023', 'SM2E'],
    defaultSwPrefix: '03L906023',
  },
  // Véhicules Chinois Bosch / UAES
  {
    vendor: 'Bosch',
    family: 'MED17.8.10',
    vehicleCategory: 'Chinois',
    architecture: 'Infineon TriCore TC1782 / TC1793',
    keywords: ['MED17.8.10', 'MED17810', 'SQRE4T15', 'BHE15', 'F01R00D'],
    defaultSwPrefix: '1037564120',
  },
  {
    vendor: 'Bosch',
    family: 'ME17.8.8',
    vehicleCategory: 'Chinois',
    architecture: 'Infineon TriCore TC1728 / TC1767',
    keywords: ['ME17.8.8', 'ME1788', 'SFG15', '15C4E', 'F01RB0D'],
    defaultSwPrefix: '1037551904',
  },
  {
    vendor: 'Bosch',
    family: 'ME7.8.8',
    vehicleCategory: 'Chinois',
    architecture: 'ST10F275 / ST10F276',
    keywords: ['ME7.8.8', 'ME788', 'F01R0AD'],
    defaultSwPrefix: '1037518200',
  },
  {
    vendor: 'Bosch',
    family: 'M7.8',
    vehicleCategory: 'Chinois',
    architecture: 'ST10F275',
    keywords: ['M7.8', 'M78_', 'F01R00A'],
    defaultSwPrefix: '1037504100',
  },
  {
    vendor: 'Continental / UAES',
    family: 'UAES / Easy-U2.5',
    vehicleCategory: 'Chinois',
    architecture: 'Infineon TriCore / MPC563',
    keywords: ['UAES', 'EASY-U', 'CONTINENTAL', 'SIM2K'],
    defaultSwPrefix: 'UAES_CN_2025',
  },
  // Véhicules Chinois Delphi
  {
    vendor: 'Delphi',
    family: 'MT62.1',
    vehicleCategory: 'Chinois',
    architecture: 'NXP MPC5634 / SPC564',
    keywords: ['MT62.1', 'MT621', 'DELPHI_MT62'],
    defaultSwPrefix: '28612400',
  },
  {
    vendor: 'Delphi',
    family: 'MT22.1',
    vehicleCategory: 'Chinois',
    architecture: 'Freescale MC9S12XET256',
    keywords: ['MT22.1', 'MT221', 'DELPHI_MT22'],
    defaultSwPrefix: '28391044',
  },
  {
    vendor: 'Delphi',
    family: 'MT22U',
    vehicleCategory: 'Chinois',
    architecture: 'Freescale MC9S12XEP',
    keywords: ['MT22U', '282908'],
    defaultSwPrefix: '28290811',
  },
  {
    vendor: 'Delphi',
    family: 'MT20U',
    vehicleCategory: 'Chinois',
    architecture: 'Motorola MC9S12DT128',
    keywords: ['MT20U', 'MT20U2', 'DELPHI'],
    defaultSwPrefix: '28056100',
  },
];

// DTC strictement INTERDITS à masquer (Sonde Lambda Amont Bank 1/2 Sensor 1 - boucle AFR critique)
export const FORBIDDEN_UPSTREAM_DTC = new Set([
  'P0130',
  'P0131',
  'P0132',
  'P0133',
  'P0134',
  'P0135',
  'P0150',
  'P0151',
  'P0152',
  'P0153',
  'P0154',
  'P0155',
  'P2195',
  'P2196',
  'P2197',
  'P2198',
  'P2237',
  'P2243',
  'P2251',
  'P0030',
  'P0031',
  'P0032',
]);

export const REAR_LAMBDA_DTC_GROUP = ['P0136', 'P0137', 'P0138', 'P0139', 'P0140', 'P0141', 'P0036', 'P0037', 'P0038'];
export const CAT_EFFICIENCY_DTC_GROUP = ['P0420', 'P0430'];

// Standard CRC32 IEEE-802.3 lookup table
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32Hex(bytes: Uint8Array, start = 0, end = bytes.length): string {
  let crc = 0xffffffff;
  const safeEnd = Math.min(bytes.length, end);
  for (let i = Math.max(0, start); i < safeEnd; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const cleanCopy = new Uint8Array(bytes.byteLength);
  cleanCopy.set(bytes);
  const hashBuf = await crypto.subtle.digest('SHA-256', cleanCopy.buffer);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function calculateShannonEntropy(bytes: Uint8Array): number {
  const sampleLen = Math.min(bytes.length, 262144);
  if (sampleLen === 0) return 0;
  const freq = new Uint32Array(256);
  for (let i = 0; i < sampleLen; i++) {
    freq[bytes[i]]++;
  }
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (freq[i] === 0) continue;
    const p = freq[i] / sampleLen;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function extractAsciiChunks(bytes: Uint8Array): string {
  const maxScan = Math.min(bytes.length, 4 * 1024 * 1024);
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < maxScan; i++) {
    const b = bytes[i];
    chunk += b >= 32 && b <= 126 ? String.fromCharCode(b) : ' ';
    if (chunk.length >= 65536) {
      parts.push(chunk);
      chunk = '';
    }
  }
  if (chunk) parts.push(chunk);
  return parts.join('');
}

function formatSizeLabel(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} Mo (${sizeBytes.toLocaleString('fr-FR')} octets)`;
  }
  return `${Math.round(sizeBytes / 1024)} Ko (${sizeBytes.toLocaleString('fr-FR')} octets)`;
}

function extractSoftwareNumber(upperAscii: string, rule: EcuPatternRule): string {
  const swPatterns = [
    /\b1037[0-9]{6}\b/,
    /\b10SW[0-9A-Z]{6,10}\b/,
    /\b0[3456][A-Z0-9][0-9]{6}[A-Z]{0,3}\b/,
    /\b8[VY][0-9][0-9]{6}[A-Z]{0,3}\b/,
    /\bSC[48]00[0-9A-Z]{4,8}\b/,
    /\bF01R[0-9A-Z]{6,8}\b/,
    /\b28[0-9]{6}\b/,
    /\bSW[_:-]?([A-Z0-9._-]{6,16})\b/,
  ];
  for (const rx of swPatterns) {
    const m = upperAscii.match(rx);
    if (m) return m[1] || m[0];
  }
  return `${rule.defaultSwPrefix}_VER`;
}

/**
 * 1. IDENTIFICATION AUTOMATIQUE STRICTE (.bin / .ori)
 */
export async function inspectEcuBinary(buffer: ArrayBuffer, fileName: string): Promise<EcuDetectionResult> {
  const bytes = new Uint8Array(buffer);
  const sizeBytes = bytes.byteLength;
  const sizeLabel = formatSizeLabel(sizeBytes);
  const sha256 = sizeBytes > 0 ? await computeSha256Hex(bytes) : 'N/A';
  const crc32Original = sizeBytes > 0 ? computeCrc32Hex(bytes) : '00000000';

  if (sizeBytes < 128 * 1024) {
    return {
      valid: false,
      blockedReason: `Fichier trop petit ou tronqué (${sizeLabel}). Un dump ECU valide doit faire au moins 256 Ko à 4 Mo.`,
      fileName,
      sizeBytes,
      sizeLabel,
      vendor: null,
      family: null,
      softwareNumber: null,
      architecture: null,
      sha256,
      crc32Original,
      entropyBits: 0,
      asciiMatches: [],
      vehicleCategory: null,
    };
  }

  // Check compressed / proprietary encrypted container headers
  const headerAscii = String.fromCharCode(...Array.from(bytes.slice(0, Math.min(64, bytes.length))));
  const upperHeader = headerAscii.toUpperCase();
  if (
    (bytes[0] === 0x50 && bytes[1] === 0x4b) || // ZIP / FRF-like compressed container
    (bytes[0] === 0x1f && bytes[1] === 0x8b) || // GZIP
    upperHeader.startsWith('RAR!') ||
    upperHeader.includes('ALIENTECH') ||
    upperHeader.includes('KESS') ||
    upperHeader.includes('SLAVE') ||
    upperHeader.includes('CRYPT')
  ) {
    return {
      valid: false,
      blockedReason:
        'ALERTE ROUGE : Fichier compressé ou chiffré propriétaire détecté (ex. format Kess/Alientech Slave ou archive ZIP/FRF non décryptée). Traitement binaire bloqué.',
      fileName,
      sizeBytes,
      sizeLabel,
      vendor: null,
      family: null,
      softwareNumber: null,
      architecture: null,
      sha256,
      crc32Original,
      entropyBits: 8,
      asciiMatches: [],
      vehicleCategory: null,
    };
  }

  // Validate standard ECU memory alignment (exact multiple of 64 KB or standard 512KB / 1MB / 1.5MB / 2MB / 2.5MB / 4MB)
  const validPowerSizes = new Set([
    256 * 1024,
    512 * 1024,
    768 * 1024,
    1024 * 1024,
    1536 * 1024,
    2048 * 1024,
    2560 * 1024,
    3072 * 1024,
    4096 * 1024,
    8192 * 1024,
  ]);
  const isAligned = validPowerSizes.has(sizeBytes) || sizeBytes % 65536 === 0;
  if (!isAligned) {
    return {
      valid: false,
      blockedReason: `ALERTE ROUGE : Taille binaire atypique ou corrompue (${sizeLabel}). Un dump brut ECU doit correspondre exactement à la géométrie Flash (ex: 512 Ko, 1.5 Mo, 2 Mo, 4 Mo).`,
      fileName,
      sizeBytes,
      sizeLabel,
      vendor: null,
      family: null,
      softwareNumber: null,
      architecture: null,
      sha256,
      crc32Original,
      entropyBits: 0,
      asciiMatches: [],
      vehicleCategory: null,
    };
  }

  const entropyBits = calculateShannonEntropy(bytes);
  const ascii = extractAsciiChunks(bytes);
  const upperAscii = ascii.toUpperCase();

  let matchedRule: EcuPatternRule | null = null;
  const asciiMatches: string[] = [];

  for (const rule of ECU_PATTERN_RULES) {
    const hits = rule.keywords.filter((kw) => upperAscii.includes(kw));
    if (hits.length > 0) {
      asciiMatches.push(...hits);
      if (!matchedRule) {
        matchedRule = rule;
      }
    }
  }

  if (entropyBits > 7.94 && asciiMatches.length === 0) {
    return {
      valid: false,
      blockedReason: `ALERTE ROUGE : Entropie très élevée (${entropyBits.toFixed(2)} bits/octet) sans signature ASCII lisible — fichier chiffré ou compressé non décrypté.`,
      fileName,
      sizeBytes,
      sizeLabel,
      vendor: null,
      family: null,
      softwareNumber: null,
      architecture: null,
      sha256,
      crc32Original,
      entropyBits,
      asciiMatches: [],
      vehicleCategory: null,
    };
  }

  if (!matchedRule) {
    return {
      valid: false,
      blockedReason:
        'ALERTE ROUGE : Calculateur non reconnu dans les chaînes ASCII (Bosch ME17/MED17/MG1, Delphi MTxx ou Continental Simos/UAES non détecté). Écriture bloquée par sécurité.',
      fileName,
      sizeBytes,
      sizeLabel,
      vendor: null,
      family: null,
      softwareNumber: null,
      architecture: null,
      sha256,
      crc32Original,
      entropyBits,
      asciiMatches: [],
      vehicleCategory: null,
    };
  }

  const softwareNumber = extractSoftwareNumber(upperAscii, matchedRule);

  return {
    valid: true,
    blockedReason: null,
    fileName,
    sizeBytes,
    sizeLabel,
    vendor: matchedRule.vendor,
    family: matchedRule.family,
    softwareNumber,
    architecture: matchedRule.architecture,
    sha256,
    crc32Original,
    entropyBits,
    asciiMatches: Array.from(new Set(asciiMatches)),
    vehicleCategory: matchedRule.vehicleCategory,
  };
}

/**
 * Parse and validate OBD-II DTC codes (e.g. P0420 -> { prefixBits: 0x0, numeric: 0x0420 })
 */
function parseDtcToWord(dtc: string): { code: string; hi: number; lo: number } | null {
  const clean = dtc.trim().toUpperCase();
  const match = clean.match(/^([PCBU])([0-9A-F]{4})$/);
  if (!match) return null;
  const prefixMap: Record<string, number> = { P: 0x00, C: 0x40, B: 0x80, U: 0xc0 };
  const val = parseInt(match[2], 16);
  const hi = (prefixMap[match[1]] | ((val >> 8) & 0x3f)) & 0xff;
  const lo = val & 0xff;
  return { code: clean, hi, lo };
}

/**
 * 2. TRAITEMENT SÉCURISÉ (LAMBDA AVAL / CAT / DTC TABLE MASKING)
 * Passe uniquement l'octet Error Class adjacent à 0x00 sans JAMAIS décaler les adresses.
 */
export async function applyLambdaAndDtcOff(
  originalBytes: Uint8Array,
  detection: EcuDetectionResult,
  options: LambdaDtcOffOptions
): Promise<LambdaDtcOffResult> {
  if (!detection.valid || !detection.family || !detection.vendor) {
    return {
      success: false,
      blockedReason: detection.blockedReason || 'ECU non identifié — opération bloquée.',
      blockedUpstreamCodes: [],
      originalSizeBytes: originalBytes.byteLength,
      modifiedSizeBytes: originalBytes.byteLength,
      sizeVerifiedExact: true,
      checksumStatus: 'Opération annulée',
      crc32Before: detection.crc32Original,
      crc32After: detection.crc32Original,
      sha256Before: detection.sha256,
      sha256After: detection.sha256,
      outputFileName: '',
      modifications: [],
      modifiedBytes: null,
      reportText: '',
    };
  }

  // Build requested DTC target list
  const requestedSet = new Set<string>();
  if (options.lambdaRearOff) {
    REAR_LAMBDA_DTC_GROUP.forEach((d) => requestedSet.add(d));
  }
  if (options.catEfficiencyOff) {
    CAT_EFFICIENCY_DTC_GROUP.forEach((d) => requestedSet.add(d));
  }

  const manualTokens = options.manualDtcInput
    .split(/[\s,;]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  // HARD GUARD: Never allow masking Bank 1 / Bank 2 Sensor 1 Upstream Lambda (AFR)
  const blockedUpstreamCodes = manualTokens.filter((code) => FORBIDDEN_UPSTREAM_DTC.has(code));
  if (blockedUpstreamCodes.length > 0) {
    return {
      success: false,
      blockedReason: `INTERDICTION CRITIQUE MOTEUR : Tentative de suppression de sonde lambda AMONT / AFR (${blockedUpstreamCodes.join(', ')}). La sonde Sensor 1 régule la richesse air/carburant : sa suppression provoque surconsommation et casse catalyseur/piston.`,
      blockedUpstreamCodes,
      originalSizeBytes: originalBytes.byteLength,
      modifiedSizeBytes: originalBytes.byteLength,
      sizeVerifiedExact: true,
      checksumStatus: 'Bloqué par sécurité AFR',
      crc32Before: detection.crc32Original,
      crc32After: detection.crc32Original,
      sha256Before: detection.sha256,
      sha256After: detection.sha256,
      outputFileName: '',
      modifications: [],
      modifiedBytes: null,
      reportText: '',
    };
  }

  manualTokens.forEach((t) => requestedSet.add(t));

  if (requestedSet.size === 0) {
    return {
      success: false,
      blockedReason: 'Sélectionnez au moins une option (Sonde Aval, Catalyseur P0420/P0430) ou saisissez un DTC valide.',
      blockedUpstreamCodes: [],
      originalSizeBytes: originalBytes.byteLength,
      modifiedSizeBytes: originalBytes.byteLength,
      sizeVerifiedExact: true,
      checksumStatus: 'Aucune cible sélectionnée',
      crc32Before: detection.crc32Original,
      crc32After: detection.crc32Original,
      sha256Before: detection.sha256,
      sha256After: detection.sha256,
      outputFileName: '',
      modifications: [],
      modifiedBytes: null,
      reportText: '',
    };
  }

  const parsedTargets = Array.from(requestedSet)
    .map(parseDtcToWord)
    .filter((x): x is { code: string; hi: number; lo: number } => x !== null);

  // Clone original bytes so original stays 100% untouched in memory
  const patched = new Uint8Array(originalBytes.byteLength);
  patched.set(originalBytes);

  const modifications: BinaryModificationEntry[] = [];
  const modifiedOffsets = new Set<number>();
  const claimedWordOffsets = new Set<number>();

  // Scan immutable originalBytes for DTC table entries so a patched byte never creates a shifted false match:
  // Pattern A (BE): [DTC_HI][DTC_LO][ERROR_CLASS != 0x00][FLAGS]
  // Pattern B (LE): [DTC_LO][DTC_HI][ERROR_CLASS != 0x00][FLAGS]
  for (let i = 0; i <= originalBytes.length - 4; i++) {
    if (claimedWordOffsets.has(i) || claimedWordOffsets.has(i + 1)) continue;

    for (const target of parsedTargets) {
      // Big-endian match [hi, lo]
      if (originalBytes[i] === target.hi && originalBytes[i + 1] === target.lo) {
        const hasDtcTableContext =
          (i >= 4 && originalBytes[i - 4] <= 0xdf && (originalBytes[i - 2] <= 0x20 || originalBytes[i - 1] <= 0x20)) ||
          (i + 6 < originalBytes.length &&
            (originalBytes[i + 4] === 0x00 ||
              originalBytes[i + 4] === 0x04 ||
              originalBytes[i + 4] === 0x01 ||
              originalBytes[i + 4] === 0x20));

        const errClassOffset = i + 2;
        const currentClass = originalBytes[errClassOffset];
        if (hasDtcTableContext && currentClass > 0x00 && currentClass <= 0x1f && !modifiedOffsets.has(errClassOffset)) {
          const oldHex = `0x${currentClass.toString(16).toUpperCase().padStart(2, '0')}`;
          patched[errClassOffset] = 0x00;
          modifiedOffsets.add(errClassOffset);
          claimedWordOffsets.add(i);
          claimedWordOffsets.add(i + 1);
          modifications.push({
            addressHex: `0x${errClassOffset.toString(16).toUpperCase().padStart(6, '0')}`,
            dtcCode: target.code,
            zone: `${detection.family} DTC Error Class Table (BE)`,
            oldHex,
            newHex: '0x00',
            detail: `Masquage classe erreur ${target.code} -> 0x00 sans décalage mémoire`,
          });
          break;
        }
      }

      // Little-endian match [lo, hi] (common in TriCore TC17xx / Delphi MTxx)
      if (originalBytes[i] === target.lo && originalBytes[i + 1] === target.hi) {
        const hasLeTableContext =
          (i >= 4 && originalBytes[i - 3] <= 0x3f && originalBytes[i - 1] <= 0x1f) ||
          (i + 4 < originalBytes.length &&
            originalBytes[i + 2] > 0x00 &&
            originalBytes[i + 2] <= 0x1f &&
            originalBytes[i + 3] <= 0x04);

        const errClassOffset = i + 2;
        const currentClass = originalBytes[errClassOffset];
        if (hasLeTableContext && currentClass > 0x00 && currentClass <= 0x1f && !modifiedOffsets.has(errClassOffset)) {
          const oldHex = `0x${currentClass.toString(16).toUpperCase().padStart(2, '0')}`;
          patched[errClassOffset] = 0x00;
          modifiedOffsets.add(errClassOffset);
          claimedWordOffsets.add(i);
          claimedWordOffsets.add(i + 1);
          modifications.push({
            addressHex: `0x${errClassOffset.toString(16).toUpperCase().padStart(6, '0')}`,
            dtcCode: target.code,
            zone: `${detection.family} DTC Error Class Table (LE)`,
            oldHex,
            newHex: '0x00',
            detail: `Masquage classe erreur ${target.code} -> 0x00 (Little-Endian TriCore)`,
          });
          break;
        }
      }
    }
  }

  // Strict size check (must be identical to the bit)
  const sizeVerifiedExact = patched.byteLength === originalBytes.byteLength;
  if (!sizeVerifiedExact) {
    return {
      success: false,
      blockedReason: 'ERREUR FATALE ANTI-BRICK : La taille du fichier modifié diffère de l’original.',
      blockedUpstreamCodes: [],
      originalSizeBytes: originalBytes.byteLength,
      modifiedSizeBytes: patched.byteLength,
      sizeVerifiedExact: false,
      checksumStatus: 'Erreur intégrité taille',
      crc32Before: detection.crc32Original,
      crc32After: detection.crc32Original,
      sha256Before: detection.sha256,
      sha256After: detection.sha256,
      outputFileName: '',
      modifications: [],
      modifiedBytes: null,
      reportText: '',
    };
  }

  const crc32After = computeCrc32Hex(patched);
  const sha256After = await computeSha256Hex(patched);

  const baseName = detection.fileName.replace(/\.(bin|ori|mod)$/i, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const cleanEcu = detection.family.replace(/[^a-zA-Z0-9.-]/g, '');
  const cleanSw = (detection.softwareNumber || 'SW').replace(/[^a-zA-Z0-9._-]/g, '');
  const outputFileName = `${baseName}_${cleanEcu}_${cleanSw}_LambdaOff_NoCS.bin`;

  const checksumStatus =
    'Checksum Non Corrigé - À corriger impérativement par l\'outil d\'écriture PCMflash / Flex / Autotuner / Kess3';

  const reportLines = [
    '========================================================================',
    '  AUTOPRO FLASH & DIAGNOSTIC HUB — RAPPORT LAMBDA OFF / DTC OFF (.BIN)',
    '========================================================================',
    `Date           : ${new Date().toLocaleString('fr-FR')}`,
    `Fichier Source : ${detection.fileName} (${detection.sizeLabel})`,
    `Calculateur    : ${detection.vendor} ${detection.family} (${detection.architecture})`,
    `N° Software SW : ${detection.softwareNumber}`,
    `Taille Avant   : ${originalBytes.byteLength} octets`,
    `Taille Après   : ${patched.byteLength} octets (Identique au bit près : OUI)`,
    `CRC32 Origine  : 0x${detection.crc32Original}`,
    `CRC32 Modifié  : 0x${crc32After}`,
    `SHA-256 Avant  : ${detection.sha256}`,
    `SHA-256 Après  : ${sha256After}`,
    `Statut Checksum: ${checksumStatus}`,
    '------------------------------------------------------------------------',
    `Modifications appliquées (${modifications.length} adresse(s)) :`,
    ...(modifications.length > 0
      ? modifications.map(
          (m) => `  • ${m.addressHex} | ${m.dtcCode} | ${m.oldHex} -> ${m.newHex} | ${m.zone}`
        )
      : [
          '  ⚠️ Aucune structure Error Class DTC standard détectée sur ce dump spécifique.',
          '  Aucun octet modifié à l’aveugle afin de garantir 0% risque de briquage.',
        ]),
    '========================================================================',
  ];

  return {
    success: true,
    blockedReason: null,
    blockedUpstreamCodes: [],
    originalSizeBytes: originalBytes.byteLength,
    modifiedSizeBytes: patched.byteLength,
    sizeVerifiedExact,
    checksumStatus,
    crc32Before: detection.crc32Original,
    crc32After,
    sha256Before: detection.sha256,
    sha256After,
    outputFileName,
    modifications,
    modifiedBytes: patched,
    reportText: reportLines.join('\n'),
  };
}

/**
 * Génère un dump binaire réaliste de démonstration atelier (2 Mo) en mémoire
 * pour valider la détection ASCII + table DTC + masquage Error Class 0x00 + CRC32.
 */
export function createWorkshopSampleEcuBinary(preset: 'vag_med17525' | 'chinese_me1788' | 'vag_simos18'): {
  fileName: string;
  buffer: ArrayBuffer;
} {
  const size = 2 * 1024 * 1024; // 2 Mo exact (TriCore)
  const buf = new Uint8Array(size);
  buf.fill(0xff);

  const encoder = new TextEncoder();
  let headerStr = '';
  let fileName = '';

  if (preset === 'vag_med17525') {
    fileName = 'VW_TRoc_14TSI_Original.bin';
    headerStr = 'BOSCH MED17.5.25 TC1782 SW:04E906027CN 1037562210 VW_MQB_TROC_2024';
  } else if (preset === 'chinese_me1788') {
    fileName = 'Geely_Chery_15L_Original.bin';
    headerStr = 'BOSCH ME17.8.8 TC1728 UAES F01RB0D210 SW:1037551904 GEELY_CHERY_CN';
  } else {
    fileName = 'VW_Golf_GTI_Simos18_Original.bin';
    headerStr = 'CONTINENTAL SIMOS18.1 TC1791 SC800 SW:06K906071CN VW_GOLF_VAG';
  }

  buf.set(encoder.encode(headerStr), 0x000100);

  // Build structured DTC Error Class table at 0x180000
  const marker = encoder.encode('DTC_TBL_V1');
  buf.set(marker, 0x17fff0);

  const sampleDtcs: Array<{ dtc: string; errClass: number; flags: number }> = [
    { dtc: 'P0136', errClass: 0x04, flags: 0x01 },
    { dtc: 'P0137', errClass: 0x04, flags: 0x01 },
    { dtc: 'P0138', errClass: 0x04, flags: 0x01 },
    { dtc: 'P0140', errClass: 0x08, flags: 0x01 },
    { dtc: 'P0141', errClass: 0x08, flags: 0x01 },
    { dtc: 'P0420', errClass: 0x03, flags: 0x01 },
    { dtc: 'P0430', errClass: 0x03, flags: 0x01 },
    // Include an upstream Sensor 1 code to prove it is never touched automatically
    { dtc: 'P0131', errClass: 0x05, flags: 0x01 },
  ];

  let offset = 0x180000;
  for (const item of sampleDtcs) {
    const word = parseDtcToWord(item.dtc);
    if (!word) continue;
    buf[offset] = word.hi;
    buf[offset + 1] = word.lo;
    buf[offset + 2] = item.errClass;
    buf[offset + 3] = 0x01;
    buf[offset + 4] = item.flags;
    buf[offset + 5] = 0x00;
    offset += 8;
  }

  return { fileName, buffer: buf.buffer };
}
