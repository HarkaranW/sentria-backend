// server/routes/factures.js
const express = require('express');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const pool = require('../db/pool');
const { genFactureDocx } = require('../services/factureService');
const { convertToPdf } = require('../services/pdfService');
const { sendInvoiceEmail } = require('../services/emailService');
const router = express.Router();
router.use(authMiddleware);

// Generate invoice number: YYYY-NNN
async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  await pool.query(
    `INSERT INTO invoice_sequence (year, last_n) VALUES ($1, 0)
     ON CONFLICT (year) DO UPDATE SET last_n = invoice_sequence.last_n + 1`, [year]
  );
  const { rows } = await pool.query('SELECT last_n FROM invoice_sequence WHERE year = $1', [year]);
  return `${year}-${String(rows[0].last_n).padStart(3, '0')}`;
}

// GET / — list invoices
router.get('/', async (req, res) => {
  try {
    const { client_id, statut } = req.query;
    let where = []; let params = []; let i = 1;
    if (client_id) { where.push(`client_id = $${i++}`); params.push(client_id); }
    if (statut)    { where.push(`statut = $${i++}`);     params.push(statut); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT f.*, c.name as client_name FROM factures f
       LEFT JOIN clients c ON f.client_id = c.id
       ${wc} ORDER BY date_emission DESC`, params
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.*, c.name as client_name FROM factures f
       LEFT JOIN clients c ON f.client_id = c.id WHERE f.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Facture introuvable' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST / — create
router.post('/', async (req, res) => {
  const { client_id, lignes, montant_total } = req.body;
  if (!client_id || !lignes || montant_total === undefined)
    return res.status(400).json({ success: false, error: 'client_id, lignes et montant_total requis' });
  try {
    const numero = await nextInvoiceNumber();
    const { rows } = await pool.query(
      `INSERT INTO factures
       (numero, client_id, client_adresse, description, date_emission, echeance, delai_jours,
        methode_paiement, lignes, remise, montant_total, statut, notes, emis_par)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        numero, client_id, req.body.client_adresse || null, req.body.description || null,
        req.body.date_emission || new Date().toISOString().split('T')[0],
        req.body.echeance || null, req.body.delai_jours || 30,
        req.body.methode_paiement || null, JSON.stringify(lignes),
        req.body.remise || 0, montant_total,
        req.body.statut || 'Brouillon', req.body.notes || null, req.user.id
      ]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PATCH /:id/statut — mark as paid
router.patch('/:id/statut', async (req, res) => {
  const { statut, date_paiement, mode_paiement } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE factures SET statut=$1, date_paiement=$2, mode_paiement=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [statut, date_paiement || null, mode_paiement || null, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /:id/export/pdf — download PDF invoice
router.get('/:id/export/pdf', async (req, res) => {
  try {
    const { rows: [facture] } = await pool.query(
      `SELECT f.*, c.name as client FROM factures f
       LEFT JOIN clients c ON f.client_id = c.id WHERE f.id = $1`, [req.params.id]
    );
    if (!facture) return res.status(404).json({ success: false, error: 'Facture introuvable' });
    const profil = req.user.profil || {};
    if (profil.logo_url) {
      try {
        const fetch = (await import('node-fetch')).default;
        const r = await fetch(profil.logo_url);
        profil.logoBuffer = Buffer.from(await r.arrayBuffer());
      } catch (e) { console.warn('Logo fetch failed'); }
    }
    const buffer = await genFactureDocx({ medecin: profil, facture });
    const tmpPath = `/tmp/fact_${facture.id}.docx`;
    fs.writeFileSync(tmpPath, buffer);
    const pdfPath = await convertToPdf(tmpPath, '/tmp');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture_${facture.numero}.pdf"`);
    res.sendFile(pdfPath, () => { fs.unlinkSync(tmpPath); fs.unlinkSync(pdfPath); });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /:id/send-email — send invoice by email
router.post('/:id/send-email', async (req, res) => {
  try {
    const { rows: [facture] } = await pool.query(
      `SELECT f.*, c.name as client, c.contact_nom, c.contact_tel FROM factures f
       LEFT JOIN clients c ON f.client_id = c.id WHERE f.id = $1`, [req.params.id]
    );
    if (!facture) return res.status(404).json({ success: false, error: 'Facture introuvable' });
    const { to_email } = req.body;
    if (!to_email) return res.status(400).json({ success: false, error: 'Email destinataire requis' });
    await sendInvoiceEmail({ to: to_email, facture, medecin: req.user.profil || {} });
    await pool.query(`UPDATE factures SET statut='Envoyée', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ success: true, data: { sent: true } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
