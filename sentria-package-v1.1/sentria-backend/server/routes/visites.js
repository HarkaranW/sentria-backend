// server/routes/visites.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const makeCrudRouter = require('./_crud');
const pool = require('../db/pool');
const { genCertificatDocx } = require('../services/certificatService');
const { convertToPdf } = require('../services/pdfService');

const router = express.Router();
router.use(authMiddleware);

const COLUMNS = [
  'salarie_id','client_id','date','type_visite','nom','prenom','service','sexe',
  'date_naissance','tension','acuite_visuelle','interrogatoire','observations_clin',
  'aptitude','restrictions','amenagement','nature_amenagement','prochaine_visite',
  'observations','custom_fields'
];

// Wire up standard CRUD
makeCrudRouter(router, 'visites', COLUMNS, ['client_id','date','type_visite','nom','aptitude']);

// GET /:id/certificat/word — download Word certificate
router.get('/:id/certificat/word', async (req, res) => {
  try {
    const { rows: [visite] } = await pool.query(
      `SELECT v.*, c.name as client FROM visites v
       LEFT JOIN clients c ON v.client_id = c.id
       WHERE v.id = $1`,
      [req.params.id]
    );
    if (!visite) return res.status(404).json({ success: false, error: 'Visite introuvable' });
    const profil = req.user.profil || {};
    const buffer = await genCertificatDocx({ medecin: profil, visite: { ...visite, client: visite.client } });
    const filename = `certificat_${visite.nom}_${visite.prenom}_${visite.date}.docx`.replace(/ /g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur génération certificat: ' + err.message });
  }
});

// GET /:id/certificat/pdf — download PDF certificate
router.get('/:id/certificat/pdf', async (req, res) => {
  try {
    const { rows: [visite] } = await pool.query(
      `SELECT v.*, c.name as client FROM visites v
       LEFT JOIN clients c ON v.client_id = c.id
       WHERE v.id = $1`,
      [req.params.id]
    );
    if (!visite) return res.status(404).json({ success: false, error: 'Visite introuvable' });
    const profil = req.user.profil || {};
    // Fetch logo if set
    if (profil.logo_url) {
      try {
        const fetch = (await import('node-fetch')).default;
        const logoRes = await fetch(profil.logo_url);
        profil.logoBuffer = Buffer.from(await logoRes.arrayBuffer());
      } catch (e) { console.warn('Logo fetch failed:', e.message); }
    }
    const buffer = await genCertificatDocx({ medecin: profil, visite: { ...visite, client: visite.client } });
    const tmpPath = `/tmp/cert_${req.params.id}.docx`;
    fs.writeFileSync(tmpPath, buffer);
    const pdfPath = await convertToPdf(tmpPath, '/tmp');
    const filename = `certificat_${visite.nom}_${visite.prenom}.pdf`.replace(/ /g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(pdfPath, () => {
      fs.unlinkSync(tmpPath);
      fs.unlinkSync(pdfPath);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur génération PDF: ' + err.message });
  }
});

module.exports = router;
