-- migration_002_form_sections.sql
-- Run ONCE: psql $DATABASE_URL -f migration_002_form_sections.sql

-- 1. Create form_sections table
CREATE TABLE IF NOT EXISTS form_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module      VARCHAR(50) NOT NULL,
  nom         VARCHAR(255) NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  obligatoire BOOLEAN DEFAULT false,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module, nom)
);

-- 2. Add section_id and position_in_section to form_fields
ALTER TABLE form_fields
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES form_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_in_section INTEGER DEFAULT 0;

-- 3. Default sections — Consultation
INSERT INTO form_sections (module, nom, position, obligatoire) VALUES
  ('consultation', 'Contexte',                     0, true),
  ('consultation', 'Salarié',                      1, true),
  ('consultation', 'Examen',      2, true),
  ('consultation', 'Diagnostic', 3, true)
ON CONFLICT (module, nom) DO NOTHING;

-- Default sections — Visite médicale
INSERT INTO form_sections (module, nom, position, obligatoire) VALUES
  ('visite', 'Contexte',          0, true),
  ('visite', 'Salarié',           1, true),
  ('visite', 'Examen',            2, true),
  ('visite', 'Décision', 3, true)
ON CONFLICT (module, nom) DO NOTHING;

-- Default sections — Accident
INSERT INTO form_sections (module, nom, position, obligatoire) VALUES
  ('accident', 'Identification', 0, true),
  ('accident', 'Circonstances',  1, true),
  ('accident', 'Lésions',        2, true),
  ('accident', 'Suites & CNSS',  3, true)
ON CONFLICT (module, nom) DO NOTHING;

-- 4. Link existing form_fields rows to their section (last section of their module)
UPDATE form_fields ff
SET section_id = (
  SELECT fs.id FROM form_sections fs
  WHERE fs.module = ff.module
  ORDER BY fs.position DESC LIMIT 1
)
WHERE ff.section_id IS NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_form_sections_module ON form_sections(module, position);
CREATE INDEX IF NOT EXISTS idx_form_fields_section  ON form_fields(section_id, position_in_section);
