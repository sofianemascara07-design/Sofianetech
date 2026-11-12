import React, { useState } from 'react';
import { Vehicle, FlashStage } from '../types/automotive';
import { FLASH_STAGES, VEHICLE_PRESETS } from '../data/mockVehicles';
import { Zap, ShieldCheck, AlertTriangle, Download, Upload, CheckCircle2, Cpu, Sparkles, HardDrive, FileText } from 'lucide-react';

interface EcuFlashingProps {
  selectedVehicle: Vehicle;
  setSelectedVehicle?: (vehicle: Vehicle) => void;
  batteryVoltage: number;
  isConnected: boolean;
  connectionMode: string;
  onOpenConnectModal: () => void;
}

export const EcuFlashing: React.FC<EcuFlashingProps> = ({
  selectedVehicle,
  setSelectedVehicle,
  batteryVoltage,
  isConnected,
  connectionMode,
  onOpenConnectModal,
}) => {
  const [selectedStage, setSelectedStage] = useState<FlashStage>(FLASH_STAGES[0]);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashPhase, setFlashPhase] = useState('');
  const [flashComplete, setFlashComplete] = useState(false);
  const [flashLogs, setFlashLogs] = useState<string[]>([]);
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  // AI recommendations
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  // Simulated Map table values for visualization
  const mapRpmColumns = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500];
  const mapLoadRows = [
    { load: '20%', vals: [0.10, 0.15, 0.22, 0.30, 0.35, 0.40, 0.38, 0.30] },
    { load: '40%', vals: [0.25, 0.40, 0.65, 0.85, 0.95, 1.05, 1.00, 0.85] },
    { load: '60%', vals: [0.45, 0.80, 1.15, 1.35, 1.48, 1.55, 1.45, 1.25] },
    { load: '80%', vals: [0.60, 1.10, 1.45, 1.70, 1.85, 1.90, 1.78, 1.55] },
    { load: '100%', vals: [0.75, 1.30, 1.65, 1.95, 2.15, 2.20, 2.05, 1.80] },
  ];

  // Backup original dump
  const handleBackupDump = () => {
    setBackupDownloaded(true);
    const dumpContent = `AutoPro ECU Backup
Calculateur: ${selectedVehicle.ecuType}
Véhicule: ${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.year})
Motorisation: ${selectedVehicle.engine}
Date de lecture: ${new Date().toISOString()}
Protocole: ${selectedVehicle.protocol}
Taille: 2048 KB (Flash Micro TC1797)`;

    const blob = new Blob([dumpContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ECU_ORIGINAL_${selectedVehicle.brand}_${selectedVehicle.ecuType.replace(/\s+/g, '_')}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Launch flash process
  const handleStartFlash = () => {
    if (batteryVoltage < 12.5) {
      alert('Tension batterie insuffisante ! Veuillez brancher un chargeur stabilisateur 13.8V avant de flasher.');
      return;
    }

    setIsFlashing(true);
    setFlashProgress(0);
    setFlashComplete(false);
    setFlashLogs([`[00.0s] Démarrage de la séquence de flash pour ${selectedStage.name}...`]);

    const steps = [
      { p: 10, phase: 'Contrôle Seed-Key & Déverrouillage RSA Bootloader', log: 'SEED reçu : 0x7F21AA9C -> KEY calculée OK (Accès Niveau 27 accordé).' },
      { p: 25, phase: 'Effacement des secteurs Flash ROM (0x00010000 - 0x001FFFFF)', log: 'Secteurs mémoires effacés avec succès. Pas de bloc défectueux détecté.' },
      { p: 45, phase: 'Écriture cartographie injection & suralimentation...', log: 'Transfert paquets CAN UDS 0x36 TransferData (Bloc 1/8)...' },
      { p: 65, phase: 'Écriture maps avance allumage & limiteurs de couple...', log: 'Transfert paquets CAN UDS 0x36 TransferData (Bloc 5/8)...' },
      { p: 85, phase: 'Recalcul automatique Checksum RSA 2048 / CRC32', log: 'Checksum recalculé : CS_0x9B41E2 -> Intégrité vérifiée OK.' },
      { p: 95, phase: 'Verrouillage calculateur & Réinitialisation adaptation', log: 'Commande UDS 0x11 ECUReset (Hard Reset)...' },
      { p: 100, phase: 'Reprogrammation terminée avec succès !', log: 'Flash validé. Clé de contact sur OFF pendant 15s puis démarrage.' },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        const item = steps[currentStep];
        setFlashProgress(item.p);
        setFlashPhase(item.phase);
        setFlashLogs((prev) => [
          ...prev,
          `[+${(currentStep * 2 + 1.5).toFixed(1)}s] ${item.log}`,
        ]);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsFlashing(false);
        setFlashComplete(true);
      }
    }, 1200);
  };

  // Ask AI Tuning Expert
  const handleAskAiTuning = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/flash/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: selectedVehicle.brand,
          model: selectedVehicle.model,
          ecuType: selectedVehicle.ecuType,
          flashStage: selectedStage.name,
        }),
      });
      const data = await res.json();
      setAiAdvice(data.recommendation || 'Conseils indisponibles.');
    } catch {
      setAiAdvice('Erreur lors du calcul de la recommandation par l\'IA.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & ECU Info Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>Reprogrammation Cartographie &amp; Flash ECU Multimarque</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Calculateur cible : <strong className="text-cyan-400 font-mono">{selectedVehicle.ecuType}</strong> sur {selectedVehicle.brand} {selectedVehicle.model} ({selectedVehicle.engine}).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full md:w-auto">
          {setSelectedVehicle && (
            <select
              value={selectedVehicle.id}
              onChange={(e) => {
                const v = VEHICLE_PRESETS.find((p) => p.id === e.target.value);
                if (v) setSelectedVehicle(v);
              }}
              className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
            >
              {VEHICLE_PRESETS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} ({v.year})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleBackupDump}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer border border-slate-700 shrink-0"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Sauvegarder ROM Origine (.bin)</span>
          </button>
        </div>
      </div>

      {/* Safety Matrix Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
          batteryVoltage >= 12.8 ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
        }`}>
          {batteryVoltage >= 12.8 ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          <div>
            <span className="font-semibold block">Tension ({batteryVoltage.toFixed(1)}V)</span>
            <span className="text-[10px] text-slate-400">{batteryVoltage >= 12.8 ? 'Stabilisateur OK' : 'Tension trop basse'}</span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
          isConnected ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}>
          {isConnected ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          <div>
            <span className="font-semibold block">Liaison ({connectionMode.toUpperCase()})</span>
            <span className="text-[10px] text-slate-400">{isConnected ? 'Canal vérifié' : 'Non connecté'}</span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
          backupDownloaded ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
        }`}>
          {backupDownloaded ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />}
          <div>
            <span className="font-semibold block">Dump d'Origine (.bin)</span>
            <span className="text-[10px] text-slate-400">{backupDownloaded ? 'Sauvegardé sur disque' : 'Non encore extrait'}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 text-xs flex items-center gap-2.5 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <span className="font-semibold block">Contrôle Checksum RSA</span>
            <span className="text-[10px] text-cyan-400 font-mono">Calcul automatique ON</span>
          </div>
        </div>
      </div>

      {/* Stage Selection Cards */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Choisissez la Calibration Moteur / Solution Logicielle
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FLASH_STAGES.map((stage) => {
            const isSelected = selectedStage.id === stage.id;
            return (
              <div
                key={stage.id}
                onClick={() => setSelectedStage(stage)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900 border-amber-500 shadow-lg ring-1 ring-amber-500/50'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase bg-slate-800 text-amber-400 px-2 py-0.5 rounded">
                      {stage.badge}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{stage.hpGain} ch / +{stage.torqueGain} Nm
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1.5">{stage.name}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{stage.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Application :</span>
                  <span>{stage.recommendedFor}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calibration Visualizer: Interactive 2D Fuel & Boost Map Preview */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Matrice de Calibration Suralimentation Target (bar) - {selectedStage.name}</span>
            </h3>
            <span className="text-xs text-slate-400">
              Pression d'admission relative injectée dans la mémoire EEPROM flashée
            </span>
          </div>

          <div className="text-xs font-mono text-cyan-400 bg-slate-950 px-3 py-1 rounded border border-slate-800">
            Gain Pression Suralimentation : +{selectedStage.boostDeltaBar.toFixed(2)} bar
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-center border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-3 text-left">Charge / RPM</th>
                {mapRpmColumns.map((rpm) => (
                  <th key={rpm} className="py-2 px-2 text-slate-300">
                    {rpm}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapLoadRows.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-3 text-left font-semibold text-slate-400">{row.load}</td>
                  {row.vals.map((v, colIdx) => {
                    const adjusted = (v + selectedStage.boostDeltaBar).toFixed(2);
                    return (
                      <td
                        key={colIdx}
                        className={`py-2 px-2 tabular-nums ${
                          parseFloat(adjusted) > 2.0
                            ? 'text-amber-400 font-bold bg-amber-950/20'
                            : parseFloat(adjusted) > 1.4
                            ? 'text-cyan-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {adjusted}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Motoriste Advice Section */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">
              Analyse Ingénieur Motoriste IA pour {selectedVehicle.brand} {selectedVehicle.model}
            </h4>
          </div>

          <button
            onClick={handleAskAiTuning}
            disabled={aiLoading}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
            <span>{aiLoading ? 'Calcul des limites...' : 'Calculer Limites avec l\'IA'}</span>
          </button>
        </div>

        {aiAdvice ? (
          <div className="p-4 bg-slate-950 rounded-lg border border-amber-800/40 text-xs text-slate-300 whitespace-pre-line leading-relaxed font-sans">
            {aiAdvice}
          </div>
        ) : (
          <p className="text-xs text-slate-400 leading-relaxed">
            Consultez les recommandations de tolérance de couple boîte (Nm), de température d'échappement (EGT max 850°C) et les ajustements de timing pour ce bloc moteur.
          </p>
        )}
      </div>

      {/* Flashing Trigger & Progress Modal/Bar */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 block">Opération Prête :</span>
            <span className="text-base font-bold text-white">
              Flasher {selectedStage.name} dans {selectedVehicle.ecuType}
            </span>
          </div>

          <button
            onClick={handleStartFlash}
            disabled={isFlashing || !isConnected}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Upload className="w-4 h-4" />
            <span>{isFlashing ? 'Écriture Flash en cours...' : 'Injecter Cartographie (Écrire ECU)'}</span>
          </button>
        </div>

        {!isConnected && (
          <div className="text-xs text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Liaison requise : Veuillez connecter le smartphone à la tablette via Câble, WiFi ou Bluetooth avant de lancer l'écriture.
            </span>
          </div>
        )}

        {isFlashing && (
          <div className="p-4 bg-slate-950 rounded-lg border border-amber-500/50 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-amber-400 font-mono">{flashPhase}</span>
              <span className="font-mono text-slate-200 font-bold">{flashProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-2.5 transition-all duration-300"
                style={{ width: `${flashProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-rose-400 font-semibold animate-pulse">
              NE PAS COUPER LE CONTACT NI DÉBRANCHER LE CÂBLE PENDANT L'ÉCRITURE.
            </p>
          </div>
        )}

        {flashComplete && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-700/60 rounded-lg text-emerald-300 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-emerald-200 text-sm">
                Flash ECU Exécuté avec Succès !
              </span>
              Le calculateur moteur a validé le nouveau programme {selectedStage.name}. Coupez le contact pendant 15 secondes pour sauvegarder les adaptations EEPROM, puis redémarrez le véhicule.
            </div>
          </div>
        )}

        {flashLogs.length > 0 && (
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto space-y-1">
            {flashLogs.map((log, idx) => (
              <div key={idx} className="leading-tight">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
