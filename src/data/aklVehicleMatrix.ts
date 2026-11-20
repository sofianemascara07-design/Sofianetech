import {
  AklVehicleProcedure,
  EepromGeometryProfile,
} from '../types/automotive';

/**
 * Géométries binaires EXACTES (Validation stricte Anti-Brick avant toute analyse).
 * Toute déviation même d'un seul octet par rapport à ces tailles déclenche un blocage strict.
 */
export const EEPROM_GEOMETRY_PROFILES: EepromGeometryProfile[] = [
  {
    id: '93C66_512',
    label: 'EEPROM 93C66 (512 octets exacts)',
    category: 'EEPROM',
    exactSizeBytes: 512,
    familyHint: 'UCH / Immobilizer ancien / Combinés asiatiques (4096 bits = 512 B)',
    notes: 'Attention organisation 8-bit vs 16-bit (Pin ORG) lors du dessoudage ou pince SOIC8.',
  },
  {
    id: '95040_512',
    label: 'EEPROM 95040 (512 octets exacts)',
    category: 'EEPROM',
    exactSizeBytes: 512,
    familyHint: 'UCH Renault/Dacia anciennes générations / Calculateur ME7.x SPI',
    notes: 'Taille invariable : 512 octets (0x0000 à 0x01FF).',
  },
  {
    id: '95160_2048',
    label: 'EEPROM 95160 (2 048 octets exacts)',
    category: 'EEPROM',
    exactSizeBytes: 2048,
    familyHint: 'BSI / UCH intermédiaire 16 Kbit (2 Ko)',
    notes: 'Vérifier contact pin 1/4/8 avant lecture pince.',
  },
  {
    id: '95320_4096',
    label: 'EEPROM 95320 (4 096 octets exacts)',
    category: 'EEPROM',
    exactSizeBytes: 4096,
    familyHint: 'BSI Magneti Marelli / UCH 32 Kbit (4 Ko)',
    notes: 'Sauvegarde double recommandée avant modification.',
  },
  {
    id: '95640_8192',
    label: 'EEPROM 95640 (8 192 octets exacts)',
    category: 'EEPROM',
    exactSizeBytes: 8192,
    familyHint: 'BSI Magneti Marelli Fiat Doblò / 500 / PSA 64 Kbit (8 Ko)',
    notes: 'Contient zone chiffrée PIN/Précodage selon table OEM.',
  },
  {
    id: '95128_16384',
    label: 'EEPROM 95128 (16 384 octets exacts)',
    category: 'EEPROM',
    exactSizeBytes: 16384,
    familyHint: 'BSI PSA Valeo / Johnson Controls 128 Kbit (16 Ko)',
    notes: 'Lecture 3.3V stabilisée conseillée pour éviter corruption horloge.',
  },
  {
    id: '9S12_DFLASH_32K',
    label: 'MCU Freescale 9S12 D-Flash (32 768 octets)',
    category: 'MCU_DFLASH',
    exactSizeBytes: 32768,
    familyHint: 'UCH Renault/Dacia Johnson Controls / Continental (32 Ko D-Flash)',
    notes: 'NE JAMAIS confondre D-Flash (32 Ko) et P-Flash (256/512 Ko).',
  },
  {
    id: 'RH850_DFLASH_64K',
    label: 'MCU Renesas RH850 / SPC560 D-Flash (65 536 octets)',
    category: 'MCU_DFLASH',
    exactSizeBytes: 65536,
    familyHint: 'UCH Continental post-2016 / PEPS Chinois / MQB RH850 (64 Ko D-Flash)',
    notes: 'Lecture sur banc (Bench) par soudures sans levage de pattes.',
  },
  {
    id: 'TRICORE_MPC_512K',
    label: 'Flash TriCore / MPC (524 288 octets · 512 Ko)',
    category: 'FLASH_TRICORE',
    exactSizeBytes: 524288,
    familyHint: 'P-Flash MCU Infineon / MPC5642 / SPC560',
    notes: 'Analysé en arrière-plan par Web Worker sans figer le navigateur.',
  },
  {
    id: 'TRICORE_FLASH_2M',
    label: 'Flash TriCore / MPC Complet (2 097 152 octets · 2 Mo)',
    category: 'FLASH_TRICORE',
    exactSizeBytes: 2097152,
    familyHint: 'Full P-Flash ECU / BCM TriCore TC1782 / TC1793',
    notes: 'Analysé par Web Worker isolé ArrayBuffer/DataView.',
  },
];

