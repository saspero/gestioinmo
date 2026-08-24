-- migrations/009_indexes.sql
-- Descripció: Índexs addicionals sobre claus foranes, columnes de filtre freqüent i cerca de text
-- Depèn de: 001_tenants.sql .. 008_auditoria.sql
-- Abast: mixt — la primera secció qualifica `public.*` (taules globals); la segona és
--        de TENANT i s'executa amb `search_path` apuntant a `tenant_{uuid}`

BEGIN;

-- --- Schema public ---
CREATE INDEX IF NOT EXISTS tenant_users_tenant_id_idx ON public.tenant_users (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_users_email_idx ON public.tenant_users (email);
CREATE INDEX IF NOT EXISTS tenant_user_sessions_tenant_user_id_idx ON public.tenant_user_sessions (tenant_user_id);
CREATE INDEX IF NOT EXISTS tenant_user_sessions_expires_at_idx ON public.tenant_user_sessions (expires_at);

-- --- Schema de TENANT ---
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Propietats / unitats
CREATE INDEX IF NOT EXISTS propietats_deleted_at_idx ON propietats (deleted_at);
CREATE INDEX IF NOT EXISTS unitats_propietat_id_idx ON unitats (propietat_id);
CREATE INDEX IF NOT EXISTS unitats_estat_idx ON unitats (estat);
CREATE INDEX IF NOT EXISTS unitats_deleted_at_idx ON unitats (deleted_at);

-- Persones
CREATE INDEX IF NOT EXISTS persones_tipus_idx ON persones (tipus);
CREATE INDEX IF NOT EXISTS persones_estat_inquili_idx ON persones (estat_inquili);
CREATE INDEX IF NOT EXISTS persones_deleted_at_idx ON persones (deleted_at);
CREATE INDEX IF NOT EXISTS persones_nom_cognoms_trgm_idx
  ON persones USING GIN ((coalesce(nom, '') || ' ' || coalesce(cognoms, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS propietat_propietaris_persona_id_idx ON propietat_propietaris (persona_id);

-- Contractes
CREATE INDEX IF NOT EXISTS contractes_unitat_id_idx ON contractes (unitat_id);
CREATE INDEX IF NOT EXISTS contractes_estat_idx ON contractes (estat);
CREATE INDEX IF NOT EXISTS contractes_deleted_at_idx ON contractes (deleted_at);
CREATE INDEX IF NOT EXISTS contracte_inquilins_persona_id_idx ON contracte_inquilins (persona_id);

-- Pagaments
CREATE INDEX IF NOT EXISTS pagaments_contracte_id_idx ON pagaments (contracte_id);
CREATE INDEX IF NOT EXISTS pagaments_remesa_id_idx ON pagaments (remesa_id);
CREATE INDEX IF NOT EXISTS pagaments_estat_idx ON pagaments (estat);
CREATE INDEX IF NOT EXISTS pagaments_data_venciment_idx ON pagaments (data_venciment);
CREATE INDEX IF NOT EXISTS pagaments_deleted_at_idx ON pagaments (deleted_at);
CREATE INDEX IF NOT EXISTS liquidacions_propietari_id_idx ON liquidacions (propietari_id);

-- Incidències
CREATE INDEX IF NOT EXISTS incidencies_unitat_id_idx ON incidencies (unitat_id);
CREATE INDEX IF NOT EXISTS incidencies_contracte_id_idx ON incidencies (contracte_id);
CREATE INDEX IF NOT EXISTS incidencies_assignat_a_idx ON incidencies (assignat_a);
CREATE INDEX IF NOT EXISTS incidencies_estat_idx ON incidencies (estat);
CREATE INDEX IF NOT EXISTS incidencies_deleted_at_idx ON incidencies (deleted_at);
CREATE INDEX IF NOT EXISTS incidencia_comentaris_incidencia_id_idx ON incidencia_comentaris (incidencia_id);
CREATE INDEX IF NOT EXISTS incidencia_adjunts_incidencia_id_idx ON incidencia_adjunts (incidencia_id);

-- Auditoria
CREATE INDEX IF NOT EXISTS auditoria_registre_id_idx ON auditoria (registre_id);
CREATE INDEX IF NOT EXISTS auditoria_taula_idx ON auditoria (taula);
CREATE INDEX IF NOT EXISTS auditoria_created_at_idx ON auditoria (created_at);

COMMIT;
