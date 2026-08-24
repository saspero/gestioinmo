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

COMMIT;
