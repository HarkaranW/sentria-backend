// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token manquant' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, email, name, role, specialite, profil FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );
    if (!rows.length) return res.status(401).json({ success: false, error: 'Utilisateur introuvable' });
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
  }
}

module.exports = authMiddleware;
