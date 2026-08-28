-- migrations/005_contractes.sql
-- Descripció: Contractes de lloguer, inquilins associats, sincronització d'estat de la
--             unitat i restriccions de baixa sobre propietats/persones amb vincles actius
-- Depèn de: 003_propietats.sql, 004_persones.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`

BEGIN;

DO $$ BEGIN
  CREATE TYPE tipus_us_contracte AS ENUM ('habitatge', 'local', 'parking', 'industrial', 'altres');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estat_contracte AS ENUM ('esborrany', 'actiu', 'finalitzat', 'resolt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS contractes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unitat_id           UUID NOT NULL REFERENCES unitats(id) ON DELETE RESTRICT,
  tipus_us            tipus_us_contracte NOT NULL DEFAULT 'habitatge',
  data_inici          DATE NOT NULL,
  data_fi             DATE,
  renda               NUMERIC(10,2) NOT NULL CHECK (renda > 0),
  fianca              NUMERIC(10,2) NOT NULL CHECK (fianca >= 0),
  index_actualitzacio TEXT NOT NULL DEFAULT 'IPC',
  percentatge_pactat  NUMERIC(5,2),
  estat               estat_contracte NOT NULL DEFAULT 'esborrany',
  document_url        TEXT,
  motiu_resolucio     TEXT,
  data_resolucio      DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT contractes_check_dates CHECK (data_fi IS NULL OR data_fi > data_inici),
  -- Fiança: 1 a 2 mensualitats només per a habitatge; als altres usos els límits es
  -- pacten lliurement (docs/requirements.md 3.5 i regla de negoci #4).
  CONSTRAINT contractes_check_fianca_habitatge
    CHECK (tipus_us <> 'habitatge' OR (fianca >= renda AND fianca <= renda * 2))
);

CREATE OR REPLACE TRIGGER trg_contractes_updated_at
  BEFORE UPDATE ON contractes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Regla de negoci: una unitat només pot tenir un contracte actiu simultàniament.
-- (un mateix inquilí SÍ pot tenir diversos contractes actius, un per unitat diferent).
CREATE UNIQUE INDEX IF NOT EXISTS contractes_unitat_actiu_idx
  ON contractes (unitat_id)
  WHERE estat = 'actiu' AND deleted_at IS NULL;

-- Inquilins associats a un contracte (permet més d'un inquilí, ex: parella o companys de pis).
CREATE TABLE IF NOT EXISTS contracte_inquilins (
  contracte_id UUID NOT NULL REFERENCES contractes(id) ON DELETE RESTRICT,
  persona_id   UUID NOT NULL REFERENCES persones(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contracte_id, persona_id)
);

-- Sincronitza l'estat de la unitat: contracte actiu -> unitat ocupada;
-- contracte finalitzat/resolt -> unitat vacant (si no queda cap altre contracte actiu).
CREATE OR REPLACE FUNCTION sync_estat_unitat()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estat = 'actiu' THEN
    UPDATE unitats SET estat = 'ocupat' WHERE id = NEW.unitat_id;
  ELSIF NEW.estat IN ('finalitzat', 'resolt')
        AND (TG_OP = 'INSERT' OR OLD.estat IS DISTINCT FROM NEW.estat) THEN
    UPDATE unitats
      SET estat = 'vacant'
      WHERE id = NEW.unitat_id
        AND estat = 'ocupat'
        AND NOT EXISTS (
          SELECT 1 FROM contractes c
          WHERE c.unitat_id = NEW.unitat_id AND c.estat = 'actiu' AND c.id <> NEW.id
        );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;

CREATE OR REPLACE TRIGGER trg_sync_estat_unitat
  AFTER INSERT OR UPDATE ON contractes
  FOR EACH ROW EXECUTE FUNCTION sync_estat_unitat();

-- Restricció: no es pot donar de baixa (soft delete) una propietat amb unitats
-- sota contracte actiu (docs/requirements.md 3.2).
CREATE OR REPLACE FUNCTION prevent_baixa_propietat_amb_contractes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM unitats u
      JOIN contractes c ON c.unitat_id = u.id
      WHERE u.propietat_id = NEW.id AND c.estat = 'actiu'
    ) THEN
      RAISE EXCEPTION 'No es pot donar de baixa la propietat %: té unitats amb contractes actius', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;

CREATE OR REPLACE TRIGGER trg_prevent_baixa_propietat
  BEFORE UPDATE ON propietats
  FOR EACH ROW EXECUTE FUNCTION prevent_baixa_propietat_amb_contractes();

-- Restriccions: no es pot donar de baixa un propietari amb propietats actives associades,
-- ni un inquilí amb un contracte actiu (docs/requirements.md 3.3 i 3.4).
CREATE OR REPLACE FUNCTION prevent_baixa_persona()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF NEW.tipus = 'propietari' AND EXISTS (
      SELECT 1 FROM propietat_propietaris pp
      JOIN propietats p ON p.id = pp.propietat_id
      WHERE pp.persona_id = NEW.id AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'No es pot donar de baixa el propietari %: té propietats actives associades', NEW.id;
    END IF;

    IF NEW.tipus = 'inquili' AND EXISTS (
      SELECT 1 FROM contracte_inquilins ci
      JOIN contractes c ON c.id = ci.contracte_id
      WHERE ci.persona_id = NEW.id AND c.estat = 'actiu'
    ) THEN
      RAISE EXCEPTION 'No es pot donar de baixa l''inquilí %: té un contracte actiu', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;

CREATE OR REPLACE TRIGGER trg_prevent_baixa_persona
  BEFORE UPDATE ON persones
  FOR EACH ROW EXECUTE FUNCTION prevent_baixa_persona();

COMMIT;
