-- migrations/016_programar_pagaments_vencuts.sql
-- Descripció: Executa cada nit `marcar_pagaments_vencuts()` a tots els tenants.
-- Depèn de: 001_tenants.sql, 015_pagaments_marge_venciment.sql
-- Abast: GLOBAL — schema public, s'executa una única vegada, no per tenant
--
-- Una sola tasca de pg_cron recorre `public.tenants`, de manera que els tenants nous hi
-- entren sense haver de programar res. Cada funció de tenant porta el seu propi
-- `search_path` (`SET search_path FROM CURRENT`), així que n'hi ha prou de qualificar-la.
-- Si un tenant falla, la resta continua i l'error queda al log de PostgreSQL.

BEGIN;

CREATE OR REPLACE FUNCTION public.marcar_pagaments_vencuts_tots_tenants()
RETURNS void AS $$
DECLARE
  v_schema TEXT;
BEGIN
  FOR v_schema IN
    SELECT n.nspname
      FROM public.tenants t
      JOIN pg_namespace n ON n.nspname = 'tenant_' || t.id
  LOOP
    BEGIN
      EXECUTE format('SELECT %I.marcar_pagaments_vencuts()', v_schema);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'marcar_pagaments_vencuts ha fallat a %: %', v_schema, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = pg_catalog, public;

-- pg_cron només existeix a Supabase: a CI i en local la programació se salta.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    -- Cada dia a les 03:00 UTC. Amb el mateix nom, cron.schedule actualitza la tasca.
    PERFORM cron.schedule(
      'gestinmo-pagaments-vencuts',
      '0 3 * * *',
      'SELECT public.marcar_pagaments_vencuts_tots_tenants()'
    );
  END IF;
END $$;

COMMIT;
