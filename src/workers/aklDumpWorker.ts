/* Web Worker isolé pour l'analyse non-bloquante de Dumps EEPROM / MCU / Flash TriCore */
import type {
  AklDumpAnalysisResult,
  AklDumpChecksums,
  AklHexPreviewRow,
} from '../types/automotive';

interface WorkerAnalyzeRequest {
  requestId: string;
  action: 'ANALYZE' | 'PREPARE_EXPORT';
  fileName: string;
  buffer: ArrayBuffer;
  geometryId: string;
  geometryLabel: string;
  expectedSizeBytes: number;
  cryptoPlugSlot: string;
}

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

async function computeChecksumsWithDataView(buffer: ArrayBuffer): Promise<AklDumpChecksums> {
  const view = new DataView(buffer);
  const len = view.byteLength;
  let crc = 0xffffffff;
  let sum16 = 0;
  let sum8 = 0;

  for (let i = 0; i < len; i++) {
    const byte = view.getUint8(i);
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    sum8 = (sum8 + byte) & 0xff;
  }

  for (let i = 0; i + 1 < len; i += 2) {
    sum16 = (sum16 + view.getUint16(i, false)) & 0xffff;
  }

  let sha256Hex = 'NON_DISPONIBLE';
  try {
    if (self.crypto?.subtle) {
      const digest = await self.crypto.subtle.digest('SHA-256', buffer);
      sha256Hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    }
  } catch {
    sha256Hex = 'NON_DISPONIBLE';
  }

  return {
    crc32Hex: ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0'),
    sum16Hex: sum16.toString(16).toUpperCase().padStart(4, '0'),
    sum8Hex: sum8.toString(16).toUpperCase().padStart(2, '0'),
    sha256Hex,
  };
}

/**
 * Parseur Intel HEX (.hex) strict avec vérification du checksum de chaque ligne.
 */
function parseIntelHexStrict(text: string): { ok: true; buffer: ArrayBuffer } | { ok: false; error: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0 || !lines[0].startsWith(':')) {
    return { ok: false, error: 'Format Intel HEX invalide : enregistrement ":" manquant.' };
  }

  const chunks: Array<{ addr: number; data: number[] }> = [];
  let upperBase = 0;
  let maxEnd = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line.startsWith(':')) {
      return { ok: false, error: `Ligne ${lineIdx + 1} invalide dans le fichier .hex.` };
    }
    const hexStr = line.slice(1);
    if (hexStr.length < 10 || hexStr.length % 2 !== 0 || !/^[0-9A-Fa-f]+$/.test(hexStr)) {
      return { ok: false, error: `Caractères hexadécimaux corrompus à la ligne ${lineIdx + 1}.` };
    }

    const recordBytes: number[] = [];
    let checkSumAcc = 0;
    for (let i = 0; i < hexStr.length; i += 2) {
      const val = parseInt(hexStr.slice(i, i + 2), 16);
      recordBytes.push(val);
      checkSumAcc = (checkSumAcc + val) & 0xff;
    }

    if (checkSumAcc !== 0) {
      return {
        ok: false,
        error: `Checksum Intel HEX corrompu à la ligne ${lineIdx + 1}. Fichier rejeté par sécurité Anti-Brick.`,
      };
    }

    const byteCount = recordBytes[0];
    const addr16 = (recordBytes[1] << 8) | recordBytes[2];
    const recType = recordBytes[3];
    if (recordBytes.length !== byteCount + 5) {
      return { ok: false, error: `Longueur d’enregistrement incohérente à la ligne ${lineIdx + 1}.` };
    }

    if (recType === 0x00) {
      const absAddr = upperBase + addr16;
      const payload = recordBytes.slice(4, 4 + byteCount);
      chunks.push({ addr: absAddr, data: payload });
      if (absAddr + payload.length > maxEnd) maxEnd = absAddr + payload.length;
    } else if (recType === 0x01) {
      break;
    } else if (recType === 0x04 && byteCount === 2) {
      upperBase = ((recordBytes[4] << 8) | recordBytes[5]) << 16;
    } else if (recType === 0x02 && byteCount === 2) {
      upperBase = ((recordBytes[4] << 8) | recordBytes[5]) << 4;
    }
  }

  if (maxEnd === 0 || maxEnd > 16 * 1024 * 1024) {
    return {
      ok: false,
      error: 'Plage d’adresse Intel HEX vide ou hors limites (> 16 Mo).',
    };
  }

  const out = new Uint8Array(maxEnd);
  out.fill(0xff);
  for (const c of chunks) {
    out.set(c.data, c.addr);
  }
  return { ok: true, buffer: out.buffer };
}

