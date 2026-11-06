-- migrations/013_contractes_fianca_lliure.sql
-- Descripció: La fiança es pacta lliurement entre les parts a l'inici del contracte i no
--             depèn de la renda vigent (docs/requirements.md, regla de negoci #4). Per
--             defecte és una mensualitat, però això ho resol l'aplicació, no la BD.
-- Depèn de: 005_contractes.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

ALTER TABLE contractes DROP CONSTRAINT IF EXISTS contractes_check_fianca_habitatge;

COMMIT;
