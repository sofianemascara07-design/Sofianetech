import { getAuthToken } from './authSession';

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
  // Sur Cloud Run (.run.app), Render (.onrender.com) ou localhost,
  // utiliser le backend Express co-localisé sans lecture URL ni localStorage.
  if (isFullStackSelfHost()) {
    return '';
  }

  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return DEFAULT_RENDER_BACKEND_URL;
}

export function setBackendBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function resetBackendBaseUrl(): void {
  // No-op: backend base URL is fixed by build/runtime environment
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

async function isHtmlProxyInterception(res: Response): Promise<boolean> {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) return true;
  if (!ct.includes('application/json') && (res.status === 200 || res.status === 404)) {
    try {
      const sample = (await res.clone().text()).trim();
      if (sample.startsWith('<!doctype') || sample.startsWith('<html') || sample.startsWith('<')) {
        return true;
      }
    } catch {
      // Ignore clone read issues
    }
  }
  return false;
}

async function fetchWithTimeout(
  url: string,
  crossOrigin: boolean,
  timeoutMs: number,
  init?: ApiFetchOptions
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onCallerAbort = () => controller.abort();
  init?.signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const headers = new Headers(init?.headers || undefined);
    const token = getAuthToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await globalThis.fetch(url, {
      credentials: crossOrigin ? 'omit' : 'include',
      ...init,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    init?.signal?.removeEventListener('abort', onCallerAbort);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    init?.signal?.removeEventListener('abort', onCallerAbort);
    if (timedOut) {
      throw new Error(`Délai dépassé (${Math.round(timeoutMs / 1000)}s) vers le serveur distant`);
    }
    throw err;
  }
}

export async function apiFetch(input: string, init?: ApiFetchOptions): Promise<Response> {
  const target = apiUrl(input);
  const isCrossOrigin = target.startsWith('http://') || target.startsWith('https://');
  const method = (init?.method || 'GET').toUpperCase();
  const defaultRetries =
    method === 'GET' ||
    input.includes('/check-session') ||
    input.includes('/activity') ||
    input.includes('/health') ||
    input.includes('/license/status')
      ? 2
      : 1;
  const maxRetries = typeof init?.retries === 'number' ? init.retries : defaultRetries;
  const timeoutMs = typeof init?.timeoutMs === 'number' ? init.timeoutMs : 22000;

  const fallbackTarget = input.startsWith('/api/') ? `${DEFAULT_RENDER_BACKEND_URL}${input}` : null;
  const canFailoverToRender = Boolean(fallbackTarget && fallbackTarget !== target);

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (init?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const response = await fetchWithTimeout(target, isCrossOrigin, timeoutMs, init);

      // Detect proxy/static HTML interception (e.g. Cloud Run ais-pre or SSO redirect on /api/*)
      if (canFailoverToRender && (await isHtmlProxyInterception(response))) {
        return await fetchWithTimeout(fallbackTarget!, true, timeoutMs, init);
      }

      if (RETRYABLE_STATUSES.has(response.status)) {
        if (attempt < maxRetries) {
          const retryAfterSec = parseInt(response.headers.get('Retry-After') || '0', 10);
          const waitMs =
            retryAfterSec > 0 ? Math.min(retryAfterSec * 1000, 5000) : 700 * (attempt + 1);
          await sleep(waitMs);
          continue;
        }
        if (canFailoverToRender) {
          return await fetchWithTimeout(fallbackTarget!, true, timeoutMs, init);
        }
      }

      return response;
    } catch (err) {
      lastError = err;

      if (init?.signal?.aborted) {
        throw lastError;
      }

      if (attempt >= maxRetries) {
        if (canFailoverToRender) {
          return await fetchWithTimeout(fallbackTarget!, true, timeoutMs, init);
        }
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
