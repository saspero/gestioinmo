-- migrations/011_tenant_despeses.sql
-- Descripció: Despeses associades a una propietat (opcionalment a una unitat o a una
--             incidència), usades per calcular `liquidacions.total_despeses`
--             (docs/db-schema.md §3.12, docs/requirements.md 3.6/3.8)
-- Depèn de: 003_propietats.sql, 007_incidencies.sql, 008_auditoria.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

DO $$ BEGIN
  CREATE TYPE categoria_despesa AS ENUM (
    'manteniment', 'subministraments', 'assegurances', 'impostos', 'comunitat', 'gestoria', 'altres'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS despeses (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propietat_id            UUID NOT NULL REFERENCES propietats(id) ON DELETE RESTRICT,
  unitat_id               UUID REFERENCES unitats(id) ON DELETE SET NULL,
  incidencia_id           UUID REFERENCES incidencies(id) ON DELETE SET NULL,
  categoria               categoria_despesa NOT NULL DEFAULT 'altres',
  concepte                TEXT NOT NULL,
  import                  NUMERIC(10,2) NOT NULL CHECK (import > 0),
  data_despesa            DATE NOT NULL,
  proveidor               TEXT,
  factura_url             TEXT,
  repercutible_propietari BOOLEAN NOT NULL DEFAULT true,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at              TIMESTAMPTZ
);

-- Reutilitza les funcions ja definides per aquest tenant a 003_propietats.sql
-- (`update_updated_at`) i 008_auditoria.sql (`registra_auditoria`): cap funció nova.
CREATE OR REPLACE TRIGGER trg_despeses_updated_at
  BEFORE UPDATE ON despeses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_auditoria_despeses
  AFTER INSERT OR UPDATE OR DELETE ON despeses
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

CREATE INDEX IF NOT EXISTS despeses_propietat_id_idx ON despeses (propietat_id);
CREATE INDEX IF NOT EXISTS despeses_unitat_id_idx ON despeses (unitat_id);
CREATE INDEX IF NOT EXISTS despeses_incidencia_id_idx ON despeses (incidencia_id);
CREATE INDEX IF NOT EXISTS despeses_categoria_idx ON despeses (categoria);
CREATE INDEX IF NOT EXISTS despeses_data_despesa_idx ON despeses (data_despesa);
CREATE INDEX IF NOT EXISTS despeses_deleted_at_idx ON despeses (deleted_at);

COMMIT;
