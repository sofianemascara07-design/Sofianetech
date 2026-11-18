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
    if (
      saved &&
      saved.trim() &&
      !saved.includes('autopro-dz-backend.onrender.com') &&
      !saved.includes('votre-backend')
    ) {
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

export function resetBackendBaseUrl(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
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

export interface ApiFetchOptions extends RequestInit {
  retries?: number;
  timeoutMs?: number;
}

const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiFetch(input: string, init?: ApiFetchOptions): Promise<Response> {
  const target = apiUrl(input);
  const isCrossOrigin = target.startsWith('http://') || target.startsWith('https://');
  const method = (init?.method || 'GET').toUpperCase();
  const defaultRetries = method === 'GET' || input.includes('/check-session') || input.includes('/activity') || input.includes('/health') ? 2 : 1;
  const maxRetries = typeof init?.retries === 'number' ? init.retries : defaultRetries;
  const timeoutMs = typeof init?.timeoutMs === 'number' ? init.timeoutMs : 22000;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (init?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const onCallerAbort = () => controller.abort();
    init?.signal?.addEventListener('abort', onCallerAbort, { once: true });

    try {
      const response = await globalThis.fetch(target, {
        credentials: isCrossOrigin ? 'omit' : 'include',
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      init?.signal?.removeEventListener('abort', onCallerAbort);

      if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
        const retryAfterSec = parseInt(response.headers.get('Retry-After') || '0', 10);
        const waitMs = retryAfterSec > 0 ? Math.min(retryAfterSec * 1000, 5000) : 700 * (attempt + 1);
        await sleep(waitMs);
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      init?.signal?.removeEventListener('abort', onCallerAbort);
      lastError = timedOut ? new Error(`Délai dépassé (${Math.round(timeoutMs / 1000)}s) vers le serveur distant`) : err;

      if (init?.signal?.aborted || attempt >= maxRetries) {
        throw lastError;
      }

      await sleep(750 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Échec de connexion réseau.');
}

export function installApiBridge(): void {
  // No-op: components use apiFetch() directly so window.fetch is never mutated
}
