export const PRIORITAT_OPTIONS = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export const ESTAT_INCIDENCIA_OPTIONS = [
  { value: 'oberta', label: 'Oberta' },
  { value: 'assignada', label: 'Assignada' },
  { value: 'en_curs', label: 'En curs' },
  { value: 'resolta', label: 'Resolta' },
] as const;

// Transicions permeses des del PATCH genèric (`resolta` només via POST /resoldre,
// src/lib/validations/incidencies.ts).
export const ESTAT_INCIDENCIA_EDITABLE_OPTIONS = ESTAT_INCIDENCIA_OPTIONS.filter((o) => o.value !== 'resolta');

// Reflecteix `src/features/propietats/types.ts::Unitat` (mateix motiu: no hi ha
// `useListUnitats` a `src/hooks/`).
export interface UnitatOpcio {
  id: string;
  propietatId: string;
  referencia: string;
  estat: string;
}
