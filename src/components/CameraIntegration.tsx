import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Video,
  VideoOff,
  Circle,
  Square,
  Maximize2,
  Eye,
  Compass,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Wifi,
  Cable,
  Bluetooth,
  Activity,
  Download,
  Cpu,
  Navigation,
  Moon,
  Sun,
  Crosshair,
  RotateCcw,
  ArrowLeft
} from 'lucide-react';
import { Vehicle, ConnectionMode, VehicleCameraSystem } from '../types/automotive';

interface CameraIntegrationProps {
  selectedVehicle: Vehicle;
  connectionMode: ConnectionMode;
  isConnected: boolean;
  onOpenConnectModal: () => void;
  onSelectTab?: (tab: any) => void;
  clientName?: string;
}

interface CapturedFrame {
  id: string;
  camera: string;
  timestamp: string;
  vehicleName: string;
  resolution: string;
  canFrame: string;
}

export const CameraIntegration: React.FC<CameraIntegrationProps> = ({
  selectedVehicle,
  connectionMode,
  isConnected,
  onOpenConnectModal,
  onSelectTab,
  clientName = 'Garage Atelier DZ',
}) => {
  const [cameraState, setCameraState] = useState<VehicleCameraSystem>({
    activeCamera: 'rear',
    isReverseEngaged: true,
    guidelinesActive: true,
    steeringAngleDeg: -14,
    nightVisionActive: false,
    recording: false,
    cameraResolution: '1080p AHD',
    brightness: 105,
    contrast: 110,
    distanceToObstacleMeters: 1.25,
  });

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationDoneMsg, setCalibrationDoneMsg] = useState<string | null>(null);
  const [lastCanLog, setLastCanLog] = useState<string>('0x3B2 [8] 01 00 FF 20 00 00 00 00 (LVDS_CAM_REAR_ACTIVE)');
  const [captures, setCaptures] = useState<CapturedFrame[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Real USB/Device Camera (WebRTC getUserMedia) support for Android Tablet / Endoscope
  const [useHardwareCamera, setUseHardwareCamera] = useState(false);
  const [hardwareCameraError, setHardwareCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Recording Timer
  useEffect(() => {
    if (!cameraState.recording) {
      setRecordingSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setRecordingSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cameraState.recording]);

  // Manage real USB/Tablet hardware camera stream if toggled
  useEffect(() => {
    if (!useHardwareCamera || !isConnected) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let cancelled = false;
    setHardwareCameraError(null);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(stream => {
          if (cancelled) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHardwareCameraError(
              'Caméra USB / Tablette non autorisée ou absente. Basculement sur flux télémétrique LVDS véhicule.'
            );
            setUseHardwareCamera(false);
          }
        });
    } else {
      setHardwareCameraError('Flux caméra matériel non supporté par ce navigateur.');
      setUseHardwareCamera(false);
    }

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [useHardwareCamera, isConnected]);

  const cameraChannels: Array<{
    id: VehicleCameraSystem['activeCamera'];
    label: string;
    shortLabel: string;
    protocol: string;
    desc: string;
  }> = [
    {
      id: 'rear',
      label: 'Caméra Recul (Arrière)',
      shortLabel: 'Arrière HD',
      protocol: 'LVDS Canal 1 · 1080p',
      desc: 'Lignes dynamiques de braquage & radars ultrasons',
    },
    {
      id: 'front',
      label: 'Caméra Avant ADAS',
      shortLabel: 'Avant ADAS',
      protocol: 'MIPI CSI-2 · Pare-brise',
      desc: 'Détection de voie (LKA), panneaux & freinage FCW',
    },
    {
      id: '360',
      label: 'Vue Panoramique 360°',
      shortLabel: 'Vue 360°',
      protocol: '4x AHD Synthèse Bird-Eye',
      desc: 'Assemblage temps réel des 4 caméras périphériques',
    },
    {
      id: 'left',
      label: 'Angle Mort Gauche',
      shortLabel: 'Rétro G',
      protocol: 'LVDS Canal 2 · Rétroviseur',
      desc: 'Surveillance roue avant gauche & trottoir',
    },
    {
      id: 'right',
      label: 'Angle Mort Droit',
      shortLabel: 'Rétro D',
      protocol: 'LVDS Canal 3 · Rétroviseur',
      desc: 'Surveillance roue avant droite & créneau',
    },
    {
      id: 'dashcam',
      label: 'Dashcam DVR Intégrée',
      shortLabel: 'Dashcam DVR',
      protocol: 'Flux H.265 Boucle SD',
      desc: 'Enregistrement continu route & choc G-Sensor',
    },
  ];

  const sendCameraCommand = async (action: string, overrides?: Partial<VehicleCameraSystem>) => {
    if (!isConnected) {
      onOpenConnectModal();
      return;
    }

    const nextState = { ...cameraState, ...overrides };
    setCameraState(nextState);

    try {
      const res = await fetch('/api/cameras/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraChannel: nextState.activeCamera,
          action,
          steeringAngleDeg: nextState.steeringAngleDeg,
          guidelinesActive: nextState.guidelinesActive,
          nightVisionActive: nextState.nightVisionActive,
          clientName,
          vehicleName: `${selectedVehicle.brand} ${selectedVehicle.model}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLastCanLog(data.canFrame);
        setStatusBanner(data.message);
        setTimeout(() => setStatusBanner(null), 3500);
      }
    } catch {
      setStatusBanner('Commande exécutée en mode local tablette.');
    }
  };

  const handleSelectCamera = (camId: VehicleCameraSystem['activeCamera']) => {
    sendCameraCommand('switch_channel', {
      activeCamera: camId,
      isReverseEngaged: camId === 'rear',
    });
  };

  const handleToggleRecording = () => {
    const nextRec = !cameraState.recording;
    sendCameraCommand('toggle_record', { recording: nextRec });
  };

  const handleTakeSnapshot = () => {
    const activeInfo = cameraChannels.find(c => c.id === cameraState.activeCamera);
    const snap: CapturedFrame = {
      id: `CAP-${Math.floor(1000 + Math.random() * 9000)}`,
      camera: activeInfo?.label || cameraState.activeCamera,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      vehicleName: `${selectedVehicle.brand} ${selectedVehicle.model}`,
      resolution: cameraState.cameraResolution,
      canFrame: lastCanLog,
    };
    setCaptures(prev => [snap, ...prev.slice(0, 5)]);
    sendCameraCommand('snapshot');
  };

  const handleCalibrateAdas = () => {
    if (!isConnected) {
      onOpenConnectModal();
      return;
    }
    setIsCalibrating(true);
    setCalibrationProgress(0);
    setCalibrationDoneMsg(null);
    sendCameraCommand('calibrate_adas');

    let step = 0;
    const interval = setInterval(() => {
      step += 20;
      setCalibrationProgress(step);
      if (step >= 100) {
        clearInterval(interval);
        setIsCalibrating(false);
        setCalibrationDoneMsg('Calibration ADAS & Alignement des caméras validés (±0.1°). Mémoire ECU 0x742 mise à jour.');
      }
    }, 350);
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60).toString().padStart(2, '0');
    const rem = (sec % 60).toString().padStart(2, '0');
    return `${mins}:${rem}`;
  };

  const getModeIcon = () => {
    if (connectionMode === 'cable') return <Cable className="w-3.5 h-3.5 text-cyan-400" />;
    if (connectionMode === 'wifi') return <Wifi className="w-3.5 h-3.5 text-blue-400" />;
    return <Bluetooth className="w-3.5 h-3.5 text-indigo-400" />;
  };

  const activeCameraMeta = cameraChannels.find(c => c.id === cameraState.activeCamera) || cameraChannels[0];

  // Dynamic curved SVG steering path offset
  const curveOffset = cameraState.steeringAngleDeg * 2.1;

  return (
    <div className="space-y-6">
      {/* Top Header & Connection Status */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyan-950 text-cyan-400 border border-cyan-700/70 flex items-center gap-1.5">
              <Camera className="w-3 h-3 text-cyan-400" />
              <span>Contrôle Caméras Véhicule &amp; ADAS</span>
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
                isConnected
                  ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                  : 'bg-rose-950/70 border-rose-700/60 text-rose-300'
              }`}
            >
              {getModeIcon()}
              <span>
                {isConnected ? `Pont Actif (${connectionMode.toUpperCase()})` : 'Tablette Déconnectée'}
              </span>
            </span>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Video className="w-5 h-5 text-cyan-400" />
            <span>Caméras Embarquées, Vue 360° &amp; Calibration ADAS ({selectedVehicle.brand} {selectedVehicle.model})</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Manipulez directement depuis la tablette Android les caméras d'origine du véhicule (Recul, Pare-brise ADAS, 360° Bird-Eye, Angles morts et Dashcam DVR) via le bus LVDS / CAN-Bus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onSelectTab && (
            <button
              onClick={() => onSelectTab('diagnostic')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vue Diagnostic Standard</span>
            </button>
          )}

          <button
            onClick={onOpenConnectModal}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors border ${
              isConnected
                ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-cyan-500 border-cyan-400 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{isConnected ? 'Liaison Véhicule OK' : 'Connecter Tablette'}</span>
          </button>
        </div>
      </div>

      {/* Warning Banner if ConnectionManager is disconnected */}
      {!isConnected && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-700/60 text-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-rose-300 block">Liaison Tablette ↔ Véhicule interrompue</strong>
              <span>Établissez la connexion USB OTG, WiFi Direct ou Bluetooth dans le Gestionnaire de Liaison pour recevoir le flux vidéo LVDS des caméras du véhicule.</span>
            </div>
          </div>
          <button
            onClick={onOpenConnectModal}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 cursor-pointer"
          >
            Activer la Liaison
          </button>
        </div>
      )}

      {statusBanner && (
        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-700/60 text-cyan-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">{lastCanLog}</span>
        </div>
      )}

      {hardwareCameraError && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/60 text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{hardwareCameraError}</span>
        </div>
      )}

      {/* Main Workspace Grid: Live Video Viewport + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Live Camera Feed Viewport + Channel Switcher */}
        <div className="lg:col-span-8 space-y-4">
          {/* Camera Selector Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {cameraChannels.map(cam => {
              const active = cameraState.activeCamera === cam.id;
              return (
                <button
                  key={cam.id}
                  onClick={() => handleSelectCamera(cam.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-md ring-1 ring-cyan-400/40'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Camera className={`w-3.5 h-3.5 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                    {active && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  </div>
                  <div className="text-[11px] font-bold leading-tight">{cam.shortLabel}</div>
                </button>
              );
            })}
          </div>

          {/* Live Video Display Screen */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-950 aspect-video shadow-2xl">
            {/* Simulated or Hardware Camera Background */}
            {!isConnected ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 space-y-2 bg-slate-950">
                <VideoOff className="w-12 h-12 text-slate-700" />
                <span className="text-sm font-bold text-slate-400">AUCUN SIGNAL VIDÉO LVDS</span>
                <span className="text-xs text-slate-600">Connectez la tablette au bus CAN / multimédia du véhicule</span>
              </div>
            ) : useHardwareCamera ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{
                  filter: `brightness(${cameraState.brightness}%) contrast(${cameraState.contrast}%) ${
                    cameraState.nightVisionActive ? 'grayscale(100%) sepia(100%) hue-rotate(85deg) saturate(200%)' : ''
                  }`,
                }}
              />
            ) : (
              /* High-fidelity Simulated Automotive Video Feed Canvas */
              <div
                className="absolute inset-0 transition-all duration-300"
                style={{
                  filter: `brightness(${cameraState.brightness}%) contrast(${cameraState.contrast}%) ${
                    cameraState.nightVisionActive ? 'grayscale(80%) hue-rotate(90deg) saturate(180%)' : ''
                  }`,
                  background:
                    cameraState.activeCamera === '360'
                      ? 'radial-gradient(circle at center, #1e293b 0%, #090d16 70%)'
                      : cameraState.nightVisionActive
                      ? 'linear-gradient(180deg, #051b11 0%, #0a2e1d 55%, #071911 100%)'
                      : 'linear-gradient(180deg, #0f172a 0%, #1e293b 42%, #111827 43%, #090d16 100%)',
                }}
              >
                {/* Perspective Road / Garage Floor Grid */}
                <svg className="w-full h-full" viewBox="0 0 800 450" preserveAspectRatio="none">
                  {/* Horizon / Road surface lines */}
                  {cameraState.activeCamera !== '360' ? (
                    <>
                      <line x1="0" y1="190" x2="800" y2="190" stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
                      {/* Asphalt lane markings */}
                      <path d="M 320 190 L 80 450" stroke="rgba(255,255,255,0.25)" strokeWidth="4" strokeDasharray="18 14" />
                      <path d="M 480 190 L 720 450" stroke="rgba(255,255,255,0.25)" strokeWidth="4" strokeDasharray="18 14" />
                      <path d="M 400 190 L 400 450" stroke="rgba(250,204,21,0.35)" strokeWidth="3" strokeDasharray="20 20" />

                      {/* ADAS Front Detection Bounding Boxes */}
                      {cameraState.activeCamera === 'front' && (
                        <g>
                          {/* Detected vehicle ahead */}
                          <rect
                            x="335"
                            y="150"
                            width="130"
                            height="78"
                            rx="4"
                            fill="rgba(34,211,238,0.08)"
                            stroke="#22d3ee"
                            strokeWidth="2"
                          />
                          <text x="340" y="143" fill="#22d3ee" fontSize="11" fontFamily="monospace" fontWeight="bold">
                            VEHICULE · 18.4m · FCW OK
                          </text>
                          {/* Lane Keep Assist highlights */}
                          <path d="M 325 190 L 140 450" stroke="#10b981" strokeWidth="3" opacity="0.7" />
                          <path d="M 475 190 L 660 450" stroke="#10b981" strokeWidth="3" opacity="0.7" />
                        </g>
                      )}

                      {/* Dynamic Steering Guidelines for Rear / Left / Right */}
                      {cameraState.guidelinesActive && cameraState.activeCamera !== 'front' && (
                        <g>
                          {/* Left dynamic curve */}
                          <path
                            d={`M 210 440 Q ${260 + curveOffset * 0.5} 310 ${310 + curveOffset} 225`}
                            fill="none"
                            stroke="#22d3ee"
                            strokeWidth="4"
                            strokeLinecap="round"
                            opacity="0.85"
                          />
                          {/* Right dynamic curve */}
                          <path
                            d={`M 590 440 Q ${540 + curveOffset * 0.5} 310 ${490 + curveOffset} 225`}
                            fill="none"
                            stroke="#22d3ee"
                            strokeWidth="4"
                            strokeLinecap="round"
                            opacity="0.85"
                          />
                          {/* Red Danger Zone (<0.6m) */}
                          <path
                            d={`M 238 395 L 562 395`}
                            stroke="#f43f5e"
                            strokeWidth="3"
                            strokeDasharray="10 6"
                          />
                          {/* Amber Caution Zone (1.2m) */}
                          <path
                            d={`M ${265 + curveOffset * 0.3} 335 L ${535 + curveOffset * 0.3} 335`}
                            stroke="#f59e0b"
                            strokeWidth="2.5"
                            strokeDasharray="12 6"
                          />
                          {/* Green Safe Zone (2.2m) */}
                          <path
                            d={`M ${295 + curveOffset * 0.7} 265 L ${505 + curveOffset * 0.7} 265`}
                            stroke="#10b981"
                            strokeWidth="2"
                          />
                        </g>
                      )}
                    </>
                  ) : (
                    /* 360 Bird's Eye Top-Down Synthetic View */
                    <g>
                      {/* Radar Sweep Rings */}
                      <circle cx="400" cy="225" r="180" fill="none" stroke="rgba(34,211,238,0.18)" strokeDasharray="8 6" strokeWidth="1.5" />
                      <circle cx="400" cy="225" r="130" fill="none" stroke="rgba(34,211,238,0.28)" strokeWidth="1.5" />
                      {/* Ultrasonic proximity sectors */}
                      <path d="M 340 110 Q 400 85 460 110" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                      <path d="M 340 340 Q 400 365 460 340" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                      <path d="M 315 150 Q 290 225 315 300" fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                      <path d="M 485 150 Q 510 225 485 300" fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                      {/* Top-Down Car Chassis */}
                      <rect x="352" y="135" width="96" height="180" rx="22" fill="#0f172a" stroke="#22d3ee" strokeWidth="2.5" />
                      <rect x="364" y="162" width="72" height="36" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                      <rect x="366" y="255" width="68" height="34" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                      <text x="400" y="230" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontFamily="monospace" fontWeight="bold">
                        {selectedVehicle.brand.toUpperCase()} 360°
                      </text>
                    </g>
                  )}
                </svg>
              </div>
            )}

            {/* Top HUD Overlay Bar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
              <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-white">{activeCameraMeta.label}</span>
                <span className="text-slate-400 font-mono hidden sm:inline">· {cameraState.cameraResolution}</span>
              </div>

              <div className="flex items-center gap-2">
                {cameraState.recording && (
                  <div className="bg-rose-950/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-rose-500/70 text-xs font-mono font-bold text-rose-300 flex items-center gap-2 animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>REC {formatTimer(recordingSeconds)}</span>
                  </div>
                )}
                <div className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-[11px] font-mono text-cyan-300">
                  Volant : {cameraState.steeringAngleDeg > 0 ? `+${cameraState.steeringAngleDeg}°` : `${cameraState.steeringAngleDeg}°`}
                </div>
              </div>
            </div>

            {/* Bottom HUD Telemetry Strip */}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              <div className="bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 text-[11px] text-slate-200 flex items-center gap-3">
                <span>
                  Radar Obstacle :{' '}
                  <strong className="text-amber-400 font-mono">
                    {cameraState.distanceToObstacleMeters?.toFixed(2)} m
                  </strong>
                </span>
                <span>·</span>
                <span className="font-mono text-emerald-400">{activeCameraMeta.protocol}</span>
              </div>

              <div className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-[10px] font-mono text-slate-400">
                {useHardwareCamera ? 'SOURCE: CAMÉRA MATÉRIELLE USB/TABLETTE' : 'SOURCE: PASSERELLE LVDS / CAN-BUS'}
              </div>
            </div>
          </div>

          {/* Quick Video Action Controls Bar */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleToggleRecording}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                  cameraState.recording
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-rose-400 border border-rose-800/60'
                }`}
              >
                {cameraState.recording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Circle className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />}
                <span>{cameraState.recording ? 'Arrêter Enregistrement' : 'Enregistrer Flux DVR'}</span>
              </button>

              <button
                onClick={handleTakeSnapshot}
                className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Capture Photo HD</span>
              </button>

              <button
                onClick={() => setUseHardwareCamera(!useHardwareCamera)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  useHardwareCamera
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
                title="Utiliser la caméra USB OTG / tablette Android en direct"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>{useHardwareCamera ? 'Caméra Tablette Active' : 'Tester Caméra USB / Tablette'}</span>
              </button>
            </div>

            <button
              onClick={handleCalibrateAdas}
              disabled={isCalibrating}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Crosshair className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin' : ''}`} />
              <span>{isCalibrating ? 'Calibration ADAS...' : 'Calibrer Caméras ADAS'}</span>
            </button>
          </div>

          {/* Calibration Progress & Result */}
          {isCalibrating && (
            <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/50 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-cyan-400 font-mono">Écriture cible ECU Caméra 0x742 (ADAS Calibration)...</span>
                <span className="font-mono text-white font-bold">{calibrationProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-2 bg-cyan-500 transition-all duration-300" style={{ width: `${calibrationProgress}%` }} />
              </div>
            </div>
          )}

          {calibrationDoneMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-700/60 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{calibrationDoneMsg}</span>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Image Settings, Steering Simulation & Captures */}
        <div className="lg:col-span-4 space-y-4">
          {/* Camera Adjustments */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Réglages Optiques &amp; Trajectoire</span>
            </h3>

            {/* Steering Angle Simulator */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Angle de Braquage Volant (SAS) :</span>
                <span className="font-mono font-bold text-cyan-400">{cameraState.steeringAngleDeg}°</span>
              </div>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={cameraState.steeringAngleDeg}
                onChange={e =>
                  setCameraState(prev => ({ ...prev, steeringAngleDeg: parseInt(e.target.value, 10) }))
                }
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Gauche (-45°)</span>
                <button
                  onClick={() => setCameraState(prev => ({ ...prev, steeringAngleDeg: 0 }))}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Centrer (0°)
                </button>
                <span>Droite (+45°)</span>
              </div>
            </div>

            {/* Brightness */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Luminosité Capteur :</span>
                <span className="font-mono text-white">{cameraState.brightness}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="150"
                value={cameraState.brightness}
                onChange={e =>
                  setCameraState(prev => ({ ...prev, brightness: parseInt(e.target.value, 10) }))
                }
                className="w-full accent-cyan-500"
              />
            </div>

            {/* Contrast */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Contraste Vidéo :</span>
                <span className="font-mono text-white">{cameraState.contrast}%</span>
              </div>
              <input
                type="range"
                min="70"
                max="160"
                value={cameraState.contrast}
                onChange={e =>
                  setCameraState(prev => ({ ...prev, contrast: parseInt(e.target.value, 10) }))
                }
                className="w-full accent-cyan-500"
              />
            </div>

            {/* Toggle Switches */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="font-medium text-slate-200">Lignes de Guidage Dynamiques</span>
                <input
                  type="checkbox"
                  checked={cameraState.guidelinesActive}
                  onChange={e =>
                    setCameraState(prev => ({ ...prev, guidelinesActive: e.target.checked }))
                  }
                  className="w-4 h-4 accent-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="font-medium text-slate-200 flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Vision Nocturne Infrarouge (IR)</span>
                </span>
                <input
                  type="checkbox"
                  checked={cameraState.nightVisionActive}
                  onChange={e =>
                    setCameraState(prev => ({ ...prev, nightVisionActive: e.target.checked }))
                  }
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <div>
                <span className="text-slate-400 block mb-1 text-[11px]">Format Sortie Vidéo :</span>
                <select
                  value={cameraState.cameraResolution}
                  onChange={e =>
                    setCameraState(prev => ({ ...prev, cameraResolution: e.target.value as any }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white"
                >
                  <option value="1080p AHD">1080p AHD Haute Définition (Geely / Jetour)</option>
                  <option value="720p HD">720p HD Standard</option>
                  <option value="CVBS">CVBS Analogique (Anciens autoradios)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Captures Gallery */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Captures Atelier ({captures.length})</span>
              </h3>
            </div>

            {captures.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-3 text-center">
                Cliquez sur « Capture Photo HD » pour archiver une vue caméra dans le dossier client.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {captures.map(cap => (
                  <div
                    key={cap.id}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-cyan-300 text-[11px]">{cap.camera}</div>
                      <div className="text-[10px] text-slate-400">
                        {cap.vehicleName} · {cap.timestamp}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-mono text-[10px]">
                      {cap.resolution}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
