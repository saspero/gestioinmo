-- migrations/007_incidencies.sql
-- Descripció: Incidències sobre unitats/contractes, comentaris i adjunts
-- Depèn de: 002_auth.sql (public.tenant_users), 003_propietats.sql, 004_persones.sql,
--           005_contractes.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (les referències a `public.tenant_users` es qualifiquen explícitament perquè
--        aquesta taula sempre viu a `public`, independentment del search_path actiu)

BEGIN;

DO $$ BEGIN
  CREATE TYPE prioritat_incidencia AS ENUM ('baixa', 'normal', 'alta', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Estats de la Incidència (docs/requirements.md 3.7): oberta -> assignada -> en_curs -> resolta.
-- No existeix un estat 'tancada' separat: la incidència es tanca en passar a 'resolta'
-- i no es pot reobrir (vegeu trg_prevent_reobrir_incidencia).
DO $$ BEGIN
  CREATE TYPE estat_incidencia AS ENUM ('oberta', 'assignada', 'en_curs', 'resolta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS incidencies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unitat_id     UUID NOT NULL REFERENCES unitats(id) ON DELETE RESTRICT,
  contracte_id  UUID REFERENCES contractes(id) ON DELETE SET NULL,
  reportador_id UUID REFERENCES persones(id) ON DELETE SET NULL,
  titol         TEXT NOT NULL,
  descripcio    TEXT,
  prioritat     prioritat_incidencia NOT NULL DEFAULT 'normal',
  estat         estat_incidencia NOT NULL DEFAULT 'oberta',
  assignat_a    UUID REFERENCES public.tenant_users(id) ON DELETE SET NULL,
  cost_estimat  NUMERIC(10,2),
  cost_final    NUMERIC(10,2),
  resolta_el    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER trg_incidencies_updated_at
  BEFORE UPDATE ON incidencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- L'autor d'un comentari és, o bé una persona (ex: el llogater des del portal),
-- o bé un usuari intern (gestor/administrador) — mai cap ni tots dos alhora sense sentit.
CREATE TABLE IF NOT EXISTS incidencia_comentaris (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incidencia_id    UUID NOT NULL REFERENCES incidencies(id) ON DELETE CASCADE,
  autor_persona_id UUID REFERENCES persones(id) ON DELETE SET NULL,
  autor_usuari_id  UUID REFERENCES public.tenant_users(id) ON DELETE SET NULL,
  text             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT incidencia_comentaris_check_autor
    CHECK (autor_persona_id IS NOT NULL OR autor_usuari_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS incidencia_adjunts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incidencia_id        UUID NOT NULL REFERENCES incidencies(id) ON DELETE CASCADE,
  url                  TEXT NOT NULL,
  nom_fitxer           TEXT,
  pujat_per_persona_id UUID REFERENCES persones(id) ON DELETE SET NULL,
  pujat_per_usuari_id  UUID REFERENCES public.tenant_users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Regla de negoci: una incidència només es tanca quan el gestor la marca com a resolta,
-- i un cop resolta no es pot reobrir (docs/requirements.md 3.7, regla #6).
CREATE OR REPLACE FUNCTION prevent_reobrir_incidencia()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estat = 'resolta' AND NEW.estat <> 'resolta' THEN
    RAISE EXCEPTION 'No es pot reobrir la incidència %: ja està resolta', OLD.id;
  END IF;
  IF NEW.estat = 'resolta' AND NEW.resolta_el IS NULL THEN
    NEW.resolta_el := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_prevent_reobrir_incidencia
  BEFORE UPDATE ON incidencies
  FOR EACH ROW EXECUTE FUNCTION prevent_reobrir_incidencia();

COMMIT;
