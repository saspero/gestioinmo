export const TIPUS_US_OPTIONS = [
  { value: 'habitatge', label: 'Habitatge' },
  { value: 'local', label: 'Local' },
  { value: 'parking', label: 'Parking' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'altres', label: 'Altres' },
] as const;

export const ESTAT_CONTRACTE_OPTIONS = [
  { value: 'esborrany', label: 'Esborrany' },
  { value: 'actiu', label: 'Actiu' },
  { value: 'finalitzat', label: 'Finalitzat' },
  { value: 'resolt', label: 'Resolt' },
] as const;

// Reflecteix `src/features/propietats/types.ts::Unitat` — no hi ha `useListUnitats` a
// `src/hooks/`, es consulta amb `apiFetch` directament (docs/architecture.md §4: lectura
// de referència des d'un Client Component).
export interface UnitatDisponible {
  id: string;
  propietatId: string;
  referencia: string;
  estat: 'vacant' | 'ocupat' | 'reservat' | 'manteniment' | 'baixa';
}
