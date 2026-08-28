-- migrations/006_pagaments.sql
-- Descripció: Rebuts, remeses, liquidacions i seguiment automàtic de morositat
-- Depèn de: 005_contractes.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`

BEGIN;

-- Estats del Rebut (docs/requirements.md 3.6): pendent -> cobrat / vençut -> mora -> regularitzat.
-- 'remesa' s'afegeix (camp mínim de l'agent) com a estat transitori mentre el rebut
-- forma part d'una remesa bancària pendent de processar.
DO $$ BEGIN
  CREATE TYPE estat_pagament AS ENUM ('pendent', 'remesa', 'cobrat', 'vencut', 'mora', 'regularitzat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE metode_pagament AS ENUM ('domiciliacio', 'transferencia', 'efectiu', 'targeta', 'altres');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS remeses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia     TEXT NOT NULL,
  data_generacio DATE NOT NULL DEFAULT current_date,
  data_enviament DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT remeses_referencia_unique UNIQUE (referencia)
);

CREATE OR REPLACE TRIGGER trg_remeses_updated_at
  BEFORE UPDATE ON remeses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS pagaments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contracte_id   UUID NOT NULL REFERENCES contractes(id) ON DELETE RESTRICT,
  remesa_id      UUID REFERENCES remeses(id) ON DELETE SET NULL,
  concepte       TEXT NOT NULL DEFAULT 'Lloguer',
  import         NUMERIC(10,2) NOT NULL CHECK (import > 0),
  data_venciment DATE NOT NULL,
  data_cobrament DATE,
  metode         metode_pagament,
  estat          estat_pagament NOT NULL DEFAULT 'pendent',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  CONSTRAINT pagaments_check_cobrament CHECK (data_cobrament IS NULL OR estat IN ('cobrat', 'regularitzat'))
);

CREATE OR REPLACE TRIGGER trg_pagaments_updated_at
  BEFORE UPDATE ON pagaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS liquidacions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propietari_id    UUID NOT NULL REFERENCES persones(id) ON DELETE RESTRICT,
  periode_inici    DATE NOT NULL,
  periode_fi       DATE NOT NULL,
  total_cobrat     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_despeses   NUMERIC(12,2) NOT NULL DEFAULT 0,
  comissio_agencia NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_a_liquidar   NUMERIC(12,2) NOT NULL DEFAULT 0,
  generat_el       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT liquidacions_check_periode CHECK (periode_fi >= periode_inici)
);

-- Regla de negoci: un pagament que arriba a l'estat 'mora' activa l'estat de mora de
-- l'inquilí; en regularitzar-se (cobrat/regularitzat) i no quedar cap altre rebut en
-- mora, l'inquilí torna a 'actiu' (docs/requirements.md 3.4/3.6, regla #5).
CREATE OR REPLACE FUNCTION sync_estat_inquili_mora()
RETURNS TRIGGER AS $$
DECLARE
  v_persona_id UUID;
BEGIN
  IF NEW.estat NOT IN ('mora', 'cobrat', 'regularitzat') THEN
    RETURN NEW;
  END IF;

  SELECT ci.persona_id INTO v_persona_id
    FROM contracte_inquilins ci
    WHERE ci.contracte_id = NEW.contracte_id
    LIMIT 1;

  IF v_persona_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.estat = 'mora' THEN
    UPDATE persones SET estat_inquili = 'moros'
      WHERE id = v_persona_id AND tipus = 'inquili' AND estat_inquili <> 'moros';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pagaments p
      JOIN contracte_inquilins ci2 ON ci2.contracte_id = p.contracte_id
      WHERE ci2.persona_id = v_persona_id AND p.estat = 'mora' AND p.id <> NEW.id
    ) THEN
      UPDATE persones SET estat_inquili = 'actiu'
        WHERE id = v_persona_id AND tipus = 'inquili' AND estat_inquili = 'moros';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;

CREATE OR REPLACE TRIGGER trg_sync_estat_inquili_mora
  AFTER INSERT OR UPDATE ON pagaments
  FOR EACH ROW EXECUTE FUNCTION sync_estat_inquili_mora();

-- Funció de manteniment periòdic: cal programar-la (pg_cron o job extern diari) perquè
-- el pas del temps flueixi els estats: pendent/remesa -> vençut en superar data_venciment,
-- i vençut -> mora en superar 30 dies vençut (regla de negoci #5). Vegeu docs/db-schema.md.
CREATE OR REPLACE FUNCTION marcar_pagaments_vencuts()
RETURNS void AS $$
BEGIN
  UPDATE pagaments
    SET estat = 'vencut'
    WHERE estat IN ('pendent', 'remesa')
      AND data_venciment < current_date
      AND deleted_at IS NULL;

  UPDATE pagaments
    SET estat = 'mora'
    WHERE estat = 'vencut'
      AND data_venciment < current_date - INTERVAL '30 days'
      AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;

COMMIT;
