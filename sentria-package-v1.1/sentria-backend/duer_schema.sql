-- duer_schema.sql
-- DUER module tables — run once on the database

CREATE TABLE IF NOT EXISTS duer_unites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID REFERENCES clients(id) ON DELETE CASCADE,
  nom        VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, nom)
);

CREATE TABLE IF NOT EXISTS duer_risques (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES clients(id) ON DELETE CASCADE,
  unite       VARCHAR(255) NOT NULL,
  danger      TEXT NOT NULL,
  famille     VARCHAR(100),
  probabilite INTEGER CHECK (probabilite BETWEEN 1 AND 3),
  gravite     INTEGER CHECK (gravite BETWEEN 1 AND 3),
  mesures     TEXT,
  exposes     INTEGER,
  frequence   VARCHAR(50),
  ref_regl    TEXT,
  action      TEXT,
  responsable VARCHAR(255),
  echeance    DATE,
  statut      VARCHAR(50) DEFAULT 'Ouverte'
              CHECK (statut IN ('Ouverte','En cours','Clôturée')),
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  modified_by UUID REFERENCES users(id),
  modified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_duer_risques_client ON duer_risques(client_id);
CREATE INDEX IF NOT EXISTS idx_duer_unites_client  ON duer_unites(client_id);
