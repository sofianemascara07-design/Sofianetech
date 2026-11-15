import { jsPDF } from 'jspdf';

interface PackRow {
  feature: string;
  std: string;
  reprog: string;
  master: string;
}

const COMMERCIAL_ROWS: PackRow[] = [
  {
    feature: 'Cible Atelier / Client',
    std: 'Electriciens auto & Entretien courant',
    reprog: 'Preparateurs & Specialistes ecrans',
    master: 'Centres Pro, Chiptuners & Ateliers complets',
  },
  {
    feature: 'Prix Logiciel Seul (DZD)',
    std: '25 000 DZD (2,5 Millions)',
    reprog: '35 000 DZD (3,5 Millions)',
    master: '45 000 DZD (4,5 Millions)',
  },
  {
    feature: 'Pack Cle en Main (PC/Tab + VCI)',
    std: '~65 000 DZD',
    reprog: '~85 000 DZD',
    master: '~110 000 DZD',
  },
  {
    feature: 'Prefixe Cle de Licence',
    std: 'AP-DZ26-STD-...',
    reprog: 'AP-DZ26-STG-...',
    master: 'AP-DZ26-MST-...',
  },
  {
    feature: 'Diagnostic OBD2 Reel (BLE/USB) & IA',
    std: 'INCLUS',
    reprog: 'INCLUS',
    master: 'INCLUS',
  },
  {
    feature: 'Historique SaaS & Fiche Atelier DZD',
    std: 'INCLUS',
    reprog: 'INCLUS',
    master: 'INCLUS',
  },
  {
    feature: 'Cameras & Calibration ADAS',
    std: 'INCLUS',
    reprog: 'INCLUS',
    master: 'INCLUS',
  },
  {
    feature: 'Liaison Materielle & Traducteur FR/AR',
    std: 'INCLUS',
    reprog: 'INCLUS',
    master: 'INCLUS',
  },
  {
    feature: 'Catalogue Apps Tablette Android',
    std: 'INCLUS',
    reprog: 'VERROUILLE',
    master: 'INCLUS',
  },
  {
    feature: 'Flash & Reprog ECU (Stage 1/2, FAP/AdBlue)',
    std: 'VERROUILLE',
    reprog: 'INCLUS',
    master: 'INCLUS',
  },
  {
    feature: 'Flash Ecran Chinois (Maps / YouTube / CarPlay)',
    std: 'VERROUILLE',
    reprog: 'INCLUS',
    master: 'INCLUS',
  },
  {
    feature: 'Habitacle & Clim (BCM / Toit ouvrant)',
    std: 'VERROUILLE',
    reprog: 'VERROUILLE',
    master: 'INCLUS',
  },
  {
    feature: 'Cle 3m Mains-Libres & Coupe-Circuit Antivol',
    std: 'VERROUILLE',
    reprog: 'VERROUILLE',
    master: 'INCLUS',
  },
  {
    feature: 'Passerelle Smartech DZ (Port IPC 35100)',
    std: 'VERROUILLE',
    reprog: 'VERROUILLE',
    master: 'INCLUS',
  },
  {
    feature: 'Console Admin & Abonnes Sofiane',
    std: 'MASQUE (Admin seul)',
    reprog: 'MASQUE (Admin seul)',
    master: 'MASQUE (Admin seul)',
  },
  {
    feature: 'Rentabilite & Amortissement Garagiste',
    std: 'Amorti en ~6 diags (4 000 DA)',
    reprog: 'Amorti en 2 flashs (20 000 DA)',
    master: 'Amorti en 1 reprog + 1 ecran',
  },
];

const WORKFLOW_STEPS = [
  {
    step: '1. PROSPECT / GARAGISTE',
    role: 'Client potentiel (58 Wilayas)',
    detail: 'Decouvre AutoPro DZ via WhatsApp ou demonstration directe sur place.',
  },
  {
    step: '2. PASS DEMO LIMITE (10 min)',
    role: 'Test chronometre securise',
    detail: 'Ouvre uniquement Diagnostic, Historique et Cameras. Verrouillage auto a 00:00.',
  },
  {
    step: '3. CONSOLE ADMIN SOFIANE',
    role: 'Creation cle + Verrou HWID',
    detail: 'Choix du Pack (STD / STG / MST), liaison a 1 seul appareil (HWID) et Kill-Switch 15s.',
  },
  {
    step: '4. ACTIVATION POSTE CLIENT',
    role: 'Deblocage selon Pack paye',
    detail: 'STD = 6 modules | REPROG = 7 modules | MASTER = 11 modules complets (sans Admin).',
  },
  {
    step: '5. UPSELL / MISE A NIVEAU',
    role: 'Evolution sans reinstaller',
    detail: 'Passage STD/REPROG vers MASTER ou blocage a distance en 1 clic depuis Admin.',
  },
];

