// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase().trim()]
    );
    if (!rows.length)
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
    const { password: _, ...safeUser } = user;
    return res.json({ success: true, data: { token, user: safeUser } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/v1/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const { password: _, ...safeUser } = req.user;
  res.json({ success: true, data: safeUser });
});

// POST /api/v1/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8)
    return res.status(400).json({ success: false, error: 'Mot de passe invalide (minimum 8 caractères)' });
  try {
    const { rows } = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(401).json({ success: false, error: 'Mot de passe actuel incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    return res.json({ success: true, data: { message: 'Mot de passe mis à jour' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/v1/auth/reset-password — request a password reset email
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ success: false, error: 'Email requis' });
  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase().trim()]
    );
    if (rows.length) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [rows[0].id]);
      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [rows[0].id, token, expiresAt]
      );
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      await sendPasswordResetEmail({ to: email.toLowerCase().trim(), resetUrl: `${baseUrl}/?reset_token=${token}` });
    }
    // Always return the same response — never reveal whether email exists
    return res.json({ success: true, data: { message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/v1/auth/reset-password/confirm — set new password using reset token
router.post('/reset-password/confirm', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 8)
    return res.status(400).json({ success: false, error: 'Token et mot de passe (minimum 8 caractères) requis' });
  try {
    const { rows } = await pool.query(
      'SELECT user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (!rows.length)
      return res.status(400).json({ success: false, error: 'Lien invalide ou expiré' });
    const userId = rows[0].user_id;
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, userId]);
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    return res.json({ success: true, data: { message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;
