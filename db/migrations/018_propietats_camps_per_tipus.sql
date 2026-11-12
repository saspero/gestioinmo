-- migrations/018_propietats_camps_per_tipus.sql
-- Descripció: Tipus de propietat "parking" i camps propis de cada tipus. Tots els tipus
--             tenen adreça, població, codi postal i referència cadastral (opcional); la
--             resta depèn del tipus i la tria l'aplicació (src/lib/validations/propietats.ts):
--               pis, casa: superfície, habitacions, banys, ascensor
--               parking:   superfície, número de plaça, planta
--               edifici:   superfície, ascensor, nombre de pisos
--               local:     superfície, banys, ascensor
--               solar:     superfície, superfície edificable, tipus de sòl
-- Depèn de: 003_propietats.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

-- PostgreSQL 12+ admet ADD VALUE dins d'una transacció mentre el valor nou no s'usi en
-- aquesta mateixa transacció.
ALTER TYPE tipus_propietat ADD VALUE IF NOT EXISTS 'parking' AFTER 'local';

DO $$ BEGIN
  CREATE TYPE tipus_sol AS ENUM ('rural', 'rustic', 'urbanitzable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE propietats
  ADD COLUMN IF NOT EXISTS referencia_cadastral  TEXT,
  ADD COLUMN IF NOT EXISTS numero_placa          TEXT,
  ADD COLUMN IF NOT EXISTS planta                TEXT,
  ADD COLUMN IF NOT EXISTS num_pisos             INTEGER CHECK (num_pisos IS NULL OR num_pisos > 0),
  ADD COLUMN IF NOT EXISTS superficie_edificable NUMERIC(10,2) CHECK (superficie_edificable IS NULL OR superficie_edificable >= 0),
  ADD COLUMN IF NOT EXISTS tipus_sol             tipus_sol;

COMMIT;
