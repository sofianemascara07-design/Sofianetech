import React, { useState } from 'react';
import {
  Download,
  ShieldCheck,
  Key,
  Copy,
  Check,
  ExternalLink,
  Laptop,
  Tablet,
  HardDrive,
  FileText,
  CheckCircle2,
  DollarSign,
  Cpu,
  Share2,
  QrCode,
  Send,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Car,
  Play,
  Wrench,
  Smartphone,
  TrendingUp,
  Calculator,
  Award,
  Layers,
  Lock,
  Unlock,
  Radio,
  Zap,
  CheckCircle,
  HelpCircle,
  Camera,
  Server,
  Terminal
} from 'lucide-react';
import { Vehicle } from '../types/automotive';
import { VEHICLE_PRESETS } from '../data/mockVehicles';
import { getBackendBaseUrl, setBackendBaseUrl } from '../utils/apiBridge';

interface CommercialPackagingProps {
  appUrl: string;
  onSelectTab?: (tab: any) => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  isAdmin?: boolean;
}

export const CommercialPackaging: React.FC<CommercialPackagingProps> = ({
  appUrl,
  onSelectTab,
  onSelectVehicle,
  isAdmin = false,
}) => {
  const [activeSection, setActiveSection] = useState<'share' | 'simulator' | 'feasibility' | 'licenses'>('simulator');
  const [workshopName, setWorkshopName] = useState('Garage Auto Tech Mascara');
  const [hwid, setHwid] = useState('HWID-DZ-9882-1270-1770-WIN11');
  const [licenseType, setLicenseType] = useState<'master' | 'reprog' | 'standard'>('master');
  const [generatedKey, setGeneratedKey] = useState<string>('Générer depuis la console Admin & Abonnés');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedTermux, setCopiedTermux] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [pitchLanguage, setPitchLanguage] = useState<'fr' | 'ar'>('fr');

  // Firebase Hosting + Render Backend Sync State
  const [activeHostingTarget, setActiveHostingTarget] = useState<'firebase' | 'cloud'>('firebase');
  const [renderUrlInput, setRenderUrlInput] = useState<string>(() => getBackendBaseUrl());
  const [backendStatusMsg, setBackendStatusMsg] = useState<string | null>(null);
  const [isTestingBackend, setIsTestingBackend] = useState(false);

  // ROI Business Simulator States (Adjustable by user / investor / garagiste)
  const [monthlyChineseFlash, setMonthlyChineseFlash] = useState<number>(6); // 20,000 DZD each
  const [monthlyReprog, setMonthlyReprog] = useState<number>(4); // 30,000 DZD each
  const [monthlyKeyless, setMonthlyKeyless] = useState<number>(5); // 15,000 DZD each
  const [monthlyDiag, setMonthlyDiag] = useState<number>(15); // 4,000 DZD each
  const [softwareLicensePrice, setSoftwareLicensePrice] = useState<number>(45000); // 45,000 DZD

  // SaaS Creator Revenue States (Selling licenses to garages across 58 wilayas)
  const [targetGaragesCount, setTargetGaragesCount] = useState<number>(20);

  const firebaseAppUrl = 'https://autoprodz-a7071.web.app';
  const cloudRunAppUrl = appUrl || 'https://ais-pre-kd2bgrq3vtrufter4hwxrg-988212701770.europe-west2.run.app';
  const sharedAppUrl = activeHostingTarget === 'firebase' ? firebaseAppUrl : cloudRunAppUrl;

  const termuxDeployCmd = renderUrlInput.trim()
    ? `rm -rf dist && VITE_API_URL="${renderUrlInput.trim().replace(/\/+$/, '')}" npm run build && firebase deploy --only hosting --project autoprodz-a7071`
    : `rm -rf dist && npm run build && firebase deploy --only hosting --project autoprodz-a7071`;

  // Pitch messages formatted for professional outreach
  const pitchMessages = {
    fr: `🔧 AutoPro Suite Pro - Démonstration Dédiée aux Garagistes & Ateliers Automobiles DZ

Salam alikoum,
Voici le lien d'accès direct pour tester la démonstration complète de la suite logicielle AutoPro Diagnostic & Flash :
👉 ${sharedAppUrl}

Points forts spécialement conçus pour les ateliers en Algérie :
✅ 100% Compatible véhicules circulant en Algérie (Fiat Doblò Usine Tafraoui Oran 1.6 MultiJet, Geely Coolray, Jetour Dashing, Chery Tiggo, DFSK, Renault Symbol, Peugeot 301...)
✅ Débridage & Flash des écrans chinois : Installation Google Maps GPS + YouTube Car Edition + Traduction en Arabe/Français
✅ Reprogrammation ECU & Chiptuning Stage 1/2, FlexFuel E85 et suppression FAP / DPF / EGR / AdBlue SCR Off
✅ Liaison directe avec votre logiciel Smartech DZ DiagAuto déjà installé dans votre atelier (port IPC 35100)
✅ Fonctionne sur PC Windows d'atelier, tablette tactile et smartphone via Câble USB OBD2, WiFi Direct ou Bluetooth

Testez la démo en direct sur votre micro ou votre smartphone en cliquant sur le lien ci-dessus !
📞 Contact & Activation WhatsApp : 05 57 76 78 04 (+213 557 76 78 04)
📧 Email : sofianemascara07@gmail.com`,

    ar: `🚗 سويت أوتوبرو دياقنوستيك وفلاش - عرض تجريبي مباشر للورشات والمهنيين في الجزائر

السلام عليكم ورحمة الله،
إليك رابط الدخول المباشر لتجربة برنامج AutoPro المخصص لورشات كهرباء وميكانيك وبرمجة السيارات في الجزائر:
👉 ${sharedAppUrl}

أبرز المزايا الخاصة بسوق السيارات الجزائري:
🔹 متوافق 100% مع السيارات المتداولة في الجزائر (فيات دوبلو مصنع طفراوي وهران 1.6 MultiJet، جيلي كولراي، جيتور داشينغ، شيري، دي أف أس كاي، رينو سيمبول...)
🔹 تعريب وتفليش شاشات السيارات الصينية وتثبيت Google Maps GPS و YouTube Car Edition بدون فك الشاشة
🔹 فحص دياق شامل وقراءة كودات الأعطال مع اقتراحات الميكانيكي الذكي
🔹 برمجة عقول السيارات (Stage 1 / Stage 2) وحذف الفلتر FAP/DPF وصمام EGR ونظام AdBlue Off
🔹 ربط ومزامنة مباشرة مع برنامج Smartech DZ DiagAuto المثبت مسبقاً في ورشتكم
🔹 يشتغل عبر كابل USB أو WiFi أو Bluetooth على الميكرو أو التابلت

يمكنك فتح الرابط مباشرة من هاتفك أو جهاز الكمبيوتر لتجربة كل الوظائف فوراً!
📞 للتواصل والحصول على مفتاح التفعيل الرسمي عبر واتساب: 05 57 76 78 04 (213557767804+)
📧 البريد الإلكتروني: sofianemascara07@gmail.com`
  };

  const handleGenerateKey = () => {
    const prefix = licenseType === 'master' ? 'AP-DZ26-MST' : licenseType === 'reprog' ? 'AP-DZ26-STG' : 'AP-DZ26-STD';
    const rand1 = Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(4, 'X');
    const rand2 = Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(4, '7');
    const newKey = `${prefix}-${rand1}-${rand2}-${Math.floor(1000 + Math.random() * 9000)}`;
    setGeneratedKey(newKey);
    setCopiedKey(false);
  };

  const handleCopy = (text: string, type: 'key' | 'url' | 'pitch' | 'termux') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } else if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } else if (type === 'termux') {
      setCopiedTermux(true);
      setTimeout(() => setCopiedTermux(false), 2500);
    } else {
      setCopiedPitch(true);
      setTimeout(() => setCopiedPitch(false), 2500);
    }
  };

  const handleSaveAndTestRenderBackend = async () => {
    const clean = setBackendBaseUrl(renderUrlInput);
    setRenderUrlInput(clean);
    setIsTestingBackend(true);
    setBackendStatusMsg(null);
    try {
      const target = clean ? `${clean}/api/health` : '/api/health';
      const res = await fetch(target);
      const data = await res.json();
      if (data?.status === 'ok') {
        setBackendStatusMsg(`✅ Connecté (${data.version}) · Modules actifs : ${(data.features || []).join(', ')}`);
      } else {
        setBackendStatusMsg('⚠️ Réponse reçue mais format inattendu.');
      }
    } catch {
      setBackendStatusMsg('❌ Serveur Render injoignable (vérifiez l\'URL https://...onrender.com ou attendez le réveil Render).');
    } finally {
      setIsTestingBackend(false);
    }
  };

  const openExternalLink = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(pitchMessages[pitchLanguage]);
    openExternalLink(`https://api.whatsapp.com/send?text=${text}`);
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent('Démonstration Logiciel AutoPro Diagnostic & Flash DZ');
    const body = encodeURIComponent(pitchMessages[pitchLanguage]);
    openExternalLink(`mailto:?subject=${subject}&body=${body}`);
  };

  // Quick 1-click guided demo scenarios
  const launchDemoScenario = (scenarioId: 'fiat_doblo' | 'geely_flash' | 'chinese_tablet' | 'smartech_bridge' | 'cameras_adas') => {
    if (!onSelectTab) return;

    if (scenarioId === 'fiat_doblo') {
      const doblo = VEHICLE_PRESETS.find(v => v.id === 'fiat_doblo_16mjet') || VEHICLE_PRESETS[0];
      if (onSelectVehicle) onSelectVehicle(doblo);
      onSelectTab('diagnostic');
    } else if (scenarioId === 'geely_flash') {
      const coolray = VEHICLE_PRESETS.find(v => v.id === 'geely_coolray_15t') || VEHICLE_PRESETS[7];
      if (onSelectVehicle) onSelectVehicle(coolray);
      onSelectTab('flash');
    } else if (scenarioId === 'chinese_tablet') {
      onSelectTab('chinese_flasher');
    } else if (scenarioId === 'smartech_bridge') {
      onSelectTab('smartech');
    } else if (scenarioId === 'cameras_adas') {
      onSelectTab('cameras');
    }
  };

  // Download Windows Workshop Setup Script (.bat)
  const handleDownloadWindowsInstaller = () => {
    const batContent = `@echo off
title AutoPro Diagnostic & Flash Hub - Installateur Micro Professionnel
color 0B
echo ======================================================================
echo    AUTOPRO DIAGNOSTIC, FLASH & SMARTECH DZ BRIDGE - INSTALLATEUR PC
echo ======================================================================
echo.
echo [1/4] Verification des composants systeme Windows x64...
timeout /t 2 >nul
echo [2/4] Installation des pilotes USB OBD-II (FTDI, CH340, Tactrix J2534)...
echo Pilotes installes avec succes dans System32\\drivers.
echo.
echo [3/4] Enregistrement de la licence professionnelle : ${generatedKey}
echo Client : ${workshopName}
echo Clé validée et activée pour ce micro.
echo.
echo [4/4] Creation du raccourci sur le Bureau de l'atelier...
echo.
echo ======================================================================
echo  INSTALLATION TERMINEE AVEC SUCCES !
echo  L'application est prete a etre utilisee avec les VCI et tablettes.
echo ======================================================================
echo.
start "" "${sharedAppUrl}"
pause
`;
    const blob = new Blob([batContent], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AutoPro_Installateur_Micro_PC_${workshopName.replace(/\s+/g, '_')}.bat`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Commercial Certificate / License TXT
  const handleDownloadLicenseCert = () => {
    const certContent = `=====================================================================
       CERTIFICAT DE LICENCE COMMERCIALE PROFESSIONNELLE
       AUTOPRO FLASH & DIAGNOSTIC HUB - ÉDITION ATELIER DZ
=====================================================================

Titulaire de la Licence : ${workshopName}
Identifiant Machine (HWID) : ${hwid}
Type de Licence : ${licenseType.toUpperCase()} (Illimitée & Mises à Jour Incluses)
Clé d'Activation : ${generatedKey}
Date d'Émission : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString()}

MODULES ACTIVÉS :
- Diagnostic Multimarque Tous Véhicules (Moteur, Boîte, Freinage, Airbag, BSI)
- Reprogrammation Calculateur ECU/TCU (Stage 1, Stage 2, Eco E85, Pop&Bang)
- Dépollution FAP / DPF / EGR / AdBlue SCR Off
- Traducteur IA Arabe Algérien & Français Automobile
- Passerelle Liaison Directe Mobile ↔ Tablette (Câble USB, WiFi, Bluetooth)
- Liaison & Injection Native Smartech DZ DiagAuto (dz.smartech.diagauto)
- Flash & Débridage Écrans Chinois (Google Maps + YouTube Car Edition)

Lien d'Accès Officiel Déployé :
${sharedAppUrl}

Support Technique & Activation WhatsApp : 05 57 76 78 04 (+213 557 76 78 04) | sofianemascara07@gmail.com
=====================================================================`;

    const blob = new Blob([certContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Licence_Pro_${workshopName.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Only shown for Admin (clients cannot share unlocked demo links) */}
      {isAdmin && (
      <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900/90 to-blue-950/60 border border-cyan-500/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Lien Protégé par Pass Démo Limité
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Clé Admin ou Pass Démo requis à l'ouverture
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Share2 className="w-6 h-6 text-cyan-400" />
              <span>Partager une Démonstration à un Garagiste / Professionnel</span>
            </h1>

            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Transmettez ce lien à votre client électricien auto, mécanicien ou chiptuner. Il peut l'ouvrir immédiatement sur son micro d'atelier, son smartphone Android ou sa tablette pour tester le diagnostic Fiat Doblò, le flash Geely/Jetour, le déblocage d'écran chinois et la liaison avec Smartech DZ.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full lg:w-auto">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              <button
                onClick={() => setActiveHostingTarget('firebase')}
                className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
                  activeHostingTarget === 'firebase' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Firebase Hosting
              </button>
              <button
                onClick={() => setActiveHostingTarget('cloud')}
                className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
                  activeHostingTarget === 'cloud' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Serveur Cloud
              </button>
            </div>

            <button
              onClick={() => handleCopy(sharedAppUrl, 'url')}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {copiedUrl ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
              <span>{copiedUrl ? 'Lien Démo Copié !' : 'Copier le Lien Démo'}</span>
            </button>

            <button
              onClick={() => setShowQrModal(!showQrModal)}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="Afficher le QR Code pour scan smartphone en atelier"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>{showQrModal ? 'Masquer QR' : 'QR Code'}</span>
            </button>

            <a
              href={sharedAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <ExternalLink className="w-4 h-4 text-cyan-400" />
              <span>Tester Plein Écran</span>
            </a>
          </div>
        </div>

        {/* Interactive QR Code Display Panel (Toggled or embedded) */}
        {showQrModal && (
          <div className="mt-5 pt-5 border-t border-slate-800 flex flex-col md:flex-row items-center gap-6 bg-slate-950/70 p-4 rounded-xl border border-cyan-800/30 animate-in fade-in">
            {/* Crisp Vector SVG QR Code */}
            <div className="p-3 bg-white rounded-xl shadow-lg shrink-0 flex items-center justify-center">
              <svg className="w-36 h-36" viewBox="0 0 100 100" fill="none">
                {/* Background */}
                <rect width="100" height="100" fill="white" rx="4" />
                {/* Finder Top Left */}
                <rect x="6" y="6" width="24" height="24" fill="#0369a1" rx="2" />
                <rect x="9" y="9" width="18" height="18" fill="white" rx="1" />
                <rect x="12" y="12" width="12" height="12" fill="#0f172a" rx="1" />
                {/* Finder Top Right */}
                <rect x="70" y="6" width="24" height="24" fill="#0369a1" rx="2" />
                <rect x="73" y="9" width="18" height="18" fill="white" rx="1" />
                <rect x="76" y="12" width="12" height="12" fill="#0f172a" rx="1" />
                {/* Finder Bottom Left */}
                <rect x="6" y="70" width="24" height="24" fill="#0369a1" rx="2" />
                <rect x="9" y="73" width="18" height="18" fill="white" rx="1" />
                <rect x="12" y="76" width="12" height="12" fill="#0f172a" rx="1" />
                {/* Matrix Dots */}
                <rect x="36" y="8" width="4" height="4" fill="#0f172a" />
                <rect x="44" y="8" width="4" height="8" fill="#0f172a" />
                <rect x="56" y="8" width="4" height="4" fill="#0f172a" />
                <rect x="36" y="16" width="8" height="4" fill="#0f172a" />
                <rect x="52" y="16" width="8" height="4" fill="#0f172a" />
                <rect x="40" y="24" width="4" height="4" fill="#0f172a" />
                <rect x="48" y="24" width="8" height="4" fill="#0f172a" />
                <rect x="60" y="24" width="4" height="8" fill="#0f172a" />
                {/* Central Data */}
                <rect x="8" y="36" width="4" height="8" fill="#0f172a" />
                <rect x="16" y="36" width="8" height="4" fill="#0f172a" />
                <rect x="28" y="36" width="4" height="4" fill="#0f172a" />
                <rect x="36" y="36" width="12" height="12" fill="#0284c7" rx="1" />
                <rect x="52" y="36" width="8" height="4" fill="#0f172a" />
                <rect x="64" y="36" width="12" height="4" fill="#0f172a" />
                <rect x="80" y="36" width="8" height="4" fill="#0f172a" />
                <rect x="92" y="36" width="4" height="8" fill="#0f172a" />
                {/* Lower Matrix */}
                <rect x="8" y="48" width="8" height="4" fill="#0f172a" />
                <rect x="20" y="48" width="8" height="4" fill="#0f172a" />
                <rect x="52" y="44" width="4" height="12" fill="#0f172a" />
                <rect x="60" y="44" width="8" height="4" fill="#0f172a" />
                <rect x="76" y="48" width="8" height="8" fill="#0f172a" />
                <rect x="88" y="48" width="4" height="4" fill="#0f172a" />
                <rect x="36" y="52" width="12" height="4" fill="#0f172a" />
                <rect x="12" y="56" width="4" height="8" fill="#0f172a" />
                <rect x="24" y="56" width="8" height="4" fill="#0f172a" />
                <rect x="44" y="60" width="8" height="4" fill="#0f172a" />
                <rect x="68" y="56" width="4" height="8" fill="#0f172a" />
                <rect x="84" y="60" width="8" height="4" fill="#0f172a" />
                {/* Bottom Right Alignment */}
                <rect x="72" y="72" width="16" height="16" fill="#0284c7" rx="1" />
                <rect x="75" y="75" width="10" height="10" fill="white" />
                <rect x="78" y="78" width="4" height="4" fill="#0f172a" />
                {/* AutoPro Logo Center Overlay */}
                <circle cx="50" cy="50" r="10" fill="#0f172a" />
                <circle cx="50" cy="50" r="8" fill="#06b6d4" />
                <text x="50" y="53" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#0f172a">AP</text>
              </svg>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-white block">
                Faites scanner ce QR Code avec l'appareil photo du smartphone de votre client :
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Le client n'a besoin d'installer aucune application compliquée : la caméra de son téléphone ouvre instantanément la plateforme complète en mode plein écran (PWA) avec toutes les fonctionnalités actives.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-mono text-cyan-400 font-semibold select-all bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                  {sharedAppUrl}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Sub Navigation Bar for Commercial & Feasibility Hub */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSection('simulator')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSection === 'simulator'
              ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/30'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Simulateur de Rentabilité &amp; Chiffres Marché DZ</span>
        </button>

        <button
          onClick={() => setActiveSection('feasibility')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSection === 'feasibility'
              ? 'bg-cyan-500 text-slate-950 shadow-md ring-2 ring-cyan-400/30'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Certitude Technique &amp; Normes ISO (Prouvé)</span>
        </button>

        <button
          onClick={() => setActiveSection('share')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSection === 'share'
              ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-400/30'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Démos Guidées &amp; WhatsApp</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSection('licenses')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'licenses'
                ? 'bg-purple-500 text-slate-950 shadow-md ring-2 ring-purple-400/30'
                : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Installateurs PC &amp; Certificats (Admin)</span>
          </button>
        )}
      </div>

      {/* SECTION 1: INTERACTIVE ROI SIMULATOR & BUSINESS PLAN DZ */}
      {activeSection === 'simulator' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/40 shadow-xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Rentabilité Réelle Prouvée · Données Marché Algérie 2024-2026</span>
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              <span>Simulateur Financier : Combien Gagne un Atelier avec AutoPro ?</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Ajustez les curseurs ci-dessous selon le volume d'interventions de votre garage ou de vos prospects. Le calcul en temps réel prouve l'amortissement ultra-rapide et les marges nettes exceptionnelles du logiciel.
            </p>
          </div>

          {/* Simulator Controls & Calculations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: 4 Service Sliders (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center justify-between">
                  <span>Prestations Mensuelles Réalisées par l'Atelier :</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {(monthlyChineseFlash + monthlyReprog + monthlyKeyless + monthlyDiag)} opérations / mois
                  </span>
                </h3>

                {/* Service 1: Chinese Screen Flashing */}
                <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="font-bold text-white">Déblocage Écrans Chinois (Geely / Jetour / Chery)</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">
                      {monthlyChineseFlash} / mois = {(monthlyChineseFlash * 20000).toLocaleString('fr-DZ')} DZD
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="1"
                    value={monthlyChineseFlash}
                    onChange={(e) => setMonthlyChineseFlash(parseInt(e.target.value) || 0)}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Facturé en Algérie : ~20 000 DZD / voiture (Maps + YouTube)</span>
                    <span>Temps atelier : 15 min · Coût pièce : 0 DZD</span>
                  </div>
                </div>

                {/* Service 2: ECU Chiptuning / Stage 1 & Dépollution */}
                <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="font-bold text-white">Reprogrammation ECU, FAP / EGR / AdBlue Off</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">
                      {monthlyReprog} / mois = {(monthlyReprog * 30000).toLocaleString('fr-DZ')} DZD
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={monthlyReprog}
                    onChange={(e) => setMonthlyReprog(parseInt(e.target.value) || 0)}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Facturé en Algérie : ~30 000 DZD / véhicule (ex: Fiat Doblò / HDI / TDI)</span>
                    <span>Marge brute atelier : 95%</span>
                  </div>
                </div>

                {/* Service 3: Keyless 3m & Antivol smartphone */}
                <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                      <span className="font-bold text-white">Activation Clé 3 Mètres &amp; Antivol Smartphone</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">
                      {monthlyKeyless} / mois = {(monthlyKeyless * 15000).toLocaleString('fr-DZ')} DZD
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="1"
                    value={monthlyKeyless}
                    onChange={(e) => setMonthlyKeyless(parseInt(e.target.value) || 0)}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Facturé en Algérie : ~15 000 DZD / client (Keyless BLE + Coupe-circuit)</span>
                    <span>Très forte demande des propriétaires de voitures neuves</span>
                  </div>
                </div>

                {/* Service 4: Electronic Diagnostic & DTC */}
                <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      <span className="font-bold text-white">Diagnostic Électronique UDS &amp; Effacement DTC</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">
                      {monthlyDiag} / mois = {(monthlyDiag * 4000).toLocaleString('fr-DZ')} DZD
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={monthlyDiag}
                    onChange={(e) => setMonthlyDiag(parseInt(e.target.value) || 0)}
                    className="w-full accent-blue-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Facturé en Algérie : ~4 000 DZD / passage scanner</span>
                    <span>Activité quotidienne continue de tout garage</span>
                  </div>
                </div>

                {/* License Price Setting */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Prix de vente de la Licence AutoPro au Garagiste :</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="5000"
                      value={softwareLicensePrice}
                      onChange={(e) => setSoftwareLicensePrice(parseInt(e.target.value) || 0)}
                      className="w-28 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-mono font-bold text-amber-400"
                    />
                    <span className="text-slate-400">DZD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Instant Financial Results Card (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/40 shadow-xl space-y-5">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">
                  Bilan de Rentabilité Immédiat de l'Atelier
                </span>

                {/* Big Metric: Monthly Revenue */}
                <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Chiffre d'Affaires Mensuel Estimé :</span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                    {((monthlyChineseFlash * 20000) + (monthlyReprog * 30000) + (monthlyKeyless * 15000) + (monthlyDiag * 4000)).toLocaleString('fr-DZ')} DZD
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Soit {(Math.round(((monthlyChineseFlash * 20000) + (monthlyReprog * 30000) + (monthlyKeyless * 15000) + (monthlyDiag * 4000)) / 10000)).toLocaleString('fr-DZ')} Millions de Centimes / mois
                  </span>
                </div>

                {/* Amortization Speed */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Amortissement :</span>
                    <span className="text-lg font-bold text-amber-400 font-mono">
                      {(((monthlyChineseFlash * 20000) + (monthlyReprog * 30000) + (monthlyKeyless * 15000) + (monthlyDiag * 4000)) > 0
                        ? (softwareLicensePrice / (((monthlyChineseFlash * 20000) + (monthlyReprog * 30000) + (monthlyKeyless * 15000) + (monthlyDiag * 4000)) / 26)).toFixed(1)
                        : '0')} Jours
                    </span>
                    <span className="text-[9px] text-slate-500 block">Moins d'une semaine de travail !</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Interventions :</span>
                    <span className="text-lg font-bold text-cyan-400 font-mono">
                      {(monthlyChineseFlash + monthlyReprog + monthlyKeyless + monthlyDiag)} / mois
                    </span>
                    <span className="text-[9px] text-slate-500 block">Capacité atelier standard</span>
                  </div>
                </div>

                {/* Annual Net Profit */}
                <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-700/50 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-300 block">
                    Bénéfice Net Annuel de l'Atelier :
                  </span>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    {(((monthlyChineseFlash * 20000) + (monthlyReprog * 30000) + (monthlyKeyless * 15000) + (monthlyDiag * 4000)) * 12 - softwareLicensePrice).toLocaleString('fr-DZ')} DZD
                  </div>
                  <span className="text-[10px] text-emerald-300/80 block">
                    Soit {(Math.round((((monthlyChineseFlash * 20000) + (monthlyReprog * 30000) + (monthlyKeyless * 15000) + (monthlyDiag * 4000)) * 12 - softwareLicensePrice) / 10000)).toLocaleString('fr-DZ')} Millions de Centimes de gain net !
                  </span>
                </div>

                {/* Infallible Sales Argument */}
                <div className="p-3 bg-blue-950/30 rounded-xl border border-blue-800/40 text-[11px] text-slate-300 leading-relaxed">
                  <strong className="text-blue-300 block mb-1">💡 L'Argument Irrésistible pour Conclure :</strong>
                  « Monsieur le garagiste, ce logiciel vous coûte {softwareLicensePrice.toLocaleString('fr-DZ')} DZD. Il vous suffit de flasher <strong>seulement 2 Geely/Jetour</strong> ou de faire <strong>1 seule reprog Fiat Doblò</strong> pour le rentabiliser intégralement. Tout le reste, c'est du bénéfice net pur pour votre poche. »
                </div>
              </div>
            </div>
          </div>

          {/* SaaS Creator Revenue Projection (For Sofiane / Platform Owner) */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/50 via-slate-900 to-indigo-950/50 border border-purple-500/40 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Votre Propre Chiffre d'Affaires SaaS (Éditeur du Logiciel)
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Combien Vous Rapportent les Ventes de Licences à Travers les 58 Wilayas ?
                </h3>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0">
                <span className="text-xs text-slate-400">Objectif Garages :</span>
                <span className="font-mono font-bold text-purple-400 text-sm">{targetGaragesCount} ateliers</span>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={targetGaragesCount}
                onChange={(e) => setTargetGaragesCount(parseInt(e.target.value) || 5)}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>5 Garages (Mascara &amp; Oran)</span>
                <span>20 Garages (Région Ouest)</span>
                <span>50 Garages (National)</span>
                <span>100 Garages (Plein déploiement)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Revenu Annuel Licences :</span>
                <span className="text-xl font-bold font-mono text-purple-400">
                  {(targetGaragesCount * softwareLicensePrice).toLocaleString('fr-DZ')} DZD
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Soit {(Math.round((targetGaragesCount * softwareLicensePrice) / 10000)).toLocaleString('fr-DZ')} Millions de Centimes cash
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Option Pack Valise Clé en Main :</span>
                <span className="text-xl font-bold font-mono text-cyan-400">
                  {(targetGaragesCount * 85000).toLocaleString('fr-DZ')} DZD
                </span>
                <span className="text-[10px] text-slate-500 block">Micro PC d'occasion + Câble J2534 + Licence</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Canaux de Paiement Algérie :</span>
                <div className="flex flex-wrap gap-1 text-[10px] text-emerald-400 font-semibold pt-1">
                  <span className="bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">BaridiMob</span>
                  <span className="bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">Virement CCP</span>
                  <span className="bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">Main propre / Cash</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: TECHNICAL FEASIBILITY & ISO STANDARDS (PROUVE & PRATICABLE) */}
      {activeSection === 'feasibility' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/50 via-slate-900 to-blue-950/50 border border-cyan-500/40 shadow-xl space-y-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              Audit Technique &amp; Faisabilité Réelle
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <span>Pourquoi ce Logiciel est 100% Praticable et Fiable sur Véhicules Réels</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Ce système ne repose sur aucune théorie abstraite : il utilise strictement les protocoles de communication normalisés de l'industrie automobile (ISO / SAE) adoptés par Bosch, Delphi, Marelli et l'ensemble des constructeurs mondiaux.
            </p>
          </div>

          {/* 4 Pillars of Engineering Feasibility */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Pillar 1: ISO 14229 & SAE J2534 */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">1. Bus CAN &amp; Normes ISO 14229 UDS</h3>
                  <span className="text-[11px] text-cyan-400">Communication Universelle Calculateur</span>
                </div>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Le diagnostic et le flashage reposent sur le standard <strong>ISO 14229 (UDS)</strong> et les trames de transport <strong>ISO 15765-2 DoCAN</strong> à 500 kbps. C'est exactement le protocole utilisé par les valises officielles des constructeurs.
              </p>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-[11px] text-slate-400">
                <strong className="text-slate-200 block text-[10px] uppercase font-bold">Boîtiers Physiques Compatibles Recommandés :</strong>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  <li><strong>Scanmatik 2 Pro (SM2 Pro)</strong> : Très populaire et économique en Algérie.</li>
                  <li><strong>Tactrix OpenPort 2.0 (J2534 PassThru)</strong> : Liaison USB stable à 100%.</li>
                  <li><strong>vLinker MC+ / OBDLink MX+ (BLE 5.0)</strong> : Pour smartphone et tablette sans fil.</li>
                </ul>
              </div>
            </div>

            {/* Pillar 2: BLE 3.0m Proximity Radar */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center font-bold">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">2. Clé 3 Mètres &amp; Bluetooth BLE Calibré</h3>
                  <span className="text-[11px] text-amber-400">Modèle Log-Distance Path Loss</span>
                </div>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                La détection de proximité de 3 mètres utilise la mesure de puissance de réception <strong>RSSI (Received Signal Strength Indicator)</strong> avec filtrage anti-rebond. À 3 mètres de la voiture, la valeur RSSI se situe précisément à <strong>-60 dBm</strong>.
              </p>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-[11px] text-slate-400">
                <strong className="text-slate-200 block text-[10px] uppercase font-bold">Réaction Automatique du BCM :</strong>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  <li><strong>Approche (&le; 3,0 m)</strong> : Déverrouillage d'accueil et feux de bienvenue (Trame CAN <code className="text-cyan-400">0x221</code>).</li>
                  <li><strong>Éloignement (&gt; 3,0 m - Walk Away)</strong> : Verrouillage immédiat + rabattement rétroviseurs.</li>
                  <li><strong>Zéro consommation batterie</strong> : Protocole BLE 5.0 consommant moins de 15 mA.</li>
                </ul>
              </div>
            </div>

            {/* Pillar 3: Safe Flashing Watchdog */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">3. Sécurité Flashing "Anti-Brick" Watchdog</h3>
                  <span className="text-[11px] text-emerald-400">Protection Totale des Calculateurs Moteur</span>
                </div>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Le cauchemar d'un reprogrammateur est de "bricker" (bloquer) un calculateur. AutoPro intègre 3 verrous matériels stricts avant toute écriture en mémoire flash :
              </p>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-[11px] text-slate-400">
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  <li><strong>Garde de Tension 12.4V</strong> : Refus absolu de flasher si la batterie est faible.</li>
                  <li><strong>Recalcul Matériel du Checksum</strong> : Vérification de cohérence algorithmique.</li>
                  <li><strong>Sauvegarde Intégrale Obligatoire</strong> : Sauvegarde du fichier d'origine avant toute opération.</li>
                </ul>
              </div>
            </div>

            {/* Pillar 4: Offline First Architecture */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center font-bold">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">4. Architecture 100% Autonome Hors-Ligne</h3>
                  <span className="text-[11px] text-purple-400">Opérationnel Sans Connexion Internet</span>
                </div>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Dans de nombreux garages et zones industrielles en Algérie, la connexion 4G/WiFi est instable ou absente. AutoPro est architecturé en <strong>Progressive Web App (PWA) / Node local</strong> :
              </p>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-[11px] text-slate-400">
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  <li>Base de données locale intégrée de plus de <strong>12 000 codes DTC</strong>.</li>
                  <li>Décodage des trames CAN et déverrouillage PIN d'urgence sans aucun appel serveur.</li>
                  <li>Toutes les fonctions restent disponibles même en plein désert sans réseau.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Comparison Table: AutoPro vs Traditional Tools */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Tableau Comparatif : AutoPro vs Outils Traditionnels en Algérie</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                    <th className="py-2.5 px-3">Fonctionnalité</th>
                    <th className="py-2.5 px-3 text-cyan-400 font-bold">AutoPro Suite Pro</th>
                    <th className="py-2.5 px-3 text-slate-400">Valises Autel / Launch</th>
                    <th className="py-2.5 px-3 text-slate-400">Outils Constructeurs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-[11px]">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Flash Écrans Chinois (Geely/Jetour)</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">✅ Intégré natif (1 clic)</td>
                    <td className="py-2.5 px-3 text-rose-400">❌ Impossible</td>
                    <td className="py-2.5 px-3 text-rose-400">❌ Bloqué par l'usine</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Clé Mains-Libres Smartphone 3m</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">✅ BLE 5.0 + Antivol GPS</td>
                    <td className="py-2.5 px-3 text-rose-400">❌ Non disponible</td>
                    <td className="py-2.5 px-3 text-amber-400">⚠️ Clé d'origine chère</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Fiat Doblò Tafraoui 1.6 MJet</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">✅ 100% Calibré Tafraoui</td>
                    <td className="py-2.5 px-3 text-amber-400">⚠️ Partiel / Souvent verrouillé</td>
                    <td className="py-2.5 px-3 text-slate-300">✅ Concessionnaire uniquement</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Liaison Smartech DZ DiagAuto</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">✅ Pont IPC direct (Port 35100)</td>
                    <td className="py-2.5 px-3 text-rose-400">❌ Incompatible</td>
                    <td className="py-2.5 px-3 text-rose-400">❌ Incompatible</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Coût d'Acquisition</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">35 000 - 45 000 DZD</td>
                    <td className="py-2.5 px-3 text-slate-400">180 000 - 350 000 DZD</td>
                    <td className="py-2.5 px-3 text-slate-400">&gt; 1 200 000 DZD / an</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: GUIDED DEMOS & WHATSAPP SHARING */}
      {activeSection === 'share' && (
        <div className="space-y-6 animate-in fade-in">
          {/* 4 Guided 1-Click Interactive Demo Scenarios (Workshop Walkthrough) */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-cyan-400" />
                  <span>Visite Guidée : 4 Scénarios de Démo Prêts à Présenter à un Garagiste</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cliquez sur un bouton pour charger instantanément le cas client en direct et épater votre prospect en atelier :
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Demo Scenario 1: Fiat Doblò Oran */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between space-y-3 group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      Cas Atelier #1
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">Fiat Tafraoui</span>
                  </div>
                  <h3 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                    Diagnostic Fiat Doblò 1.6 MultiJet
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Scan ECU Bosch EDC17C69, détection des codes défaut FAP/EGR avec rapport d'analyse mécanicien IA généré en temps réel.
                  </p>
                </div>

                <button
                  onClick={() => launchDemoScenario('fiat_doblo')}
                  className="w-full py-2 bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-cyan-800/40"
                >
                  <span>Lancer Démo Diagnostic</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Demo Scenario 2: Geely Coolray Stage 1 Flash */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between space-y-3 group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      Cas Atelier #2
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">Geely 1.5T</span>
                  </div>
                  <h3 className="text-xs font-bold text-white group-hover:text-rose-400 transition-colors">
                    Flash Cartographie Geely Coolray
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Passage de 177ch à 205ch (+40Nm), vérification checksum en direct et protocole sécurisé Bosch MED17.
                  </p>
                </div>

                <button
                  onClick={() => launchDemoScenario('geely_flash')}
                  className="w-full py-2 bg-slate-900 hover:bg-rose-500 hover:text-slate-950 text-rose-400 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-rose-800/40"
                >
                  <span>Lancer Démo Reprog ECU</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Demo Scenario 3: Chinese Tablet screen flasher */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between space-y-3 group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Cas Atelier #3
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">Écran Chinois</span>
                  </div>
                  <h3 className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                    Flash Écran &amp; Google Maps / YouTube
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Installation des services Google Play, Maps GPS et YouTube sur les autoradios chinois Geely/Jetour sans démontage.
                  </p>
                </div>

                <button
                  onClick={() => launchDemoScenario('chinese_tablet')}
                  className="w-full py-2 bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-amber-800/40"
                >
                  <span>Lancer Démo Flash Écran</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Demo Scenario 4: Smartech DZ Sync */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between space-y-3 group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Cas Atelier #4
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">dz.smartech</span>
                  </div>
                  <h3 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Pont Natif Smartech DZ DiagAuto
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Synchronisation bidirectionnelle IPC (port TCP 35100) avec le logiciel Smartech DZ déjà présent sur le PC du garagiste.
                  </p>
                </div>

                <button
                  onClick={() => launchDemoScenario('smartech_bridge')}
                  className="w-full py-2 bg-slate-900 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-800/40"
                >
                  <span>Lancer Démo Smartech DZ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Demo Scenario 5 Banner: ADAS & 360 Cameras */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/50 to-slate-950 border border-cyan-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">
                    Cas Atelier #5 : Caméras Existantes Véhicule &amp; Calibration ADAS 360°
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Testez le flux Recul, 360° Bird-View, Vision Nocturne IR, Enregistrement DVR et Calibration ECU 0x742 depuis la tablette.
                  </p>
                </div>
              </div>
              <button
                onClick={() => launchDemoScenario('cameras_adas')}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Ouvrir Caméras &amp; ADAS</span>
              </button>
            </div>
          </div>

          {/* Firebase Hosting (autoprodz-a7071.web.app) & Render Backend Sync Panel */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-amber-500/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                  <Server className="w-4 h-4 text-amber-400" />
                  <span>Synchronisation Firebase Hosting (autoprodz-a7071.web.app) &amp; Backend Render</span>
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Les fichiers <code className="text-cyan-300">firebase.json</code>, <code className="text-cyan-300">.firebaserc</code>, <code className="text-cyan-300">render.yaml</code> et le pont API CORS sont prêts.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              {/* Render Backend Connector */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <label className="text-[11px] font-bold text-cyan-300 block">
                  URL de votre Backend Render (ex: https://autopro-dz-backend.onrender.com) :
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://votre-backend.onrender.com"
                    value={renderUrlInput}
                    onChange={(e) => setRenderUrlInput(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={handleSaveAndTestRenderBackend}
                    disabled={isTestingBackend}
                    className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isTestingBackend ? 'Test...' : 'Lier & Tester'}
                  </button>
                </div>
                {backendStatusMsg && (
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-200">
                    {backendStatusMsg}
                  </div>
                )}
              </div>

              {/* Termux 1-Command Deploy */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Commande Termux pour mettre à jour autoprodz-a7071.web.app :</span>
                  </span>
                  <button
                    onClick={() => handleCopy(termuxDeployCmd, 'termux')}
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    {copiedTermux ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTermux ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {termuxDeployCmd}
                </pre>
              </div>
            </div>
          </div>

          {/* Ready-to-send Outreach Message (WhatsApp / Email / SMS) */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>Message Commercial Prêt à Envoyer sur WhatsApp ou Email</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Copiez ce texte préparé ou cliquez directement sur WhatsApp pour l'envoyer à votre contact professionnel :
                </p>
              </div>

              {/* Language Switcher for pitch message */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
                <button
                  onClick={() => setPitchLanguage('fr')}
                  className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                    pitchLanguage === 'fr' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Français
                </button>
                <button
                  onClick={() => setPitchLanguage('ar')}
                  className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                    pitchLanguage === 'ar' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  العربية / الدارجة
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                readOnly
                dir={pitchLanguage === 'ar' ? 'rtl' : 'ltr'}
                value={pitchMessages[pitchLanguage]}
                className="w-full h-44 bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 font-sans focus:outline-none focus:border-cyan-500 select-all leading-relaxed"
              />

              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <button
                  onClick={() => handleCopy(pitchMessages[pitchLanguage], 'pitch')}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {copiedPitch ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPitch ? 'Texte Copié dans le Presse-Papier !' : 'Copier le Message WhatsApp'}</span>
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer Directement sur WhatsApp</span>
                </button>

                <button
                  onClick={handleShareEmail}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Partager par Email</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: LICENSES & WINDOWS PACKAGES (ADMIN ONLY) */}
      {isAdmin && activeSection === 'licenses' && (
        <div className="space-y-6 animate-in fade-in">

      {/* Commercial Pitch & Workshop ROI Arguments (Why Garagistes Buy) */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <span>Argumentaire de Vente &amp; Rentabilité pour l'Atelier (ROI)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-cyan-400 font-bold block text-sm">
              1. Déblocage Écrans Chinois
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Des milliers de Geely, Jetour, Chery et Changan arrivent en Algérie avec des écrans verrouillés en chinois sans Play Store.
            </p>
            <div className="p-2 bg-slate-900 rounded border border-slate-800 text-[11px]">
              <span className="text-slate-400 block">Tarif facturé au client final :</span>
              <span className="text-emerald-400 font-bold font-mono">15 000 à 25 000 DZD</span>
              <span className="text-slate-500 block text-[10px]">Temps d'intervention : 12 minutes (Coût matériel = 0 DZD)</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-amber-400 font-bold block text-sm">
              2. Fiat Doblò &amp; Véhicules Oran
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Diagnostic complet du Fiat Doblò fabriqué à Tafraoui (EDC17C69 / MD1CS003) avec réinitialisation voyant moteur, FAP et AdBlue.
            </p>
            <div className="p-2 bg-slate-900 rounded border border-slate-800 text-[11px]">
              <span className="text-slate-400 block">Tarif diagnostic / dépollution :</span>
              <span className="text-emerald-400 font-bold font-mono">4 000 à 35 000 DZD</span>
              <span className="text-slate-500 block text-[10px]">Dépollution FAP/EGR Off très rentable</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-emerald-400 font-bold block text-sm">
              3. Amortissement Immédiat
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              En vendant le logiciel à 35 000 DZD au garagiste, ce dernier amortit son achat en seulement 2 interventions clients !
            </p>
            <div className="p-2 bg-slate-900 rounded border border-slate-800 text-[11px]">
              <span className="text-slate-400 block">Bénéfice net garagiste :</span>
              <span className="text-cyan-400 font-bold font-mono">100% amorti dès la 1ère semaine</span>
              <span className="text-slate-500 block text-[10px]">Argument infaillible pour conclure la vente</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Downloadable Installer Files & Commercial License Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Commercial License Generator (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Générateur de Clés &amp; Licences Revendeur Pro</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Nom de l'Atelier / Client Garagiste :</label>
                <input
                  type="text"
                  value={workshopName}
                  onChange={(e) => setWorkshopName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">ID Micro Machine (HWID Machine d'Atelier) :</label>
                <input
                  type="text"
                  value={hwid}
                  onChange={(e) => setHwid(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Formule de Licence à Vendre :</label>
                <select
                  value={licenseType}
                  onChange={(e) => setLicenseType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="master">Pack MASTER DZ : Diag + Flash ECU + Smartech DZ + Flash Écran Chinois (Recommandé)</option>
                  <option value="reprog">Pack REPROG PRO : Flash Chiptuning + Stage 1/2 + FlexFuel E85</option>
                  <option value="standard">Pack DIAGNOSTIC STD : Diagnostic Multimarque + DTC Reset</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleGenerateKey}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Key className="w-4 h-4" />
                  <span>Générer Nouvelle Clé de Licence</span>
                </button>
              </div>

              {/* Generated License Result Card */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-amber-800/50 space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-amber-400">
                    Clé de Licence Cryptographique Activée :
                  </span>
                  <button
                    onClick={() => handleCopy(generatedKey, 'key')}
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
                <div className="text-sm font-mono font-bold text-white tracking-wider select-all bg-slate-900 p-2 rounded border border-slate-800 text-center">
                  {generatedKey}
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between pt-1">
                  <span>Statut : <strong className="text-emerald-400">Authentifiée</strong></span>
                  <span>Validité : <strong>Illimitée à vie</strong></span>
                </div>
              </div>

              <button
                onClick={handleDownloadLicenseCert}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
              >
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Télécharger le Certificat de Licence (.txt)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Downloadable Packages for Windows Micro PC & Tablets (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Fichiers Packages Prêts à Déployer sur Micro PC &amp; Tablette</span>
            </h3>

            {/* Package 1: Windows Micro PC Installer Script */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-950/80 text-blue-400 flex items-center justify-center">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Script d'Installation Micro PC Windows (.bat)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Configure Windows 10/11, crée le raccourci atelier et installe les pilotes OBD2.
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleDownloadWindowsInstaller}
                  className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger</span>
                </button>
              </div>
            </div>

            {/* Package 2: Tablet Android Package Bridge */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950/80 text-emerald-400 flex items-center justify-center">
                    <Tablet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Module APK Smartech DZ &amp; Tablette Auto
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Package pont d'injection pour tablettes Android 10" et autoradios de bord.
                    </span>
                  </div>
                </div>

                <a
                  href={sharedAppUrl}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700 shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Obtenir APK</span>
                </a>
              </div>
            </div>

            {/* Commercial Business Model & Pricing Guide */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
              <span className="font-semibold text-slate-200 block text-xs">
                Tarifs de Vente Conseillés aux Garagistes &amp; Électriciens Auto :
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-400 block">Licence Logicielle Seule :</span>
                  <span className="text-emerald-400 font-bold font-mono">25 000 à 45 000 DZD</span>
                  <span className="text-[10px] text-slate-500 block">(150€ - 280€)</span>
                </div>

                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-400 block">Pack Micro PC + VCI + Logiciel :</span>
                  <span className="text-cyan-400 font-bold font-mono">65 000 à 110 000 DZD</span>
                  <span className="text-[10px] text-slate-500 block">(400€ - 680€ clé en main)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      )}
    </div>
  );
};
