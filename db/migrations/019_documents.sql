-- migrations/019_documents.sql
-- Descripció: Documents adjunts a propietats, persones (propietaris i inquilins),
--             contractes i incidències (docs/requirements.md §3.2-3.7). Els fitxers es
--             guarden a la mateixa base de dades, xifrats amb `pgp_sym_encrypt_bytea`
--             i partits en trossos: una funció de Vercel no accepta ni retorna més de
--             4,5 MB per petició, i un fitxer pot fer-ne fins a 10.
-- Depèn de: 003_propietats.sql, 004_persones.sql, 005_contractes.sql, 007_incidencies.sql,
--           008_auditoria.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

DO $$ BEGIN
  CREATE TYPE entitat_document AS ENUM ('propietat', 'persona', 'contracte', 'incidencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- L'entitat és polimòrfica (sense FK): l'aplicació comprova que existeix abans de crear
-- el document. `complet` passa a cert quan han arribat tots els trossos.
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitat      entitat_document NOT NULL,
  entitat_id   UUID NOT NULL,
  nom          TEXT NOT NULL CHECK (length(nom) BETWEEN 1 AND 255),
  mime         TEXT NOT NULL,
  mida         INTEGER NOT NULL CHECK (mida > 0 AND mida <= 10485760),
  parts        INTEGER NOT NULL CHECK (parts > 0),
  complet      BOOLEAN NOT NULL DEFAULT false,
  pujat_per    UUID REFERENCES public.tenant_users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_entitat ON documents (entitat, entitat_id, created_at DESC);

CREATE TABLE IF NOT EXISTS document_parts (
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL CHECK (idx >= 0),
  dades_enc    BYTEA NOT NULL,
  PRIMARY KEY (document_id, idx)
);

-- Només s'audita la fitxa del document; els trossos no (el contingut no ha d'anar a
-- `auditoria` en clar).
CREATE OR REPLACE TRIGGER trg_auditoria_documents
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

COMMIT;
