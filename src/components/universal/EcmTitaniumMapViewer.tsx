import React, { useState, useMemo } from 'react';
import { Gauge, Sliders, TrendingUp, Cpu } from 'lucide-react';
import {
  ECM_TITANIUM_MAPS,
  StageTunePreset,
} from '../../data/universalMasterDatabase';

const STAGE_STEPS: Array<{ id: StageTunePreset; label: string; gainText: string }> = [
  { id: 'STOCK', label: 'Origine (Stock)', gainText: 'Cartographie constructeur 0% · Tolérances OEM' },
  { id: 'STAGE1_ECO', label: 'Stage 1 Eco', gainText: '+8% Couple / -6% Consommation · Bas régimes optimisés' },
  { id: 'STAGE1_PERF', label: 'Stage 1 Performance', gainText: '+18% Couple / +15% Puissance · Limiteurs relevés' },
  { id: 'STAGE1_TCU', label: 'Stage 1 + TCU (DSG/7DCT/ZF8)', gainText: '+24% Couple ECU+TCU · Pression embrayage & passages optimisés' },
];

export const EcmTitaniumMapViewer: React.FC<{ ecuLabel: string }> = ({ ecuLabel }) => {
  const [selectedMapId, setSelectedMapId] = useState(ECM_TITANIUM_MAPS[2].id); // Limiteur de couple par défaut
  const [stageIdx, setStageIdx] = useState<number>(2); // Stage 1 Performance
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(3); // Pleine charge 100%

  const currentStage = STAGE_STEPS[stageIdx] || STAGE_STEPS[0];
  const currentMap = useMemo(
    () => ECM_TITANIUM_MAPS.find((m) => m.id === selectedMapId) || ECM_TITANIUM_MAPS[0],
    [selectedMapId]
  );

  const multiplier = currentMap.stageMultipliers[currentStage.id];

  const tunedMatrix = useMemo(
    () =>
      currentMap.baseMatrix.map((row) =>
        row.map((val) =>
          currentMap.id === 'ignition_timing'
            ? Number((val * multiplier).toFixed(1))
            : Math.round(val * multiplier)
        )
      ),
    [currentMap, multiplier]
  );

  const stockRow = currentMap.baseMatrix[selectedRowIdx] || currentMap.baseMatrix[0];
  const tunedRow = tunedMatrix[selectedRowIdx] || tunedMatrix[0];
  const maxChartVal = Math.max(...tunedRow, ...stockRow, 1) * 1.12;
  const minChartVal = Math.min(...tunedRow, ...stockRow) * 0.85;

  const toPoints = (vals: number[]) =>
    vals
      .map((v, i) => {
        const x = 44 + (i / Math.max(1, vals.length - 1)) * 452;
        const norm = (v - minChartVal) / Math.max(0.01, maxChartVal - minChartVal);
        const y = 175 - norm * 140;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <div className="space-y-5">
      {/* Header & Quick Stage Slider */}
      <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Visualiseur Cartographique « ECM Titanium Lite » — {ecuLabel}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sélectionnez une table (Rail, Turbo, Couple ECU/TCU, Avance) et ajustez le curseur Stage en temps réel.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ECM_TITANIUM_MAPS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMapId(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                  selectedMapId === m.id
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-[#0B1120] text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                {m.title.split('(')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        {/* Curseur Stage */}
        <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Niveau de Calibration : <strong className="text-cyan-300">{currentStage.label}</strong>
            </span>
            <span className="text-emerald-300 font-semibold">{currentStage.gainText}</span>
          </div>

          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={stageIdx}
            onChange={(e) => setStageIdx(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />

          <div className="grid grid-cols-4 text-[10px] font-bold text-slate-400">
            {STAGE_STEPS.map((st, idx) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStageIdx(idx)}
                className={`text-left sm:text-center cursor-pointer ${
                  stageIdx === idx ? 'text-cyan-300' : 'hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tableau 2D + Graphique 2D SVG */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Tableau 2D interactif */}
        <div className="xl:col-span-7 p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3 overflow-x-auto">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Table 2D : {currentMap.title} ({currentMap.unit})
            </span>
            <span className="text-[11px] font-mono text-emerald-300">
              Multiplicateur : ×{multiplier.toFixed(2)}
            </span>
          </div>

          <table className="w-full text-xs text-center font-mono border-collapse">
            <thead>
              <tr className="bg-[#0B1120] text-slate-400">
                <th className="p-2 border border-slate-800 text-left">Charge \ RPM</th>
                {currentMap.rpmAxis.map((rpm) => (
                  <th key={rpm} className="p-2 border border-slate-800">
                    {rpm}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tunedMatrix.map((row, rIdx) => {
                const isRowActive = selectedRowIdx === rIdx;
                return (
                  <tr
                    key={currentMap.loadAxis[rIdx]}
                    onClick={() => setSelectedRowIdx(rIdx)}
                    className={`cursor-pointer ${
                      isRowActive ? 'bg-cyan-950/35' : 'hover:bg-slate-900/50'
                    }`}
                  >
                    <td className="p-2 border border-slate-800 text-left font-bold text-cyan-300">
                      {currentMap.loadAxis[rIdx]}
                    </td>
                    {row.map((val, cIdx) => {
                      const base = currentMap.baseMatrix[rIdx][cIdx];
                      const delta = val - base;
                      const heat =
                        delta > 0
                          ? 'bg-emerald-950/60 text-emerald-200 border-emerald-500/30'
                          : 'bg-[#0B1120] text-slate-200 border-slate-800';
                      return (
                        <td key={cIdx} className={`p-2 border tabular-nums ${heat}`}>
                          <div className="font-bold">{val}</div>
                          {delta > 0 && (
                            <div className="text-[9px] text-emerald-400">
                              +{currentMap.id === 'ignition_timing' ? delta.toFixed(1) : Math.round(delta)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Graphique 2D SVG Courbe Origine vs Tunée */}
        <div className="xl:col-span-5 p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Courbe 2D (Charge {currentMap.loadAxis[selectedRowIdx]})
            </span>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-slate-400">━ Origine</span>
              <span className="text-emerald-400 font-bold">━ {currentStage.label}</span>
            </div>
          </div>

          <svg viewBox="0 0 520 205" className="w-full h-auto rounded-xl bg-[#0B1120] border border-slate-800">
            {[40, 85, 130, 175].map((y) => (
              <line key={y} x1="40" y1={y} x2="500" y2={y} stroke="#1e293b" strokeDasharray="4 4" />
            ))}
            <polyline fill="none" stroke="#64748b" strokeWidth="2.2" strokeDasharray="5 4" points={toPoints(stockRow)} />
            <polyline fill="none" stroke="#10b981" strokeWidth="3" points={toPoints(tunedRow)} />
            {currentMap.rpmAxis.map((rpm, i) => {
              const x = 44 + (i / Math.max(1, currentMap.rpmAxis.length - 1)) * 452;
              return (
                <text key={rpm} x={x} y="195" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                  {rpm}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
