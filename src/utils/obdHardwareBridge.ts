import { DtcCode } from '../types/automotive';

export type HardwareTransportType = 'none' | 'ble' | 'serial' | 'demo';

export interface ObdHardwareStatus {
  transport: HardwareTransportType;
  connected: boolean;
  ecuResponding: boolean;
  deviceName: string;
  adapterVersion: string;
  protocolName: string;
  vin: string | null;
  batteryVoltage: number | null;
  lastError: string | null;
  autoReconnectEnabled: boolean;
  reconnectCount: number;
  logs: string[];
}

export interface RealTelemetrySnapshot {
  rpm: number | null;
  speedKmh: number | null;
  coolantTempC: number | null;
  boostBar: number | null;
  mafGs: number | null;
  railPressureBar: number | null;
  batteryVoltage: number | null;
  supportedPidsHex: string | null;
}

// Minimal safe browser hardware types (avoids requiring @types/web-bluetooth / @types/w3c-web-serial)
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface BluetoothCharacteristicLike {
  uuid: string;
  properties: {
    read?: boolean;
    write?: boolean;
    writeWithoutResponse?: boolean;
    notify?: boolean;
    indicate?: boolean;
  };
  startNotifications(): Promise<BluetoothCharacteristicLike>;
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
}

interface BluetoothServiceLike {
  uuid: string;
  getCharacteristics(): Promise<BluetoothCharacteristicLike[]>;
}

interface BluetoothGattServerLike {
  connected: boolean;
  connect(): Promise<BluetoothGattServerLike>;
  disconnect(): void;
  getPrimaryServices(): Promise<BluetoothServiceLike[]>;
  getPrimaryService(uuid: string): Promise<BluetoothServiceLike>;
}

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: BluetoothGattServerLike;
  addEventListener(type: string, listener: () => void): void;
}

const KNOWN_BLE_OBD_SERVICES = [
  '0000fff0-0000-1000-8000-00805f9b34fb', // Vgate iCar Pro BLE, vLinker MC/FD/BM+, OBDCheck
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10, Viecar BLE, ELM327 BLE 4.0
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (OBDLink CX / STN BLE)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip / ISSC Transparent UART
  '000018f0-0000-1000-8000-00805f9b34fb', // Veepeak / BLE OBD2
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Star Micronics / generic UART OBD
];

