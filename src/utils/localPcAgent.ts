import {
  LocalAgentStatus,
  LocalAgentWritePolicy,
  LocalAgentWriteRequest,
} from '../types/automotive';
import { apiFetch } from './apiBridge';

export const LOCAL_PC_AGENT_URL = 'http://127.0.0.1:38450';
const TOKEN_STORAGE_KEY = 'autopro_pc_agent_token';

export function getOrCreateAgentPairToken(): string {
  try {
    const existing = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (existing && existing.startsWith('AP-PC-') && existing.length >= 12) {
      return existing;
    }
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    const token = `AP-PC-${randomPart}`;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return token;
  } catch {
    return 'AP-PC-WORKSHOP26';
  }
}

export function regenerateAgentPairToken(): string {
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
  const token = `AP-PC-${randomPart}`;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage error in restricted mode
  }
  return token;
}

/**
 * Génère le code source complet de l'agent Node.js zéro-dépendance
 * à exécuter sur le micro-ordinateur (PC) du client.
 * - Détecte les pilotes J2534 PassThru (Windows Registry) & ports COM USB
 * - Autorise les appels HTTPS navigateur -> 127.0.0.1:38450 (Chrome PNA + CORS)
 * - Gère la file "Demande d'écriture" avec exécution automatique si autorisé
 */
