// server/services/rapportService.js
// Medical activity report — Word generation

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign
} = require('docx');

const noBdr  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBdrs = { top: noBdr, bottom: noBdr, left: noBdr, right: noBdr };
const bdr    = (c) => ({ style: BorderStyle.SINGLE, size: 1, color: c || 'CCCCCC' });
const bdrs   = (c) => ({ top: bdr(c), bottom: bdr(c), left: bdr(c), right: bdr(c) });

function fmtD(d) {
  if (!d) return '—';
  const date = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T12:00:00')
    : new Date(d);
  return date.toLocaleDateString('fr-FR');
}
function tx(t, o) {
  return new TextRun({ text: String(t ?? ''), font: 'Montserrat', size: o?.size || 20,
    bold: o?.bold || false, color: o?.color || '333333', italics: o?.italic || false });
}
function mkP(runs, opts) {
  return new Paragraph({ spacing: { before: opts?.sb || 60, after: opts?.sa || 60 },
    alignment: opts?.align, children: Array.isArray(runs) ? runs : [runs] });
}

// Full-width content area (A4 minus 900dxa margins each side)
const W = 9226;

function sectionTitle(label, color1, color2) {
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [
    new TableRow({ children: [
      new TableCell({ width: { size: W, type: WidthType.DXA }, borders: noBdrs,
        shading: { fill: color1, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 200, right: 200 },
        children: [mkP([tx(label, { size: 20, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 0 })]
      })
    ]})
  ]});
}

function kpiCell(label, value, w, color1, color2, valueColor) {
  return new TableCell({ width: { size: w, type: WidthType.DXA }, borders: bdrs('DDDDDD'),
    shading: { fill: 'F6F8FA', type: ShadingType.CLEAR },
    margins: { top: 140, bottom: 140, left: 160, right: 160 },
    children: [
      mkP([tx(label, { size: 16, color: '888888', bold: true })], { sb: 0, sa: 60 }),
      mkP([tx(value, { size: 34, bold: true, color: valueColor || color1 })], { sb: 0, sa: 0 }),
    ]
  });
}