// Common DTC French dictionary for instant real-vehicle translation
const COMMON_DTC_FR: Record<string, { system: string; desc: string; severity: DtcCode['severity'] }> = {
  P0100: { system: 'Admission / Débitmètre', desc: 'Débitmètre d’air massique (MAF) — panne de circuit', severity: 'high' },
  P0101: { system: 'Admission / Débitmètre', desc: 'Débitmètre d’air massique (MAF) — plage/performance hors tolérance', severity: 'high' },
  P0102: { system: 'Admission / Débitmètre', desc: 'Signal débitmètre d’air (MAF) trop bas (court-circuit masse / capteur HS)', severity: 'high' },
  P0106: { system: 'Suralimentation / MAP', desc: 'Capteur de pression absolue collecteur (MAP) — incohérence signal', severity: 'medium' },
  P0113: { system: 'Admission Air', desc: 'Sonde de température d’air d’admission (IAT) — signal haut / circuit ouvert', severity: 'medium' },
  P0115: { system: 'Refroidissement', desc: 'Sonde de température liquide de refroidissement (ECT) — défaut circuit', severity: 'high' },
  P0118: { system: 'Refroidissement', desc: 'Sonde de température eau moteur — valeur haute (circuit ouvert)', severity: 'high' },
  P0130: { system: 'Échappement / Lambda', desc: 'Sonde lambda amont (Banc 1 Capteur 1) — dysfonctionnement circuit', severity: 'medium' },
  P0171: { system: 'Carburation / Injection', desc: 'Mélange air/carburant trop pauvre (prise d’air ou pression essence faible)', severity: 'high' },
  P0172: { system: 'Carburation / Injection', desc: 'Mélange air/carburant trop riche (injecteur fuyard / sonde lambda)', severity: 'high' },
  P0191: { system: 'Injection Haute Pression', desc: 'Capteur pression rampe carburant (Rail) — plage/performance', severity: 'critical' },
  P0234: { system: 'Turbo / Suralimentation', desc: 'Condition de surpression turbo (géométrie variable / wastegate bloquée)', severity: 'critical' },
  P0299: { system: 'Turbo / Suralimentation', desc: 'Pression de suralimentation turbo insuffisante (fuite durite / électrovanne N75)', severity: 'high' },
  P0300: { system: 'Allumage / Combustion', desc: 'Ratés d’allumage aléatoires / multiples cylindres détectés', severity: 'critical' },
  P0301: { system: 'Allumage / Injection', desc: 'Ratés de combustion détectés sur le cylindre 1', severity: 'high' },
  P0302: { system: 'Allumage / Injection', desc: 'Ratés de combustion détectés sur le cylindre 2', severity: 'high' },
  P0303: { system: 'Allumage / Injection', desc: 'Ratés de combustion détectés sur le cylindre 3', severity: 'high' },
  P0304: { system: 'Allumage / Injection', desc: 'Ratés de combustion détectés sur le cylindre 4', severity: 'high' },
  P0335: { system: 'Synchronisation Moteur', desc: 'Capteur position vilebrequin (PMH) — absence ou défaut de signal', severity: 'critical' },
  P0340: { system: 'Synchronisation Moteur', desc: 'Capteur position arbre à cames (AAC) — panne circuit / calage', severity: 'high' },
  P0380: { system: 'Préchauffage Diesel', desc: 'Circuit bougies de préchauffage / relais défectueux', severity: 'medium' },
  P0401: { system: 'Dépollution / EGR', desc: 'Débit de recirculation des gaz d’échappement (vanne EGR) insuffisant', severity: 'medium' },
  P0404: { system: 'Dépollution / EGR', desc: 'Vanne EGR bloquée ou plage de fonctionnement incorrecte', severity: 'medium' },
  P0420: { system: 'Catalyseur', desc: 'Efficacité du catalyseur inférieure au seuil (Banc 1)', severity: 'medium' },
  P0500: { system: 'Transmission / ABS', desc: 'Capteur de vitesse véhicule (VSS) — défaut signal', severity: 'medium' },
  P0562: { system: 'Alimentation Électrique', desc: 'Tension batterie / alternateur trop faible', severity: 'high' },
  P0606: { system: 'Calculateur ECM', desc: 'Processeur calculateur moteur — défaut interne', severity: 'critical' },
  P2002: { system: 'FAP / DPF Diesel', desc: 'Filtre à particules (FAP) — efficacité inférieure au seuil / colmatage', severity: 'high' },
  P2279: { system: 'Admission Air', desc: 'Fuite détectée dans le circuit d’admission d’air après débitmètre', severity: 'high' },
  U0100: { system: 'Bus CAN / Réseau', desc: 'Perte de communication avec le calculateur moteur (ECM/PCM)', severity: 'critical' },
  U0121: { system: 'Bus CAN / Réseau', desc: 'Perte de communication avec le calculateur ABS/ESP', severity: 'high' },
  U0140: { system: 'Bus CAN / Réseau', desc: 'Perte de communication avec le boîtier habitacle (BCM/BSI)', severity: 'medium' },
};

function describeDtcFrench(code: string): { system: string; desc: string; severity: DtcCode['severity'] } {
  if (COMMON_DTC_FR[code]) return COMMON_DTC_FR[code];
  const prefix = code[0];
  if (prefix === 'P') {
    return {
      system: 'Groupe Motopropulseur (OBD-II)',
      desc: `Défaut calculateur moteur / transmission (${code}) lu directement depuis le véhicule`,
      severity: code.startsWith('P03') || code.startsWith('P02') ? 'high' : 'medium',
    };
  }
  if (prefix === 'C') {
    return {
      system: 'Châssis / ABS / Direction',
      desc: `Défaut châssis / freinage / direction (${code}) lu sur le bus véhicule`,
      severity: 'high',
    };
  }
  if (prefix === 'B') {
    return {
      system: 'Habitacle / BCM / Airbag',
      desc: `Défaut carrosserie / habitacle / sécurité (${code}) lu sur le véhicule`,
      severity: 'medium',
    };
  }
  return {
    system: 'Réseau Bus CAN (UDS)',
    desc: `Défaut de communication inter-calculateurs (${code}) lu sur le bus CAN`,
    severity: 'high',
  };
}

function decodeDtcBytes(b1: number, b2: number): string | null {
  if (b1 === 0 && b2 === 0) return null;
  const typeIdx = (b1 & 0xc0) >> 6;
  const types = ['P', 'C', 'B', 'U'];
  const secondDigit = (b1 & 0x30) >> 4;
  const thirdChar = (b1 & 0x0f).toString(16).toUpperCase();
  const fourthChar = ((b2 & 0xf0) >> 4).toString(16).toUpperCase();
  const fifthChar = (b2 & 0x0f).toString(16).toUpperCase();
  return `${types[typeIdx]}${secondDigit}${thirdChar}${fourthChar}${fifthChar}`;
}