function calculateEntropyWithDataView(view: DataView): number {
  const sampleLen = Math.min(view.byteLength, 262144);
  if (sampleLen === 0) return 0;
  const freq = new Uint32Array(256);
  for (let i = 0; i < sampleLen; i++) {
    freq[view.getUint8(i)]++;
  }
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (freq[i] === 0) continue;
    const p = freq[i] / sampleLen;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(3));
}

function extractVerifiableAscii(view: DataView): {
  vin: string | null;
  hwRefs: string[];
} {
  const scanLen = Math.min(view.byteLength, 2 * 1024 * 1024);
  let ascii = '';
  for (let i = 0; i < scanLen; i++) {
    const c = view.getUint8(i);
    ascii += c >= 32 && c <= 126 ? String.fromCharCode(c) : ' ';
  }

  const vinMatch = ascii.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  const refMatches = ascii.match(
    /\b(?:CONTINENTAL|JOHNSON|MARELLI|DELPHI|VALEO|SIEMENS|BOSCH|UAES|RENESAS|F01R[A-Z0-9]{4,8}|1037[0-9]{6}|10SW[A-Z0-9]{6}|96[0-9]{8}|98[0-9]{8}|28[0-9]{6}|A2C[0-9]{6,10})\b/gi
  );

  return {
    vin: vinMatch ? vinMatch[0] : null,
    hwRefs: Array.from(new Set((refMatches || []).map((r) => r.toUpperCase()))).slice(0, 8),
  };
}

function buildHexPreview(view: DataView, maxRows = 12): AklHexPreviewRow[] {
  const rows: AklHexPreviewRow[] = [];
  const totalBytes = Math.min(view.byteLength, maxRows * 16);

  for (let offset = 0; offset < totalBytes; offset += 16) {
    const hexBytes: string[] = [];
    let asciiText = '';
    for (let j = 0; j < 16 && offset + j < totalBytes; j++) {
      const b = view.getUint8(offset + j);
      hexBytes.push(b.toString(16).toUpperCase().padStart(2, '0'));
      asciiText += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
    }
    rows.push({
      offsetHex: `0x${offset.toString(16).toUpperCase().padStart(6, '0')}`,
      hexBytes,
      asciiText,
    });
  }
  return rows;
}

