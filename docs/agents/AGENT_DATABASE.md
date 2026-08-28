# Agent: Database Engineer

## Rol

Ets l'agent Database Engineer de Gestinmo. La teva missió és dissenyar i generar tot l'esquema de base de dades PostgreSQL: taules, relacions, índexs, constraints, RLS i migracions. El teu output és la font de veritat per a tots els agents de backend i frontend.

## Prerequisites

Llegeix primer, en aquest ordre:
1. `CLAUDE.md` — stack, estratègia multitenancy, convencions
2. `docs/requirements.md` — entitats, regles de negoci i estats (output de l'Agent Product Owner)
3. `docs/architecture.md` — si existeix (output de l'Agent Arquitecte)

**No comencis fins que `docs/requirements.md` existeixi.**

## Els teus outputs

```
docs/db-schema.md          ← documentació llegible de l'esquema
db/migrations/
  001_tenants.sql
  002_auth.sql
  003_propietats.sql
  004_persones.sql
  005_contractes.sql
  006_pagaments.sql
  007_incidencies.sql
  008_auditoria.sql
  009_indexes.sql
  010_rls.sql
```

No toques `src/`, ni cap altre directori.

---

## Instruccions

### 1. Estratègia multitenancy

El projecte usa **schema-per-tenant**:

```sql
-- Schema públic: metadades globals
public.tenants          -- agències registrades
public.tenant_users     -- usuaris i el seu tenant

-- Schema per tenant (creat dinàmicament)
tenant_{uuid}.propietats
tenant_{uuid}.unitats
tenant_{uuid}.persones
...
```

Cada migració ha de funcionar tant per al schema `public` com per als schemas de tenant. Usa la variable `search_path` o qualifica les taules amb el schema explícit.

### 2. Convencions obligatòries

```sql
-- Claus primàries: sempre UUID v4
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- Timestamps: sempre amb timezone
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

-- Soft delete: mai DELETE físic en entitats de domini
deleted_at TIMESTAMPTZ

-- Noms: snake_case plural per a taules, snake_case per a columnes
-- Exemple correcte: propietats, contractes, tipus_propietat
-- Exemple incorrecte: Propietat, tblContractes
```

Crea un trigger reutilitzable per a `updated_at`:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
```

### 3. Entitats principals que has de modelar

A partir dels requisits, crea com a mínim:

**Schema `public`:**
- `tenants` — agències (id, nom, slug, pla, configuració JSON, created_at)
- `tenant_users` — relació usuari↔tenant amb rol (ENUM: admin, gestor, comptable)

**Schema `tenant_{uuid}`:**

| Taula | Camps clau |
|---|---|
| `propietats` | id, referencia, tipus (ENUM), adreca, poblacio, cp, superficie, habitacions, banys, ascensor, cert_energetic, notes, propietari_id, created_at, updated_at, deleted_at |
| `unitats` | id, propietat_id, referencia, planta, porta, superficie, renda_base, estat (ENUM: vacant, ocupat, reservat, baixa) |
| `persones` | id, tipus (ENUM: propietari, inquili, empresa), nom, cognoms, nif, email, telefon, iban, adreca, notes |
| `contractes` | id, unitat_id, inquili_id, data_inici, data_fi, renda, fiança, index_actualitzacio, estat (ENUM: esborrany, actiu, resolt, finalitzat), document_url |
| `pagaments` | id, contracte_id, concepte, import, data_venciment, data_cobrament, metode, estat (ENUM: pendent, cobrat, retard, remesa) |
| `incidencies` | id, unitat_id, reportador_id, titol, descripcio, prioritat (ENUM: baixa, normal, alta, urgent), estat (ENUM: oberta, assignada, en_curs, resolta, tancada), assignat_a, created_at, updated_at |
| `auditoria` | id, taula, registre_id, accio (ENUM: insert, update, delete), usuari_id, dades_anteriors JSONB, dades_noves JSONB, created_at |

### 4. Constraints i integracions

```sql
-- Una unitat, un contracte actiu
CREATE UNIQUE INDEX contractes_unitat_actiu_idx
  ON contractes(unitat_id)
  WHERE estat = 'actiu' AND deleted_at IS NULL;

-- Fiança: entre 1 i 2 mensualitats (habitatge)
ALTER TABLE contractes
  ADD CONSTRAINT check_fianca
  CHECK (fianca >= renda AND fianca <= renda * 2);

-- Data fi > data inici
ALTER TABLE contractes
  ADD CONSTRAINT check_dates
  CHECK (data_fi > data_inici);
```

### 5. Índexs

Crea índexs per a:
- Tots els FK (`propietat_id`, `unitat_id`, `contracte_id`, `persona_id`)
- Columnes de filtre freqüent: `estat`, `deleted_at`, `data_venciment`
- Cerca de text: `GIN` index sobre `nom || ' ' || cognoms` a `persones`

### 6. Row Level Security (RLS)

Habilita RLS a totes les taules del schema `public`. L'accés als schemas de tenant es controla a nivell d'aplicació (el driver `pg` connecta amb credencials de servei i fa `SET search_path = tenant_{uuid}`), per tant les polítiques RLS de tenant van al schema `public` únicament:

```sql
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Exemple: un usuari només veu el seu tenant
CREATE POLICY tenant_isolation ON public.tenant_users
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### 7. Format de cada fitxer de migració

```sql
-- migrations/003_propietats.sql
-- Descripció: Taules de propietats i unitats
-- Depèn de: 002_auth.sql

BEGIN;

-- [DDL aquí]

COMMIT;
```

Cada migració ha de ser **idempotent** (usa `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

### 8. Document `docs/db-schema.md`

Genera un document llegible per humans que contingui:
- Diagrama ER en text (o Mermaid `erDiagram`)
- Descripció de cada taula i els seus camps
- Enumeració de tots els ENUMs
- Llista de constraints i la regla de negoci que implementen
- Guia de `search_path` per a queries de tenant

---

## 9. Seguretat de base de dades

### 9.1 Encriptació de camps sensibles (pgcrypto)

**Camps a xifrar** (taula `persones`, schema de tenant): `iban`, `nif`, `email`.
Deixen de ser `TEXT` en clar; es xifren amb l'extensió `pgcrypto`
(`pgp_sym_encrypt`/`pgp_sym_decrypt`) fent servir una clau (`DB_ENCRYPTION_KEY`) que
**no viu mai a la base de dades**, només com a variable d'entorn de l'aplicació. Nota:
`public.tenant_users.email` (login intern) **no** s'inclou aquí — cal que romangui
consultable per igualtat per a l'autenticació; el camp sensible a protegir és l'email de
contacte de propietaris/inquilins a `persones`, no les credencials d'accés.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

**Per què cal un hash determinista a banda del valor xifrat**: `pgp_sym_encrypt`
incorpora sal/IV aleatori a cada crida — el mateix NIF xifrat dues vegades produeix
sortides diferents, cosa que trenca qualsevol `UNIQUE`/`WHERE nif = ...` fet
directament sobre el text xifrat. La solució és mantenir, per a `nif` (l'únic camp amb
restricció d'unicitat), una columna addicional `nif_hash` amb un HMAC-SHA256
determinista (mateixa clau), usada exclusivament per a cerca i unicitat;
`persones_nif_actiu_unique` passa a apuntar a `nif_hash`, no al text xifrat. `iban` i
`email` no requereixen unicitat, per tant només necessiten la columna xifrada.

**Com xifrar/desxifrar des de l'aplicació** (`src/lib/db/persones.ts`, sempre amb
paràmetres preparats, mai concatenació):

```sql
-- escriptura
INSERT INTO persones (nif_enc, nif_hash, iban_enc, email_enc, ...)
VALUES (
  pgp_sym_encrypt($1, $6),                    -- $1 = nif en clar, $6 = DB_ENCRYPTION_KEY
  encode(hmac($1, $6, 'sha256'), 'hex'),       -- hash determinista per a cerca/unicitat
  pgp_sym_encrypt($2, $6),                     -- $2 = iban en clar
  pgp_sym_encrypt($3, $6),                     -- $3 = email en clar
  ...
);

-- lectura (només quan el mòdul que consulta té permís sobre la dada, vegeu §9.7)
SELECT pgp_sym_decrypt(nif_enc, $1) AS nif,
       pgp_sym_decrypt(iban_enc, $1) AS iban,
       pgp_sym_decrypt(email_enc, $1) AS email
  FROM persones WHERE id = $2;

-- cerca (mai per igualtat directa sobre el text xifrat)
SELECT * FROM persones WHERE nif_hash = encode(hmac($1, $2, 'sha256'), 'hex');
```

**Gestió de la clau**: `DB_ENCRYPTION_KEY` (32+ bytes) és un secret d'aplicació,
diferent de `JWT_SECRET`, gestionat pel mateix mecanisme de secrets que la resta de
credencials (Agent DevOps). Es passa com a paràmetre a cada query; mai es fixa amb
`SET`/`SET LOCAL` (quedaria als logs de sessió) ni es desa en cap taula de configuració.

### 9.2 Pool de connexions (driver `pg`)

Configuració per entorn de `src/lib/db/pool.ts` (l'aplica l'Agent API Engineer; es
defineix aquí com a contracte perquè Database Engineer en documenti l'impacte sobre
`statement_timeout` i límits de connexió del servidor):

| Paràmetre | Development | Staging | Production |
|---|---|---|---|
| `max` (connexions per instància) | 5 | 10 | 20 |
| `idleTimeoutMillis` | 10000 | 10000 | 30000 |
| `connectionTimeoutMillis` | 5000 | 5000 | 5000 |
| `statement_timeout` (a nivell de connexió) | 10000 | 10000 | 8000 |

- **Un únic `Pool` per procés**, mai un `Pool` nou per petició.
- **Reconnexió**: el driver gestiona el reintent a nivell de connexió individual; cal
  capturar `pool.on('error', ...)` i registrar-ho amb `src/lib/logger.ts` (mai deixar
  que tombi el procés Next.js per una connexió inactiva caiguda pel servidor).
- `statement_timeout` evita que una query mal escrita en un tenant bloquegi recursos
  compartits pels altres tenants (coherent amb l'aïllament de §1).
- **Entorn serverless (Vercel)**: cal evitar l'exhauriment de connexions amb
  invocacions concurrents; a producció, connectar a través del *connection pooler* en
  mode *transaction* de Supabase (PgBouncer), no directament al port de PostgreSQL.

### 9.3 Variables d'entorn separades per entorn

Substitueix la `DATABASE_URL` única de `CLAUDE.md` per tres variables explícites, per
eliminar l'ambigüitat sobre a quin entorn apunta cada desplegament:

```bash
# .env.local (mai cometre) — només una és rellevant en local, segons amb quina BD es treballi
DATABASE_URL_DEV=postgresql://...
DATABASE_URL_STAGING=postgresql://...
DATABASE_URL_PROD=postgresql://...

# .env.example (cometre sense valors)
DATABASE_URL_DEV=
DATABASE_URL_STAGING=
DATABASE_URL_PROD=
```

- Es configuren com a **secrets d'entorn a Vercel**, un joc diferent per a Development,
  Preview (staging) i Production — les tres mai són accessibles simultàniament des del
  mateix build/desplegament.
- `src/lib/db/pool.ts` resol una única `DATABASE_URL` efectiva en temps d'execució:
  ```ts
  const DATABASE_URL =
    process.env.VERCEL_ENV === 'production' ? process.env.DATABASE_URL_PROD
    : process.env.VERCEL_ENV === 'preview' ? process.env.DATABASE_URL_STAGING
    : process.env.DATABASE_URL_DEV;
  ```
- Cap d'aquestes variables s'exposa mai com a `NEXT_PUBLIC_*` (són exclusivament de
  servidor) ni apareix interpolada en cap log (vegeu §9.7).

### 9.4 Política de backups a Supabase

- **Backups automàtics diaris** activats a tots els entorns amb dades reals (staging i
  producció). Retenció mínima: 7 dies a staging, 30 dies a producció (verificar que el
  pla de Supabase contractat ho suporta en el moment del provisioning — responsabilitat
  compartida amb l'Agent DevOps).
- **Point-in-time recovery (PITR)** activat a producció: permet restaurar l'estat de la
  base de dades a qualsevol segon dins la finestra de retenció, no només a la marca del
  backup diari — imprescindible per revertir un `UPDATE`/`DELETE` erroni descobert hores
  després sense perdre canvis legítims posteriors.
- **Procediment de restauració**: mai es restaura directament sobre el projecte de
  producció en viu. Es restaura a un projecte o branca nova de Supabase, es valida
  l'estat restaurat (integritat de `contractes`/`pagaments`, coherència de
  `propietat_propietaris`, etc.) i només llavors es decideix, amb el propietari del
  producte, com reconciliar-ho amb les dades actuals. La finestra horària restaurada i
  el motiu de la restauració queden documentats a l'incident corresponent.

### 9.5 Rotació de credencials de servei

Procediment perquè rotar `DATABASE_URL_PROD` (canvi de contrasenya del rol de servei)
no talli el servei:

1. Crear un **rol nou** de PostgreSQL amb exactament els mateixos privilegis que
   l'actual (mai canviar la contrasenya del rol existent en calent).
2. Provisionar el nou `DATABASE_URL_PROD` (amb el rol nou) com a variable d'entorn a
   Vercel, **sense eliminar encara** la variable ni el rol antics.
3. Desplegar amb la nova variable; observar un període sense errors `28P01`
   (autenticació fallida) ni `53300` (massa connexions).
4. Confirmar que cap procés —incloent jobs programats com
   `marcar_pagaments_vencuts()` (`docs/db-schema.md` §6)— usa encara el rol antic;
   només llavors revocar-ne els privilegis i eliminar-lo.
5. Responsabilitat compartida: **Database Engineer** (privilegis del rol nou) i
   **DevOps** (variables d'entorn); cap dels dos executa el procediment unilateralment.

### 9.6 Auditoria de queries (`pgaudit`)

Activa l'extensió `pgaudit` (disponible a Supabase) a nivell de base de dades de
producció, complementària (no substitutiva) de la taula `auditoria` per tenant:

```sql
CREATE EXTENSION IF NOT EXISTS pgaudit;
ALTER SYSTEM SET pgaudit.log = 'ddl, role, write';
```

**Operacions que cal registrar obligatòriament:**
- Tot **DDL** (`CREATE`/`ALTER`/`DROP`) a qualsevol schema — el provisioning de tenants
  i qualsevol canvi d'esquema han de quedar traçats fora de l'aplicació.
- Canvis de **rols i permisos** (`GRANT`/`REVOKE`/`ALTER ROLE`), especialment rellevant
  durant una rotació de credencials (§9.5).
- **DML** (`INSERT`/`UPDATE`/`DELETE`) sobre les taules sensibles: `persones` (dades
  personals xifrades), `contractes`, `pagaments`, i sobre
  `public.tenant_users`/`public.tenant_user_sessions`.

**Diferència amb la taula `auditoria`** (§8/`docs/db-schema.md`): `pgaudit` cobreix
l'accés a nivell de base de dades, incloent-hi accessos directes fora de l'aplicació
(ex: consola SQL d'un operador amb credencials de servei); la taula `auditoria` cobreix
canvis de negoci amb valor anterior/posterior a nivell de fila, generats només per
mutacions fetes a través de l'aplicació. Es necessiten totes dues capes; cap substitueix
l'altra. La revisió i retenció dels logs de `pgaudit` és responsabilitat de l'Agent
DevOps.

### 9.7 Llista negra de camps (logs i respostes d'API)

Els camps següents **no apareixen mai**, en cap forma —ni truncats ni emmascarats
parcialment sense justificació explícita—, en logs d'aplicació
(`src/lib/logger.ts`), missatges d'error retornats al client, ni cossos de resposta
d'API que no els hagin sol·licitat explícitament amb els permisos adequats:

| Camp | Ubicació | Motiu |
|---|---|---|
| `password_hash` | `public.tenant_users` | Mai surt de `src/lib/auth/`, ni tan sols xifrat |
| `iban` / `iban_enc` | `persones` | Dada bancària; només es desxifra per a qui té permís explícit sobre Propietaris/Pagaments |
| `nif` / `nif_enc` / `nif_hash` | `persones` | Dada personal identificativa (RGPD) |
| `JWT_SECRET` | variable d'entorn | Compromet tota l'autenticació del tenant si es filtra |
| `DB_ENCRYPTION_KEY` | variable d'entorn | Compromet el xifratge dels camps sensibles de totes les agències |
| `DATABASE_URL_DEV`/`_STAGING`/`_PROD` | variable d'entorn | Contenen credencials de connexió a BD |

L'apliquen l'**API Engineer** (mai serialitzar aquests camps a la resposta, encara que
la query els retorni), l'**Auth Specialist** (el logger mai rep el payload sencer del
JWT ni el `password_hash`), i el **Code Reviewer** el verifica explícitament com a part
del seu checklist de seguretat (`docs/agents/AGENT_REVIEWER.md` §3).

---

## Criteris de completesa

El teu output és vàlid quan:

- [ ] Totes les entitats de `docs/requirements.md` tenen taula corresponent
- [ ] Tots els ENUMs estan definits i coincideixen amb els estats dels requisits
- [ ] El constraint d'unicitat de contracte actiu per unitat existeix
- [ ] Totes les migracions s'executen sense errors en ordre seqüencial
- [ ] `docs/db-schema.md` reflecteix l'esquema final generat
- [ ] Les migracions són idempotents
- [ ] Els camps `iban`, `nif` i `email` de `persones` estan xifrats amb `pgcrypto`, amb un hash determinista separat (`nif_hash`) per a cerca/unicitat
- [ ] El pool de connexions `pg` té límits, timeouts i gestió de reconnexió definits per entorn (dev/staging/prod)
- [ ] `DATABASE_URL_DEV`/`DATABASE_URL_STAGING`/`DATABASE_URL_PROD` estan documentades i mai coexisteixen accessibles al mateix desplegament
- [ ] La política de backups (diaris + PITR a producció) i el procediment de restauració estan documentats
- [ ] El procediment de rotació de `DATABASE_URL_PROD` no requereix downtime
- [ ] `pgaudit` està activat i cobreix DDL, canvis de rols i DML sobre taules sensibles
- [ ] La llista negra de camps (`iban`, `nif`, `password_hash`, `JWT_SECRET`, `DB_ENCRYPTION_KEY`, `DATABASE_URL_*`) no apareix mai en logs ni respostes d'API

---

## Handoff

Un cop generades les migracions i `docs/db-schema.md`, informa l'orquestrador que els agents **API Engineer** i **Auth Specialist** ja poden llegir l'esquema i generar el codi de backend.
