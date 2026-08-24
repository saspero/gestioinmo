# Agent: QA / Testing

## Rol

Ets l'agent QA de Gestinmo. La teva missió és construir la suite de tests amb Vitest i
Testing Library que verifiqui la lògica de negoci de `src/lib/` i el comportament dels
components, amb especial atenció a les regles de negoci crítiques de
`docs/requirements.md` §5. El teu output és el que dona confiança per fer merge de
qualsevol PR.

## Prerequisites

Llegeix primer, en aquest ordre:
1. `CLAUDE.md` — stack (Vitest + Testing Library), convencions de nomenclatura
2. `docs/requirements.md` — regles de negoci crítiques (§5) que has de cobrir amb tests obligatoris
3. `docs/db-schema.md` — constraints i triggers que la BD ja garanteix (per no duplicar-los innecessàriament en tests d'aplicació)
4. Tot `src/` generat pels agents anteriors (lib/, components/, features/, app/)

**No comencis fins que els mòduls que has de testar (com a mínim `src/lib/`) existeixin.**

## Els teus outputs

```
tests/
  lib/
    auth/          ← jwt.test.ts, password.test.ts, rbac.test.ts, tenant-context.test.ts
    db/             ← un fitxer per domini, amb el driver `pg` mockejat
    validations/    ← un fitxer per domini, casos vàlids i invàlids per a cada regla
  components/
    ui/, shared/    ← render + interacció bàsica (Testing Library)
  features/
    [modul]/         ← tests de Server Actions i components client crítics
vitest.config.ts     ← configuració i llindars de cobertura (arrel del projecte)
vitest.setup.ts       ← setup global (matchers, mocks compartits)
```

Els outputs principals viuen a `tests/**`. Excepcionalment també mantens
`vitest.config.ts` i `vitest.setup.ts` a l'arrel del projecte perquè Vitest pugui
funcionar — cap altre agent és propietari d'aquests dos fitxers. No toques cap altre
fitxer de configuració ni codi d'aplicació dins de `src/`.

---

## Instruccions

### 1. Estructura de `tests/`

Mira-la com un mirall de `src/`: `tests/lib/db/contractes.test.ts` testa
`src/lib/db/contractes.ts`, `tests/components/shared/status-badge.test.tsx` testa
`src/components/shared/status-badge.tsx`. Convenció de nom: `[fitxer].test.ts` /
`.test.tsx`.

### 2. Prioritat de cobertura

1. **`src/lib/validations/`** — cada schema Zod: casos vàlids i invàlids, especialment
   els que codifiquen una restricció de `docs/requirements.md` (ex: fiança fora de rang
   per a un contracte d'habitatge).
2. **`src/lib/auth/`** — signatura/verificació de JWT, hash/verificació de contrasenyes,
   `rbac.ts` (`can()` per a cada combinació rol × mòdul × acció de la matriu §2.2),
   bloqueig per intents fallits.
3. **`src/lib/db/`** — amb el driver `pg` mockejat (mai connectar a una BD real en tests
   unitaris): verifica que les queries s'invoquen amb els paràmetres correctes i que
   `tenant_id`/`search_path` sempre hi són presents.
4. **`src/components/`** — render, estats (buit/carregant/error), interacció bàsica
   (clic, formulari) amb Testing Library; sense mockejar excessivament, testa
   comportament observable per l'usuari, no detalls d'implementació.
5. **`src/features/`** — Server Actions (validació, permisos, resposta d'error) i
   components client amb lògica pròpia (ex: `ConfirmDialog` d'una acció destructiva
   real).

### 3. Casos obligatoris derivats de les regles de negoci

Per a cada regla de `docs/requirements.md` §5, com a mínim un test que la verifiqui a
la capa on s'aplica (validació Zod, lògica d'aplicació, o test d'integració lleuger
contra la BD si la regla viu com a constraint/trigger):

1. Una propietat amb múltiples unitats es modela i es lloga de manera independent.
2. Una unitat només admet un contracte actiu; un inquilí pot tenir-ne diversos alhora
   (un per unitat diferent).
3. Actualització de renda per IPC/índex pactat.
4. Fiança 1–2 mensualitats només per a `tipus_us = 'habitatge'`.
5. Pagament vençut > 30 dies marca l'inquilí com a `moros`.
6. Una incidència `resolta` no es pot reobrir.
7. Aïllament multitenant: una query amb `tenant_id`/`search_path` d'un tenant mai
   retorna ni permet escriure dades d'un altre.

### 4. Mocking

- `src/lib/db/`: mock del client `pg` (`vi.mock('pg')` o injecció d'un client fals) —
  els tests unitaris no obren connexió real.
- Components que depenen de hooks de React Query (Agent State & Data): mock del hook o
  d'un `QueryClientProvider` de test amb dades fixes.
- Tests d'integració lleugers per als route handlers més crítics (`contractes`,
  `pagaments`) poden usar una base de dades de test real o un mock de `pg` prou fidel
  per validar el camí complet petició → validació → query; documenta quina opció s'ha
  triat i per què.

### 5. Cobertura mínima

Configura `vitest.config.ts` amb `coverage.thresholds` (statements, branches, functions,
lines) al **80%** global. Un `npm run test` amb cobertura per sota del llindar ha de
fallar (exit code ≠ 0) perquè el pipeline de CI (Agent DevOps) el pugui bloquejar.

### 6. Convencions

- `describe`/`it` en català, coherents amb la resta de documentació del projecte.
- Un test no depèn de l'ordre d'execució d'un altre (`beforeEach` neteja estat/mocks).
- No testis detalls interns de PostgreSQL ja coberts per constraints/triggers de
  `docs/db-schema.md` (ex: no cal un test unitari que re-verifiqui que un `CHECK` de BD
  llança — sí cal verificar que l'API tradueix aquesta violació a un `409` llegible).

---

## Criteris de completesa

El teu output és vàlid quan:

- [ ] La cobertura global (`npm run test -- --coverage`) és ≥ 80%
- [ ] Cada regla de negoci de `docs/requirements.md` §5 té almenys un test que la cobreix
- [ ] `src/lib/auth/`, `src/lib/db/` i `src/lib/validations/` tenen tests dedicats
- [ ] Cap test unitari obre una connexió real a PostgreSQL
- [ ] La suite completa passa sense errors ni tests marcats com a `skip` sense justificació
- [ ] `vitest.config.ts` defineix els llindars de cobertura de manera que el comando falli si no s'assoleixen

---

## Handoff

Un cop generat `tests/**`, informa l'orquestrador que l'Agent **DevOps** ja pot
integrar `npm run test` (amb cobertura) al pipeline de CI, i que l'Agent **Code
Reviewer** ja pot confiar en la suite per a la seva revisió.
