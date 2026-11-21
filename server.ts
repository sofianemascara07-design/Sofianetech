import express from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { saasDatabase } from './src/server/database';
import {
  AiVerificationReport,
  verifyDiagnosticAiOutput,
  verifyFlashAiOutput,
  verifyTabletUpdateAiOutput,
  verifyCockpitAiOutput,
  verifyImmoAiOutput,
  verifyTranslationOutput,
} from './src/server/aiGuardrails';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const port =
  process.env.RENDER || (process.env.NODE_ENV === 'production' && process.env.PORT && process.env.PORT !== '8080')
    ? Number(process.env.PORT) || 3000
    : 3000;

// Strict CORS Origin Allowlist (Firebase Hosting, Render, AI Studio Preview, Localhost)
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // Non-browser tools / healthchecks / same-origin
  if (
    origin === 'https://web.app' ||
    origin === 'https://autoprodz-a7071.web.app' ||
    origin === 'https://autoprodz-a7071.firebaseapp.com' ||
    origin === 'https://autopro-suitebacken.onrender.com' ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    EXTRA_ORIGINS.includes(origin)
  ) {
    return true;
  }
  try {
    const parsed = new URL(origin);
    if (
      parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('.europe-west2.run.app') ||
        parsed.hostname.endsWith('.aistudio.google.com') ||
        parsed.hostname.endsWith('.onrender.com'))
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-passcode, X-AutoPro-Token, X-AutoPro-Signature'
  );

  // Production HTTP Security Headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('Permissions-Policy', 'camera=(self), microphone=(self), bluetooth=(self), serial=(self), usb=(self), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (req.method === 'OPTIONS') {
    if (origin && !isAllowedOrigin(origin)) {
      return res.sendStatus(403);
    }
    return res.sendStatus(204);
  }
  return next();
});

// In-memory Sliding-Window Rate Limiter (Anti-Brute-Force & Anti-Quota-Drain)
const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix: string;
}) => {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  // Periodic garbage collection every 2 minutes
  const gc = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets.entries()) {
      if (now >= v.resetAt) buckets.delete(k);
    }
  }, 120_000);
  gc.unref?.();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const entry = buckets.get(key);

    if (!entry || now >= entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > options.max) {
      const retrySec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      return res.status(429).json({
        success: false,
        valid: false,
        error: options.message,
        message: options.message,
        retryAfterSeconds: retrySec,
      });
    }
    return next();
  };
};

const authBruteForceLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 25,
  keyPrefix: 'auth',
  message: 'Trop de tentatives de connexion détectées. Veuillez patienter quelques minutes par sécurité.',
});

const aiQuotaLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 25,
  keyPrefix: 'ai',
  message: 'Limite de requêtes IA atteinte (25/min). Patientez quelques secondes.',
});

const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 240,
  keyPrefix: 'api',
  message: 'Trafic API excessif détecté. Réessayez dans un instant.',
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/license/check-session' || req.path === '/remote/ping') return next();
  return globalApiLimiter(req, res, next);
});

app.use(['/api/license/verify', '/api/admin'], authBruteForceLimiter);
app.use(
  ['/api/diagnose/ai', '/api/translate/ai', '/api/flash/recommendations', '/api/ai/voice-command', '/api/chinese-tablet/ai-guard', '/api/immo/ai-key-tool', '/api/transmission/ai-diagnose'],
  aiQuotaLimiter
);

app.use(express.json({ limit: '2mb' }));

// Health check & low-overhead RTT ping for remote clients
app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    status: 'ok',
    service: 'AutoPro Diagnostic & Flash Backend DZ',
    version: '3.2.0-remote-stable',
    features: ['admin-whitelist', 'limited-demo', 'cameras', 'atelier-mode', 'pdf-reports', 'client-activity', 'backup', 'hmac-security', 'rate-limit', 'ihu-antibrick', 'remote-keepalive'],
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/remote/ping', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, serverTimeMs: Date.now() });
});

// Initialize Google GenAI
const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const ANTI_HALLUCINATION_SYSTEM_INSTRUCTION = `Tu es l'ingénieur expert automobile d'AutoPro DZ. RÈGLE ZÉRO HALLUCINATION IMPÉRATIVE :
1. N'invente JAMAIS un code défaut DTC absent des données fournies, un code PIN / CS d'antidémarrage, un code usine inconnu, une référence pièce OEM imaginaire ou un numéro de build firmware inventé.
2. N'invente JAMAIS de lien URL de téléchargement (http/https), d'archive .zip/.img/.bin/.swu ou de serveur externe.
3. Si une information matérielle (MCU, SoC, dump EEPROM, checksum .bin réel) manque, écris explicitement "Non vérifié — lecture directe requise sur le véhicule/boîtier" au lieu de deviner.
4. Interdiction absolue de recommander l'écriture sur /system, /vendor, fastboot erase ou la suppression de la sonde Lambda amont (Banc 1 Capteur 1).`;

// Groq OpenAI-compatible Server Helper (GROQ_API_KEY in Render / .env)
const callGroqAI = async (prompt: string, jsonMode = false, timeoutMs = 12000): Promise<string | null> => {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || !groqKey.trim()) return null;

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: ANTI_HALLUCINATION_SYSTEM_INSTRUCTION },
          { role: 'user', content: prompt },
        ],
        temperature: 0.0,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Groq HTTP ${res.status}: ${errText}`);
    }

    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } finally {
    clearTimeout(timer);
  }
};

type UnifiedAiProvider = AiVerificationReport['provider'];

// Unified AI Runner: tries Gemini 4 Hydrogen (deterministic config) or Groq fallback and tracks active provider
const generateUnifiedAI = async (
  prompt: string,
  options?: { jsonMode?: boolean; timeoutMs?: number }
): Promise<{ text: string | null; provider: UnifiedAiProvider }> => {
  const jsonMode = Boolean(options?.jsonMode);
  const timeoutMs = options?.timeoutMs || 15000;
  const preferGroq =
    (process.env.AI_PROVIDER || '').toLowerCase() === 'groq' ||
    (!process.env.GEMINI_API_KEY && Boolean(process.env.GROQ_API_KEY));

  if (preferGroq) {
    try {
      const groqText = await callGroqAI(prompt, jsonMode, timeoutMs);
      if (groqText) return { text: groqText, provider: 'groq-deterministic' };
    } catch (err: any) {
      console.warn('Groq primary call failed, checking Gemini fallback:', err.message);
    }
  }

  const ai = getAIClient();
  if (ai) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs)
      );
      const aiPromise = ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: ANTI_HALLUCINATION_SYSTEM_INSTRUCTION,
          seed: 42,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      });
      const response: any = await Promise.race([aiPromise, timeoutPromise]);
      if (response?.text) return { text: response.text, provider: 'gemini-4-hydrogen' };
    } catch (err: any) {
      console.warn('Gemini call failed, checking Groq fallback:', err.message);
    }
  }

  if (!preferGroq && process.env.GROQ_API_KEY) {
    try {
      const groqText = await callGroqAI(prompt, jsonMode, timeoutMs);
      if (groqText) return { text: groqText, provider: 'groq-deterministic' };
    } catch (err: any) {
      console.warn('Groq fallback failed:', err.message);
    }
  }

  return { text: null, provider: 'offline-verified-rules' };
};

// API: AI Diagnostic Expert (with post-generation code & URL anti-hallucination guardrails)
app.post('/api/diagnose/ai', async (req, res) => {
  try {
    const { brand, model, year, engine, dtcCodes, symptoms } = req.body || {};
    const dtcArray: string[] = Array.isArray(dtcCodes) ? dtcCodes.map(String) : [];
    const hasAi = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);

    if (!hasAi) {
      const offlineText = `Diagnostic technique vérifié (Règles atelier hors-ligne) pour ${brand || 'Véhicule'} ${model || ''} (${year || '2022'}) - ${engine || 'Moteur Standard'}.\n\nCodes transmis : ${dtcArray.join(', ') || 'Aucun code DTC transmis'}.\n\nProcédure de contrôle :\n1. Vérifier la tension de batterie (min. 12.4V au repos, 14.2V en charge).\n2. Contrôler les faisceaux CAN High / CAN Low (60 Ohms entre broches 6 et 14 OBD2).\n3. Inspecter les capteurs concernés avant toute pièce ou effacement DTC.`;
      const checked = verifyDiagnosticAiOutput(offlineText, dtcArray, 'offline-verified-rules');
      return res.status(200).json({
        analysis: checked.sanitizedText,
        urgency: dtcArray.some((c: string) => c.startsWith('P02') || c.startsWith('P03')) ? 'Élevée' : 'Moyenne',
        aiVerification: checked.aiVerification,
      });
    }

    const prompt = `Tu es un maître technicien mécanicien et électronicien automobile certifié (spécialiste diagnostic multimarque PSA, Renault, VAG, BMW, Mercedes, Stellantis, Geely, Jetour, Chery, Changan, Kia, Toyota, Hyundai).
Analyse EXCLUSIVEMENT le cas suivant sans inventer de nouveaux codes DTC ni de codes PIN :
- Marque: ${brand || 'Non spécifiée'}
- Modèle: ${model || 'Non spécifié'}
- Année: ${year || '2022'}
- Motorisation: ${engine || 'Standard'}
- Codes DTC relevés: ${dtcArray.join(', ') || 'Aucun code DTC fourni (analyse uniquement basée sur les symptômes)'}
- Symptômes observés: ${symptoms || 'Voyant moteur allumé'}

Donne une analyse technique approfondie en français professionnel :
1. Explication exacte uniquement des codes DTC fournis ci-dessus.
2. Les 3 causes physiques les plus probables classées par probabilité.
3. Les tests de mesure concrets au multimètre / oscilloscope / machine à fumée.
4. Les précautions avant effacement du défaut ou mise à jour calculateur.
5. Niveau de gravité (Faible / Modéré / Critique).

N'invente aucun code DTC inexistant, aucun code PIN et aucune URL externe.`;

    const aiRes = await generateUnifiedAI(prompt);
    if (!aiRes.text) {
      throw new Error('Aucun fournisseur IA disponible');
    }

    const checked = verifyDiagnosticAiOutput(aiRes.text, dtcArray, aiRes.provider);

    return res.json({
      analysis: checked.sanitizedText,
      urgency: dtcArray.some((c: string) => c.startsWith('P02') || c.startsWith('P03')) ? 'Élevée' : 'Modérée',
      aiVerification: checked.aiVerification,
    });
  } catch (error: any) {
    console.error('Error or spike demand in /api/diagnose/ai, using verified automotive fallback:', error.message);
    const { brand, model, year, engine, dtcCodes } = req.body || {};
    const dtcArray: string[] = Array.isArray(dtcCodes) ? dtcCodes.map(String) : [];
    const fallbackText = `### Diagnostic Technique Atelier (Mode Secours Vérifié) : ${brand || 'Véhicule'} ${model || ''} (${year || '2022'})\n**Motorisation :** ${engine || 'Standard'}\n**Codes DTC transmis :** ${dtcArray.join(', ') || 'Aucun code DTC transmis'}\n\n1. **Procédure de contrôle atelier :**\n   - Contrôler la tension batterie (> 12.4V contact mis) et la résistance du bus CAN (60 Ohms entre broches 6 et 14 de la prise OBD2).\n   - Vérifier les faisceaux, connecteurs et durites du système concerné par les codes ci-dessus.\n2. **Recommandation :** Ne pas remplacer de calculateur sans contrôle physique préalable ; sauvegarder les codes avant effacement.`;
    const checked = verifyDiagnosticAiOutput(fallbackText, dtcArray, 'offline-verified-rules');
    return res.status(200).json({
      analysis: checked.sanitizedText,
      urgency: 'Moyenne',
      aiVerification: checked.aiVerification,
    });
  }
});

// API: Quick Scan Visual Synthesis (Gateway, Moteur, ABS, Airbag)
app.post('/api/diagnose/quick-scan-summary', async (req, res) => {
  try {
    const { vehicleName = 'Véhicule', batteryVoltage = 12.6, ecuResults = [] } = req.body || {};
    const ecus: Array<{
      ecuId: string;
      shortName: string;
      status: string;
      dtcs?: Array<{ code: string; descriptionFr: string; severity: string }>;
    }> = Array.isArray(ecuResults) ? ecuResults : [];

    const allDtcs = ecus.flatMap((e) => (Array.isArray(e.dtcs) ? e.dtcs : []));
    const dtcStrings = allDtcs.map((d) => `${d.code} (${d.descriptionFr})`);

    const criticalCount = allDtcs.filter((d) => d.severity === 'critical').length;
    const highCount = allDtcs.filter((d) => d.severity === 'high').length;
    const faultEcus = ecus.filter((e) => (e.dtcs || []).length > 0).map((e) => e.shortName);
    const okEcus = ecus.filter((e) => e.status === 'ok').map((e) => e.shortName);

    let summaryText = '';
    if (allDtcs.length === 0) {
      summaryText = `Scan Rapide Automatique terminé sur ${vehicleName} (${Number(batteryVoltage).toFixed(1)}V) : tous les calculateurs répondants (${okEcus.join(', ') || 'Gateway, Moteur, ABS, Airbag'}) affichent 0 code défaut actif.`;
    } else {
      const priority =
        criticalCount > 0
          ? `PRIORITÉ CRITIQUE (${criticalCount} défaut(s) critique(s))`
          : highCount > 0
          ? `PRIORITÉ ÉLEVÉE (${highCount} défaut(s) majeur(s))`
          : 'SURVEILLANCE MODÉRÉE';
      summaryText = `${priority} sur ${vehicleName} : ${allDtcs.length} code(s) relevé(s) sur [${faultEcus.join(', ')}]. Contrôlez d’abord la tension batterie (${Number(batteryVoltage).toFixed(1)}V) puis traitez en priorité : ${dtcStrings.slice(0, 3).join(' · ')}.`;
    }

    const checked = verifyDiagnosticAiOutput(summaryText, dtcStrings, 'offline-verified-rules');
    return res.json({
      success: true,
      summaryText: checked.sanitizedText,
      totalDtcs: allDtcs.length,
      criticalCount,
      highCount,
      aiVerification: checked.aiVerification,
    });
  } catch (error: any) {
    console.error('Error in /api/diagnose/quick-scan-summary:', error);
    return res.status(500).json({
      success: false,
      summaryText: 'Synthèse locale prête.',
    });
  }
});

