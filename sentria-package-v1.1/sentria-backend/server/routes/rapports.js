// server/routes/rapports.js
const express = require('express');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const pool = require('../db/pool');
const { genRapportDocx } = require('../services/rapportService');
const { genRapportFacturationDocx } = require('../services/rapportFactService');
const { convertToPdf } = require('../services/pdfService');
const router = express.Router();
router.use(authMiddleware);

// Helper: fetch report data
async function getRapportData(client_id, month, year) {
  const dateFrom = `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`;
  const dateTo = new Date(year, parseInt(month) + 1, 0).toISOString().split('T')[0];
  const filter = client_id
    ? 'AND client_id = $3'
    : '';
  const params = client_id ? [dateFrom, dateTo, client_id] : [dateFrom, dateTo];
  const [cons, vis, acc, clientInfo] = await Promise.all([
    pool.query(`SELECT * FROM consultations WHERE date BETWEEN $1 AND $2 ${filter} ORDER BY date`, params),
    pool.query(`SELECT * FROM visites       WHERE date BETWEEN $1 AND $2 ${filter} ORDER BY date`, params),
    pool.query(`SELECT * FROM accidents     WHERE date BETWEEN $1 AND $2 ${filter} ORDER BY date`, params),
    client_id ? pool.query('SELECT * FROM clients WHERE id = $1', [client_id]) : Promise.resolve({ rows: [{ name: 'Tous les clients' }] }),
  ]);
  return {
    client: clientInfo.rows[0] || { name: 'Tous les clients' },
    consultations: cons.rows,
    visites: vis.rows,
    accidents: acc.rows,
    dateFrom, dateTo,
    month: parseInt(month),
    year: parseInt(year),
  };
}

// GET /export/word — monthly/annual report as Word
router.get('/export/word', async (req, res) => {
  const { client_id, month, year, type = 'mensuel' } = req.query;
  if (!month || !year)
    return res.status(400).json({ success: false, error: 'month et year requis' });
  try {
    const data = await getRapportData(client_id, month, year);
    const profil = req.user.profil || {};
    if (profil.logo_url) {
      try {
        const fetch = (await import('node-fetch')).default;
        const r = await fetch(profil.logo_url);
        profil.logoBuffer = Buffer.from(await r.arrayBuffer());
      } catch (e) { console.warn('Logo fetch failed'); }
    }
    const buffer = await genRapportDocx({ ...data, medecin: profil, type });
    const fn = `rapport_${type}_${data.client.name}_${year}_${String(parseInt(month)+1).padStart(2,'0')}.docx`.replace(/ /g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /export/pdf — same as word but converted to PDF
router.get('/export/pdf', async (req, res) => {
  const { client_id, month, year, type = 'mensuel' } = req.query;
  if (!month || !year)
    return res.status(400).json({ success: false, error: 'month et year requis' });
  try {
    const data = await getRapportData(client_id, month, year);
    const profil = req.user.profil || {};
    const buffer = await genRapportDocx({ ...data, medecin: profil, type });
    const tmpPath = `/tmp/rapport_${Date.now()}.docx`;
    fs.writeFileSync(tmpPath, buffer);
    const pdfPath = await convertToPdf(tmpPath, '/tmp');
    const fn = `rapport_${type}_${data.client.name}_${year}.pdf`.replace(/ /g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
    res.sendFile(pdfPath, () => { fs.unlinkSync(tmpPath); fs.unlinkSync(pdfPath); });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /facturation/export/pdf — billing report
router.get('/facturation/export/pdf', async (req, res) => {
  const { client_id, month, year } = req.query;
  if (!month || !year)
    return res.status(400).json({ success: false, error: 'month et year requis' });
  try {
    const dateFrom = `${year}-${String(parseInt(month)+1).padStart(2,'0')}-01`;
    const dateTo = new Date(year, parseInt(month)+1, 0).toISOString().split('T')[0];
    const params = client_id ? [dateFrom, dateTo, client_id] : [dateFrom, dateTo];
    const filter = client_id ? 'AND client_id = $3' : '';
    const { rows: factures } = await pool.query(
      `SELECT f.*, c.name as client FROM factures f
       LEFT JOIN clients c ON f.client_id = c.id
       WHERE f.date_emission BETWEEN $1 AND $2 ${filter} ORDER BY f.date_emission`, params
    );
    const clientInfo = client_id
      ? (await pool.query('SELECT * FROM clients WHERE id = $1', [client_id])).rows[0]
      : { name: 'Tous les clients' };
    const profil = req.user.profil || {};
    const buffer = await genRapportFacturationDocx({ factures, client: clientInfo, medecin: profil, month, year });
    const tmpPath = `/tmp/rapport_fact_${Date.now()}.docx`;
    fs.writeFileSync(tmpPath, buffer);
    const pdfPath = await convertToPdf(tmpPath, '/tmp');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rapport_facturation_${year}.pdf"`);
    res.sendFile(pdfPath, () => { fs.unlinkSync(tmpPath); fs.unlinkSync(pdfPath); });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
