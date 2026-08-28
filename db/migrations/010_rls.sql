-- migrations/010_rls.sql
-- Descripció: Row Level Security per a les taules globals del schema public
-- Depèn de: 001_tenants.sql, 002_auth.sql
-- Abast: schema public únicament. Els schemas de tenant NO porten RLS: el driver `pg`
--        connecta amb credencials de servei i aïlla cada agència fent `SET search_path
--        TO tenant_{uuid}`, tal com descriu CLAUDE.md. Aquestes polítiques són una capa
--        addicional de defensa sobre les úniques taules que conviuen totes les agències.

BEGIN;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_user_sessions ENABLE ROW LEVEL SECURITY;

-- L'aplicació ha de fer `SET LOCAL app.tenant_id = '<uuid>'` a l'inici de cada
-- transacció, immediatament després d'autenticar el JWT i resoldre el tenant.
DROP POLICY IF EXISTS tenant_isolation ON public.tenants;
CREATE POLICY tenant_isolation ON public.tenants
  USING (id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON public.tenant_users;
CREATE POLICY tenant_isolation ON public.tenant_users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON public.tenant_user_sessions;
CREATE POLICY tenant_isolation ON public.tenant_user_sessions
  USING (
    tenant_user_id IN (
      SELECT id FROM public.tenant_users
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

-- Auditoria de queries a nivell de base de dades (docs/db-schema.md, secció de
-- seguretat). Complementària a la taula `auditoria` per tenant: pgaudit cobreix DDL,
-- rols i DML fins i tot fora de l'aplicació (ex: consola SQL amb credencials de servei).
-- Alguns entorns gestionats (Supabase) restringeixen aquesta extensió a rols sense
-- privilegi suficient: si falla aquí, cal activar-la manualment des del panell de
-- Supabase (Database > Extensions) o amb suport de Supabase.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pgaudit;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'pgaudit no s''ha pogut activar (privilegis insuficients). Activar-lo manualment des del panell de Supabase (Database > Extensions) o amb suport de Supabase.';
END $$;

COMMIT;

-- NOTA OPERATIVA (fora d'aquesta migració, no executable dins d'un bloc de transacció):
-- un cop `pgaudit` estigui instal·lat, cal configurar `pgaudit.log = 'ddl, role, write'`
-- via ALTER SYSTEM (requereix superusuari i recàrrega de configuració) des del panell
-- de Supabase o amb el seu suport — vegeu docs/db-schema.md, secció de seguretat, §9.6.