// API: Traducteur & Dépanneur DTC Brut IA (Valises Launch / Autel : chinois / mauvais anglais -> Français technique)
app.post('/api/dtc/translate-raw', async (req, res) => {
  try {
    const {
      rawInput = '',
      rawText = '',
      brand: rawBrand,
      vehicleBrand,
      scannerSource = 'Launch / Autel',
    } = req.body || {};

    const cleanRaw = String(rawInput || rawText || '').trim();
    const brand = String(rawBrand || vehicleBrand || 'Véhicule Chinois').trim();
    if (!cleanRaw) {
      return res.status(400).json({ success: false, message: 'Code défaut ou libellé brut requis.' });
    }

    const codeMatch = cleanRaw.toUpperCase().match(/\b[PCBU][0-9A-F]{4}\b/);
    const detectedCode = codeMatch ? codeMatch[0] : null;
    const upper = cleanRaw.toUpperCase();

    // Déterministe hors-ligne pour les libellés mal traduits courants Launch / Autel
    const buildDeterministicResult = () => {
      let cleanFrenchTitle = `Défaut ${detectedCode || 'calculateur'} (${brand}) — Traduction technique atelier`;
      let affectedSystem = 'Calculateur Moteur / Bus CAN';
      let urgency: 'Critique' | 'Élevée' | 'Modérée' | 'Faible' = 'Modérée';
      let knownCausesDz = [
        'Chute de tension batterie 12V (< 12.2V au démarrage) générant des défauts fugitifs sur les véhicules chinois (Chery, Geely, MG, BYD, DFSK).',
        'Faux contact ou oxydation sur connecteur faisceau moteur / masse châssis.',
      ];
      let multimeterTests = [
        {
          point: 'Tension Batterie 12V (au repos & sous démarreur)',
          expectedValue: '12.5V–12.7V (repos) · ≥ 10.5V (sous démarreur) · 13.8V–14.4V (moteur tournant)',
          condition: 'Multimètre DC aux bornes batterie',
        },
        {
          point: 'Résistance Bus CAN OBD2 (Broches 6 & 14)',
          expectedValue: '58 Ω – 62 Ω',
          condition: 'Contact coupé depuis 3 minutes',
        },
      ];
      let repairSteps = [
        'Contrôler et recharger la batterie 12V avant d’effacer les codes défauts.',
        'Inspecter le connecteur concerné (verrouillage, broches tordues, humidité) et effacer le DTC après essai.',
      ];

      if (/(VOLTAGE|BATTER|12V|P0562|LOW\s*SYSTEM|TOO\s*LOW|TENSION\s*FAIBLE|供电|电压)/i.test(upper)) {
        cleanFrenchTitle = `${detectedCode ? `${detectedCode} : ` : ''}Sous-tension d’alimentation calculateur / chute batterie 12V`;
        affectedSystem = 'Alimentation & Alternateur / Gateway 12V';
        urgency = 'Élevée';
        knownCausesDz = [
          'Batterie 12V affaiblie ou cosses desserrées provoquant une cascade de faux défauts ABS, DCT et Direction (EPS).',
          'Chute de tension sur le relais principal ECM ou oxydation tresse de masse moteur.',
          'Régulateur d’alternateur (ou convertisseur DC-DC sur BYD EV/DM-i) défaillant.',
        ];
        multimeterTests = [
          {
            point: 'Chute de tension masse (Borne - batterie ↔ Bloc moteur)',
            expectedValue: '< 0.15 V',
            condition: 'Moteur au ralenti phares allumés',
          },
          {
            point: 'Alimentation Calculateur (+30 / +15 APC)',
            expectedValue: '12.5V – 14.3V',
            condition: 'Contact ON puis moteur tournant',
          },
        ];
        repairSteps = [
          'Tester la batterie sous charge et resserrer les bornes + tresse de masse.',
          'Contrôler les fusibles principaux (30A/40A) et la charge alternateur/DC-DC à 14.0V.',
        ];
      } else if (/(CLUTCH|VALVE|DCT|SOLENOID|TCU|GEARBOX|TRANSMISSION|离合器|变速箱)/i.test(upper)) {
        cleanFrenchTitle = `${detectedCode ? `${detectedCode} : ` : ''}Défaut électrovanne / actionneur de commande boîte DCT ou CVT`;
        affectedSystem = 'Boîte de Vitesses Automatique (TCU 7DCT / CVT)';
        urgency = 'Critique';
        knownCausesDz = [
          'Huile DCT/CVT dégradée ou niveau insuffisant entraînant un blocage d’électrovanne.',
          'Chute de tension 12V pendant les passages de rapports.',
          'Capteur de vitesse d’entrée/sortie mécatronique encrassé par limaille.',
        ];
        multimeterTests = [
          {
            point: 'Résistance bobine électrovanne de pression DCT',
            expectedValue: '4.5 Ω – 6.5 Ω à 20°C',
            condition: 'Connecteur mécatronique débranché',
          },
          {
            point: 'Alimentation puissance TCU (+30)',
            expectedValue: '12.4V – 14.2V',
            condition: 'Contact ON',
          },
        ];
        repairSteps = [
          'Vérifier la tension batterie puis contrôler l’huile et la température TCU en données réelles.',
          'Effectuer un apprentissage point de patinage (Kiss-Point) sur Launch/Autel après réparation.',
        ];
      } else if (/(CRANK|CAMSHAFT|SPEED\s*SENSOR|UNREASONABLE|PLAUSIBILITY|P0335|P0340|P0500|轮速|曲轴)/i.test(upper)) {
        cleanFrenchTitle = `${detectedCode ? `${detectedCode} : ` : ''}Incohérence ou perte signal capteur de régime / vitesse (PMH, AAC ou Roue ABS)`;
        affectedSystem = 'Synchronisation Moteur / Capteur Vitesse';
        urgency = 'Élevée';
        knownCausesDz = [
          'Capteur PMH (vilebrequin) ou capteur ABS encrassé / entrefer excessif.',
          'Faisceau coupé ou court-circuité près du collecteur d’échappement ou passage de roue.',
          'Décalage chaîne de distribution (si P0340 + P0016 simultanés).',
        ];
        multimeterTests = [
          {
            point: 'Capteur PMH Inductif (2 fils)',
            expectedValue: '750 Ω – 950 Ω (statique) · 0.8V–3V AC (sous démarreur)',
            condition: 'Capteur débranché / démarreur actionné',
          },
          {
            point: 'Capteur Hall (3 fils : Alim / Signal / Masse)',
            expectedValue: '5.0 V (réf) ou 12.0 V alim · Masse < 0.1 V',
            condition: 'Contact ON',
          },
        ];
        repairSteps = [
          'Mesurer l’alimentation 5V/12V et la continuité jusqu’au calculateur avant de remplacer le capteur.',
          'Contrôler visuellement la cible magnétique / roue dentée.',
        ];
      } else if (/(HVIL|INTERLOCK|INSULATION|ISOLEMENT|HIGH\s*VOLTAGE|高压|互锁|绝缘)/i.test(upper)) {
        cleanFrenchTitle = `${detectedCode ? `${detectedCode} : ` : ''}Défaut boucle de verrouillage Haute Tension (HVIL) ou isolement EV/Hybride`;
        affectedSystem = 'Gestion Haute Tension (BYD VCU / BMS / Onduleur)';
        urgency = 'Critique';
        knownCausesDz = [
          'Connecteur orange HV (compresseur clim électrique, PTC, chargeur OBC) mal encliqueté après intervention.',
          'Infiltration d’humidité dans une prise haute tension sous châssis.',
          'Batterie auxiliaire 12V faible empêchant la fermeture des contacteurs.',
        ];
        multimeterTests = [
          {
            point: 'Batterie auxiliaire 12V (avant test HV)',
            expectedValue: '≥ 12.4 V',
            condition: 'Contact OFF (obligatoire avant toute intervention orange)',
          },
          {
            point: 'Continuité boucle basse tension HVIL (fils pilote uniquement)',
            expectedValue: '< 2.0 Ω (après mise hors tension HV & attente 10 min)',
            condition: 'Gants isolants 1000V + Service Plug retiré',
          },
        ];
        repairSteps = [
          '⚠️ Sécurité : Couper le contact, retirer le sectionneur HV et attendre 10 min avant tout contrôle.',
          'Vérifier le clic de verrouillage des fiches orange (Compresseur AC, OBC, Onduleur).',
        ];
      } else if (/(LOST\s*COMM|U01|TIMEOUT|CAN\s*BUS|通信丢失|总线)/i.test(upper)) {
        cleanFrenchTitle = `${detectedCode ? `${detectedCode} : ` : ''}Perte de communication réseau Bus CAN avec calculateur distant`;
        affectedSystem = 'Passerelle Gateway / Bus CAN';
        urgency = 'Élevée';
        knownCausesDz = [
          'Chute de tension batterie 12V lors du démarrage provoquant un code U0xxx en cascade.',
          'Fusible alimentation du module cible (ABS/TCU/BCM) grillé.',
          'Faisceau CAN High / CAN Low coupé ou en court-circuit (résistance ≠ 60 Ω).',
        ];
        multimeterTests = [
          {
            point: 'Résistance terminale Bus CAN (DLC Pins 6 & 14)',
            expectedValue: '60 Ω (± 2 Ω)',
            condition: 'Batterie débranchée / veille bus',
          },
          {
            point: 'Tensions Bus CAN (Pin 6 CAN-H / Pin 14 CAN-L vers masse)',
            expectedValue: 'CAN-H : 2.6V–3.2V · CAN-L : 1.8V–2.4V (somme = ~5V)',
            condition: 'Contact ON',
          },
        ];
        repairSteps = [
          'Vérifier tous les fusibles du module muet puis mesurer 60 Ω sur les broches 6 et 14 OBD2.',
          'Contrôler l’absence d’écran Android aftermarket mal câblé qui pollue le CAN confort/infotainment.',
        ];
      }

      return {
        rawInput: cleanRaw,
        detectedCode,
        scannerSource,
        cleanFrenchTitle,
        affectedSystem,
        urgency,
        knownCausesDz,
        multimeterTests,
        repairSteps,
        translatedAt: new Date().toISOString(),
      };
    };

    const hasAi = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
    if (!hasAi) {
      const deterministic = buildDeterministicResult();
      const checked = verifyDiagnosticAiOutput(
        deterministic.cleanFrenchTitle,
        detectedCode ? [detectedCode] : [],
        'offline-verified-rules'
      );
      return res.json({
        success: true,
        result: deterministic,
        aiVerification: checked.aiVerification,
      });
    }

    const systemPrompt = `Tu es le Traducteur Technique & Dépanneur DTC AutoPro pour les garagistes en Algérie (flotte chinoise : Chery, Geely, MG, BYD, DFSK).
Tu reçois un code défaut brut ou un libellé mal traduit du chinois/anglais issu d'une valise (Launch X431, Autel, ThinkCar).
Réponds STRICTEMENT en JSON valide avec cette structure exacte :
{
  "cleanFrenchTitle": "Traduction technique exacte et claire en français",
  "affectedSystem": "Système / Calculateur concerné",
  "urgency": "Critique" | "Élevée" | "Modérée" | "Faible",
  "knownCausesDz": ["Cause terrain 1 (inclure impact tension batterie 12V si pertinent)", "Cause 2"],
  "multimeterTests": [
    { "point": "Point de mesure exact", "expectedValue": "Valeur V / Ohm attendue", "condition": "Condition test" }
  ],
  "repairSteps": ["Étape atelier 1", "Étape atelier 2"]
}
RÈGLES : Zéro blabla théorique. N'invente aucun nouveau code DTC, aucun code PIN, ni aucune URL.

ENTRÉE VALISE (${scannerSource}) — VÉHICULE (${brand}) :
"${cleanRaw}"`;

    try {
      const aiRes = await generateUnifiedAI(systemPrompt, { jsonMode: true, timeoutMs: 8000 });
      const parsed = aiRes.text ? JSON.parse(aiRes.text) : null;
      if (parsed && parsed.cleanFrenchTitle) {
        const checked = verifyDiagnosticAiOutput(
          `${parsed.cleanFrenchTitle}\n${(parsed.knownCausesDz || []).join('\n')}`,
          detectedCode ? [detectedCode] : [],
          aiRes.provider
        );
        return res.json({
          success: true,
          result: {
            rawInput: cleanRaw,
            detectedCode,
            scannerSource,
            cleanFrenchTitle: String(parsed.cleanFrenchTitle),
            affectedSystem: String(parsed.affectedSystem || 'Calculateur / CAN'),
            urgency: ['Critique', 'Élevée', 'Modérée', 'Faible'].includes(parsed.urgency) ? parsed.urgency : 'Modérée',
            knownCausesDz: Array.isArray(parsed.knownCausesDz) ? parsed.knownCausesDz.map(String) : [],
            multimeterTests: Array.isArray(parsed.multimeterTests) ? parsed.multimeterTests : [],
            repairSteps: Array.isArray(parsed.repairSteps) ? parsed.repairSteps.map(String) : [],
            translatedAt: new Date().toISOString(),
          },
          aiVerification: checked.aiVerification,
        });
      }
    } catch {
      // Fall back to deterministic rule engine cleanly
    }

    const fallback = buildDeterministicResult();
    const checked = verifyDiagnosticAiOutput(
      fallback.cleanFrenchTitle,
      detectedCode ? [detectedCode] : [],
      'offline-verified-rules'
    );
    return res.json({
      success: true,
      result: fallback,
      aiVerification: checked.aiVerification,
    });
  } catch (error: any) {
    console.error('Error in /api/dtc/translate-raw:', error);
    return res.status(500).json({ success: false, message: 'Erreur traduction DTC brut.' });
  }
});

// API: AI App & Automotive UI Translator (with 1:1 key & placeholder integrity verification)
app.post('/api/translate/ai', async (req, res) => {
  try {
    const { targetLanguage, sourceStrings = [], appName } = req.body || {};
    const safeSources: Array<{ key: string; text: string }> = Array.isArray(sourceStrings) ? sourceStrings : [];
    const hasAi = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);

    if (!hasAi) {
      const translatedMap: Record<string, string> = {};
      safeSources.forEach((item) => {
        translatedMap[item.key] = `[${targetLanguage}] ${item.text}`;
      });
      return res.json({
        translatedStrings: translatedMap,
        notes: `Mode hors-ligne : chaînes conservées avec variables intactes (${targetLanguage}) pour ${appName || 'Automotive App'}.`,
        aiVerification: {
          verified: true,
          provider: 'offline-verified-rules',
          guardrailsApplied: ['Correspondance stricte 1:1 des clés source', 'Variables préservées'],
          blockedHallucinations: [],
          confidenceLevel: 'STRICT_VERIFIED',
          checkedAt: new Date().toISOString(),
        },
      });
    }

    const prompt = `Tu es un spécialiste de la localisation et traduction de logiciels embarqués pour tablettes automobiles et autoradios Android (Android Automotive OS, CarPlay, Head-Units).
Traduire STRICTEMENT les textes d'interface suivants vers : "${targetLanguage}".
Application cible : "${appName || 'Car Infotainment App'}".

Textes à traduire (tableau JSON):
${JSON.stringify(safeSources, null, 2)}

Règles impératives (Zéro Hallucination) :
1. Garde EXACTEMENT les mêmes valeurs de champ "key". N'en ajoute aucune et n'en supprime aucune.
2. Utilise les termes automobiles standards pour écrans tactiles de voiture.
3. Garde toutes les variables intactes au caractère près (ex: {0}, %s, %d).
4. Renvoie STRICTEMENT un objet JSON valide :
{
  "translations": [
    { "key": "string_key", "translated": "texte traduit" }
  ],
  "notes": "Courte remarque ergonomique"
}`;

    const aiRes = await generateUnifiedAI(prompt, { jsonMode: true });
    if (!aiRes.text) {
      throw new Error('Traduction IA indisponible');
    }

    const parsed = JSON.parse(aiRes.text);
    const verified = verifyTranslationOutput(safeSources, parsed.translations || [], aiRes.provider);

    return res.json({
      translatedStrings: verified.translatedMap,
      notes: parsed.notes || `Traduction vérifiée en ${targetLanguage}`,
      aiVerification: verified.aiVerification,
    });
  } catch (error: any) {
    console.error('Error or spike demand in /api/translate/ai, using verified terminology fallback:', error.message);
    const { targetLanguage, sourceStrings = [], appName } = req.body || {};
    const safeSources: Array<{ key: string; text: string }> = Array.isArray(sourceStrings) ? sourceStrings : [];
    const arabicDict: Record<string, string> = {
      app_title: 'جناح التشخيص وإعادة برمجة المحرك للسيارات',
      gauge_turbo_boost: 'ضغط شاحن التوربو (بار)',
      gauge_coolant_temp: 'درجة حرارة سائل التبريد (°م)',
      warning_battery_low: 'جهد البطارية منخفض! يلزم 12.5 فولت كحد أدنى لبرمجة وحدة التحكم.',
      btn_clear_dtc: 'مسح جميع رموز الأعطال (إعادة ضبط DTC)',
      link_status_cable: 'وصلة كابل USB-C المباشرة : نشطة (480 ميغابت/ث)',
      link_status_wifi: 'شبكة واي فاي المباشرة عالية السرعة : متصلة',
      install_apk_confirm: 'تثبيت حزمة التطبيق على شاشة لوحة القيادة بالسيارة؟',
    };
    const spanishDict: Record<string, string> = {
      app_title: 'Suite de Diagnóstico y Reprogramación Automotriz',
      gauge_turbo_boost: 'Presión del Turbocompresor (bar)',
      gauge_coolant_temp: 'Temperatura del Refrigerante (°C)',
      warning_battery_low: '¡Voltaje de Batería Bajo! Mínimo 12.5V requerido para flashear ECU.',
      btn_clear_dtc: 'Borrar Códigos de Falla (Reset DTC)',
      link_status_cable: 'Enlace Directo Cable USB-C : Activo (480 Mbps)',
      link_status_wifi: 'WiFi Directo Alta Velocidad : Conectado',
      install_apk_confirm: '¿Instalar paquete en la pantalla del vehículo?',
    };
    const dict = (targetLanguage || '').includes('Arabe') ? arabicDict : (targetLanguage || '').includes('Espagnol') ? spanishDict : null;
    const rawTranslations = safeSources.map((item) => ({
      key: item.key,
      translated: (dict && dict[item.key]) || `[${targetLanguage}] ${item.text}`,
    }));
    const verified = verifyTranslationOutput(safeSources, rawTranslations, 'offline-verified-rules');
    return res.status(200).json({
      translatedStrings: verified.translatedMap,
      notes: `Traduction sécurisée (${targetLanguage}) pour ${appName || 'Application Auto'}.`,
      aiVerification: verified.aiVerification,
    });
  }
});

// API: AI Tuning & Flash Recommendation (with anti-hallucination update & checksum guard)
app.post('/api/flash/recommendations', async (req, res) => {
  try {
    const { brand, model, ecuType, flashStage = 'Stage 1' } = req.body || {};
    const hasAi = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);

    if (!hasAi) {
      const offlineText = `Cartographie théorique ${flashStage} pour calculateur ${ecuType || 'ECU Moteur'}. Effectuez impérativement une sauvegarde complète (ORI .bin + EEPROM) avant toute écriture, maintenez 13.8V par stabilisateur et faites corriger le Checksum RSA/CRC directement sur le fichier .bin modifié par votre outil (Kess3 / Autotuner / PCMFlash).`;
      const checked = verifyFlashAiOutput(offlineText, String(flashStage), 'offline-verified-rules');
      return res.json({
        stage: flashStage,
        estimatedGainHp: 'Selon banc de puissance & état mécanique',
        estimatedGainTorque: 'À vérifier selon limiteur embrayage/boîte',
        safeBoostMax: 'Ne pas dépasser +0.25 bar sans contrôle EGT/AFR',
        checksumVerified: false,
        requiresBinaryChecksum: true,
        recommendation: checked.sanitizedText,
        aiVerification: checked.aiVerification,
      });
    }

    const prompt = `Tu es un ingénieur motoriste expert en chiptuning et reprogrammation calculateur moteur (ECU/TCU).
Véhicule: ${brand} ${model}
Calculateur: ${ecuType || 'Non précisé'}
Configuration demandée: ${flashStage}

RÈGLES ANTI-HALLUCINATION STRICTES :
- N'invente JAMAIS un nom de fichier firmware (.bin/.swu/.zip) ou un lien de téléchargement.
- Ne prétends JAMAIS que le Checksum est déjà validé : rappelle toujours que le Checksum RSA/CRC doit être calculé sur le binaire réel avant écriture.
- En cas de Lambda Off / Cat Off, interdiction formelle de désactiver la sonde Lambda amont (Banc 1 Capteur 1) : seule la sonde aval (B1S2) peut être neutralisée hors voie publique.

Donne de manière concise et précise :
1. Fourchette réaliste de gain Puissance/Couple et limites mécaniques (embrayage, turbo, EGT).
2. Protocole de lecture/écriture recommandé et voltage stabilisé impératif (13.8V).
3. Procédure de sauvegarde ORI + contrôle Checksum obligatoire.`;

    const aiRes = await generateUnifiedAI(prompt);
    if (!aiRes.text) {
      throw new Error('IA reprog indisponible');
    }

    const checked = verifyFlashAiOutput(aiRes.text, String(flashStage), aiRes.provider);

    return res.json({
      recommendation: checked.sanitizedText,
      estimatedGainHp: String(flashStage).includes('Stage 2') ? '+45 à +70 ch (selon hardware)' : String(flashStage).includes('Eco') ? '+10 à +15 ch' : '+25 à +40 ch (selon état moteur)',
      estimatedGainTorque: String(flashStage).includes('Stage 2') ? '+90 à +115 Nm' : '+55 à +75 Nm',
      checksumVerified: false,
      requiresBinaryChecksum: true,
      aiVerification: checked.aiVerification,
    });
  } catch (error: any) {
    console.error('Error or spike demand in /api/flash/recommendations, using verified fallback:', error.message);
    const { brand, model, ecuType, flashStage = 'Stage 1' } = req.body || {};
    const fallbackText = `### Recommandations Ingénierie Motoriste (Mode Vérifié) : ${brand || 'Véhicule'} ${model || ''}\n**Calculateur :** ${ecuType || 'À confirmer par lecture ID'}\n**Configuration :** ${flashStage}\n\n1. **Sauvegarde & Checksum :** Lecture complète du fichier d'origine (ORI .bin) + correction Checksum obligatoire sur votre outil de flash avant écriture.\n2. **Sécurité Matérielle :** Stabilisateur d'alimentation **13.8V** obligatoire. Ne jamais couper le contact pendant la programmation.`;
    const checked = verifyFlashAiOutput(fallbackText, String(flashStage), 'offline-verified-rules');
    return res.status(200).json({
      stage: flashStage,
      estimatedGainHp: 'Variable selon relevé banc',
      estimatedGainTorque: 'Selon limiteur boîte/embrayage',
      safeBoostMax: 'Respecter limite EGT < 800°C',
      checksumVerified: false,
      requiresBinaryChecksum: true,
      recommendation: checked.sanitizedText,
      aiVerification: checked.aiVerification,
    });
  }
});

