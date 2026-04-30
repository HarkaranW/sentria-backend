const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  Header, TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');

// ── Data from args ────────────────────────────────────────────────────────────
const data = JSON.parse(process.argv[2] || '{}');
const med  = data.medecin  || {};
const vis  = data.visite   || {};

const nomMed    = `Dr ${med.prenom||'Samiatou'} ${med.nom||'Latoundji'}`.toUpperCase();
const nomMedFull= `Dr LATOUNDJI SAMIATOU O.`;  // override with data when available
const titre     = med.titre  || 'Médecin spécialiste en santé sécurité au travail';
const tel1      = med.tel1   || '+228 97 57 79 40';
const tel2      = med.tel2   || '+228 79 70 24 42';
const emailMed  = med.email  || 'slatoundji@protonmail.com';
const adresse   = med.adresse|| 'Lomé';

const nomSal    = `${vis.prenom||''} ${vis.nom||''}`.trim().toUpperCase();
const sexe      = vis.sexe   || 'Monsieur';
const civilite  = sexe === 'Femme' ? 'Madame' : 'Monsieur';
const ddn       = vis.dateNaissance
  ? new Date(vis.dateNaissance).toLocaleDateString('fr-FR')
  : 'non renseignée';
const poste     = (vis.service||'').toUpperCase() || 'NON PRÉCISÉ';
const entreprise= (vis.client||'').toUpperCase()  || 'NON PRÉCISÉE';
const typeVisite= vis.typeVisite || 'Visite médicale';
const aptitude  = vis.aptitude  || 'Apte';
const restrictions = vis.restrictions || '';
const natureAmen   = vis.natureAmenagement || '';

const dateVisite = vis.date
  ? new Date(vis.date).toLocaleDateString('fr-FR')
  : new Date().toLocaleDateString('fr-FR');
const dateVObj   = vis.date ? new Date(vis.date) : new Date();

// Prochaine visite = date visite + 12 mois
const prochaineDate = vis.prochaineVisite
  ? new Date(vis.prochaineVisite).toLocaleDateString('fr-FR')
  : (() => {
      const d = new Date(dateVObj);
      d.setFullYear(d.getFullYear() + 1);
      return d.toLocaleDateString('fr-FR');
    })();

// ── Colors ────────────────────────────────────────────────────────────────────
const NAVY    = '1A3A52';
const TEAL    = '2D7A6E';
const WHITE   = 'FFFFFF';
const GREEN_BG= 'E8F5F0';  // light green for apte box
const GREEN_BD= '2D7A6E';
const AMBER_BG= 'FEF3E2';
const AMBER_BD= 'D4850A';
const RED_BG  = 'FDE8E6';
const RED_BD  = 'C0392B';
const GRAY    = 'F5F5F5';

// ── Helpers ───────────────────────────────────────────────────────────────────
const sp = (n=160) => new Paragraph({ spacing:{ before:n, after:0 }, children:[new TextRun('')] });
const noBorder = { style: BorderStyle.NONE, size:0, color: 'FFFFFF' };
const noBorders = { top:noBorder, bottom:noBorder, left:noBorder, right:noBorder };

// Determine aptitude config
function aptConfig() {
  const a = aptitude.toLowerCase();
  if (a.includes('inapte définitif')) return {
    icon: '✗', label: 'INAPTE DÉFINITIF AU POSTE DE TRAVAIL',
    bg: RED_BG, bd: RED_BD,
    conclusionBody: `Après examen clinique et paraclinique, des contre-indications médicales absolues ont été mises en évidence. L'état de santé du travailleur est incompatible avec le poste actuellement occupé.\n\nEn conséquence, nous déclarons le travailleur inapte de façon définitive à son poste de travail.`,
    conclusionBold: 'inapte de façon définitive à son poste de travail.'
  };
  if (a.includes('inapte temporaire')) return {
    icon: '✗', label: 'INAPTE TEMPORAIRE AU POSTE DE TRAVAIL',
    bg: AMBER_BG, bd: AMBER_BD,
    conclusionBody: `Après examen clinique et paraclinique, certaines anomalies temporaires ont été mises en évidence. Un suivi médical et un traitement approprié permettront une réévaluation de l'aptitude.\n\nEn conséquence, nous déclarons le travailleur temporairement inapte à son poste de travail.`,
    conclusionBold: 'temporairement inapte à son poste de travail.'
  };
  if (a.includes('restriction') || a.includes('réserve') || a.includes('sous')) return {
    icon: '⚠', label: 'APTE SOUS RÉSERVE',
    bg: AMBER_BG, bd: AMBER_BD,
    conclusionBody: `Après examen clinique et paraclinique, certaines anomalies ont été mises en évidence. Celles-ci pourraient s'aggraver en l'absence d'une prise en charge adéquate.\n\nEn conséquence, nous déclarons le travailleur apte à son poste sous réserve, avec recommandation de suivi médical et de mesures adaptées.`,
    conclusionBold: 'apte à son poste sous réserve'
  };
  // Default: Apte
  return {
    icon: '✓', label: 'APTE AU POSTE DE TRAVAIL',
    bg: GREEN_BG, bd: GREEN_BD,
    conclusionBody: `Après examen clinique et paraclinique, aucune pathologie susceptible de compromettre l'aptitude au poste actuellement occupé n'a été mise en évidence à ce jour.\n\nEn conséquence, nous déclarons le travailleur apte à son poste de travail.`,
    conclusionBold: 'apte à son poste de travail.'
  };
}
const apt = aptConfig();

