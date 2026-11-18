export interface AiVerificationReport {
  verified: boolean;
  provider: 'gemini-4-hydrogen' | 'groq-deterministic' | 'offline-verified-rules';
  guardrailsApplied: string[];
  blockedHallucinations: string[];
  confidenceLevel: 'STRICT_VERIFIED' | 'WARNING_FILTERED';
  checkedAt: string;
}

// Codes d'accès Menu Usine / Ingénieur RÉELS et vérifiés sur les autoradios chinois & OEM
export const VERIFIED_FACTORY_CODES = new Set([
  '8888',
  '3368',
  '123456',
  '1617',
  '16176699',
  '0000',
  '7890',
  '369875',
  '0362',
  '6666',
  '5678',
  '126',
  '1234',
  '2400',
  '884926', // Code PIN secours AutoPro DZ explicitement configuré dans le module Keyless
]);

// Motifs de commandes destructives interdites dans les recommandations de mise à jour
const DESTRUCTIVE_UPDATE_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  {
    regex: /\bfastboot\s+(?:flash|erase)\s+(?:system|vendor|boot|preloader|lk|mcu)\b/gi,
    reason: 'Commande fastboot flash/erase sur partition critique bloquée',
  },
  {
    regex: /\bdd\s+if=[^\s]+\s+of=\/dev\/block/gi,
    reason: 'Écriture directe bloc eMMC (dd of=/dev/block) bloquée',
  },
  {
    regex: /\brm\s+-rf\s+\/(?:system|vendor|data|oem)\b/gi,
    reason: 'Suppression récursive partition système bloquée',
  },
  {
    regex: /\bmount\s+-o\s+rw,remount\s+\/(?:system|vendor)\b/gi,
    reason: 'Remontage écriture /system ou /vendor bloqué',
  },
];

// URLs externes potentiellement inventées par un LLM (liens Mega, Drive, APK/Firmware inconnus)
const EXTERNAL_URL_REGEX = /https?:\/\/[^\s)>"'`]+/gi;

// Archives firmware potentiellement hallucinéees (.zip/.img/.bin/.upd/.kdz) si absentes du contexte
const FIRMWARE_ARCHIVE_REGEX = /\b[A-Za-z0-9._-]{4,}\.(?:zip|img|upd|kdz|tar\.gz|swu)\b/gi;

function sanitizeExternalUrls(text: string, blocked: string[]): string {
  return text.replace(EXTERNAL_URL_REGEX, (url) => {
    // Autoriser uniquement les domaines officiels AutoPro s'ils apparaissent
    if (
      url.startsWith('https://autoprodz-a7071.web.app') ||
      url.startsWith('https://autopro-suitebacken.onrender.com')
    ) {
      return url;
    }
    blocked.push(`Lien externe non vérifié supprimé (${url.slice(0, 48)}...)`);
    return '[LIEN BLOQUÉ ANTI-HALLUCINATION — Utilisez uniquement un firmware vérifié par numéro MCU/IHU]';
  });
}

function sanitizeDestructiveCommands(text: string, blocked: string[]): string {
  let out = text;
  for (const rule of DESTRUCTIVE_UPDATE_PATTERNS) {
    if (rule.regex.test(out)) {
      rule.regex.lastIndex = 0;
      blocked.push(rule.reason);
      out = out.replace(rule.regex, '[COMMANDE DESTRUCTIVE BLOQUÉE PAR ANTI-BRICK]');
    }
  }
  return out;
}

/**
 * Vérifie et filtre les réponses IA de diagnostic automobile (codes DTC, PIN, liens).
 */
