// Base de données universelle Multi-Pôles — AutoPro Flash & Diagnostic Hub
// Couvre : Allemand Premium (SFD/DoIP), Français Premium (SGW), Asiatique/Chinois, Poids Lourds SAE J1939

export type VehiclePoleId =
  | 'GERMAN_PREMIUM'
  | 'FRENCH_PREMIUM'
  | 'ASIAN_CHINESE'
  | 'HEAVY_DUTY_J1939';

export type AccessMethodType = 'OBD' | 'BENCH_BOOT' | 'OBD_OR_BENCH' | 'DOIP_ETHERNET' | 'J1939_CAN250';

export interface PinoutTerminal {
  pin: string;
  connector: string;
  signal: '+12V' | 'GND' | 'CAN-H' | 'CAN-L' | 'GPT1' | 'GPT2' | 'IGN' | 'ETH_TX+' | 'ETH_TX-' | 'J1939-H' | 'J1939-L';
  wireColor: string;
  hexColor: string;
  note: string;
}

export interface UniversalControlUnitProfile {
  id: string;
  pole: VehiclePoleId;
  poleLabel: string;
  brand: string;
  models: string;
  years: string;
  engineOrGearbox: string;
  unitType: 'ECU' | 'TCU';
  ecuModel: string;
  tcuModel?: string;
  accessMethod: AccessMethodType;
  accessBadge: string;
  securityGate: string;
  protocol: string;
  txId: string;
  rxId: string;
  baudrate: string;
  flashSizeLabel: string;
  requiredPackId: 'pack_vag_md1' | 'pack_fr_sgw' | 'pack_cn_asia' | 'pack_hd_j1939';
  creditCost: number;
  pinoutSummary: string;
  pinouts: PinoutTerminal[];
  supportedSolutions: string[];
}

export const POLE_METADATA: Record<
  VehiclePoleId,
  { label: string; subtitle: string; badgeColor: string; accentBorder: string }
> = {
  GERMAN_PREMIUM: {
    label: 'Allemand Premium',
    subtitle: 'VAG, BMW, Mercedes, Porsche · SFD/SFD2 & DoIP',
    badgeColor: 'text-cyan-300 bg-cyan-950/70 border-cyan-500/40',
    accentBorder: 'border-cyan-500/40',
  },
  FRENCH_PREMIUM: {
    label: 'Français Premium',
    subtitle: 'Stellantis/PSA, Renault/Alpine, DS · SGW & EAT8/EDC',
    badgeColor: 'text-indigo-300 bg-indigo-950/70 border-indigo-500/40',
    accentBorder: 'border-indigo-500/40',
  },
  ASIAN_CHINESE: {
    label: 'Asiatique & Chinois',
    subtitle: 'Geely, Jetour, Chery, Changan, Hyundai/Kia · DCT7/CVT',
    badgeColor: 'text-emerald-300 bg-emerald-950/70 border-emerald-500/40',
    accentBorder: 'border-emerald-500/40',
  },
  HEAVY_DUTY_J1939: {
    label: 'Poids Lourds SAE J1939',
    subtitle: 'Trucks, Bus & Engins · PGN / SPN / FMI CAN 250k',
    badgeColor: 'text-amber-300 bg-amber-950/70 border-amber-500/40',
    accentBorder: 'border-amber-500/40',
  },
};

