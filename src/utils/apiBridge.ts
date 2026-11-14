const STORAGE_KEY = 'autopro_render_backend_url';
export const DEFAULT_RENDER_BACKEND_URL = 'https://autopro-suitebacken.onrender.com';

function isFullStackSelfHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location?.hostname || '';
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.run.app') ||
    host.endsWith('.onrender.com')
  );
}

export function getBackendBaseUrl(): string {
  try {
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const apiParam = params.get('api');
      if (apiParam && apiParam.trim().startsWith('http')) {
        const cleanParam = apiParam.trim().replace(/\/+$/, '');
        localStorage.setItem(STORAGE_KEY, cleanParam);
        return cleanParam;
      }
    }
  } catch {
    // Ignore URL/storage errors
  }

  // On AI Studio Cloud Run (.run.app), Render (.onrender.com), or localhost,
  // ALWAYS use the co-located Express backend so a stale localStorage URL never breaks /api calls.
  if (isFullStackSelfHost()) {
    return '';
  }

  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {
    // Ignore storage errors
  }

  return DEFAULT_RENDER_BACKEND_URL;
}

export function setBackendBaseUrl(url: string): string {
  const clean = url.trim().replace(/\/+$/, '');
  try {
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
  return clean;
}

export function isStaticFirebaseWithoutBackend(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location?.hostname || '';
  const isFirebase = host.endsWith('.web.app') || host.endsWith('.firebaseapp.com');
  return isFirebase && !getBackendBaseUrl();
}

export function apiUrl(path: string): string {
  const baseUrl = getBackendBaseUrl();
  if (baseUrl && path.startsWith('/api/')) {
    return `${baseUrl}${path}`;
  }
  return path;
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const target = apiUrl(input);
  const isCrossOrigin = target.startsWith('http://') || target.startsWith('https://');
  return globalThis.fetch(target, {
    credentials: isCrossOrigin ? 'omit' : 'same-origin',
    ...init,
  });
}

export function installApiBridge(): void {
  // No-op: components use apiFetch() directly so window.fetch is never mutated
}
