import {
  TransmissionType,
  TransmissionTransportMode,
  TransmissionSimScenario,
  TransmissionLiveData,
  TransmissionDtc,
  UdsCanFrameLog,
} from '../types/automotive';
import { obdHardwareBridge } from './obdHardwareBridge';
import { apiFetch } from './apiBridge';

/**
 * Constantes d'adressage ISO 15765-4 / ISO 14229 UDS pour Calculateur Boîte (TCU/TCM)
 */
export const TCU_CAN_TX_ID = '0x7E1';
export const TCU_CAN_RX_ID = '0x7E9';

export const UDS_SERVICES = {
  DIAGNOSTIC_SESSION_CONTROL: '10', // 0x10 0x03 = Session Étendue, 0x10 0x02 = Session Programmation
  ECU_RESET: '11',
  CLEAR_DTC: '14',                  // 0x14 FF FF FF
  READ_DTC: '19',                   // 0x19 02 09
  READ_DATA_BY_ID: '22',            // 0x22 <DID_HI> <DID_LO>
  SECURITY_ACCESS: '27',
  ROUTINE_CONTROL: '31',            // 0x31 01 <RID_HI> <RID_LO>
  REQUEST_DOWNLOAD: '34',           // 0x34 Flash (.bin / .frf)
  TESTER_PRESENT: '3E',
} as const;

export const TCU_UDS_DIDS = {
  ATF_TEMPERATURE: 'F411',
  LINE_PRESSURE_TARGET_ACTUAL: 'F422',
  GEAR_AND_CLUTCH_STATE: 'F430',
  SOLENOID_CURRENTS_N88_N93: 'F440',
  SHAFT_SPEEDS_RPM: 'F452',
} as const;

export const TCU_UDS_ROUTINES = {
  RESET_ADAPTATIONS: '0201',
  CLUTCH_KISS_POINT_CALIB: '0202',
  HYDRAULIC_PURGE_ACTUATOR_TEST: '0203',
  PRE_FLASH_ERASE_CHECK: 'FF00',
} as const;

export interface TransmissionProfilePreset {
  type: TransmissionType;
  label: string;
  shortLabel: string;
  examples: string;
  nominalPressureRangeBar: [number, number];
  optimalAtfLevelRangeC: [number, number];
  defaultGearMap: string[];
}