export function downloadCommercialPacksPdf(): string {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm

  // === PAGE 1: TABLEAU COMMERCIAL DES 3 PACKS ===
  // Dark Navy Header Banner
  doc.setFillColor(10, 18, 34);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('AUTOPRO DIAGNOSTIC & FLASH HUB DZ  -  GRILLE COMMERCIALE 3 PACKS', 14, 11);

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    'Contact Sofiane Mascara : 05 57 76 78 04 (+213 557 76 78 04)  |  sofianemascara07@gmail.com  |  https://autoprodz-a7071.web.app',
    14,
    18.5
  );

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text(`Edite le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 40, 18.5);

  // Table Geometry
  const startX = 12;
  let y = 32;
  const colWidths = [84, 62, 62, 65]; // total = 273mm
  const rowHeight = 8.4;

  // Table Header Row
  const headers = [
    { label: 'FONCTIONNALITES & MODULES', bg: [30, 41, 59] as const, fg: [248, 250, 252] as const },
    { label: '1. PACK DIAGNOSTIC STD (25 000 DA)', bg: [15, 76, 129] as const, fg: [255, 255, 255] as const },
    { label: '2. PACK REPROG PRO (35 000 DA)', bg: [88, 28, 135] as const, fg: [255, 255, 255] as const },
    { label: '3. PACK MASTER DZ (45 000 DA)', bg: [6, 95, 70] as const, fg: [255, 255, 255] as const },
  ];

  let x = startX;
  headers.forEach((h, idx) => {
    doc.setFillColor(h.bg[0], h.bg[1], h.bg[2]);
    doc.rect(x, y, colWidths[idx], 10, 'F');
    doc.setTextColor(h.fg[0], h.fg[1], h.fg[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(h.label, x + 2.5, y + 6.4);
    x += colWidths[idx];
  });
  y += 10;

  // Table Body Rows
  COMMERCIAL_ROWS.forEach((row, rIdx) => {
    const isEven = rIdx % 2 === 0;
    const cells = [row.feature, row.std, row.reprog, row.master];
    x = startX;

    cells.forEach((val, cIdx) => {
      // Cell background
      if (cIdx === 0) {
        doc.setFillColor(isEven ? 241 : 248, isEven ? 245 : 250, isEven ? 249 : 252);
      } else if (val === 'INCLUS') {
        doc.setFillColor(220, 252, 231);
      } else if (val === 'VERROUILLE') {
        doc.setFillColor(254, 226, 226);
      } else if (rIdx === 1) {
        doc.setFillColor(254, 249, 195);
      } else {
        doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      }

      doc.setDrawColor(203, 213, 225);
      doc.rect(x, y, colWidths[cIdx], rowHeight, 'FD');

      // Cell text color
      if (val === 'INCLUS') {
        doc.setTextColor(22, 101, 52);
        doc.setFont('helvetica', 'bold');
      } else if (val === 'VERROUILLE') {
        doc.setTextColor(153, 27, 27);
        doc.setFont('helvetica', 'normal');
      } else if (cIdx === 0 || rIdx === 1) {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
      }

      doc.setFontSize(7.8);
      doc.text(val, x + 2.5, y + 5.6);
      x += colWidths[cIdx];
    });
    y += rowHeight;
  });

  // Bottom ROI Strip on Page 1
  y += 4;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(startX, y, 273, 16, 2, 2, 'F');
  doc.setTextColor(250, 204, 21);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ARGUMENTAIRE RENTABILITE ATELIER (ROI IMMEDIAT) :', startX + 4, y + 6);
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(
    'Avec le Pack MASTER DZ (45 000 DZD), il suffit au garagiste de flasher 2 ecrans chinois (20 000 DZD/voiture) ou 1 reprogrammation ECU (30 000 DZD) + 4 diags pour amortir 100% du logiciel.',
    startX + 4,
    y + 12
  );

  // === PAGE 2: SCHEMA DU CIRCUIT DE VENTE & CONTROLE LICENCE ===
  doc.addPage('a4', 'landscape');

  doc.setFillColor(10, 18, 34);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SCHEMA DU CIRCUIT DE VENTE, ACTIVATION HWID & CONTROLE ADMIN', 14, 11);
  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Architecture de protection anti-partage, Pass Demo chronometre et Upsell a distance', 14, 18);

  // 5 Horizontal Workflow Boxes + Arrows
  const boxW = 48;
  const boxH = 54;
  const gap = 8;
  const flowStartX = 12;
  const flowY = 36;

  const boxColors: readonly [number, number, number][] = [
    [30, 58, 138],
    [180, 83, 9],
    [153, 27, 27],
    [6, 95, 70],
    [88, 28, 135],
  ];

  WORKFLOW_STEPS.forEach((item, idx) => {
    const bx = flowStartX + idx * (boxW + gap);
    const col = boxColors[idx];

    // Card outline
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(bx, flowY, boxW, boxH, 2.5, 2.5, 'FD');

    // Card header bar
    doc.setFillColor(col[0], col[1], col[2]);
    doc.roundedRect(bx, flowY, boxW, 13, 2, 2, 'F');
    doc.rect(bx, flowY + 8, boxW, 5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.text(item.step, bx + 2.5, flowY + 8);

    doc.setTextColor(col[0], col[1], col[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.text(item.role, bx + 2.5, flowY + 20, { maxWidth: boxW - 5 });

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.text(item.detail, bx + 2.5, flowY + 29, { maxWidth: boxW - 5 });

    // Arrow to next box
    if (idx < WORKFLOW_STEPS.length - 1) {
      const ax1 = bx + boxW + 1;
      const ax2 = bx + boxW + gap - 1;
      const ay = flowY + boxH / 2;
      doc.setDrawColor(14, 116, 144);
      doc.setLineWidth(0.8);
      doc.line(ax1, ay, ax2, ay);
      doc.line(ax2 - 2, ay - 2, ax2, ay);
      doc.line(ax2 - 2, ay + 2, ax2, ay);
      doc.setLineWidth(0.2);
    }
  });

  // Lower Architectural Summary Boxes (3 Tiers Breakdown)
  const tierY = 104;
  const tierW = 86;
  const tierH = 74;
  const tiers = [
    {
      title: 'PACK DIAGNOSTIC STD - 25 000 DZD',
      color: [15, 76, 129] as const,
      lines: [
        '- Prefix Cle : AP-DZ26-STD-XXXX',
        '- 6 Modules actifs :',
        '  1. Diagnostic OBD2 Reel (BLE / USB)',
        '  2. Historique SaaS & Fiches Atelier',
        '  3. Cameras & Calibration ADAS',
        '  4. Liaison Materielle & Terminal AT',
        '  5. Catalogue Apps Tablette',
        '  6. Traducteur FR / Arabe Auto',
        '- Ideal : Garages & Electriciens Auto',
      ],
    },
    {
      title: 'PACK REPROG PRO - 35 000 DZD',
      color: [88, 28, 135] as const,
      lines: [
        '- Prefix Cle : AP-DZ26-STG-XXXX',
        '- 7 Modules actifs :',
        '  1. Diagnostic OBD2 Reel + IA Mecano',
        '  2. Historique SaaS & Rapports PDF',
        '  3. Cameras & ADAS',
        '  4. Flash & Reprog ECU (Stage 1/2)',
        '  5. Flash Ecran Chinois (Maps/YouTube)',
        '  6. Liaison Materielle',
        '  7. Traducteur FR / Arabe Auto',
      ],
    },
    {
      title: 'PACK MASTER DZ - 45 000 DZD',
      color: [6, 95, 70] as const,
      lines: [
        '- Prefix Cle : AP-DZ26-MST-XXXX',
        '- TOUS LES 11 MODULES CLIENTS :',
        '  + Tout le contenu STD & REPROG PRO',
        '  + Habitacle & Clim (BCM / Toit)',
        '  + Cle 3m Mains-Libres & Antivol',
        '  + Passerelle Smartech DZ (35100)',
        '- Console Admin Sofiane : Toujours masquee',
        '- Verrou HWID + Kill-Switch 15 sec',
        '- Rentabilite max pour centres Pro',
      ],
    },
  ];

  tiers.forEach((t, idx) => {
    const tx = 12 + idx * (tierW + 7);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(t.color[0], t.color[1], t.color[2]);
    doc.roundedRect(tx, tierY, tierW, tierH, 2.5, 2.5, 'FD');

    doc.setFillColor(t.color[0], t.color[1], t.color[2]);
    doc.roundedRect(tx, tierY, tierW, 11, 2, 2, 'F');
    doc.rect(tx, tierY + 6, tierW, 5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(t.title, tx + 3, tierY + 7.2);

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    t.lines.forEach((line, lIdx) => {
      doc.text(line, tx + 3.5, tierY + 18 + lIdx * 6);
    });
  });

  // Footer page 2
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text(
    'AutoPro Diagnostic & Flash Hub DZ  |  Document Commercial Officiel  |  Contact : 05 57 76 78 04',
    14,
    pageHeight - 8
  );

  const fileName = `AutoPro_DZ_Grille_3_Packs_et_Schema_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
  return fileName;
}

