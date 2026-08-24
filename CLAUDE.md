# Gestinmo — Orquestrador

Portal de gestió immobiliària multitenant. Aquest fitxer és el punt d'entrada per a qualsevol sessió de Claude Code. Llegeix-lo sencer abans de fer res.

---

## Projecte

**Nom:** Gestinmo  
**Descripció:** Webapp de gestió immobiliària per a agències i propietaris. Cobreix propietats, propietaris, inquilins, contractes de lloguer, pagaments, incidències i informes. Portal del llogater com a última fase.  
**Repo:** https://github.com/saspero/gestioinmo  
**Deploy:** Vercel (gestioinmo.vercel.app)  
**Llicència:** GPL-3.0

---

## Stack tècnic

| Capa | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS + shadcn/ui |
| Llenguatge | TypeScript (strict mode) |
| BDD | PostgreSQL 16+ via Supabase |
| Accés BDD | Driver `pg` directe (NO Supabase client) |
| Auth | JWT custom amb `jose` + `bcryptjs` |
| Validació | Zod (totes les entrades i sortides d'API) |
| Dades client | TanStack React Query v5 |
| Tests | Vitest + Testing Library |
| Deploy | Vercel |
| CI/CD | GitHub Actions |

**Multitenancy:** esquema-per-tenant a PostgreSQL. Cada agència té el seu propi schema (`tenant_{id}`). RLS actiu a Supabase però tot l'accés passa pel driver `pg` directe amb credencials de servei.

---

## Estructura de fitxers

```
gestioinmo/
├── CLAUDE.md                        # Aquest fitxer (orquestrador)
├── docs/
│   ├── agents/
│   │   ├── AGENT_PRODUCT_OWNER.md
│   │   ├── AGENT_UX.md
│   │   ├── AGENT_ARQUITECTE.md
│   │   ├── AGENT_DATABASE.md
│   │   ├── AGENT_API.md
│   │   ├── AGENT_AUTH.md
│   │   ├── AGENT_UI_COMPONENTS.md
│   │   ├── AGENT_FEATURE.md
│   │   ├── AGENT_STATE.md
│   │   ├── AGENT_QA.md
│   │   ├── AGENT_DEVOPS.md
│   │   └── AGENT_REVIEWER.md
│   ├── requirements.md              # Output: Agent Product Owner
│   ├── architecture.md              # Output: Agent Arquitecte
│   ├── ux-flows.md                  # Output: Agent UX
│   └── db-schema.md                 # Output: Agent Database Engineer
├── db/
│   └── migrations/                  # Output: Agent Database Engineer
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   └── api/
│   ├── components/                  # Output: Agent UI Components
│   ├── features/                    # Output: Agent Feature Developer
│   ├── lib/
│   │   ├── db/                      # Connexions i queries base
│   │   ├── auth/                    # JWT helpers
│   │   └── validations/             # Schemas Zod compartits
│   └── types/                       # TypeScript interfaces globals
└── tests/                           # Output: Agent QA
```

---

## Mòduls funcionals

Ordre de desenvolupament (seqüencial per dependències):

1. **Auth & Multitenancy** — login, sessions JWT, creació de tenants
2. **Propietats** — immobles, unitats, característiques, estat
3. **Propietaris** — persones físiques/jurídiques, documents
4. **Inquilins** — registre, historial, documents
5. **Contractes** — alta, vigència, renovació, resolució
6. **Pagaments** — rebuts, remeses, morositat
7. **Incidències** — creació, assignació, seguiment, tancament
8. **Informes** — dashboard analític, exports
9. **Portal del llogater** — accés extern (última fase)

---

## Seqüència d'agents

Cada agent llegeix els outputs de l'anterior abans de generar res. Mai modificar fitxers fora del scope definit.

```
[Orquestrador] → rep la tasca i la descompon
      │
      ├─ Fase 1: Anàlisi i disseny
      │    ├─ Product Owner  → docs/requirements.md
      │    ├─ UX Designer    → docs/ux-flows.md
      │    └─ Arquitecte     → docs/architecture.md + docs/db-schema.md
      │
      ├─ Fase 2: Backend
      │    ├─ Database Eng.  → db/migrations/*.sql
      │    ├─ API Engineer   → src/app/api/**
      │    └─ Auth Specialist→ src/lib/auth/**
      │
      ├─ Fase 3: Frontend
      │    ├─ UI Components  → src/components/**
      │    ├─ Feature Dev.   → src/features/** + src/app/(dashboard)/**
      │    └─ State & Data   → React Query hooks + caché
      │
      └─ Fase 4: Qualitat i deploy
           ├─ QA / Testing   → tests/**
           ├─ DevOps         → .github/workflows/** + vercel config
           └─ Code Reviewer  → revisió cross-cutting
```

---

## Convencions de codi

### TypeScript
- `strict: true` sempre
- Cap `any` explícit — usar `unknown` i narrowing
- Interfaces per a entitats de domini, `type` per a unions i utils

### Zod
- Tots els inputs d'API validats amb Zod abans de tocar la BDD
- Schemas a `src/lib/validations/[domini].ts`
- Exportar el tipus inferit: `export type Propietat = z.infer<typeof propietatSchema>`

### Next.js App Router
- Server Components per defecte
- `'use client'` només quan calgui interactivitat
- Server Actions per a mutacions (no route handlers per a formularis)
- Route handlers (`/api/`) per a endpoints consumits externament o per React Query

### BDD
- Mai usar el client de Supabase — sempre `pg` directe
- Totes les queries a `src/lib/db/[domini].ts`
- Prepared statements obligatoris — zero interpolació de strings a SQL
- Sempre incloure `tenant_id` a les queries (multitenancy)

### Nomenclatura
- Fitxers: `kebab-case`
- Components: `PascalCase`
- Funcions/variables: `camelCase`
- Constants globals: `UPPER_SNAKE_CASE`
- Taules BDD: `snake_case` plural (ex: `propietats`, `contractes`)

### Git
- Commits en anglès, format: `type(scope): description`
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- Una PR per mòdul funcional

---

## Variables d'entorn

```bash
# .env.local (mai cometre)
DATABASE_URL=postgresql://...
JWT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# .env.example (cometre sense valors)
DATABASE_URL=
JWT_SECRET=
NEXT_PUBLIC_APP_URL=
```

---

## Com usar aquest sistema com a agent

Si estàs llegint aquest fitxer com a agent de Claude Code:

1. **Identifica el teu rol** — mira `docs/agents/AGENT_[ROL].md` per les teves instruccions específiques.
2. **Llegeix els prerequisites** — cada fitxer d'agent indica quins outputs d'altres agents necessites llegir primer.
3. **Genera NOMÉS el que et pertoca** — no toquis fitxers fora del teu scope.
4. **Documenta els teus outputs** — actualitza el fitxer de documentació corresponent a `docs/`.
5. **Reporta bloquejos** — si et falta informació d'un agent anterior, para i indica-ho explícitament.

---

## Estat del projecte

| Fase | Estat |
|---|---|
| Definició d'agents | ✅ Completat |
| Requirements | ⏳ Pendent |
| Arquitectura | ⏳ Pendent |
| BDD / Migracions | ⏳ Pendent |
| Auth | ⏳ Pendent |
| Mòduls funcionals | ⏳ Pendent |
| Tests | ⏳ Pendent |
| Deploy | ⏳ Pendent |
