-- migrations/004_persones.sql
-- Descripció: Persones (propietaris, inquilins, empreses), copropietat de propietats,
--             i xifratge de camps sensibles (nif, iban, email) amb pgcrypto
-- Depèn de: 003_propietats.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`

BEGIN;

-- Necessari per a pgp_sym_encrypt/pgp_sym_decrypt i hmac() (vegeu docs/db-schema.md,
-- secció de seguretat). Idempotent i de bast de base de dades: reexecutar-lo per a
-- cada tenant és inofensiu un cop instal·lat la primera vegada.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE tipus_persona AS ENUM ('propietari', 'inquili', 'empresa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Estats de l'Inquili (docs/requirements.md 3.4): actiu -> moros -> actiu -> inactiu.
-- Només té sentit quan tipus = 'inquili' (vegeu constraint persones_estat_inquili_coherent).
DO $$ BEGIN
  CREATE TYPE estat_inquili AS ENUM ('actiu', 'moros', 'inactiu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- `nif`, `iban` i `email` es guarden xifrats amb pgcrypto (pgp_sym_encrypt), usant la
-- clau d'aplicació `DB_ENCRYPTION_KEY` (mai emmagatzemada a la BD; es passa com a
-- paràmetre preparat a cada query des de `src/lib/db/persones.ts`). `pgp_sym_encrypt`
-- no és determinista (sal/IV aleatori), per això `nif` -que necessita unicitat- porta
-- a més `nif_hash`: un HMAC-SHA256 determinista (mateixa clau) usat exclusivament per
-- cerca/unicitat, mai desxifrat. `iban` i `email` no requereixen unicitat i només
-- tenen la columna xifrada. Detall complet a docs/db-schema.md.
CREATE TABLE IF NOT EXISTS persones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipus          tipus_persona NOT NULL,
  nom            TEXT NOT NULL,
  cognoms        TEXT,
  nif_enc        BYTEA,
  nif_hash       TEXT,
  email_enc      BYTEA,
  telefon        TEXT,
  iban_enc       BYTEA,
  adreca         TEXT,
  notes          TEXT,
  estat_inquili  estat_inquili,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  CONSTRAINT persones_estat_inquili_coherent CHECK ((tipus = 'inquili') = (estat_inquili IS NOT NULL))
);

CREATE OR REPLACE TRIGGER trg_persones_updated_at
  BEFORE UPDATE ON persones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- NIF/CIF únic dins del tenant (via el seu hash determinista), només entre persones no
-- donades de baixa (permet reutilitzar un NIF si el registre anterior s'ha donat de baixa).
CREATE UNIQUE INDEX IF NOT EXISTS persones_nif_hash_actiu_unique
  ON persones (nif_hash)
  WHERE nif_hash IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION set_estat_inquili_defecte()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipus = 'inquili' AND NEW.estat_inquili IS NULL THEN
    NEW.estat_inquili := 'actiu';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_persones_estat_inquili_defecte
  BEFORE INSERT ON persones
  FOR EACH ROW EXECUTE FUNCTION set_estat_inquili_defecte();

-- Copropietat: una propietat pot tenir més d'un propietari, amb percentatge de titularitat
-- que ha de sumar 100 (docs/requirements.md 3.3). Relació N a N amb `persones` (tipus='propietari').
CREATE TABLE IF NOT EXISTS propietat_propietaris (
  propietat_id UUID NOT NULL REFERENCES propietats(id) ON DELETE RESTRICT,
  persona_id   UUID NOT NULL REFERENCES persones(id) ON DELETE RESTRICT,
  percentatge  NUMERIC(5,2) NOT NULL CHECK (percentatge > 0 AND percentatge <= 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (propietat_id, persona_id)
);

CREATE OR REPLACE TRIGGER trg_propietat_propietaris_updated_at
  BEFORE UPDATE ON propietat_propietaris
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Regla de negoci: el % de titularitat d'una propietat ha de sumar exactament 100.
-- Constraint trigger diferit: permet inserir/actualitzar diverses files dins la mateixa
-- transacció (ex: donar d'alta 2 copropietaris alhora) i només valida en fer COMMIT.
CREATE OR REPLACE FUNCTION check_percentatge_titularitat()
RETURNS TRIGGER AS $$
DECLARE
  v_propietat_id UUID;
  v_total NUMERIC(6,2);
BEGIN
  v_propietat_id := COALESCE(NEW.propietat_id, OLD.propietat_id);
  SELECT COALESCE(SUM(percentatge), 0) INTO v_total
    FROM propietat_propietaris
    WHERE propietat_id = v_propietat_id;
  IF v_total <> 100 THEN
    RAISE EXCEPTION 'La suma de percentatges de titularitat de la propietat % ha de ser 100%% (actual: %)',
      v_propietat_id, v_total;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE CONSTRAINT TRIGGER trg_check_percentatge_titularitat
  AFTER INSERT OR UPDATE OR DELETE ON propietat_propietaris
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_percentatge_titularitat();

COMMIT;