export const TRANSMISSION_PROFILES: Record<TransmissionType, TransmissionProfilePreset> = {
  BVA: {
    type: 'BVA',
    label: 'Automatique Convertisseur (BVA)',
    shortLabel: 'BVA (AT 6/8)',
    examples: 'Aisin TF-80SC / EAT6-EAT8 · ZF 6HP/8HP · Hyundai A6MF1',
    nominalPressureRangeBar: [5.5, 16.5],
    optimalAtfLevelRangeC: [58, 68],
    defaultGearMap: ['P', 'R', 'N', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
  },
  DSG_DCT: {
    type: 'DSG_DCT',
    label: 'Double Embrayage (DSG / DCT / EDC)',
    shortLabel: 'DSG / DCT / EDC',
    examples: 'VW DQ200/DQ250 · Getrag 7DCT300 (Chery/Geely) · Renault EDC DC4',
    nominalPressureRangeBar: [18.0, 58.0],
    optimalAtfLevelRangeC: [58, 68],
    defaultGearMap: ['P', 'R', 'N', 'D1 (K1)', 'D2 (K2)', 'D3 (K1)', 'D4 (K2)', 'D6 (K2)'],
  },
  CVT: {
    type: 'CVT',
    label: 'Variation Continue (CVT)',
    shortLabel: 'CVT',
    examples: 'Wanliyang CVT18/CVT25 (Chery) · Punch VT2/VT3 (DFSK/MG) · Jatco JF016E',
    nominalPressureRangeBar: [8.0, 42.0],
    optimalAtfLevelRangeC: [58, 68],
    defaultGearMap: ['P', 'R', 'N', 'D (Ratio 2.38:1)', 'D (Ratio 1.15:1)', 'D (Overdrive 0.62:1)'],
  },
  ROBOTISEE: {
    type: 'ROBOTISEE',
    label: 'Boîte Robotisée Simple Embrayage',
    shortLabel: 'Robotisée (AMT)',
    examples: 'Fiat Dualogic / Selespeed · PSA ETG6/BMP6 · Opel Easytronic',
    nominalPressureRangeBar: [32.0, 52.0],
    optimalAtfLevelRangeC: [58, 68],
    defaultGearMap: ['N', '1', '2', '3', '4', '5', 'R'],
  },
};

const TRANSMISSION_DTC_CATALOG: Record<
  string,
  Omit<TransmissionDtc, 'code' | 'status' | 'rawHexFrame'>
> = {
  P0700: {
    rangeCategory: 'P0700-P0999',
    descriptionFr: 'Système de commande de transmission (MIL demandé par le calculateur TCU)',
    severity: 'high',
  },
  P0715: {
    rangeCategory: 'P0700-P0999',
    descriptionFr: 'Capteur de vitesse arbre primaire (turbine / entrée boîte) — signal absent ou erratique',
    severity: 'high',
  },
  P0730: {
    rangeCategory: 'P0700-P0999',
    descriptionFr: 'Rapport de démultiplication incorrect (patinage mécanique / embrayage ou bande usée)',
    severity: 'critical',
  },
  P0741: {
    rangeCategory: 'P0700-P0999',
    descriptionFr: 'Électrovanne embrayage convertisseur (TCC) bloquée ouverte / glissement excessif',
    severity: 'high',
  },
  P0755: {
    rangeCategory: 'P0700-P0999',
    descriptionFr: 'Électrovanne de changement de vitesse B (N89 / N90) — défaut électrique ou grippe',
    severity: 'high',
  },
  P0841: {
    rangeCategory: 'P0700-P0999',
    descriptionFr: 'Capteur / Pressostat de pression d’huile hydraulique A — plage/performance hors tolérance',
    severity: 'critical',
  },
  P0944: {
    rangeCategory: 'P0700-P0999',
    descriptionFr: 'Perte de pression hydraulique dans l’accumulateur / unité pompe mécatronique',
    severity: 'critical',
  },
  P17BF: {
    rangeCategory: 'P1700-P1899',
    descriptionFr: 'Protection contre le jeu / surpression pompe hydraulique (Mécatronique DSG/DCT — fissure carter ou accumulateur)',
    severity: 'critical',
  },
  P1735: {
    rangeCategory: 'P1700-P1899',
    descriptionFr: 'Capteur de position embrayage 1 (K1) — défaut électrique ou dérive capteur Hall',
    severity: 'critical',
  },
  P189C: {
    rangeCategory: 'P1700-P1899',
    descriptionFr: 'Limitation de fonctionnement par manque de montée en pression hydraulique (DSG/Robotisée)',
    severity: 'critical',
  },
  P2711: {
    rangeCategory: 'P2700-P2795',
    descriptionFr: 'Désengagement mécanique imprévu de rapport (fourchette ou synchronisation défaillante)',
    severity: 'critical',
  },
  P2757: {
    rangeCategory: 'P2700-P2795',
    descriptionFr: 'Électrovanne régulation pression embrayage verrouillage (SLU) bloquée ou courant hors plage',
    severity: 'high',
  },
  P2789: {
    rangeCategory: 'P2700-P2795',
    descriptionFr: 'Adaptation embrayage en butée d’usure maximale (Kiss Point hors tolérance)',
    severity: 'high',
  },
  U0101: {
    rangeCategory: 'U0101 / CAN',
    descriptionFr: 'Perte de communication sur le bus CAN avec le calculateur de boîte (TCM / TCU 0x7E1)',
    severity: 'critical',
  },
};

export function classifyTransmissionDtcRange(code: string): TransmissionDtc['rangeCategory'] {
  const upper = code.toUpperCase();
  if (upper.startsWith('U01')) return 'U0101 / CAN';
  if (upper.startsWith('P17') || upper.startsWith('P18')) return 'P1700-P1899';
  if (upper.startsWith('P27')) return 'P2700-P2795';
  return 'P0700-P0999';
}

export function buildTransmissionDtc(
  code: string,
  status: TransmissionDtc['status'] = 'Actif',
  rawHexFrame?: string
): TransmissionDtc {
  const upper = code.trim().toUpperCase();
  const known = TRANSMISSION_DTC_CATALOG[upper];
  if (known) {
    return { code: upper, ...known, status, rawHexFrame };
  }
  return {
    code: upper,
    rangeCategory: classifyTransmissionDtcRange(upper),
    descriptionFr: `Défaut transmission ${upper} détecté sur calculateur TCU (0x7E9)`,
    severity: upper.startsWith('U') || upper.startsWith('P17') ? 'critical' : 'high',
    status,
    rawHexFrame,
  };
}

export function getSimulatedScenarioDtcs(
  type: TransmissionType,
  scenario: TransmissionSimScenario
): TransmissionDtc[] {
  if (scenario === 'optimal_hot') return [];

  if (scenario === 'slip_overheat') {
    return [
      buildTransmissionDtc('P0730', 'Actif', '59 02 FF 07 30 00 2F'),
      buildTransmissionDtc(
        type === 'DSG_DCT' ? 'P2789' : 'P0741',
        'Actif',
        type === 'DSG_DCT' ? '59 02 FF 27 89 00 2F' : '59 02 FF 07 41 00 2F'
      ),
    ];
  }

  if (scenario === 'mechatronic_pressure_drop') {
    return [
      buildTransmissionDtc(
        type === 'DSG_DCT' ? 'P17BF' : 'P0841',
        'Actif',
        type === 'DSG_DCT' ? '59 02 FF 17 BF 00 2F' : '59 02 FF 08 41 00 2F'
      ),
      buildTransmissionDtc(
        type === 'CVT' ? 'P0944' : 'P189C',
        'Fugitif',
        type === 'CVT' ? '59 02 FF 09 44 00 27' : '59 02 FF 18 9C 00 27'
      ),
    ];
  }

  // solenoid_u0101_limp
  return [
    buildTransmissionDtc('P0755', 'Actif', '59 02 FF 07 55 00 2F'),
    buildTransmissionDtc('P2757', 'Mémorisé', '59 02 FF 27 57 00 24'),
    buildTransmissionDtc('U0101', 'Fugitif', '59 02 FF C1 01 00 27'),
  ];
}

export function generateSimulatedLiveData(
  type: TransmissionType,
  scenario: TransmissionSimScenario,
  tick: number
): TransmissionLiveData {
  const wave = Math.sin(tick * 0.45);
  const wave2 = Math.cos(tick * 0.3);
  const profile = TRANSMISSION_PROFILES[type];

  let atfTempC = 63 + Math.round(wave * 2); // Zone optimale vidange 58°C - 68°C
  let targetBar =
    type === 'DSG_DCT' ? 42.0 : type === 'CVT' ? 24.5 : type === 'ROBOTISEE' ? 44.0 : 9.8;
  let actualBar = parseFloat((targetBar + wave * 0.4).toFixed(1));
  let currentGear =
    type === 'DSG_DCT'
      ? tick % 6 < 3
        ? 'D2 (K2)'
        : 'D3 (K1)'
      : type === 'CVT'
      ? 'D (Ratio 1.15:1)'
      : type === 'ROBOTISEE'
      ? '3'
      : 'D3';
  let clutchState =
    type === 'DSG_DCT' ? 'K1 Fermé · K2 Pré-engagé' : 'Pontage actif (Lock-Up)';
  let inputRpm = Math.round(2150 + wave * 120);
  let slipRpm = Math.round(14 + Math.abs(wave2) * 8);
  let tcuVoltage = parseFloat((13.9 + wave * 0.1).toFixed(2));
  let n90OffsetMa = 0;

  if (scenario === 'slip_overheat') {
    atfTempC = 114 + Math.round(wave * 3);
    targetBar = type === 'DSG_DCT' ? 44.0 : 12.2;
    actualBar = parseFloat((targetBar - 2.6 + wave * 0.5).toFixed(1));
    clutchState = 'Patinage détecté (Surchauffe ATF > 110°C)';
    inputRpm = Math.round(2850 + wave * 150);
    slipRpm = Math.round(295 + Math.abs(wave2) * 55);
  } else if (scenario === 'mechatronic_pressure_drop') {
    atfTempC = 76 + Math.round(wave * 2);
    targetBar = type === 'DSG_DCT' ? 48.0 : type === 'ROBOTISEE' ? 45.0 : 14.0;
    actualBar = parseFloat((targetBar * 0.46 + wave * 1.1).toFixed(1));
    currentGear = 'D2 (Mode Dégradé)';
    clutchState = 'Pression insuffisante — Ouverture sécurité';
    slipRpm = Math.round(140 + Math.abs(wave) * 35);
    tcuVoltage = parseFloat((12.4 + wave * 0.15).toFixed(2));
  } else if (scenario === 'solenoid_u0101_limp') {
    atfTempC = 82 + Math.round(wave * 2);
    targetBar = type === 'DSG_DCT' ? 40.0 : 11.5;
    actualBar = parseFloat((targetBar - 1.2 + wave * 0.4).toFixed(1));
    currentGear = 'D3 (Bloqué Secours / Limp Home)';
    clutchState = 'Coupure étages puissance N90';
    slipRpm = 45;
    tcuVoltage = parseFloat((11.6 + wave * 0.25).toFixed(2));
    n90OffsetMa = -590; // Défaut circuit ouvert / chute courant sur N90
  }

  const outputRpm = Math.max(0, Math.round(inputRpm - slipRpm));

  const baseSolenoids: Array<{ id: string; label: string; target: number }> = [
    { id: 'N88', label: 'Électrovanne Passage A (N88)', target: 620 },
    { id: 'N89', label: 'Électrovanne Passage B (N89)', target: 540 },
    { id: 'N90', label: 'Régulateur Embrayage K1 / C1 (N90)', target: 680 },
    { id: 'N91', label: 'Régulateur Convertisseur TCC / K2 (N91)', target: 490 },
    { id: 'N92', label: 'Électrovanne Frein / Bande (N92)', target: 310 },
    { id: 'N93', label: 'Régulateur Pression Principale EPC (N93)', target: 760 },
  ];

  const solenoids = baseSolenoids.map((s, idx) => {
    const jitter = Math.round((idx % 2 === 0 ? wave : wave2) * 14);
    let actual = s.target + jitter;
    let status: 'OK' | 'Dérive' | 'Ouvert/C-C' = 'OK';

    if (scenario === 'solenoid_u0101_limp' && s.id === 'N90') {
      actual = Math.max(0, 18 + Math.round(wave * 6));
      status = 'Ouvert/C-C';
    } else if (scenario === 'mechatronic_pressure_drop' && s.id === 'N93') {
      actual = s.target + 185;
      status = 'Dérive';
    } else if (scenario === 'slip_overheat' && s.id === 'N91') {
      actual = s.target - 110 + n90OffsetMa * 0;
      status = 'Dérive';
    }

    const dutyCyclePct = Math.min(99, Math.max(2, Math.round((actual / 950) * 100)));
    return {
      id: s.id,
      label: s.label,
      targetMa: s.target,
      actualMa: actual,
      dutyCyclePct,
      status,
    };
  });

  return {
    transmissionType: type,
    ecuName: profile.shortLabel,
    atfTempC,
    targetPressureBar: targetBar,
    actualPressureBar: actualBar,
    currentGear,
    clutchState,
    inputShaftRpm: inputRpm,
    outputShaftRpm: outputRpm,
    slipRpm,
    tcuVoltage,
    solenoids,
    timestamp: new Date().toLocaleTimeString('fr-FR'),
  };
}

function parseDtcFromUdsResponse(rawResp: string): TransmissionDtc[] {
  const tokens = rawResp
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => /^[0-9A-Fa-f]{2}$/.test(t))
    .map((t) => parseInt(t, 16));

  const idx59 = tokens.findIndex((b, idx) => b === 0x59 && tokens[idx + 1] === 0x02);
  if (idx59 === -1) return [];

  const dtcs: TransmissionDtc[] = [];
  const types = ['P', 'C', 'B', 'U'];

  // Format ISO 14229 : 59 02 <AvailabilityMask> [DTC_H DTC_M DTC_L Status]...
  for (let i = idx59 + 3; i + 3 < tokens.length; i += 4) {
    const b1 = tokens[i];
    const b2 = tokens[i + 1];
    const statusByte = tokens[i + 3];
    if (b1 === 0 && b2 === 0) continue;

    const typeIdx = (b1 & 0xc0) >> 6;
    const secondDigit = (b1 & 0x30) >> 4;
    const thirdChar = (b1 & 0x0f).toString(16).toUpperCase();
    const fourthChar = ((b2 & 0xf0) >> 4).toString(16).toUpperCase();
    const fifthChar = (b2 & 0x0f).toString(16).toUpperCase();
    const code = `${types[typeIdx]}${secondDigit}${thirdChar}${fourthChar}${fifthChar}`;
    const status: TransmissionDtc['status'] = (statusByte & 0x08) !== 0 ? 'Actif' : 'Fugitif';
    dtcs.push(
      buildTransmissionDtc(
        code,
        status,
        `59 02 FF ${b1.toString(16).padStart(2, '0').toUpperCase()} ${b2.toString(16).padStart(2, '0').toUpperCase()} 00 ${statusByte.toString(16).padStart(2, '0').toUpperCase()}`
      )
    );
  }
  return dtcs;
}

