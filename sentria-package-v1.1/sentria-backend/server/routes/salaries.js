// server/routes/salaries.js
const express = require('express');
const authMiddleware = require('../middleware/auth');
const pool = require('../db/pool');
const router = express.Router();
router.use(authMiddleware);

// GET / — list all workers
router.get('/', async (req, res) => {
  try {
    const { client_id } = req.query;
    let query = `SELECT s.*, c.name as client_name FROM salaries s
                 LEFT JOIN clients c ON s.client_id = c.id`;
    const params = [];
    if (client_id) { query += ' WHERE s.client_id = $1'; params.push(client_id); }
    query += ' ORDER BY s.nom, s.prenom';
    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /:id — full patient record with all history
router.get('/:id', async (req, res) => {
  const sid = req.params.id;
  try {
    const [sal, cons, vis, acc] = await Promise.all([
      pool.query(`SELECT s.*, c.name as client_name FROM salaries s
                  LEFT JOIN clients c ON s.client_id = c.id WHERE s.id = $1`, [sid]),
      pool.query('SELECT * FROM consultations WHERE salarie_id = $1 ORDER BY date DESC', [sid]),
      pool.query('SELECT * FROM visites WHERE salarie_id = $1 ORDER BY date DESC', [sid]),
      pool.query('SELECT * FROM accidents WHERE salarie_id = $1 ORDER BY date DESC', [sid]),
    ]);
    if (!sal.rows.length) return res.status(404).json({ success: false, error: 'Salarié introuvable' });
    const derniere_visite = vis.rows[0] || null;
    res.json({
      success: true,
      data: {
        salarie: sal.rows[0],
        consultations: cons.rows,
        visites: vis.rows,
        accidents: acc.rows,
        derniere_aptitude: derniere_visite?.aptitude || null,
        prochaine_visite: derniere_visite?.prochaine_visite || null,
      }
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PATCH /:id — update worker profile
router.patch('/:id', async (req, res) => {
  const { nom, prenom, date_naissance, sexe, poste_actuel, ant_med, ant_chir } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE salaries SET
        nom = COALESCE($1, nom),
        prenom = COALESCE($2, prenom),
        date_naissance = COALESCE($3, date_naissance),
        sexe = COALESCE($4, sexe),
        poste_actuel = COALESCE($5, poste_actuel),
        ant_med = COALESCE($6, ant_med),
        ant_chir = COALESCE($7, ant_chir),
        updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [nom, prenom, date_naissance, sexe, poste_actuel, ant_med, ant_chir, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