export const UNIVERSAL_PROFILES: UniversalControlUnitProfile[] = [
  // =========================================================================
  // 1. HAUT DE GAMME ALLEMAND
  // =========================================================================
  {
    id: 'vag_md1cs004_dq381',
    pole: 'GERMAN_PREMIUM',
    poleLabel: 'Allemand Premium',
    brand: 'VAG (VW / Audi / Porsche)',
    models: 'Golf 8 GTD/GTI, Tiguan, Audi A4/A6/Q5, Passat B8',
    years: '2018–2026',
    engineOrGearbox: '2.0 TDI Evo / 2.0 TSI + DSG DQ381',
    unitType: 'ECU',
    ecuModel: 'Bosch MD1CS004 / MG1CS002',
    tcuModel: 'DSG DQ381 / DQ500 / DL382',
    accessMethod: 'BENCH_BOOT',
    accessBadge: '[BENCH / BOOT sur table] + OBD SFD2',
    securityGate: 'SFD / SFD2 + DoIP ISO 13400',
    protocol: 'ISO 14229 UDS / DoIP',
    txId: '0x7E0',
    rxId: '0x7E8',
    baudrate: '500 kbps CAN / 100 Mbps DoIP',
    flashSizeLabel: '4096 Ko / 8192 Ko (AURIX TC298)',
    requiredPackId: 'pack_vag_md1',
    creditCost: 2,
    pinoutSummary: 'Connecteur A & B Bosch MD1CS004 (GPT1/GPT2 requis en mode Bench sans ouverture).',
    pinouts: [
      { pin: 'A-16', connector: 'Conn A (96p)', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: 'Alimentation permanente 13.5V' },
      { pin: 'A-04', connector: 'Conn A (96p)', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: 'Contact +15 commuté' },
      { pin: 'A-02', connector: 'Conn A (96p)', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse châssis / puissance' },
      { pin: 'A-58', connector: 'Conn A (96p)', signal: 'CAN-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'Bus CAN 500 kbps High' },
      { pin: 'A-57', connector: 'Conn A (96p)', signal: 'CAN-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'Bus CAN 500 kbps Low' },
      { pin: 'B-21', connector: 'Conn B (58p)', signal: 'GPT1', wireColor: 'Cyan', hexColor: '#06B6D4', note: 'Impulsion horloge Bench GPT1' },
      { pin: 'B-34', connector: 'Conn B (58p)', signal: 'GPT2', wireColor: 'Violet', hexColor: '#A855F7', note: 'Impulsion horloge Bench GPT2' },
    ],
    supportedSolutions: ['DPF / FAP OFF', 'EGR OFF', 'AdBlue / SCR OFF', 'DTC OFF', 'VMAX OFF', 'Start & Stop OFF'],
  },
  {
    id: 'vag_simos18_19_dsg',
    pole: 'GERMAN_PREMIUM',
    poleLabel: 'Allemand Premium',
    brand: 'VAG (VW / Audi / Cupra)',
    models: 'Golf 7/8 R, Audi S3/RS3, Cupra Formentor',
    years: '2016–2025',
    engineOrGearbox: '2.0 TFSI EA888 + DSG DQ250 / DQ381',
    unitType: 'ECU',
    ecuModel: 'Continental SIMOS 18.x / 19.x',
    tcuModel: 'DQ200 / DQ250 / DQ381',
    accessMethod: 'OBD_OR_BENCH',
    accessBadge: '[OBD] Virtual Read ou [BENCH]',
    securityGate: 'SFD (OBD) / TPROT Cloud 0x27',
    protocol: 'UDS ISO 14229 CAN-FD',
    txId: '0x7E0',
    rxId: '0x7E8',
    baudrate: '500 kbps / CAN-FD',
    flashSizeLabel: '4096 Ko (TriCore TC1791 / TC298)',
    requiredPackId: 'pack_vag_md1',
    creditCost: 2,
    pinoutSummary: 'Brochage Continental Simos 18/19 (T91/T60) compatible câble Bench + OBD Virtual Read.',
    pinouts: [
      { pin: 'T91-03', connector: 'T91', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: '+30 Batterie stabilisée' },
      { pin: 'T91-87', connector: 'T91', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: '+15 Contact' },
      { pin: 'T91-01', connector: 'T91', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse ECU' },
      { pin: 'T91-68', connector: 'T91', signal: 'CAN-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'CAN Drive High' },
      { pin: 'T91-67', connector: 'T91', signal: 'CAN-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'CAN Drive Low' },
      { pin: 'T60-14', connector: 'T60', signal: 'GPT1', wireColor: 'Cyan', hexColor: '#06B6D4', note: 'Signal GPT Bench 1' },
      { pin: 'T60-29', connector: 'T60', signal: 'GPT2', wireColor: 'Violet', hexColor: '#A855F7', note: 'Signal GPT Bench 2' },
    ],
    supportedSolutions: ['OPF / GPF OFF', 'DTC OFF', 'VMAX OFF', 'Start & Stop OFF'],
  },
  {
    id: 'bmw_md1cp004_zf8hp',
    pole: 'GERMAN_PREMIUM',
    poleLabel: 'Allemand Premium',
    brand: 'BMW / MINI',
    models: 'Série 3 G20, Série 5 G30, X3 G01, X5 G05',
    years: '2019–2026',
    engineOrGearbox: 'B47 / B57 / B58 + ZF 8HP (8HP50/76)',
    unitType: 'ECU',
    ecuModel: 'Bosch MD1CP004 / EDC17CP44',
    tcuModel: 'ZF 8HP Gen2 / Gen3',
    accessMethod: 'DOIP_ETHERNET',
    accessBadge: '[DOIP OBD] ou [BENCH GPT]',
    securityGate: 'DoIP ISO 13400 + RSA-3072',
    protocol: 'DoIP / UDS ISO 14229',
    txId: '0x6F1',
    rxId: '0x6F4',
    baudrate: '100 Mbps Ethernet DoIP / 500k CAN',
    flashSizeLabel: '8192 Ko (AURIX TC298TP)',
    requiredPackId: 'pack_vag_md1',
    creditCost: 3,
    pinoutSummary: 'Mode DoIP Ethernet via prise OBD2 (pins 3/11/12/13) ou câble Bench GPT directe sur MD1.',
    pinouts: [
      { pin: 'OBD-16', connector: 'OBD2 / Bench', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: '+12V stabilisé ≥ 13.0V' },
      { pin: 'OBD-04', connector: 'OBD2 / Bench', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse signal & châssis' },
      { pin: 'OBD-03', connector: 'DoIP ETH', signal: 'ETH_TX+', wireColor: 'Cyan', hexColor: '#06B6D4', note: 'DoIP RX/TX+ Ethernet' },
      { pin: 'OBD-11', connector: 'DoIP ETH', signal: 'ETH_TX-', wireColor: 'Bleu', hexColor: '#3B82F6', note: 'DoIP RX/TX- Ethernet' },
      { pin: 'OBD-06', connector: 'OBD2', signal: 'CAN-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'D-CAN High' },
      { pin: 'OBD-14', connector: 'OBD2', signal: 'CAN-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'D-CAN Low' },
    ],
    supportedSolutions: ['DPF / FAP OFF', 'EGR OFF', 'AdBlue / SCR OFF', 'DTC OFF', 'VMAX OFF'],
  },
  {
    id: 'mercedes_crd3_9gtronic',
    pole: 'GERMAN_PREMIUM',
    poleLabel: 'Allemand Premium',
    brand: 'Mercedes-Benz',
    models: 'Classe C W205/W206, Classe E W213, GLC, Sprinter',
    years: '2016–2025',
    engineOrGearbox: 'OM651 / OM654 + 7G/9G-Tronic',
    unitType: 'TCU',
    ecuModel: 'Delphi CRD3.x / CRD3P / Bosch MD1CP001',
    tcuModel: 'VGS-NAG2 / VGS-NAG3 (9G-Tronic)',
    accessMethod: 'BENCH_BOOT',
    accessBadge: '[BENCH / BOOT sur table]',
    securityGate: 'FBS4 / Seed-Key Niveau 0x11 Cloud',
    protocol: 'UDS ISO 14229 CAN 500k',
    txId: '0x7E1',
    rxId: '0x7E9',
    baudrate: '500 kbps CAN',
    flashSizeLabel: '4096 Ko (TriCore TC1797 / AURIX)',
    requiredPackId: 'pack_vag_md1',
    creditCost: 2,
    pinoutSummary: 'Connectique Bench directe mécatronique VGS-NAG2/NAG3 ou ECU Delphi CRD3P.',
    pinouts: [
      { pin: 'Pin 01', connector: 'VGS / CRD3', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: 'Alimentation principale 13.5V' },
      { pin: 'Pin 03', connector: 'VGS / CRD3', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: 'Réveil borne +15' },
      { pin: 'Pin 02', connector: 'VGS / CRD3', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse capteur & puissance' },
      { pin: 'Pin 05', connector: 'VGS / CRD3', signal: 'CAN-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'CAN-C High (120 Ω)' },
      { pin: 'Pin 06', connector: 'VGS / CRD3', signal: 'CAN-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'CAN-C Low' },
    ],
    supportedSolutions: ['DTC OFF', 'VMAX OFF', 'DPF / FAP OFF', 'AdBlue / SCR OFF', 'EGR OFF'],
  },

  // =========================================================================
  // 2. HAUT DE GAMME FRANÇAIS (STELLANTIS / PSA, RENAULT / ALPINE, DS)
  // =========================================================================
  {
    id: 'psa_md1cs003_eat8',
    pole: 'FRENCH_PREMIUM',
    poleLabel: 'Français Premium',
    brand: 'Stellantis / Peugeot / DS / Citroën',
    models: '3008 II, 508 II, DS7 Crossback, C5 Aircross, Doblo',
    years: '2018–2026',
    engineOrGearbox: '1.5 BlueHDi DV5 / 2.0 BlueHDi + Aisin EAT8',
    unitType: 'ECU',
    ecuModel: 'Bosch MD1CS003 / EDC17C60 / Delphi DCM7.1A',
    tcuModel: 'Aisin EAT6 / EAT8',
    accessMethod: 'BENCH_BOOT',
    accessBadge: '[BENCH / BOOT sur table] + Bypass SGW',
    securityGate: 'SGW Stellantis/PSA + Cloud 0x27',
    protocol: 'UDS ISO 14229',
    txId: '0x7E0',
    rxId: '0x7E8',
    baudrate: '500 kbps CAN',
    flashSizeLabel: '4096 Ko (AURIX TC298)',
    requiredPackId: 'pack_fr_sgw',
    creditCost: 2,
    pinoutSummary: 'Connecteur Bosch MD1CS003 / DCM7.1A (GPT1/GPT2 sur banc pour lecture Full Flash + EEPROM).',
    pinouts: [
      { pin: 'A-15', connector: 'MD1CS003 A', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: 'Alimentation +12V stabilisée' },
      { pin: 'A-44', connector: 'MD1CS003 A', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: '+APC Contact' },
      { pin: 'A-01', connector: 'MD1CS003 A', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse ECU' },
      { pin: 'A-71', connector: 'MD1CS003 A', signal: 'CAN-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'CAN IS High' },
      { pin: 'A-70', connector: 'MD1CS003 A', signal: 'CAN-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'CAN IS Low' },
      { pin: 'B-19', connector: 'MD1CS003 B', signal: 'GPT1', wireColor: 'Cyan', hexColor: '#06B6D4', note: 'GPT1 Bench' },
      { pin: 'B-28', connector: 'MD1CS003 B', signal: 'GPT2', wireColor: 'Violet', hexColor: '#A855F7', note: 'GPT2 Bench' },
    ],
    supportedSolutions: ['AdBlue / SCR OFF', 'DPF / FAP OFF', 'EGR OFF', 'DTC OFF', 'Start & Stop OFF'],
  },
  {
    id: 'renault_sid321_edc_dw5',
    pole: 'FRENCH_PREMIUM',
    poleLabel: 'Français Premium',
    brand: 'Renault / Alpine',
    models: 'Mégane IV RS, Talisman, Austral, Trafic IV, Alpine A110',
    years: '2018–2026',
    engineOrGearbox: '1.5/2.0 Blue dCi / 1.8 TCe + Getrag EDC DW5/DW6',
    unitType: 'ECU',
    ecuModel: 'Continental SID310 / SID321 / Bosch MD1CS006',
    tcuModel: 'Getrag EDC DW5 / DW6',
    accessMethod: 'OBD_OR_BENCH',
    accessBadge: '[OBD SGW Unlock] ou [BENCH]',
    securityGate: 'SGW Renault Token / Seed 0x27',
    protocol: 'UDS ISO 14229 CAN-HS',
    txId: '0x7E0',
    rxId: '0x7E8',
    baudrate: '500 kbps CAN',
    flashSizeLabel: '4096 Ko (TriCore TC297 / TC1791)',
    requiredPackId: 'pack_fr_sgw',
    creditCost: 2,
    pinoutSummary: 'Bypass passerelle SGW requis en OBD2 ; accès direct CAN + GPT sur connecteur Continental SID321.',
    pinouts: [
      { pin: 'C1-A4', connector: 'SID321 C1', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: '+12V Batterie' },
      { pin: 'C1-B2', connector: 'SID321 C1', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: '+12V Après Contact' },
      { pin: 'C1-H1', connector: 'SID321 C1', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse ECU' },
      { pin: 'C2-D3', connector: 'SID321 C2', signal: 'CAN-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'CAN-V High' },
      { pin: 'C2-D4', connector: 'SID321 C2', signal: 'CAN-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'CAN-V Low' },
      { pin: 'C3-K2', connector: 'SID321 C3', signal: 'GPT1', wireColor: 'Cyan', hexColor: '#06B6D4', note: 'GPT1 Service Mode' },
    ],
    supportedSolutions: ['AdBlue / SCR OFF', 'DPF / FAP OFF', 'EGR OFF', 'DTC OFF', 'VMAX OFF'],
  },
  {
    id: 'psa_med1744_vd56',
    pole: 'FRENCH_PREMIUM',
    poleLabel: 'Français Premium',
    brand: 'Peugeot / DS / Citroën',
    models: '208 GTI, 308 GT, DS4, C3 PureTech',
    years: '2016–2025',
    engineOrGearbox: '1.6 THP / 1.2 PureTech + EAT6/EAT8',
    unitType: 'ECU',
    ecuModel: 'Bosch MED17.4.4 / Valeo VD56',
    tcuModel: 'Aisin EAT6 / EAT8',
    accessMethod: 'OBD_OR_BENCH',
    accessBadge: '[OBD] ou [BENCH]',
    securityGate: 'SGW PSA + TPROT',
    protocol: 'UDS ISO 14229',
    txId: '0x7E0',
    rxId: '0x7E8',
    baudrate: '500 kbps CAN',
    flashSizeLabel: '2048 Ko / 4096 Ko',
    requiredPackId: 'pack_fr_sgw',
    creditCost: 1,
    pinoutSummary: 'Lecture/écriture OBD directe après déverrouillage SGW ou câble Bench MED17.4.4.',
    pinouts: [
      { pin: '53V-M4', connector: '53V Noir', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: '+12V Permanent' },
      { pin: '53V-G4', connector: '53V Noir', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: '+15 APC' },
      { pin: '53V-H1', connector: '53V Noir', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse' },
      { pin: '32V-A3', connector: '32V Gris', signal: 'CAN-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'CAN High' },
      { pin: '32V-A4', connector: '32V Gris', signal: 'CAN-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'CAN Low' },
    ],
    supportedSolutions: ['OPF / GPF OFF', 'DTC OFF', 'VMAX OFF', 'Start & Stop OFF'],
  },

  // =========================================================================
  // 3. VÉHICULES ASIATIQUES & CHINOIS RÉCENTS
  // =========================================================================
  {
    id: 'geely_coolray_mg1us008_7dct',
    pole: 'ASIAN_CHINESE',
    poleLabel: 'Asiatique & Chinois',
    brand: 'Geely / Binyue / Monjaro',
    models: 'Coolray 1.5T (2020–2026), Battle, GX3 Pro, Starray',
    years: '2020–2026',
    engineOrGearbox: 'BHE15-EFZ 1.5T 4-Cyl + Getrag 7DCT',
    unitType: 'ECU',
    ecuModel: 'Bosch MG1US008 / MED17.8.10 / ME17.8.8',
    tcuModel: 'Getrag 7DCT (0x7E1) / CVT',
    accessMethod: 'OBD_OR_BENCH',
    accessBadge: '[OBD] J2534 ou [BENCH GPT]',
    securityGate: 'Cloud Seed/Key 0x27 Niveau 0x11',
    protocol: 'UDS ISO 14229 CAN 500k',
    txId: '0x7E0',
    rxId: '0x7E8',
    baudrate: '500 kbps CAN',
    flashSizeLabel: '4096 Ko (AURIX TC298)',
    requiredPackId: 'pack_cn_asia',
    creditCost: 2,
    pinoutSummary: 'Compatible Flash OBD Anti-LSPI DZ & Bench Bosch MG1US008 (GPT1/GPT2 sur broches B-12/B-14).',
    pinouts: [
      { pin: 'A-01', connector: 'MG1US008 A', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse châssis' },
      { pin: 'A-12', connector: 'MG1US008 A', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: '+12V stabilisé ≥ 13.0V' },
      { pin: 'A-28', connector: 'MG1US008 A', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: 'Contact +15' },
      { pin: 'A-61', connector: 'MG1US008 A', signal: 'CAN-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'CAN-High 500 kbps' },
      { pin: 'A-62', connector: 'MG1US008 A', signal: 'CAN-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'CAN-Low 500 kbps' },
      { pin: 'B-12', connector: 'MG1US008 B', signal: 'GPT1', wireColor: 'Cyan', hexColor: '#06B6D4', note: 'GPT1 Bench' },
      { pin: 'B-14', connector: 'MG1US008 B', signal: 'GPT2', wireColor: 'Violet', hexColor: '#A855F7', note: 'GPT2 Bench' },
    ],
    supportedSolutions: ['OPF / GPF OFF', 'DTC OFF', 'VMAX OFF', 'Start & Stop OFF'],
  },
  {
    id: 'jetour_chery_changan_med17',
    pole: 'ASIAN_CHINESE',
    poleLabel: 'Asiatique & Chinois',
    brand: 'Jetour / Chery / Changan',
    models: 'Dashing, X70 Plus, T2 Traveller, Tiggo 8 Pro, UNI-T',
    years: '2021–2026',
    engineOrGearbox: '1.5T / 1.6 TGDI / 2.0 TGDI + 7DCT',
    unitType: 'ECU',
    ecuModel: 'Bosch ME17.8.8 / MED17.8.10 / MG1US008',
    tcuModel: 'Magna 7DCT / CVT25',
    accessMethod: 'OBD_OR_BENCH',
    accessBadge: '[OBD] ou [BENCH GPT]',
    securityGate: 'Cloud Seed/Key 0x27',
    protocol: 'UDS ISO 14229',
    txId: '0x7E0',
    rxId: '0x7E8',
    baudrate: '500 kbps CAN',
    flashSizeLabel: '2048 Ko / 4096 Ko',
    requiredPackId: 'pack_cn_asia',
    creditCost: 1,
    pinoutSummary: 'Connectique standard UAES / Bosch TriCore TC1782 (Jetour/Chery/Changan).',
    pinouts: [
      { pin: 'Pin 03', connector: 'UAES 81p', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: '+12V Alimentation' },
      { pin: 'Pin 14', connector: 'UAES 81p', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: '+15 Contact' },
      { pin: 'Pin 02', connector: 'UAES 81p', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse' },
      { pin: 'Pin 61', connector: 'UAES 81p', signal: 'CAN-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'CAN High' },
      { pin: 'Pin 62', connector: 'UAES 81p', signal: 'CAN-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'CAN Low' },
      { pin: 'Pin 75', connector: 'UAES 81p', signal: 'GPT1', wireColor: 'Cyan', hexColor: '#06B6D4', note: 'GPT1 Bench' },
    ],
    supportedSolutions: ['DTC OFF', 'VMAX OFF', 'OPF / GPF OFF', 'IMMO OFF'],
  },
  {
    id: 'hyundai_kia_kefico_dct7',
    pole: 'ASIAN_CHINESE',
    poleLabel: 'Asiatique & Chinois',
    brand: 'Hyundai / Kia',
    models: 'Tucson, Sportage, Seltos, Accent, i30',
    years: '2018–2026',
    engineOrGearbox: '1.6 T-GDi / 1.6 CRDi + DCT7',
    unitType: 'ECU',
    ecuModel: 'Kefico CPEGD2.20 / Bosch MED17.9.8',
    tcuModel: 'Hyundai/Kia 7-Speed DCT',
    accessMethod: 'OBD_OR_BENCH',
    accessBadge: '[OBD] ou [BENCH]',
    securityGate: 'Seed-Key Hyundai/Kefico Cloud',
    protocol: 'UDS ISO 14229 CAN',
    txId: '0x7E0',
    rxId: '0x7E8',
    baudrate: '500 kbps CAN',
    flashSizeLabel: '2048 Ko (TriCore TC1782)',
    requiredPackId: 'pack_cn_asia',
    creditCost: 1,
    pinoutSummary: 'Kefico CPEGD / Bosch MED17.9.8 : lecture OBD rapide ou câble Bench sans ouverture.',
    pinouts: [
      { pin: 'A-01', connector: 'Kefico A', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse' },
      { pin: 'A-06', connector: 'Kefico A', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: '+12V Permanent' },
      { pin: 'A-73', connector: 'Kefico A', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: '+15 Contact' },
      { pin: 'A-60', connector: 'Kefico A', signal: 'CAN-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'C-CAN High' },
      { pin: 'A-77', connector: 'Kefico A', signal: 'CAN-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'C-CAN Low' },
    ],
    supportedSolutions: ['DPF / FAP OFF', 'EGR OFF', 'DTC OFF', 'IMMO OFF', 'VMAX OFF'],
  },

  // =========================================================================
  // 4. POIDS LOURDS, BUS & ENGINS (SAE J1939)
  // =========================================================================
  {
    id: 'truck_edc17cv41_j1939',
    pole: 'HEAVY_DUTY_J1939',
    poleLabel: 'Poids Lourds J1939',
    brand: 'MAN / Iveco / Sinotruk / Shacman',
    models: 'MAN TGX/TGS, Iveco Stralis, Sinotruk Howo, Shacman X3000',
    years: '2014–2026',
    engineOrGearbox: 'D20/D26 / Cursor / Weichai WP12 + ZF TraXon',
    unitType: 'ECU',
    ecuModel: 'Bosch EDC17CV41 / EDC17CV42',
    tcuModel: 'ZF AS-Tronic / TraXon',
    accessMethod: 'J1939_CAN250',
    accessBadge: '[OBD J1939 24V] ou [BENCH]',
    securityGate: 'SAE J1939-73 DM1/DM2 + Cloud Seed',
    protocol: 'SAE J1939 (29-bit CAN 250 kbps)',
    txId: '0x18DA00F9',
    rxId: '0x18DAF900',
    baudrate: '250 kbps CAN 29-bit',
    flashSizeLabel: '4096 Ko (TriCore TC1797)',
    requiredPackId: 'pack_hd_j1939',
    creditCost: 3,
    pinoutSummary: 'Prise 9-pin Deutsch / OBD 24V ou Bench EDC17CV41/CV42 (⚠️ alimentation 24V PL ou 13.5V banc).',
    pinouts: [
      { pin: 'K-01', connector: 'EDC17CV41 K', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: 'Alimentation banc 13.5V–24V' },
      { pin: 'K-02', connector: 'EDC17CV41 K', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse puissance' },
      { pin: 'K-28', connector: 'EDC17CV41 K', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: 'Signal +15' },
      { pin: 'K-54', connector: 'Deutsch C/F', signal: 'J1939-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'SAE J1939 CAN-H (250k)' },
      { pin: 'K-55', connector: 'Deutsch C/F', signal: 'J1939-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'SAE J1939 CAN-L (250k)' },
    ],
    supportedSolutions: ['AdBlue / SCR OFF', 'DPF / FAP OFF', 'EGR OFF', 'VMAX OFF', 'DTC OFF'],
  },
  {
    id: 'truck_cummins_cm2350',
    pole: 'HEAVY_DUTY_J1939',
    poleLabel: 'Poids Lourds J1939',
    brand: 'Cummins / DAF / Dongfeng / Engins',
    models: 'DAF CF/XF, Dongfeng KX, Engins TP Komatsu/Hyundai',
    years: '2015–2026',
    engineOrGearbox: 'ISX15 / QSX / ISL9',
    unitType: 'ECU',
    ecuModel: 'Cummins CM2350 / CM2350A',
    accessMethod: 'J1939_CAN250',
    accessBadge: '[OBD J1939] ou [BENCH]',
    securityGate: 'J1939 DM1 + Protection Calibrage Cummins',
    protocol: 'SAE J1939 / ISO 15765',
    txId: '0x18DA00F9',
    rxId: '0x18DAF900',
    baudrate: '250 kbps / 500 kbps J1939',
    flashSizeLabel: '4096 Ko (MPC5674 / TriCore)',
    requiredPackId: 'pack_hd_j1939',
    creditCost: 3,
    pinoutSummary: 'Connecteur OEM 60-pin Cummins CM2350 + Prise J1939 9-pin (C=CAN-H, D=CAN-L).',
    pinouts: [
      { pin: 'OEM-51', connector: 'CM2350 OEM', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: 'Bat+ 13.5V / 24V' },
      { pin: 'OEM-50', connector: 'CM2350 OEM', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Bat-' },
      { pin: 'OEM-05', connector: 'CM2350 OEM', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: 'Keyswitch +15' },
      { pin: 'OEM-46', connector: 'CM2350 OEM', signal: 'J1939-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'J1939 + Public CAN' },
      { pin: 'OEM-47', connector: 'CM2350 OEM', signal: 'J1939-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'J1939 - Public CAN' },
    ],
    supportedSolutions: ['AdBlue / SCR OFF', 'DPF / FAP OFF', 'EGR OFF', 'VMAX OFF', 'DTC OFF'],
  },
  {
    id: 'truck_volvo_renault_trw_ems2',
    pole: 'HEAVY_DUTY_J1939',
    poleLabel: 'Poids Lourds J1939',
    brand: 'Volvo Trucks / Renault Trucks',
    models: 'Volvo FH4/FMX, Renault T/C/K Euro 6',
    years: '2014–2026',
    engineOrGearbox: 'D11K / D13K / DTI 11 / DTI 13 + I-Shift',
    unitType: 'ECU',
    ecuModel: 'TRW EMS2.2 / EMS2.3 / EMS2.4',
    tcuModel: 'Volvo I-Shift / Renault Optidriver',
    accessMethod: 'J1939_CAN250',
    accessBadge: '[OBD J1939] ou [BENCH]',
    securityGate: 'Volvo Seed-Key Cloud + J1939-73',
    protocol: 'SAE J1939 / UDS',
    txId: '0x18DA00F9',
    rxId: '0x18DAF900',
    baudrate: '250 kbps / 500 kbps J1939',
    flashSizeLabel: '4096 Ko (MPC5674 / AURIX)',
    requiredPackId: 'pack_hd_j1939',
    creditCost: 3,
    pinoutSummary: 'Connecteur EA/EB TRW EMS2 (Renault Trucks T/K / Volvo FH) avec CAN J1939 250 kbps.',
    pinouts: [
      { pin: 'EA-62', connector: 'TRW EMS2 EA', signal: '+12V', wireColor: 'Rouge', hexColor: '#EF4444', note: 'Alim principale' },
      { pin: 'EA-61', connector: 'TRW EMS2 EA', signal: 'GND', wireColor: 'Noir', hexColor: '#64748B', note: 'Masse' },
      { pin: 'EA-36', connector: 'TRW EMS2 EA', signal: 'IGN', wireColor: 'Orange', hexColor: '#F97316', note: 'Contact +15' },
      { pin: 'EB-12', connector: 'TRW EMS2 EB', signal: 'J1939-H', wireColor: 'Jaune', hexColor: '#EAB308', note: 'BBM / J1939 CAN-H' },
      { pin: 'EB-13', connector: 'TRW EMS2 EB', signal: 'J1939-L', wireColor: 'Vert', hexColor: '#22C55E', note: 'BBM / J1939 CAN-L' },
    ],
    supportedSolutions: ['AdBlue / SCR OFF', 'DPF / FAP OFF', 'EGR OFF', 'VMAX OFF', 'DTC OFF'],
  },
];

// =========================================================================
// DÉCODEUR SAE J1939 PGN / SPN / FMI
// =========================================================================

export interface J1939DecodedFrame {
  rawHex: string;
  pgnHex: string;
  pgnDec: number;
  pgnName: string;
  sourceAddress: string;
  spn: number;
  spnLabel: string;
  fmi: number;
  fmiMeaning: string;
  severity: 'CRITIQUE' | 'ALERTE' | 'INFO';
  liveValueSummary: string;
}

export const J1939_FMI_TABLE: Record<number, string> = {
  0: 'Données valides mais au-dessus de la plage normale (Critique)',
  1: 'Données valides mais en-dessous de la plage normale (Critique)',
  2: 'Données erratiques, intermittentes ou incorrectes',
  3: 'Tension supérieure à la normale / court-circuit au +Bat',
  4: 'Tension inférieure à la normale / court-circuit à la masse',
  5: 'Courant inférieur à la normale / circuit ouvert',
  6: 'Courant supérieur à la normale / court-circuit masse',
  7: 'Système mécanique ne répond pas ou hors réglage',
  9: 'Taux de mise à jour anormal (Timeout bus J1939)',
  11: 'Cause racine inconnue',
  12: 'Composant ou calculateur interne défaillant',
  14: 'Instructions spéciales (Derate couple moteur actif)',
  18: 'Données valides mais modérément basses',
  31: 'Condition existante / défaut actif détecté',
};

export const J1939_SPN_CATALOG: Record<number, { label: string; unit: string }> = {
  84: { label: 'Vitesse Véhicule (Wheel-Based Vehicle Speed)', unit: 'km/h' },
  91: { label: 'Position Pédale Accélérateur', unit: '%' },
  100: { label: 'Pression Huile Moteur', unit: 'bar / kPa' },
  102: { label: 'Pression Suralimentation Turbo (Boost)', unit: 'bar / kPa' },
  110: { label: 'Température Liquide de Refroidissement', unit: '°C' },
  157: { label: 'Pression Rail Injection (Common Rail)', unit: 'bar' },
  190: { label: 'Régime Moteur (RPM)', unit: 'tr/min' },
  1761: { label: 'Niveau Réservoir AdBlue / DEF (SCR)', unit: '%' },
  3226: { label: 'Capteur NOx Aval Catalyseur SCR', unit: 'ppm' },
  3246: { label: 'Température Gaz Échappement Aval DPF', unit: '°C' },
  4364: { label: 'Efficacité Conversion SCR / Système AdBlue', unit: '%' },
};

export const J1939_SAMPLE_FRAMES: Array<{ label: string; canIdHex: string; dataHex: string }> = [
  {
    label: 'DM1 — Défaut Pression Rail Basse (SPN 157 / FMI 1)',
    canIdHex: '18FECA00',
    dataHex: '04FF9D000101FFFF',
  },
  {
    label: 'DM1 — Capteur NOx Aval / SCR AdBlue (SPN 3226 / FMI 2)',
    canIdHex: '18FECA00',
    dataHex: '04FF9A0C0203FFFF',
  },
  {
    label: 'EEC1 — Régime Moteur 1450 RPM & Charge 72% (PGN 61444)',
    canIdHex: '0CF00400',
    dataHex: 'F0487D302DFFFF00',
  },
  {
    label: 'AT1T1I — Niveau Réservoir AdBlue 18% (PGN 65110 / SPN 1761)',
    canIdHex: '18FE563D',
    dataHex: '2D46FFFFFFFFFFFF',
  },
];

export function decodeJ1939CanFrame(canIdHex: string, dataHex: string): J1939DecodedFrame {
  const cleanId = canIdHex.replace(/[^0-9A-Fa-f]/g, '').padStart(8, '0').slice(-8);
  const cleanData = dataHex.replace(/[^0-9A-Fa-f]/g, '').padEnd(16, 'F').slice(0, 16);
  const idVal = parseInt(cleanId, 16) >>> 0;
  const pgnDec = (idVal >>> 8) & 0x3ffff;
  const pgnHex = pgnDec.toString(16).toUpperCase().padStart(4, '0');
  const sa = (idVal & 0xff).toString(16).toUpperCase().padStart(2, '0');

  const bytes = Array.from({ length: 8 }, (_, i) =>
    parseInt(cleanData.slice(i * 2, i * 2 + 2), 16)
  );

  // DM1 Active Diagnostic Trouble Codes (PGN 65226 / 0xFECA)
  if (pgnDec === 65226) {
    const spn = bytes[2] | (bytes[3] << 8) | ((bytes[4] & 0xe0) << 11);
    const fmi = bytes[4] & 0x1f;
    const spnInfo = J1939_SPN_CATALOG[spn] || { label: `Paramètre J1939 SPN ${spn}`, unit: '' };
    const fmiMeaning = J1939_FMI_TABLE[fmi] || `Mode défaillance FMI ${fmi}`;
    return {
      rawHex: `${cleanId}#${cleanData}`,
      pgnHex: `0x${pgnHex}`,
      pgnDec,
      pgnName: 'DM1 (Active Diagnostic Trouble Codes)',
      sourceAddress: `SA 0x${sa} (${sa === '00' ? 'ECU Moteur' : sa === '3D' ? 'Module SCR/AdBlue' : 'Boîtier PL'})`,
      spn,
      spnLabel: spnInfo.label,
      fmi,
      fmiMeaning,
      severity: fmi === 0 || fmi === 1 || fmi === 12 ? 'CRITIQUE' : 'ALERTE',
      liveValueSummary: `Défaut actif DTC J1939 : SPN ${spn} / FMI ${fmi} (OC ${bytes[5] & 0x7f})`,
    };
  }

  // EEC1 (PGN 61444 / 0xF004)
  if (pgnDec === 61444) {
    const rpm = Math.round(((bytes[4] << 8) | bytes[3]) * 0.125);
    const torquePct = bytes[2] !== 255 ? bytes[2] - 125 : 0;
    return {
      rawHex: `${cleanId}#${cleanData}`,
      pgnHex: `0x${pgnHex}`,
      pgnDec,
      pgnName: 'EEC1 (Electronic Engine Controller 1)',
      sourceAddress: `SA 0x${sa} (ECU Moteur)`,
      spn: 190,
      spnLabel: J1939_SPN_CATALOG[190].label,
      fmi: 31,
      fmiMeaning: 'Télémétrie temps réel valide',
      severity: 'INFO',
      liveValueSummary: `Régime ${rpm} tr/min · Couple réel ${torquePct}%`,
    };
  }

  // Aftertreatment 1 DEF Tank (PGN 65110 / 0xFE56)
  if (pgnDec === 65110) {
    const levelPct = Math.round(bytes[0] * 0.4);
    const tempC = bytes[1] !== 255 ? bytes[1] - 40 : 25;
    return {
      rawHex: `${cleanId}#${cleanData}`,
      pgnHex: `0x${pgnHex}`,
      pgnDec,
      pgnName: 'AT1T1I (Réservoir AdBlue / DEF)',
      sourceAddress: `SA 0x${sa} (Contrôleur SCR)`,
      spn: 1761,
      spnLabel: J1939_SPN_CATALOG[1761].label,
      fmi: levelPct < 15 ? 18 : 31,
      fmiMeaning: levelPct < 15 ? 'Niveau AdBlue bas — risque bridage couple' : 'Télémétrie SCR nominale',
      severity: levelPct < 15 ? 'ALERTE' : 'INFO',
      liveValueSummary: `Niveau AdBlue ${levelPct}% · Température DEF ${tempC}°C`,
    };
  }

  return {
    rawHex: `${cleanId}#${cleanData}`,
    pgnHex: `0x${pgnHex}`,
    pgnDec,
    pgnName: `PGN J1939 ${pgnDec}`,
    sourceAddress: `SA 0x${sa}`,
    spn: 110,
    spnLabel: `Trame générique PGN ${pgnDec}`,
    fmi: 31,
    fmiMeaning: 'Trame capturée sur bus CAN 250 kbps',
    severity: 'INFO',
    liveValueSummary: `Octets : ${cleanData.match(/.{2}/g)?.join(' ')}`,
  };
}

// =========================================================================
// TABLES CARTOGRAPHIQUES ECM TITANIUM LITE
// =========================================================================

export type StageTunePreset = 'STOCK' | 'STAGE1_ECO' | 'STAGE1_PERF' | 'STAGE1_TCU';

export interface MapTableDefinition {
  id: 'rail_pressure' | 'turbo_boost' | 'torque_limiter' | 'ignition_timing';
  title: string;
  unit: string;
  rpmAxis: number[];
  loadAxis: string[];
  baseMatrix: number[][];
  stageMultipliers: Record<StageTunePreset, number>;
}

export const ECM_TITANIUM_MAPS: MapTableDefinition[] = [
  {
    id: 'rail_pressure',
    title: 'Pression Rail Injection (Common Rail / DI)',
    unit: 'bar',
    rpmAxis: [1500, 2000, 2500, 3000, 3500, 4000, 4500],
    loadAxis: ['25%', '50%', '75%', '100%'],
    baseMatrix: [
      [520, 640, 780, 890, 960, 1020, 980],
      [760, 920, 1100, 1250, 1340, 1380, 1320],
      [980, 1220, 1420, 1580, 1680, 1740, 1690],
      [1150, 1440, 1680, 1820, 1950, 2000, 1940],
    ],
    stageMultipliers: {
      STOCK: 1.0,
      STAGE1_ECO: 1.03,
      STAGE1_PERF: 1.08,
      STAGE1_TCU: 1.09,
    },
  },
  {
    id: 'turbo_boost',
    title: 'Pression Suralimentation Turbo (Consigne)',
    unit: 'mbar',
    rpmAxis: [1500, 2000, 2500, 3000, 3500, 4000, 4500],
    loadAxis: ['25%', '50%', '75%', '100%'],
    baseMatrix: [
      [1120, 1240, 1320, 1360, 1380, 1350, 1290],
      [1280, 1490, 1650, 1740, 1760, 1710, 1620],
      [1420, 1740, 1980, 2120, 2180, 2100, 1980],
      [1580, 1960, 2240, 2390, 2440, 2360, 2210],
    ],
    stageMultipliers: {
      STOCK: 1.0,
      STAGE1_ECO: 1.04,
      STAGE1_PERF: 1.12,
      STAGE1_TCU: 1.14,
    },
  },
  {
    id: 'torque_limiter',
    title: 'Limiteur de Couple Moteur / Boîte (ECU + TCU)',
    unit: 'Nm',
    rpmAxis: [1500, 2000, 2500, 3000, 3500, 4000, 4500],
    loadAxis: ['25%', '50%', '75%', '100%'],
    baseMatrix: [
      [110, 130, 145, 150, 148, 140, 125],
      [185, 220, 245, 250, 242, 228, 205],
      [240, 295, 330, 335, 325, 302, 275],
      [270, 340, 380, 390, 375, 350, 315],
    ],
    stageMultipliers: {
      STOCK: 1.0,
      STAGE1_ECO: 1.09,
      STAGE1_PERF: 1.18,
      STAGE1_TCU: 1.24,
    },
  },
  {
    id: 'ignition_timing',
    title: 'Avance Injection / Allumage (Anti-Cliquetis & LSPI)',
    unit: '°v',
    rpmAxis: [1500, 2000, 2500, 3000, 3500, 4000, 4500],
    loadAxis: ['25%', '50%', '75%', '100%'],
    baseMatrix: [
      [14.0, 16.5, 19.0, 21.5, 23.0, 24.5, 26.0],
      [10.5, 13.0, 15.5, 18.0, 20.0, 21.5, 23.0],
      [6.5, 9.0, 11.5, 14.5, 17.0, 18.5, 20.0],
      [3.5, 5.5, 8.0, 11.5, 14.0, 16.0, 17.5],
    ],
    stageMultipliers: {
      STOCK: 1.0,
      STAGE1_ECO: 1.02,
      STAGE1_PERF: 1.05,
      STAGE1_TCU: 1.06,
    },
  },
];
