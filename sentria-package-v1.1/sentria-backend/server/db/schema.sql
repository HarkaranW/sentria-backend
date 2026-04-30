-- ════════════════════════════════════════════════════════════════
-- SENTRIA — Database Schema v1.1
-- Run: psql $DATABASE_URL -f server/db/schema.sql
-- ════════════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  password     VARCHAR(255) NOT NULL,        -- bcrypt hash
  name         VARCHAR(255) NOT NULL,
  role         VARCHAR(50) NOT NULL DEFAULT 'medecin', -- medecin | assistante | admin
  specialite   VARCHAR(255),
  profil       JSONB DEFAULT '{}',           -- prenom, nom, titre, nif, adresse, tel1, tel2, email, banque, titulaire, compte, logo_url, color1, color2
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLIENTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  secteur      VARCHAR(255),
  effectif     VARCHAR(100),
  adresse      TEXT,
  contact_nom  VARCHAR(255),
  contact_tel  VARCHAR(100),
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── SALARIES (workers) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salaries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom            VARCHAR(255) NOT NULL,
  prenom         VARCHAR(255),
  date_naissance DATE,
  sexe           VARCHAR(10),
  client_id      UUID REFERENCES clients(id),
  poste_actuel   VARCHAR(255),
  ant_med        TEXT,                       -- antécédents médicaux
  ant_chir       TEXT,                       -- antécédents chirurgicaux
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONSULTATIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salarie_id       UUID REFERENCES salaries(id),
  client_id        UUID REFERENCES clients(id),
  date             DATE NOT NULL,
  nom              VARCHAR(255) NOT NULL,
  prenom           VARCHAR(255),
  service          VARCHAR(255),
  sexe             VARCHAR(10),
  date_naissance   DATE,
  ant_med          TEXT,
  ant_chir         TEXT,
  tension          VARCHAR(20),
  temperature      VARCHAR(10),
  poids            VARCHAR(10),
  imc              VARCHAR(10),
  motif            TEXT NOT NULL,
  interrogatoire   TEXT,
  signes_cliniques TEXT,
  hypothese        TEXT,
  examens          TEXT,
  diagnostic       VARCHAR(255),
  diagnostic_autre TEXT,
  traitement       TEXT,
  medicaments      TEXT,
  orientation      VARCHAR(100),
  arret            VARCHAR(10),
  duree_arret      INTEGER,
  observations     TEXT,
  custom_fields    JSONB DEFAULT '{}',
  saisi_par        UUID REFERENCES users(id),
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  modified_by      UUID REFERENCES users(id),
  modified_at      TIMESTAMPTZ
);

-- ── VISITES MEDICALES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visites (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salarie_id          UUID REFERENCES salaries(id),
  client_id           UUID REFERENCES clients(id),
  date                DATE NOT NULL,
  type_visite         VARCHAR(50) NOT NULL,  -- Embauche | Periodique | Reprise
  nom                 VARCHAR(255) NOT NULL,
  prenom              VARCHAR(255),
  service             VARCHAR(255),
  sexe                VARCHAR(10),
  date_naissance      DATE,
  tension             VARCHAR(20),
  acuite_visuelle     VARCHAR(50),
  interrogatoire      TEXT,
  observations_clin   TEXT,
  aptitude            VARCHAR(100) NOT NULL,
  restrictions        TEXT,
  amenagement         VARCHAR(10),
  nature_amenagement  TEXT,
  prochaine_visite    DATE,
  observations        TEXT,
  custom_fields       JSONB DEFAULT '{}',
  saisi_par           UUID REFERENCES users(id),
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  modified_by         UUID REFERENCES users(id),
  modified_at         TIMESTAMPTZ
);

-- ── ACCIDENTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salarie_id      UUID REFERENCES salaries(id),
  client_id       UUID REFERENCES clients(id),
  date            DATE NOT NULL,
  heure           VARCHAR(20),
  nom             VARCHAR(255) NOT NULL,
  prenom          VARCHAR(255),
  service         VARCHAR(255),
  poste           VARCHAR(255),
  lieu            TEXT NOT NULL,
  description     TEXT NOT NULL,
  interrogatoire  TEXT,                      -- déclaration du salarié
  tache           TEXT,
  temoins         TEXT,
  natures_lesion  TEXT[],
  localisations   TEXT[],
  gravite         VARCHAR(50),
  soins_immed     TEXT,
  arret           VARCHAR(10),
  duree_arret     INTEGER,
  orientation     VARCHAR(100),
  declare_cnss    VARCHAR(20) DEFAULT 'Non',
  observations    TEXT,
  custom_fields   JSONB DEFAULT '{}',
  saisi_par       UUID REFERENCES users(id),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  modified_by     UUID REFERENCES users(id),
  modified_at     TIMESTAMPTZ
);

-- ── FACTURES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS factures (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           VARCHAR(50) UNIQUE NOT NULL,
  client_id        UUID REFERENCES clients(id),
  client_adresse   TEXT,
  description      TEXT,
  date_emission    DATE NOT NULL DEFAULT CURRENT_DATE,
  echeance         DATE,
  delai_jours      INTEGER DEFAULT 30,
  methode_paiement VARCHAR(100),
  lignes           JSONB NOT NULL,
  remise           INTEGER DEFAULT 0,
  montant_total    INTEGER NOT NULL,
  statut           VARCHAR(50) DEFAULT 'Brouillon',
  date_paiement    DATE,
  mode_paiement    VARCHAR(100),
  notes            TEXT,
  emis_par         UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── FORM FIELDS (custom editor) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS form_fields (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module      VARCHAR(50) NOT NULL,          -- consultation | visite | accident
  field_key   VARCHAR(100) NOT NULL,
  label       VARCHAR(255) NOT NULL,
  type        VARCHAR(50) NOT NULL,          -- text | textarea | date | select | check | yesno | audioTextarea
  options     TEXT[],
  required    BOOLEAN DEFAULT false,
  position    INTEGER DEFAULT 999,
  is_core     BOOLEAN DEFAULT false,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module, field_key)
);

-- ── INVOICE SEQUENCE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_sequence (
  year    INTEGER PRIMARY KEY,
  last_n  INTEGER DEFAULT 0
);

-- ── INDEXES ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cons_salarie   ON consultations(salarie_id);
CREATE INDEX IF NOT EXISTS idx_cons_client    ON consultations(client_id);
CREATE INDEX IF NOT EXISTS idx_cons_date      ON consultations(date DESC);
CREATE INDEX IF NOT EXISTS idx_vis_salarie    ON visites(salarie_id);
CREATE INDEX IF NOT EXISTS idx_vis_client     ON visites(client_id);
CREATE INDEX IF NOT EXISTS idx_vis_date       ON visites(date DESC);
CREATE INDEX IF NOT EXISTS idx_acc_salarie    ON accidents(salarie_id);
CREATE INDEX IF NOT EXISTS idx_acc_client     ON accidents(client_id);
CREATE INDEX IF NOT EXISTS idx_acc_date       ON accidents(date DESC);
CREATE INDEX IF NOT EXISTS idx_fact_client    ON factures(client_id);
CREATE INDEX IF NOT EXISTS idx_fact_emission  ON factures(date_emission DESC);
CREATE INDEX IF NOT EXISTS idx_sal_client     ON salaries(client_id);
CREATE INDEX IF NOT EXISTS idx_sal_nom        ON salaries(nom, prenom);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_factures_updated BEFORE UPDATE ON factures FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_salaries_updated BEFORE UPDATE ON salaries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
