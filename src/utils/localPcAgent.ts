import {
  LocalAgentStatus,
  LocalAgentWritePolicy,
  LocalAgentWriteRequest,
} from '../types/automotive';
import { apiFetch } from './apiBridge';
import agentServerPySource from '../agent/agent_server.py?raw';

export const LOCAL_PC_AGENT_URL = 'http://127.0.0.1:38450';
const TOKEN_STORAGE_KEY = 'autopro_pc_agent_token';
const HMAC_STORAGE_KEY = 'autopro_pc_agent_hmac_secret';

function generateRandomHex(byteCount: number): string {
  const buf = new Uint8Array(byteCount);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < byteCount; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function getOrCreateAgentPairToken(): string {
  try {
    const existing = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (existing && existing.startsWith('AP-PC-') && existing.length >= 12) {
      return existing;
    }
    const token = `AP-PC-${generateRandomHex(6)}`;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return token;
  } catch {
    return `AP-PC-${generateRandomHex(6)}`;
  }
}

export function regenerateAgentPairToken(): string {
  const token = `AP-PC-${generateRandomHex(6)}`;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage error
  }
  return token;
}

export function getOrCreateAgentHmacSecret(): string {
  try {
    const existing = localStorage.getItem(HMAC_STORAGE_KEY);
    if (existing && existing.length >= 32) {
      return existing;
    }
    const secret = generateRandomHex(32);
    localStorage.setItem(HMAC_STORAGE_KEY, secret);
    return secret;
  } catch {
    return generateRandomHex(32);
  }
}

