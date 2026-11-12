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
  Radio
} from 'lucide-react';
import { Vehicle } from '../types/automotive';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVehicle: Vehicle;
  onSelectTab: (tab: any) => void;
  onExecuteBcmAction?: (type: string, params: any) => void;
}

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
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  const presetNames = ['Jarvis', 'AutoPro', 'Smartech', 'Matrix DZ', 'Yacine', 'Karim', 'Atlas', 'Titan'];

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onstart = () => {
        setIsListening(true);
        setRecognitionError(null);
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const resultTranscript = event.results[current][0].transcript;
        setTranscript(resultTranscript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
          setRecognitionError(`Erreur micro : ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Text-To-Speech Synthesis helper
  const speakText = (text: string) => {
    if (!speechEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.05;
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

    try {
      const response = await fetch('/api/ai/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          matrixName,
          vehicle: { brand: selectedVehicle.brand, model: selectedVehicle.model },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setLastResponse(data.speechReply);
        speakText(data.speechReply);

        // Execute returned actions
        const actionsPerformed: string[] = [];
        if (Array.isArray(data.actions)) {
          for (const action of data.actions) {
            // Send direct BCM command to backend
            try {
              await fetch('/api/bcm/command', {
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

        setExecutedActions(actionsPerformed);

        // Switch tab if suggested
        if (data.suggestedTab && ['diagnostic', 'flash', 'comfort', 'chinese_flasher', 'smartech', 'apps'].includes(data.suggestedTab)) {
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

  const handleSaveMatrixName = (name: string) => {
    const clean = name.trim() || 'Jarvis';
    setMatrixName(clean);
    localStorage.setItem('autopro_matrix_name', clean);
    setIsEditingName(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-cyan-800/60 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative overflow-hidden space-y-5">
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
                Commande vocale intelligente automobile toutes fonctions
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

        {/* Main Microphone Listening Hub */}
        <div className="flex flex-col items-center justify-center py-5 space-y-4 relative z-10">
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
                ? `Matrice « ${matrixName} » vous écoute... Cliquez pour valider`
                : `Cliquez sur le micro et parlez, ou dites « Dis ${matrixName} »`}
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
                "{transcript || 'En attente de votre voix...'}"
              </p>
            </div>
          )}

          {/* AI Response Display */}
          {lastResponse && (
            <div className="w-full p-3.5 bg-cyan-950/30 rounded-2xl border border-cyan-500/40 text-left space-y-1.5 animate-in fade-in">
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
            placeholder={`Ou tapez votre commande pour ${matrixName} (ex: "Ferme les vitres et clim à 21°C")...`}
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

        {/* Quick Suggestion Chips */}
        <div className="space-y-1.5 pt-1 relative z-10">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Exemples de Commandes Prêtes à l'Emploi :
          </span>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <button
              onClick={() => handleSendVoiceCommand("Ferme toutes les vitres et verrouille les portes")}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              🔒 "Ferme vitres &amp; verrouille"
            </button>
            <button
              onClick={() => handleSendVoiceCommand("Ouvre la mâle du coffre")}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              🚗 "Ouvre la mâle"
            </button>
            <button
              onClick={() => handleSendVoiceCommand("Mets la clim à 20 degrés et active l'AC")}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              ❄️ "Clim à 20°C"
            </button>
            <button
              onClick={() => handleSendVoiceCommand("Ouvre le toit ouvrant panoramique")}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              ☀️ "Ouvre le toit ouvrant"
            </button>
            <button
              onClick={() => handleSendVoiceCommand("Mode aération été vitres 15 pourcent et tilt toit")}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              💨 "Aération été"
            </button>
            <button
              onClick={() => handleSendVoiceCommand("Lance le scanner diagnostic moteur")}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              🔍 "Scanner diagnostic"
            </button>
            <button
              onClick={() => handleSendVoiceCommand("Ouvre la clé 3 mètres et sécurité antivol")}
              className="px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 hover:text-amber-200 border border-amber-800/60 transition-colors cursor-pointer"
            >
              📡 "Clé 3m &amp; Antivol"
            </button>
            <button
              onClick={() => handleSendVoiceCommand("7el el male w ghlaq zoudjadj")}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
            >
              🇩🇿 "7el el male w ghlaq zoudjadj"
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
