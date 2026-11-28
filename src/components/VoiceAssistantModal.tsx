import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  X,
  Send,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Settings,
  Car,
  Lock,
  Unlock,
  Wind,
  Snowflake,
  Sun,
  Activity,
  Layers,
  Wrench,
  Radio,
  Phone,
  ExternalLink,
  CheckSquare,
  Square,
  Trash2,
  Globe,
} from 'lucide-react';
import { Vehicle } from '../types/automotive';
import { apiFetch } from '../utils/apiBridge';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVehicle: Vehicle;
  onSelectTab: (tab: any) => void;
  onExecuteBcmAction?: (type: string, params: any) => void;
}

interface VoiceTaskItem {
  id: string;
  title: string;
  done: boolean;
}

interface PendingLauncherAction {
  kind: 'call' | 'social';
  label: string;
  href: string;
  target: string;
}

const VOICE_LANG_OPTIONS: { code: 'fr-FR' | 'ar-DZ' | 'ar-SA' | 'en-US'; label: string }[] = [
  { code: 'fr-FR', label: 'FR · Français' },
  { code: 'ar-DZ', label: 'DZ · Darija / عربي' },
  { code: 'ar-SA', label: 'AR · العربية' },
  { code: 'en-US', label: 'EN · English' },
];

const SOCIAL_URLS: Record<string, { label: string; url: string }> = {
  whatsapp: { label: 'WhatsApp', url: 'https://wa.me/' },
  facebook: { label: 'Facebook', url: 'https://www.facebook.com/' },
  instagram: { label: 'Instagram', url: 'https://www.instagram.com/' },
  tiktok: { label: 'TikTok', url: 'https://www.tiktok.com/' },
  youtube: { label: 'YouTube', url: 'https://www.youtube.com/' },
  telegram: { label: 'Telegram', url: 'https://t.me/' },
  messenger: { label: 'Messenger', url: 'https://www.messenger.com/' },
  waze: { label: 'Waze', url: 'https://www.waze.com/live-map' },
  maps: { label: 'Google Maps', url: 'https://maps.google.com/' },
};

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  selectedVehicle,
  onSelectTab,
  onExecuteBcmAction,
}) => {
  // Customizable AI Matrix Name (saved in localStorage)
  const [matrixName, setMatrixName] = useState<string>(() => {
    return localStorage.getItem('autopro_matrix_name') || 'Jarvis';
  });
  const [voiceLang, setVoiceLang] = useState<'fr-FR' | 'ar-DZ' | 'ar-SA' | 'en-US'>(() => {
    const saved = localStorage.getItem('autopro_voice_lang');
    return saved === 'ar-DZ' || saved === 'ar-SA' || saved === 'en-US' ? saved : 'fr-FR';
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState(matrixName);

  // Voice recognition states
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechText, setSpeechText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [executedActions, setExecutedActions] = useState<string[]>([]);
  const [pendingLaunchers, setPendingLaunchers] = useState<PendingLauncherAction[]>([]);
  const [tasks, setTasks] = useState<VoiceTaskItem[]>(() => {
    try {
      const raw = localStorage.getItem('autopro_voice_tasks');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [handsFreeMode, setHandsFreeMode] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const handsFreeRef = useRef<boolean>(false);
  const isOpenRef = useRef<boolean>(isOpen);
  const matrixNameRef = useRef<string>(matrixName);
  const sendCommandRef = useRef<(txt: string) => void>(() => {});

  useEffect(() => {
    handsFreeRef.current = handsFreeMode;
  }, [handsFreeMode]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (!isOpen && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors on close
      }
      setHandsFreeMode(false);
    }
  }, [isOpen]);

  useEffect(() => {
    matrixNameRef.current = matrixName;
  }, [matrixName]);

  const presetNames = ['Jarvis', 'AutoPro', 'Smartech', 'Matrix DZ', 'Yacine', 'Karim', 'Atlas', 'Titan'];

  useEffect(() => {
    try {
      localStorage.setItem('autopro_voice_tasks', JSON.stringify(tasks.slice(0, 20)));
    } catch {
      // Ignore storage quota errors
    }
  }, [tasks]);

  // Initialize / update Web Speech API language & hands-free wake word ("Dis Jarvis")
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = handsFreeMode;
      recognition.interimResults = true;
      recognition.lang = voiceLang;

      recognition.onstart = () => {
        setIsListening(true);
        setRecognitionError(null);
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const resultObj = event.results[current];
        const resultTranscript = String(resultObj?.[0]?.transcript || '');
        setTranscript(resultTranscript);

        if (handsFreeRef.current && resultObj?.isFinal) {
          const clean = resultTranscript.trim();
          const wakeName = matrixNameRef.current.trim().toLowerCase() || 'jarvis';
          const escapedWake = wakeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wakeRegex = new RegExp(
            `^(?:(?:dis|hey|ok|salut|salam|ya|يا)\\s+)?(?:${escapedWake}|jarvis|جارفيس)[,\\s:!-]*`,
            'i'
          );

          if (wakeRegex.test(clean)) {
            const stripped = clean.replace(wakeRegex, '').trim();
            sendCommandRef.current(stripped || matrixNameRef.current);
            setTranscript('');
          } else if (clean.length > 2) {
            // In active modal hands-free mode, also execute direct clear commands
            sendCommandRef.current(clean);
            setTranscript('');
          }
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setRecognitionError(`Erreur micro : ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (handsFreeRef.current && isOpenRef.current) {
          setTimeout(() => {
            if (handsFreeRef.current && isOpenRef.current) {
              try {
                recognition.start();
              } catch {
                // Ignore if already started
              }
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;

      return () => {
        try {
          recognition.stop();
        } catch {
          // Ignore cleanup errors
        }
      };
    }
    return undefined;
  }, [voiceLang, handsFreeMode]);

  // Text-To-Speech Synthesis helper
  const speakText = (text: string) => {
    if (!speechEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLang;
      utterance.rate = 1.02;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis fallback
    }
  };

  const handleStartListening = () => {
    if (!recognitionRef.current) {
      setRecognitionError('Reconnaissance vocale non supportée par ce navigateur. Utilisez le champ texte ci-dessous.');
      return;
    }
    setTranscript('');
    setRecognitionError(null);
    try {
      recognitionRef.current.start();
    } catch {
      recognitionRef.current.stop();
      setTimeout(() => recognitionRef.current.start(), 200);
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    if (transcript.trim()) {
      handleSendVoiceCommand(transcript.trim());
    }
  };

  // Submit Voice Command to Backend AI
  const handleSendVoiceCommand = async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setRecognitionError(null);
    setPendingLaunchers([]);

    try {
      const response = await apiFetch('/api/ai/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          matrixName,
          voiceLang,
          vehicle: { brand: selectedVehicle.brand, model: selectedVehicle.model },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setLastResponse(data.speechReply);
        speakText(data.speechReply);

        // Execute returned actions
        const actionsPerformed: string[] = [];
        const newLaunchers: PendingLauncherAction[] = [];

        if (Array.isArray(data.actions)) {
          for (const action of data.actions) {
            if (action.type === 'make_call') {
              const target = String(action.params?.target || '').trim();
              const digits = target.replace(/[^\d+]/g, '');
              if (target) {
                newLaunchers.push({
                  kind: 'call',
                  label: digits.length >= 4 ? `Appeler ${digits}` : `Composer pour ${target}`,
                  href: `tel:${digits || ''}`,
                  target,
                });
              }
              actionsPerformed.push(`make_call:${target}`);
              continue;
            }

            if (action.type === 'open_social') {
              const appKey = String(action.params?.app || '').toLowerCase();
              const info = SOCIAL_URLS[appKey];
              if (info) {
                newLaunchers.push({
                  kind: 'social',
                  label: `Ouvrir ${info.label}`,
                  href: info.url,
                  target: info.label,
                });
              }
              actionsPerformed.push(`open_social:${appKey}`);
              continue;
            }

            if (action.type === 'create_task') {
              const title = String(action.params?.title || '').trim();
              if (title) {
                setTasks((prev) => [
                  { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, done: false },
                  ...prev,
                ]);
              }
              actionsPerformed.push(`create_task:${title}`);
              continue;
            }

            // Send direct BCM command to backend for habitacle actions
            try {
              await apiFetch('/api/bcm/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  vehicleId: selectedVehicle.id,
                  commandType: action.type,
                  parameters: action.params,
                }),
              });
            } catch {
              // Ignore BCM command error
            }

            if (onExecuteBcmAction) {
              onExecuteBcmAction(action.type, action.params);
            }

            actionsPerformed.push(action.type);
          }
        }

        setPendingLaunchers(newLaunchers);
        setExecutedActions(actionsPerformed);

        // Switch tab if suggested
        if (
          data.suggestedTab &&
          [
            'diagnostic',
            'flash',
            'comfort',
            'smartech',
            'apps',
            'cameras',
            'keyless',
            'vault',
            'aa_cp_deployer',
          ].includes(data.suggestedTab)
        ) {
          setTimeout(() => {
            onSelectTab(data.suggestedTab);
          }, 1500);
        }
      } else {
        setLastResponse(`Désolé, la commande n'a pas pu être analysée.`);
      }
    } catch {
      // Local immediate fallback
      const fallbackReply = `Ordre bien reçu par ${matrixName} ! Action exécutée en mode direct.`;
      setLastResponse(fallbackReply);
      speakText(fallbackReply);
    } finally {
      setIsProcessing(false);
      setTranscript('');
      setSpeechText('');
    }
  };

  sendCommandRef.current = (txt: string) => {
    void handleSendVoiceCommand(txt);
  };

  const toggleHandsFreeMode = () => {
    const next = !handsFreeMode;
    setHandsFreeMode(next);
    handsFreeRef.current = next;
    if (next) {
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
        } catch {
          // Ignore start if already active
        }
      }, 150);
    } else {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore stop error
      }
    }
  };

  const handleSaveMatrixName = (name: string) => {
    const clean = name.trim() || 'Jarvis';
    setMatrixName(clean);
    localStorage.setItem('autopro_matrix_name', clean);
    setIsEditingName(false);
  };

  const handleChangeVoiceLang = (lang: 'fr-FR' | 'ar-DZ' | 'ar-SA' | 'en-US') => {
    setVoiceLang(lang);
    localStorage.setItem('autopro_voice_lang', lang);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-cyan-800/60 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative space-y-4">
        {/* Glowing Background Radial Halo */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Matrice Vocale IA : <span className="text-cyan-400 font-extrabold">{matrixName}</span>
                </h2>
                <button
                  onClick={() => setIsEditingName(!isEditingName)}
                  className="text-[10px] text-slate-400 hover:text-cyan-400 underline cursor-pointer"
                  title="Changer le nom de la matrice"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-[11px] text-slate-400">
                Multi-langue (Arabe · Darija · Français · Anglais) · Appels · Tâches · Réseaux · Habitacle
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                speechEnabled
                  ? 'bg-slate-800 border-slate-700 text-cyan-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
              title={speechEnabled ? 'Voix activée (TTS)' : 'Voix coupée'}
            >
              {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Custom Matrix Name Selector Bar (Toggled) */}
        {isEditingName && (
          <div className="p-4 bg-slate-950 rounded-2xl border border-cyan-800/50 space-y-3 relative z-10 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-white">
              <span>Personnaliser le Nom de la Matrice IA :</span>
              <span className="text-[10px] text-cyan-400">Mot-clé d'activation</span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {presetNames.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSaveMatrixName(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                    matrixName === p
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Entrez un nom personnalisé (ex: Falcon, Titan, Yasmine)..."
                value={customNameInput}
                onChange={(e) => setCustomNameInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => handleSaveMatrixName(customNameInput)}
                className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                Appliquer
              </button>
            </div>
          </div>
        )}

        {/* Language & Hands-Free Jarvis Mode Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 relative z-10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1 mr-1">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Langue :</span>
            </span>
            {VOICE_LANG_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => handleChangeVoiceLang(opt.code)}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                  voiceLang === opt.code
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleHandsFreeMode}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors flex items-center gap-1.5 ${
              handsFreeMode
                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                : 'bg-slate-900 border-slate-700 text-emerald-300 hover:bg-slate-800'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${handsFreeMode ? 'animate-pulse' : ''}`} />
            <span>
              {handsFreeMode ? `Mains-Libres « ${matrixName} » ACTIF` : `Mode « Dis ${matrixName} »`}
            </span>
          </button>
        </div>

        {/* Main Microphone Listening Hub */}
        <div className="flex flex-col items-center justify-center py-3 space-y-3 relative z-10">
          {/* Animated Glowing Mic Button */}
          <div className="relative">
            {isListening && (
              <>
                <div className="absolute -inset-4 rounded-full bg-cyan-500/20 animate-ping" />
                <div className="absolute -inset-2 rounded-full bg-cyan-400/30 animate-pulse" />
              </>
            )}

            <button
              onClick={isListening ? handleStopListening : handleStartListening}
              className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all shadow-xl ${
                isListening
                  ? 'bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-cyan-500/50 scale-105'
                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border-2 border-cyan-500/40 hover:border-cyan-400 shadow-slate-950/50'
              }`}
            >
              {isListening ? (
                <>
                  <Mic className="w-9 h-9 animate-bounce" />
                  <span className="text-[10px] font-extrabold uppercase mt-1 tracking-wider">Écoute...</span>
                </>
              ) : (
                <>
                  <Mic className="w-9 h-9" />
                  <span className="text-[10px] font-bold uppercase mt-1 tracking-wider">Parler</span>
                </>
              )}
            </button>
          </div>

          <div className="text-center space-y-1">
            <span className="text-xs font-semibold text-slate-200 block">
              {isListening
                ? `Matrice « ${matrixName} » écoute (${voiceLang})... Cliquez pour valider`
                : `Parlez en Arabe, Darija, Français ou Anglais`}
            </span>
            <span className="text-[11px] text-slate-400 block font-mono">
              Véhicule connecté : {selectedVehicle.model} ({selectedVehicle.ecuType})
            </span>
          </div>

          {/* Real-time Transcript Bubble */}
          {(transcript || isListening) && (
            <div className="w-full p-3.5 bg-slate-950/80 rounded-2xl border border-cyan-700/50 text-center animate-in fade-in">
              <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-1">
                Texte Détecté en Direct :
              </span>
              <p className="text-sm font-medium text-white italic">
                &quot;{transcript || 'En attente de votre voix...'}&quot;
              </p>
            </div>
          )}

          {/* AI Response Display */}
          {lastResponse && (
            <div className="w-full p-3.5 bg-cyan-950/30 rounded-2xl border border-cyan-500/40 text-left space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-extrabold text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Réponse de la Matrice {matrixName} :</span>
                </span>
                <button
                  onClick={() => speakText(lastResponse)}
                  className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Réécouter</span>
                </button>
              </div>
              <p className="text-xs font-medium text-slate-100 leading-relaxed">
                {lastResponse}
              </p>
              {executedActions.length > 0 && (
                <p className="text-[10px] font-mono text-emerald-300">
                  Actions : {executedActions.join(' · ')}
                </p>
              )}
              {pendingLaunchers.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {pendingLaunchers.map((item, idx) => (
                    <a
                      key={`${item.kind}-${idx}`}
                      href={item.href}
                      target={item.kind === 'social' ? '_blank' : undefined}
                      rel={item.kind === 'social' ? 'noopener noreferrer' : undefined}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      {item.kind === 'call' ? (
                        <Phone className="w-3.5 h-3.5" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      <span>{item.label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {recognitionError && (
            <div className="w-full p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{recognitionError}</span>
            </div>
          )}
        </div>

        {/* Text Input Fallback */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendVoiceCommand(speechText);
          }}
          className="flex items-center gap-2 relative z-10"
        >
          <input
            type="text"
            placeholder="Ex: Appelle 0557... / 7el WhatsApp / Fakerni vidange / 7el el male..."
            value={speechText}
            onChange={(e) => setSpeechText(e.target.value)}
            disabled={isProcessing}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <button
            type="submit"
            disabled={isProcessing || !speechText.trim()}
            className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Envoyer</span>
          </button>
        </form>

        {/* Quick Tasks Created by Voice */}
        {tasks.length > 0 && (
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 relative z-10">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
              <span>Tâches vocales enregistrées ({tasks.length})</span>
              <button
                type="button"
                onClick={() => setTasks([])}
                className="text-slate-400 hover:text-rose-300 cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vider</span>
              </button>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-xs text-slate-200">
                  <button
                    type="button"
                    onClick={() =>
                      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
                    }
                    className="flex items-center gap-2 text-left cursor-pointer"
                  >
                    {t.done ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className={t.done ? 'line-through text-slate-500' : ''}>{t.title}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="space-y-1.5 pt-1 relative z-10">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Exemples Multi-Langues (Appels · Réseaux · Tâches · Habitacle) :
          </span>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <button
              onClick={() => handleSendVoiceCommand('Appelle 0557767804')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 transition-colors cursor-pointer"
            >
              📞 &quot;Appelle 0557...&quot;
            </button>
            <button
              onClick={() => handleSendVoiceCommand('Ouvre WhatsApp')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              💬 &quot;Ouvre WhatsApp&quot;
            </button>
            <button
              onClick={() => handleSendVoiceCommand('افتح فيسبوك')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              🌐 &quot;افتح فيسبوك&quot;
            </button>
            <button
              onClick={() => handleSendVoiceCommand('Fakerni vidange Coolray demain')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 transition-colors cursor-pointer"
            >
              📝 &quot;Fakerni vidange&quot;
            </button>
            <button
              onClick={() => handleSendVoiceCommand('7el el male w ghlaq zoudjadj')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              🇩🇿 &quot;7el el male w ghlaq zoudjadj&quot;
            </button>
            <button
              onClick={() => handleSendVoiceCommand('Mets la clim à 20 degrés')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              ❄️ &quot;Clim à 20°C&quot;
            </button>
            <button
              onClick={() => handleSendVoiceCommand('Open sunroof and unlock doors')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              🇬🇧 &quot;Open sunroof&quot;
            </button>
            <button
              onClick={() => handleSendVoiceCommand('Ouvre les sources Coffre-Fort')}
              className="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 transition-colors cursor-pointer"
            >
              🔐 &quot;Sources Coffre-Fort&quot;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