// ── Header ────────────────────────────────────────────────────────────────────
// Navy bar at top with logo space + contacts
const headerTable = new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: [5000, 4026],
  rows: [new TableRow({ children: [
    new TableCell({
      width: { size: 5000, type: WidthType.DXA },
      borders: noBorders,
      shading: { fill: NAVY, type: ShadingType.CLEAR },
      margins: { top: 180, bottom: 180, left: 240, right: 120 },
      children: [
        // Logo placeholder text — in production replace with ImageRun
        new Paragraph({ children: [
          new TextRun({ text: 'DR', font:'Arial', size:14, color:'7FA8BE' })
        ]}),
        new Paragraph({ children: [
          new TextRun({ text: 'LATOUNDJI', font:'Arial', size:32, bold:true, color:WHITE })
        ]}),
        new Paragraph({ spacing:{before:0,after:0}, children: [
          new TextRun({ text: 'Samiatou', font:'Arial', size:22, color:'9ECFCA' })
        ]}),
        new Paragraph({ spacing:{before:60,after:0}, children: [
          new TextRun({ text: titre.toUpperCase(), font:'Arial', size:14, color:'7FA8BE', bold:true })
        ]}),
      ]
    }),
    new TableCell({
      width: { size: 4026, type: WidthType.DXA },
      borders: noBorders,
      shading: { fill: NAVY, type: ShadingType.CLEAR },
      margins: { top: 180, bottom: 180, left: 120, right: 240 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: tel1, font:'Arial', size:20, color:WHITE })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: tel2, font:'Arial', size:20, color:WHITE })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: emailMed, font:'Arial', size:18, color:TEAL2 = '3A9688' })] }),
      ]
    })
  ]})]
});

// Teal separator line (using paragraph border)
const separator = new Paragraph({
  spacing: { before: 0, after: 0 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 1 } },
  children: [new TextRun('')]
});

// ── Date ──────────────────────────────────────────────────────────────────────
const dateP = new Paragraph({
  spacing: { before: 360, after: 0 },
  children: [new TextRun({ text: `${adresse} le ${dateVisite}`, font:'Arial', size:22, color:'333333' })]
});

// ── Title ─────────────────────────────────────────────────────────────────────
const titleP = new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 480, after: 320 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333', space: 4 } },
  children: [new TextRun({ text: 'CERTIFICAT MÉDICAL', font:'Arial', size:28, bold:true, color:'1A1A1A' })]
});

// ── Body paragraph 1 — identity ───────────────────────────────────────────────
// "Je soussignée, Dr LATOUNDJI SAMIATOU O., Médecin du travail certifie avoir consulté,"
// "Monsieur AHO KOMLAN né le 01/10/1985 au poste de VENDEUR à la PHARMACIE 3E ARRONDISSEMENT."
const para1 = new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { before: 240, after: 200 },
  children: [
    new TextRun({ text: 'Je soussignée, ', font:'Arial', size:22, color:'222222' }),
    new TextRun({ text: `Dr LATOUNDJI SAMIATOU O., `, font:'Arial', size:22, bold:true, color:'222222' }),
    new TextRun({ text: `Médecin du travail certifie avoir consulté, ${civilite} `, font:'Arial', size:22, color:'222222' }),
    new TextRun({ text: nomSal, font:'Arial', size:22, bold:true, color:'222222' }),
    new TextRun({ text: ` né${civilite==='Madame'?'e':''} le `, font:'Arial', size:22, color:'222222' }),
    new TextRun({ text: ddn, font:'Arial', size:22, color:'222222' }),
    new TextRun({ text: ' au poste ', font:'Arial', size:22, color:'222222' }),
    new TextRun({ text: 'de ', font:'Arial', size:22, bold:true, color:'222222' }),
    new TextRun({ text: poste, font:'Arial', size:22, bold:true, color:'222222' }),
    new TextRun({ text: ' à la ', font:'Arial', size:22, bold:true, color:'222222' }),
    new TextRun({ text: `${entreprise}.`, font:'Arial', size:22, bold:true, color:'222222' }),
  ]
});

// ── Motif ─────────────────────────────────────────────────────────────────────
const motifLabel = new Paragraph({
  spacing: { before: 160, after: 80 },
  children: [
    new TextRun({ text: 'MOTIF DE LA VISITE', font:'Arial', size:22, bold:true, underline:{}, color:'222222' }),
    new TextRun({ text: ` : ${typeVisite.toUpperCase()}`, font:'Arial', size:22, color:'222222' }),
  ]
});

