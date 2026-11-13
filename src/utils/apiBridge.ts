const STORAGE_KEY = 'autopro_render_backend_url';

export function getBackendBaseUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {
    // Ignore storage errors
  }

  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return '';
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

export function apiUrl(path: string): string {
  const baseUrl = getBackendBaseUrl();
  if (baseUrl && path.startsWith('/api/')) {
    return `${baseUrl}${path}`;
  }
  return path;
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(apiUrl(input), init);
}

export function installApiBridge(): void {
  // No-op: components use apiFetch() directly so window.fetch is never mutated
}
