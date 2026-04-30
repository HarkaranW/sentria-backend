// server/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const pool = require('../db/pool');
const router = express.Router();
router.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET / — list users (admin only)
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, specialite, profil, is_active, created_at FROM users ORDER BY name'
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST / — create user (admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  const { email, password, name, role, specialite } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ success: false, error: 'email, password, name requis' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password, name, role, specialite)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, email, name, role, specialite`,
      [email.toLowerCase(), hash, name, role || 'medecin', specialite || '']
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Email déjà utilisé' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /me/profil — update own profile
router.patch('/me/profil', async (req, res) => {
  const allowed = ['prenom','nom','titre','nif','adresse','tel1','tel2','banque','titulaire','compte','color1','color2'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  try {
    const { rows: [current] } = await pool.query('SELECT profil FROM users WHERE id = $1', [req.user.id]);
    const newProfil = { ...(current.profil || {}), ...updates };
    await pool.query('UPDATE users SET profil = $1, updated_at = NOW() WHERE id = $2', [newProfil, req.user.id]);
    res.json({ success: true, data: { profil: newProfil } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /me/logo — upload logo
router.post('/me/logo', upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Fichier requis' });
  try {
    // Upload to Supabase Storage
    // TODO: Replace with actual Supabase upload if using Supabase Storage
    // For now, store as base64 in profil (replace with object storage in prod)
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
    const { rows: [current] } = await pool.query('SELECT profil FROM users WHERE id = $1', [req.user.id]);
    const newProfil = { ...(current.profil || {}), logo_url: dataUrl };
    await pool.query('UPDATE users SET profil = $1 WHERE id = $2', [newProfil, req.user.id]);
    res.json({ success: true, data: { logo_url: dataUrl } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /me/logo
router.delete('/me/logo', async (req, res) => {
  try {
    const { rows: [current] } = await pool.query('SELECT profil FROM users WHERE id = $1', [req.user.id]);
    const newProfil = { ...(current.profil || {}), logo_url: '' };
    await pool.query('UPDATE users SET profil = $1 WHERE id = $2', [newProfil, req.user.id]);
    res.json({ success: true, data: { logo_url: '' } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /:id — deactivate user (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ success: false, error: 'Impossible de supprimer votre propre compte' });
  try {
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: { deactivated: true } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