function statsRow(label, value, i, color1, W) {
  const fill = i % 2 ? 'F6F8FA' : 'FFFFFF';
  return new TableRow({ children: [
    new TableCell({ width: { size: W - 1800, type: WidthType.DXA }, borders: bdrs('DDDDDD'),
      shading: { fill, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [mkP([tx(label, { size: 18 })], { sb: 0, sa: 0 })] }),
    new TableCell({ width: { size: 1800, type: WidthType.DXA }, borders: bdrs('DDDDDD'),
      shading: { fill, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [mkP([tx(String(value), { size: 18, bold: true, color: color1 })], { sb: 0, sa: 0, align: AlignmentType.RIGHT })] }),
  ]});
}

async function genRapportDocx({ medecin, client, consultations, visites, accidents, type, month, year, dateFrom, dateTo }) {
  const color1 = (medecin.color1 || '#1a3a52').replace('#', '');
  const color2 = (medecin.color2 || '#2d7a6e').replace('#', '');
  const nomMed  = `Dr ${medecin.prenom || ''} ${medecin.nom || 'Latoundji'}`.trim();
  const typeLabel = { mensuel: 'MENSUEL', trimestriel: 'TRIMESTRIEL', annuel: 'ANNUEL' }[type] || 'MENSUEL';
  const moisLabel = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const periodStr = `${fmtD(dateFrom)} au ${fmtD(dateTo)}`;

  // ── Consultations stats ────────────────────────────────────────────
  const nbCons   = consultations.length;
  const consH    = consultations.filter(c => c.sexe === 'M').length;
  const consF    = consultations.filter(c => c.sexe === 'F').length;
  const consArret = consultations.filter(c => c.arret === 'Oui').length;

  const motifMap = {};
  consultations.forEach(c => {
    const m = c.motif || 'Non spécifié';
    motifMap[m] = (motifMap[m] || 0) + 1;
  });

  const diagMap = {};
  consultations.forEach(c => {
    if (c.diagnostic) diagMap[c.diagnostic] = (diagMap[c.diagnostic] || 0) + 1;
  });

  // ── Visites stats ─────────────────────────────────────────────────
  const nbVis  = visites.length;
  const visH   = visites.filter(v => v.sexe === 'M').length;
  const visF   = visites.filter(v => v.sexe === 'F').length;

  const visTypeMap = {};
  visites.forEach(v => {
    const t = v.type_visite || 'Non spécifié';
    visTypeMap[t] = (visTypeMap[t] || 0) + 1;
  });

  const aptMap = {};
  visites.forEach(v => {
    const a = v.aptitude || 'Non précisé';
    aptMap[a] = (aptMap[a] || 0) + 1;
  });

  // ── Accidents stats ───────────────────────────────────────────────
  const nbAcc    = accidents.length;
  const accArret = accidents.filter(a => a.arret === 'Oui').length;
  const accCnss  = accidents.filter(a => a.declare_cnss === 'Oui').length;

  const gravMap = {};
  accidents.forEach(a => {
    const g = a.gravite || 'Non précisé';
    gravMap[g] = (gravMap[g] || 0) + 1;
  });

  // ── Helper: two-column breakdown table ───────────────────────────
  function breakdownTable(rows) {
    if (!rows.length) {
      return mkP([tx('Aucune donnée pour cette période.', { size: 18, italic: true, color: '888888' })], { sb: 60, sa: 60 });
    }
    return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W - 1800, 1800], rows: [
      new TableRow({ children: [
        new TableCell({ width: { size: W - 1800, type: WidthType.DXA }, borders: noBdrs,
          shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [mkP([tx('CATÉGORIE', { size: 17, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 0 })] }),
        new TableCell({ width: { size: 1800, type: WidthType.DXA }, borders: noBdrs,
          shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [mkP([tx('NB', { size: 17, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 0, align: AlignmentType.RIGHT })] }),
      ]}),
      ...rows.map(([label, val], i) => statsRow(label, val, i, color1, W)),
    ]});
  }

  // ── Accidents detail table ────────────────────────────────────────
  const colW = [1200, 2200, 1800, 1400, 1400, 1226];
  function accidentDetailTable() {
    if (!accidents.length) {
      return mkP([tx('Aucun accident enregistré sur cette période.', { size: 18, italic: true, color: '888888' })], { sb: 60, sa: 60 });
    }
    const headers = ['DATE', 'NOM', 'SERVICE', 'LIEU', 'GRAVITÉ', 'CNSS'];
    return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: colW, rows: [
      new TableRow({ children: headers.map((h, i) => new TableCell({
        width: { size: colW[i], type: WidthType.DXA }, borders: noBdrs,
        shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [mkP([tx(h, { size: 16, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 0 })]
      }))}),
      ...accidents.map((a, i) => {
        const fill = i % 2 ? 'F6F8FA' : 'FFFFFF';
        const gravColor = a.gravite === 'Grave' ? 'C0392B' : a.gravite === 'Légère' ? '27AE60' : '888888';
        const vals = [
          [fmtD(a.date), { size: 17 }],
          [`${a.nom || ''} ${a.prenom || ''}`.trim(), { size: 17 }],
          [a.service || '—', { size: 17, color: '555555' }],
          [a.lieu || '—', { size: 17, color: '555555' }],
          [a.gravite || '—', { size: 17, bold: true, color: gravColor }],
          [a.declare_cnss || 'Non', { size: 17 }],
        ];
        return new TableRow({ children: vals.map(([val, opts], j) => new TableCell({
          width: { size: colW[j], type: WidthType.DXA }, borders: bdrs('DDDDDD'),
          shading: { fill, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [mkP([tx(val, opts)], { sb: 0, sa: 0 })]
        }))});
      }),
    ]});
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Montserrat', size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, right: 900, bottom: 900, left: 900 } } },
      children: [

        // ── Cover header ────────────────────────────────────────────
        new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [5800, 3426], rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 5800, type: WidthType.DXA }, borders: noBdrs,
              shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 300, bottom: 300, left: 240, right: 120 },
              children: [
                mkP([tx(client.name || 'Rapport d\'activité', { size: 26, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 60 }),
                mkP([tx(`RAPPORT D'ACTIVITÉ MÉDICALE · ${typeLabel}`, { size: 17, bold: true, color: 'B0C8D4' })], { sb: 0, sa: 40 }),
                mkP([tx(moisLabel.toUpperCase(), { size: 15, color: '7FA8BE' })], { sb: 0, sa: 0 }),
              ]
            }),
            new TableCell({ width: { size: 3426, type: WidthType.DXA }, borders: noBdrs,
              shading: { fill: color2, type: ShadingType.CLEAR }, margins: { top: 300, bottom: 300, left: 120, right: 240 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                mkP([tx(nomMed, { size: 20, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 40, align: AlignmentType.RIGHT }),
                mkP([tx(medecin.titre || 'Médecin du Travail', { size: 15, color: 'C8E4E0' })], { sb: 0, sa: 40, align: AlignmentType.RIGHT }),
                mkP([tx(`Période : ${periodStr}`, { size: 14, color: 'C8E4E0', italic: true })], { sb: 0, sa: 0, align: AlignmentType.RIGHT }),
              ]
            }),
          ]})
        ]}),
        mkP([tx('')], { sb: 0, sa: 0 }),

        // ── Global KPIs ─────────────────────────────────────────────
        new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [3075, 3075, 3076], rows: [
          new TableRow({ children: [
            kpiCell('Consultations', String(nbCons), 3075, color1, color2),
            kpiCell('Visites médicales', String(nbVis), 3075, color1, color2, color2),
            kpiCell('Accidents du travail', String(nbAcc), 3076, color1, color2, nbAcc > 0 ? 'C0392B' : color1),
          ]})
        ]}),
        mkP([tx('')], { sb: 0, sa: 60 }),

        // ── CONSULTATIONS ────────────────────────────────────────────
        sectionTitle('CONSULTATIONS MÉDICALES', color1, color2),
        mkP([tx('')], { sb: 0, sa: 40 }),

        new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [2306, 2306, 2307, 2307], rows: [
          new TableRow({ children: [
            kpiCell('Total', String(nbCons), 2306, color1, color2),
            kpiCell('Hommes', String(consH), 2306, color1, color2),
            kpiCell('Femmes', String(consF), 2307, color1, color2),
            kpiCell('Arrêts de travail', String(consArret), 2307, color1, color2, consArret > 0 ? 'D4850A' : color1),
          ]})
        ]}),
        mkP([tx('')], { sb: 0, sa: 60 }),

        mkP([tx('Répartition par motif', { size: 20, bold: true, color: color1 })], { sb: 80, sa: 80 }),
        breakdownTable(Object.entries(motifMap).sort((a, b) => b[1] - a[1])),

        ...(Object.keys(diagMap).length > 0 ? [
          mkP([tx('Principaux diagnostics', { size: 20, bold: true, color: color1 })], { sb: 200, sa: 80 }),
          breakdownTable(Object.entries(diagMap).sort((a, b) => b[1] - a[1]).slice(0, 10)),
        ] : []),

        mkP([tx('')], { sb: 0, sa: 80 }),

        // ── VISITES MÉDICALES ────────────────────────────────────────
        sectionTitle('VISITES MÉDICALES DU TRAVAIL', color1, color2),
        mkP([tx('')], { sb: 0, sa: 40 }),

        new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [2306, 2306, 2307, 2307], rows: [
          new TableRow({ children: [
            kpiCell('Total', String(nbVis), 2306, color1, color2),
            kpiCell('Hommes', String(visH), 2306, color1, color2),
            kpiCell('Femmes', String(visF), 2307, color1, color2),
            kpiCell('Embauche', String(visTypeMap['Embauche'] || 0), 2307, color1, color2, color2),
          ]})
        ]}),
        mkP([tx('')], { sb: 0, sa: 60 }),

        mkP([tx('Répartition par type de visite', { size: 20, bold: true, color: color1 })], { sb: 80, sa: 80 }),
        breakdownTable(Object.entries(visTypeMap).sort((a, b) => b[1] - a[1])),

        mkP([tx('Résultats d\'aptitude', { size: 20, bold: true, color: color1 })], { sb: 200, sa: 80 }),
        breakdownTable(Object.entries(aptMap).sort((a, b) => b[1] - a[1])),

        mkP([tx('')], { sb: 0, sa: 80 }),

        // ── ACCIDENTS DU TRAVAIL ─────────────────────────────────────
        sectionTitle('ACCIDENTS DU TRAVAIL', color1, color2),
        mkP([tx('')], { sb: 0, sa: 40 }),

        new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [2306, 2306, 2307, 2307], rows: [
          new TableRow({ children: [
            kpiCell('Total', String(nbAcc), 2306, color1, color2, nbAcc > 0 ? 'C0392B' : color1),
            kpiCell('Avec arrêt', String(accArret), 2306, color1, color2, accArret > 0 ? 'D4850A' : color1),
            kpiCell('Sans arrêt', String(nbAcc - accArret), 2307, color1, color2),
            kpiCell('Déclarés CNSS', String(accCnss), 2307, color1, color2),
          ]})
        ]}),
        mkP([tx('')], { sb: 0, sa: 60 }),

        ...(Object.keys(gravMap).length > 0 ? [
          mkP([tx('Répartition par gravité', { size: 20, bold: true, color: color1 })], { sb: 80, sa: 80 }),
          breakdownTable(Object.entries(gravMap).sort((a, b) => b[1] - a[1])),
          mkP([tx('')], { sb: 0, sa: 60 }),
        ] : []),

        mkP([tx('Détail des accidents', { size: 20, bold: true, color: color1 })], { sb: 80, sa: 80 }),
        accidentDetailTable(),

        // ── Footer ───────────────────────────────────────────────────
        mkP([tx(`Rapport généré le ${fmtD(new Date())} · ${nomMed} · ${medecin.adresse || 'Lomé, Togo'}`,
          { size: 16, italic: true, color: '888888' })], { sb: 240, sa: 0, align: AlignmentType.CENTER }),
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}

module.exports = { genRapportDocx };
