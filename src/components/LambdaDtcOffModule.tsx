import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Upload,
  Download,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Lock,
  Flame,
  Copy,
  Check,
} from 'lucide-react';
import {
  EcuDetectionResult,
  LambdaDtcOffResult,
  inspectEcuBinary,
  applyLambdaAndDtcOff,
  createWorkshopSampleEcuBinary,
} from '../utils/ecuBinaryProcessor';

export const LambdaDtcOffModule: React.FC = () => {
  const [originalBytes, setOriginalBytes] = useState<Uint8Array | null>(null);
  const [detection, setDetection] = useState<EcuDetectionResult | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  // Patch options
  const [lambdaRearOff, setLambdaRearOff] = useState<boolean>(true);
  const [catEfficiencyOff, setCatEfficiencyOff] = useState<boolean>(true);
  const [manualDtcEnabled, setManualDtcEnabled] = useState<boolean>(false);
  const [manualDtcInput, setManualDtcInput] = useState<string>('P0136, P0137, P0138, P0140, P0141, P0420');

  // Output result & Checksum mandatory acknowledgement
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<LambdaDtcOffResult | null>(null);
  const [checksumWarningAck, setChecksumWarningAck] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const loadBufferForInspection = async (buffer: ArrayBuffer, fileName: string) => {
    setIsInspecting(true);
    setProcessResult(null);
    setChecksumWarningAck(false);
    try {
      const intactCopy = new Uint8Array(buffer.byteLength);
      intactCopy.set(new Uint8Array(buffer));
      setOriginalBytes(intactCopy);
      const info = await inspectEcuBinary(intactCopy.buffer, fileName);
      setDetection(info);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await loadBufferForInspection(buffer, file.name);
  };

  const handleLoadSample = async (preset: 'vag_med17525' | 'chinese_me1788' | 'vag_simos18') => {
    const sample = createWorkshopSampleEcuBinary(preset);
    await loadBufferForInspection(sample.buffer, sample.fileName);
  };

  const handleRunLambdaDtcOff = async () => {
    if (!originalBytes || !detection || !detection.valid) return;
    setIsProcessing(true);
    setChecksumWarningAck(false);
    try {
      const result = await applyLambdaAndDtcOff(originalBytes, detection, {
        lambdaRearOff,
        catEfficiencyOff,
        manualDtcInput: manualDtcEnabled ? manualDtcInput : '',
      });
      setProcessResult(result);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadModifiedBin = () => {
    if (!processResult?.modifiedBytes || !checksumWarningAck) return;
    const copyForBlob = new Uint8Array(processResult.modifiedBytes.byteLength);
    copyForBlob.set(processResult.modifiedBytes);
    const blob = new Blob([copyForBlob.buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = processResult.outputFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadOriginalBackup = () => {
    if (!originalBytes || !detection) return;
    const copyForBlob = new Uint8Array(originalBytes.byteLength);
    copyForBlob.set(originalBytes);
    const blob = new Blob([copyForBlob.buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BACKUP_INTACT_${detection.fileName}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = () => {
    if (!processResult?.reportText) return;
    navigator.clipboard.writeText(processResult.reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/30 border border-rose-500/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
              Traitement Binaire Sécurisé · Lambda / Cat / DTC Off
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              Chinois (Bosch ME17/MED17 · Delphi MTxx · UAES) &amp; VAG (MED17 · MG1 · Simos · PCR2.1)
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 mt-1">
            <Flame className="w-5 h-5 text-amber-400" />
            <span>Module Sécurisé Sonde Lambda Aval (O2 Off) &amp; Table DTC (.bin / .ori)</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Analyse stricte des chaînes ASCII et de l&apos;entropie avant modification, masquage exclusif de l&apos;octet <code>Error Class → 0x00</code> sans décalage d&apos;adresses, protection absolue de la sonde amont (AFR) et contrôle CRC32 / taille au bit près.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-md">
            <Upload className="w-4 h-4" />
            <span>Charger Dump (.bin / .ori)</span>
            <input type="file" accept=".bin,.ori,.mod" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Supported ECU Matrix & Quick Test Dumps */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="font-bold text-cyan-300 block mb-1">
              1. Véhicules Chinois (Chery, Geely, JAC, DFSK, BAIC, Haval, MG)
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              • <strong>Bosch</strong> : ME17.8.8, MED17.8.10, ME7.8.8, M7.8<br />
              • <strong>Delphi</strong> : MT20U, MT22U, MT22.1, MT62.1<br />
              • <strong>Continental / UAES</strong> : Easy-U2.5 / SIM2K
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="font-bold text-amber-300 block mb-1">
              2. Groupe VAG (VW T-Roc, Golf, Tiguan, Audi, Seat, Skoda)
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              • <strong>Bosch</strong> : MED17.5.25, MED17.5.5, MED17.1.27, MG1CS001, MG1CS011<br />
              • <strong>Continental / Siemens</strong> : Simos 18.1, Simos 12, PCR2.1
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400 font-semibold">Tester sur dump atelier (.bin 2 Mo) :</span>
          <button
            type="button"
            onClick={() => void handleLoadSample('vag_med17525')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 cursor-pointer"
          >
            VW T-Roc MED17.5.25
          </button>
          <button
            type="button"
            onClick={() => void handleLoadSample('chinese_me1788')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 cursor-pointer"
          >
            Chery/Geely Bosch ME17.8.8
          </button>
          <button
            type="button"
            onClick={() => void handleLoadSample('vag_simos18')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 cursor-pointer"
          >
            VW Golf Simos 18.1
          </button>
        </div>
      </div>

      {/* Step 1: Strict Auto-Identification Result */}
      {isInspecting && (
        <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/40 text-xs text-cyan-300 font-mono">
          Lecture binaire ArrayBuffer, scan ASCII et calcul SHA-256 / CRC32 en cours...
        </div>
      )}

      {detection && (
        <div
          className={`p-4 sm:p-5 rounded-xl border-2 space-y-3 ${
            detection.valid
              ? 'bg-emerald-950/20 border-emerald-600/60'
              : 'bg-rose-950/60 border-rose-500'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {detection.valid ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <h3 className="text-sm font-bold text-white">
                {detection.valid
                  ? `1. Identification ECU Validée : ${detection.vendor} ${detection.family}`
                  : '1. ALERTE ROUGE — FICHIER BLOQUÉ PAR LE PARE-FEU BINAIRE'}
              </h3>
            </div>

            {originalBytes && (
              <button
                type="button"
                onClick={handleDownloadOriginalBackup}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Télécharger Copie Intacte Originale</span>
              </button>
            )}
          </div>

          {!detection.valid ? (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-600 text-xs text-rose-100 leading-relaxed font-medium">
              {detection.blockedReason}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Marque &amp; Famille ECU</span>
                <strong className="text-emerald-300">{detection.vendor} · {detection.family}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">N° Software (SW)</span>
                <strong className="text-cyan-300">{detection.softwareNumber}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Architecture &amp; Catégorie</span>
                <strong className="text-white">{detection.architecture} ({detection.vehicleCategory})</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Taille Exacte</span>
                <strong className="text-amber-300">{detection.sizeLabel}</strong>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400 pt-1">
            <span>CRC32 Origine : <strong className="text-cyan-400">0x{detection.crc32Original}</strong></span>
            <span>Entropie : <strong className="text-slate-200">{detection.entropyBits.toFixed(2)} bits/o</strong></span>
            <span className="truncate max-w-md">SHA-256 : <strong className="text-slate-200">{detection.sha256}</strong></span>
          </div>
          {detection.asciiMatches.length > 0 && (
            <div className="text-[11px] font-mono text-cyan-300">
              Chaînes ASCII détectées : {detection.asciiMatches.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Safe Lambda Off / Cat Off / Manual DTC Masking Options */}
      {detection?.valid && (
        <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>2. Configuration Traitement Sécurisé (DTC Table &amp; Error Class Mask)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                L&apos;algorithme passe uniquement l&apos;octet de classe d&apos;erreur à <code>0x00</code> sans jamais décaler les adresses mémoire.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 text-[10px] font-bold">
              Sonde Amont (Bank 1 Sensor 1 / AFR) VERROUILLÉE &amp; PROTÉGÉE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <label className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/60 cursor-pointer flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={lambdaRearOff}
                onChange={(e) => setLambdaRearOff(e.target.checked)}
                className="mt-0.5 accent-cyan-500"
              />
              <div>
                <span className="font-bold text-white block">Sonde Lambda Aval (Bank 1 Sensor 2)</span>
                <span className="text-[11px] text-slate-400">
                  Cible P0136, P0137, P0138, P0139, P0140, P0141, P0036-P0038. Ne touche jamais Sensor 1.
                </span>
              </div>
            </label>

            <label className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/60 cursor-pointer flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={catEfficiencyOff}
                onChange={(e) => setCatEfficiencyOff(e.target.checked)}
                className="mt-0.5 accent-cyan-500"
              />
              <div>
                <span className="font-bold text-white block">Efficacité Catalyseur (P0420 / P0430)</span>
                <span className="text-[11px] text-slate-400">
                  Désactive les codes rendement catalyseur Bank 1 &amp; Bank 2 sans modifier les tables d&apos;avance/AFR.
                </span>
              </div>
            </label>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="cursor-pointer flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={manualDtcEnabled}
                  onChange={(e) => setManualDtcEnabled(e.target.checked)}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <span className="font-bold text-white block">Suppression DTC manuelle</span>
                  <span className="text-[11px] text-slate-400">Saisir les codes exacts (ex: P0136, P0141, P0420)</span>
                </div>
              </label>
              {manualDtcEnabled && (
                <input
                  type="text"
                  value={manualDtcInput}
                  onChange={(e) => setManualDtcInput(e.target.value.toUpperCase())}
                  placeholder="P0136, P0137, P0138, P0140, P0141, P0420"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-amber-300 uppercase focus:outline-none focus:border-amber-400"
                />
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => void handleRunLambdaDtcOff()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>{isProcessing ? 'Traitement Binaire en cours...' : '3. Exécuter Traitement Sécurisé (Sans Décalage Mémoire)'}</span>
          </button>
        </div>
      )}

      {/* Step 3 & 4: Output Verification, Checksum Warning & Download */}
      {processResult && (
        <div
          className={`p-5 rounded-xl border-2 space-y-4 ${
            processResult.success ? 'bg-slate-900/90 border-cyan-500/50' : 'bg-rose-950/50 border-rose-500'
          }`}
        >
          {!processResult.success ? (
            <div className="flex items-start gap-3 text-rose-200 text-xs">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block text-white mb-1">OPÉRATION BLOQUÉE PAR SÉCURITÉ</span>
                <span>{processResult.blockedReason}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Traitement Binaire Terminé — {processResult.modifications.length} Adresse(s) Modifiée(s)
                    </h3>
                    <span className="text-[11px] font-mono text-cyan-400">{processResult.outputFileName}</span>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono text-[11px] font-bold">
                  Taille Exacte : {processResult.modifiedSizeBytes.toLocaleString('fr-FR')} o (100 % Identique)
                </span>
              </div>

              {/* Mandatory Checksum Warning */}
              <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500 text-xs text-amber-100 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-300 block">
                      AVERTISSEMENT OBLIGATOIRE CHECKSUM :
                    </span>
                    <span className="font-semibold">{processResult.checksumStatus}</span>
                    <div className="font-mono text-[11px] text-slate-300 mt-1">
                      CRC32 Avant : 0x{processResult.crc32Before} · CRC32 Après : 0x{processResult.crc32After}
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer bg-slate-950/70 p-2.5 rounded-lg border border-amber-700/60 text-amber-200 font-semibold">
                  <input
                    type="checkbox"
                    checked={checksumWarningAck}
                    onChange={(e) => setChecksumWarningAck(e.target.checked)}
                    className="accent-amber-500 h-4 w-4"
                  />
                  <span>
                    Je confirme avoir lu l&apos;avertissement Checksum et m&apos;engage à effectuer la correction Checksum via mon outil d&apos;écriture (PCMflash / Flex / Autotuner / Kess3) avant écriture ECU.
                  </span>
                </label>
              </div>

              {/* Modifications Table */}
              {processResult.modifications.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Adresse Hex</th>
                        <th className="py-2 px-3">Code DTC</th>
                        <th className="py-2 px-3">Ancienne Valeur</th>
                        <th className="py-2 px-3">Nouvelle Valeur</th>
                        <th className="py-2 px-3">Zone / Détail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 bg-slate-950/40 text-slate-200">
                      {processResult.modifications.map((m, idx) => (
                        <tr key={`${m.addressHex}-${idx}`}>
                          <td className="py-1.5 px-3 text-cyan-400 font-bold">{m.addressHex}</td>
                          <td className="py-1.5 px-3 text-amber-300 font-bold">{m.dtcCode}</td>
                          <td className="py-1.5 px-3 text-rose-300">{m.oldHex}</td>
                          <td className="py-1.5 px-3 text-emerald-400 font-bold">{m.newHex}</td>
                          <td className="py-1.5 px-3 text-slate-300">{m.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-300">
                  Aucune table Error Class DTC correspondante n&apos;a été détectée automatiquement dans ce dump binaire. Aucun octet n&apos;a été altéré à l&apos;aveugle (zéro risque de briquage).
                </div>
              )}

              {/* Export Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedReport ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedReport ? 'Rapport copié' : 'Copier Rapport Détaillé'}</span>
                </button>

                <button
                  type="button"
                  disabled={!checksumWarningAck}
                  onClick={handleDownloadModifiedBin}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  {checksumWarningAck ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  <span>Télécharger {processResult.outputFileName}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
