// server/routes/clients.js
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const pool = require('../db/pool');
const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients ORDER BY name ASC');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Client introuvable' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  const { name, secteur, effectif, adresse, contact_nom, contact_tel } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Nom requis' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO clients (name, secteur, effectif, adresse, contact_nom, contact_tel, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, secteur || null, effectif || null, adresse || null, contact_nom || null, contact_tel || null, req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const check = await pool.query(
      'SELECT COUNT(*) FROM consultations WHERE client_id = $1', [req.params.id]
    );
    if (parseInt(check.rows[0].count) > 0)
      return res.status(409).json({ success: false, error: 'Client lié à des actes médicaux — suppression impossible' });
    await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
