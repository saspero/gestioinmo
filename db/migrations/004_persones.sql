-- migrations/004_persones.sql
-- Descripció: Persones (propietaris, inquilins, empreses) i copropietat de propietats
-- Depèn de: 003_propietats.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`

BEGIN;

DO $$ BEGIN
  CREATE TYPE tipus_persona AS ENUM ('propietari', 'inquili', 'empresa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Estats de l'Inquili (docs/requirements.md 3.4): actiu -> moros -> actiu -> inactiu.
-- Només té sentit quan tipus = 'inquili' (vegeu constraint persones_estat_inquili_coherent).
DO $$ BEGIN
  CREATE TYPE estat_inquili AS ENUM ('actiu', 'moros', 'inactiu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS persones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipus          tipus_persona NOT NULL,
  nom            TEXT NOT NULL,
  cognoms        TEXT,
  nif            TEXT,
  email          TEXT,
  telefon        TEXT,
  iban           TEXT,
  adreca         TEXT,
  notes          TEXT,
  estat_inquili  estat_inquili,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  CONSTRAINT persones_estat_inquili_coherent CHECK ((tipus = 'inquili') = (estat_inquili IS NOT NULL))
);

CREATE OR REPLACE TRIGGER trg_persones_updated_at
  BEFORE UPDATE ON persones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- NIF/CIF únic dins del tenant, només entre persones no donades de baixa
-- (permet reutilitzar un NIF si el registre anterior s'ha donat de baixa).
CREATE UNIQUE INDEX IF NOT EXISTS persones_nif_actiu_unique
  ON persones (nif)
  WHERE nif IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION set_estat_inquili_defecte()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipus = 'inquili' AND NEW.estat_inquili IS NULL THEN
    NEW.estat_inquili := 'actiu';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_persones_estat_inquili_defecte
  BEFORE INSERT ON persones
  FOR EACH ROW EXECUTE FUNCTION set_estat_inquili_defecte();

-- Copropietat: una propietat pot tenir més d'un propietari, amb percentatge de titularitat
-- que ha de sumar 100 (docs/requirements.md 3.3). Relació N a N amb `persones` (tipus='propietari').
CREATE TABLE IF NOT EXISTS propietat_propietaris (
  propietat_id UUID NOT NULL REFERENCES propietats(id) ON DELETE RESTRICT,
  persona_id   UUID NOT NULL REFERENCES persones(id) ON DELETE RESTRICT,
  percentatge  NUMERIC(5,2) NOT NULL CHECK (percentatge > 0 AND percentatge <= 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (propietat_id, persona_id)
);

CREATE OR REPLACE TRIGGER trg_propietat_propietaris_updated_at
  BEFORE UPDATE ON propietat_propietaris
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Regla de negoci: el % de titularitat d'una propietat ha de sumar exactament 100.
-- Constraint trigger diferit: permet inserir/actualitzar diverses files dins la mateixa
-- transacció (ex: donar d'alta 2 copropietaris alhora) i només valida en fer COMMIT.
CREATE OR REPLACE FUNCTION check_percentatge_titularitat()
RETURNS TRIGGER AS $$
DECLARE
  v_propietat_id UUID;
  v_total NUMERIC(6,2);
BEGIN
  v_propietat_id := COALESCE(NEW.propietat_id, OLD.propietat_id);
  SELECT COALESCE(SUM(percentatge), 0) INTO v_total
    FROM propietat_propietaris
    WHERE propietat_id = v_propietat_id;
  IF v_total <> 100 THEN
    RAISE EXCEPTION 'La suma de percentatges de titularitat de la propietat % ha de ser 100%% (actual: %)',
      v_propietat_id, v_total;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE CONSTRAINT TRIGGER trg_check_percentatge_titularitat
  AFTER INSERT OR UPDATE OR DELETE ON propietat_propietaris
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_percentatge_titularitat();

COMMIT;
