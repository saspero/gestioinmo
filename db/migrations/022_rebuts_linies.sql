-- migrations/022_rebuts_linies.sql
-- Descripció: Rebuts mensuals amb línies (docs/requirements.md §3.6):
--             - `pagaments.periode`: primer dia del mes que cobra un rebut generat.
--               Un contracte només té un rebut generat per mes.
--             - `pagament_linies`: una línia per la renda i per cada despesa repercutida
--               vigent aquell mes (contracte_conceptes de 021).
-- Depèn de: 006_pagaments.sql, 008_auditoria.sql, 021_contractes_pactes.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

ALTER TABLE pagaments ADD COLUMN IF NOT EXISTS periode DATE;

DO $$ BEGIN
  ALTER TABLE pagaments ADD CONSTRAINT pagaments_check_periode
    CHECK (periode IS NULL OR periode = date_trunc('month', periode)::date);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS pagaments_contracte_periode_unique
  ON pagaments (contracte_id, periode)
  WHERE periode IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pagament_linies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagament_id  UUID NOT NULL REFERENCES pagaments(id) ON DELETE CASCADE,
  concepte_id  UUID REFERENCES contracte_conceptes(id) ON DELETE SET NULL,
  tipus        tipus_concepte NOT NULL,
  descripcio   TEXT NOT NULL,
  import       NUMERIC(10,2) NOT NULL CHECK (import > 0),
  ordre        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pagament_linies_pagament_idx ON pagament_linies (pagament_id, ordre);

-- RLS activat sense polítiques: tanca l'accés per l'API de dades de Supabase. L'aplicació
-- es connecta com a propietària de les taules, a qui l'RLS no s'aplica (sense FORCE).
ALTER TABLE pagament_linies ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER trg_auditoria_pagament_linies
  AFTER INSERT OR UPDATE OR DELETE ON pagament_linies
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

COMMIT;
