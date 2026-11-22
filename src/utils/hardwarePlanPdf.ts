import { jsPDF } from 'jspdf';

export interface HardwarePlanShareResult {
  fileName: string;
  waUrl: string;
  sharedNatively: boolean;
  notice: string;
}

const CANVAS_W = 1240; // ~150 DPI A4 width
const CANVAS_H = 1754; // ~150 DPI A4 height

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function renderFrenchPageCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const M = 56;
  const CW = CANVAS_W - M * 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';

  // Header
  ctx.fillStyle = '#0a1222';
  ctx.fillRect(0, 0, CANVAS_W, 175);

  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 31px "Segoe UI", Arial, sans-serif';
  ctx.fillText('PLAN MATÉRIEL EXIGÉ — ATELIER AUTOPRO DZ (FRANÇAIS)', M, 62);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '20px "Segoe UI", Arial, sans-serif';
  ctx.fillText(
    'Équipement recommandé pour Cockpit & Tablettes CN + Flash Piston Coolray (MG1US008) & Reprog ECU',
    M,
    102
  );

  ctx.fillStyle = '#94a3b8';
  ctx.font = '17px "Segoe UI", Arial, sans-serif';
  ctx.fillText(
    `Page 1/2 (Français)  |  Édité le ${new Date().toLocaleDateString('fr-FR')}  |  https://autoprodz-a7071.web.app`,
    M,
    142
  );

  let y = 205;

  const sections: Array<{
    badge: string;
    title: string;
    bg: string;
    border: string;
    headerBg: string;
    headerColor: string;
    items: string[];
  }> = [
    {
      badge: 'NIVEAU 1',
      title: 'PACK COCKPIT + TABLETTE TRADUCTION & DIAG (Démarrage 0 Risque)',
      bg: '#f0fdfa',
      border: '#14b8a6',
      headerBg: '#0f172a',
      headerColor: '#22d3ee',
      items: [
        '• PC Portable Windows 10 / 11 (64 bits, i5+, 8 Go RAM, SSD) : obligatoire pour scripts ADB, pilotes et Agent PC.',
        '• Câbles USB Data blindés courts (0,5 m – 1 m) : 1× USB-A ↔ USB-A (ports IHU) + 1× USB-C Data (Flyme / VW / Kia CN).',
        '• Clé USB fiable 16 Go ou 32 Go formatée en FAT32 (SanDisk / Kingston) pour sauvegardes et packs officiels.',
        '• Boîtier OBD2 fiable compatible navigateur : vLinker MC+ / FD+ (BLE), Vgate iCar Pro BLE 4.0 ou OBDLink CX/EX.',
      ],
    },
    {
      badge: 'NIVEAU 2',
      title: 'FLASH PISTON COOLRAY (BOSCH MG1US008 / MG1CS080) & REPROG ECU',
      bg: '#eff6ff',
      border: '#3b82f6',
      headerBg: '#0f172a',
      headerColor: '#60a5fa',
      items: [
        '• IMPORTANT : Un simple câble ELM327 ou VNCI 6154A ne lit/écrit PAS le Full Flash Bosch MG1US008 par OBD !',
        '• Option Meilleur Rapport Qualité/Prix : PCMflash Original (Dongle Guardant) + Module 71 (Bosch Bench) + Scanmatik 2 Pro + Câble GPT (SM2 Pro sert aussi d’interface J2534 officielle dans l’Agent PC AutoPro).',
        '• Option Alternative Atelier : FoxFlash ou KT200 II en mode Bench sur table avec alimentation stabilisée.',
        '• Option Haut de Gamme Auto : MagicMotorsport FLEX, Autotuner ou KESS3 (Checksum + RSA cloud & récupération rapides).',
      ],
    },
    {
      badge: 'OBLIGATOIRE',
      title: 'ÉQUIPEMENT DE SÉCURITÉ ATELIER (Zéro Bricking / Zéro Panne)',
      bg: '#fefce8',
      border: '#eab308',
      headerBg: '#0f172a',
      headerColor: '#facc15',
      items: [
        '• Stabilisateur de Tension Atelier 13.5V – 13.8V (50A à 100A min. type GYSflash / MST-80) : blocage strict sous 13.0V.',
        '• Alimentation de table 12V–13.8V (5A stable) pour lectures Bench Bosch MG1 sur établi.',
        '• Valise diag multimarque d’appui (Launch / Autel / Thinkdiag) pour contrôler Misfires live, Knock route et compression avant flash.',
        '• Multimètre précis + pince ampèremétrique pour vérifier batterie et alternateur en 10 sec devant le client.',
      ],
    },
    {
      badge: 'À ÉVITER',
      title: 'MATÉRIEL INTERDIT QUI FAIT PERDRE VOTRE RÉPUTATION',
      bg: '#fef2f2',
      border: '#ef4444',
      headerBg: '#7f1d1d',
      headerColor: '#fecaca',
      items: [
        '• Mini ELM327 bleus bas de gamme (~1 500 DA) : coupent la trame CAN en plein scan et figent la lecture.',
        '• Clones Kess V2 / Ktag chinois anciens : ne supportent pas Bosch MG1US008 (risque de blocage immédiat).',
        '• Simple chargeur de batterie qui pulse ou monte à 15V+ pendant le flash (risque de griller/bricker l’ECU).',
        '• Flasher sans Full Backup préalable (Flash + EEPROM) ou sans vérifier les ratés P0300–P0304 / bougies Iridium.',
      ],
    },
  ];

  for (const sec of sections) {
    // Measure height dynamically
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    const wrappedBlocks = sec.items.map((item) => wrapTextLines(ctx, item, CW - 44));
    const totalLines = wrappedBlocks.reduce((acc, lines) => acc + lines.length, 0);
    const boxH = 54 + totalLines * 29 + (wrappedBlocks.length - 1) * 10 + 22;

    drawRoundedRect(ctx, M, y, CW, boxH, 12, sec.bg, sec.border);

    // Header bar
    drawRoundedRect(ctx, M, y, CW, 46, 10, sec.headerBg);
    ctx.fillStyle = sec.headerColor;
    ctx.font = 'bold 21px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`[${sec.badge}]  ${sec.title}`, M + 18, y + 30);

    let ty = y + 76;
    ctx.fillStyle = '#0f172a';
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    for (const lines of wrappedBlocks) {
      for (const line of lines) {
        ctx.fillText(line, M + 22, ty);
        ty += 29;
      }
      ty += 10;
    }

    y += boxH + 22;
  }

  // Footer
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, CANVAS_H - 72);
  ctx.lineTo(CANVAS_W - M, CANVAS_H - 72);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '18px "Segoe UI", Arial, sans-serif';
  ctx.fillText(
    'AutoPro Flash & Diagnostic Hub DZ  |  Support Atelier : 05 57 76 78 04  |  Page 2 : Version Darija (الدارجة الجزائرية)',
    M,
    CANVAS_H - 38
  );

  return canvas;
}

function renderDarijaPageCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const M = 56;
  const CW = CANVAS_W - M * 2;
  const R = CANVAS_W - M; // Right anchor for RTL

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';

  // Header
  ctx.fillStyle = '#0a1222';
  ctx.fillRect(0, 0, CANVAS_W, 175);

  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 33px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('مخطط العتاد المطلوب للورشة — بالدارجة الجزائرية (AutoPro DZ)', R, 64);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '22px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(
    'واش تحتاج بالضبط باش تخدم الكوكبيت والتابلت + فلاش البيستون كولراي (MG1US008) بأمان تام',
    R,
    106
  );

  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(
    `صفحة 2/2 (الدارجة الجزائرية)  |  ${new Date().toLocaleDateString('fr-FR')}  |  https://autoprodz-a7071.web.app`,
    R,
    144
  );

  let y = 205;

  const sections: Array<{
    badge: string;
    title: string;
    bg: string;
    border: string;
    headerBg: string;
    headerColor: string;
    items: string[];
  }> = [
    {
      badge: 'المرحلة 1',
      title: 'عتاد باقة الكوكبيت وترجمة الشاشة الصينية (خدمة سريعة بلا خطر)',
      bg: '#f0fdfa',
      border: '#14b8a6',
      headerBg: '#0f172a',
      headerColor: '#22d3ee',
      items: [
        '• بيسي بورطابل مليح (Windows 10/11، i5، 8 جيغا رام، SSD): لازم باش يمشيو سكريبتات ADB ووكيل الكمبيوتر.',
        '• كابلات USB Data أصلية وقصيرة (نصف متر إلى متر): كابل USB-A لـ USB-A للشاشات + كابل USB-C للشاشات الجديدة (Cityray / VW / Kia CN).',
        '• فلاش ديسك 16 أو 32 جيغا فورماتي FAT32 (SanDisk / Kingston) — ما تخدمش بفلاش 64 جيغا الفوق.',
        '• سكانير بلوتوث أو كابل OBD مليح يتصل بالمتصفح: vLinker MC+ / FD+ أو Vgate iCar Pro BLE أو OBDLink.',
      ],
    },
    {
      badge: 'المرحلة 2',
      title: 'عتاد فلاش البيستون كولراي (MG1US008 / MG1CS080) والـ ECU',
      bg: '#eff6ff',
      border: '#3b82f6',
      headerBg: '#0f172a',
      headerColor: '#60a5fa',
      items: [
        '• تنبيه مهم: كابل ELM327 ولا VNCI 6154A ما يقراوش وما يكتبوش Full Flash تاع كمبيوتر Bosch MG1US008 عبر OBD!',
        '• أحسن خيار بالسعر والفعالية في الجزائر: PCMflash الأصلي + Module 71 (Bosch Bench) + Scanmatik 2 Pro + كابل GPT (و SM2 Pro يمشي ثانيك مع Agent PC تاعنا J2534).',
        '• بديل اقتصادي معروف في الورشات: FoxFlash أو KT200 II في وضع Bench على الطاولة بدون فتح الكومبيوتر.',
        '• الخيار الاحترافي العالي: FLEX أو Autotuner أو KESS3 (حساب Checksum و RSA أوتوماتيكي واسترجاع سريع).',
      ],
    },
    {
      badge: 'إجباري',
      title: 'عتاد الحماية والأمان (باش ما تبلوكيش كمبيوتر وتبقى سمعتك مرفوعة)',
      bg: '#fefce8',
      border: '#eab308',
      headerBg: '#0f172a',
      headerColor: '#facc15',
      items: [
        '• سطابيليزاتور بطارية احترافي 13.5V – 13.8V (قوة 50A إلى 100A مثل GYSflash / MST-80): الفلاش يتبلوكا تحت 13.0V.',
        '• أليمونطاسيون طاولة 12V–13.8V (5A ثابتة) لقراءة كمبيوتر MG1 في وضع Bench.',
        '• جهاز تشخيص مساند (Launch / Autel / Thinkdiag) باش تراقب الـ Misfires و Knock والكومبريسيون قبل أي فلاش.',
        '• مولتيميتر دقيق باش تعبر البطارية والدينامو في 10 ثواني قدام الزبون.',
      ],
    },
    {
      badge: 'ممنوع',
      title: 'صوالح رخاص لازم تبعد عليهم باش ما تخسرش الزبائن',
      bg: '#fef2f2',
      border: '#ef4444',
      headerBg: '#7f1d1d',
      headerColor: '#fecaca',
      items: [
        '• ميني ELM327 الأزرق الرخيص (1500 دج): يتكوبّا وسط الفحص ويدير أخطاء في الاتصال.',
        '• أجهزة Kess V2 / Ktag الصينية القديمة: ما تقراش كمبيوتر Coolray MG1US008 وتقدر تبلوكي.',
        '• شاحن بطارية عادي اللي يطلع الفولطاج فوق 15V أو يرمش: يقدر يحرق الكومبيوتر وسط الكتابة.',
        '• عمرك ما تكتب بلا ما تسحب Full Backup (Flash + EEPROM) وبلا ما تفيريفي البوجيهات وأعطال P0300–P0304.',
      ],
    },
  ];

  for (const sec of sections) {
    ctx.font = '21px "Segoe UI", Tahoma, Arial, sans-serif';
    const wrappedBlocks = sec.items.map((item) => wrapTextLines(ctx, item, CW - 44));
    const totalLines = wrappedBlocks.reduce((acc, lines) => acc + lines.length, 0);
    const boxH = 54 + totalLines * 31 + (wrappedBlocks.length - 1) * 10 + 22;

    drawRoundedRect(ctx, M, y, CW, boxH, 12, sec.bg, sec.border);

    // Header bar
    drawRoundedRect(ctx, M, y, CW, 46, 10, sec.headerBg);
    ctx.fillStyle = sec.headerColor;
    ctx.font = 'bold 22px "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText(`[${sec.badge}]  ${sec.title}`, R - 18, y + 31);

    let ty = y + 76;
    ctx.fillStyle = '#0f172a';
    ctx.font = '21px "Segoe UI", Tahoma, Arial, sans-serif';
    for (const lines of wrappedBlocks) {
      for (const line of lines) {
        ctx.fillText(line, R - 22, ty);
        ty += 31;
      }
      ty += 10;
    }

    y += boxH + 22;
  }

  // Footer
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, CANVAS_H - 72);
  ctx.lineTo(CANVAS_W - M, CANVAS_H - 72);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '18px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(
    'AutoPro Flash & Diagnostic Hub DZ  |  الدعم التقني للورشات : 05 57 76 78 04  |  صفحة 1 : النسخة الفرنسية',
    R,
    CANVAS_H - 38
  );

  return canvas;
}