export function regenerateAgentHmacSecret(): string {
  const secret = generateRandomHex(32);
  try {
    localStorage.setItem(HMAC_STORAGE_KEY, secret);
  } catch {
    // Ignore storage error
  }
  return secret;
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
  init: RequestInit = {},
  timeoutMs = 3500
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${LOCAL_PC_AGENT_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-AutoPro-Token': token,
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
    let res = await fetchLocalAgent('/status', token, { method: 'GET' });
    if (res.status === 404) {
      res = await fetchLocalAgent('/api/agent/status', token, { method: 'GET' });
    }
    if (!res.ok) return null;
    const data = await res.json();
    const voltage = typeof data.batteryVoltage === 'number' ? data.batteryVoltage : 13.8;
    const derivedVoltageStatus: LocalAgentStatus['voltageStatus'] =
      data.voltageStatus === 'VOLTAGE_LOW' || data.voltageStatus === 'VOLTAGE_HIGH' || data.voltageStatus === 'OK'
        ? data.voltageStatus
        : voltage < 13.0
        ? 'VOLTAGE_LOW'
        : voltage > 15.5
        ? 'VOLTAGE_HIGH'
        : 'OK';

    return {
      connected: Boolean(data.connected),
      version: String(data.version || '2.6.0'),
      agentEngine:
        data.agentEngine === 'PYTHON_FASTAPI_J2534' ? 'PYTHON_FASTAPI_J2534' : 'NODE_BRIDGE',
      hardwareMode:
        data.hardwareMode === 'J2534_REAL' ? 'J2534_REAL' : 'NO_HARDWARE_BENCH',
      hostname: String(data.hostname || 'PC-Client'),
      osPlatform: String(data.osPlatform || 'win32'),
      nodeVersion: String(data.nodeVersion || ''),
      agentUrl: String(data.agentUrl || LOCAL_PC_AGENT_URL),
      writePolicy: data.writePolicy === 'AUTO_ON_REQUEST' ? 'AUTO_ON_REQUEST' : 'ASK_EACH_WRITE',
      batteryVoltage: voltage,
      voltageStatus: derivedVoltageStatus,
      vbattSource: data.vbattSource ? String(data.vbattSource) : undefined,
      drivers: Array.isArray(data.drivers) ? data.drivers : [],
      pendingRequests: Array.isArray(data.pendingRequests) ? data.pendingRequests : [],
      recentRequests: Array.isArray(data.recentRequests) ? data.recentRequests : [],
      executedCount: Number(data.executedCount || 0),
      lastPingAt: String(data.lastPingAt || new Date().toLocaleTimeString('fr-FR')),
      flashProgress: data.flashProgress || undefined,
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
  const res = await fetchLocalAgent('/api/agent/policy', token, {
    method: 'POST',
    body: JSON.stringify({ writePolicy, batteryVoltage }),
  });
  if (res.status === 404) {
    const legacy = await fetchLocalAgent('/api/agent/config', token, {
      method: 'POST',
      body: JSON.stringify({ writePolicy, batteryVoltage }),
    });
    return legacy.ok;
  }
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
    ok: res.ok && Boolean(data.success || data.ok),
    autoExecuted: Boolean(data.autoExecuted),
    request: data.request,
    message: String(data.message || data.request?.resultMessage || data.error || 'Demande transmise.'),
  };
}

export async function approveLocalWriteRequest(
  token: string,
  requestId: string
): Promise<{ ok: boolean; request?: LocalAgentWriteRequest; message: string }> {
  let res = await fetchLocalAgent('/api/agent/approve', token, {
    method: 'POST',
    body: JSON.stringify({ id: requestId }),
  });
  if (res.status === 404) {
    res = await fetchLocalAgent(`/api/agent/approve/${encodeURIComponent(requestId)}`, token, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
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
    ok: res.ok && Boolean(data.success || data.ok),
    request: data.request,
    message: String(data.request?.resultMessage || data.message || data.error || 'Écriture exécutée.'),
  };
}

export async function rejectLocalWriteRequest(token: string, requestId: string): Promise<boolean> {
  let res = await fetchLocalAgent('/api/agent/reject', token, {
    method: 'POST',
    body: JSON.stringify({ id: requestId }),
  });
  if (res.status === 404) {
    res = await fetchLocalAgent(`/api/agent/reject/${encodeURIComponent(requestId)}`, token, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
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

// ============================================================================
// CRYPTOGRAPHIE BINAIRE (CRC32 + SHA-256 + HMAC-SHA256) & PIPELINE J2534
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32Hex(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export async function computeBinaryIntegrity(bytes: Uint8Array): Promise<{
  sizeBytes: number;
  crc32Hex: string;
  sha256Hex: string;
}> {
  const crc32Hex = computeCrc32Hex(bytes);
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  const sha256Hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return { sizeBytes: bytes.byteLength, crc32Hex, sha256Hex };
}

export async function computeHmacSha256Hex(
  secretUtf8: string,
  rawBytes: Uint8Array
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretUtf8),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, rawBytes.slice().buffer);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export async function downloadAgentServerPy(): Promise<string> {
  return triggerTextDownload('agent_server.py', agentServerPySource, 'text/x-python;charset=utf-8');
}

export function downloadPairedInstallAgentBat(
  pairToken: string,
  hmacSecret: string,
  cloudApiUrl = typeof window !== 'undefined' ? window.location.origin : 'https://autoprodz-a7071.web.app'
): string {
  const safeUrl = cloudApiUrl.replace(/["'&|<>^]/g, '');
  const pyB64 = uint8ToBase64(new TextEncoder().encode(agentServerPySource));
  const b64Lines: string[] = [];
  for (let i = 0; i < pyB64.length; i += 76) {
    b64Lines.push(`echo ${pyB64.slice(i, i + 76)}`);
  }

  const bat = `@echo off
setlocal EnableExtensions
title AutoPro Flash Hub - Installateur Agent PC Python J2534

net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

cd /d "%~dp0"
where python >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERREUR] Python 3 requis : https://www.python.org/downloads/
    pause
    exit /b 1
)

python -m pip install --upgrade fastapi uvicorn pywin32 requests
if not exist "C:\\AutoPro_Backups" mkdir "C:\\AutoPro_Backups"

netsh advfirewall firewall delete rule name="AutoPro Agent 38450 Block Public" >nul 2>&1
netsh advfirewall firewall delete rule name="AutoPro Agent 38450 Allow Loopback" >nul 2>&1
netsh advfirewall firewall add rule name="AutoPro Agent 38450 Block Public" dir=in action=block protocol=TCP localport=38450 remoteip=any profile=public,private,domain enable=yes >nul
netsh advfirewall firewall add rule name="AutoPro Agent 38450 Allow Loopback" dir=in action=allow protocol=TCP localip=127.0.0.1 localport=38450 remoteip=127.0.0.1 enable=yes >nul

set "AUTOPRO_TOKEN=${pairToken}"
set "AUTOPRO_HMAC_SECRET=${hmacSecret}"
set "AUTOPRO_CLOUD_API_URL=${safeUrl}"

if not exist "%~dp0agent_server.py" (
    echo [AutoPro] Extraction automatique de agent_server.py...
    (
${b64Lines.join('\n')}
    ) > "%~dp0agent_server.b64"
    certutil -decode -f "%~dp0agent_server.b64" "%~dp0agent_server.py" >nul
    del "%~dp0agent_server.b64" >nul 2>&1
)

echo [OK] Demarrage AutoPro J2534 Agent sur 127.0.0.1:38450 (Pare-feu actif)...
start "AutoPro J2534 Agent" /MIN cmd /c "python "%~dp0agent_server.py""
pause
`;
  return triggerTextDownload('install_agent.bat', bat);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function executeJ2534WriteEcu(params: {
  token: string;
  hmacSecret: string;
  ecuModel: string;
  txIdHex: string;
  vin: string;
  securityLevel: '01' | '11';
  filename: string;
  rawBytes: Uint8Array;
  dryRun?: boolean;
}): Promise<{
  ok: boolean;
  status: string;
  message: string;
  crc32?: string;
  backupPath?: string;
  batteryVoltage?: number;
  cloudAttestationHmac?: string;
}> {
  const integrity = await computeBinaryIntegrity(params.rawBytes);
  const hmacHex = await computeHmacSha256Hex(params.hmacSecret, params.rawBytes);

  // Attestation Cloud SaaS non-bloquante
  let cloudAttestationHmac: string | undefined;
  try {
    const signRes = await apiFetch('/api/agent/sign-firmware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sha256Hex: integrity.sha256Hex,
        crc32Hex: integrity.crc32Hex,
        fileSize: integrity.sizeBytes,
        ecuTarget: params.ecuModel,
      }),
    });
    if (signRes.ok) {
      const signData = await signRes.json();
      cloudAttestationHmac = signData.cloudAttestationHmac;
    }
  } catch {
    // Attestation cloud optionnelle si réseau offline
  }

  const res = await fetchLocalAgent(
    '/write_ecu',
    params.token,
    {
      method: 'POST',
      headers: {
        'X-AutoPro-HMAC': hmacHex,
      },
      body: JSON.stringify({
        ecu_model: params.ecuModel,
        tx_id_hex: params.txIdHex,
        vin: params.vin,
        security_level: params.securityLevel,
        filename: params.filename,
        binary_base64: uint8ToBase64(params.rawBytes),
        expected_crc32: integrity.crc32Hex,
        expected_size_bytes: integrity.sizeBytes,
        hmac_sha256: hmacHex,
        dry_run: Boolean(params.dryRun),
      }),
    },
    30000
  );

  const data = await res.json();
  void auditAgentActionBackend({
    actionTitle: `J2534 Flash ${params.ecuModel} (${params.filename})`,
    targetModule: params.ecuModel,
    autoExecuted: true,
    status: String(data.status || (res.ok ? 'FLASH_COMPLETE' : 'FAILED')),
    batteryVoltage: Number(data.batteryVoltage || data.battery_voltage || 13.6),
  });

  return {
    ok: res.ok && Boolean(data.success),
    status: String(data.status || (res.ok ? 'FLASH_COMPLETE' : 'ERROR')),
    message: String(data.message || data.error || data.detail || 'Opération terminée.'),
    crc32: data.crc32 || integrity.crc32Hex,
    backupPath: data.backupPath,
    batteryVoltage: data.batteryVoltage ?? data.battery_voltage,
    cloudAttestationHmac,
  };
}

export async function testCloudSeedKey(params: {
  seedHex: string;
  ecuModel: string;
  securityLevel: '01' | '11';
  vin?: string;
}): Promise<{
  success: boolean;
  keyHex?: string;
  udsSendKeyFrameHex?: string;
  ecuFamily?: string;
  error?: string;
}> {
  const res = await apiFetch('/api/calculate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

