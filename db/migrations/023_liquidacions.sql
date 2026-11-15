-- migrations/023_liquidacions.sql
-- Descripció: Liquidacions als propietaris (docs/requirements.md §3.6):
--             - `propietats.comissio_percentatge`: comissió de l'agència sobre la renda.
--             - `liquidacions`: IVA de la comissió i data de pagament al propietari.
--             - `liquidacio_linies`: cada rebut cobrat i cada despesa liquidats, amb la
--               part del propietari. Un rebut o una despesa només es liquiden un cop per
--               propietari.
-- Depèn de: 004_persones.sql, 006_pagaments.sql, 008_auditoria.sql, 011_tenant_despeses.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

ALTER TABLE propietats ADD COLUMN IF NOT EXISTS comissio_percentatge NUMERIC(5,2);
DO $$ BEGIN
  ALTER TABLE propietats ADD CONSTRAINT propietats_check_comissio
    CHECK (comissio_percentatge IS NULL OR (comissio_percentatge >= 0 AND comissio_percentatge <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE liquidacions ADD COLUMN IF NOT EXISTS iva_comissio NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE liquidacions ADD COLUMN IF NOT EXISTS data_pagament DATE;

CREATE TABLE IF NOT EXISTS liquidacio_linies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacio_id  UUID NOT NULL REFERENCES liquidacions(id) ON DELETE CASCADE,
  propietari_id  UUID NOT NULL REFERENCES persones(id) ON DELETE RESTRICT,
  propietat_id   UUID NOT NULL REFERENCES propietats(id) ON DELETE RESTRICT,
  pagament_id    UUID REFERENCES pagaments(id) ON DELETE RESTRICT,
  despesa_id     UUID REFERENCES despeses(id) ON DELETE RESTRICT,
  data           DATE NOT NULL,
  descripcio     TEXT NOT NULL,
  -- Import sencer del rebut o la despesa, i la part que correspon al propietari.
  import_total   NUMERIC(12,2) NOT NULL,
  percentatge    NUMERIC(5,2) NOT NULL,
  import         NUMERIC(12,2) NOT NULL,
  -- Part de renda (base de la comissió), comissió i IVA d'aquesta línia. Zero a les despeses.
  base_comissio  NUMERIC(12,2) NOT NULL DEFAULT 0,
  comissio       NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva            NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT liquidacio_linies_check_origen CHECK ((pagament_id IS NULL) <> (despesa_id IS NULL))
);

CREATE INDEX IF NOT EXISTS liquidacio_linies_liquidacio_idx ON liquidacio_linies (liquidacio_id);
CREATE UNIQUE INDEX IF NOT EXISTS liquidacio_linies_pagament_unique
  ON liquidacio_linies (pagament_id, propietari_id) WHERE pagament_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS liquidacio_linies_despesa_unique
  ON liquidacio_linies (despesa_id, propietari_id) WHERE despesa_id IS NOT NULL;

-- RLS activat sense polítiques: tanca l'accés per l'API de dades de Supabase. L'aplicació
-- es connecta com a propietària de les taules, a qui l'RLS no s'aplica (sense FORCE).
ALTER TABLE liquidacions ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidacio_linies ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER trg_auditoria_liquidacions
  AFTER INSERT OR UPDATE OR DELETE ON liquidacions
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

CREATE OR REPLACE TRIGGER trg_auditoria_liquidacio_linies
  AFTER INSERT OR UPDATE OR DELETE ON liquidacio_linies
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

COMMIT;