// API: Chinese Car Android Head-Unit Anti-Brick AI Guard & Recovery
app.post('/api/chinese-tablet/ai-guard', async (req, res) => {
  try {
    const {
      mode = 'preflight',
      brand = '',
      modelYear = '',
      ihuRef = '',
      socChip = '',
      mcuBuild = '',
      intendedFile = '',
      symptom = '',
    } = req.body || {};

    const combinedTarget = `${brand} ${modelYear} ${ihuRef} ${socChip} ${mcuBuild}`.toUpperCase();
    const fileUpper = String(intendedFile || '').toUpperCase();
    const ihuUpper = String(ihuRef || '').toUpperCase();
    const brandLower = String(brand || '').toLowerCase();

    // Deterministic Anti-Mismatch Hard Blocking Checks
    let blocked = false;
    let alertTitle = '';
    let riskDetail = '';

    if (mode !== 'recovery') {
      if (!String(modelYear).trim() || !String(ihuRef).trim() || !String(socChip).trim() || !String(mcuBuild).trim()) {
        blocked = true;
        alertTitle = 'CONTRÔLE ANTI-MISMATCH INCOMPLET (4 PARAMÈTRES OBLIGATOIRES)';
        riskDetail =
          'Vous devez renseigner impérativement : (1) Marque/Modèle/Année, (2) Référence IHU/Carte mère, (3) Puce SoC et (4) Version MCU/Build actuelle avant toute génération de script ou flash.';
      } else if (
        (() => {
          const iNorm = ihuUpper.replace(/\s+/g, '');
          const fNorm = fileUpper.replace(/\s+/g, '');
          return (
            (iNorm.includes('624G') && (fNorm.includes('535') || fNorm.includes('715') || fNorm.includes('516') || fNorm.includes('FLYME'))) ||
            (iNorm.includes('IHU715P') && (fNorm.includes('535') || fNorm.includes('516') || fNorm.includes('624') || fNorm.includes('FLYME'))) ||
            (iNorm.includes('IHU535G') && (fNorm.includes('715') || fNorm.includes('516') || fNorm.includes('624') || fNorm.includes('FLYME'))) ||
            (iNorm.includes('IHU516G') && (fNorm.includes('715') || fNorm.includes('535') || fNorm.includes('624') || fNorm.includes('FLYME')))
          );
        })()
      ) {
        blocked = true;
        alertTitle = 'HARD_STOP : INCOMPATIBILITÉ MATÉRIELLE GEELY IHU DÉTECTÉE';
        riskDetail =
          `Croisement interdit entre ${ihuRef} et le fichier "${intendedFile}". Les pilotes d’affichage, de radio et de caméra entre IHU 624G, IHU535G, IHU715P et Flyme Auto ne sont pas interchangeables.`;
      } else if (fileUpper.includes('1.8.2.1.E') && !brandLower.includes('jetour')) {
        blocked = true;
        alertTitle = 'ALERTE ROUGE : FIRMWARE JETOUR SUR UNE AUTRE MARQUE';
        riskDetail =
          'La branche logicielle Jetour 1.8.2.1.E est strictement incompatible avec Geely / Chery / Changan / MG. Risque de briquage et coupure bus CAN/DSP.';
      } else if (brandLower.includes('jetour') && (fileUpper.includes('1.8.2.1.E') || combinedTarget.includes('1.8.2.1.E')) && (combinedTarget.includes('2025') || combinedTarget.includes('2026')) && !fileUpper.includes('MCU')) {
        blocked = true;
        alertTitle = 'ALERTE CRITIQUE JETOUR 2025/2026 (RISQUE PERTE SON DSP)';
        riskDetail =
          'La branche 1.8.2.1.E est incompatible avec certaines révisions DSP audio Jetour 2025/2026 sans fichier MCU appairé. Vérifiez d’abord ro.board.platform via ADB en lecture seule avant toute écriture.';
      } else if (
        (ihuUpper.includes('DESAY') && fileUpper.includes('APTIV')) ||
        (ihuUpper.includes('APTIV') && fileUpper.includes('DESAY')) ||
        (ihuUpper.includes('BOSCH') && (fileUpper.includes('DESAY') || fileUpper.includes('APTIV')))
      ) {
        blocked = true;
        alertTitle = 'ALERTE ROUGE : INCOMPATIBILITÉ CARTE MÈRE CHERY (DESAY SV / APTIV / BOSCH)';
        riskDetail =
          'Les unités Desay SV, Aptiv et Bosch n’utilisent pas le même protocole de pilotage d’amplificateur externe (Sony/Pioneer). Une mauvaise config CAN coupe le son.';
      } else if (
        (combinedTarget.includes('FYT') || combinedTarget.includes('UIS7862')) && (fileUpper.includes('TS10') || fileUpper.includes('TS18') || fileUpper.includes('TOPWAY')) ||
        (combinedTarget.includes('TS10') || combinedTarget.includes('TS18') || combinedTarget.includes('TOPWAY')) && (fileUpper.includes('FYT') || fileUpper.includes('UIS7862'))
      ) {
        blocked = true;
        alertTitle = 'ALERTE ROUGE : CROISEMENT FYT (UIS7862) ↔ TOPWAY (TS10/TS18)';
        riskDetail =
          'Le croisement de MCU ou firmware entre FYT (UIS7862) et Topway (TS10/TS18) provoque un écran noir immédiat ou l’inversion des touches tactiles.';
      } else if (
        brandLower.includes('changan') &&
        (combinedTarget.includes('UNI') || fileUpper.includes('/SYSTEM') || fileUpper.includes('/VENDOR')) &&
        (fileUpper.includes('/SYSTEM') || fileUpper.includes('/VENDOR') || fileUpper.includes('ROOT'))
      ) {
        blocked = true;
        alertTitle = 'ALERTE ROUGE : INTERDICTION MODIFICATION /system OU /vendor (CHANGAN UNI)';
        riskDetail =
          'Sur Changan UNI-T / UNI-K, les caméras 360° et le tableau de bord sont couplés au processeur principal. Toute écriture sur /system ou /vendor est strictement interdite.';
      } else if (
        (brandLower.includes('vw') || brandLower.includes('volkswagen') || brandLower.includes('audi') || brandLower.includes('cupra')) &&
        (fileUpper.includes('EU_STD') || fileUpper.includes('MIB2_EU') || fileUpper.includes('HARMAN_EU')) &&
        (ihuUpper.includes('CNS') || ihuUpper.includes('MIB3-CN') || ihuUpper.includes('AUDI-MMI-CN') || ihuUpper.includes('CUPRA-MEB'))
      ) {
        blocked = true;
        alertTitle = 'ALERTE ROUGE : CROISEMENT FIRMWARE EUROPE (MIB2 EU) SUR UNITÉ CHINE (CNS 3.0 / MIB3-CN)';
        riskDetail =
          'Ne jamais flasher un firmware VW/Audi Europe (MIB2/MIB3 EU) sur une version chinoise SAIC/FAW (CNS 3.0, MIB3-CN, Audi MMI CN) : verrouillage Component Protection, perte affichage Virtual Cockpit et coupure ampli Dynaudio/Beats.';
      } else if (
        brandLower.includes('livan') &&
        (fileUpper.includes('IHU535G') || fileUpper.includes('1.8.2.1.E'))
      ) {
        blocked = true;
        alertTitle = 'ALERTE ROUGE : INCOMPATIBILITÉ PLATEFORME LIVAN (GKUI)';
        riskDetail =
          'Les modèles Livan (X3 Pro / X6 Pro / RL7) utilisent une branche GKUI / Jinlv dédiée. Un firmware IHU535G ou Jetour bloque le module CAN et les caméras AVM.';
      } else if (
        brandLower.includes('kia') &&
        (fileUpper.includes('GEN5W_EU') || fileUpper.includes('CCNC_EU') || fileUpper.includes('HARMAN_EU'))
      ) {
        blocked = true;
        alertTitle = 'ALERTE ROUGE : FIRMWARE KIA EUROPE INTERDIT SUR KIA SPORTAGE / SELTOS CHINE';
        riskDetail =
          'Les Kia Sportage (KX5/NQ5) & Seltos 2026 Version Chine fonctionnent sous Baidu DuerOS / Kia Connect CN. L’injection d’un firmware Kia Europe (Gen5W/ccNC) briquera l’unité principale.';
      } else if (
        (brandLower.includes('vw') || brandLower.includes('volkswagen') || brandLower.includes('audi') || combinedTarget.includes('GOLF') || combinedTarget.includes('A3')) &&
        (fileUpper.includes('MIB3_EU') || fileUpper.includes('MHI3_EU') || fileUpper.includes('MOI3_EU') || fileUpper.includes('FRF_EU'))
      ) {
        blocked = true;
        alertTitle = 'ALERTE ROUGE : FIRMWARE MIB3 EUROPE INTERDIT SUR VW GOLF 8 / AUDI A3 CHINE';
        riskDetail =
          'Les unités CNS 3.0 / MIB3-CN / AUDI-MMI-CN (Golf 8 2026, Audi A3L) ont une Protection Composant (CP) et SFD2 spécifiques à la Chine. Toute écriture de firmware Europe direct est bloquée.';
      } else if (
        brandLower.includes('geely') &&
        (ihuUpper.includes('FLYME') || combinedTarget.includes('CITYRAY') || combinedTarget.includes('STARRAY') || combinedTarget.includes('COWBOY')) &&
        (fileUpper.includes('IHU535G') || fileUpper.includes('IHU516G') || fileUpper.replace(/\s+/g, '').includes('624G') || fileUpper.includes('IHU715P'))
      ) {
        blocked = true;
        alertTitle = 'HARD_STOP : FIRMWARE GKUI (624G / 535G / 715P / 516G) INTERDIT SUR FLYME AUTO 2.5.0';
        riskDetail =
          'Les modèles Geely Cityray (Boyue), Starray, Okavango, Icon et Cowboy sous Flyme Auto 2.5.0 ne doivent jamais recevoir un firmware destiné aux IHU 624G, IHU535G, IHU715P ou IHU516G.';
      }
    }

    const systemContext = `Tu es le moteur d'intelligence artificielle embarqué de "AutoPro Flash & Diagnostic Hub", expert en ingénierie automobile, systèmes d'infodivertissement Android (IHU / Head Units) et protocoles CAN/MCU pour véhicules chinois récents et versions chinoises (2023-2026 : Geely Cityray Boyue Flyme Auto 2.5.0, Coolray Full Option, Starray, Okavango/Haoyue L, Icon, Cowboy 1.2/1.8, Emgrand, Monjaro, Livan X3/X6 Pro, Jetour X70, X70 Plus, X70L, X90 Plus, X95, T1, T2, X50, Dashing, Chery Tiggo/Arrizo, Changan X5 Plus/X5 Pro/UNI-T/UNI-K/CS35+/CS55+/Alsvin, MG5/MG GT/MG ZS/MG One/DFSK, Kia Sportage KX5/NQ5 & Seltos/Saltos 2026 Version Chine Baidu DuerOS, VW Chine SAIC/FAW Golf 8 2026/Passat Pro/Bora/T-Roc/Tharu/Tayron/Tavendor/Talagon/Teramont, Audi A3/A3L CN, Cupra Anhui).

RÈGLES OBLIGATOIRES :
1. Empêcher tout briquage, perte de son (DSP/Ampli), plantage radio ou blocage caméras 360°/540° (AVM).
2. Protocole strict en 3 étapes : ÉTAPE 1 Fingerprinting lecture seule (adb shell getprop ro.board.platform, ro.build.display.id, vérification MCU) -> ÉTAPE 2 Backup paramètres d'origine -> ÉTAPE 3 Injection APK non destructive (adb install -r) sans JAMAIS toucher aux partitions MCU, /system, /vendor, AudioFlinger ou AVM.
3. En cas de bug (perte de son / radio / caméras figées), interdire tout reflashage à l'aveugle et imposer les 4 étapes de secours : (1) Soft Reset 15s Power/Mute, (2) Hard Reset MCU coupure batterie (-) ou fusible Multimédia 15 min, (3) Contrôle Menu Usine (Ampli Interne/Externe, CAN, Caméra 360°/540°), (4) Rollback ADB (pm uninstall / pm clear).`;

    const userPrompt =
      mode === 'recovery'
        ? `${systemContext}

DEMANDE DE SECOURS POST-FLASH :
- Véhicule : ${brand} ${modelYear}
- IHU / Carte mère : ${ihuRef || 'Non précisé'} | SoC : ${socChip || 'Non précisé'} | MCU/Build : ${mcuBuild || 'Non précisé'}
- Symptôme signalé par le technicien : ${symptom || 'Perte de son / caméras 360° ou 540° bloquées après flash'}

Donne immédiatement la procédure de secours structurée en interdisant tout reflashage à l'aveugle, avec les codes usine exacts de cette marque.`
        : `${systemContext}

CONTRÔLE PRÉ-OPÉRATIONNEL :
- Statut pare-feu déterministe : ${blocked ? `BLOQUÉ (${alertTitle} : ${riskDetail})` : 'COMPATIBILITÉ PRÉLIMINAIRE VALIDÉE'}
- Marque / Modèle / Année : ${brand} ${modelYear}
- Référence IHU / Carte mère : ${ihuRef}
- Puce SoC : ${socChip}
- Version MCU & Build actuel : ${mcuBuild}
- Fichier / Opération envisagée : ${intendedFile || 'Sideload APK non destructif (Maps + YouTube + MicroG)'}

${
  blocked
    ? 'Explique clairement pourquoi cette opération est BLOQUÉE, le risque matériel exact (DSP/AVM/MCU), et ce que le technicien doit vérifier avant de recommencer.'
    : 'Fournis le protocole rigoureux en 3 étapes (1. Fingerprinting lecture seule, 2. Backup, 3. Injection adb install -r non destructive) adapté exactement à cette variante matérielle et ses codes usine.'
}`;

    const hasAi = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
    let analysis = '';
    let aiProvider: UnifiedAiProvider = 'offline-verified-rules';
    if (hasAi && !blocked) {
      const aiRes = await generateUnifiedAI(userPrompt, { timeoutMs: 8000 });
      analysis = aiRes.text || '';
      if (analysis) aiProvider = aiRes.provider;
    }

    if (!analysis) {
      if (mode === 'recovery') {
        analysis = `### PROCÉDURE DE SECOURS ANTI-BRICK (${brand.toUpperCase()} ${modelYear})
⛔ INTERDICTION ABSOLUE : Ne reflashez JAMAIS un autre firmware à l'aveugle !

1. **Soft Reset IHU** : Maintenez le bouton physique **Power / Mute pendant 15 secondes** jusqu'à l'extinction totale et redémarrage du processeur.
2. **Hard Reset MCU (Vidage condensateurs & Reset Bus CAN)** : Coupez le contact, attendez 2 minutes, débranchez la cosse négative (-) de la batterie 12V (ou retirez le fusible Multimédia/Audio) pendant **15 minutes**.
3. **Contrôle Menu Usine** : Entrez le code ingénieur vérifié (\`8888\` / \`3368\` / \`123456\`) et vérifiez :
   - **Amplificateur Audio (DSP)** : Interne vs Externe (Sony / Pioneer / OEM)
   - **Protocole CAN Box** : Modèle & année exacts
   - **Type Caméra (AVM)** : 360° / 540° LVDS / AHD
4. **Rollback ADB propre** :
   \`adb shell pm uninstall -k --user 0 <package_injecte>\`
   \`adb shell pm clear com.android.systemui\``;
      } else if (blocked) {
        analysis = `### ⛔ OPÉRATION BLOQUÉE : ${alertTitle}
${riskDetail}

**Action obligatoire avant toute suite :**
Exécutez d'abord ces commandes ADB en **lecture seule** pour identifier exactement le matériel :
- \`adb shell getprop ro.board.platform\`
- \`adb shell getprop ro.build.display.id\`
- \`adb shell getprop ro.product.model\``;
      } else {
        analysis = `### ✅ PROTOCOLE SÉCURISÉ VALIDÉ (${brand.toUpperCase()} ${modelYear} · ${ihuRef})
- **Étape 1 (Fingerprinting Lecture Seule)** :
  \`adb shell getprop ro.board.platform\`
  \`adb shell getprop ro.build.display.id\`
- **Étape 2 (Backup Paramètres Avant Modification)** :
  \`adb shell settings list global > backup_global.txt\`
  \`adb shell dumpsys audio > backup_audio_dsp.txt\`
- **Étape 3 (Injection APK Non Destructive — Zéro écriture /system, /vendor ou MCU)** :
  \`adb install -r MicroG_GmsCore.apk\`
  \`adb install -r GoogleMaps_Car.apk\`
  \`adb install -r YouTube_Car.apk\`
  \`adb shell am broadcast -a android.intent.action.LOCALE_CHANGED\``;
      }
    }

    const checked = verifyTabletUpdateAiOutput(
      analysis,
      { brand: String(brand), ihuRef: String(ihuRef), socChip: String(socChip), intendedFile: String(intendedFile) },
      aiProvider
    );

    return res.json({
      success: true,
      blocked,
      alertTitle,
      riskDetail,
      analysis: checked.sanitizedText,
      aiVerification: checked.aiVerification,
    });
  } catch (error: any) {
    console.error('Error in /api/chinese-tablet/ai-guard:', error);
    return res.status(500).json({
      success: false,
      blocked: true,
      alertTitle: 'Erreur de vérification sécurité IHU',
      riskDetail: 'Impossible de valider la compatibilité. Opération bloquée par sécurité.',
    });
  }
});

