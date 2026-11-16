-- migrations/025_recuperacio_contrasenya.sql
-- Descripció: Enllaços de recuperació de contrasenya per correu. Només es desa el hash
--             SHA-256 del token: qui llegeixi la taula no pot fer servir els enllaços.
--             Cada enllaç caduca al cap de 30 minuts i només es pot fer servir un cop.
-- Depèn de: 002_auth.sql
-- Abast: GLOBAL — schema public, s'executa una única vegada, no per tenant

BEGIN;

CREATE TABLE IF NOT EXISTS public.tenant_user_password_resets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id UUID NOT NULL REFERENCES public.tenant_users(id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL,
  ip_address     INET,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ,
  CONSTRAINT tenant_user_password_resets_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS tenant_user_password_resets_usuari_idx
  ON public.tenant_user_password_resets (tenant_user_id, created_at);

-- Com la resta de `public`: res per a l'API pública de Supabase.
ALTER TABLE public.tenant_user_password_resets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  REVOKE ALL ON public.tenant_user_password_resets FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

COMMIT;