export function buildHardwarePlanPdf() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fileName = 'Plan_Materiel_Exige_Atelier_DZ_FR_Darija.pdf';

  const page1Canvas = renderFrenchPageCanvas();
  const page1Img = page1Canvas.toDataURL('image/png');
  doc.addImage(page1Img, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

  doc.addPage();
  const page2Canvas = renderDarijaPageCanvas();
  const page2Img = page2Canvas.toDataURL('image/png');
  doc.addImage(page2Img, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

  return { doc, fileName };
}

export async function shareHardwarePlanPdf(): Promise<HardwarePlanShareResult> {
  const { doc, fileName } = buildHardwarePlanPdf();

  const shareText =
    `PLAN MATÉRIEL EXIGÉ (FR + DARIJA) — AutoPro DZ\n` +
    `1️⃣ Cockpit & Tablette CN : PC Windows 10/11 + Câbles USB Data (A-A & USB-C) + Clé FAT32 (16/32Go) + vLinker/OBDLink BLE\n` +
    `2️⃣ Flash Piston Coolray (MG1US008) : Outil Bench obligatoire (Scanmatik 2 Pro + PCMflash Mod.71 ou FLEX/Autotuner/FoxFlash)\n` +
    `3️⃣ Sécurité : Stabilisateur 13.5–13.8V (50A+) + Valise Diag d'appui (Misfires/Knock)\n\n` +
    `الدارجة : باش تخدم الكوكبيت والتابلت وفلاش البيستون كولراي بلا خطر، لازم سطابيليزاتور 13.8V + كابلات Data أصلية + أداة Bench للـ MG1US008.\n` +
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
        title: 'Plan Matériel Exigé (FR + Darija) — AutoPro DZ',
        text: shareText,
        files: [pdfFile],
      });
      return {
        fileName,
        waUrl,
        sharedNatively: true,
        notice: 'Plan Matériel PDF (FR + Darija) partagé avec succès.',
      };
    }
  } catch {
    // Fallback below
  }

  doc.save(fileName);
  try {
    await navigator.clipboard?.writeText(shareText);
  } catch {
    // Ignore clipboard error
  }

  return {
    fileName,
    waUrl,
    sharedNatively: false,
    notice: `Plan Matériel PDF téléchargé (${fileName}) et résumé copié ! Cliquez sur WhatsApp ci-dessous pour l'envoyer.`,
  };
}
