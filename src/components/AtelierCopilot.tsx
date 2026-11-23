import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Cpu,
  Download,
  FileCheck2,
  KeyRound,
  Lock,
  OctagonAlert,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  UploadCloud,
  Wifi,
  WifiOff,
} from 'lucide-react';

// ==============================================================================
// TYPES & CONSTANTES (FRANÇAIS + DARIJA ALGÉRIENNE)
// ==============================================================================

type WhitelistIhu = 'IHU624G' | 'IHU715P' | 'IHU535G' | 'IHU510G' | 'FLYME AUTO 2.5.0';
type TargetLang = 'fr' | 'ar' | 'darija';
type EcuModel = 'MG1US008' | 'MG1CS080';
type CalibrationProfile = 'EXPORT_DZ_174' | 'ANTI_LSPI_177' | 'ORI_RESTORE';

interface AdapterInfo {
  kind: string;
  name: string;
  vendor?: string;
  path?: string;
  reason?: string;
}

interface TelemetryState {
  connected: boolean;
  reconnecting: boolean;
  agentVersion: string | null;
  batteryVoltage: number | null;
  detectedIhu: string | null;
  activeInterface: string | null;
  certifiedAdapters: AdapterInfo[];
  rejectedAdapters: AdapterInfo[];
  factoryCodes: string[];
}

interface CopilotLogEntry {
  id: string;
  time: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  messageFr: string;
  messageDarija: string;
}

interface EcuDropReport {
  fileName: string;
  sizeBytes: number;
  sha256: string;
  entropy: number;
  extractedVin: string | null;
  valid: boolean;
  errorFr?: string;
  errorDarija?: string;
  rawBase64?: string;
}

interface WorkshopSession {
  jwt: string;
  workshopName: string;
  email: string;
  role: string;
  credits: number;
}

const DEFAULT_WS_URL = 'ws://127.0.0.1:8765';
const DEFAULT_API_URL = 'http://127.0.0.1:8000';
const VALID_ECU_SIZES = new Set([4096 * 1024, 8192 * 1024]);

const IHU_OPTIONS: WhitelistIhu[] = [
  'IHU624G',
  'IHU715P',
  'IHU535G',
  'IHU510G',
  'FLYME AUTO 2.5.0',
];

const FIVE_PHASES_GUIDE: Array<{
  phase: number;
  titleFr: string;
  titleDarija: string;
  descFr: string;
  descDarija: string;
}> = [
  {
    phase: 1,
    titleFr: 'Phase 1 — Liaison Agent PC & Whitelist IHU',
    titleDarija: 'المرحلة 1 — ربط الوكيل المحلي وفحص الكارط مير IHU',
    descFr:
      'Vérifie l’interface OBD/J2534 certifiée et exécute adb shell getprop pour confirmer le modèle exact de carte mère.',
    descDarija:
      'يفحص جهاز السكانير المعتمد ويتأكد عبر adb getprop من نوع الشاشة الصينية باش ما يكونش خلط.',
  },
  {
    phase: 2,
    titleFr: 'Phase 2 — Watchdog Tension (13.5V–13.8V)',
    titleDarija: 'المرحلة 2 — مراقبة البطارية (13.5V–13.8V)',
    descFr:
      'Contrôle continu de la batterie : blocage automatique strict sous 13.0V ou au-dessus de 14.8V.',
    descDarija:
      'مراقبة مستمرة للفولطاج: يتبلوكا أوتوماتيكياً تحت 13.0V ولا فوق 14.8V باش ما ينحرقش الكومبيوتر.',
  },
  {
    phase: 3,
    titleFr: 'Phase 3 — Backup Atomique & SHA-256',
    titleDarija: 'المرحلة 3 — نسخة احتياطية كاملة وبصمة SHA-256',
    descFr:
      'Crée backup_cockpit_[VIN]_[TS] (props, réglages, DSP audio, VIN F190) et contrôle chaque empreinte SHA-256.',
    descDarija:
      'يسحب ملفات الشاشة والصوت DSP والـ VIN ويفيريفي البصمة الرقمية لكل ملف قبل ما يكمّل.',
  },
  {
    phase: 4,
    titleFr: 'Phase 4 — Injection AES-256 /data/app & Secure Wipe',
    titleDarija: 'المرحلة 4 — حقن الترجمة والتطبيقات في /data/app وتنظيف الذاكرة',
    descFr:
      'Déchiffre le pack FR/AR/Darija en RAM uniquement (/system et /vendor verrouillés), injecte et efface les traces RAM/disque.',
    descDarija:
      'يفك التشفير في الذاكرة برك بلا ما يمس /system ولا /vendor، يثبّت اللغة وينظف الملفات المؤقتة فوراً.',
  },
  {
    phase: 5,
    titleFr: 'Phase 5 — Soft Reset UDS (0x11 0x01) & Audit 0 DTC',
    titleDarija: 'المرحلة 5 — إعادة تشغيل UDS وفحص 0 أعطال (DTC)',
    descFr:
      'Envoie 0x11 0x01, vérifie la lecture DTC et enregistre l’intervention complète dans l’historique SaaS.',
    descDarija:
      'يبعث أمر Reset ويتأكد بلي ما كانش أعطال (0 DTC) ويسجل العملية في السجل الآمن.',
  },
];

