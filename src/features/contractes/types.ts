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

export const TIPUS_ACTUALITZACIO_OPTIONS = [
  { value: 'ipc', label: 'IPC' },
  { value: 'irav', label: 'Índex de referència de lloguers (IRAV)' },
  { value: 'percentatge_fix', label: 'Percentatge fix pactat' },
  { value: 'cap', label: 'Sense actualització' },
] as const;

export const TIPUS_CONCEPTE_OPTIONS = [
  { value: 'escombraries', label: "Taxa d'escombraries" },
  { value: 'comunitat', label: 'Comunitat' },
  { value: 'ibi', label: 'IBI' },
  { value: 'subministraments', label: 'Subministraments' },
  { value: 'altres', label: 'Altres' },
] as const;

export const TIPUS_GARANTIA_OPTIONS = [
  { value: 'aval_bancari', label: 'Aval bancari' },
  { value: 'diposit_addicional', label: 'Dipòsit addicional' },
  { value: 'asseguranca_impagament', label: "Assegurança d'impagament" },
  { value: 'altres', label: 'Altres' },
] as const;

export const MESOS = [
  'gener',
  'febrer',
  'març',
  'abril',
  'maig',
  'juny',
  'juliol',
  'agost',
  'setembre',
  'octubre',
  'novembre',
  'desembre',
] as const;

/** Nom llegible d'un concepte: el tipus, o la descripció si és "Altres". */
export function nomConcepte(tipus: string, descripcio: string | null): string {
  if (tipus === 'renda') return 'Renda';
  if (tipus === 'altres') return descripcio || 'Altres';
  const label = TIPUS_CONCEPTE_OPTIONS.find((o) => o.value === tipus)?.label ?? tipus;
  return descripcio ? `${label} (${descripcio})` : label;
}

/** Durada en mesos com a text: "5 anys", "18 mesos", "1 any". */
export function textDurada(mesos: number): string {
  if (mesos % 12 === 0) return mesos === 12 ? '1 any' : `${mesos / 12} anys`;
  return mesos === 1 ? '1 mes' : `${mesos} mesos`;
}
