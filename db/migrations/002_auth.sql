-- migrations/002_auth.sql
-- Descripció: Usuaris interns del tenant (rol admin/gestor/comptable) i sessions JWT
-- Depèn de: 001_tenants.sql
-- Abast: schema public — taules globals, no depenen del search_path de cap tenant

BEGIN;

DO $$ BEGIN
  CREATE TYPE public.rol_usuari AS ENUM ('admin', 'gestor', 'comptable');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  password_hash    TEXT NOT NULL,
  nom              TEXT NOT NULL,
  cognoms          TEXT,
  rol              public.rol_usuari NOT NULL DEFAULT 'gestor',
  actiu            BOOLEAN NOT NULL DEFAULT true,
  intents_fallits  INTEGER NOT NULL DEFAULT 0,
  bloquejat_fins   TIMESTAMPTZ,
  ultim_login      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT tenant_users_tenant_email_unique UNIQUE (tenant_id, email)
);

CREATE OR REPLACE TRIGGER trg_tenant_users_updated_at
  BEFORE UPDATE ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Sessions JWT: permet revocació i control d'expiració.
-- Estats derivats: activa (revoked_at IS NULL AND expires_at > now()),
-- expirada (expires_at <= now()), revocada (revoked_at IS NOT NULL).
CREATE TABLE IF NOT EXISTS public.tenant_user_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id UUID NOT NULL REFERENCES public.tenant_users(id) ON DELETE CASCADE,
  token_jti      TEXT NOT NULL,
  ip_address     INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  revoked_at     TIMESTAMPTZ,
  CONSTRAINT tenant_user_sessions_token_jti_unique UNIQUE (token_jti)
);

COMMIT;
