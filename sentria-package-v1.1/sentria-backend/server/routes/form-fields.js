// @ts-nocheck
// server/routes/form-fields.js
const express = require('express');
const authMiddleware = require('../middleware/auth');
const pool = require('../db/pool');
const router = express.Router();
router.use(authMiddleware);

// ── SECTIONS ──────────────────────────────────────────────────

// GET /api/v1/form-fields/sections/:module
router.get('/sections/:module', async (req, res) => {
  try {
    const { module } = req.params;
    const [sections, fields] = await Promise.all([
      pool.query('SELECT * FROM form_sections WHERE module=$1 ORDER BY position', [module]),
      pool.query(
        `SELECT ff.*, u.name as created_by_name
         FROM form_fields ff
         LEFT JOIN users u ON ff.created_by = u.id
         WHERE ff.module=$1
         ORDER BY ff.section_id, ff.position_in_section, ff.created_at`,
        [module]
      ),
    ]);
    const fieldsBySection = {};
    fields.rows.forEach(f => {
      const sid = f.section_id || 'unsorted';
      if (!fieldsBySection[sid]) fieldsBySection[sid] = [];
      fieldsBySection[sid].push(f);
    });
    const result = sections.rows.map(s => ({ ...s, fields: fieldsBySection[s.id] || [] }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/form-fields/sections
router.post('/sections', async (req, res) => {
  const { module, nom, position } = req.body;
  if (!module || !nom)
    return res.status(400).json({ success: false, error: 'module et nom requis' });
  try {
    let pos = position;
    if (pos === undefined) {
      const { rows } = await pool.query(
        'SELECT COALESCE(MAX(position), -1) + 1 as next FROM form_sections WHERE module=$1', [module]
      );
      pos = rows[0].next;
    }
    const { rows } = await pool.query(
      `INSERT INTO form_sections (module, nom, position, obligatoire, created_by)
       VALUES ($1, $2, $3, false, $4) RETURNING *`,
      [module, nom, pos, req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ success: false, error: 'Cette section existe déjà' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/form-fields/sections/reorder — before /sections/:id to avoid id='reorder'
router.patch('/sections/reorder', async (req, res) => {
  const { module, order } = req.body;
  if (!module || !Array.isArray(order))
    return res.status(400).json({ success: false, error: 'module et order requis' });
  try {
    await Promise.all(
      order.map(({ id, position }) =>
        pool.query('UPDATE form_sections SET position=$1 WHERE id=$2', [position, id])
      )
    );
    res.json({ success: true, data: { reordered: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/form-fields/sections/:id
router.patch('/sections/:id', async (req, res) => {
  const { nom, position } = req.body;
  try {
    const { rows: [section] } = await pool.query('SELECT * FROM form_sections WHERE id=$1', [req.params.id]);
    if (!section) return res.status(404).json({ success: false, error: 'Section introuvable' });
    if (section.obligatoire && req.user.role !== 'admin')
      return res.status(403).json({ success: false, error: 'Section obligatoire — admin requis' });
    const updates = []; const vals = []; let i = 1;
    if (nom !== undefined)      { updates.push(`nom=$${i++}`);      vals.push(nom); }
    if (position !== undefined) { updates.push(`position=$${i++}`); vals.push(position); }
    if (!updates.length) return res.status(400).json({ success: false, error: 'Rien à modifier' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE form_sections SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, vals
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/form-fields/sections/:id
router.delete('/sections/:id', async (req, res) => {
  try {
    const { rows: [section] } = await pool.query('SELECT * FROM form_sections WHERE id=$1', [req.params.id]);
    if (!section) return res.status(404).json({ success: false, error: 'Section introuvable' });
    if (section.obligatoire && req.user.role !== 'admin')
      return res.status(403).json({ success: false, error: 'Section obligatoire — admin requis' });
    const { rows: [nextSection] } = await pool.query(
      'SELECT id FROM form_sections WHERE module=$1 AND id!=$2 ORDER BY position LIMIT 1',
      [section.module, req.params.id]
    );
    if (nextSection) {
      await pool.query('UPDATE form_fields SET section_id=$1 WHERE section_id=$2', [nextSection.id, req.params.id]);
    }
    await pool.query('DELETE FROM form_sections WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── CHAMPS ────────────────────────────────────────────────────

// GET /api/v1/form-fields/:module (backward compatible)
router.get('/:module', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ff.*, fs.nom as section_nom, fs.position as section_position
       FROM form_fields ff
       LEFT JOIN form_sections fs ON ff.section_id = fs.id
       WHERE ff.module=$1
       ORDER BY fs.position, ff.position_in_section, ff.created_at`,
      [req.params.module]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    // form_sections table may not exist yet — fall back to simple query
    if (err.code === '42P01') {
      try {
        const { rows } = await pool.query(
          'SELECT * FROM form_fields WHERE module=$1 ORDER BY created_at',
          [req.params.module]
        );
        return res.json({ success: true, data: rows });
      } catch (e) {
        return res.json({ success: true, data: [] });
      }
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/form-fields
router.post('/', async (req, res) => {
  const { module, field_key, label, type, options, required, section_id, position_in_section } = req.body;
  if (!module || !field_key || !label || !type)
    return res.status(400).json({ success: false, error: 'module, field_key, label, type requis' });
  let targetSectionId = section_id;
  if (!targetSectionId) {
    const { rows } = await pool.query(
      'SELECT id FROM form_sections WHERE module=$1 ORDER BY position DESC LIMIT 1', [module]
    );
    targetSectionId = rows[0]?.id || null;
  }
  let pos = position_in_section;
  if (pos === undefined) {
    const { rows } = await pool.query(
      'SELECT COALESCE(MAX(position_in_section), -1) + 1 as next FROM form_fields WHERE section_id=$1',
      [targetSectionId]
    );
    pos = rows[0]?.next || 0;
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO form_fields
       (module, field_key, label, type, options, required, section_id, position_in_section, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [module, field_key, label, type, options || null, required || false, targetSectionId, pos, req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ success: false, error: 'Ce champ existe déjà pour ce module' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/form-fields/reorder — before /:id to avoid id='reorder'
router.patch('/reorder', async (req, res) => {
  const { section_id, order } = req.body;
  if (!section_id || !Array.isArray(order))
    return res.status(400).json({ success: false, error: 'section_id et order requis' });
  try {
    await Promise.all(
      order.map(({ id, position_in_section }) =>
        pool.query('UPDATE form_fields SET position_in_section=$1 WHERE id=$2', [position_in_section, id])
      )
    );
    res.json({ success: true, data: { reordered: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/form-fields/:id
router.patch('/:id', async (req, res) => {
  try {
    const { rows: [field] } = await pool.query('SELECT * FROM form_fields WHERE id=$1', [req.params.id]);
    if (!field) return res.status(404).json({ success: false, error: 'Champ introuvable' });
    if (field.is_core && req.user.role !== 'admin')
      return res.status(403).json({ success: false, error: 'Champ obligatoire — admin requis' });
    const allowed = ['label', 'type', 'options', 'required', 'section_id', 'position_in_section'];
    const updates = allowed.filter(k => req.body[k] !== undefined);
    if (!updates.length) return res.status(400).json({ success: false, error: 'Rien à modifier' });
    const setStr = updates.map((k, i) => `${k}=$${i + 1}`).join(',');
    const vals = [...updates.map(k => req.body[k]), req.params.id];
    const { rows } = await pool.query(
      `UPDATE form_fields SET ${setStr} WHERE id=$${updates.length + 1} RETURNING *`, vals
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/form-fields/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows: [field] } = await pool.query('SELECT * FROM form_fields WHERE id=$1', [req.params.id]);
    if (!field) return res.status(404).json({ success: false, error: 'Champ introuvable' });
    if (field.is_core && req.user.role !== 'admin')
      return res.status(403).json({ success: false, error: 'Champ obligatoire — admin requis' });
    if (!field.is_core && req.user.role !== 'admin' && field.created_by !== req.user.id)
      return res.status(403).json({ success: false, error: 'Vous ne pouvez supprimer que vos propres champs' });
    await pool.query('DELETE FROM form_fields WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
