// server/services/rapportFactService.js
// Generates the billing/facturation report as a Word document

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign
} = require('docx');

const noBdr = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBdrs = { top: noBdr, bottom: noBdr, left: noBdr, right: noBdr };
const bdr = (c) => ({ style: BorderStyle.SINGLE, size: 1, color: c || 'CCCCCC' });
const bdrs = (c) => ({ top: bdr(c), bottom: bdr(c), left: bdr(c), right: bdr(c) });

function fmtD(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—'; }
function fmtM(n) { return (parseInt(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
function tx(t, o) {
  return new TextRun({ text: String(t || ''), font: 'Montserrat', size: o?.size || 20,
    bold: o?.bold || false, color: o?.color || '333333', italics: o?.italic || false });
}
function mkP(runs, opts) {
  return new Paragraph({ spacing: { before: opts?.sb || 60, after: opts?.sa || 60 },
    alignment: opts?.align, children: Array.isArray(runs) ? runs : [runs] });
}

async function genRapportFacturationDocx({ factures, client, medecin, month, year }) {
  const color1 = (medecin.color1 || '#1a3a52').replace('#', '');
  const color2 = (medecin.color2 || '#2d7a6e').replace('#', '');
  const nomMed = `Dr ${medecin.prenom || ''} ${medecin.nom || 'Latoundji'}`.trim();
  const moisLabel = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const total = factures.reduce((s, f) => s + (parseInt(f.montant_total) || 0), 0);
  const payees = factures.filter(f => f.statut === 'Payée');
  const encaisse = payees.reduce((s, f) => s + (parseInt(f.montant_total) || 0), 0);
  const attente = factures.filter(f => f.statut === 'Envoyée' || f.statut === 'En retard');
  const taux = factures.length ? Math.round(payees.length / factures.length * 100) : 0;

  function statBadge(s) {
    const c = s === 'Payée' ? '27AE60' : s === 'En retard' ? 'C0392B' : s === 'Envoyée' ? '185FA5' : '888888';
    return new TextRun({ text: s, font: 'Montserrat', size: 18, bold: true, color: c });
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Montserrat', size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, right: 900, bottom: 900, left: 900 } } },
      children: [
        // Cover header
        new Table({ width: { size: 9226, type: WidthType.DXA }, columnWidths: [5600, 3626], rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 5600, type: WidthType.DXA }, borders: noBdrs,
              shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 300, bottom: 300, left: 240, right: 120 },
              children: [
                mkP([tx(client.name || 'Rapport de facturation', { size: 26, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 60 }),
                mkP([tx('RAPPORT DE FACTURATION', { size: 18, color: 'B0C8D4', bold: true })], { sb: 0, sa: 40 }),
                mkP([tx(moisLabel.toUpperCase(), { size: 16, color: '7FA8BE' })], { sb: 0, sa: 0 }),
              ]
            }),
            new TableCell({ width: { size: 3626, type: WidthType.DXA }, borders: noBdrs,
              shading: { fill: color2, type: ShadingType.CLEAR }, margins: { top: 300, bottom: 300, left: 120, right: 240 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                mkP([tx(nomMed, { size: 20, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 40, align: AlignmentType.RIGHT }),
                mkP([tx(medecin.titre || 'Médecin du Travail', { size: 16, color: 'C8E4E0' })], { sb: 0, sa: 0, align: AlignmentType.RIGHT }),
              ]
            }),
          ]})
        ]}),
        mkP([tx('')], { sb: 0, sa: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: color2, space: 1 } } }),

        // KPIs
        mkP([tx('')], { sb: 160, sa: 0 }),
        new Table({ width: { size: 9226, type: WidthType.DXA }, columnWidths: [2306, 2306, 2307, 2307], rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 2306, type: WidthType.DXA }, borders: bdrs('DDDDDD'), shading: { fill: 'F6F8FA', type: ShadingType.CLEAR }, margins: { top: 140, bottom: 140, left: 160, right: 160 }, children: [
              mkP([tx('Factures émises', { size: 16, color: '888888', bold: true })], { sb: 0, sa: 60 }),
              mkP([tx(String(factures.length), { size: 36, bold: true, color: color1 })], { sb: 0, sa: 0 }),
            ] }),
            new TableCell({ width: { size: 2306, type: WidthType.DXA }, borders: bdrs('DDDDDD'), shading: { fill: 'F6F8FA', type: ShadingType.CLEAR }, margins: { top: 140, bottom: 140, left: 160, right: 160 }, children: [
              mkP([tx('Total facturé', { size: 16, color: '888888', bold: true })], { sb: 0, sa: 60 }),
              mkP([tx(fmtM(total), { size: 22, bold: true, color: color1 })], { sb: 0, sa: 0 }),
            ] }),
            new TableCell({ width: { size: 2307, type: WidthType.DXA }, borders: bdrs('DDDDDD'), shading: { fill: 'F6F8FA', type: ShadingType.CLEAR }, margins: { top: 140, bottom: 140, left: 160, right: 160 }, children: [
              mkP([tx('Encaissé', { size: 16, color: '888888', bold: true })], { sb: 0, sa: 60 }),
              mkP([tx(fmtM(encaisse), { size: 22, bold: true, color: '27AE60' })], { sb: 0, sa: 0 }),
            ] }),
            new TableCell({ width: { size: 2307, type: WidthType.DXA }, borders: bdrs('DDDDDD'), shading: { fill: 'F6F8FA', type: ShadingType.CLEAR }, margins: { top: 140, bottom: 140, left: 160, right: 160 }, children: [
              mkP([tx('Taux recouvrement', { size: 16, color: '888888', bold: true })], { sb: 0, sa: 60 }),
              mkP([tx(`${taux}%`, { size: 36, bold: true, color: taux >= 80 ? '27AE60' : taux >= 50 ? 'D4850A' : 'C0392B' })], { sb: 0, sa: 0 }),
            ] }),
          ]})
        ]}),

        // Factures table
        mkP([tx('Détail des factures', { size: 24, bold: true, color: color1 })], { sb: 280, sa: 100 }),
        new Table({ width: { size: 9226, type: WidthType.DXA }, columnWidths: [1200, 2400, 2400, 1613, 1613], rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [mkP([tx('N° FACTURE', { size: 16, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 0 })] }),
            new TableCell({ width: { size: 2400, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [mkP([tx('CLIENT', { size: 16, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 0 })] }),
            new TableCell({ width: { size: 2400, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [mkP([tx('DESCRIPTION', { size: 16, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 0 })] }),
            new TableCell({ width: { size: 1613, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [mkP([tx('MONTANT', { size: 16, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 0, align: AlignmentType.RIGHT })] }),
            new TableCell({ width: { size: 1613, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [mkP([tx('STATUT', { size: 16, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 0, align: AlignmentType.CENTER })] }),
          ]}),
          ...factures.map((f, i) => new TableRow({ children: [
            new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders: bdrs('DDDDDD'), shading: { fill: i % 2 ? 'F6F8FA' : 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [mkP([tx(f.numero || '—', { size: 18, bold: true, color: color1 })], { sb: 0, sa: 0 })] }),
            new TableCell({ width: { size: 2400, type: WidthType.DXA }, borders: bdrs('DDDDDD'), shading: { fill: i % 2 ? 'F6F8FA' : 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [mkP([tx(f.client || f.client_name || '—', { size: 18 })], { sb: 0, sa: 0 })] }),
            new TableCell({ width: { size: 2400, type: WidthType.DXA }, borders: bdrs('DDDDDD'), shading: { fill: i % 2 ? 'F6F8FA' : 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [mkP([tx(f.description || '—', { size: 17, color: '555555' })], { sb: 0, sa: 0 })] }),
            new TableCell({ width: { size: 1613, type: WidthType.DXA }, borders: bdrs('DDDDDD'), shading: { fill: i % 2 ? 'F6F8FA' : 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [mkP([tx(fmtM(f.montant_total), { size: 18, bold: true })], { sb: 0, sa: 0, align: AlignmentType.RIGHT })] }),
            new TableCell({ width: { size: 1613, type: WidthType.DXA }, borders: bdrs('DDDDDD'), shading: { fill: i % 2 ? 'F6F8FA' : 'FFFFFF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [mkP([statBadge(f.statut)], { sb: 0, sa: 0, align: AlignmentType.CENTER })] }),
          ]})),
          // Total row
          new TableRow({ children: [
            new TableCell({ width: { size: 7400, type: WidthType.DXA }, columnSpan: 3, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 100, right: 100 }, children: [mkP([tx('TOTAL', { size: 20, bold: true, color: 'FFFFFF' })], { sb: 0, sa: 0, align: AlignmentType.RIGHT })] }),
            new TableCell({ width: { size: 1613, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 100, right: 100 }, children: [mkP([tx(fmtM(total), { size: 22, bold: true, color: color2 })], { sb: 0, sa: 0, align: AlignmentType.RIGHT })] }),
            new TableCell({ width: { size: 1613, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 100, right: 100 }, children: [mkP([tx(`${taux}% encaissé`, { size: 16, color: color2 })], { sb: 0, sa: 0, align: AlignmentType.CENTER })] }),
          ]}),
        ]}),

        // Footer
        mkP([tx(`Généré le ${fmtD(new Date())} · ${nomMed} · Cabinet SST · ${medecin.adresse || 'Lomé, Togo'}`, { size: 16, italic: true, color: '888888' })], { sb: 200, sa: 0, align: AlignmentType.CENTER }),
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}

module.exports = { genRapportFacturationDocx };