export function downloadCommercialPacksExcel(): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const tableRowsHtml = COMMERCIAL_ROWS.map((row, idx) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const cellStyle = (val: string) => {
      if (val === 'INCLUS') return 'background:#dcfce7;color:#166534;font-weight:bold;text-align:center;';
      if (val === 'VERROUILLE') return 'background:#fee2e2;color:#991b1b;text-align:center;';
      if (idx === 1) return 'background:#fef9c3;color:#0f172a;font-weight:bold;text-align:center;';
      return `background:${bg};color:#1e293b;`;
    };
    return `
      <tr>
        <td style="background:#f1f5f9;font-weight:bold;color:#0f172a;border:1px solid #cbd5e1;padding:6px 8px;">${esc(row.feature)}</td>
        <td style="${cellStyle(row.std)}border:1px solid #cbd5e1;padding:6px 8px;">${esc(row.std)}</td>
        <td style="${cellStyle(row.reprog)}border:1px solid #cbd5e1;padding:6px 8px;">${esc(row.reprog)}</td>
        <td style="${cellStyle(row.master)}border:1px solid #cbd5e1;padding:6px 8px;">${esc(row.master)}</td>
      </tr>
    `;
  }).join('');

  const workflowRowsHtml = WORKFLOW_STEPS.map((s) => `
    <tr>
      <td style="background:#e0f2fe;font-weight:bold;color:#0c4a6e;border:1px solid #cbd5e1;padding:6px 8px;">${esc(s.step)}</td>
      <td style="background:#ffffff;font-weight:bold;color:#0f172a;border:1px solid #cbd5e1;padding:6px 8px;">${esc(s.role)}</td>
      <td colspan="2" style="background:#ffffff;color:#334155;border:1px solid #cbd5e1;padding:6px 8px;">${esc(s.detail)}</td>
    </tr>
  `).join('');

  const excelHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8" />
