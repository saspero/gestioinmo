-- migrations/008_auditoria.sql
-- Descripció: Registre d'auditoria (insert/update/delete) sobre les taules de domini del tenant
-- Depèn de: 003_propietats.sql, 004_persones.sql, 005_contractes.sql, 006_pagaments.sql,
--           007_incidencies.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`

BEGIN;

DO $$ BEGIN
  CREATE TYPE accio_auditoria AS ENUM ('insert', 'update', 'delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS auditoria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taula           TEXT NOT NULL,
  registre_id     UUID,
  accio           accio_auditoria NOT NULL,
  usuari_id       UUID REFERENCES public.tenant_users(id) ON DELETE SET NULL,
  dades_anteriors JSONB,
  dades_noves     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Requisit no funcional: totes les modificacions registren usuari, timestamp i valor
-- anterior. L'aplicació ha de fer `SET LOCAL app.current_user_id = '<uuid>'` a l'inici
-- de cada transacció perquè aquesta funció pugui atribuir l'acció a l'usuari autenticat;
-- si no s'ha fixat, l'acció queda registrada amb usuari_id NULL (ex: processos de sistema).
CREATE OR REPLACE FUNCTION registra_auditoria()
RETURNS TRIGGER AS $$
DECLARE
  v_usuari_id UUID;
BEGIN
  BEGIN
    v_usuari_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_usuari_id := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO auditoria (taula, registre_id, accio, usuari_id, dades_anteriors, dades_noves)
      VALUES (TG_TABLE_NAME, OLD.id, 'delete', v_usuari_id, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO auditoria (taula, registre_id, accio, usuari_id, dades_anteriors, dades_noves)
      VALUES (TG_TABLE_NAME, NEW.id, 'update', v_usuari_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO auditoria (taula, registre_id, accio, usuari_id, dades_anteriors, dades_noves)
      VALUES (TG_TABLE_NAME, NEW.id, 'insert', v_usuari_id, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_auditoria_propietats
  AFTER INSERT OR UPDATE OR DELETE ON propietats
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

CREATE OR REPLACE TRIGGER trg_auditoria_unitats
  AFTER INSERT OR UPDATE OR DELETE ON unitats
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

CREATE OR REPLACE TRIGGER trg_auditoria_persones
  AFTER INSERT OR UPDATE OR DELETE ON persones
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

CREATE OR REPLACE TRIGGER trg_auditoria_contractes
  AFTER INSERT OR UPDATE OR DELETE ON contractes
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

CREATE OR REPLACE TRIGGER trg_auditoria_pagaments
  AFTER INSERT OR UPDATE OR DELETE ON pagaments
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

CREATE OR REPLACE TRIGGER trg_auditoria_incidencies
  AFTER INSERT OR UPDATE OR DELETE ON incidencies
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

COMMIT;
