/**
 * Gestion sécurisée du jeton de session en mémoire JS uniquement.
 * Aucune clé Admin, aucun jeton Bearer ni secret HMAC n'est écrit dans localStorage ou sessionStorage.
 */

let inMemoryAuthToken = '';

const LEGACY_SENSITIVE_STORAGE_KEYS = [
  'autopro_license_session',
  'autopro_admin_passcode',
  'autopro_pc_agent_token',
  'autopro_pc_agent_hmac_secret',
  'autopro_admin_subscribers_mirror_v1',
  'autopro_admin_deleted_subs_v1',
  'autopro_render_backend_url',
  'autopro_hwid_override',
] as const;

export function setAuthToken(token: string): void {
  inMemoryAuthToken = typeof token === 'string' ? token.trim() : '';
}

export function getAuthToken(): string {
  return inMemoryAuthToken;
}

export function clearAuthToken(): void {
  inMemoryAuthToken = '';
}

export function purgeLegacySensitiveStorage(): void {
  if (typeof window === 'undefined') return;
  for (const key of LEGACY_SENSITIVE_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage access errors
    }
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore storage access errors
    }
  }
}
