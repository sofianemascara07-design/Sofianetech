import { DtcRawTranslateResult, EcuPinoutEntry } from '../types/automotive';
import { SEEDED_ECU_PINOUTS } from '../data/chinaWorkshopSeed';

const PINOUTS_CACHE_KEY = 'autopro_pinouts_cache_v1';
const PINOUT_VOTES_KEY = 'autopro_pinout_voter_id_v1';
const DTC_TRANSLATE_CACHE_KEY = 'autopro_dtc_raw_translate_cache_v1';

export function getOrCreateTechnicianVoterId(): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'tech-local';
    let id = window.localStorage.getItem(PINOUT_VOTES_KEY);
    if (!id) {
      id = `TECH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      window.localStorage.setItem(PINOUT_VOTES_KEY, id);
    }
    return id;
  } catch {
    return 'tech-local';
  }
}

export function loadPinoutsCache(): { entries: EcuPinoutEntry[]; updatedAt: string | null } {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { entries: SEEDED_ECU_PINOUTS, updatedAt: null };
    }
    const raw = window.localStorage.getItem(PINOUTS_CACHE_KEY);
    if (!raw) {
      return { entries: SEEDED_ECU_PINOUTS, updatedAt: null };
    }
    const parsed = JSON.parse(raw) as { entries?: EcuPinoutEntry[]; updatedAt?: string };
    if (Array.isArray(parsed?.entries) && parsed.entries.length > 0) {
      return { entries: parsed.entries, updatedAt: parsed.updatedAt || null };
    }
  } catch {
    // Fallback below
  }
  return { entries: SEEDED_ECU_PINOUTS, updatedAt: null };
}

export function savePinoutsCache(entries: EcuPinoutEntry[]): string {
  const updatedAt = new Date().toISOString();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        PINOUTS_CACHE_KEY,
        JSON.stringify({ entries: entries.slice(0, 200), updatedAt })
      );
    }
  } catch {
    // Ignore storage quota
  }
  return updatedAt;
}

export function loadDtcTranslationsCache(): DtcRawTranslateResult[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(DTC_TRANSLATE_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDtcTranslationToCache(item: DtcRawTranslateResult): DtcRawTranslateResult[] {
  const existing = loadDtcTranslationsCache();
  const normKey = item.rawInput.trim().toUpperCase();
  const next = [item, ...existing.filter((x) => x.rawInput.trim().toUpperCase() !== normKey)].slice(0, 40);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DTC_TRANSLATE_CACHE_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore quota
  }
  return next;
}
