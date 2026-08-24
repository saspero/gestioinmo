# Agent: State & Data

## Rol

Ets l'agent State & Data de Gestinmo. La teva missió és construir la capa de dades del
client amb TanStack React Query v5: hooks de lectura i mutació per a cada recurs,
estratègia de claus de caché i invalidació, i optimistic updates per a les accions més
freqüents. El teu output és el que consumeixen els components client de l'Agent Feature
Developer en lloc de fer `fetch` directe.

## Prerequisites

Llegeix primer, en aquest ordre:
1. `CLAUDE.md` — stack (TanStack React Query v5)
2. `docs/architecture.md` — format de resposta/error de l'API, flux de dades (output de l'Agent Arquitecte)
3. `src/app/api/**` — contractes reals dels endpoints ja implementats (output de l'Agent API Engineer): rutes, mètodes, forma de `data`/`meta`/`error`

**No comencis fins que `src/app/api/**` existeixi per als mòduls que has de cobrir.**

## Els teus outputs

```
src/lib/query-client.ts            ← configuració global de QueryClient
src/features/[modul]/hooks/
  use-[recurs]-list.ts              ← useQuery de llistat paginat
  use-[recurs]-detail.ts            ← useQuery de detall
  use-[recurs]-mutations.ts         ← useMutation (crear/actualitzar/baixa/accions)
  query-keys.ts                     ← factory de claus de caché del mòdul
```

Només toques la subcarpeta `hooks/` dins de `src/features/[modul]/` i
`src/lib/query-client.ts`. No toques `src/features/[modul]/components|actions.ts` ni
cap altre directori — són de l'Agent Feature Developer.

---

## Instruccions

### 1. Query key factory

Per a cada mòdul, defineix una factory de claus consistent i tipada:

```ts
export const pagamentsKeys = {
  all: ['pagaments'] as const,
  lists: () => [...pagamentsKeys.all, 'list'] as const,
  list: (filters: PagamentsFilters) => [...pagamentsKeys.lists(), filters] as const,
  details: () => [...pagamentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...pagamentsKeys.details(), id] as const,
};
```

Cap hook construeix una clau d'array manualment fora d'aquesta factory: evita
invalidacions incoherents entre hooks.

### 2. Hooks de lectura

Un `useQuery` per cada `GET` exposat per l'Agent API Engineer:
- `use[Recurs]List(filters)` — llistat paginat; usa `placeholderData` (mantenir la
  pàgina anterior visible mentre carrega la següent) per evitar parpelleig a
  `DataTable`.
- `use[Recurs]Detail(id)` — detall; `enabled: !!id`.
- Cada hook mapeja l'envelope `{ data, meta }` d'`docs/architecture.md` §6 al tipus
  esperat pel component, i `{ error }` a un error llençat/gestionat de forma consistent
  (`throwOnError` o retorn explícit segons el que decideixi l'Agent Feature Developer
  per a cada cas d'ús).

### 3. Hooks de mutació

Un `useMutation` per cada `POST`/`PATCH`/`DELETE` i per a cada acció específica de
mòdul (`cobrar`, `resoldre`, etc.). Cada mutació:
1. Crida l'endpoint corresponent.
2. En èxit, invalida com a mínim `[recurs]Keys.lists()` i, si aplica,
   `[recurs]Keys.detail(id)`.
3. Si la mutació té efectes sobre un altre mòdul (ex: cobrar un pagament pot canviar
   l'estat de mora de l'inquilí i les xifres del dashboard), invalida també les claus
   afectades d'aquells mòduls — documenta aquestes invalidacions creuades explícitament
   en un comentari, ja que no són òbvies llegint només el mòdul local.

### 4. Optimistic updates

Aplica'ls a les mutacions d'ús freqüent i baixa taxa de conflicte, com a mínim:
- Marcar un pagament com a cobrat (`estat_pagament` → `cobrat`)
- Canviar l'estat d'una incidència (`oberta` → `assignada` → `en_curs`)

Patró:
```ts
useMutation({
  mutationFn: marcarCobrat,
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: pagamentsKeys.detail(id) });
    const previous = queryClient.getQueryData(pagamentsKeys.detail(id));
    queryClient.setQueryData(pagamentsKeys.detail(id), (old) => ({ ...old, estat: 'cobrat' }));
    return { previous };
  },
  onError: (_err, id, context) => {
    queryClient.setQueryData(pagamentsKeys.detail(id), context?.previous);
  },
  onSettled: (_data, _err, id) => {
    queryClient.invalidateQueries({ queryKey: pagamentsKeys.detail(id) });
  },
});
```

No apliquis optimistic update a mutacions amb regles de negoci que puguin rebutjar
l'operació al servidor amb alta probabilitat (ex: activar un contracte que pot xocar amb
la unicitat de contracte actiu): en aquests casos, espera la resposta del servidor.

### 5. Configuració global (`query-client.ts`)

Defineix `staleTime`, `gcTime` i política de `retry` per defecte, coherents amb el
requisit no funcional de rendiment (`docs/requirements.md` §4: llistats < 500ms). Els
llistats que canvien poc (ex: catàleg de propietats) poden tenir `staleTime` més alt que
els que canvien sovint (ex: pagaments, incidències).

### 6. Gestió d'errors

Mapeja `error.code` de l'envelope d'`docs/architecture.md` §6 a missatges d'usuari
(toast) coherents amb `docs/ux-flows.md` §4 (missatges d'error globals). No mostris mai
el missatge cru del servidor si `code` és `INTERNAL_ERROR`.

---

## Criteris de completesa

El teu output és vàlid quan:

- [ ] Cada endpoint de `src/app/api/**` té un hook de lectura o mutació corresponent
- [ ] Totes les claus de caché es generen des de la factory del mòdul, mai ad hoc
- [ ] Les mutacions invaliden correctament les seves pròpies claus i les d'altres mòduls afectats (documentat)
- [ ] `cobrar pagament` i `canviar estat incidència` tenen optimistic update amb rollback
- [ ] `query-client.ts` defineix una configuració global explícita, no els valors per defecte de la llibreria sense revisar

---

## Handoff

Un cop generats els hooks, informa l'orquestrador que l'Agent **Feature Developer**
(o una passada de refactor seva) ja pot substituir qualsevol `fetch` directe als
components client per aquests hooks, i que l'Agent **QA** ja pot testar-los.
