import { jsPDF } from 'jspdf';

export interface CockpitTranslationPlanOptions {
  platformName?: string;
  clusterRef?: string;
  ihuRef?: string;
  targetLang?: 'fr' | 'ar';
  themeLabel?: string;
  selectedModules?: string[];
}

export interface CockpitTranslationShareResult {
  fileName: string;
  waUrl: string;
  sharedNatively: boolean;
  notice: string;
}

export function buildCockpitTranslationPlanPdf(
  options: CockpitTranslationPlanOptions = {}
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 12;
  const contentW = pageW - margin * 2;
  const fileName = 'Planning_Pack_Cockpit_Coolray_Traduction_DZ.pdf';

  const platformName =
    options.platformName ||
    'Geely Coolray (SX11 / Restyle / Battle 2026) & Tablettes CN';
  const clusterRef = options.clusterRef || 'IPC-10.25 / 12.3 Digital Cluster';
  const ihuRef = options.ihuRef || 'IHU624G / IHU715P / IHU535G';
  const langLabel =
    options.targetLang === 'ar' ? 'Arabe RTL (Al-Arabiya)' : 'Francais (FR)';
  const themeLabel =
    options.themeLabel || 'Sport R-Track / Cyber Cyan LVDS Maps';

  // Header dark navy
  doc.setFillColor(10, 18, 34);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.2);
  doc.text(
    'PACK COCKPIT COOLRAY + TABLETTE TRADUCTION (FR / AR)',
    margin,
    11.5
  );
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.text(
    'Planning Atelier Garagiste & Manuel Client DZ - Combine IPC + Ecran Central IHU Non Destructif',
    margin,
    18
  );
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7.8);
  doc.text(
    `Plateforme : ${platformName.slice(0, 58)} | Langue : ${langLabel} | Duree : 35-45 min | ${new Date().toLocaleDateString('fr-FR')}`,
    margin,
    24.5
  );

  let y = 35;

  // Alerte Rouge Anti-Bricking
  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(220, 38, 38);
  doc.roundedRect(margin, y, contentW, 27, 2, 2, 'FD');
  doc.setTextColor(153, 27, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.text(
    'REGLE CRITIQUE ANTI-BRICKING (HARD_STOP) - A RESPECTER AVANT TOUT FLASH :',
    margin + 3,
    y + 5.8
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.1);
  const alertLines = doc.splitTextToSize(
    '- Geely Coolray : Ne JAMAIS croiser IHU624G, IHU715P, IHU535G, IHU516G ou Flyme Auto 2.5.0 (Cityray/Starray).\n' +
      '- Protection /system & /vendor : Utiliser uniquement le mode non destructif (/data/app & /data/local/tmp) pour preserver le son DSP et les cameras 360/540 deg.\n' +
      '- Zero ecriture kilometrique : Odometre & VIN (DID F190) verrouilles en lecture seule. Tension >= 12.5V (recommande 13.5V-13.8V).',
    contentW - 6
  );
  doc.text(alertLines, margin + 3, y + 11);
  y += 31;

  // Contenu du Pack 2-en-1
  doc.setFillColor(236, 254, 255);
  doc.setDrawColor(8, 145, 178);
  doc.roundedRect(margin, y, contentW, 23, 2, 2, 'FD');
  doc.setTextColor(14, 116, 144);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.9);
  doc.text(
    `CONTENU DU PACK COMPLET SELECTIONNE (${clusterRef} | ${ihuRef}) :`,
    margin + 3,
    y + 5.5
  );
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const packLines = doc.splitTextToSize(
    `1. COCKPIT COMPTEUR (IPC) : Theme "${themeLabel}", Projection GPS Maps/Waze sur compteur (LVDS), Synchro CarPlay/Android Auto HUD, Widgets Boost 1.5TD & TPMS.\n` +
      `2. TABLETTE CENTRALE (IHU) : Traduction IA ${langLabel} (menus vehicule, 7DCT, ADAS, 540 deg), Export strings.xml / Injection directe + Sideload APK (MicroG, Maps, YouTube).`,
    contentW - 6
  );
  doc.text(packLines, margin + 3, y + 10.5);
  y += 27;

  const phases: Array<{ title: string; duration: string; bullets: string[] }> = [
    {
      title: 'PHASE 1 - CONTROLE 4 PARAMETRES & CODES USINE',
      duration: '5-10 min',
      bullets: [
        'Relever obligatoirement : 1) Modele/Annee, 2) Ref. IHU/Carte mere (IHU624G vs IHU715P vs IHU535G), 3) Puce SoC (SM6150/8155/SE1000/MT8666), 4) Build MCU actuel.',
        'Codes Usine : Geely/Coolray (8888, 3368, *#*#3646633#*#*), Jetour (8888, 123456), Kia CN (2400), VW CNS 3.0 (Appui long MENU 5s).',
      ],
    },
    {
      title: 'PHASE 2 - STABILISATION 13.5V+ & SAUVEGARDE BACKUP',
      duration: '5-10 min',
      bullets: [
        'Laisser le moteur tournant ou brancher un stabilisateur 13.5V-13.8V. Relier le PC/outil sur le port USB Data principal (USB 1 sous console/accoudoir).',
        'Executer le backup automatique dans backup_cockpit/ : global_cockpit.txt, system_cockpit.txt, lvds_display_dump.txt, audio_dsp.txt + EEPROM VIN (DID F190).',
      ],
    },
    {
      title: 'PHASE 3 - FLASH PACK COCKPIT COOLRAY (IPC + LVDS)',
      duration: '10-15 min',
      bullets: [
        'Dans "Flash Cockpit & Ecrans CN" -> onglet "Flash Cockpit Coolray / CN" : choisir le vehicule, le theme et les modules (LVDS Maps, CarPlay HUD, Langue FR/AR, TPMS/540 deg).',
        'Cocher les 2 confirmations de securite et lancer le flash UDS/DoIP (0x714 IPC / 0x770 IHU) + Soft Reset (0x11 01). L\'odometre reste intact.',
      ],
    },
    {
      title: 'PHASE 4 - TRADUCTION TABLETTE (FR / ARABE RTL) & APPS',
      duration: '10 min',
      bullets: [
        'Dans l\'onglet "Traducteur" : selectionner le pack vehicule (ex: Geely Coolray / Flyme Auto / VW CN / Kia CN) et la langue cible (Francais ou Arabe RTL).',
        'Cliquer "Traduire" puis montrer l\'apercu tactile 16:11 au client avant d\'ecrire. Cliquer ensuite "Injecter dans la Tablette" (ou "Exporter strings.xml").',
        'Completer si demande via "Protocole Tablette IHU (3 Etapes)" pour sideload non destructif dans /data/app/ (MicroG, Google Maps, YouTube Car, ZLink5).',
      ],
    },
    {
      title: 'PHASE 5 - CONTROLE FINAL CLIENT & GARANTIE ATELIER',
      duration: '5 min',
      bullets: [
        'Tester devant le client : son radio & ampli DSP, cameras 360/540 deg au clignotant et marche arriere, navigation LVDS sur compteur, zero defaut DTC.',
        'Rappel client : Aucun fichier usine critique modifie ; en cas d\'intervention anterieure ratee ailleurs, le mode "SOS Bug Son / Camera 360" permet la recuperation.',
      ],
    },
  ];

  for (const phase of phases) {
    if (y > 252) {
      doc.addPage();
      y = 14;
    }
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentW, 6.2, 'F');
    doc.setTextColor(34, 211, 238);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(phase.title, margin + 2.5, y + 4.3);
    doc.setTextColor(250, 204, 21);
    doc.text(phase.duration, pageW - margin - 15, y + 4.3);
    y += 8;

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.9);
    for (const b of phase.bullets) {
      const lines = doc.splitTextToSize(`• ${b}`, contentW - 4);
      doc.text(lines, margin + 2, y);
      y += lines.length * 3.8 + 1.1;
    }
    y += 1.5;
  }

  // Footer
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, 283, pageW - margin, 283);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'AutoPro Flash & Diagnostic Hub DZ  |  https://autoprodz-a7071.web.app  |  Support Atelier : 05 57 76 78 04',
    margin,
    288
  );

  return { doc, fileName };
}