<!--[if gte mso 9]><xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>Grille 3 Packs AutoPro DZ</x:Name>
    <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml><![endif]-->
</head>
<body style="font-family:Arial,sans-serif;">
  <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;">
    <tr>
      <th colspan="4" style="background:#0a1222;color:#22d3ee;font-size:15px;padding:12px;text-align:left;">
        AUTOPRO DIAGNOSTIC &amp; FLASH HUB DZ — GRILLE COMMERCIALE DES 3 PACKS (2026)
      </th>
    </tr>
    <tr>
      <td colspan="4" style="background:#0f172a;color:#e2e8f0;font-size:11px;padding:8px;">
        Contact Sofiane Mascara : 05 57 76 78 04 (+213 557 76 78 04) | Email : sofianemascara07@gmail.com | Web : https://autoprodz-a7071.web.app
      </td>
    </tr>
    <tr>
      <th style="background:#1e293b;color:#ffffff;padding:8px;border:1px solid #cbd5e1;">Critere / Module</th>
      <th style="background:#0f4c81;color:#ffffff;padding:8px;border:1px solid #cbd5e1;">1. Pack DIAGNOSTIC STD (25 000 DZD)</th>
      <th style="background:#581c87;color:#ffffff;padding:8px;border:1px solid #cbd5e1;">2. Pack REPROG PRO (35 000 DZD)</th>
      <th style="background:#065f46;color:#ffffff;padding:8px;border:1px solid #cbd5e1;">3. Pack MASTER DZ (45 000 DZD)</th>
    </tr>
    ${tableRowsHtml}
    <tr><td colspan="4" style="height:18px;border:none;"></td></tr>
    <tr>
      <th colspan="4" style="background:#0a1222;color:#fbbf24;font-size:13px;padding:10px;text-align:left;">
        SCHEMA DU CIRCUIT DE VENTE, ACTIVATION HWID &amp; CONTROLE ADMIN
      </th>
    </tr>
    <tr>
      <th style="background:#1e293b;color:#ffffff;padding:8px;border:1px solid #cbd5e1;">Etape du Flux</th>
      <th style="background:#1e293b;color:#ffffff;padding:8px;border:1px solid #cbd5e1;">Action / Statut</th>
      <th colspan="2" style="background:#1e293b;color:#ffffff;padding:8px;border:1px solid #cbd5e1;">Details Techniques &amp; Securite</th>
    </tr>
    ${workflowRowsHtml}
  </table>
</body>
</html>`;

  const blob = new Blob(['\uFEFF' + excelHtml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fileName = `AutoPro_DZ_Grille_3_Packs_et_Schema_${new Date().toISOString().slice(0, 10)}.xls`;
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return fileName;
}
