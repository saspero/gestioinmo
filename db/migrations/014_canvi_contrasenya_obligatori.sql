-- migrations/014_canvi_contrasenya_obligatori.sql
-- Descripció: Marca els usuaris que han d'establir una contrasenya pròpia abans de fer
--             servir l'aplicació: els que tenen una contrasenya temporal generada en
--             crear-los o en restablir-la un administrador.
-- Depèn de: 002_auth.sql
-- Abast: GLOBAL — schema public, s'executa una única vegada, no per tenant
--
-- Els usuaris existents queden a `false`: ja han triat la seva contrasenya o l'han
-- rebut abans que existís aquesta regla.

BEGIN;

ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS canvi_contrasenya_obligatori BOOLEAN NOT NULL DEFAULT false;

COMMIT;
