import { AklDumpAnalysisResult, EepromGeometryProfile } from '../types/automotive';
import { apiFetch } from './apiBridge';

export async function runAklDumpWorker(params: {
  action: 'ANALYZE' | 'PREPARE_EXPORT';
  fileName: string;
  buffer: ArrayBuffer;
  geometry: EepromGeometryProfile;
  cryptoPlugSlot: string;
}): Promise<{
  result: AklDumpAnalysisResult;
  binaryBytes: Uint8Array | null;
  exportBytes: Uint8Array | null;
}> {
  const { action, fileName, buffer, geometry, cryptoPlugSlot } = params;
  // Clone the input buffer so transfer into Worker leaves caller intact only when needed
  const cloned = buffer.slice(0);

  return new Promise((resolve, reject) => {
    let settled = false;
    let worker: Worker | null = null;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        worker?.terminate();
      } catch {
        // Ignore terminate errors
      }
      reject(new Error('Délai d’analyse Web Worker dépassé (> 12s). Vérifiez la taille du fichier.'));
    }, 12000);

    try {
      worker = new Worker(new URL('../workers/aklDumpWorker.ts', import.meta.url), {
        type: 'module',
      });

      const requestId = `AKL-${Date.now()}`;
      worker.onmessage = (ev: MessageEvent<any>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        const payload = ev.data || {};
        try {
          worker?.terminate();
        } catch {
          // Ignore cleanup
        }
        resolve({
          result: payload.result as AklDumpAnalysisResult,
          binaryBytes: payload.binaryCopy ? new Uint8Array(payload.binaryCopy) : null,
          exportBytes: payload.exportBuffer ? new Uint8Array(payload.exportBuffer) : null,
        });
      };

      worker.onerror = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        try {
          worker?.terminate();
        } catch {
          // Ignore cleanup
        }
        reject(new Error(err.message || 'Erreur interne du Web Worker binaire.'));
      };

      worker.postMessage(
        {
          requestId,
          action,
          fileName,
          buffer: cloned,
          geometryId: geometry.id,
          geometryLabel: geometry.label,
          expectedSizeBytes: geometry.exactSizeBytes,
          cryptoPlugSlot,
        },
        [cloned]
      );
    } catch (err: any) {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        reject(new Error(err?.message || 'Impossible de démarrer le Web Worker binaire.'));
      }
    }
  });
}

export async function verifyAklDumpOnServer(payload: {
  procedureId: string;
  fileName: string;
  geometryId: string;
  actualSizeBytes: number;
  sha256Before: string;
  crc32Before: string;
  extractedVin: string | null;
}): Promise<{ ok: boolean; message: string; serverSlotNote: string }> {
  try {
    const res = await apiFetch('/api/immo/akl/verify-dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return {
      ok: res.ok && Boolean(data.success),
      message: String(data.message || data.error || 'Vérification serveur terminée.'),
      serverSlotNote: String(data.serverSlotNote || ''),
    };
  } catch {
    return {
      ok: false,
      message: 'Serveur hors ligne : validation effectuée localement par le Web Worker isolé.',
      serverSlotNote: 'Mode hors-ligne actif (aucune donnée envoyée).',
    };
  }
}

export function triggerBinaryDownload(bytes: Uint8Array, filename: string): void {
  const safeCopy = new Uint8Array(bytes.byteLength);
  safeCopy.set(bytes);
  const blob = new Blob([safeCopy.buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Génère un fichier EEPROM d'atelier de test respectant EXACTEMENT la géométrie choisie
 * (ex: 93C66 = 512 octets, 95640 = 8192 octets) avec uniquement un en-tête ASCII testable
 * — ZERO PIN ou octet secret factice.
 */
export function buildSampleEepromTestDump(
  geometry: EepromGeometryProfile,
  sampleVin = 'VF1RJB00123456789'
): { fileName: string; buffer: ArrayBuffer } {
  const buf = new Uint8Array(geometry.exactSizeBytes);
  // Remplissage structuré déterministe (simule des blocs chiffrés réalistes non vides)
  for (let i = 0; i < buf.length; i++) {
    buf[i] = ((i * 73 + 0x5a) ^ (i >> 3)) & 0xff;
  }
  const encoder = new TextEncoder();
  const header = encoder.encode(`AUTOPRO_TEST_${geometry.id} VIN:${sampleVin} `);
  if (header.length + 16 < buf.length) {
    buf.set(header, 0x10);
  }
  return {
    fileName: `TEST_ATELIER_${geometry.id}_${geometry.exactSizeBytes}B.bin`,
    buffer: buf.buffer,
  };
}
