// @ts-nocheck
// server/routes/duer.js
const express = require('express');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const { canModify } = require('../middleware/roles');
const router = express.Router();
router.use(authMiddleware);

// PATCH /risques/:id and DELETE /risques/:id must come before GET /:client_id
// to avoid Express matching "risques" as a client_id.

// PATCH /risques/:id — modify a risk (30-day rule)
router.patch('/risques/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM duer_risques WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, error: 'Risque introuvable' });
    if (!canModify(existing[0], req.user))
      return res.status(403).json({ success: false, error: 'Délai de modification dépassé (30 jours) ou accès refusé' });
    const { danger, famille, probabilite, gravite, ref_regl, action, responsable, echeance, statut } = req.body;
    const { rows } = await pool.query(
      `UPDATE duer_risques SET
        danger      = COALESCE($1,  danger),
        famille     = COALESCE($2,  famille),
        probabilite = COALESCE($3,  probabilite),
        gravite     = COALESCE($4,  gravite),
        ref_regl    = COALESCE($5,  ref_regl),
        action      = COALESCE($6,  action),
        responsable = COALESCE($7,  responsable),
        echeance    = COALESCE($8,  echeance),
        statut      = COALESCE($9,  statut),
        modified_by = $10,
        modified_at = NOW()
       WHERE id = $11 RETURNING *`,
      [danger, famille, probabilite, gravite, ref_regl, action, responsable, echeance || null, statut, req.user.id, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /risques/:id — delete a risk
router.delete('/risques/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM duer_risques WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Risque introuvable' });
    if (!canModify(rows[0], req.user))
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    await pool.query('DELETE FROM duer_risques WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:client_id — all risks + units for a client
router.get('/:client_id', async (req, res) => {
  try {
    const { client_id } = req.params;
    const [unitsResult, risquesResult] = await Promise.all([
      pool.query('SELECT nom FROM duer_unites WHERE client_id = $1 ORDER BY created_at', [client_id]),
      pool.query('SELECT * FROM duer_risques WHERE client_id = $1 ORDER BY created_at', [client_id]),
    ]);
    const units = {};
    unitsResult.rows.forEach(u => { units[u.nom] = []; });
    risquesResult.rows.forEach(r => {
      if (!units[r.unite]) units[r.unite] = [];
      units[r.unite].push(r);
    });
    res.json({ success: true, data: { units } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:client_id/risques — create a risk
router.post('/:client_id/risques', async (req, res) => {
  try {
    const { client_id } = req.params;
    const { unite, danger, famille, probabilite, gravite, ref_regl, action, responsable, echeance, statut } = req.body;
    if (!danger || !unite) return res.status(400).json({ success: false, error: 'danger et unite requis' });
    await pool.query(
      'INSERT INTO duer_unites (client_id, nom) VALUES ($1, $2) ON CONFLICT (client_id, nom) DO NOTHING',
      [client_id, unite]
    );
    const { rows } = await pool.query(
      `INSERT INTO duer_risques
         (client_id, unite, danger, famille, probabilite, gravite, ref_regl, action, responsable, echeance, statut, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [client_id, unite, danger, famille || null, probabilite || 1, gravite || 1,
       ref_regl || null, action || null, responsable || null, echeance || null,
       statut || 'Ouverte', req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:client_id/unites — create a work unit
router.post('/:client_id/unites', async (req, res) => {
  try {
    const { client_id } = req.params;
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ success: false, error: 'nom requis' });
    const { rows } = await pool.query(
      `INSERT INTO duer_unites (client_id, nom) VALUES ($1, $2)
       ON CONFLICT (client_id, nom) DO UPDATE SET nom = EXCLUDED.nom RETURNING *`,
      [client_id, nom]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
