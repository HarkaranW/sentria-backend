// server/index.js
// ════════════════════════════════════════════════════════════════
// SENTRIA — Backend Server
// Cabinet SST Dr Samiatou Latoundji — Lomé, Togo
// ════════════════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────────
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));   // 10MB for base64 logos
app.use(express.urlencoded({ extended: true }));

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ── STATIC FRONTEND ───────────────────────────────────────────────
// Serve the HTML app from the client/ folder
app.use(express.static(path.join(__dirname, '../client')));

// ── API ROUTES ────────────────────────────────────────────────────
app.use('/api/v1/auth',         require('./routes/auth'));
app.use('/api/v1/consultations',require('./routes/consultations'));
app.use('/api/v1/visites',      require('./routes/visites'));
app.use('/api/v1/accidents',    require('./routes/accidents'));
app.use('/api/v1/clients',      require('./routes/clients'));
app.use('/api/v1/salaries',     require('./routes/salaries'));
app.use('/api/v1/factures',     require('./routes/factures'));
app.use('/api/v1/users',        require('./routes/users'));
app.use('/api/v1/form-fields',  require('./routes/form-fields'));
app.use('/api/v1/rapports',     require('./routes/rapports'));

// ── HEALTH CHECK ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Sentria Backend',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ── FRONTEND FALLBACK ─────────────────────────────────────────────
// All non-API routes serve the frontend HTML
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Route API introuvable' });
  }
  res.sendFile(path.join(__dirname, '../client/cabinet_sst_v11.html'));
});

// ── ERROR HANDLER ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Erreur serveur interne' });
});

// ── START ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Sentria backend running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/v1`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