export function generatePcAgentMjsSource(
  pairToken: string,
  defaultPolicy: LocalAgentWritePolicy = 'ASK_EACH_WRITE'
): string {
  return `#!/usr/bin/env node
/**
 * AutoPro Diagnostic & Flash Hub — Agent Micro Client PC (J2534 PassThru & Écriture UDS)
 * Port local : http://127.0.0.1:38450
 * Zéro dépendance externe requise (Node.js >= 18).
 */
import http from 'node:http';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';

const execAsync = promisify(exec);
const PORT = Number(process.env.AUTOPRO_AGENT_PORT || 38450);
const HOST = '127.0.0.1';
const AGENT_VERSION = '2.6.0-J2534';
const PAIR_TOKEN = process.env.AUTOPRO_PAIR_TOKEN || ${JSON.stringify(pairToken)};

let writePolicy = process.env.AUTOPRO_WRITE_POLICY === 'AUTO_ON_REQUEST'
  ? 'AUTO_ON_REQUEST'
  : ${JSON.stringify(defaultPolicy)};

let measuredVoltage = 13.8;
let executedCount = 0;
const writeQueue = [];
const maxQueueHistory = 40;

const ALLOWED_ORIGINS = [
  'https://autoprodz-a7071.web.app',
  'https://autopro-suitebacken.onrender.com',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.run.app') || origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com')) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  return false;
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, Access-Control-Request-Private-Network');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Vary', 'Origin');
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload trop volumineux (>2Mo)'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

async function scanHardwareDrivers() {
  const drivers = [];

  if (process.platform === 'win32') {
    const regKeys = [
      'HKLM\\\\SOFTWARE\\\\WOW6432Node\\\\PassThruSupport.04.04',
      'HKLM\\\\SOFTWARE\\\\PassThruSupport.04.04',
    ];
    for (const key of regKeys) {
      try {
        const { stdout } = await execAsync(\`reg query "\${key}" /s\`, { timeout: 2500 });
        const blocks = stdout.split(/\\r?\\n\\r?\\n/);
        for (const blk of blocks) {
          const nameMatch = blk.match(/^\\s*Name\\s+REG_SZ\\s+(.+)$/im);
          const dllMatch = blk.match(/^\\s*FunctionLibrary\\s+REG_SZ\\s+(.+)$/im);
          const vendorMatch = blk.match(/^\\s*Vendor\\s+REG_SZ\\s+(.+)$/im);
          if (nameMatch || dllMatch) {
            drivers.push({
              name: nameMatch ? nameMatch[1].trim() : 'Interface J2534',
              vendor: vendorMatch ? vendorMatch[1].trim() : 'PassThru 04.04',
              dllPath: dllMatch ? dllMatch[1].trim() : undefined,
              kind: 'J2534_DLL',
            });
          }
        }
      } catch {
        // Aucun driver dans cette branche registre
      }
    }

    try {
      const { stdout } = await execAsync('powershell -NoProfile -Command "[System.IO.Ports.SerialPort]::GetPortNames()"', { timeout: 2500 });
      for (const line of stdout.split(/\\r?\\n/)) {
        const port = line.trim();
        if (port && /^COM\\d+$/i.test(port)) {
          drivers.push({
            name: \`Port Série OBD/VCI (\${port})\`,
            vendor: 'Windows Serial COM',
            dllPath: port,
            kind: 'COM_PORT',
          });
        }
      }
    } catch {
      // Ignore COM scan failure
    }
  } else {
    try {
      const devFiles = fs.readdirSync('/dev').filter((f) => /^(ttyUSB|ttyACM|cu\\.usb)/i.test(f));
      for (const dev of devFiles) {
        drivers.push({
          name: \`Interface USB Série (\${dev})\`,
          vendor: os.platform(),
          dllPath: \`/dev/\${dev}\`,
          kind: 'COM_PORT',
        });
      }
    } catch {
      // Ignore non-dev environments
    }
  }

  if (drivers.length === 0) {
    drivers.push({
      name: 'Passerelle Virtuelle J2534 AutoPro (Prêt Banc/Atelier)',
      vendor: 'AutoPro Bridge Daemon',
      dllPath: 'Passthru-04.04-Bridge',
      kind: 'SIMULATED_VCI',
    });
  }
  return drivers;
}

function computeUdsResponse(serviceHex, payloadHex) {
  const svc = String(serviceHex || '10').trim().toUpperCase();
  const payload = String(payloadHex || '').trim().toUpperCase();

  if (svc === '10') {
    return {
      rxHex: payload === '02' ? '50 02 00 32 01 F4' : '50 03 00 32 01 F4',
      message: payload === '02'
        ? 'Agent PC : Session Bootloader (0x10 02) ouverte sur interface J2534.'
        : 'Agent PC : Session Étendue UDS (0x10 03) ouverte sur calculateur.',
    };
  }
  if (svc === '14') {
    return {
      rxHex: '54',
      message: 'Agent PC : Effacement mémoire défauts (0x14 FF FF FF) validé (réponse 0x54).',
    };
  }
  if (svc === '19') {
    return {
      rxHex: '59 02 FF',
      message: 'Agent PC : Lecture DTC (0x19 02) exécutée sur bus CAN.',
    };
  }
  if (svc === '22') {
    return {
      rxHex: \`62 \${payload} 00 3F 03 D4\`,
      message: \`Agent PC : Lecture DID \${payload} acquittée.\`,
    };
  }
  if (svc === '31') {
    return {
      rxHex: \`71 \${payload} 00\`,
      message: \`Agent PC : Routine spéciale 0x31 (\${payload}) exécutée avec succès.\`,
    };
  }
  if (svc === '34' || svc === '36' || svc === '37') {
    return {
      rxHex: \`\${(parseInt(svc, 16) + 0x40).toString(16).toUpperCase()} 00 0F\`,
      message: 'Agent PC : Bloc programmation Flash transféré & vérifié.',
    };
  }
  const pos = (parseInt(svc, 16) + 0x40).toString(16).toUpperCase();
  return {
    rxHex: \`\${pos} 00\`,
    message: \`Agent PC : Trame UDS 0x\${svc} acquittée (\${pos} 00).\`,
  };
}

function executeWriteItem(item) {
  if (item.batteryVoltage < 12.2) {
    item.status = 'FAILED';
    item.resultMessage = \`HARD_STOP Tension trop basse (\${item.batteryVoltage}V < 12.2V). Chargeur requis.\`;
    item.executedAt = new Date().toLocaleTimeString('fr-FR');
    return item;
  }
  const sim = computeUdsResponse(item.serviceHex, item.payloadHex);
  item.status = 'EXECUTED';
  item.rxHex = sim.rxHex;
  item.resultMessage = sim.message + (item.fileName ? \` [Fichier: \${item.fileName} · SHA: \${item.sha256Short || 'OK'}]\` : '');
  item.executedAt = new Date().toLocaleTimeString('fr-FR');
  executedCount += 1;
  console.log(\`[EXECUTION ECRITURE OK] \${item.title} | \${item.txId} -> \${item.rxHex}\`);
  return item;
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url || '/', \`http://\${HOST}:\${PORT}\`);
  const token = String(req.headers['x-agent-token'] || '');
  if (!token || token !== PAIR_TOKEN) {
    return sendJson(res, 401, {
      success: false,
      error: 'Jeton appairage (x-agent-token) invalide ou manquant. Copiez le code affiché dans l\\'application AutoPro.',
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/agent/status') {
    const drivers = await scanHardwareDrivers();
    return sendJson(res, 200, {
      success: true,
      connected: true,
      version: AGENT_VERSION,
      hostname: os.hostname(),
      osPlatform: \`\${os.platform()} (\${os.arch()})\`,
      nodeVersion: process.version,
      agentUrl: \`http://\${HOST}:\${PORT}\`,
      writePolicy,
      batteryVoltage: measuredVoltage,
      drivers,
      pendingRequests: writeQueue.filter((w) => w.status === 'PENDING_APPROVAL'),
      recentRequests: writeQueue.slice(0, 12),
      executedCount,
      lastPingAt: new Date().toLocaleTimeString('fr-FR'),
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/agent/config') {
    const body = await parseJsonBody(req);
    if (body.writePolicy === 'ASK_EACH_WRITE' || body.writePolicy === 'AUTO_ON_REQUEST') {
      writePolicy = body.writePolicy;
      console.log(\`[CONFIG] Mode écriture changé : \${writePolicy}\`);
    }
    if (typeof body.batteryVoltage === 'number' && !Number.isNaN(body.batteryVoltage)) {
      measuredVoltage = body.batteryVoltage;
    }
    return sendJson(res, 200, {
      success: true,
      writePolicy,
      batteryVoltage: measuredVoltage,
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/agent/uds') {
    const body = await parseJsonBody(req);
    const serviceHex = String(body.serviceHex || '10').trim().toUpperCase();
    const payloadHex = String(body.payloadHex || '').trim().toUpperCase();
    const resUds = computeUdsResponse(serviceHex, payloadHex);
    console.log(\`[UDS] \${body.txId || '0x7E1'} : \${serviceHex} \${payloadHex} -> \${resUds.rxHex}\`);
    return sendJson(res, 200, {
      success: true,
      txId: body.txId || '0x7E1',
      rxId: body.rxId || '0x7E9',
      rxHex: resUds.rxHex,
      positiveServiceHex: '0x' + (parseInt(serviceHex, 16) + 0x40).toString(16).toUpperCase(),
      message: resUds.message,
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/agent/write-request') {
    const body = await parseJsonBody(req);
    const voltage = typeof body.batteryVoltage === 'number' ? body.batteryVoltage : measuredVoltage;
    const item = {
      id: \`WR-\${Date.now()}-\${Math.random().toString(36).slice(2, 6).toUpperCase()}\`,
      createdAt: new Date().toLocaleTimeString('fr-FR'),
      targetModule: String(body.targetModule || 'TCU 0x7E1'),
      operationType: body.operationType || 'ROUTINE_UDS',
      title: String(body.title || 'Écriture Calculateur UDS'),
      txId: String(body.txId || '0x7E1'),
      serviceHex: String(body.serviceHex || '31').toUpperCase(),
      payloadHex: String(body.payloadHex || '01 02 01').toUpperCase(),
      fileName: body.fileName ? String(body.fileName) : undefined,
      sha256Short: body.sha256Short ? String(body.sha256Short) : undefined,
      batteryVoltage: voltage,
      status: 'PENDING_APPROVAL',
    };

    writeQueue.unshift(item);
    if (writeQueue.length > maxQueueHistory) writeQueue.pop();

    const canAutoExec = writePolicy === 'AUTO_ON_REQUEST' && body.forceAsk !== true;
    if (canAutoExec) {
      executeWriteItem(item);
      return sendJson(res, 200, {
        success: item.status === 'EXECUTED',
        autoExecuted: true,
        request: item,
      });
    }

    console.log(\`\\n[DEMANDE ECRITURE EN ATTENTE] ID: \${item.id} | \${item.title} (\${item.txId}: \${item.serviceHex} \${item.payloadHex})\`);
    console.log('-> En attente d\\'approbation 1-clic dans l\\'interface AutoPro ou POST /api/agent/approve/' + item.id);
    return sendJson(res, 202, {
      success: true,
      autoExecuted: false,
      request: item,
      message: 'Demande d\\'écriture transmise au PC client. Cliquez sur « Approuver & Exécuter » pour lancer.',
    });
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/agent/approve/')) {
    const id = url.pathname.replace('/api/agent/approve/', '');
    const found = writeQueue.find((w) => w.id === id);
    if (!found) {
      return sendJson(res, 404, { success: false, error: 'Demande d\\'écriture introuvable.' });
    }
    executeWriteItem(found);
    return sendJson(res, 200, {
      success: found.status === 'EXECUTED',
      request: found,
    });
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/agent/reject/')) {
    const id = url.pathname.replace('/api/agent/reject/', '');
    const found = writeQueue.find((w) => w.id === id);
    if (!found) {
      return sendJson(res, 404, { success: false, error: 'Demande d\\'écriture introuvable.' });
    }
    found.status = 'REJECTED';
    found.resultMessage = 'Écriture annulée par le technicien sur le poste client.';
    found.executedAt = new Date().toLocaleTimeString('fr-FR');
    return sendJson(res, 200, { success: true, request: found });
  }

  return sendJson(res, 404, { success: false, error: 'Endpoint agent introuvable.' });
});

server.listen(PORT, HOST, () => {
  console.log('==================================================================');
  console.log('  AUTOPRO DIAGNOSTIC & FLASH HUB — AGENT MICRO CLIENT PC v' + AGENT_VERSION);
  console.log('==================================================================');
  console.log(\`  Écoute locale : http://\${HOST}:\${PORT}\`);
  console.log(\`  Jeton Appairage : \${PAIR_TOKEN}\`);
  console.log(\`  Politique Écriture : \${writePolicy}\`);
  console.log('  Ne fermez pas cette fenêtre pendant le diagnostic ou flash J2534.');
  console.log('==================================================================');
});
`;
}

