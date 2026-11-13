import React, { useState } from 'react';
import { TranslationItem, ConnectionMode } from '../types/automotive';
import { SAMPLE_STRINGS_TO_TRANSLATE } from '../data/mockVehicles';
import { Languages, Sparkles, Download, CheckCircle2, Send, Tablet, RefreshCw, FileCode } from 'lucide-react';
import { apiFetch } from '../utils/apiBridge';

interface AppTranslatorProps {
  connectionMode: ConnectionMode;
  isConnected: boolean;
  onOpenConnectModal: () => void;
}

export const AppTranslator: React.FC<AppTranslatorProps> = ({
  connectionMode,
  isConnected,
  onOpenConnectModal,
}) => {
  const [stringsList, setStringsList] = useState<TranslationItem[]>(SAMPLE_STRINGS_TO_TRANSLATE);
  const [targetLang, setTargetLang] = useState<string>('Arabe (العربية)');
  const [appName, setAppName] = useState<string>('AutoPro Cockpit HD');
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const availableLanguages = [
    { code: 'ar', label: 'Arabe (العربية)', dir: 'rtl' },
    { code: 'fr', label: 'Français (France)', dir: 'ltr' },
    { code: 'en', label: 'Anglais (English)', dir: 'ltr' },
    { code: 'es', label: 'Espagnol (Español)', dir: 'ltr' },
    { code: 'de', label: 'Allemand (Deutsch)', dir: 'ltr' },
    { code: 'it', label: 'Italien (Italiano)', dir: 'ltr' },
    { code: 'pt', label: 'Portugais (Português)', dir: 'ltr' },
  ];

  // Execute AI Translation
  const handleTranslateAll = async () => {
    setIsTranslating(true);
    setAiNotes(null);

    try {
      const res = await apiFetch('/api/translate/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage: targetLang,
          appName,
          sourceStrings: stringsList.map((s) => ({ key: s.key, text: s.original })),
        }),
      });

      const data = await res.json();
      if (data.translatedStrings) {
        setStringsList((prev) =>
          prev.map((item) => ({
            ...item,
            translated: data.translatedStrings[item.key] || item.translated,
          }))
        );
      }
      setAiNotes(data.notes || `Traduction complétée pour ${targetLang}`);
    } catch {
      setAiNotes('Erreur de connexion au service de traduction IA.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Push translation directly to car headunit
  const handlePushToCarScreen = () => {
    if (!isConnected) {
      alert('Veuillez activer la liaison avec la tablette (Câble, WiFi ou Bluetooth).');
      return;
    }

    setPushStatus('Injection des ressources linguistiques dans le système de bord...');
    setTimeout(() => {
      setPushStatus(`Succès : Les fichiers linguistiques ont été injectés via ${connectionMode.toUpperCase()} dans /system/res/locale_${targetLang.slice(0, 2).toLowerCase()}.`);
      setTimeout(() => setPushStatus(null), 5000);
    }, 1500);
  };

  // Export as Android strings.xml
  const handleExportStringsXml = () => {
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n<!-- AutoPro Automotive Translation Resource -->\n<resources>\n`;
    stringsList.forEach((s) => {
      xml += `    <string name="${s.key}">${s.translated.replace(/"/g, '\\"')}</string>\n`;
    });
    xml += `</resources>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strings_${targetLang.slice(0, 2).toLowerCase()}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Check if target language is RTL (like Arabic)
  const isRtl = targetLang.includes('Arabe');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Languages className="w-5 h-5 text-cyan-400" />
            <span>Traducteur IA pour Applications &amp; Écrans Automobiles</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Traduisez instantanément les textes d'interfaces, compteurs, alertes de sécurité et boutons d'applications pour tablettes de voiture en toute langue (Arabe, Français, Anglais, Espagnol, etc.).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportStringsXml}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>Exporter strings.xml</span>
          </button>

          <button
            onClick={handlePushToCarScreen}
            disabled={!isConnected}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>Injecter dans la Tablette</span>
          </button>
        </div>
      </div>

      {pushStatus && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-700/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{pushStatus}</span>
        </div>
      )}

      {/* Target Language & App Config Strip */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        <div>
          <label className="block text-slate-400 text-xs mb-1 font-medium">Langue Cible Souhaitée :</label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-semibold"
          >
            {availableLanguages.map((l) => (
              <option key={l.code} value={l.label}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 text-xs mb-1 font-medium">Nom de l'Application Embarquée :</label>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="sm:self-end">
          <button
            onClick={handleTranslateAll}
            disabled={isTranslating}
            className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Sparkles className={`w-4 h-4 ${isTranslating ? 'animate-spin' : ''}`} />
            <span>{isTranslating ? 'Traduction IA en cours...' : `Traduire en ${targetLang}`}</span>
          </button>
        </div>
      </div>

      {aiNotes && (
        <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg text-xs text-cyan-200 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block text-cyan-300">Note de l'Expert Localisation IA :</span>
            {aiNotes}
          </div>
        </div>
      )}

      {/* Main Grid: Left Dictionary Editor / Right Simulated Tablet Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Translation Dictionary (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Dictionnaire des Textes &amp; Clés de l'Application ({stringsList.length} entrées)
              </h3>
              <span className="text-[11px] text-slate-500">Édition en direct activée</span>
            </div>

            <div className="divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
              {stringsList.map((item, idx) => (
                <div key={item.key} className="p-4 space-y-2 hover:bg-slate-800/20 transition-colors">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {item.key}
                    </span>
                    <span className="text-slate-500">{item.context}</span>
                  </div>

                  <div className="text-xs text-slate-400">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Origine :</span>
                    <span>{item.original}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-cyan-400 block mb-1">
                      Traduction ({targetLang}) :
                    </span>
                    <input
                      type="text"
                      value={item.translated}
                      dir={isRtl ? 'rtl' : 'ltr'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStringsList((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, translated: val } : s))
                        );
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live In-Car Screen Preview with Translated UI (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Tablet className="w-4 h-4 text-cyan-400" />
              <span>Rendu Visuel sur l'Écran Tactile de Bord</span>
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded">
              {isRtl ? 'Mode RTL Actif' : 'Mode LTR'}
            </span>
          </div>

          {/* Automotive Head-Unit Screen Frame */}
          <div className="p-3 bg-slate-950 rounded-2xl border-4 border-slate-800 shadow-2xl">
            <div
              dir={isRtl ? 'rtl' : 'ltr'}
              className="aspect-[16/11] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 p-4 flex flex-col justify-between space-y-3"
            >
              {/* Screen Top Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-white truncate max-w-[200px]">
                  {stringsList.find((s) => s.key === 'app_title')?.translated || appName}
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  {isConnected ? '13.8V · CAN OK' : '12.6V'}
                </span>
              </div>

              {/* Gauges & Widgets in Translated Language */}
              <div className="grid grid-cols-2 gap-2 my-auto">
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block truncate">
                    {stringsList.find((s) => s.key === 'gauge_turbo_boost')?.translated}
                  </span>
                  <div className="text-sm font-mono font-bold text-cyan-400">1.45 bar</div>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block truncate">
                    {stringsList.find((s) => s.key === 'gauge_coolant_temp')?.translated}
                  </span>
                  <div className="text-sm font-mono font-bold text-emerald-400">88 °C</div>
                </div>
              </div>

              {/* Warning Alert Banner in Translated Language */}
              <div className="p-2 rounded bg-amber-950/60 border border-amber-800/60 text-[10px] text-amber-300 leading-snug">
                {stringsList.find((s) => s.key === 'warning_battery_low')?.translated}
              </div>

              {/* Clear DTC Action Button in Translated Language */}
              <div className="pt-1">
                <button
                  type="button"
                  className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition-colors text-center"
                >
                  {stringsList.find((s) => s.key === 'btn_clear_dtc')?.translated}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg text-xs text-slate-400">
            <span className="font-semibold text-slate-200 block mb-0.5">Adaptation Ergonomique Conducteur :</span>
            Les traductions sont adaptées aux contraintes des écrans automobiles (boutons larges, lisibilité rapide au volant et support natif de l'orientation droite-à-gauche pour l'Arabe).
          </div>
        </div>
      </div>
    </div>
  );
};
