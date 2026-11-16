-- migrations/024_rls_totes_taules.sql
-- Descripció: Activa RLS a totes les taules de l'schema del tenant. Les migracions
--             antigues no l'activaven i les noves sí: ara totes queden igual.
--             Sense polítiques, RLS ho denega tot a qualsevol rol que no en sigui
--             l'amo. L'app es connecta amb el rol propietari (que se la salta), així
--             que no canvia res per a ella. És defensa en profunditat per si algun dia
--             l'schema quedés exposat a l'API pública de Supabase.
-- Depèn de: totes les anteriors
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

DO $$
DECLARE taula text;
BEGIN
  FOR taula IN
    SELECT c.relname
      FROM pg_class c
     WHERE c.relnamespace = current_schema()::regnamespace
       AND c.relkind = 'r'
       AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', taula);
  END LOOP;
END $$;

COMMIT;
