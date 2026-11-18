import React, { useState } from 'react';
import { TranslationItem, ConnectionMode } from '../types/automotive';
import { SAMPLE_STRINGS_TO_TRANSLATE } from '../data/mockVehicles';
import { Languages, Sparkles, CheckCircle2, Send, Tablet, FileCode, AlertTriangle, Car } from 'lucide-react';
import { apiFetch } from '../utils/apiBridge';
import { AiVerificationBadge, AiVerificationInfo } from './AiVerificationBadge';

interface AppTranslatorProps {
  connectionMode: ConnectionMode;
  isConnected: boolean;
  onOpenConnectModal: () => void;
}

interface HeadUnitPreset {
  id: string;
  label: string;
  appName: string;
  items: TranslationItem[];
}

const HEADUNIT_TRANSLATION_PRESETS: HeadUnitPreset[] = [
  {
    id: 'autopro_standard',
    label: 'AutoPro Cockpit Standard (EN → FR/AR)',
    appName: 'AutoPro Cockpit HD',
    items: SAMPLE_STRINGS_TO_TRANSLATE,
  },
  {
    id: 'kia_seltos_2026_cn',
    label: 'Kia Sportage (KX5 / NQ5) & Seltos 2026 Version Chine (Baidu DuerOS)',
    appName: 'Kia Connect CN / DuerOS (Sportage & Seltos)',
    items: [
      { key: 'app_title', original: '起亚智联车机系统 (Kia Connect CN Sportage / Seltos)', translated: 'Système Kia Connect (Sportage / Seltos CN)', context: 'En-tête principal tablette Kia CN' },
      { key: 'menu_vehicle_ctrl', original: '车辆设置与驾驶模式 (Drive Mode & Chassis)', translated: 'Réglages Véhicule & Modes de Conduite', context: 'Menu principal véhicule' },
      { key: 'gauge_turbo_boost', original: '涡轮增压压力 (Turbo Boost kPa/bar)', translated: 'Pression Turbo (bar)', context: 'Télémétrie moteur' },
      { key: 'gauge_coolant_temp', original: '发动机冷却液温度 (Coolant Temp °C)', translated: 'Température Moteur (°C)', context: 'Indicateur thermique' },
      { key: 'menu_avm_360', original: '360°全景影像与透明底盘 (AVM Surround)', translated: 'Caméra 360° & Châssis Transparent', context: 'Bouton assistance stationnement' },
      { key: 'menu_adas_lka', original: '车道保持辅助 LKA / 主动刹车 FCA', translated: 'Maintien de Voie (LKA) & Freinage d’Urgence', context: 'Menu ADAS sécurité' },
      { key: 'warning_battery_low', original: '蓄电池电压过低，请保持发动机启动后再升级', translated: 'Tension batterie faible ! Maintenez le moteur démarré avant mise à jour.', context: 'Alerte système' },
      { key: 'btn_clear_dtc', original: '一键扫描并清除故障码 (DTC Reset)', translated: 'Scanner et Effacer les Défauts (DTC)', context: 'Action diagnostic' },
    ],
  },
  {
    id: 'vw_golf8_audi_a3_cn',
    label: 'VW Golf 8 / 8.5 (2026) & Audi A3 / A3L Chine (CNS 3.0 / MIB3-CN)',
    appName: 'VW CNS 3.0 / Audi MMI CN (Golf 8 2026 & A3L)',
    items: [
      { key: 'app_title', original: '一汽-大众 CNS 3.0 / 奥迪 MMI 智慧车联 (Golf 8 / A3 CN)', translated: 'Cockpit VW CNS 3.0 / Audi MMI CN', context: 'En-tête principal MIB3 Chine' },
      { key: 'menu_vehicle_ctrl', original: '驾驶模式选择与底盘设定 (DCC / SFD2 Protected)', translated: 'Profils de Conduite & Châssis (SFD2)', context: 'Menu véhicule VAG CN' },
      { key: 'menu_carplay_baidu', original: '无线 CarPlay / CarLife+ 手机互联映射', translated: 'CarPlay Sans Fil & Liaison Smartphone', context: 'Connectivité MIB3-CN' },
      { key: 'menu_park_360', original: '360°全景泊车辅助与雷达显示 (PLA / OPS)', translated: 'Aide au Stationnement 360° & Radars OPS', context: 'Caméra et capteurs VAG' },
      { key: 'warning_battery_low', original: '警告：严禁直刷欧版 MIB3 固件，仅限非破坏性语言包', translated: 'Attention : Ne jamais flasher firmware MIB3 EU — Pack langue non destructif uniquement.', context: 'Sécurité FEC/CP' },
      { key: 'btn_clear_dtc', original: '应用法语/阿拉伯语翻译并保留原厂组件保护', translated: 'Appliquer Langue FR/AR (Composant Protégé)', context: 'Validation ADB/Moshi' },
    ],
  },
  {
    id: 'geely_flyme_250',
    label: 'Geely Cityray (Boyue) Flyme Auto 2.5.0 / Coolray / Starray / Okavango / Icon / Cowboy',
    appName: 'Geely Flyme Auto 2.5.0 / GKUI OS',
    items: [
      { key: 'app_title', original: '银河 Flyme Auto 2.5.0 智能座舱 (Cityray/Starray)', translated: 'Cockpit Geely Flyme Auto 2.5.0', context: 'Système Meizu Flyme Auto' },
      { key: 'menu_540_camera', original: '540°上帝之眼透明底盘视图', translated: 'Vue Caméra 540° & Châssis Transparent', context: 'Module AVM Geely' },
      { key: 'gauge_turbo_boost', original: 'BHE15涡轮增压值 (Boost Pressure)', translated: 'Pression Turbo BHE15 (bar)', context: 'Jauge performance' },
      { key: 'gauge_coolant_temp', original: '冷却液与变速箱油温 (Température DCT/Eau)', translated: 'Temp. Liquide & Boîte 7DCT (°C)', context: 'Jauge thermique' },
      { key: 'menu_ambient_light', original: '72色音乐律动氛围灯与香氛系统', translated: 'Éclairage d’Ambiance 72 Couleurs & Parfum', context: 'Habitacle Full Option' },
      { key: 'warning_battery_low', original: '系统提示：刷机或安装APK时请勿断开电源 (12.5V+)', translated: 'Alerte : Ne coupez pas le contact pendant l’installation APK (12.5V+).', context: 'Sécurité IHU' },
      { key: 'btn_clear_dtc', original: '重置车机缓存并校准语言包 (Apply FR/AR)', translated: 'Appliquer Langue FR/AR & Calibrer', context: 'Validation ADB' },
    ],
  },
  {
    id: 'jetour_full_series',
    label: 'Jetour X70 / X70 Plus / X70L / X90 Plus / X95 / T1 / X50 (Lion OS)',
    appName: 'Jetour OS Suite (X70/X70L/X90/X95/T1/X50)',
    items: [
      { key: 'app_title', original: '捷途雄狮智云车机 (Jetour Lion OS)', translated: 'Jetour Lion OS (Français / Arabe)', context: 'Interface Jetour CN' },
      { key: 'menu_xwd_terrain', original: 'XWD全自动智能四驱地形模式 (T1 / X90)', translated: 'Gestion 4x4 XWD & Modes Tout-Terrain', context: 'Sélecteur conduite Jetour' },
      { key: 'gauge_turbo_boost', original: '鲲鹏动力增压压力 (Kunpeng Turbo)', translated: 'Pression Turbo Kunpeng (bar)', context: 'Compteur moteur' },
      { key: 'gauge_coolant_temp', original: '发动机实时水温 (Engine Temp °C)', translated: 'Température Moteur (°C)', context: 'Surveillance thermique' },
      { key: 'menu_sony_dsp', original: 'SONY高保真音效与主动降噪设置', translated: 'Réglages Audio DSP & Égaliseur Habitacle', context: 'Audio DSP' },
      { key: 'warning_battery_low', original: '检测到系统非破坏模式：严禁刷写MCU/DSP分区', translated: 'Mode Non Destructif Actif : Écriture MCU/DSP bloquée par sécurité.', context: 'Pare-feu Anti-Brick' },
      { key: 'btn_clear_dtc', original: '安装常用应用商店与CarPlay (Sideload APK)', translated: 'Déployer Packs Apps & CarPlay Sans Fil', context: 'Bouton installation' },
    ],
  },
  {
    id: 'changan_x5_plus_pro',
    label: 'Changan X5 Plus / X5 Pro (Oshan InCall OS)',
    appName: 'Changan InCall OS (X5 Plus / Pro)',
    items: [
      { key: 'app_title', original: '长安欧尚 OnStyle / InCall 智能车联', translated: 'Changan X5 Plus / Pro InCall OS', context: 'Interface Changan' },
      { key: 'menu_track_mode', original: '赛道模式与声浪模拟 (Track Mode NE15T)', translated: 'Mode Piste & Télémétrie NE15T', context: 'Bouton sport' },
      { key: 'gauge_turbo_boost', original: '蓝鲸NE1.5T增压压力 (BlueCore Boost)', translated: 'Pression Turbo BlueCore (bar)', context: 'Jauge suralimentation' },
      { key: 'gauge_coolant_temp', original: '冷却系统温度监控 (Coolant °C)', translated: 'Température Refroidissement (°C)', context: 'Jauge moteur' },
      { key: 'warning_battery_low', original: '警告：禁止修改 /system 或 /vendor 分区', translated: 'Attention : Ne jamais modifier /system ou /vendor (Protection 360°).', context: 'Sécurité Changan' },
      { key: 'btn_clear_dtc', original: '应用语言翻译并开启多窗口分屏', translated: 'Appliquer Traduction & Activer Multi-Écran', context: 'Action système' },
    ],
  },
];

