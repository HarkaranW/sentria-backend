// server/middleware/roles.js

// Require specific role(s)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Non authentifié' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Accès refusé — rôle insuffisant' });
    }
    next();
  };
}

// Check if user can modify a record (30-day rule or admin)
function canModify(record, user) {
  if (user.role === 'admin') return true;
  if (!record.created_at) return true; // legacy records
  const isSelf = record.created_by === user.id;
  const withinDelay = (Date.now() - new Date(record.created_at).getTime()) < 30 * 24 * 3600 * 1000;
  return isSelf && withinDelay;
}

module.exports = { requireRole, canModify };