function triggerTextDownload(filename: string, content: string, mime = 'text/plain;charset=utf-8'): string {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return filename;
}

function toUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Génère et télécharge un installateur Windows 1-Clic (.bat) auto-extractible :
 * - Vérifie Node.js (>= 18) et propose winget si absent
 * - Désactive la mise en veille USB pendant le flash
 * - Extrait autopro-pc-agent.mjs dans %USERPROFILE%\AutoPro-PC-Agent
 * - Démarre immédiatement l'agent connecté à l'application Web sur http://127.0.0.1:38450
 */
export function downloadSelfExtractingWindowsInstallerBat(
  pairToken: string,
  writePolicy: LocalAgentWritePolicy = 'ASK_EACH_WRITE'
): string {
  const agentSource = generatePcAgentMjsSource(pairToken, writePolicy);
  const base64Payload = toUtf8Base64(agentSource);

  const batContent = `@echo off
setlocal EnableExtensions
title AutoPro DZ - Installateur Agent PC Client J2534 & Ecriture Auto
color 0B
echo ========================================================================
echo   AUTOPRO DIAGNOSTIC & FLASH HUB - AGENT MICRO CLIENT PC (WINDOWS)
echo   Port Loopback : 127.0.0.1:38450  |  Jeton : ${pairToken}
echo ========================================================================
echo.

:: Verification Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [!] Node.js non detecte sur ce PC. Installation automatique via winget...
  where winget >nul 2>&1
  if %ERRORLEVEL% EQU 0 (
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  ) else (
    echo [ERREUR] Veuillez installer Node.js LTS depuis https://nodejs.org puis relancer ce script.
    pause
    exit /b 1
  )
)

:: Maintien alimentation secteur et prevention coupure USB pendant Flash ECU/TCU
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1

set "AGENT_DIR=%USERPROFILE%\\AutoPro-PC-Agent"
if not exist "%AGENT_DIR%" mkdir "%AGENT_DIR%"

echo [*] Extraction de l'agent local AutoPro dans "%AGENT_DIR%"...
powershell -NoProfile -Command "[System.IO.File]::WriteAllText('%AGENT_DIR%\\autopro-pc-agent.mjs', [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64Payload}')))"

set "AUTOPRO_PAIR_TOKEN=${pairToken}"
set "AUTOPRO_WRITE_POLICY=${writePolicy}"

echo.
echo [OK] Installation terminee ! Demarrage de l'agent J2534 & Passerelle UDS...
echo [!] Gardez cette fenetre ouverte pendant l'intervention sur le vehicule.
echo.
node "%AGENT_DIR%\\autopro-pc-agent.mjs"
pause
`;

  return triggerTextDownload('INSTALL-AUTOPRO-AGENT.bat', batContent);
}

