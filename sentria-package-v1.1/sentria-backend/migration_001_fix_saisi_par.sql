-- migration_001_fix_saisi_par.sql
-- Fix: saisi_par columns changed from UUID to TEXT
-- Run ONCE on the database. Do not re-run.

ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_saisi_par_fkey,
  ALTER COLUMN saisi_par TYPE TEXT;

ALTER TABLE visites DROP CONSTRAINT IF EXISTS visites_saisi_par_fkey,
  ALTER COLUMN saisi_par TYPE TEXT;

ALTER TABLE accidents DROP CONSTRAINT IF EXISTS accidents_saisi_par_fkey,
  ALTER COLUMN saisi_par TYPE TEXT;

-- Backfill existing rows with the user name
UPDATE consultations c SET saisi_par = u.name
  FROM users u WHERE c.created_by = u.id AND c.saisi_par IS NOT NULL;

UPDATE visites v SET saisi_par = u.name
  FROM users u WHERE v.created_by = u.id AND v.saisi_par IS NOT NULL;

UPDATE accidents a SET saisi_par = u.name
  FROM users u WHERE a.created_by = u.id AND a.saisi_par IS NOT NULL;
