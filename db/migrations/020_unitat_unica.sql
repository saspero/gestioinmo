-- migrations/020_unitat_unica.sql
-- Descripció: Les propietats que es lloguen senceres (tots els tipus menys `edifici`)
--             tenen una sola unitat, que des d'ara l'aplicació crea en donar-les d'alta
--             (`assegurarUnitatUnica`, src/lib/db/propietats.ts). Aquesta migració crea
--             la unitat de les propietats existents que encara no en tenen cap, amb la
--             referència, la planta i la superfície de la propietat. Només dades.
-- Depèn de: 003_propietats.sql, 018_propietats_camps_per_tipus.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

INSERT INTO unitats (propietat_id, referencia, planta, superficie)
SELECT p.id, p.referencia, p.planta, p.superficie
  FROM propietats p
 WHERE p.deleted_at IS NULL
   AND p.tipus <> 'edifici'
   AND NOT EXISTS (SELECT 1 FROM unitats u WHERE u.propietat_id = p.id AND u.deleted_at IS NULL);

COMMIT;
