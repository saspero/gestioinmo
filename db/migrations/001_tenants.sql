-- migrations/001_tenants.sql
-- Descripció: Taula global de tenants (agències) i funció compartida per a updated_at
-- Depèn de: (cap)
-- Abast: schema public — taula global, no depèn del search_path de cap tenant

BEGIN;

-- `SET search_path` fixa l'schema de resolució de noms en temps d'execució
-- (independentment del search_path de qui invoqui la funció), mitigant search_path
-- hijacking (advisory de seguretat de Supabase: function_search_path_mutable).
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS public.tenants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                  TEXT NOT NULL,
  slug                 TEXT NOT NULL,
  pla                  TEXT NOT NULL DEFAULT 'basic',
  configuracio         JSONB NOT NULL DEFAULT '{}'::jsonb,
  jwt_expiracio_minuts INTEGER NOT NULL DEFAULT 60 CHECK (jwt_expiracio_minuts > 0),
  actiu                BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_unique UNIQUE (slug)
);

CREATE OR REPLACE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMIT;
