-- ════════════════════════════════════════════════════════════════
-- SENTRIA — Seed Data
-- Run AFTER schema.sql: psql $DATABASE_URL -f server/db/seed.sql
-- ════════════════════════════════════════════════════════════════

-- ── DEFAULT ADMIN USER ───────────────────────────────────────────
-- Password: Admin2025! (change immediately after first login)
INSERT INTO users (email, password, name, role, specialite, profil) VALUES
(
  'admin@sentria.io',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMlM6QgkOQf8g2.4X4kcJJdLjq', -- Admin2025!
  'Administrateur Sentria',
  'admin',
  'Super-administrateur',
  '{}'
)
ON CONFLICT (email) DO NOTHING;

-- ── DR LATOUNDJI ─────────────────────────────────────────────────
-- Password: Sentria2025! (change immediately)
INSERT INTO users (email, password, name, role, specialite, profil) VALUES
(
  'slatoundji@protonmail.com',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWWK/G', -- Sentria2025!
  'Dr Samiatou Latoundji',
  'medecin',
  'Médecin du Travail',
  '{
    "prenom": "Samiatou",
    "nom": "Latoundji",
    "titre": "Médecin spécialiste en santé sécurité au travail",
    "nif": "#1001493868",
    "adresse": "Lomé, Togo",
    "tel1": "+228 97 57 79 40",
    "tel2": "+228 79 70 24 42",
    "email": "slatoundji@protonmail.com",
    "banque": "Orabank",
    "titulaire": "Samiatou Latoundji",
    "compte": "75402800501",
    "color1": "#0f2436",
    "color2": "#2d7a6e",
    "logo_url": ""
  }'::jsonb
)
ON CONFLICT (email) DO NOTHING;

-- ── DEFAULT CLIENTS ───────────────────────────────────────────────
INSERT INTO clients (name, secteur) VALUES
  ('Hôtel 2 Février',          'Hôtellerie & Restauration'),
  ('Souroubat',                 'BTP & Construction'),
  ('Bio-Partners',              'Santé & Médical'),
  ('Clinique Biasa',            'Santé & Médical'),
  ('Moov Togo',                 'Télécommunications'),
  ('Deco-IC',                   'Distribution & Commerce'),
  ('Pharmacie 3e Arrondissement','Santé & Médical'),
  ('Bigman',                    'Distribution & Commerce')
ON CONFLICT DO NOTHING;

-- ── INVOICE SEQUENCE ─────────────────────────────────────────────
INSERT INTO invoice_sequence (year, last_n) VALUES (2025, 0), (2026, 0)
ON CONFLICT (year) DO NOTHING;

-- ── CORE FORM FIELDS ─────────────────────────────────────────────
INSERT INTO form_fields (module, field_key, label, type, required, is_core, position) VALUES
  ('consultation', 'client',       'Client / Entreprise',    'select',        true,  true,  1),
  ('consultation', 'date',         'Date',                   'date',          true,  true,  2),
  ('consultation', 'nom',          'Nom',                    'text',          true,  true,  3),
  ('visite',       'client',       'Client / Entreprise',    'select',        true,  true,  1),
  ('visite',       'date',         'Date',                   'date',          true,  true,  2),
  ('visite',       'type_visite',  'Type de visite',         'select',        true,  true,  3),
  ('visite',       'nom',          'Nom',                    'text',          true,  true,  4),
  ('visite',       'aptitude',     'Aptitude',               'select',        true,  true,  5),
  ('accident',     'client',       'Client / Entreprise',    'select',        true,  true,  1),
  ('accident',     'date',         'Date',                   'date',          true,  true,  2),
  ('accident',     'nom',          'Nom',                    'text',          true,  true,  3),
  ('accident',     'description',  'Description des faits',  'textarea',      true,  true,  4),
  ('accident',     'natures_lesion','Nature des lésions',    'check',         true,  true,  5),
  ('accident',     'localisations','Localisation blessures',  'check',         true,  true,  6)
ON CONFLICT (module, field_key) DO NOTHING;
