// server/routes/_crud.js
// Generic CRUD factory for medical act tables (consultations, visites, accidents)
const pool = require('../db/pool');
const { canModify } = require('../middleware/roles');

function makeCrudRouter(router, tableName, columns, requiredCols) {

  // GET /  — list with filters
  router.get('/', async (req, res) => {
    try {
      const { client_id, salarie_id, date_from, date_to, limit = 100, offset = 0 } = req.query;
      let where = [];
      let params = [];
      let i = 1;
      if (client_id)  { where.push(`client_id = $${i++}`);  params.push(client_id); }
      if (salarie_id) { where.push(`salarie_id = $${i++}`); params.push(salarie_id); }
      if (date_from)  { where.push(`date >= $${i++}`);       params.push(date_from); }
      if (date_to)    { where.push(`date <= $${i++}`);       params.push(date_to); }
      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY date DESC LIMIT $${i++} OFFSET $${i++}`,
        [...params, limit, offset]
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // GET /:id
  router.get('/:id', async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ success: false, error: 'Introuvable' });
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /  — create
  router.post('/', async (req, res) => {
    const body = req.body;
    // Validate required fields
    const missing = requiredCols.filter(c => !body[c]);
    if (missing.length)
      return res.status(400).json({ success: false, error: `Champs requis manquants: ${missing.join(', ')}` });
    // Auto-handle salarie (find or create)
    if (body.nom && !body.salarie_id) {
      try {
        const existing = await pool.query(
          'SELECT id FROM salaries WHERE nom = $1 AND prenom = $2 AND client_id = $3 LIMIT 1',
          [body.nom, body.prenom || '', body.client_id || null]
        );
        if (existing.rows.length) {
          body.salarie_id = existing.rows[0].id;
          // Update poste if changed
          await pool.query(
            'UPDATE salaries SET poste_actuel = $1, updated_at = NOW() WHERE id = $2',
            [body.service || body.poste || '', body.salarie_id]
          );
        } else {
          const newSal = await pool.query(
            `INSERT INTO salaries (nom, prenom, date_naissance, sexe, client_id, poste_actuel, ant_med, ant_chir)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [body.nom, body.prenom || '', body.date_naissance || null, body.sexe || null,
             body.client_id || null, body.service || body.poste || '', body.ant_med || '', body.ant_chir || '']
          );
          body.salarie_id = newSal.rows[0].id;
        }
      } catch (e) { console.error('Salarie auto-create error:', e.message); }
    }
    try {
      const validCols = columns.filter(c => body[c] !== undefined);
      const colStr = [...validCols, 'created_by', 'saisi_par'].join(', ');
      const valStr = [...validCols.map((_, i) => `$${i + 1}`), `$${validCols.length + 1}`, `$${validCols.length + 2}`].join(', ');
      const vals = [...validCols.map(c => {
        if (Array.isArray(body[c])) return body[c];
        if (typeof body[c] === 'object' && body[c] !== null) return JSON.stringify(body[c]);
        return body[c] ?? null;
      }), req.user.id, req.user.name];
      const { rows } = await pool.query(
        `INSERT INTO ${tableName} (${colStr}) VALUES (${valStr}) RETURNING *`,
        vals
      );
      res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Erreur création: ' + err.message });
    }
  });

  // PATCH /:id  — partial update with 30-day rule
  router.patch('/:id', async (req, res) => {
    try {
      const { rows: existing } = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      if (!existing.length) return res.status(404).json({ success: false, error: 'Introuvable' });
      if (!canModify(existing[0], req.user))
        return res.status(403).json({ success: false, error: 'Délai de modification dépassé (30 jours) ou accès refusé' });
      const body = req.body;
      const updatableCols = columns.filter(c => body[c] !== undefined && c !== 'id' && c !== 'created_at' && c !== 'created_by');
      if (!updatableCols.length) return res.status(400).json({ success: false, error: 'Aucun champ à mettre à jour' });
      const setStr = updatableCols.map((c, i) => `${c} = $${i + 1}`).join(', ');
      const vals = updatableCols.map(c => Array.isArray(body[c]) ? body[c] : body[c]);
      vals.push(req.user.id, req.user.name, req.params.id);
      const { rows } = await pool.query(
        `UPDATE ${tableName} SET ${setStr}, modified_by = $${updatableCols.length + 1}, modified_at = NOW(), saisi_par = $${updatableCols.length + 2} WHERE id = $${updatableCols.length + 3} RETURNING *`,
        vals
      );
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Erreur mise à jour: ' + err.message });
    }
  });

  // DELETE /:id — admin only soft delete
  router.delete('/:id', async (req, res) => {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, error: 'Admin requis' });
    try {
      await pool.query(`DELETE FROM ${tableName} WHERE id = $1`, [req.params.id]);
      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Erreur suppression' });
    }
  });

  return router;
}

module.exports = makeCrudRouter;
