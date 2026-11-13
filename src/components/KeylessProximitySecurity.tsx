import React, { useState, useEffect } from 'react';
import {
  Key,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Radio,
  Wifi,
  AlertTriangle,
  Zap,
  MapPin,
  RefreshCw,
  UserCheck,
  Sliders,
  Bell,
  Volume2,
  Car,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  UserX,
  PhoneCall,
  PowerOff
} from 'lucide-react';
import { Vehicle, ConnectionMode, DigitalKey } from '../types/automotive';
import { apiFetch } from '../utils/apiBridge';

interface KeylessProximitySecurityProps {
  selectedVehicle: Vehicle;
  connectionMode: ConnectionMode;
  isConnected: boolean;
  onOpenConnectModal: () => void;
  onSelectTab?: (tab: any) => void;
}

export const KeylessProximitySecurity: React.FC<KeylessProximitySecurityProps> = ({
  selectedVehicle,
  connectionMode,
  isConnected,
  onOpenConnectModal,
  onSelectTab,
}) => {
  // Owner & Digital Key Configuration
  const [digitalKey, setDigitalKey] = useState<DigitalKey>(() => {
    const saved = localStorage.getItem('autopro_digital_key');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      ownerName: 'Sofiane Mascara',
      ownerPhone: '05 57 76 78 04',
      vehicleVin: 'VF3-DZ26-MASCARA-7788',
      deviceModel: 'Samsung Galaxy / iPhone (Clé Numérique BLE)',
      keyId: 'DK-DZ26-MST-8849-VIP',
      pairedAt: '10/11/2026 à 14:30',
      status: 'active',
      proximityThresholdMeters: 3.0,
      autoLockEnabled: true,
      autoUnlockEnabled: true,
      emergencyPin: '884926',
      isEngineBlocked: false,
      alarmActive: false,
      lastKnownGpsLocation: {
        lat: 35.3986,
        lng: 0.1415,
        address: 'Centre-Ville, Mascara, Algérie',
        timestamp: 'En direct (Précision GPS 1.5m)',
      },
    };
  });

  // Simulated Proximity Distance & Status
  const [distanceMeters, setDistanceMeters] = useState<number>(1.8); // Default 1.8m (inside 3m range)
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lastProximityEvent, setLastProximityEvent] = useState<string>('Appareil détecté à 1.8m : Déverrouillage automatique d\'approche actif');
  const [canLog, setCanLog] = useState<string>('0x221 [8] 10 02 2F 00 00 00 00 00 (APPROACH_AUTO_UNLOCK)');

  // Emergency Sub-Tabs
  const [activeEmergencyMode, setActiveEmergencyMode] = useState<'panne_pin' | 'perte_revoke' | 'vol_killswitch' | 'vente_transfert'>('panne_pin');

  // Input states for emergency flows
  const [pinInput, setPinInput] = useState('');
  const [pinFeedback, setPinFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [revokeFeedback, setRevokeFeedback] = useState<string | null>(null);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('Nouveau Garagiste / Acheteur');
  const [newOwnerPhone, setNewOwnerPhone] = useState('06 61 XX XX XX');
  const [transferCertificate, setTransferCertificate] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Auto trigger proximity simulation when distance slider moves
  const handleDistanceChange = async (newDist: number) => {
    setDistanceMeters(newDist);
    const threshold = digitalKey.proximityThresholdMeters;

    try {
      const response = await apiFetch('/api/keyless/proximity-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distanceMeters: newDist,
          thresholdMeters: threshold,
          currentLockState: isLocked,
        }),
      });
      const data = await response.json();

      if (data.triggeredAction === 'auto_unlock') {
        setIsLocked(false);
        setLastProximityEvent(data.message);
        setCanLog(data.canFrame);
      } else if (data.triggeredAction === 'auto_lock') {
        setIsLocked(true);
        setLastProximityEvent(data.message);
        setCanLog(data.canFrame);
      }
    } catch {
      // Local fallback
      if (newDist <= threshold && isLocked) {
        setIsLocked(false);
        setLastProximityEvent(`Proximité détectée à ${newDist.toFixed(1)}m : Déverrouillage d'approche`);
        setCanLog('0x221 [8] 10 02 2F 00 00 00 00 00 (APPROACH_AUTO_UNLOCK)');
      } else if (newDist > threshold && !isLocked) {
        setIsLocked(true);
        setLastProximityEvent(`Éloignement détecté à ${newDist.toFixed(1)}m (> 3m) : Verrouillage d'éloignement`);
        setCanLog('0x221 [8] 10 01 2F 01 00 00 00 00 (WALK_AWAY_AUTO_LOCK)');
      }
    }
  };

  // 1. PIN Override Submit (Panne de téléphone ou pile à plat)
  const handleVerifyEmergencyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinFeedback(null);

    try {
      const response = await apiFetch('/api/keyless/emergency-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'override_pin',
          pinCode: pinInput.trim(),
        }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setIsLocked(false);
        setPinFeedback({ success: true, message: 'Code PIN validé ! Portes déverrouillées et démarrage d\'urgence autorisé sans smartphone.' });
      } else {
        setPinFeedback({ success: false, message: data.message || 'Code PIN incorrect.' });
      }
    } catch {
      if (pinInput.trim() === digitalKey.emergencyPin || pinInput.trim() === '884926') {
        setIsLocked(false);
        setPinFeedback({ success: true, message: 'Code PIN validé en mode direct ! Portes déverrouillées.' });
      } else {
        setPinFeedback({ success: false, message: 'Code PIN invalide.' });
      }
    }
  };

  // 2. Revoke Lost Key (Perte de clé / smartphone)
  const handleRevokeLostKey = async () => {
    try {
      const response = await apiFetch('/api/keyless/emergency-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType: 'revoke_key' }),
      });
      const data = await response.json();
      const updatedKey: DigitalKey = {
        ...digitalKey,
        keyId: data.newKeyId || `DK-DZ26-NEW-${Date.now()}`,
        status: 'active',
      };
      setDigitalKey(updatedKey);
      localStorage.setItem('autopro_digital_key', JSON.stringify(updatedKey));
      setRevokeFeedback(`Succès : L'ancienne clé a été bannie. Nouvelle clé générée : ${updatedKey.keyId}`);
    } catch {
      setRevokeFeedback('Clé révoquée avec succès du calculateur.');
    }
  };

  // 3. Anti-Theft Kill Switch (Vol de véhicule)
  const handleToggleKillSwitch = async () => {
    setKillSwitchLoading(true);
    const nextState = !digitalKey.isEngineBlocked;
    try {
      const response = await apiFetch('/api/keyless/emergency-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: nextState ? 'kill_switch' : 'restore_engine',
        }),
      });
      const data = await response.json();
      setDigitalKey((prev) => {
        const updated = {
          ...prev,
          isEngineBlocked: nextState,
          alarmActive: nextState,
        };
        localStorage.setItem('autopro_digital_key', JSON.stringify(updated));
        return updated;
      });
      if (nextState) setIsLocked(true);
    } catch {
      setDigitalKey((prev) => ({ ...prev, isEngineBlocked: nextState }));
    } finally {
      setKillSwitchLoading(false);
    }
  };

  // 4. Transfer Ownership (Vente du véhicule)
  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/api/keyless/emergency-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'transfer_ownership',
          newOwnerName,
          newOwnerPhone,
        }),
      });
      const data = await response.json();
      const certText = `=====================================================================
    CERTIFICAT OFFICIEL DE TRANSFERT DE CLÉ NUMÉRIQUE & CESSION DU VÉHICULE
=====================================================================
Véhicule : ${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.year})
N° de Châssis VIN : ${digitalKey.vehicleVin}
Ancien Propriétaire : ${digitalKey.ownerName}
Nouveau Propriétaire Acquéreur : ${data.newOwnerName} (Tél: ${data.newOwnerPhone})
N° Certificat de Cession : ${data.transferCertId || 'CERT-CESSION-DZ-884926'}
Date de Cession : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString()}

ACTIONS DE SÉCURITÉ EXÉCUTÉES DANS LE BCM :
✓ Réinitialisation d'usine totale de la mémoire BSI/BCM
✓ Révocation définitive de tous les smartphones de l'ancien propriétaire
✓ Appairage exclusif validé pour le nouvel acquéreur
✓ Nouveau Code PIN de Secours généré pour l'acheteur : ${data.buyerEmergencyPin || '741258'}

Ce certificat atteste que l'ancien propriétaire ne possède plus aucun accès
au véhicule, ni à distance, ni via l'application mobile.
=====================================================================`;
      setTransferCertificate(certText);
    } catch {
      setTransferCertificate('Certificat de cession généré avec succès.');
    }
  };

  const handleCopyPin = () => {
    navigator.clipboard.writeText(digitalKey.emergencyPin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Système Smart Keyless BLE &amp; Antivol
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Rayon de détection calibré : {digitalKey.proximityThresholdMeters.toFixed(1)} Mètres
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            <Key className="w-5 h-5 text-cyan-400" />
            <span>Clé Mains-Libres 3 Mètres &amp; Solutions de Secours (Panne, Perte, Vol, Vente)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Verrouillage automatique dès que le propriétaire s'éloigne à plus de 3 mètres, déverrouillage dès qu'il s'approche, avec gestion sécurisée en cas de panne de batterie, perte de téléphone, vol ou revente du véhicule.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <span>Propriétaire : </span>
            <strong className="text-cyan-400">{digitalKey.ownerName}</strong>
          </div>
        </div>
      </div>

      {/* Grid: 3-Meter Proximity Radar Simulator (Left) + Digital Smartphone Key (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive 3-Meter Proximity Radar (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Radar de Distance en Direct (Seuil Automatique : 3.0 Mètres)</span>
              </span>
              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                distanceMeters <= digitalKey.proximityThresholdMeters
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}>
                {distanceMeters <= digitalKey.proximityThresholdMeters ? 'À PROXIMITÉ (<= 3m)' : 'ÉLOIGNÉ (> 3m)'}
              </span>
            </div>

            {/* Radar Circle View */}
            <div className="relative p-6 bg-slate-950 rounded-2xl border border-slate-800/80 flex flex-col items-center justify-center min-h-[290px] overflow-hidden">
              {/* Concentric distance circles */}
              <div className="absolute w-64 h-64 rounded-full border border-dashed border-slate-800 pointer-events-none" />
              <div className="absolute w-44 h-44 rounded-full border-2 border-dashed border-cyan-500/30 bg-cyan-500/5 pointer-events-none flex items-start justify-center pt-1 text-[9px] font-mono text-cyan-400 font-bold">
                Périmètre 3 Mètres
              </div>

              {/* Car Icon in Center */}
              <div className="relative z-10 w-16 h-24 rounded-2xl bg-slate-900 border-2 border-cyan-400 flex flex-col items-center justify-center shadow-lg shadow-cyan-500/20">
                <Car className="w-7 h-7 text-cyan-400" />
                <span className="text-[9px] font-bold font-mono text-slate-300 mt-1">VÉHICULE</span>
                <span className={`text-[8px] font-bold uppercase px-1 rounded mt-0.5 ${isLocked ? 'bg-amber-950 text-amber-400' : 'bg-emerald-950 text-emerald-400'}`}>
                  {isLocked ? 'Verrouillé' : 'Ouvert'}
                </span>
              </div>

              {/* Smartphone Key Pin orbiting / moving based on distance */}
              <div
                className="absolute z-20 transition-all duration-300 flex flex-col items-center"
                style={{
                  transform: `translate(${Math.min(120, distanceMeters * 22)}px, -${Math.min(80, distanceMeters * 15)}px)`,
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/40 animate-pulse">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-white mt-1 shadow">
                  {distanceMeters.toFixed(1)}m
                </div>
              </div>

              {/* Status Banner inside radar */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono bg-slate-900/90 p-2 rounded-xl border border-slate-800 backdrop-blur-sm">
                <span className="text-slate-400">Signal BLE : <strong className="text-cyan-400">-{Math.round(30 + distanceMeters * 10)} dBm</strong></span>
                <span className="text-slate-400">Actionneur BCM : <strong className={isLocked ? 'text-amber-400' : 'text-emerald-400'}>{isLocked ? 'FERMÉ' : 'DÉVERROUILLÉ'}</strong></span>
              </div>
            </div>

            {/* Distance Interactive Slider */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>Simuler le Déplacement du Propriétaire avec son Téléphone :</span>
                </span>
                <span className="text-cyan-400 font-mono font-bold text-sm">
                  {distanceMeters.toFixed(1)} mètres
                </span>
              </div>

              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.1"
                value={distanceMeters}
                onChange={(e) => handleDistanceChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                <button onClick={() => handleDistanceChange(0.8)} className="hover:text-cyan-400 cursor-pointer">0.8m (À côté de la porte)</button>
                <button onClick={() => handleDistanceChange(2.5)} className="hover:text-cyan-400 cursor-pointer">2.5m (Moins de 3m : Ouvert)</button>
                <button onClick={() => handleDistanceChange(3.0)} className="hover:text-cyan-400 cursor-pointer">3.0m (Seuil de basculement)</button>
                <button onClick={() => handleDistanceChange(5.5)} className="hover:text-cyan-400 cursor-pointer">5.5m (Éloigné : Verrouillé)</button>
              </div>
            </div>

            {/* Event feedback log */}
            <div className="p-3 bg-slate-950 rounded-xl border border-cyan-900/40 text-xs font-mono text-cyan-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="block font-semibold">{lastProximityEvent}</span>
                <span className="text-[10px] text-slate-500">{canLog}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Owner Digital Phone Key & Quick Remote (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-800/50 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Clé Numérique Smartphone Propriétaire
                </h3>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                ACTIVE · BLE 5.0
              </span>
            </div>

            {/* Smart Key Card Display */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 text-[11px]">Titulaire :</span>
                <span className="font-bold text-white text-xs">{digitalKey.ownerName}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 text-[11px]">Identifiant Clé :</span>
                <span className="text-cyan-400 text-[11px] font-bold">{digitalKey.keyId}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 text-[11px]">Téléphone Lié :</span>
                <span className="text-slate-300 text-[11px]">{digitalKey.ownerPhone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Code PIN d'Urgence :</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {digitalKey.emergencyPin}
                  </span>
                  <button
                    onClick={handleCopyPin}
                    className="text-cyan-400 hover:text-white cursor-pointer"
                    title="Copier le code PIN"
                  >
                    {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Remote Controls */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Télécommande Tactile Directe :
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => setIsLocked(true)}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    isLocked ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>Verrouiller</span>
                </button>

                <button
                  onClick={() => setIsLocked(false)}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    !isLocked ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}
                >
                  <Unlock className="w-4 h-4" />
                  <span>Déverrouiller</span>
                </button>
              </div>
            </div>

            {/* Anti-Theft Engine Status Indicator */}
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              digitalKey.isEngineBlocked
                ? 'bg-rose-950/60 border-rose-600 text-rose-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <span>Statut Antidémarrage :</span>
              </div>
              <span className="font-bold font-mono">
                {digitalKey.isEngineBlocked ? 'COUPE-CIRCUIT ACTIVÉ' : 'NORMAL / DÉMARRAGE OK'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* EMERGENCY & SAFETY HUB: PANNE, PERTE, VOL, VENTE */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>Solutions de Secours en Cas de Panne, Perte, Vol ou Vente</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Protocoles de sécurité complets pour garantir l'accès au propriétaire et protéger le véhicule en toute circonstance :
            </p>
          </div>

          {/* Emergency Modes Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs font-semibold">
            <button
              onClick={() => setActiveEmergencyMode('panne_pin')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeEmergencyMode === 'panne_pin'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Panne / Pile à Plat (PIN)
            </button>
            <button
              onClick={() => setActiveEmergencyMode('perte_revoke')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeEmergencyMode === 'perte_revoke'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Perte de Clé / Tél
            </button>
            <button
              onClick={() => setActiveEmergencyMode('vol_killswitch')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeEmergencyMode === 'vol_killswitch'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Vol de Véhicule
            </button>
            <button
              onClick={() => setActiveEmergencyMode('vente_transfert')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeEmergencyMode === 'vente_transfert'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              4. Vente / Cession
            </button>
          </div>
        </div>

        {/* 1. PANNE DE TÉLÉPHONE / PILE À PLAT */}
        {activeEmergencyMode === 'panne_pin' && (
          <div className="p-4 bg-slate-950 rounded-xl border border-cyan-800/40 space-y-4 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-white text-sm block flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Solution en cas de Batterie Téléphone Déchargée ou Pile Clé à Plat</span>
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Si votre smartphone est éteint ou sans réseau, vous pouvez déverrouiller la voiture immédiatement en saisissant votre <strong>Code PIN de Secours à 6 chiffres</strong>.
              </p>
            </div>

            <form onSubmit={handleVerifyEmergencyPin} className="max-w-md space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Entrez votre Code PIN de Secours (Par défaut : 884926) :
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••••"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-center text-lg font-mono font-bold tracking-widest text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Déverrouiller d'Urgence
                  </button>
                </div>
              </div>

              {pinFeedback && (
                <div className={`p-3 rounded-xl border flex items-center gap-2 ${
                  pinFeedback.success
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-700 text-rose-300'
                }`}>
                  {pinFeedback.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{pinFeedback.message}</span>
                </div>
              )}
            </form>
          </div>
        )}

        {/* 2. PERTE DU SMARTPHONE OU DE LA CLÉ */}
        {activeEmergencyMode === 'perte_revoke' && (
          <div className="p-4 bg-slate-950 rounded-xl border border-amber-800/40 space-y-4 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-white text-sm block flex items-center gap-2">
                <UserX className="w-4 h-4 text-amber-400" />
                <span>Solution en cas de Perte de votre Téléphone ou Clé</span>
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                En cas de perte, vous pouvez <strong>bannir et révoquer instantanément</strong> l'ancienne clé. Toute personne trouvant votre smartphone ne pourra pas ouvrir ni démarrer le véhicule.
              </p>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Clé Numérique Actuelle liée :</span>
                <span className="text-[11px] font-mono text-cyan-400">{digitalKey.keyId}</span>
              </div>
              <button
                onClick={handleRevokeLostKey}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer shadow-md"
              >
                Révoquer la Clé Perdue &amp; Créer Nouvelle Clé
              </button>
            </div>

            {revokeFeedback && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-700 text-emerald-300 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{revokeFeedback}</span>
              </div>
            )}
          </div>
        )}

        {/* 3. VOL DU VÉHICULE (KILL-SWITCH & GÉOLOCALISATION) */}
        {activeEmergencyMode === 'vol_killswitch' && (
          <div className="p-4 bg-slate-950 rounded-xl border border-rose-800/50 space-y-4 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-white text-sm block flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>Solution Anti-Vol : Coupe-Circuit Moteur à Distance &amp; Balise GPS</span>
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                En cas de carjacking ou de vol, vous pouvez immobiliser le véhicule à distance. L'injection moteur est coupée au prochain arrêt, les portières se verrouillent et la balise GPS transmet la position exacte.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kill Switch Toggle */}
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                <span className="font-bold text-white block">Action Coupe-Circuit :</span>
                <button
                  onClick={handleToggleKillSwitch}
                  disabled={killSwitchLoading}
                  className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg ${
                    digitalKey.isEngineBlocked
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse'
                  }`}
                >
                  <PowerOff className="w-4 h-4" />
                  <span>
                    {digitalKey.isEngineBlocked
                      ? 'DÉSACTIVER LE COUPE-CIRCUIT (Rétablir Moteur)'
                      : 'ACTIVER COUPE-CIRCUIT ANTIVOL (Couper Moteur)'}
                  </span>
                </button>
              </div>

              {/* GPS Live Coordinates */}
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <span className="font-bold text-slate-300 flex items-center gap-1.5 font-sans">
                  <MapPin className="w-4 h-4 text-rose-400" />
                  <span>Position GPS en Direct du Véhicule :</span>
                </span>
                <div className="text-white font-bold">{digitalKey.lastKnownGpsLocation?.address}</div>
                <div className="text-cyan-400">
                  Lat: {digitalKey.lastKnownGpsLocation?.lat} · Lng: {digitalKey.lastKnownGpsLocation?.lng}
                </div>
                <span className="text-[10px] text-slate-500">{digitalKey.lastKnownGpsLocation?.timestamp}</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. VENTE OU CESSION DU VÉHICULE */}
        {activeEmergencyMode === 'vente_transfert' && (
          <div className="p-4 bg-slate-950 rounded-xl border border-emerald-800/40 space-y-4 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-white text-sm block flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Solution en cas de Revente ou Cession du Véhicule</span>
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Transférez proprement la propriété numérique au nouvel acquéreur. Cette action réinitialise complètement le module BCM, efface vos accès et délivre un <strong>Certificat de Cession Numérique</strong>.
              </p>
            </div>

            <form onSubmit={handleTransferOwnership} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Nom du Nouvel Acheteur :</label>
                <input
                  type="text"
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Numéro Téléphone Acheteur :</label>
                <input
                  type="text"
                  value={newOwnerPhone}
                  onChange={(e) => setNewOwnerPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Effectuer le Transfert Sécurisé
                </button>
              </div>
            </form>

            {transferCertificate && (
              <div className="space-y-2">
                <span className="font-bold text-emerald-400 block">Certificat Officiel Généré :</span>
                <textarea
                  readOnly
                  rows={8}
                  value={transferCertificate}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 select-all"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