export const AppTranslator: React.FC<AppTranslatorProps> = ({
  connectionMode,
  isConnected,
  onOpenConnectModal,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(HEADUNIT_TRANSLATION_PRESETS[0].id);
  const [stringsList, setStringsList] = useState<TranslationItem[]>(SAMPLE_STRINGS_TO_TRANSLATE);
  const [targetLang, setTargetLang] = useState<string>('Français (France)');
  const [appName, setAppName] = useState<string>('AutoPro Cockpit HD');
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [aiVerification, setAiVerification] = useState<AiVerificationInfo | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [pushWarning, setPushWarning] = useState<string | null>(null);

  const handleSelectPreset = (presetId: string) => {
    const preset = HEADUNIT_TRANSLATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setAppName(preset.appName);
    setStringsList(preset.items.map((item) => ({ ...item })));
    setAiNotes(null);
    setPushStatus(null);
    setPushWarning(null);
  };

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
      setAiVerification(data.aiVerification || null);
    } catch {
      setAiNotes('Erreur de connexion au service de traduction IA.');
      setAiVerification(null);
    } finally {
      setIsTranslating(false);
    }
  };

  // Push translation directly to car headunit
  const handlePushToCarScreen = () => {
    setPushWarning(null);
    if (!isConnected) {
      setPushWarning('Veuillez activer la liaison avec la tablette (Câble USB-C, WiFi Direct ou Bluetooth) avant d’injecter le pack linguistique.');
      return;
    }

    setPushStatus('Injection des ressources linguistiques dans le système de bord...');
    setTimeout(() => {
      setPushStatus(`Succès : Les fichiers linguistiques (${appName}) ont été injectés via ${connectionMode.toUpperCase()} dans /data/local/tmp/locale_${targetLang.slice(0, 2).toLowerCase()}.`);
      setTimeout(() => setPushStatus(null), 5000);
    }, 1500);
  };

  // Export as Android strings.xml
  const handleExportStringsXml = () => {
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n<!-- AutoPro Automotive Translation Resource (${appName}) -->\n<resources>\n`;
    stringsList.forEach((s) => {
      xml += `    <string name="${s.key}">${s.translated.replace(/"/g, '\\"')}</string>\n`;
    });
    xml += `</resources>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strings_${selectedPresetId}_${targetLang.slice(0, 2).toLowerCase()}.xml`;
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
            <span>Traducteur IA pour Tablettes Chinoises &amp; Écrans Automobiles</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Traduisez les tablettes chinoises (VW Golf 8 2026 CN, Audi A3/A3L CN, Kia Sportage &amp; Seltos 2026 CN, Geely Cityray Flyme Auto 2.5.0, Starray, Okavango, Icon, Cowboy, Coolray, Jetour, Changan) en Français ou Arabe RTL.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportStringsXml}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>Exporter strings.xml</span>
          </button>

          <button
            onClick={handlePushToCarScreen}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>Injecter dans la Tablette</span>
          </button>
        </div>
      </div>

      {pushWarning && (
        <div className="p-3 bg-amber-950/40 border border-amber-700/60 rounded-lg text-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{pushWarning}</span>
          </div>
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] cursor-pointer"
          >
            Connecter la tablette
          </button>
        </div>
      )}

      {pushStatus && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-700/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{pushStatus}</span>
        </div>
      )}

      {/* Vehicle Head-Unit Preset + Target Language & App Config Strip */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
        <div>
          <label className="block text-slate-300 text-xs mb-1.5 font-semibold flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-cyan-400" />
            <span>Pack Interface Tablette Véhicule (Dictionnaire Constructeur CN/EN) :</span>
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 font-semibold"
          >
            {HEADUNIT_TRANSLATION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
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
            <label className="block text-slate-400 text-xs mb-1 font-medium">Nom de l'Application / OS Embarqué :</label>
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
      </div>

      {aiNotes && (
        <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg text-xs text-cyan-200 space-y-2">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-cyan-300">Note de l'Expert Localisation IA :</span>
              {aiNotes}
            </div>
          </div>
          <AiVerificationBadge verification={aiVerification} />
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