export async function shareCockpitTranslationPlanPdf(
  options: CockpitTranslationPlanOptions = {}
): Promise<CockpitTranslationShareResult> {
  const { doc, fileName } = buildCockpitTranslationPlanPdf(options);
  const platformLabel =
    options.platformName || 'Geely Coolray & Tablettes CN';
  const langTxt =
    options.targetLang === 'ar' ? 'Arabe RTL (العربية)' : 'Français';

  const shareText =
    `PLANNING PACK COCKPIT COOLRAY + TABLETTE TRADUCTION (${langTxt})\n` +
    `Véhicule : ${platformLabel}\n` +
    `Durée totale : 35–45 min | Zéro modification kilométrique | Son DSP & Caméras 360°/540° 100% préservés\n\n` +
    `1. Contrôle 4 paramètres (Modèle, IHU, SoC, MCU) — jamais croiser IHU624G / 715P / 535G / Flyme Auto\n` +
    `2. Stabilisation 13.5V+ & Backup complet (backup_cockpit/ + EEPROM VIN)\n` +
    `3. Flash Cockpit IPC (Thème Sport, Projection GPS LVDS, CarPlay HUD, TPMS/540°)\n` +
    `4. Traducteur IA Tablette (${langTxt}) + Aperçu client 16:11 + Injection non destructive / Sideload APK\n` +
    `5. Contrôle final Son DSP + Caméras 540° + Zéro DTC\n` +
    `AutoPro DZ : https://autoprodz-a7071.web.app`;

  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  try {
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    const navShare = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };
    if (
      typeof navShare.share === 'function' &&
      (!navShare.canShare || navShare.canShare({ files: [pdfFile] }))
    ) {
      await navShare.share({
        title: 'Planning Pack Cockpit Coolray & Traduction Tablette DZ',
        text: shareText,
        files: [pdfFile],
      });
      return {
        fileName,
        waUrl,
        sharedNatively: true,
        notice: 'Planning PDF Pack Cockpit + Traduction partagé avec succès.',
      };
    }
  } catch {
    // Fallback below if user cancels or browser blocks file share
  }

  doc.save(fileName);
  try {
    await navigator.clipboard?.writeText(shareText);
  } catch {
    // Ignore clipboard error in restricted contexts
  }

  return {
    fileName,
    waUrl,
    sharedNatively: false,
    notice: `PDF téléchargé (${fileName}) et résumé copié ! Utilisez le bouton WhatsApp ci-dessous pour l'envoyer.`,
  };
}