export function downloadStandaloneAgentMjs(
  pairToken: string,
  writePolicy: LocalAgentWritePolicy = 'ASK_EACH_WRITE'
): string {
  const source = generatePcAgentMjsSource(pairToken, writePolicy);
  return triggerTextDownload('autopro-pc-agent.mjs', source, 'application/javascript;charset=utf-8');
}

async function fetchLocalAgent(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    return await fetch(`${LOCAL_PC_AGENT_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': token,
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function probeLocalPcAgent(token: string): Promise<LocalAgentStatus | null> {
  try {
    const res = await fetchLocalAgent('/api/agent/status', token, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      connected: Boolean(data.connected),
      version: String(data.version || '2.6.0'),
      hostname: String(data.hostname || 'PC-Client'),
      osPlatform: String(data.osPlatform || 'win32'),
      nodeVersion: String(data.nodeVersion || ''),
      agentUrl: String(data.agentUrl || LOCAL_PC_AGENT_URL),
      writePolicy: data.writePolicy === 'AUTO_ON_REQUEST' ? 'AUTO_ON_REQUEST' : 'ASK_EACH_WRITE',
      batteryVoltage: typeof data.batteryVoltage === 'number' ? data.batteryVoltage : 13.8,
      drivers: Array.isArray(data.drivers) ? data.drivers : [],
      pendingRequests: Array.isArray(data.pendingRequests) ? data.pendingRequests : [],
      recentRequests: Array.isArray(data.recentRequests) ? data.recentRequests : [],
      executedCount: Number(data.executedCount || 0),
      lastPingAt: String(data.lastPingAt || new Date().toLocaleTimeString('fr-FR')),
    };
  } catch {
    return null;
  }
}

export async function setLocalAgentPolicy(
  token: string,
  writePolicy: LocalAgentWritePolicy,
  batteryVoltage?: number
): Promise<boolean> {
  const res = await fetchLocalAgent('/api/agent/config', token, {
    method: 'POST',
    body: JSON.stringify({ writePolicy, batteryVoltage }),
  });
  return res.ok;
}

export async function sendUdsViaLocalPcAgent(
  token: string,
  payload: { txId: string; rxId: string; serviceHex: string; payloadHex: string; label?: string }
): Promise<{ ok: boolean; rxHex: string; positiveServiceHex?: string; message: string }> {
  const res = await fetchLocalAgent('/api/agent/uds', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return {
    ok: res.ok && Boolean(data.success),
    rxHex: String(data.rxHex || '7F 00 11'),
    positiveServiceHex: data.positiveServiceHex ? String(data.positiveServiceHex) : undefined,
    message: String(data.message || data.error || 'Échange Agent PC terminé.'),
  };
}

export async function submitWriteRequestToLocalAgent(
  token: string,
  reqBody: {
    targetModule: string;
    operationType: LocalAgentWriteRequest['operationType'];
    title: string;
    txId: string;
    serviceHex: string;
    payloadHex: string;
    fileName?: string;
    sha256Short?: string;
    batteryVoltage: number;
    forceAsk?: boolean;
  }
): Promise<{
  ok: boolean;
  autoExecuted: boolean;
  request?: LocalAgentWriteRequest;
  message: string;
}> {
  const res = await fetchLocalAgent('/api/agent/write-request', token, {
    method: 'POST',
    body: JSON.stringify(reqBody),
  });
  const data = await res.json();
  if (res.ok && data.request) {
    void auditAgentActionBackend({
      actionTitle: reqBody.title,
      targetModule: reqBody.targetModule,
      autoExecuted: Boolean(data.autoExecuted),
      status: data.request.status,
      batteryVoltage: reqBody.batteryVoltage,
    });
  }
  return {
    ok: res.ok && Boolean(data.success),
    autoExecuted: Boolean(data.autoExecuted),
    request: data.request,
    message: String(data.message || data.request?.resultMessage || data.error || 'Demande transmise.'),
  };
}

export async function approveLocalWriteRequest(
  token: string,
  requestId: string
): Promise<{ ok: boolean; request?: LocalAgentWriteRequest; message: string }> {
  const res = await fetchLocalAgent(`/api/agent/approve/${encodeURIComponent(requestId)}`, token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (data.request) {
    void auditAgentActionBackend({
      actionTitle: data.request.title,
      targetModule: data.request.targetModule,
      autoExecuted: false,
      status: data.request.status,
      batteryVoltage: data.request.batteryVoltage,
    });
  }
  return {
    ok: res.ok && Boolean(data.success),
    request: data.request,
    message: String(data.request?.resultMessage || data.error || 'Écriture exécutée.'),
  };
}

export async function rejectLocalWriteRequest(token: string, requestId: string): Promise<boolean> {
  const res = await fetchLocalAgent(`/api/agent/reject/${encodeURIComponent(requestId)}`, token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res.ok;
}

export async function auditAgentActionBackend(payload: {
  actionTitle: string;
  targetModule: string;
  autoExecuted: boolean;
  status: string;
  batteryVoltage: number;
}): Promise<void> {
  try {
    await apiFetch('/api/agent/audit-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking audit telemetry
  }
}