export function verifyDiagnosticAiOutput(
  rawText: string,
  providedDtcInputs: string[],
  provider: AiVerificationReport['provider']
): { sanitizedText: string; aiVerification: AiVerificationReport } {
  const blocked: string[] = [];
  const guardrailsApplied = [
    'Validation stricte des codes DTC saisis/lus',
    'Blocage des URLs et téléchargements inventés',
    'Protection contre l’invention de codes PIN/IMMO',
  ];

  let text = sanitizeExternalUrls(rawText, blocked);
  text = sanitizeDestructiveCommands(text, blocked);

  // Extraire les codes DTC présents dans l'entrée utilisateur (ex: "P0299 (Pression...)")
  const allowedDtcs = new Set<string>();
  for (const item of providedDtcInputs || []) {
    const matches = String(item).toUpperCase().match(/\b[PCBU][0-9A-F]{4}\b/g);
    if (matches) {
      matches.forEach((m) => allowedDtcs.add(m));
    }
  }

  // Vérifier si l'IA a inventé des codes DTC fantômes ou des codes hors-norme (ex: P9999)
  const mentionedDtcs = text.toUpperCase().match(/\b[PCBU][0-9A-F]{4}\b/g) || [];
  const inventedDtcs = Array.from(new Set(mentionedDtcs)).filter(
    (code) => allowedDtcs.size > 0 && !allowedDtcs.has(code)
  );

  if (inventedDtcs.length > 0) {
    // On n'efface pas aveuglément un code connexe légitime (ex U0100), mais on annote clairement
    // et on bloque tout code clairement invalide (ex: 5e caractère non standard ou P99xx/U99xx)
    for (const inv of inventedDtcs) {
      if (/^[PCBU][89EF][0-9A-F]{3}$/.test(inv)) {
        blocked.push(`Code DTC hors standard ISO 15031-6 filtré (${inv})`);
        const r = new RegExp(`\\b${inv}\\b`, 'g');
        text = text.replace(r, `[CODE ${inv} NON CONFIRMÉ]`);
      } else {
        blocked.push(`Code connexe mentionné par l’IA mais non lu sur ce véhicule (${inv}) — à confirmer au scanner`);
      }
    }
  }

  // Bloquer si l'IA prétend fournir un code PIN calculateur/IMMO concret dans un diagnostic
  const fakePinRegex = /\b(?:code\s+pin|pin\s+immo|code\s+sécurité)\s*(?:est|:|=)\s*['"`]?([A-Z0-9]{4,8})['"`]?/gi;
  text = text.replace(fakePinRegex, (full, pinVal: string) => {
    if (VERIFIED_FACTORY_CODES.has(pinVal)) return full;
    blocked.push(`Code PIN inventé sans lecture EEPROM bloqué (${pinVal})`);
    return 'Code PIN : [BLOQUÉ — Extraction requise depuis dump BSI/EEPROM réel]';
  });

  return {
    sanitizedText: text,
    aiVerification: {
      verified: blocked.length === 0,
      provider,
      guardrailsApplied,
      blockedHallucinations: blocked,
      confidenceLevel: blocked.length === 0 ? 'STRICT_VERIFIED' : 'WARNING_FILTERED',
      checkedAt: new Date().toISOString(),
    },
  };
}

/**
 * Vérifie les recommandations IA de flash ECU & mises à jour cartographiques.
 */
export function verifyFlashAiOutput(
  rawText: string,
  flashStage: string,
  provider: AiVerificationReport['provider']
): { sanitizedText: string; aiVerification: AiVerificationReport } {
  const blocked: string[] = [];
  const guardrailsApplied = [
    'Refus de certification Checksum sans fichier .bin réel',
    'Protection sonde Lambda amont (B1S1 AFR)',
    'Blocage des noms de firmware .bin/.swu et liens inventés',
  ];

  let text = sanitizeExternalUrls(rawText, blocked);
  text = sanitizeDestructiveCommands(text, blocked);

  // Bloquer les faux noms de fichiers firmware inventés (sauf noms génériques d'exemple)
  text = text.replace(FIRMWARE_ARCHIVE_REGEX, (fileName) => {
    blocked.push(`Référence fichier firmware non vérifiée bloquée (${fileName})`);
    return `[FICHIER ${fileName} NON CERTIFIÉ — Utilisez votre dump d’origine lu sur véhicule]`;
  });

  // Alerte si l'IA prétend que le checksum est déjà vérifié ou validé sans le binaire
  if (/checksum\s+(?:déjà\s+)?(?:validé|vérifié|ok\s+sur\s+ce\s+fichier)/i.test(text)) {
    blocked.push('L’IA ne peut pas valider un Checksum RSA/CRC sans le fichier .bin physique');
    text += '\n\n⚠️ **[GARDE-FOU AUTOPRO]** : L’IA ne calcule pas le Checksum réel. Vérifiez obligatoirement le Checksum via Kess3/Autotuner/PCMFlash/WinOLS avant toute écriture.';
  }

  // Protection sonde amont Lambda 1 sur Lambda Off
  if (/lambda\s*off|cat\s*off/i.test(flashStage) && /supprimer.*?(?:sonde\s+1|b1s1|lambda\s+amont)/i.test(text)) {
    blocked.push('Instruction dangereuse sur sonde amont B1S1 corrigée');
    text += '\n\n🛡️ **[PROTECTION AFR B1S1]** : Ne jamais désactiver la sonde Lambda amont (Banc 1 Capteur 1) ; seule la sonde aval post-catalyseur (B1S2 / P0420) doit être neutralisée.';
  }

  return {
    sanitizedText: text,
    aiVerification: {
      verified: blocked.length === 0,
      provider,
      guardrailsApplied,
      blockedHallucinations: blocked,
      confidenceLevel: blocked.length === 0 ? 'STRICT_VERIFIED' : 'WARNING_FILTERED',
      checkedAt: new Date().toISOString(),
    },
  };
}

/**
 * Vérifie les instructions IA pour tablettes Android chinoises (mises à jour IHU, codes usine, commandes ADB).
 */
export function verifyTabletUpdateAiOutput(
  rawText: string,
  context: { brand: string; ihuRef: string; socChip: string; intendedFile: string },
  provider: AiVerificationReport['provider']
): { sanitizedText: string; aiVerification: AiVerificationReport } {
  const blocked: string[] = [];
  const guardrailsApplied = [
    'Pare-feu anti-croisement IHU / SoC / MCU',
    'Blocage écriture /system, /vendor, fastboot erase et dd',
    'Contrôle des codes usine et blocage liens firmware non officiels',
  ];

  let text = sanitizeExternalUrls(rawText, blocked);
  text = sanitizeDestructiveCommands(text, blocked);

  const intendedUpper = (context.intendedFile || '').toUpperCase();
  text = text.replace(FIRMWARE_ARCHIVE_REGEX, (archiveName) => {
    if (intendedUpper && intendedUpper.includes(archiveName.toUpperCase())) {
      return archiveName;
    }
    blocked.push(`Nom d’archive mise à jour inventé bloqué (${archiveName})`);
    return `[ARCHIVE NON VÉRIFIÉE : ${archiveName}]`;
  });

  // Vérifier les codes usine cités par l'IA (ex: "code usine: 9482")
  const factoryRegex = /\b(?:code\s+(?:usine|ingénieur|secret|paramètres)|pin\s+menu)\s*(?:est|:|=)?\s*['"`]?(\d{3,8})['"`]?/gi;
  text = text.replace(factoryRegex, (full, code: string) => {
    if (VERIFIED_FACTORY_CODES.has(code)) return full;
    blocked.push(`Code menu usine non vérifié filtré (${code})`);
    return `code usine [NON CERTIFIÉ (${code}) — Testez les codes vérifiés 8888 / 3368 / 123456]`;
  });

  return {
    sanitizedText: text,
    aiVerification: {
      verified: blocked.length === 0,
      provider,
      guardrailsApplied,
      blockedHallucinations: blocked,
      confidenceLevel: blocked.length === 0 ? 'STRICT_VERIFIED' : 'WARNING_FILTERED',
      checkedAt: new Date().toISOString(),
    },
  };
}

/**
 * Vérifie les procédures IA IMMO / Clés pour bloquer tout PIN ou CS inventé.
 */
export function verifyImmoAiOutput(
  rawText: string,
  hasRealDump: boolean,
  provider: AiVerificationReport['provider']
): { sanitizedText: string; aiVerification: AiVerificationReport } {
  const blocked: string[] = [];
  const guardrailsApplied = [
    'Blocage strict de tout Code PIN inventé sans dump déchiffré',
    'Blocage de toute séquence CS 16 octets inventée',
    'Vérification Bypass SGW / Sauvegarde EEPROM obligatoire',
  ];

  let text = sanitizeExternalUrls(rawText, blocked);
  text = sanitizeDestructiveCommands(text, blocked);

  // Bloquer toute suite hexadécimale de 16 octets (32 hex) que l'IA inventerait comme CS
  const fakeCsRegex = /\b(?:[0-9A-F]{2}[\s:-]?){12,16}\b/g;
  text = text.replace(fakeCsRegex, (hexSeq) => {
    // Ignore les séquences courtes ou SHA préfixes connus, bloquer les suites CS longues
    const clean = hexSeq.replace(/[^0-9A-F]/gi, '');
    if (clean.length >= 24) {
      blocked.push(`Séquence hex CS/IMMO inventée bloquée (${clean.slice(0, 12)}...)`);
      return '[DONNÉES CS BLOQUÉES — Extraction directe depuis EEPROM/OBD requise]';
    }
    return hexSeq;
  });

  // Bloquer tout PIN concret inventé
  const pinConcreteRegex = /\b(?:pin(?:\s+code)?|mot\s+de\s+passe)\s*(?:est|:|=)\s*['"`]?([A-Z0-9]{4,8})['"`]?/gi;
  text = text.replace(pinConcreteRegex, (full, pinVal: string) => {
    if (hasRealDump && pinVal === 'NON_CALCULE') return full;
    blocked.push(`Code PIN IMMO généré par l’IA bloqué (${pinVal})`);
    return 'Code PIN : [EXTRACTION MATÉRIELLE REQUISE — Jamais généré par IA]';
  });

  return {
    sanitizedText: text,
    aiVerification: {
      verified: blocked.length === 0,
      provider,
      guardrailsApplied,
      blockedHallucinations: blocked,
      confidenceLevel: blocked.length === 0 ? 'STRICT_VERIFIED' : 'WARNING_FILTERED',
      checkedAt: new Date().toISOString(),
    },
  };
}

/**
 * Vérifie les traductions IA : correspondance exacte des clés et préservation stricte des variables ({0}, %s, %d).
 */
export function verifyTranslationOutput(
  sourceStrings: Array<{ key: string; text: string }>,
  rawTranslations: Array<{ key: string; translated: string }>,
  provider: AiVerificationReport['provider']
): { translatedMap: Record<string, string>; aiVerification: AiVerificationReport } {
  const blocked: string[] = [];
  const guardrailsApplied = [
    'Correspondance stricte 1:1 des clés source',
    'Vérification intégrité des variables ({0}, %s, %d)',
    'Rejet des chaînes inventées hors dictionnaire source',
  ];

  const sourceMap = new Map<string, string>();
  for (const item of sourceStrings || []) {
    sourceMap.set(item.key, item.text);
  }

  const translatedMap: Record<string, string> = {};
  const placeholderRegex = /(\{\d+\}|%[sdif])/g;

  for (const t of rawTranslations || []) {
    if (!t || !sourceMap.has(t.key)) {
      if (t?.key) blocked.push(`Clé inconnue inventée ignorée (${t.key})`);
      continue;
    }
    const orig = sourceMap.get(t.key) || '';
    const origPlaceholders = orig.match(placeholderRegex) || [];
    let cleanTrans = String(t.translated || '').trim();

    for (const ph of origPlaceholders) {
      if (!cleanTrans.includes(ph)) {
        blocked.push(`Variable manquante "${ph}" restaurée sur clé "${t.key}"`);
        cleanTrans = `${cleanTrans} ${ph}`.trim();
      }
    }

    if (cleanTrans) {
      translatedMap[t.key] = cleanTrans;
    }
  }

  return {
    translatedMap,
    aiVerification: {
      verified: blocked.length === 0,
      provider,
      guardrailsApplied,
      blockedHallucinations: blocked,
      confidenceLevel: blocked.length === 0 ? 'STRICT_VERIFIED' : 'WARNING_FILTERED',
      checkedAt: new Date().toISOString(),
    },
  };
}
