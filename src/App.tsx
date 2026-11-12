import React, { useState } from 'react';
import { ConnectionMode, Vehicle, LicenseSession } from './types/automotive';
import { VEHICLE_PRESETS } from './data/mockVehicles';
import { Header } from './components/Header';
import { ConnectionManager } from './components/ConnectionManager';
import { DiagnosticScanner } from './components/DiagnosticScanner';
import { DiagnosticHistory } from './components/DiagnosticHistory';
import { EcuFlashing } from './components/EcuFlashing';
import { TabletAppInstaller } from './components/TabletAppInstaller';
import { AppTranslator } from './components/AppTranslator';
import { SmartechDzBridge } from './components/SmartechDzBridge';
import { CommercialPackaging } from './components/CommercialPackaging';
import { ChineseTabletFlasher } from './components/ChineseTabletFlasher';
import { BodyComfortControl } from './components/BodyComfortControl';
import { KeylessProximitySecurity } from './components/KeylessProximitySecurity';
import { ConnectModal } from './components/ConnectModal';
import { LicenseGate } from './components/LicenseGate';
import { LicenseModal } from './components/LicenseModal';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { INITIAL_DTC_CODES } from './data/mockVehicles';
import { ShieldCheck, Cpu, HardDrive } from 'lucide-react';

export default function App() {
  const [licenseSession, setLicenseSession] = useState<LicenseSession | null>(() => {
    try {
      const saved = localStorage.getItem('autopro_license_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isValid) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return null;
  });
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [matrixName, setMatrixName] = useState<string>(() => {
    return localStorage.getItem('autopro_matrix_name') || 'Jarvis';
  });
  const [activeTab, setActiveTab] = useState<'diagnostic' | 'history' | 'flash' | 'connection' | 'apps' | 'translator' | 'smartech' | 'packaging' | 'chinese_flasher' | 'comfort' | 'keyless'>('history');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle>(VEHICLE_PRESETS[0]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('cable');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [batteryVoltage, setBatteryVoltage] = useState<number>(13.8);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [dtcCodes, setDtcCodes] = useState(INITIAL_DTC_CODES);

  const handleDeactivateLicense = () => {
    localStorage.removeItem('autopro_license_session');
    setLicenseSession(null);
  };

  // If no valid license is activated, lock the application behind the License Gate
  if (!licenseSession || !licenseSession.isValid) {
    return <LicenseGate onLicenseActivated={(session) => setLicenseSession(session)} />;
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Bar adhering to Top Bar Contract */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isConnected={isConnected}
        connectionMode={connectionMode}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        licenseSession={licenseSession}
        onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
        matrixName={matrixName}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'diagnostic' && (
          <DiagnosticScanner
            selectedVehicle={selectedVehicle}
            setSelectedVehicle={setSelectedVehicle}
            batteryVoltage={batteryVoltage}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onSelectTab={setActiveTab}
          />
        )}

        {activeTab === 'history' && (
          <DiagnosticHistory
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'flash' && (
          <EcuFlashing
            selectedVehicle={selectedVehicle}
            setSelectedVehicle={setSelectedVehicle}
            batteryVoltage={batteryVoltage}
            isConnected={isConnected}
            connectionMode={connectionMode}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'connection' && (
          <ConnectionManager
            connectionMode={connectionMode}
            setConnectionMode={setConnectionMode}
            isConnected={isConnected}
            setIsConnected={setIsConnected}
            batteryVoltage={batteryVoltage}
            setBatteryVoltage={setBatteryVoltage}
          />
        )}

        {activeTab === 'apps' && (
          <TabletAppInstaller
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'translator' && (
          <AppTranslator
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'smartech' && (
          <SmartechDzBridge
            selectedVehicle={selectedVehicle}
            dtcList={dtcCodes}
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'packaging' && (
          <CommercialPackaging
            appUrl="https://ais-pre-kd2bgrq3vtrufter4hwxrg-988212701770.europe-west2.run.app"
            onSelectTab={setActiveTab}
            onSelectVehicle={setSelectedVehicle}
          />
        )}

        {activeTab === 'chinese_flasher' && (
          <ChineseTabletFlasher
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'comfort' && (
          <BodyComfortControl
            selectedVehicle={selectedVehicle}
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
            matrixName={matrixName}
          />
        )}

        {activeTab === 'keyless' && (
          <KeylessProximitySecurity
            selectedVehicle={selectedVehicle}
            connectionMode={connectionMode}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onSelectTab={setActiveTab}
          />
        )}
      </main>

      {/* Clean Professional Automotive Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-5 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-400">AutoPro Suite Automobile</span>
            <span>·</span>
            <span>Normes ISO 14229 UDS / SAE J2534 Passthru / ISO 13400 DoIP</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Protection Calculateur Sécurisée
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Multimarque Européen, Asiatique &amp; Américain
            </span>
          </div>
        </div>
      </footer>

      {/* Connect Modal */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        connectionMode={connectionMode}
        setConnectionMode={setConnectionMode}
        isConnected={isConnected}
        setIsConnected={setIsConnected}
        batteryVoltage={batteryVoltage}
      />

      {/* License Inspector & Management Modal */}
      {licenseSession && (
        <LicenseModal
          isOpen={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
          license={licenseSession}
          onDeactivate={handleDeactivateLicense}
        />
      )}

      {/* Intelligent AI Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        selectedVehicle={selectedVehicle}
        onSelectTab={setActiveTab}
      />
    </div>
  );
}