/**
 * Pont UDS Unifié ciblant 0x7E1 (requête) -> 0x7E9 (réponse)
 * Compatible :
 * 1) Web Serial / Web Bluetooth via ELM327 / OBDLink (ATSH 7E1 / ATCRA 7E9)
 * 2) API REST J2534 Passthru (/api/transmission/uds-exchange)
 * 3) Mode Simulation intégré pour tests atelier sans véhicule
 */
export async function executeTcuUdsCommand(params: {
  transport: TransmissionTransportMode;
  transmissionType: TransmissionType;
  scenario: TransmissionSimScenario;
  serviceHex: string;
  payloadHex: string;
  label: string;
}): Promise<{
  ok: boolean;
  txLog: UdsCanFrameLog;
  rxLog: UdsCanFrameLog;
  parsedDtcs?: TransmissionDtc[];
  message: string;
}> {
  const { transport, transmissionType, scenario, serviceHex, payloadHex, label } = params;
  const fullTxHex = `${serviceHex} ${payloadHex}`.replace(/\s+/g, ' ').trim().toUpperCase();
  const nowStr = new Date().toLocaleTimeString('fr-FR');

  const txLog: UdsCanFrameLog = {
    id: `TX-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: nowStr,
    direction: 'TX -> 0x7E1',
    serviceHex: `0x${serviceHex.toUpperCase()}`,
    rawHex: fullTxHex,
    label,
    transport,
  };

  // 1) Web Serial / Web Bluetooth réel (ELM327 / OBDLink)
  if (transport === 'ELM327_BRIDGE' && obdHardwareBridge.isRealHardwareConnected()) {
    try {
      await obdHardwareBridge.sendCommand('ATSH 7E1', 2000, false);
      await obdHardwareBridge.sendCommand('ATCRA 7E9', 2000, false);
      const rawResp = await obdHardwareBridge.sendCommand(fullTxHex.replace(/\s+/g, ''), 5000, true);
      const upperResp = rawResp.toUpperCase();
      const isNegative = upperResp.includes('7F') || upperResp.includes('NO DATA') || upperResp.includes('ERROR');

      const rxLog: UdsCanFrameLog = {
        id: `RX-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
        direction: 'RX <- 0x7E9',
        serviceHex: `0x${(parseInt(serviceHex, 16) + 0x40).toString(16).toUpperCase()}`,
        rawHex: upperResp || 'NO DATA',
        label: isNegative ? 'Réponse négative / Timeout TCU' : `Réponse matérielle TCU (${label})`,
        transport,
        isNegativeResponse: isNegative,
      };

      const parsedDtcs = serviceHex.toUpperCase() === '19' ? parseDtcFromUdsResponse(upperResp) : undefined;
      return {
        ok: !isNegative,
        txLog,
        rxLog,
        parsedDtcs,
        message: isNegative
          ? `Boîtier TCU 0x7E1 muet ou session verrouillée (${upperResp}).`
          : `Trame UDS exécutée sur bus CAN véhicule (${rxLog.rawHex}).`,
      };
    } finally {
      await obdHardwareBridge.sendCommand('ATCRA', 1500, false).catch(() => undefined);
      await obdHardwareBridge.sendCommand('ATSH 7DF', 1500, false).catch(() => undefined);
    }
  }

  // 2) API REST J2534 Passthru (ou Simulation via Backend REST)
  if (transport === 'J2534_PASSTHRU') {
    const res = await apiFetch('/api/transmission/uds-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txId: TCU_CAN_TX_ID,
        rxId: TCU_CAN_RX_ID,
        serviceHex,
        payloadHex,
        transmissionType,
        scenario,
        transportMode: 'J2534_PASSTHRU',
      }),
    });
    const data = await res.json();
    const rxHex = String(data?.rxHex || '7F 00 11');
    const rxLog: UdsCanFrameLog = {
      id: `RX-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      direction: 'RX <- 0x7E9',
      serviceHex: String(data?.positiveServiceHex || `0x${(parseInt(serviceHex, 16) + 0x40).toString(16).toUpperCase()}`),
      rawHex: rxHex,
      label: String(data?.message || label),
      transport: 'J2534_PASSTHRU',
      isNegativeResponse: !data?.success,
    };
    const parsedDtcs =
      serviceHex.toUpperCase() === '19'
        ? (data?.dtcs as TransmissionDtc[]) || parseDtcFromUdsResponse(rxHex)
        : undefined;
    return {
      ok: Boolean(data?.success),
      txLog,
      rxLog,
      parsedDtcs,
      message: String(data?.message || 'Échange UDS J2534 terminé.'),
    };
  }

  // 3) Mode Simulation Atelier Intégré (sans véhicule connecté)
  const svc = serviceHex.toUpperCase();
  let rxHex = '';
  let parsedDtcs: TransmissionDtc[] | undefined;
  let message = '';

  if (svc === '10') {
    const sub = payloadHex.trim().toUpperCase();
    rxHex = sub === '02' ? '50 02 00 32 01 F4' : '50 03 00 32 01 F4';
    message =
      sub === '02'
        ? 'Session Programmation Bootloader TCU ouverte (0x10 02 -> 50 02).'
        : 'Session Étendue Diagnostic TCU active (0x10 03 -> 50 03).';
  } else if (svc === '19') {
    const simDtcs = getSimulatedScenarioDtcs(transmissionType, scenario);
    parsedDtcs = simDtcs;
    const encoded = simDtcs
      .map((d) => d.rawHexFrame?.replace(/^59 02 FF\s*/i, '') || '07 00 00 2F')
      .join(' ');
    rxHex = simDtcs.length > 0 ? `59 02 FF ${encoded}` : '59 02 FF';
    message =
      simDtcs.length > 0
        ? `${simDtcs.length} code(s) défaut transmission lu(s) depuis 0x7E9.`
        : 'Aucun défaut transmission mémorisé dans le TCU (0x7E9).';
  } else if (svc === '14') {
    rxHex = '54';
    parsedDtcs = [];
    message = 'Mémoire défauts TCU (0x7E1) effacée avec succès (réponse 0x54).';
  } else if (svc === '22') {
    rxHex = `62 ${payloadHex.trim().toUpperCase()} 00 3F 03 D4`;
    message = `Lecture DID temps réel (${payloadHex}) confirmée sur 0x7E9.`;
  } else if (svc === '31') {
    rxHex = `71 ${payloadHex.trim().toUpperCase()} 00`;
    message = `Routine UDS exécutée et validée par le calculateur boîte (71 ${payloadHex}).`;
  } else {
    rxHex = `${(parseInt(svc, 16) + 0x40).toString(16).toUpperCase()} 00`;
    message = `Trame UDS ${fullTxHex} acquittée par 0x7E9.`;
  }

  return {
    ok: true,
    txLog,
    rxLog: {
      id: `RX-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      direction: 'RX <- 0x7E9',
      serviceHex: `0x${(parseInt(svc, 16) + 0x40).toString(16).toUpperCase()}`,
      rawHex: rxHex,
      label: message,
      transport: 'SIMULATION',
    },
    parsedDtcs,
    message,
  };
}
