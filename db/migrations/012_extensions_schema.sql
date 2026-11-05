-- migrations/012_extensions_schema.sql
-- Descripció: Centralitza pgcrypto i pg_trgm a l'schema `extensions`
-- Depèn de: 004_persones.sql, 009_indexes.sql (poden haver-les creat abans)
-- Abast: GLOBAL — s'executa una única vegada, no per tenant
--
-- Les extensions són úniques per base de dades. Si es creen amb el `search_path` d'un
-- tenant, aterren dins el seu schema i la resta de tenants no en veuen les funcions ni
-- els operadors (`gin_trgm_ops`, `pgp_sym_encrypt`). Un cop en aquest schema compartit,
-- `CREATE EXTENSION IF NOT EXISTS` de 004/009 és un no-op a cada provisioning.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  ext TEXT;
  ext_schema TEXT;
BEGIN
  FOREACH ext IN ARRAY ARRAY['pgcrypto', 'pg_trgm'] LOOP
    SELECT n.nspname INTO ext_schema
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = ext;

    IF ext_schema IS NULL THEN
      EXECUTE format('CREATE EXTENSION %I SCHEMA extensions', ext);
    ELSIF ext_schema <> 'extensions' THEN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext);
    END IF;
  END LOOP;
END $$;

COMMIT;
