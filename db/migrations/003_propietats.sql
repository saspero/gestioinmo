-- migrations/003_propietats.sql
-- Descripció: Propietats i unitats llogables
-- Depèn de: 001_tenants.sql, 002_auth.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`). Vegeu docs/db-schema.md, secció "Provisioning".

BEGIN;

-- Còpia local (per tenant) de la funció d'actualització de `updated_at`, perquè els
-- triggers d'aquest schema no depenguin de `public` restant al search_path.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TYPE tipus_propietat AS ENUM ('edifici', 'casa', 'pis', 'local', 'solar', 'altres');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- vacant/ocupat/reservat/baixa provenen de l'especificació mínima de l'agent;
-- 'manteniment' s'afegeix perquè docs/requirements.md (3.2) exigeix aquest estat.
DO $$ BEGIN
  CREATE TYPE estat_unitat AS ENUM ('vacant', 'ocupat', 'reservat', 'manteniment', 'baixa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS propietats (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia     TEXT NOT NULL,
  tipus          tipus_propietat NOT NULL DEFAULT 'pis',
  adreca         TEXT NOT NULL,
  poblacio       TEXT,
  cp             TEXT,
  superficie     NUMERIC(10,2),
  habitacions    INTEGER,
  banys          INTEGER,
  ascensor       BOOLEAN NOT NULL DEFAULT false,
  cert_energetic TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  CONSTRAINT propietats_referencia_unique UNIQUE (referencia)
);

CREATE OR REPLACE TRIGGER trg_propietats_updated_at
  BEFORE UPDATE ON propietats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Una propietat pot tenir múltiples unitats (ex: edifici amb diversos pisos).
CREATE TABLE IF NOT EXISTS unitats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propietat_id UUID NOT NULL REFERENCES propietats(id) ON DELETE RESTRICT,
  referencia   TEXT NOT NULL,
  planta       TEXT,
  porta        TEXT,
  superficie   NUMERIC(10,2),
  renda_base   NUMERIC(10,2) CHECK (renda_base IS NULL OR renda_base >= 0),
  estat        estat_unitat NOT NULL DEFAULT 'vacant',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,
  CONSTRAINT unitats_propietat_referencia_unique UNIQUE (propietat_id, referencia)
);

CREATE OR REPLACE TRIGGER trg_unitats_updated_at
  BEFORE UPDATE ON unitats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