function extractHexBytesAfterHeader(rawResponse: string, expectedServiceHex: string): number[] {
  const cleaned = rawResponse
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('SEARCHING') && !l.startsWith('BUS INIT') && !l.includes('NO DATA') && !l.includes('ERROR'));

  const bytes: number[] = [];
  for (const line of cleaned) {
    // Strip optional CAN frame prefix like "0:" or "7E8" if spaces present, or raw hex tokens
    let hexLine = line.replace(/^[0-9A-F]:/i, '').replace(/[^0-9A-Fa-f]/g, '');
    if (!hexLine) continue;
    // Find expected service byte (e.g., 41 for 01, 43 for 03, 47 for 07, 49 for 09)
    const upper = hexLine.toUpperCase();
    const idx = upper.indexOf(expectedServiceHex.toUpperCase());
    if (idx !== -1 && idx % 2 === 0) {
      hexLine = upper.slice(idx);
    }
    for (let i = 0; i + 1 < hexLine.length; i += 2) {
      bytes.push(parseInt(hexLine.slice(i, i + 2), 16));
    }
  }
  return bytes;
}

class ObdHardwareBridge {
  private status: ObdHardwareStatus = {
    transport: 'none',
    connected: false,
    ecuResponding: false,
    deviceName: '',
    adapterVersion: '',
    protocolName: '',
    vin: null,
    batteryVoltage: null,
    lastError: null,
    autoReconnectEnabled: true,
    reconnectCount: 0,
    logs: [
      'Pont matériel ELM327 prêt.',
      'Choisissez Bluetooth BLE (Android/PC), Câble USB WebSerial (PC) ou Mode Démo Atelier.',
    ],
  };

  private listeners = new Set<(status: ObdHardwareStatus) => void>();
  private commandMutex: Promise<unknown> = Promise.resolve();

  // Serial state
  private serialPort: SerialPortLike | null = null;
  private serialReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

  // BLE state
  private bleDevice: BluetoothDeviceLike | null = null;
  private bleWriteChar: BluetoothCharacteristicLike | null = null;
  private bleNotifyChar: BluetoothCharacteristicLike | null = null;
  private bleDisconnectingManually = false;
  private bleReconnecting = false;
  private hwKeepAliveInterval: ReturnType<typeof setInterval> | null = null;