// ── Restrictions (if any) ─────────────────────────────────────────────────────
const restrictionsPara = restrictions ? new Paragraph({
  spacing: { before: 80, after: 80 },
  children: [
    new TextRun({ text: 'Restrictions : ', font:'Arial', size:22, bold:true, color:'222222' }),
    new TextRun({ text: restrictions, font:'Arial', size:22, color:'222222' }),
  ]
}) : null;

const amenagementPara = natureAmen ? new Paragraph({
  spacing: { before: 80, after: 80 },
  children: [
    new TextRun({ text: 'Aménagement de poste : ', font:'Arial', size:22, bold:true, color:'222222' }),
    new TextRun({ text: natureAmen, font:'Arial', size:22, color:'222222' }),
  ]
}) : null;

// ── Conclusion ────────────────────────────────────────────────────────────────
const conclusionLabel = new Paragraph({
  spacing: { before: 200, after: 100 },
  children: [new TextRun({ text: 'CONCLUSION', font:'Arial', size:22, bold:true, underline:{}, color:'222222' })]
});

const conclusionLines = apt.conclusionBody.split('\n\n');
const conclusionParas = conclusionLines.map((line, i) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { before: i===0?0:120, after: 0 },
  children: [new TextRun({ text: line, font:'Arial', size:22, color:'222222' })]
}));

// ── Aptitude box ──────────────────────────────────────────────────────────────
const aptBox = new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: [9026],
  rows: [new TableRow({ children: [new TableCell({
    width: { size: 9026, type: WidthType.DXA },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: apt.bd },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: apt.bd },
      left:   { style: BorderStyle.SINGLE, size: 4, color: apt.bd },
      right:  { style: BorderStyle.SINGLE, size: 4, color: apt.bd },
    },
    shading: { fill: apt.bg, type: ShadingType.CLEAR },
    margins: { top: 140, bottom: 140, left: 200, right: 200 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `${apt.icon}  `, font:'Arial', size:28, bold:true, color: apt.bd }),
        new TextRun({ text: apt.label, font:'Arial', size:28, bold:true, color: apt.bd }),
      ]
    })]
  })]})],
});

// ── Validité ──────────────────────────────────────────────────────────────────
const validiteP = new Paragraph({
  spacing: { before: 160, after: 160 },
  children: [new TextRun({
    text: `Validité : 12 mois — Prochaine visite avant le ${prochaineDate}`,
    font:'Arial', size:20, italics:true, color:'555555'
  })]
});

// ── Legal closing ─────────────────────────────────────────────────────────────
const closingP = new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { before: 120, after: 0 },
  children: [new TextRun({
    text: "En foi de quoi, le présent certificat est délivré à l'employeur, avec copie au travailleur, pour servir et valoir ce que de droit, notamment pour dispositions à prendre.",
    font:'Arial', size:22, bold:true, color:'222222'
  })]
});

// ── Signature block ────────────────────────────────────────────────────────────
const sigBlock = new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: [4513, 4513],
  rows: [new TableRow({ children: [
    new TableCell({ width:{size:4513,type:WidthType.DXA}, borders:noBorders, children:[new Paragraph('')] }),
    new TableCell({
      width: { size: 4513, type: WidthType.DXA },
      borders: noBorders,
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing:{before:0,after:240},
          children:[new TextRun({ text:'(Cachet et signature)', font:'Arial', size:18, italics:true, color:'888888' })]
        }),
        // Signature box
        new Table({
          width: { size: 3600, type: WidthType.DXA },
          columnWidths: [3600],
          rows: [new TableRow({ children: [new TableCell({
            width: { size: 3600, type: WidthType.DXA },
            borders: {
              top:    { style: BorderStyle.DASHED, size: 4, color: 'AAAAAA' },
              bottom: { style: BorderStyle.DASHED, size: 4, color: 'AAAAAA' },
              left:   { style: BorderStyle.DASHED, size: 4, color: 'AAAAAA' },
              right:  { style: BorderStyle.DASHED, size: 4, color: 'AAAAAA' },
            },
            margins: { top: 200, bottom: 200, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('')] })]
          })] })]
        }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing:{before:120,after:0},
          children:[new TextRun({ text:`DR LATOUNDJI SAMIATOU`, font:'Arial', size:20, bold:true, color:'222222' })]
        }),
      ]
    })
  ]})]
});

// ── Document assembly ─────────────────────────────────────────────────────────
const children = [
  headerTable,
  separator,
  dateP,
  titleP,
  para1,
  motifLabel,
];
if (restrictionsPara) children.push(restrictionsPara);
if (amenagementPara) children.push(amenagementPara);
children.push(conclusionLabel);
children.push(...conclusionParas);
children.push(sp(200));
children.push(aptBox);
children.push(validiteP);
children.push(closingP);
children.push(sp(80));
children.push(sigBlock);

const doc = new Document({
  styles: { default: { document: { run: { font:'Arial', size:22 } } } },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 720, right: 1000, bottom: 1000, left: 1000 }
      }
    },
    children
  }]
});

const outPath = process.argv[3] || '/mnt/user-data/outputs/certificat_aptitude.docx';
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log('OK:' + outPath);
}).catch(e => { console.error('ERR:' + e.message); process.exit(1); });
