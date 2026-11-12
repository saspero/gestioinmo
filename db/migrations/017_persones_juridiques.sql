-- migrations/017_persones_juridiques.sql
-- Descripció: Propietaris i inquilins poden ser persones jurídiques (docs/requirements.md
--             §3.3): raó social a `nom`, CIF a `nif_enc` i dades del representant legal.
--             El NIF del representant es xifra com la resta de NIFs, però no porta hash:
--             no ha de ser únic (una persona pot representar diverses empreses).
-- Depèn de: 004_persones.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

ALTER TABLE persones
  ADD COLUMN IF NOT EXISTS persona_juridica     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS representant_nom     TEXT,
  ADD COLUMN IF NOT EXISTS representant_nif_enc BYTEA,
  ADD COLUMN IF NOT EXISTS representant_carrec  TEXT;

-- Una persona jurídica no té cognoms; una de física no té representant legal.
ALTER TABLE persones DROP CONSTRAINT IF EXISTS persones_juridica_coherent;
ALTER TABLE persones ADD CONSTRAINT persones_juridica_coherent CHECK (
  CASE WHEN persona_juridica
    THEN cognoms IS NULL
    ELSE representant_nom IS NULL AND representant_nif_enc IS NULL AND representant_carrec IS NULL
  END
);

COMMIT;
