import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import {
  Crosshair,
  Download,
  Printer,
  Ruler,
  CheckCircle2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { ADAS_MODELS_DATABASE } from '../data/chinaWorkshopSeed';
import { AdasModelSpec } from '../types/automotive';

/**
 * Dessine les primitives vectorielles 1:1 de la cible sur un contexte jsPDF décalé de (originX, originY) en mm.
 * Permet exactement la même géométrie vectorielle sur un grand format Traceur 1:1 ET sur des tuiles A4 assemblables.
 */
function drawAdasVectorTarget(
  doc: jsPDF,
  spec: AdasModelSpec,
  originX: number,
  originY: number
) {
  const w = spec.targetWidthMm;
  const h = spec.targetHeightMm;
  const cx = originX + w / 2;
  const cy = originY + h / 2;

  // Fond blanc pur et bordure noire de découpe 1:1
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect(originX, originY, w, h, 'FD');

  if (spec.pattern === 'dual_circle_checker') {
    const sq = spec.checkerSquareMm || 50;
    const bandWidth = sq * 2;

    // Bandes damiers verticales gauche & droite
    doc.setFillColor(0, 0, 0);
    const cols = 2;
    const rows = Math.floor(h / sq);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          doc.rect(originX + c * sq, originY + r * sq, sq, sq, 'F');
          doc.rect(originX + w - bandWidth + c * sq, originY + r * sq, sq, sq, 'F');
        }
      }
    }

    // Deux grands cercles concentriques centraux calibrés
    const spacing = spec.circleSpacingMm || w * 0.52;
    const rOuter = (spec.circleDiameterMm || 200) / 2;
    const rMid = rOuter * 0.62;
    const rInner = rOuter * 0.25;

    [cx - spacing / 2, cx + spacing / 2].forEach((circleX) => {
      doc.setFillColor(0, 0, 0);
      doc.circle(circleX, cy, rOuter, 'F');
      doc.setFillColor(255, 255, 255);
      doc.circle(circleX, cy, rMid, 'F');
      doc.setFillColor(0, 0, 0);
      doc.circle(circleX, cy, rInner, 'F');

      // Croix de visée centrale de précision
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(circleX - 8, cy, circleX + 8, cy);
      doc.line(circleX, cy - 8, circleX, cy + 8);
    });
  } else if (spec.pattern === 'mg_lane_checker') {
    const sq = spec.checkerSquareMm || 60;
    // Blocs damiers SAIC haut-contraste 4x4 aux 4 coins + réticule central
    const cornerCols = 4;
    const cornerRows = 3;
    const corners = [
      { sx: originX + 15, sy: originY + 15 },
      { sx: originX + w - 15 - cornerCols * sq, sy: originY + 15 },
      { sx: originX + 15, sy: originY + h - 15 - cornerRows * sq },
      { sx: originX + w - 15 - cornerCols * sq, sy: originY + h - 15 - cornerRows * sq },
    ];
    doc.setFillColor(0, 0, 0);
    corners.forEach(({ sx, sy }) => {
      for (let r = 0; r < cornerRows; r++) {
        for (let c = 0; c < cornerCols; c++) {
          if ((r + c) % 2 === 0) {
            doc.rect(sx + c * sq, sy + r * sq, sq, sq, 'F');
          }
        }
      }
    });

    // Double cercle central SAIC Pilot
    const rOuter = (spec.circleDiameterMm || 180) / 2;
    doc.setFillColor(0, 0, 0);
    doc.circle(cx, cy, rOuter, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, rOuter * 0.55, 'F');
    doc.setFillColor(0, 0, 0);
    doc.circle(cx, cy, rOuter * 0.2, 'F');
  } else if (spec.pattern === 'byd_radar_corner') {
    const sq = spec.checkerSquareMm || 50;
    // Bordure haute & basse en damier
    const cols = Math.floor(w / sq);
    doc.setFillColor(0, 0, 0);
    for (let c = 0; c < cols; c++) {
      if (c % 2 === 0) {
        doc.rect(originX + c * sq, originY, sq, sq, 'F');
        doc.rect(originX + c * sq, originY + h - sq, sq, sq, 'F');
      }
    }
    // Triangle centre pour positionnement réflecteur corner 77GHz + 2 cibles caméra
    const spacing = spec.circleSpacingMm || 500;
    const rOuter = (spec.circleDiameterMm || 200) / 2;
    [cx - spacing / 2, cx + spacing / 2].forEach((circleX) => {
      doc.setFillColor(0, 0, 0);
      doc.circle(circleX, cy, rOuter, 'F');
      doc.setFillColor(255, 255, 255);
      doc.circle(circleX, cy, rOuter * 0.58, 'F');
      doc.setFillColor(0, 0, 0);
      doc.circle(circleX, cy, rOuter * 0.22, 'F');
    });
    // Axe laser radar central
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(1.2);
    doc.circle(cx, cy, 24, 'D');
    doc.line(cx - 32, cy, cx + 32, cy);
    doc.line(cx, cy - 32, cx, cy + 32);
  } else {
    // avm_360_mat (Mire Damier complet sol 1:1)
    const sq = spec.checkerSquareMm || 100;
    const cols = Math.floor(w / sq);
    const rows = Math.floor(h / sq);
    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          doc.rect(originX + c * sq, originY + r * sq, sq, sq, 'F');
        }
      }
    }
  }

  // Réticule central d'alignement laser + Cartouche de cotes
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.6);
  doc.line(cx - 18, cy, cx + 18, cy);
  doc.line(cx, cy - 18, cx, cy + 18);

  // Barre d'étalonnage de contrôle 100 mm = 10.0 cm exacts
  const rulerX = originX + 20;
  const rulerY = originY + h - 14;
  doc.setFillColor(255, 255, 255);
  doc.rect(rulerX - 4, rulerY - 9, 130, 12, 'F');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(rulerX, rulerY, rulerX + 100, rulerY);
  doc.line(rulerX, rulerY - 3, rulerX, rulerY + 2);
  doc.line(rulerX + 50, rulerY - 2, rulerX + 50, rulerY + 1);
  doc.line(rulerX + 100, rulerY - 3, rulerX + 100, rulerY + 2);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text('CONTROLE ECHELLE 1:1 = 100.0 mm EXACT (10.0 cm)', rulerX, rulerY - 4);

  // Cartouche infos modèle
  doc.setFillColor(255, 255, 255);
  doc.rect(originX + w / 2 - 145, originY + 6, 290, 13, 'F');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(
    `AUTOPRO ADAS 1:1 | ${spec.brand.toUpperCase()} ${spec.model} | Dist: ${spec.distanceFromFrontAxleMm}mm | H: ${spec.cameraOrTargetHeightMm}mm`,
    cx,
    originY + 14,
    { align: 'center' }
  );
}

