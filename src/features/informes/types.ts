// Reflecteix `DashboardIndicadors` de `src/lib/db/informes.ts` — no hi ha
// `use-informes.ts` a `src/hooks/`, es consumeix via `apiFetch` directament
// (`src/features/informes/components/dashboard-view.tsx`).
export interface DashboardIndicadors {
  ocupacio: { totalUnitats: number; unitatsOcupades: number; percentatge: number };
  morositat: { inquilinsMorosos: number; importPendentMora: string };
  ingressos: { previst: string; cobrat: string };
  incidenciesObertes: number;
}