// ==============================================================================
// UTILITAIRES CRYPTO & VALIDATION BINAIRE CÔTÉ NAVIGATEUR
// ==============================================================================

async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const cleanCopy = new Uint8Array(bytes.byteLength);
  cleanCopy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', cleanCopy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function computeShannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const freq = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i++) {
    freq[bytes[i]]++;
  }
  let entropy = 0;
  const total = bytes.length;
  for (let i = 0; i < 256; i++) {
    if (freq[i] > 0) {
      const p = freq[i] / total;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

function extractVinFromBinary(bytes: Uint8Array): string | null {
  const vinRegex = /\b[A-HJ-NPR-Z0-9]{17}\b/;
  const chunk = new TextDecoder('ascii', { fatal: false }).decode(
    bytes.subarray(0, Math.min(bytes.length, 2 * 1024 * 1024))
  );
  const match = chunk.match(vinRegex);
  return match ? match[0] : null;
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ==============================================================================
// COMPOSANT PRINCIPAL : ATELIER COPILOT
// ==============================================================================

export const AtelierCopilot: React.FC = () => {
  // Config connexions locales / SaaS
  const [backendUrl, setBackendUrl] = useState<string>(DEFAULT_API_URL);
  const [hmacSecret, setHmacSecret] = useState<string>('AUTOPRO_DZ_LOCAL_SESSION_KEY_2026');
  const [loginEmail, setLoginEmail] = useState<string>('atelier@autoprodz.dz');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [workshopSession, setWorkshopSession] = useState<WorkshopSession | null>(null);

  // Télémétrie temps réel WebSocket
  const [telemetry, setTelemetry] = useState<TelemetryState>({
    connected: false,
    reconnecting: false,
    agentVersion: null,
    batteryVoltage: null,
    detectedIhu: null,
    activeInterface: null,
    certifiedAdapters: [],
    rejectedAdapters: [],
    factoryCodes: [],
  });

  // États guide 5 phases & opérations Cockpit
  const [selectedIhu, setSelectedIhu] = useState<WhitelistIhu>('IHU624G');
  const [targetLang, setTargetLang] = useState<TargetLang>('fr');
  const [vinInput, setVinInput] = useState<string>('L6T7824Z9RZ001540');
  const [activePhase, setActivePhase] = useState<number>(0);
  const [isExecutingCockpit, setIsExecutingCockpit] = useState<boolean>(false);
  const [emergencyHalted, setEmergencyHalted] = useState<boolean>(false);

  // Journal temps réel bilingue FR + Darija
  const [logs, setLogs] = useState<CopilotLogEntry[]>([]);

  // État Drag & Drop ECU Bench
  const [ecuModel, setEcuModel] = useState<EcuModel>('MG1US008');
  const [calProfile, setCalProfile] = useState<CalibrationProfile>('ANTI_LSPI_177');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [ecuReport, setEcuReport] = useState<EcuDropReport | null>(null);
  const [ecuProcessing, setEcuProcessing] = useState<boolean>(false);
  const [lockedJobUid, setLockedJobUid] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushLog = useCallback(
    (
      level: CopilotLogEntry['level'],
      messageFr: string,
      messageDarija: string
    ) => {
      const entry: CopilotLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: new Date().toLocaleTimeString('fr-FR'),
        level,
        messageFr,
        messageDarija,
      };
      setLogs((prev) => [entry, ...prev].slice(0, 80));
    },
    []
  );

  // ----------------------------------------------------------------------------
  // CONNEXION WEBSOCKET TEMPS RÉEL AVEC RECONNEXION AUTOMATIQUE (127.0.0.1:8765)
  // ----------------------------------------------------------------------------
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    setTelemetry((prev) => ({ ...prev, reconnecting: true }));
    const ws = new WebSocket(DEFAULT_WS_URL);
    wsRef.current = ws;

    ws.onopen = async () => {
      reconnectAttemptRef.current = 0;
      const nonce = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const hmacToken = await computeHmacSha256Hex(hmacSecret, nonce);
      ws.send(
        JSON.stringify({
          action: 'AUTH',
          nonce,
          hmac_token: hmacToken,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'auth_ok' || msg.type === 'telemetry') {
          setTelemetry((prev) => ({
            ...prev,
            connected: true,
            reconnecting: false,
            agentVersion: msg.agent_version || prev.agentVersion,
            batteryVoltage:
              typeof msg.battery_voltage === 'number'
                ? msg.battery_voltage
                : msg.battery_voltage === null
                ? null
                : prev.batteryVoltage,
            detectedIhu: msg.detected_ihu || prev.detectedIhu,
            activeInterface: msg.adapters?.active_interface ?? prev.activeInterface,
            certifiedAdapters: msg.adapters?.certified || prev.certifiedAdapters,
            rejectedAdapters: msg.adapters?.rejected || prev.rejectedAdapters,
            factoryCodes: msg.factory_codes || prev.factoryCodes,
          }));
          if (msg.type === 'auth_ok') {
            pushLog('SUCCESS', msg.message_fr, msg.message_darija);
          }
        } else if (msg.type === 'step') {
          setActivePhase(Number(msg.phase) || 1);
          pushLog('INFO', msg.message_fr, msg.message_darija);
        } else if (msg.type === 'firewall_blocked' || msg.type === 'error') {
          setIsExecutingCockpit(false);
          pushLog('CRITICAL', msg.message_fr, msg.message_darija);
        } else if (msg.type === 'emergency_stopped') {
          setIsExecutingCockpit(false);
          setEmergencyHalted(true);
          pushLog('CRITICAL', msg.message_fr, msg.message_darija);
        } else if (msg.type === 'cockpit_complete') {
          setIsExecutingCockpit(false);
          setActivePhase(5);
          pushLog('SUCCESS', msg.message_fr, msg.message_darija);
        } else if (msg.type === 'ecu_complete') {
          setEcuProcessing(false);
          setLockedJobUid(msg.job_uid || null);
          if (typeof msg.remaining_credits === 'number') {
            setWorkshopSession((prev) =>
              prev ? { ...prev, credits: msg.remaining_credits } : prev
            );
          }
          pushLog('SUCCESS', msg.message_fr, msg.message_darija);
        }
      } catch {
        // Ignorer trames non-JSON
      }
    };

    ws.onclose = () => {
      setTelemetry((prev) => ({
        ...prev,
        connected: false,
        reconnecting: true,
      }));
      const delayMs = Math.min(10000, 1500 * Math.pow(2, reconnectAttemptRef.current));
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        connectWebSocket();
      }, delayMs);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [hmacSecret, pushLog]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // ----------------------------------------------------------------------------
  // AUTHENTIFICATION JWT SAAS BACKEND
  // ----------------------------------------------------------------------------
  const handleLoginWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || 'Connexion refusée.');
        return;
      }
      setWorkshopSession({
        jwt: data.access_token,
        workshopName: data.workshop.workshop_name,
        email: data.workshop.email,
        role: data.workshop.role,
        credits: data.workshop.credits,
      });
      pushLog(
        'SUCCESS',
        `Session SaaS ouverte : ${data.workshop.workshop_name} (${data.workshop.credits} crédits).`,
        `تم فتح الحساب بنجاح (${data.workshop.credits} رصيد).`
      );
    } catch {
      setAuthError('Serveur Backend API inaccessible.');
    }
  };

  // ----------------------------------------------------------------------------
  // CONTRÔLE JAUGE TENSION BATTERIE (13.5V–13.8V OK / BLOCAGE < 13.0V)
  // ----------------------------------------------------------------------------
  const voltageGuard = useMemo(() => {
    const v = telemetry.batteryVoltage;
    if (v === null) {
      return {
        blocked: true,
        labelFr: 'Tension non mesurée (Interface requise)',
        labelDarija: 'ماكانش قياس البطارية (ربط السكانير)',
        colorClass: 'border-rose-500/60 bg-rose-950/40 text-rose-300',
        barClass: 'bg-rose-500',
        pct: 0,
      };
    }
    if (v < 13.0 || v > 14.8) {
      return {
        blocked: true,
        labelFr: `BLOQUÉ (${v.toFixed(2)}V hors plage 13.0V–14.8V)`,
        labelDarija: `بلوكاج أمان (${v.toFixed(2)}V — الفولطاج مشي آمن)`,
        colorClass: 'border-rose-500 bg-rose-950/60 text-rose-200',
        barClass: 'bg-rose-500',
        pct: Math.min(100, Math.max(8, ((v - 11) / 4) * 100)),
      };
    }
    const isIdeal = v >= 13.5 && v <= 13.8;
    return {
      blocked: false,
      labelFr: isIdeal ? `${v.toFixed(2)}V OK (Idéal Stabilisé)` : `${v.toFixed(2)}V OK (Sous surveillance)`,
      labelDarija: isIdeal ? `${v.toFixed(2)}V ممتاز ومستقر` : `${v.toFixed(2)}V مقبول`,
      colorClass: isIdeal
        ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
        : 'border-amber-500/60 bg-amber-950/40 text-amber-300',
      barClass: isIdeal ? 'bg-emerald-500' : 'bg-amber-400',
      pct: Math.min(100, Math.max(20, ((v - 11) / 4) * 100)),
    };
  }, [telemetry.batteryVoltage]);

  // ----------------------------------------------------------------------------
  // LANCEMENT FLASH COCKPIT SÉCURISÉ + ARRÊT D'URGENCE
  // ----------------------------------------------------------------------------
  const handleStartCockpitWorkflow = async () => {
    if (!telemetry.connected || !wsRef.current || voltageGuard.blocked || !workshopSession) {
      return;
    }
    setEmergencyHalted(false);
    setIsExecutingCockpit(true);
    setActivePhase(1);

    try {
      const detectedToCheck = telemetry.detectedIhu || selectedIhu;
      const authRes = await fetch(`${backendUrl}/api/cockpit/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${workshopSession.jwt}`,
        },
        body: JSON.stringify({
          vin: vinInput.trim().toUpperCase(),
          selected_ihu: selectedIhu,
          detected_ihu: detectedToCheck,
          target_lang: targetLang,
          battery_voltage: telemetry.batteryVoltage,
        }),
      });
      const authData = await authRes.json();
      if (!authRes.ok || !authData.authorized) {
        setIsExecutingCockpit(false);
        pushLog(
          'CRITICAL',
          authData.detail || 'Autorisation Cloud refusée.',
          'السيرفر رفض الترخيص — تحقّق من الرصيد وتطابق IHU.'
        );
        return;
      }

      if (typeof authData.remaining_credits === 'number') {
        setWorkshopSession((prev) =>
          prev ? { ...prev, credits: authData.remaining_credits } : prev
        );
      }

      wsRef.current.send(
        JSON.stringify({
          action: 'RUN_COCKPIT_FLASH',
          selected_ihu: selectedIhu,
          vin: vinInput.trim().toUpperCase(),
          target_lang: targetLang,
          encrypted_pack_b64: authData.encrypted_pack_b64,
          aes_key_b64: authData.aes_key_b64,
          nonce_b64: authData.nonce_b64,
          jwt_token: workshopSession.jwt,
        })
      );
    } catch {
      setIsExecutingCockpit(false);
      pushLog(
        'CRITICAL',
        'Erreur de communication avec le Backend Cloud pendant l’autorisation.',
        'انقطع الاتصال بالسيرفر أثناء طلب الترخيص.'
      );
    }
  };

  const handleEmergencyStop = () => {
    setEmergencyHalted(true);
    setIsExecutingCockpit(false);
    setEcuProcessing(false);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'EMERGENCY_STOP' }));
    }
    pushLog(
      'CRITICAL',
      'ARRÊT D’URGENCE ACTIVÉ : Toute écriture bloquée.',
      'توقف طارئ مفعّل: تم إيقاف كل العمليات لحماية السيارة.'
    );
  };

  // ----------------------------------------------------------------------------
  // DRAG & DROP SÉCURISÉ POUR DUMPS ECU (MG1US008 / MG1CS080)
  // ----------------------------------------------------------------------------
  const inspectEcuFile = async (file: File) => {
    setLockedJobUid(null);
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sizeBytes = bytes.byteLength;

    if (!VALID_ECU_SIZES.has(sizeBytes)) {
      setEcuReport({
        fileName: file.name,
        sizeBytes,
        sha256: await computeSha256Hex(bytes),
        entropy: 0,
        extractedVin: null,
        valid: false,
        errorFr: `Taille refusée (${Math.round(sizeBytes / 1024)} Ko). Seuls les dumps complets de 4096 Ko ou 8192 Ko sont acceptés.`,
        errorDarija: `حجم الملف مرفوض (${Math.round(sizeBytes / 1024)} Ko). لازم يكون 4096 Ko ولا 8192 Ko كامل.`,
      });
      return;
    }

    let zeroCount = 0;
    let ffCount = 0;
    for (let i = 0; i < sizeBytes; i++) {
      if (bytes[i] === 0x00) zeroCount++;
      else if (bytes[i] === 0xff) ffCount++;
    }
    if (zeroCount / sizeBytes > 0.98 || ffCount / sizeBytes > 0.98) {
      setEcuReport({
        fileName: file.name,
        sizeBytes,
        sha256: await computeSha256Hex(bytes),
        entropy: 0,
        extractedVin: null,
        valid: false,
        errorFr: 'Fichier vide ou corrompu (>98% de 0x00 ou 0xFF) rejeté.',
        errorDarija: 'ملف فارغ أو فاسد (كامل أصفار 0x00 ولا 0xFF) — مرفوض!',
      });
      return;
    }

    const entropy = computeShannonEntropy(bytes);
    if (entropy < 3.5) {
      setEcuReport({
        fileName: file.name,
        sizeBytes,
        sha256: await computeSha256Hex(bytes),
        entropy,
        extractedVin: null,
        valid: false,
        errorFr: `Entropie trop faible (${entropy.toFixed(2)} bits/octet). Dump incomplet.`,
        errorDarija: 'الملف ناقص (Entropie ضعيفة) — عاود القراءة في Bench.',
      });
      return;
    }

    const sha256 = await computeSha256Hex(bytes);
    const extractedVin = extractVinFromBinary(bytes);
    if (extractedVin) {
      setVinInput(extractedVin);
    }

    setEcuReport({
      fileName: file.name,
      sizeBytes,
      sha256,
      entropy: Number(entropy.toFixed(3)),
      extractedVin,
      valid: true,
      rawBase64: arrayBufferToBase64(bytes),
    });

    pushLog(
      'INFO',
      `Dump ${file.name} vérifié (${Math.round(sizeBytes / 1024)} Ko · Entropie ${entropy.toFixed(2)}).`,
      `تم فحص الملف ${file.name} بنجاح (${Math.round(sizeBytes / 1024)} Ko).`
    );
  };

  const handleSubmitEcuToCloud = async () => {
    if (!ecuReport?.valid || !ecuReport.rawBase64 || !workshopSession) return;
    setEcuProcessing(true);
    setLockedJobUid(null);

    try {
      const res = await fetch(`${backendUrl}/api/ecu/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${workshopSession.jwt}`,
        },
        body: JSON.stringify({
          vin: vinInput.trim().toUpperCase(),
          ecu_model: ecuModel,
          calibration_profile: calProfile,
          original_sha256: ecuReport.sha256,
          size_bytes: ecuReport.sizeBytes,
          entropy: ecuReport.entropy,
          binary_b64: ecuReport.rawBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushLog(
          'CRITICAL',
          data.detail || 'Traitement ECU refusé par le serveur.',
          'السيرفر رفض معالجة ملف الكمبيوتر.'
        );
        return;
      }

      setLockedJobUid(data.job_uid);
      if (typeof data.remaining_credits === 'number') {
        setWorkshopSession((prev) =>
          prev ? { ...prev, credits: data.remaining_credits } : prev
        );
      }
      pushLog(
        'SUCCESS',
        `Dump ${ecuModel} lié au VIN ${data.vin} (HMAC ${String(data.vin_binding_hmac).slice(0, 12)}...).`,
        `تم ربط ملف ${ecuModel} برقم الشاسي ${data.vin} بنجاح.`
      );
    } catch {
      pushLog(
        'CRITICAL',
        'Impossible de joindre le Backend API pour traiter le dump ECU.',
        'تعذر الاتصال بالسيرفر لمعالجة الملف.'
      );
    } finally {
      setEcuProcessing(false);
    }
  };

  const handleDownloadLockedEcu = async () => {
    if (!lockedJobUid || !workshopSession) return;
    const res = await fetch(`${backendUrl}/api/ecu/jobs/${lockedJobUid}/download`, {
      headers: { Authorization: `Bearer ${workshopSession.jwt}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${vinInput.trim().toUpperCase()}_${ecuModel}_${calProfile}_LOCKED.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // RENDU INTERFACE COPILOTE (TAILWIND CSS)
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* En-tête + Arrêt d'Urgence + Connexion Agent/SaaS */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-extrabold text-[11px] uppercase">
              COPILOTE AGENT PC + CLOUD
            </span>
            <span
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold border flex items-center gap-1.5 ${
                telemetry.connected
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
              }`}
            >
              {telemetry.connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>
                {telemetry.connected
                  ? `Agent PC Connecté (${telemetry.agentVersion || 'ws://127.0.0.1:8765'})`
                  : telemetry.reconnecting
                  ? 'Reconnexion auto ws://127.0.0.1:8765...'
                  : 'Agent PC Hors-Ligne'}
              </span>
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-white">
            Atelier Copilote DZ — Contrôle Temps Réel (Français &amp; الدارجة)
          </h1>
          <p className="text-xs text-slate-400">
            Pilotage strict via Agent Local <code className="text-cyan-300">AutoPro_DZ_Agent.exe</code> + Pare-feu Anti-Bricking (IHU, Tension 13.5–13.8V, AES-256 RAM, Bench MG1).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => wsRef.current?.send(JSON.stringify({ action: 'SCAN_HARDWARE' }))}
            disabled={!telemetry.connected}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-cyan-300 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Scanner Matériel</span>
          </button>

          <button
            type="button"
            onClick={handleEmergencyStop}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/60"
          >
            <OctagonAlert className="w-4 h-4" />
            <span>ARRÊT D&apos;URGENCE / توقف طارئ</span>
          </button>
        </div>
      </div>

      {/* Connexion SaaS JWT & Solde Crédits */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        {!workshopSession ? (
          <form onSubmit={handleLoginWorkshop} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">URL Backend API</label>
              <input
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Secret HMAC Agent</label>
              <input
                type="password"
                value={hmacSecret}
                onChange={(e) => setHmacSecret(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Email Atelier</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Mot de passe</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="AtelierDZ#2026"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <button
              type="submit"
              className="py-2 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Connexion SaaS</span>
            </button>
            {authError && (
              <div className="sm:col-span-5 text-rose-300 bg-rose-950/40 border border-rose-500/40 rounded-lg p-2">
                {authError}
              </div>
            )}
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="font-bold text-white block">{workshopSession.workshopName}</span>
                <span className="text-slate-400">{workshopSession.email} · Rôle {workshopSession.role.toUpperCase()}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3.5 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 font-bold">
                Crédits disponibles : {workshopSession.credits}
              </div>
              <button
                type="button"
                onClick={() => setWorkshopSession(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tableau de Bord Télémétrie en Direct (4 cartes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Jauge Tension Batterie */}
        <div className={`p-4 rounded-2xl border space-y-2 ${voltageGuard.colorClass}`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <BatteryCharging className="w-4 h-4" />
              <span>Tension Batterie</span>
            </span>
            <span className="font-mono">
              {telemetry.batteryVoltage !== null ? `${telemetry.batteryVoltage.toFixed(2)}V` : '--.-V'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
            <div className={`h-full transition-all ${voltageGuard.barClass}`} style={{ width: `${voltageGuard.pct}%` }} />
          </div>
          <div className="text-[11px] font-semibold">{voltageGuard.labelFr}</div>
          <div className="text-[11px] opacity-90 text-right" dir="rtl">{voltageGuard.labelDarija}</div>
        </div>

        {/* Référence Carte Mère / IHU */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Carte Mère / IHU Détectée</span>
          </span>
          <div className="text-base font-bold font-mono text-white">
            {telemetry.detectedIhu || 'En attente ADB getprop'}
          </div>
          <span className="text-[11px] text-slate-400 block">
            Sélectionné : <strong className="text-cyan-300">{selectedIhu}</strong>
          </span>
        </div>

        {/* Interface OBD / J2534 */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Interface OBD / J2534</span>
          </span>
          <div className="text-sm font-bold text-white truncate">
            {telemetry.activeInterface || 'Aucune interface certifiée'}
          </div>
          {telemetry.rejectedAdapters.length > 0 && (
            <span className="text-[11px] text-rose-400 block">
              ⛔ {telemetry.rejectedAdapters.length} adaptateur(s) générique(s) bloqué(s)
            </span>
          )}
        </div>

        {/* Statut Pare-Feu & Arrêt Urgence */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Pare-Feu Anti-Bricking</span>
          </span>
          <div className={`text-sm font-bold ${emergencyHalted ? 'text-rose-400' : 'text-emerald-400'}`}>
            {emergencyHalted ? 'ARRÊT D’URGENCE ACTIF' : '/system & F190 Verrouillés RO'}
          </div>
          {emergencyHalted && (
            <button
              type="button"
              onClick={() => {
                setEmergencyHalted(false);
                wsRef.current?.send(JSON.stringify({ action: 'RESET_EMERGENCY' }));
              }}
              className="text-[11px] text-cyan-300 underline cursor-pointer"
            >
              Réarmer l&apos;Agent PC
            </button>
          )}
        </div>
      </div>

      {/* Grille Principale : Guide 5 Phases + Contrôles Cockpit | Drag & Drop ECU + Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Gauche : Configuration Cockpit + Guide 5 Phases Bilingue (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-white">
              1. Configuration Flash Cockpit Sécurisé (FR / AR / Darija)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Pack IHU Whitelist *</label>
                <select
                  value={selectedIhu}
                  onChange={(e) => setSelectedIhu(e.target.value as WhitelistIhu)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 font-bold"
                >
                  {IHU_OPTIONS.map((ihu) => (
                    <option key={ihu} value={ihu}>{ihu}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Langue Cible *</label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value as TargetLang)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-semibold"
                >
                  <option value="fr">Français</option>
                  <option value="ar">Arabe (العربية)</option>
                  <option value="darija">Darija DZ (الدارجة)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">N° Châssis (VIN) *</label>
                <input
                  type="text"
                  value={vinInput}
                  onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                  maxLength={17}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={
                !telemetry.connected ||
                voltageGuard.blocked ||
                !workshopSession ||
                isExecutingCockpit ||
                emergencyHalted
              }
              onClick={() => void handleStartCockpitWorkflow()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 text-slate-950 font-extrabold flex items-center justify-center gap-2 cursor-pointer"
            >
              {voltageGuard.blocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>BLOQUÉ : {voltageGuard.labelFr}</span>
                </>
              ) : isExecutingCockpit ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Exécution Phase {activePhase}/5 en cours...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Lancer Protocole Cockpit Sécurisé (5 Phases)</span>
                </>
              )}
            </button>
          </div>

          {/* Guide Pas-à-Pas Interactif en 5 Phases (FR + Darija) */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h2 className="text-sm font-bold text-white">
              2. Guide Atelier Pas-à-Pas (Français &amp; الدارجة الجزائرية)
            </h2>
            <div className="space-y-2.5">
              {FIVE_PHASES_GUIDE.map((step) => {
                const isDone = activePhase > step.phase || (activePhase === 5 && step.phase === 5 && !isExecutingCockpit);
                const isCurrent = activePhase === step.phase && isExecutingCockpit;
                return (
                  <div
                    key={step.phase}
                    className={`p-3.5 rounded-xl border text-xs space-y-1 transition-all ${
                      isDone
                        ? 'bg-emerald-950/30 border-emerald-500/50'
                        : isCurrent
                        ? 'bg-cyan-950/40 border-cyan-400'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {step.titleFr}
                      </span>
                      <span className="font-bold text-cyan-300" dir="rtl">{step.titleDarija}</span>
                    </div>
                    <p className="text-[11px] text-slate-300">{step.descFr}</p>
                    <p className="text-[11px] text-amber-200/90 text-right" dir="rtl">{step.descDarija}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Colonne Droite : Drag & Drop ECU Bench + Journal Temps Réel (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Drag & Drop Sécurisé Dumps ECU MG1US008 / MG1CS080 */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              <span>Dépôt Sécurisé Dump ECU Bench (MG1US008 / MG1CS080)</span>
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={ecuModel}
                onChange={(e) => setEcuModel(e.target.value as EcuModel)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-cyan-300 font-bold"
              >
                <option value="MG1US008">Bosch MG1US008 (4 cyl)</option>
                <option value="MG1CS080">Bosch MG1CS080 (3 cyl)</option>
              </select>
              <select
                value={calProfile}
                onChange={(e) => setCalProfile(e.target.value as CalibrationProfile)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-semibold"
              >
                <option value="ANTI_LSPI_177">Anti-LSPI 177 ch DZ</option>
                <option value="EXPORT_DZ_174">Export DZ 174 ch</option>
                <option value="ORI_RESTORE">Vérif / Backup ORI</option>
              </select>
            </div>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void inspectEcuFile(file);
              }}
              className={`block border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-950/30'
                  : 'border-slate-700 bg-slate-950/70 hover:border-slate-500'
              }`}
            >
              <input
                type="file"
                accept=".bin,.ori"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void inspectEcuFile(file);
                }}
              />
              <UploadCloud className="w-7 h-7 text-cyan-400 mx-auto mb-2" />
              <span className="font-bold text-white block">
                Glissez votre Full Backup (.bin — 4096 Ko ou 8192 Ko)
              </span>
              <span className="text-[11px] text-amber-300 block mt-1" dir="rtl">
                حط ملف الفول باكاب هنا (4096 أو 8192 Ko) للفحص والربط مع الشاسي
              </span>
            </label>

            {ecuReport && (
              <div
                className={`p-3 rounded-xl border space-y-1.5 ${
                  ecuReport.valid
                    ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {ecuReport.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className="truncate">{ecuReport.fileName}</span>
                </div>
                {ecuReport.valid ? (
                  <>
                    <div className="text-[11px] font-mono">
                      Taille : {Math.round(ecuReport.sizeBytes / 1024)} Ko · Entropie : {ecuReport.entropy} bits/o
                    </div>
                    <div className="text-[11px] font-mono truncate">SHA-256 : {ecuReport.sha256}</div>
                    <div className="text-[11px]">
                      VIN extrait : <strong>{ecuReport.extractedVin || `Saisi (${vinInput})`}</strong>
                    </div>
                    <button
                      type="button"
                      disabled={!workshopSession || ecuProcessing}
                      onClick={() => void handleSubmitEcuToCloud()}
                      className="w-full mt-2 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-extrabold cursor-pointer"
                    >
                      {ecuProcessing ? 'Traitement sécurisé...' : 'Valider & Lier au VIN (1 Crédit)'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-[11px]">{ecuReport.errorFr}</div>
                    <div className="text-[11px] text-right" dir="rtl">{ecuReport.errorDarija}</div>
                  </>
                )}
              </div>
            )}

            {lockedJobUid && (
              <button
                type="button"
                onClick={() => void handleDownloadLockedEcu()}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger Fichier Verrouillé VIN ({ecuModel})</span>
              </button>
            )}
          </div>

          {/* Journal d'activité en direct (FR + Darija) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-4 h-4" />
                <span>Journal Temps Réel (FR / الدارجة)</span>
              </span>
              <span className="text-slate-500 font-mono">{logs.length} evt</span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 text-[11px]">
              {logs.length === 0 ? (
                <div className="text-slate-500 py-4 text-center">
                  En attente d&apos;événements Agent PC / SaaS...
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-lg border ${
                      log.level === 'CRITICAL'
                        ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                        : log.level === 'SUCCESS'
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between text-[10px] opacity-70 font-mono mb-0.5">
                      <span>{log.level}</span>
                      <span>{log.time}</span>
                    </div>
                    <div>{log.messageFr}</div>
                    <div className="text-right opacity-90 mt-0.5" dir="rtl">{log.messageDarija}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
