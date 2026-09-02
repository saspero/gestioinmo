// Tipus propis del mòdul Propietats. `Unitat` no s'exporta des de cap hook de
// `src/hooks/` (no hi ha `use-propietats` per a unitats, només per a la propietat
// mateixa) — es defineix aquí i es consumeix via `apiFetch` directament
// (`src/hooks/api-client.ts`), seguint les mateixes convencions que els hooks existents.

export interface Unitat {
  id: string;
  propietatId: string;
  referencia: string;
  planta: string | null;
  porta: string | null;
  superficie: string | null;
  rendaBase: string | null;
  estat: 'vacant' | 'ocupat' | 'reservat' | 'manteniment' | 'baixa';
  createdAt: string;
  updatedAt: string;
}

export interface CrearUnitatInput {
  referencia: string;
  planta?: string;
  porta?: string;
  superficie?: number;
  rendaBase?: number;
}

export type ActualitzarUnitatInput = Partial<CrearUnitatInput> & { estat?: Unitat['estat'] };

export const TIPUS_PROPIETAT_OPTIONS = [
  { value: 'pis', label: 'Pis' },
  { value: 'edifici', label: 'Edifici' },
  { value: 'casa', label: 'Casa' },
  { value: 'local', label: 'Local' },
  { value: 'solar', label: 'Solar' },
  { value: 'altres', label: 'Altres' },
] as const;