/**
 * Référentiel Modulaire Smart Transponder & Procédure AKL
 * RÈGLE ANTI-HALLUCINATION :
 * - Aucune donnée cryptographique inventée (zéro code PIN, zéro octet CS, zéro adresse EEPROM arbitraire).
 * - Respect matériel strict des capacités réelles (ex: XT57B = ID46 + ID4A/PCF7939M démarrage seul SANS télécommande).
 * - Chaque entrée précise `cryptoTablePlugSlot` pour raccorder la table OEM côté Cloud Function / serveur.
 */
export const AKL_VEHICLE_MATRIX: AklVehicleProcedure[] = [
  {
    id: 'renault_dacia_clio4_sandero2_id4a',
    brand: 'Renault / Dacia',
    model: 'Clio IV / Sandero II / Logan II / Duster',
    yearRange: '2013–2020',
    immoSystem: 'UCH Continental / Johnson Controls (ID4A / Hitag AES)',
    mcuOrEeprom: 'MCU Renesas V850 / RH850 ou SPC560 (D-Flash 32 Ko / 64 Ko)',
    defaultGeometryId: 'RH850_DFLASH_64K',
    transponder: {
      chipName: 'Xhorse XT57B Super Chip (ou OEM PCF7939M / PCF7961M)',
      chipTechnology: 'ID4A / Hitag AES (Transpondeur 128-bit AES)',
      transponderOnly: true,
      supportsRemoteCentralLocking: false,
      warningNote:
        'ATTENTION CAPACITÉ RÉELLE XT57B : Le Xhorse XT57B gère l’ID46 et l’ID4A (PCF7939M), mais c’est un transpondeur de DÉMARRAGE UNIQUEMENT sans télécommande centralisée RF. Pour garder l’ouverture à distance, utilisez une carte/clé télécommande PCF7961M/PCF7953M complète.',
      precodingMode: 'Mode Xhorse ID4A (PCF7939M) — Précodage ISK requis avant apprentissage OBD/Bench',
    },
    mechanicalBlade: 'VA2 (ou HU136TE / VAC102 selon barillet)',
    remoteFrequency: '433.92 MHz FSK',
    riskLevel: 'Critique (Anti-Brick)',
    sgwRequired: false,
    minBatteryVoltage: 12.5,
    sensitiveEcuWarning:
      'RISQUE BRICKING UCH RENAULT/DACIA (Continental / Johnson Controls) : En All Keys Lost, une perte de tension (< 12.5V) ou coupure OBD pendant la lecture D-Flash / apprentissage peut effacer l’ISK et bloquer le véhicule définitivement. Sauvegarde D-Flash + P-Flash obligatoire avant toute écriture.',
    blockingConfirmations: [
      'Stabilisateur batterie atelier branché (Tension mesurée >= 12.5V)',
      'Sauvegarde horodatée du D-Flash / P-Flash UCH effectuée avant écriture',
      'J’ai noté que le Xhorse XT57B assure uniquement le démarrage (pas de centralisation RF)',
    ],
    procedureMethod: 'Bench MCU (D-Flash/P-Flash)',
    steps: [
      '1. En mode Add Key (Clonage) : lisez une clé fonctionnelle existante avant de toucher à l’UCH.',
      '2. En mode AKL : branchez un stabilisateur 13.5V (>= 12.5V requis) et identifiez UCH Continental vs Johnson Controls.',
      '3. Effectuez une lecture complète D-Flash (64 Ko) sur banc (ou OBD sécurisé avec sauvegarde D-Flash automatique) et générez le Backup horodaté.',
      '4. Générez le transpondeur XT57B en mode ID4A (ou clé OEM PCF7939M/7961M) via la table cryptographique serveur, puis finalisez l’apprentissage OBD.',
    ],
    cryptoTablePlugSlot:
      'POST /api/immo/akl/verify-dump -> slot "renault_uch_hitag_aes_isk" (insérer ici la table propriétaire d’extraction ISK/Cryptokey D-Flash).',
  },
  {
    id: 'renault_dacia_post2020_sgw',
    brand: 'Renault / Dacia',
    model: 'Duster II Ph2 / Sandero III / Logan III / Clio V',
    yearRange: '2020–2026',
    immoSystem: 'UCH / HFM Nouvelle Génération + Passerelle SGW',
    mcuOrEeprom: 'MCU Renesas RH850 verrouillé (Protection SGW CAN)',
    defaultGeometryId: 'RH850_DFLASH_64K',
    transponder: {
      chipName: 'Clé OEM PCF7953M / Carte Hitag-AES (XT57B en secours ID4A)',
      chipTechnology: 'Hitag AES 4A Chiffré + SGW Token',
      transponderOnly: false,
      supportsRemoteCentralLocking: true,
      warningNote:
        'Le XT57B seul en mode ID4A ne pilote pas les cartes mains-libres ni la télécommande 433.92 MHz ; réservez-le aux tests ou clés mécaniques sans centralisation.',
      precodingMode: 'Précodage Hitag-AES 4A + Authentification Passerelle SGW',
    },
    mechanicalBlade: 'VA2 / HU136TE',
    remoteFrequency: '433.92 MHz FSK',
    riskLevel: 'Critique (Anti-Brick)',
    sgwRequired: true,
    minBatteryVoltage: 12.6,
    sensitiveEcuWarning:
      'PASSERELLE SGW RENAULT/DACIA POST-2020 DÉTECTÉE : La prise OBD2 bloque toute commande d’écriture AKL sans câble Bypass SGW raccordé directement sur le faisceau UCH/Gateway (ou accès Bench / Serveur constructeur).',
    blockingConfirmations: [
      'Câble Bypass SGW branché en direct derrière la passerelle (ou connexion Bench)',
      'Alimentation batterie stabilisée >= 12.6V vérifiée',
      'J’accepte de ne jamais débrancher la prise pendant l’apprentissage clé',
    ],
    procedureMethod: 'OBD + Bypass SGW',
    steps: [
      '1. Localisez la passerelle SGW (sous planche de bord) et raccordez le câble Bypass SGW 12+8 / Renault.',
      '2. Lisez l’identification UCH/HFM et vérifiez l’absence de défaut de tension (< 12.6V).',
      '3. Chargez les données extraites dans le module serveur sécurisé pour préparer la puce précodée Hitag-AES 4A.',
      '4. Exécutez l’apprentissage AKL sur prise contournée sans couper le contact jusqu’à validation finale.',
    ],
    cryptoTablePlugSlot:
      'POST /api/immo/akl/verify-dump -> slot "renault_sgw_2020_rh850" (table d’appairage HFM/UCH côté Cloud Function uniquement).',
  },
  {
    id: 'renault_dacia_gen1_id46',
    brand: 'Renault / Dacia',
    model: 'Logan I / Sandero I / Clio III / Kangoo II',
    yearRange: '2006–2013',
    immoSystem: 'UCH Sagem / Johnson Controls / Siemens (ID46)',
    mcuOrEeprom: 'EEPROM 93C66 (512 o) ou 95040 (512 o) selon boîtier UCH',
    defaultGeometryId: '93C66_512',
    transponder: {
      chipName: 'PCF7936 (ID46) · Xhorse XT27A ou XT57B (mode ID46)',
      chipTechnology: 'Hitag 2 / ID46 (PCF7936)',
      transponderOnly: true,
      supportsRemoteCentralLocking: false,
      warningNote:
        'XT27A et XT57B configurés en ID46 assurent uniquement le démarrage moteur (puce passive sans pile ni télécommande). Pour la télécommande 433 MHz, utilisez un PCB PCF7946/7947.',
      precodingMode: 'ID46 Vierge / PCF7936 (ou PCF7946 avec télécommande intégrée)',
    },
    mechanicalBlade: 'VAC102 (Logan/Sandero 1) ou VA2 (Clio III)',
    remoteFrequency: '433.92 MHz ASK',
    riskLevel: 'Moyen',
    sgwRequired: false,
    minBatteryVoltage: 12.5,
    sensitiveEcuWarning: null,
    blockingConfirmations: [
      'Taille EEPROM vérifiée (93C66 = 512 octets exacts ou 95040 = 512 octets exacts)',
      'Sauvegarde originale .bin créée avant tout ré-encodage pince/programmeur',
    ],
    procedureMethod: 'EEPROM Banc',
    steps: [
      '1. Déposez l’UCH, identifiez l’EEPROM (93C66 ou 95040) et lisez exactement 512 octets.',
      '2. Déposez le fichier dans l’Analyseur de Dump ci-dessous pour vérifier CRC32 + SHA-256 et générer le Backup horodaté.',
      '3. Insérez votre table locale/serveur Hitag-2 pour extraire le code APV/PIN et précoder la puce ID46 (XT57B/XT27A/PCF7936).',
      '4. Finalisez la synchronisation de démarrage par OBD ou réinjection EEPROM vérifiée.',
    ],
    cryptoTablePlugSlot:
      'POST /api/immo/akl/verify-dump -> slot "renault_uch_93c66_id46" (table lecture Hitag-2 / APV 12 octets).',
  },
  {
    id: 'fiat_doblo_bsi_marelli_sgw',
    brand: 'Fiat / Stellantis',
    model: 'Doblò (263 & Tafraoui K9) / 500 / Fiorino',
    yearRange: '2014–2026',
    immoSystem: 'BSI Magneti Marelli (95640 / MPC5604) · SGW >= 2018',
    mcuOrEeprom: 'EEPROM 95640 (8 192 octets exacts) ou BSI PSA K9 (2023+)',
    defaultGeometryId: '95640_8192',
    transponder: {
      chipName: 'PCF7946 / XT57B (ID46 Doblò 263) · PCF7953M (K9 2023+)',
      chipTechnology: 'ID46 Hitag-2 (263) / Hitag-AES 4A (Tafraoui K9)',
      transponderOnly: false,
      supportsRemoteCentralLocking: true,
      warningNote:
        'Sur Doblò 263 / 500 : le précodage Dealer Key (7 octets de précodage issus du dump BSI) est OBLIGATOIRE avant apprentissage. Un XT57B en mode ID46 démarre sans télécommande.',
      precodingMode: 'Précodage Dealer Key obligatoire depuis BSI avant apprentissage PIN',
    },
    mechanicalBlade: 'SIP22 (263 / 500) · VA2 / HU83 (Stellantis K9)',
    remoteFrequency: '433.92 MHz FSK',
    riskLevel: 'Élevé (SGW)',
    sgwRequired: true,
    minBatteryVoltage: 12.5,
    sensitiveEcuWarning:
      'PASSERELLE SGW FIAT / STELLANTIS (>= 2018) : La prise OBD2 est filtrée en écriture. Branchement obligatoire du câble Bypass FCA 12+8 sous la colonne/boîte à gants (ou lecture directe EEPROM 95640 au programmeur sur banc).',
    blockingConfirmations: [
      'Câble Bypass FCA 12+8 branché (ou lecture directe BSI 95640 = 8 192 octets sur banc)',
      'Tension batterie >= 12.5V confirmée',
      'Toutes les clés à conserver sont prêtes (en apprentissage Fiat, les clés absentes sont définitivement barrées)',
    ],
    procedureMethod: 'OBD + Bypass SGW',
    steps: [
      '1. Connectez le câble Bypass FCA 12+8 si millésime >= 2018 (ou déposez le BSI Marelli pour lire l’EEPROM 95640 = 8 192 octets).',
      '2. Validez l’intégrité exacte du dump (8 192 o) et créez le backup horodaté.',
      '3. Précodez la clé vierge (Dealer Key) via votre table serveur Marelli puis exécutez la procédure d’apprentissage avec maintien >= 12.5V.',
    ],
    cryptoTablePlugSlot:
      'POST /api/immo/akl/verify-dump -> slot "fiat_marelli_95640_dealer_key" (table déchiffrement XOR Marelli côté serveur).',
  },
  {
    id: 'psa_peugeot_citroen_bsi',
    brand: 'Peugeot / Citroën',
    model: '208 / 301 / C-Élysée / Partner / Berlingo',
    yearRange: '2012–2025',
    immoSystem: 'BSI Valeo / Johnson Controls / Delphi CAN',
    mcuOrEeprom: 'EEPROM 95128 (16 384 o) / Flash Delphi-Continental',
    defaultGeometryId: '95128_16384',
    transponder: {
      chipName: 'PCF7936 (XT27A/XT57B ID46) ou PCF7939M (XT57B ID4A post-2019)',
      chipTechnology: 'ID46 (2012–2018) · ID4A Hitag-AES (2019–2025)',
      transponderOnly: true,
      supportsRemoteCentralLocking: false,
      warningNote:
        'XT57B couvre ID46 (ancien BSI) et ID4A (BSI Delphi/Continental récent) en DÉMARRAGE UNIQUEMENT. Télécommande RF requiert un PCB clé PSA complet 433.92 MHz (PCF7941 / PCF7961M).',
      precodingMode: 'Code PIN PSA 4 caractères + Synchronisation télécommande post-contact',
    },
    mechanicalBlade: 'VA2 ou HU83 (vérifier rainure latérale vs centrale)',
    remoteFrequency: '433.92 MHz FSK / ASK',
    riskLevel: 'Moyen',
    sgwRequired: false,
    minBatteryVoltage: 12.5,
    sensitiveEcuWarning:
      'VIGILANCE BSI VALEO / DELPHI PSA : Ne jamais lire l’EEPROM 95128 en circuit sous 5V sans pince 3.3V régulée, et toujours sauvegarder avant écriture (risque perte configuration feux/essuie-glaces/anti-démarrage).',
    blockingConfirmations: [
      'Backup EEPROM 95128 (16 384 octets exacts) ou Dump BSI sauvegardé',
      'Tension batterie stabilisée >= 12.5V (mode Éco désactivé)',
    ],
    procedureMethod: 'EEPROM Banc',
    steps: [
      '1. Lisez le dump BSI (16 384 octets exacts pour 95128) ou effectuez une extraction PIN OBD sécurisée.',
      '2. Validez taille et Checksums CRC32/SHA-256 ci-dessous.',
      '3. Préparez le transpondeur XT57B (ID46 ou ID4A selon année) ou clé télécommande OEM, puis encodez avec les 4 caractères PIN.',
    ],
    cryptoTablePlugSlot:
      'POST /api/immo/akl/verify-dump -> slot "psa_bsi_95128_pin_swap" (table lecture ASCII/hex PIN PSA côté Cloud Function).',
  },
  {
    id: 'chery_geely_peps_cn',
    brand: 'Chery / Geely / MG',
    model: 'Tiggo 4 / Tiggo 7 Pro / Coolray / MG ZS',
    yearRange: '2019–2026',
    immoSystem: 'Module PEPS / BCM Immobilizer Chinois (Hitag AES 4A)',
    mcuOrEeprom: 'MCU SPC560 / RH850 D-Flash (64 Ko) ou EEPROM BCM 95320/95640',
    defaultGeometryId: 'RH850_DFLASH_64K',
    transponder: {
      chipName: 'Smart Key PCF7953M / 4A (ou XT57B ID4A démarrage induction)',
      chipTechnology: 'Hitag AES 4A (PEPS 433.92 MHz)',
      transponderOnly: false,
      supportsRemoteCentralLocking: true,
      warningNote:
        'XT57B configuré en ID4A peut démarrer le véhicule en posant le transpondeur sur la bobine d’induction d’urgence (porte-gobelet/Start-Stop), mais sans ouverture sans-clé PEPS ni télécommande.',
      precodingMode: 'Smart Key Hitag-AES 4A + Lecture Code PIN PEPS 4–8 chiffres',
    },
    mechanicalBlade: 'HU136 / TOY48 / HON66 (lame secours insert)',
    remoteFrequency: '433.92 MHz FSK',
    riskLevel: 'Moyen',
    sgwRequired: false,
    minBatteryVoltage: 12.5,
    sensitiveEcuWarning:
      'PEPS CHINOIS 2024–2026 : Sur certaines séries Geely Coolray / Chery récentes, si la lecture PIN échoue par OBD2, ne pas insister avec de faux PIN (blocage temporaire module PEPS 15 à 60 min) — passer en lecture D-Flash sur banc.',
    blockingConfirmations: [
      'Tension batterie >= 12.5V vérifiée',
      'Zone bobine d’induction d’urgence localisée pour présenter la clé lors de l’apprentissage',
    ],
    procedureMethod: 'OBD',
    steps: [
      '1. Tentez la lecture du mot de passe PEPS via OBD2 (Lonsdor/Autel/OBDStar) avec contact coupé ou feux de détresse actifs selon modèle.',
      '2. En cas d’échec sur modèle 2025/2026, déposez le module PEPS et lisez le D-Flash (65 536 octets) sur banc avec backup obligatoire.',
      '3. Présentez la Smart Key vierge (PCF7953M / 4A) dans l’emplacement d’induction d’urgence pendant l’écriture.',
    ],
    cryptoTablePlugSlot:
      'POST /api/immo/akl/verify-dump -> slot "china_peps_hitag_aes" (table correspondance PEPS Geely/Chery côté serveur).',
  },
  {
    id: 'vag_mqb_5c_rh850',
    brand: 'Volkswagen / Audi / Cupra',
    model: 'Golf 7/8 · Passat Pro · T-Roc · Audi A3L',
    yearRange: '2016–2026',
    immoSystem: 'MQB48 (VDO NEC35xx) / MQB49-5C (RH850 + SFD)',
    mcuOrEeprom: 'MCU NEC35xx / Renesas RH850 R7F7014xx (D-Flash 64 Ko)',
    defaultGeometryId: 'RH850_DFLASH_64K',
    transponder: {
      chipName: 'Clé MQB48 (XT27A sans RF / OEM) · OEM MQB 5C (XT57B NON compatible)',
      chipTechnology: 'MQB48 AES / MQB49-5C (16 octets CS + Sync Data ECU/TCU/ELV)',
      transponderOnly: false,
      supportsRemoteCentralLocking: true,
      warningNote:
        'PRÉCISION CRITIQUE : Le XT57B ne gère PAS le MQB48/5C. Utilisez XT27A (démarrage seul MQB48 après décryptage Sync Data) ou une clé OEM/Xhorse MQB48/5C adaptée.',
      precodingMode: 'Génération Dealer Key avec 16 octets CS + Sync Data (All Keys Lost)',
    },
    mechanicalBlade: 'HU66',
    remoteFrequency: '433.92 / 434.4 MHz FSK (Chine SAIC/FAW)',
    riskLevel: 'Critique (Anti-Brick)',
    sgwRequired: true,
    minBatteryVoltage: 12.6,
    sensitiveEcuWarning:
      'ALERTE ANTI-BRICK MQB49 / 5C & SFD : NE JAMAIS effacer ni modifier le combiné RH850 en All Keys Lost sans avoir préalablement extrait et sauvegardé la Synchronization Data (ECU Moteur + Boîte DSG/TCU + Colonne ELV).',
    blockingConfirmations: [
      'Sauvegarde complète D-Flash + P-Flash RH850/NEC35xx réalisée',
      'Calcul Sync Data complet (Cluster + ECU + DSG/TCU) disponible avant écriture',
      'Stabilisateur batterie >= 12.6V raccordé',
    ],
    procedureMethod: 'Bench MCU (D-Flash/P-Flash)',
    steps: [
      '1. Déposez le combiné d’instruments et lisez le D-Flash RH850 (65 536 octets) avec adaptateur sans levage de pattes.',
      '2. Validez taille et Checksums dans l’Analyseur Web Worker et générez le Backup horodaté.',
      '3. Transférez les empreintes vérifiées au module serveur/Cloud pour calcul CS 16 octets + Sync Data, précodez la Dealer Key et finalisez l’apprentissage.',
    ],
    cryptoTablePlugSlot:
      'POST /api/immo/akl/verify-dump -> slot "vag_mqb_rh850_sync_server" (service serveur calcul Immo/Sync Data).',
  },
];

export function getEepromGeometryById(id: string): EepromGeometryProfile {
  return EEPROM_GEOMETRY_PROFILES.find((g) => g.id === id) || EEPROM_GEOMETRY_PROFILES[0];
}
