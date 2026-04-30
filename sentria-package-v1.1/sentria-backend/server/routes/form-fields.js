// server/routes/form-fields.js
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const pool = require('../db/pool');
const router = express.Router();
router.use(authMiddleware);

router.get('/:module', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM form_fields WHERE module = $1 ORDER BY position, created_at',
      [req.params.module]
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  const { module, field_key, label, type, options, required } = req.body;
  if (!module || !field_key || !label || !type)
    return res.status(400).json({ success: false, error: 'module, field_key, label, type requis' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO form_fields (module, field_key, label, type, options, required, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [module, field_key, label, type, options || null, required || false, req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Ce champ existe déjà pour ce module' });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows: [field] } = await pool.query('SELECT * FROM form_fields WHERE id = $1', [req.params.id]);
    if (!field) return res.status(404).json({ success: false, error: 'Champ introuvable' });
    if (field.is_core && req.user.role !== 'admin')
      return res.status(403).json({ success: false, error: 'Champ obligatoire — admin requis' });
    if (!field.is_core && req.user.role !== 'admin' && field.created_by !== req.user.id)
      return res.status(403).json({ success: false, error: 'Vous ne pouvez supprimer que vos propres champs' });
    await pool.query('DELETE FROM form_fields WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