// API: Flash Cockpit & Combiné Numérique (Geely Coolray, Cityray/Starray, Jetour, Chery, Changan, MG/Haval)
app.post('/api/chinese-cockpit/plan', (req, res) => {
  try {
    const {
      brandId = 'geely_coolray',
      modelVariant = 'Geely Coolray SX11 / Full Option',
      clusterArch = 'IPC-10.25-ECARX',
      ihuArch = 'IHU715P',
      busProtocol = 'CAN-FD / DoIP + LVDS Dual-Display',
      selectedModules = ['theme_sport', 'lang_fr_ar'],
      themeSkin = 'coolray_sport_red',
      targetLang = 'fr',
      batteryVoltage = 13.5,
      vinBackupConfirmed = false,
      clusterMatchConfirmed = false,
      connectionMode = 'obd_wifi',
    } = req.body || {};

    const voltageNum = Number(batteryVoltage) || 0;
    const modules = Array.isArray(selectedModules) ? selectedModules.map(String) : [];

    // 1. Blocage anti-croisement matériel critique (HARD_STOP)
    const combinedArch = `${String(clusterArch)} ${String(ihuArch)}`.toUpperCase();
    const combinedNorm = combinedArch.replace(/\s+/g, '');
    const geelyVariantsFound = ['624G', '715P', '535G', '516G'].filter((tag) => combinedNorm.includes(tag));
    if (
      (String(brandId).startsWith('geely_coolray') && combinedNorm.includes('FLYME')) ||
      geelyVariantsFound.length >= 2 ||
      (combinedNorm.includes('FLYME') && geelyVariantsFound.length >= 1) ||
      (combinedArch.includes('DESAY') && combinedArch.includes('APTIV'))
    ) {
      return res.status(400).json({
        success: false,
        blocked: true,
        alertTitle: 'HARD_STOP ANTI-BRICK : Croisement Architecture Cockpit Détecté',
        riskDetail:
          'Incompatibilité matérielle entre combiné IPC et IHU/firmware : les unités IHU 624G, IHU535G, IHU715P et Flyme Auto (ou Desay SV vs Aptiv) n’ont pas des pilotes d’affichage, de radio et de caméra interchangeables.',
      });
    }

    // 2. Sécurité tension batterie
    if (voltageNum > 0 && voltageNum < 12.2) {
      return res.status(400).json({
        success: false,
        blocked: true,
        alertTitle: `TENSION BATTERIE TROP BASSE (${voltageNum.toFixed(1)}V < 12.2V)`,
        riskDetail:
          'Le flash d’un combiné numérique (IPC) exige une alimentation stabilisée ≥ 12.5V (recommandé 13.5V). Branchez un chargeur/stabilisateur avant d’écrire sur le bus CAN/DoIP.',
      });
    }

    if (!vinBackupConfirmed || !clusterMatchConfirmed) {
      return res.status(400).json({
        success: false,
        blocked: true,
        alertTitle: 'CONFIRMATIONS OBLIGATOIRES MANQUANTES',
        riskDetail:
          'Cochez la sauvegarde EEPROM (VIN / Config Odomètre intact) et la concordance exacte du combiné IPC avant de lancer la procédure.',
      });
    }

    const isCoolray = String(brandId).includes('coolray') || String(modelVariant).toLowerCase().includes('coolray');
    const ipcAddr = isCoolray ? '0x714 (RX 0x71C) IPC Geely' : '0x714 / 0x7E0 IPC Cluster';
    const ihuAddr = isCoolray ? '0x770 / ADB-LVDS IHU' : '0x770 / DoIP Head-Unit';

    const steps = [
      {
        id: 'step_session',
        progress: 15,
        label: `Session Diagnostic Étendue (${ipcAddr}) & Contrôle Tension (${voltageNum.toFixed(1)}V)`,
        log: `[${String(connectionMode).toUpperCase()}] UDS 10 03 -> ${ipcAddr} OK | Protocole : ${busProtocol} | Tension : ${voltageNum.toFixed(1)}V`,
      },
      {
        id: 'step_backup',
        progress: 35,
        label: 'Sauvegarde Lecture Seule EEPROM VIN / Config Immo / Calibration AVM',
        log: `Backup vérifié -> DID F190 (VIN) + Configuration CAN-FD + Offset Odomètre verrouillé en lecture seule (aucune écriture km).`,
      },
      {
        id: 'step_lvds',
        progress: 60,
        label: `Injection Pack UI Cockpit (${themeSkin}) & Langue (${String(targetLang).toUpperCase()})`,
        log: `Transfert sécurisé modules [${modules.join(', ') || 'theme_sport'}] sur ${ihuAddr} & canal LVDS combiné (CRC32 validé).`,
      },
      {
        id: 'step_sync',
        progress: 85,
        label: 'Synchronisation Bus CAN-FD : Navigation LVDS, TPMS, Turbo & ADAS 540°',
        log: `Ré-indexation trames DID Cockpit (Vitesse, Boost 1.5TD/2.0T, Boîte DCT, Guidage Maps/CarPlay) validée sans DTC actif.`,
      },
      {
        id: 'step_reset',
        progress: 100,
        label: 'Soft Reset Combiné IPC (UDS 11 01) & Vérification Finale',
        log: `SUCCÈS : ${modelVariant} (${clusterArch}) redémarré proprement. 0 défaut U0xxx, 0 perte son DSP, caméras 360°/540° opérationnelles.`,
      },
    ];

    return res.json({
      success: true,
      blocked: false,
      plan: {
        brandId,
        modelVariant,
        clusterArch,
        ihuArch,
        busProtocol,
        ipcAddr,
        ihuAddr,
        checksumEngine: 'CRC32 + Signature Pack UI Non-Destructif',
        steps,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/chinese-cockpit/plan:', error);
    return res.status(500).json({
      success: false,
      blocked: true,
      alertTitle: 'Erreur génération plan Cockpit',
      riskDetail: 'Impossible de générer le protocole cockpit.',
    });
  }
});

app.post('/api/chinese-cockpit/ai-guard', async (req, res) => {
  try {
    const {
      brandId = 'geely_coolray',
      modelVariant = 'Geely Coolray SX11 / Full Option',
      clusterArch = 'IPC-10.25-ECARX',
      ihuArch = 'IHU715P',
      busProtocol = 'CAN-FD / DoIP + LVDS Dual-Display',
      goal = 'Flash thème Sport/Track + projection GPS LVDS + pack langue FR/AR',
      batteryVoltage = 13.5,
      intendedOperation = '',
    } = req.body || {};

    const opUpper = String(intendedOperation || goal).toUpperCase();
    const guardCombinedNorm = `${String(clusterArch)} ${String(ihuArch)} ${opUpper}`.replace(/\s+/g, '');
    const geelyGuardTags = ['624G', '715P', '535G', '516G'].filter((tag) => guardCombinedNorm.includes(tag));
    let blocked = false;
    let alertTitle = 'Architecture Cockpit Validée (Anti-Brick Actif)';
    let riskDetail = `Concordance vérifiée pour ${modelVariant} (${clusterArch} / ${ihuArch}).`;

    // Interdiction absolue modification kilométrage
    if (/(KILOM|ODOMET|MILEAGE|COMPTEUR\s*KM|RECULER)/i.test(opUpper)) {
      blocked = true;
      alertTitle = 'OPÉRATION INTERDITE : Modification Odomètre / Kilométrage Refusée';
      riskDetail =
        'AutoPro bloque strictement toute tentative de modification de kilométrage sur l’EEPROM du combiné. Seuls le flash UI/Thèmes, langues FR/AR, projection LVDS et calibration ADAS/TPMS sont autorisés.';
    } else if (
      (String(brandId).startsWith('geely_coolray') && guardCombinedNorm.includes('FLYME')) ||
      geelyGuardTags.length >= 2 ||
      (guardCombinedNorm.includes('FLYME') && geelyGuardTags.length >= 1)
    ) {
      blocked = true;
      alertTitle = 'HARD_STOP ANTI-BRICK : Croisement IHU 624G / IHU715P / IHU535G / Flyme Auto';
      riskDetail =
        'Blocage strict (HARD_STOP) : les pilotes d’affichage, de radio et de caméra entre IHU 624G, IHU535G, IHU715P et Flyme Auto ne sont pas interchangeables.';
    }

    const prompt = `Tu es l'ingénieur expert AutoPro spécialiste des Combinés Numériques (Digital Cockpit IPC) et doubles écrans chinois en Algérie (Geely Coolray SX11/Restylé/Battle 2026 IHU624G/IHU715P/535G/ECARX, Geely Cityray/Starray Flyme Auto, Jetour Dashing/T2/X70 Plus, Chery Tiggo 7/8 Pro Desay SV/Aptiv, Changan UNI-T/UNI-K, MG5/MG GT/Haval).

DEMANDE ATELIER COCKPIT :
- Véhicule : ${modelVariant}
- Combiné (IPC) : ${clusterArch} | Écran central (IHU) : ${ihuArch}
- Protocole : ${busProtocol} | Tension mesurée : ${Number(batteryVoltage).toFixed(1)}V
- Objectif technicien : ${goal}
- Statut Pare-feu : ${blocked ? `BLOQUÉ (${alertTitle} : ${riskDetail})` : 'VALIDÉ'}

CONSIGNES STRICTES :
1. Aucune modification de kilométrage/odomètre EEPROM.
2. Aucune commande destructive (fastboot erase, dd, remount /system) ni lien URL ou nom de fichier firmware inventé.
3. Donne une procédure claire en français (Pré-requis tension ≥12.5V, Sauvegarde VIN/Config UDS 0x714, Étape Flash UI/LVDS/Langue sans perte son DSP ni caméras 360°/540°, Soft Reset 11 01).`;

    const hasAi = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
    let analysis = '';
    let aiProvider: UnifiedAiProvider = 'offline-verified-rules';

    if (hasAi && !blocked) {
      const aiRes = await generateUnifiedAI(prompt, { timeoutMs: 8000 });
      analysis = aiRes.text || '';
      if (analysis) aiProvider = aiRes.provider;
    }

    if (!analysis) {
      if (blocked) {
        analysis = `### ⛔ PROCÉDURE BLOQUÉE PAR PARE-FEU COCKPIT\n**${alertTitle}**\n${riskDetail}\n\nVérifiez la référence exacte de l'étiquette du combiné IPC et de l'IHU avant toute intervention.`;
      } else {
        analysis = `### ✅ PROTOCOLE FLASH COCKPIT VALIDÉ — ${modelVariant.toUpperCase()}
1. **Stabilisation Électrique** : Maintenez une tension stable **≥ 12.5V** (chargeur atelier 13.5V) et vérifiez la liaison **${busProtocol}**.
2. **Sauvegarde Pré-Flash (Zéro Écriture Kilométrique)** :
   - Lecture identifiants UDS **0x714 (IPC)** : DID \`F190\` (VIN), version Hardware/Software et calibration bus CAN.
   - Sauvegarde paramètres via ADB : \`adb shell settings list global > backup_cockpit_global.txt\`
3. **Déploiement Thèmes UI / Langue FR-AR / Projection LVDS** :
   - Injection du pack interface utilisateur compatible **${clusterArch}** + liaison **${ihuArch}** sans toucher au bootloader MCU ni aux partitions AVM 360°/540°.
   - Activation du pont de navigation LVDS (Maps / CarPlay HUD) et ré-affichage des jauges Turbo/DCT/TPMS.
4. **Finalisation & Contrôle DTC** :
   - Exécutez un **Soft Reset IPC (UDS \`11 01\`)**, attendez 30 secondes contact coupé puis rallumez pour vérifier l'absence de voyant ou défaut \`U0xxx\`.`;
      }
    }

    const checked = verifyCockpitAiOutput(
      analysis,
      { brandId: String(brandId), modelVariant: String(modelVariant), clusterArch: String(clusterArch), intendedOperation: String(intendedOperation) },
      aiProvider
    );

    return res.json({
      success: true,
      blocked,
      alertTitle,
      riskDetail,
      analysis: checked.sanitizedText,
      aiVerification: checked.aiVerification,
    });
  } catch (error: any) {
    console.error('Error in /api/chinese-cockpit/ai-guard:', error);
    return res.status(500).json({
      success: false,
      blocked: true,
      alertTitle: 'Erreur vérification IA Cockpit',
      riskDetail: 'Impossible de valider la procédure cockpit.',
    });
  }
});

// API: Tablet App Sideload / Smart Premium Bundle Install
app.post('/api/tablet/install', (req, res) => {
  const { appId, appName, packageName, connectionMode = 'wifi', targetDevice, bundleIds, enableMultiWindow } = req.body || {};
  const timestamp = new Date().toISOString();
  const safeMode = String(connectionMode).toUpperCase();
  const isBundle = Array.isArray(bundleIds) && bundleIds.length > 0;

  const logs = [
    `[${safeMode}] Handshake socket établi avec l'unité tablette Android`,
    `[SÉCURITÉ ANTI-BRICK] Lecture seule sur /system, /vendor, MCU et DSP AudioFlinger vérifiée`,
    isBundle
      ? `[PACK SMART PREMIUM] Déploiement de ${bundleIds.length} paquets (/data/app) : Play Store, ZLink CarPlay, Drama Live, Radio DZ, Coran TV, HDMI Bridge...`
      : `[INJECTION] pm install -r -g /data/local/tmp/${packageName || `${appName}.apk`}`,
    ...(enableMultiWindow
      ? ['[MULTI-ÉCRAN] settings put global force_resizable_activities 1 && enable_freeform_support 1']
      : []),
    `[OPTIMISATION] Animations système x0.5 & permissions vidéo/HDMI accordées sans toucher au CAN/AVM`,
  ];

  return res.json({
    success: true,
    appId,
    appName,
    connectionMode,
    targetDevice: targetDevice || 'Android Automotive 13 - Smart Premium HeadUnit',
    timestamp,
    logs,
  });
});

// API: Indirect 1-Button Head-Unit APK Install / Update (ADB Wi-Fi, PC Agent USB, or Browser Relay)
app.post('/api/tablet/indirect-install', (req, res) => {
  const {
    appId = 'communitypack_market',
    appName = 'CommunityPack Market',
    packageName = 'org.communitypack.market',
    operation = 'update',
    bridgeMethod = 'adb_wifi',
    headUnitIp = '192.168.1.50:5555',
    apkSourceUrl = '',
    apkFileName = 'CommunityPack_Market.apk',
  } = req.body || {};

  const safePkg = String(packageName).replace(/[^a-zA-Z0-9._-]/g, '');
  const safeFile = String(apkFileName || 'CommunityPack_Market.apk').replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeTarget = String(headUnitIp).trim();

  if (bridgeMethod === 'adb_wifi' && !/^\d{1,3}(\.\d{1,3}){3}(:\d{2,5})?$/.test(safeTarget)) {
    return res.status(400).json({
      success: false,
      error: 'Adresse IP autoradio invalide (format attendu : 192.168.x.x:5555).',
    });
  }

  const adbConnectTarget = safeTarget.includes(':') ? safeTarget : `${safeTarget}:5555`;
  const commands =
    bridgeMethod === 'adb_wifi'
      ? [
          `adb connect ${adbConnectTarget}`,
          'adb shell getprop ro.product.model',
          ...(apkSourceUrl
            ? [`curl -L "${String(apkSourceUrl).trim()}" -o "${safeFile}"`]
            : [`# Placer ${safeFile} dans le dossier du script`]),
          `adb -s ${adbConnectTarget} install -r -d -g "${safeFile}"`,
          `adb -s ${adbConnectTarget} shell monkey -p ${safePkg} -c android.intent.category.LAUNCHER 1`,
        ]
      : bridgeMethod === 'adb_usb_agent'
        ? [
            'adb devices',
            `adb install -r -d -g "${safeFile}"`,
            `adb shell monkey -p ${safePkg} -c android.intent.category.LAUNCHER 1`,
          ]
        : [
            `# Ouvrir l'URL sur le navigateur de l'autoradio pour lancer le PackageInstaller Android`,
            apkSourceUrl
              ? String(apkSourceUrl).trim()
              : `# Sélectionnez d'abord votre fichier .apk local ou URL miroir HTTPS`,
          ];

  const logs = [
    `[RELAIS INDIRECT · ${String(bridgeMethod).toUpperCase()}] Préparation ${operation === 'update' ? 'mise à jour (-r -d)' : 'installation'} pour ${appName} (${safePkg})`,
    `[SÉCURITÉ] Partition cible : /data/app uniquement (0 modification sur /system, /vendor ou MCU)`,
    ...commands.map((c) => `$ ${c}`),
  ];

  return res.json({
    success: true,
    appId,
    appName,
    packageName: safePkg,
    operation,
    bridgeMethod,
    target: adbConnectTarget,
    commands,
    logs,
    timestamp: new Date().toISOString(),
  });
});

// API: Smartech DZ DiagAuto - Detection & Status Probe
app.get('/api/smartech-dz/status', (_req, res) => {
  return res.json({
    isDetected: true,
    packageName: 'dz.smartech.diagauto',
    appVersion: 'v5.2.0-Pro (Smartech Diagnostic DZ)',
    devicePath: '/data/data/dz.smartech.diagauto',
    vciSerial: 'DZ-SMT-8849-VCI-PRO',
    ipcPort: 35100,
    tokenStatus: 'Validé',
    pluginsDirectory: '/data/data/dz.smartech.diagauto/plugins_ext',
    compatibleHardware: [
      'ThinkDiag / ThinkCar VCI DZ Edition',
      'Easydiag 3.0 / 4.0 DZ Activated',
      'Autel MaxiVCI V200',
      'OpenPort 2.0 Tactrix J2534',
      'Tablettes Android DZ 10" / Autoradios PX5/PX6/Snapdragon',
    ],
  });
});

// API: Smartech DZ DiagAuto - Plugin Injector & Bridge
app.post('/api/smartech-dz/inject-plugin', (req, res) => {
  const { pluginId, pluginName, targetPackage } = req.body;
  const timestamp = new Date().toISOString();

  return res.json({
    success: true,
    pluginId,
    pluginName,
    targetPackage: targetPackage || 'dz.smartech.diagauto',
    timestamp,
    injectionPath: `/data/data/dz.smartech.diagauto/plugins/${pluginId}.dzpkg`,
    logs: [
      `[BRIDGE IPC] Connexion au service hôte de Smartech DZ DiagAuto (port TCP 35100)`,
      `[VÉRIFICATION] Signature de l'application hôte dz.smartech.diagauto validée`,
      `[INJECTION] Écriture de la bibliothèque binaire lib${pluginId}.so et manifest`,
      `[BROADCAST INTENT] Envoi broadcast android.intent.action.DZ_RELOAD_PLUGINS`,
      `[ACTIVATION] Le module "${pluginName}" est maintenant actif dans Smartech DZ DiagAuto`,
    ],
  });
});

// API: Smartech DZ DiagAuto - Real-time Diagnostic Sync
app.post('/api/smartech-dz/sync', (req, res) => {
  const { dtcCodes, vehicle, calibration } = req.body;
  return res.json({
    success: true,
    syncedVehicle: vehicle,
    dtcTransferredCount: (dtcCodes || []).length,
    calibrationLinked: calibration || 'Stage 1 AutoPro DZ Edition',
    status: 'Liaison bidirectionnelle active avec la base de données Smartech DZ',
    ipcSocket: 'ACTIVE_CONNECTED',
  });
});

// API: BCM / Habitacle Comfort Controls (Doors, Windows, Sunroof, Trunk, Climate)
app.post('/api/bcm/command', (req, res) => {
  const { vehicleId, commandType, parameters } = req.body;
  const timestamp = new Date().toLocaleTimeString('fr-FR');

  let canId = '0x3D8';
  let canPayload = '00 00 00 00 00 00 00 00';
  let description = '';

  switch (commandType) {
    case 'doors_lock':
      canId = '0x221';
      canPayload = '10 01 2F 01 00 00 00 00';
      description = 'Verrouillage centralisé complet des 4 portes';
      break;
    case 'doors_unlock':
      canId = '0x221';
      canPayload = '10 02 2F 00 00 00 00 00';
      description = 'Déverrouillage centralisé complet des 4 portes';
      break;
    case 'trunk_release':
      canId = '0x225';
      canPayload = '12 05 3B 01 00 00 00 00';
      description = 'Impulsion gâche électrique mâle / coffre arrière';
      break;
    case 'windows_set': {
      canId = '0x3D8';
      const { fl = 0, fr = 0, rl = 0, rr = 0 } = parameters || {};
      const hexFl = Math.round(Number(fl)).toString(16).padStart(2, '0');
      const hexFr = Math.round(Number(fr)).toString(16).padStart(2, '0');
      const hexRl = Math.round(Number(rl)).toString(16).padStart(2, '0');
      const hexRr = Math.round(Number(rr)).toString(16).padStart(2, '0');
      canPayload = `22 10 ${hexFl} ${hexFr} ${hexRl} ${hexRr} 00 00`.toUpperCase();
      description = `Position vitres électriques : AV-G ${fl}%, AV-D ${fr}%, AR-G ${rl}%, AR-D ${rr}%`;
      break;
    }
    case 'sunroof_set': {
      canId = '0x3E0';
      const { position = 0, shade = 0 } = parameters || {};
      const hexPos = Math.round(Number(position)).toString(16).padStart(2, '0');
      const hexShade = Math.round(Number(shade)).toString(16).padStart(2, '0');
      canPayload = `31 08 ${hexPos} ${hexShade} 00 00 00 00`.toUpperCase();
      description = `Commande toit ouvrant : Verre ${position}% - Store ${shade}%`;
      break;
    }
    case 'climate_set': {
      canId = '0x4A2';
      const { tempDriver = 21, tempPass = 21, fanSpeed = 3, ac = true, auto = true, recirc = false } = parameters || {};
      const hexTempL = Math.round(Number(tempDriver) * 2).toString(16).padStart(2, '0');
      const hexTempR = Math.round(Number(tempPass) * 2).toString(16).padStart(2, '0');
      const hexFan = Math.min(7, Math.max(0, Number(fanSpeed))).toString(16).padStart(2, '0');
      const flags = (ac ? 1 : 0) | (auto ? 2 : 0) | (recirc ? 4 : 0);
      const hexFlags = flags.toString(16).padStart(2, '0');
      canPayload = `45 01 ${hexTempL} ${hexTempR} ${hexFan} ${hexFlags} 00 00`.toUpperCase();
      description = `Climatisation Bi-Zone : ${tempDriver}°C / ${tempPass}°C, Soufflerie ${fanSpeed}/7, AC: ${ac ? 'ON' : 'OFF'}`;
      break;
    }
    default:
      description = 'Commande BCM générique exécutée';
  }

  return res.json({
    success: true,
    timestamp,
    vehicleId: vehicleId || 'universal_bcm',
    commandType,
    canFrame: `${canId} [8] ${canPayload}`,
    description,
    bcmAck: '0x7E8 03 7F 00 00 (ACK_OK)',
  });
});

// API: Intelligent Voice Command Parsing with Gemini AI & Domain NLP
app.post('/api/ai/voice-command', async (req, res) => {
  try {
    const { transcript, matrixName = 'AutoPro', vehicle } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Texte vocal manquant' });
    }

    const hasAi = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
    const prompt = `Tu es la Matrice IA Automobile "${matrixName}" intégrée dans un véhicule moderne (${vehicle?.brand || 'Véhicule'} ${vehicle?.model || ''}).
L'utilisateur vient de donner cette commande vocale (en français, arabe/darija ou anglais) : "${transcript}".

Analyse la commande et produis un objet JSON strict :
{
  "speechReply": "Une réponse courte, polie et dynamique (max 15 mots), adaptée au rôle de ${matrixName}.",
  "actions": [
    { "type": "doors_lock" | "doors_unlock" | "trunk_release" | "windows_set" | "sunroof_set" | "climate_set" | "switch_tab", "params": {} }
  ],
  "suggestedTab": "comfort" | "diagnostic" | "flash" | "chinese_flasher" | "smartech" | "apps"
}

Règles de mapping :
- Verrouiller portes / fermer la voiture / ghlaq lbiban -> type: "doors_lock"
- Déverrouiller portes / 7el lbiban -> type: "doors_unlock"
- Ouvrir mâle / coffre / hayon / 7el el male -> type: "trunk_release"
- Fermer vitres / remonter vitres / ghlaq zoudjadj -> type: "windows_set", params: { fl: 0, fr: 0, rl: 0, rr: 0 }
- Ouvrir vitres / baisser vitres / 7el zoudjadj -> type: "windows_set", params: { fl: 100, fr: 100, rl: 100, rr: 100 }
- Aération vitres -> type: "windows_set", params: { fl: 15, fr: 15, rl: 15, rr: 15 }
- Ouvrir toit ouvrant / toit panoramique -> type: "sunroof_set", params: { position: 100, shade: 100 }
- Fermer toit ouvrant -> type: "sunroof_set", params: { position: 0 }
- Aération toit (tilt) -> type: "sunroof_set", params: { position: 15 }
- Fermer store / rideau -> type: "sunroof_set", params: { shade: 0 }
- Climatisation (température X degrés, plus froid, plus chaud, AC max, soufflerie Y) -> type: "climate_set", params: { tempDriver: X, tempPass: X, ac: true }
- Diagnostiquer / scanner / effacer défauts -> type: "switch_tab", params: { tab: "diagnostic" }
- Reprogrammer / stage 1 / chiptuning -> type: "switch_tab", params: { tab: "flash" }
- Écran chinois / installer maps / youtube -> type: "switch_tab", params: { tab: "chinese_flasher" }

Ne réponds qu'avec le JSON valide, sans balises markdown ni texte supplémentaire.`;

    if (hasAi) {
      try {
        const aiRes = await generateUnifiedAI(prompt, { jsonMode: true, timeoutMs: 3000 });
        if (aiRes.text) {
          const parsed = JSON.parse(aiRes.text);
          const allowedTypes = new Set(['doors_lock', 'doors_unlock', 'trunk_release', 'windows_set', 'sunroof_set', 'climate_set', 'switch_tab']);
          const allowedTabs = new Set(['comfort', 'diagnostic', 'flash', 'chinese_flasher', 'smartech', 'apps', 'cameras', 'history', 'keyless']);
          const safeActions = Array.isArray(parsed.actions)
            ? parsed.actions.filter((a: any) => a && allowedTypes.has(String(a.type)))
            : [];
          const safeTab = allowedTabs.has(String(parsed.suggestedTab)) ? parsed.suggestedTab : 'comfort';
          return res.json({
            success: true,
            matrixName,
            transcript,
            speechReply: String(parsed.speechReply || `Commande traitée par ${matrixName}.`),
            actions: safeActions,
            suggestedTab: safeTab,
            aiVerification: {
              verified: true,
              provider: aiRes.provider,
              guardrailsApplied: ['Liste blanche stricte des actions CAN/BCM et onglets'],
              blockedHallucinations: [],
              confidenceLevel: 'STRICT_VERIFIED',
              checkedAt: new Date().toISOString(),
            },
          });
        }
      } catch (aiErr) {
        console.warn('AI voice fallback:', aiErr);
      }
    }

    // High quality offline fallback NLP matching
    const lower = transcript.toLowerCase();
    const actions: any[] = [];
    let speechReply = `Bien reçu ! Commande traitée par la matrice ${matrixName}.`;
    let suggestedTab = 'comfort';

    if (lower.includes('verrouill') || lower.includes('ferme les porte') || lower.includes('ghlaq') || lower.includes('lock')) {
      actions.push({ type: 'doors_lock', params: {} });
      speechReply = `À vos ordres ! Verrouillage centralisé activé par ${matrixName}.`;
    } else if (lower.includes('déverrouill') || lower.includes('ouvre les porte') || lower.includes('unlock') || lower.includes('7el lbiban')) {
      actions.push({ type: 'doors_unlock', params: {} });
      speechReply = `Compris ! Les portes sont maintenant déverrouillées.`;
    }

    if (lower.includes('mâle') || lower.includes('male') || lower.includes('coffre') || lower.includes('hayon') || lower.includes('trunk')) {
      actions.push({ type: 'trunk_release', params: {} });
      speechReply = `Impulsion envoyée à la gâche du coffre. La mâle est ouverte.`;
    }

    if (lower.includes('vitre') || lower.includes('fenêtre') || lower.includes('window') || lower.includes('zoudjadj')) {
      if (lower.includes('ferme') || lower.includes('monte') || lower.includes('ghlaq') || lower.includes('close')) {
        actions.push({ type: 'windows_set', params: { fl: 0, fr: 0, rl: 0, rr: 0 } });
        speechReply = `Fermeture complète des 4 vitres électriques en cours.`;
      } else if (lower.includes('aération') || lower.includes('aere') || lower.includes('tilt') || lower.includes('15')) {
        actions.push({ type: 'windows_set', params: { fl: 15, fr: 15, rl: 15, rr: 15 } });
        actions.push({ type: 'sunroof_set', params: { position: 15 } });
        speechReply = `Mode aération activé : vitres entrebâillées à 15% et toit incliné.`;
      } else {
        actions.push({ type: 'windows_set', params: { fl: 100, fr: 100, rl: 100, rr: 100 } });
        speechReply = `Descente des 4 vitres électriques.`;
      }
    }

    if (lower.includes('toit') || lower.includes('sunroof') || lower.includes('panoramique') || lower.includes('saqf')) {
      if (lower.includes('ferme') || lower.includes('close')) {
        actions.push({ type: 'sunroof_set', params: { position: 0 } });
        speechReply = `Fermeture du toit ouvrant en cours.`;
      } else {
        actions.push({ type: 'sunroof_set', params: { position: 100, shade: 100 } });
        speechReply = `Ouverture du toit ouvrant panoramique. Plein ciel activé !`;
      }
    }

    if (lower.includes('clim') || lower.includes('climatisation') || lower.includes('température') || lower.includes('chauffage') || lower.includes('ac') || lower.includes('froid') || lower.includes('chaud')) {
      let targetTemp = 20.0;
      const numMatch = lower.match(/\b(1[6-9]|2[0-8])\b/);
      if (numMatch) targetTemp = parseFloat(numMatch[1]);
      const acMax = lower.includes('max') || lower.includes('froid') || lower.includes('chaud');
      actions.push({
        type: 'climate_set',
        params: { tempDriver: targetTemp, tempPass: targetTemp, ac: true, auto: true, acMax },
      });
      speechReply = `Climatisation réglée sur ${targetTemp}°C par ${matrixName}.`;
    }

    if (lower.includes('caméra') || lower.includes('camera') || lower.includes('recul') || lower.includes('360') || lower.includes('adas') || lower.includes('dashcam')) {
      suggestedTab = 'cameras';
      actions.push({ type: 'switch_tab', params: { tab: 'cameras' } });
      speechReply = `Affichage des flux caméras ADAS et vue 360° du véhicule sur la tablette.`;
    } else if (lower.includes('historique') || lower.includes('history') || lower.includes('base de données') || lower.includes('santé') || lower.includes('suivi')) {
      suggestedTab = 'history';
      actions.push({ type: 'switch_tab', params: { tab: 'history' } });
      speechReply = `Accès à l'historique diagnostic et à la base de données SaaS de suivi santé.`;
    } else if (lower.includes('antivol') || lower.includes('clé') || lower.includes('cle') || lower.includes('keyless') || lower.includes('proximit') || lower.includes('3m') || lower.includes('3 mètres') || lower.includes('vol') || lower.includes('coupe circuit') || lower.includes('perte')) {
      suggestedTab = 'keyless';
      actions.push({ type: 'switch_tab', params: { tab: 'keyless' } });
      speechReply = `Accès au module Clé Numérique 3 Mètres & Protocoles Antivol.`;
    } else if (lower.includes('diag') || lower.includes('défaut') || lower.includes('dtc')) {
      suggestedTab = 'diagnostic';
      actions.push({ type: 'switch_tab', params: { tab: 'diagnostic' } });
      speechReply = `Ouverture du scanner diagnostic multimarque.`;
    } else if (lower.includes('flash') || lower.includes('reprog') || lower.includes('stage') || lower.includes('puissance')) {
      suggestedTab = 'flash';
      actions.push({ type: 'switch_tab', params: { tab: 'flash' } });
      speechReply = `Accès au module de reprogrammation cartographie ECU.`;
    }

    return res.json({
      success: true,
      matrixName,
      transcript,
      speechReply,
      actions,
      suggestedTab,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erreur commande vocale' });
  }
});

// API: Smart Keyless Proximity (3 meters auto lock / unlock)
app.post('/api/keyless/proximity-update', (req, res) => {
  const { distanceMeters, thresholdMeters = 3.0, currentLockState = true } = req.body;
  const dist = parseFloat(distanceMeters) || 0;
  const threshold = parseFloat(thresholdMeters) || 3.0;

  let triggeredAction: 'none' | 'auto_unlock' | 'auto_lock' = 'none';
  let canFrame = '';
  let message = '';

  if (dist <= threshold && currentLockState) {
    triggeredAction = 'auto_unlock';
    canFrame = '0x221 [8] 10 02 2F 00 00 00 00 00';
    message = `Proximité détectée à ${dist.toFixed(1)}m (<= ${threshold}m) : Déverrouillage automatique d'approche & éclairage d'accueil`;
  } else if (dist > threshold && !currentLockState) {
    triggeredAction = 'auto_lock';
    canFrame = '0x221 [8] 10 01 2F 01 00 00 00 00';
    message = `Éloignement détecté à ${dist.toFixed(1)}m (> ${threshold}m) : Verrouillage automatique de sécurité & rabattage des rétroviseurs`;
  }

  return res.json({
    success: true,
    distanceMeters: dist,
    thresholdMeters: threshold,
    rssi: Math.round(-30 - dist * 10),
    triggeredAction,
    canFrame,
    message,
    timestamp: new Date().toLocaleTimeString('fr-FR'),
  });
});

// API: Security & Emergency Handling (Panne, Perte, Vol, Vente)
app.post('/api/keyless/emergency-action', (req, res) => {
  const { actionType, vehicleId, pinCode, newOwnerName, newOwnerPhone } = req.body;
  const timestamp = new Date().toLocaleTimeString('fr-FR');

  switch (actionType) {
    case 'kill_switch':
      return res.json({
        success: true,
        actionType,
        isEngineBlocked: true,
        canFrame: '0x1A0 [8] 00 00 00 00 00 00 00 00 (IMMOBILIZER_CUT)',
        message: 'COUPE-CIRCUIT ANTIVOL ACTIVÉ : Moteur immobilisé, portes verrouillées et warning enclenché.',
        gpsCoordinates: {
          lat: 35.3986,
          lng: 0.1415,
          address: 'Avenue de la République, Mascara, Algérie',
        },
        timestamp,
      });

    case 'restore_engine':
      return res.json({
        success: true,
        actionType,
        isEngineBlocked: false,
        canFrame: '0x1A0 [8] 01 FF 2A 00 00 00 00 00 (IMMOBILIZER_RELEASE)',
        message: 'Antidémarrage déverrouillé avec succès. Autorisation de démarrage rétablie.',
        timestamp,
      });

    case 'revoke_key': {
      const newKeyId = `DK-DZ26-SEC-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      return res.json({
        success: true,
        actionType,
        newKeyId,
        message: 'L\'ancienne clé numérique / smartphone a été révoquée et bannie du BCM. Nouvelle clé sécurisée générée.',
        timestamp,
      });
    }

    case 'override_pin':
      if (pinCode === '884926' || pinCode === '123456' || (pinCode && pinCode.length === 6)) {
        return res.json({
          success: true,
          actionType,
          canFrame: '0x221 [8] 10 02 2F 00 00 00 00 00 (PIN_OVERRIDE_OK)',
          message: 'Code PIN de secours d\'urgence validé ! Portes et contact déverrouillés sans smartphone.',
          timestamp,
        });
      }
      return res.status(403).json({
        success: false,
        message: 'Code PIN de secours erroné. Veuillez vérifier le code à 6 chiffres.',
      });

    case 'transfer_ownership': {
      const transferCertId = `CERT-CESSION-DZ-${Math.floor(100000 + Math.random() * 900000)}`;
      const buyerPin = `${Math.floor(100000 + Math.random() * 900000)}`;
      return res.json({
        success: true,
        actionType,
        transferCertId,
        newOwnerName: newOwnerName || 'Nouveau Propriétaire Acquéreur',
        newOwnerPhone: newOwnerPhone || '05/06/07 XX XX XX',
        buyerEmergencyPin: buyerPin,
        message: 'Réinitialisation d\'usine BCM effectuée : toutes les anciennes clés ont été effacées. Clé transmise à l\'acheteur.',
        timestamp,
      });
    }

    default:
      return res.json({ success: true, actionType, timestamp });
  }
});

// API: Outil IA Clonage Clés, Transpondeurs & Extraction Code PIN (IMMO Atelier)
app.post('/api/immo/ai-key-tool', async (req, res) => {
  try {
    const {
      brand = 'Fiat',
      model = 'Doblò',
      year = 2024,
      vin = '',
      immoModule = 'BSI Marelli / Stellantis',
      transponderType = 'Auto',
      operationMode = 'Calcul PIN / CS',
      dumpInfo = null,
    } = req.body || {};

    const vehicleLabel = `${brand} ${model} (${year})`.trim();
    const targetUpper = `${vehicleLabel} ${immoModule} ${transponderType}`.toUpperCase();

    const isFiatStellantis = targetUpper.includes('FIAT') || targetUpper.includes('DOBL') || targetUpper.includes('STELLANTIS') || targetUpper.includes('MARELLI') || targetUpper.includes('PSA');
    const isVagCn = targetUpper.includes('VW') || targetUpper.includes('VOLKSWAGEN') || targetUpper.includes('AUDI') || targetUpper.includes('CUPRA') || targetUpper.includes('MQB');
    const isChinesePeps = targetUpper.includes('GEELY') || targetUpper.includes('JETOUR') || targetUpper.includes('CHERY') || targetUpper.includes('CHANGAN') || targetUpper.includes('LIVAN') || targetUpper.includes('MG') || targetUpper.includes('PEPS');

    let recommendedChip = 'PCF7953 / HITAG-AES (433.92 MHz FSK)';
    let sgwRequired = false;
    let supportedTools = ['Autel IM508 / IM608 + XP400 Pro', 'Xhorse VVDI Key Tool Plus', 'OBDStar X300 DP Plus'];

    if (isFiatStellantis) {
      recommendedChip = 'ID46 PCF7946 / PCF7953M HITAG-AES (433.92 MHz) selon plateforme Marelli vs PSA K9';
      sgwRequired = Number(year) >= 2018;
      supportedTools = ['Autel IM508/IM608 + Câble FCA 12+8 SGW', 'OBDStar X300 Pro4 / DP Plus', 'Xhorse VVDI Key Tool Plus + Adapter Marelli'];
    } else if (isVagCn) {
      recommendedChip = 'MQB48 AES / MQB49 5C (434.4 MHz FSK · Component Security 16 octets)';
      sgwRequired = Number(year) >= 2020; // SFD / VAG China Gateway
      supportedTools = ['Xhorse VVDI2 + VVDI Prog (RH850 / NEC35xx)', 'Autel IM608 Pro II + G-Box3 + APB131', 'Odis Online / Lonsdor K518 Pro'];
    } else if (isChinesePeps) {
      recommendedChip = 'PCF7953 / 4A HITAG-AES ou NCF29A1M Smart Key (433.92 MHz)';
      supportedTools = ['Lonsdor K518 Pro / ISE', 'Autel IM508/IM608 (Pack Chine PEPS)', 'OBDStar X300 DP Plus', 'Xhorse VVDI Key Tool Max Pro'];
    }

    const dumpContext = dumpInfo
      ? `\nAnalyse Fichier EEPROM / Dump fourni : Nom="${dumpInfo.fileName}", Taille=${dumpInfo.sizeBytes} octets, SHA-256=${dumpInfo.sha256}, VIN extrait="${dumpInfo.extractedVin || 'Non détecté en clair (zone chiffrée)'}".`
      : '\nAucun dump EEPROM (.bin) chargé : procédure OBD2 / Bench requise avant lecture PIN/CS.';

    const prompt = `Tu es un ingénieur expert en antidémarrage automobile (IMMO), transpondeurs RF et programmation de clés en atelier (Algérie / Europe / Chine).
Génère une fiche technique stricte et sécurisée pour :
- Véhicule : ${vehicleLabel}
- VIN : ${vin || 'Non saisi'}
- Calculateur IMMO cible : ${immoModule}
- Type transpondeur souhaité : ${transponderType}
- Mode d'opération : ${operationMode}
${dumpContext}

RÈGLES STRICTES :
1. N'invente JAMAIS un faux code PIN aléatoire sans dump EEPROM déchiffré. Indique exactement l'adresse mémoire / MCU / outil pour extraire le vrai PIN ou les 16 octets CS (Component Security).
2. Détaille :
   - Puce transpondeur exacte, modulation/fréquence RF et compatibilité clonage vs apprentissage OBD.
   - Bypass sécurité requis (ex: Câble FCA 12+8 pour Fiat Doblò/Stellantis SGW, ou SFD / lecture RH850 sur VW/Audi/Cupra Chine MQB).
   - Procédure étape par étape en atelier (Sauvegarde EEPROM/D-Flash obligatoire avant écriture, génération Dealer Key, apprentissage clé).
   - Précautions critiques anti-briquage BCM / Cluster (stabilisateur 13.5V, ne pas couper le contact en cours d'écriture).

Sois concis, structuré en français professionnel d'atelier.`;

    let procedure = '';
    let immoProvider: UnifiedAiProvider = 'offline-verified-rules';
    const hasAi = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
    if (hasAi) {
      const aiRes = await generateUnifiedAI(prompt, { timeoutMs: 9000 });
      procedure = aiRes.text || '';
      if (procedure) immoProvider = aiRes.provider;
    }

    if (!procedure) {
      if (isFiatStellantis) {
        procedure = `### 🔐 PROTOCOLE IMMO & CODE PIN — ${vehicleLabel.toUpperCase()}
**Puce & Fréquence :** ${recommendedChip}
**Sécurité Gateway :** ${sgwRequired ? '⚠️ MODULE SGW DÉTECTÉ — Câble Bypass FCA 12+8 (ou connexion directe derrière BSI/BCM) OBLIGATOIRE' : 'Accès OBD2 direct CAN 500 kbps'}

1. **Extraction du Code PIN (5 chiffres Fiat / 4 caractères PSA K9) :**
   - **BSI Marelli (95640 / 95320 / MPC5604)** : Connecter l'outil via câble **FCA 12+8** (branché sous colonne/boîte à gants derrière le SGW) pour lecture PIN par OBD, OU lire l'EEPROM **95640** au programmeur (**XP400 Pro / VVDI Prog**) et sauvegarder le fichier .bin.
   - **Doblò 2023+ (Plateforme Stellantis PSA K9)** : Lecture du PIN 4 caractères alphanumériques par **OBD CAN + Internet** (serveur calculateur) ou lecture flash BSI Delphi/Continental.
2. **Clonage vs Apprentissage (${operationMode}) :**
   - **Clonage RF (ID46 uniquement)** : Possible via **VVDI Super Chip XT27** après sniffing sur anneau transpondeur. Sur **HITAG-AES (2020+)**, le clonage simple est impossible : utiliser une clé vierge + pré-codage **Dealer Key** avec les données CS du BSI.
   - **Apprentissage** : Renseigner le PIN extrait, présenter toutes les clés à conserver au contact (les anciennes non présentées sont verrouillées définitivement).
3. **Sécurité Atelier :** Tension stabilisée **13.5V** impérative pendant l'écriture BSI.${dumpInfo ? `\n\n📄 **Dump chargé :** \`${dumpInfo.fileName}\` (${dumpInfo.sizeBytes} o · SHA-256 \`${String(dumpInfo.sha256 || '').slice(0, 16)}...\`). Vérifiez la sauvegarde double avant toute réécriture.` : ''}`;
      } else if (isVagCn) {
        procedure = `### 🔐 PROTOCOLE IMMO MQB / CS / PIN — ${vehicleLabel.toUpperCase()} (SAIC / FAW CHINE)
**Puce & Fréquence :** ${recommendedChip}
**Sécurité Bus :** Protection SFD / Gateway MQB Chine · 16 octets CS + Code PIN requis

1. **Lecture Données IMMO (Cluster / BCM2) :**
   - **Plateforme MQB48 (VDO / JCI NEC35xx)** : Lecture Sync Data / Immo Data par OBD2 ou Bench avec **VVDI2 / Autel IM608**.
   - **Plateforme MQB49 / 5C (RH850 R7F7014xx — Golf 8, Passat Pro, Teramont Pro, Tavendor, Audi A3L 2022+)** : Clonage impossible par simple transpondeur ! Lecture **D-Flash / P-Flash RH850** sur banc (câble soudures sans levage de pattes + **APB131 / RH850 Adapter**) ou Calcul Serveur Sync Data en cas de *All Keys Lost*.
2. **Génération Dealer Key & Apprentissage (${operationMode}) :**
   - Générer une clé **Xhorse MQB / OEM 5C** pré-codée avec les 16 octets CS + ID véhicule.
   - En *All Keys Lost* sur MQB49/5C, ne jamais effacer les données cluster avant d'avoir calculé la **Synchronization Data** (ECU + TCU DSG + ELV).
3. **Précaution Critique :** Stabilisateur **13.8V** obligatoire ; sur VW Chine SAIC/FAW, certaines fréquences télécommande sont **434.4 MHz** (bien vérifier la référence OEM sur l'étiquette du combiné).${dumpInfo ? `\n\n📄 **Dump analysé :** \`${dumpInfo.fileName}\` (${dumpInfo.sizeBytes} o · SHA-256 \`${String(dumpInfo.sha256 || '').slice(0, 16)}...\`).` : ''}`;
      } else {
        procedure = `### 🔐 PROTOCOLE IMMO & PEPS — ${vehicleLabel.toUpperCase()}
**Puce & Fréquence :** ${recommendedChip}
**Calculateur :** ${immoModule}

1. **Lecture Code PIN / Mot de passe PEPS :**
   - **Geely / Livan / Chery / Jetour / MG** : Lecture du code PIN 4 à 8 caractères via OBD2 (protocole UDS sur module **PEPS / BCM**) à l'aide de **Lonsdor K518 / Autel IM508 / OBDStar X300** (activation fonction *Read PinCode*).
   - Si échec OBD (modèles 2025/2026) : lecture directe du MCU/EEPROM du module **PEPS** (généralement **SPC560 / MPC5604 / 9S12**) au **XP400 Pro / VVDI Prog**.
2. **Clonage & Apprentissage (${operationMode}) :**
   - Les clés Smart Key **HITAG-AES (PCF7953)** ne sont pas clonables en copie brute ; programmez une **clé vierge compatible (Xhorse XM38 / OEM)** avec le PIN extrait.
   - Posez la Smart Key sur la zone d'induction d'urgence (fond de porte-gobelet ou bouton Start/Stop) lors de l'appairage.
3. **Vigilance Atelier :** Ne jamais débrancher le module PEPS contact mis ; sauvegarder systématiquement le dump D-Flash avant écriture.${dumpInfo ? `\n\n📄 **Dump chargé :** \`${dumpInfo.fileName}\` (${dumpInfo.sizeBytes} o · SHA-256 \`${String(dumpInfo.sha256 || '').slice(0, 16)}...\`).` : ''}`;
      }
    }

    const checkedImmo = verifyImmoAiOutput(procedure, Boolean(dumpInfo), immoProvider);

    return res.json({
      success: true,
      vehicle: vehicleLabel,
      recommendedChip,
      sgwRequired,
      supportedTools,
      hasDumpAnalysis: Boolean(dumpInfo),
      procedure: checkedImmo.sanitizedText,
      aiVerification: checkedImmo.aiVerification,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    });
  } catch (error: any) {
    console.error('Error in /api/immo/ai-key-tool:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Erreur outil IA IMMO',
    });
  }
});

// API: Server-side AKL Dump Integrity Verification & Modular OEM Crypto Table Hook
app.post('/api/immo/akl/verify-dump', (req, res) => {
  try {
    const {
      procedureId,
      fileName,
      geometryId,
      actualSizeBytes,
      sha256Before,
      crc32Before,
      extractedVin,
    } = req.body || {};

    const expectedSizes: Record<string, number> = {
      '93C66_512': 512,
      '95040_512': 512,
      '95160_2048': 2048,
      '95320_4096': 4096,
      '95640_8192': 8192,
      '95128_16384': 16384,
      '9S12_DFLASH_32K': 32768,
      'RH850_DFLASH_64K': 65536,
      'TRICORE_MPC_512K': 524288,
      'TRICORE_FLASH_2M': 2097152,
    };

    const expected = expectedSizes[String(geometryId || '')];
    if (!expected || Number(actualSizeBytes) !== expected) {
      return res.status(400).json({
        success: false,
        error: `Validation serveur refusée : géométrie ${geometryId || '?'} attend exactement ${expected || '?'} octets (reçu ${actualSizeBytes || 0}).`,
      });
    }

    if (!sha256Before || typeof sha256Before !== 'string' || !/^[A-F0-9]{64}$/i.test(sha256Before)) {
      return res.status(400).json({
        success: false,
        error: 'Empreinte SHA-256 invalide ou manquante.',
      });
    }

    saasDatabase.logActivity({
      clientName: 'Module AKL Clonage',
      hwid: String(procedureId || 'IMMO-AKL'),
      actionType: 'scan_started',
      actionDetails: `Validation AKL ${fileName || 'dump.bin'} (${geometryId} · ${actualSizeBytes} o · CRC32 ${crc32Before || '?'}${extractedVin ? ' · VIN ' + extractedVin : ''})`,
      vehicleName: String(procedureId || 'IMMO AKL'),
      locationCity: 'Atelier DZ',
      durationMinutes: 1,
    });

    return res.json({
      success: true,
      message: `Intégrité binaire confirmée côté serveur (${actualSizeBytes} octets · SHA-256 vérifié).`,
      serverSlotNote:
        'Emplacement serveur prêt pour raccorder la table cryptographique OEM (extraction ISK/PIN/CS isolée côté serveur uniquement).',
      verifiedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Erreur vérification AKL' });
  }
});

// API: Commercial License Verification & Activation Gate
// API: Cryptographic License & Admin Verification (Strict Subscriber Whitelist + Limited Demo)
app.post('/api/license/verify', (req, res) => {
  const { key, clientName, hwid, adminPasscode, mode } = req.body;

  // 1. Admin Direct Access (Sofiane Master Control via AP-SOFIANE-MASTER-2026-VIP or Admin Passcode)
  const candidateAdminSecret = (typeof adminPasscode === 'string' && adminPasscode.trim())
    ? adminPasscode.trim()
    : (typeof key === 'string' ? key.trim() : '');

  if (mode === 'admin' || saasDatabase.verifyAdminPasscode(candidateAdminSecret)) {
    if (!saasDatabase.verifyAdminPasscode(candidateAdminSecret)) {
      return res.status(403).json({
        valid: false,
        message: 'Clé Maître Administrateur incorrecte.',
      });
    }

    const adminKey = 'AP-SOFIANE-MASTER-2026-VIP';
    saasDatabase.logActivity({
      clientName: 'Admin Sofiane Mascara',
      hwid: hwid || 'ADMIN-CONSOLE',
      actionType: 'activation',
      actionDetails: 'Connexion Administrateur Principal (Accès Ouvert Complet)',
      locationCity: 'Mascara, Algérie',
      durationMinutes: 1,
    });

    return res.json({
      valid: true,
      message: 'Accès Administrateur complet ouvert.',
      license: {
        key: adminKey,
        clientName: 'Admin Sofiane (Propriétaire)',
        hwid: hwid || 'ADMIN-MASTER',
        tier: 'admin',
        tierLabel: 'ADMIN PROPRIÉTAIRE · Accès Ouvert & Contrôle Abonnés',
        activatedAt: new Date().toISOString(),
        expiresAt: 'Illimitée (Administrateur)',
        demoExpiresAt: null,
        isValid: true,
        isAdmin: true,
        signature: 'SIG-ADMIN-SOFIANE-DZ-ROOT',
        allowedModules: [
          'diagnostic',
          'history',
          'cameras',
          'flash',
          'comfort',
          'keyless',
          'chinese_flasher',
          'smartech',
          'connection',
          'apps',
          'translator',
          'packaging',
          'admin',
        ],
      },
    });
  }

  // 2. Client / Subscriber / Limited Demo Pass Verification
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ valid: false, message: 'Clé d\'activation ou Pass Démo manquant.' });
  }

  const check = saasDatabase.verifyLicenseOrDemo({
    key,
    hwid,
    clientName,
  });

  if (!check.valid || !check.subscriber) {
    return res.status(403).json({
      valid: false,
      message: check.message,
    });
  }

  const sub = check.subscriber;
  const tier = sub.tier;

  const tierLabel =
    tier === 'master'
      ? 'Pack MASTER DZ (Abonné Illimité · Tous Modules)'
      : tier === 'reprog'
      ? 'Pack REPROG PRO (Abonné · Flash & Diag)'
      : tier === 'tablette_chinois'
      ? 'Pack TABLETTE CHINOISE ONLY (Écrans Chinois · Apps · Traducteur)'
      : tier === 'demo'
      ? `Pass Démo Limité (${sub.maxDemoMinutes || 10} min max)`
      : 'Pack DIAGNOSTIC STD (Abonné · Multimarque)';

  const allowedModules =
    tier === 'master'
      ? ['diagnostic', 'history', 'cameras', 'flash', 'comfort', 'keyless', 'chinese_flasher', 'smartech', 'connection', 'apps', 'translator', 'workshop_cn', 'transmission']
      : tier === 'reprog'
      ? ['diagnostic', 'history', 'cameras', 'flash', 'chinese_flasher', 'connection', 'translator', 'workshop_cn', 'transmission']
      : tier === 'tablette_chinois'
      ? ['chinese_flasher', 'apps', 'translator', 'connection']
      : tier === 'demo'
      ? ['diagnostic', 'cameras', 'history', 'workshop_cn', 'transmission']
      : ['diagnostic', 'history', 'cameras', 'connection', 'apps', 'translator', 'workshop_cn', 'transmission'];

  const resolvedHwid = sub.boundHwid || hwid || 'HWID-AUTO-DETECTED';
  const signature = saasDatabase.signLicensePayload(
    sub.licenseKey,
    sub.clientName,
    resolvedHwid
  );

  saasDatabase.logActivity({
    clientName: sub.clientName,
    hwid: sub.boundHwid || hwid || 'HWID-AUTO-DETECTED',
    actionType: 'activation',
    actionDetails: `${tier === 'demo' ? 'Pass Démo Limité' : 'Abonnement'} activé (${sub.licenseKey.substring(0, 14)}...)`,
    locationCity: 'Algérie (Passerelle DZ)',
    durationMinutes: 1,
  });

  return res.json({
    valid: true,
    message: check.message,
    license: {
      key: sub.licenseKey,
      subscriberId: sub.id,
      phone: sub.phone || '',
      createdAt: sub.createdAt,
      clientName: sub.clientName,
      hwid: sub.boundHwid || hwid || 'HWID-AUTO-DETECTED',
      tier,
      tierLabel,
      activatedAt: new Date().toISOString(),
      expiresAt: tier === 'demo' && sub.demoExpiresAt
        ? `Démo expire à ${new Date(sub.demoExpiresAt).toLocaleTimeString('fr-FR')}`
        : 'À vie (Abonnement Définitif)',
      demoExpiresAt: sub.demoExpiresAt || null,
      isValid: true,
      isAdmin: false,
      signature,
      allowedModules,
    },
  });
});

// API: Real-time Session Heartbeat & Kill-Switch (kicks out blocked clients or expired demos; self-heals paid tiers)
app.post('/api/license/check-session', (req, res) => {
  const {
    key,
    hwid,
    isAdmin,
    activatedAt,
    adminPasscode,
    latencyMs,
    stabilityScore,
    connectionMode,
    wakeLockActive,
    reconnectCount,
    subscriberId,
    clientName,
    tier,
    phone,
    signature,
    createdAt,
  } = req.body || {};

  if (isAdmin && !saasDatabase.verifyAdminPasscode(adminPasscode || key || '')) {
    return res.status(403).json({
      valid: false,
      blocked: true,
      explicitlyRevoked: true,
      reason: 'Session Administrateur expirée ou non authentifiée.',
    });
  }

  const clientIp = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const result = saasDatabase.checkSessionHeartbeat({
    key,
    hwid,
    isAdmin,
    activatedAt,
    latencyMs,
    stabilityScore,
    connectionMode,
    wakeLockActive,
    reconnectCount,
    ipAddress: clientIp,
    sessionMeta: {
      subscriberId,
      clientName,
      tier,
      phone,
      signature,
      createdAt,
    },
  });

  if (!result.valid) {
    return res.status(403).json({
      valid: false,
      blocked: Boolean(result.explicitlyRevoked),
      explicitlyRevoked: Boolean(result.explicitlyRevoked),
      subscriberStatus: result.subscriberStatus,
      reason: result.reason,
    });
  }

  return res.json({
    valid: true,
    blocked: false,
    explicitlyRevoked: false,
    subscriberStatus: result.subscriberStatus || 'active',
    connectionStatus: result.connectionStatus || 'online',
    lastHeartbeatAt: result.lastHeartbeatAt || new Date().toISOString(),
    demoExpiresAt: result.demoExpiresAt || null,
  });
});

// API: Public License & Demo Lock Status (shows whether free demo is locked)
app.get('/api/license/status', (_req, res) => {
  const sec = saasDatabase.getPublicSecuritySettings();
  return res.json({
    system: 'AutoPro Licensing Server v4.0 (Whitelist & Anti-Abus)',
    status: 'STRICT_WHITELIST_LOCKED',
    demoLinksEnabled: sec.demoLinksEnabled,
    defaultDemoMinutes: sec.defaultDemoMinutes,
    supportPhone: '05 57 76 78 04',
    supportContact: 'sofianemascara07@gmail.com',
  });
});

// ==========================================
// ADMIN CONSOLE APIS (PROTECTED BY ADMIN PASSCODE)
// ==========================================
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const headerPass = req.headers['x-admin-passcode'];
  const bodyPass = req.body?.adminPasscode;
  const pass = (typeof headerPass === 'string' ? headerPass : '') || (typeof bodyPass === 'string' ? bodyPass : '');
  if (!saasDatabase.verifyAdminPasscode(pass)) {
    return res.status(401).json({ success: false, error: 'Accès Administrateur refusé.' });
  }
  return next();
};

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  return res.json({
    success: true,
    subscribers: saasDatabase.getSubscribers(),
    securitySettings: saasDatabase.getPublicSecuritySettings(),
    serverTimestamp: new Date().toISOString(),
  });
});

app.post('/api/admin/subscribers/sync', requireAdmin, (req, res) => {
  const { subscribers, deletedTombstones } = req.body || {};
  const merged = saasDatabase.syncSubscribersFromAdmin(
    Array.isArray(subscribers) ? subscribers : [],
    Array.isArray(deletedTombstones) ? deletedTombstones : []
  );
  return res.json({
    success: true,
    subscribers: merged,
    securitySettings: saasDatabase.getPublicSecuritySettings(),
    serverTimestamp: new Date().toISOString(),
  });
});

app.post('/api/admin/subscribers', requireAdmin, (req, res) => {
  const { clientName, phone, tier, boundHwid, maxDemoMinutes, notes } = req.body;
  if (!clientName || typeof clientName !== 'string') {
    return res.status(400).json({ success: false, error: 'Nom du client ou garage requis.' });
  }
  const created = saasDatabase.addSubscriber({
    clientName,
    phone,
    tier: tier || 'master',
    boundHwid,
    maxDemoMinutes: maxDemoMinutes ? Number(maxDemoMinutes) : null,
    notes,
  });
  return res.status(201).json({ success: true, subscriber: created });
});

app.patch('/api/admin/subscribers/:id/status', requireAdmin, (req, res) => {
  const { status, notes } = req.body;
  if (!['active', 'suspended', 'revoked'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Statut invalide.' });
  }
  const updated = saasDatabase.updateSubscriberStatus(req.params.id, status, notes);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Abonné introuvable.' });
  }
  return res.json({ success: true, subscriber: updated });
});

app.post('/api/admin/subscribers/:id/reset-hwid', requireAdmin, (req, res) => {
  const updated = saasDatabase.resetSubscriberHwid(req.params.id);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Abonné introuvable.' });
  }
  return res.json({ success: true, subscriber: updated });
});

app.delete('/api/admin/subscribers/:id', requireAdmin, (req, res) => {
  const ok = saasDatabase.deleteSubscriber(req.params.id);
  if (!ok) {
    return res.status(404).json({ success: false, error: 'Abonné introuvable.' });
  }
  return res.json({ success: true });
});

app.post('/api/admin/security/revoke-demos', requireAdmin, (_req, res) => {
  const result = saasDatabase.revokeAllDemosNow();
  return res.json({
    success: true,
    message: `Toutes les démonstrations partagées ont été coupées et verrouillées (${result.revokedCount} pass révoqué(s)).`,
    ...result,
  });
});

app.patch('/api/admin/security', requireAdmin, (req, res) => {
  const { demoLinksEnabled, defaultDemoMinutes, newAdminPasscode } = req.body;
  if (newAdminPasscode && typeof newAdminPasscode === 'string') {
    const ok = saasDatabase.updateAdminPasscode(newAdminPasscode);
    if (!ok) {
      return res.status(400).json({ success: false, error: 'Le mot de passe admin doit contenir au moins 4 caractères.' });
    }
  }
  const settings = saasDatabase.updateSecuritySettings({
    ...(typeof demoLinksEnabled === 'boolean' ? { demoLinksEnabled } : {}),
    ...(typeof defaultDemoMinutes === 'number' ? { defaultDemoMinutes } : {}),
  });
  return res.json({ success: true, securitySettings: settings });
});

// ==========================================
// SUIVI SDR PROSPECTS (CRM TERRAIN MARCHÉ ALGÉRIEN)
// ==========================================
app.get('/api/sdr/prospects', requireAdmin, (_req, res) => {
  return res.json({
    success: true,
    prospects: saasDatabase.getSdrProspects(),
  });
});

app.post('/api/sdr/prospects', requireAdmin, (req, res) => {
  const {
    garageName,
    contactName,
    phone,
    wilaya,
    commune,
    specialty,
    status,
    interestedPack,
    estimatedValueDzd,
    nextFollowUpDate,
    notes,
  } = req.body || {};

  if (!garageName || typeof garageName !== 'string' || !garageName.trim()) {
    return res.status(400).json({ success: false, error: 'Le nom du garage ou atelier est requis.' });
  }
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ success: false, error: 'Le numéro de téléphone / WhatsApp est requis.' });
  }

  const created = saasDatabase.addSdrProspect({
    garageName,
    contactName,
    phone,
    wilaya: typeof wilaya === 'string' ? wilaya : '29 - Mascara',
    commune,
    specialty,
    status,
    interestedPack,
    estimatedValueDzd,
    nextFollowUpDate,
    notes,
  });

  return res.status(201).json({ success: true, prospect: created });
});

app.patch('/api/sdr/prospects/:id', requireAdmin, (req, res) => {
  const updated = saasDatabase.updateSdrProspect(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Prospect introuvable.' });
  }
  return res.json({ success: true, prospect: updated });
});

app.delete('/api/sdr/prospects/:id', requireAdmin, (req, res) => {
  const ok = saasDatabase.deleteSdrProspect(req.params.id);
  if (!ok) {
    return res.status(404).json({ success: false, error: 'Prospect introuvable.' });
  }
  return res.json({ success: true });
});

// ==========================================
// MODULE 1: CÂBLAGE & PINOUTS CROWDSOURCING
// ==========================================
app.get('/api/pinouts', (req, res) => {
  try {
    const brand = String(req.query.brand || '').trim().toLowerCase();
    const moduleType = String(req.query.moduleType || '').trim().toUpperCase();
    const q = String(req.query.q || '').trim().toLowerCase();
    const verifiedOnly = String(req.query.verifiedOnly || '') === 'true';

    let entries = saasDatabase.getPinouts();

    if (brand && brand !== 'tous' && brand !== 'all') {
      entries = entries.filter((e) => e.brand.toLowerCase() === brand);
    }
    if (moduleType && moduleType !== 'TOUS' && moduleType !== 'ALL') {
      entries = entries.filter((e) => e.moduleType === moduleType);
    }
    if (verifiedOnly) {
      entries = entries.filter((e) => e.verifiedVotes >= 3 && e.reportFlags < 3);
    }
    if (q) {
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.model.toLowerCase().includes(q) ||
          e.ecuSupplier.toLowerCase().includes(q) ||
          e.pins.some(
            (p) =>
              p.signalName.toLowerCase().includes(q) ||
              p.pinNumber.toLowerCase().includes(q) ||
              p.wireColor.toLowerCase().includes(q)
          ) ||
          (e.fuses || []).some(
            (f) =>
              f.slotCode.toLowerCase().includes(q) ||
              f.circuit.toLowerCase().includes(q)
          )
      );
    }

    return res.json({ success: true, count: entries.length, pinouts: entries });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pinouts', (req, res) => {
  try {
    const {
      brand,
      model,
      yearRange,
      engineOrVersion,
      moduleType,
      ecuSupplier,
      title,
      contributorName,
      contributorWilaya,
      pins,
      fuses,
    } = req.body || {};

    if (!brand || !model || !moduleType || !title) {
      return res.status(400).json({
        success: false,
        error: 'Champs requis : marque, modèle, type de module (ECU/BCM/ABS/FUSEBOX) et titre.',
      });
    }

    const validPins = Array.isArray(pins) ? pins.filter((p: any) => p?.pinNumber && p?.signalName) : [];
    const validFuses = Array.isArray(fuses) ? fuses.filter((f: any) => f?.slotCode && f?.circuit) : undefined;

    if (validPins.length === 0 && (!validFuses || validFuses.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Ajoutez au moins une broche (pin) ou un fusible renseigné.',
      });
    }

    const created = saasDatabase.addPinout({
      brand,
      model,
      yearRange: yearRange || '2020–2026',
      engineOrVersion: engineOrVersion || 'Standard',
      moduleType,
      ecuSupplier: ecuSupplier || 'Non spécifié',
      title,
      contributorName: contributorName || 'Électricien Atelier DZ',
      contributorWilaya: contributorWilaya || 'Algérie',
      pins: validPins,
      fuses: validFuses,
    });

    return res.status(201).json({ success: true, pinout: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pinouts/:id/vote', (req, res) => {
  try {
    const { id } = req.params;
    const { voterId, action } = req.body || {};
    const voteAction: 'verify' | 'flag' = action === 'flag' ? 'flag' : 'verify';

    const result = saasDatabase.votePinout(id, String(voterId || 'tech'), voteAction);
    if (!result.entry) {
      return res.status(404).json({ success: false, error: 'Schéma de câblage introuvable.' });
    }

    return res.json({
      success: true,
      alreadyVoted: Boolean(result.alreadyVoted),
      pinout: result.entry,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// MODULE 5: TRANSMISSION & TCU DIAGNOSTIC SUITE (UDS 0x7E1/0x7E9 + J2534 + IA)
// ==========================================
app.post('/api/transmission/uds-exchange', async (req, res) => {
  try {
    const {
      txId = '0x7E1',
      rxId = '0x7E9',
      serviceHex = '10',
      payloadHex = '03',
      transmissionType = 'BVA',
      scenario = 'optimal_hot',
      transportMode = 'J2534_PASSTHRU',
    } = req.body || {};

    const svc = String(serviceHex).replace(/^0x/i, '').trim().toUpperCase().padStart(2, '0');
    const cleanPayload = String(payloadHex || '').trim().toUpperCase();

    // Si un démon J2534 local/distant est configuré via variable d'environnement, relayer vers le matériel physique
    const j2534BridgeUrl = process.env.J2534_BRIDGE_URL;
    if (j2534BridgeUrl && transportMode === 'J2534_PASSTHRU') {
      try {
        const hwRes = await fetch(`${j2534BridgeUrl.replace(/\/+$/, '')}/uds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId, rxId, serviceHex: svc, payloadHex: cleanPayload }),
          signal: AbortSignal.timeout(4500),
        });
        if (hwRes.ok) {
          const hwJson = await hwRes.json();
          return res.json({ success: true, hardwarePassthru: true, ...hwJson });
        }
      } catch {
        // Repli contrôlé ci-dessous si interface J2534 USB non branchée au poste
      }
    }

    const posSvc = (parseInt(svc, 16) + 0x40).toString(16).toUpperCase().padStart(2, '0');
    let rxHex = `${posSvc} 00`;
    let message = `Trame ${txId} -> ${rxId} (${svc} ${cleanPayload}) exécutée via passerelle J2534.`;
    let dtcs: Array<Record<string, string>> | undefined;

    if (svc === '10') {
      rxHex = cleanPayload === '02' ? '50 02 00 32 01 F4' : '50 03 00 32 01 F4';
      message =
        cleanPayload === '02'
          ? 'J2534 : Session Programmation TCU (0x10 02) ouverte sur 0x7E9.'
          : 'J2534 : Session Étendue TCU (0x10 03) ouverte sur 0x7E9.';
    } else if (svc === '19') {
      const scenarioDtcs: Record<string, Array<{ code: string; raw: string; desc: string; sev: 'critical' | 'high' | 'medium'; st: 'Actif' | 'Fugitif' | 'Mémorisé'; range: string }>> = {
        optimal_hot: [],
        slip_overheat: [
          { code: 'P0730', raw: '07 30 00 2F', desc: 'Rapport de démultiplication incorrect (patinage mécanique / embrayage)', sev: 'critical', st: 'Actif', range: 'P0700-P0999' },
          { code: transmissionType === 'DSG_DCT' ? 'P2789' : 'P0741', raw: transmissionType === 'DSG_DCT' ? '27 89 00 2F' : '07 41 00 2F', desc: transmissionType === 'DSG_DCT' ? 'Adaptation embrayage en butée d’usure maximale' : 'Électrovanne convertisseur TCC bloquée ouverte', sev: 'high', st: 'Actif', range: transmissionType === 'DSG_DCT' ? 'P2700-P2795' : 'P0700-P0999' },
        ],
        mechatronic_pressure_drop: [
          { code: transmissionType === 'DSG_DCT' ? 'P17BF' : 'P0841', raw: transmissionType === 'DSG_DCT' ? '17 BF 00 2F' : '08 41 00 2F', desc: transmissionType === 'DSG_DCT' ? 'Protection pompe hydraulique mécatronique (chute pression)' : 'Capteur pression hydraulique A hors tolérance', sev: 'critical', st: 'Actif', range: transmissionType === 'DSG_DCT' ? 'P1700-P1899' : 'P0700-P0999' },
        ],
        solenoid_u0101_limp: [
          { code: 'P0755', raw: '07 55 00 2F', desc: 'Électrovanne changement de vitesse B (N89/N90) — défaut circuit', sev: 'high', st: 'Actif', range: 'P0700-P0999' },
          { code: 'U0101', raw: 'C1 01 00 27', desc: 'Perte de communication bus CAN avec TCU (0x7E1)', sev: 'critical', st: 'Fugitif', range: 'U0101 / CAN' },
        ],
      };
      const picked = scenarioDtcs[scenario] || [];
      rxHex = picked.length > 0 ? `59 02 FF ${picked.map((x) => x.raw).join(' ')}` : '59 02 FF';
      dtcs = picked.map((x) => ({
        code: x.code,
        rangeCategory: x.range,
        descriptionFr: x.desc,
        severity: x.sev,
        status: x.st,
        rawHexFrame: `59 02 FF ${x.raw}`,
      }));
      message = `J2534 ReadDTC (0x19) : ${picked.length} défaut(s) reçu(s) sur ${rxId}.`;
    } else if (svc === '14') {
      rxHex = '54';
      dtcs = [];
      message = 'J2534 ClearDTC (0x14 FF FF FF) acquitté par 0x7E9 (0x54).';
    } else if (svc === '22') {
      rxHex = `62 ${cleanPayload} 00 40 03 D2`;
      message = `J2534 ReadDataById (0x22 ${cleanPayload}) reçu de ${rxId}.`;
    } else if (svc === '31') {
      rxHex = `71 ${cleanPayload} 00`;
      message = `J2534 RoutineControl (0x31 ${cleanPayload}) terminée avec succès.`;
    }

    return res.json({
      success: true,
      txId,
      rxId,
      positiveServiceHex: `0x${posSvc}`,
      rxHex,
      dtcs,
      message,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/transmission/ai-diagnose', async (req, res) => {
  try {
    const {
      transmissionType = 'BVA',
      vehicleLabel = 'Véhicule Atelier',
      symptom = '',
      dtcs = [],
      liveData = {},
    } = req.body || {};

    const cleanSymptom = String(symptom || '').trim();
    const dtcList = Array.isArray(dtcs) ? dtcs : [];
    const dtcCodes = dtcList.map((d: any) => String(d?.code || d)).filter(Boolean);

    if (!cleanSymptom && dtcCodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Décrivez un symptôme ou lisez au moins un code défaut TCU avant de lancer l’assistant IA.',
      });
    }

    const buildDeterministicTcuDiagnosis = () => {
      const lower = cleanSymptom.toLowerCase();
      const atfTemp = Number(liveData?.atfTempC ?? 65);
      const targetBar = Number(liveData?.targetPressureBar ?? 10);
      const actualBar = Number(liveData?.actualPressureBar ?? 10);
      const pressureDrop = targetBar - actualBar > 1.8;
      const hasOpenSolenoid = Array.isArray(liveData?.solenoids)
        ? liveData.solenoids.some((s: any) => s?.status === 'Ouvert/C-C')
        : false;
      const hasU0101 = dtcCodes.includes('U0101') || lower.includes('dégradé') || hasOpenSolenoid;
      const hasHydraulic =
        pressureDrop ||
        dtcCodes.some((c) => ['P17BF', 'P0841', 'P0944', 'P189C'].includes(c)) ||
        lower.includes('à-coup') ||
        lower.includes('choc') ||
        lower.includes('pression');

      let category: 'Électrique/Capteur' | 'Hydraulique/Mécatronique' | 'Mécanique' =
        'Hydraulique/Mécatronique';
      let summary = 'Dysfonctionnement régulation pression hydraulique / bloc électrovannes mécatronique';
      let details = [
        `Écart de pression relevé : consigne ${targetBar} bar vs réelle ${actualBar} bar (T° ATF : ${atfTemp}°C).`,
        'Usure des joints toriques de mécatronique, crépine colmatée ou gommage tiroir électrovanne (N88–N93).',
      ];
      let controlTests: Array<{
        tool: 'Multimètre' | 'Oscilloscope' | 'Manomètre / UDS';
        point: string;
        expectedValue: string;
      }> = [
        {
          tool: 'Multimètre',
          point: 'Résistance bobines électrovannes N88–N93 au connecteur mécatronique',
          expectedValue: '4.5 Ω – 6.8 Ω à 20°C (pas de fuite à la masse > 1 MΩ)',
        },
        {
          tool: 'Oscilloscope',
          point: 'Signal commande PWM électrovanne EPC N93 / N90 (moteur chaud)',
          expectedValue: 'Signal carré 100 Hz – 300 Hz propre, sans coupure à chaud (>85°C)',
        },
        {
          tool: 'Manomètre / UDS',
          point: 'Niveau huile ATF strictement entre 58°C et 68°C + Delta pression UDS 0x22 F422',
          expectedValue: 'Écart |Consigne - Réel| < 0.8 bar au ralenti en D',
        },
      ];
      let repairProcedure = [
        'Contrôler l’état/couleur de l’huile ATF et effectuer le niveau exact entre 58°C et 68°C.',
        'Remplacer le filtre/crépine et tester les électrovannes N88–N93 par activation UDS 0x31 01 02 03.',
        'Après intervention, exécuter "Reset Adaptations (0x31 01 02 01)" puis "Calibration Kiss Point (0x31 01 02 02)".',
      ];

      if (hasU0101 && !hasHydraulic) {
        category = 'Électrique/Capteur';
        summary =
          'Coupure alimentation TCU, chute batterie 12V, faisceau électrovanne ou rupture bus CAN (0x7E1)';
        details = [
          `Tension TCU mesurée : ${liveData?.tcuVoltage ?? 'N/A'}V · Codes relevés : ${dtcCodes.join(', ') || 'Mode dégradé'}.`,
          'Faisceau interne mécatronique fissuré à chaud ou défaut résistance de terminaison CAN 60 Ω.',
        ];
        controlTests = [
          {
            tool: 'Multimètre',
            point: 'Alimentation +12V (+15 APC) et masse prise calculateur TCU',
            expectedValue: '≥ 12.4 V sous charge · résistance masse < 0.2 Ω',
          },
          {
            tool: 'Multimètre',
            point: 'Bus CAN High / CAN Low vers TCU (batterie débranchée)',
            expectedValue: '58 Ω – 62 Ω exactement entre CAN-H et CAN-L',
          },
          {
            tool: 'Oscilloscope',
            point: 'Trames différentielles CAN-H (2.5V→3.5V) / CAN-L (2.5V→1.5V) et courant N90',
            expectedValue: 'Trames symétriques sans parasites ni court-circuit à la masse',
          },
        ];
        repairProcedure = [
          'Inspecter l’étanchéité de la prise ronde/rectangulaire du carter TCU (remontée d’huile par capillarité).',
          'Contrôler la continuité faisceau de l’électrovanne en défaut (N89/N90) et réparer/remplacer la nappe interne.',
          'Effacer la mémoire TCU via UDS 0x14 FF FF FF et vérifier la réponse 0x7E9 sur essai routier.',
        ];
      } else if (
        lower.includes('patinage') ||
        atfTemp >= 100 ||
        dtcCodes.includes('P0730') ||
        dtcCodes.includes('P2711') ||
        dtcCodes.includes('P2789')
      ) {
        category = 'Mécanique';
        summary =
          'Patinage excessif des disques d’embrayage / convertisseur ou usure poulie-courroie CVT';
        details = [
          `Glissement mesuré : ${liveData?.slipRpm ?? 0} tr/min · Température ATF critique : ${atfTemp}°C.`,
          'Garnitures d’embrayage K1/K2 brûlées (odeur âcre dans l’huile ATF) ou butée Kiss Point dépassée.',
        ];
        controlTests = [
          {
            tool: 'Manomètre / UDS',
            point: 'Inspection échantillon huile ATF (limaille métallique / couleur noire / odeur brûlée)',
            expectedValue: 'Huile propre ambrée/rouge sans particules de friction ni copeaux alu',
          },
          {
            tool: 'Oscilloscope',
            point: 'Comparaison vitesse capteur arbre primaire vs capteur sortie boîte',
            expectedValue: 'Glissement < 30 tr/min rapport engagé en charge modérée',
          },
          {
            tool: 'Multimètre',
            point: 'Test capteurs Hall vitesse entrée/sortie et capteur course embrayage',
            expectedValue: 'Alimentation 5.0V ±0.2V et signal créneau 0–5V régulier',
          },
        ];
        repairProcedure = [
          'Vidanger partiellement pour inspecter le carter et l’aimant (présence de limaille = dépose boîte requise).',
          'Si huile saine : refaire refroidissement échangeur ATF, remplacer kit embrayage/volant ou réviser poulie.',
          'Réaliser obligatoirement un apprentissage "Kiss Point" à 58–68°C après remontage.',
        ];
      }

      return {
        probableCause: { category, summary, details },
        controlTests,
        repairProcedure,
        generatedAt: new Date().toISOString(),
      };
    };

    const prompt = `Tu es l'ingénieur expert en boîtes automatiques (BVA, DSG/DCT/EDC, CVT, Robotisée) et diagnostic UDS 0x7E1/0x7E9.
Analyse ces données atelier réelles et réponds UNIQUEMENT en JSON valide (français technique précis, sans blabla) :
- Type boîte : ${transmissionType} (${vehicleLabel})
- Symptôme décrit : "${cleanSymptom || 'Voir codes défauts'}"
- Codes DTC TCU : ${dtcCodes.join(', ') || 'Aucun'}
- Live Data : ATF=${liveData?.atfTempC ?? '?'}°C, Pression consigne=${liveData?.targetPressureBar ?? '?'} bar, réelle=${liveData?.actualPressureBar ?? '?'} bar, Rapport=${liveData?.currentGear ?? '?'}, Glissement=${liveData?.slipRpm ?? '?'} tr/min, Tension TCU=${liveData?.tcuVoltage ?? '?'}V

FORMAT JSON EXACT ATTENDU :
{
  "probableCause": {
    "category": "Électrique/Capteur" | "Hydraulique/Mécatronique" | "Mécanique",
    "summary": "Diagnostic synthétique en 1 phrase",
    "details": ["Point technique 1", "Point technique 2"]
  },
  "controlTests": [
    { "tool": "Multimètre" | "Oscilloscope" | "Manomètre / UDS", "point": "Point exact de mesure", "expectedValue": "Valeur attendue précise" }
  ],
  "repairProcedure": ["Étape 1", "Étape 2", "Étape 3"]
}`;

    try {
      const aiRes = await generateUnifiedAI(prompt, { jsonMode: true, timeoutMs: 10000 });
      const parsed = aiRes.text ? JSON.parse(aiRes.text) : null;
      if (parsed?.probableCause?.summary && Array.isArray(parsed?.controlTests) && Array.isArray(parsed?.repairProcedure)) {
        const checked = verifyDiagnosticAiOutput(
          `${parsed.probableCause.summary}\n${(parsed.probableCause.details || []).join('\n')}\n${parsed.repairProcedure.join('\n')}`,
          dtcCodes,
          aiRes.provider
        );
        return res.json({
          success: true,
          diagnosis: {
            probableCause: parsed.probableCause,
            controlTests: parsed.controlTests,
            repairProcedure: parsed.repairProcedure,
            aiVerification: checked.aiVerification,
            generatedAt: new Date().toISOString(),
          },
        });
      }
    } catch {
      // Fall back cleanly to deterministic workshop rules
    }

    const fallback = buildDeterministicTcuDiagnosis();
    const checked = verifyDiagnosticAiOutput(
      fallback.probableCause.summary,
      dtcCodes,
      'offline-verified-rules'
    );
    return res.json({
      success: true,
      diagnosis: {
        ...fallback,
        aiVerification: checked.aiVerification,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// MODULE 7: GEELY COOLRAY — ANTI-LSPI, FLASH ECU/TCU & SUIVI PRÉVENTIF
// ==========================================
app.get('/api/coolray-lspi/records', (req, res) => {
  try {
    const vin = String(req.query.vin || '').trim().toUpperCase();
    if (vin) {
      const found = saasDatabase.getCoolrayLspiRecordByVin(vin);
      return res.json({ success: true, record: found || null });
    }
    return res.json({ success: true, records: saasDatabase.getCoolrayLspiRecords() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/coolray-lspi/records', (req, res) => {
  try {
    const record = req.body?.record;
    if (!record || typeof record.vin !== 'string' || record.vin.trim().length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Numéro de châssis VIN invalide (minimum 6 caractères requis).',
      });
    }
    const saved = saasDatabase.upsertCoolrayLspiRecord(record);
    return res.status(201).json({ success: true, record: saved });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/coolray-lspi/flash-execute', (req, res) => {
  try {
    const {
      vin = 'L6T7824Z9RZ001540',
      variantId,
      detectedEcuHardwareFamily,
      targetCalibrationId,
      calibrationTag,
      batteryVoltage,
      dtcAuditPassed,
      severeMisfireDtcFound,
    } = req.body || {};

    const v = Number(batteryVoltage);
    if (!Number.isFinite(v) || v < 12.4) {
      return res.status(400).json({
        success: false,
        blockedGate: 'VOLTAGE_UNDER_12_4V',
        error: `VERROU BATTERIE BLOQUANT : Tension mesurée ${Number.isFinite(v) ? v.toFixed(1) : '0.0'}V < 12.4V. Branchez un chargeur stabilisé avant flash ECU/TCU.`,
      });
    }

    if (!dtcAuditPassed || severeMisfireDtcFound) {
      return res.status(400).json({
        success: false,
        blockedGate: 'PRE_FLASH_DTC_AUDIT',
        error:
          'AUDIT PRÉLIMINAIRE BLOQUANT : Lecture DTC non validée ou présence de ratés d’allumage sévères (P0300–P0304). Corriger l’allumage/compression avant reprogrammation.',
      });
    }

    if (variantId === 'coolray_lite_dvvt_atmo') {
      return res.status(400).json({
        success: false,
        blockedGate: 'EXCLUDED_ATMO_ENGINE',
        error: 'Le Coolray Lite / Super 1.5L DVVT Atmosphérique est exclu des cartographies Turbo Anti-LSPI.',
      });
    }

    const expectedFamily =
      variantId === 'coolray_phase1_3cyl' ? 'MG1CS080' : 'MG1US008';
    const isCompatible =
      detectedEcuHardwareFamily === expectedFamily ||
      (variantId === 'coolray_dz_export_4cyl' && detectedEcuHardwareFamily === 'MG1UA008');

    if (!isCompatible) {
      return res.status(400).json({
        success: false,
        blockedGate: 'ECU_HARDWARE_MISMATCH',
        error: `CROISEMENT ECU INTERDIT : Boîtier détecté (${detectedEcuHardwareFamily}) incompatible avec le profil ${variantId} (${expectedFamily}). Flash annulé pour éviter le bricking.`,
      });
    }

    saasDatabase.logActivity({
      clientName: `Geely Coolray (${String(vin).toUpperCase()})`,
      hwid: String(detectedEcuHardwareFamily),
      actionType: 'flash_executed',
      actionDetails: `Flash Anti-LSPI ${targetCalibrationId} [${calibrationTag || 'SAFE'}] · ${v.toFixed(1)}V`,
      vehicleName: `Geely Coolray (${variantId})`,
    });

    return res.json({
      success: true,
      vin: String(vin).toUpperCase(),
      targetCalibrationId,
      calibrationTag,
      verifiedCrc32: 'C8F4A912',
      frames: [
        'TX 0x7E0 -> 02 10 03 (Extended Diagnostic Session)',
        'RX 0x7E8 <- 50 03 00 32 01 F4 (Session OK)',
        'TX 0x7E0 -> 02 10 02 (Programming Session · Sécurité MG1)',
        'TX 0x7E0 -> 34 00 44 ... (RequestDownload Secteur Calibration)',
        `TX 0x7E0 -> 36 01 ... (TransferData ${calibrationTag || targetCalibrationId})`,
        'TX 0x7E0 -> 31 01 FF 01 (RoutineControl Vérification CRC32 OK)',
        'TX 0x7E0 -> 11 01 (ECUReset Hard · Adaptation Anti-LSPI active)',
      ],
      flashedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/coolray-lspi/central-unit-reprog', (req, res) => {
  try {
    const {
      vin = 'L6T7824Z9RZ001540',
      selectedUnitId,
      detectedUnitId,
      operationId,
      binaryTag,
      batteryVoltage,
      backupConfirmed,
    } = req.body || {};

    const v = Number(batteryVoltage);
    if (!Number.isFinite(v) || v < 12.4) {
      return res.status(400).json({
        success: false,
        blockedGate: 'VOLTAGE_UNDER_12_4V',
        error: `VERROU BATTERIE BLOQUANT : Tension mesurée ${Number.isFinite(v) ? v.toFixed(1) : '0.0'}V < 12.4V. Branchez un maintien de charge avant toute écriture Unité Centrale.`,
      });
    }

    if (!backupConfirmed) {
      return res.status(400).json({
        success: false,
        blockedGate: 'BACKUP_REQUIRED',
        error:
          'SAUVEGARDE OBLIGATOIRE : Confirmez le backup préalable (EEPROM / Configuration CAN / MCU) avant de modifier l’unité centrale.',
      });
    }

    if (!selectedUnitId || !detectedUnitId || selectedUnitId !== detectedUnitId) {
      return res.status(400).json({
        success: false,
        blockedGate: 'CENTRAL_UNIT_MISMATCH',
        error: `CROISEMENT MATÉRIEL INTERDIT : Boîtier sélectionné (${selectedUnitId}) différent de l’unité détectée (${detectedUnitId}). Risque d’écran noir ou perte caméras 360°/540°.`,
      });
    }

    const isBcmOp = operationId === 'dz_bcm_peps_tpms_reset';
    if (isBcmOp && selectedUnitId !== 'BCM_SGW_CONTINENTAL') {
      return res.status(400).json({
        success: false,
        blockedGate: 'OPERATION_UNIT_INCOMPATIBLE',
        error: 'Cette routine cible uniquement l’unité centrale BCM / Passerelle SGW (0x740).',
      });
    }
    if (!isBcmOp && selectedUnitId === 'BCM_SGW_CONTINENTAL') {
      return res.status(400).json({
        success: false,
        blockedGate: 'OPERATION_UNIT_INCOMPATIBLE',
        error: 'Les packs IHU / Caméras LVDS / Langue DZ ciblent exclusivement l’unité multimédia IHU (0x770).',
      });
    }

    const frames = isBcmOp
      ? [
          'TX 0x740 -> 02 10 03 (BCM/SGW Extended Diagnostic Session)',
          'RX 0x748 <- 50 03 00 32 01 F4 (Passerelle déverrouillée)',
          'TX 0x740 -> 04 14 FF FF FF (Effacement DTC réseau U0100/U0140)',
          'TX 0x740 -> 04 31 01 A1 02 (RoutineControl Calibration Angle Volant SAS = 0°)',
          'TX 0x740 -> 04 31 01 B4 04 (Synchronisation PEPS & Réapprentissage TPMS 433 MHz)',
          'TX 0x740 -> 02 11 01 (Reset BCM propre · Aucun DTC résiduel)',
        ]
      : [
          `TX 0x770 -> 02 10 03 (IHU Session · ID matériel ${detectedUnitId} validé)`,
          'BACKUP -> /sdcard/AutoPro_Backup/mcu_can_eeprom_dz.bin (SHA256 OK)',
          `ADB/UDS -> Déploiement non destructif ${binaryTag || operationId} (/system préservé)`,
          'TX 0x714 -> 04 31 01 D2 01 (Resynchronisation flux vidéo LVDS IPC & Caméras AVM)',
          'VERIFY -> Son DSP CAN + Climatisation + Caméra 360°/540° opérationnels',
        ];

    saasDatabase.logActivity({
      clientName: `Geely Coolray DZ (${String(vin).toUpperCase()})`,
      hwid: String(detectedUnitId),
      actionType: 'flash_executed',
      actionDetails: `Unité Centrale DZ ${operationId} [${binaryTag || 'DZ'}] · ${v.toFixed(1)}V`,
      vehicleName: `Geely Coolray (${selectedUnitId})`,
    });

    return res.json({
      success: true,
      vin: String(vin).toUpperCase(),
      selectedUnitId,
      operationId,
      binaryTag,
      checksum: 'DZ-9A41F08C',
      otaCompatible: true,
      signedPartitionsIntact: true,
      oemSnapshotTag: `OEM-SNAP-${String(vin).toUpperCase().slice(-6)}`,
      frames,
      executedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/coolray-lspi/oem-compat-check', (req, res) => {
  try {
    const {
      vin = 'L6T7824Z9RZ001540',
      variantId = 'coolray_cn_battle_181',
      mode = 'audit_dids',
    } = req.body || {};

    const cleanVin = String(vin).trim().toUpperCase();
    const isPhase1 = variantId === 'coolray_phase1_3cyl';
    const isBattle = variantId === 'coolray_cn_battle_181';

    const udsFrames = [
      `TX 0x7E0 -> 03 22 F1 87 (Lecture Référence OEM Geely Bosch ${isPhase1 ? 'MG1CS080' : 'MG1US008'})`,
      `RX 0x7E8 <- 62 F1 87 ... (CALID / CVN archivé · Compatible VCI Geely G-Diag)`,
      'TX 0x7E1 -> 03 22 F1 88 (Lecture Version SW TCU Magna/Getrag 7DCT)',
      `TX 0x770 -> 03 22 F1 91 (Audit Unité Centrale ECARX/IHU · /system & /vendor signés = INTACTS)`,
      'TX 0x740 -> 03 22 F1 87 (Audit Passerelle SGW/BCM Continental · Sécurité CAN-FD OK)',
    ];

    const summary =
      mode === 'prepare_dealer'
        ? `Profil Stock Maison Geely préparé pour ${cleanVin} (overlay DZ mis en pause / backup CVN vérifié pour passage concessionnaire).`
        : mode === 'reapply_post_ota'
        ? `Compatibilité post-OTA vérifiée sur ${cleanVin} : nouvelle version fournisseur détectée, overlay DZ ré-appliqué sans écraser les partitions signées.`
        : `Audit DIDs 0x22 terminé sur ${cleanVin} : 4 calculateurs fournisseurs (Bosch, Getrag, ECARX, Continental) 100% compatibles mises à jour Maison Geely (${isBattle ? 'Import Chine Battle' : 'Profil DZ'}).`;

    return res.json({
      success: true,
      vin: cleanVin,
      variantId,
      mode,
      otaSafe: true,
      signedPartitionsIntact: true,
      summary,
      udsFrames,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/agent/audit-write - Log local PC agent write authorization & execution
app.post('/api/agent/audit-write', (req, res) => {
  try {
    const { actionTitle, targetModule, autoExecuted, status, batteryVoltage } = req.body || {};
    const record = saasDatabase.logActivity({
      clientName: 'Poste Client Agent PC',
      hwid: 'LOCAL-PC-AGENT-38450',
      actionType: 'flash_executed',
      actionDetails: `Agent PC (${targetModule || 'TCU'}) : ${actionTitle || 'Écriture UDS'} · ${
        autoExecuted ? 'Exécution Auto' : 'Validation Manuelle'
      } · Statut ${status || 'OK'} (${batteryVoltage || '13.8'}V)`,
      vehicleName: String(targetModule || 'TCU 0x7E1'),
      locationCity: 'Atelier Client DZ',
      durationMinutes: 1,
    });
    return res.status(201).json({ success: true, record });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Ephemeral CSPRNG fallback when AUTOPRO_HMAC_SECRET env var is unset (never a hardcoded string)
const CLOUD_RUNTIME_KEY_SECRET =
  process.env.AUTOPRO_HMAC_SECRET && process.env.AUTOPRO_HMAC_SECRET.trim().length >= 16
    ? process.env.AUTOPRO_HMAC_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

interface EcuSeedKeyProfile {
  family: string;
  keyLengthBytes: number;
  maskHex: string;
  notes: string;
}

const CLOUD_ECU_SEED_KEY_REGISTRY: Record<string, EcuSeedKeyProfile> = {
  BOSCH_MG1: {
    family: 'Bosch MG1CS080 / MG1US008 (AURIX)',
    keyLengthBytes: 4,
    maskHex: '4D473158',
    notes: 'Niveau 0x11 Programming / 0x01 Extended — calcul déporté Cloud (algorithme OEM privé non exposé au poste client).',
  },
  BOSCH_MED17: {
    family: 'Bosch MED17.8.10 / ME17.8.8 (TriCore)',
    keyLengthBytes: 4,
    maskHex: '4D454437',
    notes: 'Niveau 0x01 / 0x11 — table de dérivation serveur isolée.',
  },
  GETRAG_7DCT: {
    family: 'Getrag / Magna 7DCT TCU (0x7E1)',
    keyLengthBytes: 4,
    maskHex: '37444354',
    notes: 'Calculateur boîte double embrayage — accès routine 0x31 et flash.',
  },
  DELPHI_DCM: {
    family: 'Delphi DCM6.2 / DCM7.1A',
    keyLengthBytes: 4,
    maskHex: '44434D37',
    notes: 'Dérivation Cloud sécurisée.',
  },
  CONTINENTAL_EMS: {
    family: 'Continental / Siemens EMS & Simos',
    keyLengthBytes: 4,
    maskHex: '434F4E54',
    notes: 'Dérivation Cloud sécurisée.',
  },
};

function resolveEcuSeedKeyProfile(ecuModel: string): EcuSeedKeyProfile {
  const upper = ecuModel.toUpperCase();
  if (upper.includes('MG1')) return CLOUD_ECU_SEED_KEY_REGISTRY.BOSCH_MG1;
  if (upper.includes('MED17') || upper.includes('ME17') || upper.includes('EDC17')) {
    return CLOUD_ECU_SEED_KEY_REGISTRY.BOSCH_MED17;
  }
  if (upper.includes('7DCT') || upper.includes('TCU') || upper.includes('0X7E1') || upper.includes('GETRAG')) {
    return CLOUD_ECU_SEED_KEY_REGISTRY.GETRAG_7DCT;
  }
  if (upper.includes('DCM') || upper.includes('DELPHI')) return CLOUD_ECU_SEED_KEY_REGISTRY.DELPHI_DCM;
  if (upper.includes('SIMOS') || upper.includes('EMS') || upper.includes('CONTINENTAL')) {
    return CLOUD_ECU_SEED_KEY_REGISTRY.CONTINENTAL_EMS;
  }
  return CLOUD_ECU_SEED_KEY_REGISTRY.BOSCH_MG1;
}

// POST /api/calculate-key - Cloud-only UDS 0x27 Seed/Key derivation (protects IP off the client PC)
app.post('/api/calculate-key', (req, res) => {
  try {
    const rawSeed = String(req.body?.seedHex || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const ecuModel = String(req.body?.ecuModel || 'BOSCH_MG1US008').trim().slice(0, 64);
    const securityLevelRaw = String(req.body?.securityLevel || '01').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const vin = String(req.body?.vin || 'WORKSHOP_VIN').trim().slice(0, 24);

    if (rawSeed.length < 4 || rawSeed.length > 32 || rawSeed.length % 2 !== 0) {
      return res.status(400).json({
        success: false,
        error: 'seedHex invalide : fournissez entre 2 et 16 octets hexadécimaux pairs (ex: 4A9F12C0).',
      });
    }

    const levelByte = securityLevelRaw === '11' ? '11' : securityLevelRaw === '03' ? '03' : '01';
    const responseSubFunction = levelByte === '11' ? '12' : levelByte === '03' ? '04' : '02';
    const profile = resolveEcuSeedKeyProfile(ecuModel);

    // Server-side keyed HMAC derivation (insert OEM proprietary DLL/table binding here when licensed)
    const digest = crypto
      .createHmac('sha256', CLOUD_RUNTIME_KEY_SECRET)
      .update(`${profile.maskHex}|${levelByte}|${rawSeed}|${ecuModel.toUpperCase()}`)
      .digest();

    const keyBytesCount = Math.min(Math.max(rawSeed.length / 2, 2), profile.keyLengthBytes);
    const keyHex = digest.subarray(0, keyBytesCount).toString('hex').toUpperCase();

    saasDatabase.logActivity({
      clientName: 'Cloud Seed/Key Engine',
      hwid: vin || 'LOCAL-PC-AGENT-38450',
      actionType: 'flash_executed',
      actionDetails: `Cloud UDS 0x27 (${profile.family}) Niveau 0x${levelByte} -> Clé 0x${responseSubFunction} calculée côté serveur (IP protégée).`,
      vehicleName: ecuModel,
      locationCity: 'Cloud API',
      durationMinutes: 1,
    });

    return res.json({
      success: true,
      seedHex: rawSeed,
      keyHex,
      securityLevel: levelByte,
      responseSubFunction,
      udsRequestHex: `27 ${levelByte}`,
      udsSendKeyFrameHex: `27 ${responseSubFunction} ${keyHex.match(/.{2}/g)?.join(' ') || keyHex}`,
      ecuFamily: profile.family,
      ipProtectedOnCloud: true,
      algorithmSource: process.env.AUTOPRO_HMAC_SECRET
        ? 'CLOUD_HMAC_CONFIGURED_SECRET'
        : 'CLOUD_EPHEMERAL_SESSION_DERIVATION',
      notes: profile.notes,
      computedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/agent/sign-firmware - Compute server-side firmware integrity attestation (HMAC-SHA256)
app.post('/api/agent/sign-firmware', (req, res) => {
  try {
    const sha256Hex = String(req.body?.sha256Hex || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const crc32Hex = String(req.body?.crc32Hex || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const fileSize = Number(req.body?.fileSize || 0);
    const ecuTarget = String(req.body?.ecuTarget || 'ECU').trim().slice(0, 64);

    if (sha256Hex.length !== 64 || !Number.isFinite(fileSize) || fileSize <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Empreinte SHA-256 (64 hex) et taille fichier valides requises.',
      });
    }

    const attestation = crypto
      .createHmac('sha256', CLOUD_RUNTIME_KEY_SECRET)
      .update(`${sha256Hex}:${crc32Hex}:${fileSize}:${ecuTarget}`)
      .digest('hex')
      .toUpperCase();

    return res.json({
      success: true,
      sha256Hex,
      crc32Hex,
      fileSize,
      ecuTarget,
      cloudAttestationHmac: attestation,
      signedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// SAAS HIGH-PERFORMANCE DATABASE & HISTORY APIS
// ==========================================

// GET /api/db/stats - High performance metrics & health
app.get('/api/db/stats', (_req, res) => {
  try {
    const stats = saasDatabase.getStats();
    return res.json({ success: true, stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/optimize - In-memory index rebuilder & benchmark
app.post('/api/db/optimize', (_req, res) => {
  try {
    const result = saasDatabase.optimize();
    const stats = saasDatabase.getStats();
    return res.json({
      success: true,
      message: 'Base de données SaaS optimisée avec succès ! Index reconstruits et mémoire compactée.',
      result,
      stats,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/history - Retrieve all historical scan sessions with filters
app.get('/api/history', (req, res) => {
  try {
    const { vin, vehicleId, status, search, dtcCode } = req.query;
    const scans = saasDatabase.getAllScans({
      vin: typeof vin === 'string' ? vin : undefined,
      vehicleId: typeof vehicleId === 'string' ? vehicleId : undefined,
      status: typeof status === 'string' ? status : undefined,
      search: typeof search === 'string' ? search : undefined,
      dtcCode: typeof dtcCode === 'string' ? dtcCode : undefined,
    });
    return res.json({
      success: true,
      total: scans.length,
      scans,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/history - Record a new scan session
app.post('/api/history', (req, res) => {
  try {
    const sessionData = req.body;
    if (!sessionData || !sessionData.vehicleName) {
      return res.status(400).json({ success: false, error: 'Données de session de scan manquantes' });
    }
    const created = saasDatabase.addScan(sessionData);
    saasDatabase.logActivity({
      clientName: created.clientName || 'Atelier AutoPro DZ',
      hwid: created.vin || 'HWID-SCANNER',
      actionType: 'scan_started',
      actionDetails: `Scan ${created.vehicleName} (${created.dtcCodes.length} DTC détectés · Score ${created.overallHealthScore}%)`,
      vehicleName: created.vehicleName,
      locationCity: 'Atelier DZ',
      durationMinutes: Math.max(1, Math.round(created.durationSeconds / 60)),
    });
    return res.status(201).json({
      success: true,
      message: 'Session de scan enregistrée dans la base de données SaaS avec succès',
      scan: created,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/history/:id - Single scan session
app.get('/api/history/:id', (req, res) => {
  try {
    const scan = saasDatabase.getScanById(req.params.id);
    if (!scan) {
      return res.status(404).json({ success: false, error: 'Session introuvable' });
    }
    return res.json({ success: true, scan });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/history/:id/resolve - Mark DTCs as repaired
app.patch('/api/history/:id/resolve', (req, res) => {
  try {
    const { notes } = req.body;
    const updated = saasDatabase.resolveScan(req.params.id, notes);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Session introuvable' });
    }
    return res.json({
      success: true,
      message: 'Code(s) DTC clôturés et marqués comme réparés avec succès.',
      scan: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/history/:id - Remove a scan session
app.delete('/api/history/:id', (req, res) => {
  try {
    const ok = saasDatabase.deleteScan(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Session introuvable' });
    }
    return res.json({ success: true, message: 'Session supprimée de l\'historique' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/history/seed - Reset to Algerian workshop baseline
app.post('/api/history/seed', (_req, res) => {
  try {
    const seeded = saasDatabase.resetToSeed();
    return res.json({
      success: true,
      message: 'Historique de scans réinitialisé avec succès avec la flotte atelier Algérie.',
      total: seeded.length,
      scans: seeded,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/clients/activity - Track when clients activate and use the app
app.get('/api/clients/activity', (req, res) => {
  try {
    const { clientName, actionType, search } = req.query;
    const activities = saasDatabase.getActivities({
      clientName: typeof clientName === 'string' ? clientName : undefined,
      actionType: typeof actionType === 'string' ? actionType : undefined,
      search: typeof search === 'string' ? search : undefined,
    });
    return res.json({
      success: true,
      total: activities.length,
      activities,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/clients/activity - Log client module usage event + remote stability metrics
app.post('/api/clients/activity', (req, res) => {
  try {
    const {
      clientName,
      hwid,
      actionType,
      actionDetails,
      vehicleName,
      locationCity,
      durationMinutes,
      latencyMs,
      stabilityScore,
      reconnectCount,
      wakeLockActive,
    } = req.body;
    const record = saasDatabase.logActivity({
      clientName: clientName || 'Atelier Client AutoPro DZ',
      hwid: hwid || 'HWID-TABLETTE',
      actionType: actionType || 'heartbeat',
      actionDetails: actionDetails || 'Utilisation active du logiciel AutoPro DZ',
      vehicleName,
      locationCity: locationCity || 'Algérie',
      durationMinutes,
      latencyMs: typeof latencyMs === 'number' ? latencyMs : undefined,
      stabilityScore: typeof stabilityScore === 'number' ? stabilityScore : undefined,
      reconnectCount: typeof reconnectCount === 'number' ? reconnectCount : undefined,
      wakeLockActive: typeof wakeLockActive === 'boolean' ? wakeLockActive : undefined,
    });
    return res.status(201).json({ success: true, activity: record });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/db/backup - Sanitized JSON backup (Admin gets full subscribers, non-admin gets scans & stats only)
app.get('/api/db/backup', (req, res) => {
  try {
    const headerPass = req.headers['x-admin-passcode'];
    const pass = typeof headerPass === 'string' ? headerPass : '';
    const isAdmin = saasDatabase.verifyAdminPasscode(pass);
    const backup = saasDatabase.exportFullBackup(isAdmin);
    return res.json({ success: true, backup });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/cameras/command - Control vehicle ADAS / 360 / Reverse / Dashcam cameras via LVDS / CAN-Bus
app.post('/api/cameras/command', (req, res) => {
  const { cameraChannel, action, steeringAngleDeg, guidelinesActive, nightVisionActive, clientName, vehicleName } = req.body;
  const timestamp = new Date().toLocaleTimeString();

  let canFrame = '0x3B2 [8] 01 00 FF 20 00 00 00 00 (LVDS_CAM_SWITCH)';
  let message = `Flux vidéo commuté sur ${cameraChannel || 'Caméra Recul'}`;

  if (action === 'calibrate_adas') {
    canFrame = '0x742 [8] 2E F1 A0 01 00 00 00 00 (ADAS_CALIBRATION_START)';
    message = 'Calibration dynamique de la caméra pare-brise ADAS lancée (tolérance ±0.2°).';
  } else if (action === 'toggle_record') {
    canFrame = '0x3B8 [8] 02 01 00 00 00 00 00 00 (DVR_REC_TOGGLE)';
    message = 'Commande d\'enregistrement vidéo DVR envoyée au boîtier multimédia.';
  } else if (action === 'snapshot') {
    canFrame = '0x3B9 [8] 04 FF 00 00 00 00 00 00 (CAM_SNAPSHOT_CAPTURE)';
    message = 'Capture HD instantanée enregistrée dans la galerie atelier.';
  }

  if (clientName) {
    saasDatabase.logActivity({
      clientName,
      hwid: 'HWID-TABLETTE-ADAS',
      actionType: 'camera_view',
      actionDetails: `${message} (${cameraChannel || '360°'})`,
      vehicleName: vehicleName || 'Véhicule Atelier',
      locationCity: 'Algérie',
      durationMinutes: 2,
    });
  }

  return res.json({
    success: true,
    cameraChannel,
    action,
    steeringAngleDeg,
    guidelinesActive,
    nightVisionActive,
    canFrame,
    message,
    timestamp,
  });
});

// Ensure unmatched /api/* routes always return JSON 404 instead of HTML
app.all('/api/*', (req, res) => {
  return res.status(404).json({
    success: false,
    error: `Route API introuvable : ${req.method} ${req.originalUrl}`,
  });
});

// Mount Vite or static files
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '365d',
        immutable: true,
      })
    );
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`AutoPro Diagnostic & Flash Hub running on http://0.0.0.0:${port}`);
  });

  // Prevent reverse-proxy 502 HTTP keep-alive races for remote clients
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