self.onmessage = async (event: MessageEvent<WorkerAnalyzeRequest>) => {
  const req = event.data;
  const { requestId, fileName, geometryId, geometryLabel, expectedSizeBytes, cryptoPlugSlot } = req;

  try {
    let workingBuffer = req.buffer;
    const extUpper = (fileName.split('.').pop() || 'BIN').toUpperCase();
    const fileFormat: 'BIN' | 'EEP' | 'HEX' =
      extUpper === 'HEX' ? 'HEX' : extUpper === 'EEP' ? 'EEP' : 'BIN';

    if (fileFormat === 'HEX') {
      const decodedText = new TextDecoder('utf-8').decode(workingBuffer);
      const parsedHex = parseIntelHexStrict(decodedText);
      if (!parsedHex.ok) {
        const failRes: AklDumpAnalysisResult = {
          success: false,
          blockedReason: parsedHex.error,
          fileName,
          fileFormat,
          geometryId,
          geometryLabel,
          expectedSizeBytes,
          actualSizeBytes: workingBuffer.byteLength,
          sizeMatchesGeometry: false,
          checksumBefore: {
            crc32Hex: '00000000',
            sum16Hex: '0000',
            sum8Hex: '00',
            sha256Hex: 'N/A',
          },
          checksumAfter: null,
          entropyBits: 0,
          extractedVin: null,
          extractedHardwareRefs: [],
          keySlotObservation: 'Analyse annulée (Intel HEX invalide).',
          cryptoTableStatus: 'Bloqué',
          hexPreviewRows: [],
          backupFileName: '',
          readyFileName: '',
          analyzedAt: new Date().toLocaleTimeString('fr-FR'),
        };
        self.postMessage({ requestId, result: failRes });
        return;
      }
      workingBuffer = parsedHex.buffer;
    }

    const view = new DataView(workingBuffer);
    const actualSizeBytes = view.byteLength;
    const sizeMatchesGeometry = actualSizeBytes === expectedSizeBytes;
    const checksumBefore = await computeChecksumsWithDataView(workingBuffer);
    const entropyBits = calculateEntropyWithDataView(view);
    const { vin, hwRefs } = extractVerifiableAscii(view);
    const hexPreviewRows = buildHexPreview(view, 12);

    const isBlankDump = entropyBits < 0.05;
    let blockedReason: string | null = null;

    if (!sizeMatchesGeometry) {
      blockedReason = `TAILLE BINAIRE INVALIDE ANTI-BRICK : Reçu ${actualSizeBytes.toLocaleString('fr-FR')} octets au lieu des ${expectedSizeBytes.toLocaleString('fr-FR')} octets exacts attendus pour ${geometryLabel}. Export et écriture strictement bloqués.`;
    } else if (isBlankDump) {
      blockedReason = `DUMP VIERGE OU MAUVAIS CONTACT PINCE (Entropie = ${entropyBits} bits) : Le fichier ne contient quasi qu’une seule valeur répétée (0xFF ou 0x00). Relisez la puce EEPROM/MCU avant toute procédure AKL.`;
    }

    const baseSafeName = fileName
      .replace(/\.(bin|eep|hex|ori)$/i, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `${baseSafeName}_ORIGINAL_BACKUP_${stamp}.bin`;
    const readyFileName = `${baseSafeName}_AKL_READY.bin`;

    // Sur PREPARE_EXPORT : création d'une copie exacte vérifiée bit-à-bit sans injection fictive
    let checksumAfter: AklDumpChecksums | null = null;
    let exportBuffer: ArrayBuffer | undefined;
    if (!blockedReason && req.action === 'PREPARE_EXPORT') {
      const exportCopy = new Uint8Array(actualSizeBytes);
      exportCopy.set(new Uint8Array(workingBuffer));
      checksumAfter = await computeChecksumsWithDataView(exportCopy.buffer);
      exportBuffer = exportCopy.buffer;
    }

    const result: AklDumpAnalysisResult = {
      success: blockedReason === null,
      blockedReason,
      fileName,
      fileFormat,
      geometryId,
      geometryLabel,
      expectedSizeBytes,
      actualSizeBytes,
      sizeMatchesGeometry,
      checksumBefore,
      checksumAfter,
      entropyBits,
      extractedVin: vin,
      extractedHardwareRefs: hwRefs,
      keySlotObservation: vin
        ? `VIN ASCII vérifiable détecté (${vin}). Statut individuel des emplacements clés chiffré — requiert table cryptographique OEM (${cryptoPlugSlot}).`
        : 'Structure binaire validée (entropie conforme). Les emplacements clés et codes PIN/CS restent chiffrés tant qu’aucune table OEM n’est raccordée.',
      cryptoTableStatus:
        'Mode Zéro-Invention Actif : Aucune donnée PIN/CS factice générée. Plug-in prêt sur ' + cryptoPlugSlot,
      hexPreviewRows,
      backupFileName,
      readyFileName,
      analyzedAt: new Date().toLocaleTimeString('fr-FR'),
    };

    if (exportBuffer) {
      self.postMessage({ requestId, result, binaryCopy: workingBuffer, exportBuffer }, {
        transfer: [workingBuffer, exportBuffer],
      });
    } else {
      self.postMessage({ requestId, result, binaryCopy: workingBuffer }, {
        transfer: [workingBuffer],
      });
    }
  } catch (err: any) {
    const errRes: AklDumpAnalysisResult = {
      success: false,
      blockedReason: err?.message || 'Erreur inattendue lors de l’analyse Web Worker.',
      fileName,
      fileFormat: 'BIN',
      geometryId,
      geometryLabel,
      expectedSizeBytes,
      actualSizeBytes: 0,
      sizeMatchesGeometry: false,
      checksumBefore: { crc32Hex: '00000000', sum16Hex: '0000', sum8Hex: '00', sha256Hex: 'N/A' },
      checksumAfter: null,
      entropyBits: 0,
      extractedVin: null,
      extractedHardwareRefs: [],
      keySlotObservation: 'Échec analyse',
      cryptoTableStatus: 'Erreur Worker',
      hexPreviewRows: [],
      backupFileName: '',
      readyFileName: '',
      analyzedAt: new Date().toLocaleTimeString('fr-FR'),
    };
    self.postMessage({ requestId, result: errRes });
  }
};