export const AdasTargetPdfModule: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>(ADAS_MODELS_DATABASE[0].id);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const selectedSpec = useMemo(
    () => ADAS_MODELS_DATABASE.find((m) => m.id === selectedId) || ADAS_MODELS_DATABASE[0],
    [selectedId]
  );

  // Format 1:1 Grand Format (Traceur / Imprimerie locale)
  const handleDownloadFullScalePdf = () => {
    const spec = selectedSpec;
    const margin = 15;
    const pageW = spec.targetWidthMm + margin * 2;
    const pageH = spec.targetHeightMm + margin * 2;

    const doc = new jsPDF({
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pageW, pageH],
    });

    drawAdasVectorTarget(doc, spec, margin, margin);
    const fileName = `AutoPro_ADAS_1_1_${spec.brand}_${spec.targetWidthMm}x${spec.targetHeightMm}mm.pdf`;
    doc.save(fileName);
    setExportStatus(
      `PDF vectoriel 1:1 Grand Format généré (${pageW} x ${pageH} mm) — À imprimer sans mise à l'échelle (100% / Taille réelle).`
    );
  };

  // Format 1:1 Multi-Pages A4 Tuilé (Pour imprimante bureau A4 standard en atelier DZ)
  const handleDownloadTiledA4Pdf = () => {
    const spec = selectedSpec;
    const a4W = 210;
    const a4H = 297;
    const tileW = 190; // 10mm marge tout autour
    const tileH = 277;

    const cols = Math.ceil(spec.targetWidthMm / tileW);
    const rows = Math.ceil(spec.targetHeightMm / tileH);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Page 1 : Fiche de pose & Plan d'assemblage des feuilles A4
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(`FICHE POSE & ASSEMBLAGE ADAS 1:1 — ${spec.brand.toUpperCase()}`, 14, 20);
    doc.setFontSize(11);
    doc.text(`Modèle : ${spec.model} (${spec.years})`, 14, 29);
    doc.text(`Système : ${spec.systemName}`, 14, 36);
    doc.text(`Dimensions Cible Exactes : ${spec.targetWidthMm} mm x ${spec.targetHeightMm} mm`, 14, 43);

    doc.setDrawColor(15, 23, 42);
    doc.rect(14, 52, 182, 42);
    doc.setFontSize(11);
    doc.text(`COTES EXACTES DE PLACEMENT :`, 18, 60);
    doc.setFontSize(10);
    doc.text(`• Distance depuis centre essieu avant : ${spec.distanceFromFrontAxleMm} mm (${(spec.distanceFromFrontAxleMm / 1000).toFixed(2)} m)`, 18, 68);
    doc.text(`• Hauteur centre mire / bord depuis le sol : ${spec.cameraOrTargetHeightMm} mm (${(spec.cameraOrTargetHeightMm / 10).toFixed(1)} cm)`, 18, 75);
    doc.text(`• Décalage latéral par rapport à l'axe véhicule : ${spec.lateralOffsetMm} mm (Centré)`, 18, 82);
    doc.text(`• Procédure OBD2 : ${spec.obdProcedure}`, 18, 89);

    doc.setFontSize(11);
    doc.text(`Grille d'assemblage A4 (${cols} colonnes x ${rows} lignes = ${cols * rows} feuilles à scotchage bord-à-bord) :`, 14, 108);

    const cellW = Math.min(32, 170 / cols);
    const cellH = (cellW * tileH) / tileW;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 14 + c * cellW;
        const y = 116 + r * cellH;
        doc.rect(x, y, cellW, cellH);
        doc.setFontSize(9);
        doc.text(`L${r + 1}-C${c + 1}`, x + cellW / 2, y + cellH / 2 + 2, { align: 'center' });
      }
    }

    doc.setFontSize(10);
    doc.text(
      `IMPORTANT IMPRESSION : Dans Adobe / Chrome, cocher IMPÉRATIVEMENT "Taille réelle (100%)" — Jamais "Ajuster à la page".`,
      14,
      270
    );

    // Génération de chaque tuile A4 en gardant le vecteur à l'échelle exacte 1:1
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        doc.addPage('a4', 'portrait');
        const originX = 10 - c * tileW;
        const originY = 10 - r * tileH;
        drawAdasVectorTarget(doc, spec, originX, originY);

        // Masquage des 10mm de marge blanche propre + Repères de découpe & index tuile
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, a4W, 10, 'F');
        doc.rect(0, a4H - 10, a4W, 10, 'F');
        doc.rect(0, 0, 10, a4H, 'F');
        doc.rect(a4W - 10, 0, 10, a4H, 'F');

        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.3);
        doc.rect(10, 10, tileW, tileH);

        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(
          `TUILE [Ligne ${r + 1}/${rows} · Colonne ${c + 1}/${cols}] — ${spec.brand} ${spec.model} — Échelle 100% (1:1)`,
          10,
          7
        );
      }
    }

    const fileName = `AutoPro_ADAS_A4_Tuile_${spec.brand}_${cols}x${rows}.pdf`;
    doc.save(fileName);
    setExportStatus(
      `PDF A4 Tuilé généré (1 fiche de cotes + ${cols * rows} feuilles A4 à assembler à 100% / Taille réelle).`
    );
  };

  return (
    <div className="space-y-5">
      {/* Model Selector Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Crosshair className="w-4 h-4" />
            Sélection Modèle Véhicule Chinois (Calibration Statique)
          </div>
          <p className="text-xs text-slate-400">
            Cibles vectorielles exactes au millimètre près — Prêtes pour imprimerie traceur ou imprimante A4 locale
          </p>
        </div>

        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setExportStatus(null);
          }}
          className="px-3.5 py-2.5 rounded-lg bg-slate-950 border border-cyan-500/40 text-sm font-semibold text-white min-w-[290px] focus:outline-none focus:border-cyan-400"
        >
          {ADAS_MODELS_DATABASE.map((m) => (
            <option key={m.id} value={m.id}>
              {m.brand} — {m.model} ({m.years})
            </option>
          ))}
        </select>
      </div>

      {exportStatus && (
        <div className="px-4 py-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{exportStatus}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Exact Placement Dimensions + OBD Procedure */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Ruler className="w-4 h-4 text-cyan-400" />
              Cotes Exactes de Placement Atelier
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block">
                  Distance Essieu Avant (X)
                </span>
                <span className="text-xl font-mono font-extrabold text-cyan-300">
                  {selectedSpec.distanceFromFrontAxleMm} mm
                </span>
                <span className="text-[11px] text-slate-500 block">
                  soit {(selectedSpec.distanceFromFrontAxleMm / 100).toFixed(1)} cm devant centre roue AV
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block">
                  Hauteur Sol → Cible (Z)
                </span>
                <span className="text-xl font-mono font-extrabold text-amber-300">
                  {selectedSpec.cameraOrTargetHeightMm === 0
                    ? 'SOL (0 mm)'
                    : `${selectedSpec.cameraOrTargetHeightMm} mm`}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {selectedSpec.cameraOrTargetHeightMm === 0
                    ? 'À plat au sol (Mire AVM 360°)'
                    : `Axe central à ${(selectedSpec.cameraOrTargetHeightMm / 10).toFixed(1)} cm`}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block">
                  Dimensions Cible 1:1
                </span>
                <span className="text-sm font-mono font-bold text-white">
                  {selectedSpec.targetWidthMm} × {selectedSpec.targetHeightMm} mm
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Carrés {selectedSpec.checkerSquareMm || 50} mm
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block">
                  Décalage Latéral (Y)
                </span>
                <span className="text-sm font-mono font-bold text-emerald-300">
                  {selectedSpec.lateralOffsetMm} mm (Axe Logo)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Tolérance laser ±5 mm
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-blue-950/40 border border-blue-800/60 space-y-1.5">
              <div className="text-[11px] font-bold uppercase text-blue-300">
                Chemin Valise OBD2 / UDS
              </div>
              <p className="text-xs font-mono text-white">{selectedSpec.obdProcedure}</p>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-700/40 space-y-1">
              <div className="text-[11px] font-bold uppercase text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Conditions Critiques Avant Lancement
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedSpec.calibrationNotes}
              </p>
            </div>

            {/* Export PDF Buttons */}
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={handleDownloadFullScalePdf}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                Télécharger Cible PDF Vectorielle 1:1 (Imprimerie / Traceur)
              </button>

              <button
                type="button"
                onClick={handleDownloadTiledA4Pdf}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-cyan-400" />
                Télécharger PDF A4 Tuilé 1:1 (Imprimante Bureau Standard)
              </button>
            </div>
          </div>
        </div>

        {/* Right: Visual SVG 1:1 Schematic Preview */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Aperçu Vectoriel Cible : {selectedSpec.targetName}
              </h3>
              <p className="text-xs text-slate-400">{selectedSpec.systemName}</p>
            </div>
            <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-[11px] text-cyan-300">
              Échelle Vectorielle 1:1
            </span>
          </div>

          {/* Target SVG Rendering Preview */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex items-center justify-center">
            <svg
              viewBox={`0 0 ${selectedSpec.targetWidthMm} ${selectedSpec.targetHeightMm}`}
              className="w-full max-h-[340px] bg-white border-2 border-slate-700 shadow-lg"
            >
              {selectedSpec.pattern === 'dual_circle_checker' && (
                <>
                  {Array.from({ length: Math.floor(selectedSpec.targetHeightMm / (selectedSpec.checkerSquareMm || 50)) }).map((_, r) =>
                    [0, 1].map((c) => {
                      const sq = selectedSpec.checkerSquareMm || 50;
                      if ((r + c) % 2 !== 0) return null;
                      return (
                        <React.Fragment key={`${r}-${c}`}>
                          <rect x={c * sq} y={r * sq} width={sq} height={sq} fill="#000" />
                          <rect
                            x={selectedSpec.targetWidthMm - sq * 2 + c * sq}
                            y={r * sq}
                            width={sq}
                            height={sq}
                            fill="#000"
                          />
                        </React.Fragment>
                      );
                    })
                  )}
                  {[
                    selectedSpec.targetWidthMm / 2 - (selectedSpec.circleSpacingMm || 500) / 2,
                    selectedSpec.targetWidthMm / 2 + (selectedSpec.circleSpacingMm || 500) / 2,
                  ].map((cxVal, idx) => {
                    const rO = (selectedSpec.circleDiameterMm || 200) / 2;
                    return (
                      <g key={idx}>
                        <circle cx={cxVal} cy={selectedSpec.targetHeightMm / 2} r={rO} fill="#000" />
                        <circle cx={cxVal} cy={selectedSpec.targetHeightMm / 2} r={rO * 0.62} fill="#fff" />
                        <circle cx={cxVal} cy={selectedSpec.targetHeightMm / 2} r={rO * 0.25} fill="#000" />
                      </g>
                    );
                  })}
                </>
              )}

              {selectedSpec.pattern === 'mg_lane_checker' && (
                <>
                  {[
                    { sx: 15, sy: 15 },
                    { sx: selectedSpec.targetWidthMm - 15 - 4 * (selectedSpec.checkerSquareMm || 60), sy: 15 },
                    { sx: 15, sy: selectedSpec.targetHeightMm - 15 - 3 * (selectedSpec.checkerSquareMm || 60) },
                    {
                      sx: selectedSpec.targetWidthMm - 15 - 4 * (selectedSpec.checkerSquareMm || 60),
                      sy: selectedSpec.targetHeightMm - 15 - 3 * (selectedSpec.checkerSquareMm || 60),
                    },
                  ].map((corner, k) => {
                    const sq = selectedSpec.checkerSquareMm || 60;
                    return [0, 1, 2].map((r) =>
                      [0, 1, 2, 3].map((c) =>
                        (r + c) % 2 === 0 ? (
                          <rect
                            key={`${k}-${r}-${c}`}
                            x={corner.sx + c * sq}
                            y={corner.sy + r * sq}
                            width={sq}
                            height={sq}
                            fill="#000"
                          />
                        ) : null
                      )
                    );
                  })}
                  <circle
                    cx={selectedSpec.targetWidthMm / 2}
                    cy={selectedSpec.targetHeightMm / 2}
                    r={(selectedSpec.circleDiameterMm || 180) / 2}
                    fill="#000"
                  />
                  <circle
                    cx={selectedSpec.targetWidthMm / 2}
                    cy={selectedSpec.targetHeightMm / 2}
                    r={((selectedSpec.circleDiameterMm || 180) / 2) * 0.55}
                    fill="#fff"
                  />
                  <circle
                    cx={selectedSpec.targetWidthMm / 2}
                    cy={selectedSpec.targetHeightMm / 2}
                    r={((selectedSpec.circleDiameterMm || 180) / 2) * 0.2}
                    fill="#000"
                  />
                </>
              )}

              {selectedSpec.pattern === 'byd_radar_corner' && (
                <>
                  {Array.from({ length: Math.floor(selectedSpec.targetWidthMm / (selectedSpec.checkerSquareMm || 50)) }).map(
                    (_, c) => {
                      const sq = selectedSpec.checkerSquareMm || 50;
                      if (c % 2 !== 0) return null;
                      return (
                        <React.Fragment key={c}>
                          <rect x={c * sq} y={0} width={sq} height={sq} fill="#000" />
                          <rect
                            x={c * sq}
                            y={selectedSpec.targetHeightMm - sq}
                            width={sq}
                            height={sq}
                            fill="#000"
                          />
                        </React.Fragment>
                      );
                    }
                  )}
                  {[
                    selectedSpec.targetWidthMm / 2 - (selectedSpec.circleSpacingMm || 500) / 2,
                    selectedSpec.targetWidthMm / 2 + (selectedSpec.circleSpacingMm || 500) / 2,
                  ].map((cxVal, idx) => {
                    const rO = (selectedSpec.circleDiameterMm || 200) / 2;
                    return (
                      <g key={idx}>
                        <circle cx={cxVal} cy={selectedSpec.targetHeightMm / 2} r={rO} fill="#000" />
                        <circle cx={cxVal} cy={selectedSpec.targetHeightMm / 2} r={rO * 0.58} fill="#fff" />
                        <circle cx={cxVal} cy={selectedSpec.targetHeightMm / 2} r={rO * 0.22} fill="#000" />
                      </g>
                    );
                  })}
                  <circle
                    cx={selectedSpec.targetWidthMm / 2}
                    cy={selectedSpec.targetHeightMm / 2}
                    r={26}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="4"
                  />
                </>
              )}

              {selectedSpec.pattern === 'avm_360_mat' &&
                Array.from({ length: Math.floor(selectedSpec.targetHeightMm / (selectedSpec.checkerSquareMm || 100)) }).map(
                  (_, r) =>
                    Array.from({
                      length: Math.floor(selectedSpec.targetWidthMm / (selectedSpec.checkerSquareMm || 100)),
                    }).map((__, c) => {
                      const sq = selectedSpec.checkerSquareMm || 100;
                      if ((r + c) % 2 !== 0) return null;
                      return <rect key={`${r}-${c}`} x={c * sq} y={r * sq} width={sq} height={sq} fill="#000" />;
                    })
                )}

              {/* Crosshair */}
              <line
                x1={selectedSpec.targetWidthMm / 2 - 25}
                y1={selectedSpec.targetHeightMm / 2}
                x2={selectedSpec.targetWidthMm / 2 + 25}
                y2={selectedSpec.targetHeightMm / 2}
                stroke="#ef4444"
                strokeWidth="3"
              />
              <line
                x1={selectedSpec.targetWidthMm / 2}
                y1={selectedSpec.targetHeightMm / 2 - 25}
                x2={selectedSpec.targetWidthMm / 2}
                y2={selectedSpec.targetHeightMm / 2 + 25}
                stroke="#ef4444"
                strokeWidth="3"
              />
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 bg-slate-950/70 px-3.5 py-2.5 rounded-lg border border-slate-800">
            <span>
              Règle de contrôle intégrée sur chaque PDF : <strong className="text-white">100.0 mm exact</strong> (vérifier au réglet après impression).
            </span>
            <span className="text-cyan-400 font-mono">100% Hors-Ligne</span>
          </div>
        </div>
      </div>
    </div>
  );
};
