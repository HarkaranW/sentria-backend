// server/services/factureService.js
// Invoice Word generation — mirrors the HTML preview in the frontend
// Uses the same docx library as gen_certificat.js and gen_rapport_v2.js

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign
} = require('docx');

const NAVY = '1A3A52', TEAL = '2D7A6E', WHITE = 'FFFFFF';
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
  return new Paragraph({
    spacing: { before: opts?.sb || 60, after: opts?.sa || 60 },
    alignment: opts?.align,
    children: Array.isArray(runs) ? runs : [runs]
  });
}
function cell(text, opts) {
  return new TableCell({
    width: { size: opts?.w || 2000, type: WidthType.DXA },
    borders: bdrs(opts?.bd || 'DDDDDD'),
    shading: { fill: opts?.fill || WHITE, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [mkP([tx(text, { bold: opts?.bold, color: opts?.color, size: opts?.size || 19 })],
      { sb: 0, sa: 0, align: opts?.align })]
  });
}

async function genFactureDocx({ medecin, facture }) {
  const color1 = (medecin.color1 || '#1a3a52').replace('#', '');
  const color2 = (medecin.color2 || '#2d7a6e').replace('#', '');
  const nomMed = `Dr ${medecin.prenom || ''} ${medecin.nom || 'Latoundji'}`.trim().toUpperCase();
  const titre = medecin.titre || 'Médecin du Travail';
  const lignes = Array.isArray(facture.lignes) ? facture.lignes : JSON.parse(facture.lignes || '[]');
  const sousTotal = lignes.reduce((s, l) => s + (parseInt(l.qte) || 1) * (parseInt(l.pu) || 0), 0);
  const remise = parseInt(facture.remise) || 0;
  const total = sousTotal - remise;

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Montserrat', size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, right: 1000, bottom: 1000, left: 1000 } } },
      children: [
        // Header
        new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [5000, 4026], rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 5000, type: WidthType.DXA }, borders: noBdrs,
              shading: { fill: color1, type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 240, right: 120 },
              children: [
                mkP([tx(nomMed, { size: 24, bold: true, color: WHITE })], { sb: 0, sa: 60 }),
                mkP([tx(titre.toUpperCase(), { size: 16, color: 'B0C8D4' })], { sb: 0, sa: 0 }),
              ]
            }),
            new TableCell({ width: { size: 4026, type: WidthType.DXA }, borders: noBdrs,
              shading: { fill: color1, type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 120, right: 240 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                mkP([tx('FACTURE', { size: 32, bold: true, color: color2 })], { sb: 0, sa: 0, align: AlignmentType.RIGHT }),
                mkP([tx(facture.numero || '', { size: 20, color: 'B0C8D4' })], { sb: 40, sa: 0, align: AlignmentType.RIGHT }),
              ]
            }),
          ]})
        ]}),
        // Separator
        mkP([tx('')], { sb: 0, sa: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: color2, space: 1 } } }),
        // Date info
        new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [3008, 3009, 3009], rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 3008, type: WidthType.DXA }, borders: bdrs('DDDDDD'),
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                mkP([tx('Date d\'émission', { size: 16, color: '888888', bold: true })], { sb: 0, sa: 40 }),
                mkP([tx(fmtD(facture.date_emission), { size: 22, bold: true, color: NAVY })], { sb: 0, sa: 0 }),
              ]
            }),
            new TableCell({ width: { size: 3009, type: WidthType.DXA }, borders: bdrs('DDDDDD'),
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                mkP([tx('Délai de paiement', { size: 16, color: '888888', bold: true })], { sb: 0, sa: 40 }),
                mkP([tx((facture.delai_jours || 30) + ' jours', { size: 22, bold: true, color: color2 })], { sb: 0, sa: 0 }),
              ]
            }),
            new TableCell({ width: { size: 3009, type: WidthType.DXA }, borders: bdrs('DDDDDD'),
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                mkP([tx('Date d\'échéance', { size: 16, color: '888888', bold: true })], { sb: 0, sa: 40 }),
                mkP([tx(fmtD(facture.echeance), { size: 22, bold: true, color: NAVY })], { sb: 0, sa: 0 }),
              ]
            }),
          ]})
        ]}),
        // Parties
        new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [4513, 4513], rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 4513, type: WidthType.DXA }, borders: bdrs('DDDDDD'),
              margins: { top: 140, bottom: 140, left: 160, right: 160 },
              children: [
                mkP([tx('FACTURÉ À', { size: 16, bold: true, color: color2 })], { sb: 0, sa: 60 }),
                mkP([tx((facture.client || facture.client_name || '').toUpperCase(), { size: 22, bold: true, color: NAVY })], { sb: 0, sa: 0 }),
                facture.client_adresse ? mkP([tx(facture.client_adresse, { size: 18, color: '555555' })], { sb: 40, sa: 0 }) : mkP([tx('')], { sb: 0, sa: 0 }),
              ]
            }),
            new TableCell({ width: { size: 4513, type: WidthType.DXA }, borders: bdrs('DDDDDD'),
              margins: { top: 140, bottom: 140, left: 160, right: 160 },
              children: [
                mkP([tx('MÉDECIN', { size: 16, bold: true, color: color2 })], { sb: 0, sa: 60 }),
                mkP([tx(nomMed, { size: 18, bold: true, color: NAVY })], { sb: 0, sa: 40 }),
                mkP([tx(`${medecin.tel1 || ''} · ${medecin.email || ''}`, { size: 16, color: '555555' })], { sb: 0, sa: 0 }),
                mkP([tx(medecin.adresse || 'Lomé, Togo', { size: 16, color: '555555' })], { sb: 20, sa: 0 }),
              ]
            }),
          ]})
        ]}),
        // Lines table
        new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [4500, 1000, 1300, 1113, 1113], rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 4500, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [mkP([tx('DESCRIPTION', { size: 17, bold: true, color: WHITE })], { sb: 0, sa: 0 })] }),
            new TableCell({ width: { size: 1000, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [mkP([tx('QTÉ', { size: 17, bold: true, color: WHITE })], { sb: 0, sa: 0, align: AlignmentType.CENTER })] }),
            new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [mkP([tx('UNITÉ', { size: 17, bold: true, color: WHITE })], { sb: 0, sa: 0 })] }),
            new TableCell({ width: { size: 1113, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [mkP([tx('P.U.', { size: 17, bold: true, color: WHITE })], { sb: 0, sa: 0, align: AlignmentType.RIGHT })] }),
            new TableCell({ width: { size: 1113, type: WidthType.DXA }, borders: noBdrs, shading: { fill: color1, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [mkP([tx('TOTAL', { size: 17, bold: true, color: WHITE })], { sb: 0, sa: 0, align: AlignmentType.RIGHT })] }),
          ]}),
          ...lignes.filter(l => l.description).map(l => new TableRow({ children: [
            cell(l.description, { w: 4500 }),
            cell(l.qte || 1, { w: 1000, align: AlignmentType.CENTER }),
            cell(l.unite || 'Forfait', { w: 1300 }),
            cell(((parseInt(l.pu) || 0).toLocaleString('fr-FR')), { w: 1113, align: AlignmentType.RIGHT }),
            cell((((parseInt(l.qte)||1)*(parseInt(l.pu)||0)).toLocaleString('fr-FR')), { w: 1113, align: AlignmentType.RIGHT, bold: true }),
          ]})),
        ]}),
        // Totals
        mkP([tx(`Sous-total : ${fmtM(sousTotal)}${remise ? `  |  Remise : -${fmtM(remise)}` : ''}`, { size: 18, color: '555555' })], { sb: 100, sa: 60, align: AlignmentType.RIGHT }),
        new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [9026], rows: [
          new TableRow({ children: [new TableCell({
            width: { size: 9026, type: WidthType.DXA }, borders: noBdrs,
            shading: { fill: color1, type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 200, right: 200 },
            children: [mkP([tx('TOTAL DÛ   ', { size: 24, bold: true, color: WHITE }), tx(fmtM(total), { size: 28, bold: true, color: color2 })], { sb: 0, sa: 0, align: AlignmentType.RIGHT })]
          })] })
        ]}),
        // Bank + notes
        new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [4513, 4513], rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 4513, type: WidthType.DXA }, borders: bdrs('DDDDDD'), margins: { top: 140, bottom: 140, left: 160, right: 160 }, children: [
              mkP([tx('COORDONNÉES BANCAIRES', { size: 16, bold: true, color: color2 })], { sb: 0, sa: 60 }),
              mkP([tx(`Banque : ${medecin.banque || '—'}`, { size: 18 })], { sb: 0, sa: 20 }),
              mkP([tx(`Titulaire : ${medecin.titulaire || nomMed}`, { size: 18 })], { sb: 0, sa: 20 }),
              mkP([tx(`N° compte : ${medecin.compte || '—'}`, { size: 18 })], { sb: 0, sa: 0 }),
            ] }),
            new TableCell({ width: { size: 4513, type: WidthType.DXA }, borders: bdrs('DDDDDD'), margins: { top: 140, bottom: 140, left: 160, right: 160 }, children: [
              mkP([tx('NOTES', { size: 16, bold: true, color: color2 })], { sb: 0, sa: 60 }),
              mkP([tx(facture.notes || 'Facture établie conformément au contrat de prestation en vigueur.', { size: 17, italic: true, color: '555555' })], { sb: 0, sa: 0 }),
            ] }),
          ]})
        ]}),
        // Footer
        mkP([tx(`Merci de votre confiance — ${nomMed} · ${medecin.adresse || 'Lomé, Togo'}`, { size: 17, italic: true, color: '888888' })], { sb: 160, sa: 0, align: AlignmentType.CENTER }),
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}

module.exports = { genFactureDocx };