  // Incoming chunk buffer for ELM327 '>' prompt
  private rxBuffer = '';
  private pendingResolve: ((resp: string) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  public subscribe(listener: (status: ObdHardwareStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus(): ObdHardwareStatus {
    return { ...this.status, logs: [...this.status.logs] };
  }

  public isRealHardwareConnected(): boolean {
    return this.status.connected && (this.status.transport === 'ble' || this.status.transport === 'serial');
  }

  public isWebBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && Boolean((navigator as unknown as { bluetooth?: unknown }).bluetooth);
  }

  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && Boolean((navigator as unknown as { serial?: unknown }).serial);
  }

  public setAutoReconnect(enabled: boolean) {
    this.status.autoReconnectEnabled = enabled;
    this.pushLog(
      enabled
        ? 'STABILITÉ : Reconnexion automatique BLE/ELM327 activée.'
        : 'STABILITÉ : Reconnexion automatique BLE désactivée.'
    );
  }

  private startHwKeepAlive() {
    this.stopHwKeepAlive();
    this.hwKeepAliveInterval = setInterval(() => {
      if (this.isRealHardwareConnected() && !this.pendingResolve) {
        void this.sendCommand('ATRV', 2000, false)
          .then((rv) => {
            const match = rv.match(/(\d+(?:[.,]\d+)?)/);
            if (match) {
              this.status.batteryVoltage = parseFloat(match[1].replace(',', '.'));
              this.emit();
            }
          })
          .catch(() => {
            // Silent idle keep-alive
          });
      }
    }, 25_000);
  }

  private stopHwKeepAlive() {
    if (this.hwKeepAliveInterval) {
      clearInterval(this.hwKeepAliveInterval);
      this.hwKeepAliveInterval = null;
    }
  }

  private emit() {
    const snap = this.getStatus();
    this.listeners.forEach((fn) => fn(snap));
  }

  private pushLog(msg: string) {
    const time = new Date().toLocaleTimeString();
    this.status.logs = [`[${time}] ${msg}`, ...this.status.logs.slice(0, 39)];
    this.emit();
  }

  private handleIncomingText(text: string) {
    this.rxBuffer += text;
    if (this.rxBuffer.includes('>') && this.pendingResolve) {
      const idx = this.rxBuffer.indexOf('>');
      const completeResponse = this.rxBuffer.slice(0, idx).replace(/\r/g, '\n').trim();
      this.rxBuffer = this.rxBuffer.slice(idx + 1);
      if (this.pendingTimer) {
        clearTimeout(this.pendingTimer);
        this.pendingTimer = null;
      }
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      this.pendingReject = null;
      resolve(completeResponse);
    }
  }

  private async sendCommandRaw(cmd: string, timeoutMs = 4000): Promise<string> {
    const run = async (): Promise<string> => {
      if (!this.isRealHardwareConnected()) {
        throw new Error('Aucun boîtier ELM327 physique connecté.');
      }

      this.rxBuffer = '';
      const payload = new TextEncoder().encode(`${cmd.trim()}\r`);

      const responsePromise = new Promise<string>((resolve, reject) => {
        this.pendingResolve = resolve;
        this.pendingReject = reject;
        this.pendingTimer = setTimeout(() => {
          const partial = this.rxBuffer.trim();
          this.pendingResolve = null;
          this.pendingReject = null;
          this.rxBuffer = '';
          if (partial) {
            resolve(partial);
          } else {
            reject(new Error(`Timeout (${timeoutMs}ms) sans réponse du boîtier pour "${cmd}"`));
          }
        }, timeoutMs);
      });

      if (this.status.transport === 'serial' && this.serialWriter) {
        await this.serialWriter.write(payload);
      } else if (this.status.transport === 'ble' && this.bleWriteChar) {
        if (this.bleWriteChar.properties.writeWithoutResponse && this.bleWriteChar.writeValueWithoutResponse) {
          await this.bleWriteChar.writeValueWithoutResponse(payload);
        } else {
          await this.bleWriteChar.writeValue(payload);
        }
      } else {
        throw new Error('Canal d’écriture matériel indisponible.');
      }

      return responsePromise;
    };

    const next = this.commandMutex.then(run, run);
    this.commandMutex = next.catch(() => undefined);
    return next;
  }

  public async sendCommand(cmd: string, timeoutMs = 4500, logExchange = false): Promise<string> {
    const resp = await this.sendCommandRaw(cmd, timeoutMs);
    if (logExchange) {
      this.pushLog(`> ${cmd}  ⇒  ${resp.replace(/\n+/g, ' | ') || '(vide)'}`);
    }
    return resp;
  }

  public activateDemoMode() {
    void this.disconnect(true);
    this.status = {
      ...this.status,
      transport: 'demo',
      connected: true,
      ecuResponding: true,
      deviceName: 'Simulateur Atelier AutoPro (Démo)',
      adapterVersion: 'SIM-ELM327 v2.2',
      protocolName: 'Simulation CAN 500k (Données fictives)',
      vin: null,
      batteryVoltage: 13.8,
      lastError: null,
      logs: [
        `[${new Date().toLocaleTimeString()}] Mode Démo Atelier activé (données simulées pour démonstration sans véhicule).`,
        ...this.status.logs.slice(0, 20),
      ],
    };
    this.emit();
  }

  public async disconnect(silent = false) {
    this.bleDisconnectingManually = true;
    this.stopHwKeepAlive();
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (this.pendingReject) {
      this.pendingReject(new Error('Connexion interrompue.'));
    }
    this.pendingResolve = null;
    this.pendingReject = null;
    this.rxBuffer = '';

    try {
      if (this.serialReader) {
        await this.serialReader.cancel().catch(() => undefined);
        this.serialReader.releaseLock();
        this.serialReader = null;
      }
      if (this.serialWriter) {
        this.serialWriter.releaseLock();
        this.serialWriter = null;
      }
      if (this.serialPort) {
        await this.serialPort.close().catch(() => undefined);
        this.serialPort = null;
      }
    } catch {
      // Ignore serial cleanup errors
    }

    try {
      if (this.bleDevice?.gatt?.connected) {
        this.bleDevice.gatt.disconnect();
      }
    } catch {
      // Ignore BLE cleanup errors
    }

    this.bleDevice = null;
    this.bleWriteChar = null;
    this.bleNotifyChar = null;
    this.bleDisconnectingManually = false;

    this.status = {
      ...this.status,
      transport: 'none',
      connected: false,
      ecuResponding: false,
      deviceName: '',
      adapterVersion: '',
      protocolName: '',
      vin: null,
    };

    if (!silent) {
      this.pushLog('Interface véhicule déconnectée.');
    } else {
      this.emit();
    }
  }

  public async connectBluetoothBLE(): Promise<ObdHardwareStatus> {
    if (!this.isWebBluetoothSupported()) {
      const errMsg =
        'Web Bluetooth non disponible sur ce navigateur. Utilisez Google Chrome sur Android ou PC (Safari/iOS bloque le Bluetooth web).';
      this.status.lastError = errMsg;
      this.pushLog(`ERREUR : ${errMsg}`);
      throw new Error(errMsg);
    }

    await this.disconnect(true);
    this.status.lastError = null;
    this.pushLog('Ouverture sélecteur Bluetooth BLE (vLinker / Vgate iCar Pro / ELM327 BLE 4.0)...');

    try {
      const navBt = (navigator as unknown as {
        bluetooth: {
          requestDevice(opts: {
            acceptAllDevices?: boolean;
            optionalServices?: string[];
          }): Promise<BluetoothDeviceLike>;
        };
      }).bluetooth;

      const device = await navBt.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_BLE_OBD_SERVICES,
      });

      this.bleDevice = device;
      const devName = device.name || 'Adaptateur OBD2 BLE';
      this.pushLog(`Périphérique sélectionné : ${devName}. Connexion GATT...`);

      device.addEventListener('gattserverdisconnected', () => {
        if (this.bleDisconnectingManually) return;
        if (this.status.transport === 'ble' && this.status.connected) {
          this.stopHwKeepAlive();
          this.status.connected = false;
          this.status.ecuResponding = false;
          this.pushLog('ALERTE : Périphérique Bluetooth BLE déconnecté.');
          if (this.status.autoReconnectEnabled && !this.bleReconnecting) {
            void this.attemptBleAutoReconnect(device);
          } else {
            this.status.transport = 'none';
            this.emit();
          }
        }
      });

      await this.setupBleGattCharacteristics(device);

      this.status.transport = 'ble';
      this.status.connected = true;
      this.status.deviceName = devName;

      await this.initializeElm327Sequence();
      this.startHwKeepAlive();
      return this.getStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur connexion Bluetooth BLE.';
      await this.disconnect(true);
      this.status.lastError = msg;
      this.pushLog(`ÉCHEC BLE : ${msg}`);
      throw new Error(msg);
    }
  }

  private async setupBleGattCharacteristics(device: BluetoothDeviceLike): Promise<void> {
    const devName = device.name || 'Adaptateur OBD2 BLE';
    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error('Serveur GATT introuvable sur ce boîtier Bluetooth.');
    }

    let foundWrite: BluetoothCharacteristicLike | null = null;
    let foundNotify: BluetoothCharacteristicLike | null = null;

    const servicesToScan: BluetoothServiceLike[] = [];
    try {
      const allServices = await server.getPrimaryServices();
      servicesToScan.push(...allServices);
    } catch {
      for (const uuid of KNOWN_BLE_OBD_SERVICES) {
        try {
          const svc = await server.getPrimaryService(uuid);
          servicesToScan.push(svc);
        } catch {
          // Service not present on this dongle
        }
      }
    }

    for (const service of servicesToScan) {
      try {
        const chars = await service.getCharacteristics();
        for (const ch of chars) {
          if (!foundNotify && (ch.properties.notify || ch.properties.indicate)) {
            foundNotify = ch;
          }
          if (!foundWrite && (ch.properties.writeWithoutResponse || ch.properties.write)) {
            foundWrite = ch;
          }
        }
        if (foundWrite && foundNotify) break;
      } catch {
        // Ignore protected/standard GAP/GATT services
      }
    }

    if (!foundWrite || !foundNotify) {
      throw new Error(
        `Service série BLE OBD2 introuvable sur "${devName}". Vérifiez qu’il s’agit bien d’un ELM327 BLE 4.0/5.0 (ex: Vgate iCar Pro BLE, vLinker) et non d’un ancien ELM327 Bluetooth 2.0 SPP classique.`
      );
    }

    this.bleWriteChar = foundWrite;
    this.bleNotifyChar = foundNotify;

    await foundNotify.startNotifications();
    foundNotify.addEventListener('characteristicvaluechanged', (ev: Event) => {
      const target = ev.target as unknown as { value?: DataView };
      if (target?.value) {
        const chunk = new TextDecoder().decode(target.value);
        this.handleIncomingText(chunk);
      }
    });
  }

  private async attemptBleAutoReconnect(device: BluetoothDeviceLike) {
    this.bleReconnecting = true;
    const maxAttempts = 3;
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (this.bleDisconnectingManually || this.bleDevice !== device) return;
        this.pushLog(`[STABILITÉ] Tentative de reconnexion auto BLE ${attempt}/${maxAttempts}...`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        if (this.bleDisconnectingManually || this.bleDevice !== device) return;
        try {
          await this.setupBleGattCharacteristics(device);
          this.status.transport = 'ble';
          this.status.connected = true;
          this.status.reconnectCount += 1;
          this.status.lastError = null;
          await this.sendCommand('ATE0', 2500, false);
          this.status.ecuResponding = true;
          this.startHwKeepAlive();
          this.pushLog(`SUCCÈS : Liaison BLE rétablie automatiquement (${this.status.deviceName}).`);
          return;
        } catch {
          // Retry next attempt
        }
      }
      this.status.transport = 'none';
      this.status.lastError = 'Reconnexion auto BLE impossible après 3 tentatives.';
      this.pushLog('ÉCHEC : Reconnexion auto BLE impossible après 3 tentatives.');
    } finally {
      this.bleReconnecting = false;
    }
  }

  public async connectUsbSerial(baudRate = 38400): Promise<ObdHardwareStatus> {
    if (!this.isWebSerialSupported()) {
      const errMsg =
        'Web Serial USB n’est pas supporté sur ce navigateur (sur téléphone Android, Chrome bloque Web Serial : utilisez un boîtier Bluetooth BLE 4.0 ou un PC Windows/Linux avec Chrome/Edge).';
      this.status.lastError = errMsg;
      this.pushLog(`ERREUR : ${errMsg}`);
      throw new Error(errMsg);
    }

    await this.disconnect(true);
    this.status.lastError = null;
    this.pushLog(`Ouverture port série USB ELM327 (${baudRate} bps)...`);

    try {
      const navSerial = (navigator as unknown as {
        serial: { requestPort(): Promise<SerialPortLike> };
      }).serial;

      const port = await navSerial.requestPort();
      await port.open({ baudRate });

      if (!port.readable || !port.writable) {
        throw new Error('Flux lecture/écriture USB indisponible sur ce port.');
      }

      this.serialPort = port;
      this.serialWriter = port.writable.getWriter();
      this.serialReader = port.readable.getReader();

      this.status.transport = 'serial';
      this.status.connected = true;
      this.status.deviceName = `Câble USB ELM327 (${baudRate} bps)`;

      // Start background reader loop
      void this.readSerialLoop();

      await this.initializeElm327Sequence();
      this.startHwKeepAlive();
      return this.getStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur port série USB.';
      await this.disconnect(true);
      this.status.lastError = msg;
      this.pushLog(`ÉCHEC USB : ${msg}`);
      throw new Error(msg);
    }
  }

  private async readSerialLoop() {
    const decoder = new TextDecoder();
    while (this.serialReader) {
      try {
        const { value, done } = await this.serialReader.read();
        if (done) break;
        if (value) {
          this.handleIncomingText(decoder.decode(value, { stream: true }));
        }
      } catch {
        break;
      }
    }
  }

  private async initializeElm327Sequence() {
    this.pushLog('Initialisation ELM327 (ATZ, ATE0, ATSP0)...');

    const atzResp = await this.sendCommand('ATZ', 5000, true);
    this.status.adapterVersion = atzResp.replace(/\n+/g, ' ').trim() || 'ELM327 Détecté';

    await this.sendCommand('ATE0', 2500, false);
    await this.sendCommand('ATL0', 2500, false);
    await this.sendCommand('ATS1', 2500, false); // keep spaces for reliable byte parsing
    await this.sendCommand('ATH0', 2500, false);
    await this.sendCommand('ATSP0', 3000, true);

    // Real battery voltage from OBD2 pin 16
    try {
      const rv = await this.sendCommand('ATRV', 2500, true);
      const match = rv.match(/(\d+(?:[.,]\d+)?)/);
      if (match) {
        this.status.batteryVoltage = parseFloat(match[1].replace(',', '.'));
      }
    } catch {
      // Optional on some clones
    }

    // Probe vehicle ECU via Mode 01 PID 00
    try {
      const pid00 = await this.sendCommand('0100', 8000, true);
      const upper = pid00.toUpperCase();
      if (upper.includes('41 00') || upper.includes('4100')) {
        this.status.ecuResponding = true;
        this.pushLog('SUCCÈS : Calculateur moteur véhicule en ligne (réponse 41 00 confirmée).');
      } else {
        this.status.ecuResponding = false;
        this.status.lastError =
          'Adaptateur ELM327 détecté, mais le calculateur voiture ne répond pas (NO DATA). Vérifiez que le CONTACT est MIS (ON) et que la prise OBD2 est bien enfoncée.';
        this.pushLog(`AVERTISSEMENT : ${this.status.lastError}`);
      }
    } catch {
      this.status.ecuResponding = false;
      this.status.lastError = 'Délai dépassé en attendant la réponse du calculateur véhicule (contact coupé ?).';
      this.pushLog(`AVERTISSEMENT : ${this.status.lastError}`);
    }

    // Read detected protocol description
    try {
      const dp = await this.sendCommand('ATDP', 2500, true);
      this.status.protocolName = dp.replace(/^AUTO,\s*/i, '').trim() || 'ISO 15765-4 CAN';
    } catch {
      this.status.protocolName = 'Auto (ATSP0)';
    }

    // Try reading real VIN (Mode 09 PID 02)
    if (this.status.ecuResponding) {
      this.status.vin = await this.readVin();
    }

    this.emit();
  }

  public async readBatteryVoltage(): Promise<number | null> {
    if (!this.isRealHardwareConnected()) return null;
    try {
      const rv = await this.sendCommand('ATRV', 2000, false);
      const match = rv.match(/(\d+(?:[.,]\d+)?)/);
      if (match) {
        const v = parseFloat(match[1].replace(',', '.'));
        this.status.batteryVoltage = v;
        this.emit();
        return v;
      }
    } catch {
      // Ignore transient
    }
    return null;
  }

  public async readVin(): Promise<string | null> {
    if (!this.isRealHardwareConnected()) return null;
    try {
      const raw = await this.sendCommand('0902', 5000, true);
      const bytes = extractHexBytesAfterHeader(raw, '49');
      // 49 02 01 [17 ASCII bytes]
      const asciiChars: string[] = [];
      let startIdx = 0;
      if (bytes[0] === 0x49 && bytes[1] === 0x02) {
        startIdx = bytes[2] === 0x01 ? 3 : 2;
      }
      for (let i = startIdx; i < bytes.length; i++) {
        const b = bytes[i];
        if (b >= 0x30 && b <= 0x5a) {
          asciiChars.push(String.fromCharCode(b));
        }
      }
      const vin = asciiChars.join('').slice(0, 17);
      if (vin.length >= 11) {
        this.pushLog(`VIN véhicule lu : ${vin}`);
        return vin;
      }
    } catch {
      // Many ECUs don't expose 0902 over generic ELM327
    }
    return null;
  }

  public async readCalibrationId(): Promise<string | null> {
    if (!this.isRealHardwareConnected()) return null;
    try {
      const raw = await this.sendCommand('0904', 5000, true);
      const bytes = extractHexBytesAfterHeader(raw, '49');
      const asciiChars: string[] = [];
      let startIdx = 0;
      if (bytes[0] === 0x49 && bytes[1] === 0x04) {
        startIdx = bytes[2] <= 0x08 ? 3 : 2;
      }
      for (let i = startIdx; i < bytes.length; i++) {
        const b = bytes[i];
        if ((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x2d || b === 0x5f || b === 0x2e) {
          asciiChars.push(String.fromCharCode(b));
        }
      }
      const calId = asciiChars.join('').trim();
      if (calId.length >= 4) {
        this.pushLog(`Calibration / Build ID ECU lu (0904) : ${calId}`);
        return calId;
      }
    } catch {
      // Many ECUs do not expose Mode 09 PID 04 over generic ELM327
    }
    return null;
  }

  public async readLiveTelemetry(): Promise<RealTelemetrySnapshot> {
    const snap: RealTelemetrySnapshot = {
      rpm: null,
      speedKmh: null,
      coolantTempC: null,
      boostBar: null,
      mafGs: null,
      railPressureBar: null,
      batteryVoltage: await this.readBatteryVoltage(),
      supportedPidsHex: null,
    };

    if (!this.isRealHardwareConnected()) return snap;

    // 010C: Engine RPM
    try {
      const r = await this.sendCommand('010C', 2000, false);
      const b = extractHexBytesAfterHeader(r, '41');
      if (b[0] === 0x41 && b[1] === 0x0c && b.length >= 4) {
        snap.rpm = Math.round(((b[2] * 256) + b[3]) / 4);
        this.status.ecuResponding = true;
      }
    } catch {
      // Ignore single PID miss
    }

    // 0105: Coolant Temp
    try {
      const r = await this.sendCommand('0105', 2000, false);
      const b = extractHexBytesAfterHeader(r, '41');
      if (b[0] === 0x41 && b[1] === 0x05 && b.length >= 3) {
        snap.coolantTempC = b[2] - 40;
      }
    } catch {
      // Ignore
    }

    // 010D: Vehicle Speed
    try {
      const r = await this.sendCommand('010D', 2000, false);
      const b = extractHexBytesAfterHeader(r, '41');
      if (b[0] === 0x41 && b[1] === 0x0d && b.length >= 3) {
        snap.speedKmh = b[2];
      }
    } catch {
      // Ignore
    }

    // 010B: Intake Manifold Absolute Pressure (kPa -> relative bar)
    try {
      const r = await this.sendCommand('010B', 2000, false);
      const b = extractHexBytesAfterHeader(r, '41');
      if (b[0] === 0x41 && b[1] === 0x0b && b.length >= 3) {
        snap.boostBar = parseFloat(((b[2] - 101) / 100).toFixed(2));
      }
    } catch {
      // Ignore
    }

    // 0110: MAF Air Flow (g/s)
    try {
      const r = await this.sendCommand('0110', 2000, false);
      const b = extractHexBytesAfterHeader(r, '41');
      if (b[0] === 0x41 && b[1] === 0x10 && b.length >= 4) {
        snap.mafGs = parseFloat((((b[2] * 256) + b[3]) / 100).toFixed(1));
      }
    } catch {
      // Ignore
    }

    // 0123: Fuel Rail Gauge Pressure (diesel / direct injection)
    try {
      const r = await this.sendCommand('0123', 2000, false);
      const b = extractHexBytesAfterHeader(r, '41');
      if (b[0] === 0x41 && b[1] === 0x23 && b.length >= 4) {
        snap.railPressureBar = Math.round((((b[2] * 256) + b[3]) * 10) / 100);
      }
    } catch {
      // Ignore
    }

    return snap;
  }

  public async readDtcCodes(): Promise<{ dtcs: DtcCode[]; ecuResponded: boolean; rawResponses: string[] }> {
    if (!this.isRealHardwareConnected()) {
      throw new Error('Aucun adaptateur réel connecté.');
    }

    const found = new Map<string, DtcCode>();
    const rawResponses: string[] = [];
    let ecuResponded = false;

    const scanMode = async (modeCmd: '03' | '07', expectedRespHex: '43' | '47', statusLabel: DtcCode['status']) => {
      try {
        const raw = await this.sendCommand(modeCmd, 6000, true);
        rawResponses.push(`${modeCmd}: ${raw}`);
        const upper = raw.toUpperCase();
        if (upper.includes('43') || upper.includes('47')) {
          ecuResponded = true;
        }
        const bytes = extractHexBytesAfterHeader(raw, expectedRespHex);
        // After 43 (or 43 <count> on CAN ISO15765), pairs of bytes encode DTCs
        let idx = bytes[0] === parseInt(expectedRespHex, 16) ? 1 : 0;
        // On CAN ISO 15765-4, byte after 43/47 can be DTC count if odd number of remaining bytes
        if (bytes.length - idx > 1 && (bytes.length - idx) % 2 === 1) {
          idx += 1;
        }
        for (let i = idx; i + 1 < bytes.length; i += 2) {
          const code = decodeDtcBytes(bytes[i], bytes[i + 1]);
          if (code && !found.has(code)) {
            const info = describeDtcFrench(code);
            found.set(code, {
              code,
              system: info.system,
              descriptionFr: info.desc,
              severity: info.severity,
              status: statusLabel,
            });
          }
        }
      } catch (err) {
        rawResponses.push(`${modeCmd}: ${err instanceof Error ? err.message : 'Erreur'}`);
      }
    };

    await scanMode('03', '43', 'Actif');
    await scanMode('07', '47', 'Fugitif');

    this.status.ecuResponding = ecuResponded || this.status.ecuResponding;
    this.emit();

    return {
      dtcs: Array.from(found.values()),
      ecuResponded,
      rawResponses,
    };
  }

  public async clearDtcCodes(): Promise<{ success: boolean; rawResponse: string }> {
    if (!this.isRealHardwareConnected()) {
      throw new Error('Aucun adaptateur réel connecté.');
    }
    const raw = await this.sendCommand('04', 6000, true);
    const upper = raw.toUpperCase();
    const ok = upper.includes('44') || !upper.includes('ERROR');
    return { success: ok, rawResponse: raw };
  }
}

export const obdHardwareBridge = new ObdHardwareBridge();
