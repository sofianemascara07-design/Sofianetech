import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  FolderOpen,
  Smartphone,
  Terminal,
  Play,
  CheckSquare,
  Square,
  Search,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Package,
} from 'lucide-react';

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:8080';

function isAllowedLocalBridgeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === '127.0.0.1' || host === 'localhost' || host === '::1') return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    const m172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (m172) {
      const second = Number(m172[1]);
      if (second >= 16 && second <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isValidAdbIpTarget(raw: string): boolean {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::(\d{1,5}))?$/);
  if (!match) return false;
  for (let i = 1; i <= 4; i++) {
    const octet = Number(match[i]);
    if (octet < 0 || octet > 255) return false;
  }
  if (match[5] !== undefined) {
    const port = Number(match[5]);
    if (port < 1 || port > 65535) return false;
  }
  return true;
}

function isSafeApkRelativePath(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 260) return false;
  if (trimmed.includes('..') || trimmed.startsWith('/') || trimmed.startsWith('\\')) return false;
  if (/[;|&$`><\r\n\0"']/.test(trimmed)) return false;
  return trimmed.toLowerCase().endsWith('.apk');
}

interface ApkFolderGroup {
  folder: string;
  files: { id: string; name: string; path: string }[];
}

interface LogLine {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'error';
  text: string;
}

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString('fr-FR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function makeLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildApkPath(folder: string, fileName: string): string {
  const cleanName = fileName.trim();
  if (!folder || folder === 'Racine' || cleanName.includes('/')) {
    return cleanName;
  }
  return `${folder.replace(/\/+$/, '')}/${cleanName}`;
}

function normalizePacksPayload(payload: unknown): ApkFolderGroup[] {
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  const rawPacks =
    obj.packs ?? obj.folders ?? obj.directories ?? obj.apks ?? obj.files ?? obj.data ?? null;

  if (!rawPacks) return [];

  if (Array.isArray(rawPacks)) {
    // Array of { folder / name / title, files / apks / items }
    if (
      rawPacks.length > 0 &&
      typeof rawPacks[0] === 'object' &&
      rawPacks[0] !== null
    ) {
      return rawPacks
        .map((entry) => {
          const item = entry as Record<string, unknown>;
          const folder = String(
            item.folder ?? item.name ?? item.dir ?? item.title ?? 'Pack APK'
          ).trim();
          const listRaw = item.files ?? item.apks ?? item.items ?? [];
          const list = Array.isArray(listRaw)
            ? listRaw
                .map((f) =>
                  typeof f === 'string'
                    ? f
                    : typeof f === 'object' && f !== null
                    ? String((f as Record<string, unknown>).name ?? (f as Record<string, unknown>).file ?? (f as Record<string, unknown>).path ?? '')
                    : ''
                )
                .filter((s) => s.trim().length > 0)
            : [];
          return {
            folder,
            files: list.map((fName) => {
              const path = buildApkPath(folder, fName);
              const shortName = path.split('/').pop() || fName;
              return { id: path, name: shortName, path };
            }),
          };
        })
        .filter((g) => g.files.length > 0);
    }

    // Flat array of string file paths
    const grouped = new Map<string, { id: string; name: string; path: string }[]>();
    for (const entry of rawPacks) {
      if (typeof entry !== 'string' || !entry.trim()) continue;
      const cleanPath = entry.trim();
      const parts = cleanPath.split('/').filter(Boolean);
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Racine';
      const fileName = parts[parts.length - 1] || cleanPath;
      const arr = grouped.get(folder) ?? [];
      arr.push({ id: cleanPath, name: fileName, path: cleanPath });
      grouped.set(folder, arr);
    }
    return Array.from(grouped.entries()).map(([folder, files]) => ({ folder, files }));
  }

  // Object map: { "AndroidAuto": ["fermata.apk", ...], ... }
  if (typeof rawPacks === 'object') {
    const groups: ApkFolderGroup[] = [];
    for (const [folderKey, val] of Object.entries(rawPacks as Record<string, unknown>)) {
      if (!Array.isArray(val)) continue;
      const files = val
        .map((f) =>
          typeof f === 'string'
            ? f
            : typeof f === 'object' && f !== null
            ? String((f as Record<string, unknown>).name ?? (f as Record<string, unknown>).path ?? '')
            : ''
        )
        .filter((s) => s.trim().length > 0)
        .map((fName) => {
          const path = buildApkPath(folderKey, fName);
          const shortName = path.split('/').pop() || fName;
          return { id: path, name: shortName, path };
        });
      if (files.length > 0) {
        groups.push({ folder: folderKey, files });
      }
    }
    return groups;
  }

  return [];
}

function extractLogsFromJson(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  const rawLogs = obj.logs ?? obj.log ?? obj.output;
  if (Array.isArray(rawLogs)) {
    return rawLogs.map((l) => (typeof l === 'string' ? l : JSON.stringify(l)));
  }
  if (typeof rawLogs === 'string' && rawLogs.trim()) {
    return rawLogs.split(/\r?\n/).filter((line) => line.trim().length > 0);
  }
  if (typeof obj.message === 'string' && obj.message.trim()) {
    return [obj.message.trim()];
  }
  return [];
}

export const ChineseAutoDeployer: React.FC = () => {
  const [bridgeUrl, setBridgeUrl] = useState<string>(DEFAULT_BRIDGE_URL);
  const [bridgeConnected, setBridgeConnected] = useState<boolean>(false);
  const [checkingBridge, setCheckingBridge] = useState<boolean>(true);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const [packGroups, setPackGroups] = useState<ApkFolderGroup[]>([]);
  const [selectedApks, setSelectedApks] = useState<string[]>([]);
  const [manualIp, setManualIp] = useState<string>('');
  const [connectedTarget, setConnectedTarget] = useState<string | null>(null);

  const [busyAction, setBusyAction] = useState<
    null | 'refresh' | 'scan' | 'connect' | 'step1' | 'install'
  >(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const appendLog = useCallback((level: LogLine['level'], text: string) => {
    setLogs((prev) => [
      ...prev.slice(-250),
      {
        id: makeLogId(),
        timestamp: nowTimeLabel(),
        level,
        text,
      },
    ]);
  }, []);

  const appendJsonLogs = useCallback(
    (payload: unknown, fallbackSummary?: string) => {
      const extracted = extractLogsFromJson(payload);
      if (extracted.length > 0) {
        extracted.forEach((line) => {
          const lower = line.toLowerCase();
          const lvl: LogLine['level'] =
            lower.includes('erreur') || lower.includes('error') || lower.includes('fail')
              ? 'error'
              : lower.includes('ok') || lower.includes('succ') || lower.includes('connect')
              ? 'success'
              : 'info';
          appendLog(lvl, line);
        });
      } else if (fallbackSummary) {
        appendLog('info', fallbackSummary);
      } else {
        appendLog('info', JSON.stringify(payload));
      }
    },
    [appendLog]
  );

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const normalizedBaseUrl = useMemo(
    () => bridgeUrl.trim().replace(/\/+$/, '') || DEFAULT_BRIDGE_URL,
    [bridgeUrl]
  );

  const fetchBridgeState = useCallback(
    async (silent = false) => {
      if (!silent) {
        setBusyAction('refresh');
      }
      setCheckingBridge(true);
      setBridgeError(null);

      if (!isAllowedLocalBridgeUrl(normalizedBaseUrl)) {
        const msg =
          'Adresse bloquée par sécurité : seule une passerelle locale (127.0.0.1, localhost ou réseau privé 192.168.x.x / 10.x.x.x) est autorisée.';
        setBridgeConnected(false);
        setCheckingBridge(false);
        setBusyAction((curr) => (curr === 'refresh' ? null : curr));
        setBridgeError(msg);
        appendLog('error', msg);
        return;
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${normalizedBaseUrl}/`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} reçu depuis ${normalizedBaseUrl}`);
        }

        const data = await res.json();
        setBridgeConnected(true);

        const parsedGroups = normalizePacksPayload(data);
        setPackGroups(parsedGroups);

        const validPaths = new Set(parsedGroups.flatMap((g) => g.files.map((f) => f.path)));
        setSelectedApks((prev) => prev.filter((p) => validPaths.has(p)));

        const detectedIp =
          typeof data?.ip === 'string'
            ? data.ip
            : typeof data?.device === 'string'
            ? data.device
            : typeof data?.connectedIp === 'string'
            ? data.connectedIp
            : null;
        if (detectedIp) {
          setConnectedTarget(detectedIp);
        }

        const totalFiles = parsedGroups.reduce((sum, g) => sum + g.files.length, 0);
        appendLog(
          'success',
          `Pont Termux Connecté (${normalizedBaseUrl}) — ${parsedGroups.length} dossier(s), ${totalFiles} APK détecté(s).`
        );
        const jsonLogs = extractLogsFromJson(data);
        jsonLogs.forEach((line) => appendLog('info', line));
      } catch (err: any) {
        setBridgeConnected(false);
        const msg =
          err?.name === 'AbortError'
            ? `Délai dépassé sur ${normalizedBaseUrl}. Vérifiez que le serveur Termux est lancé.`
            : `Pont Termux inaccessible sur ${normalizedBaseUrl}. Démarrez votre API locale sur le port 8080 (avec CORS autorisé).`;
        setBridgeError(msg);
        appendLog('error', msg);
      } finally {
        setCheckingBridge(false);
        setBusyAction((curr) => (curr === 'refresh' ? null : curr));
      }
    },
    [normalizedBaseUrl, appendLog]
  );

  useEffect(() => {
    void fetchBridgeState(true);
  }, [fetchBridgeState]);

  const postAction = async (
    actionKind: 'scan' | 'connect' | 'step1' | 'install',
    body: Record<string, unknown>,
    startMessage: string
  ) => {
    setBusyAction(actionKind);
    setBridgeError(null);

    if (!isAllowedLocalBridgeUrl(normalizedBaseUrl)) {
      const msg =
        'Action bloquée : seule une URL locale sécurisée (http://127.0.0.1:8080 ou LAN privé) est autorisée.';
      setBridgeError(msg);
      appendLog('error', msg);
      setBusyAction(null);
      return;
    }

    appendLog('info', startMessage);

    try {
      const controller = new AbortController();
      const timeoutMs = actionKind === 'install' || actionKind === 'step1' ? 180_000 : 30_000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${normalizedBaseUrl}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const rawText = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawText || '{}');
      } catch {
        data = { logs: rawText ? [rawText] : [] };
      }

      if (!res.ok) {
        appendJsonLogs(data, `Erreur HTTP ${res.status}`);
        throw new Error(
          String(data?.error || data?.message || `Échec action "${actionKind}" (HTTP ${res.status})`)
        );
      }

      setBridgeConnected(true);

      if (typeof data?.ip === 'string' && data.ip.trim()) {
        setConnectedTarget(data.ip.trim());
      } else if (actionKind === 'connect' && typeof body.ip === 'string') {
        setConnectedTarget(body.ip);
      }

      const maybeUpdatedPacks = normalizePacksPayload(data);
      if (maybeUpdatedPacks.length > 0) {
        setPackGroups(maybeUpdatedPacks);
      }

      appendJsonLogs(
        data,
        `Action "${String(body.action)}" terminée avec succès.`
      );
    } catch (err: any) {
      const errText =
        err?.name === 'AbortError'
          ? `Délai dépassé lors de l'action "${actionKind}".`
          : err?.message || `Impossible de joindre ${normalizedBaseUrl}.`;
      setBridgeError(errText);
      appendLog('error', errText);
    } finally {
      setBusyAction(null);
    }
  };

  const handleScanWifi = () => {
    void postAction('scan', { action: 'scan' }, 'POST / {"action": "scan"} — Scan Auto Wi-Fi ADB lancé...');
  };

  const handleConnectIp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIp = manualIp.trim();
    if (!isValidAdbIpTarget(cleanIp)) {
      const err =
        'IP invalide : entrez une adresse IPv4 valide (ex : 192.168.43.100 ou 192.168.1.50:5555).';
      setBridgeError(err);
      appendLog('error', err);
      return;
    }
    void postAction(
      'connect',
      { action: 'connect', ip: cleanIp },
      `POST / {"action": "connect", "ip": "${cleanIp}"}...`
    );
  };

  const handleStep1 = () => {
    void postAction(
      'step1',
      { action: 'step1' },
      'POST / {"action": "step1"} — Étape 1 : Débridage & Langue FR en cours...'
    );
  };

  const handleStep2Install = () => {
    if (selectedApks.length === 0) {
      setBridgeError('Cochez au moins un fichier APK avant de lancer le déploiement.');
      return;
    }
    const safeApks = selectedApks.filter(isSafeApkRelativePath);
    if (safeApks.length !== selectedApks.length) {
      const err =
        'Sélection bloquée par sécurité : un chemin APK contient des caractères non autorisés.';
      setBridgeError(err);
      appendLog('error', err);
      return;
    }
    void postAction(
      'install',
      { action: 'install', apks: safeApks },
      `POST / {"action": "install", "apks": [${safeApks.length} fichier(s)]}...`
    );
  };

  const toggleApkPath = (path: string) => {
    setSelectedApks((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const toggleFolder = (group: ApkFolderGroup) => {
    const groupPaths = group.files.map((f) => f.path);
    const allSelected = groupPaths.every((p) => selectedApks.includes(p));
    if (allSelected) {
      setSelectedApks((prev) => prev.filter((p) => !groupPaths.includes(p)));
    } else {
      setSelectedApks((prev) => Array.from(new Set([...prev, ...groupPaths])));
    }
  };

  const allApkPaths = useMemo(
    () => packGroups.flatMap((g) => g.files.map((f) => f.path)),
    [packGroups]
  );

  const toggleSelectAll = () => {
    if (allApkPaths.length === 0) return;
    if (selectedApks.length === allApkPaths.length) {
      setSelectedApks([]);
    } else {
      setSelectedApks(allApkPaths);
    }
  };

  const handleCopyLogs = () => {
    const formatted = logs.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(formatted);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Header & Bridge Status */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg font-bold border ${
                bridgeConnected
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/70 border-rose-500/50 text-rose-300'
              }`}
            >
              {bridgeConnected ? (
                <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>
                {bridgeConnected ? 'Pont Termux Connecté' : 'Pont Termux Hors-Ligne'}
              </span>
            </span>

            <span className="text-slate-400 font-mono tabular-nums">
              {normalizedBaseUrl}
              {connectedTarget ? ` · Cible ADB : ${connectedTarget}` : ''}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Déploiement Android Auto &amp; CarPlay Chinois
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            Pilotez votre passerelle locale Termux sur{' '}
            <code className="text-cyan-300 font-mono">{DEFAULT_BRIDGE_URL}</code> pour scanner
            l&apos;autoradio en Wi-Fi, appliquer le débridage FR et déployer vos packs APK en
            quelques clics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            type="url"
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
            aria-label="Adresse du pont Termux local"
            className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300 w-52 focus:border-cyan-400 outline-none"
          />
          <button
            type="button"
            disabled={checkingBridge || busyAction !== null}
            onClick={() => void fetchBridgeState(false)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-xs font-semibold text-white flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${checkingBridge ? 'animate-spin' : ''}`} />
            <span>Actualiser le pont</span>
          </button>
        </div>
      </div>

      {bridgeError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{bridgeError}</span>
        </div>
      )}

      {/* Top Controls Row: Wi-Fi Scan / Manual IP + Step 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Connection Panel */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" />
              <span>Connexion Autoradio (Wi-Fi ADB)</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">
              {connectedTarget ? `Connecté : ${connectedTarget}` : 'Aucune IP ciblée'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleScanWifi}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${busyAction === 'scan' ? 'animate-spin' : ''}`} />
              <span>Scan Auto Wi-Fi</span>
            </button>

            <form onSubmit={handleConnectIp} className="flex-1 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                placeholder="IP manuelle autoradio (ex: 192.168.43.100)"
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 outline-none"
              />
              <button
                type="submit"
                disabled={busyAction !== null}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 text-xs sm:text-sm font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                {busyAction === 'connect' ? 'Connexion...' : 'Connecter IP'}
              </button>
            </form>
          </div>
        </div>

        {/* Step 1 Panel */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Préparation Tablette Chinoise</span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Débloque les installations APK tierces et applique les réglages de langue française
              via le pont Termux avant le déploiement.
            </p>
          </div>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleStep1}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
          >
            {busyAction === 'step1' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>Étape 1 : Débridage &amp; Langue FR</span>
          </button>
        </div>
      </div>

      {/* Main Split: APK Folders (Left) + Live JSON Terminal Logs (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* APK Folder Selection & Step 2 Deploy */}
        <div className="xl:col-span-7 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span>Dossiers &amp; Fichiers APK (Packs Termux)</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                  {packGroups.length} dossier(s) · {allApkPaths.length} APK disponible(s) ·{' '}
                  {selectedApks.length} sélectionné(s)
                </p>
              </div>

              {allApkPaths.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  {selectedApks.length === allApkPaths.length ? (
                    <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>
                    {selectedApks.length === allApkPaths.length
                      ? 'Tout désélectionner'
                      : 'Tout sélectionner'}
                  </span>
                </button>
              )}
            </div>

            {checkingBridge && packGroups.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Lecture des dossiers APK sur {normalizedBaseUrl}...</span>
              </div>
            ) : packGroups.length === 0 ? (
              <div className="py-10 px-4 rounded-xl bg-slate-950/70 border border-slate-800 text-center space-y-3">
                <FolderOpen className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-200">
                    Aucun dossier APK reçu du pont Termux
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Vérifiez que votre serveur local écoute sur{' '}
                    <code className="text-cyan-300 font-mono">{normalizedBaseUrl}</code> et retourne
                    vos dossiers dans <code className="text-cyan-300 font-mono">packs</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchBridgeState(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white cursor-pointer"
                >
                  Interroger à nouveau
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {packGroups.map((group) => {
                  const groupSelectedCount = group.files.filter((f) =>
                    selectedApks.includes(f.path)
                  ).length;
                  const allGroupChecked =
                    group.files.length > 0 && groupSelectedCount === group.files.length;

                  return (
                    <div
                      key={group.folder}
                      className="rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden"
                    >
                      <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFolder(group)}
                          className="flex items-center gap-2 text-left text-xs sm:text-sm font-bold text-cyan-300 hover:text-cyan-200 cursor-pointer"
                        >
                          {allGroupChecked ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="truncate">{group.folder}</span>
                        </button>
                        <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                          {groupSelectedCount}/{group.files.length}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-800/60">
                        {group.files.map((file) => {
                          const checked = selectedApks.includes(file.path);
                          return (
                            <label
                              key={file.id}
                              className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/60 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleApkPath(file.path)}
                                  className="w-4 h-4 rounded accent-cyan-500 cursor-pointer shrink-0"
                                />
                                <span
                                  className={`text-xs font-mono truncate ${
                                    checked ? 'text-white font-semibold' : 'text-slate-300'
                                  }`}
                                >
                                  {file.name}
                                </span>
                              </div>
                              {checked && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-mono tabular-nums text-slate-300">
              Sélection prête : <strong className="text-cyan-300">{selectedApks.length}</strong>{' '}
              fichier(s) APK
            </span>

            <button
              type="button"
              disabled={busyAction !== null || selectedApks.length === 0}
              onClick={handleStep2Install}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              {busyAction === 'install' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>Étape 2 : Déployer la sélection ({selectedApks.length})</span>
            </button>
          </div>
        </div>

        {/* Live Logs Terminal */}
        <div className="xl:col-span-5 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Terminal de Logs en Direct</span>
            </h2>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={logs.length === 0}
                onClick={handleCopyLogs}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                {copiedLogs ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={logs.length === 0}
                onClick={() => setLogs([])}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1 cursor-pointer"
                title="Effacer les logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider</span>
              </button>
            </div>
          </div>

          <div
            className="flex-1 min-h-[340px] max-h-[480px] overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-3.5 font-mono text-xs tabular-nums space-y-1.5"
            role="log"
            aria-live="polite"
          >
            {logs.length === 0 ? (
              <p className="text-slate-500">
                En attente des réponses JSON <code className="text-slate-400">logs</code> du pont
                Termux...
              </p>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} className="leading-relaxed break-words">
                  <span className="text-slate-500 mr-2">[{entry.timestamp}]</span>
                  <span
                    className={
                      entry.level === 'error'
                        ? 'text-rose-400'
                        : entry.level === 'success'
                        ? 'text-emerald-300'
                        : 'text-slate-200'
                    }
                  >
                    {entry.text}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
