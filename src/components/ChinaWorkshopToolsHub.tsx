import React, { useState } from 'react';
import {
  Cable,
  Crosshair,
  Cpu,
  Languages,
  HardDriveDownload,
  Wrench,
} from 'lucide-react';
import { Vehicle } from '../types/automotive';
import { PinoutCrowdsourcingModule } from './PinoutCrowdsourcingModule';
import { AdasTargetPdfModule } from './AdasTargetPdfModule';
import { VinEcuDecoderModule } from './VinEcuDecoderModule';
import { DtcRawTranslatorModule } from './DtcRawTranslatorModule';

type WorkshopSubTab = 'pinouts' | 'adas_pdf' | 'vin_ecu' | 'dtc_translate';

interface ChinaWorkshopToolsHubProps {
  selectedVehicle?: Vehicle;
  initialSubTab?: WorkshopSubTab;
}

export const ChinaWorkshopToolsHub: React.FC<ChinaWorkshopToolsHubProps> = ({
  selectedVehicle,
  initialSubTab = 'pinouts',
}) => {
  const [subTab, setSubTab] = useState<WorkshopSubTab>(initialSubTab);

  const tabs: Array<{
    id: WorkshopSubTab;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'pinouts',
      label: 'Câblage & Pinouts',
      subtitle: 'ECU / BCM / ABS & Fusibles (Votes DZ)',
      icon: <Cable className="w-4 h-4" />,
    },
    {
      id: 'adas_pdf',
      label: 'Calibration ADAS 1:1',
      subtitle: 'Cibles PDF Vectorielles + Cotes mm',
      icon: <Crosshair className="w-4 h-4" />,
    },
    {
      id: 'vin_ecu',
      label: 'Décodeur VIN ECU',
      subtitle: 'Bosch / Delphi / UAES / BYD / SAIC',
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      id: 'dtc_translate',
      label: 'Traducteur DTC Brut IA',
      subtitle: 'Chinois/Anglais → Français + Multimètre',
      icon: <Languages className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Wrench className="w-4 h-4" />
            Boîte à Outils Atelier Chine (Chery · Geely · MG · BYD · DFSK)
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white">
            Câblage Crowdsourcé, Cibles ADAS 1:1, Décodeur VIN &amp; Dépannage DTC
          </h2>
          {selectedVehicle && (
            <p className="text-xs text-slate-400">
              Véhicule actif :{' '}
              <span className="text-cyan-300 font-semibold">
                {selectedVehicle.brand} {selectedVehicle.model} ({selectedVehicle.year})
              </span>
            </p>
          )}
        </div>

        <div className="px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 shrink-0 self-start md:self-center">
          <HardDriveDownload className="w-4 h-4 text-emerald-400" />
          <span>Optimisé Hors-Ligne (Cache Atelier)</span>
        </div>
      </div>

      {/* 4 Sub-Tab Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tabs.map((tab) => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                active
                  ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm'
                  : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  active ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-cyan-400'
                }`}
              >
                {tab.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold truncate">{tab.label}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{tab.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Sub-Module */}
      <div>
        {subTab === 'pinouts' && <PinoutCrowdsourcingModule />}
        {subTab === 'adas_pdf' && <AdasTargetPdfModule />}
        {subTab === 'vin_ecu' && <VinEcuDecoderModule />}
        {subTab === 'dtc_translate' && <DtcRawTranslatorModule />}
      </div>
    </div>
  );
};
